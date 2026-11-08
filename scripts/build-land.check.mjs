// [task-33] Geometry checks of the adaptive globe terrain, run by `npm run test:land`
// (scripts/build-land.mjs --check imports this after registering the TypeScript loader).
// Measures what the eye calls "cracks", "coast teeth", "terraces" and "seams" so they cannot
// silently come back, plus the per-preset triangle budget. Fixed seed 0xA1A1, no WebGL.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vector3 } from 'three';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0xA1A1;
/** Terrain triangle ceilings per preset (docs/PERFORMANCE.md). */
export const TERRAIN_BUDGET = { low: 45000, medium: 210000, high: 300000 };

export async function checkTerrain({ log = console.log } = {}) {
  const { decodeLandMask } = await import('../src/render/globe/land-mask.ts');
  const terrain = await import('../src/render/globe/terrain.ts');
  const { CITIES } = await import('../src/data/cities.ts');
  const mask = decodeLandMask(JSON.parse(readFileSync(resolve(ROOT, 'public/data/land-50m.json'), 'utf8')));
  let passed = 0, failed = 0;
  const check = (ok, label) => { if (ok) passed++; else { failed++; log('FAIL ' + label); } };
  const stats = {};

  for (const level of ['low', 'medium', 'high']) {
    const built = terrain.buildTerrainArrays(mask, level);
    const { positions, colors, land, finestDeg } = built;
    const triangles = built.stats.triangles;
    stats[level] = { triangles, buildMs: built.stats.buildMs, snapped: built.stats.snapped };
    check(triangles <= TERRAIN_BUDGET[level], `${level}: ${triangles} terrain triangles within budget ${TERRAIN_BUDGET[level]}`);

    // Watertight + consistently wound: every undirected edge shared by exactly two triangles,
    // each direction used once. Adaptive refinement with T-junctions would fail this.
    const keyOf = new Map();
    const vertexKey = (i) => {
      const k = Math.round(positions[i * 3] * 2e6) + ',' + Math.round(positions[i * 3 + 1] * 2e6) + ',' +
        Math.round(positions[i * 3 + 2] * 2e6);
      let id = keyOf.get(k);
      if (id === undefined) { id = keyOf.size; keyOf.set(k, id); }
      return id;
    };
    const ids = new Uint32Array(triangles * 3);
    for (let i = 0; i < ids.length; i++) ids[i] = vertexKey(i);
    const directed = new Map(), owner = new Map();
    let flipped = 0;
    for (let t = 0; t < triangles; t++) {
      for (let j = 0; j < 3; j++) {
        const a = ids[t * 3 + j], b = ids[t * 3 + (j + 1) % 3];
        const key = a * 4194304 + b;
        directed.set(key, (directed.get(key) ?? 0) + 1);
        owner.set(key, t);
      }
      // Folded triangles (snapping must never flip a facet inward).
      const o = t * 9;
      const ux = positions[o + 3] - positions[o], uy = positions[o + 4] - positions[o + 1], uz = positions[o + 5] - positions[o + 2];
      const vx = positions[o + 6] - positions[o], vy = positions[o + 7] - positions[o + 1], vz = positions[o + 8] - positions[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * positions[o] + ny * positions[o + 1] + nz * positions[o + 2] <= 0) flipped++;
    }
    let open = 0, doubled = 0;
    for (const [key, count] of directed) {
      if (count > 1) doubled++;
      const a = Math.floor(key / 4194304), b = key % 4194304;
      if (!directed.has(b * 4194304 + a)) open++;
    }
    check(open === 0, `${level}: watertight mesh (open edges ${open})`);
    check(doubled === 0, `${level}: consistent winding (duplicated directed edges ${doubled})`);
    check(flipped === 0, `${level}: no folded triangles (${flipped})`);

    // Coast "teeth": land triangles poking into the sea (2+ sea neighbours) and how far the
    // land/sea boundary edges stray from the smooth coastline.
    const neighbourSea = new Uint8Array(triangles);
    let boundary = 0, stray = 0;
    const p = new Vector3();
    for (const [key, t] of owner) {
      const a = Math.floor(key / 4194304), b = key % 4194304;
      const u = owner.get(b * 4194304 + a);
      if (u === undefined || land[t] === land[u]) continue;
      if (land[t]) neighbourSea[t]++;
      if (!land[t]) continue; // count each boundary edge once
      boundary++;
      const ia = ids.indexOf(a, t * 3), ib = ids.indexOf(b, t * 3);
      p.set(positions[ia * 3] + positions[ib * 3], positions[ia * 3 + 1] + positions[ib * 3 + 1],
        positions[ia * 3 + 2] + positions[ib * 3 + 2]).normalize();
      const lat = Math.asin(p.y) * 180 / Math.PI, lon = Math.atan2(p.x, p.z) * 180 / Math.PI;
      stray += Math.abs(mask.distanceAt(lon, lat));
    }
    let landTris = 0, teeth = 0;
    for (let t = 0; t < triangles; t++) if (land[t]) { landTris++; if (neighbourSea[t] >= 2) teeth++; }
    const strayRatio = stray / Math.max(1, boundary) / finestDeg;
    const teethShare = teeth / Math.max(1, landTris);
    stats[level].coastStray = +strayRatio.toFixed(3);
    stats[level].teethPct = +(teethShare * 100).toFixed(2);
    check(strayRatio < .2, `${level}: coastline follows the smooth contour (mean stray ${strayRatio.toFixed(3)} edge)`);
    check(teethShare < (level === 'low' ? .05 : .03), `${level}: coast teeth ${(teethShare * 100).toFixed(2)}% of land triangles`);

    // Terraces: neighbouring facets inside the sand seas must not jump in colour (the old
    // thresholded sand/desert biome did), and no facet pair anywhere in the Sahara box may show a
    // hard biome edge. Reference, old thresholded biomes on dev: p99 0.365, max 0.366 (all presets).
    const lum = (t) => colors[t * 9] * .2126 + colors[t * 9 + 1] * .7152 + colors[t * 9 + 2] * .0722;
    const centroid = (t, out) => {
      const o = t * 9;
      p.set(positions[o] + positions[o + 3] + positions[o + 6], positions[o + 1] + positions[o + 4] + positions[o + 7],
        positions[o + 2] + positions[o + 5] + positions[o + 8]).normalize();
      return terrain.sampleAt(Math.atan2(p.x, p.z) * 180 / Math.PI, Math.asin(p.y) * 180 / Math.PI, mask, out);
    };
    const sa = terrain.createSample(), sb = terrain.createSample();
    const core = [];
    let hardest = 0;
    for (const [key, t] of owner) {
      const a = Math.floor(key / 4194304), b = key % 4194304;
      const u = owner.get(b * 4194304 + a);
      if (u === undefined || u < t || !land[t] || !land[u]) continue;
      centroid(t, sa);
      if (sa.lat < 16 || sa.lat > 30 || sa.lon < -12 || sa.lon > 30) continue;
      centroid(u, sb);
      const step = Math.abs(lum(t) - lum(u)) / 65535;
      hardest = Math.max(hardest, step);
      if (sa.dry > .85 && sb.dry > .85) core.push(step);
    }
    core.sort((x, y) => x - y);
    const p99 = core[Math.floor(core.length * .99)] ?? 1;
    stats[level].saharaStepP99 = +p99.toFixed(4);
    stats[level].saharaStepMax = +hardest.toFixed(4);
    check(core.length > 50 && p99 < .05, `${level}: sand sea without terraces (p99 luminance step ${p99.toFixed(4)})`);
    check(hardest < .25, `${level}: no hard biome edge in the Sahara box (max step ${hardest.toFixed(4)})`);

    // Adaptive density: open-sea facets are much larger than coastal ones.
    let seaArea = 0, seaN = 0, coastArea = 0, coastN = 0;
    for (let t = 0; t < triangles; t += 3) {
      const o = t * 9;
      p.set(positions[o], positions[o + 1], positions[o + 2]).normalize();
      const lat = Math.asin(p.y) * 180 / Math.PI, lon = Math.atan2(p.x, p.z) * 180 / Math.PI;
      const d = mask.distanceAt(lon, lat);
      const ux = positions[o + 3] - positions[o], uy = positions[o + 4] - positions[o + 1], uz = positions[o + 5] - positions[o + 2];
      const vx = positions[o + 6] - positions[o], vy = positions[o + 7] - positions[o + 1], vz = positions[o + 8] - positions[o + 2];
      const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      if (d < -6 && Math.abs(lat) < 60) { seaArea += area; seaN++; } else if (Math.abs(d) < .2) { coastArea += area; coastN++; }
    }
    const ratio = (seaArea / Math.max(1, seaN)) / (coastArea / Math.max(1, coastN));
    stats[level].seaToCoastArea = +ratio.toFixed(1);
    check(ratio > 8, `${level}: open sea coarser than coasts (area ratio ${ratio.toFixed(1)})`);

    if (level === 'medium') {
      const again = terrain.buildTerrainArrays(mask, level);
      let same = again.positions.length === positions.length;
      for (let i = 0; same && i < positions.length; i++) same = again.positions[i] === positions[i];
      for (let i = 0; same && i < colors.length; i++) same = again.colors[i] === colors[i];
      check(same, 'medium: terrain build is deterministic');
    }
  }

  // Relief and biomes where they are in reality.
  const s = terrain.createSample();
  const peak = (lon, lat, field) => {
    let best = -1;
    for (let dy = -1; dy <= 1; dy += .25) for (let dx = -1; dx <= 1; dx += .25) {
      best = Math.max(best, terrain.sampleAt(lon + dx, lat + dy, mask, s)[field]);
    }
    return best;
  };
  const snowy = (lon, lat) => {
    let best = 0;
    for (let dy = -1; dy <= 1; dy += .25) for (let dx = -1; dx <= 1; dx += .25) {
      terrain.sampleAt(lon + dx, lat + dy, mask, s);
      const c = terrain.biomeColor(s, s.height);
      best = Math.max(best, Math.min(c.r, c.g, c.b));
    }
    return best > .7;
  };
  for (const [name, lon, lat] of [['Alps', 10, 46.5], ['Atlas', -6, 32], ['Scandes', 13, 65], ['Andes', -70, -32],
    ['Himalaya', 86.9, 28], ['Rockies', -108, 42]]) {
    check(peak(lon, lat, 'height') > .01, `mountains: ${name} rises (${peak(lon, lat, 'height').toFixed(4)})`);
  }
  for (const [name, lon, lat] of [['Sahara', 10, 24], ['Amazon', -60, -5], ['Poland', 19, 52], ['Siberia', 80, 60]]) {
    check(peak(lon, lat, 'height') < .007, `lowland: ${name} stays low (${peak(lon, lat, 'height').toFixed(4)})`);
    check(!snowy(lon, lat), `no snow: ${name}`);
  }
  for (const [name, lon, lat] of [['Himalaya', 86.9, 28], ['Alps', 10, 46.5], ['Greenland', -40, 75], ['Antarctica', 40, -80]]) {
    check(snowy(lon, lat), `snow: ${name}`);
  }
  // Arctic cap: solid pack ice around the pole and no seam across the antimeridian.
  let seam = 0, holes = 0, cells = 0;
  for (let lat = 82; lat <= 89.5; lat += .5) {
    for (let lon = -180; lon < 180; lon += 2) {
      cells++;
      if (terrain.sampleAt(lon, lat, mask, s).ice < .5) holes++;
    }
    const a = terrain.sampleAt(179.999, lat, mask, s);
    const ca = terrain.biomeColor(a, a.height).clone();
    const b = terrain.sampleAt(-179.999, lat, mask, s);
    const cb = terrain.biomeColor(b, b.height);
    seam = Math.max(seam, Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b), Math.abs(a.height - b.height) * 100);
  }
  // Leads (open-water cracks) are allowed; a hole in the cap or a missing cap is not.
  check(holes / cells < .03, `arctic: pack ice covers north of 82° (${holes}/${cells} open-water samples)`);
  check(seam < .01, `arctic: no antimeridian seam (${seam.toFixed(5)})`);
  // South Pole: solid land, no ring of raster-artefact sea around the pole.
  let polarSea = 0;
  for (let lat = -84.6; lat > -90; lat -= .3) for (let lon = -180; lon < 180; lon += 3) if (mask.distanceAt(lon, lat) <= 0) polarSea++;
  check(polarSea === 0, `antarctica: no sea south of 84.6°S (${polarSea} samples)`);
  // Airports: terrain never rises above the pads (1.0055).
  let worst = 0;
  for (const city of CITIES) worst = Math.max(worst, terrain.terrainHeight(city.lon, city.lat, mask));
  check(worst < .0045, `airports: terrain below every pad (max ${worst.toFixed(4)})`);

  // [ext-04 E4] Decorations (trees, rocks) went with the diorama/satellite looks (D-285); the print has none.
  return { passed, failed, stats };
}

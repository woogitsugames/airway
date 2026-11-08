// [task-03] Build the deterministic low-poly globe's Natural Earth 50m land raster.
// Produces compact RLE scanlines, not browser-time TopoJSON/canvas polygon rendering.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = require.resolve('world-atlas/land-50m.json');
const DEST = resolve(ROOT, 'public/data/land-50m.json');
const WIDTH = 2048, HEIGHT = 1024;

export function rasterizeLand(topo, width = WIDTH, height = HEIGHT) {
  if (topo.type !== 'Topology' || !topo.transform || !topo.objects?.land) {
    throw new TypeError('Expected Natural Earth world-atlas land TopoJSON');
  }
  const bits = new Uint8Array(width * height);
  const cache = new Map();
  const { scale, translate } = topo.transform;
  const arc = (index) => {
    const id = index < 0 ? ~index : index;
    let points = cache.get(id);
    if (!points) {
      let x = 0, y = 0;
      points = topo.arcs[id].map(([dx, dy]) => {
        x += dx; y += dy;
        return [(x * scale[0] + translate[0] + 180) * width / 360,
          (90 - y * scale[1] - translate[1]) * height / 180];
      });
      cache.set(id, points);
    }
    return index < 0 ? [...points].reverse() : points;
  };
  const ring = (ids) => {
    const points = [];
    let previousX = null;
    for (const id of ids) {
      const samples = arc(id);
      for (let i = points.length ? 1 : 0; i < samples.length; i++) {
        let x = samples[i][0];
        if (previousX !== null) {
          while (x - previousX > width / 2) x -= width;
          while (x - previousX < -width / 2) x += width;
        }
        points.push([x, samples[i][1]]);
        previousX = x;
      }
    }
    const intersections = new Map();
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
      if (y0 === y1) continue;
      const first = Math.max(0, Math.ceil(Math.min(y0, y1) - .5));
      const end = Math.min(height, Math.ceil(Math.max(y0, y1) - .5));
      for (let y = first; y < end; y++) {
        let xs = intersections.get(y);
        if (!xs) { xs = []; intersections.set(y, xs); }
        xs.push(x0 + (y + .5 - y0) * (x1 - x0) / (y1 - y0));
      }
    }
    for (const [y, xs] of intersections) {
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.ceil(xs[i] - .5), b = Math.ceil(xs[i + 1] - .5);
        for (const shift of [-width, 0, width]) {
          const from = Math.max(0, a + shift), to = Math.min(width, b + shift);
          for (let x = from; x < to; x++) bits[y * width + x] ^= 1;
        }
      }
    }
  };
  const geometry = (g) => {
    if (g.type === 'GeometryCollection') g.geometries.forEach(geometry);
    else if (g.type === 'Polygon') g.arcs.forEach(ring);
    else if (g.type === 'MultiPolygon') g.arcs.forEach((poly) => poly.forEach(ring));
    else throw new TypeError('Unsupported geometry: ' + g.type);
  };
  geometry(topo.objects.land);
  // At the South Pole Natural Earth's antimeridian closure needs an explicit
  // polar cap in planar raster coordinates (the spherical fill does this implicitly).
  // [task-33] From 84.4°S: the three rows just north of 85°S came out as sea (XOR closure artefact),
  // which drew a ring around the South Pole on the terrain.
  bits.fill(1, Math.floor(174.4 / 180 * height) * width);
  const rows = [], stats = { land: 0, runs: 0 };
  for (let y = 0; y < height; y++) {
    const row = [];
    let prev = 0;
    for (let x = 0; x < width; x++) {
      const bit = bits[y * width + x];
      stats.land += bit;
      if (bit !== prev) { row.push(x); prev = bit; }
    }
    if (prev) row.push(width);
    stats.runs += row.length / 2;
    rows.push(row);
  }
  return { data: { format: 'airway-land-rle-v1', width, height, rows }, stats };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const atlas = JSON.parse(readFileSync(SOURCE, 'utf8'));
    const { data, stats } = rasterizeLand(atlas);
    const contents = JSON.stringify(data) + '\n';
    const check = process.argv.includes('--check');
    if (check) {
      if (readFileSync(DEST, 'utf8') !== contents) throw new Error('Generated land raster is stale');
    } else {
      mkdirSync(dirname(DEST), { recursive: true });
      writeFileSync(DEST, contents, 'utf8');
    }
    // [task-33] --check also builds the adaptive terrain and decorations and measures them.
    let terrain = '';
    let failed = 0;
    if (check) {
      await import('./ts-test-loader.mjs');
      const { checkTerrain } = await import('./build-land.check.mjs');
      const result = await checkTerrain();
      failed = result.failed;
      for (const [level, s] of Object.entries(result.stats)) console.log(`terrain ${level} ${JSON.stringify(s)}`);
      const m = result.stats.medium;
      terrain = ` checks=${result.passed + result.failed} tris=${result.stats.low.triangles}/${m.triangles}/` +
        `${result.stats.high.triangles} teethPct=${m.teethPct} saharaStepP99=${m.saharaStepP99}`;
    }
    console.log('SUMMARY build-land seed=0xA1A1 width=' + WIDTH + ' height=' + HEIGHT +
      ' land=' + stats.land + ' runs=' + stats.runs + ' bytes=' + Buffer.byteLength(contents) +
      ' checked=' + (check ? 1 : 0) + terrain + ' failed=' + failed);
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    console.log('SUMMARY build-land seed=0xA1A1 failed=1');
    process.exitCode = 1;
  }
}

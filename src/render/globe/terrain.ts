// [task-33] Adaptive low-poly terrain: an icosphere refined by edge, so it is crack-free (both
// triangles sharing an edge always agree on splitting it). Dense along coasts, mountains and the
// pack-ice edge, medium on land, coarse on the open sea. Coast vertices are snapped onto the
// smooth signed-distance contour so the shoreline has no raster "teeth"; heights and biome
// colours are continuous fields (no thresholded terraces).
import {
  BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Mesh, MeshStandardMaterial,
} from 'three';
import { CITIES } from '../../data/cities';
import type { LandMask } from './land-mask';
import { drynessAt, mountainAt } from './relief';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface TerrainQuality {
  /** Icosphere subdivision of the coarse (open-sea) mesh. */
  readonly detail: number;
  /** Extra edge-bisection levels at coasts / mountains; land gets `depth - 1`. */
  readonly depth: number;
  /** Bisection levels on the open sea (0 = base mesh); coastal water gets one more. */
  readonly sea: number;
}
interface Position { readonly x: number; readonly y: number; readonly z: number }

export const TERRAIN_QUALITY: Record<QualityLevel, TerrainQuality> = {
  low: { detail: 17, depth: 2, sea: 0 },
  medium: { detail: 23, depth: 3, sea: 1 },
  high: { detail: 28, depth: 3, sea: 1 },
};

const PALETTE = {
  deep: new Color('#1f5f86'), sea: new Color('#2f86a8'), shallow: new Color('#4aa3b8'),
  sand: new Color('#e6cf91'), grass: new Color('#86b35a'), forest: new Color('#4f8a45'),
  jungle: new Color('#3d7a3c'), desert: new Color('#dcb36e'), rock: new Color('#9a8f7c'),
  snow: new Color('#f3f1ea'), tundra: new Color('#a9b48c'), steppe: new Color('#b7b06a'),
  taiga: new Color('#3f7346'), ice: new Color('#e4ecee'), iceShadow: new Color('#c9d9de'),
};
const DEG = Math.PI / 180;
/** Heights above the unit sphere (globe radius = 1). Airport pads sit at 1.0055. */
const H = { coast: .0012, lowland: .0034, hills: .0026, mountain: .024, deep: -.0045, ice: .0022, airport: .0036 };

// ---- deterministic value noise (render-only decoration, not simulation) ----------------------
function hash(x: number, y: number, z: number): number {
  let v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h000 = hash(ix, iy, iz), h100 = hash(ix + 1, iy, iz), h010 = hash(ix, iy + 1, iz), h110 = hash(ix + 1, iy + 1, iz);
  const h001 = hash(ix, iy, iz + 1), h101 = hash(ix + 1, iy, iz + 1);
  const h011 = hash(ix, iy + 1, iz + 1), h111 = hash(ix + 1, iy + 1, iz + 1);
  const x00 = h000 + (h100 - h000) * u, x10 = h010 + (h110 - h010) * u;
  const x01 = h001 + (h101 - h001) * u, x11 = h011 + (h111 - h011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
/** Smooth 0..1 fbm on the unit sphere (feature size ~20° / 8° / 3°). */
export function terrainNoise(v: Position): number {
  return noise(v.x * 3, v.y * 3, v.z * 3) * .55 +
    noise(v.x * 7, v.y * 7, v.z * 7) * .3 +
    noise(v.x * 17, v.y * 17, v.z * 17) * .15;
}
function ridge(x: number, y: number, z: number): number {
  const a = 1 - Math.abs(noise(x * 28, y * 28, z * 28) * 2 - 1);
  const b = 1 - Math.abs(noise(x * 61 + 7, y * 61, z * 61) * 2 - 1);
  return a * .65 + b * .35;
}
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const smooth = smoothstep;

// Airports sit on fixed-height pads: the terrain is flattened in a small disc around every city.
// Cities bucketed by 2° latitude bands so a lookup checks only the neighbouring bands.
const CITY_BANDS: { lon: number; lat: number; k: number }[][] = Array.from({ length: 91 }, () => []);
for (const c of CITIES) {
  const point = { lon: c.lon, lat: c.lat, k: Math.cos(c.lat * DEG) };
  const band = Math.floor((c.lat + 90) / 2);
  for (let b = band - 1; b <= band + 1; b++) if (b >= 0 && b < CITY_BANDS.length) CITY_BANDS[b].push(point);
}
/** 1 on an airport pad, fading to 0 at 1.4° from any dataset city. */
export function airportFlatten(lon: number, lat: number): number {
  let flat = 0;
  const band = CITY_BANDS[Math.max(0, Math.min(CITY_BANDS.length - 1, Math.floor((lat + 90) / 2)))];
  for (const c of band) {
    const dy = lat - c.lat;
    if (dy > 1.4 || dy < -1.4) continue;
    let dx = lon - c.lon;
    if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
    dx *= c.k;
    if (dx > 1.4 || dx < -1.4) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1.96) flat = Math.max(flat, 1 - smooth(.7, 1.4, Math.sqrt(d2)));
  }
  return flat;
}

/** Everything the mesh, colours and decorations need about one surface point. */
export interface SurfaceSample {
  lon: number; lat: number;
  /** Signed coast distance, degrees (+ land). */
  dist: number;
  /** Smooth 0..1 fbm. */
  noise: number;
  /** Relative mountain elevation 0..~1.2 (ridged, flattened at airports). */
  mountain: number;
  /** 0..1 desert weight. */
  dry: number;
  /** 0..1 sea-ice / ice-sheet weight. */
  ice: number;
  /** Height above the unit sphere. */
  height: number;
}
export function createSample(): SurfaceSample {
  return { lon: 0, lat: 0, dist: 0, noise: 0, mountain: 0, dry: 0, ice: 0, height: 0 };
}

/** Sample the terrain fields at a unit vector (writes into `out`). */
export function sampleSurface(x: number, y: number, z: number, mask: LandMask, out: SurfaceSample): SurfaceSample {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) / DEG;
  const lon = Math.atan2(x, z) / DEG;
  const dist = mask.distanceAt(lon, lat);
  const n = terrainNoise({ x, y, z });
  out.lon = lon; out.lat = lat; out.dist = dist; out.noise = n;
  const a = Math.abs(lat);
  if (dist > 0) {
    const flat = airportFlatten(lon, lat);
    const relief = mountainAt(lon, lat);
    const mountain = relief > 0 ? relief * (.45 + .75 * ridge(x, y, z)) * (1 - flat) : 0;
    const shore = smooth(0, .9, dist);
    const hills = H.lowland + H.hills * smooth(.35, .8, n) * (1 - flat);
    // Ice sheets: Greenland and Antarctica are smooth white domes.
    const sheet = lat < -60 ? smooth(-62, -68, lat) : (lon > -75 && lon < -10 && lat > 59) ? smooth(59, 66, lat) : 0;
    out.mountain = mountain;
    out.dry = drynessAt(lon, lat, noise(x * 9, y * 9, z * 9));
    out.ice = Math.max(sheet, a > 72 ? smooth(72, 78, a) : 0);
    out.height = H.coast + (hills - H.coast + mountain * H.mountain + sheet * .006) * shore;
    if (flat > 0) out.height += (Math.min(out.height, H.airport) - out.height) * flat;
  } else {
    // Pack ice: a frayed northern cap and the Antarctic fringe; floes break up the edge.
    const fray = (noise(x * 11, y * 11, z * 11) - .5) * 9;
    const ice = lat > 0 ? smooth(77.5, 80.5, lat + fray) : smooth(-66.5, -69.5, lat - fray);
    out.mountain = 0; out.dry = 0; out.ice = ice;
    const sea = H.coast + (H.deep - H.coast) * smooth(0, 3, -dist);
    out.height = sea + (H.ice - sea) * smooth(.35, .6, ice);
  }
  return out;
}

const S = createSample();
/** Smooth surface height at lon/lat (decorations; matches the mesh up to its facet size). */
export function terrainHeight(lon: number, lat: number, mask: LandMask): number {
  return sampleAt(lon, lat, mask, S).height;
}
export function sampleAt(lon: number, lat: number, mask: LandMask, out: SurfaceSample): SurfaceSample {
  const c = Math.cos(lat * DEG);
  return sampleSurface(Math.sin(lon * DEG) * c, Math.sin(lat * DEG), Math.cos(lon * DEG) * c, mask, out);
}

const OUT = new Color();
/** Biome colour from smooth weights (linear working space), written into a shared Color. */
export function biomeColor(s: SurfaceSample, h: number): Color {
  const a = Math.abs(s.lat), n = s.noise;
  if (s.dist <= 0) {
    if (s.ice > .5) return OUT.copy(PALETTE.ice).lerp(PALETTE.iceShadow, smooth(.5, .9, 1.25 - s.ice + (n - .5) * .5));
    const shelf = smooth(-1.3, -.1, s.dist);
    OUT.copy(PALETTE.deep).lerp(PALETTE.sea, Math.min(1, smooth(-3.5, -.8, s.dist) * .8 + (n - .5) * .1));
    return OUT.lerp(PALETTE.shallow, shelf * .9);
  }
  // Base vegetation by latitude, then dryness, then altitude.
  if (a < 14) OUT.copy(PALETTE.jungle).lerp(PALETTE.grass, smooth(8, 14, a) * .6);
  else OUT.copy(PALETTE.grass).lerp(PALETTE.forest, smooth(.42, .62, n));
  OUT.lerp(PALETTE.taiga, smooth(50, 57, a) * (1 - smooth(63, 68, a)));
  OUT.lerp(PALETTE.tundra, smooth(62, 68, a + (n - .5) * 6));
  if (s.dry > 0) {
    OUT.lerp(PALETTE.steppe, smooth(0, .45, s.dry));
    OUT.lerp(PALETTE.desert, smooth(.35, .8, s.dry));
    OUT.lerp(PALETTE.sand, smooth(.75, 1, s.dry) * smooth(.3, .85, n));
  }
  // Beaches: a thin sand rim, not on cold coasts.
  OUT.lerp(PALETTE.sand, (1 - smooth(.05, .3, s.dist)) * .55 * (1 - smooth(45, 58, a)));
  // Rock then snow: the snowline falls with latitude (tropical highlands stay rock longer).
  const rockAt = .12, snowAt = .32 + .3 * (1 - smooth(25, 60, a)) + (n - .5) * .08;
  OUT.lerp(PALETTE.rock, smooth(rockAt, rockAt + .1, s.mountain) * (1 - s.ice));
  OUT.lerp(PALETTE.snow, Math.max(smooth(snowAt, snowAt + .06, s.mountain), s.ice));
  // Gentle per-facet shade so flat plains still read as low-poly.
  return OUT.multiplyScalar(.96 + n * .05 + (h - H.lowland) * 1.5);
}

/**
 * Refinement level a vertex asks for (cheap: no noise); an edge splits at depth d when either
 * end or its midpoint wants more than d. Coasts, mountains and the ice edge get the full depth.
 */
function levelAt(x: number, y: number, z: number, mask: LandMask, q: TerrainQuality, coastBand: number): number {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) / DEG;
  const lon = Math.atan2(x, z) / DEG;
  const d = mask.distanceAt(lon, lat);
  if (Math.abs(d) < coastBand) return q.depth;
  if (d > 0) return mountainAt(lon, lat) > .04 ? q.depth : q.depth - 1;
  if (lat > 72 || lat < -61) return Math.max(1, q.depth - 1);
  return Math.min(q.depth - 1, d > -2.5 ? q.sea + 1 : q.sea);
}

/** Geometry statistics for tests and docs/PERFORMANCE.md. */
export interface TerrainStats { triangles: number; vertices: number; snapped: number; buildMs: number }
export interface TerrainArrays {
  /** Non-indexed xyz, 3 vertices per triangle. */
  readonly positions: Float32Array;
  /** Normalised 16-bit linear RGB per vertex (flat per triangle). */
  readonly colors: Uint16Array;
  /** 1 when the triangle's centroid is land. */
  readonly land: Uint8Array;
  /** Finest edge length, degrees. */
  readonly finestDeg: number;
  readonly stats: TerrainStats;
}

/** Builds the terrain arrays (non-indexed, flat colours). Pure function of mask + level. */
export function buildTerrainArrays(mask: LandMask, level: QualityLevel): TerrainArrays {
  const started = Date.now();
  const q = TERRAIN_QUALITY[level];
  const finest = 63.435 / (q.detail + 1) / (1 << q.depth); // degrees
  const coastBand = finest * 1.25;
  // Vertex table: unit direction + requested level (from the unsnapped position).
  const px: number[] = [], py: number[] = [], pz: number[] = [], lv: number[] = [];
  const midKey = new Map<number, number>();
  const tmp = createSample();
  const addVertex = (x: number, y: number, z: number): number => {
    const m = 1 / Math.hypot(x, y, z);
    x *= m; y *= m; z *= m;
    px.push(x); py.push(y); pz.push(z);
    lv.push(levelAt(x, y, z, mask, q, coastBand));
    return px.length - 1;
  };
  const middle = (a: number, b: number): number => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    let id = midKey.get(key);
    if (id === undefined) {
      id = addVertex(px[a] + px[b], py[a] + py[b], pz[a] + pz[b]);
      midKey.set(key, id);
    }
    return id;
  };
  const tris: number[] = [];
  const refine = (a: number, b: number, c: number, depth: number): void => {
    if (depth >= q.depth) { tris.push(a, b, c); return; }
    const want = (u: number, v: number): boolean => lv[u] > depth || lv[v] > depth || lv[middle(u, v)] > depth;
    const sab = want(a, b), sbc = want(b, c), sca = want(c, a);
    const count = +sab + +sbc + +sca;
    if (count === 0) { tris.push(a, b, c); return; }
    const next = depth + 1;
    if (count === 3) {
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
      refine(a, ab, ca, next); refine(ab, b, bc, next); refine(ca, bc, c, next); refine(ab, bc, ca, next);
      return;
    }
    // Rotate so the split pattern is canonical: one split on (A,B), or two on (A,B) + (B,C).
    let A = a, B = b, C = c;
    if (count === 1) {
      if (sbc) { A = b; B = c; C = a; } else if (sca) { A = c; B = a; C = b; }
      const m = middle(A, B);
      refine(A, m, C, next); refine(m, B, C, next);
      return;
    }
    if (!sab) { A = b; B = c; C = a; } else if (!sbc) { A = c; B = a; C = b; }
    const m1 = middle(A, B), m2 = middle(B, C);
    refine(m1, B, m2, next);
    // The quad A-m1-m2-C is cut along its shorter diagonal (an interior edge: no neighbour to agree with).
    const d1 = (px[A] - px[m2]) ** 2 + (py[A] - py[m2]) ** 2 + (pz[A] - pz[m2]) ** 2;
    const d2 = (px[m1] - px[C]) ** 2 + (py[m1] - py[C]) ** 2 + (pz[m1] - pz[C]) ** 2;
    if (d1 <= d2) { refine(A, m1, m2, next); refine(A, m2, C, next); } else { refine(A, m1, C, next); refine(m1, m2, C, next); }
  };

  const base = new IcosahedronGeometry(1, q.detail);
  const attr = base.getAttribute('position');
  const baseIds = new Map<string, number>();
  const baseId = (i: number): number => {
    const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i);
    const key = Math.round(x * 1e6) + ',' + Math.round(y * 1e6) + ',' + Math.round(z * 1e6);
    let id = baseIds.get(key);
    if (id === undefined) { id = addVertex(x, y, z); baseIds.set(key, id); }
    return id;
  };
  for (let i = 0; i < attr.count; i += 3) refine(baseId(i), baseId(i + 1), baseId(i + 2), 0);
  base.dispose();

  // Final vertex positions: snap near-coast vertices onto the zero contour, then sample height.
  const vertexCount = px.length;
  const fx = new Float64Array(vertexCount), fy = new Float64Array(vertexCount), fz = new Float64Array(vertexCount);
  const fh = new Float64Array(vertexCount);
  const snapLimit = finest * .45, step = finest * .25;
  const used = new Uint8Array(vertexCount);
  for (const v of tris) used[v] = 1;
  let snapped = 0, usedCount = 0;
  for (let i = 0; i < vertexCount; i++) {
    if (!used[i]) continue;
    usedCount++;
    let x = px[i], y = py[i], z = pz[i];
    const lat = Math.asin(Math.max(-1, Math.min(1, y))) / DEG, lon = Math.atan2(x, z) / DEG;
    const dist = mask.distanceAt(lon, lat);
    if (Math.abs(dist) < snapLimit && Math.abs(lat) < 86) {
      const k = Math.cos(lat * DEG);
      const gx = (mask.distanceAt(lon + step / k, lat) - mask.distanceAt(lon - step / k, lat)) / (2 * step);
      const gy = (mask.distanceAt(lon, lat + step) - mask.distanceAt(lon, lat - step)) / (2 * step);
      const g2 = gx * gx + gy * gy;
      if (g2 > .04) {
        let mx = -dist * gx / g2, my = -dist * gy / g2;
        const len = Math.hypot(mx, my);
        if (len > snapLimit) { mx *= snapLimit / len; my *= snapLimit / len; }
        const nlat = lat + my, nlon = lon + mx / k;
        const c = Math.cos(nlat * DEG);
        x = Math.sin(nlon * DEG) * c; y = Math.sin(nlat * DEG); z = Math.cos(nlon * DEG) * c;
        snapped++;
      }
    }
    fx[i] = x; fy[i] = y; fz[i] = z;
  }
  // A snap must never fold a facet: where one does, put that facet's vertices back.
  for (let pass = 0; pass < 4; pass++) {
    let folded = 0;
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const ux = fx[b] - fx[a], uy = fy[b] - fy[a], uz = fz[b] - fz[a];
      const vx = fx[c] - fx[a], vy = fy[c] - fy[a], vz = fz[c] - fz[a];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * (fx[a] + fx[b] + fx[c]) + ny * (fy[a] + fy[b] + fy[c]) + nz * (fz[a] + fz[b] + fz[c]) > 1e-12) continue;
      folded++;
      for (const v of [a, b, c]) {
        if (fx[v] !== px[v] || fy[v] !== py[v] || fz[v] !== pz[v]) snapped--;
        fx[v] = px[v]; fy[v] = py[v]; fz[v] = pz[v];
      }
    }
    if (!folded) break;
  }
  for (let i = 0; i < vertexCount; i++) if (used[i]) fh[i] = sampleSurface(fx[i], fy[i], fz[i], mask, tmp).height;

  const triangles = tris.length / 3;
  const positions = new Float32Array(tris.length * 3);
  const colors = new Uint16Array(tris.length * 3);
  const land = new Uint8Array(triangles);
  const center = createSample();
  for (let t = 0; t < triangles; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    // Biome and land/sea class come from the facet centroid (flat colour per facet).
    const cx = fx[a] + fx[b] + fx[c], cy = fy[a] + fy[b] + fy[c], cz = fz[a] + fz[b] + fz[c];
    const m = 1 / Math.hypot(cx, cy, cz);
    sampleSurface(cx * m, cy * m, cz * m, mask, center);
    land[t] = center.dist > 0 ? 1 : 0;
    const color = biomeColor(center, (fh[a] + fh[b] + fh[c]) / 3);
    const r = Math.round(Math.max(0, Math.min(1, color.r)) * 65535);
    const g = Math.round(Math.max(0, Math.min(1, color.g)) * 65535);
    const bl = Math.round(Math.max(0, Math.min(1, color.b)) * 65535);
    for (let j = 0; j < 3; j++) {
      const v = tris[t * 3 + j], o = (t * 3 + j) * 3, radius = 1 + fh[v];
      positions[o] = fx[v] * radius; positions[o + 1] = fy[v] * radius; positions[o + 2] = fz[v] * radius;
      colors[o] = r; colors[o + 1] = g; colors[o + 2] = bl;
    }
  }
  return { positions, colors, land, finestDeg: finest,
    stats: { triangles, vertices: usedCount, snapped, buildMs: Date.now() - started } };
}

export function createTerrain(mask: LandMask, level: QualityLevel): Mesh {
  const { positions, colors, stats } = buildTerrainArrays(mask, level);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3, true));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: .92, metalness: 0,
  }));
  mesh.name = 'AirwayTerrain';
  mesh.receiveShadow = true;
  mesh.userData['triangles'] = stats.triangles;
  mesh.userData['buildMs'] = stats.buildMs;
  return mesh;
}

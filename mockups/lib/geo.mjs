// Shared mockup helpers: orthographic globe, land outlines, great-circle routes, day/night terminator.
// Stage-0 tooling only (generates static SVG strings in Node); the real renderer will reuse the same maths.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoOrthographic, geoPath, geoGraticule10, geoCircle, geoInterpolate, geoDistance, geoRotation } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const atlas = (name) => JSON.parse(readFileSync(require.resolve(`world-atlas/${name}`), 'utf8'));
export const land110 = feature(atlas('land-110m.json'), atlas('land-110m.json').objects.land);
export const land50 = feature(atlas('land-50m.json'), atlas('land-50m.json').objects.land);

/** Fictional-but-real-coordinate city set used by every mockup (lon, lat). */
export const CITIES = {
  WAW: { name: 'Warszawa', en: 'Warsaw', lon: 21.0, lat: 52.2 },
  LIS: { name: 'Lizbona', en: 'Lisbon', lon: -9.1, lat: 38.7 },
  LON: { name: 'Londyn', en: 'London', lon: -0.1, lat: 51.5 },
  REK: { name: 'Reykjavík', en: 'Reykjavík', lon: -21.9, lat: 64.1 },
  CAI: { name: 'Kair', en: 'Cairo', lon: 31.2, lat: 30.0 },
  IST: { name: 'Stambuł', en: 'Istanbul', lon: 28.9, lat: 41.0 },
  NYC: { name: 'Nowy Jork', en: 'New York', lon: -74.0, lat: 40.7 },
  MTL: { name: 'Montreal', en: 'Montreal', lon: -73.6, lat: 45.5 },
  DKR: { name: 'Dakar', en: 'Dakar', lon: -17.4, lat: 14.7 },
  LOS: { name: 'Lagos', en: 'Lagos', lon: 3.4, lat: 6.5 },
  ROM: { name: 'Rzym', en: 'Rome', lon: 12.5, lat: 41.9 },
  OSL: { name: 'Oslo', en: 'Oslo', lon: 10.7, lat: 59.9 },
  MAD: { name: 'Madryt', en: 'Madrid', lon: -3.7, lat: 40.4 },
  ACC: { name: 'Akra', en: 'Accra', lon: -0.2, lat: 5.6 },
  CMN: { name: 'Casablanca', en: 'Casablanca', lon: -7.6, lat: 33.6 },
  KIV: { name: 'Kijów', en: 'Kyiv', lon: 30.5, lat: 50.4 },
  BOG: { name: 'Bogota', en: 'Bogotá', lon: -74.1, lat: 4.7 },
  REC: { name: 'Recife', en: 'Recife', lon: -34.9, lat: -8.1 },
};

export function makeGlobe({ cx, cy, r, rotate = [-5, -38, 0] }) {
  const proj = geoOrthographic().translate([cx, cy]).scale(r).rotate(rotate).clipAngle(90).precision(0.3);
  const path = geoPath(proj);
  const center = [-rotate[0], -rotate[1]];
  const visible = (lon, lat) => geoDistance([lon, lat], center) < Math.PI / 2 - 0.02;
  const pt = (lon, lat) => proj([lon, lat]);
  const city = (code) => { const c = CITIES[code]; return { ...c, code, xy: pt(c.lon, c.lat), vis: visible(c.lon, c.lat) }; };
  const sphere = () => path({ type: 'Sphere' });
  const land = (detail = 110) => path(detail === 50 ? land50 : land110);
  const graticule = () => path(geoGraticule10());
  /** Great-circle route as an SVG path (clipped at the horizon). */
  const route = (a, b) => path({ type: 'LineString', coordinates: [[CITIES[a].lon, CITIES[a].lat], [CITIES[b].lon, CITIES[b].lat]] });
  /** Point at fraction t along the great circle a→b plus heading (degrees, screen space). */
  const along = (a, b, t) => {
    const A = [CITIES[a].lon, CITIES[a].lat], B = [CITIES[b].lon, CITIES[b].lat];
    const f = geoInterpolate(A, B);
    const p = proj(f(t)), q = proj(f(Math.min(1, t + 0.01)));
    return { x: p[0], y: p[1], deg: Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI };
  };
  /** Night hemisphere for a subsolar point; radius 90 = terminator, other radii = twilight bands. */
  const night = (sunLon, sunLat, radius = 90) => path(geoCircle().center([sunLon + 180, -sunLat]).radius(radius)());
  // Raised great-circle arc ("cruise altitude"): lifted by `lift`×r at mid-route so the middle of a long route stays
  // visible just past the horizon. Returns { front, back } SVG paths (back = hidden behind the globe).
  const rot = geoRotation(rotate);
  const lifted = (a, b, t, lift) => {
    const A = [CITIES[a].lon, CITIES[a].lat], B = [CITIES[b].lon, CITIES[b].lat];
    const [lo, la] = rot(geoInterpolate(A, B)(t)).map((d) => d * Math.PI / 180);
    const h = 1 + lift * Math.sin(Math.PI * t) * Math.min(1, geoDistance(A, B) / 1.2);
    const x = Math.cos(la) * Math.sin(lo) * h, y = Math.sin(la) * h, z = Math.cos(la) * Math.cos(lo) * h;
    return { x: cx + r * x, y: cy - r * y, front: z > 0 || x * x + y * y > 1 };
  };
  const arc = (a, b, lift = 0.12, n = 64) => {
    let front = '', back = '', prev = null;
    for (let i = 0; i <= n; i++) {
      const p = lifted(a, b, i / n, lift);
      const cmd = (prev && prev.front === p.front ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      if (prev && prev.front !== p.front) { // bridge the switch so both halves meet
        if (p.front) front += 'M' + prev.x.toFixed(1) + ' ' + prev.y.toFixed(1); else back += 'M' + prev.x.toFixed(1) + ' ' + prev.y.toFixed(1);
      }
      if (p.front) front += prev && prev.front !== p.front ? 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) : cmd;
      else back += prev && prev.front !== p.front ? 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) : cmd;
      prev = p;
    }
    return { front, back };
  };
  const arcAt = (a, b, t, lift = 0.12) => {
    const p = lifted(a, b, t, lift), q = lifted(a, b, Math.min(1, t + 0.01), lift);
    return { x: p.x, y: p.y, deg: Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI, front: p.front };
  };
  return { proj, path, pt, city, sphere, land, graticule, route, along, night, visible, arc, arcAt, cx, cy, r };
}

/** Deterministic PRNG for decorative scatter (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const f1 = (n) => Math.round(n * 10) / 10;

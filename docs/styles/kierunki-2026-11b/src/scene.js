// Shared game situation for every 2026-11b mockup frame: week 1, day 2 of 3, 17:06, 34 passengers,
// eastern Mediterranean / Middle East; Athens and Amman are hubs, Amman is jammed, Karachi is off-screen.
import { geoInterpolate, geoDistance } from 'd3-geo';

export const W = 1080, H = 1920;
export const SUN = { lon: -40, lat: -16 }; // late afternoon over the Levant in November

export const AIRPORTS = {
  RIX: { name: 'Ryga', lon: 23.97, lat: 56.92, wait: 2, cap: 12, pax: { EUS: 1, ME: 1 } },
  VCE: { name: 'Wenecja', lon: 12.35, lat: 45.5, wait: 5, cap: 12, pax: { EUN: 3, ME: 2 } },
  ATH: { name: 'Ateny', lon: 23.94, lat: 37.94, wait: 14, cap: 24, hub: true, pax: { EUN: 6, ME: 5, AFR: 3 }, trend: 1 },
  ANK: { name: 'Ankara', lon: 32.99, lat: 40.13, wait: 4, cap: 12, pax: { EUS: 3, ME: 1 }, isNew: true },
  AMM: { name: 'Amman', lon: 35.99, lat: 31.72, wait: 36, cap: 36, hub: true, jam: 42, pax: { EUN: 15, EUS: 12, AFR: 9 } },
  BGW: { name: 'Bagdad', lon: 44.23, lat: 33.26, wait: 7, cap: 12, pax: { EUS: 4, EUN: 3 } },
  KHI: { name: 'Karaczi', lon: 67.16, lat: 24.9, wait: 8, cap: 12, off: true },
};
export const ROUTES = [['VCE', 'RIX'], ['VCE', 'ATH'], ['ATH', 'AMM'], ['ANK', 'AMM'], ['AMM', 'BGW'], ['BGW', 'KHI'], ['ATH', 'ANK']];
// plane: route index, progress 0..1, kind
export const PLANES = [
  { r: 0, t: 0.55, kind: 'prop' }, { r: 2, t: 0.42, kind: 'jet' }, { r: 4, t: 0.62, kind: 'prop' },
  { r: 5, t: 0.22, kind: 'prop' }, { r: 6, t: 0.7, kind: 'prop' },
];

export const REGIONS = {
  NAM: { glyph: 'fin', color: '#0072B2' }, SAM: { glyph: 'bracket', color: '#56B4E9' },
  EUN: { glyph: 'chevron', color: '#009E73' }, EUS: { glyph: 'crescent', color: '#E69F00' },
  AFR: { glyph: 'keyhole', color: '#13302E' }, ME: { glyph: 'bowtie', color: '#CC79A7' },
};
// D-08 glyphs, 12x12 centred (same paths as src/data/regions.ts).
export const GLYPH = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
  keyhole: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z',
  fin: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z',
  bracket: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z',
};

export function arc(a, b, n = 64) {
  const A = AIRPORTS[a], B = AIRPORTS[b];
  const f = geoInterpolate([A.lon, A.lat], [B.lon, B.lat]);
  return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}
export function along(a, b, t) {
  const A = AIRPORTS[a], B = AIRPORTS[b];
  return geoInterpolate([A.lon, A.lat], [B.lon, B.lat])(t);
}
export const km = (a, b) => Math.round(geoDistance([AIRPORTS[a].lon, AIRPORTS[a].lat], [AIRPORTS[b].lon, AIRPORTS[b].lat]) * 6371);

// Screen path of a great-circle arc, optionally lifted by altitude h(t) (fraction of R) for wires/contrails.
export function screenArc(cam, a, b, lift = 0, n = 64) {
  return arc(a, b, n).map((ll, i) => cam.project(ll, lift * Math.sin(Math.PI * i / n)));
}
export const toD = (pts) => {
  let out = '', pen = false;
  for (const p of pts) { if (!p) { pen = false; continue; } out += `${pen ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)} `; pen = true; }
  return out;
};
export function planePose(cam, pl, lift = 0) {
  const [a, b] = ROUTES[pl.r];
  const p1 = along(a, b, pl.t), p2 = along(a, b, Math.min(1, pl.t + 0.02));
  const h = lift * Math.sin(Math.PI * pl.t);
  const q1 = cam.project(p1, h), q2 = cam.project(p2, h), g = cam.project(p1);
  return { x: q1[0], y: q1[1], gx: g[0], gy: g[1], ang: Math.atan2(q2[1] - q1[1], q2[0] - q1[0]) * 180 / Math.PI };
}
export const pos = (cam, code, lift = 0) => cam.project([AIRPORTS[code].lon, AIRPORTS[code].lat], lift);
// the game camera of the store shot: over Turkey, looking north-east, horizon near the top
export const GAME_CAM = { lon: 34, lat: 33, alt: 0.55, back: 0.16, lookLon: 34, lookLat: 42, F: 1320, cx: 560, cy: 760 };
export const MENU_CAM = { lon: 16, lat: 24, alt: 2.6, back: 0, F: 1400, cx: 560, cy: 760 };

export function el(tag, attrs = {}, ...kids) {
  const ns = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'text', 'tspan', 'polygon', 'polyline', 'ellipse', 'defs', 'pattern', 'clipPath', 'use', 'mask', 'filter', 'feTurbulence', 'feDisplacementMap'].includes(tag);
  const e = ns ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}

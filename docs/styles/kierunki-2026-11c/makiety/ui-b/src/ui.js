// UI-B "Karta lotnicza w świecie" (2026-11c): the K2 night globe (../../src/globe.js, NASA imagery) with the game's
// information drawn into the world in the language of aeronautical charts: a neatline frame with coordinate ticks,
// a graticule, airport symbols with codes, passenger stacks standing on the airports, a hatched restricted-area ring
// that grows around a jammed hub, course/distance annotations, a compass rose, a scale bar, and the time of day as a
// thin hour scale riding the globe's limb. Mockup code only; nothing here is shipped.
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import { makeGlobe } from '../../src/globe.js';
import { AIRPORTS, ROUTES, PLANNED, REGIONS, GLYPH, ICON, gc, km } from '../../src/scene.js';

export const W = 412, H = 915, DPR = 2;
const D2R = Math.PI / 180;

// ---------- frames ----------
const NIGHT_GLOBE = { space: '#010306', atm: '#7FA4D6', nightGain: 1.7, moon: 0.06, grade: 0.95, haze: 0.4, atmStrength: 0.9, stars: true };
const DAY_GLOBE = { space: '#010306', atm: '#8FB8E6', nightGain: 1.3, moon: 0.03, grade: 0.9, haze: 0.55, atmStrength: 1.05, stars: true };
const GAME_CAM = { lon: 33.9, lat: 22.5, alt: 0.72, tlon: 34.1, tlat: 39.0, fov: 54, shift: [0, 62] };
const FRAMES = {
  night: { theme: 'night', globe: NIGHT_GLOBE, sun: { lon: -55, lat: -16 }, cam: GAME_CAM, clock: '19:05', hour: 19.08 },
  day: { theme: 'day', globe: DAY_GLOBE, sun: { lon: -30, lat: -16 }, cam: GAME_CAM, clock: '16:20', hour: 16.33 },
  menu: { theme: 'night', globe: NIGHT_GLOBE, sun: { lon: -72, lat: -14 }, cam: { lon: 30, lat: 26, alt: 11.2, tlon: 30, tlat: 26, fov: 30, shift: [0, 40] }, clock: '19:05', hour: 19.08 },
  week: { theme: 'night', globe: NIGHT_GLOBE, sun: { lon: -95, lat: -16 }, cam: { lon: 33, lat: 30, alt: 11.6, tlon: 33, tlat: 30, fov: 30, shift: [0, 125] }, clock: '23:59', hour: 23.98 },
  report: { theme: 'night', globe: NIGHT_GLOBE, sun: { lon: -82, lat: -16 }, cam: { lon: 36.5, lat: 19.0, alt: 0.56, tlon: 36.5, tlat: 34.0, fov: 50, shift: [0, 175] }, clock: '21:14', hour: 21.23 },
};

// ---------- helpers ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const SVGT = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'text', 'tspan', 'polygon', 'polyline', 'defs', 'clipPath', 'textPath', 'pattern', 'use'];
function el(tag, attrs = {}, ...kids) {
  const e = SVGT.includes(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const f1 = (n) => n.toFixed(1);
function pathOf(pts, clip) {
  let d = '', pen = false;
  for (const p of pts) {
    if (!p || !p.vis || (clip && !clip(p))) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)} `; pen = true;
  }
  return d;
}
// geodesic destination (deg) from lon/lat, bearing (deg), distance (km)
function dest(lon, lat, brg, dkm) {
  const d = dkm / 6371, b = brg * D2R, p1 = lat * D2R, l1 = lon * D2R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [l2 / D2R, p2 / D2R];
}
function bearing(A, B) {
  const p1 = A.lat * D2R, p2 = B.lat * D2R, dl = (B.lon - A.lon) * D2R;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}
const deg3 = (b) => String(Math.round(b) % 360).padStart(3, '0') + '°';
// SVG arrow drawn as a path (the chosen faces have no U+2192)
const arrow = (x, y, len = 14, cls = 'arw') => el('path', { d: `M${x} ${y}h${len} M${x + len - 4.5} ${y - 4}l4.5 4l-4.5 4`, class: cls });
function glyph(region, x, y, s, theme) {
  const r = REGIONS[region];
  const dark = region === 'AFR';
  return el('path', { d: GLYPH[r.glyph], transform: `translate(${f1(x)} ${f1(y)}) scale(${(s / 12).toFixed(3)})`, fill: dark && theme === 'night' ? '#0B1612' : r.color, class: `gl${dark ? ' dk' : ''}` });
}

// ---------- entry ----------
export async function render(stage, f, debug) {
  const F = FRAMES[f];
  stage.className = `${F.theme} f-${f}`;
  await Promise.all(['400 14px Chivo', '600 14px Chivo', '800 14px Chivo', '900 14px Chivo', 'italic 400 14px Chivo', 'italic 600 14px Chivo',
    '400 14px "Chivo Mono"', '500 14px "Chivo Mono"', '700 14px "Chivo Mono"'].map((s) => document.fonts.load(s)));
  const g = await makeGlobe(stage, { w: W, h: H, dpr: DPR, theme: F.globe, cam: F.cam, sunLL: F.sun });
  g.eye = (() => { const c = F.cam, r = 1 + c.alt; return new THREE.Vector3(r * Math.cos(c.lat * D2R) * Math.cos(c.lon * D2R), r * Math.sin(c.lat * D2R), -r * Math.cos(c.lat * D2R) * Math.sin(c.lon * D2R)); })();
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'world' });
  stage.append(svg);
  const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  if (debug) for (const [c, a] of Object.entries(AIRPORTS)) { const p = g.project(a.lon, a.lat); console.log(c, p.x.toFixed(0), p.y.toFixed(0), p.vis); }
  ({ night: game, day: game, menu, week, report })[f](stage, svg, g, topo, F, f);
}

// ---------- shared world layers ----------
function borders(svg, g, topo, box, cls = 'border') {
  const m = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  let d = '';
  for (const line of m.coordinates) d += pathOf(line.map(([lon, lat]) => (lon < box[0] || lon > box[1] || lat < box[2] || lat > box[3]) ? null : g.project(lon, lat)));
  svg.append(el('path', { d, class: cls }));
}
function coast(svg, g, topo, box) {
  const m = mesh(topo, topo.objects.countries, (a, b) => a === b);
  let d = '';
  for (const line of m.coordinates) d += pathOf(line.map(([lon, lat]) => (lon < box[0] || lon > box[1] || lat < box[2] || lat > box[3]) ? null : g.project(lon, lat)));
  svg.append(el('path', { d, class: 'coast' }));
}
// graticule; returns the polylines so the frame can print their coordinates where they cross the neatline
function graticule(svg, g, { lon: [l0, l1], lat: [p0, p1], step }) {
  const grp = el('g', { class: 'grat' }), lines = [];
  for (let lon = l0; lon <= l1; lon += step) {
    const pts = []; for (let lat = p0; lat <= p1; lat += 0.5) pts.push(g.project(lon, lat));
    grp.append(el('path', { d: pathOf(pts) })); lines.push({ kind: 'lon', v: lon, pts });
  }
  for (let lat = p0; lat <= p1; lat += step) {
    const pts = []; for (let lon = l0; lon <= l1; lon += 0.5) pts.push(g.project(lon, lat));
    grp.append(el('path', { d: pathOf(pts) })); lines.push({ kind: 'lat', v: lat, pts });
  }
  svg.append(grp);
  return lines;
}
// limb of the globe as a screen polyline, slightly above the surface
function limb(g, n = 720, alt = 0.0) {
  const E = g.eye.clone(), d = E.length(), Eh = E.clone().normalize();
  const u = new THREE.Vector3(0, 1, 0).cross(Eh).normalize(), v = Eh.clone().cross(u).normalize();
  const r = Math.sqrt(1 - 1 / (d * d)), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n * Math.PI * 2;
    const P = Eh.clone().multiplyScalar(1 / d).add(u.clone().multiplyScalar(r * Math.cos(t))).add(v.clone().multiplyScalar(r * Math.sin(t)));
    const lat = Math.asin(P.y) / D2R, lon = Math.atan2(-P.z, P.x) / D2R;
    out.push({ t, ...g.project(lon, lat, alt) });
  }
  return out;
}

// airport chart symbol: ring with service ticks; hub = double ring with the hub asterisk
function portSymbol(layer, a, p, theme) {
  const grp = el('g', { class: `sym${a.hub ? ' hub' : ''}${a.isNew ? ' new' : ''}${a.jam ? ' jam' : ''}` });
  if (a.hub) {
    grp.append(el('circle', { cx: p.x, cy: p.y, r: 9.5, class: 'ring-o' }), el('circle', { cx: p.x, cy: p.y, r: 6.2, class: 'ring-i' }));
    grp.append(el('path', { d: ICON.hub, class: 'hubmark', transform: `translate(${f1(p.x)} ${f1(p.y)}) scale(0.085) translate(-50 -50)` }));
    for (let i = 0; i < 8; i++) { const a2 = i * 45 * D2R; grp.append(el('line', { x1: p.x + Math.cos(a2) * 9.5, y1: p.y + Math.sin(a2) * 9.5, x2: p.x + Math.cos(a2) * 13, y2: p.y + Math.sin(a2) * 13, class: 'tick' })); }
  } else {
    grp.append(el('circle', { cx: p.x, cy: p.y, r: 4.6, class: 'ring' }));
    for (let i = 0; i < 4; i++) { const a2 = i * 90 * D2R; grp.append(el('line', { x1: p.x + Math.cos(a2) * 4.6, y1: p.y + Math.sin(a2) * 4.6, x2: p.x + Math.cos(a2) * 7.6, y2: p.y + Math.sin(a2) * 7.6, class: 'tick' })); }
  }
  layer.append(grp);
}

// passengers: a stack of D-08 glyphs standing on the airport, one glyph per person, columns of `cap` with a ceiling bar
function paxStack(layer, a, p, theme, { dx = 13, step = 4.9, size = 8.6, col = 12, colW = 10.5, ceilingFor = a.cap, left = false } = {}) {
  const grp = el('g', { class: `stack${a.jam ? ' jam' : ''}` });
  const list = [];
  for (const [r, n] of Object.entries(a.pax)) for (let i = 0; i < n; i++) list.push(r);
  const cols = Math.ceil(ceilingFor / col);
  const x0 = left ? p.x - dx - cols * colW + 4 : p.x + dx, base = p.y + 2;
  // ground line + ceiling bar (capacity) for every column that exists at this airport
  const ceil = base - col * step - 3.5;
  grp.append(el('line', { x1: x0 - 3, y1: base + 1.5, x2: x0 + cols * colW - 1.5, y2: base + 1.5, class: 'ground' }));
  grp.append(el('path', { d: `M${f1(x0 - 3)} ${f1(base + 1.5)}V${f1(ceil)}H${f1(x0 + cols * colW - 1.5)}V${f1(ceil + 3)}`, class: 'ceil' }));
  for (let k = 6; k < col; k += 6) grp.append(el('line', { x1: x0 - 5.5, y1: f1(base - 1 - k * step), x2: x0 - 3, y2: f1(base - 1 - k * step), class: 'gtick' }));
  list.forEach((r, i) => {
    const c = Math.floor(i / col), k = i % col;
    grp.append(glyph(r, x0 + c * colW + 4, base - 3.5 - k * step, size, theme));
  });
  layer.append(grp);
  return { x0, x1: x0 + cols * colW, top: ceil, base };
}

function label(layer, p, name, code, { dx = -11, dy = 4, anchor = 'end', hub = false, note } = {}) {
  const grp = el('g', { class: `lbl${hub ? ' hub' : ''}` });
  grp.append(el('text', { x: p.x + dx, y: p.y + dy, 'text-anchor': anchor, class: 'nm' }, name));
  grp.append(el('text', { x: p.x + dx, y: p.y + dy + (hub ? 12 : 11), 'text-anchor': anchor, class: 'cd' }, code + (note ? '' : '')));
  if (note) grp.append(el('text', { x: p.x + dx, y: p.y + dy + 23, 'text-anchor': anchor, class: 'note' }, note));
  layer.append(grp);
}

function routeLine(layer, g, A, B, kind, cls = '') {
  const f = gc(A, B);
  const pts = Array.from({ length: 97 }, (_, i) => { const [lon, lat] = f(i / 96); return g.project(lon, lat); });
  const d = pathOf(pts);
  layer.append(el('path', { d, class: `rc ${kind} ${cls}` }), el('path', { d, class: `rt ${kind} ${cls}` }));
  return { f, pts };
}

function plane(layer, g, f, t, kind) {
  const [lon, lat] = f(t), [lon2, lat2] = f(Math.min(1, t + 0.01));
  const alt = 0.006, p = g.project(lon, lat, alt), q = g.project(lon2, lat2, alt), s = g.project(lon, lat);
  const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
  const sc = (kind === 'jet' ? 25 : 20) / 100;
  layer.append(el('path', { d: ICON[kind], class: 'pshadow', transform: `translate(${f1(s.x + 1.5)} ${f1(s.y + 5)}) rotate(${f1(ang)}) scale(${sc}) translate(-50 -50)` }));
  const pg = el('g', { transform: `translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(ang)}) scale(${sc}) translate(-50 -50)` });
  pg.append(el('path', { d: ICON[kind], class: `plane ${kind}` }));
  const wing = kind === 'jet' ? [8, 66, 92, 66] : [10, 49, 90, 49];
  pg.append(el('circle', { cx: wing[0], cy: wing[1], r: 4.4, fill: '#FF4A3D' }), el('circle', { cx: wing[2], cy: wing[3], r: 4.4, fill: '#3DFF8E' }));
  layer.append(pg);
}

// a ring on the ground (projected geodesic circle)
function groundRing(g, c, rkm, n = 120) {
  return Array.from({ length: n + 1 }, (_, i) => { const [lon, lat] = dest(c.lon, c.lat, i / n * 360, rkm); return { brg: i / n * 360, ...g.project(lon, lat) }; });
}

// compass rose (VOR style) on the ground around an airport
function rose(layer, g, c, rkm) {
  const grp = el('g', { class: 'rose' });
  grp.append(el('path', { d: pathOf(groundRing(g, c, rkm)) + 'Z' }));
  for (let b = 0; b < 360; b += 5) {
    const len = b % 30 === 0 ? 0.16 : b % 10 === 0 ? 0.09 : 0.05;
    const [l1, a1] = dest(c.lon, c.lat, b, rkm), [l2, a2] = dest(c.lon, c.lat, b, rkm * (1 - len));
    const P = g.project(l1, a1), Q = g.project(l2, a2);
    grp.append(el('line', { x1: f1(P.x), y1: f1(P.y), x2: f1(Q.x), y2: f1(Q.y), class: b % 30 === 0 ? 'maj' : '' }));
    if (false) {
      const [l3, a3] = dest(c.lon, c.lat, b, rkm * 1.2), T = g.project(l3, a3);
      grp.append(el('text', { x: f1(T.x), y: f1(T.y + 3), class: 'rn' }, String(b / 10)));
    }
  }
  // north pointer
  const [ln, an] = dest(c.lon, c.lat, 0, rkm * 1.42), [lb, ab] = dest(c.lon, c.lat, 0, rkm * 1.06);
  const N = g.project(ln, an), B = g.project(lb, ab);
  const ang = Math.atan2(N.y - B.y, N.x - B.x);
  const nx = Math.cos(ang + Math.PI / 2) * 3, ny = Math.sin(ang + Math.PI / 2) * 3;
  grp.append(el('path', { d: `M${f1(B.x + nx)} ${f1(B.y + ny)}L${f1(N.x)} ${f1(N.y)}L${f1(B.x - nx)} ${f1(B.y - ny)}Z`, class: 'north' }));
  layer.append(grp);
}

// jammed hub: hatched restricted-area ring that grows toward a dashed closing limit; countdown printed on the limit
function jamRing(layer, defs, g, c, rNow, rMax, text, id, closed = false) {
  const grp = el('g', { class: `jamring${closed ? ' closed' : ''}` });
  const lim = groundRing(g, c, rMax), now = groundRing(g, c, rNow);
  grp.append(el('path', { d: pathOf(lim) + 'Z', class: 'limit' }));
  grp.append(el('path', { d: pathOf(now) + 'Z', class: 'edge' }));
  // inward hatch ticks (restricted-area convention); between now and limit a faint growth band of tick marks
  for (let i = 0; i < 72; i += 1) {
    const b = i * 5;
    const [l1, a1] = dest(c.lon, c.lat, b, rNow), [l2, a2] = dest(c.lon, c.lat, b + 3, rNow * 0.84);
    const P = g.project(l1, a1), Q = g.project(l2, a2);
    grp.append(el('line', { x1: f1(P.x), y1: f1(P.y), x2: f1(Q.x), y2: f1(Q.y), class: 'hatch' }));
  }
  // growth arrows on the four cardinal bearings: from the current ring out to the limit
  if (!closed) for (const b of [45, 135, 225, 315]) {
    const [l1, a1] = dest(c.lon, c.lat, b, rNow + 6), [l2, a2] = dest(c.lon, c.lat, b, rMax - 6);
    const P = g.project(l1, a1), Q = g.project(l2, a2), ang = Math.atan2(Q.y - P.y, Q.x - P.x);
    grp.append(el('path', { d: `M${f1(P.x)} ${f1(P.y)}L${f1(Q.x)} ${f1(Q.y)}M${f1(Q.x - 4 * Math.cos(ang - 0.5))} ${f1(Q.y - 4 * Math.sin(ang - 0.5))}L${f1(Q.x)} ${f1(Q.y)}L${f1(Q.x - 4 * Math.cos(ang + 0.5))} ${f1(Q.y - 4 * Math.sin(ang + 0.5))}`, class: 'grow' }));
  }
  // countdown text along the limit (upper arc, left to right)
  const ordered = groundRing(g, c, rMax * 1.06, 90).filter((q) => q.brg >= 95 && q.brg <= 265).reverse();
  defs.append(el('path', { id, d: pathOf(ordered) }));
  const t = el('text', { class: 'jamtext' }); const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, text);
  t.append(tp); grp.append(t);
  layer.append(grp);
}

// hour scale along the globe's limb (0..24 across the visible limb), night hours dotted, elapsed part thick
function limbClock(svg, g, F, { from, to, alt = 0.035, ticks = true, labels = [0, 6, 12, 18, 24], dayStart = 6, dayEnd = 19, full = false }) {
  const L = limb(g, 1440, alt).filter((q) => q.vis);
  const inView = L.filter((q) => q.x > from[0] && q.x < from[1] && q.y > to[0] && q.y < to[1]);
  if (!inView.length) return;
  // order by angle, then unwrap so the visible stretch is continuous (left to right on screen)
  let pts = full ? L : inView;
  pts = pts.slice().sort((a, b) => a.t - b.t);
  let gapAt = 0, gap = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].t - pts[i - 1].t > gap) { gap = pts[i].t - pts[i - 1].t; gapAt = i; }
  if (gap > 0.05) pts = [...pts.slice(gapAt), ...pts.slice(0, gapAt)];
  if (pts[0].x > pts[pts.length - 1].x) pts.reverse();
  const lo = Math.max(0, pts.findIndex((q) => q.x > from[0] + 26)), hi = pts.length - 1 - Math.max(0, pts.slice().reverse().findIndex((q) => q.x < from[1] - 26));
  if (!full) pts = pts.slice(lo, hi + 1);
  const at = (h) => pts[Math.max(0, Math.min(pts.length - 1, Math.round(h / 24 * (pts.length - 1))))];
  const grp = el('g', { class: 'clockarc' });
  const seg = (h0, h1) => { const a = []; for (let h = h0; h <= h1 + 1e-6; h += 0.05) a.push(at(h)); return pathOf(a); };
  grp.append(el('path', { d: seg(0, dayStart), class: 'nightseg' }), el('path', { d: seg(dayEnd, 24), class: 'nightseg' }));
  grp.append(el('path', { d: seg(dayStart, dayEnd), class: 'dayseg' }));
  grp.append(el('path', { d: seg(0, F.hour), class: 'elapsed' }));
  // ticks: normal to the arc, outward (away from the globe centre)
  const C = g.project(...(() => { const E = g.eye.clone().normalize(); return [Math.atan2(-E.z, E.x) / D2R, Math.asin(E.y) / D2R]; })());
  const outward = (p) => { const dx = p.x - C.x, dy = p.y - C.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  if (ticks) for (let h = 0; h <= 24; h++) {
    const p = at(h), [ox, oy] = outward(p), len = h % 6 === 0 ? 7 : 3.5;
    grp.append(el('line', { x1: f1(p.x), y1: f1(p.y), x2: f1(p.x + ox * len), y2: f1(p.y + oy * len), class: h % 6 === 0 ? 'maj' : '' }));
    if (labels.includes(h) && Math.abs(h - F.hour) > 1.6 && h > 0 && h < 24) grp.append(el('text', { x: f1(p.x + ox * 15), y: f1(p.y + oy * 15 + 3), class: 'hl' }, String(h)));
  }
  // now marker: a short bar across the arc and the time in mono
  const p = at(F.hour), [ox, oy] = outward(p);
  grp.append(el('line', { x1: f1(p.x - ox * 5), y1: f1(p.y - oy * 5), x2: f1(p.x + ox * 11), y2: f1(p.y + oy * 11), class: 'now' }));
  grp.append(el('text', { x: f1(p.x + ox * 22), y: f1(p.y + oy * 22 + 4), class: 'nowt' }, F.clock));
  svg.append(grp);
  return { pts, at, outward };
}


// the projected limb is a circle on screen: fit it, then draw dials around it in screen space
function limbCircle(g) {
  const L = limb(g, 360, 0).filter((q) => q.vis);
  const cx = L.reduce((a, q) => a + q.x, 0) / L.length, cy = L.reduce((a, q) => a + q.y, 0) / L.length;
  const r = L.reduce((a, q) => a + Math.hypot(q.x - cx, q.y - cy), 0) / L.length;
  return { cx, cy, r };
}
const arcD = (c, r, a0, a1) => { const p = (a) => `${f1(c.cx + r * Math.cos(a * D2R))} ${f1(c.cy + r * Math.sin(a * D2R))}`; return `M${p(a0)} A${f1(r)} ${f1(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`; };
// 24 h dial: noon at the top, morning on the left, evening on the right (the sun's way across the sky)
function dial(svg, g, F, gap = 12) {
  const c = limbCircle(g), r = c.r + gap, ang = (h) => 90 + h * 15;
  const grp = el('g', { class: 'clockarc dial' });
  grp.append(el('path', { d: arcD(c, r, ang(0), ang(6)), class: 'nightseg' }), el('path', { d: arcD(c, r, ang(19), ang(24)), class: 'nightseg' }));
  grp.append(el('path', { d: arcD(c, r, ang(6), ang(19)), class: 'dayseg' }));
  grp.append(el('path', { d: arcD(c, r, ang(0) + 0.01, ang(F.hour)), class: 'elapsed' }));
  for (let h = 0; h < 24; h++) {
    const a = ang(h) * D2R, len = h % 6 === 0 ? 8 : 4, x = Math.cos(a), y = Math.sin(a);
    grp.append(el('line', { x1: f1(c.cx + x * r), y1: f1(c.cy + y * r), x2: f1(c.cx + x * (r + len)), y2: f1(c.cy + y * (r + len)), class: h % 6 === 0 ? 'maj' : '' }));
    if (h % 6 === 0 && Math.abs(h - F.hour) > 1.6) grp.append(el('text', { x: f1(c.cx + x * (r + 17)), y: f1(c.cy + y * (r + 17) + 3), class: 'hl' }, String(h)));
  }
  const a = ang(F.hour) * D2R, x = Math.cos(a), y = Math.sin(a);
  grp.append(el('line', { x1: f1(c.cx + x * (r - 5)), y1: f1(c.cy + y * (r - 5)), x2: f1(c.cx + x * (r + 12)), y2: f1(c.cy + y * (r + 12)), class: 'now' }));
  grp.append(el('text', { x: f1(c.cx + x * (r + 30)), y: f1(c.cy + y * (r + 30) + 4), class: 'nowt' }, F.clock));
  svg.append(grp);
  return c;
}

// neatline frame: outside = margin (opaque), inside = the world; alternating coordinate bars on the edge
function neatline(stage, svg, box, lines, theme, skip = () => false) {
  const [x0, y0, x1, y1] = box;
  const m = el('path', { d: `M0 0H${W}V${H}H0Z M${x0} ${y0}V${y1}H${x1}V${y0}Z`, class: 'margin', 'fill-rule': 'evenodd' });
  const grp = el('g', { class: 'neat' });
  grp.append(el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'nl' }));
  // coordinate labels where graticule lines meet the frame
  const cross = [];
  for (const L of lines) {
    for (let i = 1; i < L.pts.length; i++) {
      const a = L.pts[i - 1], b = L.pts[i]; if (!a.vis || !b.vis) continue;
      for (const [edge, val] of [['l', x0], ['r', x1]]) if ((a.x - val) * (b.x - val) < 0) { const t = (val - a.x) / (b.x - a.x); const y = a.y + t * (b.y - a.y); if (y > y0 + 10 && y < y1 - 10) cross.push({ edge, x: val, y, L }); }
      for (const [edge, val] of [['b', y1], ['t', y0]]) if ((a.y - val) * (b.y - val) < 0) { const t = (val - a.y) / (b.y - a.y); const x = a.x + t * (b.x - a.x); if (x > x0 + 14 && x < x1 - 14) cross.push({ edge, x, y: val, L }); }
    }
  }
  for (const c of cross) {
    const t = c.L.kind === 'lon' ? `${c.L.v}°E` : `${c.L.v}°N`;
    if ((c.edge === 'l' || c.edge === 'r') && c.L.kind !== 'lat') continue;
    if (c.edge === 'b' && c.L.kind !== 'lon') continue;
    if (c.edge === 'b' && c.x < 120) continue;
    if (skip(c)) continue;
    if (c.edge === 'l') { grp.append(el('line', { x1: c.x, y1: c.y, x2: c.x + 6, y2: c.y, class: 'ctk' }), el('text', { x: c.x - 1.5, y: c.y + 3, class: 'coord', 'text-anchor': 'end' }, '')); grp.append(el('text', { x: c.x + 9, y: c.y + 3.2, class: 'coord in' }, t)); }
    if (c.edge === 'r') { grp.append(el('line', { x1: c.x - 6, y1: c.y, x2: c.x, y2: c.y, class: 'ctk' }), el('text', { x: c.x - 9, y: c.y + 3.2, class: 'coord in', 'text-anchor': 'end' }, t)); }
    if (c.edge === 'b') { grp.append(el('line', { x1: c.x, y1: c.y - 6, x2: c.x, y2: c.y, class: 'ctk' }), el('text', { x: c.x, y: c.y - 9, class: 'coord in', 'text-anchor': 'middle' }, t)); }
  }
  // alternating bars (every 18 px) just outside the neatline
  const bars = el('g', { class: 'bars' });
  for (let x = x0, i = 0; x < x1; x += 18, i++) if (i % 2 === 0) { bars.append(el('rect', { x, y: y0 - 3, width: Math.min(18, x1 - x), height: 3 })); bars.append(el('rect', { x, y: y1, width: Math.min(18, x1 - x), height: 3 })); }
  for (let y = y0, i = 0; y < y1; y += 18, i++) if (i % 2 === 0) { bars.append(el('rect', { x: x0 - 3, y, width: 3, height: Math.min(18, y1 - y) })); bars.append(el('rect', { x: x1, y, width: 3, height: Math.min(18, y1 - y) })); }
  svg.append(m, bars, grp);
}

function scaleBar(svg, g, x, y, at, kmTotal = 500) {
  const a = g.project(at.lon, at.lat), [l2, p2] = dest(at.lon, at.lat, 90, kmTotal), b = g.project(l2, p2);
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  const grp = el('g', { class: 'scale', transform: `translate(${x} ${y})` });
  const n = 4;
  for (let i = 0; i < n; i++) grp.append(el('rect', { x: i * px / n, y: 0, width: px / n, height: 3.2, class: i % 2 ? 'o' : 'f' }));
  grp.append(el('rect', { x: 0, y: 0, width: px, height: 3.2, class: 'box' }));
  for (const [t, xx] of [['0', 0], [String(kmTotal / 2), px / 2], [`${kmTotal} km`, px]]) grp.append(el('text', { x: f1(xx), y: -4, 'text-anchor': xx === 0 ? 'start' : xx === px ? 'end' : 'middle' }, t));
  svg.append(grp);
  return px;
}

function statusbar(stage, theme) {
  stage.append(html(`<div class="statusbar"><span>14:32</span><span class="sb-r"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i><b></b></span></div>`));
}

// ---------- game frame (night / day) ----------
const PORT_LBL = {
  RIX: { dx: -11, dy: 4, anchor: 'end' }, KBP: { dx: -11, dy: 4, anchor: 'end' }, BEG: { dx: 10, dy: 17, anchor: 'start' },
  ATH: { dx: 0, dy: 44, anchor: 'middle', hub: true }, ANK: { dx: -11, dy: -6, anchor: 'end', note: 'nowe' }, CAI: { dx: -11, dy: 6, anchor: 'end' },
  AMM: { dx: 15, dy: 20, anchor: 'start', hub: true }, BGW: { dx: -14, dy: 18, anchor: 'end' },
};

function game(stage, svg, g, topo, F, f) {
  const theme = F.theme;
  const box = [8, 76, 404, f === 'day' ? 852 : 812];
  const defs = el('defs'); svg.append(defs);
  coast(svg, g, topo, [-15, 85, 5, 75]);
  borders(svg, g, topo, [-15, 85, 5, 75]);
  const lines = graticule(svg, g, { lon: [10, 60], lat: [20, 65], step: 5 });
  // atlas labels: countries spaced caps, seas italic
  const atlas = el('g', { class: 'atlas' });
  for (const c of [{ t: 'TURCJA', lon: 36.6, lat: 38.9 }, { t: 'EGIPT', lon: 28.6, lat: 26.2 }, { t: 'RUMUNIA', lon: 26.2, lat: 45.2 }, { t: 'BIAŁORUŚ', lon: 28.0, lat: 53.6 }, { t: 'ARABIA SAUDYJSKA', lon: 38.5, lat: 26.2 }]) {
    const p = g.project(c.lon, c.lat); if (p.vis && p.y > 200 && p.y < box[3] - 40) atlas.append(el('text', { x: p.x, y: p.y, class: 'country' }, c.t));
  }
  for (const c of [{ t: 'Morze Czarne', lon: 34.2, lat: 43.4 }, { t: 'Morze Śródziemne', lon: 27.6, lat: 33.0 }]) {
    const p = g.project(c.lon, c.lat); if (p.vis) atlas.append(el('text', { x: p.x, y: p.y, class: 'sea' }, c.t));
  }
  svg.append(atlas);

  const routes = el('g', { class: 'routes' }), notes = el('g', { class: 'notes' }), ports = el('g', { class: 'ports' }), planes = el('g', { class: 'planes' });
  // compass rose around the calm hub (Athens)
  rose(routes, g, AIRPORTS.ATH, 190);
  // jam ring around Amman (current radius grows toward the limit; at the limit the hub closes)
  jamRing(routes, defs, g, AIRPORTS.AMM, 150, 260, 'ZATOR · 0:42', 'jt');
  const R = {};
  for (const r of ROUTES) R[r.a + r.b] = { ...routeLine(routes, g, AIRPORTS[r.a], AIRPORTS[r.b], r.kind), r };
  // planned route (being drawn): dashed, with course and distance
  const P = routeLine(routes, g, AIRPORTS[PLANNED.a], AIRPORTS[PLANNED.b], 'plan');
  // course + distance annotations (chart style: course in degrees, distance in km, along the route)
  const ann = (A, B, t, dx, dy, anchor = 'start', plan = false) => {
    const f = gc(A, B), m = f(t), p = g.project(m[0], m[1]);
    const grp = el('g', { class: `ann${plan ? ' plan' : ''}`, transform: `translate(${f1(p.x + dx)} ${f1(p.y + dy)})` });
    grp.append(el('text', { x: 0, y: 0, 'text-anchor': anchor, class: 'crs' }, deg3(bearing(A, B))));
    grp.append(el('text', { x: 0, y: 11, 'text-anchor': anchor, class: 'dst' }, `${fmt(km(A, B))} km`));
    notes.append(grp);
  };
  ann(AIRPORTS.ATH, AIRPORTS.AMM, 0.30, 6, -14);
  ann(AIRPORTS.AMM, AIRPORTS.BGW, 0.45, -4, -24, 'start');
  ann(AIRPORTS.ANK, AIRPORTS.AMM, 0.42, 9, 0, 'start', true);
  for (const k of Object.keys(R)) for (const t of R[k].r.planes) plane(planes, g, R[k].f, t, R[k].r.kind);

  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue;
    const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    portSymbol(ports, a, p, theme);
    paxStack(ports, a, p, theme, a.hub ? { dx: 15 } : code === 'BGW' ? { left: true } : {});
    label(ports, p, a.name, code, PORT_LBL[code]);
  }
  svg.append(routes, notes, ports, planes);

  // off-chart destination: a dotted bearing stub leaving the chart toward Karachi, labelled at the neatline
  {
    const K = AIRPORTS.KHI, B = AIRPORTS.BGW, fk = gc(B, K);
    const pts = Array.from({ length: 60 }, (_, i) => { const [lon, lat] = fk(i / 59 * 0.5); return g.project(lon, lat); }).filter((q) => q.x < box[2]);
    svg.append(el('path', { d: pathOf(pts.slice(2)), class: 'stub' }));
    const e = pts[pts.length - 1] || g.project(B.lon, B.lat);
    const cont = el('g', { class: 'cont', transform: `translate(${box[2] - 8} ${f1(e.y + 46)})` });
    cont.append(el('text', { x: 0, y: 0, 'text-anchor': 'end', class: 'c1' }, 'do Karaczi'), el('text', { x: 0, y: 11, 'text-anchor': 'end', class: 'c2' }, `KHI ${fmt(km(B, K))} km`));
    svg.append(cont);
  }

  const contY = g.project(AIRPORTS.BGW.lon, AIRPORTS.BGW.lat).y + 46;
  neatline(stage, svg, box, lines, theme, (c) => c.edge === 'r' && Math.abs(c.y - contY) < 24);
  scaleBar(svg, g, 22, box[3] - 30, { lon: 30, lat: 33 });
  limbClock(svg, g, F, { from: [box[0], box[2]], to: [box[1], box[3]] });

  statusbar(stage, theme);
  // one typographic line: week, day, passengers; pause as a bare 48dp target
  stage.append(html(`<header class="line"><span class="wk">Tydzień <b>1</b></span><span class="sep"></span><span class="dy">dzień <b>2</b> z 3</span><span class="sep"></span><span class="px"><b>34</b> pasażerów</span></header>`));
  stage.append(html(`<button class="pause" aria-label="Pauza"><svg viewBox="0 0 20 20"><rect x="4.5" y="3" width="3.6" height="14"/><rect x="11.9" y="3" width="3.6" height="14"/></svg></button>`));
  dock(stage, f === 'day' ? 'tucked' : 'open');
}

// dock: a strip of shape icons in the bottom margin; counts are shown by repeating the silhouette, not with badges
function dock(stage, mode) {
  const ic = (id, n = 1, cls = '') => `<svg viewBox="0 0 ${100 + (n - 1) * 46} 100" class="${cls}" style="width:${30 + (n - 1) * 14}px">${Array.from({ length: n }, (_, i) => `<path d="${ICON[id]}" transform="translate(${i * 46} 0)"/>`).join('')}</svg>`;
  if (mode === 'open') {
    stage.append(html(`<nav class="dock open">
      <span class="grip"></span>
      <button class="t minor"><span class="ic">${ic('undo')}</span><b>Cofnij</b></button>
      <button class="t sel"><span class="ic">${ic('prop', 2)}</span><b>Turbośmigł.</b></button>
      <button class="t"><span class="ic">${ic('jet', 1)}</span><b>Szerokokadł.</b></button>
      <button class="t off"><span class="ic">${ic('hub', 1, 'dash')}</span><b>Hub <i>za 1 dzień</i></b></button>
      <button class="t minor"><span class="ic">${ic('tempo')}</span><b>Tempo 1×</b></button>
    </nav>`));
  } else {
    stage.append(html(`<nav class="dock tucked">
      <span class="grip"></span>
      <button class="t sel"><span class="ic">${ic('prop', 2)}</span><b>Turbośmigł.</b></button>
      <span class="more">przeciągnij w górę: 5 narzędzi</span>
    </nav>`));
  }
}

// ---------- menu ----------
function menu(stage, svg, g, topo, F) {
  const lines = graticule(svg, g, { lon: [-180, 180], lat: [-75, 75], step: 15 });
  borders(svg, g, topo, [-180, 180, -90, 90], 'border faint');
  const routes = el('g', { class: 'routes small' }), ports = el('g', { class: 'ports small' });
  for (const r of ROUTES) routeLine(routes, g, AIRPORTS[r.a], AIRPORTS[r.b], r.kind);
  for (const [, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue; const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    ports.append(el('circle', { cx: p.x, cy: p.y, r: a.hub ? 3.4 : 2.1, class: a.hub ? 'mh' : 'mp' }));
  }
  svg.append(routes, ports);
  dial(svg, g, F);
  statusbar(stage);
  stage.append(html(`<header class="title">
    <h1>Airway</h1>
    <p class="sub">Sieć lotnicza na prawdziwej Ziemi</p>
    <p class="sheet">ARKUSZ 1 · ZIEMIA · 08.11.2026 · <span>noc nad Lewantem</span></p>
  </header>`));
  const gl = (r) => `<svg viewBox="-7 -7 14 14"><path d="${GLYPH[REGIONS[r].glyph]}" style="fill:${r === 'AFR' ? '#0B1612' : REGIONS[r].color}" class="${r === 'AFR' ? 'dk' : ''}"/></svg>`;
  const arw = `<svg class="arw" viewBox="0 0 44 14"><path d="M0 7h42M35 1l7 6l-7 6"/></svg>`;
  stage.append(html(`<nav class="legend">
    <div class="lh"><span>LEGENDA</span><i></i></div>
    <button class="li primary"><span class="sym"><svg viewBox="-16 -16 32 32"><circle r="10"/><circle r="6.5"/><path d="${ICON.hub}" transform="scale(0.09) translate(-50 -50)"/></svg></span><span class="tx"><b>Lot bez końca</b><small>rekord 212 pasażerów · tydzień 6</small></span>${arw}</button>
    <button class="li"><span class="sym glyphs">${gl('EUN')}${gl('ME')}${gl('AFR')}</span><span class="tx"><b>Dziś, 8 listopada</b><small>ten sam świat dla wszystkich</small></span></button>
    <button class="li"><span class="sym"><svg viewBox="-16 -16 32 32"><path d="M-12 8 L12 -8" class="ln"/><circle cx="-12" cy="8" r="3.4"/><circle cx="12" cy="-8" r="3.4"/></svg></span><span class="tx"><b>Zadania</b><small>0 z 40 rozwiązanych</small></span><span class="num">0/40</span></button>
    <div class="pair"><button class="li half"><b>Dziennik</b></button><button class="li half"><b>Ustawienia</b></button></div>
  </nav>`));
}

// ---------- end of week board (upgrade choice) ----------
function week(stage, svg, g, topo, F) {
  graticule(svg, g, { lon: [-180, 180], lat: [-75, 75], step: 15 });
  borders(svg, g, topo, [-180, 180, -90, 90], 'border faint');
  const routes = el('g', { class: 'routes small' }), ports = el('g', { class: 'ports small' });
  for (const r of ROUTES) routeLine(routes, g, AIRPORTS[r.a], AIRPORTS[r.b], r.kind);
  for (const [, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue; const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    ports.append(el('circle', { cx: p.x, cy: p.y, r: a.hub ? 3.4 : 2.1, class: a.hub ? 'mh' : 'mp' }));
  }
  svg.append(routes, ports);
  // the week as three closed day arcs around the globe (same dial as the menu, one arc per day)
  const c = limbCircle(g), r = c.r + 12;
  const grp = el('g', { class: 'weekarc' });
  for (let i = 0; i < 3; i++) {
    const a0 = 90 + i * 120 + 3, a1 = 90 + (i + 1) * 120 - 3, am = (a0 + a1) / 2 * D2R;
    grp.append(el('path', { d: arcD(c, r, a0, a1) }));
    const ro = r + (Math.abs(Math.cos(am)) > 0.5 ? 34 : 16);
    grp.append(el('text', { x: f1(c.cx + Math.cos(am) * ro), y: f1(c.cy + Math.sin(am) * ro + 3) }, `doba ${i + 1}`));
  }
  svg.append(grp);
  // chart callouts: leader line from the hub to a short note
  const call = (code, dx, dy, t1, t2, cls = '') => {
    const a = AIRPORTS[code], p = g.project(a.lon, a.lat), x = p.x + dx, y = p.y + dy;
    const cg = el('g', { class: `callout ${cls}` });
    cg.append(el('path', { d: `M${f1(p.x)} ${f1(p.y)}L${f1(x)} ${f1(y)}H${f1(x + (dx < 0 ? -6 : 6))}` }));
    const an = dx < 0 ? 'end' : 'start', tx = x + (dx < 0 ? -9 : 9);
    cg.append(el('text', { x: f1(tx), y: f1(y - 2), 'text-anchor': an, class: 't1' }, t1), el('text', { x: f1(tx), y: f1(y + 10), 'text-anchor': an, class: 't2' }, t2));
    svg.append(cg);
  };
  call('ATH', -70, -58, 'ATENY', '48 przesiadek');
  call('AMM', -20, 78, 'AMMAN', 'przetrwał zator', 'warn');
  statusbar(stage);
  stage.append(html(`<header class="line wk-top"><span>Koniec tygodnia <b>1</b></span><span class="sep"></span><span><b>112</b> pasażerów</span><span class="sep"></span><span><b>3</b> trasy</span></header>`));
  stage.append(html(`<div class="wk-note">Trzy doby zamknięte, sieć przetrwała. Wybierz, czym ją wzmocnić.</div>`));
  const big = (d, cls = '') => `<svg viewBox="0 0 100 100" class="${cls}"><path d="${d}"/></svg>`;
  stage.append(html(`<section class="board">
    <h2>Wybierz jedno ulepszenie</h2>
    <button class="opt sel"><span class="sym">${big(ICON.prop)}</span><span class="tx"><b>Turbośmigłowiec</b><small>+1 samolot · krótkie trasy do 1 500 km · tani w utrzymaniu</small></span></button>
    <button class="opt"><span class="sym">${big(ICON.jet)}</span><span class="tx"><b>Szerokokadłubowiec</b><small>+1 samolot · zabiera dwa razy więcej · trasy do 6 000 km</small></span></button>
    <button class="opt"><span class="sym hub"><svg viewBox="-50 -50 100 100"><circle r="38"/><circle r="25"/><path d="${ICON.hub}" transform="scale(.36) translate(-50 -50)"/></svg></span><span class="tx"><b>Hub</b><small>nowy węzeł przesiadkowy · kolejka do 24 osób</small></span></button>
    <p class="hint">TYDZIEŃ 2 RUSZA PO WYBORZE · 00:00 NAD LEWANTEM</p>
  </section>`));
}

// ---------- game over report ----------
function report(stage, svg, g, topo, F) {
  const defs = el('defs'); svg.append(defs);
  coast(svg, g, topo, [-15, 85, 5, 75]);
  borders(svg, g, topo, [-15, 85, 5, 75]);
  const glines = graticule(svg, g, { lon: [20, 55], lat: [20, 50], step: 5 });
  const routes = el('g', { class: 'routes' }), ports = el('g', { class: 'ports' });
  jamRing(routes, defs, g, AIRPORTS.AMM, 260, 260, 'ZAMKNIĘTY · 21:14', 'jt2', true);
  for (const r of ROUTES) routeLine(routes, g, AIRPORTS[r.a], AIRPORTS[r.b], r.kind);
  routeLine(routes, g, AIRPORTS.ANK, AIRPORTS.AMM, 'jet');
  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue; const p = g.project(a.lon, a.lat); if (!p.vis || p.y > 430 || p.y < 90 || p.x < 20 || p.x > 392) continue;
    portSymbol(ports, { ...a, isNew: false }, p, 'night');
    if (code === 'AMM') paxStack(ports, a, p, 'night', { dx: 15 });
    label(ports, p, a.name, code, { ...PORT_LBL[code], note: undefined, ...(code === 'AMM' ? { dx: -16, dy: 24 } : {}) });
  }
  svg.append(routes, ports);
  neatline(stage, svg, [8, 76, 404, 444], glines, 'night');
  scaleBar(svg, g, 22, 428, { lon: 36, lat: 32 }, 500);
  statusbar(stage);
  stage.append(html(`<header class="line"><span>Koniec lotu</span><span class="sep"></span><span>tydzień <b>6</b>, dzień 3</span><span class="sep"></span><span>21:14</span></header>`));
  stage.append(html(`<section class="report">
    <div class="big"><b>212</b><span>pasażerów<br>dowiezionych</span></div>
    <p class="why">Zator w Ammanie: 36 osób czekało, aż pierścień doszedł do granicy.</p>
    <dl>
      <div><dt>Tygodnie</dt><dd>6 · 18 dób</dd></div>
      <div><dt>Najdłuższa trasa</dt><dd>Ateny–Karaczi · 2 408 km</dd></div>
      <div><dt>Najwięcej przesiadek</dt><dd>Ateny · 1 120</dd></div>
      <div><dt>Flota</dt><dd>4 turbośmigł. · 3 szerokokadł.</dd></div>
      <div class="rec"><dt>Rekord</dt><dd>212 · nowy</dd></div>
    </dl>
    <div class="acts">
      <button class="go">Leć jeszcze raz<svg viewBox="0 0 44 14"><path d="M0 7h42M35 1l7 6l-7 6"/></svg></button>
      <div class="pair"><button class="txt">Mapa sieci</button><button class="txt">Menu</button></div>
    </div>
  </section>`));
}

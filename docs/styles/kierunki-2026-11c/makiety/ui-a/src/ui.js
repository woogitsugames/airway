// UI-A "Lotniskowa tablica i paski lotu" (2026-11c, rev. 2): seven 412x915 frames on the K2 globe
// (../../src/globe.js, NASA Blue Marble / Black Marble). The world layer is SVG projected with the globe camera; the
// chrome is HTML/CSS built from airport vocabulary: split-flap board, enamel airfield signs, controller flight strips,
// a controller's console for the tool dock, teleprinter paper. Yellow means one thing only: direction / the next
// action (the route being drawn, its distance tag, the off-screen direction sign, the primary button).
// Airport labels are placed by a small greedy placer with zoom-dependent levels of detail (see UI-A-SPEC.md).
// Mockup code only; nothing here ships.
import { mesh } from 'topojson-client';
import { makeGlobe } from '../../src/globe.js';
import { AIRPORTS, ROUTES, PLANNED, REGIONS, GLYPH, ICON, COUNTRY_LABELS, SEA_LABELS, gc, km } from '../../src/scene.js';

export const W = 412, H = 915, DPR = 2;
const NIGHT = { space: '#010306', atm: '#7FA4D6', nightGain: 1.7, moon: 0.06, grade: 0.95, haze: 0.4, atmStrength: 0.9, stars: true };
const DAY = { space: '#010306', atm: '#8FB8E6', nightGain: 1.25, moon: 0.03, grade: 0.9, haze: 0.55, atmStrength: 1.05, stars: true };
const FRAMES = {
  night: { globe: NIGHT, sun: { lon: -55, lat: -16 }, cam: 'game', clock: '19:05', hour: 19.08, cls: 'night' },
  day: { globe: DAY, sun: { lon: 38, lat: -15 }, cam: 'game', clock: '11:40', hour: 11.67, cls: 'day' },
  dense: { globe: NIGHT, sun: { lon: -40, lat: -16 }, cam: 'dense', clock: '20:15', hour: 20.25, cls: 'night dense' },
  hc: { globe: NIGHT, sun: { lon: -55, lat: -16 }, cam: 'game', clock: '19:05', hour: 19.08, cls: 'night hc' },
  menu: { globe: NIGHT, sun: { lon: -72, lat: -14 }, cam: 'menu', cls: 'night menu' },
  week: { globe: NIGHT, sun: { lon: -70, lat: -16 }, cam: 'game', cls: 'night wk' },
  over: { globe: NIGHT, sun: { lon: -100, lat: -16 }, cam: 'over', cls: 'night rep' },
};
const CAMS = {
  game: { lon: 32, lat: 21, alt: 0.68, tlon: 32.3, tlat: 39.0, fov: 54, shift: [0, 100] },
  dense: { lon: 32.2, lat: 33, alt: 0.86, tlon: 32.4, tlat: 39.8, fov: 54, shift: [0, 30] },
  menu: { lon: 30, lat: 30, alt: 7.4, tlon: 30, tlat: 30, fov: 30, shift: [0, 118] },
  over: { lon: 36, lat: 22, alt: 0.95, tlon: 36, tlat: 31.7, fov: 50, shift: [0, 290] },
};

// The dense frame: week 4, 16 airports, 8 routes, three hubs (IST, ATH, AMM); AMM is jammed.
const DENSE = {
  WAW: { name: 'Warszawa', lon: 20.97, lat: 52.17, pax: { EUS: 1 } },
  KBP: { name: 'Kijów', lon: 30.89, lat: 50.34, pax: { ME: 2, EUS: 1 } },
  BUD: { name: 'Budapeszt', lon: 19.26, lat: 47.44, pax: { ME: 1 } },
  BEG: { name: 'Belgrad', lon: 20.31, lat: 44.82, pax: { EUS: 2, ME: 2, AFR: 1 } },
  OTP: { name: 'Bukareszt', lon: 26.10, lat: 44.57, pax: { ME: 3, AFR: 1 } },
  SOF: { name: 'Sofia', lon: 23.41, lat: 42.70, pax: { ME: 2, EUS: 2 } },
  IST: { name: 'Stambuł', lon: 28.75, lat: 41.26, hub: true, pax: { EUN: 6, ME: 8, AFR: 4 }, cap: 36, wait: 18 },
  ATH: { name: 'Ateny', lon: 23.94, lat: 37.94, hub: true, pax: { EUN: 5, ME: 4, AFR: 2 }, cap: 24, wait: 11 },
  ESB: { name: 'Ankara', lon: 32.99, lat: 40.13, pax: { EUS: 3, ME: 2 } },
  AYT: { name: 'Antalya', lon: 30.80, lat: 36.90, pax: { EUN: 4 } },
  LCA: { name: 'Larnaka', lon: 33.62, lat: 34.88, pax: { EUN: 2, EUS: 1 } },
  BEY: { name: 'Bejrut', lon: 35.49, lat: 33.82, pax: { EUN: 2, EUS: 2 } },
  TLV: { name: 'Tel Awiw', lon: 34.89, lat: 32.01, pax: { EUN: 3, EUS: 1, AFR: 1 } },
  AMM: { name: 'Amman', lon: 35.99, lat: 31.72, hub: true, jam: '0:42', pax: { EUN: 15, EUS: 12, AFR: 9 }, cap: 36, wait: 36 },
  CAI: { name: 'Kair', lon: 31.41, lat: 30.12, pax: { EUN: 4, EUS: 2 } },
  BGW: { name: 'Bagdad', lon: 44.23, lat: 33.26, pax: { EUS: 4, EUN: 3 } },
};
const DENSE_ROUTES = [
  { a: 'BEG', b: 'ATH', kind: 'prop', planes: [0.55] }, { a: 'SOF', b: 'IST', kind: 'prop', planes: [0.4] },
  { a: 'OTP', b: 'IST', kind: 'prop', planes: [] }, { a: 'IST', b: 'ATH', kind: 'jet', planes: [0.5] },
  { a: 'IST', b: 'AMM', kind: 'jet', planes: [0.62] }, { a: 'ATH', b: 'CAI', kind: 'jet', planes: [0.35] },
  { a: 'AMM', b: 'BGW', kind: 'prop', planes: [0.5] }, { a: 'LCA', b: 'AMM', kind: 'prop', planes: [] },
];

const SVGNS = 'http://www.w3.org/2000/svg';
const SVGT = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'text', 'tspan', 'polygon', 'ellipse', 'polyline'];
function el(tag, attrs = {}, ...kids) {
  const e = SVGT.includes(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const wflap = (s, cls = '') => `<span class="wflap ${cls}">${s}</span>`;
const flaps = (s, cls = '') => `<span class="flaps ${cls}">${[...s].map((c) => c === ' ' ? '<i class="sp"></i>' : c === ':' ? '<i class="narrow">:</i>' : `<i>${c}</i>`).join('')}</span>`;
// airfield direction-sign arrow (shaft + wedge head), 24x24
const ARROW = '<svg viewBox="0 0 24 24"><path d="M1 9.6 H13 V3.5 L23 12 L13 20.5 V14.4 H1 Z" fill="currentColor"/></svg>';
const icon = (id, extra = '') => `<svg viewBox="0 0 100 100" ${extra}><path d="${ICON[id]}"/></svg>`;
const CODE = { ANK: 'ESB' };

function pathOf(pts) {
  let d = '', pen = false;
  for (const p of pts) { if (!p || !p.vis) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `; pen = true; }
  return d;
}
function glyph(region, x, y, s, dark) {
  const r = REGIONS[region];
  return el('path', { d: GLYPH[r.glyph], transform: `translate(${x} ${y}) scale(${s / 12})`, fill: r.color, class: dark && region === 'AFR' ? 'gl-dark' : null });
}
function queueOrder(pax) {
  const left = Object.entries(pax).map(([r, n]) => [r, n]); const out = [];
  while (left.some(([, n]) => n > 0)) for (const e of left) if (e[1] > 0) { out.push(e[0]); e[1]--; }
  return out;
}

export async function render(stage, f, debug) {
  const F = FRAMES[f];
  stage.className = F.cls;
  await Promise.all(['700 14px Archivo', '800 14px Archivo', '600 14px Archivo', '500 14px Archivo', 'italic 500 14px Archivo', '500 14px "Chivo Mono"', '700 14px "Chivo Mono"', '800 14px "Chivo Mono"'].map((s) => document.fonts.load(s)));
  const g = await makeGlobe(stage, { w: W, h: H, dpr: DPR, theme: F.globe, cam: CAMS[F.cam], sunLL: F.sun });
  if (f === 'hc') stage.append(html('<div class="hc-dim"></div>'));
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'world' });
  stage.append(svg);
  const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  drawBorders(svg, g, topo, F.cam);
  if (debug) for (const [c, a] of Object.entries(f === 'dense' ? DENSE : AIRPORTS)) { const p = g.project(a.lon, a.lat); console.log(c, p.x.toFixed(0), p.y.toFixed(0), p.vis); }
  statusbar(stage);
  if (f === 'night' || f === 'day') { drawNetwork(svg, g, f, { lod: 1, s: 1, area: [132, 672] }); drawAtlas(svg, g, 1); drawGameChrome(stage, F, 2); }
  if (f === 'hc') { drawNetwork(svg, g, f, { lod: 2, s: 1.3, area: [140, 690] }); drawGameChrome(stage, F, 1); }
  if (f === 'dense') { drawDense(svg, g); drawAtlas(svg, g, 2); drawGameChrome(stage, F, 1); }
  if (f === 'menu') { drawNetworkSmall(svg, g); drawMenu(stage); }
  if (f === 'week') { drawOver(svg, g, true); drawWeek(stage); }
  if (f === 'over') { drawOver(svg, g); drawReport(stage); }
  if (debug) for (const r of placed) svg.append(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: 'none', stroke: '#f0f', 'stroke-width': 0.5 }));
}

function drawBorders(svg, g, topo, cam) {
  const m = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const box = cam === 'menu' ? [-180, 180, -90, 90] : [-15, 85, 5, 75];
  let d = '';
  for (const line of m.coordinates) d += pathOf(line.map(([lon, lat]) => (lon < box[0] || lon > box[1] || lat < box[2] || lat > box[3]) ? null : g.project(lon, lat)));
  svg.append(el('path', { d, class: 'border' }));
}
// atlas labels yield to airport plates: a country or sea name that would touch a plate is not drawn
const free = (p, w) => { const b = { x: p.x - w / 2, y: p.y - 10, w, h: 13 }; return b.x > 4 && b.x + b.w < W - 4 && !placed.some((o) => overlap(b, o)) && !pinBoxes.some((o) => overlap(b, o)); };
// atlas labels: at LOD 1 countries and seas; at LOD 2 seas only (countries would compete with 16 airport plates)
function drawAtlas(svg, g, lod) {
  const grp = el('g', { class: 'atlas' });
  if (lod === 1) for (const c of COUNTRY_LABELS) {
    const p = g.project(c.lon, c.lat); if (c.t === 'TURCJA' || !p.vis || p.y < 150 || p.y > 660 || p.x < 50 || p.x > 362) continue;
    if (free(p, c.t.length * 10)) grp.append(el('text', { x: p.x, y: p.y, class: 'country' }, c.t));
  }
  const seas = lod === 1 ? [...SEA_LABELS.map((s) => [s.lon, s.lat, s.t]), [24.5, 33.6, 'Morze Śródziemne']]
    : [[34.6, 43.4, 'Morze Czarne'], [20.0, 34.6, 'Morze Śródziemne']];
  for (const [lon, lat, t] of seas) { const p = g.project(lon, lat); if (p.vis && free(p, t.length * 7)) grp.append(el('text', { x: p.x, y: p.y, class: 'sea' }, t)); }
  svg.insertBefore(grp, svg.children[1]);
}

function routeLayer(g, routes, ports, f, withPlanes, s = 1) {
  const rl = el('g', { class: 'routes' }), planes = el('g', { class: 'planes' });
  for (const r of routes) {
    const A = ports[r.a], B = ports[r.b], fn = gc(A, B);
    const d = pathOf(Array.from({ length: 97 }, (_, i) => { const [lon, lat] = fn(i / 96); return g.project(lon, lat); }));
    rl.append(el('path', { d, class: `casing ${r.kind}` }), el('path', { d, class: `core ${r.kind}` }));
    if (withPlanes) for (const t of r.planes) drawPlane(planes, g, fn, t, r.kind, f === 'day' ? 0 : 1, s);
  }
  return { routes: rl, planes };
}

function drawPlane(layer, g, fn, t, kind, lights, s = 1) {
  const [lon, lat] = fn(t), [lon2, lat2] = fn(Math.min(1, t + 0.01));
  const alt = 0.008;
  const p = g.project(lon, lat, alt), q = g.project(lon2, lat2, alt), sh = g.project(lon, lat);
  const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
  const size = (kind === 'jet' ? 38 : 31) * Math.min(s, 1.15), sc = size / 100;
  layer.append(el('path', { d: ICON[kind], class: 'shadow', transform: `translate(${sh.x + 2} ${sh.y + 7}) rotate(${ang}) scale(${sc}) translate(-50 -50)` }));
  const pg = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${ang}) scale(${sc}) translate(-50 -50)` });
  pg.append(el('path', { d: ICON[kind], class: 'plane' }));
  if (lights) {
    const wing = kind === 'jet' ? [8, 66, 92, 66] : [10, 49, 90, 49];
    pg.append(el('circle', { cx: wing[0], cy: wing[1], r: 4, fill: '#E8382E' }), el('circle', { cx: wing[2], cy: wing[3], r: 4, fill: '#3FD07A' }));
  }
  layer.append(pg);
  planeBoxes.push({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size });
}

// ---------------------------------------------------------------------------------------------------------------
// Airport labels: enamel plates (cream code on black, cream keyline) with the waiting queue as D-08 glyphs.
// LOD 1 (close zoom): code + one glyph per passenger (max 7, then +n) + city name under the plate.
// LOD 2 (wide zoom or text scale >= 120 %): code + one glyph per destination region + total; city only on hubs.
// LOD 3 (fallback when nothing fits): code only. Neighbours that still collide are grouped into one shared plate.
// Hubs and the jammed hub always keep their plate; jam = white on red with the countdown (mandatory-sign colours).
let placed = [], pinBoxes = [], planeBoxes = [];
const mtx = document.createElement('canvas').getContext('2d');
const tw = (t, px, wt = 800) => { mtx.font = `${wt} ${px}px Archivo`; return mtx.measureText(t).width * 0.84; };

function plateSpec(code, a, lod, s) {
  const hub = !!a.hub, jam = !!a.jam;
  const fs = (hub ? 16 : 14) * s, h = (hub ? 25 : 21) * s;
  const codeW = Math.ceil(tw(code, fs) + 14 * s);
  const tok = 11 * s, parts = [];
  let w = codeW;
  if (!hub) {
    const q = queueOrder(a.pax);
    if (lod === 1) {
      const shown = q.slice(0, 7); parts.push({ k: 'q', list: shown, x: w + 3 * s }); w += shown.length * tok + 6 * s;
      if (q.length > 7) { parts.push({ k: 'more', t: `+${q.length - 7}`, x: w - 2 * s }); w += 16 * s; }
    } else if (lod === 2) {
      const regs = Object.entries(a.pax).sort((x, y) => y[1] - x[1]).map(([r]) => r);
      parts.push({ k: 'q', list: regs, x: w + 3 * s }); w += regs.length * tok + 4 * s;
      const n = String(q.length); parts.push({ k: 'n', t: n, x: w }); w += tw(n, 13 * s, 700) + 7 * s;
    }
  }
  if (jam) { parts.push({ k: 'jam', t: a.jam }); w += 40 * s; }
  if (a.isNew) w += 0; // the NOWE tab hangs above the plate, see drawPlate
  const city = lod === 1 || hub ? a.name : null;
  const cityW = city ? tw(city, 11 * s, 600) / 0.84 * 0.97 + 2 : 0;
  return { code, a, hub, jam, h, w, codeW, parts, tok, fs, s, city, cityW, cityH: city ? 13 * s : 0, lod };
}

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
function boxOf(sp, x0, y0, left) {
  const top = sp.a.isNew ? y0 - 14 * sp.s : y0;
  const w = Math.max(sp.w, sp.cityW), x = left ? x0 + sp.w - w : x0;
  return { x, y: top, w, h: y0 + sp.h + (sp.city ? sp.cityH + 2 : 0) - top };
}
// candidate slots around the pin, preferred side first; then the same slots at leader-line distance
function candidates(sp, p, pref) {
  const r = (sp.hub ? 12.5 : 5.4) + 4, w = sp.w, h = sp.h;
  const base = {
    r: [p.x + r, p.y - h / 2, 0], l: [p.x - r - w, p.y - h / 2, 1], ru: [p.x + 2, p.y - r - h - sp.cityH, 0], lu: [p.x - 2 - w, p.y - r - h - sp.cityH, 1],
    rd: [p.x + 2, p.y + r, 0], ld: [p.x - 2 - w, p.y + r, 1],
  };
  const order = [pref, 'r', 'l', 'ru', 'lu', 'rd', 'ld'].filter((k, i, arr) => k && arr.indexOf(k) === i);
  const out = order.map((k) => ({ k, x: base[k][0], y: base[k][1], left: !!base[k][2], lead: 0 }));
  for (const k of order) { const L = 20; const dx = base[k][2] ? -L : k === 'r' || k === 'l' ? L : 6, dy = k.endsWith('u') ? -L : k.endsWith('d') ? L : 0;
    out.push({ k, x: base[k][0] + dx, y: base[k][1] + dy, left: !!base[k][2], lead: 1 }); }
  return out;
}
function cost(b, area, own) {
  let c = 0;
  for (const o of placed) c += overlap(b, o) * 4;
  for (const o of pinBoxes) if (o !== own) c += overlap(b, o) * 6;
  for (const o of planeBoxes) c += overlap(b, o) * 1.5;
  if (b.x < 4 || b.x + b.w > W - 4 || b.y < area[0] || b.y + b.h > area[1]) c += 1e5;
  return c;
}
function place(items, area) {
  // items: {code, a, p, pref, prio}; returns [{sp, x, y, left, lead}] and the codes that must be grouped
  const res = [], failed = [];
  for (const it of items.sort((x, y) => y.prio - x.prio)) {
    let done = false;
    for (const lod of it.lods) {
      const sp = plateSpec(it.code, it.a, lod, it.s);
      let best = null;
      for (const c of candidates(sp, it.p, it.pref)) {
        const b = boxOf(sp, c.x, c.y, c.left), raw = cost(b, area, it.pin), k = raw + c.lead * 40;
        if (!best || k < best.k) best = { ...c, b, k, raw };
        if (k === 0) break;
      }
      if (best.raw === 0 || lod === it.lods[it.lods.length - 1] && it.force) { placed.push(best.b); res.push({ sp, p: it.p, members: it.members, ...best }); done = true; break; }
    }
    if (!done) failed.push(it);
  }
  return { res, failed };
}

function drawPlate(layer, R, quiet) {
  const { sp, p, x: x0, y: y0, left, lead } = R, s = sp.s, h = sp.h;
  const plate = el('g', { class: `plate${sp.hub ? ' hub' : ''}${sp.jam ? ' jam' : ''}` });
  for (const m of R.members || []) {
    const tx = Math.max(x0 + 3, Math.min(x0 + sp.w - 3, m.p.x)), ty = m.p.y < y0 ? y0 : m.p.y > y0 + h ? y0 + h : y0 + h / 2;
    const ex = m.p.y >= y0 && m.p.y <= y0 + h ? (m.p.x < x0 ? x0 : x0 + sp.w) : tx;
    plate.append(el('path', { d: `M${m.p.x} ${m.p.y} L${ex} ${ty}`, class: 'lead' }));
  }
  if (lead && !R.members) {
    const tx = left ? x0 + sp.w : x0, ty = y0 + h / 2;
    plate.append(el('path', { d: `M${p.x} ${p.y} L${tx} ${ty}`, class: 'lead' }));
  }
  plate.append(el('rect', { x: x0, y: y0, width: sp.w, height: h, rx: 2, class: 'bg' }));
  plate.append(el('rect', { x: x0 + 2.5 * s, y: y0 + 2.5 * s, width: sp.codeW - 5 * s, height: h - 5 * s, rx: 1, class: 'loc' }));
  plate.append(el('text', { x: x0 + sp.codeW / 2, y: y0 + h / 2 + sp.fs * 0.36, 'text-anchor': 'middle', class: 'code', 'font-size': sp.fs }, sp.code));
  for (const pt of sp.parts) {
    if (pt.k === 'q') pt.list.forEach((r, i) => plate.append(glyph(r, x0 + pt.x + sp.tok / 2 + i * sp.tok, y0 + h / 2, 9.5 * s, true)));
    if (pt.k === 'more') plate.append(el('text', { x: x0 + pt.x, y: y0 + h / 2 + 3.6 * s, class: 'more', 'font-size': 10 * s }, pt.t));
    if (pt.k === 'n') plate.append(el('text', { x: x0 + pt.x, y: y0 + h / 2 + 4.6 * s, class: 'n', 'font-size': 13 * s }, pt.t));
    if (pt.k === 'jam') plate.append(el('text', { x: x0 + sp.w - 6 * s, y: y0 + h / 2 + 5 * s, 'text-anchor': 'end', class: 't', 'font-size': 14 * s }, pt.t));
  }
  if (sp.city) plate.append(el('text', { x: left ? x0 + sp.w : x0, y: y0 + h + 11 * s, 'text-anchor': left ? 'end' : 'start', class: 'city', 'font-size': 11 * s }, sp.city));
  if (sp.a.isNew && !quiet) {
    // NOWE: a small cream tab hung on the plate's top edge (an enamel 'new' tag), not a badge
    plate.append(el('g', { class: 'new', transform: `translate(${x0 + sp.codeW + 2} ${y0 - 12 * s})` }, el('rect', { width: 32 * s, height: 13 * s, rx: 1 }), el('text', { x: 16 * s, y: 9.6 * s, 'text-anchor': 'middle', 'font-size': 8 * s }, 'NOWE')));
  }
  layer.append(plate);
}
function pinOf(layer, a, p, s = 1) {
  const g = el('g', { class: `port${a.hub ? ' hub' : ''}${a.jam ? ' jam' : ''}` });
  if (a.jam) {
    const R = 21 * Math.min(s, 1.15);
    g.append(el('circle', { cx: p.x, cy: p.y, r: R, class: 'jam-ring' }));
    const frac = 0.47, a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
    g.append(el('path', { d: `M${p.x} ${p.y - R} A${R} ${R} 0 0 1 ${p.x + R * Math.cos(a1)} ${p.y + R * Math.sin(a1)}`, class: 'jam-arc' }));
  }
  if (a.hub) {
    g.append(el('circle', { cx: p.x, cy: p.y, r: 12.5, class: 'hub-outer' }), el('circle', { cx: p.x, cy: p.y, r: 9, class: 'hub-inner' }));
    g.append(el('path', { d: ICON.hub, class: 'hub-mark', transform: `translate(${p.x} ${p.y}) scale(0.125) translate(-50 -50)` }));
  } else g.append(el('circle', { cx: p.x, cy: p.y, r: 5.4, class: 'pin' }));
  layer.append(g);
  const r = a.jam ? 22 : a.hub ? 13 : 6;
  const box = { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }; pinBoxes.push(box); return box;
}

const PREF = { RIX: 'r', BEG: 'r', KBP: 'r', ATH: 'l', ANK: 'r', CAI: 'l', AMM: 'rd', BGW: 'lu' };

function drawNetwork(svg, g, f, { lod, s, area }) {
  placed = []; pinBoxes = []; planeBoxes = [];
  const { routes, planes } = routeLayer(g, ROUTES, AIRPORTS, f, true, s);
  const ports = el('g', { class: 'ports' }), labels = el('g', { class: 'labels' });
  // the route the player is drawing: yellow grease pencil (the only yellow on the map besides the edge sign)
  const A = AIRPORTS[PLANNED.a], B = AIRPORTS[PLANNED.b], fn = gc(A, B);
  const pts = Array.from({ length: 49 }, (_, i) => { const [lon, lat] = fn(i / 48); const p = g.project(lon, lat); p.x += Math.sin(i * 1.7) * 0.7; return p; });
  routes.append(el('path', { d: pathOf(pts), class: 'planned-casing' }), el('path', { d: pathOf(pts), class: 'planned' }));
  const items = [];
  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue;
    const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    const pin = pinOf(ports, a, p, s);
    items.push({ code: CODE[code] || code, a, p, pin, s, pref: PREF[code], prio: a.jam ? 100 : a.hub ? 50 : queueOrder(a.pax).length, lods: lod === 1 ? [1, 2, 3] : [2, 3], force: true });
  }
  const m = fn(0.3), mp = g.project(m[0], m[1]);
  const t = `${fmt(km(A, B))} km`, tagW = 54 * s, tagH = 19 * s;
  const tag = { x: mp.x + 9, y: mp.y - 10 * s, w: tagW, h: tagH }; placed.push(tag);
  routes.append(el('g', { class: 'sign-y', transform: `translate(${tag.x} ${tag.y})` }, el('rect', { width: tagW, height: tagH, rx: 1.5 }), el('text', { x: tagW / 2, y: 13.6 * s, 'text-anchor': 'middle', 'font-size': 11 * s }, t)));
  const { res } = place(items, area);
  for (const R of res) drawPlate(labels, R);
  svg.append(routes, ports, planes, labels);
  const K = AIRPORTS.KHI, p = g.project(AIRPORTS.BGW.lon, AIRPORTS.BGW.lat);
  svg.parentElement.append(html(`<div class="edge-sign" style="top:${(p.y + (s > 1 ? 150 : 118)).toFixed(0)}px"><div class="tx"><b>KHI</b><span>Karaczi ${fmt(km(AIRPORTS.BGW, K))} km</span></div>${ARROW}</div>`));
}

function drawDense(svg, g) {
  placed = []; pinBoxes = []; planeBoxes = [];
  const area = [132, 708];
  const { routes, planes } = routeLayer(g, DENSE_ROUTES, DENSE, 'dense', true);
  const ports = el('g', { class: 'ports' }), labels = el('g', { class: 'labels' });
  const items = [];
  for (const [code, a] of Object.entries(DENSE)) {
    const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    const pin = pinOf(ports, a, p);
    const linked = DENSE_ROUTES.some((r) => r.a === code || r.b === code);
    const n = queueOrder(a.pax).length;
    // importance: jam > hub > linked > waiting; small unlinked airports may drop to code only (LOD 3)
    items.push({ code, a, p, pin, s: 1, pref: { ATH: 'l', CAI: 'l', AMM: 'rd', BGW: 'lu', IST: 'ru', LCA: 'l', BEY: 'r', TLV: 'l' }[code], prio: a.jam ? 100 : a.hub ? 50 : (linked ? 20 : 0) + n, lods: linked || n >= 4 ? [2, 3] : [2, 3], force: false });
  }
  // grouping pre-pass: ordinary airports whose pins are closer than GROUP_PX share one plate
  const GROUP_PX = 40, groups = [];
  for (const it of items.filter((i) => !i.a.hub)) {
    const near = items.filter((o) => o !== it && !o.a.hub && !o.grouped && Math.hypot(o.p.x - it.p.x, o.p.y - it.p.y) < GROUP_PX);
    if (it.grouped || !near.length) continue;
    const mem = [it, ...near]; mem.forEach((m) => { m.grouped = true; });
    const pax = {}; for (const m of mem) for (const [r, n] of Object.entries(m.a.pax)) pax[r] = (pax[r] || 0) + n;
    const p = { x: mem.reduce((t, m) => t + m.p.x, 0) / mem.length, y: mem.reduce((t, m) => t + m.p.y, 0) / mem.length };
    groups.push({ code: mem.map((m) => m.code).join('·'), a: { name: '', pax }, p, s: 1, members: mem, pref: 'l', prio: 30, lods: [2], force: true });
  }
  const { res, failed } = place([...items.filter((i) => !i.grouped), ...groups], area);
  for (const R of res) drawPlate(labels, R);
  for (const it of failed) { const { res: r2 } = place([{ ...it, lods: [3], force: true }], area); r2.forEach((R) => drawPlate(labels, R)); }
  svg.append(routes, ports, planes, labels);
  window.__dense = { placed: res.map((r) => [r.sp.code, r.sp.lod, r.k, r.lead]), failed: failed.map((f) => f.code) };
  console.log(JSON.stringify(window.__dense));
}

function statusbar(stage) {
  stage.append(html(`<div class="statusbar"><span>14:32</span><span class="sb-r"><i></i><i></i><b></b></span></div>`));
}

function hoursBar(hour) {
  const cells = Array.from({ length: 24 }, (_, h) => `<i class="${h < 6 || h >= 19 ? 'n' : 'd'}${h < Math.floor(hour) ? ' past' : ''}"></i>`).join('');
  return `<div class="hours">${cells}<em style="left:${(hour / 24 * 100).toFixed(2)}%"></em></div>`;
}

const SCREW = '<svg class="screw" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2"/><path d="M2.4 6.6 L7.6 3.4"/></svg>';
// The dock is a controller's console: a sloped enamel panel with screwed-on controls. Shape says what a control
// does: round push button = instant action (Undo), rotary selector = setting (Tempo), rectangular enamel plate =
// an aircraft to place (with the route line it flies: dashed = turboprop, solid = widebody), octagon = something
// to build (Hub). The armed plate is inverted to cream and its lamp is lit; no yellow in the dock.
function dock(F) {
  const hc = F.cls.includes('hc'); // text 130 %: the dock switches to the short label forms

  const plateTool = (id, label, n, line, sel) => `<button class="ctl plate-tool ${id}${sel ? ' sel' : ''}" aria-label="${label}" aria-pressed="${sel ? 'true' : 'false'}">
      <span class="face">${SCREW}${SCREW}<i class="lamp"></i>${icon(id)}<span class="line ${line}"></span>${flaps(n, 'cnt')}</span><span class="eng">${label}</span></button>`;
  return html(`<nav class="console" aria-label="Narzędzia">
    <button class="ctl round" aria-label="Cofnij"><span class="face"><span class="cap">${icon('undo')}</span></span><span class="eng">Cofnij</span></button>
    ${plateTool('prop', hc ? 'Turbo' : 'Turbośmigł.', '2', 'dash', true)}
    ${plateTool('jet', hc ? 'Szeroki' : 'Szerokokadł.', '1', 'solid', false)}
    <button class="ctl oct off" aria-label="Hub, dostępny za 1 dzień" aria-disabled="true"><span class="face"><span class="cap">${icon('hub')}</span></span><span class="tag">${hc ? '1 dzień' : 'za 1 dzień'}</span><span class="eng">Hub</span></button>
    <button class="ctl rotary" aria-label="Tempo 1×"><span class="face"><svg viewBox="0 0 60 60"><g class="ticks"><path d="M14 44 L18 40"/><path d="M30 8 L30 13"/><path d="M46 44 L42 40"/></g><text x="8" y="57">1</text><text x="26" y="6.5">2</text><text x="46" y="57">4</text><circle cx="30" cy="31" r="17" class="knob"/><path d="M30 31 L18.5 42.5" class="ptr"/></svg></span><span class="eng">Tempo</span></button>
  </nav>`);
}

function drawGameChrome(stage, F, strips) {
  stage.append(html(`<header class="board">
    <div class="row">
      <div class="cell"><span class="lg">Czas lokalny</span>${flaps(F.clock, 'clock')}</div>
      <div class="cell"><span class="lg">Tydz.</span>${flaps(F.cls.includes('dense') ? '4' : '1', 'sm')}</div>
      <div class="cell"><span class="lg">Dzień</span>${flaps('2/3', 'sm')}</div>
      <div class="cell"><span class="lg">Pasaż.</span>${flaps(F.cls.includes('dense') ? '139' : '034', 'sm')}</div>
    </div>
    ${hoursBar(F.hour)}
  </header>`));
  stage.append(html(`<button class="ctl pause" aria-label="Pauza"><span class="face"><span class="cap"><svg viewBox="0 0 20 20"><rect x="3.5" y="3" width="4.6" height="14"/><rect x="11.9" y="3" width="4.6" height="14"/></svg></span></span><span class="eng">Stop</span></button>`));
  const hc = F.cls.includes('hc');
  const bayH = strips === 2 ? 126 : hc ? 87 : 67;
  stage.append(stripBay(H - 112 - bayH, strips, hc));
  stage.append(dock(F));
}

function stripQueue(pax, w, tok = 7.6) {
  const rows = Object.entries(pax);
  const s = el('svg', { width: w, height: rows.length * 9.5, viewBox: `0 0 ${w} ${rows.length * 9.5}` });
  rows.forEach(([r, n], i) => { for (let k = 0; k < n; k++) s.append(glyph(r, 4 + k * tok, 4.8 + i * 9.5, tok - 1.2, false)); });
  return s.outerHTML;
}

function stripBay(top, n, hc) {
  const A = AIRPORTS.AMM, T = AIRPORTS.ATH;
  const loop = '<svg class="pencil" style="left:0;top:12px" width="64" height="40"><path d="M52 7 C 68 11, 69 30, 50 36 C 30 42, 4 38, 3 23 C 2 9, 26 2, 46 4 C 54 5, 60 9, 62 14"/></svg>';
  const amm = `<div class="strip jam">
      <div class="holder">${icon('hub')}</div>
      <div class="col" style="width:64px"><small>Hub</small><b class="code">AMM</b><span class="city">Amman</span></div>
      <div class="col q"><small>Kolejka${hc ? '' : ' · 3 kierunki'}</small>${hc ? `<span class="qbig">${Object.entries(A.pax).map(([r, k]) => `<span><svg width="14" height="14" viewBox="-7 -7 14 14"><path d="${GLYPH[REGIONS[r].glyph]}" fill="${REGIONS[r].color}"/></svg>${k}</span>`).join('')}</span>` : n === 1 ? stripQueue(A.pax, 108, 6.8) : stripQueue(A.pax, 132)}</div>
      <div class="col" style="width:${hc ? 68 : 60}px"><small>Miejsca</small><b class="num">36/36</b></div>
      <div class="col" style="width:${hc ? 78 : 72}px"><small>Zamkn.</small><b class="big">0:42</b>${hc ? '' : loop}</div>
    </div>`;
  const ath = `<div class="strip ok">
      <div class="holder">${icon('hub')}</div>
      <div class="col" style="width:64px"><small>Hub</small><b class="code">ATH</b><span class="city">Ateny</span></div>
      <div class="col q"><small>Kolejka · 3 kierunki</small>${stripQueue(T.pax, 132)}</div>
      <div class="col" style="width:60px"><small>Miejsca</small><b class="num">14/24</b></div>
      <div class="col" style="width:72px"><small>Zamkn.</small><b class="num ok" style="font-size:13px;margin-top:8px">brak</b></div>
    </div>`;
  const more = n === 1 ? `<span class="bay-more" aria-label="2 kolejne paski"><b>+2</b>paski</span>` : '';
  return html(`<section class="bay${n === 1 ? ' one' : ''}" style="top:${top}px">${amm}${n === 2 ? ath : ''}${more}</section>`);
}

function drawNetworkSmall(svg, g) {
  const { routes } = routeLayer(g, ROUTES, AIRPORTS, 'menu', false);
  routes.querySelectorAll('.casing').forEach((e) => e.setAttribute('stroke-width', '4'));
  routes.querySelectorAll('.core').forEach((e) => { e.setAttribute('stroke-width', '2'); });
  const ports = el('g');
  for (const a of Object.values(AIRPORTS)) {
    if (a.off) continue; const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    ports.append(el('circle', { cx: p.x, cy: p.y, r: a.hub ? 3.6 : 2.4, class: 'pin', 'stroke-width': 1.2 }));
  }
  svg.append(routes, ports);
}

function drawMenu(stage) {
  stage.append(html(`<header class="masthead">${flaps('AIRWAY')}<p>Sieć lotnicza na prawdziwej Ziemi</p></header>`));
  stage.append(html(`<div class="globe-cap" style="top:492px"><i></i>Lewant · 19:05 · zapada noc</div>`));
  const gl = (r) => `<svg width="15" height="15" viewBox="-7.5 -7.5 15 15"><path d="${GLYPH[REGIONS[r].glyph]}" fill="${REGIONS[r].color}" ${r === 'AFR' ? 'class="gl-dark"' : ''}/></svg>`;
  const arr = ARROW.replace('<svg', '<svg width="18" height="18" style="color:#EFE7D3"');
  stage.append(html(`<section class="fids" style="top:520px">
    <div class="hd"><span>Odloty · <b>wybierz</b></span><span>08.11</span></div>
    <button class="r"><span>${wflap('Dziś')}<small>Ten sam świat dla wszystkich</small></span><span class="st">${gl('EUN')} ${gl('ME')} ${gl('AFR')}<br><span class="open">OTWARTE</span></span></button>
    <button class="r"><span>${wflap('Zadania')}<small>0 z 40 rozwiązanych</small></span><span class="st">${flaps('0/40', 'stf')}</span></button>
    <button class="r"><span>${wflap('Dziennik')}<small>Rekordy i trasy</small></span><span class="st">${arr}</span></button>
    <button class="r"><span>${wflap('Ustawienia')}<small>Dźwięk, język, tempo, kontrast</small></span><span class="st">${arr}</span></button>
  </section>`));
  stage.append(html(`<button class="go" style="bottom:22px"><span><b>Lot bez końca</b><small>Rekord: 212 pasażerów · tydzień 6</small></span>${ARROW}</button>`));
}

function drawWeek(stage) {
  stage.append(html('<div class="scrim"></div>'));
  stage.append(html(`<header class="board" style="width:396px">
    <div class="row">
      <div class="cell"><span class="lg">Koniec tygodnia</span>${flaps('TYDZ 1', 'clock')}</div>
    </div>
    <div class="row" style="margin-top:9px;gap:14px">
      <div class="cell"><span class="lg">Pasażerowie</span>${flaps('034', 'sm')}</div>
      <div class="cell"><span class="lg">Trasy</span>${flaps('3', 'sm')}</div>
      <div class="cell"><span class="lg">Samoloty</span>${flaps('3', 'sm')}</div>
      <div class="cell"><span class="lg">Przesiadki</span>${flaps('11', 'sm')}</div>
    </div>
  </header>`));
  stage.append(html(`<h2 style="top:466px">Przydział na tydzień 2 · weź jeden pasek</h2>`));
  const strip = (cls, id, name, desc, qty, unit) => `<div class="strip ${cls}"><div class="holder">${icon(id)}</div><div class="main"><b>${name}</b><span>${desc}</span></div><div class="qty"><b>${qty}</b><small>${unit}</small></div>${cls.includes('sel') ? '<i class="clip">wybrany</i>' : ''}</div>`;
  stage.append(html(`<section class="pick" style="top:492px">
    ${strip('prop sel', 'prop', 'Turbośmigłowiec', 'Krótkie trasy do 1 500 km.<br>12 miejsc, szybki obrót.', '+2', 'samoloty')}
    ${strip('jet', 'jet', 'Szerokokadłubowiec', 'Długie trasy między hubami.<br>36 miejsc, wolny obrót.', '+1', 'samolot')}
    ${strip('hub', 'hub', 'Hub', 'Lotnisko przesiadkowe:<br>kolejka 24 → 36 miejsc.', '+1', 'hub')}
  </section>`));
  stage.append(html(`<button class="go" style="bottom:22px"><span><b>Weź turbośmigłowce</b><small>Tydzień 2 zaczyna się o 06:00</small></span>${ARROW}</button>`));
}

function drawOver(svg, g, calm) {
  const { routes, planes } = routeLayer(g, ROUTES, AIRPORTS, 'over', !!calm);
  const ports = el('g');
  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue; const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    if (code === 'AMM' && !calm) {
      ports.append(el('circle', { cx: p.x, cy: p.y, r: 20, class: 'jam-ring' }), el('circle', { cx: p.x, cy: p.y, r: 20, class: 'jam-arc' }));
      ports.append(el('circle', { cx: p.x, cy: p.y, r: 10, fill: '#C9251C', stroke: '#fff', 'stroke-width': 2 }));
    } else ports.append(el('circle', { cx: p.x, cy: p.y, r: a.hub ? 5 : 3.6, class: 'pin', 'stroke-width': 1.6 }));
  }
  svg.append(routes, ports, planes);
}

// Teleprinter report. The ZATOR stamp has its own printed field at the foot of the slip ('pole pieczęci'), with a
// clear margin from the sprocket holes, the rules and every printed line: it never touches the paper's track.
function drawReport(stage) {
  stage.append(html('<div class="scrim" style="background:rgba(5,6,7,.5)"></div>'));
  const ln = (k, v, extra = '') => `<div class="ln"><span>${k}</span><span class="dots">${' .'.repeat(40)}</span><b>${v}</b>${extra}</div>`;
  const q = el('svg', { width: 260, height: 30, viewBox: '0 0 260 30' });
  Object.entries({ EUN: 15, EUS: 12, AFR: 9 }).forEach(([r, n], i) => { for (let k = 0; k < n; k++) q.append(glyph(r, 5 + k * 9, 5 + i * 10, 7.6, false)); });
  stage.append(html(`<article class="ticket" style="top:206px">
    <div class="tear"></div>
    <h3>AIRWAY · RAPORT KOŃCOWY</h3>
    <div>08.11.2026 · LOT BEZ KOŃCA</div>
    <hr>
    <div><b>HUB AMM AMMAN ZAMKNIĘTY</b></div>
    <div>TYDZ. 6 · DZIEŃ 3 · 04:12</div>
    <div>KOLEJKA PRZY ZAMKNIĘCIU 36/36:</div>
    ${q.outerHTML}
    <hr>
    ${ln('PRZEWIEZIENI', '212', '<span class="new">REKORD</span>')}
    ${ln('PRZESIADKI', '118')}
    ${ln('TRASY', '9')}
    ${ln('SAMOLOTY', '11')}
    ${ln('NAJDŁ. LOT ATH–KHI', '3 302 km')}
    ${ln('HUBY', 'ATH · AMM · IST')}
    <hr>
    <div class="tbl th"><span>TYDZ.</span><span>PASAŻ.</span><span>TRASY</span><span>UWAGI</span></div>
    ${[[1,34,3],[2,71,4],[3,108,6],[4,139,7],[5,176,8],[6,212,9]].map(([w,p,t])=>`<div class="tbl"><span>${w}</span><span>${p}</span><span>${t}</span><span>${w===6?"<b>ZATOR AMM</b>":"—"}</span></div>`).join('')}
    <hr>
    <div class="foot"><div class="sig"><div>KONIEC RAPORTU</div><div>ZACHOWANY W DZIENNIKU</div><div class="sigline">DYŻURNY: ____________</div></div>
      <div class="field"><span>POLE PIECZĘCI</span><div class="stamp">ZATOR<small>AMM 04:12</small></div></div></div>
  </article>`));
  stage.append(html(`<div class="btnrow" style="bottom:22px"><button class="go alt"><span><b>Menu</b></span></button><button class="go"><span><b>Jeszcze raz</b><small>Nowy świat, ta sama Ziemia</small></span>${ARROW}</button></div>`));
}

// Direction C "Makieta": the globe is a hand-made physical model on a dark studio table: sculpted relief in
// matte painted plaster, the sea in glossy resin, one warm key lamp from the upper left and a cool lamp on the
// night side. Airports are enamel map pins, routes brass wires above the surface with real shadows, planes
// small die-cast models. UI = the same enamel tokens and stencil decals, lit by the same lamp.
import { renderGlobe, makeCamera, hex, mix, clamp, smooth } from './globe.js';
import { W, H, SUN, AIRPORTS, ROUTES, PLANES, REGIONS, GLYPH, screenArc, toD, planePose, el, km, GAME_CAM, MENU_CAM } from './scene.js';
import { ICON } from './icons.js';

const C = {
  table: '#26221F', desert: '#DDBE88', steppe: '#C4B07A', temperate: '#97A86C', forest: '#728C5A', rock: '#A68A6C', snow: '#EEE9DE',
  sea: '#2C6C8A', seaDeep: '#1F4F68', shelf: '#3E8BA2', night: '#384774',
  enamel: '#F3EEE4', enamelShade: '#C9C1B2', ink: '#1F1D1C', red: '#D8432C', brass: '#B98A3E', brassHi: '#F1D38E', decal: '#F3EEE4',
};
const X = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)]));
const L = (() => { const v = [-0.5, 0.62, 0.6]; const l = Math.hypot(...v); return v.map((a) => a / l); })();
const Hh = (() => { const v = [L[0], L[1], L[2] + 1]; const l = Math.hypot(...v); return v.map((a) => a / l); })();

function shade(s) {
  const nd = clamp(L[0] * s.nx + L[1] * s.ny + L[2] * s.nz);
  let col;
  if (s.land < 0.5) {
    col = s.dist < 1.0 ? mix(X.shelf, X.sea, s.dist) : mix(X.sea, X.seaDeep, clamp((s.dist - 1) / 8));
    const light = 0.55 + 0.55 * nd;
    col = col.map((c) => c * light);
    const spec = Math.pow(clamp(Hh[0] * s.nx + Hh[1] * s.ny + Hh[2] * s.nz), 160) * 0.35;
    const fres = Math.pow(1 - s.nz, 3) * 0.35;
    col = mix(col, [255, 248, 232], clamp(spec + fres * 0.5));
  } else {
    const e = s.elevb, lat = Math.abs(s.lat), lon = s.lon;
    const arid = lat > 12 && lat < 35 && lon > -18 && lon < 62;
    col = arid ? X.desert : lat > 52 ? X.forest : lat > 44 ? X.temperate : X.steppe;
    if (e > 0.22) col = mix(col, X.rock, smooth(0.22, 0.4, e));
    if (e > 0.5) col = mix(col, X.snow, smooth(0.5, 0.62, e));
    const relief = 0.5 + 0.8 * (0.35 * s.hs + 0.65 * s.hsb); // sculpted relief, exaggerated
    const light = (0.42 + 0.62 * nd) * relief;
    col = col.map((c) => Math.min(255, c * light));
  }
  // night side: lit by a cool lamp instead of going black
  const nightT = smooth(0.05, -0.08, s.sun);
  if (nightT > 0) col = mix(col, col.map((c, i) => c * 0.32 + X.night[i] * 0.55), nightT);
  return col;
}
function sky(s, bg) {
  if (s.gap < 0.006) return mix(bg, [150, 175, 190], (1 - s.gap / 0.006) * 0.35);
  return null;
}

const T = (x, y, txt, a = {}) => el('text', { x, y, ...a }, txt);
const st = (w, size, fill, extra = {}) => ({ 'font-family': 'Big Shoulders Stencil', 'font-weight': w, 'font-size': size, fill, ...extra });
const gr = (w, size, fill, extra = {}) => ({ 'font-family': 'Schibsted Grotesk', 'font-weight': w, 'font-size': size, fill, ...extra });

function defs(svg) {
  const d = el('defs');
  const f = el('filter', { id: 'soft', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  const b = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur'); b.setAttribute('stdDeviation', '3'); f.append(b); d.append(f);
  const f2 = el('filter', { id: 'soft2', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  const b2 = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur'); b2.setAttribute('stdDeviation', '6'); f2.append(b2); d.append(f2);
  svg.append(d);
}

// enamel token: a disc lit from the upper left (flat top + darker rim), the same object as pins and dock
function token(g, x, y, r, fill, rim) {
  g.append(el('ellipse', { cx: x + r * 0.28, cy: y + r * 0.34, rx: r, ry: r * 0.92, fill: '#000', opacity: 0.35, filter: 'url(#soft)' }));
  g.append(el('circle', { cx: x, cy: y, r, fill: rim }));
  g.append(el('circle', { cx: x - r * 0.06, cy: y - r * 0.08, r: r * 0.86, fill }));
}

function pin(svg, cam, code, o = {}) {
  const a = AIRPORTS[code]; const p = cam.project([a.lon, a.lat]); if (!p) return;
  const [x, y] = p; const g = el('g'); svg.append(g);
  const jam = a.jam != null; const hgt = a.hub ? 96 : 66;
  // needle shadow on the globe (lamp upper left), needle, head
  g.append(el('line', { x1: x, y1: y, x2: x + hgt * 0.55, y2: y + hgt * 0.22, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 5, 'stroke-linecap': 'round', filter: 'url(#soft)' }));
  g.append(el('ellipse', { cx: x, cy: y, rx: 9, ry: 4, fill: '#000', opacity: 0.4 }));
  g.append(el('line', { x1: x, y1: y, x2: x, y2: y - hgt, stroke: '#8E8A84', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  g.append(el('line', { x1: x - 1.5, y1: y - 4, x2: x - 1.5, y2: y - hgt, stroke: '#E8E4DD', 'stroke-width': 1.5 }));
  const hy = y - hgt;
  if (a.hub) {
    // hub: a square enamel plate with three runways (shape, not colour)
    g.append(el('rect', { x: x - 30 + 8, y: hy - 30 + 10, width: 60, height: 60, fill: '#000', opacity: 0.35, filter: 'url(#soft)' }));
    g.append(el('rect', { x: x - 30, y: hy - 30, width: 60, height: 60, fill: jam ? '#9E2A1A' : C.enamelShade }));
    g.append(el('rect', { x: x - 30, y: hy - 30, width: 56, height: 56, fill: jam ? C.red : C.enamel }));
    g.append(el('path', { d: ICON.hub, transform: `translate(${x - 22} ${hy - 22}) scale(0.42)`, fill: jam ? C.enamel : C.ink }));
  } else {
    token(g, x, hy, 20, jam ? C.red : C.enamel, jam ? '#9E2A1A' : C.enamelShade);
    g.append(el('rect', { x: x - 3, y: hy - 12, width: 6, height: 24, fill: C.ink, transform: `rotate(35 ${x} ${hy})` }));
  }
  // paper flag hung on the pin: name, fill as punched holes, passengers by region
  const items = Object.entries(a.pax || {});
  const fw = Math.max(a.name.length * 20 + 100, items.length * 74 + 24);
  const fx = Math.max(20, Math.min(W - 20 - fw, o.anchor === 'end' ? x - 40 - fw : x + 40)), fy = hy + (o.dy ?? -26);
  g.append(el('rect', { x: fx + 9, y: fy + 9, width: fw, height: 100, fill: '#000', opacity: 0.3 }));
  g.append(el('rect', { x: fx, y: fy, width: fw, height: 100, fill: jam ? C.red : C.enamel }));
  const tc = jam ? C.enamel : C.ink;
  g.append(T(fx + 16, fy + 38, a.name, gr(800, 32, tc)));
  g.append(T(fx + fw - 14, fy + 38, `${a.wait}/${a.cap}`, st(800, 32, tc, { 'text-anchor': 'end' })));
  let gx = fx + 26;
  for (const [rid, n] of items) {
    g.append(el('circle', { cx: gx, cy: fy + 72, r: 16, fill: jam ? C.enamel : REGIONS[rid].color }));
    g.append(el('path', { d: GLYPH[REGIONS[rid].glyph], transform: `translate(${gx} ${fy + 72}) scale(1.6)`, fill: jam ? C.red : C.enamel }));
    g.append(T(gx + 22, fy + 82, String(n), gr(700, 26, tc)));
    gx += 74;
  }
  if (a.isNew) {
    g.append(el('rect', { x: fx + fw - 86, y: fy - 30, width: 86, height: 30, fill: C.red }));
    g.append(T(fx + fw - 43, fy - 7, 'NOWE', st(800, 24, C.enamel, { 'text-anchor': 'middle' })));
  }
  if (jam) {
    g.append(T(fx + fw / 2, fy + 172, '0:42', st(900, 76, C.red, { 'text-anchor': 'middle', stroke: C.table, 'stroke-width': 10, 'paint-order': 'stroke' })));
    g.append(T(fx + fw / 2, fy + 206, 'do zatoru', gr(700, 26, C.enamel, { 'text-anchor': 'middle', stroke: C.table, 'stroke-width': 7, 'paint-order': 'stroke' })));
  }
}

function plane(svg, cam, pl) {
  const q = planePose(cam, pl, 0.05);
  const icon = pl.kind === 'jet' ? ICON.jet : ICON.prop; const sc = pl.kind === 'jet' ? 0.6 : 0.5;
  svg.append(el('path', { d: icon, transform: `translate(${q.gx + 14} ${q.gy + 10}) rotate(${q.ang + 90}) scale(${sc}) translate(-50 -50)`, fill: '#000', opacity: 0.38, filter: 'url(#soft)' }));
  svg.append(el('path', { d: icon, transform: `translate(${q.x + 1.5} ${q.y + 2}) rotate(${q.ang + 90}) scale(${sc}) translate(-50 -50)`, fill: '#7F7A72' }));
  svg.append(el('path', { d: icon, transform: `translate(${q.x} ${q.y}) rotate(${q.ang + 90}) scale(${sc}) translate(-50 -50)`, fill: C.enamel }));
}

function wire(svg, cam, a, b, lift, w = 5, dashed = false) {
  const ground = toD(screenArc(cam, a, b, 0));
  const air = screenArc(cam, a, b, lift);
  // shadow falls down-right from the lamp
  svg.append(el('path', { d: ground, transform: 'translate(10 8)', fill: 'none', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': w + 1, filter: 'url(#soft)' }));
  svg.append(el('path', { d: toD(air), fill: 'none', stroke: '#7A5A26', 'stroke-width': w + 2, 'stroke-linecap': 'round', 'stroke-dasharray': dashed ? '18 12' : 'none' }));
  svg.append(el('path', { d: toD(air), fill: 'none', stroke: C.brass, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-dasharray': dashed ? '18 12' : 'none' }));
  svg.append(el('path', { d: toD(air), transform: 'translate(-1 -1.5)', fill: 'none', stroke: C.brassHi, 'stroke-width': 1.6, 'stroke-dasharray': dashed ? '18 12' : 'none' }));
}

function hud(svg) {
  svg.append(T(60, 176, '17:06', st(800, 150, C.decal)));
  svg.append(T(380, 108, 'Tydzień 1', gr(800, 40, C.decal)));
  svg.append(T(380, 152, 'dzień 2 z 3', gr(600, 30, '#BDB5A8')));
  svg.append(T(64, 232, '34 pasażerów', gr(600, 30, '#BDB5A8')));
  // a day ring of 24 punched holes, night holes filled; reads like the pins' enamel
  const x0 = 380, y0 = 186;
  for (let h = 0; h < 24; h++) {
    const night = h < 6 || h >= 20, past = h < 17;
    svg.append(el('circle', { cx: x0 + h * 19, cy: y0, r: 6.5, fill: night ? C.night : past ? C.decal : 'none', stroke: C.decal, 'stroke-width': past || night ? 0 : 2 }));
  }
  svg.append(el('rect', { x: x0 + 17.1 * 19 - 2, y: y0 - 18, width: 4, height: 36, fill: C.red }));
  const g = el('g'); svg.append(g);
  token(g, W - 127, 127, 63, C.enamel, C.enamelShade);
  g.append(el('rect', { x: W - 127 - 22, y: 100, width: 13, height: 52, fill: C.ink }));
  g.append(el('rect', { x: W - 127 + 5, y: 100, width: 13, height: 52, fill: C.ink }));
  // dock: six enamel tokens on the table edge
  svg.append(el('rect', { x: 0, y: 1580, width: W, height: H - 1580, fill: C.table }));
  svg.append(el('rect', { x: 0, y: 1580, width: W, height: 4, fill: '#3A342F' }));
  const y = 1700;
  const items = [[ICON.undo, 'Cofnij'], [ICON.prop, 'Turbośmigł.', 'sel'], [ICON.jet, 'Szerokokadł.', 'off'], [ICON.hub, 'Hub', 'off'], [ICON.view, 'Widok'], [ICON.tempo, 'Tempo 1×']];
  const bw = (W - 48) / 6;
  items.forEach(([ic, lb, s], i) => {
    const cx = 24 + i * bw + bw / 2; const tg = el('g'); svg.append(tg);
    if (s === 'off') { tg.append(el('circle', { cx, cy: y, r: 62, fill: 'none', stroke: '#6D655C', 'stroke-width': 3, 'stroke-dasharray': '6 7' })); }
    else token(tg, cx, y, 62, s === 'sel' ? C.red : C.enamel, s === 'sel' ? '#9E2A1A' : C.enamelShade);
    tg.append(el('path', { d: ic, transform: `translate(${cx - 34} ${y - 36}) scale(0.68)`, fill: s === 'off' ? '#8C8378' : s === 'sel' ? C.enamel : C.ink }));
    tg.append(T(cx, y + 106, lb, gr(700, 25, s === 'off' ? '#8C8378' : C.decal, { 'text-anchor': 'middle' })));
    if (s === 'off') tg.append(T(cx, y + 140, 'za 1 dzień', gr(500, 23, '#8C8378', { 'text-anchor': 'middle' })));
  });
}

export async function render({ world, stage, frame }) {
  const cv = el('canvas', { width: W, height: H }); stage.append(cv);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = C.table; ctx.fillRect(0, 0, W, H);
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); stage.append(svg); defs(svg);
  if (frame === 'game') {
    const cam = makeCamera(GAME_CAM);
    renderGlobe(ctx, world, cam, SUN, shade, 2, sky);
    for (const [a, b] of ROUTES) wire(svg, cam, a, b, 0.045, 5, a === 'VCE' && b === 'RIX');
    for (const pl of PLANES) plane(svg, cam, pl);
    pin(svg, cam, 'RIX', { dy: -30 });
    pin(svg, cam, 'VCE', { dy: -30 });
    pin(svg, cam, 'ANK', { dy: -40 });
    pin(svg, cam, 'BGW', { dy: -40 });
    pin(svg, cam, 'ATH', { anchor: 'end', dy: 30 });
    pin(svg, cam, 'AMM', { anchor: 'end', dy: 20 });
    const g = el('g'); svg.append(g);
    g.append(el('rect', { x: W - 250, y: 1230, width: 250, height: 96, fill: C.enamel }));
    g.append(T(W - 228, 1272, 'Karaczi →', gr(800, 32, C.ink)));
    g.append(T(W - 228, 1308, `${km('BGW', 'KHI').toLocaleString('pl-PL')} km · 8/12`, gr(600, 24, C.ink)));
    hud(svg);
  } else {
    const cam = makeCamera({ ...MENU_CAM, F: 1450, cy: 820 });
    renderGlobe(ctx, world, cam, { lon: -12, lat: -16 }, shade, 2, sky);
    // the globe's own soft shadow on the table
    svg.insertBefore(el('ellipse', { cx: 640, cy: 1270, rx: 380, ry: 46, fill: '#000', opacity: 0.45, filter: 'url(#soft2)' }), svg.firstChild);
    for (const [a, b] of [['VCE', 'ATH'], ['ATH', 'AMM'], ['VCE', 'RIX'], ['AMM', 'BGW']]) wire(svg, cam, a, b, 0.02, 3.5);
    for (const c of ['VCE', 'ATH', 'AMM', 'RIX', 'BGW']) {
      const a = AIRPORTS[c]; const [x, y] = cam.project([a.lon, a.lat]); const g = el('g'); svg.append(g);
      g.append(el('line', { x1: x, y1: y, x2: x, y2: y - 26, stroke: '#8E8A84', 'stroke-width': 3 }));
      token(g, x, y - 26, 9, a.jam ? C.red : C.enamel, C.enamelShade);
    }
    svg.append(T(60, 200, 'AIRWAY', st(900, 190, C.decal, { 'letter-spacing': 4 })));
    svg.append(T(66, 262, 'Sieć lotnicza na całym globie', gr(600, 36, '#BDB5A8')));
    const rows = [['Lot bez końca', 'brak rekordu', 'sel'], ['Dziś 06.11', 'ten sam świat dla wszystkich'], ['Zadania', '0 z 40 rozwiązanych'], ['Dziennik'], ['Ustawienia']];
    let y = 1460;
    rows.forEach(([t, sub, s], i) => {
      const g = el('g'); svg.append(g);
      if (s) token(g, 110, y, 50, C.red, '#9E2A1A'), g.append(el('path', { d: 'M-14 -20 L22 0 L-14 20 Z', transform: `translate(${112} ${y})`, fill: C.enamel }));
      else g.append(el('circle', { cx: 110, cy: y, r: 9, fill: C.enamelShade }));
      g.append(T(190, y + (sub ? -2 : 14), t, gr(800, s ? 52 : 42, C.decal)));
      if (sub) g.append(T(190, y + 36, sub, gr(500, 26, '#BDB5A8')));
      y += s ? 128 : 96;
    });
  }
}

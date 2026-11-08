// K1 "Atlas satelitarny" and K2 "Nawigacja nocna" mockup frames (2026-11c). Globe: three.js (globe.js).
// World layer (borders, atlas labels, routes, airports, aircraft, queues): SVG projected with the globe camera.
// HUD and menu: HTML/CSS. Mockup code only; nothing here is shipped.
import { feature, mesh } from 'topojson-client';
import { makeGlobe } from './globe.js';
import { AIRPORTS, ROUTES, PLANNED, REGIONS, GLYPH, ICON, COUNTRY_LABELS, SEA_LABELS, gc, km } from './scene.js';

export const W = 412, H = 915, DPR = 2;

const THEMES = {
  k1: {
    globe: { space: '#02050A', atm: '#8FB8E6', nightGain: 1.25, moon: 0.03, grade: 0.86, haze: 0.62, atmStrength: 1.15, stars: true },
    sun: { game: { lon: -37, lat: -6 }, menu: { lon: -22, lat: -14 } },
    clock: '17:06', hour: 17.1,
  },
  k2: {
    globe: { space: '#010306', atm: '#7FA4D6', nightGain: 1.7, moon: 0.06, grade: 0.95, haze: 0.4, atmStrength: 0.9, stars: true },
    sun: { game: { lon: -55, lat: -16 }, menu: { lon: -72, lat: -14 } },
    clock: '19:05', hour: 19.08,
  },
};
const CAMS = {
  game: { lon: 32, lat: 21.5, alt: 0.74, tlon: 32.3, tlat: 39.5, fov: 54, shift: [0, 40] },
  menu: { lon: 30, lat: 28, alt: 7.75, tlon: 30, tlat: 28, fov: 30, shift: [0, 80] },
};

const SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const svg = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'text', 'tspan', 'polygon', 'polyline', 'ellipse', 'defs', 'linearGradient', 'stop', 'clipPath', 'use'].includes(tag);
  const e = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function pathOf(pts) {
  let d = '', pen = false;
  for (const p of pts) {
    if (!p || !p.vis) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `; pen = true;
  }
  return d;
}

function glyph(region, x, y, s, cls = 'gl') {
  const r = REGIONS[region];
  return el('path', { d: GLYPH[r.glyph], transform: `translate(${x} ${y}) scale(${s / 12})`, fill: r.color, class: cls });
}

export async function render(stage, k, f, debug) {
  const T = THEMES[k];
  stage.className = `${k} ${f}`;
  await Promise.all(['500 14px Newsreader', '600 14px Newsreader', '700 14px Newsreader', 'italic 500 14px Newsreader',
    '500 14px "Hanken Grotesk"', '600 14px "Hanken Grotesk"', '700 14px "Hanken Grotesk"', '600 14px Manrope', '700 14px Manrope', '800 14px Manrope',
    '500 14px "Sofia Sans Condensed"', '600 14px "Sofia Sans Condensed"', '700 14px "Sofia Sans Condensed"', '800 14px "Sofia Sans Condensed"']
    .map((s) => document.fonts.load(s)));
  const g = await makeGlobe(stage, { w: W, h: H, dpr: DPR, theme: T.globe, cam: CAMS[f], sunLL: T.sun[f] });
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'world' });
  stage.append(svg);
  const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  drawBorders(svg, g, topo, f);
  if (f === 'game') { drawAtlas(svg, g, k); drawNetwork(svg, g, k, true); drawHud(stage, T, k); } else { drawNetwork(svg, g, k, false); drawMenu(stage, T, k); }
  if (debug) for (const [c, a] of Object.entries(AIRPORTS)) { const p = g.project(a.lon, a.lat); console.log(c, p.x.toFixed(0), p.y.toFixed(0), p.vis); }
}

function drawBorders(svg, g, topo, f) {
  const m = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const box = f === 'game' ? [-15, 85, 5, 75] : [-180, 180, -90, 90];
  let d = '';
  for (const line of m.coordinates) {
    const pts = line.map(([lon, lat]) => (lon < box[0] || lon > box[1] || lat < box[2] || lat > box[3]) ? null : g.project(lon, lat));
    d += pathOf(pts);
  }
  svg.append(el('path', { d, class: 'border' }));
}

function drawAtlas(svg, g, k) {
  const grp = el('g', { class: 'atlas' });
  for (const c of COUNTRY_LABELS) {
    const p = g.project(c.lon, c.lat); if (!p.vis || p.y < 200 || p.y > 790 || p.x < 50 || p.x > 362) continue;
    const s = Math.max(0.62, Math.min(1.05, (p.y - 60) / 640));
    grp.append(el('text', { x: p.x, y: p.y, class: 'country', 'font-size': (11.5 * s).toFixed(1) }, c.t));
  }
  for (const c of SEA_LABELS) {
    const p = g.project(c.lon, c.lat); if (!p.vis) continue;
    grp.append(el('text', { x: p.x, y: p.y, class: 'sea' }, c.t));
  }
  svg.append(grp);
}

// label placement per airport (game frame): label anchor offset, text anchor, pill above/below the name.
// Hubs get a card (name + queue + meter) at offset cx/cy from the marker, with a leader tick.
const LBL = {
  RIX: { dx: 10, dy: 5, a: 'start', pill: 'below' }, BEG: { dx: 10, dy: 5, a: 'start', pill: 'below' },
  KBP: { dx: 10, dy: 5, a: 'start', pill: 'below' }, ANK: { dx: 10, dy: 5, a: 'start', pill: 'above' },
  CAI: { dx: -10, dy: 5, a: 'end', pill: 'below' }, BGW: { dx: -10, dy: -14, a: 'end', pill: 'above' },
  ATH: { card: [-75, 26], max: 8 }, AMM: { card: [-66, 22], max: 15 },
};

function drawNetwork(svg, g, k, full) {
  const routes = el('g', { class: 'routes' }), planes = el('g', { class: 'planes' }), ports = el('g', { class: 'ports' });
  // routes: casing + core, great circles on the ground (nav-route look)
  for (const r of ROUTES) {
    const A = AIRPORTS[r.a], B = AIRPORTS[r.b], f = gc(A, B);
    const pts = Array.from({ length: 97 }, (_, i) => { const [lon, lat] = f(i / 96); return g.project(lon, lat); });
    const d = pathOf(pts);
    routes.append(el('path', { d, class: `casing ${r.kind}` }), el('path', { d, class: `core ${r.kind}` }));
    if (full) for (const t of r.planes) drawPlane(planes, g, f, t, r.kind, k);
  }
  if (full) {
    const A = AIRPORTS[PLANNED.a], B = AIRPORTS[PLANNED.b], f = gc(A, B);
    const pts = Array.from({ length: 49 }, (_, i) => { const [lon, lat] = f(i / 48); return g.project(lon, lat); });
    routes.append(el('path', { d: pathOf(pts), class: 'planned-casing' }), el('path', { d: pathOf(pts), class: 'planned' }));
    const m = f(0.5), p = g.project(m[0], m[1]);
    const t = `${fmt(km(A, B))} km`;
    const gg = el('g', { class: 'plan-tag', transform: `translate(${p.x + 8} ${p.y - 2})` });
    gg.append(el('rect', { x: 0, y: -10, width: 52, height: 17, rx: 2 }), el('text', { x: 26, y: 3 }, t));
    routes.append(gg);
  }
  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue;
    const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    if (!full) { ports.append(el('circle', { cx: p.x, cy: p.y, r: a.hub ? 3.6 : 2.4, class: a.hub ? 'm-hub' : 'm-port' })); continue; }
    drawPort(ports, code, a, p, k);
  }
  svg.append(routes, ports, planes);
  if (full) {
    // off-screen destination: edge chip with direction and distance
    const K = AIRPORTS.KHI;
    const chip = html(`<div class="edge-chip" style="top:${738}px"><b>Karaczi</b><span>${fmt(km(AIRPORTS.BGW, K))} km · 8/12</span><i>→</i></div>`);
    svg.parentElement.append(chip);
  }
}

function drawPlane(layer, g, f, t, kind, k) {
  const [lon, lat] = f(t), [lon2, lat2] = f(Math.min(1, t + 0.01));
  const alt = 0.006;
  const p = g.project(lon, lat, alt), q = g.project(lon2, lat2, alt), s = g.project(lon, lat);
  const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
  // trail: the last stretch behind the aircraft, a little brighter than the route
  const tr = Array.from({ length: 17 }, (_, i) => { const [a, b] = f(Math.max(0, t - 0.12 + 0.12 * i / 16)); return g.project(a, b, alt * i / 16); });
  const size = kind === 'jet' ? 26 : 21;
  const sc = size / 100;
  layer.append(el('path', { d: ICON[kind], class: 'shadow', transform: `translate(${s.x + 1.5} ${s.y + 5}) rotate(${ang}) scale(${sc}) translate(-50 -50)` }));
  const pg = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${ang}) scale(${sc}) translate(-50 -50)` });
  pg.append(el('path', { d: ICON[kind], class: `plane ${kind}` }));
  if (k === 'k2') {
    const wing = kind === 'jet' ? [8, 66, 92, 66] : [10, 49, 90, 49];
    pg.append(el('circle', { cx: wing[0], cy: wing[1], r: 4.2, fill: '#FF4A3D' }), el('circle', { cx: wing[2], cy: wing[3], r: 4.2, fill: '#3DFF8E' }));
  }
  layer.append(pg);
}

function paxRow(region, n, x, y, max, tok) {
  const g = el('g');
  const shown = Math.min(n, max);
  for (let i = 0; i < shown; i++) g.append(glyph(region, x + i * tok, y, tok - 1.6));
  return { g, w: shown * tok };
}

function drawPort(layer, code, a, p, k) {
  const L = LBL[code];
  const g = el('g', { class: `port${a.hub ? ' hub' : ''}${a.jam ? ' jam' : ''}` });
  const entries = Object.entries(a.pax);
  if (!a.hub) {
    g.append(el('circle', { cx: p.x, cy: p.y, r: 5.2, class: 'pin' }));
    const tx = p.x + L.dx, ty = p.y + L.dy;
    const name = el('text', { x: tx, y: ty, class: 'name', 'text-anchor': L.a }, a.name);
    g.append(name);
    // load pill: D-08 glyph + count per region, then waiting/capacity
    const tok = 11, gap = 4;
    let wpx = 6; const parts = [];
    for (const [r, n] of entries) { parts.push([r, n, wpx]); wpx += tok + 3 + String(n).length * (k === 'k2' ? 5.6 : 6.2) + gap; }
    const capTxt = `${a.wait}/${a.cap}`; const capW = capTxt.length * (k === 'k2' ? 5.4 : 5.8) + 8;
    const total = wpx + capW;
    const x0 = L.a === 'end' ? tx - total : tx;
    const y0 = L.pill === 'below' ? ty + 6 : ty - 33;
    const pill = el('g', { class: 'pill', transform: `translate(${x0} ${y0})` });
    pill.append(el('rect', { x: 0, y: 0, width: total, height: 17, rx: 2 }));
    for (const [r, n, x] of parts) { pill.append(glyph(r, x + 5.5, 8.5, 10)); pill.append(el('text', { x: x + tok + 2, y: 12.6, class: 'n' }, String(n))); }
    pill.append(el('rect', { x: wpx - 2, y: 3.5, width: 1, height: 10, class: 'sep' }));
    pill.append(el('text', { x: wpx + 3, y: 12.6, class: 'cap' }, capTxt));
    g.append(pill);
    if (a.isNew) g.append(el('g', { class: 'new-tag', transform: `translate(${tx + a.name.length * (k === 'k2' ? 8.4 : 7.9) + 5} ${ty - 11})` }, el('rect', { width: 36, height: 14, rx: 1.5 }), el('text', { x: 18, y: 10.4 }, 'NOWE')));
    layer.append(g);
    return;
  }
  // hub card: name, queue (one token per waiting passenger, one row per region), capacity meter
  const tok = 9.4, max = L.max;
  const boxW = 14 + max * tok + 26, boxH = 30 + entries.length * 13 + 16;
  const x0 = Math.max(6, Math.min(406 - boxW, p.x + L.card[0])), y0 = p.y + L.card[1];
  g.append(el('line', { x1: p.x, y1: p.y + 12, x2: p.x, y2: y0, class: 'leader' }));
  const q = el('g', { class: 'queue', transform: `translate(${x0} ${y0})` });
  q.append(el('rect', { x: 0, y: 0, width: boxW, height: boxH, rx: 2 }));
  q.append(el('text', { x: 9, y: 19, class: 'hname' }, a.name));
  q.append(el('text', { x: boxW - 7, y: 18, class: 'hub-tag', 'text-anchor': 'end' }, 'HUB'));
  entries.forEach(([r, n], i) => {
    const { g: row } = paxRow(r, n, 13, 34 + i * 13, max, tok);
    q.append(row, el('text', { x: boxW - 7, y: 38 + i * 13, class: 'n', 'text-anchor': 'end' }, String(n)));
  });
  const cells = 18, mw = boxW - 18 - 40, cw = mw / cells, my = boxH - 9;
  for (let i = 0; i < cells; i++) q.append(el('rect', { x: 9 + i * cw, y: my - 3, width: cw - 1.2, height: 5, class: i < Math.round(cells * a.wait / a.cap) ? 'cell on' : 'cell' }));
  q.append(el('text', { x: boxW - 7, y: my + 2.5, class: 'cap', 'text-anchor': 'end' }, `${a.wait}/${a.cap}`));
  g.append(q);
  if (a.jam) {
    const jt = el('g', { class: 'jam-tag', transform: `translate(${x0} ${y0 + boxH + 3})` });
    jt.append(el('rect', { width: boxW, height: 24, rx: 2 }), el('text', { x: 9, y: 16, class: 'l' }, 'ZATOR · zamknięcie za'), el('text', { x: boxW - 8, y: 17.5, class: 't', 'text-anchor': 'end' }, a.jam));
    g.append(jt);
    const R = 19, frac = 0.47, a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
    g.append(el('circle', { cx: p.x, cy: p.y, r: R, class: 'jam-zone' }));
    g.append(el('path', { d: `M${p.x + R * Math.cos(a0)} ${p.y + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${p.x + R * Math.cos(a1)} ${p.y + R * Math.sin(a1)}`, class: 'jam-arc' }));
  }
  g.append(el('circle', { cx: p.x, cy: p.y, r: 12, class: 'hub-outer' }), el('circle', { cx: p.x, cy: p.y, r: 8.6, class: 'hub-inner' }));
  g.append(el('path', { d: ICON.hub, class: 'hub-mark', transform: `translate(${p.x} ${p.y}) scale(0.12) translate(-50 -50)` }));
  layer.append(g);
}

const SEG = (hour, k) => Array.from({ length: 24 }, (_, h) => `<i class="${h < 6 || h >= 19 ? 'n' : 'd'}${h < Math.floor(hour) ? ' past' : ''}"></i>`).join('');

function drawHud(stage, T, k) {
  const pct = (T.hour / 24 * 100).toFixed(2);
  stage.append(html(`<div class="statusbar"><span>${'14:32'}</span><span class="sb-r"><i></i><i></i><b></b></span></div>`));
  stage.append(html(`<header class="clock">
    <div class="time">${T.clock}</div>
    <div class="meta"><b>Tydzień 1</b><span>dzień 2 z 3</span></div>
    <div class="score"><b>34</b><span>pasażerów</span></div>
    <div class="daybar">${SEG(T.hour, k)}<em style="left:${pct}%"></em></div>
    <div class="dayticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
  </header>`));
  stage.append(html(`<button class="pause" aria-label="Pauza"><svg viewBox="0 0 20 20"><rect x="4" y="3" width="4.2" height="14"/><rect x="11.8" y="3" width="4.2" height="14"/></svg></button>`));
  // ATC flight-progress strip: the one alert that matters, as a strip in the bay
  stage.append(html(`<div class="strip">
    <div class="bay"><svg viewBox="0 0 100 100"><path d="${ICON.hub}"/></svg></div>
    <div class="c c1"><small>HUB</small><b>AMM</b><span>Amman</span></div>
    <div class="c c2"><small>KOLEJKA</small><b>36/36</b></div>
    <div class="c c3"><small>ZAMKNIĘCIE</small><b class="t">0:42</b></div>
    <div class="c c4"><small>ODCIĄŻ</small><span>+ trasa<br>z Ankary</span></div>
  </div>`));
  const btn = (id, label, sub, cls = '', badge = '') => `<button class="tool ${cls}"><span class="ic"><svg viewBox="0 0 100 100"><path d="${ICON[id]}"/></svg>${badge ? `<em>${badge}</em>` : ''}</span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  stage.append(html(`<nav class="dock">
    ${btn('undo', 'Cofnij', '', 'minor')}
    ${btn('prop', 'Turbośmigł.', '', 'sel', '2')}
    ${btn('jet', 'Szerokokadł.', '', '', '1')}
    ${btn('hub', 'Hub', 'za 1 dzień', 'off')}
    ${btn('tempo', 'Tempo', '1×', 'minor')}
  </nav>`));
}

function drawMenu(stage, T, k) {
  stage.append(html(`<div class="statusbar"><span>${'14:32'}</span><span class="sb-r"><i></i><i></i><b></b></span></div>`));
  stage.append(html(`<header class="title"><h1>Airway</h1><p>Sieć lotnicza na prawdziwej Ziemi</p></header>`));
  stage.append(html(`<div class="globe-cap"><span class="dot"></span>${k === 'k1' ? 'Nad Lewantem 17:06 · zmierzch idzie od wschodu' : 'Nad Lewantem 19:05 · zapada noc'}</div>`));
  const gl = (r) => `<svg viewBox="-7 -7 14 14"><path d="${GLYPH[REGIONS[r].glyph]}" fill="${REGIONS[r].color}"/></svg>`;
  stage.append(html(`<nav class="menu">
    <button class="row primary"><span class="lbl"><b>Lot bez końca</b><small>rekord: 212 pasażerów · tydzień 6</small></span><span class="go"><svg viewBox="0 0 100 100"><path d="${ICON.jet}" transform="rotate(90 50 50)"/></svg></span></button>
    <button class="row"><span class="lbl"><b>Dziś · 08.11</b><small>ten sam świat dla wszystkich</small></span><span class="glyphs">${gl('EUN')}${gl('ME')}${gl('AFR')}</span></button>
    <button class="row"><span class="lbl"><b>Zadania</b><small>0 z 40 rozwiązanych</small></span><span class="num">0/40</span></button>
    <div class="row-pair"><button class="row half"><b>Dziennik</b></button><button class="row half"><b>Ustawienia</b></button></div>
  </nav>`));
}

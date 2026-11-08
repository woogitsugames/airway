// UI-A "Lotniskowa tablica i paski lotu" (2026-11c): five 412x915 frames on the K2 globe (../../src/globe.js,
// NASA Blue Marble / Black Marble). The world layer is SVG projected with the globe camera; the chrome is HTML/CSS
// built from airport vocabulary: split-flap board, ICAO airfield signs, controller flight strips, teleprinter paper.
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
  menu: { globe: NIGHT, sun: { lon: -72, lat: -14 }, cam: 'menu', cls: 'night menu' },
  week: { globe: NIGHT, sun: { lon: -70, lat: -16 }, cam: 'game', cls: 'night wk' },
  over: { globe: NIGHT, sun: { lon: -100, lat: -16 }, cam: 'over', cls: 'night rep' },
};
const CAMS = {
  game: { lon: 32, lat: 21, alt: 0.68, tlon: 32.3, tlat: 39.0, fov: 54, shift: [0, 100] },
  menu: { lon: 30, lat: 30, alt: 7.4, tlon: 30, tlat: 30, fov: 30, shift: [0, 118] },
  over: { lon: 36, lat: 22, alt: 0.95, tlon: 36, tlat: 31.7, fov: 50, shift: [0, 290] },
};

const SVGNS = 'http://www.w3.org/2000/svg';
const SVGT = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'text', 'tspan', 'polygon', 'ellipse'];
function el(tag, attrs = {}, ...kids) {
  const e = SVGT.includes(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const wflap = (s, cls = '') => `<span class="wflap ${cls}">${s}</span>`;
const flaps = (s, cls = '') => `<span class="flaps ${cls}">${[...s].map((c) => c === ' ' ? '<i class="sp"></i>' : c === ':' ? '<i class="narrow">:</i>' : `<i>${c}</i>`).join('')}</span>`;
// airfield direction-sign arrow (shaft + wedge head), 24x24
const ARROW = '<svg viewBox="0 0 24 24"><path d="M1 9.6 H13 V3.5 L23 12 L13 20.5 V14.4 H1 Z" fill="currentColor"/></svg>';
const icon = (id, extra = '') => `<svg viewBox="0 0 100 100" ${extra}><path d="${ICON[id]}"/></svg>`;
const CODE = { RIX: 'RIX', BEG: 'BEG', KBP: 'KBP', ATH: 'ATH', ANK: 'ESB', CAI: 'CAI', AMM: 'AMM', BGW: 'BGW', KHI: 'KHI' };

function pathOf(pts) {
  let d = '', pen = false;
  for (const p of pts) { if (!p || !p.vis) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `; pen = true; }
  return d;
}
function glyph(region, x, y, s, dark) {
  const r = REGIONS[region];
  return el('path', { d: GLYPH[r.glyph], transform: `translate(${x} ${y}) scale(${s / 12})`, fill: r.color, class: dark && region === 'AFR' ? 'gl-dark' : null });
}
// one glyph per waiting passenger, in queue order (regions interleaved the way they arrived)
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
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'world' });
  stage.append(svg);
  const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  drawBorders(svg, g, topo, F.cam);
  if (debug) for (const [c, a] of Object.entries(AIRPORTS)) { const p = g.project(a.lon, a.lat); console.log(c, p.x.toFixed(0), p.y.toFixed(0), p.vis); }
  statusbar(stage);
  if (f === 'night' || f === 'day') { drawAtlas(svg, g); drawNetwork(svg, g, f); drawGameChrome(stage, F); }
  if (f === 'menu') { drawNetworkSmall(svg, g); drawMenu(stage); }
  if (f === 'week') { drawOver(svg, g, true); drawWeek(stage); }
  if (f === 'over') { drawOver(svg, g); drawReport(stage); }
}

function drawBorders(svg, g, topo, cam) {
  const m = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const box = cam === 'menu' ? [-180, 180, -90, 90] : [-15, 85, 5, 75];
  let d = '';
  for (const line of m.coordinates) d += pathOf(line.map(([lon, lat]) => (lon < box[0] || lon > box[1] || lat < box[2] || lat > box[3]) ? null : g.project(lon, lat)));
  svg.append(el('path', { d, class: 'border' }));
}
function drawAtlas(svg, g) {
  const grp = el('g', { class: 'atlas' });
  for (const c of COUNTRY_LABELS) {
    const p = g.project(c.lon, c.lat); if (c.t === 'TURCJA' || !p.vis || p.y < 150 || p.y > 680 || p.x < 50 || p.x > 362) continue;
    grp.append(el('text', { x: p.x, y: p.y, class: 'country' }, c.t));
  }
  for (const c of SEA_LABELS) { const p = g.project(c.lon, c.lat); if (p.vis) grp.append(el('text', { x: p.x, y: p.y, class: 'sea' }, c.t)); }
  const med = g.project(24.5, 33.6); grp.append(el('text', { x: med.x, y: med.y, class: 'sea' }, 'Morze Śródziemne'));
  svg.append(grp);
}

// label side per airport: plate to the right (r) or left (l) of the pin, and above (u) or below (d)
const LBL = { RIX: 'r', BEG: 'r', KBP: 'r', ATH: 'l', ANK: 'r', CAI: 'ld', AMM: 'rd', BGW: 'lu' };

function routeLayer(svg, g, f, withPlanes) {
  const routes = el('g', { class: 'routes' }), planes = el('g', { class: 'planes' });
  for (const r of ROUTES) {
    const A = AIRPORTS[r.a], B = AIRPORTS[r.b], fn = gc(A, B);
    const d = pathOf(Array.from({ length: 97 }, (_, i) => { const [lon, lat] = fn(i / 96); return g.project(lon, lat); }));
    routes.append(el('path', { d, class: `casing ${r.kind}` }), el('path', { d, class: `core ${r.kind}` }));
    if (withPlanes) for (const t of r.planes) drawPlane(planes, g, fn, t, r.kind, f === 'day' ? 0 : 1);
  }
  return { routes, planes };
}

function drawNetwork(svg, g, f, quiet) {
  const { routes, planes } = routeLayer(svg, g, f, true);
  const ports = el('g', { class: 'ports' });
  if (!quiet) {
    // the route the player is drawing: yellow grease pencil, slightly uneven, with a direction-sign distance tag
    const A = AIRPORTS[PLANNED.a], B = AIRPORTS[PLANNED.b], fn = gc(A, B);
    const pts = Array.from({ length: 49 }, (_, i) => { const [lon, lat] = fn(i / 48); const p = g.project(lon, lat); p.x += Math.sin(i * 1.7) * 0.7; return p; });
    routes.append(el('path', { d: pathOf(pts), class: 'planned-casing' }), el('path', { d: pathOf(pts), class: 'planned' }));
    const m = fn(0.3), p = g.project(m[0], m[1]);
    const t = `${fmt(km(A, B))} km`;
    routes.append(el('g', { class: 'sign-y', transform: `translate(${p.x + 9} ${p.y - 10})` }, el('rect', { width: 54, height: 19, rx: 1.5 }), el('text', { x: 27, y: 13.6, 'text-anchor': 'middle' }, t)));
  }
  for (const [code, a] of Object.entries(AIRPORTS)) {
    if (a.off) continue;
    const p = g.project(a.lon, a.lat); if (!p.vis) continue;
    drawPort(ports, code, a, p, quiet);
  }
  svg.append(routes, ports, planes);
  if (!quiet) {
    const K = AIRPORTS.KHI, p = g.project(AIRPORTS.BGW.lon, AIRPORTS.BGW.lat);
    svg.parentElement.append(html(`<div class="edge-sign" style="top:${(p.y + 118).toFixed(0)}px"><div class="tx"><b>KHI</b><span>Karaczi ${fmt(km(AIRPORTS.BGW, K))} km</span></div>${ARROW}</div>`));
  }
}

function drawPlane(layer, g, fn, t, kind, lights) {
  const [lon, lat] = fn(t), [lon2, lat2] = fn(Math.min(1, t + 0.01));
  const alt = 0.008;
  const p = g.project(lon, lat, alt), q = g.project(lon2, lat2, alt), s = g.project(lon, lat);
  const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
  const size = kind === 'jet' ? 38 : 31, sc = size / 100;
  layer.append(el('path', { d: ICON[kind], class: 'shadow', transform: `translate(${s.x + 2} ${s.y + 7}) rotate(${ang}) scale(${sc}) translate(-50 -50)` }));
  const pg = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${ang}) scale(${sc}) translate(-50 -50)` });
  pg.append(el('path', { d: ICON[kind], class: 'plane' }));
  if (lights) {
    const wing = kind === 'jet' ? [8, 66, 92, 66] : [10, 49, 90, 49];
    pg.append(el('circle', { cx: wing[0], cy: wing[1], r: 4, fill: '#E8382E' }), el('circle', { cx: wing[2], cy: wing[3], r: 4, fill: '#3FD07A' }));
  }
  layer.append(pg);
}

// Airport label: an ICAO location sign (yellow code on black, yellow inner border) with the waiting passengers
// queued behind it as D-08 glyphs, one per passenger; the city name under the plate. Hubs carry the hub mark;
// a jammed hub turns into a mandatory sign (white on red) with the countdown.
function drawPort(layer, code, a, p, quiet) {
  const side = LBL[code] || 'r', left = side[0] === 'l', up = side[1] === 'u', down = side[1] === 'd';
  const g = el('g', { class: `port${a.hub ? ' hub' : ''}${a.jam ? ' jam' : ''}` });
  if (a.jam) {
    const R = 21;
    g.append(el('circle', { cx: p.x, cy: p.y, r: R, class: 'jam-ring' }));
    const frac = 0.47, a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
    g.append(el('path', { d: `M${p.x} ${p.y - R} A${R} ${R} 0 0 1 ${p.x + R * Math.cos(a1)} ${p.y + R * Math.sin(a1)}`, class: 'jam-arc' }));
  }
  if (a.hub) {
    g.append(el('circle', { cx: p.x, cy: p.y, r: 12.5, class: 'hub-outer' }), el('circle', { cx: p.x, cy: p.y, r: 9, class: 'hub-inner' }));
    g.append(el('path', { d: ICON.hub, class: 'hub-mark', transform: `translate(${p.x} ${p.y}) scale(0.125) translate(-50 -50)` }));
  } else g.append(el('circle', { cx: p.x, cy: p.y, r: 5.4, class: 'pin' }));
  const plate = el('g', { class: `plate${a.hub ? ' hub' : ''}${a.jam ? ' jam' : ''}` });
  const c = CODE[code], h = a.hub ? 25 : 21, codeW = a.hub ? 48 : 38;
  const q = a.hub ? [] : queueOrder(a.pax), maxQ = 7, shown = q.slice(0, maxQ), tok = 11;
  const qW = shown.length ? shown.length * tok + 6 + (q.length > maxQ ? 16 : 0) : 0;
  const jamW = a.jam ? 40 : 0;
  const w = codeW + qW + jamW;
  const gap = a.hub ? 17 : 9;
  const x0 = left ? p.x - (down ? 4 : gap) - w : p.x + (down ? 4 : gap), y0 = up ? p.y - h - 12 : down ? p.y + 20 : p.y - h / 2;
  plate.append(el('rect', { x: x0, y: y0, width: w, height: h, rx: 2, class: 'bg' }));
  plate.append(el('rect', { x: x0 + 2.5, y: y0 + 2.5, width: codeW - 5, height: h - 5, rx: 1, class: 'loc' }));
  plate.append(el('text', { x: x0 + codeW / 2, y: y0 + h / 2 + (a.hub ? 5.8 : 5), 'text-anchor': 'middle', class: 'code' }, c));
  shown.forEach((r, i) => plate.append(glyph(r, x0 + codeW + 3 + tok / 2 + i * tok, y0 + h / 2, 9.5, true)));
  if (q.length > maxQ) plate.append(el('text', { x: x0 + codeW + 4 + shown.length * tok + 1, y: y0 + h / 2 + 3.6, class: 'more' }, `+${q.length - maxQ}`));
  if (a.jam) plate.append(el('text', { x: x0 + w - 6, y: y0 + h / 2 + 5, 'text-anchor': 'end', class: 't' }, a.jam));
  plate.append(el('text', { x: left ? x0 + w : x0, y: up ? y0 - 4 : y0 + h + 12, 'text-anchor': left ? 'end' : 'start', class: 'city' }, a.name));
  if (a.isNew && !quiet) {
    const nx = x0 + w + 4;
    plate.append(el('g', { class: 'new', transform: `translate(${nx} ${y0 + 3})` }, el('rect', { width: 34, height: 15, rx: 1 }), el('text', { x: 17, y: 10.8, 'text-anchor': 'middle' }, 'NOWE')));
  }
  g.append(plate);
  layer.append(g);
}

function statusbar(stage) {
  stage.append(html(`<div class="statusbar"><span>14:32</span><span class="sb-r"><i></i><i></i><b></b></span></div>`));
}

function hoursBar(hour) {
  const cells = Array.from({ length: 24 }, (_, h) => `<i class="${h < 6 || h >= 19 ? 'n' : 'd'}${h < Math.floor(hour) ? ' past' : ''}"></i>`).join('');
  return `<div class="hours">${cells}<em style="left:${(hour / 24 * 100).toFixed(2)}%"></em></div>`;
}

function drawGameChrome(stage, F) {
  stage.append(html(`<header class="board">
    <div class="row">
      <div class="cell"><span class="lg">Czas lokalny</span>${flaps(F.clock, 'clock')}</div>
      <div class="cell"><span class="lg">Tydz.</span>${flaps('1', 'sm')}</div>
      <div class="cell"><span class="lg">Dzień</span>${flaps('2/3', 'sm')}</div>
      <div class="cell"><span class="lg">Pasaż.</span>${flaps('034', 'sm pax')}</div>
    </div>
    ${hoursBar(F.hour)}
  </header>`));
  stage.append(html(`<button class="key pause" aria-label="Pauza"><svg viewBox="0 0 20 20"><rect x="3.5" y="3" width="4.6" height="14"/><rect x="11.9" y="3" width="4.6" height="14"/></svg><b>STOP</b></button>`));
  stage.append(stripBay(693));
  const tool = (id, label, sub, cls = '', n = '') => `<button class="tool ${cls}">${icon(id)}${n ? flaps(n, 'cnt') : ''}<b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  stage.append(html(`<nav class="keys">
    ${tool('undo', 'Cofnij', '', 'minor')}
    ${tool('prop', 'Turbośmigł.', '', 'sel', '2')}
    ${tool('jet', 'Szerokokadł.', '', '', '1')}
    ${tool('hub', 'Hub', 'za 1 dzień', 'off')}
    ${tool('tempo', 'Tempo 1×', '', 'minor')}
  </nav>`));
}

// queue block for a strip: one glyph per passenger, one row per region, 7.5 px tokens
function stripQueue(pax, w, tok = 7.6) {
  const rows = Object.entries(pax);
  const s = el('svg', { width: w, height: rows.length * 9.5, viewBox: `0 0 ${w} ${rows.length * 9.5}` });
  rows.forEach(([r, n], i) => { for (let k = 0; k < n; k++) s.append(glyph(r, 4 + k * tok, 4.8 + i * 9.5, tok - 1.2, false)); });
  return s.outerHTML;
}

function stripBay(top) {
  const A = AIRPORTS.AMM, T = AIRPORTS.ATH;
  // red chinagraph marks the controller would add: a loop around the countdown and a tick under the queue
  const loop = '<svg class="pencil" style="left:0;top:12px" width="64" height="40"><path d="M52 7 C 68 11, 69 30, 50 36 C 30 42, 4 38, 3 23 C 2 9, 26 2, 46 4 C 54 5, 60 9, 62 14"/></svg>';
  return html(`<section class="bay" style="top:${top}px">
    <div class="strip jam">
      <div class="holder">${icon('hub')}</div>
      <div class="col" style="width:64px"><small>Hub</small><b class="code">AMM</b><span class="city">Amman</span></div>
      <div class="col q"><small>Kolejka · 3 kierunki</small>${stripQueue(A.pax, 132)}</div>
      <div class="col" style="width:60px"><small>Miejsca</small><b class="num">36/36</b></div>
      <div class="col" style="width:72px"><small>Zamkn.</small><b class="big">0:42</b>${loop}</div>
    </div>
    <div class="strip ok">
      <div class="holder">${icon('hub')}</div>
      <div class="col" style="width:64px"><small>Hub</small><b class="code">ATH</b><span class="city">Ateny</span></div>
      <div class="col q"><small>Kolejka · 3 kierunki</small>${stripQueue(T.pax, 132)}</div>
      <div class="col" style="width:60px"><small>Miejsca</small><b class="num">14/24</b></div>
      <div class="col" style="width:72px"><small>Zamkn.</small><b class="num ok" style="font-size:13px;margin-top:8px">brak</b></div>
    </div>
  </section>`);
}

function drawNetworkSmall(svg, g) {
  const { routes } = routeLayer(svg, g, 'menu', false);
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
  stage.append(html(`<section class="fids" style="top:520px">
    <div class="hd"><span>Odloty · <b>wybierz</b></span><span>08.11</span></div>
    <button class="r"><span>${wflap('Dziś')}<small>Ten sam świat dla wszystkich</small></span><span class="st y">${gl('EUN')} ${gl('ME')} ${gl('AFR')}<br>OTWARTE</span></button>
    <button class="r"><span>${wflap('Zadania')}<small>0 z 40 rozwiązanych</small></span><span class="st">${flaps('0/40', 'stf')}</span></button>
    <button class="r"><span>${wflap('Dziennik')}<small>Rekordy i trasy</small></span><span class="st">${ARROW.replace('<svg', '<svg width="18" height="18" style="color:#EFE7D3"')}</span></button>
    <button class="r"><span>${wflap('Ustawienia')}<small>Dźwięk, język, tempo</small></span><span class="st">${ARROW.replace('<svg', '<svg width="18" height="18" style="color:#EFE7D3"')}</span></button>
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
      <div class="cell"><span class="lg">Pasażerowie</span>${flaps('034', 'sm pax')}</div>
      <div class="cell"><span class="lg">Trasy</span>${flaps('3', 'sm')}</div>
      <div class="cell"><span class="lg">Samoloty</span>${flaps('3', 'sm')}</div>
      <div class="cell"><span class="lg">Przesiadki</span>${flaps('11', 'sm')}</div>
    </div>
  </header>`));
  stage.append(html(`<h2 style="top:466px">Przydział na tydzień 2 · weź jeden pasek</h2>`));
  const strip = (cls, id, name, desc, qty, unit) => `<div class="strip ${cls}"><div class="holder">${icon(id)}</div><div class="main"><b>${name}</b><span>${desc}</span></div><div class="qty"><b>${qty}</b><small>${unit}</small></div></div>`;
  stage.append(html(`<section class="pick" style="top:492px">
    ${strip('prop sel', 'prop', 'Turbośmigłowiec', 'Krótkie trasy do 1 500 km.<br>12 miejsc, szybki obrót.', '+2', 'samoloty')}
    ${strip('jet', 'jet', 'Szerokokadłubowiec', 'Długie trasy między hubami.<br>36 miejsc, wolny obrót.', '+1', 'samolot')}
    ${strip('hub', 'hub', 'Hub', 'Lotnisko przesiadkowe:<br>kolejka 24 → 36 miejsc.', '+1', 'hub')}
  </section>`));
  stage.append(html(`<button class="go" style="bottom:22px"><span><b>Weź turbośmigłowce</b><small>Tydzień 2 zaczyna się o 06:00</small></span>${ARROW}</button>`));
}

function drawOver(svg, g, calm) {
  const { routes, planes } = routeLayer(svg, g, 'over', !!calm);
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

function drawReport(stage) {
  stage.append(html('<div class="scrim" style="background:rgba(5,6,7,.5)"></div>'));
  const ln = (k, v, extra = '') => `<div class="ln"><span>${k}</span><span class="dots">${' .'.repeat(40)}</span><b>${v}</b>${extra}</div>`;
  const A = AIRPORTS.AMM;
  const q = el('svg', { width: 260, height: 30, viewBox: '0 0 260 30' });
  Object.entries({ EUN: 15, EUS: 12, AFR: 9 }).forEach(([r, n], i) => { for (let k = 0; k < n; k++) q.append(glyph(r, 5 + k * 9, 5 + i * 10, 7.6, false)); });
  stage.append(html(`<article class="ticket" style="top:236px">
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
    <div style="color:#6E6350">KONIEC RAPORTU · ZACHOWANY W DZIENNIKU</div>
    <div class="stamp">ZATOR<small>AMM 04:12</small></div>
  </article>`));
  stage.append(html(`<div class="btnrow" style="bottom:22px"><button class="go alt"><span><b>Menu</b></span></button><button class="go"><span><b>Jeszcze raz</b><small>Nowy świat, ta sama Ziemia</small></span>${ARROW}</button></div>`));
}

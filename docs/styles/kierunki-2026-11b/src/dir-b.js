// Direction B "Gwasz": the screen is one gouache poster. Every surface is a flat, opaque field of paint from
// one small palette; relief is posterised into three light steps (Imhof's north-west light), the terminator is
// painted as a warm band and the night as one flat indigo glaze. Routes and planes float above the globe and
// cast flat shadows. UI shapes are cut from the same paint: no lines, no outlines, no gradients, no shadows on UI.
import { renderGlobe, makeCamera, hex, mix, clamp } from './globe.js';
import { W, H, SUN, AIRPORTS, ROUTES, PLANES, REGIONS, GLYPH, screenArc, toD, planePose, el, km, GAME_CAM, MENU_CAM } from './scene.js';
import { ICON } from './icons.js';

const C = {
  sky: '#173340', band1: '#1F4352', band2: '#29566A', deep: '#245B6A', shelf: '#2F7682',
  low: '#E3C68E', mid: '#D2A263', high: '#B47A4B', peak: '#F1E5CC', green: '#A7AF73',
  lightP: '#F5E4BC', darkP: '#7E4B33', night: '#18203D', dusk: '#E2643A',
  cream: '#F4EAD3', ink: '#122129', red: '#E2532F', mute: '#5E7E88',
};
const X = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)]));

function shade(s) {
  let col;
  if (s.land < 0.5) {
    col = s.dist < 1.1 ? X.shelf : X.deep;
  } else {
    const e = s.elevb;
    col = e > 0.48 ? X.peak : e > 0.24 ? X.high : e > 0.09 ? X.mid : (s.lat > 44 ? X.green : X.low);
    if (s.hsb > 0.66) col = mix(col, X.lightP, 0.38);
    else if (s.hsb < 0.47) col = mix(col, X.darkP, 0.4);
  }
  // sphere: one flat darker step on the side away from the poster light (upper left)
  const lam = -0.5 * s.nx + 0.5 * s.ny + 0.7 * s.nz;
  if (lam < 0.42) col = mix(col, X.ink, 0.1);
  // terminator painted as a warm band, night as one flat glaze
  if (s.sun < -0.02) col = mix(col, X.night, 0.66);
  else if (s.sun < 0.012) col = mix(col, X.dusk, 0.45);
  return col;
}
function sky(s) {
  if (s.gap < 0.012) return X.band2;
  if (s.gap < 0.03) return X.band1;
  return null;
}

const T = (x, y, txt, a = {}) => el('text', { x, y, ...a }, txt);
const face = (w, wd, size, fill, extra = {}) => ({ 'font-family': 'Anybody', 'font-weight': w, 'font-stretch': `${wd}%`, 'font-size': size, fill, ...extra });

// hangar silhouettes (shape = type); the paint level inside = passengers waiting
const HANGAR = 'M-38 0 L-38 -24 Q-38 -54 0 -54 Q38 -54 38 -24 L38 0 Z'; const HANGAR_OLD = 'M-30 0 L-30 -20 Q-30 -44 0 -44 Q30 -44 30 -20 L30 0 Z';
const HUBHANGAR = 'M-56 0 L-56 -24 Q-56 -50 -28 -50 Q-6 -50 -2 -30 Q2 -50 24 -50 Q40 -50 46 -36 L46 -78 L40 -78 L40 -92 L62 -92 L62 -78 L56 -78 L56 0 Z';

let clipN = 0;
function airport(svg, cam, code, o = {}) {
  const a = AIRPORTS[code]; const p = cam.project([a.lon, a.lat]); if (!p) return;
  const [x, y] = p; const g = el('g'); svg.append(g);
  const jam = a.jam != null; const shape = a.hub ? HUBHANGAR : HANGAR; const hgt = a.hub ? 92 : 44;
  if (jam) {
    g.append(el('circle', { cx: x, cy: y - 30, r: 128, fill: C.red }));
  }
  g.append(el('path', { d: shape, transform: `translate(${x + 10} ${y + 6}) skewX(-30) scale(1 0.35)`, fill: C.ink, opacity: 0.28 }));
  const id = `cl${clipN++}`; const cp = el('clipPath', { id }); cp.append(el('path', { d: shape, transform: `translate(${x} ${y})` })); svg.append(cp);
  g.append(el('path', { d: shape, transform: `translate(${x} ${y})`, fill: C.cream }));
  const level = Math.min(1, a.wait / a.cap) * (a.hub ? 50 : 54);
  g.append(el('rect', { x: x - 60, y: y - level, width: 124, height: level, fill: jam ? C.ink : C.ink, 'clip-path': `url(#${id})` }));
  if (jam) g.append(el('path', { d: shape, transform: `translate(${x} ${y})`, fill: 'none' }));
  // name plate: a flat cut of ink with cream lettering and the passengers in their region colours
  const items = Object.entries(a.pax || {});
  const name = a.name.toUpperCase();
  const tw = Math.max(name.length * 19 + 110, items.length * 76 + 20);
  const bx = Math.max(24, Math.min(W - 24 - tw, o.anchor === 'end' ? x + (o.dx ?? 0) - tw : x + (o.dx ?? 40))), by = y + (o.dy ?? -34);
  g.append(el('rect', { x: bx, y: by, width: tw, height: items.length ? 92 : 50, fill: jam ? C.red : C.ink }));
  g.append(T(bx + 14, by + 38, name, face(800, 78, 34, C.cream)));
  g.append(T(bx + tw - 14, by + 38, `${a.wait}/${a.cap}`, face(700, 70, 28, jam ? C.cream : '#9DB5BB', { 'text-anchor': 'end' })));
  let gx = bx + 26;
  for (const [rid, n] of items) {
    g.append(el('path', { d: GLYPH[REGIONS[rid].glyph], transform: `translate(${gx} ${by + 70}) scale(2)`, fill: jam ? C.cream : rid === 'AFR' ? C.cream : REGIONS[rid].color }));
    g.append(T(gx + 18, by + 80, String(n), face(700, 80, 28, C.cream)));
    gx += 76;
  }
  if (a.isNew) {
    g.append(el('rect', { x: bx, y: by - 34, width: 92, height: 34, fill: C.red }));
    g.append(T(bx + 12, by - 8, 'NOWE', face(800, 90, 24, C.cream)));
  }
}

function plane(svg, cam, pl) {
  const q = planePose(cam, pl, 0.03);
  const icon = pl.kind === 'jet' ? ICON.jet : ICON.prop; const sc = pl.kind === 'jet' ? 0.62 : 0.52;
  svg.append(el('path', { d: icon, transform: `translate(${q.gx} ${q.gy}) rotate(${q.ang + 90}) scale(${sc}) translate(-50 -50)`, fill: C.ink, opacity: 0.3 }));
  svg.append(el('path', { d: icon, transform: `translate(${q.x} ${q.y}) rotate(${q.ang + 90}) scale(${sc}) translate(-50 -50)`, fill: C.cream }));
}

function hud(svg) {
  svg.append(T(60, 176, '17:06', face(800, 120, 136, C.cream)));
  svg.append(T(64, 232, 'TYDZIEŃ 1 · DZIEŃ 2 Z 3', face(700, 80, 34, C.cream)));
  svg.append(T(64, 278, '34 pasażerów', face(500, 90, 30, '#B7C9CD')));
  // day as three painted fields: night, day, night; the cut is "now"
  const x0 = 520, y0 = 206, w = 330;
  const seg = (h0, h1, c) => svg.append(el('rect', { x: x0 + (h0 / 24) * w, y: y0, width: ((h1 - h0) / 24) * w, height: 26, fill: c }));
  seg(0, 6, C.night); seg(6, 7, C.dusk); seg(7, 19, C.cream); seg(19, 20, C.dusk); seg(20, 24, C.night);
  svg.append(el('rect', { x: x0 + (17.1 / 24) * w - 3, y: y0 - 14, width: 6, height: 54, fill: C.red }));
  // pause, 126 px disc = 48 dp
  svg.append(el('circle', { cx: W - 64 - 63, cy: 127, r: 63, fill: C.cream }));
  svg.append(el('rect', { x: W - 127 - 20, y: 100, width: 13, height: 54, fill: C.ink }));
  svg.append(el('rect', { x: W - 127 + 7, y: 100, width: 13, height: 54, fill: C.ink }));
  // dock: the poster's lower band, same paint as the sky
  const y = 1650;
  svg.append(el('rect', { x: 0, y, width: W, height: H - y, fill: C.sky }));
  const items = [[ICON.undo, 'Cofnij'], [ICON.prop, 'Turbośmigłowy', 'sel'], [ICON.jet, 'Szerokokadł.', 'off'], [ICON.hub, 'Hub', 'off'], [ICON.view, 'Widok'], [ICON.tempo, 'Tempo 1×']];
  const bw = (W - 48) / 6;
  items.forEach(([ic, lb, st], i) => {
    const cx = 24 + i * bw + bw / 2;
    if (st === 'sel') svg.append(el('circle', { cx, cy: y + 86, r: 66, fill: C.red }));
    svg.append(el('path', { d: ic, transform: `translate(${cx - 38} ${y + 48}) scale(0.76)`, fill: st === 'off' ? C.mute : C.cream }));
    svg.append(T(cx, y + 192, lb, face(700, 72, 27, st === 'off' ? C.mute : C.cream, { 'text-anchor': 'middle' })));
    if (st === 'off') svg.append(T(cx, y + 228, 'za 1 dzień', face(500, 80, 24, C.mute, { 'text-anchor': 'middle' })));
  });
}

export async function render({ world, stage, frame }) {
  const cv = el('canvas', { width: W, height: H }); stage.append(cv);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); stage.append(svg);
  if (frame === 'game') {
    const cam = makeCamera(GAME_CAM);
    renderGlobe(ctx, world, cam, SUN, shade, 2, sky);
    for (const [a, b] of ROUTES) {
      svg.append(el('path', { d: toD(screenArc(cam, a, b)), fill: 'none', stroke: C.ink, 'stroke-opacity': 0.26, 'stroke-width': 9, 'stroke-linecap': 'round' }));
    }
    for (const [a, b] of ROUTES) {
      svg.append(el('path', { d: toD(screenArc(cam, a, b, 0.03)), fill: 'none', stroke: C.cream, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': a === 'VCE' && b === 'RIX' ? '1 18' : 'none' }));
    }
    for (const pl of PLANES) plane(svg, cam, pl);
    airport(svg, cam, 'RIX', { dx: 44, dy: -40 });
    airport(svg, cam, 'VCE', { dx: 44, dy: -40 });
    airport(svg, cam, 'ATH', { dx: -30, dy: 26, anchor: 'end' });
    airport(svg, cam, 'ANK', { dx: 46, dy: -38 });
    airport(svg, cam, 'BGW', { dx: 40, dy: -160, anchor: 'end' });
    airport(svg, cam, 'AMM', { dx: -150, dy: 120, anchor: 'end' });
    const am = cam.project([AIRPORTS.AMM.lon, AIRPORTS.AMM.lat]);
    svg.append(T(am[0], am[1] + 64, '0:42', face(900, 110, 60, C.cream, { 'text-anchor': 'middle' })));
    svg.append(el('rect', { x: W - 250, y: 1180, width: 250, height: 96, fill: C.cream }));
    svg.append(T(W - 228, 1224, 'KARACZI →', face(800, 78, 32, C.ink)));
    svg.append(T(W - 228, 1262, `${km('BGW', 'KHI').toLocaleString('pl-PL')} km · 8/12`, face(600, 85, 24, C.ink)));
    hud(svg);
  } else {
    const cam = makeCamera({ ...MENU_CAM, F: 1750, cy: 980 });
    renderGlobe(ctx, world, cam, { lon: -5, lat: -16 }, shade, 2, sky);
    for (const [a, b] of [['VCE', 'ATH'], ['ATH', 'AMM'], ['VCE', 'RIX'], ['AMM', 'BGW']]) {
      svg.append(el('path', { d: toD(screenArc(cam, a, b)), fill: 'none', stroke: C.ink, 'stroke-opacity': 0.3, 'stroke-width': 6 }));
      svg.append(el('path', { d: toD(screenArc(cam, a, b, 0.012)), fill: 'none', stroke: C.cream, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    }
    for (const c of ['VCE', 'ATH', 'AMM', 'RIX', 'BGW']) {
      const a = AIRPORTS[c]; const [x, y] = cam.project([a.lon, a.lat]);
      svg.append(el('path', { d: a.hub ? HUBHANGAR : HANGAR, transform: `translate(${x} ${y}) scale(0.4)`, fill: a.jam ? C.red : C.cream }));
    }
    svg.append(T(54, 236, 'AIRWAY', face(900, 125, 190, C.cream)));
    svg.append(T(62, 300, 'Sieć lotnicza na całym globie', face(600, 90, 38, '#B7C9CD')));
    const y0 = 1390;
    svg.append(el('rect', { x: 0, y: y0 - 30, width: W, height: H - y0 + 30, fill: C.sky }));
    svg.append(el('rect', { x: 0, y: y0, width: W - 60, height: 150, fill: C.red }));
    svg.append(T(60, y0 + 100, 'LOT BEZ KOŃCA', face(900, 110, 74, C.cream)));
    svg.append(T(W - 96, y0 + 96, 'brak rekordu', face(600, 85, 28, C.cream, { 'text-anchor': 'end' })));
    const rows = [['DZIŚ 06.11', 'ten sam świat dla wszystkich'], ['ZADANIA', '0 z 40 rozwiązanych']];
    rows.forEach(([t, sub], i) => {
      const y = y0 + 236 + i * 100;
      svg.append(T(60, y, t, face(800, 100, 48, C.cream)));
      if (sub) svg.append(T(W - 60, y - 4, sub, face(500, 85, 28, '#B7C9CD', { 'text-anchor': 'end' })));
    });
    const y3 = y0 + 236 + 2 * 100 + 10;
    svg.append(el('rect', { x: 60, y: y3 - 66, width: 455, height: 100, fill: C.band1 }));
    svg.append(el('rect', { x: 565, y: y3 - 66, width: 455, height: 100, fill: C.band1 }));
    svg.append(T(90, y3, 'DZIENNIK', face(800, 100, 40, C.cream)));
    svg.append(T(595, y3, 'USTAWIENIA', face(800, 100, 40, C.cream)));
  }
}

// Direction A "Linoryt": the whole screen is one relief print in three inks on paper.
// World: ocean = Prussian-blue block with carved white lines (water-lining at coasts, parallels offshore);
// land = ochre block with black hatching from the relief; night = black cross-hatching.
// UI: the same inks, cut shapes, no shadows, no panels; text is printed on the paper margin.
import { renderGlobe, makeCamera, coastD, hex, mix, clamp, smooth } from './globe.js';
import { W, H, SUN, AIRPORTS, ROUTES, PLANES, REGIONS, GLYPH, screenArc, toD, planePose, el, km, GAME_CAM, MENU_CAM } from './scene.js';
import { ICON } from './icons.js';

const C = { paper: '#ECE3CC', ink: '#1E1C1F', blue: '#2B4A66', ochre: '#D29C47', red: '#C8412A', paper2: '#E2D6B8' };
const P = hex(C.paper), INK = hex(C.ink), BLUE = hex(C.blue), OCHRE = hex(C.ochre), RED = hex(C.red);

function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
const band = (v, w) => { const f = v - Math.floor(v); return Math.abs(f - 0.5) < w ? 1 : 0; };
const bandS = (v, w, aa = 0.06) => { const f = Math.abs((v - Math.floor(v)) - 0.5); return 1 - smooth(w - aa, w + aa, f); };

function shade(s) {
  const lam = clamp(-0.45 * s.nx + 0.55 * s.ny + 0.7 * s.nz);
  const speck = hash(s.x, s.y);
  let col;
  if (s.land < 0.5) {
    // ocean: blue block; three carved water-lines follow the coast, then fine carved parallels
    let carve = 0;
    if (s.dist < 2.6) carve = bandS(s.dist / 0.85 + 0.5, 0.17 - s.dist * 0.04, 0.07);
    else carve = bandS(s.lat / 0.16, 0.03 + 0.16 * lam * lam, 0.07);
    col = mix(BLUE, P, carve * 0.9);
  } else {
    // land: ochre block, black hatching only where the relief turns away from the light
    const dark = clamp((0.5 - s.hs) * 2.6) * 0.85 + clamp((0.5 - lam) * 0.5);
    const hatch = bandS((s.lon * 0.85 + s.lat) / 0.15, dark * 0.36, 0.08);
    col = mix(OCHRE, INK, hatch);
  }
  col = mix(col, INK, smooth(0.25, 0.6, s.edge || 0)); // printed coast
  // night: black cross-hatching that thickens past the terminator
  const n1 = clamp((0.06 - s.sun) * 2.6, 0, 0.36);
  if (n1 > 0) {
    const h1 = bandS((s.lon - s.lat) / 0.15, n1, 0.08);
    const n2 = clamp((-0.08 - s.sun) * 2.2, 0, 0.3);
    const h2 = n2 > 0 ? bandS((s.lon + s.lat * 0.3) / 0.17 + 0.25, n2, 0.08) : 0;
    col = mix(col, INK, Math.max(h1, h2) * 0.92);
  }
  if (speck < 0.03) col = mix(col, P, 0.45); // starved ink
  return col;
}

function paperBg(ctx) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (hash(i % 4320, (i / 4320) | 0) - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  ctx.putImageData(img, 0, 0);
}

const T = (x, y, txt, a = {}) => el('text', { x, y, ...a }, txt);
const halo = { stroke: C.paper, 'stroke-width': 9, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };

function glyph(id, x, y, size, fill) {
  return el('path', { d: GLYPH[REGIONS[id].glyph], transform: `translate(${x} ${y}) scale(${size / 12})`, fill });
}

function airport(svg, cam, code, opts = {}) {
  const a = AIRPORTS[code]; const p = cam.project([a.lon, a.lat]); if (!p) return;
  const [x, y] = p; const g = el('g'); svg.append(g);
  const jam = a.jam != null;
  if (jam) {
    // red overprint: a hatched exclusion zone, ring = time left
    const r = 118;
    g.append(el('circle', { cx: x, cy: y, r, fill: 'url(#redHatch)' }));
    g.append(el('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.red, 'stroke-width': 4 }));
    const left = 0.7, ang = left * 2 * Math.PI;
    const ex = x + r * Math.sin(ang), ey = y - r * Math.cos(ang);
    g.append(el('path', { d: `M${x} ${y - r} A${r} ${r} 0 ${left > 0.5 ? 1 : 0} 1 ${ex} ${ey}`, fill: 'none', stroke: C.red, 'stroke-width': 16, 'stroke-linecap': 'butt' }));
  }
  if (a.hub) {
    const r = 40; const pts = [];
    for (let i = 0; i < 8; i++) { const t = (i + 0.5) * Math.PI / 4; pts.push(`${x + r * Math.cos(t)},${y + r * Math.sin(t)}`); }
    g.append(el('polygon', { points: pts.join(' '), fill: jam ? C.red : C.ink, stroke: C.paper, 'stroke-width': 5, 'paint-order': 'stroke' }));
    g.append(el('path', { d: ICON.hub, transform: `translate(${x - 26} ${y - 26}) scale(0.52)`, fill: C.paper }));
  } else {
    g.append(el('rect', { x: x - 22, y: y - 22, width: 44, height: 44, fill: C.ink, stroke: C.paper, 'stroke-width': 5, 'paint-order': 'stroke' }));
    g.append(el('rect', { x: x - 4, y: y - 17, width: 8, height: 34, fill: C.paper, transform: `rotate(35 ${x} ${y})` }));
  }
  // label block: name, tally of seats (one mark = 2 places), waiting passengers by region
  const lx = x + (opts.dx ?? (a.hub ? 56 : 40)), ly = y + (opts.dy ?? -6);
  const anchor = opts.anchor || 'start';
  g.append(T(lx, ly, a.name, { 'font-family': 'Besley', 'font-weight': 800, 'font-size': a.hub ? 44 : 36, fill: jam ? C.red : C.ink, 'text-anchor': anchor, ...halo }));
  const marks = Math.ceil(a.cap / 2), full = Math.ceil(a.wait / 2);
  const mw = a.cap > 24 ? 9 : 11; const totalW = marks * mw;
  const mx0 = anchor === 'end' ? lx - totalW : lx;
  const tg = el('g'); g.append(tg);
  tg.append(el('rect', { x: mx0 - 6, y: ly + 12, width: totalW + 8, height: 30, fill: C.paper }));
  for (let i = 0; i < marks; i++) {
    const on = i < full;
    tg.append(el('rect', { x: mx0 + i * mw, y: ly + 16, width: mw - 4, height: 22, fill: on ? (jam ? C.red : C.ink) : 'none', stroke: jam ? C.red : C.ink, 'stroke-width': on ? 0 : 2 }));
  }
  if (opts.pax !== false && a.pax) {
    let gx = mx0; const gy = ly + 66;
    const items = Object.entries(a.pax);
    const w = items.length * 78;
    if (anchor === 'end') gx = lx - w;
    tg.append(el('rect', { x: gx - 6, y: gy - 22, width: w + 4, height: 42, fill: C.paper }));
    for (const [id, n] of items) {
      tg.append(glyph(id, gx + 14, gy, 26, jam ? C.red : C.ink));
      tg.append(T(gx + 32, gy + 11, String(n), { 'font-family': 'Schibsted Grotesk', 'font-weight': 700, 'font-size': 30, fill: jam ? C.red : C.ink }));
      gx += 78;
    }
  }
  if (a.isNew) {
    g.append(el('rect', { x: x - 100, y: y - 15, width: 68, height: 30, fill: C.red }));
    g.append(T(x - 66, y + 8, 'NOWE', { 'font-family': 'Schibsted Grotesk', 'font-weight': 800, 'font-size': 22, fill: C.paper, 'text-anchor': 'middle', 'letter-spacing': 1 }));
  }
}

function plane(svg, cam, pl) {
  const q = planePose(cam, pl);
  const icon = pl.kind === 'jet' ? ICON.jet : ICON.prop;
  svg.append(el('path', { d: icon, transform: `translate(${q.x} ${q.y}) rotate(${q.ang + 90}) scale(0.5) translate(-50 -50)`, fill: C.ink, stroke: C.paper, 'stroke-width': 9, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }));
}

function defs(svg) {
  const d = el('defs');
  const p = el('pattern', { id: 'redHatch', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  p.append(el('rect', { width: 4.5, height: 12, fill: C.red }));
  d.append(p); svg.append(d);
}

function dockButton(svg, x, y, w, icon, label, state) {
  const g = el('g'); svg.append(g);
  const sel = state === 'sel', off = state === 'off';
  if (sel) g.append(el('rect', { x: x + 6, y, width: w - 12, height: 132, fill: C.ink }));
  g.append(el('path', { d: icon, transform: `translate(${x + w / 2 - 36} ${y + 16}) scale(0.72)`, fill: off ? 'none' : sel ? C.paper : C.ink, stroke: off ? C.ink : 'none', 'stroke-width': off ? 4 : 0, 'stroke-linejoin': 'round' }));
  g.append(T(x + w / 2, y + 122, label, { 'font-family': 'Schibsted Grotesk', 'font-weight': 700, 'font-size': 26, fill: sel ? C.paper : C.ink, 'text-anchor': 'middle' }));
  if (off) g.append(T(x + w / 2, y + 160, 'za 1 dzień', { 'font-family': 'Schibsted Grotesk', 'font-weight': 500, 'font-size': 24, fill: C.blue, 'text-anchor': 'middle' }));
}

function hud(svg) {
  // time block, printed on the paper sky
  svg.append(T(64, 168, '17:06', { 'font-family': 'Besley', 'font-weight': 900, 'font-size': 128, fill: C.ink }));
  svg.append(T(420, 112, 'Tydzień 1', { 'font-family': 'Besley', 'font-weight': 800, 'font-size': 44, fill: C.ink }));
  svg.append(T(420, 160, 'dzień 2 z 3 · 34 pasażerów', { 'font-family': 'Schibsted Grotesk', 'font-weight': 600, 'font-size': 30, fill: C.ink }));
  // day strip: 24 carved cells, night hours inked solid, now = red cut
  const x0 = 66, y0 = 206, cw = 30;
  for (let h = 0; h < 24; h++) {
    const night = h < 6 || h >= 20; const past = h < 17;
    svg.append(el('rect', { x: x0 + h * cw, y: y0, width: cw - 5, height: 26, fill: night ? C.ink : past ? C.blue : 'none', stroke: C.ink, 'stroke-width': night || past ? 0 : 2.5 }));
  }
  const nx = x0 + 17.1 * cw;
  svg.append(el('path', { d: `M${nx} ${y0 - 4} l-11 -18 h22 z`, fill: C.red }));
  svg.append(el('rect', { x: nx - 2, y: y0 - 4, width: 4, height: 36, fill: C.red }));
  for (const [h, t] of [[0, '0'], [6, '6'], [12, '12'], [18, '18']]) svg.append(T(x0 + h * cw, y0 + 58, t, { 'font-family': 'Schibsted Grotesk', 'font-weight': 600, 'font-size': 22, fill: C.ink }));
  // pause: a cut square, 126 px = 48 dp
  svg.append(el('rect', { x: W - 64 - 126, y: 64, width: 126, height: 126, fill: C.ink }));
  svg.append(el('rect', { x: W - 64 - 126 + 42, y: 98, width: 14, height: 58, fill: C.paper }));
  svg.append(el('rect', { x: W - 64 - 126 + 70, y: 98, width: 14, height: 58, fill: C.paper }));
  // dock on the paper margin, double rule like a print border
  const y = 1640;
  svg.append(el('rect', { x: 0, y, width: W, height: H - y, fill: C.paper }));
  svg.append(el('rect', { x: 0, y, width: W, height: 7, fill: C.ink }));
  svg.append(el('rect', { x: 0, y: y + 13, width: W, height: 2.5, fill: C.ink }));
  const items = [[ICON.undo, 'Cofnij'], [ICON.prop, 'Turbośmigł.', 'sel'], [ICON.jet, 'Szerokokadł.', 'off'], [ICON.hub, 'Hub', 'off'], [ICON.view, 'Widok'], [ICON.tempo, 'Tempo 1×']];
  const w = (W - 48) / 6;
  items.forEach(([ic, lb, st], i) => dockButton(svg, 24 + i * w, y + 40, w, ic, lb, st));
}

// sky: paper, with three printed atmosphere lines just off the limb and an inked limb
function sky(s, bg) {
  const g = s.gap;
  if (g < 0.0016) return INK;
  for (const [o, w] of [[0.007, 0.0012], [0.016, 0.0009], [0.028, 0.0007]]) if (Math.abs(g - o) < w) return BLUE;
  return null;
}

export async function render({ world, stage, frame }) {
  const cv = el('canvas', { width: W, height: H }); stage.append(cv);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  paperBg(ctx);
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); stage.append(svg); defs(svg);
  if (frame === 'game') {
    const cam = makeCamera(GAME_CAM);
    renderGlobe(ctx, world, cam, SUN, shade, 2, sky);
    for (const [a, b] of ROUTES) {
      const d = toD(screenArc(cam, a, b));
      svg.append(el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 11, 'stroke-linecap': 'round' }));
      svg.append(el('path', { d, fill: 'none', stroke: C.paper, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': a === 'VCE' && b === 'RIX' ? '14 10' : 'none' }));
    }
    for (const pl of PLANES) plane(svg, cam, pl);
    airport(svg, cam, 'RIX', { dx: 36, dy: 8 });
    airport(svg, cam, 'VCE', { dx: 36, dy: -10 });
    airport(svg, cam, 'ATH', { dx: -10, dy: 92, anchor: 'end' });
    airport(svg, cam, 'ANK', { dx: 36, dy: -22 });
    airport(svg, cam, 'BGW', { dx: -10, dy: 74, anchor: 'end' });
    airport(svg, cam, 'AMM', { dx: -130, dy: 40, anchor: 'end' });
    const am = cam.project([AIRPORTS.AMM.lon, AIRPORTS.AMM.lat]);
    const bx = am[0] - 150, by = am[1] + 134;
    svg.append(el('rect', { x: bx, y: by, width: 300, height: 128, fill: C.red }));
    svg.append(T(bx + 22, by + 44, 'Zator za', { 'font-family': 'Schibsted Grotesk', 'font-weight': 700, 'font-size': 30, fill: C.paper }));
    svg.append(T(bx + 22, by + 104, '0:42', { 'font-family': 'Besley', 'font-weight': 900, 'font-size': 64, fill: C.paper }));
    svg.append(T(bx + 278, by + 104, '36 z 36', { 'font-family': 'Schibsted Grotesk', 'font-weight': 700, 'font-size': 28, fill: C.paper, 'text-anchor': 'end' }));
    svg.append(el('rect', { x: W - 260, y: 900, width: 260, height: 104, fill: C.paper }));
    svg.append(el('rect', { x: W - 260, y: 900, width: 6, height: 104, fill: C.ink }));
    svg.append(T(W - 236, 942, 'Karaczi →', { 'font-family': 'Besley', 'font-weight': 800, 'font-size': 34, fill: C.ink }));
    svg.append(T(W - 236, 984, `${km('BGW', 'KHI').toLocaleString('pl-PL')} km · 8 z 12`, { 'font-family': 'Schibsted Grotesk', 'font-weight': 600, 'font-size': 24, fill: C.ink }));
    hud(svg);
  } else {
    const cam = makeCamera(MENU_CAM);
    renderGlobe(ctx, world, cam, { lon: -10, lat: -16 }, shade, 2, sky);
    svg.append(el('path', { d: coastD(world, cam), fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    for (const [a, b] of [['VCE', 'ATH'], ['ATH', 'AMM'], ['VCE', 'RIX'], ['AMM', 'BGW']]) {
      const d = toD(screenArc(cam, a, b));
      svg.append(el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 8, 'stroke-linecap': 'round' }));
      svg.append(el('path', { d, fill: 'none', stroke: C.paper, 'stroke-width': 3 }));
    }
    for (const c of ['VCE', 'ATH', 'AMM', 'RIX', 'BGW']) {
      const a = AIRPORTS[c]; const [x, y] = cam.project([a.lon, a.lat]);
      svg.append(el('rect', { x: x - 13, y: y - 13, width: 26, height: 26, fill: a.hub ? C.red : C.ink, stroke: C.paper, 'stroke-width': 4, 'paint-order': 'stroke' }));
    }
    // title printed over the margin
    svg.append(T(60, 230, 'Airway', { 'font-family': 'Besley', 'font-weight': 900, 'font-size': 190, fill: C.ink }));
    svg.append(T(66, 290, 'Sieć lotnicza na globusie', { 'font-family': 'Schibsted Grotesk', 'font-weight': 600, 'font-size': 36, fill: C.ink }));
    // menu: a printed index, rules between rows, one red cut for the main action
    const rows = [
      ['Lot bez końca', 'brak rekordu', 'main'], ['Dziś 06.11', 'ten sam świat dla wszystkich'], ['Zadania', '0 z 40 rozwiązanych'], ['Dziennik', ''], ['Ustawienia', ''],
    ];
    let y = 1330;
    svg.append(el('rect', { x: 0, y: y - 20, width: W, height: H - y + 20, fill: C.paper }));
    svg.append(el('rect', { x: 60, y: y - 20, width: W - 120, height: 7, fill: C.ink }));
    svg.append(el('rect', { x: 60, y: y - 7, width: W - 120, height: 2.5, fill: C.ink }));
    for (const [t, sub, kind] of rows) {
      const h = kind ? 150 : 104;
      if (kind) svg.append(el('rect', { x: 60, y: y + 10, width: W - 120, height: h - 20, fill: C.red }));
      svg.append(T(kind ? 92 : 60, y + (kind ? 88 : 66), t, { 'font-family': 'Besley', 'font-weight': 800, 'font-size': kind ? 62 : 46, fill: kind ? C.paper : C.ink }));
      if (sub) svg.append(T(W - (kind ? 92 : 60), y + (kind ? 86 : 64), sub, { 'font-family': 'Schibsted Grotesk', 'font-weight': 600, 'font-size': 28, fill: kind ? C.paper : C.ink, 'text-anchor': 'end' }));
      y += h;
      if (!kind) svg.append(el('rect', { x: 60, y: y - 2, width: W - 120, height: 2.5, fill: C.ink }));
    }
    svg.append(T(W - 60, 1270, 'Tryb: losowy świat  ▾', { 'font-family': 'Schibsted Grotesk', 'font-weight': 700, 'font-size': 30, fill: C.ink, 'text-anchor': 'end' }));
  }
}

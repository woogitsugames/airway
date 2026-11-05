// Variant B "Nadruk" — no panels at all: everything is overprinted straight onto the globe in two chart inks
// (VFR magenta + chart blue), each letter and symbol with a white cartographic halo. Airports are magenta chart symbols
// whose ring thickens with the waiting load; a jam is a hatched prohibited area; the dock is a row of printed symbols.
import { AIRPORTS, MENU_PADS, ROUTES, byCode, pos, rad, runways, glyphRow, T, sym, mount } from '../common.js';
import { tw } from '../measure.js';

// two print inks (ref. plates 08, 09): blue = hubs and the HUD, magenta = small airports, routes and alerts
const MAG = '#B0186C', BLK = '#1B4A8F', W = '#FFFFFF', GREY = '#6F7A86';
const F = 'Libre Franklin', S = 'Source Serif 4';
const H = { halo: W, hw: 2.4 };

/** Arc path on a circle from fraction f0 to f1 (0 = top, clockwise). */
function arc(r, f0, f1) {
  const p = (f) => { const a = (-90 + f * 360) * Math.PI / 180; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const [x0, y0] = p(f0), [x1, y1] = p(f1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function marker(a, [x, y], key) {
  const r = rad(a, key), f = a.wait.length / a.cap, col = a.hub && !a.jam ? BLK : MAG;
  let s = `<g transform="translate(${x} ${y})">`;
  if (a.jam) {
    // prohibited area: hatched band, its length = time left before the network closes
    const R = r + 12;
    s += `<circle r="${R}" fill="none" stroke="${W}" stroke-width="3.6"/><circle r="${R}" fill="none" stroke="${MAG}" stroke-width="1.6"/>`;
    for (let i = 0; i < 44 * (42 / 60); i++) {
      const a0 = (-90 + (i / 44) * 360) * Math.PI / 180, a1 = a0 + 0.13;
      const d = `M${(Math.cos(a0) * (R - 8)).toFixed(2)} ${(Math.sin(a0) * (R - 8)).toFixed(2)}L${(Math.cos(a1) * R).toFixed(2)} ${(Math.sin(a1) * R).toFixed(2)}`;
      s += `<path d="${d}" stroke="${W}" stroke-width="4"/><path d="${d}" stroke="${MAG}" stroke-width="2"/>`;
    }
  }
  const rr = a.hub ? r + 4 : r;
  // load ring: thin for free places, thick for taken ones
  s += `<circle r="${rr}" fill="none" stroke="${W}" stroke-width="${a.hub ? 3.4 : 4}"/>`;
  s += `<circle r="${rr}" fill="none" stroke="${col}" stroke-width="1.3"/>`;
  if (f > 0) s += `<path d="${arc(rr, 0, Math.min(f, 0.999))}" fill="none" stroke="${W}" stroke-width="7.5" stroke-linecap="butt"/><path d="${arc(rr, 0, Math.min(f, 0.999))}" fill="none" stroke="${col}" stroke-width="4.5" stroke-linecap="butt"/>`;
  s += a.hub ? runways(true, r * 0.95, { fill: col, halo: W, hw: 1.6 }) : runways(false, r * 0.82, { fill: col, halo: W, hw: 1.3 });
  return s + '</g>';
}
/** Airport data block, printed next to the symbol: name, code + load (+ trend), grouped passenger glyphs. */
function block(a, [x, y], anchor = 'start') {
  const n = a.wait.length;
  let s = '';
  const w1 = tw(a.city, a.jam ? 17 : 15, F, 700);
  const l2 = a.jam ? `Zator, sieć zamknie się za ${a.timer}` : `${a.code}  ${n} z ${a.cap}`;
  const end = anchor === 'end';
  const X = (w) => (end ? x - w : x);
  s += T(X(w1), y, a.city, { size: a.jam ? 17 : 15, fam: F, w: 700, italic: true, fill: a.jam ? MAG : a.hub ? BLK : MAG, ...H });
  let y2 = y + 17;
  const w2 = tw(l2, 13.5, F, 700);
  s += T(X(w2), y2, l2, { size: 13.5, fam: F, w: 700, fill: a.jam ? MAG : BLK, ...H });
  if (a.trend && !a.jam) s += `<path d="M${X(w2) + w2 + 6} ${y2 - 1}l4.5 -9 4.5 9z" fill="${MAG}" stroke="${W}" stroke-width="2.4" paint-order="stroke"/>`;
  if (a.jam) { y2 += 17; s += T(X(0), y2, `${a.code}  ${n} z ${a.cap}`, { size: 13.5, fam: F, w: 700, fill: MAG, ...H });
    s += `<path d="M${x + tw(`${a.code}  ${n} z ${a.cap}`, 13.5, F, 700) + 6} ${y2 - 1}l4.5 -9 4.5 9z" fill="${MAG}" stroke="${W}" stroke-width="2.4" paint-order="stroke"/>`; }
  if (n) {
    const txt = (gx, gy, t) => T(gx, gy, t, { size: 13, fam: F, w: 700, fill: BLK, ...H });
    const [, gw] = glyphRow(0, 0, a.wait, { size: 12, text: () => '', gap: 6 });
    s += glyphRow(X(gw), y2 + 15, a.wait, { size: 12, ink: W, inkW: 2.6, text: txt, gap: 6 })[0];
  }
  return s;
}
const PLACE = {
  p: { RIX: [168, 284], VCE: [16, 333], ATH: [14, 470], ANK: [210, 380], AMM: [128, 536], BGW: [306, 438] },
  l: { RIX: [378, 116], VCE: [266, 160, 'end'], ATH: [306, 272, 'end'], ANK: [410, 180], AMM: [440, 312], BGW: [496, 232], KHI: [656, 314] },
};
/** Routes as translucent ink bands with the route number set in the band (ref. plate 13). Proposal for src/render. */
function bands(key) {
  let s = '';
  ROUTES.forEach(([p, q], i) => {
    const A = pos(byCode(p), key), B = pos(byCode(q), key);
    s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${MAG}" stroke-opacity=".32" stroke-width="8" stroke-linecap="butt"/>`;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
    const rot = ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang;
    if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 70) s += `<g transform="translate(${mx} ${my}) rotate(${rot})">${T(0, -7, `L${i + 1}`, { size: 11.5, fam: F, w: 700, fill: MAG, anchor: 'middle', halo: W, hw: 2.4 })}</g>`;
  });
  return s;
}
function world(key) {
  let s = bands(key);
  for (const a of AIRPORTS) { const p = a[key]; if (p) s += marker(a, p, key); }
  for (const a of AIRPORTS) { const q = PLACE[key][a.code]; if (a[key] && q) s += block(a, q, q[2]); }
  return s;
}
/** Week track: a printed magenta course line with hour ticks; night stretches are dashed; "now" is a solid triangle. */
function track(x, y, w) {
  let s = '';
  const day = w / 3, hx = (d, h) => x + d * day + (h / 24) * day;
  for (let d = 0; d < 3; d++) {
    s += `<path d="M${hx(d, 0)} ${y}H${hx(d, 6)}M${hx(d, 20)} ${y}H${hx(d, 24)}" stroke="${W}" stroke-width="5"/><path d="M${hx(d, 0)} ${y}H${hx(d, 6)}M${hx(d, 20)} ${y}H${hx(d, 24)}" stroke="${MAG}" stroke-width="1.3" stroke-dasharray="2 3"/>`;
    s += `<path d="M${hx(d, 6)} ${y}H${hx(d, 20)}" stroke="${W}" stroke-width="6.5"/><path d="M${hx(d, 6)} ${y}H${hx(d, 20)}" stroke="${MAG}" stroke-width="3"/>`;
    for (let h = 0; h <= 24; h += 6) s += `<path d="M${hx(d, h)} ${y - (h % 24 ? 4 : 8)}V${y + (h % 24 ? 4 : 8)}" stroke="${W}" stroke-width="3.6"/><path d="M${hx(d, h)} ${y - (h % 24 ? 4 : 8)}V${y + (h % 24 ? 4 : 8)}" stroke="${MAG}" stroke-width="1.4"/>`;
    s += T(hx(d, 12), y + 24, `${d + 1}`, { size: 14, fam: S, w: d === 1 ? 700 : 400, fill: d === 1 ? BLK : GREY, anchor: 'middle', ...H });
  }
  const now = hx(1, 17.1);
  s += `<path d="M${now - 7} ${y - 17}h14l-7 12z" fill="${BLK}" stroke="${W}" stroke-width="2.6" paint-order="stroke"/>`;
  // crate at the end of the week: square with a cross, the chart symbol for "obstruction / box"
  s += `<g transform="translate(${x + w + 14} ${y})"><rect x="-7" y="-7" width="14" height="14" fill="none" stroke="${W}" stroke-width="4.6"/><rect x="-7" y="-7" width="14" height="14" fill="none" stroke="${BLK}" stroke-width="1.8"/><path d="M-7 -7L7 7M7 -7L-7 7" stroke="${BLK}" stroke-width="1.4"/></g>`;
  return s;
}
const DOCK = [
  { id: 'undo', cap: 'Cofnij' }, { id: 'turboprop', cap: 'Śmigłowy', n: 1, sel: true },
  { id: 'widebody', cap: 'Odrzutowy', off: 'za 1 dzień' }, { id: 'hub', cap: 'Hub', n: 1 },
  { id: 'satellite', cap: 'Satelita' }, { id: 'speed', cap: 'Tempo 1×', arg: 1 },
];
function dockItem(d, cx, cy) {
  const col = d.sel ? MAG : d.off ? GREY : BLK;
  let s = sym(d.id, cx - (d.n ? 7 : 0), cy - 10, 28, col, { halo: W, hw: 3.4, arg: d.arg });
  if (d.n) s += T(cx + 13, cy - 3, d.n, { size: 17, fam: S, w: 700, fill: col, ...H });
  s += T(cx, cy + 20, d.cap, { size: 12.5, fam: F, w: d.sel ? 700 : 500, fill: col, anchor: 'middle', ...H });
  if (d.sel) { const w = tw(d.cap, 12.5, F, 700); s += `<path d="M${cx - w / 2} ${cy + 27}h${w}" stroke="${W}" stroke-width="6"/><path d="M${cx - w / 2} ${cy + 27}h${w}" stroke="${MAG}" stroke-width="3"/>`; }
  if (d.off) s += T(cx, cy + 35, d.off, { size: 12.5, fam: F, w: 500, fill: GREY, anchor: 'middle', ...H });
  return s;
}
function clock(x, y) {
  return T(x, y, 'Tydzień 1, dzień 2 z 3', { size: 15, fam: F, w: 500, fill: BLK, ...H })
    + T(x - 2, y + 46, '17:06', { size: 46, fam: S, w: 700, fill: BLK, ...H })
    + T(x + 132, y + 44, '34 pasażerów', { size: 15, fam: F, w: 500, fill: BLK, ...H });
}
function pause(x, y) {
  return `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="${W}" stroke-width="5"/><circle cx="${x}" cy="${y}" r="21" fill="none" stroke="${MAG}" stroke-width="2"/>` + sym('pause', x, y, 22, MAG);
}
function edge(xr, y) {
  const s1 = 'KHI  8 z 12', s2 = '1 790 km';
  return `<path d="M${xr - 10} ${y - 9}l10 9 -10 9" fill="none" stroke="${W}" stroke-width="6"/><path d="M${xr - 10} ${y - 9}l10 9 -10 9" fill="none" stroke="${MAG}" stroke-width="2.6"/>`
    + T(xr - 18, y - 2, s1, { size: 14, fam: F, w: 700, fill: MAG, anchor: 'end', ...H }) + T(xr - 18, y + 15, s2, { size: 13, fam: S, fill: BLK, anchor: 'end', ...H });
}
export function render(view) {
  if (view === 'jam') return mount('jam', world('p'));
  if (view === 'game-p') {
    let hud = clock(20, 50) + track(22, 140, 300) + pause(368, 58) + edge(402, 512);
    DOCK.forEach((d, i) => { hud += dockItem(d, 6 + (400 / 6) * (i + 0.5), 858); });
    return mount('game-p', world('p'), hud);
  }
  if (view === 'game-l') {
    let hud = clock(48, 32) + track(50, 110, 240) + pause(858, 46);
    DOCK.forEach((d, i) => { hud += dockItem(d, 858, 100 + i * 52); });
    return mount('game-l', world('l'), hud.replace(/za 1 dzień/, ''));
  }
  let w = '';
  for (const [x, y, hub] of MENU_PADS) w += marker({ hub: !!hub, cap: hub ? 24 : 12, wait: [] }, [x, y], 'p');
  let hud = T(22, 150, 'Airway', { size: 66, fam: S, w: 700, fill: BLK, ...H });
  hud += T(26, 180, 'Sieć lotnicza na całym globie', { size: 16, fam: F, w: 500, fill: MAG, ...H });
  // menu as a printed route: waypoints on a magenta course line, thumb side
  const items = [['Lot bez końca', 'rekord 1 284'], ['Zadania', '12 z 30'], ['Trasa dnia', '5 listopada'], ['Dziennik', 'tydzień 7'], ['Ustawienia', '']];
  const x = 40, y0 = 590, step = 62;
  hud += `<path d="M${x} ${y0}V${y0 + step * 4}" stroke="${W}" stroke-width="6.5"/><path d="M${x} ${y0}V${y0 + step * 4}" stroke="${MAG}" stroke-width="3"/>`;
  items.forEach(([l, d], i) => {
    const y = y0 + i * step;
    hud += i === 0 ? `<path d="M${x} ${y - 11}l10 11 -10 11 -10 -11z" fill="${MAG}" stroke="${W}" stroke-width="3" paint-order="stroke"/>`
      : `<circle cx="${x}" cy="${y}" r="7" fill="${W}" stroke="${MAG}" stroke-width="2.6"/>`;
    hud += T(x + 24, y + 7, l, { size: 22, fam: F, w: 700, fill: i === 0 ? MAG : BLK, ...H, hw: 4 });
    if (d) hud += T(x + 24 + tw(l, 22, F, 700) + 10, y + 6, d, { size: 15, fam: S, fill: BLK, ...H, hw: 4 });
  });
  return mount('menu-p', w, hud);
}

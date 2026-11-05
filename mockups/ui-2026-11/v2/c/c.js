// Variant C "Róża" — built from the compass rose of an aeronautical chart. Every airport is a small rose whose ticks
// are its waiting places (taken = long tick), the airport name runs along the ring like a curved chart label, and the
// HUD is one rose in the thumb corner: a 24 h dial (night hatched) with the dock laid out on an arc around it.
// Ink: chalk white with a dark halo over the photo, near-black on the sky; vermilion only for a jam.
import { AIRPORTS, MENU_PADS, rad, runways, glyphRow, T, sym, mount } from '../common.js';
import { tw } from '../measure.js';

const INK0 = '#F5F2EA', DK0 = '#0C1418', RED = '#EA4A2A', DIM0 = 'rgba(245,242,234,.55)';
// ink flips on the sky (dark ink, light halo); see render('game-l')
let INK = INK0, DK = DK0, DIM = DIM0;
const A = 'Atkinson Hyperlegible Next', N = 'Alegreya';
let H = { halo: DK, hw: 3.2 };
function inks(sky) { INK = sky ? DK0 : INK0; DK = sky ? '#EEF3F2' : DK0; DIM = sky ? 'rgba(12,20,24,.5)' : DIM0; H = { halo: DK, hw: 3.2 }; }
let uid = 0;

function rose(r, cap, n, col, { major = 6, len = 6 } = {}) {
  let s = '';
  for (let i = 0; i < cap; i++) {
    const a = (-90 + (i * 360) / cap) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), taken = i < n;
    const l = taken ? len : len * 0.45, w = taken ? 2.2 : 1.3;
    const d = `M${(c * r).toFixed(2)} ${(sn * r).toFixed(2)}L${(c * (r + l)).toFixed(2)} ${(sn * (r + l)).toFixed(2)}`;
    s += `<path d="${d}" stroke="${DK}" stroke-width="${w + 2.2}"/><path d="${d}" stroke="${taken ? col : DIM}" stroke-width="${w}"/>`;
  }
  return s;
}
function marker(a, [x, y], key, { labels = true } = {}) {
  const r = rad(a, key) - (a.hub ? 1 : 0), n = a.wait.length, col = a.jam ? RED : INK;
  let s = `<g transform="translate(${x} ${y})">`;
  s += `<circle r="${r}" fill="none" stroke="${DK}" stroke-width="3.6"/><circle r="${r}" fill="none" stroke="${col}" stroke-width="1.3"/>`;
  if (a.hub) s += `<circle r="${r - 3.2}" fill="none" stroke="${col}" stroke-width=".9"/>`;
  s += rose(r + 1, a.cap, n, col, { len: a.hub ? 7 : 6 });
  s += runways(!!a.hub, a.hub ? r * 0.82 : r * 0.78, { fill: col, halo: DK, hw: 1.3 });
  if (a.jam) {
    // time left before the network closes: a heavy arc outside the rose, shrinking clockwise
    const R = r + 14, f = 42 / 60, e = (-90 + f * 360) * Math.PI / 180;
    s += `<path d="M0 ${-R}A${R} ${R} 0 1 1 ${(Math.cos(e) * R).toFixed(2)} ${(Math.sin(e) * R).toFixed(2)}" fill="none" stroke="${DK}" stroke-width="7"/>`;
    s += `<path d="M0 ${-R}A${R} ${R} 0 1 1 ${(Math.cos(e) * R).toFixed(2)} ${(Math.sin(e) * R).toFixed(2)}" fill="none" stroke="${RED}" stroke-width="4"/>`;
    s += `<path d="M0 ${-R - 6}V${-R + 6}" stroke="${RED}" stroke-width="2"/>`;
  }
  if (labels) {
    // curved name along the top of the ring
    const R = r + (a.jam ? 22 : a.hub ? 13 : 11), id = `arc${uid++}`;
    s += `<path id="${id}" d="M${-R * 1.4} 0A${R} ${R} 0 0 1 ${R * 1.4} 0" transform="scale(${1 / 1.4} 1)" fill="none"/>`;
    s += `<path id="${id}b" d="M${-R} 0A${R} ${R} 0 0 1 ${R} 0" fill="none"/>`;
    s += `<text font-family="${N}" font-weight="700" font-size="${a.jam ? 15 : 13.5}" fill="${col}" stroke="${DK}" stroke-width="3" paint-order="stroke" stroke-linejoin="round" letter-spacing=".3"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${a.city}</textPath></text>`;
  }
  return s + '</g>';
}
/** Side note: code, load and trend, then grouped glyphs; jam adds the countdown in words. */
function note(a, [x, y], anchor = 'start') {
  const n = a.wait.length, col = a.jam ? RED : INK, end = anchor === 'end';
  const l1 = `${a.code} ${n} z ${a.cap}`;
  const w1 = tw(l1, 14.5, A, 700);
  const X = (w) => (end ? x - w : x);
  let s = T(X(w1 + (a.trend ? 14 : 0)), y, l1, { size: 14.5, fam: A, w: 700, fill: col, ...H });
  if (a.trend) s += `<path d="M${X(w1 + 14) + w1 + 5} ${y - 1}l4.5 -9 4.5 9z" fill="${col}" stroke="${DK}" stroke-width="2.4" paint-order="stroke"/>`;
  let yy = y;
  if (a.jam) { yy += 18; const t = `Zator, sieć zamknie się za ${a.timer}`; s += T(X(tw(t, 14, A, 700)), yy, t, { size: 14, fam: A, w: 700, fill: RED, ...H }); }
  if (n) {
    const [, gw] = glyphRow(0, 0, a.wait, { size: 12, text: () => '', gap: 6 });
    s += glyphRow(X(gw), yy + 16, a.wait, { size: 12, ink: DK, inkW: 2.4, text: (gx, gy, t) => T(gx, gy, t, { size: 13.5, fam: A, w: 700, fill: INK, ...H }), gap: 6 })[0];
  }
  return s;
}
const PLACE = {
  p: { RIX: [168, 295], VCE: [14, 400], ATH: [14, 466], ANK: [236, 410], AMM: [128, 544], BGW: [312, 478] },
  l: { RIX: [378, 134], VCE: [262, 188, 'end'], ATH: [306, 268, 'end'], ANK: [428, 216], AMM: [404, 320, 'end'], BGW: [498, 268], KHI: [654, 350] },
};
function world(key) {
  let s = '';
  for (const a of AIRPORTS) { const p = a[key]; if (p) s += marker(a, p, key); }
  for (const a of AIRPORTS) { const q = PLACE[key][a.code]; if (a[key] && q) s += note(a, q, q[2]); }
  return s;
}
/** The HUD rose: a 24 h dial with night hatched, a heading-bug for now, day pips, time in the middle. */
function dial(cx, cy, R, compact = false) {
  let s = `<g transform="translate(${cx} ${cy})">`;
  // night sector 20:00-06:00 as hatch between R-10 and R
  for (let h = 20; h < 30; h += 0.5) {
    const a = (-90 + ((h % 24) / 24) * 360) * Math.PI / 180;
    s += `<path d="M${Math.cos(a) * (R - 10)} ${Math.sin(a) * (R - 10)}L${Math.cos(a + 0.08) * R} ${Math.sin(a + 0.08) * R}" stroke="${DK}" stroke-width="3"/><path d="M${Math.cos(a) * (R - 10)} ${Math.sin(a) * (R - 10)}L${Math.cos(a + 0.08) * R} ${Math.sin(a + 0.08) * R}" stroke="${DIM}" stroke-width="1.1"/>`;
  }
  s += `<circle r="${R}" fill="none" stroke="${DK}" stroke-width="4"/><circle r="${R}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  for (let h = 0; h < 24; h++) {
    const a = (-90 + (h / 24) * 360) * Math.PI / 180, l = h % 6 ? 5 : 10, c = Math.cos(a), sn = Math.sin(a);
    const d = `M${c * R} ${sn * R}L${c * (R - l)} ${sn * (R - l)}`;
    s += `<path d="${d}" stroke="${DK}" stroke-width="${h % 6 ? 3.2 : 4.4}"/><path d="${d}" stroke="${INK}" stroke-width="${h % 6 ? 1.2 : 2.2}"/>`;
  }
  for (const [h, t] of compact ? [] : [[0, '0'], [6, '6'], [12, '12'], [18, '18']]) {
    const a = (-90 + (h / 24) * 360) * Math.PI / 180;
    s += T(Math.cos(a) * (R - 19), Math.sin(a) * (R - 19) + 4.5, t, { size: 12, fam: A, w: 700, fill: INK, anchor: 'middle', ...H, hw: 2.6 });
  }
  // heading bug for "now"
  const a = (-90 + (17.1 / 24) * 360);
  s += `<g transform="rotate(${a + 90})"><path d="M-7 ${-R - 9}h14l-7 9z" fill="${INK}" stroke="${DK}" stroke-width="2.4" paint-order="stroke"/></g>`;
  s += T(0, compact ? 5 : 6, '17:06', { size: compact ? 16 : 23, fam: A, w: 700, fill: INK, anchor: 'middle', ...H });
  if (!compact) s += T(0, 24, 'dzień 2 z 3', { size: 12.5, fam: A, w: 400, fill: INK, anchor: 'middle', ...H, hw: 2.6 });
  return s + '</g>';
}
const DOCK = [
  { id: 'undo', cap: 'Cofnij' }, { id: 'turboprop', cap: 'Śmigłowy', n: 1, sel: true },
  { id: 'widebody', cap: 'za 1 dzień', off: true }, { id: 'hub', cap: 'Hub', n: 1 },
  { id: 'satellite', cap: 'Satelita' }, { id: 'speed', cap: 'Tempo 1×', arg: 1 },
];
function dockArc(cx, cy, Rr, a0, a1) {
  let s = '';
  const step = (a1 - a0) / (DOCK.length - 1);
  const p = (deg) => [cx + Math.cos(deg * Math.PI / 180) * Rr, cy + Math.sin(deg * Math.PI / 180) * Rr];
  const [sx, sy] = p(a0 - 6), [ex, ey] = p(a1 + 6);
  s += `<path d="M${sx} ${sy}A${Rr} ${Rr} 0 0 1 ${ex} ${ey}" fill="none" stroke="${DK}" stroke-width="3.4" opacity=".7"/><path d="M${sx} ${sy}A${Rr} ${Rr} 0 0 1 ${ex} ${ey}" fill="none" stroke="${DIM}" stroke-width="1.2" stroke-dasharray="2 4"/>`;
  DOCK.forEach((d, i) => {
    const [x, y] = p(a0 + step * i), col = d.off ? DIM : INK;
    if (d.sel) s += `<circle cx="${x}" cy="${y - 2}" r="21" fill="none" stroke="${DK}" stroke-width="5"/><circle cx="${x}" cy="${y - 2}" r="21" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
    else s += `<circle cx="${x}" cy="${y - 2}" r="3" fill="${DK}"/>`;
    s += sym(d.id, x - (d.n ? 5 : 0), y - 4, 24, col, { halo: DK, hw: 3, arg: d.arg });
    if (d.n) s += T(x + 13, y + 3, d.n, { size: 14, fam: A, w: 700, fill: INK, ...H, hw: 2.6 });
    // caption on the outer side of the arc: left of the symbol on the steep part, above it on the flat part
    const deg = a0 + step * i, c = Math.cos(deg * Math.PI / 180);
    const [tx, ty, an] = c < -0.45 ? [x - 28, y + 1, 'end'] : [x, y - 30, 'middle'];
    s += T(tx, ty, d.cap, { size: 12.5, fam: A, w: d.sel ? 700 : 400, fill: col, anchor: an, ...H, hw: 2.8 });
  });
  return s;
}
function corner(x, y, day = '') {
  return T(x, y, 'Tydzień 1' + day, { size: 19, fam: N, w: 700, fill: DK })
    + T(x, y + 21, '34 pasażerów', { size: 15, fam: A, w: 400, fill: DK });
}
function pause(x, y, onSky = true) {
  const k = onSky ? DK : INK;
  return `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="${k}" stroke-width="2"/>` + sym('pause', x, y, 20, k);
}
export function render(view) {
  if (view === 'jam') return mount('jam', world('p'));
  if (view === 'game-p') {
    let hud = corner(20, 52) + pause(370, 50);
    hud += `<g>${T(402, 520, 'KHI 8 z 12', { size: 14.5, fam: A, w: 700, fill: INK, anchor: 'end', ...H })}${T(402, 537, '1 790 km', { size: 12.5, fam: A, fill: INK, anchor: 'end', ...H, hw: 2.6 })}<path d="M394 494l10 9-10 9" fill="none" stroke="${DK}" stroke-width="5"/><path d="M394 494l10 9-10 9" fill="none" stroke="${INK}" stroke-width="2.2"/></g>`;
    hud += dial(336, 830, 56) + dockArc(336, 830, 168, 176, 274);
    return mount('game-p', world('p'), hud);
  }
  if (view === 'game-l') {
    // landscape: the dock arc is a slice of a larger rose along the right (thumb) edge, the dial sits under it;
    // pause moves to the free sky corner on the left
    let hud = corner(50, 46, ', dzień 2 z 3') + pause(300, 44);
    inks(true); hud += dial(852, 352, 30, true) + dockArc(1090, 165, 260, 151, 209); inks(false);
    return mount('game-l', world('l'), hud);
  }
  let w = '';
  for (const [x, y, hub] of MENU_PADS) w += marker({ hub: !!hub, cap: hub ? 24 : 12, wait: hub ? Array(9).fill('EUN') : ['EUN', 'EUN'], city: '' }, [x, y], 'p', { labels: false });
  let hud = T(22, 150, 'Airway', { size: 60, fam: N, w: 700, fill: DK });
  hud += T(26, 178, 'Sieć lotnicza na całym globie', { size: 16, fam: A, w: 400, fill: DK });
  // the menu rose: entries sit on its western arc, within thumb reach
  const cx = 316, cy = 780, R = 70;
  let s = `<g transform="translate(${cx} ${cy})"><circle r="${R}" fill="none" stroke="${DK}" stroke-width="4"/><circle r="${R}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, l = i % 18 ? (i % 2 ? 3 : 6) : 12, c = Math.cos(a), sn = Math.sin(a);
    s += `<path d="M${c * R} ${sn * R}L${c * (R - l)} ${sn * (R - l)}" stroke="${INK}" stroke-width="${i % 18 ? 1 : 2}"/>`; }
  s += `<path d="M0 -50L8 0 0 50 -8 0Z" fill="${INK}" stroke="${DK}" stroke-width="2"/><path d="M-50 0L0 -8 50 0 0 8Z" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  s += T(0, -R - 10, 'N', { size: 14, fam: N, w: 700, fill: INK, anchor: 'middle', ...H }) + '</g>';
  hud += s;
  const items = [['Lot bez końca', 'rekord 1 284'], ['Zadania', '12 z 30'], ['Trasa dnia', '5 listopada'], ['Dziennik', 'tydzień 7'], ['Ustawienia', '']];
  items.forEach(([l, d], i) => {
    const ang = (152 + i * 26) * Math.PI / 180, Rr = 150;
    const x = cx + Math.cos(ang) * Rr, y = cy + Math.sin(ang) * Rr;
    const xi = cx + Math.cos(ang) * (R + 4), yi = cy + Math.sin(ang) * (R + 4);
    hud += `<path d="M${xi} ${yi}L${x + 8} ${y}" stroke="${DK}" stroke-width="3.4"/><path d="M${xi} ${yi}L${x + 8} ${y}" stroke="${INK}" stroke-width="1.2"/>`;
    hud += i === 0 ? `<path d="M${x + 8} ${y - 8}l8 8-8 8-8-8z" fill="${RED}" stroke="${DK}" stroke-width="2"/>` : `<circle cx="${x + 8}" cy="${y}" r="4.5" fill="${INK}" stroke="${DK}" stroke-width="2"/>`;
    hud += T(x - 6, y + 2, l, { size: 21, fam: N, w: 700, fill: INK, anchor: 'end', ...H, hw: 3.6 });
    if (d) hud += T(x - 6, y + 20, d, { size: 13.5, fam: A, fill: INK, anchor: 'end', ...H, hw: 3 });
  });
  return mount('menu-p', w, hud);
}

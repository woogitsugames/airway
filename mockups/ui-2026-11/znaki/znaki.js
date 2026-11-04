// Direction 3 "Znaki" — the UI speaks the airfield sign code: black panel + yellow legend = where you are
// (location), yellow panel + black legend = where it goes (direction / destination), red panel + white legend =
// stop (mandatory: a jam). Waiting passengers are written as the airport's destination sign.
import { AIRPORTS, HUD, groups, GLYPH, REGION } from '../common/data.js';
import { ICON } from '../common/icons.js';

const YEL = '#F7C600';
const BLK = '#121212';
const RED = '#C8152B';
const WHT = '#FFFFFF';
const ASPH = '#2A2C2E';

const T = (x, y, txt, { size = 16, fam = 'Overpass', w = 800, fill = YEL, anchor = 'start', ls = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${txt}</text>`;
const M = (x, y, txt, o = {}) => T(x, y, txt, { fam: 'Overpass Mono', w: 700, ...o });
// On a sign the destination glyphs are printed in the legend colour: shape alone carries the region (D-08).
const G = (x, y, region, s = 13, ink = BLK) => {
  const r = REGION[region];
  return `<g transform="translate(${x} ${y}) scale(${s / 14})"><path d="${GLYPH[r.g]}" fill="${ink}"/></g>`;
};
const I = (name, x, y, s, color) => `<g transform="translate(${x} ${y}) scale(${s / 40})" color="${color}" fill="${color}">${ICON[name]}</g>`;
/** Arrow as drawn on airfield signs: thick shaft, wide head. */
function arrow(x, y, dir, s = 1, color = BLK) {
  const rot = { right: 0, down: 90, left: 180, up: -90, upright: -45, downright: 45 }[dir];
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-8 -2.4 H2 V-7 L9 0 L2 7 V2.4 H-8Z" fill="${color}"/></g>`;
}
/** Sign panel. kind: loc (black, yellow legend + border), dir (yellow, black legend), stop (red, white legend). */
function panel(x, y, w, h, kind) {
  const bg = kind === 'loc' ? BLK : kind === 'dir' ? YEL : RED;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${bg}"/>`;
  if (kind === 'loc') s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="1.5" fill="none" stroke="${YEL}" stroke-width="1.6"/>`;
  if (kind === 'stop') s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="1.5" fill="none" stroke="${WHT}" stroke-width="1.2"/>`;
  return s;
}
/** Frame around a sign array: a thin dark housing, as the real ones have. */
const housing = (x, y, w, h) => `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="4" fill="${BLK}"/>`;
/** Hold-short marking: two solid and two dashed yellow lines. */
function holdLine(x, y, w, vertical = false) {
  if (vertical) return `<path d="M${x} ${y} V${y + w} M${x + 5} ${y} V${y + w}" stroke="${YEL}" stroke-width="2.4"/><path d="M${x + 12} ${y} V${y + w} M${x + 17} ${y} V${y + w}" stroke="${YEL}" stroke-width="2.4" stroke-dasharray="9 6"/>`;
  return `<path d="M${x} ${y} H${x + w} M${x} ${y + 5} H${x + w}" stroke="${YEL}" stroke-width="2.4"/><path d="M${x} ${y + 12} H${x + w} M${x} ${y + 17} H${x + w}" stroke="${YEL}" stroke-width="2.4" stroke-dasharray="9 6"/>`;
}
function trendMark(x, y, color = BLK) {
  return `<path d="M${x - 5} ${y + 1} L${x} ${y - 4} L${x + 5} ${y + 1} M${x - 5} ${y + 6} L${x} ${y + 1} L${x + 5} ${y + 6}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="square"/>`;
}

/** Airport sign: location panel (code) + destination panel (waiting passengers by region). */
function sign(a, [px, py], [x, y], { flip = false } = {}) {
  const gs = groups(a.wait);
  const h = 30;
  const locW = a.hub ? 58 : 50;
  const destW = gs.length ? gs.reduce((w, g) => w + 19 + (g.n > 1 ? String(g.n).length * 8.4 + 3 : 0), 6) + (a.trend ? 16 : 0) : 0;
  const w = locW + (destW ? destW + 2 : 0);
  const bx = flip ? x - w : x;
  // post from the pad to the sign (a short frangible mount)
  const cx = Math.max(bx + 10, Math.min(px, bx + w - 10)); const cy = py < y ? y : y + h;
  let s = `<path d="M${px} ${py + (py < y ? a.r - 4 : -a.r + 4)} L${cx} ${cy}" stroke="${BLK}" stroke-width="4"/><path d="M${px} ${py + (py < y ? a.r - 4 : -a.r + 4)} L${cx} ${cy}" stroke="${a.jam ? RED : YEL}" stroke-width="1.6"/>`;
  s += housing(bx, y, w, h);
  s += panel(bx, y, locW, h, a.jam ? 'stop' : 'loc');
  s += T(bx + locW / 2, y + 21, a.code, { size: 17, anchor: 'middle', fill: a.jam ? WHT : YEL, ls: .3 });
  if (a.hub) s += `<path d="M${bx + 10} ${y + 25} H${bx + locW - 10}" stroke="${a.jam ? WHT : YEL}" stroke-width="1.6"/>`;
  if (destW) {
    const dx = bx + locW + 2;
    s += panel(dx, y, destW, h, 'dir');
    let gx = dx + 13;
    for (const g of gs) { s += G(gx, y + h / 2, g.id, 13); if (g.n > 1) s += M(gx + 9, y + 20.5, g.n, { size: 13, fill: BLK }); gx += 19 + (g.n > 1 ? String(g.n).length * 8.4 + 3 : 0); }
    if (a.trend) s += trendMark(gx + 1, y + 12);
  }
  return s;
}
/** Jam: the location panel turns into a stop sign, a countdown panel and a hold-short bar under it. */
function jamSign(a, p, [x, y]) {
  let s = sign(a, p, [x, y]);
  s += housing(x, y + 34, 132, 26);
  s += panel(x, y + 34, 132, 26, 'stop');
  s += T(x + 10, y + 52, 'ZATOR', { size: 13, fill: WHT, ls: 1 });
  s += T(x + 122, y + 52.5, a.timer, { size: 15, fill: WHT, anchor: 'end' });
  return s;
}
function edgeSign(a, x, y) {
  const w = 104, h = 30;
  let s = housing(x - w, y, w, h) + panel(x - w, y, w, h, 'dir');
  s += T(x - w + 10, y + 21, a.code, { size: 17, fill: BLK });
  s += M(x - w + 50, y + 20.5, `${a.wait.length}`, { size: 13, fill: BLK });
  s += trendMark(x - w + 70, y + 12);
  s += arrow(x - 13, y + 15, 'right', .95);
  return s;
}

function topBar(W, safe, { landscape = false, x0 = 16, maxW } = {}) {
  const y = landscape ? 12 : safe + 10; const h = 52;
  const cells = [['TYDZ', HUD.week, 54], ['DZIEŃ', `${HUD.day}/${HUD.days}`, 64], ['GODZ', HUD.time, 92], ['PAX', HUD.pax, 58]];
  const w = cells.reduce((a, c) => a + c[2], 0) + (cells.length - 1) * 2;
  let s = housing(x0, y, w, h);
  let cx = x0;
  for (const [lab, val, cw] of cells) {
    s += panel(cx, y, cw, h, 'loc');
    s += T(cx + 10, y + 18, lab, { size: 10, ls: 1.2, w: 800 });
    s += M(cx + 10, y + 42, val, { size: 22, fill: YEL });
    cx += cw + 2;
  }
  // day squares as a sign strip: done / today / ahead
  // pause: a mandatory-style square? No: yellow action sign.
  const px = landscape ? x0 + (maxW || W) - 56 : W - 16 - 52;
  s += housing(px, y, 52, h) + panel(px, y, 52, h, 'dir') + I('pause', px + 26, y + 26, 26, BLK);
  return s;
}
const DOCK = [
  { id: 'undo', kind: 'dir', label: 'COFNIJ' },
  { id: 'turboprop', kind: 'loc', value: '1', sel: true },
  { id: 'widebody', kind: 'off', value: '1D' },
  { id: 'hub', kind: 'loc', value: '1' },
  { id: 'satellite', kind: 'dir' },
  { id: 'speed', kind: 'dir', value: '1×' },
];
function dockSign(d, x, y, w, h, side = false) {
  let s = housing(x, y, w, h);
  if (d.kind === 'off') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${ASPH}"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="1.5" fill="none" stroke="#6B6E70" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    s += I(d.id, x + w / 2, y + h / 2 - 6, 22, '#8C8F91') + M(x + w / 2, y + h - 9, '1 DZIEŃ', { size: 10, fill: '#A9ACAE', anchor: 'middle' });
    return s;
  }
  s += panel(x, y, w, h, d.kind);
  const c = d.kind === 'loc' ? YEL : BLK;
  if (d.value) { s += I(d.id, x + w / 2 - (d.id === 'speed' ? 10 : 9), y + h / 2, 24, c) + M(x + w / 2 + (d.id === 'speed' ? 13 : 13), y + h / 2 + 6.5, d.value, { size: 17, fill: c, anchor: 'middle' }); }
  else s += I(d.id, x + w / 2, y + h / 2, 26, c);
  if (d.sel) s += `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="5" fill="none" stroke="${YEL}" stroke-width="2.5"/>` + (side ? arrow(x - 16, y + h / 2, 'left', .8, YEL) : arrow(x + w / 2, y - 14, 'up', .8, YEL));
  return s;
}
function dock(W, H, safe) {
  const h = 56; const y0 = H - safe - h - 10;
  let s = `<rect x="0" y="${y0 - 34}" width="${W}" height="${H - y0 + 34}" fill="${ASPH}"/>`;
  s += holdLine(0, y0 - 30, W);
  const gap = 8; const w = (W - 32 - gap * 5) / 6;
  DOCK.forEach((d, i) => { s += dockSign(d, 16 + i * (w + gap), y0, w, h); });
  return s;
}
function sideDock(W, H) {
  const w = 62; const x0 = W - 24 - w;
  let s = `<rect x="${x0 - 34}" y="0" width="${W - x0 + 34}" height="${H}" fill="${ASPH}"/>`;
  s += `<g transform="translate(${x0 - 30} 0)">${holdLine(0, 0, H, true).replace(/M(\d+\.?\d*) 0 V/g, 'M$1 0 V')}</g>`;
  const gap = 8; const h = (H - 24 - gap * 5) / 6;
  DOCK.forEach((d, i) => { s += dockSign(d, x0, 12 + i * (h + gap), w, h, true); });
  return s;
}

function menu(W, H) {
  let s = '';
  const y0 = 500;
  s += `<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="${ASPH}"/>`;
  s += holdLine(0, y0 + 4, W);
  // title: a big location sign
  let y = y0 + 36;
  s += housing(16, y, W - 32, 74) + panel(16, y, W - 32, 74, 'loc');
  s += T(34, y + 52, 'AIRWAY', { size: 44, ls: 2 });
  s += `<path d="M${W - 150} ${y + 16} V${y + 58}" stroke="${YEL}" stroke-width="1.6"/>`;
  s += T(W - 136, y + 33, 'TERMINAL 1', { size: 12, ls: 1.3 }) + T(W - 136, y + 52, 'AIRWAY.GAMES', { size: 12, ls: 1.3 });
  y += 92;
  const rows = [
    { t: 'LOT BEZ KOŃCA', sub: 'brak rekordu', arr: 'left', main: true },
    { t: 'ZADANIA', sub: '0 z 35', arr: 'upright' },
    { t: 'DZIŚ 04.11', sub: 'ten sam świat', arr: 'right' },
  ];
  for (const r of rows) {
    const h = r.main ? 66 : 56;
    s += housing(16, y, W - 32, h) + panel(16, y, W - 32, h, 'dir');
    const left = r.arr === 'left';
    s += arrow(left ? 44 : W - 46, y + h / 2, r.arr, r.main ? 1.9 : 1.6);
    const tx = left ? 76 : 32;
    s += T(tx, y + h / 2 + (r.main ? 1 : 0), r.t, { size: r.main ? 26 : 22, fill: BLK, ls: .3 });
    s += T(tx, y + h / 2 + 20, r.sub, { size: 13, w: 400, fill: BLK });
    y += h + 10;
  }
  const half = (W - 32 - 10) / 2;
  s += housing(16, y, half, 52) + panel(16, y, half, 52, 'loc') + T(30, y + 33, 'USTAWIENIA', { size: 16, ls: .8 });
  s += housing(26 + half, y, half, 52) + panel(26 + half, y, half, 52, 'loc') + T(40 + half, y + 33, 'DZIENNIK', { size: 16, ls: .8 });
  return s;
}

export function render(kind) {
  const W = innerWidth, H = innerHeight;
  const A = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
  let s = '';
  if (kind === 'game-p') {
    s += sign(A.RIX, A.RIX.p, [124, 232]);
    s += sign(A.VCE, A.VCE.p, [14, 304]);
    s += sign(A.ANK, A.ANK.p, [178, 352]);
    s += sign(A.BGW, A.BGW.p, [260, 412]);
    s += sign(A.ATH, A.ATH.p, [8, 488]);
    s += jamSign(A.AMM, A.AMM.p, [112, 552]);
    s += edgeSign(A.KHI, W - 4, 500);
    s += topBar(W, 24);
    s += dock(W, H, 16);
  } else if (kind === 'game-l') {
    s += sign(A.RIX, A.RIX.l, [338, 74]);
    s += sign(A.VCE, A.VCE.l, [150, 128]);
    s += sign(A.ANK, A.ANK.l, [420, 160]);
    s += sign(A.BGW, A.BGW.l, [500, 210]);
    s += sign(A.ATH, A.ATH.l, [150, 262]);
    s += jamSign(A.AMM, A.AMM.l, [360, 318]);
    s += sign(A.KHI, A.KHI.l, [560, 262]);
    s += topBar(W, 0, { landscape: true, x0: 40, maxW: W - 40 - 140 });
    s += sideDock(W, H);
  } else if (kind === 'menu-p') s += menu(W, H);
  document.getElementById('ui').innerHTML = `<svg class="abs" style="left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// Direction 2 "Kokpit" — the UI is a flight deck: matte panels with engraved labels, black instruments,
// annunciator colours with a fixed meaning (white normal, amber caution, red warning, cyan selected).
// Every airport carries a small fill gauge; the fill trend is the gauge's trend vector.
import { AIRPORTS, HUD, groups, GLYPH, REGION } from '../common/data.js';
import { ICON } from '../common/icons.js';

const PANEL = '#4B565D'; // instrument-panel grey
const PANEL_HI = '#6C7880';
const PANEL_LO = '#2B3337';
const FACE = '#0C0E0F'; // instrument face
const WHITE = '#F3F4F1';
const ENGR = '#E9ECE8'; // engraved label
const AMBER = '#F0A202';
const RED = '#E5341D';
const GREEN = '#36B868';
const CYAN = '#3EC3E0';

const T = (x, y, txt, { size = 12, fam = 'Archivo Narrow', w = 700, fill = ENGR, anchor = 'start', ls = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${txt}</text>`;
const M = (x, y, txt, o = {}) => T(x, y, txt, { fam: 'Atkinson Hyperlegible Mono', ...o });
const G = (x, y, region, s = 12) => {
  const r = REGION[region];
  return `<g transform="translate(${x} ${y}) scale(${s / 14})"><path d="${GLYPH[r.g]}" fill="${r.c}" stroke="${region === 'AFR' ? '#C9CFCB' : FACE}" stroke-width="${region === 'AFR' ? 1.2 : 1}" paint-order="stroke" stroke-linejoin="round"/></g>`;
};
const I = (name, x, y, s, color = WHITE) => `<g transform="translate(${x} ${y}) scale(${s / 40})" color="${color}" fill="${color}">${ICON[name]}</g>`;
const screw = (x, y) => `<g transform="translate(${x} ${y})"><circle r="3.2" fill="${PANEL_LO}"/><circle r="2.4" fill="${PANEL_HI}"/><path d="M-1.6 -1.1 L1.6 1.1" stroke="${PANEL_LO}" stroke-width=".9"/></g>`;

/** Panel slab: flat grey with a light top edge and a dark bottom edge (machined, no drop shadow). */
function panel(x, y, w, h, { screws = true } = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PANEL}"/>`;
  s += `<path d="M${x} ${y + .5} H${x + w}" stroke="${PANEL_HI}" stroke-width="1"/><path d="M${x} ${y + h - .5} H${x + w}" stroke="${PANEL_LO}" stroke-width="1"/>`;
  if (screws) s += screw(x + 8, y + 8) + screw(x + w - 8, y + 8) + screw(x + 8, y + h - 8) + screw(x + w - 8, y + h - 8);
  return s;
}
/** A recessed black readout window. */
const win = (x, y, w, h, stroke = PANEL_LO) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${FACE}" stroke="${stroke}" stroke-width="1.5"/>`;

const pt = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5; // gauge from 7:30 clockwise to 4:30
function arc(cx, cy, r, f0, f1, color, w) {
  const a = A0 + f0 * SPAN, b = A0 + f1 * SPAN;
  const [x1, y1] = pt(cx, cy, r, a), [x2, y2] = pt(cx, cy, r, b);
  return `<path d="M${x1} ${y1} A${r} ${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
}
/** Fill gauge: band green/amber/red, needle = waiting/capacity, trend vector = last game hour. */
function gauge(cx, cy, r, fill, { trend = null, warn = false } = {}) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="${warn ? RED : PANEL}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${FACE}"/>`;
  s += arc(cx, cy, r - 3, 0, .6, '#5E6A70', 2.2) + arc(cx, cy, r - 3, .6, .85, AMBER, 2.2) + arc(cx, cy, r - 3, .85, 1, RED, 2.2);
  for (let i = 0; i <= 4; i++) { const a = A0 + i / 4 * SPAN; const [x1, y1] = pt(cx, cy, r - 1, a), [x2, y2] = pt(cx, cy, r - 6.5, a); s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${WHITE}" stroke-width="1"/>`; }
  const a = A0 + Math.min(1, fill) * SPAN;
  if (trend) {
    const t = Math.min(1, fill + .22);
    s += arc(cx, cy, r - 9, fill, t, WHITE, 1.6);
    const b = A0 + t * SPAN; const [hx, hy] = pt(cx, cy, r - 9, b);
    const tx = -Math.sin(b), ty = Math.cos(b); // tangent (clockwise)
    s += `<path d="M${hx + tx * 3.6} ${hy + ty * 3.6} L${hx - ty * 2.8} ${hy + tx * 2.8} L${hx + ty * 2.8} ${hy - tx * 2.8}Z" fill="${WHITE}"/>`;
  }
  const [nx, ny] = pt(cx, cy, r - 3, a);
  s += `<path d="M${cx} ${cy} L${nx} ${ny}" stroke="${warn ? RED : WHITE}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="2.6" fill="${PANEL_HI}"/>`;
  return s;
}

/** Airport instrument: stem from the pad, gauge, code plate and passenger readout. */
function instrument(a, [px, py], [x, y], { flip = false } = {}) {
  const n = a.wait.length; const fill = n / a.cap;
  const gs = groups(a.wait);
  const R = a.hub ? 17 : 15;
  const gw = gs.reduce((w, g) => w + 16 + (g.n > 1 ? String(g.n).length * 6.6 : 0), 0);
  const bodyW = Math.max(50, gw + 12);
  const H = 2 * R + 6;
  const w = H + bodyW + 6;
  const bx = flip ? x - w : x;
  // stem
  const cx = flip ? bx + w - H / 2 : bx + H / 2, cy = y + H / 2;
  const ang = Math.atan2(cy - py, cx - px);
  const [sx, sy] = pt(px, py, a.r + 2, ang);
  let s = `<path d="M${sx} ${sy} L${cx} ${cy}" stroke="${FACE}" stroke-width="4"/><path d="M${sx} ${sy} L${cx} ${cy}" stroke="${a.jam ? RED : PANEL_HI}" stroke-width="2"/>`;
  s += `<circle cx="${sx}" cy="${sy}" r="3" fill="${a.jam ? RED : PANEL_HI}" stroke="${FACE}" stroke-width="1.5"/>`;
  // body plate
  s += `<rect x="${bx}" y="${y}" width="${w}" height="${H}" rx="${H / 2}" fill="${a.jam ? RED : PANEL}" stroke="${FACE}" stroke-width="1.5"/>`;
  s += gauge(cx, cy, R, fill, { trend: a.trend, warn: a.jam });
  const tx = flip ? bx + 8 : bx + H + 2;
  const codeFill = a.jam ? FACE : ENGR;
  s += T(tx, y + 15, a.code, { size: a.hub ? 15 : 14, fill: codeFill, ls: .8 });
  if (a.hub) s += `<rect x="${tx + 37}" y="${y + 5}" width="17" height="11" rx="1.5" fill="none" stroke="${codeFill}" stroke-width="1.1"/>` + T(tx + 45.5, y + 14, 'H', { size: 9, fill: codeFill, anchor: 'middle' });
  // readout window
  const ry = y + 20, rh = H - 25;
  s += win(tx - 2, ry, bodyW, rh, a.jam ? '#8E1E10' : PANEL_LO);
  if (a.jam) {
    s += M(tx + 3, ry + rh - 3.5, `ZATOR ${a.timer}`, { size: 10.5, fill: RED });
  } else if (n) {
    let gx = tx + 6;
    for (const g of gs) { s += G(gx, ry + rh / 2, g.id, 10.5); if (g.n > 1) s += M(gx + 7, ry + rh / 2 + 3.6, g.n, { size: 10, fill: WHITE }); gx += 16 + (g.n > 1 ? String(g.n).length * 6.6 : 0); }
  } else s += M(tx + 3, ry + rh - 3.5, '—', { size: 10, fill: '#7F8B90' });
  return s;
}
/** Jam: a larger red instrument with the passenger readout as a second row. */
function jamInstrument(a, [px, py], [x, y]) {
  const gs = groups(a.wait);
  const gw = gs.reduce((w, g) => w + 16 + (g.n > 1 ? String(g.n).length * 6.6 : 0), 0);
  const w = 2 * 17 + 6 + Math.max(50, gw + 12) + 6, y2 = y + 36;
  let s = `<path d="M${x + 20} ${y2 - 4} H${x + w - 20} V${y2 + 30} a6 6 0 0 1 -6 6 H${x + 26} a6 6 0 0 1 -6 -6Z" fill="${RED}" stroke="${FACE}" stroke-width="1.5"/>`;
  s += instrument(a, [px, py], [x, y]);
  s += win(x + 26, y2 + 4, w - 52, 24, '#8E1E10');
  let gx = x + 38;
  for (const g of gs) { s += G(gx, y2 + 16, g.id, 11); s += M(gx + 8, y2 + 20, g.n, { size: 10.5, fill: WHITE }); gx += 17 + String(g.n).length * 7; }
  return s;
}
/** Off-screen airport: a bearing pointer on the edge. */
function bearing(a, x, y) {
  let s = `<path d="M${x} ${y} l-14 -18 h-58 a18 18 0 0 0 0 36 h58 z" fill="${PANEL}" stroke="${FACE}" stroke-width="1.5"/>`;
  s += gauge(x - 70, y, 13, a.wait.length / a.cap, { trend: 'up' });
  s += T(x - 52, y - 2, a.code, { size: 14, ls: .8 });
  s += M(x - 52, y + 12, `${a.wait.length}/${a.cap}`, { size: 10, fill: WHITE });
  return s;
}

function topPanel(W, safe, { landscape = false, x0 = 0, w = W } = {}) {
  const h = landscape ? 62 : safe + 70;
  let s = panel(x0, 0, w, h, { screws: !landscape });
  const y = landscape ? 8 : safe + 8;
  const cells = [['TYDZ', HUD.week, 40], ['DZIEŃ', `${HUD.day}/${HUD.days}`, 46], ['CZAS', HUD.time, 72], ['PASAŻ.', HUD.pax, 44]];
  let cx = x0 + (landscape ? 40 : 16);
  for (const [lab, val, cw] of cells) {
    s += T(cx + 1, y + 10, lab, { size: 10, ls: 1.2 });
    s += win(cx, y + 15, cw, 30);
    s += M(cx + cw / 2, y + 37, val, { size: 18, fill: WHITE, anchor: 'middle' });
    cx += cw + 8;
  }
  // master warning: lit while a hub jams; tap = look at it
  const mx = landscape ? x0 + w - 64 - 112 : W - 16 - 48 - 8 - 76, mw = landscape ? 104 : 76;
  s += `<rect x="${mx}" y="${y + 3}" width="${mw}" height="44" rx="3" fill="${FACE}"/><rect x="${mx + 3}" y="${y + 6}" width="${mw - 6}" height="38" rx="2" fill="${RED}"/>`;
  s += T(mx + mw / 2, y + 22, 'ZATOR', { size: 12.5, fill: FACE, anchor: 'middle', ls: 1.5 });
  s += M(mx + mw / 2, y + 38, `AMM ${HUD.jam || '42 s'}`, { size: 12, fill: FACE, anchor: 'middle' });
  // pause pushbutton
  const px = landscape ? x0 + w - 16 - 48 : W - 16 - 48;
  s += button(px, y + 1, 48, 48, 'pause', { lamp: false });
  return s;
}
function button(x, y, w, h, icon, { lamp = 'off', label = null, value = null, sel = false, dim = false } = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PANEL_LO}"/><rect x="${x + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${h - 5}" rx="3" fill="${FACE}"/>`;
  if (lamp) s += `<rect x="${x + 10}" y="${y + 7}" width="${w - 20}" height="4" rx="1" fill="${lamp === 'on' ? GREEN : lamp === 'sel' ? CYAN : '#2E3538'}"/>`;
  if (sel) s += `<rect x="${x + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${h - 5}" rx="3" fill="none" stroke="${CYAN}" stroke-width="2"/>`;
  const ic = dim ? '#6E797E' : WHITE;
  if (value) { s += I(icon, x + w / 2 - 9, y + h / 2 + 3, 22, ic) + M(x + w / 2 + 10, y + h / 2 + 9, value, { size: 15, fill: sel ? CYAN : ic, anchor: 'middle' }); }
  else s += I(icon, x + w / 2, y + h / 2 + (lamp ? 3 : 0), 24, ic);
  if (label) s += T(x + w / 2, y + h + 14, label, { size: 10, anchor: 'middle', ls: 1.1 });
  return s;
}
/** Speed selector: a rotary knob with three engraved positions. */
function knob(cx, cy, pos = 0, label = 'TEMPO') {
  let s = '';
  const marks = ['1×', '2×', '4×'];
  marks.forEach((m, i) => { const a = -Math.PI / 2 + (i - 1) * 0.9; const [x, y] = pt(cx, cy, 31, a); s += T(x, y + 3.5, m, { size: 9.5, anchor: 'middle', fill: i === pos ? WHITE : '#AEB7BB' }); });
  s += `<circle cx="${cx}" cy="${cy}" r="22" fill="${PANEL_LO}"/><circle cx="${cx}" cy="${cy}" r="19.5" fill="${FACE}"/>`;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const [x1, y1] = pt(cx, cy, 19.5, a), [x2, y2] = pt(cx, cy, 17, a); s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#3A4246" stroke-width="1.2"/>`; }
  const a = -Math.PI / 2 + (pos - 1) * 0.9; const [x2, y2] = pt(cx, cy, 15, a), [x1, y1] = pt(cx, cy, 4, a);
  s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${WHITE}" stroke-width="3" stroke-linecap="round"/>`;
  if (label) s += T(cx, cy + 36, label, { size: 10, anchor: 'middle', ls: 1.1 });
  return s;
}
const DOCK = [
  { icon: 'undo', label: 'COFNIJ', lamp: 'on' },
  { icon: 'turboprop', label: 'TURBO', value: '1', lamp: 'sel', sel: true },
  { icon: 'widebody', label: 'ZA 1 DZIEŃ', lamp: 'off', dim: true },
  { icon: 'hub', label: 'HUB +6', value: '1', lamp: 'on' },
  { icon: 'satellite', label: 'SATELITA', lamp: 'on' },
];
function bottomPanel(W, H, safe) {
  const h = 92; const y0 = H - safe - h;
  let s = panel(0, y0, W, h + safe, { screws: false });
  const bw = 52; const gap = (W - 32 - 5 * bw - 64) / 5;
  DOCK.forEach((d, i) => { s += button(16 + i * (bw + gap), y0 + 12, bw, bw, d.icon, d); });
  s += knob(W - 16 - 32, y0 + 36, 0);
  return s;
}
function sidePanel(W, H) {
  const w = 96; const x0 = W - 24 - w;
  let s = panel(x0 - 8, 0, w + 32, H, { screws: false });
  s += `<path d="M${x0 - 7.5} 0 V${H}" stroke="${PANEL_HI}" stroke-width="1"/>`;
  const rows = [...DOCK];
  const bw = 46; const step = 76;
  // two columns: plane/hub inventory on the left, view/undo on the right; the knob at the bottom
  const pos = [[1, 0], [0, 0], [0, 1], [0, 2], [1, 1]];
  rows.forEach((d, i) => { const [c, r] = pos[i]; s += button(x0 + c * 52, 10 + r * step, bw, bw, d.icon, { ...d, label: d.label.replace('ZA 1 DZIEŃ', '1 DZIEŃ') }); });
  s += knob(x0 + 74, H - 104, 0);
  return s;
}

function cdu(W, H) {
  // Menu as a control display unit: lines on a black screen, each next to a 48 dp line-select key.
  const y0 = 512; const s0 = [];
  let s = panel(0, y0, W, H - y0, { screws: true });
  const sx = 66, sw = W - 132, sy = y0 + 22, sh = H - 16 - y0 - 40;
  s += `<rect x="${sx - 4}" y="${sy - 4}" width="${sw + 8}" height="${sh + 8}" rx="4" fill="${PANEL_LO}"/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${FACE}"/>`;
  s += M(sx + sw / 2, sy + 24, 'AIRWAY', { size: 20, fill: WHITE, anchor: 'middle', ls: 3 });
  s += M(sx + sw - 8, sy + 24, '1/1', { size: 11, fill: '#9AA4A8', anchor: 'end' });
  const lines = [
    { side: 'L', title: '&lt;LOT BEZ KOŃCA', sub: 'REKORD  —', color: GREEN },
    { side: 'L', title: '&lt;ZADANIA', sub: 'ROZWIĄZANE 0/35', color: WHITE },
    { side: 'L', title: '&lt;DZIŚ 04.11', sub: 'TEN SAM ŚWIAT', color: WHITE },
    { side: 'R', title: 'USTAWIENIA&gt;', sub: 'GLOBUS SATELITA', color: WHITE, row: 0 },
    { side: 'R', title: 'DZIENNIK&gt;', sub: 'LOTÓW 0', color: WHITE, row: 1 },
  ];
  const rowY = (r) => sy + 78 + r * 84;
  let lr = 0;
  for (const l of lines) {
    const r = l.side === 'L' ? lr++ : l.row;
    const y = rowY(r);
    const left = l.side === 'L';
    s += M(left ? sx + 8 : sx + sw - 8, y - 12, l.sub, { size: 10, fill: '#9AA4A8', anchor: left ? 'start' : 'end' });
    s += M(left ? sx + 8 : sx + sw - 8, y + 6, l.title, { size: 15, fill: l.color, anchor: left ? 'start' : 'end', w: 700 });
  }
  // line-select keys (both sides, three each)
  for (let r = 0; r < 3; r++) {
    const y = rowY(r) - 24;
    s += key(10, y, r < 3) + key(W - 58, y, r < 2);
  }
  s += M(sx + 8, sy + sh - 12, 'DZIŚ 04.11  ·  NOWY ŚWIAT', { size: 10.5, fill: AMBER });
  return s;
  function key(x, y, active) {
    return `<rect x="${x}" y="${y}" width="48" height="48" rx="4" fill="${PANEL_LO}"/><rect x="${x + 2.5}" y="${y + 2.5}" width="43" height="43" rx="3" fill="${active ? '#1B2023' : '#2A3034'}"/><path d="M${x + 15} ${y + 24} H${x + 33}" stroke="${active ? WHITE : '#59646A'}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

export function render(kind) {
  const W = innerWidth, H = innerHeight;
  const A = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
  let s = '';
  if (kind === 'game-p') {
    s += instrument(A.RIX, A.RIX.p, [176, 236]);
    s += instrument(A.VCE, A.VCE.p, [12, 300]);
    s += instrument(A.ANK, A.ANK.p, [222, 330]);
    s += instrument(A.BGW, A.BGW.p, [312, 400]);
    s += instrument(A.ATH, A.ATH.p, [8, 488]);
    s += jamInstrument(A.AMM, A.AMM.p, [168, 556]);
    s += bearing(A.KHI, W, 548);
    s += topPanel(W, 24);
    s += bottomPanel(W, H, 16);
  } else if (kind === 'game-l') {
    s += instrument(A.RIX, A.RIX.l, [404, 92]);
    s += instrument(A.VCE, A.VCE.l, [120, 132]);
    s += instrument(A.ANK, A.ANK.l, [470, 150]);
    s += instrument(A.BGW, A.BGW.l, [560, 212]);
    s += instrument(A.ATH, A.ATH.l, [140, 252]);
    s += jamInstrument(A.AMM, A.AMM.l, [450, 318]);
    s += instrument(A.KHI, A.KHI.l, [668, 268]);
    s += topPanel(W, 0, { landscape: true, x0: 0, w: W - 128 });
    s += sidePanel(W, H);
  } else if (kind === 'menu-p') {
    s += cdu(W, H);
    s += panel(0, 0, W, 24 + 58);
    s += `<rect x="16" y="34" width="132" height="34" rx="3" fill="${PANEL_LO}"/><rect x="18" y="36" width="128" height="30" rx="2" fill="#C9CFCB"/>`;
    s += T(82, 57, 'AIRWAY · A-01', { size: 13, fill: FACE, anchor: 'middle', ls: 1.6 });
    s += T(W - 112, 44, 'UTC', { size: 10, ls: 1.2 }) + win(W - 112, 48, 96, 26) + M(W - 64, 67, '04.11 17:06', { size: 13, fill: WHITE, anchor: 'middle' });
  }
  document.getElementById('ui').innerHTML = `<svg class="abs" style="left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// Direction 1 "Karta" — the UI is the overprint of an aeronautical chart laid over the satellite photo:
// ink margins with a neatline, lettering with a cartographic halo, leader lines, scale bars, restricted-area hatch.
import { AIRPORTS, HUD, glyph, groups, GLYPH, REGION } from '../common/data.js';
import { ICON, trend } from '../common/icons.js';

const INK = '#0E1B22';
const PAPER = '#F2EEE3';
const MAG = '#D3167A';
const DIM = 'rgba(242,238,227,.55)';

const svgEl = (w, h, body) => `<svg class="abs" style="left:0;top:0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const halo = (s = 3.2) => `stroke="${INK}" stroke-width="${s}" paint-order="stroke" stroke-linejoin="round"`;
const T = (x, y, txt, { size = 14, fam = 'Barlow Condensed', w = 700, fill = PAPER, anchor = 'start', ls = 0, h = 3.2, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}" ${h ? halo(h) : ''}>${txt}</text>`;
const G = (x, y, region, s = 13, ink = INK) => {
  const r = REGION[region];
  return `<g transform="translate(${x} ${y}) scale(${s / 14})"><path d="${GLYPH[r.g]}" fill="${r.c}" stroke="${ink}" stroke-width="2" paint-order="stroke" stroke-linejoin="round"/>${region === 'AFR' ? `<path d="${GLYPH[r.g]}" fill="none" stroke="${PAPER}" stroke-width=".9"/>` : ''}</g>`;
};
const I = (name, x, y, s, color = PAPER) => `<g transform="translate(${x} ${y}) scale(${s / 40})" color="${color}" fill="${color}">${ICON[name]}</g>`;

/** Chart scale bar: one segment per waiting place, filled = taken. */
function scaleBar(x, y, cap, n, { color = PAPER, empty = INK } = {}) {
  const seg = cap > 12 ? 3.5 : 5.5; const gap = 1;
  let s = `<rect x="${x - 1.5}" y="${y - 1.5}" width="${cap * (seg + gap) - gap + 3}" height="7" fill="${INK}" opacity=".9"/>`;
  for (let i = 0; i < cap; i++) {
    const on = i < n;
    s += `<rect x="${x + i * (seg + gap)}" y="${y}" width="${seg}" height="4" fill="${on ? color : empty}" stroke="${color}" stroke-width="${on ? 0 : .7}"/>`;
  }
  return s;
}

/** One airport callout: leader line, code (hub = double underline), count + trend, scale bar, glyph groups. */
function callout(a, [px, py], [lx, ly], { align = 'start' } = {}) {
  const n = a.wait.length;
  const right = align === 'end';
  const gs = groups(a.wait);
  let s = '';
  // leader: from the pad edge toward the label anchor
  // the leader ends on the label block's nearest edge point
  const bw = a.jam ? 164 : a.hub ? 110 : 76, top = a.jam ? ly - 2 : ly - 14, bot = a.jam ? ly + 64 : ly + (n ? 40 : 6);
  const bx0 = a.jam ? (right ? lx - bw : lx) : right ? lx - bw : lx;
  const ex = Math.max(bx0, Math.min(px, bx0 + bw)), ey = Math.max(top, Math.min(py, bot));
  const ang = Math.atan2(ey - py, ex - px);
  const sx = px + Math.cos(ang) * (a.r + 3), sy = py + Math.sin(ang) * (a.r + 3);
  s += `<path d="M${sx} ${sy} L${ex} ${ey}" stroke="${INK}" stroke-width="3.2" fill="none"/><path d="M${sx} ${sy} L${ex} ${ey}" stroke="${a.jam ? MAG : PAPER}" stroke-width="1.1" fill="none"/>`;
  s += `<circle cx="${sx}" cy="${sy}" r="2.4" fill="${a.jam ? MAG : PAPER}" stroke="${INK}" stroke-width="1.2"/>`;
  const x0 = right ? lx - 4 : lx + 4;
  const anchor = right ? 'end' : 'start';
  if (a.jam) {
    // magenta block: the only filled shape on the chart
    const bx = right ? lx - bw : lx;
    s += `<rect x="${bx}" y="${ly - 2}" width="${bw}" height="66" fill="${MAG}"/>`;
    s += `<rect x="${bx + 3}" y="${ly + 1}" width="${bw - 6}" height="60" fill="none" stroke="${PAPER}" stroke-width=".8"/>`;
    s += T(bx + 11, ly + 21, a.code, { size: 21, h: 0, ls: .5 });
    s += T(bx + 54, ly + 19, `${n}/${a.cap}`, { size: 14, fam: 'IBM Plex Mono', w: 600, h: 0 });
    s += `<g transform="translate(${bx + 108} ${ly + 13})">${trendPath(PAPER)}</g>`;
    s += T(bx + 11, ly + 36, `ZATOR · SIEĆ ZAMKNIE SIĘ ZA ${a.timer}`, { size: 10, h: 0, ls: .7, w: 700 });
    let gx = bx + 16;
    for (const g of gs) { s += G(gx, ly + 50, g.id, 12, PAPER) + T(gx + 9, ly + 54, g.n, { size: 11, fam: 'IBM Plex Mono', w: 600, h: 0 }); gx += 24 + String(g.n).length * 6.6; }
    return s;
  }
  s += T(x0, ly + 4, a.code, { size: a.hub ? 20 : 18, anchor, ls: .6 });
  const codeW = (a.hub ? 30 : 27);
  if (a.hub) s += `<path d="M${right ? x0 - codeW : x0} ${ly + 8} h${codeW} M${right ? x0 - codeW : x0} ${ly + 10.5} h${codeW}" stroke="${PAPER}" stroke-width=".9"/>`;
  if (n || a.plate === false) {
    const cx = right ? x0 - codeW - 6 : x0 + codeW + 6;
    s += T(cx, ly + 3, `${n}/${a.cap}`, { size: 12, fam: 'IBM Plex Mono', w: 600, anchor });
    const tw = `${n}/${a.cap}`.length * 7.2 + 9;
    if (a.trend) s += `<g transform="translate(${right ? cx - tw : cx + tw} ${ly - 1})">${trendPath(PAPER, true)}</g>`;
    const barW = a.cap * ((a.cap > 12 ? 3.5 : 5.5) + 1) - 1;
    s += scaleBar(right ? x0 - barW : x0, ly + 15, a.cap, n);
    let gx = right ? x0 - 6 : x0 + 6;
    const items = gs.map((g) => ({ ...g, w: 20 + (g.n > 1 ? String(g.n).length * 7 : 0) }));
    if (right) items.reverse();
    for (const g of items) {
      const ox = right ? gx - g.w + 6 : gx;
      s += G(ox, ly + 32, g.id, 12);
      if (g.n > 1) s += T(ox + 8, ly + 36, g.n, { size: 11, fam: 'IBM Plex Mono', w: 600, h: 2.6 });
      gx += right ? -g.w : g.w;
    }
  }
  return s;
}
function trendPath(color, haloOn) {
  const d = 'M-5 1 L0 -4 L5 1 M-5 6 L0 1 L5 6';
  return `${haloOn ? `<path d="${d}" stroke="${INK}" stroke-width="4" fill="none"/>` : ''}<path d="${d}" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="square"/>`;
}

/** Restricted-area boundary around the jammed hub; the solid arc is the time left before it closes. */
function restricted([x, y], r, left = 0.47) {
  let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${INK}" stroke-width="4.5" opacity=".7"/>`;
  s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${MAG}" stroke-width="1.3" stroke-dasharray="2 3"/>`;
  const a1 = -Math.PI / 2, a2 = a1 + left * Math.PI * 2;
  const p = (a, rr) => `${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr}`;
  s += `<path d="M${p(a1, r)} A${r} ${r} 0 ${left > .5 ? 1 : 0} 1 ${p(a2, r)}" fill="none" stroke="${MAG}" stroke-width="3.2"/>`;
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    s += `<path d="M${p(a, r)} L${p(a, r - 5)}" stroke="${MAG}" stroke-width="1.1"/>`;
  }
  return s;
}

/** The week ruler: three days of 24 h, nights hatched, the marker is now; crates arrive at the end. */
function weekRuler(x, y, w, { compact = false } = {}) {
  const day = w / 3; const hour = day / 24;
  let s = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V4" stroke="${PAPER}" stroke-width="1" opacity=".55"/></pattern></defs>`;
  for (let d = 0; d < 3; d++) {
    const dx = x + d * day;
    s += `<rect x="${dx}" y="${y}" width="${6 * hour}" height="8" fill="url(#hatch)"/>`;
    s += `<rect x="${dx + 22 * hour}" y="${y}" width="${2 * hour}" height="8" fill="url(#hatch)"/>`;
  }
  s += `<path d="M${x} ${y + 8} H${x + w}" stroke="${PAPER}" stroke-width="1"/>`;
  for (let h = 0; h <= 72; h++) {
    const tx = x + h * hour; const major = h % 24 === 0; const mid = h % 6 === 0;
    s += `<path d="M${tx} ${y + 8} V${y + 8 - (major ? 12 : mid ? 6 : 3)}" stroke="${PAPER}" stroke-width="${major ? 1.2 : .8}" opacity="${major || mid ? 1 : .6}"/>`;
  }
  for (let d = 0; d < 3; d++) s += T(x + d * day + 3, y + 21, `DZIEŃ ${d + 1}`, { size: 9.5, ls: 1.1, h: 0, fill: d + 1 === HUD.day ? PAPER : DIM });
  // now
  const now = x + (24 + 17 + 6 / 60) * hour;
  s += `<rect x="${x}" y="${y + 9.5}" width="${now - x}" height="2" fill="${PAPER}"/>`;
  s += `<path d="M${now} ${y + 9} l-4.5 -7 h9 z" fill="${PAPER}" transform="translate(0 -1) rotate(180 ${now} ${y + 5})"/>`;
  // crates at the end of the week
  s += `<g transform="translate(${x + w + (compact ? 9 : 11)} ${y + 3})"><rect x="-6" y="-6" width="12" height="12" fill="none" stroke="${PAPER}" stroke-width="1.2"/><path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="${PAPER}" stroke-width=".8"/></g>`;
  return s;
}

function topBand(w, safe, { landscape = false } = {}) {
  const h = landscape ? 66 : safe + 84;
  let s = `<rect x="0" y="0" width="${w}" height="${h}" fill="${INK}"/>`;
  s += `<path d="M0 ${h - .5} H${w} M0 ${h + 2.5} H${w}" stroke="${PAPER}" stroke-width="1" opacity=".9"/>`;
  s += `<path d="M0 ${h + 2.5} H${w}" stroke="${INK}" stroke-width="3" opacity=".5"/>`;
  const L = landscape ? 40 : 16; const y = landscape ? 12 : safe + 10;
  s += T(L, y + 9, 'TYDZIEŃ', { size: 9.5, ls: 1.4, h: 0, fill: DIM });
  s += T(L, y + 33, HUD.week, { size: 26, fam: 'IBM Plex Mono', w: 600, h: 0 });
  s += T(L + 58, y + 9, 'GODZ.', { size: 9.5, ls: 1.4, h: 0, fill: DIM });
  s += T(L + 58, y + 33, HUD.time, { size: 26, fam: 'IBM Plex Mono', w: 600, h: 0 });
  const px = landscape ? L + 156 : L + 156;
  s += T(px, y + 9, 'PASAŻERÓW', { size: 9.5, ls: 1.4, h: 0, fill: DIM });
  s += T(px, y + 33, HUD.pax, { size: 26, fam: 'IBM Plex Mono', w: 600, h: 0 });
  // pause: a ruled 48×48 target
  const bx = landscape ? w - 104 - 56 : w - 16 - 48, by = landscape ? 9 : safe + 8;
  s += `<rect x="${bx + .5}" y="${by + .5}" width="47" height="47" fill="none" stroke="${PAPER}" stroke-width="1"/>`;
  s += `<rect x="${bx + 18}" y="${by + 15}" width="4.5" height="18" fill="${PAPER}"/><rect x="${bx + 26}" y="${by + 15}" width="4.5" height="18" fill="${PAPER}"/>`;
  if (landscape) s += weekRuler(L + 250, 20, 300, { compact: true });
  else s += weekRuler(16, safe + 58, 356);
  return s;
}

const DOCK = [
  { id: 'undo', label: 'COFNIJ' },
  { id: 'turboprop', label: 'TURBO', value: '1' },
  { id: 'widebody', label: 'SZEROKI', value: '1 dz.', off: true },
  { id: 'hub', label: 'HUB +6', value: '1' },
  { id: 'satellite', label: 'SATELITA' },
  { id: 'speed', label: 'TEMPO', value: '1×' },
];
function dockCell(d, x, y, w, h, { selected = false } = {}) {
  let s = '';
  if (selected) s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" fill="${PAPER}"/>`;
  const c = selected ? INK : d.off ? DIM : PAPER;
  const cx = x + w / 2;
  const hasVal = d.value && !d.off;
  s += I(d.id, hasVal ? cx - 11 : cx, y + h / 2 - 7, d.off ? 22 : 24, c);
  if (d.off) s += `<circle cx="${cx}" cy="${y + h / 2 - 7}" r="16" fill="none" stroke="${DIM}" stroke-width="1" stroke-dasharray="2 2.5"/>`;
  if (hasVal) s += T(cx + 6, y + h / 2 - 1, d.value, { size: 17, fam: 'IBM Plex Mono', w: 600, h: 0, fill: c });
  s += T(cx, y + h - 11, d.off ? 'ZA 1 DZIEŃ' : d.label, { size: 9.5, ls: 1.1, h: 0, anchor: 'middle', fill: selected ? INK : d.off ? DIM : 'rgba(242,238,227,.8)' });
  return s;
}
function bottomDock(w, H, safe) {
  const h = 76; const y0 = H - safe - h;
  let s = `<rect x="0" y="${y0 - 6}" width="${w}" height="${h + safe + 6}" fill="${INK}"/>`;
  s += `<path d="M0 ${y0 - 8.5} H${w}" stroke="${INK}" stroke-width="3" opacity=".5"/><path d="M0 ${y0 - 8.5} H${w} M0 ${y0 - 5.5} H${w}" stroke="${PAPER}" stroke-width="1" opacity=".9"/>`;
  const cw = (w - 16) / 6;
  DOCK.forEach((d, i) => {
    const x = 8 + i * cw;
    if (i) s += `<path d="M${x} ${y0 + 8} V${y0 + h - 8}" stroke="${PAPER}" stroke-width=".6" opacity=".35"/>`;
    s += dockCell(d, x, y0, cw, h, { selected: d.id === 'turboprop' });
  });
  return s;
}
function sideDock(W, H) {
  const w = 84; const x0 = W - 24 - w; // right safe inset 24
  let s = `<rect x="${x0 - 6}" y="0" width="${w + 30}" height="${H}" fill="${INK}"/>`;
  s += `<path d="M${x0 - 8.5} 0 V${H}" stroke="${INK}" stroke-width="3" opacity=".5"/><path d="M${x0 - 8.5} 0 V${H} M${x0 - 5.5} 0 V${H}" stroke="${PAPER}" stroke-width="1" opacity=".9"/>`;
  const ch = (H - 16) / 6;
  DOCK.forEach((d, i) => {
    const y = 8 + i * ch;
    if (i) s += `<path d="M${x0 + 10} ${y} H${x0 + w - 10}" stroke="${PAPER}" stroke-width=".6" opacity=".35"/>`;
    s += dockCell(d, x0, y, w, ch, { selected: d.id === 'turboprop' });
  });
  return s;
}

/** Off-screen airport: a margin note on the route's exit, with distance as a chart would print it. */
function edgeNote(a, x, y) {
  let s = `<path d="M${x} ${y} l-12 -7 v14 z" fill="${PAPER}" stroke="${INK}" stroke-width="1.5" paint-order="stroke"/>`;
  s += T(x - 18, y + 6, a.code, { size: 18, anchor: 'end', ls: .5 });
  s += `<g transform="translate(${x - 8} ${y + 22})">${trendPath(PAPER, true)}</g>`;
  s += T(x - 18, y + 26, `${a.wait.length}/${a.cap}`, { size: 12, fam: 'IBM Plex Mono', w: 600, anchor: 'end' });
  s += T(x - 18, y + 41, '1 790 KM', { size: 10.5, anchor: 'end', ls: 1, h: 3 });
  return s;
}
function routeLabel(x, y, txt, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-22" y="-8" width="44" height="15" fill="${INK}" stroke="${PAPER}" stroke-width=".8"/>${T(0, 3.5, txt, { size: 10, anchor: 'middle', h: 0, ls: .6 })}</g>`;
}


function sym(kind, x, y, c = PAPER) {
  if (kind === 'endless') return `<g transform="translate(${x} ${y})" stroke="${c}" fill="none" stroke-width="1.4"><circle r="9"/><circle r="4.5"/><path d="M-13 0h4 M9 0h4 M0 -13v4 M0 9v4"/></g>`;
  if (kind === 'puzzle') return `<g transform="translate(${x} ${y})" stroke="${c}" fill="none" stroke-width="1.4"><rect x="-8" y="-8" width="16" height="16"/><path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke-width=".9"/></g>`;
  if (kind === 'daily') return `<g transform="translate(${x} ${y})" stroke="${c}" fill="none" stroke-width="1.4"><circle r="5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 -8 V-11" transform="rotate(${a})"/>`).join('')}</g>`;
  if (kind === 'settings') return `<g transform="translate(${x} ${y})" stroke="${c}" fill="none" stroke-width="1.4"><path d="M-8 -5h16 M-8 0h16 M-8 5h16"/><circle cx="-3" cy="-5" r="1.8" fill="${INK}"/><circle cx="4" cy="0" r="1.8" fill="${INK}"/><circle cx="-1" cy="5" r="1.8" fill="${INK}"/></g>`;
  return `<g transform="translate(${x} ${y})" stroke="${c}" fill="none" stroke-width="1.4"><path d="M-7 -8h11l3 3v13h-14z M-4 -3h8 M-4 1h8 M-4 5h5"/></g>`;
}
function menuRow(y, h, k, title, sub, right, { primary = false, W }) {
  let s = '';
  const fg = primary ? INK : PAPER;
  if (primary) s += `<rect x="12" y="${y + 4}" width="${W - 24}" height="${h - 8}" fill="${PAPER}"/>`;
  else s += `<path d="M16 ${y + h} H${W - 16}" stroke="${PAPER}" stroke-width=".6" opacity=".35"/>`;
  s += sym(k, 38, y + h / 2, fg);
  s += T(64, y + h / 2 + (sub ? -2 : 6), title, { size: primary ? 24 : 20, h: 0, fill: fg, ls: 1.2 });
  if (sub) s += T(64, y + h / 2 + 16, sub, { size: 13, w: 500, h: 0, fill: primary ? 'rgba(14,27,34,.7)' : DIM, ls: .3 });
  if (right) s += T(W - 28, y + h / 2 + 6, right, { size: 15, fam: 'IBM Plex Mono', w: 600, h: 0, fill: fg, anchor: 'end' });
  return s;
}
function menuP(W, H) {
  let s = '';
  // the long route in the frame becomes a chart airway with a designator box
  s += `<g transform="translate(150 311) rotate(1.5)"><rect x="-30" y="-10" width="60" height="19" fill="${INK}" stroke="${PAPER}" stroke-width="1"/>${T(0, 4.5, 'AW 1', { size: 13, anchor: 'middle', h: 0, ls: 1.5 })}</g>`;
  s += T(150, 340, '5 570 KM', { size: 11, anchor: 'middle', ls: 1.2, h: 3 });
  // top margin: neatline with corner coordinates
  s += `<rect x="0" y="0" width="${W}" height="62" fill="${INK}"/>`;
  s += `<path d="M0 61.5 H${W} M0 64.5 H${W}" stroke="${PAPER}" stroke-width="1" opacity=".9"/>`;
  for (let x = 6; x < W; x += 10) s += `<path d="M${x} 61 V${(x - 6) % 50 === 0 ? 53 : 57}" stroke="${PAPER}" stroke-width=".8" opacity=".7"/>`;
  s += T(16, 44, '60°N  30°W', { size: 11, ls: 1.4, h: 0, fill: DIM });
  s += T(W - 16, 44, 'AIRWAY.GAMES', { size: 11, ls: 1.4, h: 0, fill: DIM, anchor: 'end' });
  // title block
  const y0 = 526;
  s += `<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="${INK}"/>`;
  s += `<path d="M0 ${y0 - 1.5} H${W} M0 ${y0 + 1.5} H${W}" stroke="${PAPER}" stroke-width="1" opacity=".9"/>`;
  s += T(16, y0 + 54, 'AIRWAY', { size: 50, ls: 7, h: 0 });
  s += T(18, y0 + 76, 'KARTA SIECI LOTNICZEJ · ARKUSZ 04.11', { size: 11, ls: 1.6, h: 0, fill: DIM });
  // scale bar
  const sx = W - 150;
  for (let i = 0; i < 4; i++) s += `<rect x="${sx + i * 28}" y="${y0 + 36}" width="28" height="5" fill="${i % 2 ? INK : PAPER}" stroke="${PAPER}" stroke-width=".8"/>`;
  s += T(sx, y0 + 56, '0', { size: 10, h: 0, fill: DIM, anchor: 'middle' }) + T(sx + 56, y0 + 56, '1000', { size: 10, h: 0, fill: DIM, anchor: 'middle' }) + T(sx + 112, y0 + 56, '2000 KM', { size: 10, h: 0, fill: DIM, anchor: 'middle' });
  s += `<path d="M16 ${y0 + 92} H${W - 16}" stroke="${PAPER}" stroke-width="1"/>`;
  let y = y0 + 96;
  s += menuRow(y, 76, 'endless', 'LOT BEZ KOŃCA', 'brak rekordu · ten sam świat albo nowy', '▸', { primary: true, W }); y += 76;
  s += menuRow(y, 64, 'puzzle', 'ZADANIA', '0 z 35 rozwiązanych', '0/35', { W }); y += 64;
  s += menuRow(y, 64, 'daily', 'DZIŚ 04.11', 'ten sam świat dla wszystkich', 'NOWY', { W }); y += 64;
  const half = W / 2;
  s += sym('settings', 38, y + 30) + T(60, y + 36, 'USTAWIENIA', { size: 17, h: 0, ls: 1.2 });
  s += `<path d="M${half} ${y + 10} V${y + 52}" stroke="${PAPER}" stroke-width=".6" opacity=".35"/>`;
  s += sym('log', half + 22, y + 30) + T(half + 44, y + 36, 'DZIENNIK', { size: 17, h: 0, ls: 1.2 });
  return s;
}

export function render(kind) {
  const W = innerWidth, H = innerHeight;
  const root = document.getElementById('ui');
  let s = '';
  if (kind === 'game-p') {
    const A = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
    s += restricted(A.AMM.p, 47);
    s += routeLabel(166, 461, '1 120 KM', 33);
    s += callout(A.RIX, A.RIX.p, [190, 246]);
    s += callout(A.VCE, A.VCE.p, [14, 304]);
    s += callout(A.ATH, A.ATH.p, [16, 512]);
    s += callout(A.ANK, A.ANK.p, [220, 340]);
    s += callout(A.BGW, A.BGW.p, [318, 410]);
    s += callout(A.AMM, A.AMM.p, [186, 572]);
    s += edgeNote(A.KHI, W - 4, 528);
    s += topBand(W, 24);
    s += bottomDock(W, H, 16);
  } else if (kind === 'game-l') {
    const A = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));
    s += restricted(A.AMM.l, 46);
    s += callout(A.RIX, A.RIX.l, [420, 92]);
    s += callout(A.VCE, A.VCE.l, [96, 140]);
    s += callout(A.ATH, A.ATH.l, [96, 262]);
    s += callout(A.ANK, A.ANK.l, [480, 142]);
    s += callout(A.BGW, A.BGW.l, [560, 200]);
    s += callout(A.AMM, A.AMM.l, [470, 330]);
    s += callout(A.KHI, A.KHI.l, [690, 262]);
    s += topBand(W - 114, 0, { landscape: true });
    s += sideDock(W, H);
  } else if (kind === 'menu-p') s += menuP(W, H);
  root.innerHTML = svgEl(W, H, s);
}
export { INK, PAPER, MAG, DIM, T, I, svgEl, trendPath };

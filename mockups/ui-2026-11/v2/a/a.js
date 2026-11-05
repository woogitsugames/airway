// Variant A "Arkusz" — the screen is one printed chart sheet: a thin paper margin with a double neatline frames the
// photo; the HUD is the sheet's title block (time scale bar) and its legend (the dock). Airports are FAA-style chart
// airport symbols in "towered" blue; waiting places are the service ticks; a jam is drawn as a restricted area.
import { AIRPORTS, MENU_PADS, pos, rad, runways, seatTicks, glyphRow, T, sym, mount } from '../common.js';
import { tw } from '../measure.js';

const PAPER = '#F3F0E7', INK = '#1C1C1A', BLUE = '#1C5A9C', MAG = '#A11A5C', GREY = '#8C8A84';
const F = 'Familjen Grotesk', S = 'Young Serif';

function marker(a, [x, y], key) {
  const r = rad(a, key), n = a.wait.length;
  let s = `<g transform="translate(${x} ${y})">`;
  if (a.jam) {
    // restricted area: border line with hatching on the inside; the hatched part is the time left (42 of 60 s)
    const R = r + 13, left = 42 / 60;
    s += `<circle r="${R}" fill="none" stroke="${PAPER}" stroke-width="4.5"/><circle r="${R}" fill="none" stroke="${MAG}" stroke-width="2"/>`;
    for (let i = 0; i < 60; i++) {
      const t = i / 60; if (t > left) break;
      const an = (-90 + t * 360) * Math.PI / 180, c = Math.cos(an), sn = Math.sin(an);
      s += `<path d="M${c * R} ${sn * R}L${c * (R - 6)} ${sn * (R - 6)}" stroke="${MAG}" stroke-width="1.6"/>`;
    }
  }
  if (a.hub) {
    s += runways(true, r, { fill: a.jam ? MAG : BLUE, halo: PAPER, hw: 2 });
  } else {
    s += `<circle r="${r}" fill="none" stroke="${PAPER}" stroke-width="4.4"/><circle r="${r}" fill="none" stroke="${BLUE}" stroke-width="2.4"/>`;
    s += runways(false, r * 0.85, { fill: BLUE, halo: PAPER, hw: 1.4 });
  }
  s += seatTicks(a.hub ? r + 1 : r + 1.5, a.cap, n, { on: a.jam ? MAG : BLUE, off: PAPER, halo: PAPER, len: a.hub ? 6 : 5, w: 2.2, dot: 1.1 });
  return s + '</g>';
}

/** Boxed chart callout: name + code, then "n z cap" with fill trend and grouped passenger glyphs. */
function callout(a, [px, py], [bx, by], key) {
  const n = a.wait.length, jam = !!a.jam;
  const l1 = a.city, code = a.code;
  const w1 = tw(l1, 14, F, 700) + 6 + tw(code, 12, F, 400);
  const cnt = `${n} z ${a.cap}`;
  const wc = tw(cnt, 13, S);
  const rowW = n ? 14 + groupsWidth(a) : 0;
  const extra = jam ? tw(`zator, sieć zamknie się za ${a.timer}`, 12.5, F, 700) : 0;
  const W = Math.ceil(Math.max(w1, wc + 4 + (a.trend ? 14 : 0) + rowW, extra)) + 16;
  const H = jam ? 62 : 42;
  // leader from marker edge to nearest box point
  const ex = Math.max(bx, Math.min(px, bx + W)), ey = Math.max(by, Math.min(py, by + H));
  const ang = Math.atan2(ey - py, ex - px), r0 = (a.jam ? rad(a, key) + 14 : rad(a, key) + 6);
  const sx = px + Math.cos(ang) * r0, sy = py + Math.sin(ang) * r0;
  let s = `<path d="M${sx} ${sy}L${ex} ${ey}" stroke="${PAPER}" stroke-width="3.4"/><path d="M${sx} ${sy}L${ex} ${ey}" stroke="${jam ? MAG : INK}" stroke-width="1.2"/>`;
  s += `<rect x="${bx}" y="${by}" width="${W}" height="${H}" fill="${PAPER}" stroke="${jam ? MAG : INK}" stroke-width="${jam ? 2 : 1}"/>`;
  if (jam) s += `<rect x="${bx + 3}" y="${by + 3}" width="${W - 6}" height="${H - 6}" fill="none" stroke="${MAG}" stroke-width=".8"/>`;
  s += T(bx + 8, by + 17, l1, { size: 14, fam: F, w: 700, fill: jam ? MAG : INK });
  s += T(bx + 8 + tw(l1, 14, F, 700) + 6, by + 17, code, { size: 12, fam: F, w: 400, fill: jam ? MAG : '#55534D' });
  let y2 = by + 34;
  if (jam) { s += T(bx + 8, by + 34, `Zator, sieć zamknie się za ${a.timer}`, { size: 12.5, fam: F, w: 700, fill: MAG }); y2 = by + 53; }
  s += `<rect x="${bx + 4.5}" y="${y2 - 12.5}" width="${wc + 7}" height="17" fill="none" stroke="${jam ? MAG : INK}" stroke-width=".9"/>`;
  s += T(bx + 8, y2, cnt, { size: 13, fam: S, fill: INK });
  let gx = bx + 8 + wc + 8;
  if (a.trend) { s += `<path d="M${gx + 1} ${y2 - 1}l4.5 -8 4.5 8z" fill="${INK}"/>`; gx += 14; }
  if (n) s += glyphRow(gx + 6, y2 - 4.5, a.wait, { size: 11, ink: PAPER, inkW: 2, text: (x, y, t) => T(x, y, t, { size: 12.5, fam: S, fill: INK }), gap: 6 })[0];
  return s;
}
function groupsWidth(a) { return glyphRow(0, 0, a.wait, { size: 11, text: () => '', gap: 6 })[1]; }

/** Off-screen airport: a margin note with an arrow-shaped box, like a reference to the next sheet. */
function edgeNote(a, y, xr) {
  const t = `${a.code}`, sub = `${a.wait.length} z ${a.cap}`; // 1 790 km below
  const W = 78, x = xr - W;
  return `<path d="M${x} ${y} H${xr - 12} L${xr} ${y + 19} L${xr - 12} ${y + 38} H${x} Z" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>`
    + T(x + 8, y + 16, t, { size: 14, fam: F, w: 700, fill: INK }) + T(x + 8, y + 32, sub, { size: 12.5, fam: S, fill: INK })
    + T(xr - 4, y + 54, '1 790 km', { size: 12.5, fam: S, fill: PAPER, anchor: 'end', halo: INK, hw: 3 });
}

function sheet(W, H, win) {
  const [x0, y0, x1, y1] = win;
  let s = `<path fill-rule="evenodd" d="M0 0H${W}V${H}H0Z M${x0} ${y0}V${y1}H${x1}V${y0}Z" fill="${PAPER}"/>`;
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<rect x="${x0 - 3.5}" y="${y0 - 3.5}" width="${x1 - x0 + 7}" height="${y1 - y0 + 7}" fill="none" stroke="${INK}" stroke-width=".6"/>`;
  // graticule ticks on the neatline (every 5 degrees, roughly)
  for (let x = x0 + 28; x < x1 - 8; x += 38) s += `<path d="M${x} ${y0}v5M${x} ${y1}v-5" stroke="${INK}" stroke-width="1"/>`;
  for (let y = y0 + 28; y < y1 - 8; y += 38) s += `<path d="M${x0} ${y}h5M${x1} ${y}h-5" stroke="${INK}" stroke-width="1"/>`;
  return s;
}
function panel(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" fill="none" stroke="${INK}" stroke-width=".6"/>`;
}
/** Title block: name, week, big clock, day + passengers, and the time scale bar (3 days, 6 h blocks). */
function titleBlock(x, y) {
  const w = 192, h = 112;
  let s = panel(x, y, w, h);
  // ILS approach-plate header (ref. plate 06): hairline cells, small label over a big value
  const c1 = x + 104, c2 = x + 148;
  s += `<path d="M${c1} ${y + 3}V${y + 72}M${c2} ${y + 3}V${y + 72}M${x + 3} ${y + 72}H${x + w - 3}" stroke="${INK}" stroke-width=".7"/>`;
  s += T(x + 10, y + 19, 'Godzina', { size: 12, fam: F, fill: '#55534D' }) + T(x + 9, y + 60, '17:06', { size: 33, fam: S, fill: INK });
  s += T(c1 + 8, y + 19, 'Dzień', { size: 12, fam: F, fill: '#55534D' }) + T(c1 + 8, y + 46, '2', { size: 22, fam: S, fill: INK }) + T(c1 + 22, y + 46, 'z 3', { size: 12, fam: F, fill: INK });
  s += T(c2 + 8, y + 19, 'Tydz.', { size: 12, fam: F, fill: '#55534D' }) + T(c2 + 8, y + 46, '1', { size: 22, fam: S, fill: INK });
  s += T(c1 + 8, y + 65, '34 pasażerów', { size: 12, fam: F, fill: INK });
  // scale bar: 12 blocks, alternating, night blocks hatched
  const bx = x + 11, bw = w - 22, by = y + 80, blk = bw / 12;
  for (let i = 0; i < 12; i++) {
    const night = i % 4 === 0 || i % 4 === 3;
    s += `<rect x="${bx + i * blk}" y="${by}" width="${blk}" height="6" fill="${night ? 'url(#hatch)' : i % 2 ? INK : PAPER}" stroke="${INK}" stroke-width=".8"/>`;
  }
  const now = bx + ((1 + 17.1 / 24) / 3) * bw;
  s += `<path d="M${now - 5} ${by - 7}h10l-5 7z" fill="${MAG}"/>`;
  for (let d = 0; d < 3; d++) s += T(bx + (d + 0.5) * bw / 3, by + 21, `${d + 1}`, { size: 12.5, fam: S, fill: d === 1 ? INK : GREY, anchor: 'middle' });
  return s;
}
const DOCK = [
  { id: 'undo', cap: 'Cofnij' }, { id: 'turboprop', cap: 'Śmigłowy', n: 1, sel: true },
  { id: 'widebody', cap: 'Odrzutowy', off: 'za 1 dzień' }, { id: 'hub', cap: 'Hub', n: 1 },
  { id: 'satellite', cap: 'Satelita' }, { id: 'speed', cap: 'Tempo 1×', arg: 1 },
];
function legendCell(d, cx, cy, cw, ch) {
  let s = '';
  if (d.sel) s += `<rect x="${cx - cw / 2 + 3}" y="${cy - ch / 2 + 2}" width="${cw - 6}" height="${ch - 4}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  const col = d.off || d.dim ? GREY : INK;
  s += sym(d.id, cx - (d.n ? 7 : 0), cy - 12, 26, col, { arg: d.arg });
  if (d.n) s += T(cx + 12, cy - 5, d.n, { size: 17, fam: S, fill: INK });
  s += T(cx, cy + 15, d.cap, { size: 13, fam: F, w: d.sel ? 700 : 400, fill: col, anchor: 'middle' });
  if (d.off) s += T(cx, cy + 29, d.off, { size: 12, fam: F, fill: GREY, anchor: 'middle' });
  return s;
}
const DEFS = `<defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="${PAPER}"/><path d="M0 0V3" stroke="${INK}" stroke-width="1.1"/></pattern></defs>`;

const PLACE = {
  p: { RIX: [174, 252], VCE: [14, 306], ATH: [14, 470], ANK: [222, 368], AMM: [118, 548], BGW: [300, 424] },
  l: { RIX: [384, 92], VCE: [178, 138], ATH: [200, 262], ANK: [428, 166], AMM: [446, 302], BGW: [506, 222], KHI: [664, 300] },
};

function world(key) {
  let s = DEFS;
  for (const a of AIRPORTS) { const p = a[key]; if (!p) continue; s += marker(a, p, key); }
  for (const a of AIRPORTS) { const p = a[key]; if (!p || !PLACE[key][a.code]) continue; s += callout(a, p, PLACE[key][a.code], key); }
  return s;
}

export function render(view) {
  if (view === 'jam') return mount('jam', world('p'));
  if (view === 'game-p') {
    const win = [8, 30, 404, 826];
    let hud = DEFS + sheet(412, 915, win) + titleBlock(8, 30) + panel(352, 30, 52, 52) + sym('pause', 378, 56, 24, INK);
    hud += edgeNote(AIRPORTS.find((a) => a.code === 'KHI'), 488, 404);
    const cw = 396 / 6;
    DOCK.forEach((d, i) => { hud += legendCell(d, 8 + cw * (i + 0.5), 862, cw, 66); });
    return mount('game-p', world('p'), hud);
  }
  if (view === 'game-l') {
    const win = [40, 10, 812, 402];
    let hud = DEFS + sheet(915, 412, win) + titleBlock(40, 10);
    hud += panel(824, 10, 64, 52) + sym('pause', 856, 36, 24, INK);
    DOCK.forEach((d, i) => { hud += legendCell(d.off ? { ...d, cap: d.off, off: '' , dim: true } : d, 856, 98 + i * 51, 64, 50); });
    return mount('game-l', world('l'), hud);
  }
  // menu: the sheet's title block grows into the menu; the network behind is drawn with chart symbols
  let w = DEFS;
  for (const [x, y, hub] of MENU_PADS) w += marker({ hub: !!hub, cap: hub ? 24 : 12, wait: [] }, [x, y], 'p');
  const win = [8, 30, 404, 520];
  let hud = DEFS + sheet(412, 915, win);
  hud += `<rect x="8" y="520" width="396" height="380" fill="${PAPER}"/>`;
  hud += T(24, 584, 'Airway', { size: 50, fam: S, fill: INK });
  hud += T(26, 610, 'Mapa sieci lotniczej, arkusz 1', { size: 15, fam: F, fill: INK });
  // scale bar, chart style
  const sx = 266, sw = 120;
  for (let i = 0; i < 4; i++) hud += `<rect x="${sx + i * sw / 4}" y="566" width="${sw / 4}" height="6" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width=".8"/>`;
  hud += T(sx + sw, 590, '1 : 40 000 000', { size: 12.5, fam: S, fill: INK, anchor: 'end' });
  const rows = [['speed', 'Lot bez końca', 'rekord 1 284', 1], ['hub', 'Zadania', '12 z 30'], ['satellite', 'Trasa dnia', '5 listopada'], ['undo', 'Dziennik', 'tydzień 7'], ['pause', 'Ustawienia', '']];
  rows.forEach(([ic, label, det, arg], i) => {
    const y = 632 + i * 52;
    hud += `<path d="M24 ${y}H388" stroke="${INK}" stroke-width="${i ? .6 : 1.4}"/>`;
    hud += i === 0 ? `<path d="M44 ${y + 15}l11 11-11 11-11-11z" fill="${MAG}"/>` : `<circle cx="44" cy="${y + 26}" r="6" fill="none" stroke="${INK}" stroke-width="2"/>`;
    hud += T(72, y + 32, label, { size: 19, fam: F, w: 700, fill: i === 0 ? MAG : INK });
    hud += T(388, y + 31, det, { size: 14, fam: S, fill: INK, anchor: 'end' });
  });
  hud += `<path d="M24 892H388" stroke="${INK}" stroke-width="1.4"/>`;
  return mount('menu-p', w, hud);
}

// Direction "Mapa pilota" (Plotting Chart): the globe is a working aeronautical chart.
// Every gameplay value is a chart symbol: hub = airport wheel with capacity ticks, curfew = restricted-area hatch,
// widebody = double airway line, turboprop = dashed line with range circle, week = chart scale bar.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoCircle } from 'd3-geo';
import { makeGlobe, CITIES } from '../lib/geo.mjs';
import { writePage, SAFE } from '../lib/page.mjs';
import { glyph, plane, km, nf, sector, polar } from '../lib/draw.mjs';
import { REGIONS, CITY_REGION, ROUTES, FLIGHTS, HUBS, CITIES_WAITING, NEW_CITY, CURFEW, SUN, CLOCK, TITLE, UPGRADES } from '../lib/scene.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const C = {
  paper: '#E9EBE0', land: '#F5F3E9', sea: '#D6E6EA', tan: '#D9CDB0', blue: '#1F4E9C', magenta: '#B0177E',
  ochre: '#E0A526', teal: '#5FB8C9', verm: '#D24A1C', ink: '#2B2A28', hatch: '#3A4660',
};
// Destination colours (Okabe-Ito derived) — reinforcement only, the glyph shape is the identity.
const DEST = { NAM: '#0072B2', EUN: '#009E73', EUS: '#E69F00', AFR: '#2B2A28', ME: '#CC79A7', SAM: '#56B4E9' };
const FONTS = [
  { family: 'Shoulders', file: 'BigShouldersDisplay-800.ttf', weight: 800 },
  { family: 'Shoulders', file: 'BigShouldersDisplay-500.ttf', weight: 500 },
  { family: 'Plex', file: 'IBMPlexSansCondensed-400.ttf', weight: 400 },
  { family: 'Plex', file: 'IBMPlexSansCondensed-600.ttf', weight: 600 },
  { family: 'PlexMono', file: 'IBMPlexMono-400.ttf', weight: 400 },
  { family: 'PlexMono', file: 'IBMPlexMono-600.ttf', weight: 600 },
];
const CSS = `
body{background:${C.paper};font-family:Plex,sans-serif;color:${C.ink}}
.mono{font-family:PlexMono,monospace}
.hd{font-family:Shoulders,sans-serif;font-weight:800;letter-spacing:.01em}
svg{position:absolute;left:0;top:0}
`;

const defs = `<defs>
<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${C.hatch}" stroke-width="1.6" opacity=".3"/></pattern>
<pattern id="rhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${C.magenta}" stroke-width="1.2" opacity=".55"/></pattern>
<pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${C.paper}"/><circle cx="1" cy="1" r=".35" fill="${C.ink}" opacity=".06"/></pattern>
</defs>`;

/** Airport wheel for a plain city: circle + 4 short ticks + region glyph. Hollow + restricted hatch under curfew. */
function citySym(g, code, s = 0.85) {
  const c = g.city(code); if (!c.vis) return '';
  const [x, y] = c.xy, closed = CURFEW.includes(code), col = C.magenta, reg = REGIONS[CITY_REGION[code]].glyph;
  let o = '';
  if (closed) o += `<circle cx="${x}" cy="${y}" r="${20 * s}" fill="url(#rhatch)" stroke="${C.magenta}" stroke-width="1" stroke-dasharray="3 2"/>`;
  for (let a = 0; a < 360; a += 90) { const [x0, y0] = polar(x, y, 7.5 * s, a + 45), [x1, y1] = polar(x, y, 10.5 * s, a + 45); o += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="1.6"/>`; }
  o += `<circle cx="${x}" cy="${y}" r="${7.5 * s}" fill="${closed ? C.paper : C.land}" stroke="${col}" stroke-width="2"/>`;
  o += glyph(reg, x, y, 0.42 * s, `fill="${closed ? 'none' : col}" stroke="${closed ? col : 'none'}" stroke-width="${closed ? 2 : 0}"`);
  return o;
}

/** Waiting passengers printed as a row of destination glyphs on a leader line. */
function queue(x, y, list, dx = 1, s = 0.5, gap = 9.5) {
  if (!list.length) return '';
  const per = 6, rows = Math.ceil(list.length / per);
  let o = `<line x1="${x}" y1="${y}" x2="${x + dx * (12 + Math.min(per, list.length) * gap)}" y2="${y}" stroke="${C.ink}" stroke-width=".6" opacity=".5"/>`;
  list.forEach((r, i) => { o += glyph(REGIONS[r].glyph, x + dx * (14 + (i % per) * gap), y - 7 - Math.floor(i / per) * 11, s, `fill="${DEST[r]}" stroke="${C.land}" stroke-width="1.2" paint-order="stroke"`); });
  return o;
}

function label(x, y, text, anchor = 'start', size = 9.5, weight = 600, fill = C.ink) {
  return `<text x="${x}" y="${y}" font-family="Plex" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" letter-spacing=".06em" paint-order="stroke" stroke="${C.land}" stroke-width="3">${text}</text>`;
}

/** Hub = towered (blue) airport wheel: ring of capacity ticks, filled ticks = waiting; connection dial; jam ring. */
function hubSym(g, code, sc = 0.78) {
  const c = g.city(code), h = HUBS[code]; if (!c.vis) return '';
  return `<g transform="translate(${c.xy[0]} ${c.xy[1]}) scale(${sc}) translate(${-c.xy[0]} ${-c.xy[1]})">${hubInner(g, code, c, h)}</g>`;
}
function hubInner(g, code, c, h) {
  const [x, y] = c.xy, n = h.cap, w = h.waiting.length, load = w / n;
  let o = '';
  if (h.warn) {
    o += `<circle cx="${x}" cy="${y}" r="33" fill="none" stroke="${C.verm}" stroke-width="2" stroke-dasharray="5 3"/>`;
    o += `<path d="${sector(x, y, 37, 0, 360 * h.jamIn)}" fill="none" stroke="${C.verm}" stroke-width="4"/>`;
  }
  // connection dial (compass bezel): N mark + transferring passengers riding clockwise
  o += `<circle cx="${x}" cy="${y}" r="27" fill="${C.land}" stroke="${C.blue}" stroke-width="1"/>`;
  for (let a = 0; a < 360; a += 30) { const [x0, y0] = polar(x, y, 27, a), [x1, y1] = polar(x, y, a % 90 ? 25 : 23, a); o += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.blue}" stroke-width="1"/>`; }
  const [nx, ny] = polar(x, y, 31, 0); o += `<path d="M${nx - 3} ${ny + 3} L${nx} ${ny - 3} L${nx + 3} ${ny + 3}Z" fill="${C.blue}"/>`;
  for (let i = 0; i < h.dial; i++) { const [px, py] = polar(x, y, 27, 140 + i * 70); o += `<circle cx="${px}" cy="${py}" r="2.6" fill="${C.land}" stroke="${C.blue}" stroke-width="1.4"/>`; }
  // capacity ticks
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) * 360 / n, [x0, y0] = polar(x, y, 13, a), [x1, y1] = polar(x, y, 20, a), full = i < w;
    o += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${full ? (load > 0.8 ? C.verm : C.blue) : C.blue}" stroke-width="${full ? 4 : 1.2}" stroke-linecap="butt" opacity="${full ? 1 : 0.55}"/>`;
  }
  o += `<circle cx="${x}" cy="${y}" r="11" fill="${C.blue}"/>`;
  o += glyph(REGIONS[CITY_REGION[code]].glyph, x, y, 0.62, `fill="${C.land}"`);
  return o;
}

function routeLine(g, a, b, type) {
  const { front, back } = g.arc(a, b, type === 'widebody' ? 0.1 : 0.04);
  let o = '';
  if (back) o += `<path d="${back}" fill="none" stroke="${C.ink}" stroke-width="1" stroke-dasharray="1 4" opacity=".5"/>`;
  if (type === 'widebody') {
    o += `<path d="${front}" fill="none" stroke="${C.blue}" stroke-width="5" stroke-linecap="round"/>`;
    o += `<path d="${front}" fill="none" stroke="${C.land}" stroke-width="1.8" stroke-linecap="round"/>`;
  } else {
    o += `<path d="${front}" fill="none" stroke="${C.magenta}" stroke-width="2.2" stroke-dasharray="7 3.5"/>`;
  }
  // distance ticks every 500 km (chart convention)
  const d = km(a, b);
  for (let k = 500; k < d; k += 500) {
    const p = g.arcAt(a, b, k / d, type === 'widebody' ? 0.1 : 0.04); if (!p.front) continue;
    const r = (p.deg + 90) * Math.PI / 180, L = type === 'widebody' ? 5 : 4;
    o += `<line x1="${(p.x - Math.cos(r) * L).toFixed(1)}" y1="${(p.y - Math.sin(r) * L).toFixed(1)}" x2="${(p.x + Math.cos(r) * L).toFixed(1)}" y2="${(p.y + Math.sin(r) * L).toFixed(1)}" stroke="${type === 'widebody' ? C.blue : C.magenta}" stroke-width="1"/>`;
  }
  return o;
}

function flights(g) {
  return FLIGHTS.map(([a, b, t, load, type]) => {
    const p = g.arcAt(a, b, t, type === 'widebody' ? 0.1 : 0.04); if (!p.front) return '';
    const s = type === 'widebody' ? 0.95 : 0.8;
    // seat-load bar beside the fuselage: filled part = passengers on board
    const r = (p.deg + 90) * Math.PI / 180, off = type === 'widebody' ? 15 : 12, bx = p.x + Math.cos(r) * off, by = p.y + Math.sin(r) * off;
    const dx = Math.cos(p.deg * Math.PI / 180) * 7, dy = Math.sin(p.deg * Math.PI / 180) * 7;
    return plane(type, p.x, p.y, p.deg, s, `fill="${C.ink}" stroke="${C.land}" stroke-width="1.6" paint-order="stroke"`) +
      `<line x1="${(bx - dx).toFixed(1)}" y1="${(by - dy).toFixed(1)}" x2="${(bx + dx).toFixed(1)}" y2="${(by + dy).toFixed(1)}" stroke="${C.land}" stroke-width="4.4"/>` +
      `<line x1="${(bx - dx).toFixed(1)}" y1="${(by - dy).toFixed(1)}" x2="${(bx + dx).toFixed(1)}" y2="${(by + dy).toFixed(1)}" stroke="${C.ink}" stroke-width="2.4" opacity=".25"/>` +
      `<line x1="${(bx - dx).toFixed(1)}" y1="${(by - dy).toFixed(1)}" x2="${(bx - dx + 2 * dx * load).toFixed(1)}" y2="${(by - dy + 2 * dy * load).toFixed(1)}" stroke="${C.ink}" stroke-width="2.4"/>`;
  }).join('');
}

/** Edge marker: a city outside the viewport is shown as a chevron + code on the screen edge (tap = rotate there). */
function edgeMarker(x, y, deg, code, n) {
  return `<g transform="translate(${x} ${y})"><rect x="-4" y="-17" width="56" height="34" fill="${C.land}" stroke="${C.ink}" stroke-width="1.2"/>
  <path d="M${deg > 90 ? '4 -8 L-4 0 L4 8' : '44 -8 L52 0 L44 8'}" fill="none" stroke="${C.ink}" stroke-width="2.2" transform="translate(${deg > 90 ? 4 : -4} 0)"/>
  <text x="${deg > 90 ? 14 : 4}" y="-1" font-family="PlexMono" font-weight="600" font-size="11" fill="${C.ink}">${code}</text>
  <text x="${deg > 90 ? 14 : 4}" y="11" font-family="Plex" font-size="8.5" fill="${C.ink}">${n} czeka</text></g>`;
}

/** The globe as a chart: sea, land, graticule, night hatch, terminator, routes, cities, hubs, planes. */
function chartGlobe(g, { drag = true, labels = true, tag = [-150, -60] } = {}) {
  const night = g.night(SUN.lon, SUN.lat);
  let o = `<g><path d="${g.sphere()}" fill="${C.sea}"/>`;
  o += `<path d="${g.land(50)}" fill="${C.land}" stroke="${C.blue}" stroke-width=".7" stroke-opacity=".7"/>`;
  o += `<path d="${g.graticule()}" fill="none" stroke="${C.ink}" stroke-width=".5" opacity=".14"/>`;
  o += `<path d="${night}" fill="url(#hatch)"/><path d="${night}" fill="none" stroke="${C.hatch}" stroke-width="1.2" stroke-dasharray="10 3 2 3"/>`;
  o += `<path d="${g.sphere()}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>`;
  o += ROUTES.map(([a, b, t]) => routeLine(g, a, b, t)).join('');
  if (drag) {
    // Drawing a route LIS → ACC with a turboprop selected: range circle + preview turns vermilion past range.
    const lis = g.city('LIS'), acc = g.city('ACC');
    o += `<path d="${g.path(geoCircle().center([CITIES.LIS.lon, CITIES.LIS.lat]).radius(2500 / 111.2)())}" fill="none" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 3"/>`;
    const rp = g.pt(-9.1 - 9.5, 38.7 - 19.5);
    o += label(rp[0] + 70, rp[1] + 26, 'ZASIĘG TURBOŚMIGŁOWCA 2500 KM', 'middle', 7.5, 600);
    const { front } = g.arc('LIS', 'ACC', 0.04);
    o += `<path d="${front}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="7 3.5" opacity=".9"/>`;
    const cut = g.arcAt('LIS', 'ACC', 0.62, 0.04);
    o += `<circle cx="${acc.xy[0]}" cy="${acc.xy[1]}" r="24" fill="${C.ink}" fill-opacity=".08" stroke="${C.ink}" stroke-width="1.5"/>`;
    o += `<path d="M${cut.x - 5} ${cut.y - 5} L${cut.x + 5} ${cut.y + 5} M${cut.x + 5} ${cut.y - 5} L${cut.x - 5} ${cut.y + 5}" stroke="${C.verm}" stroke-width="2.4"/>`;
    o += `<g transform="translate(${acc.xy[0] + tag[0]} ${acc.xy[1] + tag[1]})"><rect x="0" y="-11" width="118" height="30" fill="${C.land}" stroke="${C.verm}" stroke-width="1.2"/>
      <text x="6" y="1" font-family="PlexMono" font-weight="600" font-size="10" fill="${C.verm}">${nf(km('LIS', 'ACC'))} KM</text>
      <text x="6" y="13" font-family="Plex" font-size="8.5" fill="${C.ink}">za daleko · dodaj międzylądowanie</text></g>`;
  }
  o += Object.keys(CITIES_WAITING).map((k) => citySym(g, k)).join('');
  // new city marker: chart "new" tag with leader
  const nc = g.city(NEW_CITY);
  if (nc.vis && !drag) o += `<circle cx="${nc.xy[0]}" cy="${nc.xy[1]}" r="16" fill="none" stroke="${C.magenta}" stroke-width="1" stroke-dasharray="2 2"/>`;
  o += Object.keys(HUBS).map((k) => hubSym(g, k)).join('');
  o += flights(g);
  // queues
  const q = (code, dx, dy, dir = 1) => { const c = g.city(code); return c.vis ? queue(c.xy[0] + dx, c.xy[1] + dy, (HUBS[code]?.waiting) || CITIES_WAITING[code], dir) : ''; };
  o += q('LON', -30, -34, -1) + q('IST', 30, 8) + q('LIS', -34, 16, -1) + q('NYC', 6, 22) + q('ROM', 10, 4) + q('MAD', -10, 16, -1) + q('WAW', 8, -12) + q('CAI', 18, 22) + q('LOS', 8, 18) + q('DKR', -10, 18, -1);
  if (labels) {
    const L = (code, dx, dy, a = 'start', extra = '') => { const c = g.city(code); return c.vis ? label(c.xy[0] + dx, c.xy[1] + dy, (CITIES[code].name.toUpperCase()) + extra, a) : ''; };
    o += L('LON', -36, -22, 'end') + L('LIS', -30, -6, 'end') + L('IST', -30, -26, 'end') + L('NYC', -14, -12, 'end') + L('CAI', -22, 26, 'end') + L('KIV', 22, 4, 'start').replace('KIJÓW','KIJÓW');
    const cai = g.city('CAI'); if (cai.vis) o += label(cai.xy[0] - 22, cai.xy[1] + 38, 'R · CISZA NOCNA 23–06', 'end', 7.5, 600, C.magenta);
    const lon = g.city('LON'); if (lon.vis) o += `<text x="${lon.xy[0] - 36}" y="${lon.xy[1] - 9}" text-anchor="end" font-family="PlexMono" font-weight="600" font-size="9" fill="${C.verm}" paint-order="stroke" stroke="${C.land}" stroke-width="3">${HUBS.LON.waiting.length}/${HUBS.LON.cap} · PRZESIADKA 25 MIN</text>`;
  }
  return o + '</g>';
}

/** Week as a chart scale bar: 7 alternating segments, filled up to the current day. */
function scaleBar(x, y, w, day = 3) {
  const s = w / 7; let o = `<g>`;
  for (let i = 0; i < 7; i++) o += `<rect x="${x + i * s}" y="${y}" width="${s}" height="5" fill="${i < day ? (i % 2 ? C.ink : C.ink) : (i % 2 ? C.land : C.paper)}" stroke="${C.ink}" stroke-width=".8" ${i < day && i % 2 ? 'opacity=".7"' : ''}/>`;
  'PWŚCPSN'.split('').forEach((d, i) => { o += `<text x="${x + i * s + s / 2}" y="${y + 15}" font-family="PlexMono" font-size="7.5" text-anchor="middle" fill="${C.ink}" opacity="${i === day - 1 ? 1 : 0.55}">${d}</text>`; });
  return o + '</g>';
}

const btn = (x, y, w, h, inner, primary = false) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${primary ? C.ink : C.land}" stroke="${C.ink}" stroke-width="1.2"/>${inner}</g>`;
const pauseIcon = (cx, cy) => `<rect x="${cx - 6}" y="${cy - 8}" width="4" height="16" fill="${C.ink}"/><rect x="${cx + 2}" y="${cy - 8}" width="4" height="16" fill="${C.ink}"/>`;
const undoIcon = (cx, cy, col = C.ink) => `<path d="M${cx + 8} ${cy + 7} A8 8 0 1 0 ${cx - 6} ${cy - 2}" fill="none" stroke="${col}" stroke-width="2.2"/><path d="M${cx - 11} ${cy - 7} L${cx - 6} ${cy + 1} L${cx - 1} ${cy - 6}Z" fill="${col}"/>`;

/** Dock cells: undo · turboprop ×2 · widebody ×1 · hub expansion ×0 · speed. Horizontal or vertical. */
function dock(x, y, len, vertical) {
  const cells = [
    { w: 56, inner: (cx, cy) => undoIcon(cx, cy) },
    { w: 78, inner: (cx, cy) => plane('turboprop', cx - 12, cy, -90, 1.05, `fill="${C.ink}"`) + `<text x="${cx + 6}" y="${cy + 6}" font-family="Shoulders" font-weight="800" font-size="20" fill="${C.ink}">×2</text>` },
    { w: 78, inner: (cx, cy) => plane('widebody', cx - 12, cy, -90, 0.95, `fill="${C.blue}"`) + `<text x="${cx + 6}" y="${cy + 6}" font-family="Shoulders" font-weight="800" font-size="20" fill="${C.blue}">×1</text>` },
    { w: 78, inner: (cx, cy) => { let o = ''; for (let i = 0; i < 8; i++) { const a = (i + .5) * 45, [a0, b0] = polar(cx - 12, cy, 6, a), [a1, b1] = polar(cx - 12, cy, 11, a); o += `<line x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}" stroke="${C.ink}" stroke-width="2"/>`; } return o + `<text x="${cx + 6}" y="${cy + 6}" font-family="Shoulders" font-weight="800" font-size="20" fill="${C.ink}" opacity=".35">×0</text>`; } },
    { w: 56, inner: (cx, cy) => `<path d="M${cx - 10} ${cy - 8} L${cx} ${cy} L${cx - 10} ${cy + 8}Z M${cx} ${cy - 8} L${cx + 10} ${cy} L${cx} ${cy + 8}Z" fill="${C.ink}"/>` },
  ];
  const total = cells.reduce((s, c) => s + c.w, 0), k = len / total, H = 64;
  let o = vertical
    ? `<rect x="${x}" y="${y}" width="${H}" height="${len}" fill="${C.land}" stroke="${C.ink}" stroke-width="1.4"/><rect x="${x - 3}" y="${y - 3}" width="${H + 6}" height="${len + 6}" fill="none" stroke="${C.ink}" stroke-width=".6"/>`
    : `<rect x="${x}" y="${y}" width="${len}" height="${H}" fill="${C.land}" stroke="${C.ink}" stroke-width="1.4"/><rect x="${x - 3}" y="${y - 3}" width="${len + 6}" height="${H + 6}" fill="none" stroke="${C.ink}" stroke-width=".6"/>`;
  let p = 0;
  cells.forEach((c, i) => {
    const w = c.w * k;
    if (vertical) { o += c.inner(x + H / 2 + 4, y + p + w / 2); if (i) o += `<line x1="${x}" y1="${y + p}" x2="${x + H}" y2="${y + p}" stroke="${C.ink}" stroke-width=".8"/>`; }
    else { o += c.inner(x + p + w / 2 + (i && i < 4 ? 4 : 0), y + H / 2); if (i) o += `<line x1="${x + p}" y1="${y}" x2="${x + p}" y2="${y + H}" stroke="${C.ink}" stroke-width=".8"/>`; }
    p += w;
  });
  return o;
}

function topStrip(x, y, w) {
  return `<g><text x="${x}" y="${y + 14}" class="hd" font-family="Shoulders" font-weight="800" font-size="19" fill="${C.ink}">TYDZIEŃ ${CLOCK.week}</text>
  <text x="${x + 92}" y="${y + 14}" font-family="PlexMono" font-weight="600" font-size="12" fill="${C.ink}">${CLOCK.dayPl.toUpperCase()} ${CLOCK.time} UTC</text>
  ${scaleBar(x, y + 22, 150)}
  <text x="${x + w - 62}" y="${y + 14}" font-family="PlexMono" font-weight="600" font-size="13" text-anchor="end" fill="${C.ink}">${nf(CLOCK.pax)}</text>
  <text x="${x + w - 62}" y="${y + 27}" font-family="Plex" font-size="8.5" text-anchor="end" fill="${C.ink}" letter-spacing=".08em">PASAŻERÓW</text>
  ${btn(x + w - 48, y - 4, 48, 48, pauseIcon(x + w - 24, y + 20))}</g>`;
}

function neatline(w, h, sf) {
  return `<rect x="6" y="${sf.t - 26}" width="${w - 12}" height="${h - sf.t - sf.b + 32}" fill="none" stroke="${C.ink}" stroke-width=".6" opacity=".5"/>`;
}

function gameP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 206, cy: 450, r: 470, rotate: [-6, -38, 0] });
  const finger = g.city('ACC'), ny = g.city('NYC');
  const edge = ny.xy[0] < 0 ? edgeMarker(14, Math.min(h - 140, Math.max(120, ny.xy[1] + (ny.xy[1] - g.city('LON').xy[1]) * 0)), 180, 'NYC', 3) : '';
  const body = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}
  <rect width="${w}" height="${h}" fill="url(#grain)"/>${neatline(w, h, sf)}
  ${chartGlobe(g)}
  <circle cx="${finger.xy[0] + 6}" cy="${finger.xy[1] + 8}" r="22" fill="${C.ink}" fill-opacity=".12"/>${edge}
  <rect x="0" y="0" width="${w}" height="${sf.t + 52}" fill="${C.paper}" opacity=".93"/><line x1="12" y1="${sf.t + 52}" x2="${w - 12}" y2="${sf.t + 52}" stroke="${C.ink}" stroke-width=".8"/>
  ${topStrip(16, sf.t + 4, w - 32)}
  <rect x="0" y="${h - sf.b - 88}" width="${w}" height="${88 + sf.b}" fill="${C.paper}" opacity=".93"/>
  ${dock(16, h - sf.b - 76, w - 32, false)}
  </svg>`;
  writePage(dir, 'game-p', { w, h, title: 'Mapa pilota — gra', fonts: FONTS, css: CSS, body });
}

function gameL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 520, cy: 175, r: 340, rotate: [-4, -32, 0] });
  const body = `<svg width="${w}" height="${h}">${defs}<rect width="${w}" height="${h}" fill="url(#grain)"/>
  ${chartGlobe(g, { tag: [40, -14] })}
  <rect x="0" y="0" width="${sf.l + 196}" height="${h}" fill="${C.paper}" opacity=".93"/><line x1="${sf.l + 196}" y1="12" x2="${sf.l + 196}" y2="${h - 12}" stroke="${C.ink}" stroke-width=".8"/>
  <g transform="translate(${sf.l + 12} 22)">
    <text x="0" y="14" font-family="Shoulders" font-weight="800" font-size="22" fill="${C.ink}">TYDZIEŃ ${CLOCK.week}</text>
    <text x="0" y="32" font-family="PlexMono" font-weight="600" font-size="12" fill="${C.ink}">${CLOCK.dayPl.toUpperCase()} ${CLOCK.time} UTC</text>
    ${scaleBar(0, 42, 150)}
    <text x="0" y="98" font-family="PlexMono" font-weight="600" font-size="16" fill="${C.ink}">${nf(CLOCK.pax)}</text>
    <text x="0" y="111" font-family="Plex" font-size="8.5" fill="${C.ink}" letter-spacing=".08em">PASAŻERÓW</text>
    ${btn(112, 76, 48, 48, pauseIcon(136, 100))}
    <text x="0" y="160" font-family="Plex" font-weight="600" font-size="8.5" fill="${C.ink}" letter-spacing=".08em">LEGENDA</text>
    <line x1="0" y1="176" x2="30" y2="176" stroke="${C.blue}" stroke-width="5"/><line x1="0" y1="176" x2="30" y2="176" stroke="${C.land}" stroke-width="1.8"/>
    <text x="38" y="179" font-family="Plex" font-size="9.5" fill="${C.ink}">szerokokadłubowy</text>
    <line x1="0" y1="194" x2="30" y2="194" stroke="${C.magenta}" stroke-width="2.2" stroke-dasharray="7 3.5"/>
    <text x="38" y="197" font-family="Plex" font-size="9.5" fill="${C.ink}">turbośmigłowy</text>
    <rect x="0" y="206" width="30" height="12" fill="url(#hatch)" stroke="${C.hatch}" stroke-width=".8"/>
    <text x="38" y="215" font-family="Plex" font-size="9.5" fill="${C.ink}">noc · popyt rośnie o świcie</text>
  </g>
  <rect x="${w - sf.r - 92}" y="0" width="${sf.r + 92}" height="${h}" fill="${C.paper}" opacity=".93"/>
  ${dock(w - sf.r - 80, 18, h - 36 - sf.b, true)}
  </svg>`;
  writePage(dir, 'game-l', { w, h, title: 'Mapa pilota — gra (poziomo)', fonts: FONTS, css: CSS, body });
}

/** Upgrade plates: drawn like approach-plate sheets (header band, plan view, spec line). */
function plate(x, y, w, h, u, i) {
  const wide = w > 300; const cx = wide ? x + 76 : x + w / 2, cy = wide ? y + 26 + (h - 26) / 2 : y + 92;
  let art = '';
  if (u.id === 'turboprop' || u.id === 'widebody') {
    const big = 56; const R = u.id === 'turboprop' ? big * 0.45 : big;
    art += `<circle cx="${cx}" cy="${cy}" r="${big}" fill="none" stroke="${C.ink}" stroke-width=".6" opacity=".35"/>`;
    art += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="2 3"/>`;
    art += plane(u.id, cx, cy, -90, u.id === 'turboprop' ? 1.6 : 1.8, `fill="${u.id === 'widebody' ? C.blue : C.ink}"`);
  } else {
    for (let k = 0; k < 14; k++) { const a = (k + .5) * 360 / 14, [a0, b0] = polar(cx, cy, 16, a), [a1, b1] = polar(cx, cy, 28, a); art += `<line x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}" stroke="${k >= 8 ? C.verm : C.blue}" stroke-width="${k >= 8 ? 3 : 2}"/>`; }
    art += `<circle cx="${cx}" cy="${cy}" r="13" fill="${C.blue}"/>` + glyph('chevron', cx, cy, .75, `fill="${C.land}"`);
    art += `<circle cx="${cx}" cy="${cy}" r="36" fill="none" stroke="${C.blue}" stroke-width="1"/>`;
  }
  const tx = x + (wide ? 150 : 16); const ty = wide ? 0 : 108;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.land}" stroke="${C.ink}" stroke-width="1.4"/>
  <rect x="${x}" y="${y}" width="${w}" height="26" fill="${C.ink}"/>
  <text x="${x + 10}" y="${y + 18}" font-family="PlexMono" font-weight="600" font-size="11" fill="${C.land}" letter-spacing=".1em">ARKUSZ ${String.fromCharCode(65 + i)}</text>
  <text x="${x + w - 10}" y="${y + 18}" font-family="PlexMono" font-size="11" fill="${C.land}" text-anchor="end">${u.note.toUpperCase()}</text>
  ${art}
  <text x="${tx}" y="${y + 66 + ty}" font-family="Shoulders" font-weight="800" font-size="24" fill="${C.ink}">${u.pl.toUpperCase()}</text>
  ${u.specPl.split(' · ').map((s, k) => `<text x="${tx}" y="${y + 90 + ty + k * 17}" font-family="PlexMono" font-size="11.5" fill="${C.ink}">${s}</text>`).join('')}
  <line x1="${tx}" y1="${y + h - 30}" x2="${x + w - 12}" y2="${y + h - 30}" stroke="${C.ink}" stroke-width=".6"/>
  <text x="${tx}" y="${y + h - 13}" font-family="Plex" font-size="9.5" fill="${C.ink}" opacity=".75">${['tani, krótkie trasy', 'otwiera oceany', 'LON jest blisko limitu'][i]}</text></g>`;
}

function upgradeP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 214, cy: 300, r: 220, rotate: [14, -37, 0] });
  const ph = 184;
  const body = `<svg width="${w}" height="${h}">${defs}<rect width="${w}" height="${h}" fill="url(#grain)"/>
  <g opacity=".35">${chartGlobe(g, { drag: false, labels: false })}</g>
  <rect width="${w}" height="${h}" fill="${C.paper}" opacity=".55"/>
  <text x="20" y="${sf.t + 34}" font-family="Shoulders" font-weight="800" font-size="40" fill="${C.ink}">TYDZIEŃ ${CLOCK.week + 1}</text>
  <text x="20" y="${sf.t + 58}" font-family="Plex" font-weight="600" font-size="14" fill="${C.ink}">Nowy przydział. Weź jeden arkusz.</text>
  ${scaleBar(250, sf.t + 18, 140, 0)}
  ${UPGRADES.map((u, i) => plate(16, 300 + i * (ph + 14), w - 32, ph, u, i)).join('')}
  </svg>`;
  writePage(dir, 'upgrade-p', { w, h, title: 'Mapa pilota — ulepszenie', fonts: FONTS, css: CSS, body });
}
function upgradeL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 457, cy: 240, r: 260, rotate: [14, -37, 0] });
  const pw = (w - sf.l - sf.r - 32 - 28) / 3;
  const body = `<svg width="${w}" height="${h}">${defs}<rect width="${w}" height="${h}" fill="url(#grain)"/>
  <g opacity=".3">${chartGlobe(g, { drag: false, labels: false })}</g><rect width="${w}" height="${h}" fill="${C.paper}" opacity=".55"/>
  <text x="${sf.l + 16}" y="46" font-family="Shoulders" font-weight="800" font-size="36" fill="${C.ink}">TYDZIEŃ ${CLOCK.week + 1}</text>
  <text x="${sf.l + 196}" y="44" font-family="Plex" font-weight="600" font-size="14" fill="${C.ink}">Nowy przydział. Weź jeden arkusz.</text>
  ${UPGRADES.map((u, i) => plate(sf.l + 16 + i * (pw + 14), 70, pw, h - 70 - sf.b - 8, u, i)).join('')}
  </svg>`;
  writePage(dir, 'upgrade-l', { w, h, title: 'Mapa pilota — ulepszenie (poziomo)', fonts: FONTS, css: CSS, body });
}

function menuItems(x, y, w) {
  const items = [
    ['Lot bez końca', 'rekord: 2 914 pasażerów', true],
    ['Zadania', '12 z 40 arkuszy rozwiązanych'],
    ['Wyzwanie dnia', '02.11 · ten sam świat dla wszystkich'],
    ['Ustawienia', ''],
  ];
  return items.map(([t, s, p], i) => {
    const yy = y + i * 64, H = 56;
    return `<g><rect x="${x}" y="${yy}" width="${w}" height="${H}" fill="${p ? C.ink : C.land}" stroke="${C.ink}" stroke-width="1.2"/>
    ${p ? plane('widebody', x + 28, yy + H / 2, 0, 1.1, `fill="${C.land}"`) : `<text x="${x + 28}" y="${yy + 34}" font-family="PlexMono" font-weight="600" font-size="13" fill="${C.ink}" text-anchor="middle">${String(i).padStart(2, '0')}</text>`}
    <text x="${x + 54}" y="${yy + (s ? 26 : 35)}" font-family="Shoulders" font-weight="800" font-size="22" fill="${p ? C.land : C.ink}">${t.toUpperCase()}</text>
    ${s ? `<text x="${x + 54}" y="${yy + 43}" font-family="Plex" font-size="10.5" fill="${p ? C.land : C.ink}" opacity=".8">${s}</text>` : ''}</g>`;
  }).join('');
}

function titleBlock(x, y, size = 64) {
  return `<g><text x="${x}" y="${y}" font-family="Shoulders" font-weight="800" font-size="${size}" fill="${C.ink}" letter-spacing=".01em">${TITLE.main}</text>
  <line x1="${x}" y1="${y + 12}" x2="${x + size * 4.1}" y2="${y + 12}" stroke="${C.ink}" stroke-width="1.2"/>
  <text x="${x}" y="${y + 30}" font-family="PlexMono" font-size="11" fill="${C.ink}" letter-spacing=".08em">MAPA SIECI · ARKUSZ 1 : 40 000 000</text>
  <text x="${x}" y="${y + 46}" font-family="PlexMono" font-size="11" fill="${C.magenta}" letter-spacing=".08em">${TITLE.sub.toUpperCase()}</text></g>`;
}

function menuP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 300, cy: 400, r: 250, rotate: [14, -37, 0] });
  const body = `<svg width="${w}" height="${h}">${defs}<rect width="${w}" height="${h}" fill="url(#grain)"/>${neatline(w, h, sf)}
  <g>${chartGlobe(g, { drag: false, labels: false })}</g>
  <rect x="0" y="0" width="${w}" height="${sf.t + 120}" fill="${C.paper}" opacity=".9"/>
  ${titleBlock(20, sf.t + 62)}
  <rect x="0" y="${h - sf.b - 290}" width="${w}" height="${290 + sf.b}" fill="${C.paper}" opacity=".92"/>
  ${menuItems(16, h - sf.b - 272, w - 32)}
  </svg>`;
  writePage(dir, 'menu-p', { w, h, title: 'Mapa pilota — menu', fonts: FONTS, css: CSS, body });
}
function menuL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 640, cy: 230, r: 250, rotate: [14, -37, 0] });
  const body = `<svg width="${w}" height="${h}">${defs}<rect width="${w}" height="${h}" fill="url(#grain)"/>
  <g>${chartGlobe(g, { drag: false, labels: false })}</g>
  <rect x="0" y="0" width="${sf.l + 380}" height="${h}" fill="${C.paper}" opacity=".93"/>
  ${titleBlock(sf.l + 16, 74, 54)}
  ${menuItems(sf.l + 16, 150, 340).replace(/<g>/g, '<g>')}
  </svg>`;
  writePage(dir, 'menu-l', { w, h, title: 'Mapa pilota — menu (poziomo)', fonts: FONTS, css: CSS, body });
}

gameP(); gameL(); upgradeP(); upgradeL(); menuP(); menuL();

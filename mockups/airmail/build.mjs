// Direction "Poczta lotnicza" (Air Mail): consciously in the studio family — flat outlined illustration, warm
// daylight, a world full of small drawn things. Cities are postage stamps with their skyline; the stamp's
// perforation teeth are the hub's seats (filled = taken), long-haul routes wear the par-avion ribbon.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains, geoCircle } from 'd3-geo';
import { makeGlobe, CITIES, land50, rng } from '../lib/geo.mjs';
import { writePage, SAFE } from '../lib/page.mjs';
import { glyph, plane, km, nf } from '../lib/draw.mjs';
import { REGIONS, CITY_REGION, ROUTES, FLIGHTS, HUBS, CITIES_WAITING, CURFEW, SUN, CLOCK, TITLE, UPGRADES } from '../lib/scene.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const C = {
  sky: '#BFE3EC', sea: '#8FCADB', seaDeep: '#6FB3CB', wave: '#E9F6F8', land: '#B9D98A', land2: '#9CC572', sand: '#EED9A2', dune: '#D9B871',
  ink: '#2E2B28', paper: '#FBF4E4', cream: '#F3EAD7', red: '#C8332B', blue: '#1F3F8F', mustard: '#D9A21B', snow: '#FFFFFF', rock: '#B7A98F',
  night: '#1B2440', tree: '#5E9A4C', tree2: '#7DB35A', trunk: '#8A5A36', roof: '#D9653B',
};
const DEST = { NAM: '#1F3F8F', EUN: '#2E8B57', EUS: '#D9A21B', AFR: '#C8332B', ME: '#B05AA8', SAM: '#8AD3E6' }; // CVD-checked (min ΔE ≥ 16)
const FONTS = [
  { family: 'Young', file: 'YoungSerif-400.ttf', weight: 400 },
  { family: 'Fam', file: 'FamiljenGrotesk-400.ttf', weight: 400 }, { family: 'Fam', file: 'FamiljenGrotesk-700.ttf', weight: 700 },
];
const CSS = `body{background:${C.sky};font-family:Fam,sans-serif;color:${C.ink}}`;
const S = `stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const MOUNTAINS = [[7, 46.2], [9.5, 46.6], [12, 47], [14, 46.6], [0.5, 42.7], [-1.5, 42.9], [-6, 31.6], [-3.5, 32.8], [-8, 31], [8, 61.5], [11, 63], [14.5, 66], [24, 47.5], [25.5, 45.8], [33, 38.5], [36, 39.5], [-19, 64.6], [21, 42], [43, 43], [-4, 37.2]];
const SAHARA = { type: 'Polygon', coordinates: [[[-16, 16], [-16, 30], [-5, 32], [10, 32], [25, 31], [33, 30], [36, 22], [33, 15], [15, 14], [0, 14], [-16, 16]]] };

/** Ocean wave marks, trees, mountains, dunes: the illustrated texture of the world. */
function decor(g, seed = 3) {
  const R = rng(seed); let o = '';
  for (let i = 0; i < 900; i++) {
    const lon = -60 + R() * 110, lat = -10 + R() * 75; if (!g.visible(lon, lat)) continue;
    const [x, y] = g.pt(lon, lat), onLand = geoContains(land50, [lon, lat]);
    if (!onLand && R() < .35) o += `<path d="M${x - 6} ${y} q3 -3 6 0 t6 0" fill="none" stroke="${C.wave}" stroke-width="1.8" stroke-linecap="round"/>`;
    else if (onLand && !geoContains(SAHARA, [lon, lat]) && lat < 66 && R() < .55) {
      const s = .8 + R() * .5, c = R() > .5 ? C.tree : C.tree2;
      o += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><line x1="0" y1="0" x2="0" y2="6" stroke="${C.trunk}" stroke-width="2"/><circle cx="0" cy="-2" r="5" fill="${c}" ${S} stroke-width="1.5"/></g>`;
    } else if (onLand && geoContains(SAHARA, [lon, lat]) && R() < .5) o += `<path d="M${x - 8} ${y} q8 -6 16 0" fill="none" stroke="${C.dune}" stroke-width="2" stroke-linecap="round"/>`;
  }
  for (const [lon, lat] of MOUNTAINS) {
    if (!g.visible(lon, lat)) continue; const [x, y] = g.pt(lon, lat);
    o += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M-16 8 L-4 -12 L8 8Z" fill="${C.rock}" ${S}/><path d="M-9 -4 L-4 -12 L1 -4 L-2 -6 L-4 -3 L-7 -6Z" fill="${C.snow}" stroke="${C.ink}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 8 L10 -6 L20 8Z" fill="${C.rock}" ${S}/></g>`;
  }
  return o;
}

/** Puffy outlined clouds with a flat offset shadow on the ground. */
function cloudsSvg(g, list) {
  return list.map(([lon, lat, s]) => {
    if (!g.visible(lon, lat)) return ''; const [x, y] = g.pt(lon, lat);
    const d = `M-26 6 q-8 -14 8 -16 q4 -14 20 -10 q10 -10 22 0 q14 0 12 14 q6 12 -10 12 Z`;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><path d="${d}" transform="translate(10 22)" fill="${C.ink}" opacity=".13"/><path d="${d}" fill="#fff" ${S}/></g>`;
  }).join('');
}

/** Generic skyline drawn inside a stamp; hubs get their landmark. */
function skyline(code, w, h, seed) {
  const R = rng(seed); let o = `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.sky}"/><circle cx="${w * .75}" cy="${h * .3}" r="${h * .14}" fill="#FFE08A"/>`;
  o += `<rect x="0" y="${h * .8}" width="${w}" height="${h * .2}" fill="${C.land2}"/>`;
  const lm = { LON: 'tower', LIS: 'belem', IST: 'dome' }[code];
  let x = 2;
  while (x < w - 4) {
    const bw = 5 + R() * 6, bh = h * (.25 + R() * .3), col = ['#F2E6CF', '#E7C9A0', '#D9B48A', '#F5F0E6'][Math.floor(R() * 4)];
    o += `<rect x="${x}" y="${h * .82 - bh}" width="${bw}" height="${bh}" fill="${col}" stroke="${C.ink}" stroke-width="1"/>`;
    if (R() > .5) o += `<path d="M${x} ${h * .82 - bh} L${x + bw / 2} ${h * .82 - bh - 4} L${x + bw} ${h * .82 - bh}Z" fill="${C.roof}" stroke="${C.ink}" stroke-width="1"/>`;
    x += bw + 1;
  }
  const cx = w * .42, base = h * .82;
  if (lm === 'tower') o += `<rect x="${cx - 4}" y="${base - h * .62}" width="8" height="${h * .62}" fill="#E7C9A0" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${cx}" cy="${base - h * .5}" r="3" fill="#fff" stroke="${C.ink}" stroke-width="1"/><path d="M${cx - 5} ${base - h * .62} L${cx} ${base - h * .8} L${cx + 5} ${base - h * .62}Z" fill="${C.blue}" stroke="${C.ink}" stroke-width="1.2"/>`;
  if (lm === 'belem') o += `<rect x="${cx - 7}" y="${base - h * .45}" width="14" height="${h * .45}" fill="#F5F0E6" stroke="${C.ink}" stroke-width="1.2"/><path d="M${cx - 7} ${base - h * .45} v-3 h3 v3 h2 v-3 h4 v3 h2 v-3 h3 v3" fill="none" stroke="${C.ink}" stroke-width="1.2"/><rect x="${cx - 3}" y="${base - h * .62}" width="6" height="${h * .17}" fill="#F5F0E6" stroke="${C.ink}" stroke-width="1.2"/>`;
  if (lm === 'dome') o += `<path d="M${cx - 10} ${base - h * .3} a10 10 0 0 1 20 0Z" fill="#9FB7C9" stroke="${C.ink}" stroke-width="1.2"/><rect x="${cx - 10}" y="${base - h * .3}" width="20" height="${h * .3}" fill="#F2E6CF" stroke="${C.ink}" stroke-width="1.2"/><rect x="${cx - 15}" y="${base - h * .66}" width="3" height="${h * .66}" fill="#F2E6CF" stroke="${C.ink}" stroke-width="1"/><rect x="${cx + 12}" y="${base - h * .66}" width="3" height="${h * .66}" fill="#F2E6CF" stroke="${C.ink}" stroke-width="1"/>`;
  return o;
}

/** Stamp: perforated edge (teeth = seats for hubs), skyline, region glyph corner, code. */
function stamp(x, y, w, h, code, { teeth = 0, filled = 0, warn = false, closed = false, seed = 1 } = {}) {
  const id = 'st' + code + Math.round(x);
  const per = 5; let edge = '';
  // perforation: semicircle bites along all four sides
  const bites = [];
  for (let px = per; px < w; px += per * 2) bites.push([px, 0], [px, h]);
  for (let py = per; py < h; py += per * 2) bites.push([0, py], [w, py]);
  edge = bites.map(([bx, by]) => `<circle cx="${bx}" cy="${by}" r="2.6" fill="#000"/>`).join('');
  let o = `<g transform="translate(${(x - w / 2).toFixed(1)} ${(y - h / 2).toFixed(1)})">
  <defs><mask id="${id}"><rect x="-3" y="-3" width="${w + 6}" height="${h + 6}" fill="#fff"/>${edge}</mask><clipPath id="${id}c"><rect x="4" y="4" width="${w - 8}" height="${h - 8}"/></clipPath></defs>
  <rect x="3" y="4" width="${w}" height="${h}" fill="${C.ink}" opacity=".2" mask="url(#${id})"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.2" mask="url(#${id})"/>
  <g clip-path="url(#${id}c)"><g transform="translate(4 4)">${skyline(code, w - 8, h - 8, seed)}</g></g>
  <rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`;
  const reg = REGIONS[CITY_REGION[code]].glyph;
  o += `<circle cx="${w - 9}" cy="9" r="7" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.2"/>` + glyph(reg, w - 9, 9, .5, `fill="${C.ink}"`);
  if (teeth) { // seats: filled ticks along the bottom strip
    const bw = (w - 12) / teeth;
    for (let i = 0; i < teeth; i++) o += `<rect x="${6 + i * bw + .8}" y="${h + 4}" width="${bw - 1.6}" height="6" rx="1" fill="${i < filled ? (warn ? C.red : C.ink) : C.paper}" stroke="${C.ink}" stroke-width="1"/>`;
  }
  if (closed) o += `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="${C.night}" opacity=".55"/><path d="M${w * .25} ${h * .2} a${h * .22} ${h * .22} 0 1 0 ${h * .24} ${h * .36} a${h * .17} ${h * .17} 0 0 1 -${h * .24} -${h * .36}Z" fill="#FFE08A" stroke="${C.ink}" stroke-width="1"/><text x="${w / 2}" y="${h - 9}" font-family="Fam" font-weight="700" font-size="8" text-anchor="middle" fill="#fff">23–06</text>`;
  if (warn) o += `<g transform="translate(${w - 6} ${h - 4}) rotate(-14)"><circle r="15" fill="none" stroke="${C.red}" stroke-width="2.4"/><circle r="11" fill="none" stroke="${C.red}" stroke-width="1"/><text y="4" font-family="Fam" font-weight="700" font-size="10" text-anchor="middle" fill="${C.red}">0:42</text></g>`;
  return o + '</g>';
}

/** Route ribbon: widebody = par-avion striped ribbon, turboprop = cream ribbon with a dashed seam. */
function ribbon(g, a, b, type, id) {
  const { front } = g.arc(a, b, type === 'widebody' ? 0.1 : 0.04); if (!front) return '';
  if (type === 'widebody') return `<path d="${front}" fill="none" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/><path d="${front}" fill="none" stroke="${C.paper}" stroke-width="7" stroke-linecap="round"/>
    <path d="${front}" fill="none" stroke="${C.red}" stroke-width="7" stroke-dasharray="7 14"/><path d="${front}" fill="none" stroke="${C.blue}" stroke-width="7" stroke-dasharray="7 14" stroke-dashoffset="-10.5"/>`;
  return `<path d="${front}" fill="none" stroke="${C.ink}" stroke-width="7.5" stroke-linecap="round"/><path d="${front}" fill="none" stroke="${C.cream}" stroke-width="4.5" stroke-linecap="round"/><path d="${front}" fill="none" stroke="${C.mustard}" stroke-width="1.4" stroke-dasharray="4 4"/>`;
}

function planes(g) {
  return FLIGHTS.map(([a, b, t, , type]) => {
    const p = g.arcAt(a, b, t, type === 'widebody' ? 0.1 : 0.04); if (!p.front) return '';
    const s = type === 'widebody' ? 1.35 : 1.15;
    return `<g><g transform="translate(9 14)" opacity=".18">${plane(type, p.x, p.y, p.deg, s, `fill="${C.ink}"`)}</g>${plane(type, p.x, p.y, p.deg, s, `fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"`)}${type === 'widebody' ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4" fill="${C.red}"/>` : ''}</g>`;
  }).join('');
}

/** Passengers waiting: luggage tags with the destination glyph. */
function tags(x, y, list, per = 6) {
  return list.map((r, i) => {
    const tx = x + (i % per) * 15, ty = y + Math.floor(i / per) * 18;
    return `<g transform="translate(${tx} ${ty})"><path d="M-6 -7 h9 l4 4 v10 h-13Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="3.5" cy="-3.5" r="1" fill="${C.ink}"/>${glyph(REGIONS[r].glyph, -.5, 2, .42, `fill="${DEST[r]}"`)}</g>`;
  }).join('');
}

function world(g, { drag = true, detail = true } = {}) {
  const night = g.night(SUN.lon, SUN.lat);
  let o = `<defs><clipPath id="globe"><path d="${g.sphere()}"/></clipPath><clipPath id="landc"><path d="${g.land(50)}"/></clipPath></defs>`;
  o += `<path d="${g.sphere()}" fill="${C.sea}"/>`;
  o += `<g clip-path="url(#globe)">`;
  o += `<path d="${g.land(50)}" fill="${C.land}" stroke="${C.wave}" stroke-width="7" stroke-opacity=".7"/>`;
  o += `<g clip-path="url(#landc)"><path d="${g.path(SAHARA)}" fill="${C.sand}"/></g>`;
  o += `<path d="${g.land(50)}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
  if (detail) o += decor(g);
  o += `<path d="${night}" fill="${C.night}" opacity=".42"/>`;
  // stars only over the night sea, a few — the night reads as a place, not a filter
  o += ROUTES.map(([a, b, t], i) => ribbon(g, a, b, t, i)).join('');
  if (drag) {
    const { front } = g.arc('LIS', 'ACC', 0.04);
    o += `<path d="${front}" fill="none" stroke="${C.ink}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>`;
    const cut = g.arcAt('LIS', 'ACC', 0.64, 0.04);
    o += `<g transform="translate(${cut.x} ${cut.y})"><circle r="11" fill="${C.red}" ${S}/><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>`;
  }
  o += planes(g);
  o += cloudsSvg(g, [[-28, 45, 1.1], [-12, 55, .8], [15, 30, .9], [-20, 22, 1], [30, 55, .9], [5, 12, 1.1], [-40, 30, .8]]);
  o += `</g><path d="${g.sphere()}" fill="none" stroke="${C.ink}" stroke-width="2.5"/>`;
  // cities and hubs on top
  let seed = 10;
  for (const k of Object.keys(CITIES_WAITING)) { const c = g.city(k); if (c.vis) o += stamp(c.xy[0], c.xy[1], 34, 28, k, { closed: CURFEW.includes(k), seed: seed++ }); }
  for (const [k, h] of Object.entries(HUBS)) { const c = g.city(k); if (c.vis) o += stamp(c.xy[0], c.xy[1], 56, 44, k, { teeth: h.cap, filled: h.waiting.length, warn: h.warn, seed: seed++ }); }
  if (detail) {
    const T = (k, dx, dy) => { const c = g.city(k); return c.vis ? tags(c.xy[0] + dx, c.xy[1] + dy, HUBS[k]?.waiting || CITIES_WAITING[k]) : ''; };
    o += T('LON', -46, -46) + T('LIS', -110, -10) + T('IST', 40, 34) + T('ROM', 26, -10) + T('WAW', 26, -24) + T('MAD', -70, 10) + T('CAI', 26, 0) + T('LOS', 26, -4) + T('NYC', 26, 10);
  }
  return o;
}

const card = (x, y, w, h, inner, fill = C.paper) => `<g><rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="10" fill="${C.ink}" opacity=".22"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" ${S}/>${inner}</g>`;
/** Air-mail envelope border: red/blue chevrons along an edge. */
const chevrons = (x, y, w) => { let o = ''; for (let i = 0; i * 14 < w - 8; i++) o += `<path d="M${x + i * 14} ${y} l7 0 l-5 6 l-7 0Z" fill="${i % 2 ? C.blue : C.red}"/>`; return o; };

function hud(w, h, sf, land) {
  const top = land ? 12 : sf.t + 6;
  let o = card(land ? sf.l + 8 : 12, top, 186, 58, `<text x="${(land ? sf.l + 8 : 12) + 14}" y="${top + 27}" font-family="Young" font-size="21" fill="${C.ink}">Tydzień ${CLOCK.week}</text>
  <text x="${(land ? sf.l + 8 : 12) + 120}" y="${top + 26}" font-family="Fam" font-weight="700" font-size="13" fill="${C.ink}" opacity=".7">${CLOCK.dayPl} ${CLOCK.time}</text>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${(land ? sf.l + 8 : 12) + 14 + i * 23}" y="${top + 38}" width="19" height="8" rx="2" fill="${i < 2 ? C.ink : i === 2 ? C.red : C.cream}" stroke="${C.ink}" stroke-width="1"/>`).join('')}`);
  const rx = land ? sf.l + 8 : w - 12 - 56 - 10 - 116, ry = land ? top + 70 : top;
  o += card(rx, ry, 116, 58, `${tags(rx + 22, ry + 30, ['EUN'])}<text x="${rx + 40}" y="${ry + 28}" font-family="Young" font-size="20" fill="${C.ink}">1 284</text><text x="${rx + 40}" y="${ry + 44}" font-family="Fam" font-size="11" fill="${C.ink}" opacity=".7">pasażerów</text>`);
  const px = land ? sf.l + 8 + 126 : w - 12 - 56;
  o += card(px, ry, 56, 58, `<rect x="${px + 19}" y="${ry + 18}" width="6" height="22" rx="2" fill="${C.ink}"/><rect x="${px + 31}" y="${ry + 18}" width="6" height="22" rx="2" fill="${C.ink}"/>`);
  return o;
}

function dock(x, y, len, vertical) {
  const items = [
    (cx, cy) => `<path d="M${cx + 9} ${cy + 8} A9 9 0 1 0 ${cx - 7} ${cy - 3}" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><path d="M${cx - 13} ${cy - 9} L${cx - 7} ${cy + 2} L${cx - 1} ${cy - 8}Z" fill="${C.ink}"/>`,
    (cx, cy) => plane('turboprop', cx - 10, cy, -90, 1.3, `fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"`) + `<text x="${cx + 12}" y="${cy + 8}" font-family="Young" font-size="22" fill="${C.ink}">2</text>`,
    (cx, cy) => plane('widebody', cx - 10, cy, -90, 1.2, `fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"`) + `<circle cx="${cx - 10}" cy="${cy}" r="2.4" fill="${C.red}"/><text x="${cx + 12}" y="${cy + 8}" font-family="Young" font-size="22" fill="${C.ink}">1</text>`,
    (cx, cy) => `<g opacity=".45"><rect x="${cx - 26}" y="${cy - 12}" width="30" height="24" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="3 2"/><rect x="${cx - 21}" y="${cy - 7}" width="20" height="14" fill="${C.sky}" stroke="${C.ink}" stroke-width="1.2"/><text x="${cx + 16}" y="${cy + 8}" font-family="Young" font-size="22" fill="${C.ink}">0</text></g>`,
    (cx, cy) => `<path d="M${cx - 13} ${cy - 9} L${cx} ${cy} L${cx - 13} ${cy + 9}Z M${cx} ${cy - 9} L${cx + 13} ${cy} L${cx} ${cy + 9}Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
  ];
  const sizes = [1, 1.3, 1.3, 1.3, 1], tot = sizes.reduce((a, b) => a + b), gap = 8, unit = (len - gap * 4) / tot;
  let o = '', p = 0;
  items.forEach((f, i) => {
    const L = sizes[i] * unit;
    const [bx, by, bw, bh] = vertical ? [x, y + p, 70, L] : [x + p, y, L, 62];
    o += card(bx, by, bw, bh, f(bx + bw / 2, by + bh / 2), i === 1 ? '#FFF1C9' : C.paper);
    p += L + gap;
  });
  return o;
}

const tip = (x, y) => card(x, y, 290, 52, `${chevrons(x + 8, y + 6, 274)}<text x="${x + 12}" y="${y + 30}" font-family="Young" font-size="15" fill="${C.red}">3 788 km</text><text x="${x + 92}" y="${y + 30}" font-family="Fam" font-weight="700" font-size="12" fill="${C.ink}">za daleko dla turbośmigłowca</text><text x="${x + 12}" y="${y + 45}" font-family="Fam" font-size="11.5" fill="${C.ink}">puść na mieście po drodze = międzylądowanie</text>`);

function gameP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 206, cy: 470, r: 470, rotate: [-6, -38, 0] });
  const acc = g.city('ACC');
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/>${world(g)}
  <circle cx="${acc.xy[0] + 8}" cy="${acc.xy[1] + 10}" r="22" fill="${C.ink}" opacity=".15"/>
  ${tip(16, acc.xy[1] - 150)}${hud(w, h, sf, false)}${dock(12, h - sf.b - 74, w - 24, false)}</svg>`;
  writePage(dir, 'game-p', { w, h, title: 'Poczta lotnicza — gra', fonts: FONTS, css: CSS, body });
}
function gameL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 480, cy: 190, r: 360, rotate: [-4, -34, 0] });
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/>${world(g, { drag: false })}
  ${hud(w, h, sf, true)}${dock(w - sf.r - 80, 12, h - 24 - sf.b, true)}</svg>`;
  writePage(dir, 'game-l', { w, h, title: 'Poczta lotnicza — gra (poziomo)', fonts: FONTS, css: CSS, body });
}

/** Upgrade: three parcels delivered by air mail; each is a big stamp you tear off. */
function offer(x, y, w, h, u, i, compact) {
  const art = compact ? { x: x + w / 2, y: y + 70 } : { x: x + 64, y: y + h / 2 + 6 };
  let pic = '';
  if (u.id === 'hub') pic = stamp(art.x, art.y, 86, 66, 'LON', { teeth: 12 + 6, filled: 11, seed: 40 });
  else pic = `<circle cx="${art.x}" cy="${art.y}" r="44" fill="${C.sky}" ${S}/>` + cloudsSvg({ visible: () => true, pt: () => [art.x - 10, art.y + 20] }, [[0, 0, .55]]) + plane(u.id, art.x, art.y - 4, -60, u.id === 'widebody' ? 2.6 : 2.4, `fill="#fff" stroke="${C.ink}" stroke-width="1" stroke-linejoin="round"`);
  const tx = compact ? x + 16 : x + 132, ty = compact ? y + 150 : y + 22;
  return card(x, y, w, h, `${chevrons(x + 10, y + 8, w - 20)}${pic}
  <text x="${tx}" y="${ty + 30}" font-family="Young" font-size="${u.pl.length > 15 ? 19 : 22}" fill="${C.ink}">${u.pl}</text>
  <text x="${tx}" y="${ty + 52}" font-family="Fam" font-weight="700" font-size="13" fill="${C.ink}" opacity=".75">${u.specPl}</text>
  <g transform="translate(${tx} ${ty + 66})"><rect width="${u.note.length * 7 + 18}" height="22" rx="11" fill="${i === 2 ? C.red : C.blue}"/><text x="9" y="15" font-family="Fam" font-weight="700" font-size="12" fill="#fff">${u.note}</text></g>`);
}
function upgradeP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 206, cy: 470, r: 470, rotate: [-6, -38, 0] });
  const ch = 172;
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/><g opacity=".5">${world(g, { drag: false, detail: false })}</g><rect width="${w}" height="${h}" fill="${C.sky}" opacity=".45"/>
  <text x="20" y="${sf.t + 46}" font-family="Young" font-size="34" fill="${C.ink}">Tydzień ${CLOCK.week + 1}</text>
  <text x="20" y="${sf.t + 72}" font-family="Fam" font-weight="700" font-size="15" fill="${C.ink}">Przyszła poczta. Otwórz jedną paczkę.</text>
  ${UPGRADES.map((u, i) => offer(14, sf.t + 104 + i * (ch + 16), w - 28, ch, u, i)).join('')}</svg>`;
  writePage(dir, 'upgrade-p', { w, h, title: 'Poczta lotnicza — ulepszenie', fonts: FONTS, css: CSS, body });
}
function upgradeL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 480, cy: 190, r: 360, rotate: [-4, -34, 0] });
  const cw = (w - sf.l - sf.r - 32 - 32) / 3;
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/><g opacity=".5">${world(g, { drag: false, detail: false })}</g><rect width="${w}" height="${h}" fill="${C.sky}" opacity=".45"/>
  <text x="${sf.l + 16}" y="42" font-family="Young" font-size="30" fill="${C.ink}">Tydzień ${CLOCK.week + 1}</text>
  <text x="${sf.l + 190}" y="40" font-family="Fam" font-weight="700" font-size="15" fill="${C.ink}">Przyszła poczta. Otwórz jedną paczkę.</text>
  ${UPGRADES.map((u, i) => offer(sf.l + 16 + i * (cw + 16), 62, cw, h - 62 - sf.b - 6, u, i, true)).join('')}</svg>`;
  writePage(dir, 'upgrade-l', { w, h, title: 'Poczta lotnicza — ulepszenie (poziomo)', fonts: FONTS, css: CSS, body });
}

function menu(x, y, w, compact) {
  const rows = [['Lot bez końca', 'rekord: 2 914 pasażerów'], ['Zadania', '12 z 40 listów doręczonych'], ['Wyzwanie dnia', '2 listopada · ten sam świat dla wszystkich'], ['Ustawienia', '']];
  const H = compact ? 50 : 60, gap = compact ? 8 : 12;
  return rows.map(([t, s], i) => {
    const yy = y + i * (H + gap);
    return card(x, yy, w, H, `${i === 0 ? chevrons(x + 10, yy + 6, w - 20) : ''}<text x="${x + 18}" y="${yy + (s ? H / 2 + 3 : H / 2 + 8)}" font-family="Young" font-size="${i ? 18 : 21}" fill="${i ? C.ink : '#fff'}">${t}</text>${s ? `<text x="${x + 18}" y="${yy + H / 2 + 19}" font-family="Fam" font-size="11.5" fill="${i ? C.ink : '#fff'}" opacity=".85">${s}</text>` : ''}`, i === 0 ? C.red : C.paper);
  }).join('');
}
const logo = (x, y, s) => `<g transform="translate(${x} ${y})"><text x="0" y="0" font-family="Young" font-size="${s}" fill="${C.ink}" stroke="${C.ink}" stroke-width="1">${TITLE.main[0] + TITLE.main.slice(1).toLowerCase()}</text>${chevrons(2, 14, s * 3.4)}<text x="2" y="${s * .2 + 30}" font-family="Fam" font-weight="700" font-size="13" fill="${C.ink}" letter-spacing=".1em">${TITLE.sub.toUpperCase()}</text></g>`;
function menuP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 230, cy: 470, r: 330, rotate: [20, -30, 0] });
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/><circle cx="340" cy="${sf.t + 70}" r="34" fill="#FFE08A" ${S}/>${world(g, { drag: false })}
  ${logo(22, sf.t + 76, 62)}${menu(16, h - sf.b - 280, w - 32)}</svg>`;
  writePage(dir, 'menu-p', { w, h, title: 'Poczta lotnicza — menu', fonts: FONTS, css: CSS, body });
}
function menuL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 660, cy: 230, r: 300, rotate: [20, -30, 0] });
  const body = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${C.sky}"/>${world(g, { drag: false })}
  ${logo(sf.l + 18, 70, 52)}${menu(sf.l + 16, 150, 340, true)}</svg>`;
  writePage(dir, 'menu-l', { w, h, title: 'Poczta lotnicza — menu (poziomo)', fonts: FONTS, css: CSS, body });
}

gameP(); gameL(); upgradeP(); upgradeL(); menuP(); menuL();

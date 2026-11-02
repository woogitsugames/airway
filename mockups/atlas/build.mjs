// Direction "Atlas": the globe as an engraved and watercoloured atlas plate — water-lined coasts, hachured
// mountains, ink forests, a compass rose, hub medallions with engraved landmarks. Rich, hand-made, old-world.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains } from 'd3-geo';
import { makeGlobe, land50, rng } from '../lib/geo.mjs';
import { writePage, SAFE } from '../lib/page.mjs';
import { glyph, plane, polar } from '../lib/draw.mjs';
import { REGIONS, CITY_REGION, ROUTES, FLIGHTS, HUBS, CITIES_WAITING, CURFEW, SUN, CLOCK, TITLE, UPGRADES } from '../lib/scene.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const C = {
  paper: '#EBDDBB', paper2: '#E2CFA4', sea: '#C9D6C2', seaLine: '#8FA592', land: '#EFE2BF', green: '#B9C48D', sand: '#E6C98C',
  ink: '#3B2A1E', red: '#A3312A', indigo: '#2D3E6B', gold: '#B8862F', night: '#24304F',
};
const DEST = { NAM: '#2D5DA8', EUN: '#4E7A3A', EUS: '#C9962F', AFR: '#3B2A1E', ME: '#B0559A', SAM: '#6FB3C0' }; // CVD-checked (min ΔE ≥ 15)
const FONTS = [
  { family: 'AlSC', file: 'AlegreyaSC-800.ttf', weight: 800 }, { family: 'AlSC', file: 'AlegreyaSC-500.ttf', weight: 500 },
  { family: 'Al', file: 'Alegreya-400.ttf', weight: 400 }, { family: 'Al', file: 'Alegreya-700.ttf', weight: 700 },
];
const CSS = `body{background:${C.paper};font-family:Al,serif;color:${C.ink}}`;
const MOUNTAIN_CHAINS = [
  [[5, 45.5], [7.5, 46.2], [10, 46.6], [12.5, 47], [15, 46.8]], [[-1.8, 42.9], [0.5, 42.7], [2.5, 42.5]], [[-9, 30.8], [-6.5, 31.6], [-4, 32.8], [-1, 33.7]],
  [[6.5, 60], [9, 61.8], [12, 63.5], [15, 66.2], [18, 68.5]], [[19, 49.3], [22.5, 48.8], [25, 47.5], [25.5, 45.6], [23, 45.3]], [[30, 37.5], [33, 37.3], [36, 38.2], [39, 39]],
  [[40, 43.4], [43, 43], [46, 42]], [[19.5, 42.5], [21, 41.8]], [[-4, 37.1], [-2.5, 37.2]],
];
const FORESTS = [[25, 56], [30, 58], [20, 61], [35, 55], [16, 51], [10, 50], [3, 48], [-2, 47.5], [28, 50], [24, 52], [40, 56], [-1, 53], [-8, 42.5], [12, 58], [5, 8], [10, 6], [20, 3], [-6, 8], [15, 1], [26, 1]];

const defs = (id = '') => `<defs>
<filter id="paper${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .23  0 0 0 0 .16  0 0 0 0 .1  0 0 0 .09 0"/></filter>
<filter id="wash${id}"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="28" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="5"/></filter>
<pattern id="seaLines${id}" width="6" height="5" patternUnits="userSpaceOnUse"><line x1="0" y1="2.5" x2="6" y2="2.5" stroke="${C.seaLine}" stroke-width=".7" opacity=".55"/></pattern>
<pattern id="xhatch${id}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0 L6 6 M6 0 L0 6" stroke="${C.night}" stroke-width=".8" opacity=".5"/></pattern>
<radialGradient id="vig${id}" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity=".28"/></radialGradient>
</defs>`;

function paperBg(w, h, id = '') { return `<rect width="${w}" height="${h}" fill="${C.paper}"/><rect width="${w}" height="${h}" filter="url(#paper${id})"/>`; }

/** Hachured mountain: a ridge with shading strokes on the lee (east) side — engraved-map convention. */
function mountain(x, y, s = 1) {
  let o = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><path d="M-9 6 Q-4 -2 0 -9 Q4 -2 9 6" fill="${C.land}" stroke="${C.ink}" stroke-width="1.2"/>`;
  for (let k = 0; k < 5; k++) o += `<line x1="${1 + k * 1.6}" y1="${-6 + k * 2.4}" x2="${-1 + k * 1.6}" y2="${5}" stroke="${C.ink}" stroke-width=".8"/>`;
  return o + '</g>';
}
const treeInk = (x, y, s = 1) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><line x1="0" y1="1" x2="0" y2="5" stroke="${C.ink}" stroke-width="1"/><path d="M-3.5 1 a3.5 4 0 1 1 7 0Z" fill="${C.green}" stroke="${C.ink}" stroke-width=".9"/><path d="M1 -2 L2.5 0.5 M0 -1 L1.5 1" stroke="${C.ink}" stroke-width=".6"/></g>`;

/** Compass rose (32-point simplified) — ornament and north indicator. */
function compass(x, y, r) {
  let o = `<g transform="translate(${x} ${y})"><circle r="${r}" fill="none" stroke="${C.ink}" stroke-width="1"/><circle r="${r - 4}" fill="none" stroke="${C.ink}" stroke-width=".6"/>`;
  for (let a = 0; a < 360; a += 10) { const [x0, y0] = polar(0, 0, r - 4, a), [x1, y1] = polar(0, 0, r - (a % 90 ? 7 : 10), a); o += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.ink}" stroke-width=".7"/>`; }
  for (let a = 0; a < 360; a += 45) {
    const L = a % 90 ? r * .55 : r * .9, [tx, ty] = polar(0, 0, L, a), [lx, ly] = polar(0, 0, r * .16, a - 45), [rx, ry] = polar(0, 0, r * .16, a + 45);
    o += `<path d="M0 0 L${lx} ${ly} L${tx} ${ty}Z" fill="${a % 90 ? C.paper : C.ink}" stroke="${C.ink}" stroke-width=".8"/><path d="M0 0 L${rx} ${ry} L${tx} ${ty}Z" fill="${a % 90 ? C.ink : C.red}" stroke="${C.ink}" stroke-width=".8"/>`;
  }
  return o + `<text y="${-r - 6}" font-family="AlSC" font-weight="800" font-size="13" text-anchor="middle" fill="${C.ink}">N</text></g>`;
}

/** Old-map town symbol: three small towers. */
const town = (x, y, closed) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="6" rx="11" ry="3" fill="${C.ink}" opacity=".18"/>
  <path d="M-8 6 V-1 L-6 -4 L-4 -1 V6Z M-3 6 V-5 L0 -10 L3 -5 V6Z M4 6 V0 L6 -3 L8 0 V6Z" fill="${closed ? C.night : C.paper}" stroke="${C.ink}" stroke-width="1.1" stroke-linejoin="round"/>
  ${closed ? '' : `<rect x="-1" y="1" width="2" height="3" fill="${C.ink}"/>`}</g>`;
/** Pennant with the region glyph flying from the town (what passengers ask for). */
const pennant = (x, y, reg) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line x1="0" y1="0" x2="0" y2="-16" stroke="${C.ink}" stroke-width="1"/><path d="M0 -16 L16 -12 L0 -7Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>${glyph(reg, 5.5, -11.5, .32, `fill="${C.ink}"`)}</g>`;

/** Hub medallion: double ring, engraved landmark inside, bead ring = seats (red beads = taken). */
function medallion(x, y, r, code, h) {
  const lm = { LON: 'tower', LIS: 'belem', IST: 'dome' }[code], load = h.waiting.length / h.cap;
  let o = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${r + 9}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.4"/>`;
  for (let i = 0; i < h.cap; i++) { const [bx, by] = polar(0, 0, r + 4.5, (i + .5) * 360 / h.cap); o += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.3" fill="${i < h.waiting.length ? (load > .8 ? C.red : C.ink) : C.paper}" stroke="${C.ink}" stroke-width=".9"/>`; }
  o += `<circle r="${r}" fill="${C.land}" stroke="${C.ink}" stroke-width="1.2"/><clipPath id="md${code}"><circle r="${r - 1}"/></clipPath><g clip-path="url(#md${code})">`;
  for (let k = -r; k < r; k += 3) o += `<line x1="${-r}" y1="${k}" x2="${r}" y2="${k}" stroke="${C.seaLine}" stroke-width=".5" opacity=".7"/>`;
  o += `<rect x="${-r}" y="${r * .35}" width="${2 * r}" height="${r}" fill="${C.green}" stroke="${C.ink}" stroke-width=".8"/>`;
  const b = r * .35;
  if (lm === 'tower') o += `<rect x="-4" y="${b - r * 1.05}" width="8" height="${r * 1.05}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-5 ${b - r * 1.05} L0 ${b - r * 1.4} L5 ${b - r * 1.05}Z" fill="${C.ink}"/><circle cy="${b - r * .85}" r="2.6" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"/>${[-1, 1, 3].map((k) => `<line x1="-4" y1="${b - r * .5 + k * 3}" x2="4" y2="${b - r * .5 + k * 3}" stroke="${C.ink}" stroke-width=".5"/>`).join('')}`;
  if (lm === 'belem') o += `<rect x="-7" y="${b - r * .7}" width="14" height="${r * .7}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-7 ${b - r * .7} v-3 h3 v3 h2 v-3 h4 v3 h2 v-3 h3 v3" fill="none" stroke="${C.ink}" stroke-width="1"/><rect x="-3" y="${b - r * .98}" width="6" height="${r * .28}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-3 ${b - r * .98} q3 -5 6 0" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>`;
  if (lm === 'dome') o += `<path d="M-9 ${b - r * .45} a9 9 0 0 1 18 0Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><rect x="-10" y="${b - r * .45}" width="20" height="${r * .45}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-14 ${b} V${b - r * 1.05} l1.2 -3 l1.2 3 V${b} M12 ${b} V${b - r * 1.05} l1.2 -3 l1.2 3 V${b}" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>`;
  o += `</g>`;
  o += `<g transform="translate(${r * .72} ${-r * .72})"><circle r="7.5" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>${glyph(REGIONS[CITY_REGION[code]].glyph, 0, 0, .5, `fill="${C.ink}"`)}</g>`;
  if (h.warn) o += `<g transform="translate(${-r * .9} ${r * .8})"><circle r="11" fill="${C.red}" stroke="${C.ink}" stroke-width="1"/><path d="M-6 0 a6 6 0 1 0 6 -6" fill="none" stroke="${C.paper}" stroke-width="1.6"/><path d="M0 -6 V0 L3 2" stroke="${C.paper}" stroke-width="1.4" fill="none"/></g>`;
  return o + '</g>';
}

/** Queue of passengers: small ink glyphs on a scroll banderole. */
function banderole(x, y, list, per = 6) {
  if (!list.length) return '';
  const n = Math.min(per, list.length), w = n * 13 + 12 + (list.length > per ? 18 : 0);
  let o = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 -1 h${w} l-4 7 l4 7 h-${w} l4 -7Z" fill="${C.paper}" stroke="${C.ink}" stroke-width=".9"/>`;
  list.slice(0, per).forEach((r, i) => { o += glyph(REGIONS[r].glyph, 11 + i * 13, 6, .54, `fill="${DEST[r]}"`); });
  if (list.length > per) o += `<text x="${10 + per * 13}" y="10" font-family="AlSC" font-weight="800" font-size="10" fill="${C.ink}">+${list.length - per}</text>`;
  return o + '</g>';
}

function route(g, a, b, type) {
  const { front } = g.arc(a, b, type === 'widebody' ? .1 : .04); if (!front) return '';
  if (type === 'widebody') return `<path d="${front}" fill="none" stroke="${C.paper}" stroke-width="7"/><path d="${front}" fill="none" stroke="${C.red}" stroke-width="5"/><path d="${front}" fill="none" stroke="${C.paper}" stroke-width="1.6"/>`;
  return `<path d="${front}" fill="none" stroke="${C.paper}" stroke-width="5"/><path d="${front}" fill="none" stroke="${C.indigo}" stroke-width="2.2" stroke-dasharray="1 4.5" stroke-linecap="round" transform="translate(0 0)"/><path d="${front}" fill="none" stroke="${C.indigo}" stroke-width="2.8" stroke-dasharray="0 5.5" stroke-linecap="round"/>`;
}

function world(g, { drag = true, detail = true } = {}) {
  const landP = g.land(50), night = g.night(SUN.lon, SUN.lat);
  let o = `<clipPath id="gl"><path d="${g.sphere()}"/></clipPath><clipPath id="ld"><path d="${landP}"/></clipPath>`;
  o += `<path d="${g.sphere()}" fill="${C.sea}"/><g clip-path="url(#gl)"><rect x="0" y="0" width="2000" height="2000" fill="url(#seaLines)"/>`;
  // water-lining: concentric coastlines fading into the sea (engraver's convention)
  for (const [wd, op] of [[26, .18], [18, .26], [11, .36], [5, .5]]) o += `<path d="${landP}" fill="none" stroke="${C.seaLine}" stroke-width="${wd}" opacity="${op}"/><path d="${landP}" fill="none" stroke="${C.sea}" stroke-width="${wd - 2.2}"/>`;
  o += `<path d="${landP}" fill="${C.land}"/>`;
  // watercolour washes (green temperate belt, sand desert) with ragged, bleeding edges
  o += `<g clip-path="url(#ld)" filter="url(#wash)" opacity=".85">`;
  for (const [lon, lat, r] of [[10, 52, 14], [25, 55, 14], [-3, 46, 9], [20, 45, 8], [35, 52, 12], [10, 8, 12], [-8, 8, 8], [22, 2, 12], [15, 62, 9]]) { if (g.visible(lon, lat)) { const [x, y] = g.pt(lon, lat); o += `<circle cx="${x}" cy="${y}" r="${r * g.r / 100}" fill="${C.green}" opacity=".75"/>`; } }
  for (const [lon, lat, r] of [[0, 24, 12], [15, 24, 12], [27, 25, 9], [-10, 22, 8], [42, 24, 9]]) { if (g.visible(lon, lat)) { const [x, y] = g.pt(lon, lat); o += `<circle cx="${x}" cy="${y}" r="${r * g.r / 100}" fill="${C.sand}" opacity=".9"/>`; } }
  o += `</g><path d="${landP}" fill="none" stroke="${C.ink}" stroke-width="1.1"/>`;
  o += `<path d="${g.graticule()}" fill="none" stroke="${C.ink}" stroke-width=".5" opacity=".25" stroke-dasharray="3 2"/>`;
  if (detail) {
    const R = rng(11);
    for (const chain of MOUNTAIN_CHAINS) chain.forEach(([lon, lat], i) => { if (g.visible(lon, lat)) { const [x, y] = g.pt(lon, lat); o += mountain(x, y, .9 + (i % 2) * .25); } });
    for (const [lon, lat] of FORESTS) { if (!g.visible(lon, lat)) continue; const [x, y] = g.pt(lon, lat); for (let k = 0; k < 6; k++) { const tx = x + (R() - .5) * 26, ty = y + (R() - .5) * 16; const ll = g.proj.invert([tx, ty]); if (ll && geoContains(land50, ll)) o += treeInk(tx, ty, .9 + R() * .3); } }
    // a little ship on the Atlantic, for scale and life
    const sh = g.pt(-24, 36); o += `<g transform="translate(${sh[0]} ${sh[1]})"><path d="M-10 0 h20 l-4 5 h-12Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M0 0 V-14 L8 -3 H0" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-1 -12 L-8 -2 H-1" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-16 7 q4 -2 8 0 t8 0 t8 0 t8 0" fill="none" stroke="${C.seaLine}" stroke-width="1"/></g>`;
  }
  // night: engraved cross-hatching over a deep wash; the terminator is drawn as a dotted ink line
  o += `<path d="${night}" fill="${C.night}" opacity=".22"/><path d="${night}" fill="url(#xhatch)"/><path d="${night}" fill="none" stroke="${C.night}" stroke-width="1.2" stroke-dasharray="1 3"/>`;
  o += ROUTES.map(([a, b, t]) => route(g, a, b, t)).join('');
  if (drag) {
    const { front } = g.arc('LIS', 'ACC', .04);
    o += `<path d="${front}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-dasharray="6 4"/>`;
    const cut = g.arcAt('LIS', 'ACC', .64, .04);
    o += `<g transform="translate(${cut.x} ${cut.y})"><circle r="10" fill="${C.red}" stroke="${C.ink}"/><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="${C.paper}" stroke-width="2"/></g>`;
  }
  o += FLIGHTS.map(([a, b, t, , type]) => { const p = g.arcAt(a, b, t, type === 'widebody' ? .1 : .04); return p.front ? plane(type, p.x, p.y, p.deg, type === 'widebody' ? 1.25 : 1.05, `fill="${C.ink}" stroke="${C.paper}" stroke-width="1.6" paint-order="stroke"`) : ''; }).join('');
  o += `</g><path d="${g.sphere()}" fill="none" stroke="${C.ink}" stroke-width="1.6"/><path d="${g.sphere()}" fill="none" stroke="${C.ink}" stroke-width=".6" transform="translate(${g.cx} ${g.cy}) scale(1.012) translate(${-g.cx} ${-g.cy})"/>`;
  for (const k of Object.keys(CITIES_WAITING)) { const c = g.city(k); if (c.vis) o += town(c.xy[0], c.xy[1], CURFEW.includes(k)) + pennant(c.xy[0] + 8, c.xy[1] - 4, REGIONS[CITY_REGION[k]].glyph); }
  for (const [k, h] of Object.entries(HUBS)) { const c = g.city(k); if (c.vis) o += medallion(c.xy[0], c.xy[1], 22, k, h); }
  if (detail) {
    const B = (k, dx, dy) => { const c = g.city(k); return c.vis ? banderole(c.xy[0] + dx, c.xy[1] + dy, HUBS[k]?.waiting || CITIES_WAITING[k]) : ''; };
    o += B('LON', -40, -58) + B('LIS', -98, 18) + B('IST', 26, 26) + B('ROM', 14, 6) + B('WAW', 14, 4) + B('MAD', -60, 10) + B('CAI', 16, 8) + B('NYC', 14, 8) + B('LOS', 14, 6);
    const lab = (k, dx, dy, t, a = 'start') => { const c = g.city(k); return c.vis ? `<text x="${c.xy[0] + dx}" y="${c.xy[1] + dy}" font-family="AlSC" font-weight="800" font-size="12" letter-spacing=".08em" text-anchor="${a}" fill="${C.ink}" paint-order="stroke" stroke="${C.land}" stroke-width="3">${t}</text>` : ''; };
    o += lab('LON', -36, 4, 'Londyn', 'end') + lab('LIS', -36, -8, 'Lizbona', 'end') + lab('IST', -36, -26, 'Stambuł', 'end') + lab('CAI', -14, 24, 'Kair · noc', 'end');
  }
  return o;
}

/** Paper slip with corner ornaments (no SaaS cards: ink frame, folded corner). */
const slip = (x, y, w, h, inner, fill = C.paper) => `<g><path d="M${x} ${y} h${w - 10} l10 10 v${h - 10} h-${w} Z" fill="${fill}" stroke="${C.ink}" stroke-width="1.3"/><path d="M${x + w - 10} ${y} v10 h10" fill="${C.paper2}" stroke="${C.ink}" stroke-width="1"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="none" stroke="${C.ink}" stroke-width=".5" opacity=".6"/>${inner}</g>`;

function topHud(x, y, w) {
  // week as a scroll ribbon; days as the ribbon's notches
  return `<g><path d="M${x} ${y + 8} h12 v-8 h172 v8 h12 l-8 14 l8 14 h-24 v-6 h-160 v6 h-24 l8 -14Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.3"/>
  <text x="${x + 98}" y="${y + 26}" font-family="AlSC" font-weight="800" font-size="18" text-anchor="middle" fill="${C.ink}">Tydzień ${CLOCK.week} · ${CLOCK.dayPl} ${CLOCK.time}</text>
  ${Array.from({ length: 7 }, (_, i) => `<circle cx="${x + 44 + i * 18}" cy="${y + 44}" r="5" fill="${i < 2 ? C.ink : i === 2 ? C.red : C.paper}" stroke="${C.ink}" stroke-width="1"/>`).join('')}
  ${slip(x + w - 176, y, 112, 56, `<text x="${x + w - 162}" y="${y + 28}" font-family="AlSC" font-weight="800" font-size="20" fill="${C.ink}">1 284</text><text x="${x + w - 162}" y="${y + 44}" font-family="Al" font-style="italic" font-size="12" fill="${C.ink}">pasażerów</text>`)}
  ${slip(x + w - 56, y, 56, 56, `<rect x="${x + w - 38}" y="${y + 17}" width="6" height="22" fill="${C.ink}"/><rect x="${x + w - 26}" y="${y + 17}" width="6" height="22" fill="${C.ink}"/>`)}</g>`;
}

function dock(x, y, len, vertical) {
  const it = [
    (cx, cy) => `<path d="M${cx + 9} ${cy + 8} A9 9 0 1 0 ${cx - 7} ${cy - 3}" fill="none" stroke="${C.ink}" stroke-width="2.6"/><path d="M${cx - 13} ${cy - 9} L${cx - 7} ${cy + 2} L${cx - 1} ${cy - 8}Z" fill="${C.ink}"/>`,
    (cx, cy) => plane('turboprop', cx - 10, cy, -90, 1.3, `fill="${C.indigo}"`) + `<text x="${cx + 10}" y="${cy + 7}" font-family="AlSC" font-weight="800" font-size="22" fill="${C.ink}">2</text>`,
    (cx, cy) => plane('widebody', cx - 10, cy, -90, 1.2, `fill="${C.red}"`) + `<text x="${cx + 10}" y="${cy + 7}" font-family="AlSC" font-weight="800" font-size="22" fill="${C.ink}">1</text>`,
    (cx, cy) => `<g opacity=".45">${Array.from({ length: 8 }, (_, i) => { const [bx, by] = polar(cx - 10, cy, 9, i * 45); return `<circle cx="${bx}" cy="${by}" r="2.6" fill="${C.paper}" stroke="${C.ink}"/>`; }).join('')}<text x="${cx + 10}" y="${cy + 7}" font-family="AlSC" font-weight="800" font-size="22" fill="${C.ink}">0</text></g>`,
    (cx, cy) => `<path d="M${cx - 12} ${cy - 9} L${cx} ${cy} L${cx - 12} ${cy + 9}Z M${cx} ${cy - 9} L${cx + 12} ${cy} L${cx} ${cy + 9}Z" fill="${C.ink}"/>`,
  ];
  const sz = [1, 1.3, 1.3, 1.3, 1], tot = sz.reduce((a, b) => a + b), gap = 8, unit = (len - gap * 4) / tot;
  let o = '', p = 0;
  it.forEach((f, i) => { const L = sz[i] * unit; const [bx, by, bw, bh] = vertical ? [x, y + p, 70, L] : [x + p, y, L, 62]; o += slip(bx, by, bw, bh, f(bx + bw / 2, by + bh / 2)); p += L + gap; });
  return o;
}

const tip = (x, y) => slip(x, y, 280, 54, `<text x="${x + 14}" y="${y + 24}" font-family="AlSC" font-weight="800" font-size="15" fill="${C.red}">3 788 km — za daleko</text><text x="${x + 14}" y="${y + 41}" font-family="Al" font-style="italic" font-size="12.5" fill="${C.ink}">Turbośmigłowiec tam nie doleci. Wskaż miasto po drodze.</text>`);

function gameP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 206, cy: 470, r: 470, rotate: [-6, -38, 0] });
  const acc = g.city('ACC');
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}${world(g)}${compass(70, 690, 34)}
  <circle cx="${acc.xy[0] + 8}" cy="${acc.xy[1] + 10}" r="22" fill="${C.ink}" opacity=".14"/>${tip(16, acc.xy[1] - 140)}
  <rect width="${w}" height="${h}" fill="url(#vig)" pointer-events="none"/>
  ${topHud(12, sf.t + 6, w - 24)}${dock(12, h - sf.b - 74, w - 24)}</svg>`;
  writePage(dir, 'game-p', { w, h, title: 'Atlas — gra', fonts: FONTS, css: CSS, body });
}
function gameL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 470, cy: 190, r: 360, rotate: [-4, -34, 0] });
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}${world(g, { drag: false })}${compass(190, 330, 30)}<rect width="${w}" height="${h}" fill="url(#vig)"/>
  ${topHud(sf.l + 8, 12, 420)}${dock(w - sf.r - 80, 12, h - 24 - sf.b, true)}</svg>`;
  writePage(dir, 'game-l', { w, h, title: 'Atlas — gra (poziomo)', fonts: FONTS, css: CSS, body });
}

/** Upgrade: three engraved plates ("Tablica I/II/III") like an atlas appendix. */
function plateArt(cx, cy, u) {
  if (u.id === 'hub') return medallion(cx, cy, 30, 'LON', { cap: 18, waiting: Array(11).fill('NAM') });
  let o = `<circle cx="${cx}" cy="${cy}" r="40" fill="${C.sea}" stroke="${C.ink}" stroke-width="1.2"/>`;
  for (let k = -38; k < 40; k += 3) { const hw = Math.sqrt(Math.max(0, 1600 - k * k)) - 1; o += `<line x1="${cx - hw}" y1="${cy + k}" x2="${cx + hw}" y2="${cy + k}" stroke="${C.seaLine}" stroke-width=".5"/>`; }
  return o + plane(u.id, cx, cy, -55, u.id === 'widebody' ? 2.6 : 2.4, `fill="${u.id === 'widebody' ? C.red : C.indigo}" stroke="${C.paper}" stroke-width=".8" paint-order="stroke"`);
}
const ROMAN = ['I', 'II', 'III'];
function upgradeP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 206, cy: 470, r: 470, rotate: [-6, -38, 0] });
  const ph = 176;
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}<g opacity=".35">${world(g, { drag: false, detail: false })}</g><rect width="${w}" height="${h}" fill="${C.paper}" opacity=".5"/><rect width="${w}" height="${h}" fill="url(#vig)"/>
  <text x="20" y="${sf.t + 44}" font-family="AlSC" font-weight="800" font-size="34" fill="${C.ink}">Tydzień ${CLOCK.week + 1}</text>
  <text x="20" y="${sf.t + 70}" font-family="Al" font-style="italic" font-size="16" fill="${C.ink}">Kompania przysłała jedną dostawę. Wybierz.</text>
  ${UPGRADES.map((u, i) => { const y = sf.t + 100 + i * (ph + 14); return slip(14, y, w - 28, ph, `${plateArt(78, y + ph / 2, u)}
    <text x="140" y="${y + 34}" font-family="AlSC" font-weight="500" font-size="13" letter-spacing=".12em" fill="${C.ink}">Tablica ${ROMAN[i]}</text>
    <text x="140" y="${y + 62}" font-family="AlSC" font-weight="800" font-size="${u.pl.length > 15 ? 20 : 23}" fill="${C.ink}">${u.pl}</text>
    ${u.specPl.split(' · ').map((t, k) => `<text x="140" y="${y + 86 + k * 19}" font-family="Al" font-size="15" fill="${C.ink}">${t}</text>`).join('')}
    <text x="140" y="${y + ph - 20}" font-family="Al" font-style="italic" font-size="13" fill="${C.red}">${u.note}</text>`); }).join('')}</svg>`;
  writePage(dir, 'upgrade-p', { w, h, title: 'Atlas — ulepszenie', fonts: FONTS, css: CSS, body });
}
function upgradeL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 470, cy: 190, r: 360, rotate: [-4, -34, 0] });
  const cw = (w - sf.l - sf.r - 32 - 28) / 3;
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}<g opacity=".35">${world(g, { drag: false, detail: false })}</g><rect width="${w}" height="${h}" fill="${C.paper}" opacity=".5"/>
  <text x="${sf.l + 16}" y="42" font-family="AlSC" font-weight="800" font-size="30" fill="${C.ink}">Tydzień ${CLOCK.week + 1}</text>
  <text x="${sf.l + 200}" y="40" font-family="Al" font-style="italic" font-size="16" fill="${C.ink}">Kompania przysłała jedną dostawę. Wybierz.</text>
  ${UPGRADES.map((u, i) => { const x = sf.l + 16 + i * (cw + 14), y = 62, ph = h - 62 - sf.b - 6; return slip(x, y, cw, ph, `${plateArt(x + cw / 2, y + 74, u)}
    <text x="${x + 16}" y="${y + 150}" font-family="AlSC" font-weight="500" font-size="12" letter-spacing=".12em" fill="${C.ink}">Tablica ${ROMAN[i]}</text>
    <text x="${x + 16}" y="${y + 176}" font-family="AlSC" font-weight="800" font-size="21" fill="${C.ink}">${u.pl}</text>
    <text x="${x + 16}" y="${y + 200}" font-family="Al" font-size="14" fill="${C.ink}">${u.specPl}</text>
    <text x="${x + 16}" y="${y + ph - 18}" font-family="Al" font-style="italic" font-size="13" fill="${C.red}">${u.note}</text>`); }).join('')}</svg>`;
  writePage(dir, 'upgrade-l', { w, h, title: 'Atlas — ulepszenie (poziomo)', fonts: FONTS, css: CSS, body });
}

function cartouche(x, y, s) {
  return `<g transform="translate(${x} ${y})"><path d="M0 0 h${s * 4.6} q12 0 12 12 v${s * 1.75} q0 12 -12 12 h-${s * 4.6} q-12 0 -12 -12 v-${s * 1.75} q0 -12 12 -12Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.6"/>
  <path d="M6 6 h${s * 4.6 - 12} q8 0 8 8 v${s * 1.75 - 4} q0 8 -8 8 h-${s * 4.6 - 12} q-8 0 -8 -8 v-${s * 1.75 - 4} q0 -8 8 -8Z" fill="none" stroke="${C.ink}" stroke-width=".6"/>
  <text x="${s * 2.3}" y="${s * 1.02 + 6}" font-family="AlSC" font-weight="800" font-size="${s}" text-anchor="middle" fill="${C.ink}">${TITLE.main[0] + TITLE.main.slice(1).toLowerCase()}</text>
  <text x="${s * 2.3}" y="${s * 1.02 + 30}" font-family="Al" font-style="italic" font-size="13" text-anchor="middle" fill="${C.red}">Atlas połączeń świata · ${TITLE.sub}</text></g>`;
}
function menuRows(x, y, w, compact) {
  const rows = [['Lot bez końca', 'rekord: 2 914 pasażerów'], ['Zadania', 'rozwiązane 12 z 40'], ['Wyzwanie dnia', '2 listopada · ten sam świat dla wszystkich'], ['Ustawienia', '']];
  const H = compact ? 50 : 60, gap = compact ? 8 : 12;
  return rows.map(([t, s], i) => { const yy = y + i * (H + gap); return slip(x, yy, w, H, `<text x="${x + 18}" y="${yy + (s ? H / 2 + 2 : H / 2 + 7)}" font-family="AlSC" font-weight="800" font-size="${i ? 19 : 22}" fill="${i ? C.ink : C.paper}">${t}</text>${s ? `<text x="${x + 18}" y="${yy + H / 2 + 19}" font-family="Al" font-style="italic" font-size="12.5" fill="${i ? C.ink : C.paper}">${s}</text>` : ''}`, i ? C.paper : C.red); }).join('');
}
function menuP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const g = makeGlobe({ cx: 230, cy: 460, r: 330, rotate: [20, -30, 0] });
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}${world(g, { drag: false })}${compass(80, 980, 30)}<rect width="${w}" height="${h}" fill="url(#vig)"/>
  ${cartouche(30, sf.t + 18, 44)}${menuRows(16, h - sf.b - 280, w - 32)}</svg>`;
  writePage(dir, 'menu-p', { w, h, title: 'Atlas — menu', fonts: FONTS, css: CSS, body });
}
function menuL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const g = makeGlobe({ cx: 660, cy: 230, r: 300, rotate: [20, -30, 0] });
  const body = `<svg width="${w}" height="${h}">${defs()}${paperBg(w, h)}${world(g, { drag: false })}<rect width="${w}" height="${h}" fill="url(#vig)"/>
  ${cartouche(sf.l + 26, 18, 40)}${menuRows(sf.l + 16, 150, 340, true)}</svg>`;
  writePage(dir, 'menu-l', { w, h, title: 'Atlas — menu (poziomo)', fonts: FONTS, css: CSS, body });
}

gameP(); gameL(); upgradeP(); upgradeL(); menuP(); menuL();

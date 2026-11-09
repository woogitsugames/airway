// Full-severity Machado et al. (2009) matrices, converted from linear sRGB to CIE Lab D65.
// Every destination must remain distinguishable by shape even when colours pass this guard.
import { readFileSync } from 'node:fs';

const SEED = '0xA1A1';
const MIN_DELTA_E = 15;
const palette = JSON.parse(readFileSync(new URL('../src/ui/theme/tokens.json', import.meta.url), 'utf8')).destinations;
const css = readFileSync(new URL('../src/ui/theme/theme.css', import.meta.url), 'utf8');
const MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};
function rgb(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Invalid hex colour: ' + hex);
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
}
function linear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
function encoded(channel) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}
function lab(linearRgb) {
  const encodedRgb = linearRgb.map((channel) => Math.min(1, Math.max(0, encoded(channel))));
  const [r, g, b] = encodedRgb.map(linear);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (n) => n > 216 / 24389 ? Math.cbrt(n) : (24389 / 27 * n + 16) / 116;
  const [fx, fy, fz] = [x, y, z].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function simulate(colour, matrix) {
  const channels = rgb(colour).map(linear);
  // Machado 2009 operates on linear RGB. Clip before converting back to sRGB/Lab.
  return lab(matrix.map((row) => Math.min(1, Math.max(0, row.reduce((sum, k, i) => sum + k * channels[i], 0)))));
}
function deltaE(a, b) {
  return Math.hypot(...a.map((channel, i) => channel - b[i]));
}
let failed = 0;
let comparisons = 0;
const entries = Object.entries(palette);
for (const [id, hex] of entries) {
  const actual = css.match(new RegExp('\\-\\-airway-dest-' + id.toLowerCase() + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i'));
  if (!actual || actual[1].toLowerCase() !== hex.toLowerCase()) {
    console.error('FAIL CSS destination variable differs from tested token: ' + id);
    failed++;
  }
}
if (entries.length !== 6 || new Set(entries.map(([id]) => id)).size !== 6) {
  console.error('FAIL Expected exactly six destination colours');
  failed++;
}
for (const [name, matrix] of Object.entries(MATRICES)) {
  let minimum = Number.POSITIVE_INFINITY;
  let worstPair = '';
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const distance = deltaE(simulate(entries[i][1], matrix), simulate(entries[j][1], matrix));
      comparisons++;
      if (distance < minimum) {
        minimum = distance;
        worstPair = entries[i][0] + '/' + entries[j][0];
      }
    }
  }
  console.log(name + ': min DeltaE76=' + minimum.toFixed(2) + ' (' + worstPair + ')');
  if (!Number.isFinite(minimum) || minimum < MIN_DELTA_E) {
    console.error('FAIL ' + name + ' minimum below ' + MIN_DELTA_E);
    failed++;
  }
}
// [night-09c] D-80: the player's airline colours must stay apart from each other in normal vision and in all
// three simulations, and every one must stand out from the cream aircraft body it accents.
const airline = Object.entries(JSON.parse(readFileSync(new URL('../src/data/airline-colours.json', import.meta.url), 'utf8')));
const AIRCRAFT_BODY = '#f7f3ea';
const MIN_BODY_DELTA_E = 40;
if (airline.length < 4 || airline.some(([, hex]) => !/^#[0-9a-fA-F]{6}$/.test(hex))) {
  console.error('FAIL Expected at least four airline colours as #rrggbb');
  failed++;
}
const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
for (const [name, matrix] of Object.entries({ normal: IDENTITY, ...MATRICES })) {
  let minimum = Number.POSITIVE_INFINITY;
  let worstPair = '';
  for (let i = 0; i < airline.length; i++) {
    for (let j = i + 1; j < airline.length; j++) {
      const distance = deltaE(simulate(airline[i][1], matrix), simulate(airline[j][1], matrix));
      comparisons++;
      if (distance < minimum) { minimum = distance; worstPair = airline[i][0] + '/' + airline[j][0]; }
    }
  }
  console.log('airline ' + name + ': min DeltaE76=' + minimum.toFixed(2) + ' (' + worstPair + ')');
  if (!(minimum >= MIN_DELTA_E)) {
    console.error('FAIL airline ' + name + ' minimum below ' + MIN_DELTA_E);
    failed++;
  }
}
for (const [id, hex] of airline) {
  const distance = deltaE(simulate(hex, IDENTITY), simulate(AIRCRAFT_BODY, IDENTITY));
  if (!(distance >= MIN_BODY_DELTA_E)) {
    console.error('FAIL airline ' + id + ' too close to the aircraft body: ' + distance.toFixed(2));
    failed++;
  }
}
// [night-48a] U6 (D-08, D-47, PLAN-LINORYT): the glyphs in the Linoryt print. Each glyph is a silhouette with an ink
// outline (`--skin-glyph-outline` -> --base-ink) on the note's paper ground. Shape stays the carrier: in every simulation
// the outline reaches the non-text 3:1 on paper and on ochre, and each fill stays apart from paper (ΔE76 ≥ 15). On bare
// ochre several fills would sink (EUS crescent ΔE ~11 under tritan), so the glyph cell must keep its paper ground.
// [night-81a] D-336 (T6): the inks live on as the base inks of board.css section A (the base structure the board builds
// on: hub cause board, ATC strip, tutorial); the note glyph cell's paper ground went with Linoryt's notes (the board's
// signs are checked below).
const linCss = readFileSync(new URL('../src/ui/skin/board.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const skinCss = readFileSync(new URL('../src/ui/skin/current.css', import.meta.url), 'utf8');
const inks = Object.fromEntries([...linCss.matchAll(/--base-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const glyphs = [...readFileSync(new URL('../src/data/regions.ts', import.meta.url), 'utf8')
  .matchAll(/^\s*([A-Z]+):\s*\{\s*glyph:\s*'[a-z]+',\s*color:\s*'(#[0-9A-Fa-f]{6})'[^}]*?(provisional: true)?\s*\}/gm)]
  .map((m) => ({ id: m[1], hex: m[2], provisional: Boolean(m[3]) }));
const relative = (l) => { const [r, g, b] = l.map((c) => Math.min(1, Math.max(0, c))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const simLinear = (hex, matrix) => { const c = rgb(hex).map(linear); return matrix.map((row) => row.reduce((sum, k, i) => sum + k * c[i], 0)); };
const ratio = (a, b) => { const [x, y] = [relative(a), relative(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const official = glyphs.filter((glyph) => !glyph.provisional);
if (official.length !== 6 || official.some((glyph) => palette[glyph.id]?.toLowerCase() !== glyph.hex.toLowerCase())) {
  console.error('FAIL regions.ts glyph colours differ from the tested D-08 palette');
  failed++;
}
if (!/--skin-glyph-outline:\s*var\(--base-ink\)/.test(skinCss) || !inks.paper || !inks.ochre || !inks.ink) {
  console.error('FAIL the glyph outline is not the Linoryt ink, or an ink is missing');
  failed++;
}
let linoryt = 0;
for (const [name, matrix] of Object.entries({ normal: IDENTITY, ...MATRICES })) {
  for (const ground of ['paper', 'ochre']) {
    const outline = ratio(simLinear(inks.ink, matrix), simLinear(inks[ground], matrix));
    linoryt++;
    if (!(outline >= 3)) { console.error(`FAIL ${name} glyph outline on ${ground}: ${outline.toFixed(2)}`); failed++; }
    let minimum = Number.POSITIVE_INFINITY; let worst = '';
    for (const glyph of official) {
      const distance = deltaE(simulate(glyph.hex, matrix), simulate(inks[ground], matrix));
      comparisons++;
      if (distance < minimum) { minimum = distance; worst = glyph.id; }
    }
    console.log(`base ${name} on ${ground}: outline ${outline.toFixed(2)}:1, min fill DeltaE76=${minimum.toFixed(2)} (${worst})`);
    if (ground === 'paper' && !(minimum >= MIN_DELTA_E)) { console.error(`FAIL linoryt ${name} fill on paper below ${MIN_DELTA_E}`); failed++; }
  }
}
// [night-73a] D-328 (PLAN-NOWY-KIERUNEK.md step T2): the glyphs in the UI-A preview (src/ui/skin/board.css). On an airport
// sign they stand on black enamel with a cream outline (the Africa keyhole's fill #13302E sinks into enamel, so the
// outline carries the shape there: in every simulation the outline reaches the non-text 3:1 on enamel); on the flight
// strips' paper (T3) the fills stay apart from paper (ΔE76 ≥ 15) and the print outline reaches 3:1, as in Linoryt.
const boardCss = readFileSync(new URL('../src/ui/skin/board.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const board = Object.fromEntries([...boardCss.matchAll(/--board-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
if (!board.enamel || !board.cream || !board.paper || !board.print) { console.error('FAIL a board token is missing'); failed++; }
if (!/\.bd-notes \.airport-region-glyph path\s*\{[^}]*stroke:\s*var\(--board-cream\)/.test(boardCss)) {
  console.error('FAIL the sign glyphs lost their cream outline (the dark fills would sink into the enamel)');
  failed++;
}
// [night-75a] D-330 (T3): on the strips' paper the glyphs keep the print outline the paper checks below assume.
if (!/\.bd-strip \.airport-region-glyph path\s*\{[^}]*stroke:\s*var\(--board-print\)/.test(boardCss)) {
  console.error('FAIL the strip glyphs lost their print outline');
  failed++;
}
// [night-77a] D-332 (T5): the print-out's queue at closing and the settings' glyph legend stand on the same paper.
if (!/\.bd-print__glyphs \.airport-region-glyph path\s*\{[^}]*stroke:\s*var\(--board-print\)/.test(boardCss) ||
  !/\.airway-glyph-legend__row \.airport-region-glyph path\s*\{[^}]*stroke:\s*var\(--board-print\)/.test(boardCss)) {
  console.error('FAIL the print-out or legend glyphs lost their print outline');
  failed++;
}
let boardChecks = 0;
for (const [name, matrix] of Object.entries({ normal: IDENTITY, ...MATRICES })) {
  const enamelOutline = ratio(simLinear(board.cream, matrix), simLinear(board.enamel, matrix));
  const paperOutline = ratio(simLinear(board.print, matrix), simLinear(board.paper, matrix));
  boardChecks += 2;
  if (!(enamelOutline >= 3)) { console.error(`FAIL board ${name} glyph outline on enamel: ${enamelOutline.toFixed(2)}`); failed++; }
  if (!(paperOutline >= 3)) { console.error(`FAIL board ${name} glyph outline on paper: ${paperOutline.toFixed(2)}`); failed++; }
  let minimum = Number.POSITIVE_INFINITY; let worst = '';
  for (const glyph of official) {
    const distance = deltaE(simulate(glyph.hex, matrix), simulate(board.paper, matrix));
    comparisons++;
    if (distance < minimum) { minimum = distance; worst = glyph.id; }
  }
  console.log(`board ${name}: outline on enamel ${enamelOutline.toFixed(2)}:1, on paper ${paperOutline.toFixed(2)}:1, min fill on paper DeltaE76=${minimum.toFixed(2)} (${worst})`);
  if (!(minimum >= MIN_DELTA_E)) { console.error(`FAIL board ${name} fill on paper below ${MIN_DELTA_E}`); failed++; }
}
console.log('SUMMARY test:cvd seed=' + SEED + ' modes=3 colours=' + entries.length + ' airline=' + airline.length + ' base=' + linoryt + ' board=' + boardChecks +
  ' comparisons=' + comparisons + ' passed=' + (failed ? 0 : 1) + ' failed=' + failed);
if (failed) process.exitCode = 1;

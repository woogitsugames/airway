// WCAG 2.x contrast for every declared text/background token pair.
import { readFileSync } from 'node:fs';

const SEED = '0xA1A1';
const THRESHOLD = 4.5;
const tokens = JSON.parse(readFileSync(new URL('../src/ui/theme/tokens.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../src/ui/theme/theme.css', import.meta.url), 'utf8');
const failures = [];
for (const [token, variable] of Object.entries({
  panel: 'panel', paper: 'paper', dim: 'dim', jam: 'jam', jamText: 'jam-text',
  ticket: 'ticket', ink: 'ink', kraftLabel: 'kraft-label',
  kraftEmpty: 'kraft-empty', kraftEmptyInk: 'kraft-empty-ink', // [night-11n] R5d
})) {
  const match = css.match(new RegExp('--airway-' + variable + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i'));
  if (!match || match[1].toLowerCase() !== tokens.colors[token].toLowerCase()) {
    failures.push('CSS variable --airway-' + variable + ' differs from token ' + token);
  }
}
function luminance(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Invalid hex colour: ' + hex);
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
if (!Array.isArray(tokens.textPairs) || tokens.textPairs.length < 1) {
  failures.push('No text/background pairs declared');
} else {
  const seen = new Set();
  for (const pair of tokens.textPairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      failures.push('Invalid text pair');
      continue;
    }
    const [fg, bg] = pair;
    if (seen.has(fg + '/' + bg)) failures.push('Duplicate pair ' + fg + '/' + bg);
    seen.add(fg + '/' + bg);
    try {
      const value = contrast(tokens.colors[fg], tokens.colors[bg]);
      if (value < THRESHOLD) failures.push(fg + ' on ' + bg + ': ' + value.toFixed(2));
    } catch (error) {
      failures.push(fg + '/' + bg + ': ' + String(error));
    }
  }
}
// These semantic pairs are used by the released skin ([night-46a] D-301: Linoryt); resolve the current aliases rather than duplicating colours.
const skinCss = readFileSync(new URL('../src/ui/skin/current.css', import.meta.url), 'utf8');
const inkCss = readFileSync(new URL('../src/ui/skin/linoryt.css', import.meta.url), 'utf8');
const root = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
const declarations = Object.fromEntries([...`${root(inkCss)};${root(skinCss)}`.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
  .map((match) => [match[1], match[2].trim()]));
function resolveSkin(name, seen = new Set()) {
  if (seen.has(name)) throw new Error('Cyclic skin token: ' + name);
  seen.add(name);
  const value = declarations[name];
  if (!value) throw new Error('Missing skin token: ' + name);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (!alias) throw new Error('Non-opaque skin token: ' + name);
  return resolveSkin(alias[1], seen);
}
for (const [fg, bg] of [['--skin-go-flap-ink', '--skin-go-flap-bg'], ['--skin-edge-jam-ink', '--skin-edge-jam-bg']]) {
  try { const value = contrast(resolveSkin(fg), resolveSkin(bg)); if (value < THRESHOLD) failures.push(`${fg} on ${bg}: ${value.toFixed(2)}`); }
  catch (error) { failures.push(String(error)); }
}
// [night-48a] U6 (D-47, D-177, PLAN-LINORYT): the Linoryt inks. UI text pairs (formerly only in test:skin-tokens) at
// 4.5:1; the world inks (`LINORYT_INKS`, src/render/globe/linoryt.ts, read only) equal the UI inks; every airport note
// prints its text on its own paper ground, so a label reads the same over ochre land, blue sea and the night cross-hatch
// (the ground is paper, never the world); stamps (ink, 2 px paper outline, render spec §5) reach the D-177 non-text 3:1
// against every world ground through the better of their two boundaries (outline against the ground, ink core against
// the outline). The real frames are measured by test:e2e:linoryt-contrast.
const LINORYT_TEXT = [['ink', 'paper'], ['ink-dim', 'paper'], ['blue', 'paper'], ['red', 'paper'], ['ink', 'paper-deep'],
  ['blue', 'paper-deep'], ['paper', 'ink'], ['ink', 'paper-pressed'], ['paper', 'red'], ['paper', 'blue']];
const NON_TEXT = 3;
const lin = Object.fromEntries([...root(inkCss).matchAll(/--lin-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const world = Object.fromEntries([...readFileSync(new URL('../src/render/globe/linoryt.ts', import.meta.url), 'utf8')
  .match(/LINORYT_INKS\s*=\s*\{([^}]*)\}/)?.[1].matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g) ?? []].map((m) => [m[1], m[2]]));
let linorytPairs = 0;
for (const [fg, bg] of LINORYT_TEXT) {
  linorytPairs++;
  if (!lin[fg] || !lin[bg]) { failures.push(`linoryt ${fg}/${bg}: missing ink`); continue; }
  const value = contrast(lin[fg], lin[bg]);
  if (value < THRESHOLD) failures.push(`linoryt ${fg} on ${bg}: ${value.toFixed(2)}`);
}
for (const name of ['paper', 'ink', 'blue', 'ochre', 'red']) {
  if (!world[name] || world[name].toLowerCase() !== lin[name]?.toLowerCase()) failures.push(`LINORYT_INKS.${name} ${world[name]} differs from --lin-${name} ${lin[name]}`);
}
// The world grounds a note or a stamp can stand on; the night cross-hatch is ink lines over ochre or blue, so both of its
// inks count as ground.
const grounds = { 'ochre land': ['ochre'], 'blue sea': ['blue'], 'night hatch on land': ['ochre', 'ink'], 'night hatch on sea': ['blue', 'ink'],
  'paper sky': ['paper'] };
const noteGround = lin['paper'];
for (const [where, inks] of Object.entries(grounds)) {
  linorytPairs++;
  // Text on a note: ink on the note's own paper, whatever lies behind the note.
  const text = contrast(lin['ink'], noteGround);
  if (text < THRESHOLD) failures.push(`linoryt note text on ${where}: ${text.toFixed(2)}`);
  for (const stamp of ['ink', 'red']) {
    linorytPairs++;
    const core = contrast(world[stamp] ?? '#000000', world['paper'] ?? '#000000');
    const edge = Math.min(...inks.map((ink) => contrast(world['paper'] ?? '#000000', world[ink] ?? '#000000')));
    // The outline alone may vanish on ink hatch lines, the core alone on ochre: D-177 takes the better boundary.
    const best = Math.max(core, edge);
    if (best < NON_TEXT) failures.push(`linoryt ${stamp} stamp on ${where}: edge ${edge.toFixed(2)} core ${core.toFixed(2)}`);
  }
}
// [night-73a] D-328 (PLAN-NOWY-KIERUNEK.md step T2): the UI-A preview's signs (src/ui/skin/board.css). Every sign prints
// its letters on its own opaque ground, so a sign reads the same on the day, dusk and night photo: cream on enamel (code,
// queue count, city strip, a direction sign past the yellow budget), white on red (a jam), ink on the sign yellow (a
// direction sign), ink on cream (the NOWE tag). Atlas labels (countries cream, seas water blue) are read against their
// dark halo, which is drawn round every letter; the photos themselves are measured in T7.
const boardCss = readFileSync(new URL('../src/ui/skin/board.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const board = Object.fromEntries([...boardCss.matchAll(/--board-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const BOARD_SIGN_TEXT = [['cream', 'enamel'], ['white', 'red'], ['sign-ink', 'sign'], ['sign-ink', 'cream'],
  ['atlas-country', 'atlas-halo'], ['atlas-sea', 'atlas-halo']];
let boardPairs = 0;
for (const ground of ['day photo', 'dusk photo', 'night photo']) {
  for (const [fg, bg] of BOARD_SIGN_TEXT) {
    boardPairs++;
    if (!board[fg] || !board[bg]) { failures.push(`board ${fg}/${bg}: missing token`); continue; }
    const value = contrast(board[fg], board[bg]);
    if (value < THRESHOLD) failures.push(`board ${fg} on ${bg} (on the ${ground}): ${value.toFixed(2)}`);
  }
}
if (!/\.bd-notes \.bd-city\s*\{[^}]*background:\s*var\(--board-enamel\)/.test(boardCss)) failures.push('board: the city strip lost its enamel ground');
// [night-75a] D-330 (T3): the hub flight strips, the full strip and the ATC strip are paper (opaque): print and the
// labels' dimmer print on paper, the jam's red pencil figures on paper, the "+N" tile's cream on enamel (counted above).
for (const [fg, bg] of [['print', 'paper'], ['print-dim', 'paper'], ['red', 'paper']]) {
  boardPairs++;
  if (!board[fg] || !board[bg]) { failures.push(`board ${fg}/${bg}: missing token`); continue; }
  const value = contrast(board[fg], board[bg]);
  if (value < THRESHOLD) failures.push(`board strip ${fg} on ${bg}: ${value.toFixed(2)}`);
}
if (!/\.bd-strip\s*\{[^}]*background:\s*var\(--board-paper\)/.test(boardCss)) failures.push('board: the hub strip lost its paper ground');
// [night-77a] D-332 (T5): the menu board, the pages and the print-out. Cream and the board labels on enamel and on the
// console (pause, keys), ink on the yellow sign (the main action), print and its labels and the stamp's red on paper,
// the engraved status line on the console, the "REKORD" tag (paper on print).
for (const [fg, bg] of [['cream', 'enamel'], ['cream-2', 'enamel'], ['cream', 'console'], ['engrave', 'console'], ['cream', 'flap-a'],
  ['cream', 'flap-b'], ['sign-ink', 'sign'], ['print', 'paper'], ['print-dim', 'paper'], ['red', 'paper'], ['paper', 'print'], ['white', 'red']]) {
  boardPairs++;
  if (!board[fg] || !board[bg]) { failures.push(`board ${fg}/${bg}: missing token`); continue; }
  const value = contrast(board[fg], board[bg]);
  if (value < THRESHOLD) failures.push(`board sheet ${fg} on ${bg}: ${value.toFixed(2)}`);
}
if (!/\.bd-print__roll\s*\{[^}]*background:\s*var\(--board-paper\)/.test(boardCss)) failures.push('board: the print-out lost its paper ground');
if (!/\.bd-atlas__label\s*\{[^}]*text-shadow:[^;]*var\(--board-atlas-halo\)/.test(boardCss)) failures.push('board: atlas labels lost their halo');
linorytPairs += boardPairs;
for (const message of failures) console.error('FAIL ' + message);
console.log('SUMMARY test:contrast seed=' + SEED + ' pairs=' + ((tokens.textPairs?.length ?? 0) + 2 + linorytPairs) +
  ' threshold=' + THRESHOLD + ' passed=' + (failures.length ? 0 : 1) + ' failed=' + failures.length);
if (failures.length) process.exitCode = 1;

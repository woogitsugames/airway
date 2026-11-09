// [night-11aq] D-249: UI skin guard. The component CSS of the in-game HUD (boarding pass, tag dock), airport tags and
// chips, pause sheet, weekly board, hub cause board, game-over report, main menu / settings and [night-11as] the ATC
// strip, logbook, puzzle board, leaderboard, tutorial and glyph outline (glyphs.ts, puzzles/index.ts) reads every colour,
// typeface, weight, motion duration, corner, shadow and icon size from src/ui/skin/current.css, so a UI skin
// (docs/styles/ui-2026-11/KIERUNKI.md) is one token file plus structural tweaks. Fails when a colour literal (#hex,
// rgb/hsl, a named colour), a font family name or generic family, a numeric font weight or a ms/s duration appears in a
// covered file outside the skin file; when a component uses an undefined --skin-* token or the skin defines one that
// nothing reads; when a covered CSS file is imported without the skin; or when the skin redefines a palette/text-scale
// token (--airway-*, D-248 stays in theme.css). Self-check: the detector must flag literals planted in a copy.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constantProperties, inlineInks, inlineSkin, keptSkin, baseInks, referencedValues, REFERENCED_TOKENS, resolveTokens, skinBuild, skinTokens, withConstants } from './vite-skin-inline.mjs';
import { skinOverrides, pruneOverridden } from './vite-skin-prune.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIN = 'src/ui/skin/current.css';
const COVERED = ['src/ui/hud.css', 'src/ui/overlay.css', 'src/ui/game.css', 'src/ui/upgrade/upgrade.css', 'src/ui/hubBoard.css',
  'src/ui/gameover/gameover.css', 'src/ui/menu/menu.css',
  // [night-11as] D-250 follow-up: the components D-250 left out.
  'src/ui/atcStrip.css', 'src/ui/logbook/logbook.css', 'src/ui/puzzles/board.css', 'src/ui/leaderboard/leaderboard.css',
  'src/ui/tutorial/tutorial.css'];
/** TS modules whose inline SVG inks are skin tokens. */
const COVERED_TS = ['src/ui/overlay.ts', 'src/ui/glyphs.ts', 'src/ui/puzzles/index.ts'];
const NAMED = /\b(white|black|red|green|blue|yellow|orange|gray|grey|silver|maroon|navy|teal|purple|pink|gold|beige|ivory|tan|brown|cyan|magenta)\b/i;
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Every declaration `prop: value` with its line, outside comments (nested @media / @container blocks included). */
function declarations(css) {
  const out = [];
  const text = stripComments(css);
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '}' || ch === ';') {
      const chunk = text.slice(start, i);
      const colon = chunk.indexOf(':');
      if (ch !== '{' && colon > 0) {
        const prop = chunk.slice(0, colon).trim();
        if (/^-{0,2}[a-z][a-z0-9-]*$/i.test(prop)) {
          out.push({ prop: prop.toLowerCase(), value: chunk.slice(colon + 1).trim(), line: text.slice(0, start).split('\n').length });
        }
      }
      start = i + 1;
    }
  }
  return out;
}

/** Literals a skin owns, found in one CSS source. */
function literals(css) {
  const found = [];
  for (const { prop, value, line } of declarations(css)) {
    const v = value.replace(/!important/g, '');
    const where = `${line}: ${prop}: ${value}`.slice(0, 120);
    if (!prop.includes('mask')) { // the ticket notch mask is an alpha stencil, not a colour of the skin
      if (/#[0-9a-f]{3,8}\b/i.test(v)) found.push('colour ' + where);
      if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i.test(v)) found.push('colour function ' + where);
      if (!prop.startsWith('--') && NAMED.test(v.replace(/var\([^)]*\)/g, ''))) found.push('named colour ' + where);
    }
    if (prop === 'font' || prop === 'font-family') {
      if (/['"]/.test(v) || /\b(sans-serif|serif|monospace|system-ui)\b/.test(v)) found.push('font family ' + where);
      if (prop === 'font-family' && !/^(var\(|inherit|initial|unset)/.test(v)) found.push('font family ' + where);
    }
    if (/\b(sans-serif|monospace)\b/.test(v) && prop !== 'font' && prop !== 'font-family') found.push('font family ' + where);
    if ((prop === 'font' && /^\s*[1-9]00\b/.test(v)) || (prop === 'font-weight' && /^\s*([1-9]00|bold|bolder|lighter)\b/.test(v))) {
      found.push('font weight ' + where);
    }
    if (/^(animation|transition)(-duration|-delay)?$/.test(prop) && /(^|[\s,])\.?\d+(\.\d+)?m?s\b/.test(v)) found.push('duration ' + where);
  }
  return found;
}

const results = [];
const check = (name, ok, why = '') => results.push({ name, ok, why });

// 1. Self-check: the detector sees each kind of literal.
const planted = '.x { color: #fff; background: rgba(0,0,0,.5); border-color: white; font: 800 12px/1 \'Overpass\', sans-serif; }\n' +
  '.y { font-family: Overpass; font-weight: 700; transition: opacity 90ms linear; animation: a .2s; }';
const seen = literals(planted);
check('detector flags planted literals', seen.length >= 8, `${seen.length} of 8+ flagged`);
check('detector ignores tokens', literals('.x { color: var(--skin-a); font: var(--skin-weight-bold) 12px/1 var(--skin-face-mono); animation: none; }').length === 0);

// 2. No literals in the covered component CSS.
let uses = 0;
const used = new Set();
for (const file of COVERED) {
  const css = read(file);
  const found = literals(css);
  check(`${file} has no colour/font/motion literal`, found.length === 0, found.slice(0, 4).join(' | '));
  for (const m of stripComments(css).matchAll(/var\(--skin-([a-z0-9-]+)\)/g)) { used.add(m[1]); uses++; }
}
for (const file of COVERED_TS) {
  const ts = read(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = ts.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? [];
  check(`${file} has no colour literal`, hex.length === 0, hex.join(' '));
  for (const m of ts.matchAll(/var\(--skin-([a-z0-9-]+)\)/g)) { used.add(m[1]); uses++; }
}

// 3. Skin file: defines every used token, nothing dead, no palette/text-scale redefinition.
const skin = stripComments(read(SKIN));
const defined = new Map([...skin.matchAll(/--skin-([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
for (const m of skin.matchAll(/var\(--skin-([a-z0-9-]+)\)/g)) used.add(m[1]);
const missing = [...used].filter((name) => !defined.has(name));
const dead = [...defined.keys()].filter((name) => !used.has(name));
check('every --skin-* token used is defined in the skin', missing.length === 0, missing.join(' '));
check('the skin defines no unused token', dead.length === 0, dead.join(' '));
check('the skin keeps the palette and D-248 text tokens in theme.css', !/--airway-[a-z-]+\s*:/.test(skin));
check('the skin has faces, weights and motion', ['face-text', 'face-display', 'face-mono', 'weight-bold', 'motion-follow'].every((n) => defined.has(n)));

// 4. The skin is loaded wherever a covered CSS file is.
const tsFiles = [];
const walk = (dir) => { for (const name of readdirSync(resolve(ROOT, dir))) {
  const path = `${dir}/${name}`;
  if (statSync(resolve(ROOT, path)).isDirectory()) walk(path); else if (/\.ts$/.test(name)) tsFiles.push(path);
} };
walk('src');
walk('dev');
const late = [];
for (const file of tsFiles) {
  const source = read(file);
  const imports = [...source.matchAll(/^import\s+'([^']+\.css)';/gm)].map((m) => relative(ROOT, resolve(ROOT, dirname(file), m[1])));
  for (const css of imports.filter((path) => COVERED.includes(path))) {
    const skinAt = imports.indexOf(SKIN);
    const mainLoaded = file === 'src/main.ts' && skinAt >= 0;
    if (!mainLoaded && (skinAt < 0 || skinAt > imports.indexOf(css))) late.push(`${file} → ${css}`);
  }
}
check('every module importing a covered CSS file imports the skin first', late.length === 0, late.join(' | '));
check('src/main.ts loads the skin', /import '\.\/ui\/skin\/current\.css';/.test(read('src/main.ts')));

// 5. [night-11ar] D-252: release builds write the token values in place (scripts/vite-skin-inline.mjs).
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const unit = resolveTokens(skinTokens(':root {\n  /* c */ --skin-a: #fff;\n  --skin-b: var(--skin-a);\n  --skin-c: 1px solid var(--p);\n}'));
check('inline: nested tokens resolve', unit.get('b') === '#fff' && unit.get('c') === '1px solid var(--p)');
check('inline: a use becomes its value', inlineSkin('.x { color: var(--skin-b); border: var(--skin-c); }', unit) ===
  '.x { color: #fff; border: 1px solid var(--p); }');
check('inline: refuses fallbacks, unknown tokens, cycles, a second rule and a token or read property set outside :root', [
  () => inlineSkin('.x { color: var(--skin-a, red); }', unit),
  () => inlineSkin('.x { color: var(--skin-z); }', unit),
  () => resolveTokens(skinTokens(':root { --skin-a: var(--skin-b); --skin-b: var(--skin-a); }')),
  () => skinTokens(':root { --skin-a: 1px; }\n.x { color: red; }'),
  () => inlineSkin('.x { --skin-a: 2px; }', unit),
  () => inlineSkin('.x { --p: red; }', unit),
].every(throws));
const constants = constantProperties([':root { --p: #123; --q: #456; --r: var(--p); }\n:root[data-x] { --q: #000; }\n@media (x) { :root { --s: 1px; } }\n:root { --s: 2px; --t: 3px; }'],
  ["el.style.setProperty('--t', '4px')"]);
check('inline: only properties set once, in a plain :root, without var() and untouched by scripts, are constants',
  [...constants.keys()].join() === 'p' && withConstants(unit, constants).get('c') === '1px solid #123');
check('inline: the skin file keeps only the tokens scripts read', keptSkin(unit, ['b', 'zz']) === ':root {\n  --skin-b: #fff;\n}\n');
const real = skinBuild(ROOT);
const leftover = COVERED.filter((file) => /var\(--skin-/.test(inlineSkin(read(file), real.resolved, file)));
check('inline: every covered file of the real skin inlines with no token left', leftover.length === 0, leftover.join(' '));
check('inline: the real skin keeps exactly the tokens of the covered TypeScript', [...real.keep].sort().join() ===
  [...new Set(COVERED_TS.flatMap((file) => [...read(file).matchAll(/var\(--skin-([a-z0-9-]+)\)/g)].map((m) => m[1])))].sort().join());
// [night-36a] D-294: the font stacks stay `var(--skin-face-*)` references in the release (one :root definition each);
// every other token is still written in place, nested references included, and the kept skin defines each reference.
{
  const refUnit = referencedValues(new Map([['f', "'X', serif"], ['g', '700 1px var(--skin-f)'], ['h', 'var(--skin-c)'], ['c', '#fff']]),
    ['f']);
  check('inline: a referenced token stays var() (also inside other tokens), the rest resolves',
    refUnit.get('f') === 'var(--skin-f)' && refUnit.get('g') === '700 1px var(--skin-f)' && refUnit.get('h') === '#fff',
    [...refUnit].join(' | '));
  const used = new Set(COVERED.flatMap((file) => [...inlineSkin(read(file), real.inline, file).matchAll(/var\(--skin-([a-z0-9-]+)/g)].map((m) => m[1])));
  const kept = keptSkin(real.resolved, new Set([...real.keep, ...real.refs]));
  check('inline: the release keeps only the font stacks as references, each defined (resolved) in the kept skin',
    REFERENCED_TOKENS.every((name) => real.refs.has(name) && kept.includes(`--skin-${name}: ${real.resolved.get(name)};`) &&
      !real.resolved.get(name).includes('var(')) && [...used].every((name) => real.refs.has(name)) && used.size > 0,
    [...used].join(' '));
  const cssFiles = [];
  const walkCss = (dir) => { for (const name of readdirSync(resolve(ROOT, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(resolve(ROOT, path)).isDirectory()) walkCss(path); else if (/\.css$/.test(name)) cssFiles.push(path);
  } };
  walkCss('src');
  const setElsewhere = cssFiles.filter((file) => file !== SKIN &&
    REFERENCED_TOKENS.some((name) => new RegExp(`--skin-${name}\\s*:`).test(read(file))));
  check('inline: no release stylesheet sets a referenced token (the :root value is the only one)', setElsewhere.length === 0,
    setElsewhere.join(' '));
}

// 6. [night-46a] D-301 (Linoryt's flip); [night-81a] D-336 (PLAN-NOWY-KIERUNEK.md step T6): UI-A is the shipped skin.
// current.css holds its token values; the structure is src/ui/skin/board.css (section A: the base structure the board
// builds on, Linoryt's until T6, with the base inks in a plain :root; section B: the board) and board-week.css, both
// loaded statically by src/main.ts after every component stylesheet, every rule scoped to :root[data-skin="board"]
// (index.html sets it; a release writes it `:root:root`), the inks inlined with no token left. Linoryt's skin
// (linoryt.css, linoryt.ts), its faces and the DEV `?skin=` flag are gone; Róża and the Diorama comparison before them.
const BOARD_FILE = 'src/ui/skin/board.css';
const SECTION_B = '/* ==== Section B';
const LIN = BOARD_FILE; // the base structure lives in board.css section A
const sectionA = (css) => css.slice(0, css.indexOf(SECTION_B));
const main = read('src/main.ts');
const gone = ['src/ui/skin/roza.css', 'src/ui/skin/roza.ts', 'src/ui/skin/diorama.css', 'public/fonts/Alegreya-700.woff2',
  'public/fonts/OFL-Alegreya.txt', 'src/ui/skin/linoryt.css', 'src/ui/skin/linoryt.ts', 'public/fonts/Besley-800.woff2',
  'public/fonts/Besley-900.woff2', 'public/fonts/OFL-Besley.txt', 'public/fonts/SchibstedGrotesk-VF.woff2', 'public/fonts/OFL-SchibstedGrotesk.txt']
  .filter((file) => { try { statSync(resolve(ROOT, file)); return true; } catch { return false; } });
check('base: Linoryt (skin, helpers, Besley, Schibsted Grotesk), Róża, the Diorama comparison and Alegreya are gone from the tree', gone.length === 0, gone.join(' '));
const skinRefs = tsFiles.filter((file) => /skin\/(roza|diorama|linoryt)\b|\bstartRoza\b|\bstartLinoryt\b|dataset\.skin === '(roza|current|linoryt)'|query\.get\('skin'\)/.test(read(file)));
check('base: no module reads Linoryt, Róża, the comparison skin or a `?skin=` query', skinRefs.length === 0, skinRefs.join(' '));
check('base: index.html sets <html data-skin="board"> for the first paint', /<html[^>]*data-skin="board"/.test(read('index.html')));
check('base: src/main.ts starts the helpers and the board on every boot (not behind a DEV branch)',
  /^startSkinBase\(\{ t, localNumber \}\);$/m.test(main) && /^const boardReady: Promise<void> = startBoardSkin\(\);$/m.test(main));
{
  const lin = stripComments(sectionA(read(LIN)));
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < lin.length; i++) {
    const ch = lin[i];
    if (ch === '{') { const sel = lin.slice(start, i).trim(); if (depth === 0 || !sel.startsWith('@')) rules.push(sel); depth++; start = i + 1; }
    else if (ch === '}') { depth--; start = i + 1; }
    else if (ch === ';') start = i + 1;
  }
  /** A selector list split on top-level commas (not the ones inside :has(…)). */
  const splitList = (sel) => {
    const parts = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < sel.length; i++) {
      if (sel[i] === '(') depth++;
      else if (sel[i] === ')') depth--;
      else if (sel[i] === ',' && depth === 0) { parts.push(sel.slice(from, i)); from = i + 1; }
    }
    return [...parts, sel.slice(from)];
  };
  const loose = rules.filter((sel) => !/^@(media|font-face)\b/.test(sel) && sel !== ':root' &&
    !splitList(sel).every((part) => /^:root(\[data-airway-motion="reduce"\])?\[data-skin="board"\]/.test(part.trim())));
  check('base: every structural rule of section A is scoped to :root[data-skin="board"]', rules.length > 40 && loose.length === 0, loose.slice(0, 3).join(' | '));
  check('base: the structure sets no skin token', !/--skin-[a-z0-9-]+\s*:/.test(stripComments(read(LIN))));
  check('base: section A loads no face (the UI-A faces are section B\'s)', !/@font-face/.test(lin));
  const linRoot = [...lin.matchAll(/(?:^|\})\s*:root\s*\{([^{}]*)\}/g)].map((m) => m[1]).join(';');
  check('base: the plain :root sets only the inks (--base-*)', linRoot.length > 0 &&
    [...linRoot.matchAll(/(--[a-z0-9-]+)\s*:/g)].every((m) => m[1].startsWith('--base-')));
  check('base: never redefines the palette or text-scale tokens', !/--airway-[a-z-]+\s*:/.test(stripComments(read(LIN))));
  check('base: the structure inlines with no token left but the font stacks',
    [...inlineSkin(read(LIN), real.inline, LIN).matchAll(/var\(--skin-([a-z0-9-]+)/g)].every((m) => real.refs.has(m[1])));
  const constants = constantProperties([lin], []);
  const inks = ['paper', 'paper-deep', 'paper-pressed', 'ink', 'ink-dim', 'rule-ink', 'blue', 'ochre', 'red'];
  check('base: the inks are palette constants (written out in the token values)', inks.every((name) => constants.has('base-' + name)) &&
    ![...real.resolved.values()].some((value) => /var\(--base-/.test(value)), inks.filter((name) => !constants.has('base-' + name)).join(' '));
  // [night-48a] U6: the release writes the ink constants in place (D-294 mechanism); vars that a script sets or whose value
  // holds a var() stay references, a fallback form is left alone.
  const inkMap = baseInks(constantProperties([read(LIN), read(SKIN)], [read('src/ui/skin/base.ts'), read('src/ui/skin/board.ts')]));
  const printed = inlineInks(inlineSkin(read(LIN), real.inline, LIN), inkMap);
  const leftInks = [...new Set([...printed.matchAll(/var\(--(base-[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((name) => inkMap.has(name));
  check('base: the release writes the inks in place (var(--base-ink) -> #1E1C1F), script-set and var() inks stay',
    inkMap.size >= 9 && leftInks.length === 0 && /var\(--base-top\)/.test(printed) && !inkMap.has('base-pass-bottom') &&
    inlineInks('a{color:var(--base-ink);b:var(--base-ink, red);c:var(--base-x)}', new Map([['base-ink', '#1E1C1F']])) ===
      'a{color:#1E1C1F;b:var(--base-ink, red);c:var(--base-x)}', leftInks.join(' '));
  // D-47: every text pair of the inks reaches 4.5:1 (paper letters on the red block included, D-284).
  const ink = Object.fromEntries([...lin.matchAll(/--base-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [['ink', 'paper'], ['ink-dim', 'paper'], ['blue', 'paper'], ['red', 'paper'], ['ink', 'paper-deep'], ['blue', 'paper-deep'],
    ['paper', 'ink'], ['ink', 'paper-pressed']];
  const weak = pairs.filter(([fg, bg]) => !ink[fg] || !ink[bg] || ratio(ink[fg], ink[bg]) < 4.5)
    .map(([fg, bg]) => `${fg}/${bg} ${ink[fg] && ink[bg] ? ratio(ink[fg], ink[bg]).toFixed(2) : 'missing'}`);
  check('base: text inks reach 4.5:1 on paper and paper on the red block (D-47)', weak.length === 0, weak.join(' '));
  const structureImports = tsFiles.filter((file) => /import\s*\(?\s*'[^']*skin\/board(-week)?\.css(\?raw)?'/.test(read(file)));
  const staticImports = [...main.matchAll(/^import\s[^;]*;/gm)].map((m) => m[0]);
  check('base: src/main.ts (only) imports the structure, board.css then board-week.css after every other import',
    structureImports.join() === 'src/main.ts' && staticImports.at(-2) === "import './ui/skin/board.css';" &&
    /^import '\.\/ui\/skin\/board-week\.css';/.test(staticImports.at(-1) ?? ''), structureImports.join(' ') + ' | ' + staticImports.slice(-2).join(' '));
  const runtime = [...read('src/ui/skin/base.ts').matchAll(/^import\s+(?!type\b)[^;]*;/gm)].map((m) => m[0]);
  check('base: the helpers have no runtime import (src/main.ts hands in i18n)', runtime.length === 0, runtime.join(' '));
  const devOnly = [...tsFiles.filter((file) => file.startsWith('src/'))].filter((file) => /import\.meta\.env\.DEV\s*&&\s*skinBase\.on/.test(read(file)));
  check('base: no helper call is DEV-only', devOnly.length === 0, devOnly.join(' '));
  check('base: Linoryt\'s notes (U2), menu index and U4 pages are not in the structure (the board prints its own)',
    !/\/\* U2 notes \*\/|\/\* U4 screens \*\/|Part 4: menu/.test(read(LIN)));
}
// 7. [night-69a] D-324 (PLAN-NOWY-KIERUNEK.md step T1): UI-A "Lotniskowa tablica i paski lotu", src/ui/skin/board.{css,ts}
// ([night-81a] D-336: shipped since T6; the contract below applies to board.css section B). Its contract:
// one token block `:root[data-skin="board"] { --board-*: … }` holds every colour, face and duration; every structural rule
// is scoped to :root[data-skin="board"] and uses no literal; it never sets a --skin-* or palette token; its text pairs reach
// D-47 4.5:1; its faces (Archivo, Chivo Mono, SIL OFL) are WOFF2 in public/fonts/ with licences and stay out of dist/
// (PREVIEW_FONTS); the helpers have no runtime import; no module imports the preview statically; index.html is unchanged.
{
  const BOARD = 'src/ui/skin/board.css';
  const raw = read(BOARD).slice(read(BOARD).indexOf(SECTION_B)); // [night-81a] D-336: section B (section A is part 6's)
  const board = stripComments(raw);
  const blocks = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < board.length; i++) {
    const ch = board[i];
    if (ch === '{') { if (depth === 0) blocks.push({ sel: board.slice(start, i).trim(), from: i + 1 }); depth++; start = i + 1; }
    else if (ch === '}') { depth--; if (depth === 0) blocks.at(-1).body = board.slice(blocks.at(-1).from, i); start = i + 1; }
    else if (ch === ';' && depth === 0) start = i + 1;
  }
  const tokenBlocks = blocks.filter((b) => b.sel === ':root[data-skin="board"]');
  check('board: one token block :root[data-skin="board"]', tokenBlocks.length === 1);
  const tokenBody = tokenBlocks[0]?.body ?? '';
  const declared = [...tokenBody.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
  check('board: the token block sets only --board-* tokens', declared.length > 30 && declared.every((name) => name.startsWith('--board-')),
    declared.filter((name) => !name.startsWith('--board-')).join(' '));
  const structure = blocks.filter((b) => b !== tokenBlocks[0] && !/^@(font-face|keyframes)\b/.test(b.sel));
  const nested = (b) => (/^@(media|container)\b/.test(b.sel) ? [...b.body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] })) : [b]);
  const rules = structure.flatMap(nested);
  const parts = (sel) => { const out = []; let d = 0; let from = 0;
    for (let i = 0; i < sel.length; i++) { if (sel[i] === '(') d++; else if (sel[i] === ')') d--; else if (sel[i] === ',' && d === 0) { out.push(sel.slice(from, i)); from = i + 1; } }
    return [...out, sel.slice(from)].map((p) => p.trim()); };
  const loose = rules.filter((r) => !parts(r.sel).every((p) => p.startsWith(':root[data-skin="board"]')));
  check('board: every structural rule is scoped to :root[data-skin="board"]', rules.length > 60 && loose.length === 0, loose.slice(0, 3).map((r) => r.sel).join(' | '));
  const boardLiterals = rules.flatMap((r) => literals(`x{${r.body}}`).filter((what) => !/^font weight /.test(what)));
  check('board: the structure has no colour, font family or duration literal (all in the token block)', boardLiterals.length === 0, boardLiterals.slice(0, 4).join(' | '));
  check('board: the structure sets only its local sizes (--bd-*), never a --board-*, --skin-* or palette token',
    rules.every((r) => [...r.body.matchAll(/(?:^|;)\s*(--[a-z0-9-]+)\s*:/g)].every((m) => m[1].startsWith('--bd-'))) &&
    !/--skin-[a-z0-9-]+\s*:|--airway-[a-z-]+\s*:/.test(board));
  const usedBoard = new Set([...board.matchAll(/var\((--board-[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const undefinedBoard = [...usedBoard].filter((name) => !declared.includes(name));
  check('board: every --board-* token used is defined', undefinedBoard.length === 0, undefinedBoard.join(' '));
  // D-47: text pairs of the skin (T1 and the later stages' pairs: signs, jam, strips).
  const hexOf = Object.fromEntries([...tokenBody.matchAll(/--board-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const textPairs = [['cream', 'flap-a'], ['cream', 'flap-b'], ['cream', 'enamel'], ['cream-2', 'enamel'], ['engrave', 'console'],
    ['white', 'console'], ['sign-ink', 'cream'], ['print', 'paper'], ['sign-ink', 'sign'], ['white', 'red'], ['red', 'paper'], ['cream', 'console'], ['atlas-country', 'atlas-halo'], ['atlas-sea', 'atlas-halo']];
  const weakBoard = textPairs.filter(([fg, bg]) => !hexOf[fg] || !hexOf[bg] || ratio(hexOf[fg], hexOf[bg]) < 4.5)
    .map(([fg, bg]) => `${fg}/${bg} ${hexOf[fg] && hexOf[bg] ? ratio(hexOf[fg], hexOf[bg]).toFixed(2) : 'missing'}`);
  check('board: text pairs reach 4.5:1 (D-47: cream on flaps and enamel, captions on the console, white on red, red and print on paper, ink on yellow)',
    weakBoard.length === 0, weakBoard.join(' '));
  const faceFiles = [...raw.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
  const { PREVIEW_FONTS } = await import('./vite-font-files.mjs');
  const absentBoard = [...faceFiles, 'OFL-Archivo.txt', 'OFL-ChivoMono.txt']
    .filter((file) => { try { return statSync(resolve(ROOT, 'public/fonts', file)).size === 0; } catch { return true; } });
  check('board: Archivo and Chivo Mono WOFF2 and their OFL licences are in public/fonts/', faceFiles.length === 4 &&
    faceFiles.every((file) => file.endsWith('.woff2')) && absentBoard.length === 0, absentBoard.join(' '));
  check('board: its faces and licences ship ([night-81a] D-336: PREVIEW_FONTS is empty)', PREVIEW_FONTS.length === 0, PREVIEW_FONTS.join(' '));
  const boardRuntime = [...read('src/ui/skin/board.ts').matchAll(/^import\s+(?!type\b)[^;]*;/gm)].map((m) => m[0]);
  check('board: the helpers have no runtime import (src/main.ts hands in i18n and the flaps)', boardRuntime.length === 0, boardRuntime.join(' '));
  const staticBoard = tsFiles.filter((file) => /^import\s[^;]*skin\/board'/m.test(read(file)));
  check('board: its helpers are a lazy chunk (main.ts imports them dynamically, no module statically)', staticBoard.length === 0 &&
    /import\('\.\/ui\/skin\/board'\)/.test(main) && !/import\.meta\.env\.DEV && query\.get\('skin'\)/.test(main), staticBoard.join(' '));
  // [night-76a] D-331 (T4): the weekly sheet's stylesheet keeps the same contract with board.css's tokens: no token block
  // of its own, every rule scoped, no literal, only --bd-* local sizes, every --board-* it reads defined; the sheet's
  // helpers have no runtime import and only main.ts's DEV branch loads them.
  const WEEK = 'src/ui/skin/board-week.css';
  const week = stripComments(read(WEEK));
  const weekBlocks = [];
  depth = 0; start = 0;
  for (let i = 0; i < week.length; i++) {
    const ch = week[i];
    if (ch === '{') { if (depth === 0) weekBlocks.push({ sel: week.slice(start, i).trim(), from: i + 1 }); depth++; start = i + 1; }
    else if (ch === '}') { depth--; if (depth === 0) weekBlocks.at(-1).body = week.slice(weekBlocks.at(-1).from, i); start = i + 1; }
    else if (ch === ';' && depth === 0) start = i + 1;
  }
  const weekRules = weekBlocks.flatMap(nested);
  const weekLoose = weekRules.filter((r) => !parts(r.sel).every((p) => p.startsWith(':root[data-skin="board"]')));
  check('board week sheet: every rule is scoped to :root[data-skin="board"] (no token block of its own)',
    weekRules.length > 40 && weekLoose.length === 0 && !weekBlocks.some((b) => b.sel === ':root[data-skin="board"]'), weekLoose.slice(0, 3).map((r) => r.sel).join(' | '));
  const weekLiterals = weekRules.flatMap((r) => literals(`x{${r.body}}`).filter((what) => !/^font weight /.test(what)));
  check('board week sheet: no colour, font family or duration literal', weekLiterals.length === 0, weekLiterals.slice(0, 4).join(' | '));
  check('board week sheet: sets only local sizes (--bd-*)',
    weekRules.every((r) => [...r.body.matchAll(/(?:^|;)\s*(--[a-z0-9-]+)\s*:/g)].every((m) => m[1].startsWith('--bd-'))));
  const weekUndefined = [...new Set([...week.matchAll(/var\((--board-[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((name) => !declared.includes(name));
  check('board week sheet: every --board-* token it reads is defined in board.css', weekUndefined.length === 0, weekUndefined.join(' '));
  const weekPairs = [['white', 'holder-prop'], ['white', 'holder-hub'], ['white', 'holder-slots'], ['white', 'blue'], ['print-2', 'paper']];
  const weakWeek = weekPairs.filter(([fg, bg]) => !hexOf[fg] || !hexOf[bg] || ratio(hexOf[fg], hexOf[bg]) < 4.5)
    .map(([fg, bg]) => `${fg}/${bg} ${hexOf[fg] && hexOf[bg] ? ratio(hexOf[fg], hexOf[bg]).toFixed(2) : 'missing'}`);
  check('board week sheet: holder symbols and the strip\'s second ink reach 4.5:1', weakWeek.length === 0, weakWeek.join(' '));
  const weekRuntime = [...read('src/ui/skin/board-week.ts').matchAll(/^import\s+(?!type\b)[^;]*;/gm)].map((m) => m[0]);
  const staticWeek = tsFiles.filter((file) => /^import\s[^;]*skin\/board-week'/m.test(read(file)));
  check('board week sheet: no runtime import, a lazy chunk of main.ts (its CSS a static import, part 6)', weekRuntime.length === 0 && staticWeek.length === 0 &&
    /import\('\.\/ui\/skin\/board-week'\)/.test(main), [...weekRuntime, ...staticWeek].join(' '));
}

const dropped = ['BarlowCondensed-500.woff2', 'BarlowCondensed-700.woff2', 'AirwayChartMono-400.woff2', 'AirwayChartMono-600.woff2']
  .filter((file) => { try { statSync(resolve(ROOT, 'public/fonts', file)); return true; } catch { return false; } });
check('the KARTA faces (Barlow Condensed, Airway Chart Mono) are gone from the release', dropped.length === 0, dropped.join(' '));

// [night-11ax] D-257: release CSS drops the component declarations the shipped structure always overrides
// (scripts/vite-skin-prune.mjs).
{
  const over = skinOverrides(':root[data-skin="board"] .a, :root[data-skin="board"] .b::after { color: x; font: 1px y; }\n' +
    '@media (w) { :root[data-skin="board"] .c { padding: 0; } }\n:root[data-skin="board"]:has(.d) .e { top: 0; }');
  const pruned = pruneOverridden('.a { color: red; margin: 0; }\n.b::after { font-size: 2px; line-height: 1; }\n.a, .z { color: blue; }\n' +
    '.c { padding-left: 1px; }\n@media (w) { .c { padding-top: 1px; } }\n.a { color: green !important; }\n.e { top: 1px; }', over);
  check('prune: overridden declarations go (same selector, shorthand cover, same @media), the rest stays',
    pruned.removed === 4 && /\.a \{ margin: 0; \}/.test(pruned.css) && !/\.b::after/.test(pruned.css) && /\.a, \.z \{ color: blue; \}/.test(pruned.css) &&
    /\.c \{ padding-left: 1px; \}/.test(pruned.css) && !/@media/.test(pruned.css) && /green !important/.test(pruned.css) && /\.e \{ top: 1px; \}/.test(pruned.css),
    pruned.css.replace(/\n/g, ' '));
  // [night-11az] D-257: a class (or its ::before/::after) the structure hides outright takes its subtree's rules along,
  // unless another structural rule gives it a display again.
  const hid = skinOverrides(':root[data-skin="board"] .h { display: none; }\n:root[data-skin="board"] .k { display: none; }\n' +
    ':root[data-skin="board"] .w .k { display: flex; }\n:root[data-skin="board"] .p::before { display: none; }');
  const gone = pruneOverridden('.h { color: red; }\n.x .h strong { margin: 0; }\n.hx { color: blue; }\n.k { top: 0; }\n' +
    '.y .p::before { left: 0; }\n.p { left: 1px; }\n.h { color: green !important; }', hid);
  check('prune: rules of hidden elements go (subtree, pseudo-element), a re-shown or longer class stays',
    gone.removed === 3 && !/margin/.test(gone.css) && /\.hx \{ color: blue; \}/.test(gone.css) && /\.k \{ top: 0; \}/.test(gone.css) &&
    !/::before/.test(gone.css) && /\.p \{ left: 1px; \}/.test(gone.css) && /green !important/.test(gone.css), gone.css.replace(/\n/g, ' '));
  const realOver = skinOverrides(read(LIN) + '\n' + read('src/ui/skin/board-week.css'));
  const removed = COVERED.reduce((sum, file) => sum + pruneOverridden(inlineSkin(read(file), real.resolved, file), realOver).removed, 0);
  check('prune: the real UI-A structure makes some component declarations dead', removed > 50, `${removed} removed`);
}

for (const { name, ok, why } of results) console[ok ? 'log' : 'error'](`${ok ? 'PASS' : 'FAIL'} ${name}${why && !ok ? ': ' + why : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`SUMMARY test:skin-tokens seed=0xA1A1 files=${COVERED.length + COVERED_TS.length} tokens=${defined.size} uses=${uses} ` +
  `passed=${results.length - failed} failed=${failed}`);
if (failed) process.exitCode = 1;

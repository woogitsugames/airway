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
import { constantProperties, inlineSkin, keptSkin, resolveTokens, skinBuild, skinTokens, withConstants } from './vite-skin-inline.mjs';

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

for (const { name, ok, why } of results) console[ok ? 'log' : 'error'](`${ok ? 'PASS' : 'FAIL'} ${name}${why && !ok ? ': ' + why : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`SUMMARY test:skin-tokens seed=0xA1A1 files=${COVERED.length + COVERED_TS.length} tokens=${defined.size} uses=${uses} ` +
  `passed=${results.length - failed} failed=${failed}`);
if (failed) process.exitCode = 1;

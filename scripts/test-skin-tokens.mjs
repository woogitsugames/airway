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
import { kartaOverrides, pruneOverridden } from './vite-skin-prune.mjs';

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
// [night-11ax] D-257: a token only the DEV comparison skin (diorama.css) reads inside its own values is still part of the contract.
for (const m of stripComments(read('src/ui/skin/diorama.css')).matchAll(/var\(--skin-([a-z0-9-]+)\)/g)) used.add(m[1]);
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

// 6. [night-11au] D-256, [night-11ax] D-257: KARTA is the shipped skin. current.css holds its tokens; the structure and
// the chart palette are src/ui/skin/karta.css, loaded statically by src/main.ts after every component stylesheet, every
// rule scoped to :root[data-skin="karta"] (so the DEV `?skin=current` comparison drops it), palette only in a plain
// :root, inlined with no token left. The previous skin (src/ui/skin/diorama.css) redefines every token, adds none, and
// is imported only by the DEV `?skin=current` branch of src/main.ts.
const KARTA = 'src/ui/skin/karta.css';
const DIORAMA = 'src/ui/skin/diorama.css';
const karta = stripComments(read(KARTA));
const dioramaTokens = new Set([...stripComments(read(DIORAMA)).matchAll(/--skin-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const dioramaMissing = [...defined.keys()].filter((name) => !dioramaTokens.has(name));
const dioramaExtra = [...dioramaTokens].filter((name) => !defined.has(name));
check('diorama: the comparison skin redefines every token of the shipped skin', dioramaMissing.length === 0, dioramaMissing.join(' '));
check('diorama: the comparison skin adds no skin token of its own', dioramaExtra.length === 0, dioramaExtra.join(' '));
check('karta: the structure sets no skin token', !/--skin-[a-z0-9-]+\s*:/.test(karta));
const kartaRules = [];
{
  let depth = 0;
  let start = 0;
  for (let i = 0; i < karta.length; i++) {
    const ch = karta[i];
    if (ch === '{') { const sel = karta.slice(start, i).trim(); if (depth === 0 || !sel.startsWith('@')) kartaRules.push(sel); depth++; start = i + 1; }
    else if (ch === '}') { depth--; start = i + 1; }
    else if (ch === ';' ) start = i + 1;
  }
}
const unscoped = kartaRules.filter((sel) => !/^@(media|font-face)\b/.test(sel) && sel !== ':root' &&
  !sel.split(',').every((part) => part.trim().startsWith(':root[data-skin="karta"]')));
check('karta: every structural rule is scoped to :root[data-skin="karta"]', unscoped.length === 0, unscoped.slice(0, 3).join(' | '));
const kartaRoot = [...karta.matchAll(/(?:^|\})\s*:root\s*\{([^{}]*)\}/g)].map((m) => m[1]).join(';');
check('karta: the plain :root sets only the chart palette (--karta-*)',
  [...kartaRoot.matchAll(/(--[a-z0-9-]+)\s*:/g)].every((m) => m[1].startsWith('--karta-')));
check('karta: never redefines the palette or text-scale tokens', !/--airway-[a-z-]+\s*:/.test(karta));
check('karta: the structure inlines with no token left', !/var\(--skin-/.test(inlineSkin(read(KARTA), real.resolved, KARTA)));
const fontFiles = [...karta.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
const missingFonts = fontFiles.filter((file) => { try { statSync(resolve(ROOT, 'public/fonts', file)); return false; } catch { return true; } });
check('karta: its faces ship from public/fonts/ with their OFL licences', fontFiles.length === 4 && missingFonts.length === 0 &&
  ['OFL-BarlowCondensed.txt', 'OFL-AirwayChartMono.txt'].every((file) => { try { return statSync(resolve(ROOT, 'public/fonts', file)).size > 0; } catch { return false; } }),
  missingFonts.join(' '));
const main = read('src/main.ts');
const kartaImports = tsFiles.filter((file) => /import\s*\(?\s*'[^']*karta\.css'/.test(read(file)));
const lastImport = [...main.matchAll(/^import\s[^;]*;/gm)].pop()?.[0] ?? '';
check('karta: src/main.ts (only) imports the structure, after every other import', kartaImports.join() === 'src/main.ts' &&
  lastImport === "import './ui/skin/karta.css';", kartaImports.join(' '));
check('karta: on by default in src/main.ts (startKartaPreview outside the DEV comparison branch)',
  /if \(import\.meta\.env\.DEV && query\.get\('skin'\) === 'current'\) \{[^}]*void import\('\.\/ui\/skin\/diorama\.css'\);\s*\} else \{\s*startKartaPreview\(/.test(main) &&
  /<html[^>]*data-skin="karta"/.test(read('index.html')));
const dioramaImports = tsFiles.filter((file) => /diorama\.css'/.test(read(file)));
check('diorama: imported only by the DEV comparison branch of src/main.ts', dioramaImports.join() === 'src/main.ts' &&
  !/^import\s+'[^']*diorama\.css'/m.test(main), dioramaImports.join(' '));
const guarded = ['src/ui/overlay.ts', 'src/ui/hud/boarding-pass.ts', 'src/ui/hud/tag-dock.ts', 'src/ui/menu/menu.ts']
  .filter((file) => /import\.meta\.env\.DEV\s*&&\s*skinPreview/.test(read(file)));
check('karta: the chart helpers are not DEV-only any more', guarded.length === 0, guarded.join(' '));

// [night-11ax] D-257: release CSS drops the component declarations KARTA always overrides (scripts/vite-skin-prune.mjs).
{
  const over = kartaOverrides(':root[data-skin="karta"] .a, :root[data-skin="karta"] .b::after { color: x; font: 1px y; }\n' +
    '@media (w) { :root[data-skin="karta"] .c { padding: 0; } }\n:root[data-skin="karta"]:has(.d) .e { top: 0; }');
  const pruned = pruneOverridden('.a { color: red; margin: 0; }\n.b::after { font-size: 2px; line-height: 1; }\n.a, .z { color: blue; }\n' +
    '.c { padding-left: 1px; }\n@media (w) { .c { padding-top: 1px; } }\n.a { color: green !important; }\n.e { top: 1px; }', over);
  check('prune: overridden declarations go (same selector, shorthand cover, same @media), the rest stays',
    pruned.removed === 4 && /\.a \{ margin: 0; \}/.test(pruned.css) && !/\.b::after/.test(pruned.css) && /\.a, \.z \{ color: blue; \}/.test(pruned.css) &&
    /\.c \{ padding-left: 1px; \}/.test(pruned.css) && !/@media/.test(pruned.css) && /green !important/.test(pruned.css) && /\.e \{ top: 1px; \}/.test(pruned.css),
    pruned.css.replace(/\n/g, ' '));
  const realOver = kartaOverrides(read(KARTA));
  const removed = COVERED.reduce((sum, file) => sum + pruneOverridden(inlineSkin(read(file), real.resolved, file), realOver).removed, 0);
  check('prune: the real KARTA structure makes some component declarations dead', removed > 50, `${removed} removed`);
}

// [night-11av] D-256: the helpers (src/ui/skin/preview.ts) are imported statically by the overlay, HUD and menu; they get
// i18n and the sim constants from src/main.ts (KartaDeps), so the module stays type-only and the bundle order unchanged.
const previewImports = [...read('src/ui/skin/preview.ts').matchAll(/^import\s+(?!type\b)[^;]*;/gm)].map((m) => m[0]);
check('karta: the preview helpers have no runtime import (release bundle order unchanged)', previewImports.length === 0, previewImports.join(' '));

for (const { name, ok, why } of results) console[ok ? 'log' : 'error'](`${ok ? 'PASS' : 'FAIL'} ${name}${why && !ok ? ': ' + why : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`SUMMARY test:skin-tokens seed=0xA1A1 files=${COVERED.length + COVERED_TS.length} tokens=${defined.size} uses=${uses} ` +
  `passed=${results.length - failed} failed=${failed}`);
if (failed) process.exitCode = 1;

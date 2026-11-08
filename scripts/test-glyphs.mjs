// [night-12s] R7g, D-146: every character the game can show must exist in the font that renders it. A missing glyph
// falls back to a system font (other width, in the worst WebView an empty box). Reads each TTF `cmap`
// (scripts/lib/ttf-cmap.mjs, no dependency) and the @font-face rules of src/ui/fonts.css, including the
// unicode-range faces that borrow single glyphs between families, then checks every family and weight against:
// all catalog strings (PL/EN) and city/region names, numbers formatted for every planned locale, and the letter set
// of PL/EN/DE/FR/ES/PT-BR (localisation wave 1, RESEARCH R7).
// [night-11ax] D-257: the fonts ship as WOFF2 (the reader handles both) and the shipped skin adds its own faces
// ([night-46a] D-301 Linoryt, src/ui/skin/linoryt.css: Besley 800/900 and Schibsted Grotesk 500–700, Latin subsets;
// Róża's Alegreya and KARTA's Barlow Condensed and Airway Chart Mono are gone). Each skin face is checked with what the
// browser falls back to for a glyph its subset lacks (Besley: U+2192, U+202F; Schibsted: U+2009, U+202F): the next
// families of its `--skin-face-*` stack in src/ui/skin/current.css, which must be shipped faces (Atkinson lends them).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './ts-test-loader.mjs';
import { fontCodePoints } from './lib/ttf-cmap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = '0xA1A1';
let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}

/** Parses `U+00B7`, `U+0100-017F`, `U+20??` lists into a predicate. */
function unicodeRange(value) {
  const ranges = value.split(',').map((part) => {
    const token = part.trim().replace(/^U\+/i, '');
    if (token.includes('?')) return [parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)];
    const [a, b = a] = token.split('-');
    return [parseInt(a, 16), parseInt(b, 16)];
  });
  return (cp) => ranges.some(([a, b]) => cp >= a && cp <= b);
}

/** Effective code points per "family weight" from the @font-face rules (a borrowed range adds those glyphs). */
function faces(file = 'src/ui/fonts.css') {
  const css = readFileSync(resolve(ROOT, file), 'utf8');
  const result = new Map();
  for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const prop = (name) => body.match(new RegExp(name + '\\s*:\\s*([^;]+);'))?.[1].trim();
    const family = prop('font-family').replace(/['"]/g, '');
    const file = prop('src').match(/url\(['"]?\/?([^'")]+)['"]?\)/)[1];
    const key = family + ' ' + (prop('font-weight') ?? '400');
    const points = fontCodePoints(resolve(ROOT, 'public', file));
    const range = prop('unicode-range');
    const set = result.get(key) ?? new Set();
    for (const cp of points) if (!range || unicodeRange(range)(cp)) set.add(cp);
    result.set(key, set);
  }
  return result;
}

// Format characters that never draw a glyph of their own (a soft hyphen breaks with the font's '-').
const INVISIBLE = new Set([0x00ad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);
const WHITESPACE = new Set([0x0a, 0x09]);
function codePoints(text) {
  return new Set([...text].map((c) => c.codePointAt(0)).filter((cp) => !INVISIBLE.has(cp) && !WHITESPACE.has(cp)));
}
const show = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' ' + JSON.stringify(String.fromCodePoint(cp));

// Letters and punctuation of the wave-1 languages (RESEARCH R7): PL, EN, DE, FR, ES, PT-BR.
const LETTERS = {
  pl: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”',
  en: '‘’“”',
  de: 'äöüßẞÄÖÜ„“‚‘',
  fr: 'àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ«»',
  es: 'áéíóúñüÁÉÍÓÚÑÜ¿¡',
  'pt-BR': 'ãõáâàçéêíóôúÃÕÁÂÀÇÉÊÍÓÔÚºª',
  common: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?-–—…·×/()%€ \'"',
};
const LOCALES = ['pl-PL', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR'];

const shipped = faces();
/** [night-11ax] D-257: skin faces with their stack fallbacks: "family weight" -> own ∪ every weight of the families
 *  after it in the --skin-face-* stack that names it (a missing glyph is drawn by the first family that has it). */
const skinOwn = faces('src/ui/skin/linoryt.css');
const skinCss = readFileSync(resolve(ROOT, 'src/ui/skin/current.css'), 'utf8');
const stacks = [...skinCss.matchAll(/--skin-face-[a-z]+\s*:\s*([^;]+);/g)]
  .map((m) => m[1].split(',').map((f) => f.trim().replace(/['"]/g, '')));
// [night-69a] D-324: the faces of the DEV UI-A preview (src/ui/skin/board.css: Archivo 600/700/800, Chivo Mono 500–800)
// with the stacks of its token block (--board-face, --board-mono); checked like a shipped skin so the flip (T6) is safe.
const boardOwn = faces('src/ui/skin/board.css');
const boardCss = readFileSync(resolve(ROOT, 'src/ui/skin/board.css'), 'utf8');
stacks.push(...[...boardCss.matchAll(/--board-(?:face|mono)\s*:\s*([^;]+);/g)]
  .map((m) => m[1].split(',').map((f) => f.trim().replace(/['"]/g, ''))));
const skinFaces = new Map();
const fallbackFamilies = new Map();
for (const [face, own] of [...skinOwn, ...boardOwn]) {
  const family = face.replace(/( \d+)+$/, '');
  const set = new Set(own);
  const after = new Set();
  for (const stack of stacks.filter((st) => st[0] === family)) {
    for (const next of stack.slice(1)) {
      after.add(next);
      for (const [shippedFace, points] of shipped) if (shippedFace.replace(/ \d+$/, '') === next) for (const cp of points) set.add(cp);
    }
  }
  fallbackFamilies.set(face, after);
  skinFaces.set(face, set);
}
const fonts = new Map([...shipped, ...skinFaces]);
const { en } = await import('../src/i18n/en.ts');
const { pl } = await import('../src/i18n/pl.ts');
const { CITIES } = await import('../src/data/index.ts');
const regions = await import('../src/data/regions.ts');
const { formatNumberIn } = await import('../src/core/format.ts');

function missing(text) {
  const need = codePoints(text);
  const gaps = [];
  for (const [face, have] of fonts) {
    const lack = [...need].filter((cp) => !have.has(cp));
    if (lack.length) gaps.push(face + ': ' + lack.map(show).join(', '));
  }
  return gaps;
}
function check(text) {
  const gaps = missing(text);
  if (gaps.length) throw new Error(gaps.join('; '));
}

test('fonts.css declares the five shipped faces', () => {
  const keys = [...shipped.keys()].sort();
  const want = ['Atkinson Hyperlegible Next 400', 'Atkinson Hyperlegible Next 700', 'Overpass 400', 'Overpass 800', 'Overpass Mono 700'];
  if (JSON.stringify(keys) !== JSON.stringify(want)) throw new Error('faces ' + keys.join(', '));
  for (const [face, set] of shipped) if (set.size < 300) throw new Error(face + ' maps only ' + set.size + ' code points');
});
test('[night-11ax] every font file is WOFF2', () => {
  const css = ['src/ui/fonts.css', 'src/ui/skin/linoryt.css', 'src/ui/skin/board.css'].map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('');
  const urls = [...css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1]);
  const other = urls.filter((u) => !u.endsWith('.woff2'));
  if (urls.length < 10 || other.length) throw new Error(urls.length + ' urls; not WOFF2: ' + other.join(', '));
});
test('[night-46a] linoryt.css declares the Linoryt faces (Besley 800/900, Schibsted Grotesk 500–700), stack heads with shipped fallbacks', () => {
  const keys = [...skinOwn.keys()].sort();
  const want = ['Besley 800', 'Besley 900', 'Schibsted Grotesk 500 700'];
  if (JSON.stringify(keys) !== JSON.stringify(want)) throw new Error('faces ' + keys.join(', '));
  for (const [face, own] of skinOwn) {
    if (own.size < 300) throw new Error(face + ' maps only ' + own.size + ' code points');
    const after = [...fallbackFamilies.get(face)].filter((f) => !/^(sans-serif|serif|monospace)$/.test(f));
    const unknown = after.filter((f) => ![...shipped.keys()].some((k) => k.replace(/ \d+$/, '') === f));
    if (!after.length || unknown.length) throw new Error(face + ' falls back to ' + (after.join(', ') || 'nothing') + (unknown.length ? '; not shipped: ' + unknown.join(', ') : ''));
  }
});
test('[night-46a] the glyphs the Linoryt subsets lack (Besley U+2192 U+202F, Schibsted U+2009 U+202F) come from a shipped fallback', () => {
  const gaps = [];
  for (const [face, own] of skinOwn) for (const cp of [0x2009, 0x202f, 0x2192]) {
    if (!own.has(cp) && !skinFaces.get(face).has(cp)) gaps.push(face + ' ' + show(cp));
  }
  if (gaps.length) throw new Error(gaps.join(', '));
  const lacks = (face, cp) => !skinOwn.get(face).has(cp);
  if (!(lacks('Besley 800', 0x202f) && lacks('Besley 800', 0x2192) && lacks('Schibsted Grotesk 500 700', 0x202f))) {
    throw new Error('subset changed: a Linoryt face now maps a borrowed glyph, update this test');
  }
});
test('[night-69a] board.css declares the UI-A faces (Archivo 600/700/800, Chivo Mono 500–800) with shipped fallbacks for their gaps', () => {
  const keys = [...boardOwn.keys()].sort();
  const want = ['Archivo 600', 'Archivo 700', 'Archivo 800', 'Chivo Mono 500 800'];
  if (JSON.stringify(keys) !== JSON.stringify(want)) throw new Error('faces ' + keys.join(', '));
  const gaps = [];
  for (const [face, own] of boardOwn) {
    if (own.size < 300) gaps.push(face + ' maps only ' + own.size + ' code points');
    const after = [...fallbackFamilies.get(face)].filter((f) => !/^(sans-serif|serif|monospace)$/.test(f));
    if (!after.length || after.some((f) => ![...shipped.keys()].some((k) => k.replace(/ \d+$/, '') === f))) gaps.push(face + ' falls back to ' + after.join(', '));
    for (const cp of [0x2009, 0x202f, 0x2192]) if (!skinFaces.get(face).has(cp)) gaps.push(face + ' ' + show(cp));
  }
  if (!boardOwn.get('Chivo Mono 500 800').has(0x2192) === false) gaps.push('Chivo Mono now maps U+2192, update this test');
  if (gaps.length) throw new Error(gaps.join('; '));
});
for (const [name, catalog] of [['en', en], ['pl', pl]]) {
  test(`every ${name} catalog string is in every face`, () => {
    const bad = [];
    for (const [key, value] of Object.entries(catalog)) {
      const gaps = missing(value.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, ''));
      if (gaps.length) bad.push(key + ' (' + gaps.join('; ') + ')');
    }
    if (bad.length) throw new Error(bad.length + ' keys: ' + bad.slice(0, 6).join(' | '));
  });
}
test('city and region names are in every face', () => {
  const names = CITIES.flatMap((c) => [c.namePl, c.nameEn, c.code]);
  const regionList = Object.values(regions.REGIONS);
  for (const r of regionList) names.push(...Object.values(r).filter((v) => typeof v === 'string'));
  check(names.join(''));
});
test('numbers formatted for pl/en/de/fr/es/pt-BR are in every face', () => {
  check(LOCALES.map((l) => [0, 1, 2500, 11000, -1234567.5].map((n) => formatNumberIn(l, n, 1)).join(' ')).join(' '));
});
for (const [language, letters] of Object.entries(LETTERS)) {
  test(`${language} letters and punctuation are in every face`, () => check(letters));
}

console.log(`SUMMARY test:glyphs seed=${SEED} faces=${fonts.size} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

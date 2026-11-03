// [night-12s] R7g, D-146: every character the game can show must exist in the font that renders it. A missing glyph
// falls back to a system font (other width, in the worst WebView an empty box). Reads each TTF `cmap`
// (scripts/lib/ttf-cmap.mjs, no dependency) and the @font-face rules of src/ui/fonts.css, including the
// unicode-range faces that borrow single glyphs between families, then checks every family and weight against:
// all catalog strings (PL/EN) and city/region names, numbers formatted for every planned locale, and the letter set
// of PL/EN/DE/FR/ES/PT-BR (localisation wave 1, RESEARCH R7).
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
function faces() {
  const css = readFileSync(resolve(ROOT, 'src/ui/fonts.css'), 'utf8');
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

const fonts = faces();
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
  const keys = [...fonts.keys()].sort();
  const want = ['Atkinson Hyperlegible Next 400', 'Atkinson Hyperlegible Next 700', 'Overpass 400', 'Overpass 800', 'Overpass Mono 700'];
  if (JSON.stringify(keys) !== JSON.stringify(want)) throw new Error('faces ' + keys.join(', '));
  for (const [face, set] of fonts) if (set.size < 300) throw new Error(face + ' maps only ' + set.size + ' code points');
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

// Check catalog parity, nonempty strings, and formatting placeholders with a fixed test seed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const SEED = '0xA1A1';

function dictionary(language) {
  const file = resolve(ROOT, 'src/i18n', language + '.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error(language + ' has invalid TypeScript syntax');
  let expression;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === language) {
        expression = declaration.initializer;
      }
    }
  }
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))) {
    expression = expression.expression;
  }
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    throw new Error(language + ' must export a literal dictionary');
  }
  const values = new Map();
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property) ||
        (!ts.isStringLiteral(property.name) && !ts.isIdentifier(property.name)) ||
        !ts.isStringLiteral(property.initializer)) {
      failures.push(language + ': all catalog entries must be literal strings');
      continue;
    }
    const key = property.name.text;
    if (values.has(key)) failures.push(language + ': duplicate key ' + key);
    values.set(key, property.initializer.text);
    if (!property.initializer.text.trim()) failures.push(language + ': empty value for ' + key);
  }
  return values;
}

// [night-12q] R5i: every catalog key must be referenced from src/ (outside the catalogs) as a string literal,
// or start with the static prefix of a template/concatenated key such as `privacy.s${n}` or 'settings.airline.' + x.
// Catches dead copy left behind when a screen is removed (13 a11y.city*/a11y.action.* keys and status.* were).
function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path);
  }
  return out;
}
export function unusedKeys(keys, sources) {
  const text = sources.join('\n');
  const literals = new Set([...text.matchAll(/['"`]([A-Za-z0-9_.-]+)['"`]/g)].map((m) => m[1]));
  const prefixes = new Set([
    ...[...text.matchAll(/`([A-Za-z0-9_.-]+)\$\{/g)].map((m) => m[1]),
    ...[...text.matchAll(/['"]([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]*)['"]\s*\+/g)].map((m) => m[1]),
  ].filter((prefix) => prefix.includes('.')));
  return [...keys].filter((key) => !literals.has(key) && ![...prefixes].some((prefix) => key.startsWith(prefix)));
}

// [night-11t] R5g, D-195: banned synonyms per language. `allow` lists keys where the word names something else (the
// "TERMINAL 1" sign on the menu, the puzzle board's "route planning terminal"), not the concept it would duplicate.
const TERMINAL_SIGNS = ['menu.terminal', 'puzzle.board.subtitle'];
export const BANNED = {
  en: [
    { re: /\bgrid\b/i, word: 'network' },
    { re: /\bnodes?\b/i, word: 'hub' },
    { re: /\bterminals?\b/i, word: 'hub', allow: TERMINAL_SIGNS },
    { re: /\b(cargo|freight)[ -]labels?\b/i, word: 'crate' },
    { re: /\bsimulation\b/i, word: 'time / the game' },
  ],
  pl: [
    { re: /(?<!\p{L})siat(ka|ki|ce|kę|ką|ek|kach|kami|kom)(?!\p{L})/iu, word: 'sieć' },
    { re: /(?<!\p{L})węz(eł|ła|łowi|łem|le|ły|łów|łom|łami|łach)(?!\p{L})/iu, word: 'hub' },
    { re: /(?<!\p{L})terminal(a|e|i|u|owi|em|ów|ach|ami)?(?!\p{L})/iu, word: 'hub', allow: TERMINAL_SIGNS },
    { re: /(?<!\p{L})etykiet(a|y|ę|ą|om|ach|ami)? frachtow/iu, word: 'skrzynia' },
    { re: /(?<!\p{L})symulacj/iu, word: 'czas / gra' },
  ],
};

const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
  .map((match) => match[1]).sort().join(',');
let keyCount = 0;
let fileCount = 0;
// [night-12w] R7f, D-185: the catalogs, their plural form counts and the derived lookups all come from the one
// language table; a new language is one entry there plus its catalog file.
await import('./ts-test-loader.mjs');
const { LANGUAGE_ENTRIES, LANGUAGES, createLanguageTable, localName } = await import('../src/i18n/languages.ts');
const { formatNumberIn, numberLocale } = await import('../src/core/format.ts');
const { LENGTH_BUDGETS, textLength } = await import('../src/i18n/limits.ts');
const { pseudoText } = await import('../src/i18n/pseudo.ts');
const { fillPluralTokens } = await import('../src/i18n/index.ts');
let budgetCount = 0;
/** A catalog template with sample parameters filled in, as t() renders it (numbers in the language's format). */
function fillSample(template, sample = {}, entry) {
  const filled = fillPluralTokens(template, sample, entry.locale, entry.plural);
  return filled.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name) => sample[name] === undefined ? token
    : typeof sample[name] === 'number' ? formatNumberIn(entry.locale, sample[name]) : String(sample[name]));
}
try {
  const english = dictionary('en');
  keyCount = english.size;
  const catalogs = new Map(LANGUAGE_ENTRIES.map((entry) => [entry.code, dictionary(entry.code)]));
  fileCount = catalogs.size;
  for (const entry of LANGUAGE_ENTRIES) {
    const catalog = catalogs.get(entry.code);
    for (const key of english.keys()) {
      if (!catalog.has(key)) { failures.push(entry.code + ': missing key ' + key); continue; }
      if (placeholders(english.get(key)) !== placeholders(catalog.get(key))) failures.push(entry.code + ': placeholder mismatch: ' + key);
      // [night-07j] Plural tokens `{name|form|…}` give the language's categories in table order (at least
      // `requiredForms`, at most all of them); the name must be a parameter of the English template.
      const params = new Set([...english.get(key).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)[}|]/g)].map((m) => m[1]));
      for (const match of catalog.get(key).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g)) {
        const forms = match[2].split('|');
        if (forms.length < entry.requiredForms || forms.length > entry.plural.length || forms.some((form) => !form.trim())) {
          failures.push(entry.code + ': plural token ' + match[0] + ' in ' + key + ' needs ' + entry.requiredForms + '-' +
            entry.plural.length + ' forms');
        }
        if (!params.has(match[1])) failures.push(entry.code + ': plural token parameter ' + match[1] + ' unknown in ' + key);
      }
    }
    for (const key of catalog.keys()) if (!english.has(key)) failures.push('en: missing key ' + key + ' (in ' + entry.code + ')');
    if (!english.has(entry.labelKey)) failures.push(entry.code + ': settings label ' + entry.labelKey + ' not in the catalogs');
    if (numberLocale(entry.code) !== entry.locale) failures.push(entry.code + ': number locale ' + numberLocale(entry.code));
  }
  if (LANGUAGES.normalise('pl-PL') !== 'pl' || LANGUAGES.normalise('EN_us') !== 'en' || LANGUAGES.normalise('de') !== null ||
    LANGUAGES.fallback !== 'en') failures.push('language table: normalise/fallback');
  if (localName({ namePl: 'Londyn', nameEn: 'London' }, 'pl') !== 'Londyn' ||
    localName({ namePl: 'Londyn', nameEn: 'London' }, 'en') !== 'London') failures.push('language table: city names');
  // A stub language needs exactly one entry: every derived lookup knows it.
  const stub = { code: 'de', locale: 'de-DE', plural: ['one', 'other'], requiredForms: 2, labelKey: 'language.german',
    storeLocale: 'de-DE', names: 'nameEn' };
  const table = createLanguageTable([...LANGUAGE_ENTRIES, stub], 'en');
  if (table.normalise('de-AT') !== 'de' || table.codes.join() !== 'pl,en,de' || table.entry('de').plural.join() !== 'one,other' ||
    formatNumberIn(table.entry('de').locale, 1000) !== '1.000' || table.entry('xx').code !== 'en') {
    failures.push('stub language: one entry should give normalise, codes, plural order, number locale and fallback');
  }
  let duplicate = false;
  try { createLanguageTable([stub, stub], 'de'); } catch { duplicate = true; }
  if (!duplicate) failures.push('language table accepts a duplicate code');
  // No module outside the table and the catalogs may spell out a language code again.
  const hardCoded = sourceFiles(resolve(ROOT, 'src'))
    .filter((file) => !/src\/i18n\/(en|pl|languages)\.ts$/.test(file.replace(/\\/g, '/')))
    .filter((file) => /=== ?['"](pl|en)['"]|['"]pl['"] ?\| ?['"]en['"]|namePl : |\.namePl\b/.test(readFileSync(file, 'utf8')));
  for (const file of hardCoded) failures.push('hard-coded language in ' + file.slice(ROOT.length + 1) + ' (use src/i18n/languages.ts)');
  const catalogDir = resolve(ROOT, 'src/i18n');
  const sources = sourceFiles(resolve(ROOT, 'src'))
    .filter((file) => ![...LANGUAGE_ENTRIES.map((entry) => entry.code + '.ts'), 'pseudo.ts'].some((name) => file === join(catalogDir, name)))
    .map((file) => readFileSync(file, 'utf8'));
  // Self-check of the matcher: a literal, a template prefix and a concatenated prefix count; a bare key does not.
  const probe = unusedKeys(['a.used', 'b.s1', 'c.x.y', 'd.unused'], ["t('a.used')", "t(`b.s${n}`)", "t('c.x.' + v)"]);
  if (probe.join() !== 'd.unused') failures.push('unused-key matcher self-check: got ' + probe.join());
  for (const key of unusedKeys(english.keys(), sources)) failures.push('unused key (not referenced in src/): ' + key);
  // [night-11t] R5g, D-195: one word per concept (glossary in src/i18n/README.md). A banned synonym in any player
  // string fails, so "siatka", "węzeł", "terminal" (for a hub), "cargo label" or "simulation" cannot creep back.
  const pl = catalogs.get('pl');
  for (const [code, catalog] of [['en', english], ['pl', pl]]) {
    for (const [key, value] of catalog) {
      for (const { re, word, allow = [] } of BANNED[code]) {
        if (re.test(value) && !allow.includes(key)) failures.push(`${code}: banned synonym "${value.match(re)[0]}" in ${key} (use "${word}")`);
      }
    }
  }
  // Self-check: the matcher catches the old game-over title and spares the diegetic terminal sign.
  if (!BANNED.pl.some(({ re }) => re.test('Pokaż siatkę wokół')) || !BANNED.pl.some(({ re }) => re.test('Siatka wstrzymana')) || BANNED.pl.some(({ re, allow = [] }) =>
    re.test('AIRWAY.GAMES · TERMINAL 1') && !allow.includes('menu.terminal'))) failures.push('banned-synonym matcher self-check');
  // [night-11ac] R7h, D-211: length budgets (src/i18n/limits.ts). Each budgeted key, with its sample parameters
  // filled in, fits its budget in every catalog and in the pseudo-locale (both modes); the pseudo text fills the
  // budget, so the layout is tested at the longest allowed translation.
  budgetCount = Object.keys(LENGTH_BUDGETS).length;
  for (const [key, budget] of Object.entries(LENGTH_BUDGETS)) {
    if (!english.has(key)) { failures.push('length budget for an unknown key ' + key); continue; }
    if (!Number.isInteger(budget.max) || budget.max < 1 || !budget.where) failures.push('length budget ' + key + ': max and where');
    for (const entry of LANGUAGE_ENTRIES) {
      const text = fillSample(catalogs.get(entry.code).get(key), budget.sample, entry);
      if (/\{[A-Za-z]/.test(text)) failures.push(entry.code + ': ' + key + ' sample leaves a token: ' + text);
      if (textLength(text) > budget.max) failures.push(`${entry.code}: ${key} is ${textLength(text)} > ${budget.max} (${budget.where}): "${text}"`);
      for (const mode of ['stretch', 'harsh']) {
        const pseudo = pseudoText(text, { mode, budget: budget.max });
        if (textLength(pseudo) > budget.max) failures.push(`pseudo ${mode} ${entry.code}: ${key} is ${textLength(pseudo)} > ${budget.max}: "${pseudo}"`);
        else if (textLength(text) + 2 <= budget.max && textLength(pseudo) !== budget.max) failures.push(`pseudo ${mode} ${entry.code}: ${key} does not fill its budget: "${pseudo}"`);
      }
    }
  }
  // The flap budgets are the board's own cell counts.
  const menuSource = readFileSync(resolve(ROOT, 'src/ui/menu/menu.ts'), 'utf8');
  if ((menuSource.match(/maxCells:\s*[^,}]*FLAP_CELLS/g) ?? []).length !== 3 || /maxCells:\s*\d/.test(menuSource)) {
    failures.push('menu split-flaps must take maxCells from FLAP_CELLS (src/i18n/limits.ts)');
  }
  // Self-checks: an over-budget translation fails; the harsh mode doubles short text and leaves long text at ~1.4x.
  const fake = fillSample('USTAWIENIA GRY', undefined, LANGUAGE_ENTRIES[0]);
  if (textLength(fake) <= LENGTH_BUDGETS['menu.settings'].max) failures.push('length-budget self-check: over-budget text passes');
  if (textLength(pseudoText('Back', { mode: 'harsh' })) !== 8 || textLength(pseudoText('Back')) !== 7 ||
    textLength(pseudoText('SETTINGS', { budget: 10 })) !== 10 || textLength(pseudoText('USTAWIENIA', { budget: 10 })) !== 10 ||
    pseudoText('USTAWIENIA', { budget: 10 }).includes('[')) failures.push('pseudo-locale self-check: ' +
    [pseudoText('Back', { mode: 'harsh' }), pseudoText('SETTINGS', { budget: 10 }), pseudoText('USTAWIENIA', { budget: 10 })].join(' '));
  for (const text of ['Graphics quality', 'Passengers delivered: 1,284', 'Choose a departure to plan the network']) {
    const ratio = textLength(pseudoText(text, { mode: 'harsh' })) / textLength(text);
    if (text.length <= 20 ? ratio !== 2 : ratio < 1.2 || ratio > 1.6) failures.push(`pseudo harsh ratio ${ratio.toFixed(2)} for "${text}"`);
  }
  if (english.size === 0) failures.push('dictionaries must not be empty');
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
for (const failure of failures) console.error('FAIL ' + failure);
console.log('SUMMARY test:i18n seed=' + SEED + ' files=' + fileCount + ' keys=' + keyCount + ' budgets=' + budgetCount +
  ' passed=' + (failures.length ? 0 : 1) + ' failed=' + failures.length);
if (failures.length) process.exitCode = 1;

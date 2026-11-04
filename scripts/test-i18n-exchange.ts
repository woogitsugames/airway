// [night-12ah] R7i, D-211: translator export/import round-trips (JSON and CSV) and rejects files that would break
// the game: lost or invented {params}, wrong plural form counts, over-budget text, stale English, wrong rows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGE_CODES, PLANNED_LANGUAGE_ENTRIES } from '../src/i18n/languages.ts';
import {
  buildExport, fromCsv, measuredLength, parseCsv, readCatalogSource, renderCatalog, toCsv, validateImport,
  type ExchangeFile, type TargetLanguage,
} from './lib/i18n-exchange.ts';

const SEED = '0xA1A1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

const en = readCatalogSource(readFileSync(resolve(ROOT, 'src/i18n/en.ts'), 'utf8'), 'en');
const pl = readCatalogSource(readFileSync(resolve(ROOT, 'src/i18n/pl.ts'), 'utf8'), 'pl');
const planned = (code: string): TargetLanguage => PLANNED_LANGUAGE_ENTRIES.find((entry) => entry.code === code)!;
const de = planned('de');
const fr = planned('fr');
/** A stand-in "translation": the English text with every plural token given `forms` forms (valid by construction). */
const fill = (file: ExchangeFile, forms: number): ExchangeFile => ({
  ...file,
  rows: file.rows.map((row) => ({
    ...row,
    translation: '«' + row.en.replace(/\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g, (_t, name: string, list: string) => {
      const given = list.split('|');
      return `{${name}|${Array.from({ length: forms }, (_, i) => given[Math.min(i, given.length - 1)] + (i ? i : '')).join('|')}}`;
    }),
  })),
});
const withRow = (file: ExchangeFile, key: string, change: Partial<ExchangeFile['rows'][number]>): ExchangeFile => ({
  ...file, rows: file.rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
});
const errorsOf = (file: ExchangeFile, target: TargetLanguage = de, limits?: Map<string, number>): string[] =>
  validateImport({ file, target, en, limits }).errors;

test('catalog reader sees every key with its section comment', () => {
  assert.ok(en.length > 400);
  assert.equal(en.length, pl.length);
  const waiting = en.find((entry) => entry.key === 'airport.waiting')!;
  assert.match(waiting.comment, /^Airport overlays/);
  assert.doesNotMatch(waiting.comment, /\[task/);
  assert.match(en.find((entry) => entry.key === 'airport.new')!.comment, /^Airport overlays/);
});

test('export: every EN key with PL reference, placeholders, plural params and the language plural rules', () => {
  const file = buildExport({ target: de, en, pl, limits: new Map([['menu.gate', 2]]) });
  assert.equal(file.language, 'de');
  assert.deepEqual(file.rows.map((row) => row.key), en.map((entry) => entry.key));
  const row = file.rows.find((r) => r.key === 'airport.waiting')!;
  assert.equal(row.pl, pl.find((entry) => entry.key === 'airport.waiting')!.value);
  assert.deepEqual(row.placeholders, ['code', 'count']);
  assert.deepEqual(row.pluralParams, ['count']);
  assert.equal(file.rows.find((r) => r.key === 'menu.gate')!.maxLength, 2);
  assert.equal(file.rows.find((r) => r.key === 'app.title')!.maxLength, null);
  assert.deepEqual(file.plural.categories, ['one', 'other']);
  assert.deepEqual(file.plural.examples.one, [1]);
  assert.ok(file.rows.every((r) => r.translation === ''));
});

test('export: fr/es/pt list many after other with round millions as the example', () => {
  for (const code of ['fr', 'es', 'pt']) {
    const file = buildExport({ target: planned(code), en, pl });
    assert.deepEqual(file.plural.categories, ['one', 'other', 'many'], code);
    assert.equal(file.plural.requiredForms, 2);
    assert.ok(file.plural.examples.many.includes(1_000_000), code);
  }
  assert.ok(buildExport({ target: fr, en, pl }).plural.examples.one.includes(0), 'French 0 is singular');
});

test('JSON round-trip: a filled file imports cleanly and the rendered catalog reads back identically', () => {
  const file = JSON.parse(JSON.stringify(fill(buildExport({ target: de, en, pl }), 2))) as ExchangeFile;
  const result = validateImport({ file, target: de, en });
  assert.deepEqual(result.errors, []);
  const source = renderCatalog('de', en, result.catalog);
  const back = readCatalogSource(source, 'de');
  assert.deepEqual(back.map((entry) => [entry.key, entry.value]), [...result.catalog]);
  assert.match(source, /satisfies Record<keyof typeof en, string>/);
});

test('CSV round-trip keeps commas, quotes, newlines, edge spaces and the plural header', () => {
  let file = fill(buildExport({ target: fr, en, pl, limits: new Map([['menu.gate', 2]]) }), 3);
  file = withRow(file, 'app.title', { translation: ' "Air, way"\nzwei ', context: 'a, "b"' });
  const back = fromCsv(toCsv(file));
  assert.equal(back.language, 'fr');
  assert.deepEqual(back.plural.categories, ['one', 'other', 'many']);
  assert.equal(back.plural.requiredForms, 2);
  assert.deepEqual(back.rows, file.rows);
  assert.deepEqual(parseCsv('a,"b ""c""",\r\n"x\ny",z\n'), [['a', 'b "c"', ''], ['x\ny', 'z']]);
  const clean = withRow(withRow(back, 'app.title', { translation: 'Airway' }), 'menu.gate', { translation: 'G1' });
  assert.deepEqual(validateImport({ file: clean, target: fr, en }).errors, []);
});

test('plural tokens: de needs exactly 2 forms, fr takes 2 or 3', () => {
  const base = fill(buildExport({ target: de, en, pl }), 2);
  const three = withRow(base, 'menu.record', { translation: 'Rekord {count} {count|Fluggast|Fluggäste|Fluggäste}' });
  assert.ok(errorsOf(three).some((e) => /menu\.record: plural token .* has 3 forms, de needs 2/.test(e)));
  const one = withRow(base, 'menu.record', { translation: 'Rekord {count} {count|Fluggäste}' });
  assert.ok(errorsOf(one).some((e) => /has 1 forms/.test(e)));
  const frBase = fill(buildExport({ target: fr, en, pl }), 2);
  assert.deepEqual(errorsOf(frBase, fr), []);
  assert.deepEqual(errorsOf(fill(buildExport({ target: fr, en, pl }), 3), fr), []);
  const four = withRow(frBase, 'menu.record', { translation: 'record {count} {count|a|b|c|d}' });
  assert.ok(errorsOf(four, fr).some((e) => /4 forms, fr needs 2–3/.test(e)));
  const empty = withRow(base, 'menu.record', { translation: 'Rekord {count} {count|Fluggast|}' });
  assert.ok(errorsOf(empty).some((e) => /empty form/.test(e)));
  const unknown = withRow(base, 'menu.record', { translation: 'Rekord {count} {n|Fluggast|Fluggäste}' });
  assert.ok(errorsOf(unknown).some((e) => /parameter "n" is not a parameter/.test(e)));
  const noToken = withRow(base, 'menu.record', { translation: 'Rekord: {count}' });
  assert.deepEqual(errorsOf(noToken), []);
  assert.equal(validateImport({ file: noToken, target: de, en }).warnings.length, 1);
});

test('placeholders: a lost, renamed, invented or broken {param} is rejected', () => {
  const base = fill(buildExport({ target: de, en, pl }), 2);
  const cases: [string, RegExp][] = [
    ['{code}: {count|Fluggast wartet|Fluggäste warten}', /placeholders \{code\} differ from English \{code, count\}/],
    ['{code}: {anzahl} {count|Fluggast|Fluggäste}', /placeholders \{anzahl, code\}/],
    ['{code}: {count} {count|Fluggast|Fluggäste} {extra}', /placeholders \{code, count, extra\}/],
    ['{code}: {count {count|Fluggast|Fluggäste}', /placeholders|stray/],
    ['{code}: {count} {count|Fluggast|Fluggäste} }', /stray/],
  ];
  for (const [translation, error] of cases) {
    assert.ok(errorsOf(withRow(base, 'airport.waiting', { translation })).some((e) => error.test(e)), translation);
  }
});

test('rows: missing, unknown, duplicate, untranslated, stale English and wrong language are rejected', () => {
  const base = fill(buildExport({ target: de, en, pl }), 2);
  assert.ok(errorsOf({ ...base, rows: base.rows.slice(1) }).includes('app.title: missing row'));
  assert.ok(errorsOf({ ...base, rows: [...base.rows, { ...base.rows[0], key: 'no.such' }] }).some((e) => /no\.such: unknown key/.test(e)));
  assert.ok(errorsOf({ ...base, rows: [...base.rows, base.rows[0]] }).includes('app.title: duplicate row'));
  assert.ok(errorsOf(withRow(base, 'gl.lost', { translation: '  ' })).includes('gl.lost: no translation'));
  assert.ok(errorsOf(withRow(base, 'gl.lost', { en: 'Graphics restart.' })).some((e) => /gl\.lost: English source changed/.test(e)));
  assert.ok(errorsOf({ ...base, language: 'fr' }).some((e) => /not "de"/.test(e)));
});

test('length budget: text over the budget fails, plural tokens count as their longest form', () => {
  assert.equal(measuredLength('{count} {count|day|days}'), 5);
  const base = fill(buildExport({ target: de, en, pl, limits: new Map([['menu.gate', 2]]) }), 2);
  assert.ok(errorsOf(withRow(base, 'menu.gate', { translation: 'Gate' })).some((e) => /menu\.gate: 4 characters, budget 2/.test(e)));
  assert.ok(!errorsOf(withRow(base, 'menu.gate', { translation: 'G1' })).some((e) => /budget/.test(e)));
  // The current budget wins over the one written in the file.
  const loose = withRow(base, 'menu.gate', { translation: 'Gate', maxLength: 10 });
  assert.ok(errorsOf(loose, de, new Map([['menu.gate', 2]])).some((e) => /budget 2/.test(e)));
});

test('re-export keeps translations whose English is unchanged and clears the rest', () => {
  const previous = withRow(fill(buildExport({ target: de, en, pl }), 2), 'gl.lost', { en: 'old text', translation: 'alt' });
  const next = buildExport({ target: de, en, pl, previous });
  assert.equal(next.rows.find((r) => r.key === 'gl.lost')!.translation, '');
  assert.equal(next.rows.find((r) => r.key === 'app.title')!.translation, '«Airway');
});

test('planned wave-1 languages are not shipped', () => {
  assert.deepEqual(PLANNED_LANGUAGE_ENTRIES.map((entry) => entry.code), ['de', 'fr', 'es', 'pt']);
  for (const entry of PLANNED_LANGUAGE_ENTRIES) {
    assert.ok(!(LANGUAGE_CODES as readonly string[]).includes(entry.code), entry.code);
    assert.ok(!existsSync(resolve(ROOT, 'src/i18n', entry.code + '.ts')), entry.code + '.ts must not be committed yet');
    const categories = new Intl.PluralRules(entry.locale).resolvedOptions().pluralCategories;
    assert.deepEqual([...entry.plural].sort(), [...categories].sort(), entry.code + ' plural categories match Intl');
  }
});

test('CLI: export → fill → import writes a catalog; a bad file exits 1 and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'airway-i18n-'));
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', './scripts/ts-test-loader.mjs', 'scripts/i18n-exchange.ts', ...args],
    { cwd: ROOT, encoding: 'utf8' });
  try {
    for (const ext of ['json', 'csv']) {
      const exchange = join(dir, 'de.' + ext);
      const out = join(dir, 'de-' + ext + '.ts');
      const exported = run('export', 'de', '--out=' + exchange);
      assert.equal(exported.status, 0, exported.stderr);
      assert.match(exported.stdout, /SUMMARY i18n:export language=de rows=\d+ translated=0/);
      const file = ext === 'csv' ? fromCsv(readFileSync(exchange, 'utf8')) : JSON.parse(readFileSync(exchange, 'utf8')) as ExchangeFile;
      const filled = fill(file, 2);
      writeFileSync(exchange, ext === 'csv' ? toCsv(filled) : JSON.stringify(filled));
      const imported = run('import', 'de', '--file=' + exchange, '--out=' + out);
      assert.equal(imported.status, 0, imported.stdout + imported.stderr);
      assert.match(imported.stdout, /errors=0/);
      assert.equal(readCatalogSource(readFileSync(out, 'utf8'), 'de').length, en.length);
      // Re-export keeps the filled translations.
      assert.match(run('export', 'de', '--out=' + exchange).stdout, new RegExp(`translated=${en.length}`));
      writeFileSync(exchange, ext === 'csv' ? toCsv(withRow(filled, 'menu.record', { translation: 'x {count|a|b|c}' }))
        : JSON.stringify(withRow(filled, 'menu.record', { translation: 'x {count|a|b|c}' })));
      const bad = run('import', 'de', '--file=' + exchange, '--out=' + join(dir, 'bad.ts'));
      assert.equal(bad.status, 1);
      assert.match(bad.stderr, /menu\.record: placeholders|menu\.record: plural token/);
      assert.ok(!existsSync(join(dir, 'bad.ts')));
    }
    assert.equal(run('export', 'xx').status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`SUMMARY test:i18n-exchange seed=${SEED} keys=${en.length} languages=${PLANNED_LANGUAGE_ENTRIES.length} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

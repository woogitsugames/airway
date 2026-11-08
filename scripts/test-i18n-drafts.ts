// [night-50a] GPT-12: guard for the translator drafts committed in docs/i18n/<code>.json|.csv (wave 1, D-96/D-136).
// A draft that would break the game when imported fails: unknown or duplicate key, a lost/invented {param}, a plural
// token with the wrong number of forms, text over its length budget, broken braces, a file for the wrong language.
// Missing rows (new EN keys), stale rows (EN changed since the export) and untranslated rows only print one WARN line
// with counts, so adding or rewording an English string never breaks `test:fast`; `npm run i18n:export -- <code>`
// brings the draft up to date. Self-checks on a synthetic draft come first.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGE_ENTRIES, PLANNED_LANGUAGE_ENTRIES } from '../src/i18n/languages.ts';
import {
  buildExport, checkDraft, limitsFromModule, parseExchange, readCatalogSource, type ExchangeFile, type TargetLanguage,
} from './lib/i18n-exchange.ts';

const SEED = '0xA1A1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFTS = resolve(ROOT, 'docs/i18n');
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

const en = readCatalogSource(readFileSync(resolve(ROOT, 'src/i18n/en.ts'), 'utf8'), 'en');
const pl = readCatalogSource(readFileSync(resolve(ROOT, 'src/i18n/pl.ts'), 'utf8'), 'pl');
const limits = limitsFromModule(await import(pathToFileURL(resolve(ROOT, 'src/i18n/limits.ts')).href) as Record<string, unknown>,
  new Set(en.map((entry) => entry.key)));
const targets: TargetLanguage[] = [...PLANNED_LANGUAGE_ENTRIES, ...LANGUAGE_ENTRIES.filter((entry) => entry.code !== 'en')];
const de = targets.find((entry) => entry.code === 'de')!;

// --- Self-checks on a synthetic draft -----------------------------------------------------------------------------
/** Every row "translated" as its English text with two plural forms (valid by construction, within budget). */
const filled = (): ExchangeFile => {
  const file = buildExport({ target: de, en, pl, limits });
  return { ...file, rows: file.rows.map((row) => ({ ...row, translation: row.en })) };
};
const withRow = (file: ExchangeFile, key: string, change: Partial<ExchangeFile['rows'][number]>): ExchangeFile => ({
  ...file, rows: file.rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
});
const check = (file: ExchangeFile) => checkDraft({ file, target: de, en, limits });
const only = (file: ExchangeFile, pattern: RegExp): void => {
  const { problems } = check(file);
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0], pattern);
};

test('a complete draft has no problems and nothing to warn about', () => {
  const report = check(filled());
  assert.deepEqual([report.problems, report.missing, report.stale, report.untranslated], [[], [], [], []]);
});

test('structural: unknown and duplicate keys fail', () => {
  const base = filled();
  only({ ...base, rows: [...base.rows, { ...base.rows[0], key: 'no.such' }] }, /^no\.such: unknown key/);
  only({ ...base, rows: [...base.rows, base.rows[0]] }, /^app\.title: duplicate row/);
});

test('structural: a lost, invented or broken {param} fails', () => {
  only(withRow(filled(), 'airport.focus', { translation: 'Zu Code drehen' }), /airport\.focus: placeholders \{\} differ/);
  only(withRow(filled(), 'airport.focus', { translation: 'Zu {code} {extra} drehen' }), /placeholders \{code, extra\}/);
  only(withRow(filled(), 'airport.focus', { translation: 'Zu {code} drehen }' }), /stray/);
});

test('structural: a German plural token needs exactly two forms', () => {
  only(withRow(filled(), 'menu.record', { translation: 'Rekord {count} {count|Passagier|Passagiere|Passagieren}' }),
    /menu\.record: plural token .* has 3 forms, de needs 2/);
  only(withRow(filled(), 'menu.record', { translation: 'Rekord {count} {count|Passagiere}' }), /has 1 forms/);
});

test('structural: text over its length budget fails, the current budget wins', () => {
  only(withRow(filled(), 'menu.onTime', { translation: 'Pünktlich', maxLength: 20 }), /menu\.onTime: 9 characters, budget 8/);
});

test('structural: a draft for another language fails', () => {
  only({ ...filled(), language: 'fr' }, /not "de"/);
});

test('warn only: missing, untranslated and stale rows are counted, not failed', () => {
  const base = filled();
  const missing = check({ ...base, rows: base.rows.filter((row) => row.key !== 'gl.lost') });
  assert.deepEqual([missing.problems, missing.missing], [[], ['gl.lost']]);
  const empty = check(withRow(base, 'gl.lost', { translation: '' }));
  assert.deepEqual([empty.problems, empty.untranslated], [[], ['gl.lost']]);
  // The English gained a {param} since the export: the old translation is stale, not broken.
  const stale = check(withRow(base, 'airport.focus', { en: 'Rotate', translation: 'Drehen', placeholders: [] }));
  assert.deepEqual([stale.problems, stale.stale], [[], ['airport.focus']]);
  // A stale untranslated row is just untranslated.
  const both = check(withRow(base, 'airport.focus', { en: 'Rotate', translation: '' }));
  assert.deepEqual([both.stale, both.untranslated], [[], ['airport.focus']]);
});

test('a stale row is still checked against the English and budget it was exported with', () => {
  only(withRow(filled(), 'airport.focus', { en: 'Rotate to {code}!', translation: 'Drehen' }), /airport\.focus: placeholders \{\}/);
  only(withRow(filled(), 'menu.onTime', { en: 'Punctual', maxLength: 8, translation: 'Pünktlich' }), /9 characters, budget 8/);
});

// --- The committed drafts ------------------------------------------------------------------------------------------
const files = existsSync(DRAFTS) ? readdirSync(DRAFTS).filter((name) => /^[a-z]{2,3}(-[a-z0-9]+)?\.(json|csv)$/i.test(name)).sort() : [];
let rows = 0;
for (const name of files) {
  test(`docs/i18n/${name}`, () => {
    const code = name.replace(/\.(json|csv)$/i, '');
    const target = targets.find((entry) => entry.code === code);
    assert.ok(target, `unknown language "${code}" (known: ${targets.map((entry) => entry.code).join(', ')})`);
    const file = parseExchange(readFileSync(resolve(DRAFTS, name), 'utf8'), name.endsWith('.csv') ? 'csv' : 'json');
    rows += file.rows.length;
    const report = checkDraft({ file, target, en, limits });
    const counts = [report.missing.length, report.stale.length, report.untranslated.length];
    if (counts.some(Boolean)) {
      console.log(`WARN docs/i18n/${name}: missing=${counts[0]} stale=${counts[1]} untranslated=${counts[2]} ` +
        `(run npm run i18n:export -- ${code}, then translate the empty rows)`);
    }
    assert.deepEqual(report.problems, [], `docs/i18n/${name}: ${report.problems.length} problems ` +
      `(fix the translation, or re-export for unknown keys):\n  ` + report.problems.join('\n  '));
  });
}

console.log(`SUMMARY test:i18n-drafts seed=${SEED} files=${files.length} rows=${rows} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

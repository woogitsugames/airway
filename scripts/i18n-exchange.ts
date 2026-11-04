// [night-12ah] R7i, D-211: translator hand-off CLI (logic in scripts/lib/i18n-exchange.ts).
//   npm run i18n:export -- de [--csv] [--out=docs/i18n/de.json]   EN + PL reference → file for the translator
//   npm run i18n:import -- de [--file=docs/i18n/de.json] [--out=src/i18n/de.ts] [--check]
// Export keeps the translations of an existing file whose English source is unchanged. Import writes nothing when
// any row fails (exit 1, one line per problem); `--check` validates only. A written catalog is not shipped until
// its language is added to LANGUAGE_ENTRIES (src/i18n/languages.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGE_ENTRIES, PLANNED_LANGUAGE_ENTRIES } from '../src/i18n/languages.ts';
import {
  buildExport, parseExchange, readCatalogSource, renderCatalog, toCsv, validateImport, type ExchangeFile, type TargetLanguage,
} from './lib/i18n-exchange.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, code, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => rest.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
const has = (name: string): boolean => rest.includes('--' + name);

function fail(message: string): never {
  console.error('FAIL ' + message);
  process.exit(1);
}

const targets: TargetLanguage[] = [...PLANNED_LANGUAGE_ENTRIES, ...LANGUAGE_ENTRIES.filter((entry) => entry.code !== 'en')];
if ((command !== 'export' && command !== 'import') || !code) {
  fail('usage: i18n-exchange.ts export|import <' + targets.map((t) => t.code).join('|') + '> [--csv] [--file=…] [--out=…] [--check]');
}
const target = targets.find((entry) => entry.code === code) ?? fail(`unknown language "${code}" (known: ${targets.map((t) => t.code).join(', ')}; ` +
  'add a planned entry to src/i18n/languages.ts first)');

const catalog = (name: string) => readCatalogSource(readFileSync(resolve(ROOT, 'src/i18n', name + '.ts'), 'utf8'), name);
const en = catalog('en');
const pl = catalog('pl');

/** R7h's length budgets, when `src/i18n/limits.ts` exists: any exported `Record<key, number>` (or `{ max }`). */
async function lengthLimits(): Promise<Map<string, number>> {
  const file = resolve(ROOT, 'src/i18n/limits.ts');
  const limits = new Map<string, number>();
  if (!existsSync(file)) return limits;
  const module: Record<string, unknown> = await import(pathToFileURL(file).href);
  const keys = new Set(en.map((entry) => entry.key));
  for (const value of Object.values(module)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [key, limit] of Object.entries(value as Record<string, unknown>)) {
      const max = typeof limit === 'number' ? limit : (limit as { max?: unknown } | null)?.max;
      if (keys.has(key) && typeof max === 'number') limits.set(key, Math.min(max, limits.get(key) ?? Infinity));
    }
  }
  return limits;
}

const limits = await lengthLimits();
const kindOf = (path: string): 'json' | 'csv' => (path.endsWith('.csv') ? 'csv' : 'json');

if (command === 'export') {
  const out = resolve(ROOT, flag('out') ?? `docs/i18n/${code}.${has('csv') ? 'csv' : 'json'}`);
  let previous: ExchangeFile | null = null;
  if (existsSync(out)) previous = parseExchange(readFileSync(out, 'utf8'), kindOf(out));
  const file = buildExport({ target, en, pl, limits, previous });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, kindOf(out) === 'csv' ? toCsv(file) : JSON.stringify(file, null, 2) + '\n');
  const done = file.rows.filter((row) => row.translation).length;
  console.log(`SUMMARY i18n:export language=${code} rows=${file.rows.length} translated=${done} plural=${target.plural.join('|')} ` +
    `limits=${file.rows.filter((row) => row.maxLength !== null).length} file=${relative(ROOT, out)}`);
} else {
  const input = resolve(ROOT, flag('file') ?? [`docs/i18n/${code}.json`, `docs/i18n/${code}.csv`].find((p) => existsSync(resolve(ROOT, p))) ??
    fail(`no docs/i18n/${code}.json or .csv (pass --file=…)`));
  let file: ExchangeFile;
  try { file = parseExchange(readFileSync(input, 'utf8'), kindOf(input)); } catch (error) { fail(input + ': ' + (error as Error).message); }
  const result = validateImport({ file, target, en, limits });
  for (const warning of result.warnings) console.log('WARN ' + warning);
  // Untranslated rows are one line (a fresh export has hundreds); every other problem gets its own.
  const untranslated = result.errors.filter((error) => error.endsWith(': no translation'));
  for (const error of result.errors) if (!untranslated.includes(error)) console.error('FAIL ' + error);
  if (untranslated.length) {
    console.error(`FAIL ${untranslated.length} rows without a translation: ` +
      untranslated.slice(0, 8).map((error) => error.split(':')[0]).join(', ') + (untranslated.length > 8 ? ', …' : ''));
  }
  const out = resolve(ROOT, flag('out') ?? `src/i18n/${code}.ts`);
  if (!result.errors.length && !has('check')) writeFileSync(out, renderCatalog(code, en, result.catalog));
  console.log(`SUMMARY i18n:import language=${code} rows=${file.rows.length} errors=${result.errors.length} ` +
    `warnings=${result.warnings.length} written=${!result.errors.length && !has('check') ? relative(ROOT, out) : 'none'}`);
  if (result.errors.length) process.exitCode = 1;
}

// [night-12ah] R7i, D-211: the translator hand-off. `i18n:export` turns the EN catalog (+ PL reference, context
// comments, length budgets and the target language's plural categories) into one file a translator fills in;
// `i18n:import` checks a filled file and writes `src/i18n/<code>.ts`. Pure (no fs): the CLIs and the test use it.
//
// Two file shapes carry the same rows: JSON (`airway-i18n/1`, default, round-trips everything) and CSV (RFC 4180,
// one header row + one row per key, for spreadsheets). Import refuses a file when any row would break the game:
// a missing or extra key, a `{param}` lost or invented, a plural token with the wrong number of forms, text over its
// length budget, or a translation made for an English source that has changed since the export.
import ts from 'typescript';
import type { LanguageEntry } from '../../src/i18n/languages.ts';

export const FORMAT = 'airway-i18n/1';

/** What the hand-off needs from a language: the shipped entries and the planned ones both fit. */
export type TargetLanguage = Pick<LanguageEntry, 'code' | 'locale' | 'plural' | 'requiredForms'>;

export interface CatalogEntry {
  readonly key: string;
  readonly value: string;
  /** Section comment above the entry and/or the comment at the end of its line, task tags removed. */
  readonly comment: string;
}

export interface ExchangeRow {
  key: string;
  en: string;
  pl: string;
  context: string;
  maxLength: number | null;
  placeholders: string[];
  pluralParams: string[];
  translation: string;
}

export interface ExchangeFile {
  format: typeof FORMAT;
  language: string;
  locale: string;
  plural: {
    categories: string[];
    requiredForms: number;
    /** Sample counts for each category, so the translator sees which numbers take which form. */
    examples: Record<string, number[]>;
    howTo: string;
  };
  rows: ExchangeRow[];
}

const TAG = /^\s*\[[a-z0-9-]+\]\s*/i;
const PARAM = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const PLURAL = /\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g;

const cleanComment = (text: string): string =>
  text.replace(/^\/\/\s?|^\/\*+|\*+\/$/g, '').replace(TAG, '').replace(/\s+/g, ' ').trim();

/** Reads `export const <name> = { 'key': 'text', … }` with its comments (no evaluation). */
export function readCatalogSource(source: string, name: string): CatalogEntry[] {
  const file = ts.createSourceFile(name + '.ts', source, ts.ScriptTarget.Latest, true);
  let literal: ts.ObjectLiteralExpression | undefined;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      let init = declaration.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && init && ts.isObjectLiteralExpression(init)) literal = init;
    }
  }
  if (!literal) throw new Error(name + ': no literal catalog `export const ' + name + ' = { … }`');
  const entries: CatalogEntry[] = [];
  let section = '';
  for (const property of literal.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer) ||
      !(ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))) {
      throw new Error(name + ': every catalog entry must be a literal string');
    }
    const leading = ts.getLeadingCommentRanges(source, property.getFullStart()) ?? [];
    const above = leading.map((range) => cleanComment(source.slice(range.pos, range.end))).filter(Boolean).join(' ');
    if (above) section = above;
    const lineEnd = source.indexOf('\n', property.getEnd());
    const rest = source.slice(property.getEnd(), lineEnd < 0 ? undefined : lineEnd);
    const trailing = /\/\/(.*)$/.exec(rest)?.[1];
    const own = trailing ? cleanComment(trailing) : '';
    entries.push({ key: property.name.text, value: property.initializer.text, comment: [section, own].filter(Boolean).join(' — ') });
  }
  return entries;
}

export const placeholdersOf = (text: string): string[] => [...new Set([...text.matchAll(PARAM)].map((m) => m[1]))].sort();
export const pluralParamsOf = (text: string): string[] => [...new Set([...text.matchAll(PLURAL)].map((m) => m[1]))].sort();

/** Plural categories of the language with sample counts (0…200, 1 000, 1 000 000; first five per category). */
export function pluralExamples(target: TargetLanguage): Record<string, number[]> {
  const rules = new Intl.PluralRules(target.locale);
  const out: Record<string, number[]> = Object.fromEntries(target.plural.map((category) => [category, []]));
  for (const n of [...Array.from({ length: 201 }, (_, i) => i), 1000, 1_000_000]) {
    const list = out[rules.select(n)];
    if (list && list.length < 5) list.push(n);
  }
  return out;
}

/** Visible length budget measure: plural tokens count as their longest form, `{param}` as nothing (R7h may refine). */
export function measuredLength(text: string): number {
  const plural = text.replace(PLURAL, (_token, _name: string, forms: string) =>
    forms.split('|').reduce((longest, form) => (form.length > longest.length ? form : longest), ''));
  return [...plural.replace(PARAM, '')].length;
}

export function buildExport(options: {
  target: TargetLanguage;
  en: readonly CatalogEntry[];
  pl: readonly CatalogEntry[];
  limits?: ReadonlyMap<string, number>;
  /** A previous export/translation of the same language: its translations are kept where the EN source is unchanged. */
  previous?: ExchangeFile | null;
}): ExchangeFile {
  const { target, en, pl, limits, previous } = options;
  const reference = new Map(pl.map((entry) => [entry.key, entry.value]));
  const kept = new Map((previous?.rows ?? []).map((row) => [row.key, row]));
  const rows = en.map((entry): ExchangeRow => {
    const old = kept.get(entry.key);
    return {
      key: entry.key,
      en: entry.value,
      pl: reference.get(entry.key) ?? '',
      context: entry.comment,
      maxLength: limits?.get(entry.key) ?? null,
      placeholders: placeholdersOf(entry.value),
      pluralParams: pluralParamsOf(entry.value),
      translation: old && old.en === entry.value ? old.translation : '',
    };
  });
  const forms = target.plural.slice(0, target.requiredForms).join('|');
  return {
    format: FORMAT,
    language: target.code,
    locale: target.locale,
    plural: {
      categories: [...target.plural],
      requiredForms: target.requiredForms,
      examples: pluralExamples(target),
      howTo: `Write a count's word as {name|${target.plural.join('|')}} with ${target.requiredForms}` +
        (target.requiredForms < target.plural.length ? `–${target.plural.length}` : '') +
        ` forms in this order (at least ${forms}); a missing form falls back to the last one given. ` +
        'Keep every {param} of the English text; the number itself is written separately: "{count} {count|…}".',
    },
    rows,
  };
}

// --- CSV (RFC 4180) ----------------------------------------------------------------------------------------------
const CSV_COLUMNS = ['key', 'en', 'pl', 'context', 'maxLength', 'placeholders', 'pluralParams', 'translation'] as const;

const csvCell = (value: string): string => (/[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value);

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV: unterminated quoted cell');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/** Header lines starting with `#` carry the language and plural notes; spreadsheets keep them as plain rows. */
export function toCsv(file: ExchangeFile): string {
  const meta = [
    ['#format', file.format], ['#language', file.language], ['#locale', file.locale],
    ['#plural', file.plural.categories.join('|')], ['#requiredForms', String(file.plural.requiredForms)],
    ['#examples', Object.entries(file.plural.examples).map(([c, list]) => c + ': ' + list.join(' ')).join('; ')],
    ['#howTo', file.plural.howTo],
  ];
  const lines = [
    ...meta.map((cells) => cells.map(csvCell).join(',')),
    CSV_COLUMNS.join(','),
    ...file.rows.map((row) => [row.key, row.en, row.pl, row.context, row.maxLength === null ? '' : String(row.maxLength),
      row.placeholders.join(' '), row.pluralParams.join(' '), row.translation].map(csvCell).join(',')),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function fromCsv(text: string): ExchangeFile {
  const meta = new Map<string, string>();
  let header: string[] | null = null;
  const rows: ExchangeRow[] = [];
  for (const cells of parseCsv(text)) {
    if (!header && cells[0].startsWith('#')) { meta.set(cells[0].slice(1), cells[1] ?? ''); continue; }
    if (!header) {
      header = cells;
      const missing = CSV_COLUMNS.filter((column) => !header!.includes(column));
      if (missing.length) throw new Error('CSV: missing columns ' + missing.join(', '));
      continue;
    }
    const get = (column: (typeof CSV_COLUMNS)[number]): string => cells[header!.indexOf(column)] ?? '';
    const max = get('maxLength').trim();
    rows.push({
      key: get('key'), en: get('en'), pl: get('pl'), context: get('context'),
      maxLength: max === '' ? null : Number(max),
      placeholders: get('placeholders').split(' ').filter(Boolean),
      pluralParams: get('pluralParams').split(' ').filter(Boolean),
      translation: get('translation'),
    });
  }
  if (meta.get('format') !== FORMAT) throw new Error('CSV: not an ' + FORMAT + ' file (#format row)');
  const categories = (meta.get('plural') ?? '').split('|').filter(Boolean);
  return {
    format: FORMAT, language: meta.get('language') ?? '', locale: meta.get('locale') ?? '',
    plural: { categories, requiredForms: Number(meta.get('requiredForms')), examples: {}, howTo: meta.get('howTo') ?? '' },
    rows,
  };
}

export function parseExchange(text: string, kind: 'json' | 'csv'): ExchangeFile {
  if (kind === 'csv') return fromCsv(text);
  const file = JSON.parse(text) as ExchangeFile;
  if (!file || file.format !== FORMAT || !Array.isArray(file.rows)) throw new Error('JSON: not an ' + FORMAT + ' file');
  return file;
}

// --- Import ------------------------------------------------------------------------------------------------------
export interface ImportResult {
  readonly errors: string[];
  /** Allowed but worth a look (a count without its own word form). */
  readonly warnings: string[];
  readonly catalog: Map<string, string>;
}

/**
 * Checks a filled file against the current EN catalog and the target language. Every problem is listed (the
 * translator fixes them in one pass); the catalog is only usable when `errors` is empty.
 */
export function validateImport(options: {
  file: ExchangeFile;
  target: TargetLanguage;
  en: readonly CatalogEntry[];
  limits?: ReadonlyMap<string, number>;
}): ImportResult {
  const { file, target, en, limits } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const catalog = new Map<string, string>();
  if (file.language !== target.code) errors.push(`file is for language "${file.language}", not "${target.code}"`);
  const source = new Map(en.map((entry) => [entry.key, entry.value]));
  const seen = new Set<string>();
  for (const row of file.rows) {
    const key = row.key;
    if (seen.has(key)) { errors.push(`${key}: duplicate row`); continue; }
    seen.add(key);
    const english = source.get(key);
    if (english === undefined) { errors.push(`${key}: unknown key (not in en.ts)`); continue; }
    const text = (row.translation ?? '').replace(/\r\n?/g, '\n');
    if (!text.trim()) { errors.push(`${key}: no translation`); continue; }
    if (row.en !== english) errors.push(`${key}: English source changed since the export (re-export and check the translation)`);
    const want = placeholdersOf(english).join(', ');
    const got = placeholdersOf(text).join(', ');
    if (want !== got) errors.push(`${key}: placeholders {${got}} differ from English {${want}}`);
    const params = new Set([...placeholdersOf(english), ...pluralParamsOf(english)]);
    for (const match of text.matchAll(PLURAL)) {
      const forms = match[2].split('|');
      if (forms.length < target.requiredForms || forms.length > target.plural.length) {
        errors.push(`${key}: plural token ${match[0]} has ${forms.length} forms, ${target.code} needs ` +
          (target.requiredForms === target.plural.length ? String(target.requiredForms) : `${target.requiredForms}–${target.plural.length}`) +
          ` (${target.plural.join('|')})`);
      }
      if (forms.some((form) => !form.trim())) errors.push(`${key}: plural token ${match[0]} has an empty form`);
      if (!params.has(match[1])) errors.push(`${key}: plural token parameter "${match[1]}" is not a parameter of the English text`);
    }
    for (const name of pluralParamsOf(english)) {
      if (!pluralParamsOf(text).includes(name) && target.plural.length > 1) {
        warnings.push(`${key}: English chooses a word form by {${name}|…}; the translation has no plural token for "${name}"`);
      }
    }
    if (/[{}]/.test(text.replace(PLURAL, '').replace(PARAM, ''))) errors.push(`${key}: stray "{" or "}" (broken placeholder)`);
    const limit = limits?.get(key) ?? row.maxLength ?? null;
    if (limit !== null && Number.isFinite(limit) && measuredLength(text) > limit) {
      errors.push(`${key}: ${measuredLength(text)} characters, budget ${limit}`);
    }
    catalog.set(key, text);
  }
  for (const key of source.keys()) if (!seen.has(key)) errors.push(`${key}: missing row`);
  return { errors, warnings, catalog };
}

/**
 * [night-50a] GPT-12: the length budgets of `src/i18n/limits.ts` from its module exports: any exported
 * `Record<key, number>` (or `{ max }`) whose keys are catalog keys; the smallest budget wins. Shared by the CLI and
 * `test:i18n-drafts`.
 */
export function limitsFromModule(module: Readonly<Record<string, unknown>>, keys: ReadonlySet<string>): Map<string, number> {
  const limits = new Map<string, number>();
  for (const value of Object.values(module)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [key, limit] of Object.entries(value as Record<string, unknown>)) {
      const max = typeof limit === 'number' ? limit : (limit as { max?: unknown } | null)?.max;
      if (keys.has(key) && typeof max === 'number') limits.set(key, Math.min(max, limits.get(key) ?? Infinity));
    }
  }
  return limits;
}

/** A committed translation draft sorted into what breaks it and what only means "re-export and translate more". */
export interface DraftReport {
  /** Structural problems: unknown/duplicate key, {param}s, plural forms, budget, broken braces, wrong language. */
  readonly problems: string[];
  /** EN keys without a row (new since the export). */
  readonly missing: string[];
  /** Rows whose English source changed since the export (checked against the English they were made from). */
  readonly stale: string[];
  /** Rows with no translation yet. */
  readonly untranslated: string[];
  readonly warnings: string[];
}

/**
 * [night-50a] GPT-12: the `test:i18n-drafts` rules for a draft in `docs/i18n/`. A new or changed EN key must not
 * break the fast suite, so missing, stale and untranslated rows are only counted; a stale row is still checked, but
 * against the English and the budget it was exported with. Everything `validateImport` finds beyond that is a problem.
 */
export function checkDraft(options: {
  file: ExchangeFile;
  target: TargetLanguage;
  en: readonly CatalogEntry[];
  limits?: ReadonlyMap<string, number>;
}): DraftReport {
  const { file, target, en, limits } = options;
  const current = new Map(en.map((entry) => [entry.key, entry.value]));
  const exported = new Map<string, ExchangeRow>();
  for (const row of file.rows) if (!exported.has(row.key)) exported.set(row.key, row);
  const stale = [...exported.values()]
    .filter((row) => current.has(row.key) && row.en !== current.get(row.key) && (row.translation ?? '').trim() !== '')
    .map((row) => row.key);
  const staleSet = new Set(stale);
  const source = en.map((entry) => (staleSet.has(entry.key) ? { ...entry, value: exported.get(entry.key)!.en } : entry));
  const ownLimits = new Map([...(limits ?? new Map<string, number>())].filter(([key]) => !staleSet.has(key)));
  const result = validateImport({ file, target, en: source, limits: ownLimits });
  const keyOf = (error: string): string => error.slice(0, error.indexOf(':'));
  const missing = result.errors.filter((error) => error.endsWith(': missing row')).map(keyOf);
  const untranslated = result.errors.filter((error) => error.endsWith(': no translation')).map(keyOf);
  const problems = result.errors.filter((error) => !error.endsWith(': missing row') && !error.endsWith(': no translation'));
  return { problems, missing, stale, untranslated, warnings: result.warnings };
}

/** `src/i18n/<code>.ts` in the shape of pl.ts (same key order as en.ts; type-checked against it). */
export function renderCatalog(code: string, en: readonly CatalogEntry[], catalog: ReadonlyMap<string, string>): string {
  const name = code.replace(/[^A-Za-z0-9]/g, '_');
  const lines = en.map((entry) => `  ${JSON.stringify(entry.key)}: ${JSON.stringify(catalog.get(entry.key) ?? '')},`);
  return [
    `// ${code}: generated by \`npm run i18n:import -- ${code}\` from the translator file (scripts/lib/i18n-exchange.ts).`,
    '// Edit the translation file and import again; same keys and parameter names as English.',
    "import type { en } from './en';",
    `export const ${name} = {`,
    ...lines,
    '} as const satisfies Record<keyof typeof en, string>;',
    '',
  ].join('\n');
}

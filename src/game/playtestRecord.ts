// [night-12ap] R3j, D-231: the playtest record — one machine line (`AW1:` + base64url JSON) under the logbook's
// readable "Copy summary" text, and its decoder for `npm run playtest:decode` (CSV for docs/PLAYTEST.md). Counts and
// fixed words only: no airport code, seed, name or device identifier. It leaves the device only when the player pastes
// the summary somewhere (D-16). Pure: btoa/atob exist in browsers and Node ≥ 16.
import { LOGBOOK_KEY, readLogbook, runRecord, type Logbook, type RunNote } from './logbook';

export const RECORD_PREFIX = 'AW1:';

/** Per-run columns of the record, in order (also the CSV's run columns). */
export const RUN_COLUMNS = ['day', 'mode', 'min_1x', 'min_real', 'weeks', 'passengers', 'cause', 'picks',
  'hub_picked', 'hub_offered', 'slots_picked', 'slots_offered', 'held_min', 'tutorial', 'quality', 'preset',
  'adapt_steps', 'version'] as const;
/** Per-summary columns repeated on every CSV row. */
export const SUMMARY_COLUMNS = ['summary', 'copied', 'app_version', 'flights', 'dailies', 'tutorial_now',
  'puzzles_solved', 'puzzles_total'] as const;

export interface RecordInput {
  readonly book: Logbook;
  readonly tutorial: string;
  readonly puzzlesSolved: number;
  readonly puzzlesTotal: number;
  /** Local day of the copy, YYYY-MM-DD. */
  readonly today: string;
  readonly version: string;
}

type Cell = string | number | null;
const minutes = (tenths: number | undefined): number | null => (tenths === undefined ? null : tenths / 10);

function runRow(run: RunNote): Cell[] {
  return [run.day, run.mode, minutes(run.tenths), minutes(run.real), run.weeks, run.passengers, run.cause ?? null,
    run.picks ?? null, run.hubPicked, run.hubOffered, run.slotsPicked, run.slotsOffered, run.held,
    run.tutorial ?? null, run.quality ?? null, run.preset ?? null, run.adapt ?? null, run.version ?? null];
}

function base64url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unbase64url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

/** The `AW1:` line: {v, d, app, f, dl, tut, pz, r: rows in RUN_COLUMNS order}. ASCII JSON, so btoa is safe. */
export function encodePlaytestRecord(input: RecordInput): string {
  const json = JSON.stringify({
    v: 1, d: input.today, app: input.version, f: input.book.flights, dl: input.book.dailies, tut: input.tutorial,
    pz: [input.puzzlesSolved, input.puzzlesTotal], r: input.book.runs.map(runRow),
  });
  return RECORD_PREFIX + base64url(json.replace(/[^\x20-\x7e]/g, ''));
}

export interface DecodedRecord {
  readonly copied: string;
  readonly version: string;
  readonly flights: number;
  readonly dailies: number;
  readonly tutorial: string;
  readonly puzzlesSolved: number;
  readonly puzzlesTotal: number;
  readonly runs: readonly RunNote[];
}

/**
 * One `AW1:` token back into a record; null when it is not one (wrong prefix, bad base64 or JSON, other version).
 * Runs pass the logbook's own validation, so a hand-edited line cannot inject other fields.
 */
export function decodePlaytestRecord(token: string): DecodedRecord | null {
  if (!token.startsWith(RECORD_PREFIX)) return null;
  let data: unknown;
  try { data = JSON.parse(unbase64url(token.slice(RECORD_PREFIX.length).trim())); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.v !== 1 || !Array.isArray(record.r)) return null;
  const rows = record.r.filter((row): row is unknown[] => Array.isArray(row) && row.length === RUN_COLUMNS.length);
  const notes = rows.map((row) => {
    const cell = (name: typeof RUN_COLUMNS[number]): unknown => row[RUN_COLUMNS.indexOf(name)];
    const tenths = (name: typeof RUN_COLUMNS[number]): unknown => {
      const value = cell(name);
      return typeof value === 'number' ? Math.round(value * 10) : undefined;
    };
    return {
      day: cell('day'), mode: cell('mode'), passengers: cell('passengers'), weeks: cell('weeks'), hub: null,
      tenths: tenths('min_1x'), real: tenths('min_real'), held: cell('held_min'),
      hubOffered: cell('hub_offered'), hubPicked: cell('hub_picked'),
      slotsOffered: cell('slots_offered'), slotsPicked: cell('slots_picked'),
      cause: cell('cause'), picks: cell('picks'), tutorial: cell('tutorial'), quality: cell('quality'),
      preset: cell('preset'), adapt: cell('adapt_steps'), version: cell('version'),
    };
  });
  // Reuse the logbook reader: it validates and caps every note exactly as the game does.
  const book = readLogbook({
    getItem: (key) => (key === LOGBOOK_KEY ? JSON.stringify({ flights: 0, passengers: 0, weeks: 0, longestWeeks: 0, runs: notes }) : null),
    setItem: () => undefined,
  });
  const num = (value: unknown): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0);
  const pz = Array.isArray(record.pz) ? record.pz : [];
  const text = (value: unknown, pattern: RegExp): string => (typeof value === 'string' && pattern.test(value) ? value : '');
  return {
    copied: text(record.d, /^\d{4}-\d{2}-\d{2}$/), version: runRecord({ version: record.app }).version ?? '',
    flights: num(record.f), dailies: num(record.dl), tutorial: runRecord({ tutorial: record.tut }).tutorial ?? '',
    puzzlesSolved: num(pz[0]), puzzlesTotal: num(pz[1]), runs: book.runs,
  };
}

const csvCell = (value: Cell): string => {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Every `AW1:` line found in the pasted text as CSV: one row per run, summary columns first. `summary` numbers the
 * records in the order found (1-based); rows without a valid token are skipped and counted.
 */
export function playtestCsv(pasted: string): { readonly csv: string; readonly records: number; readonly rows: number; readonly skipped: number } {
  const tokens = pasted.match(/AW1:[A-Za-z0-9_-]+/g) ?? [];
  const lines = [[...SUMMARY_COLUMNS, ...RUN_COLUMNS].join(',')];
  let records = 0;
  let skipped = 0;
  for (const token of tokens) {
    const record = decodePlaytestRecord(token);
    if (!record) { skipped++; continue; }
    records++;
    const head: Cell[] = [records, record.copied, record.version, record.flights, record.dailies, record.tutorial,
      record.puzzlesSolved, record.puzzlesTotal];
    for (const run of record.runs) lines.push([...head, ...runRow(run)].map(csvCell).join(','));
  }
  return { csv: lines.join('\n') + '\n', records, rows: lines.length - 1, skipped };
}

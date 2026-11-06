// [night-10n] The pilot's logbook: lifetime totals of finished Endless and daily flights, kept on the device only.
// Written once per game over (src/main.ts onFailure); the logbook screen also reads the existing best record,
// daily scores and puzzle stars. Pure over a Storage-like object so it runs headless.

export const LOGBOOK_KEY = 'airway.logbook.v1';
/** Last flights listed on the logbook page (newest first). */
export const RECENT_FLIGHTS = 6;
/** Distinct hubs counted; the least-used one is dropped beyond this so the record stays small. */
const MAX_HUBS = 40;
const MAX_COUNT = 1_000_000_000;
/** [night-12am] R1o: closed-test notes kept for the last runs ("Copy summary"; Q-73, Q-78, Q-80). */
export const RUN_NOTES = 30;

import { REGION_IDS, type RegionId } from '../data/regions';
import { LEGACY_MILESTONES, MILESTONES, isMilestone, type MilestoneId } from './milestones'; // [night-12ax] R1n

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type LogMode = 'endless' | 'daily';

export interface LogEntry {
  /** Local calendar day of the game over, YYYY-MM-DD. */
  readonly day: string;
  readonly mode: LogMode;
  readonly passengers: number;
  readonly weeks: number;
  /** City code of the run's busiest hub (or busiest airport without a hub); null for an empty network. */
  readonly hub: string | null;
  /** [night-11aj] R2g: the Endless home region the run started in; absent for Random, Daily and older entries. */
  readonly region?: RegionId;
  /** [night-12bc] R2h, D-251: an Endless run's licence class above I; absent for class I, Daily and older entries. */
  readonly licence?: 2 | 3;
}

/**
 * [night-12am] R1o: what one finished run adds to the closed-test summary, read from the sim at game over.
 * Counts only, no identifiers; kept on the device and leaves it only when the player copies the summary (D-16).
 */
export interface RunStats {
  /** Run length in tenths of a minute at 1x speed (sim ticks / 60), the balance report's unit (Q-73). */
  readonly tenths: number;
  /** Aircraft-minutes held on the ground for a departure slot; 0 = the hourly limit never bit (Q-80). */
  readonly held: number;
  /** Weekly boards that showed the hub expansion card / runs' picks of it (Q-78). */
  readonly hubOffered: number;
  readonly hubPicked: number;
  /** Weekly boards that showed the "+2 slots" card / picks of it (Q-80). */
  readonly slotsOffered: number;
  readonly slotsPicked: number;
}

/** [night-12ap] R3j: game-over cause kinds as the board ranks them (src/game/causes.ts; a literal so this file loads alone). */
export const RECORD_CAUSES = ['no-route', 'regional-demand', 'seat-shortage', 'missed-transfer', 'transfer-not-ready',
  'long-wait', 'capacity', 'congestion-duration', 'slot-wait', 'unavailable'] as const;
export type RecordCause = typeof RECORD_CAUSES[number];
/** [night-12ap] Weekly picks as letters: Turboprop, Widebody, Hub expansion, departure Slots (in week order). */
export const PICK_LETTERS = { turboprop: 'T', widebody: 'W', 'hub-expansion': 'H', 'departure-slots': 'S' } as const;
export const RECORD_TUTORIAL = ['completed', 'skipped', 'in-progress', 'none'] as const;
export const RECORD_QUALITY = ['auto', 'saver', 'low', 'medium', 'high'] as const;
export const RECORD_PRESETS = ['low', 'medium', 'high'] as const;
const MAX_PICKS = 60;
const MAX_ADAPT = 3;
const VERSION = /^[0-9A-Za-z.+-]{1,24}$/;
const PICKS = new RegExp(`^[${Object.values(PICK_LETTERS).join('')}]{0,${MAX_PICKS}}$`);

/**
 * [night-12ap] R3j playtest record of one run (all optional: runs logged before R3j, or a field the device could not
 * read, simply lack it). Counts and fixed words only, no identifiers (D-16).
 */
export interface RunRecord {
  /** Real (wall-clock) play time in tenths of a minute: game screen and weekly board, app in front, not paused. */
  readonly real?: number;
  /** The first cause on the game-over board. */
  readonly cause?: RecordCause;
  /** Weekly card picked each week, in order, as PICK_LETTERS (e.g. "WHT"). */
  readonly picks?: string;
  /** Flight training state when the run ended. */
  readonly tutorial?: typeof RECORD_TUTORIAL[number];
  /** Graphics setting, the preset the renderer ran at the end, adaptive downgrade steps taken (0–3). */
  readonly quality?: typeof RECORD_QUALITY[number];
  readonly preset?: typeof RECORD_PRESETS[number];
  readonly adapt?: number;
  /** App version that played the run (package.json; "dev" outside a Vite build). */
  readonly version?: string;
}

export interface RunNote extends RunStats, RunRecord {
  readonly day: string;
  readonly mode: LogMode;
  readonly passengers: number;
  readonly weeks: number;
}

export interface Logbook {
  readonly flights: number;
  /** [night-12am] Finished daily challenges (official and practice) since R1o. */
  readonly dailies: number;
  readonly passengers: number;
  readonly weeks: number;
  readonly longestWeeks: number;
  /** Flights per hub city code. */
  readonly hubs: Readonly<Record<string, number>>;
  readonly recent: readonly LogEntry[];
  /** [night-12am] The last RUN_NOTES runs with closed-test stats, newest first. */
  readonly runs: readonly RunNote[];
  /**
   * [night-12ax] R1n, D-242: the flight (1 = the first one logged) in which each Endless milestone was first
   * reached; a milestone never reached has no entry. Older records load with none.
   */
  readonly milestones: Readonly<Partial<Record<MilestoneId, number>>>;
  /**
   * [night-12bc] R2h, D-251: the most weeks flown in one run per licence class (class I counts Endless class I and
   * daily challenges: the same rules). Read through `licenceWeeks`. A record from before R2h starts class I at its
   * `longestWeeks` (every earlier flight was flown under class I rules).
   */
  readonly licenceWeeks?: Readonly<Partial<Record<1 | 2 | 3, number>>>;
}

export const EMPTY_LOGBOOK: Logbook = {
  flights: 0, dailies: 0, passengers: 0, weeks: 0, longestWeeks: 0, hubs: {}, recent: [], runs: [], milestones: {},
  licenceWeeks: {},
};

/** [night-12bc] R2h: valid per-class bests only (class 1–3, a count within the longest flight). */
function licenceRecord(value: unknown, longest: number): Partial<Record<1 | 2 | 3, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Partial<Record<1 | 2 | 3, number>> = {};
  for (const key of [1, 2, 3] as const) {
    const n = count((value as Record<string, unknown>)[key]);
    if (n !== null && n <= longest) out[key] = n;
  }
  return out;
}

/**
 * [night-12bc] R2h: the best weeks per licence class, tolerating hand-built Logbook objects (screens, dev fixtures)
 * that lack the field: their class I best is `longestWeeks`, like a stored record from before R2h.
 */
export function licenceWeeks(book: Logbook): Readonly<Partial<Record<1 | 2 | 3, number>>> {
  const value: unknown = (book as { readonly licenceWeeks?: unknown }).licenceWeeks;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Partial<Record<1 | 2 | 3, number>>;
  return book.flights > 0 ? { 1: book.longestWeeks } : {};
}

/** [night-12ax] Valid milestone entries only: a known id and a flight number within the flights logged. */
function milestoneRecord(value: unknown, flights: number): Partial<Record<MilestoneId, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Partial<Record<MilestoneId, number>> = {};
  for (const id of MILESTONES) {
    const n = count((value as Record<string, unknown>)[id]);
    if (n !== null && n >= 1 && n <= flights) out[id] = n;
  }
  // D-270: a pre-D-270 record's week-5 / 1 000-passenger flight counts for week 4 / 750 when it is earlier.
  for (const [old, id] of Object.entries(LEGACY_MILESTONES)) {
    const n = count((value as Record<string, unknown>)[old]);
    if (n !== null && n >= 1 && n <= flights && (out[id] === undefined || n < out[id]!)) out[id] = n;
  }
  return out;
}

/**
 * [night-11ao] The flight of each milestone's first reach, tolerating a logbook object that predates R1n (no
 * `milestones` field) or carries a malformed one. `readLogbook` normalises stored records, but screens and dev
 * fixtures also receive hand-built Logbook objects; every reader goes through here so none of them can throw.
 */
export function milestoneFlights(book: Logbook): Readonly<Partial<Record<MilestoneId, number>>> {
  const value: unknown = (book as { readonly milestones?: unknown }).milestones;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<Record<MilestoneId, number>> : {};
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Z]{3}$/;

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT ? value : null;
}
function entry(value: unknown): LogEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const passengers = count(item.passengers);
  const weeks = count(item.weeks);
  if (typeof item.day !== 'string' || !DAY.test(item.day)) return null;
  if (item.mode !== 'endless' && item.mode !== 'daily') return null;
  if (passengers === null || weeks === null) return null;
  const hub = typeof item.hub === 'string' && CODE.test(item.hub) ? item.hub : null;
  const region = item.mode === 'endless' && (REGION_IDS as readonly unknown[]).includes(item.region) ? item.region as RegionId : null;
  const licence = item.mode === 'endless' && (item.licence === 2 || item.licence === 3) ? item.licence : null;
  return { day: item.day, mode: item.mode, passengers, weeks, hub, ...(region ? { region } : {}), ...(licence ? { licence } : {}) };
}

const STAT_KEYS = ['tenths', 'held', 'hubOffered', 'hubPicked', 'slotsOffered', 'slotsPicked'] as const;
function stats(value: unknown): RunStats | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of STAT_KEYS) {
    const n = count(item[key]);
    if (n === null) return null;
    out[key] = n;
  }
  const clean = out as unknown as RunStats;
  // A resumed run counts only the boards shown after resuming; a pick proves its card was offered.
  return { ...clean, hubOffered: Math.max(clean.hubOffered, clean.hubPicked),
    slotsOffered: Math.max(clean.slotsOffered, clean.slotsPicked) };
}
const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  (list as readonly unknown[]).includes(value) ? value as T : undefined;
/** [night-12ap] The R3j fields that are valid; a bad one is dropped alone, the note stays. */
export function runRecord(value: unknown): RunRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const item = value as Record<string, unknown>;
  const real = count(item.real);
  const adapt = count(item.adapt);
  const fields: Record<string, unknown> = {
    real: real ?? undefined,
    cause: oneOf(RECORD_CAUSES, item.cause),
    picks: typeof item.picks === 'string' && PICKS.test(item.picks) ? item.picks : undefined,
    tutorial: oneOf(RECORD_TUTORIAL, item.tutorial),
    quality: oneOf(RECORD_QUALITY, item.quality),
    preset: oneOf(RECORD_PRESETS, item.preset),
    adapt: adapt !== null && adapt <= MAX_ADAPT ? adapt : undefined,
    version: typeof item.version === 'string' && VERSION.test(item.version) ? item.version : undefined,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as RunRecord;
}
function note(value: unknown): RunNote | null {
  const base = entry(value);
  const extra = stats(value);
  if (!base || !extra) return null;
  return { day: base.day, mode: base.mode, passengers: base.passengers, weeks: base.weeks, ...extra, ...runRecord(value) };
}

/** The stored logbook; a missing, malformed or unreadable record is an empty one (never throws). */
export function readLogbook(storage: StorageLike | undefined): Logbook {
  try {
    const raw = storage?.getItem(LOGBOOK_KEY);
    if (!raw) return EMPTY_LOGBOOK;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_LOGBOOK;
    const record = parsed as Record<string, unknown>;
    const flights = count(record.flights);
    const dailies = count(record.dailies) ?? 0;
    const passengers = count(record.passengers);
    const weeks = count(record.weeks);
    const longestWeeks = count(record.longestWeeks);
    if (flights === null || passengers === null || weeks === null || longestWeeks === null) return EMPTY_LOGBOOK;
    const hubs: Record<string, number> = {};
    if (record.hubs && typeof record.hubs === 'object' && !Array.isArray(record.hubs)) {
      for (const [code, value] of Object.entries(record.hubs as Record<string, unknown>)) {
        const n = count(value);
        if (CODE.test(code) && n) hubs[code] = n;
      }
    }
    const recent = Array.isArray(record.recent)
      ? record.recent.map(entry).filter((item): item is LogEntry => item !== null).slice(0, RECENT_FLIGHTS) : [];
    const runs = Array.isArray(record.runs)
      ? record.runs.map(note).filter((item): item is RunNote => item !== null).slice(0, RUN_NOTES) : [];
    return { flights, dailies: Math.min(dailies, flights), passengers, weeks, longestWeeks, hubs, recent, runs,
      milestones: milestoneRecord(record.milestones, flights),
      // [night-12bc] R2h: a record from before R2h has no field; its flights were all class I.
      licenceWeeks: record.licenceWeeks === undefined ? (flights > 0 ? { 1: longestWeeks } : {})
        : licenceRecord(record.licenceWeeks, longestWeeks) };
  } catch {
    return EMPTY_LOGBOOK;
  }
}

/**
 * Add one finished flight and write it back. A failed write still returns the updated book for this session.
 * [night-12am] `run` (closed-test stats) adds a line to `runs`; without it the flight counts but leaves no note.
 * [night-12ap] R3j: `run` may also carry the playtest record (RunRecord); invalid fields are dropped.
 * [night-12ax] R1n: `milestones` reached by an Endless run; each one not logged before gets this flight's number.
 */
export function recordFlight(storage: StorageLike | undefined, flight: LogEntry, run?: RunStats & RunRecord,
  milestones: readonly MilestoneId[] = []): Logbook {
  const prior = readLogbook(storage);
  const clean = entry(flight);
  if (!clean) return prior;
  const hubs: Record<string, number> = { ...prior.hubs };
  if (clean.hub) hubs[clean.hub] = Math.min(MAX_COUNT, (hubs[clean.hub] ?? 0) + 1);
  const codes = Object.keys(hubs);
  if (codes.length > MAX_HUBS) {
    // Drop the least-flown hub other than this flight's; ties drop the alphabetically last (deterministic).
    const drop = codes.filter((code) => code !== clean.hub)
      .sort((a, b) => (hubs[a] ?? 0) - (hubs[b] ?? 0) || b.localeCompare(a))[0];
    if (drop) delete hubs[drop];
  }
  const runNote = run ? note({ ...clean, ...run }) : null;
  const flights = Math.min(MAX_COUNT, prior.flights + 1);
  const firsts: Partial<Record<MilestoneId, number>> = { ...milestoneFlights(prior) };
  if (clean.mode === 'endless') for (const id of milestones) if (isMilestone(id) && firsts[id] === undefined) firsts[id] = flights;
  const next: Logbook = {
    flights,
    dailies: Math.min(MAX_COUNT, prior.dailies + (clean.mode === 'daily' ? 1 : 0)),
    passengers: Math.min(MAX_COUNT, prior.passengers + clean.passengers),
    weeks: Math.min(MAX_COUNT, prior.weeks + clean.weeks),
    longestWeeks: Math.max(prior.longestWeeks, clean.weeks),
    hubs,
    recent: [clean, ...prior.recent].slice(0, RECENT_FLIGHTS),
    runs: runNote ? [runNote, ...prior.runs].slice(0, RUN_NOTES) : prior.runs,
    milestones: milestoneRecord(firsts, flights),
    licenceWeeks: bestPerClass(licenceWeeks(prior), clean),
  };
  try { storage?.setItem(LOGBOOK_KEY, JSON.stringify(next)); } catch { /* Storage denied: session value only. */ }
  return next;
}

/** [night-12bc] R2h: the per-class bests after one more flight (Daily flies class I rules). */
function bestPerClass(prior: Readonly<Partial<Record<1 | 2 | 3, number>>>, flight: LogEntry): Partial<Record<1 | 2 | 3, number>> {
  const licence = flight.mode === 'endless' ? flight.licence ?? 1 : 1;
  return { ...prior, [licence]: Math.max(prior[licence] ?? 0, flight.weeks) };
}

/** [night-12ax] R1n: milestones this flight reached for the first time (its number is the book's last flight). */
export function firstMilestones(book: Logbook, reached: readonly MilestoneId[]): MilestoneId[] {
  const firsts = milestoneFlights(book);
  return reached.filter((id) => firsts[id] === book.flights);
}

/** The most-flown hub; a tie goes to the one flown most recently, then alphabetical. */
export function favouriteHub(book: Logbook): { readonly code: string; readonly flights: number } | null {
  let best: { code: string; flights: number } | null = null;
  const recency = (code: string): number => {
    const index = book.recent.findIndex((item) => item.hub === code);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  for (const [code, flights] of Object.entries(book.hubs)) {
    if (!best || flights > best.flights
      || (flights === best.flights && (recency(code) < recency(best.code)
        || (recency(code) === recency(best.code) && code < best.code)))) best = { code, flights };
  }
  return best;
}

/**
 * The run's home hub for the logbook: the hub on most routes, else the airport on most routes (a network that
 * never opened a hub still has a home). Ties go to the alphabetically first code so a replay logs the same.
 */
export function runHub(cities: readonly { readonly id: string; readonly hub: boolean }[],
    routes: readonly { readonly cityIds: readonly string[] }[]): string | null {
  const routesAt = new Map<string, number>();
  for (const route of routes) for (const id of new Set(route.cityIds)) routesAt.set(id, (routesAt.get(id) ?? 0) + 1);
  const pick = (ids: readonly string[]): string | null => {
    let best: string | null = null;
    for (const id of ids) {
      const n = routesAt.get(id) ?? 0;
      if (!n) continue;
      const b = best === null ? -1 : routesAt.get(best) ?? 0;
      if (n > b || (n === b && best !== null && id < best)) best = id;
    }
    return best;
  };
  return pick(cities.filter((city) => city.hub).map((city) => city.id)) ?? pick(cities.map((city) => city.id));
}

/** Local calendar day as YYYY-MM-DD (the player's day, like the daily mode's date on the board). */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

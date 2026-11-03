// [night-10n] The pilot's logbook: lifetime totals of finished Endless and daily flights, kept on the device only.
// Written once per game over (src/main.ts onFailure); the logbook screen also reads the existing best record,
// daily scores and puzzle stars. Pure over a Storage-like object so it runs headless.

export const LOGBOOK_KEY = 'airway.logbook.v1';
/** Last flights listed on the logbook page (newest first). */
export const RECENT_FLIGHTS = 6;
/** Distinct hubs counted; the least-used one is dropped beyond this so the record stays small. */
const MAX_HUBS = 40;
const MAX_COUNT = 1_000_000_000;

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
}

export interface Logbook {
  readonly flights: number;
  readonly passengers: number;
  readonly weeks: number;
  readonly longestWeeks: number;
  /** Flights per hub city code. */
  readonly hubs: Readonly<Record<string, number>>;
  readonly recent: readonly LogEntry[];
}

export const EMPTY_LOGBOOK: Logbook = { flights: 0, passengers: 0, weeks: 0, longestWeeks: 0, hubs: {}, recent: [] };

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
  return { day: item.day, mode: item.mode, passengers, weeks, hub };
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
    return { flights, passengers, weeks, longestWeeks, hubs, recent };
  } catch {
    return EMPTY_LOGBOOK;
  }
}

/** Add one finished flight and write it back. A failed write still returns the updated book for this session. */
export function recordFlight(storage: StorageLike | undefined, flight: LogEntry): Logbook {
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
  const next: Logbook = {
    flights: Math.min(MAX_COUNT, prior.flights + 1),
    passengers: Math.min(MAX_COUNT, prior.passengers + clean.passengers),
    weeks: Math.min(MAX_COUNT, prior.weeks + clean.weeks),
    longestWeeks: Math.max(prior.longestWeeks, clean.weeks),
    hubs,
    recent: [clean, ...prior.recent].slice(0, RECENT_FLIGHTS),
  };
  try { storage?.setItem(LOGBOOK_KEY, JSON.stringify(next)); } catch { /* Storage denied: session value only. */ }
  return next;
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

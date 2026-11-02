// Offline, device-local daily results. Only an authoritative server could prevent save tampering.

export type DailyRunKind = 'official' | 'practice';

export interface DailyResult {
  readonly dateKey: string;
  readonly kind: DailyRunKind;
  readonly score: number;
  readonly weeks: number;
  readonly ticket: string;
}

export interface DailyProgress {
  readonly dateKey: string;
  readonly officialUsed: boolean;
  readonly officialResult: DailyResult | null;
  readonly practiceBest: DailyResult | null;
  readonly bestOfficial: DailyResult | null;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** In-memory fallback is not durable across app restarts. */
  readonly persistent: boolean;
}

export interface ScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OfficialReservation {
  readonly dateKey: string;
  readonly attemptId: number;
}

export interface ScoreService {
  reserveOfficial(dateKey: string): OfficialReservation | null;
  finishOfficial(reservation: OfficialReservation, score: number, weeks: number, ticket: string): DailyResult | null;
  recordPractice(dateKey: string, score: number, weeks: number, ticket: string): DailyResult;
  getProgress(dateKey: string): DailyProgress;
}

const STORAGE_KEY = 'aw-daily-scores-v1';
const DAY_MS = 86_400_000;
const TICKET_PATTERN = /^(?:--|[‹⋈◖⌑⟆⟧]{1,12}\+?)$/u;

interface DayEntry {
  attemptId?: number;
  official?: DailyResult;
  practiceBest?: DailyResult;
}

interface StoreState {
  version: 1;
  nextAttemptId: number;
  days: Record<string, DayEntry>;
}

function emptyState(): StoreState {
  return { version: 1, nextAttemptId: 1, days: Object.create(null) as Record<string, DayEntry> };
}

/** A UTC calendar index avoids DST-induced 23/25-hour streak errors. */
export function dateIndex(dateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new RangeError('Invalid daily date key');
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError('Invalid daily calendar date');
  }
  return Math.floor(date.getTime() / DAY_MS);
}

function validResult(value: unknown, key: string, kind: DailyRunKind): value is DailyResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<DailyResult>;
  return item.dateKey === key && item.kind === kind &&
    Number.isSafeInteger(item.score) && (item.score ?? -1) >= 0 &&
    Number.isSafeInteger(item.weeks) && (item.weeks ?? -1) >= 0 &&
    typeof item.ticket === 'string' && TICKET_PATTERN.test(item.ticket);
}

function decode(raw: string | null): StoreState {
  if (!raw || raw.length > 2_000_000) return emptyState();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyState();
    const data = parsed as Partial<StoreState>;
    if (data.version !== 1 || !data.days || typeof data.days !== 'object' || Array.isArray(data.days)) {
      return emptyState();
    }
    const state = emptyState();
    if (Number.isSafeInteger(data.nextAttemptId) && (data.nextAttemptId ?? 0) > 0) {
      state.nextAttemptId = data.nextAttemptId!;
    }
    for (const [key, value] of Object.entries(data.days).slice(0, 4000)) {
      try { dateIndex(key); } catch { continue; }
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const day: DayEntry = {};
      if (Number.isSafeInteger(value.attemptId) && (value.attemptId ?? 0) > 0) {
        day.attemptId = value.attemptId;
        state.nextAttemptId = Math.max(state.nextAttemptId, value.attemptId! + 1);
      }
      if (validResult(value.official, key, 'official') && day.attemptId !== undefined) {
        day.official = { ...value.official };
      }
      if (validResult(value.practiceBest, key, 'practice')) {
        day.practiceBest = { ...value.practiceBest };
      }
      if (day.attemptId !== undefined || day.practiceBest) state.days[key] = day;
    }
    return state;
  } catch {
    // A corrupt or interrupted write must never prevent starting the game.
    return emptyState();
  }
}

function checkedResult(dateKey: string, kind: DailyRunKind, score: number, weeks: number, ticket: string): DailyResult {
  dateIndex(dateKey);
  const result: DailyResult = { dateKey, kind, score, weeks, ticket };
  if (!validResult(result, dateKey, kind)) throw new RangeError('Invalid daily result');
  return result;
}

function better(candidate: DailyResult, previous: DailyResult | null | undefined): boolean {
  return !previous || candidate.score > previous.score ||
    (candidate.score === previous.score && candidate.weeks > previous.weeks);
}

/** Storage injection makes the service testable and replaceable by task-16's platform storage. */
export class MemoryScoreStorage implements ScoreStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
}

function browserStorage(): ScoreStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}

export class LocalScoreService implements ScoreService {
  private storage: ScoreStorage | null;
  private readonly backup = new MemoryScoreStorage();

  constructor(storage: ScoreStorage | null = browserStorage()) {
    this.storage = storage;
  }

  private read(): StoreState {
    try { return decode((this.storage ?? this.backup).getItem(STORAGE_KEY)); }
    catch { this.storage = null; return decode(this.backup.getItem(STORAGE_KEY)); }
  }

  private write(state: StoreState): void {
    const content = JSON.stringify(state);
    this.backup.setItem(STORAGE_KEY, content);
    try { this.storage?.setItem(STORAGE_KEY, content); }
    catch { this.storage = null; }
  }

  reserveOfficial(dateKey: string): OfficialReservation | null {
    dateIndex(dateKey);
    const state = this.read();
    if (state.days[dateKey]?.attemptId !== undefined) return null;
    if (state.nextAttemptId >= Number.MAX_SAFE_INTEGER) throw new RangeError('Attempt counter exhausted');
    const attemptId = state.nextAttemptId++;
    state.days[dateKey] = { ...state.days[dateKey], attemptId };
    // Reserve BEFORE gameplay, so quitting or crashing still uses today's official attempt.
    this.write(state);
    return { dateKey, attemptId };
  }

  finishOfficial(reservation: OfficialReservation, score: number, weeks: number, ticket: string): DailyResult | null {
    const result = checkedResult(reservation.dateKey, 'official', score, weeks, ticket);
    const state = this.read();
    const day = state.days[reservation.dateKey];
    if (!day || day.attemptId !== reservation.attemptId || day.official) return null;
    day.official = result;
    this.write(state);
    return { ...result };
  }

  recordPractice(dateKey: string, score: number, weeks: number, ticket: string): DailyResult {
    const result = checkedResult(dateKey, 'practice', score, weeks, ticket);
    const state = this.read();
    const day = state.days[dateKey] ?? (state.days[dateKey] = {});
    if (better(result, day.practiceBest)) {
      day.practiceBest = result;
      this.write(state);
    }
    return { ...result };
  }

  getProgress(dateKey: string): DailyProgress {
    const today = dateIndex(dateKey);
    const state = this.read();
    const day = state.days[dateKey];
    let bestOfficial: DailyResult | null = null;
    const completed = new Set<number>();
    for (const [key, entry] of Object.entries(state.days)) {
      if (!entry.official) continue;
      completed.add(dateIndex(key));
      if (better(entry.official, bestOfficial)) bestOfficial = entry.official;
    }
    const ordered = [...completed].sort((a, b) => a - b);
    let longestStreak = 0;
    let run = 0;
    let previous: number | null = null;
    for (const dayIndex of ordered) {
      run = previous !== null && dayIndex === previous + 1 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = dayIndex;
    }
    let currentStreak = 0;
    let cursor = completed.has(today) ? today : today - 1;
    while (completed.has(cursor)) { currentStreak++; cursor--; }
    return {
      dateKey,
      officialUsed: day?.attemptId !== undefined,
      officialResult: day?.official ? { ...day.official } : null,
      practiceBest: day?.practiceBest ? { ...day.practiceBest } : null,
      bestOfficial: bestOfficial ? { ...bestOfficial } : null,
      currentStreak,
      longestStreak,
      persistent: this.storage !== null,
    };
  }
}

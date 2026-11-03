// [night-06] D-66 score submission: the client sends the command journal, the server replays it on the same
// deterministic Sim (D-13) and only the replayed score counts. Pure: shared by the client (shape, self-check)
// and the Cloud Function (authoritative check), and testable without Firebase.
import { dailySeedForKey } from '../core/daily.ts';
import { createGame, Sim, TICKS_PER_WEEK } from '../sim/index.ts';
import { RULES_VERSION } from '../sim/state.ts';

export const SUBMISSION_VERSION = 1 as const;
/** Server replay budget: 30 game weeks (D-40: 3-day weeks) — far beyond any run seen in balance tests. */
export const MAX_REPLAY_TICKS = 30 * TICKS_PER_WEEK;
export const MAX_JOURNAL_ENTRIES = 5_000;

export type JournalEntry = readonly [tick: number, command: Readonly<Record<string, unknown>>];

export interface DailySubmission {
  readonly v: typeof SUBMISSION_VERSION;
  readonly mode: 'daily';
  readonly dateKey: string;
  readonly seed: number;
  readonly rulesVersion: number;
  /** Tick of the game over (the run must have ended there). */
  readonly endTick: number;
  readonly claimedScore: number;
  readonly journal: readonly JournalEntry[];
}

export type RejectReason =
  | 'malformed' | 'old_rules' | 'wrong_seed' | 'wrong_day' | 'too_long' | 'not_finished' | 'score_mismatch' | 'replay_error';

export type Verdict =
  | { readonly ok: true; readonly score: number; readonly weeks: number; readonly hash: string }
  | { readonly ok: false; readonly reason: RejectReason };

/** Build the submission for a finished official daily run. */
export function buildDailySubmission(sim: Sim, dateKey: string): DailySubmission {
  return {
    v: SUBMISSION_VERSION, mode: 'daily', dateKey, seed: sim.seed, rulesVersion: RULES_VERSION,
    endTick: sim.tickCount, claimedScore: sim.world.score,
    journal: sim.getCommandLog() as unknown as JournalEntry[],
  };
}

const isUint = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;

/** Structural check of untrusted JSON; never throws. */
export function parseSubmission(value: unknown): DailySubmission | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (s.v !== SUBMISSION_VERSION || s.mode !== 'daily' || typeof s.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.dateKey)) return null;
  if (!isUint(s.seed, 0xffffffff) || !isUint(s.rulesVersion) || !isUint(s.endTick) || !isUint(s.claimedScore)) return null;
  if (!Array.isArray(s.journal) || s.journal.length > MAX_JOURNAL_ENTRIES) return null;
  let previous = 0;
  for (const entry of s.journal) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isUint(entry[0]) || entry[0] < 1 || entry[0] < previous) return null;
    if (!entry[1] || typeof entry[1] !== 'object' || Array.isArray(entry[1])) return null;
    previous = entry[0];
  }
  return s as unknown as DailySubmission;
}

/**
 * Authoritative replay. `allowedDays` are the Warsaw day keys the server accepts now (today, and
 * yesterday for runs finished just before midnight or sent from the offline queue).
 */
export function verifyDailySubmission(input: unknown, allowedDays: readonly string[]): Verdict {
  const submission = parseSubmission(input);
  if (!submission) return { ok: false, reason: 'malformed' };
  if (submission.rulesVersion !== RULES_VERSION) return { ok: false, reason: 'old_rules' };
  if (!allowedDays.includes(submission.dateKey)) return { ok: false, reason: 'wrong_day' };
  if (submission.seed !== dailySeedForKey(submission.dateKey)) return { ok: false, reason: 'wrong_seed' };
  if (submission.endTick > MAX_REPLAY_TICKS) return { ok: false, reason: 'too_long' };
  if (submission.journal.some(([tick]) => tick > submission.endTick)) return { ok: false, reason: 'malformed' };
  let sim: Sim;
  try {
    sim = Sim.replay(submission.seed, submission.journal as never, submission.endTick, { mode: 'daily' }, true);
  } catch {
    return { ok: false, reason: 'replay_error' };
  }
  if (sim.world.status !== 'over') return { ok: false, reason: 'not_finished' };
  // [night-12d] D-93: the run must end exactly at the claimed tick. The replay stops at the game over, so an
  // inflated endTick (or commands after the end) costs nothing and cannot inflate `weeks`.
  if (sim.tickCount !== submission.endTick) return { ok: false, reason: 'malformed' };
  if (sim.world.score !== submission.claimedScore) return { ok: false, reason: 'score_mismatch' };
  return { ok: true, score: sim.world.score, weeks: Math.floor(sim.tickCount / TICKS_PER_WEEK), hash: sim.hash() };
}

/** Same rules as the server, run locally before queueing (catches bugs, not cheats). */
export function selfCheck(submission: DailySubmission): Verdict {
  return verifyDailySubmission(submission, [submission.dateKey]);
}

/** Fresh daily Sim for a key (tests, server fixtures). */
export function dailyGame(dateKey: string): Sim { return createGame(dailySeedForKey(dateKey), 'daily'); }

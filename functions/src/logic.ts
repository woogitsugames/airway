// [night-06b] Pure server rules for D-66 leaderboards (no Firebase imports, unit-tested by test:net-server).
import { dailyKey } from '../../src/core/daily.ts';
import { boardsForDaily, parseBoardId } from '../../src/net/boards.ts';
import { verifyDailySubmission, type Verdict } from '../../src/net/submission.ts';

export const TOP_ENTRIES = 50;
/** [night-09a] D-77: Firestore TTL deletes a board entry this many days after its last write. */
export const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

/** [night-09a] D-77: the `expireAt` a board entry written at `nowMs` carries (the TTL policy field). */
export function expiresAt(nowMs: number): number {
  return nowMs + RETENTION_DAYS * DAY_MS;
}
/** Hard request cap before any parsing: a 30-week journal is far below this. */
export const MAX_REQUEST_BYTES = 512 * 1024;

/** Warsaw days a run may be filed under now: today, and yesterday for late finishes / the offline queue. */
export function allowedDays(nowMs: number): string[] {
  return [dailyKey(new Date(nowMs)), dailyKey(new Date(nowMs - DAY_MS))];
}

/** Public, non-identifying call sign from the anonymous uid (FNV-1a, 4 hex digits). */
export function callSign(uid: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) { hash ^= uid.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return `AW-${(hash & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export interface ReviewedRun {
  readonly verdict: Verdict;
  readonly daily?: string;
  readonly weekly?: string;
}

/** Size check, then the shared authoritative replay; returns the boards the run counts for. */
export function reviewSubmission(submission: unknown, nowMs: number): ReviewedRun {
  let bytes = 0;
  try { bytes = JSON.stringify(submission ?? null).length; } catch { return { verdict: { ok: false, reason: 'malformed' } }; }
  if (bytes > MAX_REQUEST_BYTES) return { verdict: { ok: false, reason: 'too_long' } };
  const verdict = verifyDailySubmission(submission, allowedDays(nowMs));
  if (!verdict.ok) return { verdict };
  const ids = boardsForDaily((submission as { dateKey: string }).dateKey);
  return { verdict, daily: ids.daily, weekly: ids.weekly };
}

export function validBoardId(id: unknown): id is string {
  return typeof id === 'string' && parseBoardId(id) !== null;
}

/** [night-12i] D-108: one row of a board's `meta/top` document (server-only; the uid never leaves the server). */
export interface TopEntry {
  readonly uid: string;
  readonly callSign: string;
  readonly score: number;
}

/**
 * [night-12i] D-108: the order of the old `orderBy('score', 'desc').limit(50)` query, which Firestore completes
 * with an implicit `__name__` order in the direction of the last explicit order: score desc, then doc id desc.
 */
export function compareTop(a: TopEntry, b: TopEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.uid < b.uid ? 1 : a.uid > b.uid ? -1 : 0;
}

/** [night-12i] D-108: the caller's 1-based place in a top list, or null outside it. */
export function rankInTop(top: readonly TopEntry[], uid: string): number | null {
  const index = top.findIndex((entry) => entry.uid === uid);
  return index < 0 ? null : index + 1;
}

/**
 * [night-12i] D-108: `top` with `entry` put in its place (replacing the same uid), sorted and cut to `limit`.
 * Returns null when the list would not change (a score that does not beat the last place of a full list), so
 * the caller skips the write.
 */
export function mergeTop(top: readonly TopEntry[], entry: TopEntry, limit = TOP_ENTRIES): TopEntry[] | null {
  const next = [...top.filter((row) => row.uid !== entry.uid), entry].sort(compareTop).slice(0, limit);
  const same = next.length === top.length && next.every((row, i) =>
    row.uid === top[i].uid && row.score === top[i].score && row.callSign === top[i].callSign);
  return same ? null : next;
}

/** [night-12i] D-108: rows read back from a stored top document; anything malformed is dropped, order restored. */
export function readTopRows(raw: unknown): TopEntry[] {
  if (!Array.isArray(raw)) return [];
  const rows: TopEntry[] = [];
  for (const item of raw) {
    const row = item as Partial<TopEntry> | null;
    if (row && typeof row.uid === 'string' && typeof row.callSign === 'string' && Number.isFinite(row.score)) {
      rows.push({ uid: row.uid, callSign: row.callSign, score: Number(row.score) });
    }
  }
  return rows.sort(compareTop).slice(0, TOP_ENTRIES);
}

// [night-06b] Pure server rules for D-66 leaderboards (no Firebase imports, unit-tested by test:net-server).
import { dailyKey } from '../../src/core/daily.ts';
import { boardsForDaily, parseBoardId } from '../../src/net/boards.ts';
import { verifyDailySubmission, type Verdict } from '../../src/net/submission.ts';

export const TOP_ENTRIES = 50;
/** Hard request cap before any parsing: a 30-week journal is far below this. */
export const MAX_REQUEST_BYTES = 512 * 1024;

/** Warsaw days a run may be filed under now: today, and yesterday for late finishes / the offline queue. */
export function allowedDays(nowMs: number): string[] {
  return [dailyKey(new Date(nowMs)), dailyKey(new Date(nowMs - 86_400_000))];
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

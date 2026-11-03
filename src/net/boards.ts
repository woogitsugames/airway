// [night-06] D-66 leaderboard identities. Daily boards follow the Warsaw calendar day of the daily seed
// (src/core/daily.ts); weekly boards are the ISO week of that same Warsaw day.
import { dailyKey, isoWeekKey } from '../core/daily.ts';

export type BoardKind = 'daily' | 'weekly';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;

export function dailyBoardId(dateKey: string): string {
  if (!DATE_KEY.test(dateKey)) throw new RangeError('daily key must be YYYY-MM-DD');
  return `d-${dateKey}`;
}

/** ISO week (Warsaw calendar) that a daily key belongs to. Noon UTC is the same Warsaw day all year. */
export function weekKeyForDate(dateKey: string): string {
  if (!DATE_KEY.test(dateKey)) throw new RangeError('daily key must be YYYY-MM-DD');
  return isoWeekKey(new Date(`${dateKey}T12:00:00Z`));
}

export function weeklyBoardId(weekKey: string): string {
  if (!WEEK_KEY.test(weekKey)) throw new RangeError('week key must be YYYY-Www');
  return `w-${weekKey}`;
}

export function parseBoardId(id: string): { kind: BoardKind; key: string } | null {
  if (/^d-\d{4}-\d{2}-\d{2}$/.test(id)) return { kind: 'daily', key: id.slice(2) };
  if (/^w-\d{4}-W\d{2}$/.test(id)) return { kind: 'weekly', key: id.slice(2) };
  return null;
}

/** Board ids that today's official daily run counts towards. */
export function boardsForDaily(dateKey: string): { daily: string; weekly: string } {
  return { daily: dailyBoardId(dateKey), weekly: weeklyBoardId(weekKeyForDate(dateKey)) };
}

/** Today's Warsaw key (re-exported so callers never use the device time zone). */
export function todayKey(now: Date = new Date()): string { return dailyKey(now); }

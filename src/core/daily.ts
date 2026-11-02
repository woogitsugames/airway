import { seedFromString } from './rng.ts';

const WARSAW = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Warsaw', calendar: 'gregory',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Calendar date in Warsaw: YYYY-MM-DD, unaffected by the device time zone. */
export function dailyKey(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('invalid date');
  const fields = WARSAW.formatToParts(date);
  const year = fields.find((part) => part.type === 'year')?.value;
  const month = fields.find((part) => part.type === 'month')?.value;
  const day = fields.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Warsaw calendar date unavailable');
  return `${year.padStart(4, '0')}-${month}-${day}`;
}

/** Stable daily challenge seed; no RNG state or local time is consulted. */
export function dailySeed(date: Date = new Date()): number {
  return seedFromString(`airway/daily/v1/${dailyKey(date)}`);
}

/** ISO week of the WARSAW calendar day: ISO week-year and W01..W53. */
export function isoWeekKey(date: Date = new Date()): string {
  const [year, month, day] = dailyKey(date).split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = (utc.getUTCDay() + 6) % 7; // Monday=0.
  utc.setUTCDate(utc.getUTCDate() + 3 - weekday); // Thursday decides ISO year.
  const isoYear = utc.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - firstWeekday);
  const week = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

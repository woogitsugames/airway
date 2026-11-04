// [night-11af] R4c: fill trend chevron on the passenger tag. Once per game hour (the same boundary and the same
// `CueRun` view as the audio drone readings in audioCues.ts) the game layer notes how many passengers wait at each
// airport; the difference between the last two readings is that hour's balance (arrivals minus departures).
// Presentation only: reads the run, never writes it, nothing goes into the sim or its hash (D-13).
import { gameHour, type CueRun } from './audioCues';

export type FillTrend = 'filling' | 'emptying' | null;

/** The chevron appears only from this share of the waiting places taken (a calm airport needs no forecast). */
export const TREND_MIN_FILL = 0.5;
/** A balance within ±this many passengers is steady: no chevron. */
export const TREND_STEADY = 1;

/**
 * The trend rule: `waiting`/`capacity` are live, `balance` is the last game hour's change in waiting passengers
 * (null while fewer than two consecutive hourly readings exist). Below half full, or steady ±1, there is no chevron.
 */
export function fillTrend(waiting: number, capacity: number, balance: number | null): FillTrend {
  if (balance === null || capacity <= 0 || waiting < capacity * TREND_MIN_FILL) return null;
  if (balance > TREND_STEADY) return 'filling';
  if (balance < -TREND_STEADY) return 'emptying';
  return null;
}

/** Hourly waiting counts per airport; keeps only the last two readings. */
export class FillReadings {
  private hour = -1;
  private previous = new Map<string, number>();
  private latest = new Map<string, number>();

  /** Take a reading on a new game hour; true when one was taken. A jump (undo, restore) starts the history over. */
  hourly(run: Pick<CueRun, 'clockMinute' | 'cityList'>): boolean {
    const hour = gameHour(run.clockMinute);
    if (hour === this.hour) return false;
    const consecutive = hour === this.hour + 1 && this.hour >= 0;
    const swap = this.previous;
    this.previous = this.latest;
    this.latest = swap;
    this.latest.clear();
    if (!consecutive) this.previous.clear();
    this.hour = hour;
    for (const city of run.cityList()) this.latest.set(city.id, city.waiting.length);
    return true;
  }

  /** The last game hour's balance at an airport, or null without two consecutive readings of it. */
  balance(id: string): number | null {
    const now = this.latest.get(id);
    const before = this.previous.get(id);
    return now === undefined || before === undefined ? null : now - before;
  }

  trend(id: string, waiting: number, capacity: number): FillTrend {
    return fillTrend(waiting, capacity, this.balance(id));
  }
}

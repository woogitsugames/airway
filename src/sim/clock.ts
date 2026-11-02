import { SIM_DAYS_PER_WEEK, SIM_MINUTES_PER_DAY, SIM_MINUTES_PER_WEEK } from './params.ts';

/** Simulation time is counted exclusively in integer game-minute ticks. */
export const TICKS_PER_DAY: number = SIM_MINUTES_PER_DAY;
// [task-31] Re-exports of the single week length in params.ts (D-40); never redefine it here.
export const DAYS_PER_WEEK: number = SIM_DAYS_PER_WEEK;
export const TICKS_PER_WEEK: number = SIM_MINUTES_PER_WEEK;
export const TICKS_PER_SECOND_1X = 10;
export type SimSpeed = 0 | 1 | 2 | 4;

export interface ClockTime {
  readonly tick: number;
  readonly week: number;       // Starts at 1.
  readonly dayOfWeek: number;  // Starts at 1.
  readonly day: number;        // Total days elapsed, starts at 0.
  readonly hour: number;
  readonly minute: number;
  readonly minuteOfDay: number;
}

export function isSimSpeed(value: unknown): value is SimSpeed {
  return value === 0 || value === 1 || value === 2 || value === 4;
}

export function ticksPerSecond(speed: SimSpeed): number {
  if (!isSimSpeed(speed)) throw new RangeError('invalid simulation speed');
  return speed * TICKS_PER_SECOND_1X;
}

export function clockAt(tick: number): ClockTime {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('tick must be a nonnegative safe integer');
  }
  const day = Math.floor(tick / TICKS_PER_DAY);
  const minuteOfDay = tick % TICKS_PER_DAY;
  return {
    tick,
    week: Math.floor(day / DAYS_PER_WEEK) + 1,
    dayOfWeek: (day % DAYS_PER_WEEK) + 1,
    day,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    minuteOfDay,
  };
}

/**
 * [task-31] The calendar shown to the player (boarding pass). Weeks are one-based; at an exact week boundary
 * (the weekly board is open) it still shows the week just finished, with its last day, so the day bar is full.
 * Two scalar functions so the per-frame HUD path allocates nothing.
 */
export function calendarWeekAt(minute: number): number {
  if (!Number.isSafeInteger(minute) || minute < 0) throw new RangeError('minute must be a nonnegative safe integer');
  return Math.max(1, Math.ceil(minute / TICKS_PER_WEEK));
}
export function calendarDayAt(minute: number): number {
  const week = calendarWeekAt(minute);
  return Math.min(DAYS_PER_WEEK, Math.floor((minute - (week - 1) * TICKS_PER_WEEK) / TICKS_PER_DAY) + 1);
}

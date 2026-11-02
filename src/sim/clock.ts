/** Simulation time is counted exclusively in integer game-minute ticks. */
export const TICKS_PER_DAY = 1_440;
export const DAYS_PER_WEEK = 7;
export const TICKS_PER_WEEK = TICKS_PER_DAY * DAYS_PER_WEEK;
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

/**
 * [night-12bb] R2i, D-249: the announced demand surge (Endless runs whose GameConfig carries `demandSurge`).
 *
 * From the week-2 board on, each weekly board picks one open airport that has a route and a local start hour. A
 * game day before the window the airport announces the surge; during the window (SURGE_DURATION_MINUTES, on the
 * airport's local clock) it generates SURGE_DEMAND_PERCENT of its usual demand. The pick and the destinations of
 * the extra passengers come from `new Rng(seed).fork('surge/<week>')`, whose state is kept in the snapshot: no
 * kernel RNG stream moves, so a run plays exactly as without surges until the first surge window opens.
 * Pure: no clock, no transcendentals (D-13). The world (world.ts) owns the state and calls these functions.
 */
import { Rng } from '../core/rng.ts';
import { localMinuteOfDay } from './daynight.ts';
import {
  SIM_MINUTES_PER_DAY, SIM_MINUTES_PER_WEEK, SURGE_DURATION_MINUTES, SURGE_EXTRA_PASSENGERS, SURGE_FIRST_BOARD_WEEK,
  SURGE_NOTICE_MINUTES, SURGE_START_LOCAL_HOURS,
} from './params.ts';

export interface DemandSurge {
  /** Board week that drew the surge; its window lies in week `week + 1`. */
  readonly week: number;
  readonly cityId: string;
  /** Local hour (airport clock) at which the window opens. */
  readonly startLocalHour: number;
  /** First minute the airport shows the announcement (one game day before the window). */
  readonly announceTick: number;
  /** Window [startTick, endTick) in game minutes. */
  readonly startTick: number;
  readonly endTick: number;
  /** Extra passengers the window sends (on top of the usual demand). */
  readonly passengers: number;
}
export interface SurgeRecord extends DemandSurge {
  /** Extra passengers the surge actually created (fewer when the run ended inside the window). */
  readonly extra: number;
}
/** Serialized in the world snapshot (only in runs with the demand surge). */
export interface SurgeSnapshot {
  readonly current: DemandSurge | null;
  readonly announced: boolean;
  /** State of the surge's RNG fork (destinations of the extra passengers). */
  readonly rngState: number;
  /** Extra passengers of the current surge so far. */
  readonly extra: number;
  readonly history: readonly SurgeRecord[];
}
export interface SurgeCandidate { readonly cityId: string; readonly utcOffsetH: number }
export type SurgePhase = 'hidden' | 'announced' | 'active' | 'over';

export const EMPTY_SURGES: SurgeSnapshot = Object.freeze({
  current: null, announced: false, rngState: 0, extra: 0, history: Object.freeze([]) as readonly SurgeRecord[],
});

/**
 * Draw the surge at the board that ends week `week` (game minute `boardTick`): one candidate uniformly (by city id
 * order) and one start hour, from `new Rng(seed).fork('surge/<week>')`. The window opens on the first such local
 * hour at least SURGE_NOTICE_MINUTES after the board, so the announcement (a notice period before it) never falls
 * before the board. Null before SURGE_FIRST_BOARD_WEEK or without a candidate. `rngState` continues the same fork
 * for the destinations of the extra passengers.
 */
export function drawSurge(seed: number, week: number, boardTick: number, candidates: readonly SurgeCandidate[]):
    { surge: DemandSurge; rngState: number } | null {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('Invalid week');
  if (!Number.isSafeInteger(boardTick) || boardTick < 0) throw new RangeError('Invalid board tick');
  if (week < SURGE_FIRST_BOARD_WEEK || candidates.length === 0) return null;
  const pool = [...candidates].sort((a, b) => (a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0));
  const rng = new Rng(seed >>> 0).fork(`surge/${week}`);
  const city = pool[rng.int(pool.length)]!;
  const startLocalHour = SURGE_START_LOCAL_HOURS[rng.int(SURGE_START_LOCAL_HOURS.length)]!;
  const earliest = boardTick + SURGE_NOTICE_MINUTES;
  const local = localMinuteOfDay(earliest, city.utcOffsetH);
  const startTick = earliest + (startLocalHour * 60 - local + SIM_MINUTES_PER_DAY) % SIM_MINUTES_PER_DAY;
  return {
    surge: {
      week, cityId: city.cityId, startLocalHour, announceTick: startTick - SURGE_NOTICE_MINUTES,
      startTick, endTick: startTick + SURGE_DURATION_MINUTES, passengers: SURGE_EXTRA_PASSENGERS,
    },
    rngState: rng.state,
  };
}

/** Does the window send an extra passenger at this minute? Evenly spaced from the window's first minute. */
export function surgePassengerDue(surge: DemandSurge, tick: number): boolean {
  if (tick < surge.startTick || tick >= surge.endTick) return false;
  const every = Math.floor((surge.endTick - surge.startTick) / surge.passengers);
  const k = tick - surge.startTick;
  return k % every === 0 && k / every < surge.passengers;
}

export function surgePhase(surge: DemandSurge, tick: number): SurgePhase {
  if (tick < surge.announceTick) return 'hidden';
  if (tick < surge.startTick) return 'announced';
  return tick < surge.endTick ? 'active' : 'over';
}

/** Close the running surge at a board: record it with its extra passengers. */
export function closeSurge(state: SurgeSnapshot): SurgeSnapshot {
  if (!state.current) return state;
  return { ...EMPTY_SURGES, history: [...state.history, { ...state.current, extra: state.extra }] };
}

export function validSurgeSnapshot(value: unknown, knownCity: (id: string) => boolean): value is SurgeSnapshot {
  const count = (n: unknown): boolean => Number.isSafeInteger(n) && (n as number) >= 0;
  const surge = (s: unknown): boolean => {
    if (!s || typeof s !== 'object') return false;
    const v = s as Record<string, unknown>;
    return count(v.week) && (v.week as number) >= SURGE_FIRST_BOARD_WEEK && typeof v.cityId === 'string' && knownCity(v.cityId) &&
      SURGE_START_LOCAL_HOURS.includes(v.startLocalHour as number) && count(v.announceTick) && count(v.startTick) &&
      count(v.endTick) && v.startTick === (v.announceTick as number) + SURGE_NOTICE_MINUTES &&
      (v.endTick as number) > (v.startTick as number) && (v.endTick as number) - (v.startTick as number) <= SIM_MINUTES_PER_WEEK &&
      count(v.passengers) && (v.passengers as number) >= 1 && (v.passengers as number) <= (v.endTick as number) - (v.startTick as number);
  };
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.current === null || surge(v.current)) && typeof v.announced === 'boolean' && (v.current !== null || !v.announced) &&
    count(v.rngState) && (v.rngState as number) <= 0xffff_ffff && count(v.extra) &&
    Array.isArray(v.history) && v.history.every((h) => surge(h) && count((h as Record<string, unknown>).extra));
}

/** Authoritative, integer-only local time, demand waves and curfew rules. */
import {
  CURFEW_ADDITIONAL_CITY_EVERY_WEEKS, CURFEW_END_HOUR, CURFEW_ENDLESS_START_WEEK,
  CURFEW_MAX_CITY_COUNT, CURFEW_START_CITY_COUNT, CURFEW_START_HOUR,
  DAYNIGHT_MINUTES_PER_DAY, DAYNIGHT_MINUTES_PER_WEEK, DEMAND_HOURLY_WEIGHTS, MORNING_START_LOCAL_HOUR,
} from './params.ts';

export type DayNightMode = 'endless' | 'puzzle';
export interface DayNightCity {
  readonly cityId: string;
  readonly utcOffsetH: number;
}
/** Connect to task 02's Rng root; fork() has no effect on other RNG streams. */
export interface CurfewRngRoot {
  fork(label: string): { int(maxExclusive: number): number };
}
export interface CurfewAnnouncement {
  readonly week: number;
  readonly firstTick: number;
  readonly cityIds: readonly string[];
}
export interface CurfewSnapshot {
  readonly week: number;
  readonly lastAnnouncedWeek: number;
  readonly selectedCityIds: readonly string[];
  readonly activeCityIds: readonly string[];
  readonly selectionCityIds: readonly string[];
}

function validTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Game tick must be a nonnegative safe integer');
  }
}
function validOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < -12 || offset > 12) {
    throw new RangeError('utcOffsetH must be an integer in [-12, 12]');
  }
}
function validWeek(week: number): void {
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new RangeError('Week must be a positive safe integer');
  }
}

export function weekAtTick(tick: number): number {
  validTick(tick);
  return Math.floor(tick / DAYNIGHT_MINUTES_PER_WEEK) + 1;
}

/** Positive modulo prevents negative local clock readings west of Greenwich. */
export function localMinuteOfDay(tick: number, utcOffsetH: number): number {
  validTick(tick);
  validOffset(utcOffsetH);
  return ((tick % DAYNIGHT_MINUTES_PER_DAY) + utcOffsetH * 60 +
    DAYNIGHT_MINUTES_PER_DAY) % DAYNIGHT_MINUTES_PER_DAY;
}
/**
 * [night-86a] D-343 (P-3): the UTC minute of day at game minute 0 of a morning-start run, so that the clock airport
 * (UTC offset `utcOffsetH`) reads MORNING_START_LOCAL_HOUR:00. A whole number of hours in [0, 1440). Every local
 * reading of such a run adds it to the game minute ("clock shift"); weeks and days keep counting game minutes.
 */
export function morningStartShift(utcOffsetH: number): number {
  validOffset(utcOffsetH);
  return (((MORNING_START_LOCAL_HOUR - utcOffsetH) % 24 + 24) % 24) * 60;
}
export function localHourAt(tick: number, utcOffsetH: number): number {
  return Math.floor(localMinuteOfDay(tick, utcOffsetH) / 60);
}
export function hourlyDemandWeight(tick: number, utcOffsetH: number): number {
  return DEMAND_HOURLY_WEIGHTS[localHourAt(tick, utcOffsetH)];
}
export function isLocalCurfewHour(tick: number, utcOffsetH: number): boolean {
  const hour = localHourAt(tick, utcOffsetH);
  return hour >= CURFEW_START_HOUR || hour < CURFEW_END_HOUR;
}

function sortedUniqueIds(ids: readonly string[], known?: ReadonlySet<string>): string[] {
  if (new Set(ids).size !== ids.length || ids.some((id) => !id || (known && !known.has(id)))) {
    throw new RangeError('City IDs must be distinct, nonempty and known');
  }
  return [...ids].sort();
}

/** [night-12bc] R2h, D-251: the Endless curfew knobs a licence class may change (class I = the shared constants). */
export interface EndlessCurfewRules {
  readonly startWeek: number;
  readonly startCities: number;
}
export const ENDLESS_CURFEW_RULES: EndlessCurfewRules = Object.freeze({
  startWeek: CURFEW_ENDLESS_START_WEEK, startCities: CURFEW_START_CITY_COUNT,
});

/** Week-specific seeded shuffle: independent of other events and call order. */
export function selectEndlessCurfewCities(
  week: number, activeCityIds: readonly string[], rngRoot: CurfewRngRoot,
  rules: EndlessCurfewRules = ENDLESS_CURFEW_RULES,
): readonly string[] {
  validWeek(week);
  if (week < rules.startWeek) return [];
  const pool = sortedUniqueIds(activeCityIds);
  const count = Math.min(pool.length, CURFEW_MAX_CITY_COUNT,
    rules.startCities + Math.floor((week - rules.startWeek) /
      CURFEW_ADDITIONAL_CITY_EVERY_WEEKS));
  const rng = rngRoot.fork(`daynight/curfew/week/${week}`);
  for (let i = 0; i < count; i++) {
    const j = i + rng.int(pool.length - i);
    if (!Number.isSafeInteger(j) || j < i || j >= pool.length) {
      throw new RangeError('Curfew RNG returned an invalid index');
    }
    const swapped = pool[i];
    pool[i] = pool[j];
    pool[j] = swapped;
  }
  return Object.freeze(pool.slice(0, count).sort());
}

/** Stores only week inputs and the announcement cursor; no wall-clock dependencies. */
export class CurfewPlanner {
  private readonly offsets = new Map<string, number>();
  private readonly puzzleIds: readonly string[];
  private activeIds: readonly string[];
  private selectionCityIds: readonly string[] = Object.freeze([]);
  private selectedIds: readonly string[] = Object.freeze([]);
  private selectedSet: ReadonlySet<string> = new Set();
  private currentWeek = 0;
  private lastAnnouncedWeek = 0;
  /** [night-86a] D-343: minutes added to a game minute before reading a local hour (0 = UTC midnight start). */
  private shift = 0;

  constructor(
    private readonly mode: DayNightMode,
    cities: readonly DayNightCity[],
    private readonly root: CurfewRngRoot,
    puzzleCurfewCityIds: readonly string[] = [],
    private readonly endlessRules: EndlessCurfewRules = ENDLESS_CURFEW_RULES,
  ) {
    if (mode !== 'endless' && mode !== 'puzzle') throw new RangeError('Unknown day/night mode');
    for (const city of cities) {
      if (!city.cityId || this.offsets.has(city.cityId)) throw new RangeError('Duplicate city ID');
      validOffset(city.utcOffsetH);
      this.offsets.set(city.cityId, city.utcOffsetH);
    }
    this.activeIds = Object.freeze([...this.offsets.keys()].sort());
    this.puzzleIds = Object.freeze(sortedUniqueIds(puzzleCurfewCityIds, new Set(this.offsets.keys())));
  }

  /** [night-86a] D-343: the run's clock shift (`morningStartShift`); set once, before the first check. */
  setClockShift(minutes: number): void {
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes >= DAYNIGHT_MINUTES_PER_DAY) {
      throw new RangeError('Clock shift must be a minute of the day');
    }
    this.shift = minutes;
  }

  /** Call before a week boundary; task 05's spawner supplies currently active city IDs. */
  setActiveCities(cityIds: readonly string[]): void {
    this.activeIds = Object.freeze(sortedUniqueIds(cityIds, new Set(this.offsets.keys())));
  }

  /** Idempotent; a notice is emitted once per week, including the week 4 transition. */
  advance(tick: number): CurfewAnnouncement | null {
    const week = weekAtTick(tick);
    if (week !== this.currentWeek) {
      this.currentWeek = week;
      this.selectionCityIds = this.activeIds;
      this.selectedIds = this.mode === 'puzzle'
        ? this.puzzleIds
        : selectEndlessCurfewCities(week, this.selectionCityIds, this.root, this.endlessRules);
      this.selectedSet = new Set(this.selectedIds);
    }
    if (this.selectedIds.length === 0 || this.lastAnnouncedWeek === week) return null;
    this.lastAnnouncedWeek = week;
    return {
      week, firstTick: (week - 1) * DAYNIGHT_MINUTES_PER_WEEK,
      cityIds: [...this.selectedIds],
    };
  }

  get curfewCityIds(): readonly string[] { return this.selectedIds; }
  get week(): number { return this.currentWeek; }

  /** The caller advances the planner before examining curfew at this tick. */
  isClosed(cityId: string, tick: number): boolean {
    const offset = this.offsets.get(cityId);
    if (offset === undefined) throw new RangeError(`Unknown city: ${cityId}`);
    if (weekAtTick(tick) !== this.currentWeek) {
      throw new RangeError('Advance the curfew planner to this tick first');
    }
    return this.selectedSet.has(cityId) && isLocalCurfewHour(tick + this.shift, offset);
  }
  canDepart(cityId: string, tick: number): boolean { return !this.isClosed(cityId, tick); }
  canLand(cityId: string, tick: number): boolean { return !this.isClosed(cityId, tick); }

  /** Check the planned departure and arrival. Re-check arrival on the actual landing tick. */
  canScheduleLeg(fromId: string, toId: string, departureTick: number, durationTicks: number): boolean {
    if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0 ||
        !Number.isSafeInteger(departureTick + durationTicks)) {
      throw new RangeError('Flight duration must be a positive safe integer');
    }
    if (!this.offsets.has(toId)) throw new RangeError(`Unknown city: ${toId}`);
    if (!this.canDepart(fromId, departureTick)) return false;
    const arrivalTick = departureTick + durationTicks;
    if (weekAtTick(arrivalTick) !== this.currentWeek) {
      // Puzzle levels have stable curfew cities across week boundaries.
      if (this.mode === 'puzzle') {
        return !this.selectedSet.has(toId) ||
          !isLocalCurfewHour(arrivalTick + this.shift, this.offsets.get(toId)!);
      }
      // Endless city selection may change next week; re-check when landing.
      return true;
    }
    return this.canLand(toId, arrivalTick);
  }

  snapshot(): CurfewSnapshot {
    return {
      week: this.currentWeek, lastAnnouncedWeek: this.lastAnnouncedWeek,
      selectedCityIds: [...this.selectedIds], activeCityIds: [...this.activeIds],
      selectionCityIds: [...this.selectionCityIds],
    };
  }
  restore(saved: CurfewSnapshot): void {
    if (!saved || !Number.isSafeInteger(saved.week) || saved.week < 0 ||
        !Number.isSafeInteger(saved.lastAnnouncedWeek) || saved.lastAnnouncedWeek < 0 ||
        saved.lastAnnouncedWeek > saved.week || !Array.isArray(saved.selectedCityIds) ||
        !Array.isArray(saved.activeCityIds) ||
        !Array.isArray(saved.selectionCityIds)) throw new RangeError('Invalid curfew snapshot');
    const known = new Set(this.offsets.keys());
    const active = sortedUniqueIds(saved.activeCityIds, known);
    const selected = sortedUniqueIds(saved.selectedCityIds, known);
    const selectedFrom = sortedUniqueIds(saved.selectionCityIds, known);
    if (saved.week === 0 && selectedFrom.length > 0) {
      throw new RangeError('No selection exists before the first week');
    }
    if (selected.some((id) => this.mode === 'endless' && !selectedFrom.includes(id))) {
      throw new RangeError('Curfew city must have been active at the weekly boundary');
    }
    const expected = saved.week === 0 ? [] : this.mode === 'puzzle'
      ? this.puzzleIds : selectEndlessCurfewCities(saved.week, selectedFrom, this.root, this.endlessRules);
    if (selected.length !== expected.length || selected.some((id, i) => id !== expected[i])) {
      throw new RangeError('Curfew snapshot does not match its seed and mode');
    }
    this.activeIds = Object.freeze(active);
    this.selectionCityIds = Object.freeze(selectedFrom);
    this.currentWeek = saved.week;
    this.lastAnnouncedWeek = saved.lastAnnouncedWeek;
    this.selectedIds = Object.freeze(selected);
    this.selectedSet = new Set(selected);
  }
}

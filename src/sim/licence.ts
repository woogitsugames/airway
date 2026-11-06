// [night-12bc] R2h, D-251: Endless licence classes (difficulty tiers). Every class is a set of scenario knobs on the
// shared Endless rules, kept here as data in one place; class I is the shared scenario itself (no knob differs, so
// its state, hashes and replays are the pre-R2h ones). Daily and puzzles never carry a class.
import {
  CURFEW_ENDLESS_START_WEEK, CURFEW_START_CITY_COUNT, HUB_WAITING_CAPACITY, INITIAL_PLANE_RESERVE,
} from './params.ts';

export type LicenceClass = 1 | 2 | 3;
/** The classes in order; a run's GameConfig names only a class above I (`licenceClass: 2 | 3`). */
export const LICENCE_CLASSES: readonly LicenceClass[] = Object.freeze([1, 2, 3]);
/** Bump when a class's knobs change (balance reports and the decision log quote it). */
export const LICENCE_PARAMS_VERSION = 1 as const;
/**
 * A class opens once a run of the class below it reached this calendar week (week 4 = three weeks flown,
 * the logbook's "weeks" unit + 1). Unlocks are stored on the device only (src/game/licence.ts).
 * D-273 (owner, Q-84 → B): week 4, in line with the week-4 milestone (D-270); D-251 had week 5.
 */
export const LICENCE_UNLOCK_WEEK = 4 as const;

/** The scenario knobs a licence class sets. Nothing else differs between classes. */
export interface LicenceParams {
  /** Calendar week in which the weekly curfew selection starts (D-151: week 3). */
  readonly curfewStartWeek: number;
  /** Curfew airports in the first curfew week (later weeks add one every two weeks as before, D-17). */
  readonly curfewStartCities: number;
  /** Turboprops in the starting reserve (task 22: 4). */
  readonly turbopropReserve: number;
  /** Waiting seats of an interchange hub before upgrades (task 31: 36). */
  readonly hubCapacity: number;
}

export const LICENCE_PARAMS: Readonly<Record<LicenceClass, LicenceParams>> = Object.freeze({
  // Class I = today's Endless (and Daily): the shared constants.
  1: Object.freeze({ curfewStartWeek: CURFEW_ENDLESS_START_WEEK, curfewStartCities: CURFEW_START_CITY_COUNT,
    turbopropReserve: INITIAL_PLANE_RESERVE.turboprop, hubCapacity: HUB_WAITING_CAPACITY }),
  // Class II: curfew from week 2, a starting reserve of 3 turboprops.
  2: Object.freeze({ curfewStartWeek: 2, curfewStartCities: CURFEW_START_CITY_COUNT,
    turbopropReserve: 3, hubCapacity: HUB_WAITING_CAPACITY }),
  // Class III: class II plus hub capacity -6 and two more curfew airports.
  3: Object.freeze({ curfewStartWeek: 2, curfewStartCities: CURFEW_START_CITY_COUNT + 2,
    turbopropReserve: 3, hubCapacity: HUB_WAITING_CAPACITY - 6 }),
});

export function isLicenceClass(value: unknown): value is LicenceClass {
  return value === 1 || value === 2 || value === 3;
}

// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

// [task-11] One game tick is one UTC minute; day/night balance is versioned.
export const DAYNIGHT_PARAMS_VERSION = 1 as const;
export const DAYNIGHT_MINUTES_PER_DAY = 1_440 as const;
export const DAYNIGHT_DAYS_PER_WEEK = 7 as const;
export const DAYNIGHT_MINUTES_PER_WEEK = DAYNIGHT_MINUTES_PER_DAY * DAYNIGHT_DAYS_PER_WEEK;
// Keep these numbers identical to task 08's demand profile when merging the branches.
// Local 06:00 dawn is deliberately stronger than local 02:00 night.
export const DEMAND_HOURLY_WEIGHTS = [
  18, 15, 15, 18, 35, 90, 205, 190, 145, 110, 95, 90,
  85, 90, 105, 125, 145, 150, 125, 100, 70, 50, 35, 25,
] as const;
export const CURFEW_START_HOUR = 23 as const;
export const CURFEW_END_HOUR = 6 as const;
export const CURFEW_ENDLESS_START_WEEK = 4 as const;
export const CURFEW_START_CITY_COUNT = 2 as const;
export const CURFEW_ADDITIONAL_CITY_EVERY_WEEKS = 2 as const;
export const CURFEW_MAX_CITY_COUNT = 8 as const;

// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

// [task-05] City spawner (1 simulation tick = 1 game minute, task 01 architecture).
export const SPAWNER_PARAMS_VERSION = 1 as const;
export const GAME_TICKS_PER_HOUR = 60 as const;
export const SPAWNER_INTERVAL_HOURS = 4 as const;
export const SPAWNER_INTERVAL_TICKS = SPAWNER_INTERVAL_HOURS * GAME_TICKS_PER_HOUR;
export const SPAWNER_START_CITY_MIN = 3 as const;
export const SPAWNER_START_CITY_MAX = 4 as const;
export const SPAWNER_START_RADIUS_KM = 3000 as const;
export const SPAWNER_MAX_CITIES = 40 as const;
// A rounded integer great-circle distance >= 668 km guarantees >= 6.0 degrees
// for Earth radius 6371 km (6 degrees ~= 667.17 km), even after rounding.
export const SPAWNER_MIN_CITY_DISTANCE_KM = 668 as const;

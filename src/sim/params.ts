// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

// [task-05] City spawner (1 simulation tick = 1 game minute, task 01 architecture).
export const SPAWNER_PARAMS_VERSION = 1 as const;
export const GAME_TICKS_PER_HOUR = 60 as const;
export const SPAWNER_INTERVAL_HOURS = 12 as const;
export const SPAWNER_INTERVAL_TICKS = SPAWNER_INTERVAL_HOURS * GAME_TICKS_PER_HOUR;
export const SPAWNER_START_CITY_MIN = 3 as const;
export const SPAWNER_START_CITY_MAX = 4 as const;
export const SPAWNER_START_RADIUS_KM = 3000 as const;
export const SPAWNER_MAX_CITIES = 40 as const;
// A rounded integer great-circle distance >= 668 km guarantees >= 6.0 degrees
// for Earth radius 6371 km (6 degrees ~= 667.17 km), even after rounding.
export const SPAWNER_MIN_CITY_DISTANCE_KM = 668 as const;
// [task-08] Passenger-network simulation parameters. One tick is one game minute.
export const PASSENGER_SIM_VERSION = 1 as const;
export const SIM_MINUTES_PER_DAY = 1_440 as const;
export const SIM_DAYS_PER_WEEK = 7 as const;
export const DEMAND_PASSENGERS_PER_MILLION_PER_DAY = 1 as const;
// Dawn is intentionally strongest; this 24-element integer profile is in local time.
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
export const HUB_WAITING_CAPACITY = 30 as const;
export const CITY_WAITING_CAPACITY = 20 as const;
// [task-12] One hub upgrade: +6 seats and a 15-minute minimum connection time.
export const HUB_CAPACITY_UPGRADE = 6 as const;
export const MIN_TRANSFER_TICKS = 25 as const;
export const UPGRADED_TRANSFER_TICKS = 15 as const;
// At 1x the player has 45 real seconds (10 ticks per real second) to clear a jam.
export const CONGESTION_GRACE_TICKS = 45 * SIM_TICKS_PER_SECOND;
export const WAIT_TOO_LONG_TICKS = 360 as const;
// [task-09] Planes: integer kilometres and whole simulation minutes (ticks).
export const PLANE_TYPES = {
  turboprop: { rangeKm: 2500, seats: 48, speedKmPerTick: 8 },
  widebody: { rangeKm: 11000, seats: 300, speedKmPerTick: 14 },
} as const;
export type PlaneType = keyof typeof PLANE_TYPES;
export const MIN_AIRPORT_SERVICE_TICKS = 25 as const;
export const MAX_ROUTE_SEGMENT_KM = 21000 as const;
export const PLANE_PROGRESS_SCALE = 10000 as const;
export const INITIAL_PLANE_RESERVE: Readonly<Record<PlaneType, number>> = {
  turboprop: 4,
  widebody: 0,
};
export const CURFEW_START_HOUR = 23 as const;
export const CURFEW_END_HOUR = 6 as const;
export const CURFEW_ENDLESS_START_WEEK = 4 as const;
export const CURFEW_START_CITY_COUNT = 2 as const;
export const CURFEW_ADDITIONAL_CITY_EVERY_WEEKS = 2 as const;
export const CURFEW_MAX_CITY_COUNT = 8 as const;

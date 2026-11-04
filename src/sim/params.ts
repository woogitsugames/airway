// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

// [task-05] City spawner (1 simulation tick = 1 game minute, task 01 architecture).
// [night-12f] 1 -> 2: week-1 reach rule and a 2,500 km start radius (D-95, D-105).
export const SPAWNER_PARAMS_VERSION = 2 as const;
export const GAME_TICKS_PER_HOUR = 60 as const;
// [task-22 balance, integration] 4 h -> 12 h; see docs/balance/README.md (bot median 10.1 min at 1x).
// [task-31 balance] 12 h -> 16 h with the 3-day week (D-40): 4.5 new cities per week; docs/balance/README.md.
// [night-12f balance] 16 h -> 12 h with the week-1 reach rule (D-95, D-106): 6 new airports per week.
export const SPAWNER_INTERVAL_HOURS = 12 as const;
export const SPAWNER_INTERVAL_TICKS = SPAWNER_INTERVAL_HOURS * GAME_TICKS_PER_HOUR;
export const SPAWNER_START_CITY_MIN = 3 as const;
export const SPAWNER_START_CITY_MAX = 4 as const;
// [night-12f] 3000 -> 2500 km (D-105): every start airport is within turboprop range of the start anchor.
export const SPAWNER_START_RADIUS_KM = 2500 as const;
export const SPAWNER_MAX_CITIES = 40 as const;
// A rounded integer great-circle distance >= 668 km guarantees >= 6.0 degrees
// for Earth radius 6371 km (6 degrees ~= 667.17 km), even after rounding.
export const SPAWNER_MIN_CITY_DISTANCE_KM = 668 as const;
// [task-08] Passenger-network simulation parameters. One tick is one game minute.
export const PASSENGER_SIM_VERSION = 1 as const;
export const SIM_MINUTES_PER_DAY = 1_440 as const;
// [task-31] D-40: the ONLY definition of the week length. The clock, weekly upgrade board, HUD day bar,
// curfew start (week 3, D-17, D-151) and daily/puzzle modes all derive from it; test:week-source enforces this.
export const SIM_DAYS_PER_WEEK = 3 as const;
export const SIM_MINUTES_PER_WEEK = SIM_MINUTES_PER_DAY * SIM_DAYS_PER_WEEK;
// [task-22 balance, integration] 3 -> 1 passenger per million inhabitants per day.
export const DEMAND_PASSENGERS_PER_MILLION_PER_DAY = 1 as const;
// [night-12f balance] D-95/D-106: integer percentage on the demand rate above (100 = the task-22 rate). Week 1
// became fairer (airports within reach, bot median 17.81 -> 24.43 min), so the pace is faster to keep it in 10–18.
export const DEMAND_RATE_PERCENT = 130 as const;
// Dawn is intentionally strongest; this 24-element integer profile is in local time.
// [task-11] One game tick is one UTC minute; day/night balance is versioned.
export const DAYNIGHT_PARAMS_VERSION = 1 as const;
export const DAYNIGHT_MINUTES_PER_DAY = SIM_MINUTES_PER_DAY;
// [task-31] Alias of the single week length above (kept for the task-11 day/night module).
export const DAYNIGHT_MINUTES_PER_WEEK = SIM_MINUTES_PER_WEEK;
// The single local-time demand profile, shared by demand.ts and daynight.ts.
// Local 06:00 dawn is deliberately stronger than local 02:00 night.
export const DEMAND_HOURLY_WEIGHTS = [
  18, 15, 15, 18, 35, 90, 205, 190, 145, 110, 95, 90,
  85, 90, 105, 125, 145, 150, 125, 100, 70, 50, 35, 25,
] as const;
// [task-22 balance, integration] hub 10 -> 30, ordinary city 5 -> 20 waiting passengers.
// [task-31 balance] hub 30 -> 36, ordinary city 20 -> 24 (D-40 rebalance; docs/balance/README.md).
export const HUB_WAITING_CAPACITY = 36 as const;
export const CITY_WAITING_CAPACITY = 24 as const;
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
// [night-12f] D-95: before the first weekly board (where the first widebody can be taken) a new airport opens only
// within turboprop range of an active airport, so every week-1 airport can be answered with the starting fleet.
export const SPAWNER_WEEK1_REACH_KM = PLANE_TYPES.turboprop.rangeKm;
export const SPAWNER_REACH_RULE_UNTIL_MINUTE = SIM_MINUTES_PER_WEEK;
export const MIN_AIRPORT_SERVICE_TICKS = 25 as const;
export const MAX_ROUTE_SEGMENT_KM = 21000 as const;
export const PLANE_PROGRESS_SCALE = 10000 as const;
// [task-22 balance, integration] starting reserve 2 -> 4 turboprops (D-24 was provisional).
export const INITIAL_PLANE_RESERVE: Readonly<Record<PlaneType, number>> = {
  turboprop: 4,
  widebody: 0,
};
export const CURFEW_START_HOUR = 23 as const;
export const CURFEW_END_HOUR = 6 as const;
// [night-12v] R8c, D-151: week 4 -> 3 (only 15 % of bot runs saw week 4; rules v6). Daily shares it; puzzles set their own.
export const CURFEW_ENDLESS_START_WEEK = 3 as const;
export const CURFEW_START_CITY_COUNT = 2 as const;
export const CURFEW_ADDITIONAL_CITY_EVERY_WEEKS = 2 as const;
export const CURFEW_MAX_CITY_COUNT = 8 as const;
// [task-32] D-41: departure slots per airport per game hour (UTC game hour, integer minutes).
// A plane that finished its service waits on the ground until its airport has a free slot.
// [task-32 balance] 2 / 3 chosen with the bot sweep in docs/balance/README.md (4 / 6 never binds).
export const DEPARTURE_SLOTS_PER_HOUR_CITY = 2 as const;
export const DEPARTURE_SLOTS_PER_HOUR_HUB = 3 as const;
/** Weekly "+2 slots" upgrade: extra hourly departures for one chosen airport. */
export const DEPARTURE_SLOT_UPGRADE = 2 as const;

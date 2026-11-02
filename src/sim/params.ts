// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

// [task-08] Passenger-network simulation parameters. One tick is one game minute.
export const PASSENGER_SIM_VERSION = 1 as const;
export const SIM_MINUTES_PER_DAY = 1_440 as const;
export const SIM_DAYS_PER_WEEK = 7 as const;
export const DEMAND_PASSENGERS_PER_MILLION_PER_DAY = 3 as const;
// Dawn is intentionally strongest; this 24-element integer profile is in local time.
export const DEMAND_HOURLY_WEIGHTS = [
  18, 15, 15, 18, 35, 90, 205, 190, 145, 110, 95, 90,
  85, 90, 105, 125, 145, 150, 125, 100, 70, 50, 35, 25,
] as const;
export const HUB_WAITING_CAPACITY = 10 as const;
export const CITY_WAITING_CAPACITY = 5 as const;
export const HUB_CAPACITY_UPGRADE = 4 as const;
export const MIN_TRANSFER_TICKS = 25 as const;
// At 1x the player has 45 real seconds (10 ticks per real second) to clear a jam.
export const CONGESTION_GRACE_TICKS = 45 * SIM_TICKS_PER_SECOND;
export const WAIT_TOO_LONG_TICKS = 360 as const;

// Keep deterministic balance values and the simulation tick rate in one versionable module.
export const SIM_TICKS_PER_SECOND = 10 as const;
export const SIM_TICK_MS = 100 as const;

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
  turboprop: 2,
  widebody: 0,
};

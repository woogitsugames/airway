// [task-11] Time-zone adapter while task 05's city catalog is not merged into dev.
// The eventual City records should carry the precomputed utcOffsetH integer.
export interface CityUtcOffset {
  readonly utcOffsetH: number;
}

/** Fictional geographic time zones, not real-world UTC or DST rules. */
export function utcOffsetHFromLongitude(longitude: number): number {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError('Longitude must be a finite value in [-180, 180]');
  }
  return Math.max(-12, Math.min(12, Math.round(longitude / 15)));
}

/** Apply once while preparing city data; never recalculate in a simulation tick. */
export function withUtcOffsetH<T extends { readonly lon: number }>(city: T): T & CityUtcOffset {
  return { ...city, utcOffsetH: utcOffsetHFromLongitude(city.lon) };
}

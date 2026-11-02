// Store versioned, static airport, city, and world datasets.
// Derived lookups are built once at module load, never on a simulation tick.
import { CITIES, withUtcOffsetH, type City, type CityUtcOffset } from './cities.ts';
import { distanceKm } from './generated/distances.ts';

export { CITIES, CITY_DATA_VERSION, utcOffsetHFromLongitude, withUtcOffsetH } from './cities.ts';
export type { City, CityUtcOffset } from './cities.ts';
export { REGIONS, REGION_IDS, GLYPH_PATHS } from './regions.ts';
export type { RegionId, RegionGlyph, RegionDefinition } from './regions.ts';

/** City records with their fictional whole-hour UTC offset (D-27), in stable CITIES order. */
export const CITY_RECORDS: readonly (City & CityUtcOffset)[] = Object.freeze(CITIES.map(withUtcOffsetH));

const INDEX_BY_CODE: ReadonlyMap<string, number> = new Map(CITIES.map((city, index) => [city.code, index]));

/** Stable dataset index of a city code, or undefined for an unknown code. */
export function cityIndex(code: string): number | undefined {
  return INDEX_BY_CODE.get(code);
}

export function cityByCode(code: string): (City & CityUtcOffset) | undefined {
  const index = INDEX_BY_CODE.get(code);
  return index === undefined ? undefined : CITY_RECORDS[index];
}

/** Precomputed integer great-circle kilometres between two city codes (undefined if unknown). */
export function cityDistanceKm(a: string, b: string): number | undefined {
  const i = INDEX_BY_CODE.get(a);
  const j = INDEX_BY_CODE.get(b);
  return i === undefined || j === undefined ? undefined : distanceKm(i, j);
}

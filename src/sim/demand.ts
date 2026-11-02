// [task-08] Local-time regional demand. All arithmetic is integral except seeded RNG.next().
import {
  DEMAND_HOURLY_WEIGHTS, DEMAND_PASSENGERS_PER_MILLION_PER_DAY,
  SIM_MINUTES_PER_DAY,
} from './params.js';
import type { DistanceLookup, RoutingCity } from './routing.js';

/** Adapter for task 02's forked 'demand' RNG stream; never use ambient randomness. */
export interface DemandRandom {
  next(): number;
  snapshot(): number;
  restore(state: number): void;
}
export interface DemandRandomRoot { fork(label: 'demand'): DemandRandom }
export interface DemandCity extends RoutingCity {
  readonly population: number;
  /** Fixed UTC offset in minutes. Zone/DST rules can be supplied by task 11 later. */
  readonly utcOffsetMinutes: number;
}
export interface GeneratedPassenger {
  readonly originCityId: string;
  readonly destinationRegion: string;
}
export interface DemandSnapshot {
  readonly credit: Record<string, number>;
  readonly randomState: number;
}
interface RegionChoice { readonly regionId: string; readonly weight: number }
const PROFILE_SUM = DEMAND_HOURLY_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const CREDIT_THRESHOLD = 1_000_000 * PROFILE_SUM * 60;

function distanceFactor(km: number): number {
  if (km <= 1_200) return 5;
  if (km <= 4_000) return 4;
  if (km <= 8_000) return 3;
  return 2;
}

export class RegionalDemand {
  private readonly credit: Record<string, number> = {};
  private readonly choices = new Map<string, RegionChoice[]>();
  private readonly cities: readonly DemandCity[];
  private readonly distanceKm: DistanceLookup;
  private readonly active = new Set<string>();
  private readonly rng: DemandRandom;

  constructor(cities: readonly DemandCity[], distanceKm: DistanceLookup, root: DemandRandomRoot,
      initiallyActive?: readonly string[]) {
    this.cities = cities;
    this.distanceKm = distanceKm;
    this.rng = root.fork('demand');
    if (!this.rng || typeof this.rng.next !== 'function' ||
        typeof this.rng.snapshot !== 'function' || typeof this.rng.restore !== 'function') {
      throw new Error("Task 02 must supply a serializable fork('demand') RNG adapter");
    }
    for (const city of cities) {
      if (!Number.isSafeInteger(city.population) || city.population < 0 ||
          !Number.isInteger(city.utcOffsetMinutes) || city.utcOffsetMinutes < -720 || city.utcOffsetMinutes > 840) {
        throw new Error(`Invalid demand data for city: ${city.cityId}`);
      }
      this.credit[city.cityId] = 0;
    }
    this.setActiveCities(initiallyActive ?? cities.map((city) => city.cityId));
  }

  /** Task 05 activates cities as the endless-mode spawner reveals them. */
  setActiveCities(ids: readonly string[]): void {
    const known = new Set(this.cities.map((city) => city.cityId));
    if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new Error('Invalid active city selection');
    }
    this.active.clear();
    for (const id of ids) this.active.add(id);
    this.choices.clear();
    const regions = new Map<string, DemandCity[]>();
    for (const city of this.cities) {
      if (!this.active.has(city.cityId)) continue;
      const bucket = regions.get(city.regionId) ?? [];
      bucket.push(city);
      regions.set(city.regionId, bucket);
    }
    for (const from of this.cities) {
      if (!this.active.has(from.cityId)) continue;
      const options: RegionChoice[] = [];
      for (const [regionId, regionCities] of [...regions.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        if (regionId === from.regionId) continue;
        let nearest = Number.MAX_SAFE_INTEGER;
        let population = 0;
        for (const target of regionCities) {
          population += target.population;
          const km = this.distanceKm(from.cityId, target.cityId);
          if (!Number.isSafeInteger(km) || km < 0) throw new Error('Invalid precomputed distance');
          if (km < nearest) nearest = km;
        }
        const weight = (Math.floor(population / 1_000_000) + 1) * distanceFactor(nearest);
        if (weight > 0) options.push({ regionId, weight });
      }
      this.choices.set(from.cityId, options);
    }
  }

  /** One simulation tick = one game minute; no new allocations without generated passengers. */
  tick(tick: number, emit: (passenger: GeneratedPassenger) => void): void {
    for (const city of this.cities) {
      if (!this.active.has(city.cityId)) continue;
      const options = this.choices.get(city.cityId)!;
      if (!options.length) continue;
      const localMinute = ((tick + city.utcOffsetMinutes) % SIM_MINUTES_PER_DAY + SIM_MINUTES_PER_DAY) % SIM_MINUTES_PER_DAY;
      const hour = Math.floor(localMinute / 60);
      let balance = this.credit[city.cityId] +
        city.population * DEMAND_PASSENGERS_PER_MILLION_PER_DAY * DEMAND_HOURLY_WEIGHTS[hour];
      while (balance >= CREDIT_THRESHOLD) {
        balance -= CREDIT_THRESHOLD;
        let total = 0;
        for (const choice of options) total += choice.weight;
        const roll = this.rng.next();
        if (roll < 0 || roll >= 1 || !Number.isFinite(roll)) throw new Error('Invalid demand RNG value');
        let index = Math.floor(roll * total);
        for (const choice of options) {
          index -= choice.weight;
          if (index < 0) {
            emit({ originCityId: city.cityId, destinationRegion: choice.regionId });
            break;
          }
        }
      }
      this.credit[city.cityId] = balance;
    }
  }

  snapshot(): DemandSnapshot { return { credit: { ...this.credit }, randomState: this.rng.snapshot() }; }
  restore(saved: DemandSnapshot): void {
    if (!saved || !saved.credit || !Number.isSafeInteger(saved.randomState)) throw new Error('Invalid demand snapshot');
    if (Object.keys(saved.credit).length !== this.cities.length) throw new Error('Demand city set changed');
    for (const city of this.cities) {
      const n = saved.credit[city.cityId];
      if (!Number.isSafeInteger(n) || n < 0 || n >= CREDIT_THRESHOLD) throw new Error('Invalid demand credit');
      this.credit[city.cityId] = n;
    }
    this.rng.restore(saved.randomState);
  }
}

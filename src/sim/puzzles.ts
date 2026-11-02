// Puzzle levels (task 17 data) as real-simulation scenarios: fixed cities, stock, scripted waves and
// always-on curfew cities (D-17). The task-17 goal grading still lives in src/game/modes/puzzle.ts.
import { cityByCode } from '../data/index.ts';
import { PUZZLES, type PuzzleLevel } from '../data/puzzles/index.ts';
import type { DemandWave, Scenario } from './world.ts';

const cache = new Map<string, Scenario>();

export function puzzleLevel(id: string): PuzzleLevel {
  const level = PUZZLES.find((item) => item.id === id);
  if (!level) throw new RangeError(`Unknown puzzle: ${id}`);
  return level;
}

/** Throws RangeError when a level names a city that is not in the city dataset. */
export function puzzleScenario(id: string): Scenario {
  const cached = cache.get(id);
  if (cached) return cached;
  const level = puzzleLevel(id);
  const capacityByCity: Record<string, number> = {};
  for (const city of level.startCities) {
    if (!cityByCode(city.id)) throw new RangeError(`Puzzle ${id}: unknown city ${city.id}`);
    capacityByCity[city.id] = city.hubCapacity;
  }
  // The level's demand seed keeps its fixed 0..8 minute wave offset (task 17 contract).
  const offset = level.demandSeed % 9;
  const demandWaves: DemandWave[] = level.demand.map((wave) => ({
    fromCityId: wave.from, toRegion: cityByCode(wave.to)!.region, passengers: wave.passengers,
    firstMinute: wave.firstTick + offset, everyMinutes: wave.everyTicks,
  }));
  const scenario: Scenario = Object.freeze({
    startCityIds: level.startCities.map((city) => city.id),
    randomDemand: false,
    demandWaves,
    reserve: { turboprop: level.stock.turboprops, widebody: level.stock.jets },
    hubUpgrades: level.stock.hubUpgrades,
    weeklyUpgrades: false,
    curfewCityIds: level.startCities.filter((city) => city.curfew).map((city) => city.id),
    endMinute: level.durationTicks,
    capacityByCity,
  });
  cache.set(id, scenario);
  return scenario;
}

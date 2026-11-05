// Map a GameConfig (part of every snapshot) to its world rules. Endless and Daily share the rules;
// Daily differs only by its Warsaw-calendar seed (src/core/daily.ts).
import type { RegionId } from '../data/regions.ts';
import type { GameConfig } from './state.ts';
import { ENDLESS_SCENARIO, type Scenario } from './world.ts';
import { puzzleScenario } from './puzzles.ts';

export function scenarioFor(config: GameConfig): Scenario {
  if (config.mode === 'puzzle') {
    if (config.puzzleId === undefined) throw new TypeError('puzzle mode needs a puzzleId');
    return puzzleScenario(config.puzzleId);
  }
  // [night-11aj] R2g: a chosen home region moves only the start cluster (D-236); Daily never carries one.
  // [night-12ba] R2k: the weekly contract (D-247) is an Endless flag too; without either it is the shared scenario.
  if (config.homeRegion === undefined && config.weeklyContract !== true) return ENDLESS_SCENARIO;
  return endlessScenario(config.homeRegion ?? null, config.weeklyContract === true);
}

const ENDLESS_VARIANTS = new Map<string, Scenario>();
function endlessScenario(region: RegionId | null, contract: boolean): Scenario {
  const key = `${region ?? '-'}/${contract ? 'c' : '-'}`;
  let scenario = ENDLESS_VARIANTS.get(key);
  if (!scenario) {
    scenario = Object.freeze({ ...ENDLESS_SCENARIO, ...(region ? { homeRegionId: region } : {}),
      ...(contract ? { weeklyContract: true } : {}) });
    ENDLESS_VARIANTS.set(key, scenario);
  }
  return scenario;
}

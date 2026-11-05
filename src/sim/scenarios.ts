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
  if (config.homeRegion !== undefined) return homeScenario(config.homeRegion);
  return ENDLESS_SCENARIO;
}

const HOME_SCENARIOS = new Map<RegionId, Scenario>();
function homeScenario(region: RegionId): Scenario {
  let scenario = HOME_SCENARIOS.get(region);
  if (!scenario) {
    scenario = Object.freeze({ ...ENDLESS_SCENARIO, homeRegionId: region });
    HOME_SCENARIOS.set(region, scenario);
  }
  return scenario;
}

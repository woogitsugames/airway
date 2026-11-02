// Map a GameConfig (part of every snapshot) to its world rules. Endless and Daily share the rules;
// Daily differs only by its Warsaw-calendar seed (src/core/daily.ts).
import type { GameConfig } from './state.ts';
import { ENDLESS_SCENARIO, type Scenario } from './world.ts';
import { puzzleScenario } from './puzzles.ts';

export function scenarioFor(config: GameConfig): Scenario {
  if (config.mode === 'puzzle') {
    if (config.puzzleId === undefined) throw new TypeError('puzzle mode needs a puzzleId');
    return puzzleScenario(config.puzzleId);
  }
  return ENDLESS_SCENARIO;
}

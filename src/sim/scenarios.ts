// Map a GameConfig (part of every snapshot) to its world rules. Endless and Daily share the rules;
// Daily differs only by its Warsaw-calendar seed (src/core/daily.ts).
import type { RegionId } from '../data/regions.ts';
import type { GameConfig } from './state.ts';
import { ENDLESS_SCENARIO, type Scenario } from './world.ts';
import { puzzleScenario } from './puzzles.ts';
import { LICENCE_PARAMS, type LicenceClass } from './licence.ts';

export function scenarioFor(config: GameConfig): Scenario {
  if (config.mode === 'puzzle') {
    if (config.puzzleId === undefined) throw new TypeError('puzzle mode needs a puzzleId');
    return puzzleScenario(config.puzzleId);
  }
  // [night-11aj] R2g: a chosen home region moves only the start cluster (D-236); Daily never carries one.
  // [night-12ba] R2k: the weekly contract (D-247) is an Endless flag too; without either it is the shared scenario.
  // [night-12bb] R2i: so is the demand surge (D-249).
  // [night-12bc] R2h: a licence class above I (D-251) sets the class's knobs; class I carries no field.
  if (config.homeRegion === undefined && config.weeklyContract !== true && config.demandSurge !== true &&
      config.licenceClass === undefined) return ENDLESS_SCENARIO;
  return endlessScenario(config.homeRegion ?? null, config.weeklyContract === true, config.demandSurge === true,
    config.licenceClass ?? 1);
}

const ENDLESS_VARIANTS = new Map<string, Scenario>();
function endlessScenario(region: RegionId | null, contract: boolean, surge: boolean, licence: LicenceClass): Scenario {
  const key = `${region ?? '-'}/${contract ? 'c' : '-'}/${surge ? 's' : '-'}/${licence}`;
  let scenario = ENDLESS_VARIANTS.get(key);
  if (!scenario) {
    scenario = Object.freeze({ ...ENDLESS_SCENARIO, ...(region ? { homeRegionId: region } : {}),
      ...(contract ? { weeklyContract: true } : {}), ...(surge ? { demandSurge: true } : {}),
      ...(licence === 1 ? {} : licenceKnobs(licence)) });
    ENDLESS_VARIANTS.set(key, scenario);
  }
  return scenario;
}

/** [night-12bc] R2h: the scenario fields of a licence class above I (data: LICENCE_PARAMS). */
function licenceKnobs(licence: LicenceClass): Pick<Scenario, 'reserve' | 'licence'> {
  const params = LICENCE_PARAMS[licence];
  return {
    reserve: Object.freeze({ ...ENDLESS_SCENARIO.reserve, turboprop: params.turbopropReserve }),
    licence: Object.freeze({
      curfew: Object.freeze({ startWeek: params.curfewStartWeek, startCities: params.curfewStartCities }),
      hubCapacity: params.hubCapacity,
    }),
  };
}

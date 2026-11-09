// Public facade of the deterministic simulation (see docs/ARCHITECTURE.md, "Sim API").
import { Sim } from './sim.ts';
import type { GameConfig } from './state.ts';

export { Sim, type UndoResult } from './sim.ts';
export type { CommandOutcome } from './sim.ts';
export type { Command, CommandEntry, CommandCheck, RejectReason, RouteEnd } from './commands.ts';
export type { GameConfig, SimState } from './state.ts';
export type {
  CityView, RouteView, HubCauseLedgerView, SimEvent, GameMode, WorldStatus, UpgradeRecord, Scenario,
  WorldView, DemandWave, SurgeView, WeatherView, AirportWeatherView,
} from './world.ts';
export type { PlaneState } from './planes.ts';
export type { PlaneType } from './params.ts';
export type { UpgradeKind, UpgradeOffer, WeeklyUpgradeState } from './upgrades.ts';
export type { WeeklyContract, ContractRecord } from './contracts.ts';
export type { DemandSurge, SurgeRecord, SurgePhase } from './surge.ts';
export type { WeatherFront, WeatherBand, AirportFront, AirportFrontPhase } from './weather.ts';
export type { HubFailure } from './hubs.ts';
export { PLANE_TYPES, PLANE_PROGRESS_SCALE, CONGESTION_GRACE_TICKS, MORNING_START_LOCAL_HOUR } from './params.ts';
export { clockAt, calendarWeekAt, calendarDayAt, ticksPerSecond, TICKS_PER_DAY, DAYS_PER_WEEK, TICKS_PER_WEEK, TICKS_PER_SECOND_1X } from './clock.ts';
export type { ClockTime, SimSpeed } from './clock.ts';

export { HOME_REGIONS } from './spawner.ts';
export { LICENCE_CLASSES, LICENCE_PARAMS, LICENCE_PARAMS_VERSION, LICENCE_UNLOCK_WEEK, isLicenceClass } from './licence.ts';
export type { LicenceClass, LicenceParams } from './licence.ts';
import type { LicenceClass } from './licence.ts';

/**
 * Start a new run. `seed` is an unsigned 32-bit integer (Daily: src/core/daily.ts dailySeed()).
 * [night-11aj] R2g: `homeRegion` (Endless only; null = Random) anchors the start cluster in that region.
 * [night-12bc] R2h: `licenceClass` (Endless only; 1 = today's rules, no config field) picks the class's knobs.
 * [night-12bd] R2j: `weatherFront` (Endless only) turns the weekly weather front on; shipped Endless leaves it off.
 * [night-86a] D-343: `morningStart` (Endless and Daily) starts the run at local 07:00 at its first airport.
 */
export function createGame(seed: number, mode: GameConfig['mode'] = 'endless', puzzleId?: string,
    homeRegion: GameConfig['homeRegion'] | null = null, weeklyContract = false, demandSurge = false,
    licenceClass: LicenceClass = 1, weatherFront = false, eusClusterV2 = true, morningStart = false): Sim {
  if (mode === 'puzzle') return new Sim(seed >>> 0, { mode, puzzleId: puzzleId ?? '' });
  // [night-86a] D-343: the morning start is the one rule Daily shares with Endless (new runs of both set it).
  const morning = morningStart ? { morningStart: true as const } : {};
  if (mode !== 'endless') return new Sim(seed >>> 0, { mode, ...morning });
  // [night-12ba] R2k: the weekly contract (D-247) is Endless only; the game layer turns it on for new runs.
  // [night-12bb] R2i: so is the demand surge (D-249). [night-12bc] R2h: and a licence class above I (D-251).
  return new Sim(seed >>> 0, { mode, ...(homeRegion ? { homeRegion } : {}), ...(weeklyContract ? { weeklyContract: true } : {}),
    ...(demandSurge ? { demandSurge: true } : {}), ...(licenceClass === 1 ? {} : { licenceClass }),
    ...(weatherFront ? { weatherFront: true } : {}), ...(homeRegion === 'EUS' && eusClusterV2 ? { eusClusterV2: true } : {}),
    ...morning });
}

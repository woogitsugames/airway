// Public facade of the deterministic simulation (see docs/ARCHITECTURE.md, "Sim API").
import { Sim } from './sim.ts';
import type { GameConfig } from './state.ts';

export { Sim } from './sim.ts';
export type { Command, CommandEntry, CommandCheck, RejectReason, RouteEnd } from './commands.ts';
export type { GameConfig, SimState } from './state.ts';
export type {
  CityView, RouteView, HubCauseLedgerView, SimEvent, GameMode, WorldStatus, UpgradeRecord, Scenario,
} from './world.ts';
export type { PlaneState } from './planes.ts';
export type { PlaneType } from './params.ts';
export type { UpgradeKind, UpgradeOffer, WeeklyUpgradeState } from './upgrades.ts';
export type { HubFailure } from './hubs.ts';
export { PLANE_TYPES, PLANE_PROGRESS_SCALE, CONGESTION_GRACE_TICKS } from './params.ts';
export { clockAt, ticksPerSecond, TICKS_PER_DAY, TICKS_PER_WEEK, TICKS_PER_SECOND_1X } from './clock.ts';
export type { ClockTime, SimSpeed } from './clock.ts';

/** Start a new run. `seed` is an unsigned 32-bit integer (Daily: src/core/daily.ts dailySeed()). */
export function createGame(seed: number, mode: GameConfig['mode'] = 'endless', puzzleId?: string): Sim {
  return new Sim(seed >>> 0, mode === 'puzzle' ? { mode, puzzleId: puzzleId ?? '' } : { mode });
}

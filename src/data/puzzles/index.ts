// Versioned puzzle data contract; JSON entries contain no executable behavior.
export type PuzzlePlane = 'turboprop' | 'jet';
export interface PuzzleCity {
  readonly id: string;
  readonly continent: 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC';
  readonly latitude: number;
  readonly longitude: number;
  readonly hubCapacity: number;
  readonly curfew?: Readonly<{ startMinuteOfDay: number; endMinuteOfDay: number }>;
}
export interface PuzzleRoute {
  readonly from: string;
  readonly to: string;
  readonly plane: PuzzlePlane;
  readonly flightTicks: number;
  readonly intervalTicks: number;
}
export type PuzzleCommand =
  | Readonly<{ type: 'connect'; from: string; to: string; plane: PuzzlePlane }>
  | Readonly<{ type: 'upgradeHub'; city: string }>;
export type PuzzleGoal =
  | Readonly<{ kind: 'deliver'; targetDelivered: number }>
  | Readonly<{ kind: 'continents'; targetDelivered: number; continents: number }>
  | Readonly<{ kind: 'curfewNights'; targetDelivered: number; nights: number }>;
/** [night-01] Newer mechanics a level is built around; test:puzzles proves each one in the reference run. */
export type PuzzleMechanic = 'slots' | 'curfew' | 'week' | 'mct' | 'transfer';
export interface PuzzleLevel {
  readonly version: 1;
  readonly id: string;
  readonly titleKey: `puzzle.${string}.title`;
  readonly durationTicks: number;
  readonly demandSeed: number;
  readonly startCities: readonly PuzzleCity[];
  readonly stock: Readonly<{ turboprops: number; jets: number; hubUpgrades: number }>;
  readonly goal: PuzzleGoal;
  readonly mechanics?: readonly PuzzleMechanic[];
  readonly demand: readonly Readonly<{ from: string; to: string; passengers: number; firstTick: number; everyTicks: number }>[];
  readonly availableRoutes: readonly PuzzleRoute[];
  readonly referenceCommands: readonly PuzzleCommand[];
}
// [ext-01] R6f, D-160: the level list is generated from the NN.json files (npm run build:puzzles).
import { PUZZLE_LEVELS } from './levels.generated.ts';
import { releasedLevels } from './packs.ts';

/** [night-11u] D-193: DEV/test builds (and Node tests, which have no Vite env) show every pack; a release build
 *  shows the packs not marked `hiddenInRelease`, unless it was built with `VITE_AW_ALL_PACKS=1`. */
export function showHiddenPacks(env: { readonly DEV?: boolean; readonly VITE_AW_ALL_PACKS?: string } | undefined): boolean {
  return !env || env.DEV === true || env.VITE_AW_ALL_PACKS === '1';
}
export const PUZZLES: readonly PuzzleLevel[] = releasedLevels(PUZZLE_LEVELS, showHiddenPacks(import.meta.env));

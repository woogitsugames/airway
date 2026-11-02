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
import level01 from './01.json';
import level02 from './02.json';
import level03 from './03.json';
import level04 from './04.json';
import level05 from './05.json';
import level06 from './06.json';
import level07 from './07.json';
import level08 from './08.json';
import level09 from './09.json';
import level10 from './10.json';
import level11 from './11.json';
import level12 from './12.json';
import level13 from './13.json';
import level14 from './14.json';
import level15 from './15.json';
import level16 from './16.json';
import level17 from './17.json';
import level18 from './18.json';
import level19 from './19.json';
import level20 from './20.json';
import level21 from './21.json';
import level22 from './22.json';
import level23 from './23.json';
import level24 from './24.json';
import level25 from './25.json';
import level26 from './26.json';
import level27 from './27.json';
import level28 from './28.json';
import level29 from './29.json';
import level30 from './30.json';

// Runtime validation in startPuzzle rejects malformed JSON at the boundary.
export const PUZZLES: readonly PuzzleLevel[] = [
  level01, level02, level03, level04, level05,
  level06, level07, level08, level09, level10,
  level11, level12, level13, level14, level15,
  level16, level17, level18, level19, level20,
  level21, level22, level23, level24, level25,
  level26, level27, level28, level29, level30,
] as unknown as readonly PuzzleLevel[];

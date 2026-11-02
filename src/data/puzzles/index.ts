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
export interface PuzzleLevel {
  readonly version: 1;
  readonly id: string;
  readonly titleKey: `puzzle.${string}.title`;
  readonly durationTicks: number;
  readonly demandSeed: number;
  readonly startCities: readonly PuzzleCity[];
  readonly stock: Readonly<{ turboprops: number; jets: number; hubUpgrades: number }>;
  readonly goal: PuzzleGoal;
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

// Runtime validation in startPuzzle rejects malformed JSON at the boundary.
export const PUZZLES: readonly PuzzleLevel[] = [
  level01, level02, level03, level04, level05,
  level06, level07, level08, level09, level10,
  level11, level12, level13, level14, level15,
] as unknown as readonly PuzzleLevel[];

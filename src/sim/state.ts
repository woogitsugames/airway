import { Rng, seedFromString } from '../core/rng.ts';
import type { SimSpeed } from './clock.ts';
import type { CommandEntry } from './commands.ts';
import type { RegionId } from '../data/regions.ts';
import type { GameMode, WorldSnapshot } from './world.ts';

/** v2: the kernel state carries the whole game world (tasks 05/08/09/11/12). */
// [task-31] 3 -> 3-day weeks (D-40) change the rules; older saves are rejected.
// [task-32] 3 -> 4: departure slots are enforced (D-41); aircraft and world snapshots gained slot state.
// [night-12f] 4 -> 5: week-1 spawn reach, 2,500 km start radius, 12 h spawns, demand 130 %, Alexandria in ME
// (D-95, D-99, D-105, D-106). Older saves are replayed under the new rules (D-76).
// [night-12v] 5 -> 6: weekly board draws only cards that can act (R8a, D-150), curfew from week 3 (R8c, D-151).
// Older saves are replayed under the new rules (D-76).
export const RULES_VERSION = 6;
export const SNAPSHOT_VERSION = 2;
export const INITIAL_COMMAND_DIGEST = 0x811c9dc5;

export type RngStream = 'cities' | 'demand' | 'events' | 'upgrades';
export interface RngStates {
  cities: number;
  demand: number;
  events: number;
  upgrades: number;
}

/** What kind of run this is; a puzzle also names its level. Part of every snapshot and hash. */
export interface GameConfig {
  readonly mode: GameMode;
  readonly puzzleId?: string;
  /**
   * [night-11aj] R2g: Endless only. The start cluster is anchored in this region; absent = Random (the pre-R2g
   * draw, so older saves and hashes are unchanged). Daily and puzzles never carry it.
   */
  readonly homeRegion?: RegionId;
  /**
   * [night-12ba] R2k, D-247: Endless only. The weekly board names a contract; meeting it adds a fourth crate next week.
   * Absent = the pre-R2k rules (older saves and every Daily replay unchanged); new Endless runs set it.
   */
  readonly weeklyContract?: true;
  /**
   * [night-12bb] R2i, D-249: Endless only. From week 3 one open airport per week announces a demand surge a game day
   * ahead. Absent = no surges (older saves and every Daily replay unchanged); new Endless runs set it.
   */
  readonly demandSurge?: true;
}

/** [night-11aj] Canonical copy of a config: optional fields only when set (they are part of the state hash). */
export function copyConfig(config: GameConfig): GameConfig {
  return {
    mode: config.mode,
    ...(config.puzzleId === undefined ? {} : { puzzleId: config.puzzleId }),
    ...(config.homeRegion === undefined ? {} : { homeRegion: config.homeRegion }),
    ...(config.weeklyContract === true ? { weeklyContract: true } : {}),
    ...(config.demandSurge === true ? { demandSurge: true } : {}),
  };
}

/** Kernel bookkeeping. `tick` counts kernel steps (journal index); the world keeps game minutes. */
export interface KernelState {
  readonly rulesVersion: number;
  readonly seed: number;
  readonly config: GameConfig;
  tick: number;
  speed: SimSpeed;
  commandCount: number;
  commandDigest: number;
  rng: RngStates;
}

/** The complete authoritative state: kernel fields plus the serialized world. */
export interface SimState extends KernelState {
  readonly world: WorldSnapshot;
}

export function initialKernelState(seed: number, config: GameConfig): KernelState {
  const base = new Rng(seed);
  return {
    rulesVersion: RULES_VERSION,
    seed,
    config: copyConfig(config),
    tick: 0,
    speed: 1,
    commandCount: 0,
    commandDigest: INITIAL_COMMAND_DIGEST,
    rng: {
      cities: base.fork('cities').state,
      demand: base.fork('demand').state,
      events: base.fork('events').state,
      upgrades: base.fork('upgrades').state,
    },
  };
}

export function copyKernel(state: KernelState): KernelState {
  return { rulesVersion: state.rulesVersion, seed: state.seed, config: copyConfig(state.config), tick: state.tick,
    speed: state.speed, commandCount: state.commandCount, commandDigest: state.commandDigest, rng: { ...state.rng } };
}

/** Deep, JSON-normalised copy (drops `undefined` optionals so hashing is canonical). */
export function copyState(state: SimState): SimState {
  return JSON.parse(JSON.stringify(state)) as SimState;
}

/** Stable recursive key ordering; rejects non-JSON values and numbers. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new TypeError('authoritative state must use finite safe integers');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
    ).join(',')}}`;
  }
  throw new TypeError('expected a plain, JSON-compatible value');
}

export function hashState(state: SimState): string {
  return seedFromString(canonicalJson(state)).toString(16).padStart(8, '0');
}

/** Rolling command history fingerprint (also distinguishes rejected commands in the hash). */
export function foldCommandDigest(prior: number, entry: CommandEntry): number {
  return seedFromString(`${prior.toString(16)}:${canonicalJson(entry)}`);
}

import { Rng, seedFromString } from '../core/rng.ts';
import type { SimSpeed } from './clock.ts';
import type { CommandEntry } from './commands.ts';

export const RULES_VERSION = 1;
export const SNAPSHOT_VERSION = 1;
export const INITIAL_COMMAND_DIGEST = 0x811c9dc5;

export type RngStream = 'cities' | 'demand' | 'events' | 'upgrades';
export interface RngStates {
  cities: number;
  demand: number;
  events: number;
  upgrades: number;
}

/** Task 02 intentionally contains no routes, aircraft or passenger-world state. */
export interface SimState {
  readonly rulesVersion: number;
  readonly seed: number;
  tick: number;
  speed: SimSpeed;
  commandCount: number;
  commandDigest: number;
  rng: RngStates;
}

export function initialState(seed: number): SimState {
  const base = new Rng(seed);
  return {
    rulesVersion: RULES_VERSION,
    seed,
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

export function copyState(state: SimState): SimState {
  return { ...state, rng: { ...state.rng } };
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

/** Rolling command history fingerprint until domain-specific state exists. */
export function foldCommandDigest(prior: number, entry: CommandEntry): number {
  return seedFromString(`${prior.toString(16)}:${canonicalJson(entry)}`);
}

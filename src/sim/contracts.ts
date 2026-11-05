/**
 * [night-12ba] R2k, D-247: the weekly contract (Endless runs whose GameConfig carries `weeklyContract`).
 *
 * Each weekly board (end of week w) names one optional contract for the coming week: carry `target` passengers
 * between two named regions, in either direction. Meeting it adds a fourth crate to the next board. Nothing is
 * lost when a contract is missed. The regions are drawn from a per-week fork of the run seed (no kernel stream
 * moves, so the offers and passengers of a run that never meets a contract stay as without contracts); the target
 * is a share of the demand the pair is expected to generate that week, read from the current network.
 * Pure: no clock, no transcendentals (D-13). The world (world.ts) owns the state and calls these functions.
 */
import { Rng } from '../core/rng.ts';
import { REGION_IDS } from '../data/regions.ts';
import { CONTRACT_MAX_PASSENGERS, CONTRACT_MIN_PASSENGERS, CONTRACT_SHARE_PERCENT, SIM_DAYS_PER_WEEK } from './params.ts';

export interface WeeklyContract {
  /** Board week that issued the contract; it runs during week `week + 1`. */
  readonly week: number;
  /** Two distinct regions in REGION_IDS order; passengers count in either direction. */
  readonly regions: readonly [string, string];
  readonly target: number;
  readonly delivered: number;
}
export interface ContractRecord extends WeeklyContract { readonly met: boolean }
/** Serialized in the world snapshot (only in runs with the weekly contract). */
export interface ContractSnapshot {
  readonly current: WeeklyContract | null;
  /** Fourth crates earned and not yet shown (a board that cannot show one keeps it for the next board). */
  readonly bonusCrates: number;
  readonly history: readonly ContractRecord[];
}
/** Read-only demand estimate: expected passengers from one region to another over `days` game days. */
export type DemandEstimate = (fromRegion: string, toRegion: string, days: number) => number;

export const EMPTY_CONTRACTS: ContractSnapshot = Object.freeze({ current: null, bonusCrates: 0, history: [] });

const ORDER = new Map<string, number>(REGION_IDS.map((id, index) => [id, index]));
const byRegionOrder = (a: string, b: string): number => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99) || (a < b ? -1 : a > b ? 1 : 0);

/** The target for a pair: CONTRACT_SHARE_PERCENT of next week's expected demand both ways, floored, at most the cap. */
export function contractTarget(a: string, b: string, estimate: DemandEstimate): number {
  const expected = estimate(a, b, SIM_DAYS_PER_WEEK) + estimate(b, a, SIM_DAYS_PER_WEEK);
  return Math.min(CONTRACT_MAX_PASSENGERS, Math.floor(expected * CONTRACT_SHARE_PERCENT / 100));
}

/**
 * Draw the contract for board week `week`: one unordered pair of regions with an open airport whose target is at
 * least CONTRACT_MIN_PASSENGERS, uniformly, from `new Rng(seed).fork('contract/<week>')`. Null when no pair
 * qualifies (fewer than two regions open, or too little demand).
 */
export function drawContract(seed: number, week: number, openRegions: readonly string[], estimate: DemandEstimate): WeeklyContract | null {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('Invalid week');
  const regions = [...new Set(openRegions)].sort(byRegionOrder);
  const pairs: { regions: [string, string]; target: number }[] = [];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const target = contractTarget(regions[i]!, regions[j]!, estimate);
      if (target >= CONTRACT_MIN_PASSENGERS) pairs.push({ regions: [regions[i]!, regions[j]!], target });
    }
  }
  if (!pairs.length) return null;
  const pick = pairs[new Rng(seed >>> 0).fork(`contract/${week}`).int(pairs.length)]!;
  return { week, regions: pick.regions, target: pick.target, delivered: 0 };
}

/** Does a delivered passenger count for the contract (either direction between its two regions)? */
export function countsFor(contract: WeeklyContract, originRegion: string | undefined, destinationRegion: string): boolean {
  const [a, b] = contract.regions;
  return (originRegion === a && destinationRegion === b) || (originRegion === b && destinationRegion === a);
}

export function isMet(contract: WeeklyContract): boolean { return contract.delivered >= contract.target; }

/** Close the running contract at a board: record it and bank a fourth crate when it was met. */
export function closeContract(state: ContractSnapshot): ContractSnapshot {
  const current = state.current;
  if (!current) return state;
  const met = isMet(current);
  return { current: null, bonusCrates: state.bonusCrates + (met ? 1 : 0), history: [...state.history, { ...current, met }] };
}

export function validContractSnapshot(value: unknown): value is ContractSnapshot {
  const count = (n: unknown): boolean => Number.isSafeInteger(n) && (n as number) >= 0;
  const contract = (c: unknown): boolean => {
    if (!c || typeof c !== 'object') return false;
    const v = c as Record<string, unknown>;
    return count(v.week) && (v.week as number) >= 1 && Array.isArray(v.regions) && v.regions.length === 2 &&
      v.regions.every((r) => typeof r === 'string' && ORDER.has(r)) && v.regions[0] !== v.regions[1] &&
      count(v.target) && (v.target as number) >= 1 && count(v.delivered);
  };
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.current === null || contract(v.current)) && count(v.bonusCrates) && Array.isArray(v.history) &&
    v.history.every((h) => contract(h) && typeof (h as Record<string, unknown>).met === 'boolean');
}

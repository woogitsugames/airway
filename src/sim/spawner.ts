// Pure, serializable city spawning (task 05): no geometry/trigonometry or platform clock calls.
// Randomness comes from the kernel's 'cities' stream; the kernel persists that stream's state.
import type { Rng } from '../core/rng.ts';
import { CITIES } from '../data/cities.ts';
import { distanceKm } from '../data/generated/distances.ts';
import {
  SPAWNER_INTERVAL_TICKS,
  SPAWNER_MAX_CITIES,
  SPAWNER_MIN_CITY_DISTANCE_KM,
  SPAWNER_PARAMS_VERSION,
  SPAWNER_REACH_RULE_UNTIL_MINUTE,
  SPAWNER_START_CITY_MAX,
  SPAWNER_START_CITY_MIN,
  SPAWNER_START_RADIUS_KM,
  SPAWNER_WEEK1_REACH_KM,
} from './params.ts';

export interface CitySpawnerState {
  readonly paramsVersion: typeof SPAWNER_PARAMS_VERSION;
  readonly activeCityIndices: readonly number[];
  readonly nextSpawnTick: number | null;
  readonly lastTick: number;
}

export interface SpawnResult {
  readonly state: CitySpawnerState;
  // Resolve each index against CITIES; ordered, stable integer identities for replays/saves.
  readonly spawnedCityIndices: readonly number[];
}

const NO_CITIES: readonly number[] = Object.freeze([]);

function isFarEnough(candidate: number, active: readonly number[]): boolean {
  for (const index of active) {
    if (distanceKm(candidate, index) < SPAWNER_MIN_CITY_DISTANCE_KM) return false;
  }
  return true;
}

interface StartCluster {
  readonly members: readonly number[];
}

// Precomputed once when this data module is loaded, never on a simulation tick.
// [integration-sim] Passengers only travel to OTHER regions (task 08), so a start needs two regions:
// members[0] is the anchor, members[1] its nearest foreign-region neighbour, then the nearest others.
function buildStartClusters(): readonly StartCluster[] {
  const clusters: StartCluster[] = [];
  for (let anchor = 0; anchor < CITIES.length; anchor++) {
    const nearby: number[] = [];
    for (let other = 0; other < CITIES.length; other++) {
      if (other === anchor) continue;
      const km = distanceKm(anchor, other);
      if (km >= SPAWNER_MIN_CITY_DISTANCE_KM && km <= SPAWNER_START_RADIUS_KM) {
        nearby.push(other);
      }
    }
    nearby.sort((a, b) => distanceKm(anchor, a) - distanceKm(anchor, b) || a - b);
    const foreign = nearby.find((other) => CITIES[other].region !== CITIES[anchor].region);
    if (foreign === undefined) continue;
    const members = [anchor, foreign];
    for (const other of nearby) {
      if (other !== foreign && isFarEnough(other, members)) members.push(other);
      if (members.length === SPAWNER_START_CITY_MAX) break;
    }
    if (members.length === SPAWNER_START_CITY_MAX) clusters.push({ members });
  }
  return clusters;
}

const START_CLUSTERS = buildStartClusters();

/** Seeded start: one 3-4 city cluster. `rng` is the kernel's 'cities' stream. */
export function createCitySpawner(rng: Rng): CitySpawnerState {
  if (START_CLUSTERS.length === 0) throw new Error('City dataset has no viable starting region');
  const cluster = START_CLUSTERS[rng.int(START_CLUSTERS.length)].members;
  const count = SPAWNER_START_CITY_MIN + rng.int(SPAWNER_START_CITY_MAX - SPAWNER_START_CITY_MIN + 1);
  const options = cluster.slice(2);
  // Fisher–Yates for variable starting groups without breaking pairwise spacing.
  for (let i = options.length - 1; i > 0; i--) {
    const roll = rng.int(i + 1);
    const tmp = options[i];
    options[i] = options[roll];
    options[roll] = tmp;
  }
  return {
    paramsVersion: SPAWNER_PARAMS_VERSION,
    activeCityIndices: [cluster[0], cluster[1], ...options.slice(0, count - 2)],
    nextSpawnTick: SPAWNER_INTERVAL_TICKS,
    lastTick: 0,
  };
}

function proximityWeight(nearestKm: number): number {
  if (nearestKm <= 1500) return 24;
  if (nearestKm <= 3000) return 12;
  if (nearestKm <= 5000) return 4;
  return 1; // A small global escape probability prevents regional dead ends.
}

/**
 * Weighted draw of the next city. `withinReach` (week 1, D-98) keeps only candidates whose nearest active airport is
 * at most SPAWNER_WEEK1_REACH_KM away; when no such candidate exists the draw falls back to every spaced candidate.
 */
function chooseNextCity(active: readonly number[], rng: Rng, withinReach: boolean): number | null {
  const candidates: number[] = [];
  const weights: number[] = [];
  let totalWeight = 0;
  let reachable = 0;
  const nearest: number[] = [];
  for (let index = 0; index < CITIES.length; index++) {
    let nearestKm = 20016;
    for (const existing of active) {
      const km = distanceKm(index, existing);
      if (km < nearestKm) nearestKm = km;
      if (nearestKm < SPAWNER_MIN_CITY_DISTANCE_KM) break;
    }
    if (nearestKm < SPAWNER_MIN_CITY_DISTANCE_KM) continue;
    candidates.push(index);
    nearest.push(nearestKm);
    if (nearestKm <= SPAWNER_WEEK1_REACH_KM) reachable++;
  }
  const restrict = withinReach && reachable > 0;
  for (let i = 0; i < candidates.length; i++) {
    const weight = restrict && nearest[i] > SPAWNER_WEEK1_REACH_KM ? 0 : proximityWeight(nearest[i]);
    weights.push(weight);
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  let ticket = rng.int(totalWeight);
  for (let i = 0; i < candidates.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return candidates[i];
  }
  throw new Error('Invalid weighted city selection');
}

// Call with the authoritative integer game tick; skipping ticks catches up identically.
export function advanceCitySpawner(state: CitySpawnerState, gameTick: number, rng: Rng): SpawnResult {
  if (!Number.isSafeInteger(gameTick) || gameTick < state.lastTick) {
    throw new RangeError('Game tick must be a nondecreasing safe integer');
  }
  if (state.paramsVersion !== SPAWNER_PARAMS_VERSION) {
    throw new Error('Spawner parameter version mismatch');
  }
  if (state.nextSpawnTick === null || gameTick < state.nextSpawnTick) {
    if (gameTick === state.lastTick) return { state, spawnedCityIndices: NO_CITIES };
    return { state: { ...state, lastTick: gameTick }, spawnedCityIndices: NO_CITIES };
  }

  let nextSpawnTick: number | null = state.nextSpawnTick;
  const active = [...state.activeCityIndices];
  const spawned: number[] = [];
  while (nextSpawnTick !== null && gameTick >= nextSpawnTick) {
    if (active.length >= SPAWNER_MAX_CITIES) {
      nextSpawnTick = null;
      break;
    }
    const index = chooseNextCity(active, rng, nextSpawnTick < SPAWNER_REACH_RULE_UNTIL_MINUTE);
    if (index === null) {
      nextSpawnTick = null; // Dataset exhausted under the 6-degree restriction.
      break;
    }
    active.push(index);
    spawned.push(index);
    nextSpawnTick += SPAWNER_INTERVAL_TICKS;
    if (active.length >= SPAWNER_MAX_CITIES) nextSpawnTick = null;
  }
  return {
    state: {
      paramsVersion: state.paramsVersion,
      activeCityIndices: active,
      nextSpawnTick,
      lastTick: gameTick,
    },
    spawnedCityIndices: spawned,
  };
}

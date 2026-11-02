// Pure, serializable city spawning: no geometry/trigonometry or platform clock calls.
import { nextRngUint32 } from '../core/rng';
import { CITIES } from '../data/cities';
import { distanceKm } from '../data/generated/distances';
import {
  SPAWNER_INTERVAL_TICKS,
  SPAWNER_MAX_CITIES,
  SPAWNER_MIN_CITY_DISTANCE_KM,
  SPAWNER_PARAMS_VERSION,
  SPAWNER_START_CITY_MAX,
  SPAWNER_START_CITY_MIN,
  SPAWNER_START_RADIUS_KM,
} from './params';

export interface CitySpawnerState {
  readonly paramsVersion: typeof SPAWNER_PARAMS_VERSION;
  readonly rngState: number;
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
function buildStartClusters(): readonly StartCluster[] {
  const clusters: StartCluster[] = [];
  for (let anchor = 0; anchor < CITIES.length; anchor++) {
    const nearby: number[] = [];
    for (let other = 0; other < CITIES.length; other++) {
      if (other === anchor || CITIES[other].region !== CITIES[anchor].region) continue;
      const km = distanceKm(anchor, other);
      if (km >= SPAWNER_MIN_CITY_DISTANCE_KM && km <= SPAWNER_START_RADIUS_KM) {
        nearby.push(other);
      }
    }
    nearby.sort((a, b) => distanceKm(anchor, a) - distanceKm(anchor, b) || a - b);
    const members = [anchor];
    for (const other of nearby) {
      if (isFarEnough(other, members)) members.push(other);
      if (members.length === SPAWNER_START_CITY_MAX) break;
    }
    if (members.length === SPAWNER_START_CITY_MAX) clusters.push({ members });
  }
  return clusters;
}

const START_CLUSTERS = buildStartClusters();

function nextRoll(state: number, exclusiveMax: number): { readonly state: number; readonly roll: number } {
  const step = nextRngUint32(state);
  return { state: step.state, roll: step.value % exclusiveMax };
}

export function createCitySpawner(seed: number): CitySpawnerState {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be an integer');
  if (START_CLUSTERS.length === 0) throw new Error('City dataset has no viable starting region');
  let rng = seed >>> 0;
  let draw = nextRoll(rng, START_CLUSTERS.length);
  rng = draw.state;
  const cluster = START_CLUSTERS[draw.roll].members;
  draw = nextRoll(rng, SPAWNER_START_CITY_MAX - SPAWNER_START_CITY_MIN + 1);
  rng = draw.state;
  const count = SPAWNER_START_CITY_MIN + draw.roll;
  const options = cluster.slice(1);
  // Fisher–Yates for variable starting groups without breaking pairwise spacing.
  for (let i = options.length - 1; i > 0; i--) {
    draw = nextRoll(rng, i + 1);
    rng = draw.state;
    const tmp = options[i];
    options[i] = options[draw.roll];
    options[draw.roll] = tmp;
  }
  return {
    paramsVersion: SPAWNER_PARAMS_VERSION,
    rngState: rng,
    activeCityIndices: [cluster[0], ...options.slice(0, count - 1)],
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

function chooseNextCity(active: readonly number[], state: number): {
  readonly index: number | null;
  readonly rngState: number;
} {
  const candidates: number[] = [];
  const weights: number[] = [];
  let totalWeight = 0;
  for (let index = 0; index < CITIES.length; index++) {
    let nearestKm = 20016;
    for (const existing of active) {
      const km = distanceKm(index, existing);
      if (km < nearestKm) nearestKm = km;
      if (nearestKm < SPAWNER_MIN_CITY_DISTANCE_KM) break;
    }
    if (nearestKm < SPAWNER_MIN_CITY_DISTANCE_KM) continue;
    const weight = proximityWeight(nearestKm);
    candidates.push(index);
    weights.push(weight);
    totalWeight += weight;
  }
  if (candidates.length === 0) return { index: null, rngState: state };
  const draw = nextRoll(state, totalWeight);
  let ticket = draw.roll;
  for (let i = 0; i < candidates.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return { index: candidates[i], rngState: draw.state };
  }
  throw new Error('Invalid weighted city selection');
}

// Call with the authoritative integer game tick; skipping ticks catches up identically.
export function advanceCitySpawner(state: CitySpawnerState, gameTick: number): SpawnResult {
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

  let rngState = state.rngState;
  let nextSpawnTick: number | null = state.nextSpawnTick;
  const active = [...state.activeCityIndices];
  const spawned: number[] = [];
  while (nextSpawnTick !== null && gameTick >= nextSpawnTick) {
    if (active.length >= SPAWNER_MAX_CITIES) {
      nextSpawnTick = null;
      break;
    }
    const result = chooseNextCity(active, rngState);
    rngState = result.rngState;
    if (result.index === null) {
      nextSpawnTick = null; // Dataset exhausted under the 6-degree restriction.
      break;
    }
    active.push(result.index);
    spawned.push(result.index);
    nextSpawnTick += SPAWNER_INTERVAL_TICKS;
    if (active.length >= SPAWNER_MAX_CITIES) nextSpawnTick = null;
  }
  return {
    state: {
      paramsVersion: state.paramsVersion,
      rngState,
      activeCityIndices: active,
      nextSpawnTick,
      lastTick: gameTick,
    },
    spawnedCityIndices: spawned,
  };
}

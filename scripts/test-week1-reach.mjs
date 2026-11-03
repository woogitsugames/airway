// [night-12f] D-95 / D-105 / D-99: week 1 is fair. Before the first weekly board (the first chance of a widebody)
// every airport — the start group and each new one — must be within turboprop range of an active airport, so no
// week-1 loss is one the starting fleet could not have answered. Also Q-58: Alexandria is in Cairo's region.
// Pure spawner + data checks on many seeds; runs in well under a second.
import { strict as assert } from 'node:assert';
import './ts-test-loader.mjs';

const { Rng } = await import('../src/core/rng.ts');
const { CITIES } = await import('../src/data/cities.ts');
const { distanceKm } = await import('../src/data/generated/distances.ts');
const { createCitySpawner, advanceCitySpawner } = await import('../src/sim/spawner.ts');
const { PLANE_TYPES, SIM_MINUTES_PER_WEEK, SPAWNER_INTERVAL_TICKS } = await import('../src/sim/params.ts');

const REACH_KM = PLANE_TYPES.turboprop.rangeKm;
const SEEDS = 400;
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const nearestKm = (index, active) => Math.min(...active.filter((other) => other !== index).map((other) => distanceKm(index, other)));

/** Spawner run of one seed up to the end of week 1: start group and the cities spawned before the first board. */
function weekOne(seed) {
  const rng = new Rng(seed >>> 0).fork('cities');
  let state = createCitySpawner(rng);
  const start = [...state.activeCityIndices];
  const spawned = [];
  for (let tick = SPAWNER_INTERVAL_TICKS; tick < SIM_MINUTES_PER_WEEK; tick += SPAWNER_INTERVAL_TICKS) {
    const before = [...state.activeCityIndices];
    const next = advanceCitySpawner(state, tick, rng);
    for (const index of next.spawnedCityIndices) spawned.push({ index, before: [...before] });
    state = next.state;
  }
  return { start, spawned };
}

const runs = Array.from({ length: SEEDS }, (_, i) => ({ seed: 0xa1a1 + i, ...weekOne(0xa1a1 + i) }));

test(`${SEEDS} seeds: every week-1 airport opens within ${REACH_KM} km of an active airport`, () => {
  const far = [];
  for (const run of runs) {
    for (const { index, before } of run.spawned) {
      const km = nearestKm(index, before);
      if (km > REACH_KM) far.push(`${CITIES[index].code}@${run.seed.toString(16)} ${km} km`);
    }
  }
  const total = runs.reduce((sum, run) => sum + run.spawned.length, 0);
  console.log(`  week-1 spawns=${total} beyond_reach=${far.length}`);
  assert.equal(far.length, 0, `${far.length} week-1 airports beyond turboprop reach, e.g. ${far.slice(0, 3).join(', ')}`);
});

test(`${SEEDS} seeds: every start airport is within ${REACH_KM} km of another start airport`, () => {
  const far = [];
  for (const run of runs) {
    for (const index of run.start) {
      const km = nearestKm(index, run.start);
      if (km > REACH_KM) far.push(`${CITIES[index].code}@${run.seed.toString(16)} ${km} km`);
    }
  }
  console.log(`  start airports=${runs.reduce((sum, run) => sum + run.start.length, 0)} beyond_reach=${far.length}`);
  assert.equal(far.length, 0, `${far.length} start airports beyond turboprop reach, e.g. ${far.slice(0, 3).join(', ')}`);
});

test('week 1 still opens new airports (the rule narrows the draw, it does not stop it)', () => {
  for (const run of runs) assert.ok(run.spawned.length >= 3, `seed ${run.seed.toString(16)}: ${run.spawned.length} week-1 spawns`);
});

test('after week 1 the draw is global again (far airports can open from week 2)', () => {
  let far = 0;
  for (let i = 0; i < 100; i++) {
    const rng = new Rng((0xa1a1 + i) >>> 0).fork('cities');
    let state = createCitySpawner(rng);
    for (let tick = SPAWNER_INTERVAL_TICKS; tick <= SIM_MINUTES_PER_WEEK * 4; tick += SPAWNER_INTERVAL_TICKS) {
      const before = [...state.activeCityIndices];
      const next = advanceCitySpawner(state, tick, rng);
      if (tick >= SIM_MINUTES_PER_WEEK) for (const index of next.spawnedCityIndices) if (nearestKm(index, before) > REACH_KM) far++;
      state = next.state;
    }
  }
  console.log(`  weeks 2-4 spawns beyond reach (100 seeds)=${far}`);
  assert.ok(far > 0, 'no far airport after week 1: the reach rule leaked past the first board');
});

test('Q-58: Alexandria is in the same region as Cairo (ME)', () => {
  const alexandria = CITIES.find((city) => city.code === 'ALX');
  const cairo = CITIES.find((city) => city.code === 'CAI');
  assert.equal(cairo?.region, 'ME');
  assert.equal(alexandria?.region, cairo?.region);
});

console.log(`SUMMARY test:week1-reach seed=0xA1A1 seeds=${SEEDS} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

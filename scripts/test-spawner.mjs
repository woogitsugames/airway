// [task-05] Check seeded replay, six-degree spacing, local starts, timing, and 40-city cap.
import { strict as assert } from 'node:assert';
import { loadTask05Modules } from './test-05-loader.mjs';
import './ts-test-loader.mjs';
const { Rng } = await import('../src/core/rng.ts');
const citiesStream = (seed) => new Rng(seed >>> 0).fork('cities');

const SEED = '0xA1A1';
let assertions = 0;
let testedSeeds = 0;
const errors = [];
let modules;
try {
  modules = loadTask05Modules();
  const { CITIES } = modules.cities;
  const { distanceKm } = modules.distances;
  const spawner = await import('../src/sim/spawner.ts');
  const { SPAWNER_MAX_CITIES, SPAWNER_MIN_CITY_DISTANCE_KM, SPAWNER_INTERVAL_TICKS,
    SPAWNER_START_RADIUS_KM } = modules.params;
  const starts = new Set();
  const seeds = [0, 1, 2, 3, 5, 42, 57, 128, 777, 0xA1A1, 0xDEADBEEF, 0xFFFFFFFF,
    0x12345678, 0x87654321, 9001, 100003];
  for (const seed of seeds) {
    const rng = citiesStream(seed);
    const advanceCitySpawner = (state, tick) => spawner.advanceCitySpawner(state, tick, rng);
    let incremental = spawner.createCitySpawner(rng);
    const first = JSON.stringify(incremental);
    assert.equal(first, JSON.stringify(spawner.createCitySpawner(citiesStream(seed))));
    assert.ok(incremental.activeCityIndices.length >= 3 && incremental.activeCityIndices.length <= 4);
    starts.add(incremental.activeCityIndices.join(','));
    const anchorIndex = incremental.activeCityIndices[0];
    for (const index of incremental.activeCityIndices) {
      assert.ok(distanceKm(index, anchorIndex) <= SPAWNER_START_RADIUS_KM);
    }
    // Demand only targets other regions, so every start mixes at least two regions.
    assert.ok(new Set(incremental.activeCityIndices.map((index) => CITIES[index].region)).size >= 2,
      `single-region start for seed ${seed}`);
    let before = advanceCitySpawner(incremental, SPAWNER_INTERVAL_TICKS - 1);
    assert.equal(before.spawnedCityIndices.length, 0);
    assert.equal(before.state.activeCityIndices.length, incremental.activeCityIndices.length);
    incremental = before.state;
    let lastCount = incremental.activeCityIndices.length;
    for (let tick = SPAWNER_INTERVAL_TICKS; tick <= SPAWNER_INTERVAL_TICKS * 45; tick += SPAWNER_INTERVAL_TICKS) {
      const next = advanceCitySpawner(incremental, tick);
      incremental = next.state;
      assert.ok(next.spawnedCityIndices.length <= 1);
      assert.ok(incremental.activeCityIndices.length >= lastCount);
      assert.ok(incremental.activeCityIndices.length <= SPAWNER_MAX_CITIES);
      const used = incremental.activeCityIndices;
      assert.equal(new Set(used).size, used.length);
      for (let i = 0; i < used.length; i++) {
        for (let j = 0; j < i; j++) {
          assert.ok(distanceKm(used[i], used[j]) >= SPAWNER_MIN_CITY_DISTANCE_KM,
            `too close: ${CITIES[used[i]].code}, ${CITIES[used[j]].code}, seed ${seed}`);
          const a = CITIES[used[i]];
          const b = CITIES[used[j]];
          const rad = Math.PI / 180;
          const dLat = (a.lat - b.lat) * rad;
          const dLon = (a.lon - b.lon) * rad;
          const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
          const angularDegrees = 2 * Math.asin(Math.min(1, Math.sqrt(h))) / rad;
          assert.ok(angularDegrees >= 6, `great-circle spacing under 6 degrees: ${a.code}, ${b.code}`);
          assertions++;
        }
      }
      lastCount = used.length;
    }
    assert.equal(incremental.activeCityIndices.length, SPAWNER_MAX_CITIES);
    assert.equal(incremental.nextSpawnTick, null);
    const replayRng = citiesStream(seed);
    const replay = spawner.advanceCitySpawner(spawner.createCitySpawner(replayRng), SPAWNER_INTERVAL_TICKS * 45, replayRng).state;
    assert.equal(replayRng.state, rng.state, 'skipping ticks must consume the same city stream');
    assert.deepEqual(replay, incremental, 'skipping ticks must match single-step replay');
    assert.deepEqual(JSON.parse(JSON.stringify(replay)), replay, 'save state must be JSON-serializable');
    assert.deepEqual(advanceCitySpawner(replay, SPAWNER_INTERVAL_TICKS * 50).state.activeCityIndices,
      replay.activeCityIndices, 'after cap no more city spawns');
    testedSeeds++;
  }
  assert.ok(starts.size >= 10, 'independent seeds should yield varied starts');
  const r1 = citiesStream(1);
  assert.throws(() => spawner.advanceCitySpawner(spawner.createCitySpawner(r1), -1, r1), RangeError);
  assert.throws(() => spawner.advanceCitySpawner(spawner.advanceCitySpawner(spawner.createCitySpawner(r1), 500, r1).state, 499, r1), RangeError);
} catch (error) {
  errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  modules?.dispose();
}
for (const error of errors) console.error('FAIL ' + error);
console.log(`SUMMARY test:spawner seed=${SEED} seeds=${testedSeeds} pairsChecked=${assertions} passed=${errors.length ? 0 : 1} failed=${errors.length}`);
if (errors.length) process.exitCode = 1;

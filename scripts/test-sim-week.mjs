import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { rngRoot, city, fullyConnectedDistances, assertBalance } from './sim-fixtures.mjs';
const { PassengerSimulation } = await import('../src/sim/sim.ts');
const { SIM_MINUTES_PER_DAY, SIM_DAYS_PER_WEEK } = await import('../src/sim/params.ts');

const WEEK = SIM_MINUTES_PER_DAY * SIM_DAYS_PER_WEEK;
const SEEDS = [0xA1A1, 0xB2B2, 0xC3C3];
const cities = [
  city('A', 'EUS', 4_000_000, 60), city('B', 'NAM', 3_000_000, -300),
  city('C', 'AFR', 2_000_000, 120), city('D', 'ME', 5_000_000, 180),
];
const distances = fullyConnectedDistances(cities.map((c) => c.cityId));
const make = (seed, network) => {
  const s = new PassengerSimulation(cities, distances, rngRoot(seed));
  if (network) {
    s.apply({ type: 'AddRoute', routeId: 'R1', cities: ['A', 'B', 'C'] });
    s.apply({ type: 'AddRoute', routeId: 'R2', cities: ['C', 'D'] });
    s.apply({ type: 'AddRoute', routeId: 'R3', cities: ['B', 'D'] });
  }
  return s;
};
function teleportPassengers(sim) {
  for (const route of sim.network.routes) for (let direction = 0; direction < 2; direction++) {
    const stops = direction === 0 ? [...route.cities] : [...route.cities].reverse();
    let manifest = [];
    for (let i = 0; i < stops.length; i++) {
      if (i > 0) {
        const results = sim.alightAt(stops[i], route.id, manifest, stops[i + 1]);
        manifest = [...results.stayingOnboard];
      }
      if (i + 1 < stops.length) {
        const boarded = sim.boardAt(stops[i], route.id, 16 - manifest.length, stops[i + 1]);
        manifest.push(...boarded.map((p) => p.id));
      }
    }
    assert.equal(manifest.length, 0, 'teleport aircraft always finishes at the final stop');
  }
}
function advance(sim, targetTick, transport = true) {
  while (sim.tick < targetTick && !sim.failed) {
    if (transport && sim.tick % 20 === 0) teleportPassengers(sim);
    sim.step();
  }
}

let tests = 0;
const hashes = [];
const failTicks = [];
try {
  for (const seed of SEEDS) {
    const run = make(seed, true);
    advance(run, 3 * SIM_MINUTES_PER_DAY);
    assert.equal(run.failed, false, `seed ${seed}: sufficient network must stay alive`);
    const checkpoint = JSON.parse(JSON.stringify(run.snapshot()));
    const resumed = make(seed, false);
    resumed.restore(checkpoint);
    assert.equal(run.hash(), resumed.hash(), 'checkpoint hash');
    advance(run, WEEK);
    advance(resumed, WEEK);
    assert.equal(run.failed, false, 'full week must survive with sufficient transport');
    assert.equal(resumed.hash(), run.hash(), 'RNG stream and passenger state must replay after restore');
    assert.ok(run.score > 0, 'week must deliver some passengers');
    assertBalance(assert, run);
    hashes.push(`${seed.toString(16)}:${run.hash()}`);
    tests++;

    const blocked = make(seed, false);
    advance(blocked, WEEK, false);
    assert.equal(blocked.failed, true, 'insufficient routes must trigger failure');
    assert.ok(blocked.failure.tick < WEEK);
    const blockedAgain = make(seed, false);
    advance(blockedAgain, WEEK, false);
    assert.equal(blockedAgain.failure.tick, blocked.failure.tick, 'failure tick must be deterministic');
    assert.equal(blockedAgain.hash(), blocked.hash(), 'same seed must replay exactly');
    failTicks.push(`${seed.toString(16)}:${blocked.failure.tick}`);
    tests++;
  }
  const expectedHashes = ['a1a1:1570912c', 'b2b2:008558de', 'c3c3:a0d4688d'];
  assert.deepEqual(hashes, expectedHashes, 'deterministic week hashes changed');
  assert.deepEqual(failTicks, ['a1a1:824', 'b2b2:824', 'c3c3:824'], 'locked congestion failure ticks');
  console.log(`SUMMARY test:sim-week seeds=3 weekTicks=${WEEK} cases=${tests} passed=${tests} failed=0 hashes=${hashes.join(',')} failTicks=${failTicks.join(',')}`);
} catch (e) {
  console.error(e);
  console.log(`SUMMARY test:sim-week seeds=3 weekTicks=${WEEK} cases=${tests} passed=${tests} failed=1 hashes=${hashes.join(',')} failTicks=${failTicks.join(',')}`);
  process.exitCode = 1;
}

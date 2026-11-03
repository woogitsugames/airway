import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { demandRng, city, fullyConnectedDistances, assertBalance } from './sim-fixtures.mjs';
const { PassengerSimulation } = await import('../src/sim/passengers.ts');
const { SIM_MINUTES_PER_DAY, SIM_DAYS_PER_WEEK } = await import('../src/sim/params.ts');

const WEEK = SIM_MINUTES_PER_DAY * SIM_DAYS_PER_WEEK;
const SEEDS = [0xA1A1, 0xB2B2, 0xC3C3];
const cities = [
  city('A', 'EUS', 12_000_000, 1), city('B', 'NAM', 9_000_000, -5),
  city('C', 'AFR', 6_000_000, 2), city('D', 'ME', 15_000_000, 3),
];
const distances = fullyConnectedDistances(cities.map((c) => c.cityId));
const streams = new WeakMap();
const make = (seed, network) => {
  const rng = demandRng(seed);
  const s = new PassengerSimulation(cities, distances, rng);
  streams.set(s, rng);
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
    // [task-31] Checkpoint after day 1 and run both copies to the end of the (3-day, D-40) week. The old
    // `WEEK - 3 days` target was an absolute tick, so with 7-day weeks the "full week" only reached day 4.
    advance(run, SIM_MINUTES_PER_DAY);
    assert.equal(run.failed, false, `seed ${seed}: sufficient network must stay alive`);
    const checkpoint = JSON.parse(JSON.stringify(run.snapshot()));
    const resumed = make(seed, false);
    resumed.restore(checkpoint);
    // The kernel persists the demand stream state next to the world snapshot.
    streams.get(resumed).setState(streams.get(run).state);
    assert.equal(run.hash(), resumed.hash(), 'checkpoint hash');
    advance(run, WEEK);
    advance(resumed, WEEK);
    assert.equal(run.tick, WEEK, 'the run must reach the end of the week');
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
  // [task-31] Re-locked for the 3-day week (D-40) and waiting capacities 36/24 (end-of-week state, day 3).
  // [night-12f] Re-locked for rules v5 (D-95/D-105/D-106: week-1 reach, 12 h spawns, demand 130 %, ALX in ME);
  // the unserved world now jams at tick 2174 instead of 2619 (demand 1.3x).
  const expectedHashes = ['a1a1:7b1ed586', 'b2b2:14760e40', 'c3c3:1aea8e84'];
  assert.deepEqual(hashes, expectedHashes, 'deterministic week hashes changed');
  assert.deepEqual(failTicks, ['a1a1:2174', 'b2b2:2174', 'c3c3:2174'], 'locked congestion failure ticks');
  console.log(`SUMMARY test:sim-week seeds=3 weekTicks=${WEEK} cases=${tests} passed=${tests} failed=0 hashes=${hashes.join(',')} failTicks=${failTicks.join(',')}`);
} catch (e) {
  console.error(e);
  console.log(`SUMMARY test:sim-week seeds=3 weekTicks=${WEEK} cases=${tests} passed=${tests} failed=1 hashes=${hashes.join(',')} failTicks=${failTicks.join(',')}`);
  process.exitCode = 1;
}

import assert from 'node:assert/strict';
import { clockAt, TICKS_PER_DAY, TICKS_PER_WEEK, ticksPerSecond } from '../src/sim/clock.ts';
import { Sim } from '../src/sim/sim.ts';
import { MAX_CHECKPOINTS } from '../src/sim/undo.ts';
import { canonicalJson } from '../src/sim/state.ts';

const SEED = 0xa1a1;
let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

function schedule(sim: Sim, tick: number): void {
  if (tick % 733 === 0) sim.apply({
    type: 'AddRoute', routeId: `r${tick}`, fromCityId: 'WAW', toCityId: 'BRU', flightTicks: 102,
  });
  if (tick % 997 === 0) sim.apply({ type: 'AssignPlane', planeId: `p${tick}`, routeId: `r${tick - (tick % 733)}` });
  if (tick % 1111 === 0) sim.apply({ type: 'SetSpeed', speed: tick % 2 === 0 ? 2 : 4 });
}
function advance(sim: Sim, start: number, last: number): void {
  for (let tick = start + 1; tick <= last; tick++) { schedule(sim, tick); sim.tick(); }
}

check('calendar boundaries and fixed rates', () => {
  assert.deepEqual([0, 1, 2, 4].map((speed) => ticksPerSecond(speed as 0 | 1 | 2 | 4)), [0, 10, 20, 40]);
  assert.deepEqual([clockAt(0).hour, clockAt(60).hour, clockAt(TICKS_PER_DAY).dayOfWeek,
    clockAt(TICKS_PER_WEEK).week], [0, 1, 2, 2]);
  assert.equal(clockAt(TICKS_PER_DAY - 1).minuteOfDay, 1439);
  assert.throws(() => clockAt(-1), RangeError);
});
check('queued commands run at the boundary and are copied', () => {
  const sim = new Sim(SEED);
  const input = { type: 'RemoveRoute' as const, routeId: 'one' };
  const originalHash = sim.hash();
  sim.apply(input);
  assert.equal(sim.tickCount, 0);
  assert.equal(sim.hash(), originalHash);
  assert.equal(sim.getCommandLog().length, 0);
  (input as { routeId: string }).routeId = 'changed';
  sim.tick();
  assert.deepEqual(sim.getCommandLog(), [[1, { type: 'RemoveRoute', routeId: 'one' }]]);
  assert.notEqual(sim.hash(), originalHash);
  const log = sim.getCommandLog();
  (log[0][1] as { routeId: string }).routeId = 'external';
  assert.equal((sim.getCommandLog()[0][1] as { routeId: string }).routeId, 'one');
  const state = sim.getState();
  state.rng.cities = 0;
  assert.notEqual(sim.getState().rng.cities, 0);
});
check('paused scheduler can resume without a zero-speed deadlock', () => {
  const sim = new Sim(SEED);
  sim.apply({ type: 'SetSpeed', speed: 0 });
  assert.equal(sim.schedulingSpeed, 1);
  sim.tick();
  assert.equal(sim.speed, 0);
  assert.equal(sim.schedulingSpeed, 0);
  sim.apply({ type: 'SetSpeed', speed: 2 });
  assert.equal(sim.schedulingSpeed, 2);
  assert.equal(sim.speed, 0);
  sim.tick();
  assert.equal(sim.speed, 2);
  assert.equal(sim.schedulingSpeed, 2);
});
check('canonical JSON ignores object insertion order', () => {
  assert.equal(canonicalJson({ b: 1, a: { z: [1, 2], x: 3 } }),
    canonicalJson({ a: { x: 3, z: [1, 2] }, b: 1 }));
  assert.throws(() => canonicalJson({ bad: NaN }), TypeError);
});
check('50,000 ticks replay to the exact hash and log', () => {
  const sim = new Sim(SEED);
  advance(sim, 0, 50_000);
  const replay = Sim.replay(SEED, sim.getCommandLog(), 50_000);
  assert.equal(replay.hash(), sim.hash());
  assert.equal(sim.tickCount, 50_000);
  assert.ok(sim.getCommandLog().length > 100);
  assert.ok(JSON.parse(sim.snapshot()).checkpoints.length <= MAX_CHECKPOINTS);
  assert.notEqual(Sim.replay(SEED + 1, sim.getCommandLog(), 50_000).hash(), sim.hash());
});
check('snapshot restore resumes at exact tick with queued commands', () => {
  const uninterrupted = new Sim(SEED);
  advance(uninterrupted, 0, 25_000);
  uninterrupted.apply({ type: 'SetSpeed', speed: 0 });
  const restored = Sim.fromSnapshot(uninterrupted.snapshot());
  assert.equal(restored.hash(), uninterrupted.hash());
  assert.equal(restored.pendingCount, 1);
  uninterrupted.tick(); restored.tick();
  for (let t = 25_002; t <= 50_000; t++) {
    schedule(uninterrupted, t); schedule(restored, t);
    uninterrupted.tick(); restored.tick();
  }
  assert.equal(restored.hash(), uninterrupted.hash());
  assert.deepEqual(restored.getCommandLog(), uninterrupted.getCommandLog());
});
check('restore rejects incompatible and tampered save', () => {
  const sim = new Sim(SEED);
  sim.apply({ type: 'SetSpeed', speed: 2 }); sim.tick();
  const save = JSON.parse(sim.snapshot());
  save.version = 2;
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(save)), /unsupported/);
  save.version = 1; save.state.commandDigest++;
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(save)), /digest mismatch/);
});
console.log(`SUMMARY test:sim-kernel seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

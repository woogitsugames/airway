import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.ts';
import { CHECKPOINT_EVERY_TICKS } from '../src/sim/undo.ts';

const SEED = 0xa1a1;
let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
const skip = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.tick(); };
const route = (id: string) => ({ type: 'RemoveRoute' as const, routeId: id });

check('undo of queued action does not advance time', () => {
  const sim = new Sim(SEED);
  const before = sim.hash();
  assert.equal(sim.undo(), false);
  sim.apply(route('pending'));
  assert.equal(sim.undo(), true);
  assert.equal(sim.pendingCount, 0);
  assert.equal(sim.hash(), before);
});
check('undo restores exact hash at the same tick', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, 10); skip(reference, 11);
  edited.apply(route('test'));
  edited.tick();
  assert.notEqual(edited.hash(), reference.hash());
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), reference.hash());
  assert.equal(edited.tickCount, 11);
});
check('undo last of two same-tick commands, then first', () => {
  const edited = new Sim(SEED);
  const once = new Sim(SEED);
  const none = new Sim(SEED);
  edited.apply(route('first'));
  edited.apply(route('second'));
  once.apply(route('first'));
  edited.tick(); once.tick(); none.tick();
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), once.hash());
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), none.hash());
  assert.equal(edited.undo(), false);
});
check('checkpoint exactly at command boundary is not reused', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, CHECKPOINT_EVERY_TICKS - 1);
  edited.apply(route('on-boundary'));
  edited.tick();
  skip(reference, CHECKPOINT_EVERY_TICKS);
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), reference.hash());
});
check('undo across checkpoints retains older actions', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, 100); skip(reference, 100);
  edited.apply(route('kept')); reference.apply(route('kept'));
  edited.tick(); reference.tick();
  skip(edited, 1_200); skip(reference, 1_200);
  edited.apply({ type: 'SetSpeed', speed: 4 });
  edited.tick(); reference.tick();
  assert.equal(edited.undo(), true);
  assert.equal(edited.speed, 1);
  assert.equal(edited.hash(), reference.hash());
});
check('undo after snapshot restore keeps the exact old state', () => {
  const sim = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(sim, 1_258); skip(reference, 1_258);
  sim.apply(route('saved-edit'));
  sim.tick(); reference.tick();
  const restored = Sim.fromSnapshot(sim.snapshot());
  assert.equal(restored.undo(), true);
  assert.equal(restored.hash(), reference.hash());
});
check('undo still works after bounded checkpoint ring eviction', () => {
  const sim = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(sim, 40_000); skip(reference, 40_000);
  sim.apply(route('late')); sim.tick(); reference.tick();
  assert.equal(sim.undo(), true);
  assert.equal(sim.hash(), reference.hash());
});
console.log(`SUMMARY test:undo seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

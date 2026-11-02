import assert from 'node:assert/strict';
import { chooseUpgrade, drawUpgradeOffers, mostLoadedHub, startWeeklyUpgrade, TICKS_PER_WEEK } from '../src/sim/upgrades.ts';

const SEED = 0xA1A1;
function rng(seed) {
  let state = seed >>> 0;
  return { nextInt(max) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; } };
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (error) { console.error('FAIL', name, error); process.exitCode = 1; } }
test('offers are deterministic with unique ids and guaranteed plane', () => {
  for (let seed = 0; seed < 200; seed++) {
    const a = drawUpgradeOffers(4, rng(seed)), b = drawUpgradeOffers(4, rng(seed));
    assert.deepEqual(a, b); assert.equal(new Set(a.map(x => x.id)).size, 3);
    assert.ok(a.some(x => x.id === 'turboprop' || x.id === 'widebody'));
  }
});
test('week boundary pauses exactly once per 3-day week (D-40)', () => {
  assert.equal(TICKS_PER_WEEK, 3 * 24 * 60); // [task-31]
  assert.equal(startWeeklyUpgrade(TICKS_PER_WEEK - 1, rng(SEED)), null);
  assert.equal(startWeeklyUpgrade(0, rng(SEED)), null);
  assert.equal(startWeeklyUpgrade(TICKS_PER_WEEK, rng(SEED))?.week, 1);
  assert.equal(startWeeklyUpgrade(TICKS_PER_WEEK * 2, rng(SEED))?.week, 2);
});
test('congestion stamp resolves ties by stable ID', () => {
  assert.equal(mostLoadedHub([{ hubId: 'LHR', label: 'London', waiting: 11, capacity: 12 }, { hubId: 'AMS', label: 'Amsterdam', waiting: 7, capacity: 8 }])?.hubId, 'LHR');
  assert.equal(mostLoadedHub([{ hubId: 'LHR', label: 'London', waiting: 4, capacity: 8 }, { hubId: 'AMS', label: 'Amsterdam', waiting: 4, capacity: 8 }])?.hubId, 'AMS');
});
test('hub choice requires real hub and applies capacity plus MCT', () => {
  const state = { week: 1, paused: true, offers: [{ id: 'hub-expansion', week: 1 }], pendingHub: false };
  const calls = []; const effects = { expandHub: (...args) => calls.push(args) };
  assert.equal(chooseUpgrade(state, { type: 'ChooseUpgrade', week: 1, upgrade: 'hub-expansion' }, effects, ['LHR']).pendingHub, true);
  assert.throws(() => chooseUpgrade(state, { type: 'ChooseUpgrade', week: 1, upgrade: 'hub-expansion', hubId: 'XXX' }, effects, ['LHR']));
  const chosen = chooseUpgrade(state, { type: 'ChooseUpgrade', week: 1, upgrade: 'hub-expansion', hubId: 'LHR' }, effects, ['LHR']);
  assert.deepEqual(calls, [['LHR', 6, 15]]); assert.equal(chosen.paused, false);
  assert.throws(() => chooseUpgrade(chosen, { type: 'ChooseUpgrade', week: 1, upgrade: 'hub-expansion', hubId: 'LHR' }, effects, ['LHR']));
});
test('aircraft and slot effects fire only on valid choices', () => {
  const calls = [], effects = { grantPlane: (...args) => calls.push(args), addDepartureSlots: n => calls.push(['slots', n]) };
  const s = (id) => ({ week: 2, paused: true, offers: [{ id, week: 2 }], pendingHub: false });
  chooseUpgrade(s('turboprop'), { type: 'ChooseUpgrade', week: 2, upgrade: 'turboprop' }, effects, []);
  chooseUpgrade(s('departure-slots'), { type: 'ChooseUpgrade', week: 2, upgrade: 'departure-slots' }, effects, []);
  assert.deepEqual(calls, [['turboprop', 1], ['slots', 2]]);
});
console.log(`SUMMARY test:upgrades seed=0xA1A1 cases=5 passed=${passed} failed=${5-passed}`);
if (passed !== 5) process.exitCode = 1;

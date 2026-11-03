// [night-10a] "New airport" mark timing (src/game/newAirports.ts): marked from the spawn event until a route
// serves the airport or NEW_MARK_TICKS pass; never before the overlay knows the airport; no work when idle.
import assert from 'node:assert/strict';
import { NewAirportMarks, NEW_MARK_TICKS } from '../src/game/newAirports.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const none = () => [];
const all = () => true;

test('idle: no routes read, shared empty result', () => {
  const marks = new NewAirportMarks();
  let reads = 0;
  const a = marks.update(10, 1, () => { reads++; return []; }, all);
  const b = marks.update(11, 1, () => { reads++; return []; }, all);
  assert.equal(a.length, 0);
  assert.equal(a, b);
  assert.equal(reads, 0);
});
test('spawned airport is marked once, then expires after NEW_MARK_TICKS', () => {
  const marks = new NewAirportMarks();
  marks.opened('LIS', 100);
  assert.deepEqual(marks.update(100, 1, none, all), [['LIS', true]]);
  assert.deepEqual(marks.update(101, 1, none, all), []);
  assert.ok(marks.isMarked('LIS'));
  assert.deepEqual(marks.update(100 + NEW_MARK_TICKS - 1, 1, none, all), []);
  assert.deepEqual(marks.update(100 + NEW_MARK_TICKS, 1, none, all), [['LIS', false]]);
  assert.ok(!marks.isMarked('LIS'));
  assert.deepEqual(marks.update(100 + NEW_MARK_TICKS + 1, 1, none, all), []);
});
test('a route serving the airport clears the mark; routes re-read only on a new revision', () => {
  const marks = new NewAirportMarks();
  marks.opened('LIS', 0);
  marks.opened('OSL', 0);
  let reads = 0;
  let routes: { cityIds: string[] }[] = [];
  const read = () => { reads++; return routes; };
  assert.deepEqual(marks.update(1, 1, read, all), [['LIS', true], ['OSL', true]]);
  marks.update(2, 1, read, all);
  assert.equal(reads, 1);
  routes = [{ cityIds: ['MAD', 'LIS'] }];
  assert.deepEqual(marks.update(3, 1, read, all), []); // same revision: not seen yet
  assert.deepEqual(marks.update(4, 2, read, all), [['LIS', false]]);
  assert.equal(reads, 2);
  assert.ok(marks.isMarked('OSL'));
});
test('waits until the overlay knows the airport', () => {
  const marks = new NewAirportMarks();
  marks.opened('LIS', 0);
  assert.deepEqual(marks.update(0, 1, none, () => false), []);
  assert.deepEqual(marks.update(1, 1, none, all), [['LIS', true]]);
});
test('served before it was ever shown: no change reported', () => {
  const marks = new NewAirportMarks();
  marks.opened('LIS', 0);
  assert.deepEqual(marks.update(1, 1, () => [{ cityIds: ['LIS', 'MAD'] }], () => false), []);
  assert.deepEqual(marks.update(2, 1, none, all), []);
});
console.log(`SUMMARY new-airports passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);

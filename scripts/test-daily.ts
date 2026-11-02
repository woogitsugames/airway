import assert from 'node:assert/strict';
import { dailyKey, dailySeed, isoWeekKey } from '../src/core/daily.ts';

const SEED = 0xa1a1;
let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
const at = (iso: string) => new Date(iso);

check('winter midnight in Warsaw versus UTC', () => {
  assert.equal(dailyKey(at('2025-12-31T22:59:59Z')), '2025-12-31');
  assert.equal(dailyKey(at('2025-12-31T23:00:00Z')), '2026-01-01');
});
check('summer midnight in Warsaw versus UTC', () => {
  assert.equal(dailyKey(at('2026-07-01T21:59:59Z')), '2026-07-01');
  assert.equal(dailyKey(at('2026-07-01T22:00:00Z')), '2026-07-02');
});
check('spring DST jump has no fictitious calendar day', () => {
  assert.equal(dailyKey(at('2026-03-28T22:59:59Z')), '2026-03-28');
  assert.equal(dailyKey(at('2026-03-28T23:00:00Z')), '2026-03-29');
  assert.equal(dailyKey(at('2026-03-29T00:59:59Z')), '2026-03-29');
  assert.equal(dailyKey(at('2026-03-29T01:00:00Z')), '2026-03-29');
});
check('autumn DST overlap remains one day', () => {
  assert.equal(dailyKey(at('2026-10-24T21:59:59Z')), '2026-10-24');
  assert.equal(dailyKey(at('2026-10-24T22:00:00Z')), '2026-10-25');
  assert.equal(dailyKey(at('2026-10-25T00:59:59Z')), '2026-10-25');
  assert.equal(dailyKey(at('2026-10-25T01:00:00Z')), '2026-10-25');
});
check('daily challenge seed is stable for one Warsaw date', () => {
  assert.equal(dailySeed(at('2026-11-02T02:00:00Z')), dailySeed(at('2026-11-02T22:00:00Z')));
  assert.notEqual(dailySeed(at('2026-11-02T22:00:00Z')), dailySeed(at('2026-11-02T23:00:00Z')));
});
check('ISO week-year boundaries use Warsaw day', () => {
  assert.equal(isoWeekKey(at('2020-12-31T12:00:00Z')), '2020-W53');
  assert.equal(isoWeekKey(at('2021-01-01T12:00:00Z')), '2020-W53');
  assert.equal(isoWeekKey(at('2021-01-04T12:00:00Z')), '2021-W01');
  assert.equal(isoWeekKey(at('2026-11-02T12:00:00Z')), '2026-W45');
});
check('invalid date fails explicitly', () => {
  assert.throws(() => dailyKey(new Date('invalid')), RangeError);
  assert.throws(() => dailySeed(new Date('invalid')), RangeError);
  assert.throws(() => isoWeekKey(new Date('invalid')), RangeError);
});
console.log(`SUMMARY test:daily seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

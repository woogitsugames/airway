// [night-11s] R6c: an empty dock tag counts down to the next weekly crates (src/ui/hud/crate-countdown.ts): days with
// PL plural forms, then hours, then minutes; spoken text "Next allotment in 2 days 5 h" ([night-85b] D-342); no countdown without a weekly
// board (puzzles), when it is due, or for junk input.
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/index.ts';
import { crateCountdown } from '../src/ui/hud/crate-countdown.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const short = (minutes: number | null) => crateCountdown(minutes)?.short;

test('EN: days, then hours, then minutes', () => {
  setLanguage('en');
  assert.equal(short(2 * 1440 + 5 * 60 + 3), '2 days');
  assert.equal(short(1440 + 59), '1 day');
  assert.equal(short(5 * 60 + 40), '5 h');
  assert.equal(short(40), '40 min');
  assert.equal(crateCountdown(2 * 1440 + 5 * 60)?.spoken, 'Next allotment in 2 days 5 h');
  assert.equal(crateCountdown(135)?.spoken, 'Next allotment in 2 h 15 min');
});
test('PL: plural forms and hours', () => {
  setLanguage('pl');
  assert.equal(short(1440), '1 dzień');
  assert.equal(short(2 * 1440), '2 dni');
  assert.equal(short(5 * 1440), '5 dni');
  assert.equal(short(3 * 60), '3 godz.');
  assert.equal(short(9), '9 min');
  assert.equal(crateCountdown(1440 + 60)?.spoken, 'Następny przydział za 1 dzień 1 godz.');
  setLanguage('en');
});
test('no countdown without a weekly board, when it is due, or for junk', () => {
  for (const value of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(crateCountdown(value), null);
});

console.log(`SUMMARY test:dock-countdown seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

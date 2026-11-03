// [night-10l] Best margin per puzzle (src/game/puzzleBest.ts): first clear, wider and narrower runs, clamping,
// malformed or denied storage, unknown levels dropped.
import assert from 'node:assert/strict';
import { readPuzzleMargins, recordPuzzleMargin, PUZZLE_BEST_KEY, MAX_MARGIN } from '../src/game/puzzleBest.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}
const IDS = ['01', '02', '03'];

test('first clear, better, same and narrower runs', () => {
  const storage = memory();
  const margins = readPuzzleMargins(storage, IDS);
  assert.deepEqual(margins, {});
  assert.equal(recordPuzzleMargin(storage, margins, '01', 18), 'first');
  assert.equal(recordPuzzleMargin(storage, margins, '01', 18), 'same');
  assert.equal(recordPuzzleMargin(storage, margins, '01', 12), 'same');
  assert.equal(recordPuzzleMargin(storage, margins, '01', 31.7), 'better');
  assert.deepEqual(readPuzzleMargins(storage, IDS), { '01': 31 });
});
test('clamped to 0..MAX_MARGIN', () => {
  const storage = memory();
  const margins = {};
  recordPuzzleMargin(storage, margins, '02', -5);
  recordPuzzleMargin(storage, margins, '03', 123456);
  assert.deepEqual(readPuzzleMargins(storage, IDS), { '02': 0, '03': MAX_MARGIN });
});
test('malformed values and unknown levels are dropped', () => {
  const storage = memory({ [PUZZLE_BEST_KEY]: JSON.stringify({ '01': 12, '02': 'x', '03': 1.5, '99': 40 }) });
  assert.deepEqual(readPuzzleMargins(storage, IDS), { '01': 12 });
  assert.deepEqual(readPuzzleMargins(memory({ [PUZZLE_BEST_KEY]: '[1,2]' }), IDS), {});
  assert.deepEqual(readPuzzleMargins(memory({ [PUZZLE_BEST_KEY]: '{oops' }), IDS), {});
});
test('denied storage never throws; the session keeps the value', () => {
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const margins = readPuzzleMargins(denied, IDS);
  assert.equal(recordPuzzleMargin(denied, margins, '01', 20), 'first');
  assert.equal(margins['01'], 20);
  assert.deepEqual(readPuzzleMargins(undefined, IDS), {});
});

console.log(`SUMMARY test:puzzle-best seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

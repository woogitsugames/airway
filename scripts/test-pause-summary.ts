// [night-10j] Pause sheet network summary (src/game/pauseSummary.ts): network row with/without spare aircraft,
// the fullest hub by share of capacity (stable ties), "none yet" without hubs, the crate countdown in days or
// hours and no countdown without weekly boards; PL plural forms.
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/index.ts';
import { pauseSummary } from '../src/game/pauseSummary.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const value = (rows: ReturnType<typeof pauseSummary>, key: string): string | undefined => rows.find((row) => row.key === key)?.value;

test('EN: network, fullest hub by share, board in days', () => {
  setLanguage('en');
  const rows = pauseSummary({ routes: 5, assigned: 7, spare: 2, minutesToBoard: 1440 + 6 * 60 + 12,
    hubs: [{ label: 'FRA', waiting: 14, capacity: 20 }, { label: 'NYC', waiting: 9, capacity: 10 }, { label: 'LON', waiting: 18, capacity: 30 }] });
  assert.deepEqual(rows.map((row) => row.key), ['network', 'hub', 'board']);
  assert.equal(value(rows, 'network'), '5 routes · 7 aircraft, 2\u00A0spare');
  assert.equal(value(rows, 'hub'), 'NYC 9/10');
  assert.equal(value(rows, 'board'), 'in 1 day 6 h');
});
test('EN: one route, no spare, no hub, board within the day', () => {
  setLanguage('en');
  const rows = pauseSummary({ routes: 1, assigned: 1, spare: 0, hubs: [], minutesToBoard: 135 });
  assert.equal(value(rows, 'network'), '1 route · 1 aircraft');
  assert.equal(value(rows, 'hub'), 'none yet');
  assert.equal(value(rows, 'board'), 'in 2 h 15 min');
});
test('equal share: more waiting wins, then label order; zero-capacity hubs ignored', () => {
  setLanguage('en');
  const hubs = [{ label: 'BBB', waiting: 5, capacity: 10 }, { label: 'AAA', waiting: 5, capacity: 10 },
    { label: 'CCC', waiting: 10, capacity: 20 }, { label: 'ZZZ', waiting: 3, capacity: 0 }];
  assert.equal(value(pauseSummary({ routes: 2, assigned: 2, spare: 0, hubs, minutesToBoard: null }), 'hub'), 'CCC 10/20');
  assert.equal(value(pauseSummary({ routes: 2, assigned: 2, spare: 0, hubs: hubs.slice(0, 2), minutesToBoard: null }), 'hub'), 'AAA 5/10');
});
test('no weekly boards: no countdown row', () => {
  assert.equal(pauseSummary({ routes: 0, assigned: 0, spare: 3, hubs: [], minutesToBoard: null }).length, 2);
});
test('PL plurals', () => {
  setLanguage('pl');
  const a = pauseSummary({ routes: 2, assigned: 5, spare: 1, hubs: [], minutesToBoard: 2 * 1440 + 60 });
  assert.equal(value(a, 'network'), '2 trasy · 5 samolotów, 1\u00A0w\u00A0rezerwie');
  assert.equal(value(a, 'hub'), 'jeszcze brak');
  assert.equal(value(a, 'board'), 'za 2 dni 1 godz.');
  const b = pauseSummary({ routes: 1, assigned: 1, spare: 0, hubs: [], minutesToBoard: 1440 });
  assert.equal(value(b, 'network'), '1 trasa · 1 samolot');
  assert.equal(value(b, 'board'), 'za 1 dzień 0 godz.');
  setLanguage('en');
});

console.log(`SUMMARY test:pause-summary seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

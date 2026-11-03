// [night-10n] Logbook store (src/game/logbook.ts): totals, longest flight, recent list cap, favourite hub with
// ties, the run's home hub, malformed or denied storage.
import assert from 'node:assert/strict';
import { EMPTY_LOGBOOK, LOGBOOK_KEY, RECENT_FLIGHTS, favouriteHub, localDay, readLogbook, recordFlight, runHub,
  type LogEntry } from '../src/game/logbook.ts';

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
const flight = (over: Partial<LogEntry> = {}): LogEntry =>
  ({ day: '2026-11-03', mode: 'endless', passengers: 120, weeks: 2, hub: 'LIS', ...over });

test('totals, longest flight and newest-first recent list', () => {
  const storage = memory();
  assert.deepEqual(readLogbook(storage), EMPTY_LOGBOOK);
  recordFlight(storage, flight());
  recordFlight(storage, flight({ mode: 'daily', passengers: 300, weeks: 5, hub: 'NYC' }));
  const book = recordFlight(storage, flight({ passengers: 0, weeks: 0, hub: null }));
  assert.equal(book.flights, 3);
  assert.equal(book.passengers, 420);
  assert.equal(book.weeks, 7);
  assert.equal(book.longestWeeks, 5);
  assert.deepEqual(book.recent.map((item) => item.passengers), [0, 300, 120]);
  assert.deepEqual(readLogbook(storage), book);
});
test(`recent list keeps the last ${RECENT_FLIGHTS}`, () => {
  const storage = memory();
  for (let i = 0; i < RECENT_FLIGHTS + 3; i++) recordFlight(storage, flight({ passengers: i }));
  const book = readLogbook(storage);
  assert.equal(book.flights, RECENT_FLIGHTS + 3);
  assert.equal(book.recent.length, RECENT_FLIGHTS);
  assert.equal(book.recent[0]?.passengers, RECENT_FLIGHTS + 2);
});
test('favourite hub: most flights, tie to the most recent', () => {
  const storage = memory();
  recordFlight(storage, flight({ hub: 'LIS' }));
  recordFlight(storage, flight({ hub: 'NYC' }));
  assert.deepEqual(favouriteHub(readLogbook(storage)), { code: 'NYC', flights: 1 });
  recordFlight(storage, flight({ hub: 'LIS' }));
  assert.deepEqual(favouriteHub(readLogbook(storage)), { code: 'LIS', flights: 2 });
  assert.equal(favouriteHub(EMPTY_LOGBOOK), null);
});
test('run hub: hub on most routes, else the busiest airport, ties alphabetical', () => {
  const cities = [{ id: 'LIS', hub: false }, { id: 'MAD', hub: true }, { id: 'PAR', hub: false }, { id: 'LON', hub: true }];
  const routes = [{ cityIds: ['LIS', 'PAR'] }, { cityIds: ['LIS', 'MAD'] }, { cityIds: ['LIS', 'LON'] }, { cityIds: ['MAD', 'PAR'] }];
  assert.equal(runHub(cities, routes), 'MAD');
  assert.equal(runHub(cities, routes.slice(0, 3)), 'LON'); // LON and MAD on one route each
  assert.equal(runHub(cities.map((city) => ({ ...city, hub: false })), routes), 'LIS');
  assert.equal(runHub(cities, []), null);
});
test('malformed records and entries are dropped; bad flights are not logged', () => {
  assert.deepEqual(readLogbook(memory({ [LOGBOOK_KEY]: '{oops' })), EMPTY_LOGBOOK);
  assert.deepEqual(readLogbook(memory({ [LOGBOOK_KEY]: '[1]' })), EMPTY_LOGBOOK);
  assert.deepEqual(readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify({ flights: -1, passengers: 0, weeks: 0, longestWeeks: 0 }) })), EMPTY_LOGBOOK);
  const book = readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify({ flights: 2, passengers: 5, weeks: 1, longestWeeks: 1,
    hubs: { LIS: 2, bad: 3, NYC: 'x' }, recent: [flight(), { day: 'today' }, flight({ hub: 'lis' })] }) }));
  assert.deepEqual(book.hubs, { LIS: 2 });
  assert.equal(book.recent.length, 2);
  assert.equal(book.recent[1]?.hub, null);
  const storage = memory();
  assert.deepEqual(recordFlight(storage, flight({ passengers: 1.5 })), EMPTY_LOGBOOK);
  assert.equal(storage.data.size, 0);
});
test('denied storage never throws and still returns the session value', () => {
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(readLogbook(denied), EMPTY_LOGBOOK);
  assert.equal(recordFlight(denied, flight()).flights, 1);
  assert.equal(recordFlight(undefined, flight()).flights, 1);
});
test('hub table stays bounded', () => {
  const storage = memory();
  for (let i = 0; i < 60; i++) {
    const code = String.fromCharCode(65 + Math.floor(i / 26) % 26, 65 + (i % 26), 65);
    recordFlight(storage, flight({ hub: code }));
  }
  assert.ok(Object.keys(readLogbook(storage).hubs).length <= 40);
});
test('local day', () => { assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05'); });

console.log(`SUMMARY test:logbook seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

// [night-12am] R1o, D-227: closed-test logbook export. The logbook keeps per-run notes (length at 1x, slot holds,
// hub / "+2 slots" card offers and picks) for the last 30 runs and a daily-challenge count; EndlessRun reports them
// at game over (checked on a fake sim and on a real bot run); "Copy summary" prints them in PL and EN exactly as
// docs/PLAYTEST.md shows; the protocol covers Q-73, Q-78 and Q-80; the export stays local (no network path).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMPTY_LOGBOOK, LOGBOOK_KEY, RUN_NOTES, readLogbook, recordFlight, type LogEntry, type Logbook, type RunNote,
  type RunStats } from '../src/game/logbook.ts';
import { EndlessRun } from '../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../src/game/dev/autoplay.ts';
import { readTutorialOutcome, TUTORIAL_KEY } from '../src/game/tutorial/controller.ts';
import { logbookSummary } from '../src/ui/logbook/summary.ts';
import { setLanguage } from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import type { Sim, UpgradeKind } from '../src/sim/index.ts';

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
const read = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const flight = (over: Partial<LogEntry> = {}): LogEntry =>
  ({ day: '2026-11-18', mode: 'endless', passengers: 120, weeks: 2, hub: 'LIS', ...over });
const stats = (over: Partial<RunStats> = {}): RunStats =>
  ({ tenths: 142, held: 0, hubOffered: 1, hubPicked: 0, slotsOffered: 0, slotsPicked: 0, ...over });

test('run notes: newest first, capped, dailies counted, a flight without stats leaves no note', () => {
  const storage = memory();
  recordFlight(storage, flight(), stats({ tenths: 1 }));
  recordFlight(storage, flight({ mode: 'daily' }), stats({ tenths: 2 }));
  let book = recordFlight(storage, flight({ mode: 'daily' }));
  assert.equal(book.flights, 3);
  assert.equal(book.dailies, 2);
  assert.deepEqual(book.runs.map((run) => run.tenths), [2, 1]);
  assert.deepEqual(book.runs[0], { day: '2026-11-18', mode: 'daily', passengers: 120, weeks: 2, ...stats({ tenths: 2 }) });
  for (let i = 0; i < RUN_NOTES + 5; i++) book = recordFlight(storage, flight(), stats({ tenths: 100 + i }));
  assert.equal(RUN_NOTES, 30);
  assert.equal(book.runs.length, RUN_NOTES);
  assert.equal(book.runs[0]?.tenths, 100 + RUN_NOTES + 4);
  assert.deepEqual(readLogbook(storage), book);
});
test('older records load with no notes; malformed notes are dropped; offered is never below picked', () => {
  const old = { flights: 4, passengers: 50, weeks: 3, longestWeeks: 2, hubs: {}, recent: [flight()] };
  const legacy = readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify(old) }));
  assert.equal(legacy.dailies, 0);
  assert.deepEqual(legacy.runs, []);
  const runs = [{ ...flight(), ...stats() }, { ...flight(), ...stats(), held: -1 }, { ...flight(), tenths: 5 },
    { ...flight(), ...stats({ hubOffered: 0, hubPicked: 2, slotsOffered: 0, slotsPicked: 1 }) }];
  const book = readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify({ ...old, dailies: 9, runs }) }));
  assert.equal(book.dailies, 4, 'dailies never exceed flights');
  assert.equal(book.runs.length, 2);
  assert.deepEqual([book.runs[1]?.hubOffered, book.runs[1]?.slotsOffered], [2, 1]);
  assert.equal(recordFlight(memory(), flight(), stats({ tenths: 1.5 })).runs.length, 0, 'a bad note is not logged');
});

/** The slice of Sim that EndlessRun.playtestStats and drainEvents read. */
function fakeSim(over: { events: unknown[]; upgrades: { upgrade: UpgradeKind }[]; wait: Record<string, number>; tick: number }): Sim {
  const world = {
    activeCityIds: () => ['LON'],
    cities: () => Object.keys(over.wait).map((id) => ({ id })),
    hubCauseLedger: (id: string) => ({ slotWaitMinutes: over.wait[id] ?? 0 }),
    cityView: () => ({ departureSlots: 2, nextSlotMinutes: 10 }),
    upgrades: over.upgrades,
  };
  return { world, tickCount: over.tick, drainEvents: () => over.events.splice(0) } as unknown as Sim;
}
test('EndlessRun.playtestStats: length at 1x, held minutes over airports, card offers and picks', () => {
  const offered = (week: number, offers: UpgradeKind[]) => ({ type: 'UpgradeOffered', minute: 0, week, offers });
  const sim = fakeSim({
    events: [offered(1, ['turboprop', 'widebody', 'hub-expansion']), offered(2, ['hub-expansion', 'departure-slots', 'widebody']),
      { type: 'DepartureHeld', minute: 0, cityId: 'LON', planeId: 'p1', first: true }, offered(3, ['turboprop', 'widebody', 'departure-slots'])],
    upgrades: [{ upgrade: 'widebody' }, { upgrade: 'hub-expansion' }, { upgrade: 'departure-slots' }],
    wait: { LON: 12, PAR: 0, NYC: 7 }, tick: 8_523,
  });
  const run = new EndlessRun(sim);
  assert.deepEqual(run.playtestStats(), { tenths: 142, held: 19, hubOffered: 1, hubPicked: 1, slotsOffered: 1, slotsPicked: 1 },
    'before draining, offers fall back to picks');
  run.drainEvents();
  assert.deepEqual(run.playtestStats(), { tenths: 142, held: 19, hubOffered: 2, hubPicked: 1, slotsOffered: 2, slotsPicked: 1 });
});
test('a real bot run reports what its weekly boards showed and what it picked', () => {
  const run = EndlessRun.create(42); // two boards, one hub pick on rules v5
  const boards = new Map<number, readonly UpgradeKind[]>();
  for (let tick = 0; tick < 60 * 60 * 10 && !run.failed; tick++) {
    if (tick % AUTOPLAY_ACTION_INTERVAL === 0) {
      const command = nextAutoplayCommand(run.sim);
      if (command) run.queue(command);
    }
    run.step();
    run.drainEvents();
    const offer = run.weeklyUpgrade;
    if (offer && !boards.has(offer.week)) boards.set(offer.week, offer.offers.map((item) => item.id));
  }
  assert.ok(boards.size >= 1, `${boards.size} boards`);
  const count = (kind: UpgradeKind) => [...boards.values()].filter((offers) => offers.includes(kind)).length;
  const picks = (kind: UpgradeKind) => run.sim.world.upgrades.filter((item) => item.upgrade === kind).length;
  let held = 0;
  for (const city of run.sim.world.cities()) held += run.sim.world.hubCauseLedger(city.id).slotWaitMinutes;
  const got = run.playtestStats();
  assert.deepEqual(got, {
    tenths: Math.round(run.tick / 60), held: Math.round(held),
    hubOffered: count('hub-expansion'), hubPicked: picks('hub-expansion'),
    slotsOffered: count('departure-slots'), slotsPicked: picks('departure-slots'),
  });
  assert.ok(got.tenths > 0 && got.hubOffered >= got.hubPicked && got.slotsOffered >= got.slotsPicked);
});

test('tutorial outcome for the summary: none, started, finished, skipped, malformed', () => {
  const save = (status: string) => memory({ [TUTORIAL_KEY]: JSON.stringify({ version: 1, status }) });
  assert.equal(readTutorialOutcome(memory()), 'none');
  assert.equal(readTutorialOutcome(null), 'none');
  assert.equal(readTutorialOutcome(save('completed')), 'completed');
  assert.equal(readTutorialOutcome(save('skipped')), 'skipped');
  assert.equal(readTutorialOutcome(save('in-progress')), 'in-progress');
  assert.equal(readTutorialOutcome(save('won')), 'none');
});

// The three-run phone of docs/PLAYTEST.md.
const note = (day: string, mode: 'endless' | 'daily', tenths: number, weeks: number, passengers: number,
  card: [number, number, number, number], held: number): RunNote =>
  ({ day, mode, tenths, weeks, passengers, hubPicked: card[0], hubOffered: card[1], slotsPicked: card[2], slotsOffered: card[3], held });
const sample: Logbook = { ...EMPTY_LOGBOOK, flights: 14, dailies: 4, runs: [
  note('2026-11-18', 'endless', 218, 3, 412, [1, 1, 0, 1], 34),
  note('2026-11-17', 'daily', 142, 2, 233, [0, 1, 0, 0], 0),
  note('2026-11-16', 'endless', 96, 1, 88, [0, 0, 0, 0], 0),
] };
const input = { book: sample, tutorial: 'completed' as const, puzzlesSolved: 6, puzzlesTotal: 40, today: '2026-11-18' };
const doc = read('docs/PLAYTEST.md');

test('EN summary is the example printed in docs/PLAYTEST.md', () => {
  setLanguage('en');
  const example = doc.match(/```text\n([\s\S]*?)\n```/)?.[1];
  assert.ok(example, 'no ```text example in PLAYTEST.md');
  assert.equal(logbookSummary(input), example);
});
test('PL summary: Polish labels, local numbers, every run, no template token', () => {
  setLanguage('pl');
  const text = logbookSummary(input);
  const lines = text.split('\n');
  assert.equal(lines.length, 11 + sample.runs.length);
  assert.match(text, /Długość biegu przy prędkości 1×: mediana 14,2 min · najdłuższy 21,8 min/);
  assert.match(text, /Karta „Rozbudowa huba”: w ofercie 2 · wybrana 1/);
  assert.match(text, /Karta „Sloty startowe”: w ofercie 1 · wybrana 0/);
  assert.match(text, /Odlot czekał na slot: w 1 z 3 biegów/);
  assert.equal(lines.at(-1), '2026-11-16 · Bez końca · 9,6 · 1 · 88 · 0/0 · 0/0 · 0');
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\b(LIS|FRA|SIN|seed|0x)\b/i, 'no airport code or seed');
});
test('no runs yet: totals and the "no details" line only', () => {
  setLanguage('en');
  const text = logbookSummary({ ...input, book: { ...EMPTY_LOGBOOK, flights: 2 }, tutorial: 'none' });
  assert.deepEqual(text.split('\n').slice(1), ['Flights: 2 (Endless 2, daily challenges 0)', 'Flight training: not opened',
    'Puzzles solved: 6 of 40', en['logbook.summary.noRuns']]);
});

test('PLAYTEST.md: 14-day protocol, PL/EN questions, Q-73/Q-78/Q-80 each with what to count', () => {
  for (const day of ['| 1 |', '| 7 |', '| 8 |', '| 14 |']) assert.ok(doc.includes(day), `day row ${day}`);
  for (const heading of ['### PL', '### EN', '### A — dzień 1', '### B — dzień 7', '### C — dzień 14']) assert.ok(doc.includes(heading), heading);
  for (const q of ['Q-73', 'Q-78', 'Q-80']) {
    const row = doc.split('\n').find((line) => line.startsWith(`| **${q}**`));
    assert.ok(row, `${q} row in "Otwarte pytania"`);
    assert.ok(doc.split('\n').some((line) => /^\| [ABC]\d /.test(line) && line.includes(q)), `${q} survey question`);
  }
  assert.ok(doc.includes(en['logbook.copy']) && doc.includes(pl['logbook.copy']), 'button named as the game names it');
  assert.ok(doc.includes('D-16') && doc.includes('D-227'));
});
test('local only: the export has no network path and the privacy sheet and decision record it', () => {
  for (const path of ['src/ui/logbook/summary.ts', 'src/ui/logbook/logbook.ts', 'src/game/logbook.ts']) {
    const code = read(path);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//, path);
  }
  assert.match(read('docs/store/privacy-declarations.md'), /"Copy summary" \(R1o, D-227/);
  assert.match(read('docs/DECISIONS.md'), /^## D-227 — .*logbook/m);
  const logbookUi = read('src/ui/logbook/logbook.ts');
  assert.doesNotMatch(logbookUi, /import\.meta\.env\.DEV/, 'Copy summary ships in release builds');
});

console.log(`SUMMARY test:playtest seed=42 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

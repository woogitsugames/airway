// [night-12ax] R1n, D-242: Endless run milestones. The pure check (src/game/milestones.ts) reads hubs, regions open and
// served, the calendar week and the score; "every region served" counts only at a weekly board; a reached milestone
// stays reached. The run reads them without touching the Sim (same hash as a raw Sim driven by the same bot, D-13).
// Bot check: 50 bot runs from 0xA1A1 (the test:balance seeds, 60 min cap) — the median run reaches the first four
// milestones; every milestone's reach is printed. The logbook keeps the flight of the first reach (Endless only),
// and the game-over row / logbook section read in PL and EN; the stamp animation stops under "Reduce motion".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MILESTONES, MIN_REGIONS_FOR_ALL, MilestoneTracker, milestoneItems, milestoneView, milestonesIn,
  type MilestoneId, type MilestoneView } from '../src/game/milestones.ts';
import { EMPTY_LOGBOOK, LOGBOOK_KEY, firstMilestones, readLogbook, recordFlight, type LogEntry } from '../src/game/logbook.ts';
import { EndlessRun } from '../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../src/game/dev/autoplay.ts';
import { createGame, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { gameOverMilestones, logbookMilestones } from '../src/ui/milestones.ts';
import { localNumber, setLanguage } from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const view = (over: Partial<MilestoneView> = {}): MilestoneView =>
  ({ hubs: 0, regionsOpen: 1, regionsServed: 0, week: 1, passengers: 0, ...over });

test('the seven milestones of R1n, in report order', () => {
  assert.deepEqual([...MILESTONES], ['first-hub', 'all-regions', 'week-2', 'week-3', 'week-5', 'passengers-500', 'passengers-1000']);
});
test('each milestone at its threshold and not one step below', () => {
  assert.deepEqual(milestonesIn(view(), true), []);
  assert.deepEqual(milestonesIn(view({ hubs: 1 }), false), ['first-hub']);
  assert.deepEqual(milestonesIn(view({ week: 2 }), false), ['week-2']);
  assert.deepEqual(milestonesIn(view({ week: 4 }), false), ['week-2', 'week-3']);
  assert.deepEqual(milestonesIn(view({ week: 5 }), false), ['week-2', 'week-3', 'week-5']);
  assert.deepEqual(milestonesIn(view({ passengers: 499 }), false), []);
  assert.deepEqual(milestonesIn(view({ passengers: 500 }), false), ['passengers-500']);
  assert.deepEqual(milestonesIn(view({ passengers: 999 }), false), ['passengers-500']);
  assert.deepEqual(milestonesIn(view({ passengers: 1000 }), false), ['passengers-500', 'passengers-1000']);
});
test('"every region served" only at a weekly board, with every open region served and at least two open', () => {
  const all = view({ regionsOpen: 4, regionsServed: 4 });
  assert.deepEqual(milestonesIn(all, false), [], 'mid-week does not count');
  assert.deepEqual(milestonesIn(all, true), ['all-regions']);
  assert.deepEqual(milestonesIn(view({ regionsOpen: 4, regionsServed: 3 }), true), []);
  assert.equal(MIN_REGIONS_FOR_ALL, 2);
  assert.deepEqual(milestonesIn(view({ regionsOpen: 1, regionsServed: 1 }), true), [], 'a one-region start is not "every region"');
});
test('milestoneView reads hubs, regions open/served, the calendar week and the score from the read model', () => {
  const cities = [{ id: 'LIS', region: 'EUS', hub: true }, { id: 'MAD', region: 'EUS', hub: false },
    { id: 'JFK', region: 'NAM', hub: false }, { id: 'GRU', region: 'SAM', hub: false }];
  const v = milestoneView(cities, [{ cityIds: ['LIS', 'MAD'] }, { cityIds: ['LIS', 'JFK'] }], 2 * TICKS_PER_WEEK - 1, TICKS_PER_WEEK, 321);
  assert.deepEqual(v, { hubs: 1, regionsOpen: 3, regionsServed: 2, week: 2, passengers: 321 });
  assert.equal(milestoneView([], [], 2 * TICKS_PER_WEEK, TICKS_PER_WEEK, -5).week, 3);
  assert.equal(milestoneView([], [], 0, TICKS_PER_WEEK, -5).passengers, 0);
});
test('the tracker keeps what was reached (a hub that later closes still counts) and lists in order', () => {
  const tracker = new MilestoneTracker();
  tracker.observe(view({ passengers: 600 }));
  tracker.observe(view({ hubs: 1 }));
  tracker.observe(view({ regionsOpen: 3, regionsServed: 3 }), true);
  tracker.observe(view({ hubs: 0 }));
  assert.deepEqual(tracker.list(), ['first-hub', 'all-regions', 'passengers-500']);
  assert.deepEqual(milestoneItems(tracker.list(), ['all-regions', 'week-5']).filter((item) => item.reached || item.first)
    .map((item) => `${item.id}:${item.first}`), ['first-hub:false', 'all-regions:true', 'passengers-500:false'],
  'first only for a reached milestone');
});

// The bot: same policy and cadence as test:balance (decision every 30 ticks), seeds from 0xA1A1, 60 min cap.
const SEEDS = 50;
const CAP_TICKS = 60 * 60 * 10;
const runs: { seed: number; minutes: number; reached: MilestoneId[] }[] = [];
for (let i = 0; i < SEEDS; i++) {
  const run = EndlessRun.create(0xA1A1 + i);
  for (let tick = 0; tick < CAP_TICKS && !run.failed; tick++) {
    if (tick % AUTOPLAY_ACTION_INTERVAL === 0) {
      const command = nextAutoplayCommand(run.sim);
      if (command) run.queue(command);
    }
    run.step();
    run.drainEvents();
  }
  runs.push({ seed: 0xA1A1 + i, minutes: run.tick / 600, reached: run.milestones() });
}
const reach = (id: MilestoneId): number => runs.filter((run) => run.reached.includes(id)).length;
const byLength = [...runs].sort((a, b) => a.minutes - b.minutes);
const median = byLength[Math.floor(SEEDS / 2)]!;
const EARLY: MilestoneId[] = ['first-hub', 'all-regions', 'week-2', 'week-3'];

test('bot: the median run reaches the first four milestones, each reached by at least half of the runs', () => {
  assert.equal(runs.filter((run) => run.minutes * 600 >= CAP_TICKS).length, 0, 'no run hit the cap');
  for (const id of EARLY) assert.ok(reach(id) * 2 >= SEEDS, `${id}: ${reach(id)}/${SEEDS}`);
  for (const id of EARLY) assert.ok(median.reached.includes(id), `median run (${median.minutes.toFixed(2)} min) reaches ${id}`);
  assert.ok(median.minutes > 10 && median.minutes < 18, `median ${median.minutes.toFixed(2)} min (D-79)`);
  // Stretch goals stay rare for the bot (a human who plays well can pass it; nothing is earned by them).
  for (const id of ['week-5', 'passengers-500', 'passengers-1000'] as const) assert.ok(reach(id) * 2 < SEEDS, `${id} is a stretch goal`);
  console.log(`  bot reach (${SEEDS} runs, median ${median.minutes.toFixed(2)} min): ` +
    MILESTONES.map((id) => `${id} ${reach(id)}`).join(' · '));
});
test('D-13: reading milestones never changes the Sim (same hash as a raw Sim driven by the same bot)', () => {
  const seed = 0xA1A1 + 7;
  const run = EndlessRun.create(seed);
  const sim = createGame(seed);
  for (let tick = 0; tick < 12_000 && !run.failed; tick++) {
    if (tick % AUTOPLAY_ACTION_INTERVAL === 0) {
      const a = nextAutoplayCommand(run.sim);
      if (a) run.queue(a);
      const b = nextAutoplayCommand(sim);
      if (b && sim.check(b).ok) sim.apply(b);
      run.milestones();
    }
    run.step();
    run.drainEvents();
    if (sim.world.status === 'running' || sim.schedulingSpeed !== 0) sim.tick();
    sim.drainEvents();
  }
  assert.equal(run.hash(), sim.hash());
  assert.ok(run.milestones().length >= 3);
  for (const path of ['src/sim/index.ts', 'src/sim/world.ts', 'src/sim/state.ts', 'src/sim/params.ts']) {
    assert.doesNotMatch(read(path), /milestone/i, `${path} knows nothing of milestones`);
  }
});

const flight = (over: Partial<LogEntry> = {}): LogEntry =>
  ({ day: '2026-11-05', mode: 'endless', passengers: 120, weeks: 2, hub: 'LIS', ...over });
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
test('logbook: the flight of the first reach, Endless only, never overwritten; older or bad records load safely', () => {
  const storage = memory();
  let book = recordFlight(storage, flight(), undefined, ['first-hub', 'week-2']);
  assert.deepEqual(book.milestones, { 'first-hub': 1, 'week-2': 1 });
  assert.deepEqual(firstMilestones(book, ['first-hub', 'week-2']), ['first-hub', 'week-2']);
  book = recordFlight(storage, flight({ mode: 'daily' }), undefined, ['week-3']);
  assert.deepEqual(book.milestones, { 'first-hub': 1, 'week-2': 1 }, 'a daily run adds no milestone');
  book = recordFlight(storage, flight(), undefined, ['first-hub', 'week-2', 'week-3', 'bogus' as MilestoneId]);
  assert.deepEqual(book.milestones, { 'first-hub': 1, 'week-2': 1, 'week-3': 3 });
  assert.deepEqual(firstMilestones(book, ['first-hub', 'week-2', 'week-3']), ['week-3']);
  assert.deepEqual(readLogbook(storage), book);
  const old = { flights: 4, passengers: 50, weeks: 3, longestWeeks: 2, hubs: {}, recent: [] };
  assert.deepEqual(readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify(old) })).milestones, {});
  const bad = { ...old, milestones: { 'first-hub': 2, 'week-2': 0, 'week-3': 9, 'week-5': 1.5, nope: 1 } };
  assert.deepEqual(readLogbook(memory({ [LOGBOOK_KEY]: JSON.stringify(bad) })).milestones, { 'first-hub': 2 });
  assert.deepEqual(EMPTY_LOGBOOK.milestones, {});
});
test('game-over row and logbook section in EN and PL; every text in both catalogs', () => {
  setLanguage('en');
  const row = gameOverMilestones(['first-hub', 'week-2', 'week-3'], ['week-3']);
  assert.equal(row.title, 'Milestones 3/7');
  assert.deepEqual(row.items.map((item) => item.text), ['First hub', 'Every region served', 'Week 2', 'Week 3', 'Week 5',
    '500 passengers', '1,000 passengers']);
  assert.deepEqual(row.items.slice(0, 4).map((item) => item.label), ['First hub: reached', 'Every region served: not reached',
    'Week 2: reached', 'Week 3: reached for the first time']);
  const book = { ...EMPTY_LOGBOOK, flights: 5, milestones: { 'first-hub': 1, 'week-3': 4 } };
  assert.deepEqual(logbookMilestones(book).slice(0, 4), [['first-hub', 'First hub', 'first on flight 1'],
    ['all-regions', 'Every region served', 'not yet'], ['week-2', 'Week 2', 'not yet'], ['week-3', 'Week 3', 'first on flight 4']]);
  setLanguage('pl');
  const plRow = gameOverMilestones(['first-hub'], []);
  assert.equal(plRow.title, 'Etapy 1/7');
  assert.deepEqual(plRow.items.map((item) => item.text), ['Pierwszy hub', 'Każdy region obsłużony', 'Tydzień 2', 'Tydzień 3',
    'Tydzień 5', '500 pasażerów', `${localNumber(1000)} pasażerów`]);
  assert.match(localNumber(1000), /^1\s000$/u, 'PL groups thousands with a space');
  assert.equal(plRow.items[1]!.label, 'Każdy region obsłużony: jeszcze nie');
  assert.deepEqual(logbookMilestones(book)[3], ['week-3', 'Tydzień 3', 'pierwszy raz w locie 4']);
  const keys = Object.keys(en).filter((key) => key.startsWith('milestone.') || key.includes('.milestones'));
  assert.equal(keys.length, 15);
  for (const key of keys) assert.ok(key in pl, `pl has ${key}`);
});
// [night-11ao] Regression: the logbook screen threw "reading 'first-hub'" for a Logbook object without `milestones`
// (pre-R1n shape, as the pseudo-320 fixture and any hand-built caller passes). Every reader must tolerate it.
test('logbook objects without milestones (pre-R1n shape) render every milestone as open and never throw', () => {
  setLanguage('en');
  const { milestones: _drop, ...rest } = { ...EMPTY_LOGBOOK, flights: 12 };
  for (const book of [rest, { ...rest, milestones: null }, { ...rest, milestones: [] }, { ...rest, milestones: 'x' }]) {
    const legacy = book as unknown as typeof EMPTY_LOGBOOK;
    const rows = logbookMilestones(legacy);
    assert.equal(rows.length, MILESTONES.length);
    assert.ok(rows.every(([, , state]) => state === 'not yet'), JSON.stringify(rows));
    assert.deepEqual(firstMilestones(legacy, ['first-hub']), []);
  }
  const storage = memory();
  const next = recordFlight(storage, flight(), undefined, ['first-hub']);
  assert.deepEqual(next.milestones, { 'first-hub': 1 });
  const logbookUi = read('src/ui/logbook/logbook.ts');
  assert.doesNotMatch(logbookUi, /data\.book\.milestones\[/, 'the logbook screen reads milestones through milestoneFlights()');
  assert.doesNotMatch(read('src/ui/milestones.ts'), /book\.milestones\[/);
});
test('wiring: Endless game over logs and shows milestones; the row is shape-coded and still under "Reduce motion"', () => {
  const session = read('src/game/session.ts');
  assert.match(session, /run\.mode === 'endless' \? \{ milestones: \{ reached: run\.milestones\(\), first: callbacks\.failureMilestones\?\.\(\) \?\? \[\] \} \}/);
  const main = read('src/main.ts');
  assert.match(main, /const reached = mode === 'endless' \? failed\.milestones\(\) : \[\];/);
  assert.match(main, /firstReached = firstMilestones\(book, reached\);/);
  assert.match(main, /failureMilestones: \(\) => firstReached/);
  const ui = read('src/ui/gameover/index.ts');
  assert.match(ui, /if \(snapshot\.milestones\) strip\.append\(milestoneRow\(/);
  assert.match(read('src/ui/logbook/logbook.ts'), /logbookMilestones\(data\.book\)/);
  const css = read('src/ui/gameover/gameover.css');
  assert.match(css, /\.airway-go-milestone\[data-reached="true"\] \.airway-go-milestone-mark \{[^}]*background: var\(--aw-ms-done\)/,
    'reached: a filled square');
  assert.match(css, /\.airway-go-milestone-mark \{[^}]*border: 1\.5px solid currentColor;/, 'open: a hollow square');
  assert.match(css, /:root\[data-airway-motion="reduce"\] \.airway-go-milestone-first \{ animation: none; \}/);
  assert.match(css, /airway-go-stamp 160ms ease-out/, 'short, no bounce');
});

console.log(`SUMMARY test:milestones seed=0xA1A1 runs=${SEEDS} median_min=${median.minutes.toFixed(2)} ` +
  MILESTONES.map((id) => `${id}=${reach(id)}`).join(' ') + ` cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

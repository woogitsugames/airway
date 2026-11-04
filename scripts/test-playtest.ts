// [night-12am] R1o, D-227: closed-test logbook export. The logbook keeps per-run notes (length at 1x, slot holds,
// hub / "+2 slots" card offers and picks) for the last 30 runs and a daily-challenge count; EndlessRun reports them
// at game over (checked on a fake sim and on a real bot run); "Copy summary" prints them in PL and EN exactly as
// docs/PLAYTEST.md shows; the protocol covers Q-73, Q-78 and Q-80; the export stays local (no network path).
// [night-12ap] R3j, D-231: each note also keeps the playtest record (real minutes, game-over cause, weekly picks,
// training state, graphics setting/preset/adaptation steps, app version); the summary ends with the `AW1:` line,
// which decodes back to the same notes and to CSV (`npm run playtest:decode`).
// [night-12aq] R3k, D-232: PLAYTEST.md has the recruitment plan, a decision table whose bot references are the numbers in
// docs/balance (game-summary.md, README N12af, r8-audit-200.csv), each row with a minimum sample and a default, and the
// production-access answer sheet with every Play Console question.
// [night-12ar] R6i: PLAYTEST.md has the first-session observation sheet (O1–O8 incl. seconds to the first route, dock,
// "nothing to do", glyph, weekly board), the two device checks (Android music focus, budget-phone vibration) and a
// threshold for each; no names in the sheet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMPTY_LOGBOOK, LOGBOOK_KEY, RUN_NOTES, readLogbook, recordFlight, type LogEntry, type Logbook, type RunNote,
  type RunStats } from '../src/game/logbook.ts';
import { EndlessRun } from '../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../src/game/dev/autoplay.ts';
import { readTutorialOutcome, TUTORIAL_KEY } from '../src/game/tutorial/controller.ts';
import { logbookSummary } from '../src/ui/logbook/summary.ts';
import { decodePlaytestRecord, encodePlaytestRecord, playtestCsv, RECORD_PREFIX, RUN_COLUMNS, SUMMARY_COLUMNS } from '../src/game/playtestRecord.ts';
import { buildCauseReport } from '../src/game/causes.ts';
import { APP_VERSION } from '../src/core/version.ts';
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

test('R3j record fields are kept per run; a bad field is dropped alone; R1o notes load without them', () => {
  const storage = memory();
  const record = { real: 253, cause: 'capacity', picks: 'WHS', tutorial: 'completed', quality: 'auto', preset: 'medium',
    adapt: 1, version: '0.1.0' } as const;
  let book = recordFlight(storage, flight(), { ...stats(), ...record });
  assert.deepEqual(book.runs[0], { day: '2026-11-18', mode: 'endless', passengers: 120, weeks: 2, ...stats(), ...record });
  assert.deepEqual(readLogbook(storage).runs[0], book.runs[0], 'stored and read back');
  book = recordFlight(storage, flight(), { ...stats(), ...record, cause: 'boredom', picks: 'WX', adapt: 4, quality: 'ultra',
    preset: 'auto', tutorial: 'won', version: 'v 1', real: -1 } as never);
  assert.deepEqual(Object.keys(book.runs[0]!).sort(), ['day', 'held', 'hubOffered', 'hubPicked', 'mode', 'passengers',
    'slotsOffered', 'slotsPicked', 'tenths', 'weeks'], 'every bad R3j field dropped, the R1o note kept');
  assert.equal(book.runs.length, 2);
});

/** The slice of Sim that EndlessRun.playtestStats and drainEvents read. */
function fakeSim(over: { events: unknown[]; upgrades: { week: number; upgrade: UpgradeKind }[]; wait: Record<string, number>; tick: number }): Sim {
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
    upgrades: [{ week: 1, upgrade: 'widebody' }, { week: 3, upgrade: 'departure-slots' }, { week: 2, upgrade: 'hub-expansion' }],
    wait: { LON: 12, PAR: 0, NYC: 7 }, tick: 8_523,
  });
  const run = new EndlessRun(sim);
  const r3j = { real: 0, picks: 'WHS' };
  assert.deepEqual(run.playtestStats(), { tenths: 142, held: 19, hubOffered: 1, hubPicked: 1, slotsOffered: 1, slotsPicked: 1, ...r3j },
    'before draining, offers fall back to picks');
  run.drainEvents();
  assert.deepEqual(run.playtestStats(), { tenths: 142, held: 19, hubOffered: 2, hubPicked: 1, slotsOffered: 2, slotsPicked: 1, ...r3j });
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
    real: 0, picks: [...run.sim.world.upgrades].sort((a, b) => a.week - b.week).map((item) => item.upgrade[0]!.toUpperCase()
      .replace('D', 'S')).join(''),
    ...(run.failed ? { cause: buildCauseReport(run.failed.ledger)[0]!.kind } : {}),
  });
  assert.ok(got.tenths > 0 && got.hubOffered >= got.hubPicked && got.slotsOffered >= got.slotsPicked);
});

test('R3j: real play time counts frames up to 0.5 s each; a failed run reports the board\'s first cause', () => {
  const run = EndlessRun.create(42);
  for (let i = 0; i < 600; i++) run.addPlayTime(1 / 60); // 10 s of frames
  run.addPlayTime(3600); // back from the background: one frame, capped
  run.addPlayTime(Number.NaN);
  run.addPlayTime(-5);
  assert.equal(run.playtestStats().real, Math.round(10.5 / 6), '10.5 s = 0.2 min in tenths');
  for (let i = 0; i < 1800; i++) run.addPlayTime(0.1); // +180 s
  assert.equal(run.playtestStats().real, Math.round(190.5 / 6));
  assert.equal(run.playtestStats().cause, undefined, 'no cause while flying');
  for (let tick = 0; tick < 60 * 60 * 60 && !run.failed; tick++) { run.step(); run.drainEvents(); } // no network: a hub jams
  assert.ok(run.failed, 'the empty network jammed');
  const cause = run.playtestStats().cause;
  assert.equal(cause, buildCauseReport(run.failed.ledger)[0]?.kind);
  assert.notEqual(cause, 'unavailable');
  assert.equal(run.playtestStats().picks, '');
});
test('session counts real time on the game screen and the weekly board only, never paused', () => {
  const session = read('src/game/session.ts');
  assert.match(session, /if \(!disposed && !paused && \(screen === 'game' \|\| screen === 'upgrade'\)\) run\.addPlayTime\(dt\);/);
  const main = read('src/main.ts');
  assert.match(main, /\.\.\.failed\.playtestStats\(\), \.\.\.deviceRecord\(\)/, 'game over logs the record');
  for (const field of ['tutorial', 'quality: readSettings().graphics', 'preset', 'adapt', 'version: APP_VERSION']) {
    assert.ok(main.includes(field), `deviceRecord sets ${field}`);
  }
  assert.match(read('vite.config.ts'), /__AIRWAY_VERSION__: JSON\.stringify\(version\)/);
  assert.equal(APP_VERSION, 'dev', 'headless reads "dev"; the build reads package.json');
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
  card: [number, number, number, number], held: number, record: RunNote extends infer N ? Partial<N> : never = {}): RunNote =>
  ({ day, mode, tenths, weeks, passengers, hubPicked: card[0], hubOffered: card[1], slotsPicked: card[2], slotsOffered: card[3], held, ...record });
const sample: Logbook = { ...EMPTY_LOGBOOK, flights: 14, dailies: 4, runs: [
  note('2026-11-18', 'endless', 218, 3, 412, [1, 1, 0, 1], 34,
    { real: 163, cause: 'capacity', picks: 'WHT', tutorial: 'completed', quality: 'auto', preset: 'medium', adapt: 1, version: '0.1.1' }),
  note('2026-11-17', 'daily', 142, 2, 233, [0, 1, 0, 0], 0,
    { real: 121, cause: 'no-route', picks: 'TW', tutorial: 'completed', quality: 'auto', preset: 'medium', adapt: 0, version: '0.1.0' }),
  note('2026-11-16', 'endless', 96, 1, 88, [0, 0, 0, 0], 0), // logged before R3j: no record fields
] };
const input = { book: sample, tutorial: 'completed' as const, puzzlesSolved: 6, puzzlesTotal: 40, today: '2026-11-18',
  version: '0.1.1' };
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
  assert.equal(lines.length, 14 + sample.runs.length);
  assert.match(text, /Wersja gry: 0\.1\.1/);
  assert.match(text, /Czas gry naprawdę \(bez pauz\): mediana 14,2 min · najdłuższy 16,3 min · zmierzony w 2 biegach/);
  assert.ok(lines.at(-1)!.startsWith(RECORD_PREFIX), 'AW1 line last');
  assert.match(text, /Długość biegu przy prędkości 1×: mediana 14,2 min · najdłuższy 21,8 min/);
  assert.match(text, /Karta „Rozbudowa huba”: w ofercie 2 · wybrana 1/);
  assert.match(text, /Karta „Sloty startowe”: w ofercie 1 · wybrana 0/);
  assert.match(text, /Odlot czekał na slot: w 1 z 3 biegów/);
  assert.equal(lines.at(-2), '2026-11-16 · Bez końca · 9,6 · 1 · 88 · 0/0 · 0/0 · 0');
  assert.doesNotMatch(text, /[{}]/);
  assert.doesNotMatch(text, /\b(LIS|FRA|SIN|seed|0x)\b/i, 'no airport code or seed');
});
test('no runs yet: totals and the "no details" line only', () => {
  setLanguage('en');
  const text = logbookSummary({ ...input, book: { ...EMPTY_LOGBOOK, flights: 2 }, tutorial: 'none' });
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(1, -1), ['Flights: 2 (Endless 2, daily challenges 0)', 'Flight training: not opened',
    'Puzzles solved: 6 of 40', 'Game version: 0.1.1', en['logbook.summary.noRuns']]);
  assert.deepEqual(decodePlaytestRecord(lines.at(-1)!), { copied: '2026-11-18', version: '0.1.1', flights: 2, dailies: 0,
    tutorial: 'none', puzzlesSolved: 6, puzzlesTotal: 40, runs: [] });
});

test('AW1 line: base64url of ASCII JSON, same in PL and EN, decodes to the same notes', () => {
  setLanguage('pl');
  const pl = logbookSummary(input).split('\n').at(-1)!;
  setLanguage('en');
  const line = logbookSummary(input).split('\n').at(-1)!;
  assert.equal(pl, line, 'the machine line does not depend on the language');
  assert.equal(line, encodePlaytestRecord(input));
  assert.match(line, /^AW1:[A-Za-z0-9_-]+$/);
  const json = JSON.parse(Buffer.from(line.slice(4), 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(json), ['v', 'd', 'app', 'f', 'dl', 'tut', 'pz', 'r']);
  assert.equal(json.r[0].length, RUN_COLUMNS.length);
  assert.deepEqual(json.r[2].slice(RUN_COLUMNS.indexOf('min_real')), [null, 1, 88, null, null, 0, 0, 0, 0, 0, null, null, null, null, null],
    'a pre-R3j note writes null for what it lacks');
  const back = decodePlaytestRecord(line);
  assert.ok(back);
  assert.deepEqual(back.runs, sample.runs);
  assert.deepEqual({ ...back, runs: [] }, { copied: '2026-11-18', version: '0.1.1', flights: 14, dailies: 4, tutorial: 'completed',
    puzzlesSolved: 6, puzzlesTotal: 40, runs: [] });
  assert.doesNotMatch(JSON.stringify(json), /\b(LIS|FRA|SIN|seed|hub":)/i, 'no airport code, seed or hub field');
  for (const bad of ['AW2:' + line.slice(4), 'AW1:!!!', 'AW1:' + Buffer.from('{"v":2,"r":[]}').toString('base64url'), 'AW1:']) {
    assert.equal(decodePlaytestRecord(bad), null, bad.slice(0, 12));
  }
});
test('playtest:decode CSV: one row per run, summaries numbered, bad tokens skipped, forged fields dropped', () => {
  setLanguage('en');
  const forged = { v: 1, d: '2026-11-18', app: '0.1.0', f: 1, dl: 0, tut: 'none', pz: [0, 40],
    r: [['2026-11-18', 'endless', 5, 6, 0, 7, 'cause=1,2', 'HHX', 0, 0, 0, 0, 0, 'none', 'auto', 'low', 9, 'x y']] };
  const pasted = `Survey answer 1\n${logbookSummary(input)}\n\nanswer 2: AW1:@@@ and AW1:${Buffer.from(JSON.stringify(forged)).toString('base64url')}\n`;
  const out = playtestCsv(pasted);
  assert.deepEqual([out.records, out.rows, out.skipped], [2, 4, 0]);
  const rows = out.csv.trim().split('\n');
  assert.equal(rows[0], [...SUMMARY_COLUMNS, ...RUN_COLUMNS].join(','));
  assert.equal(rows[1], '1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-18,endless,21.8,16.3,3,412,capacity,WHT,1,1,0,1,34,completed,auto,medium,1,0.1.1');
  assert.equal(rows[3], '1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-16,endless,9.6,,1,88,,,0,0,0,0,0,,,,,');
  assert.equal(rows[4], '2,2026-11-18,0.1.0,1,0,none,0,40,2026-11-18,endless,5,6,0,7,,,0,0,0,0,0,none,auto,low,,',
    'invalid cause, picks, adapt and version become empty cells');
  assert.equal(playtestCsv('AW1:AAAA').skipped, 1);
  const docCsv = doc.match(/```csv\n([\s\S]*?)\n```/)?.[1];
  assert.equal(docCsv + '\n', playtestCsv(logbookSummary(input)).csv, 'PLAYTEST.md CSV example = decoder output');
  const script = read('scripts/playtest-decode.ts');
  assert.match(script, /playtestCsv/);
  assert.match(read('package.json'), /"playtest:decode": "node --import \.\/scripts\/ts-test-loader\.mjs scripts\/playtest-decode\.ts"/);
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
/** Rows of the markdown table under a `## heading` (cells, header and separator dropped). */
function docTable(heading: string): string[][] {
  const start = doc.indexOf('\n## ' + heading);
  assert.ok(start >= 0, `section "${heading}"`);
  const body = doc.slice(start + 1).split('\n## ')[0]!;
  return body.split('\n').filter((line) => line.startsWith('|')).slice(2).map((line) => line.split(' | ').map((cell) => cell.replace(/^\| |\s*\|$/g, '').trim()));
}
const pl1 = (n: number, digits = 2): string => n.toFixed(digits).replace('.', ',');
test('R3k decision table: Q-73/Q-78/Q-80 thresholds with the bot numbers from docs/balance, a minimum and a default', () => {
  const rows = docTable('Tabela decyzji');
  assert.ok(rows.length >= 10, `${rows.length} rows`);
  for (const row of rows) {
    assert.equal(row.length, 6, row[0]);
    assert.ok(row.every((cell) => cell.length > 0), `${row[0]}: empty cell`);
    assert.match(row[4]!, /\d/, `${row[0]}: a numeric threshold`);
  }
  const row = (q: string): string => rows.find((cells) => cells[0]!.startsWith(`**${q}**`))?.join(' | ') ?? '';
  // Bot reference: the gate's 50 runs (game-summary.md) and the 200-seed N12af measurement (balance README).
  const summary = read('docs/balance/game-summary.md');
  const session = summary.match(/\| Session, min at 1x \| ([\d.]+) \| [\d.]+ \| ([\d.]+) \| [\d.]+ \| ([\d.]+) \|/);
  assert.ok(session, 'game-summary session quantiles');
  for (const value of session.slice(1)) assert.ok(row('Q-73').includes(pl1(Number(value))), `Q-73 cites ${value}`);
  const weeks = summary.match(/\| Game weeks \| [\d.]+ \| [\d.]+ \| ([\d.]+) \|/)?.[1];
  assert.ok(weeks && row('Q-73').includes(pl1(Number(weeks))), 'Q-73 cites the median weeks');
  const hub = summary.match(/\| hub-expansion \| (\d+) \| (\d+) \| (\d+) % \|/);
  assert.ok(hub && row('Q-78').includes(`w ofercie ${hub[1]}, wybrana ${hub[2]} (${hub[3]} %)`), 'Q-78 cites the hub card');
  const slot = summary.match(/\| Slot hold \| (\d+) \| (\d+) % \|/);
  assert.ok(slot && row('Q-80').includes(`wstrzymanie w ${slot[1]} (${slot[2]} %)`), 'Q-80 cites slot holds');
  const readme = read('docs/balance/README.md');
  assert.match(readme, /\| 4 of 364 \| 3 of 200 \| 0 \| 12 of 200/);
  assert.ok(row('Q-80').includes('karta na 4 z 364 tablic') && row('Q-80').includes('wstrzymanie w 12 (6 %)'));
  // Decisions per option, as the owner's questions name them.
  assert.match(row('Q-73'), /\*\*B\*\*.*≥ 22 min.*\*\*A\*\*.*10–18 min \(D-79\)/);
  assert.match(row('Q-78'), /\*\*A\*\*.*≥ 10 % ofert.*\*\*D\*\*.*< 5 % ofert/);
  assert.match(row('Q-80'), /\*\*A\*\*.*≥ 20 % biegów.*\*\*B\*\*.*< 10 % biegów/);
  // R8 per-run data: week-1 card shares and the losing cause, quoted for Q-35 and the cause row.
  const csv = read('docs/balance/r8-audit-200.csv').trim().split('\n');
  const head = csv[0]!.split(',');
  const bot = csv.slice(1).map((line) => line.split(',')).filter((cells) => cells[0] === 'bot');
  const share = (values: string[], value: string) => Math.round(100 * values.filter((v) => v === value).length / values.length);
  const first = bot.map((cells) => cells[head.indexOf('picks')]!.split('|')[0]!).filter(Boolean);
  const q35 = rows.find((cells) => cells[0]!.startsWith('Q-35'))!.join(' | ');
  assert.ok(q35.includes(`szerokokadłubowiec ${share(first, 'widebody')} %, turbośmigłowiec ${share(first, 'turboprop')} %, hub ${share(first, 'hub')} % (${first.length} biegi)`), 'Q-35 week-1 shares');
  const causes = bot.map((cells) => cells[head.indexOf('fail_top_cause')]!);
  const causeRow = rows.find((cells) => cells[0]!.startsWith('Przyczyna'))!.join(' | ');
  for (const kind of ['regional-demand', 'no-route', 'capacity']) assert.ok(causeRow.includes(`\`${kind}\` ${share(causes, kind)} %`), kind);
});
test('R3k recruitment and production-access answer sheet', () => {
  const recruit = docTable('Rekrutacja').map((cells) => cells.join(' | ')).join('\n');
  for (const needle of ['16–18 zapisanych', '≥ 6 PL i ≥ 6 EN', '≥ 3 budżetowe Androidy', '≥ 2 tablety', 'airway-testers', '**Bez** płatnych']) {
    assert.ok(recruit.includes(needle), needle);
  }
  assert.match(doc, /\| 8 \| \*\*poprawka\*\*/, 'day-8 fix release');
  const sheet = docTable('Arkusz odpowiedzi do wniosku o produkcję');
  const questions = ['How easy was it to recruit testers?', 'Describe the engagement of your testers',
    'Was the usage similar to what you expect in production?', 'Summarise the feedback and how you collected it',
    'Intended audience', 'How does your app provide value?', 'Expected installs in the first year',
    'What changes did you make based on the test?', 'How did you decide the app is ready for production?'];
  assert.deepEqual(sheet.map((cells) => cells[0]), questions);
  for (const cells of sheet) assert.match(cells[2]!, /^".+"$/, `${cells[0]}: an EN draft`);
  assert.match(read('docs/DECISIONS.md'), /^## D-232 — .*decision table/m);
  assert.ok(doc.includes('D-94') && doc.includes('Q-52'));
});
test('R6i first-session observation sheet: observations, device checks, thresholds, pseudonyms only', () => {
  const rows = docTable('Arkusz obserwacji pierwszej sesji').filter((cells) => !['#', 'Sygnał'].includes(cells[0]!) && !cells[0]!.startsWith('|-'));
  const ids = rows.map((cells) => cells[0]);
  assert.deepEqual(ids, ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'U1', 'U2', ...ids.slice(10)]);
  const text = (id: string): string => rows.find((cells) => cells[0] === id)!.join(' | ');
  assert.match(text('O2'), /Sekundy do pierwszej własnej trasy/);
  assert.match(text('O3'), /Czy znalazł dok/);
  assert.match(text('O4'), /nie ma nic do roboty/);
  assert.match(text('O5'), /Co znaczy glif/);
  assert.match(text('O6'), /Tablica tygodnia.*bez pomocy/);
  assert.match(text('U1'), /Android: muzyka z innej aplikacji/);
  assert.match(text('U2'), /Wibracje na tanim telefonie.*R6d, R6e/);
  const thresholds = rows.slice(10);
  for (const id of ['O2', 'O3', 'O4', 'O5', 'O6', 'U1', 'U2']) {
    const row = thresholds.find((cells) => cells[0]!.startsWith(id));
    assert.ok(row, `threshold for ${id}`);
    assert.match(row[1]!, /\d/, `${id}: numeric threshold`);
    assert.ok(row[2]!.length > 10, `${id}: decision`);
  }
  assert.match(doc, /pseudonimem \(`T01`/);
  assert.match(doc, /\*\*nie podpowiada\*\*/);
});
test('local only: the export has no network path and the privacy sheet and decision record it', () => {
  for (const path of ['src/ui/logbook/summary.ts', 'src/ui/logbook/logbook.ts', 'src/game/logbook.ts',
    'src/game/playtestRecord.ts', 'src/core/version.ts', 'scripts/playtest-decode.ts']) {
    const code = read(path);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//, path);
  }
  assert.match(read('docs/store/privacy-declarations.md'), /"Copy summary" \(R1o, D-227/);
  assert.match(read('docs/store/privacy-declarations.md'), /`AW1:` line, D-231/);
  assert.match(read('docs/DECISIONS.md'), /^## D-231 — .*AW1/m);
  assert.match(doc, /npm run playtest:decode -- /);
  assert.match(read('docs/DECISIONS.md'), /^## D-227 — .*logbook/m);
  const logbookUi = read('src/ui/logbook/logbook.ts');
  assert.doesNotMatch(logbookUi, /import\.meta\.env\.DEV/, 'Copy summary ships in release builds');
});

console.log(`SUMMARY test:playtest seed=42 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

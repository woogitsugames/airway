// [night-12bc] R2h / D-251: Endless licence classes. Class I is today's Endless: Daily (and its leaderboard replay),
// Endless without and with the weekly contract are bit-for-bit the pre-R2h bot runs (pinned from origin/dev 635e1bf)
// and a new class I run carries no config field. Classes II/III change only scenario knobs (curfew start week and
// airports, starting turboprops, hub seats) read from one table; the class survives save/restore, the v3 -> v4
// envelope bump and the D-76 replay; Daily, puzzles and bad values refuse a class. The logbook keeps the best weeks
// per class (older records start class I at their longest flight), classes open at week 5 of the class below, and
// the menu choice lives in the device settings record. Fails on the old code: no licence module, no licenceClass.
import assert from 'node:assert/strict';
import { createGame, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { LICENCE_CLASSES, LICENCE_PARAMS, LICENCE_UNLOCK_WEEK } from '../src/sim/licence.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import {
  CURFEW_ENDLESS_START_WEEK, CURFEW_START_CITY_COUNT, HUB_WAITING_CAPACITY, INITIAL_PLANE_RESERVE,
} from '../src/sim/params.ts';
import { decodeSave, encodeSave, restoreSimDetailed, saveSourceFromSim, SAVE_VERSION } from '../src/game/save.ts';
import { EndlessRun } from '../src/game/run.ts';
import { EMPTY_LOGBOOK, LOGBOOK_KEY, licenceWeeks, readLogbook, recordFlight, type LogEntry } from '../src/game/logbook.ts';
import {
  licenceForRun, licenceIssued, openLicences, readLicenceChoice, writeLicenceChoice,
} from '../src/game/licence.ts';
import { readHomeRegion, writeHomeRegion } from '../src/game/homeRegion.ts';
import { setLanguage, t } from '../src/i18n/index.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from './bot.ts';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The balance bot to the end of the run (or `maxTicks`), as test:balance plays it. */
function botRun(seed: number, mode: 'endless' | 'daily', contract: boolean, licence: 1 | 2 | 3 = 1, maxTicks = 18_000) {
  const session = createBalanceSession(seed, mode, null, contract, licence);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}
/** FNV-1a over the envelope fields in the order save.ts checksums them (to forge an older envelope as written). */
function checksum(body: Record<string, unknown>): string {
  const data = JSON.stringify([body.v, body.savedAt, body.seed, body.tick, body.snapshot, body.commands,
    body.stateHash, body.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { hash ^= data.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function memoryStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(), key: () => null, get length() { return data.size; } };
}
const flight = (weeks: number, extra: Partial<LogEntry> = {}): LogEntry =>
  ({ day: '2026-11-05', mode: 'endless', passengers: 100, weeks, hub: null, ...extra });

// Bot runs on origin/dev 635e1bf (before R2h): final hash, tick, score. Daily = the leaderboard world;
// endless+contract = a new Endless run today (= class I).
const GOLDEN: Record<string, { hash: string; tick: number; score: number }> = {
  'daily:41377': { hash: '61693056', tick: 6958, score: 163 },
  'endless:41377': { hash: '6a2d0971', tick: 6958, score: 163 },
  'endless+contract:41377': { hash: '3f0440fb', tick: 6958, score: 163 },
  'daily:45746': { hash: '060b04c6', tick: 12178, score: 565 },
  'endless:45746': { hash: '72ed8fcb', tick: 12178, score: 565 },
  'endless+contract:45746': { hash: 'a14b64c4', tick: 12178, score: 565 },
  'daily:50115': { hash: '1225dcd9', tick: 9659, score: 116 },
  'endless:50115': { hash: '608b0fd2', tick: 9659, score: 116 },
  'endless+contract:50115': { hash: '27706f70', tick: 9659, score: 116 },
};

await test('class I = today: Daily, Endless and Endless with contract are bit-for-bit the pre-R2h bot runs', () => {
  for (const [key, want] of Object.entries(GOLDEN)) {
    const [kind, seed] = key.split(':') as [string, string];
    const mode = kind === 'daily' ? 'daily' : 'endless';
    const sim = botRun(Number(seed), mode, kind.endsWith('+contract'));
    assert.deepEqual({ hash: sim.hash(), tick: sim.tickCount, score: sim.world.score }, want, key);
    assert.equal(sim.config.licenceClass, undefined, `${key}: no class field`);
    if (mode === 'daily') {
      const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, { mode: 'daily' }, true);
      assert.equal(replay.hash(), want.hash, `${key}: server replay`);
    }
  }
  // A new class I run from the game layer is the same config as before R2h.
  const run = EndlessRun.create(41377, 'endless', null, 1);
  assert.deepEqual(run.sim.config, { mode: 'endless', weeklyContract: true });
  assert.equal(run.licenceClass, 1);
  assert.equal(EndlessRun.create(41377).hash(), run.hash());
});

await test('class params: one table, class I = the shared constants, II and III as the backlog names them', () => {
  assert.deepEqual([...LICENCE_CLASSES], [1, 2, 3]);
  assert.equal(LICENCE_UNLOCK_WEEK, 5);
  const one = LICENCE_PARAMS[1];
  assert.deepEqual(one, { curfewStartWeek: CURFEW_ENDLESS_START_WEEK, curfewStartCities: CURFEW_START_CITY_COUNT,
    turbopropReserve: INITIAL_PLANE_RESERVE.turboprop, hubCapacity: HUB_WAITING_CAPACITY });
  assert.deepEqual(LICENCE_PARAMS[2], { ...one, curfewStartWeek: 2, turbopropReserve: 3 });
  assert.deepEqual(LICENCE_PARAMS[3], { ...LICENCE_PARAMS[2], curfewStartCities: CURFEW_START_CITY_COUNT + 2,
    hubCapacity: HUB_WAITING_CAPACITY - 6 });
});

await test('config: class II/III only in Endless; Daily, puzzles, class 1 and unknown values refuse a field', () => {
  assert.deepEqual(createGame(7, 'endless', undefined, null, true, 2).config, { mode: 'endless', weeklyContract: true, licenceClass: 2 });
  assert.deepEqual(createGame(7, 'endless', undefined, 'EUN', false, 3).config, { mode: 'endless', homeRegion: 'EUN', licenceClass: 3 });
  assert.deepEqual(createGame(7, 'endless', undefined, null, false, 1).config, { mode: 'endless' });
  assert.deepEqual(createGame(7, 'daily', undefined, null, false, 3).config, { mode: 'daily' });
  assert.deepEqual(EndlessRun.create(7, 'daily', null, 3).sim.config, { mode: 'daily' });
  for (const config of [{ mode: 'daily', licenceClass: 2 }, { mode: 'endless', licenceClass: 1 },
    { mode: 'endless', licenceClass: 4 }, { mode: 'endless', licenceClass: '2' }]) {
    assert.throws(() => new Sim(7, config as never), JSON.stringify(config));
  }
});

await test('class II: 3 turboprops at the start and curfew announced in week 2; class I has none in week 2', () => {
  for (const seed of [0xA1A1, 0xA1A2, 0xA1A3]) {
    const one = createGame(seed, 'endless', undefined, null, true, 1);
    const two = createGame(seed, 'endless', undefined, null, true, 2);
    assert.equal(one.world.reserve.turboprop, 4);
    assert.deepEqual(two.world.reserve, { turboprop: 3, widebody: 0 });
    // Same seed: the start world is the same airports (only knobs differ).
    assert.deepEqual([...two.world.cities()].map((c) => c.id), [...one.world.cities()].map((c) => c.id));
    const oneWeek2 = botRun(seed, 'endless', true, 1, TICKS_PER_WEEK + 60);
    const twoWeek2 = botRun(seed, 'endless', true, 2, TICKS_PER_WEEK + 60);
    assert.ok(twoWeek2.world.minute > TICKS_PER_WEEK && oneWeek2.world.minute > TICKS_PER_WEEK, 'in week 2');
    assert.equal(oneWeek2.world.curfewCityIds.length, 0, 'class I: no curfew in week 2');
    assert.equal(twoWeek2.world.curfewCityIds.length, 2, 'class II: 2 curfew airports in week 2');
  }
});

await test('class III: 4 curfew airports from week 2 and hubs 6 seats smaller (36 -> 30)', () => {
  for (const seed of [0xA1A1, 0xA1A2, 0xA1A3]) {
    const sim = botRun(seed, 'endless', true, 3, TICKS_PER_WEEK + 60);
    assert.ok(sim.world.minute > TICKS_PER_WEEK, 'in week 2');
    assert.equal(sim.world.curfewCityIds.length, Math.min(4, [...sim.world.cities()].length));
  }
  // A hub (two routes) has 30 seats in class III, 36 in class I.
  const capacityOfHub = (licence: 1 | 3): number => {
    const run = createGame(0xA1A1, 'endless', undefined, null, true, licence);
    const ids = [...run.world.cities()].map((c) => c.id);
    assert.ok(ids.length >= 3);
    assert.equal(run.apply({ type: 'AddRoute', cityIds: [ids[0]!, ids[1]!] }), true);
    assert.equal(run.apply({ type: 'AddRoute', cityIds: [ids[0]!, ids[2]!] }), true);
    run.advance(1);
    const hub = [...run.world.cities()].find((c) => c.id === ids[0])!;
    assert.equal(hub.isHub, true);
    return hub.capacity;
  };
  assert.equal(capacityOfHub(1), 36);
  assert.equal(capacityOfHub(3), 30);
});

await test('classes are harder for the bot, never easier on these seeds (report: balance:licences)', () => {
  let one = 0;
  let three = 0;
  for (const seed of [0xA1A1, 0xA1A2, 0xA1A3, 0xA1A4, 0xA1A5, 0xA1A6]) {
    one += botRun(seed, 'endless', true, 1).tickCount;
    three += botRun(seed, 'endless', true, 3).tickCount;
  }
  assert.ok(three < one, `class III ${three} < class I ${one} ticks`);
});

await test('save → load keeps the class and the hash (envelope v4); v3 envelopes load; D-76 replay keeps it', () => {
  const sim = botRun(0xA1A1, 'endless', true, 3, TICKS_PER_WEEK + 600);
  assert.equal(sim.config.licenceClass, 3);
  const save = encodeSave(saveSourceFromSim(sim), 1000);
  assert.equal(save.v, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 4);
  const decoded = decodeSave(JSON.stringify(save));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.equal(new EndlessRun(restored.sim).licenceClass, 3);
  restored.sim.advance(400);
  sim.advance(400);
  assert.equal(restored.sim.hash(), sim.hash(), 'continues identically');
  // D-76: an older-rules save is replayed with its class.
  const old = restoreSimDetailed(encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000));
  assert.ok(old && old.replayed);
  assert.equal(old.sim.config.licenceClass, 3);
  assert.equal(old.sim.hash(), sim.hash(), 'unchanged rules replay to the same hash');
  // A v3 envelope (pre-R2h, always class I) still loads to its hash; tampering is caught as v3.
  const plain = createGame(0xB2B2, 'endless', undefined, null, true);
  plain.advance(1200);
  const current = encodeSave(saveSourceFromSim(plain), 1000);
  const { checksum: _drop, ...body } = { ...current, v: 3 };
  const v3 = { ...body, checksum: checksum(body) };
  const loaded = decodeSave(JSON.stringify(v3));
  assert.equal(loaded.status, 'ok');
  if (loaded.status !== 'ok') return;
  assert.equal(loaded.save.v, SAVE_VERSION);
  assert.equal(restoreSimDetailed(loaded.save)?.sim.hash(), plain.hash());
  assert.equal(decodeSave(JSON.stringify({ ...v3, checksum: current.checksum })).status, 'error', 'v3 is checked as v3');
  // A newer envelope is refused as unsupported; a class snapshot cannot load as class I.
  const { checksum: _c, ...newer } = { ...current, v: 5 };
  const decodedNewer = decodeSave(JSON.stringify({ ...newer, checksum: checksum(newer) }));
  assert.deepEqual(decodedNewer, { status: 'error', issue: 'unsupported' });
  const snap = JSON.parse(sim.snapshot());
  snap.state.config = { mode: 'endless', weeklyContract: true };
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(snap)));
});

await test('logbook: best weeks per class, class I counts Daily, older records start at their longest flight', () => {
  const storage = memoryStorage();
  recordFlight(storage, flight(2));
  recordFlight(storage, flight(3, { mode: 'daily' }));
  recordFlight(storage, flight(1, { licence: 2 }));
  recordFlight(storage, flight(5, { mode: 'daily', licence: 3 } as Partial<LogEntry>));
  const book = readLogbook(storage);
  assert.deepEqual(licenceWeeks(book), { 1: 5, 2: 1 });
  assert.equal(book.recent[1]!.licence, 2);
  assert.equal(book.recent[0]!.licence, undefined, 'Daily never carries a class');
  // A record written before R2h: class I starts at its longest flight.
  const legacy = memoryStorage();
  legacy.setItem(LOGBOOK_KEY, JSON.stringify({ flights: 3, passengers: 10, weeks: 6, longestWeeks: 4, hubs: {}, recent: [] }));
  assert.deepEqual(licenceWeeks(readLogbook(legacy)), { 1: 4 });
  assert.deepEqual(licenceWeeks(EMPTY_LOGBOOK), {});
  // Hand-built Logbook objects without the field never throw.
  const { licenceWeeks: _omit, ...bare } = { ...EMPTY_LOGBOOK, flights: 2, longestWeeks: 3 };
  assert.deepEqual(licenceWeeks(bare as never), { 1: 3 });
  // Malformed values are dropped, a value above the longest flight too.
  legacy.setItem(LOGBOOK_KEY, JSON.stringify({ flights: 3, passengers: 10, weeks: 6, longestWeeks: 4, hubs: {}, recent: [],
    licenceWeeks: { 1: 4, 2: 'x', 3: 9 } }));
  assert.deepEqual(licenceWeeks(readLogbook(legacy)), { 1: 4 });
});

await test('unlocks: class II at week 5 of class I (4 weeks flown), class III at week 5 of class II; issued once', () => {
  const storage = memoryStorage();
  assert.deepEqual(openLicences(readLogbook(storage)), [1]);
  recordFlight(storage, flight(3));
  assert.deepEqual(openLicences(readLogbook(storage)), [1], 'week 4 is not enough');
  const before = readLogbook(storage);
  const after = recordFlight(storage, flight(4));
  assert.deepEqual(openLicences(after), [1, 2]);
  assert.equal(licenceIssued(before, after), 2);
  assert.equal(licenceIssued(after, recordFlight(storage, flight(6))), null, 'issued once');
  // Class III only from class II flights, never from a long class I flight.
  recordFlight(storage, flight(9));
  assert.deepEqual(openLicences(readLogbook(storage)), [1, 2]);
  const beforeThree = readLogbook(storage);
  const three = recordFlight(storage, flight(4, { licence: 2 }));
  assert.deepEqual(openLicences(three), [1, 2, 3]);
  assert.equal(licenceIssued(beforeThree, three), 3);
  // A class III best without class II open (hand-edited record) opens nothing past the gap.
  assert.deepEqual(openLicences({ ...EMPTY_LOGBOOK, flights: 1, longestWeeks: 9, licenceWeeks: { 1: 1, 2: 9 } }), [1]);
});

await test('menu choice: settings record only (beside the home region), class I by default, closed class falls back', () => {
  const storage = memoryStorage();
  assert.equal(readLicenceChoice(storage), 1);
  writeHomeRegion(storage, 'EUN');
  writeLicenceChoice(storage, 3);
  assert.equal(readLicenceChoice(storage), 3);
  assert.equal(readHomeRegion(storage), 'EUN', 'the home region is kept');
  assert.deepEqual([...storage.data.keys()], ['airway.settings'], 'no new storage key');
  assert.deepEqual(JSON.parse(storage.getItem('airway.settings')!), { homeRegion: 'EUN', licenceClass: 3 });
  writeLicenceChoice(storage, 1);
  assert.deepEqual(JSON.parse(storage.getItem('airway.settings')!), { homeRegion: 'EUN' });
  storage.setItem('airway.settings', JSON.stringify({ licenceClass: 7 }));
  assert.equal(readLicenceChoice(storage), 1);
  assert.equal(licenceForRun(3, [1, 2]), 1);
  assert.equal(licenceForRun(2, [1, 2]), 2);
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(readLicenceChoice(blocked), 1);
  assert.doesNotThrow(() => writeLicenceChoice(blocked, 2));
});

await test('i18n: stamp numerals, class names, issued notice, logbook and game-over lines in PL and EN', () => {
  for (const lang of ['pl', 'en'] as const) {
    setLanguage(lang);
    assert.deepEqual([1, 2, 3].map((n) => t(`licence.short.${n}` as never)), ['I', 'II', 'III']);
    for (const n of [1, 2, 3]) assert.match(t(`licence.name.${n}` as never), lang === 'pl' ? /^Klasa / : /^Class /);
    assert.match(t('menu.licenceIssued', { class: 'II' }), /II/);
    assert.match(t('gameover.licence', { class: 'III' }), /III/);
    assert.equal(t('logbook.licenceValue', { class: 'II', count: 2 }), lang === 'pl' ? 'II: 2 tygodnie' : 'II: 2 weeks');
  }
  setLanguage('en');
});

console.log(`SUMMARY test:licence-classes passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

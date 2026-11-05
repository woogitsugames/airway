// [night-12bb] R2i / D-249: the announced demand surge. Daily (and its leaderboard replay), flagless Endless and the
// contract-only Endless runs of the previous build are bit-for-bit unchanged (hashes pinned from
// origin/night/12ba-weekly-contract 4617dcb); new Endless runs carry `demandSurge`; from the week-2 board on one open
// airport with a route is drawn from the surge's own RNG fork, announced exactly one game day before a 6-hour window
// on its local clock (clear of the curfew), and sends SURGE_EXTRA_PASSENGERS more passengers evenly spaced in it; no
// kernel RNG stream moves; the surge survives save/restore, the v3 -> v4 envelope bump and the D-76 replay; the pause
// sheet and the tag mark read it. Fails on the old code: no surge module, no demandSurge config.
import assert from 'node:assert/strict';
import { createGame, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import {
  closeSurge, drawSurge, EMPTY_SURGES, surgePassengerDue, surgePhase, validSurgeSnapshot, type DemandSurge,
} from '../src/sim/surge.ts';
import {
  CURFEW_END_HOUR, CURFEW_START_HOUR, SURGE_DURATION_MINUTES, SURGE_EXTRA_PASSENGERS, SURGE_FIRST_BOARD_WEEK,
  SURGE_NOTICE_MINUTES, SURGE_START_LOCAL_HOURS,
} from '../src/sim/params.ts';
import { localHourAt } from '../src/sim/daynight.ts';
import { CITY_RECORDS } from '../src/data/index.ts';
import { decodeSave, encodeSave, restoreSimDetailed, saveSourceFromSim, SAVE_VERSION } from '../src/game/save.ts';
import { EndlessRun, ENDLESS_DEMAND_SURGE } from '../src/game/run.ts';
import { pauseSummary } from '../src/game/pauseSummary.ts';
import { localClock, surgeKey, surgeMark } from '../src/game/surge.ts';
import { setLanguage } from '../src/i18n/index.ts';
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
function botRun(seed: number, mode: 'endless' | 'daily', contract: boolean, surge: boolean, maxTicks = 18_000) {
  const session = createBalanceSession(seed, mode, null, contract, surge);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session;
}
/** FNV-1a over the envelope fields in the order save.ts checksums them (to forge an older envelope as written). */
function checksum(body: Record<string, unknown>): string {
  const data = JSON.stringify([body.v, body.savedAt, body.seed, body.tick, body.snapshot, body.commands,
    body.stateHash, body.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { hash ^= data.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function stateOf(sim: Sim) { return JSON.parse(sim.snapshot()).state; }
const OFFSET = new Map(CITY_RECORDS.map((city) => [city.code, city.utcOffsetH]));

// Bot runs on origin/night/12ba-weekly-contract 4617dcb (before R2i): final hash, tick, score.
const GOLDEN: Record<string, { hash: string; tick: number; score: number }> = {
  'daily:41377': { hash: '61693056', tick: 6958, score: 163 },
  'daily:45746': { hash: '060b04c6', tick: 12178, score: 565 },
  'daily:50115': { hash: '1225dcd9', tick: 9659, score: 116 },
  'endless:41377': { hash: '6a2d0971', tick: 6958, score: 163 },
  'endless:45746': { hash: '72ed8fcb', tick: 12178, score: 565 },
  'endless:50115': { hash: '608b0fd2', tick: 9659, score: 116 },
  'endless+contract:41377': { hash: '3f0440fb', tick: 6958, score: 163 },
  'endless+contract:45746': { hash: 'a14b64c4', tick: 12178, score: 565 },
  'endless+contract:50115': { hash: '27706f70', tick: 9659, score: 116 },
};

// A surge run (as new Endless runs play) that lives through its first whole surge window (deterministic scan).
let fullSeed = 0;
let fullSurge: DemandSurge | null = null;
for (let seed = 0xA1A1; seed < 0xA1A1 + 60 && !fullSeed; seed++) {
  const session = botRun(seed, 'endless', true, true);
  const first = session.simulation.world.surgeRecords()[0];
  if (first && session.simulation.tickCount > first.endTick) { fullSeed = seed; fullSurge = first; }
}

await test('Daily, flagless and contract-only Endless: bit-for-bit the pre-R2i bot runs (leaderboard replay unchanged)', () => {
  for (const [key, want] of Object.entries(GOLDEN)) {
    const [kind, seed] = key.split(':') as [string, string];
    const mode = kind === 'daily' ? 'daily' : 'endless';
    const sim = botRun(Number(seed), mode, kind.endsWith('+contract'), false).simulation;
    assert.deepEqual({ hash: sim.hash(), tick: sim.tickCount, score: sim.world.score }, want, key);
    assert.equal(stateOf(sim).world.surges, undefined, `${key}: no surge record`);
    assert.equal(sim.world.surge, null);
    assert.deepEqual(sim.world.surgeRecords(), []);
    if (mode === 'daily') {
      const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, { mode: 'daily' }, true);
      assert.equal(replay.hash(), want.hash, `${key}: server replay`);
    }
  }
  assert.equal(RULES_VERSION, 6, 'rules version unchanged (the flag keeps old runs as they were)');
});

await test('config: new Endless runs carry the surge; Daily, puzzles and bad values refuse it', () => {
  assert.equal(ENDLESS_DEMAND_SURGE, true);
  assert.deepEqual(EndlessRun.create(1).sim.config, { mode: 'endless', weeklyContract: true, demandSurge: true });
  assert.deepEqual(EndlessRun.create(1, 'endless', 'EUN').sim.config,
    { mode: 'endless', homeRegion: 'EUN', weeklyContract: true, demandSurge: true });
  assert.deepEqual(EndlessRun.create(1, 'daily').sim.config, { mode: 'daily' });
  assert.deepEqual(createGame(1).config, { mode: 'endless' }, 'the facade keeps the old default');
  assert.deepEqual(createGame(1, 'endless', undefined, null, false, true).config, { mode: 'endless', demandSurge: true });
  assert.deepEqual(createGame(1, 'daily', undefined, null, true, true).config, { mode: 'daily' }, 'the facade drops it for Daily');
  assert.throws(() => new Sim(1, { mode: 'daily', demandSurge: true }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'puzzle', puzzleId: 'p01', demandSurge: true }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'endless', demandSurge: false as never }), /configuration/);
});

await test('pure draw: none before the week-2 board, a day of notice, a 6-hour window on the local clock clear of the curfew', () => {
  const candidates = ['WAW', 'NRT', 'LAX', 'SYD', 'NBO'].filter((id) => OFFSET.has(id))
    .map((cityId) => ({ cityId, utcOffsetH: OFFSET.get(cityId)! }));
  assert.ok(candidates.length >= 3, 'test airports exist');
  assert.equal(drawSurge(1, SURGE_FIRST_BOARD_WEEK - 1, TICKS_PER_WEEK, candidates), null, 'week-1 board: none (first surge in week 3)');
  assert.equal(drawSurge(1, 2, 2 * TICKS_PER_WEEK, []), null, 'no airport with a route: none');
  assert.throws(() => drawSurge(1, 0, 0, candidates), /week/);
  const cities = new Set<string>();
  const hours = new Set<number>();
  for (let seed = 1; seed <= 200; seed++) {
    for (const week of [2, 3, 7]) {
      const board = week * TICKS_PER_WEEK;
      const drawn = drawSurge(seed, week, board, candidates)!;
      const surge = drawn.surge;
      assert.deepEqual(drawSurge(seed, week, board, [...candidates].reverse()), drawn, 'independent of candidate order');
      cities.add(surge.cityId);
      hours.add(surge.startLocalHour);
      assert.ok(SURGE_START_LOCAL_HOURS.includes(surge.startLocalHour));
      assert.equal(surge.startTick - surge.announceTick, SURGE_NOTICE_MINUTES, 'announced one game day ahead');
      assert.equal(SURGE_NOTICE_MINUTES, 1440);
      assert.ok(surge.announceTick >= board && surge.announceTick < board + 1440, 'announced during the first day after the board');
      assert.equal(surge.endTick - surge.startTick, SURGE_DURATION_MINUTES);
      assert.ok(surge.endTick < board + TICKS_PER_WEEK, 'the window ends inside the coming week');
      const offset = OFFSET.get(surge.cityId)!;
      assert.equal(localHourAt(surge.startTick, offset), surge.startLocalHour, 'opens on the local hour');
      for (let tick = surge.startTick; tick < surge.endTick; tick += 30) {
        const hour = localHourAt(tick, offset);
        assert.ok(hour < CURFEW_START_HOUR && hour >= CURFEW_END_HOUR, 'never inside the curfew hours');
      }
      assert.equal(surge.passengers, SURGE_EXTRA_PASSENGERS);
    }
  }
  assert.equal(cities.size, candidates.length, 'every candidate can be drawn');
  assert.equal(hours.size, SURGE_START_LOCAL_HOURS.length, 'every start hour can be drawn');
  const surge = drawSurge(9, 2, 2 * TICKS_PER_WEEK, candidates)!.surge;
  let due = 0;
  for (let tick = surge.announceTick; tick <= surge.endTick + 10; tick++) if (surgePassengerDue(surge, tick)) due++;
  assert.equal(due, SURGE_EXTRA_PASSENGERS, 'exactly N extra passengers, all inside the window');
  assert.ok(surgePassengerDue(surge, surge.startTick) && !surgePassengerDue(surge, surge.startTick + 1));
  assert.equal(surgePhase(surge, surge.announceTick - 1), 'hidden');
  assert.equal(surgePhase(surge, surge.announceTick), 'announced');
  assert.equal(surgePhase(surge, surge.startTick), 'active');
  assert.equal(surgePhase(surge, surge.endTick), 'over');
  const closed = closeSurge({ ...EMPTY_SURGES, current: surge, announced: true, rngState: 5, extra: 12 });
  assert.deepEqual(closed, { ...EMPTY_SURGES, history: [{ ...surge, extra: 12 }] });
  const known = (id: string) => OFFSET.has(id);
  assert.ok(validSurgeSnapshot(closed, known) && validSurgeSnapshot(EMPTY_SURGES, known));
  assert.ok(!validSurgeSnapshot({ ...EMPTY_SURGES, announced: true }, known), 'announced without a surge');
  assert.ok(!validSurgeSnapshot({ ...EMPTY_SURGES, current: { ...surge, cityId: 'XXX' } }, known), 'unknown airport');
  assert.ok(!validSurgeSnapshot({ ...EMPTY_SURGES, current: { ...surge, startTick: surge.startTick + 1 } }, known), 'notice is fixed');
});

await test(`a surge run is the run without surges until its first window opens: same state, no kernel RNG moved (seed 0x${fullSeed.toString(16)})`, () => {
  assert.ok(fullSeed && fullSurge, 'some seed among 60 lives through a whole surge window');
  const stop = fullSurge.startTick - 30;
  const on = botRun(fullSeed, 'endless', true, true, stop).simulation;
  const off = botRun(fullSeed, 'endless', true, false, stop).simulation;
  assert.equal(on.tickCount, off.tickCount);
  assert.ok(on.tickCount < fullSurge.startTick && on.tickCount >= fullSurge.announceTick, 'stopped between the notice and the window');
  const a = stateOf(on);
  const b = stateOf(off);
  assert.deepEqual(a.rng, b.rng, 'kernel RNG streams unchanged');
  const { surges, ...worldOn } = a.world;
  assert.deepEqual(worldOn, b.world, 'world identical apart from the surge record');
  assert.ok(surges.announced && surges.current.cityId === fullSurge.cityId);
  assert.equal(surges.extra, 0);
  // Through the window: the kernel demand stream depends on the usual demand only, so it still matches a replay of
  // the same commands without surges as long as the network is the same (no commands inside the window here).
  const log = on.getCommandLog().filter(([tick]) => tick <= on.tickCount);
  const end = fullSurge.endTick + 5;
  const withSurge = Sim.replay(on.seed, log, end, on.config);
  const withoutSurge = Sim.replay(off.seed, log, end, off.config);
  assert.ok(withSurge.world.status === 'running' && withoutSurge.world.status === 'running', 'both replays live through the window');
  {
    assert.equal(stateOf(withSurge).rng.demand, stateOf(withoutSurge).rng.demand, 'demand stream untouched by the extra passengers');
    assert.equal(withSurge.world.surgeRecords().at(-1)!.extra, SURGE_EXTRA_PASSENGERS);
  }
});

await test('the announcement a day ahead, the window and its extra passengers, minute by minute (events once)', () => {
  const full = botRun(fullSeed, 'endless', true, true).simulation;
  const surge = fullSurge!;
  const log = full.getCommandLog();
  const sim = new Sim(full.seed, full.config);
  const events: { type: string; minute: number; phase?: string; cityId?: string }[] = [];
  let index = 0;
  let views = 0;
  let activeViews = 0;
  while (sim.tickCount < surge.endTick + 2) {
    while (index < log.length && log[index]![0] === sim.tickCount + 1) sim.apply(log[index++]![1]);
    sim.tick();
    events.push(...(sim.drainEvents() as typeof events));
    const view = sim.world.surge;
    const tick = sim.tickCount;
    if (tick < surge.announceTick) assert.equal(view, null, `hidden at ${tick}`);
    else if (tick < surge.endTick) {
      assert.ok(view && view.cityId === surge.cityId, `shown at ${tick}`);
      assert.equal(view.active, tick >= surge.startTick);
      views++;
      if (view.active) activeViews++;
      assert.equal(view.endLocalHour, (surge.startLocalHour + SURGE_DURATION_MINUTES / 60) % 24);
    } else assert.equal(view, null, `gone after the window (${tick})`);
  }
  assert.equal(views, surge.endTick - surge.announceTick);
  assert.equal(activeViews, SURGE_DURATION_MINUTES);
  const announced = events.filter((event) => event.type === 'SurgeAnnounced');
  assert.equal(announced.length, 1, 'announced once');
  assert.equal(announced[0]!.minute, surge.announceTick);
  assert.deepEqual(events.filter((event) => event.type === 'Surge').map((event) => [event.minute, event.phase, event.cityId]),
    [[surge.startTick, 'start', surge.cityId], [surge.endTick, 'end', surge.cityId]]);
  assert.equal(sim.world.surgeRecords().at(-1)!.extra, SURGE_EXTRA_PASSENGERS, 'all extra passengers created');
  assert.equal(sim.hash(), Sim.replay(full.seed, log.filter(([tick]) => tick <= sim.tickCount), sim.tickCount, full.config).hash(), 'replay equal');
  // The next board files it in the history; the same seed draws the same surge.
  const again = botRun(fullSeed, 'endless', true, true).simulation;
  assert.equal(again.hash(), full.hash());
  if (full.world.surgeHistory.length) assert.deepEqual(full.world.surgeHistory[0], { ...surge, extra: SURGE_EXTRA_PASSENGERS });
});

await test('the surge airport has a route at the board; the candidates move with the network', () => {
  let seen = 0;
  for (let seed = 0xA1A1; seed < 0xA1A1 + 30; seed++) {
    const session = botRun(seed, 'endless', true, true, 2 * TICKS_PER_WEEK);
    const sim = session.simulation;
    if (sim.world.status !== 'upgrade' || sim.tickCount !== 2 * TICKS_PER_WEEK) continue;
    const record = sim.world.surgeRecords().at(-1);
    if (!record) continue;
    seen++;
    assert.equal(record.week, 2);
    assert.ok(sim.world.cityView(record.cityId).routes > 0, 'served airport');
  }
  assert.ok(seen >= 5, `${seen} runs reached the week-2 board with a surge`);
});

await test('save → load keeps the surge and the exact hash (envelope v4); v3 envelopes load; D-76 replay keeps it', () => {
  const sim = botRun(fullSeed, 'endless', true, true, fullSurge!.startTick + 60).simulation;
  assert.ok(sim.world.surge?.active);
  const save = encodeSave(saveSourceFromSim(sim), 1000);
  assert.equal(save.v, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 4);
  const decoded = decodeSave(JSON.stringify(save));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.deepEqual(restored.sim.world.surge, sim.world.surge);
  restored.sim.advance(400);
  sim.advance(400);
  assert.equal(restored.sim.hash(), sim.hash(), 'continues identically (extra passengers included)');
  const old = restoreSimDetailed(encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000));
  assert.ok(old && old.replayed);
  assert.equal(old.sim.config.demandSurge, true);
  assert.equal(old.sim.config.weeklyContract, true);
  assert.equal(old.sim.hash(), sim.hash(), 'unchanged rules replay to the same hash');
  // A v3 envelope (pre-R2i: contract, no surge) still loads to its hash, re-tagged; tampering is caught as v3.
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
  assert.equal(decodeSave(JSON.stringify({ ...save, v: 5 })).status, 'error', 'a newer envelope is refused');
  // A surge snapshot cannot be loaded into a run without the flag, nor the reverse.
  const snap = JSON.parse(sim.snapshot());
  snap.state.config = { mode: 'endless', weeklyContract: true };
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(snap)));
  const bare = JSON.parse(plain.snapshot());
  bare.state.config = { ...bare.state.config, demandSurge: true };
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(bare)));
});

await test('tag mark and pause sheet: pennant state, +N and the local clock (PL/EN)', () => {
  assert.equal(localClock(8), '08:00');
  assert.equal(localClock(22), '22:00');
  assert.equal(localClock(26), '02:00');
  assert.equal(surgeMark(null), null);
  assert.equal(surgeKey(null), '');
  const view = { week: 2, cityId: 'WAW', startLocalHour: 14, announceTick: 9000, startTick: 10440, endTick: 10800,
    passengers: 12, active: false, endLocalHour: 20, extra: 0 };
  assert.deepEqual(surgeMark(view), { cityId: 'WAW', mark: { phase: 'announced', passengers: 12, time: '14:00' } });
  assert.deepEqual(surgeMark({ ...view, active: true }), { cityId: 'WAW', mark: { phase: 'active', passengers: 12, time: '20:00' } });
  assert.notEqual(surgeKey(surgeMark(view)), surgeKey(surgeMark({ ...view, active: true })));
  const base = { routes: 2, assigned: 2, spare: 0, hubs: [], minutesToBoard: 300 };
  const surge = { airport: 'WAW', passengers: 12, startLocalHour: 14, endLocalHour: 20, active: false };
  setLanguage('en');
  assert.equal(pauseSummary(base).length, 3, 'no row without a surge');
  assert.equal(pauseSummary({ ...base, surge: null }).length, 3);
  assert.deepEqual(pauseSummary({ ...base, surge }).at(-1), { key: 'surge', label: 'Passenger surge', value: 'WAW +12, 14:00–20:00 local' });
  assert.equal(pauseSummary({ ...base, surge: { ...surge, active: true } }).at(-1)!.value, 'WAW +12, now until 20:00 local');
  setLanguage('pl');
  assert.deepEqual(pauseSummary({ ...base, surge }).at(-1), { key: 'surge', label: 'Szczyt ruchu', value: 'WAW +12, 14:00–20:00 czasu lok.' });
  assert.equal(pauseSummary({ ...base, surge: { ...surge, active: true } }).at(-1)!.value, 'WAW +12, teraz, do 20:00 czasu lok.');
  setLanguage('en');
});

console.log(`SUMMARY test:demand-surge seed=0xA1A1 fullSeed=0x${fullSeed.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

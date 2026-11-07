// [night-12bd] R2j / D-253: weather front, a post-launch candidate behind `GameConfig.weatherFront` (off in shipped
// Endless; DEV `?weather=front`, tests and the bot only). Default runs are bit-for-bit origin/dev 7759457: Daily (and
// its leaderboard replay), flagless Endless, shipped Endless (contract + surge) and a class III run keep their bot
// hashes, ticks, scores and save bytes. The front path is a pure function of the seed (own RNG fork, nothing saved);
// an airport inside the band's latitudes is under the deck 4 game hours a week and loses one hourly departure slot.
// Only a weather save is written as envelope v6 (a pre-R2j build refuses it as 'unsupported'); every other save stays
// a v5. Fails on the old code: no weather module, no weatherFront config, no front on the tags.
import assert from 'node:assert/strict';
import { createGame, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { assignPlane, createPlaneFleet, createScheduledRoute } from '../src/sim/planes.ts';
import { tickPlaneSchedule } from '../src/sim/schedule.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import {
  SIM_MINUTES_PER_WEEK, WEATHER_FIRST_WEEK, WEATHER_FORECAST_MINUTES, WEATHER_PARAMS_VERSION, WEATHER_SLOT_PENALTY, WEATHER_GROUND_HOLD_MINUTES,
  WEATHER_WIDTH_TENTHS,
} from '../src/sim/params.ts';
import {
  airportFrontPhase, drawFront, frontBand, frontCovers, frontOver, TURN_TENTHS, WEATHER_LIFE_MINUTES, weatherWeekAt, weatherGroundHold,
} from '../src/sim/weather.ts';
import { seedFromString } from '../src/core/rng.ts';
import { CITY_RECORDS } from '../src/data/index.ts';
import {
  decodeSave, encodeSave, replaySave, restoreSimDetailed, saveSourceFromSim, SAVE_VERSION, WEATHER_SAVE_VERSION,
} from '../src/game/save.ts';
import { EndlessRun, ENDLESS_WEATHER_FRONT } from '../src/game/run.ts';
import { HubDepartureLog } from '../src/game/hubBoard.ts';
import { frontKey, frontMark, frontMarks, frontSummary, localClockMinute } from '../src/game/weather.ts';
import { pauseSummary } from '../src/game/pauseSummary.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
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
function botRun(seed: number, mode: 'endless' | 'daily', contract: boolean, surge: boolean, licence: 1 | 2 | 3 = 1,
    weather = false, maxTicks = 18_000) {
  const session = createBalanceSession(seed, mode, null, contract, surge, licence, weather);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}
/** FNV-1a over the envelope fields in the order save.ts checksums them (to forge an envelope as written). */
function checksum(body: Record<string, unknown>): string {
  const data = JSON.stringify([body.v, body.savedAt, body.seed, body.tick, body.snapshot, body.commands,
    body.stateHash, body.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { hash ^= data.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
const POS = new Map(CITY_RECORDS.map((city) => [city.code, { lon10: Math.round(city.lon * 10), lat10: Math.round(city.lat * 10) }]));

// Bot runs on origin/dev 7759457 (before R2j): final hash, tick, score and the FNV-1a of the save written at savedAt 0.
// Daily = the leaderboard world; endless+contract+surge = a new shipped Endless run.
const GOLDEN: Record<string, { hash: string; tick: number; score: number; save: string }> = {
  'daily:41377': { hash: '61693056', tick: 6958, score: 163, save: '7835f57f' },
  'endless:41377': { hash: '6a2d0971', tick: 6958, score: 163, save: '7d982360' },
  'endless+contract+surge:41377': { hash: '52ab6123', tick: 6958, score: 163, save: '97e7114f' },
  'endless+contract+surge+class3:41377': { hash: '7d35b602', tick: 6958, score: 149, save: '63bf8bdd' },
  'daily:45746': { hash: '060b04c6', tick: 12178, score: 565, save: 'a0e7839d' },
  'endless:45746': { hash: '72ed8fcb', tick: 12178, score: 565, save: 'b3d4ad1a' },
  'endless+contract+surge:45746': { hash: '59572cd7', tick: 12178, score: 571, save: '2ed2e3fc' },
  'endless+contract+surge+class3:45746': { hash: '1d760073', tick: 7803, score: 274, save: '1f3989f3' },
  'daily:50115': { hash: '1225dcd9', tick: 9659, score: 116, save: 'bd7a9866' },
  'endless:50115': { hash: '608b0fd2', tick: 9659, score: 116, save: '8fd86e92' },
  'endless+contract+surge:50115': { hash: 'e911950c', tick: 9659, score: 116, save: 'd867ccb3' },
  'endless+contract+surge+class3:50115': { hash: 'c3d74225', tick: 10424, score: 147, save: '0db6bc8a' },
};

await test('default flags = origin/dev: Daily, Endless, shipped Endless and class III keep hashes, ticks, scores and save bytes', () => {
  for (const [key, want] of Object.entries(GOLDEN)) {
    const [kind, seed] = key.split(':') as [string, string];
    const mode = kind === 'daily' ? 'daily' : 'endless';
    const sim = botRun(Number(seed), mode, kind.includes('+contract'), kind.includes('+surge'), kind.endsWith('class3') ? 3 : 1);
    const save = JSON.stringify(encodeSave(saveSourceFromSim(sim), 0));
    assert.deepEqual({ hash: sim.hash(), tick: sim.tickCount, score: sim.world.score, save: seedFromString(save).toString(16).padStart(8, '0') },
      want, key);
    assert.equal(sim.config.weatherFront, undefined, `${key}: no weather field`);
    assert.equal(JSON.parse(save).v, SAVE_VERSION, `${key}: still a v5 envelope`);
    assert.equal(sim.world.weather, null);
    if (mode === 'daily') {
      const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, { mode: 'daily' }, true);
      assert.equal(replay.hash(), want.hash, `${key}: server replay`);
    }
  }
});

await test('switch: shipped Endless leaves the front off; only an explicit flag turns it on, never in Daily or puzzles', () => {
  assert.equal(ENDLESS_WEATHER_FRONT, false);
  assert.deepEqual(EndlessRun.create(7).sim.config, { mode: 'endless', weeklyContract: true, demandSurge: true });
  assert.equal(EndlessRun.create(7).weatherFront, false);
  const on = EndlessRun.create(7, 'endless', null, 1, true);
  assert.deepEqual(on.sim.config, { mode: 'endless', weeklyContract: true, demandSurge: true, weatherFront: true });
  assert.equal(on.weatherFront, true);
  assert.deepEqual(EndlessRun.create(7, 'daily', null, 1, true).sim.config, { mode: 'daily' });
  assert.deepEqual(createGame(7, 'daily', undefined, null, false, false, 1, true).config, { mode: 'daily' });
  for (const config of [{ mode: 'daily', weatherFront: true }, { mode: 'endless', weatherFront: false },
    { mode: 'endless', weatherFront: 1 }, { mode: 'puzzle', puzzleId: 'p01', weatherFront: true }]) {
    assert.throws(() => new Sim(7, config as never), JSON.stringify(config));
  }
  assert.equal(WEATHER_PARAMS_VERSION, 2);
  assert.equal(RULES_VERSION, 6, 'no rules bump: the flag-off rules are unchanged');
});

await test('path: own RNG fork per week, none in week 1, forms 1–6 h after the board and is gone before the next one', () => {
  for (const seed of [0, 1, 0xA1A1, 0xFFFF_FFFF, 123_456_789]) {
    assert.equal(drawFront(seed, 1), null);
    for (let week = WEATHER_FIRST_WEEK; week <= 30; week++) {
      const front = drawFront(seed, week)!;
      assert.deepEqual(drawFront(seed, week), front, 'pure');
      const start = (week - 1) * SIM_MINUTES_PER_WEEK;
      assert.ok(front.formTick >= start + 60 && front.formTick <= start + 360 && front.formTick % 60 === 0);
      assert.equal(front.endTick, front.formTick + WEATHER_LIFE_MINUTES);
      assert.ok(front.endTick < week * SIM_MINUTES_PER_WEEK, 'gone before the next board');
      assert.ok(front.startLon10 >= -1800 && front.startLon10 < 1800 && front.startLon10 % 150 === 0);
      assert.ok(front.southLat10 >= -400 && front.northLat10 <= 700 && front.northLat10 - front.southLat10 === 400);
      assert.equal(weatherWeekAt(front.formTick), week);
    }
  }
  // Different seeds and weeks draw different fronts.
  const keys = new Set<string>();
  for (let seed = 0; seed < 40; seed++) keys.add(JSON.stringify({ ...drawFront(seed, 2), week: 0, formTick: 0, endTick: 0 }));
  assert.ok(keys.size > 30, `${keys.size} distinct fronts`);
  assert.equal(weatherWeekAt(TICKS_PER_WEEK), 2, 'the board minute already belongs to the coming front');
});

await test('geometry: every point in the band latitudes is under the deck exactly 4 game hours, once; the band agrees', () => {
  const front = drawFront(0xA1A1, 3)!;
  const width = WEATHER_WIDTH_TENTHS;
  for (let lon10 = -1800; lon10 < 1800; lon10 += 37) {
    const lat10 = front.southLat10 + 123;
    const over = frontOver(front, lon10, lat10)!;
    assert.equal(over.toTick - over.fromTick, width, 'four hours');
    let covered = 0;
    for (let minute = front.formTick - 10; minute < front.endTick + 10; minute++) {
      const inside = frontCovers(front, lon10, lat10, minute);
      if (inside) covered++;
      const band = frontBand(front, minute);
      if (band) {
        // The band [west, east] (unwrapped) holds the point exactly when it is covered (west edge exclusive once formed).
        const d = (((lon10 - front.startLon10) % TURN_TENTHS) + TURN_TENTHS) % TURN_TENTHS;
        const inBand = front.startLon10 + d <= band.eastLon10 && (front.startLon10 + d > band.westLon10 || band.westLon10 === front.startLon10 && d === 0);
        assert.equal(inBand, inside, `lon ${lon10} minute ${minute}`);
      } else assert.equal(inside, false);
    }
    assert.equal(covered, width);
  }
  assert.equal(frontOver(front, 0, front.northLat10), null, 'north edge exclusive');
  assert.equal(frontOver(front, 0, front.southLat10 - 1), null);
  assert.equal(frontBand(front, front.formTick - 1), null);
  assert.equal(frontBand(front, front.endTick), null);
  // Forecast: 'ahead' within six hours before arrival (from the board on), 'under' while covered.
  const over = frontOver(front, front.startLon10 + 1200, front.southLat10)!;
  assert.equal(airportFrontPhase(front, over, over.fromTick - WEATHER_FORECAST_MINUTES - 1), null);
  assert.equal(airportFrontPhase(front, over, over.fromTick - WEATHER_FORECAST_MINUTES), 'ahead');
  assert.equal(airportFrontPhase(front, over, over.fromTick), 'under');
  assert.equal(airportFrontPhase(front, over, over.toTick), null);
});

await test('front coverage and unchanged slot capacity', () => {
  let under = 0;
  for (const seed of [0xA1A1, 0xA1A3]) {
    const off = createBalanceSession(seed, 'endless', null, true, true, 1, false);
    const on = createBalanceSession(seed, 'endless', null, true, true, 1, true);
    for (let i = 0; i < 600; i++) {
      const snapshot = off.snapshot();
      if (snapshot.status === 'finished') break;
      const decision = chooseBotAction(snapshot);
      if (decision) { off.dispatch(decision.command); on.dispatch(decision.command); }
      for (let k = 0; k < 30; k++) {
        off.advance(1); on.advance(1);
        const a = off.simulation.world;
        const b = on.simulation.world;
        if (a.status !== 'running' || b.status !== 'running') continue;
        for (const city of a.cities()) {
          const weather = b.airportWeather(city.id);
          const covered = weather?.phase === 'under';
          if (covered) under++;
          const p = POS.get(city.id)!;
          const front = b.weather?.front;
          assert.equal(covered, !!front && frontCovers(front, p.lon10, p.lat10, b.minute), `${city.id} at ${b.minute}`);
          assert.equal(b.cityView(city.id).departureSlots, city.departureSlots - (covered ? WEATHER_SLOT_PENALTY : 0),
            `${city.id} at ${b.minute}`);
          assert.equal(b.departureSlotLimit(city.id), a.departureSlotLimit(city.id) - (covered ? WEATHER_SLOT_PENALTY : 0));
        }
      }
    }
    // The flag adds nothing to the world snapshot (the path is derived), and no kernel RNG stream moves because of it.
    const a = JSON.parse(off.simulation.snapshot());
    const b = JSON.parse(on.simulation.snapshot());
    assert.deepEqual(Object.keys(b.state.world).sort(), Object.keys(a.state.world).sort());
  }
  assert.ok(under > 200, `airport-minutes under the deck seen: ${under}`);
});

await test('bot departures wait under the front', () => {
  const run = createBalanceSession(0xA1A2, 'endless', null, true, true, 1, true);
  for (let i = 0; i < 2000; i++) {
    const snapshot = run.snapshot();
    if (snapshot.status === 'finished') break;
    const decision = chooseBotAction(snapshot);
    if (decision) run.dispatch(decision.command);
    run.advance(30);
  }
  assert.ok(run.weather().slotHoldsUnder > 0, 'a departure is held while the airport is under the front');
});

await test('weather to slot: each reason reported once and curfew time counts from readiness', () => {
  const setup = () => {
    const sim = createGame(0xA1A1, 'endless', undefined, null, false, false, 1, true);
    const world = sim.world as any;
    let covered = true, limit = 0, curfew = false;
    world.underFront = () => covered;
    world.departureSlotLimit = () => limit;
    const route = createScheduledRoute('test', ['FRA', 'NYC'], () => 100);
    const fleet = createPlaneFleet({ turboprop: 1 });
    assignPlane(fleet, route, 'turboprop');
    const plane = fleet.planes[0]!; plane.remainingServiceTicks = 0;
    world.fleet = fleet;
    world.routes = () => [{ id: 'test', cityIds: ['FRA', 'NYC'], planeIds: [plane.id] }];
    const run = new EndlessRun(sim);
    const curfewGate = { canDepart: () => !curfew, canLand: () => true };
    const tick = () => tickPlaneSchedule(fleet, [route], undefined, curfewGate, world.slotGate);
    return { world, plane, run, tick, setCovered: (v: boolean) => { covered = v; }, setLimit: (v: number) => { limit = v; }, setCurfew: (v: boolean) => { curfew = v; } };
  };
  const a = setup();
  for (let i = 0; i < WEATHER_GROUND_HOLD_MINUTES + 3; i++) a.tick();
  const events = a.world.drainEvents().filter((e: { type: string }) => e.type === 'DepartureHeld');
  assert.deepEqual(events.map((e: { reason?: string; first: boolean }) => [e.reason ?? 'slot', e.first]), [['weather', false], ['slot', true]]);
  assert.equal(a.world.slotEverHeld, true);
  assert.equal(a.world.slotWait.get('FRA'), 3);
  a.tick(); assert.equal(a.world.drainEvents().length, 0, 'no repeated slot event');
  a.setLimit(10); a.tick(); assert.equal(a.plane.phase, 'flight');
  assert.equal(a.plane.weatherReadyTicks, undefined); assert.equal(a.plane.slotWaitReported, undefined);
  const board = setup();
  const log = new HubDepartureLog(); let minute = 0;
  const city = (id: string, region: 'EUN' | 'NAM', waiting: ('NAM')[]) => ({ id, region, waiting, connecting: 0,
    capacity: 12, hub: true, jamTicksLeft: null, slotHeld: 0, nextSlotMinutes: 0, curfewClosed: false, lon: 0, lat: 0 });
  const view = () => ({ clockMinute: minute, cityList: () => [city('FRA', 'EUN', ['NAM']), city('NYC', 'NAM', [])],
    routeList: () => [{ id: 'test', cityIds: ['FRA', 'NYC'], aircraft: 'turboprop' as const }],
    planeList: () => board.run.planeList() });
  log.observe(view());
  for (let i = 0; i < WEATHER_GROUND_HOLD_MINUTES + 1; i++) { board.tick(); minute++; }
  log.observe(view());
  assert.equal(board.run.planeList()[0]!.slotWaitTicks, 1, 'weather time is not returned as slot time');
  assert.equal(log.board(view(), 'FRA')!.rows.find((row) => row.region === 'NAM')!.minutes, 1,
    'hub board attributes only the one slot minute');
  board.setCovered(false); board.tick(); minute++; log.observe(view());
  assert.equal(log.board(view(), 'FRA')!.rows.find((row) => row.region === 'NAM')!.minutes, 2);
  const mixed = setup(); const mixedLog = new HubDepartureLog(); let mixedMinute = 0;
  const mixedView = () => ({ clockMinute: mixedMinute, cityList: () => [city('FRA', 'EUN', ['NAM']), city('NYC', 'NAM', [])],
    routeList: () => [{ id: 'test', cityIds: ['FRA', 'NYC'], aircraft: 'turboprop' as const }],
    planeList: () => mixed.run.planeList() });
  mixedLog.observe(mixedView()); mixed.setCovered(false);
  for (let i = 0; i < 2; i++) { mixed.tick(); mixedMinute++; }
  mixed.setCovered(true);
  for (let i = 0; i < 13; i++) { mixed.tick(); mixedMinute++; }
  mixed.setCovered(false);
  for (let i = 0; i < 2; i++) { mixed.tick(); mixedMinute++; }
  mixedLog.observe(mixedView());
  assert.equal(mixed.world.slotWait.get('FRA'), 4);
  assert.equal(mixed.run.planeList()[0]!.slotWaitTicks, 2, 'current streak alone is incomplete');
  assert.equal(mixedLog.board(mixedView(), 'FRA')!.rows.find((row) => row.region === 'NAM')!.minutes, 4,
    'both slot periods are counted despite unobserved weather');
  const b = setup(); b.setCurfew(true); b.setLimit(10);
  for (let i = 0; i < 20; i++) b.tick();
  assert.equal(b.plane.weatherReadyTicks, 20); assert.equal(b.plane.slotWaitTicks, 0);
  b.setCurfew(false); b.tick(); assert.equal(b.plane.phase, 'flight', 'curfew wait satisfies weather hold');
  const c = setup(); c.setCovered(false);
  c.tick(); c.setCovered(true); c.tick();
  const both = c.world.drainEvents().filter((e: { type: string }) => e.type === 'DepartureHeld');
  assert.deepEqual(both.map((e: { reason?: string }) => e.reason ?? 'slot'), ['slot', 'weather'], 'weather counted after prior slot wait');
});

await test('weather-to-slot state survives save and restore without changing plain saves', () => {
  const session = createBalanceSession(0xA1A2, 'endless', null, true, true, 1, true);
  let active: string | undefined;
  for (let i = 0; i < 15000 && !active; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished') break;
    if (i % 30 === 0) { const decision = chooseBotAction(snapshot); if (decision) session.dispatch(decision.command); }
    session.advance(1);
    active = session.simulation.world.planes.find((p) => p.weatherWaitReported && !p.slotWaitReported &&
      (p.weatherReadyTicks ?? 0) < WEATHER_GROUND_HOLD_MINUTES)?.id;
  }
  assert.ok(active, 'a live weather-held plane was found');
  const saved = encodeSave(saveSourceFromSim(session.simulation), 1000);
  const decoded = decodeSave(JSON.stringify(saved)); assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save); assert.ok(restored && !restored.replayed);
  const w = restored.sim.world as any;
  const p = w.fleet.planes.find((plane: { id: string }) => plane.id === active);
  assert.equal(p.weatherWaitReported, true); assert.ok(p.weatherReadyTicks > 0);
  w.underFront = () => true; w.departureSlotLimit = () => 0; w.drainEvents();
  const gate = { canDepart: () => true, canLand: () => true };
  for (let i = 0; i < WEATHER_GROUND_HOLD_MINUTES + 2; i++) tickPlaneSchedule(w.fleet, w.schedules, undefined, gate, w.slotGate);
  const events = w.drainEvents().filter((e: { type: string; planeId?: string }) => e.type === 'DepartureHeld' && e.planeId === active);
  assert.equal(events.filter((e: { reason?: string }) => e.reason === 'weather').length, 0, 'weather event is not duplicated');
  assert.equal(events.filter((e: { reason?: string }) => e.reason !== 'weather').length, 1, 'first actual slot wait is reported');
  assert.ok(p.weatherSlotWaitTicks > 0, 'slot-only count survives transition');
  const beforeTotals = { ...p.weatherSlotWaitTotals };
  const savedAgain = encodeSave(saveSourceFromSim(restored.sim), 1001);
  const decodedAgain = decodeSave(JSON.stringify(savedAgain)); assert.equal(decodedAgain.status, 'ok');
  if (decodedAgain.status !== 'ok') return;
  const restoredAgain = restoreSimDetailed(decodedAgain.save); assert.ok(restoredAgain && !restoredAgain.replayed);
  const restoredPlane = restoredAgain.sim.world.planes.find((plane) => plane.id === active);
  assert.deepEqual(restoredPlane?.weatherSlotWaitTotals, beforeTotals, 'per-airport totals survive restore');
});

await test('ground hold boundaries: only under front and only until ready wait elapsed', () => {
  assert.equal(weatherGroundHold(false, 0), false);
  assert.equal(weatherGroundHold(true, 0), true);
  assert.equal(weatherGroundHold(true, WEATHER_GROUND_HOLD_MINUTES - 1), true);
  assert.equal(weatherGroundHold(true, WEATHER_GROUND_HOLD_MINUTES), false);
  assert.equal(weatherGroundHold(false, WEATHER_GROUND_HOLD_MINUTES - 1), false);
});

await test('a weather run is deterministic: replay and undo-free resume reach the same hash', () => {
  const sim = botRun(0xA1A2, 'endless', true, true, 1, true, TICKS_PER_WEEK + 2400);
  assert.equal(sim.config.weatherFront, true);
  assert.ok(sim.world.minute > TICKS_PER_WEEK && sim.world.weather, 'a front this week');
  const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, sim.config);
  assert.equal(replay.hash(), sim.hash());
  const flagless = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, { mode: 'endless', weeklyContract: true, demandSurge: true });
  assert.notEqual(flagless.hash(), sim.hash(), 'the flag is part of the hash');
});

await test('save: a weather run writes envelope v7 and resumes with its front; v5 never carries it; D-76 replay keeps it', () => {
  const sim = botRun(0xA1A2, 'endless', true, true, 1, true, TICKS_PER_WEEK + 2400);
  const save = encodeSave(saveSourceFromSim(sim), 1000);
  assert.equal(save.v, WEATHER_SAVE_VERSION);
  assert.equal(WEATHER_SAVE_VERSION, 7);
  assert.equal(SAVE_VERSION, 5, 'every other save is still a v5');
  assert.ok(WEATHER_SAVE_VERSION > SAVE_VERSION, 'a pre-R2j build (reads ≤ v5) refuses it as unsupported');
  const decoded = decodeSave(JSON.stringify(save));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  assert.equal(decoded.save.v, WEATHER_SAVE_VERSION);
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.equal(new EndlessRun(restored.sim).weatherFront, true);
  restored.sim.advance(600);
  sim.advance(600);
  assert.equal(restored.sim.hash(), sim.hash(), 'continues identically');
  // Re-encoding the loaded weather save keeps v7.
  assert.equal(encodeSave(saveSourceFromSim(restored.sim), 1000).v, WEATHER_SAVE_VERSION);
  // Envelope and flag must agree: a weather snapshot tagged v5, or a v7 without the front, is corrupt.
  const { checksum: _a, ...asV5 } = { ...save, v: SAVE_VERSION };
  assert.deepEqual(decodeSave(JSON.stringify({ ...asV5, checksum: checksum(asV5) })), { status: 'error', issue: 'corrupt' });
  const plain = encodeSave(saveSourceFromSim(botRun(0xA1A2, 'endless', true, true, 1, false, 1200)), 1000);
  assert.equal(plain.v, SAVE_VERSION);
  const { checksum: _b, ...asV6 } = { ...plain, v: WEATHER_SAVE_VERSION };
  assert.deepEqual(decodeSave(JSON.stringify({ ...asV6, checksum: checksum(asV6) })), { status: 'error', issue: 'corrupt' });
  const { checksum: _c, ...v7 } = { ...save, v: WEATHER_SAVE_VERSION + 1 };
  assert.deepEqual(decodeSave(JSON.stringify({ ...v7, checksum: checksum(v7) })), { status: 'error', issue: 'unsupported' });
  const { checksum: _legacy, ...legacyV6 } = { ...save, v: 6 };
  assert.deepEqual(decodeSave(JSON.stringify({ ...legacyV6, checksum: checksum(legacyV6) })), { status: 'error', issue: 'unsupported' });
  // D-76: an older-rules save is replayed with its front.
  const old = encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000);
  const replayed = replaySave(old);
  assert.ok(replayed);
  assert.equal(replayed.config.weatherFront, true);
  assert.equal(replayed.hash(), sim.hash(), 'unchanged rules replay to the same hash');
});

await test('UI model: tag marks (ahead / under, local clock), stable keys, pause row in EN and PL', () => {
  assert.equal(localClockMinute(0), '00:00');
  assert.equal(localClockMinute(14 * 60 + 5), '14:05');
  assert.equal(localClockMinute(-60), '23:00');
  const ahead = { fromTick: 5000, toTick: 5240, phase: 'ahead' as const, fromLocalMinute: 14 * 60 + 20, toLocalMinute: 18 * 60 + 20 };
  const under = { ...ahead, phase: 'under' as const };
  assert.deepEqual(frontMark(ahead), { phase: 'ahead', slots: WEATHER_GROUND_HOLD_MINUTES, time: '14:20' });
  assert.deepEqual(frontMark(under), { phase: 'under', slots: WEATHER_GROUND_HOLD_MINUTES, time: '18:20' });
  assert.equal(frontMark(null), null);
  assert.notEqual(frontKey(frontMark(ahead)), frontKey(frontMark(under)));
  assert.equal(frontKey(null), '');
  const views: Record<string, typeof ahead | typeof under> = { WAW: under, BER: ahead, PRG: { ...ahead, fromTick: 4900, fromLocalMinute: 12 * 60 } };
  const of = (id: string) => views[id] ?? null;
  assert.deepEqual([...frontMarks(['WAW', 'BER', 'LHR'], of).keys()], ['WAW', 'BER']);
  assert.deepEqual(frontSummary(['WAW', 'BER', 'PRG'], of, (id) => id), { under: ['WAW'], until: '18:20', next: { airport: 'PRG', time: '12:00' } });
  const base = { routes: 2, assigned: 2, spare: 0, hubs: [], minutesToBoard: 100 };
  setLanguage('en');
  const rowsEn = pauseSummary({ ...base, front: frontSummary(['WAW', 'BER'], of, (id) => id) });
  assert.deepEqual(rowsEn.at(-1), { key: 'front', label: 'Weather front', value: 'WAW: front until 18:20 local' });
  assert.equal(pauseSummary({ ...base, front: frontSummary(['BER'], of, (id) => id) }).at(-1)!.value, 'Reaches BER at 14:20 local');
  assert.equal(pauseSummary({ ...base, front: { under: [], until: null, next: null } }).at(-1)!.value, 'Away from your airports');
  assert.equal(pauseSummary(base).some((row) => row.key === 'front'), false, 'no row without a front');
  setLanguage('pl');
  assert.deepEqual(pauseSummary({ ...base, front: frontSummary(['WAW'], of, (id) => id) }).at(-1),
    { key: 'front', label: 'Front atmosferyczny', value: 'WAW: front do 18:20 czasu lok.' });
  setLanguage('en');
  for (const key of ['airport.frontSoon', 'airport.frontUnder', 'airport.frontSoonAria', 'airport.frontUnderAria', 'pause.summary.front',
    'pause.summary.frontUnder', 'pause.summary.frontSoon', 'pause.summary.frontAway'] as const) {
    assert.ok(en[key] && pl[key] && en[key] !== '' && pl[key] !== '', key);
  }
});

await test('run view: a weather run forecasts and shows the front on served airports; a shipped run shows none', () => {
  // The bot's run on 0xA1A1, stopped at the first minute a front is forecast for or over one of its airports.
  const session = createBalanceSession(0xA1A1, 'endless', null, true, true, 1, true);
  const phases = new Set<string>();
  let seen = 0;
  for (let i = 0; i < 2000 && phases.size < 2; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished') break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
    const sim = session.simulation;
    const run = new EndlessRun(sim);
    for (const city of run.cityList()) {
      const view = run.airportWeather(city.id);
      if (!view) continue;
      seen++;
      phases.add(view.phase);
      assert.ok(run.weather, 'a front this week');
      assert.ok(view.phase === 'ahead' ? view.fromTick > sim.world.minute && view.fromTick - sim.world.minute <= WEATHER_FORECAST_MINUTES
        : sim.world.minute >= view.fromTick && sim.world.minute < view.toTick);
    }
  }
  assert.deepEqual([...phases].sort(), ['ahead', 'under'], 'both a forecast and a front overhead were shown');
  const shipped = new EndlessRun(botRun(0xA1A1, 'endless', true, true, 1, false, TICKS_PER_WEEK + 3000));
  assert.equal(shipped.weather, null);
  assert.ok(shipped.cityList().every((city) => shipped.airportWeather(city.id) === null));
  assert.ok(seen > 0);
});

console.log(`SUMMARY test:weather-front passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

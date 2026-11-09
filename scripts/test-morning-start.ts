// [night-86a] D-343 (P-3 of the 9 Nov playtest): a new Endless or Daily run starts at local 07:00 at its first airport
// (the sim's clock airport) instead of at UTC midnight, which put the Americas at ~19:00 and Europe at ~01:00. The
// start is `GameConfig.morningStart`: a clock shift (whole hours) added to the game minute before every local reading
// (demand profile, curfew, surge hours, weather times, city views) and to the sun (`EndlessRun.utcMinute`); weeks and
// days keep counting game minutes, so every game day and week starts at 07:00 there. Runs without the flag (older
// saves, puzzles) are unchanged; the Daily leaderboard replays with the flag (DAILY_RULES_VERSION 7).
// Fails on the old code: no `morningStart`, no `clockShift`, the first view at the home airport is not 07:00.
import assert from 'node:assert/strict';
import { calendarDayAt, calendarWeekAt, createGame, HOME_REGIONS, MORNING_START_LOCAL_HOUR, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { isLocalCurfewHour, localHourAt, morningStartShift } from '../src/sim/daynight.ts';
import { CITY_RECORDS } from '../src/data/index.ts';
import { decodeSave, encodeSave, restoreSimDetailed, saveSourceFromSim } from '../src/game/save.ts';
import { EndlessRun, RUN_MORNING_START } from '../src/game/run.ts';
import { buildDailySubmission, DAILY_CONFIG, DAILY_RULES_VERSION, verifyDailySubmission } from '../src/net/submission.ts';
import { dailySeedForKey } from '../src/core/daily.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from './bot.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const OFFSET = new Map(CITY_RECORDS.map((city) => [city.code, city.utcOffsetH]));
const localDay = (minute: number): number => ((minute % 1440) + 1440) % 1440;

function botRun(seed: number, mode: 'endless' | 'daily', morning: boolean, maxTicks = 18_000) {
  const session = createBalanceSession(seed, mode, null, mode === 'endless', mode === 'endless', 1, false, morning);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}

test('the shift: whole hours so that the clock airport reads 07:00 at minute 0', () => {
  assert.equal(MORNING_START_LOCAL_HOUR, 7);
  for (let offset = -12; offset <= 12; offset++) {
    const shift = morningStartShift(offset);
    assert.ok(shift >= 0 && shift < 1440 && shift % 60 === 0, `offset ${offset}: ${shift}`);
    assert.equal(localHourAt(shift, offset), 7, `offset ${offset}`);
  }
  assert.throws(() => morningStartShift(13), RangeError);
});

test('new Endless runs (every home region and Random) and Daily open at 07:00 on the boarding pass', () => {
  assert.equal(RUN_MORNING_START, true);
  const runs: EndlessRun[] = [EndlessRun.create(0xA1A1), EndlessRun.create(0xA1A1, 'daily')];
  for (const region of HOME_REGIONS) for (const seed of [1, 0xB2B2, 41377]) runs.push(EndlessRun.create(seed, 'endless', region));
  for (const run of runs) {
    const world = run.sim.world;
    assert.equal(run.sim.config.morningStart, true, `${run.mode} config`);
    assert.ok(world.clockCityId && world.activeCityIds().includes(world.clockCityId));
    assert.equal(world.clockShift, morningStartShift(OFFSET.get(world.clockCityId)!));
    assert.equal(localDay(run.localMinute), MORNING_START_LOCAL_HOUR * 60, `${run.seed} ${run.homeRegion}: 07:00`);
    assert.equal(world.cityView(world.clockCityId).localHour, MORNING_START_LOCAL_HOUR);
    assert.equal(run.utcMinute, world.minute + world.clockShift, 'the sun reads UTC');
    assert.equal(run.clockMinute, 0, 'weeks and days count from the start');
  }
  assert.deepEqual(EndlessRun.create(1, 'daily').sim.config, DAILY_CONFIG);
});

test('without the flag (older saves) and in puzzles the run still starts at UTC midnight', () => {
  for (const sim of [createGame(0xA1A1), createGame(0xA1A1, 'daily'), createGame(1, 'puzzle', '01')]) {
    assert.equal(sim.config.morningStart, undefined);
    assert.equal(sim.world.clockShift, 0);
  }
  assert.throws(() => new Sim(1, { mode: 'puzzle', puzzleId: '01', morningStart: true }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'endless', morningStart: false as never }), /configuration/);
  assert.equal(RULES_VERSION, 6, 'a config flag: no kernel rules bump (hashes of flagless runs unchanged)');
});

test('days and weeks count from the start: each game day and week begins at 07:00 at the clock airport', () => {
  const run = EndlessRun.create(0xC3C3, 'endless', 'NAM');
  const home = OFFSET.get(run.sim.world.clockCityId!)! * 60 + run.sim.world.clockShift;
  for (let day = 0; day <= 2 * TICKS_PER_WEEK / 1440; day++) {
    assert.equal(localDay(day * 1440 + home), 7 * 60, `day ${day + 1} begins at 07:00`);
  }
  assert.deepEqual([calendarWeekAt(1), calendarDayAt(1)], [1, 1]);
  assert.deepEqual([calendarWeekAt(1441), calendarDayAt(1441)], [1, 2]);
  assert.deepEqual([calendarWeekAt(TICKS_PER_WEEK + 1), calendarDayAt(TICKS_PER_WEEK + 1)], [2, 1]);
});

test('local readings of the sim follow the shift: city hours, curfew, surge window, all deterministic', () => {
  const sim = botRun(0xA1A2, 'endless', true, 4 * TICKS_PER_WEEK);
  const world = sim.world;
  const shift = world.clockShift;
  assert.ok(shift > 0 || OFFSET.get(world.clockCityId!) === 7);
  for (const id of world.activeCityIds()) {
    const view = world.cityView(id);
    assert.equal(view.localHour, localHourAt(world.minute + shift, OFFSET.get(id)!), id);
    assert.equal(view.curfewClosed, view.curfewCity && isLocalCurfewHour(world.minute + shift, OFFSET.get(id)!), id);
  }
  let surges = 0;
  for (const surge of world.surgeRecords()) {
    surges++;
    assert.equal(localHourAt(surge.startTick + shift, OFFSET.get(surge.cityId)!), surge.startLocalHour, 'surge opens at its local hour');
  }
  assert.ok(surges > 0, 'the bot run saw a surge');
  const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, sim.config);
  assert.equal(replay.hash(), sim.hash(), 'journal replay');
  assert.equal(botRun(0xA1A2, 'endless', true, 4 * TICKS_PER_WEEK).hash(), sim.hash(), 'same seed, same run');
  assert.notEqual(botRun(0xA1A2, 'endless', false, 4 * TICKS_PER_WEEK).hash(), sim.hash(), 'the start is in the hash');
});

test('save → load keeps the morning start and the hash; the D-76 replay keeps it too', () => {
  const sim = botRun(0xA1A3, 'endless', true, TICKS_PER_WEEK + 600);
  const decoded = decodeSave(JSON.stringify(encodeSave(saveSourceFromSim(sim), 1000)));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.equal(restored.sim.world.clockShift, sim.world.clockShift);
  assert.equal(new EndlessRun(restored.sim).localMinute, new EndlessRun(sim).localMinute, 'the same home clock after a restore');
  const old = restoreSimDetailed(encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000));
  assert.ok(old && old.replayed);
  assert.equal(old.sim.config.morningStart, true);
  assert.equal(old.sim.hash(), sim.hash(), 'unchanged rules replay to the same hash');
});

test('Daily leaderboard: a morning Daily verifies (rules 7); a pre-D-343 Daily is old rules', () => {
  const day = '2026-11-09';
  const seed = dailySeedForKey(day);
  const morning = botRun(seed, 'daily', true);
  assert.equal(morning.world.status, 'over');
  const honest = buildDailySubmission(morning, day);
  assert.equal(honest.rulesVersion, DAILY_RULES_VERSION);
  const verdict = verifyDailySubmission(JSON.parse(JSON.stringify(honest)), [day]);
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  const midnight = botRun(seed, 'daily', false);
  const old = buildDailySubmission(midnight, day);
  assert.equal(old.rulesVersion, DAILY_RULES_VERSION - 1);
  assert.deepEqual(verifyDailySubmission(JSON.parse(JSON.stringify(old)), [day]), { ok: false, reason: 'old_rules' });
});

console.log(`SUMMARY test:morning-start seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

// [night-10r] End-of-run timeline (src/game/runTimeline.ts): a bot-played Endless run (fixed seed) is re-read from its
// journal in a separate Sim; the counts equal the accepted commands of the live run, rejected commands are not
// counted, the weekly crate shows in the week after its board, the live sim is untouched, and a foreign journal
// yields null. [night-10t] Live outcomes: no replay for a run in one sitting, only a resumed save's prefix; undo
// and restore keep the outcomes in step with the journal.
import assert from 'node:assert/strict';
import { chooseBotAction } from '../src/game/dev/bot-policy.ts';
import { buildRunTimeline, timelineFromAccepted } from '../src/game/runTimeline.ts';
import { Sim, TICKS_PER_WEEK, type CommandEntry } from '../src/sim/index.ts';
import { createBalanceSession } from './balance-game-adapter.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The balance bot to the end (or 30 min); live counts of accepted network commands from the sim's own events. */
function play(seed: number) {
  const session = createBalanceSession(seed);
  const sim = session.simulation;
  for (let step = 0; step < 600; step++) {
    const snap = session.snapshot();
    if (snap.status === 'finished') break;
    const decision = chooseBotAction(snap);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return sim;
}

const sim = play(SEED);
const journal = sim.getCommandLog();
const input = { seed: SEED, config: sim.config, journal, endTick: sim.tickCount, endMinute: sim.world.minute,
  upgrades: sim.world.upgrades };

await test('bot run: weeks 1..end, counts add up to the journal network commands, picks after their board', async () => {
  const hash = JSON.stringify(sim.getState()).length;
  const weeks = await buildRunTimeline(input);
  assert.ok(weeks, 'timeline built');
  assert.equal(weeks.length, Math.ceil(sim.world.minute / TICKS_PER_WEEK));
  assert.deepEqual(weeks.map((w) => w.week), weeks.map((_, i) => i + 1));
  const routes = journal.filter(([, c]) => c.type === 'AddRoute').length;
  assert.ok(routes > 0, 'bot opened routes');
  // The bot pre-checks every command, so all of its network commands were accepted.
  assert.equal(weeks.reduce((n, w) => n + w.routes, 0), routes);
  assert.equal(weeks.reduce((n, w) => n + w.extended, 0), journal.filter(([, c]) => c.type === 'ExtendRoute').length);
  assert.equal(weeks.reduce((n, w) => n + w.aircraft, 0),
    journal.filter(([, c]) => c.type === 'AssignPlane' || (c.type === 'AddRoute' && c.aircraft)).length);
  for (const record of sim.world.upgrades) assert.equal(weeks[record.week]?.pick?.upgrade, record.upgrade);
  assert.equal(weeks[0]!.pick, undefined);
  assert.equal(JSON.stringify(sim.getState()).length, hash, 'live sim untouched');
});

await test('a command the sim refuses at its tick is not counted', async () => {
  const first = journal.find(([, c]) => c.type === 'AddRoute')!;
  // Well-formed but refused at its tick: no such route.
  const bogus: CommandEntry = [first[0] + 1, { type: 'RemoveRoute', routeId: 'r999' }];
  const patched = [...journal, bogus].sort((a, b) => a[0] - b[0]);
  const base = await buildRunTimeline(input);
  const weeks = await buildRunTimeline({ ...input, journal: patched });
  assert.ok(base && weeks);
  assert.equal(weeks.reduce((n, w) => n + w.removed, 0), base.reduce((n, w) => n + w.removed, 0));
});

await test('pure counting: quiet weeks, removals, hub pick', () => {
  const weeks = timelineFromAccepted([
    { minute: 10, entry: [11, { type: 'AddRoute', cityIds: ['LON', 'PAR'], aircraft: 'turboprop' }] },
    { minute: 20, entry: [21, { type: 'AssignPlane', routeId: 'r1', aircraft: 'widebody' }] },
    { minute: 2 * TICKS_PER_WEEK + 5, entry: [99, { type: 'RemoveRoute', routeId: 'r1' }] },
  ], 2 * TICKS_PER_WEEK + 100, [{ week: 1, upgrade: 'hub-expansion', hubId: 'LON' }]);
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks[0], { week: 1, routes: 1, extended: 0, removed: 0, aircraft: 2 });
  assert.deepEqual(weeks[1], { week: 2, routes: 0, extended: 0, removed: 0, aircraft: 0, pick: { upgrade: 'hub-expansion', hubId: 'LON' } });
  assert.equal(weeks[2]!.removed, 1);
});

await test('a journal that does not fit the run (past its end) gives null', async () => {
  const late: CommandEntry = [sim.tickCount + 50, { type: 'SetSpeed', speed: 1 }];
  assert.equal(await buildRunTimeline({ ...input, journal: [...journal, late] }), null);
});

await test('the replay yields to the caller in slices', async () => {
  let yields = 0;
  await buildRunTimeline(input, async () => { yields++; });
  // Without outcomes the replay runs up to the last journal entry.
  assert.ok(yields >= Math.floor(journal.at(-1)![0] / 1500), `yields ${yields}`);
});

// [night-10t] The live Sim records each entry's outcome, so a run played in one sitting needs no replay.
await test('live outcomes: same timeline as the replay, without replaying (no yields, seed never used)', async () => {
  const outcomes = sim.getCommandOutcomes();
  assert.equal(outcomes.length, journal.length);
  assert.ok(outcomes.every((o) => o !== null), 'every outcome known on a live run');
  const replayed = await buildRunTimeline(input);
  let yields = 0;
  // A wrong seed would replay a different world: equal output proves the outcomes alone were used.
  const live = await buildRunTimeline({ ...input, seed: SEED + 1, outcomes }, async () => { yields++; });
  assert.deepEqual(live, replayed);
  assert.equal(yields, 0);
});

await test('a command refused at its tick is recorded as not accepted by the live sim', () => {
  const probe = createBalanceSession(SEED).simulation;
  probe.apply({ type: 'RemoveRoute', routeId: 'r999' });
  probe.apply({ type: 'SetSpeed', speed: 1 });
  probe.tick();
  assert.deepEqual(probe.getCommandOutcomes(), [{ minute: 0, accepted: false }, { minute: 0, accepted: true }]);
});

await test('resumed save: outcomes unknown before the resume, only that prefix is replayed, result unchanged', async () => {
  const session = createBalanceSession(SEED);
  const live = session.simulation;
  const half = Math.floor(sim.tickCount / 2);
  let i = 0;
  while (live.tickCount < half) {
    while (i < journal.length && journal[i]![0] === live.tickCount + 1) live.apply(journal[i++]![1]);
    live.tick();
  }
  const resumed = Sim.fromSnapshot(live.snapshot());
  const known = resumed.getCommandOutcomes();
  assert.ok(known.length > 0 && known.every((o) => o === null), 'restored journal has unknown outcomes');
  while (resumed.tickCount < sim.tickCount) {
    while (i < journal.length && journal[i]![0] === resumed.tickCount + 1) resumed.apply(journal[i++]![1]);
    resumed.tick();
  }
  const outcomes = resumed.getCommandOutcomes();
  assert.ok(outcomes.some((o) => o !== null), 'entries after the resume are known');
  assert.equal(resumed.hash(), sim.hash());
  let yields = 0;
  const weeks = await buildRunTimeline({ ...input, outcomes }, async () => { yields++; });
  assert.deepEqual(weeks, await buildRunTimeline(input));
  assert.ok(yields <= Math.floor(half / 1500) + 1, `replay stopped near the resume (yields ${yields})`);
});

await test('undo keeps the outcomes in step with the journal (re-simulated outcomes)', () => {
  const s = createBalanceSession(SEED).simulation;
  let i = 0;
  const stop = journal.find(([, c]) => c.type === 'AddRoute')![0] + 200;
  while (s.tickCount < stop) {
    while (i < journal.length && journal[i]![0] === s.tickCount + 1) s.apply(journal[i++]![1]);
    s.tick();
  }
  assert.ok(s.undo(), 'undo');
  const outcomes = s.getCommandOutcomes();
  assert.equal(outcomes.length, s.getCommandLog().length);
  const fresh = Sim.replay(SEED, s.getCommandLog(), s.tickCount, s.config);
  assert.deepEqual(outcomes, fresh.getCommandOutcomes());
});

console.log(`SUMMARY test:run-timeline seed=0x${SEED.toString(16).toUpperCase()} ticks=${sim.tickCount} weeks=${Math.ceil(sim.world.minute / TICKS_PER_WEEK)} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

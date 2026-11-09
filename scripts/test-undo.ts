import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.ts';
import { CHECKPOINT_EVERY_TICKS } from '../src/sim/undo.ts';
import { TICKS_PER_WEEK } from '../src/sim/clock.ts';
import { withinBudget } from './lib/time-budget.mjs';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from '../src/game/dev/bot-policy.ts';
import { EndlessRun } from '../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../src/game/dev/autoplay.ts';

const SEED = 0xa1a1;
let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
const skip = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.tick(); };
const route = (id: string) => ({ type: 'RemoveRoute' as const, routeId: id });

check('undo of queued action does not advance time', () => {
  const sim = new Sim(SEED);
  const before = sim.hash();
  assert.equal(sim.undo(), false);
  sim.apply(route('pending'));
  assert.equal(sim.undo(), true);
  assert.equal(sim.pendingCount, 0);
  assert.equal(sim.hash(), before);
});
check('undo restores exact hash at the same tick', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, 10); skip(reference, 11);
  edited.apply(route('test'));
  edited.tick();
  assert.notEqual(edited.hash(), reference.hash());
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), reference.hash());
  assert.equal(edited.tickCount, 11);
});
check('undo last of two same-tick commands, then first', () => {
  const edited = new Sim(SEED);
  const once = new Sim(SEED);
  const none = new Sim(SEED);
  edited.apply(route('first'));
  edited.apply(route('second'));
  once.apply(route('first'));
  edited.tick(); once.tick(); none.tick();
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), once.hash());
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), none.hash());
  assert.equal(edited.undo(), false);
});
check('checkpoint exactly at command boundary is not reused', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, CHECKPOINT_EVERY_TICKS - 1);
  edited.apply(route('on-boundary'));
  edited.tick();
  skip(reference, CHECKPOINT_EVERY_TICKS);
  assert.equal(edited.undo(), true);
  assert.equal(edited.hash(), reference.hash());
});
check('undo across checkpoints retains older actions', () => {
  const edited = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(edited, 100); skip(reference, 100);
  edited.apply(route('kept')); reference.apply(route('kept'));
  edited.tick(); reference.tick();
  skip(edited, 1_200); skip(reference, 1_200);
  edited.apply({ type: 'SetSpeed', speed: 4 });
  edited.tick(); reference.tick();
  assert.equal(edited.undo(), true);
  assert.equal(edited.speed, 1);
  assert.equal(edited.hash(), reference.hash());
});
check('undo after snapshot restore keeps the exact old state', () => {
  const sim = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(sim, 1_258); skip(reference, 1_258);
  sim.apply(route('saved-edit'));
  sim.tick(); reference.tick();
  const restored = Sim.fromSnapshot(sim.snapshot());
  assert.equal(restored.undo(), true);
  assert.equal(restored.hash(), reference.hash());
});
check('undo still works after bounded checkpoint ring eviction', () => {
  const sim = new Sim(SEED);
  const reference = new Sim(SEED);
  skip(sim, 40_000); skip(reference, 40_000);
  sim.apply(route('late')); sim.tick(); reference.tick();
  assert.equal(sim.undo(), true);
  assert.equal(sim.hash(), reference.hash());
});
// [night-07x] Undo right after a weekly choice popped the choice itself: the world went back to the board the UI
// had already closed and the clock froze with nothing on screen. The choice must stay.
// [night-56a] D-313 (Q-92 → A): nor may Undo reach past it. A closed week is a barrier; network commands made
// after the pick are still undone one by one, the choice and everything before it stay.
check('undo after a weekly choice stops at the closed week; later edits still undo', () => {
  const session = createBalanceSession(SEED);
  for (let i = 0; i < 2000 && session.snapshot().status !== 'upgrade'; i++) {
    const decision = chooseBotAction(session.snapshot());
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  const sim = session.simulation;
  assert.equal(sim.world.status, 'upgrade', 'bot reached the week-1 board');
  const offer = sim.world.offer!.offers.find((item) => item.id === 'turboprop' || item.id === 'widebody')!;
  sim.apply({ type: 'ChooseUpgrade', week: sim.world.offer!.week, upgrade: offer.id });
  skip(sim, 40);
  const journal = sim.getCommandLog();
  assert.equal(journal[journal.length - 1][1].type, 'ChooseUpgrade');
  assert.ok(journal.some(([, command]) => command.type !== 'ChooseUpgrade'), 'network commands before the pick');
  const hash = sim.hash();
  assert.equal(sim.canUndo, false, 'nothing undoable right after the pick');
  assert.equal(sim.undo(), false);
  assert.equal(sim.hash(), hash, 'a refused Undo changes nothing');
  assert.equal(JSON.stringify(sim.getCommandLog()), JSON.stringify(journal));
  // A network edit after the pick: queued, it is undone in place; journaled, it is undone with an exact replay.
  sim.apply(route('after-pick-queued'));
  assert.equal(sim.canUndo, true);
  assert.equal(sim.undo(), true);
  assert.equal(sim.pendingCount, 0);
  const reference = Sim.fromSnapshot(sim.snapshot());
  sim.apply(route('after-pick')); sim.tick(); reference.tick();
  skip(sim, 20); skip(reference, 20);
  assert.equal(sim.undo(), true);
  assert.equal(sim.hash(), reference.hash());
  assert.equal(sim.world.upgrades.length, 1, 'the weekly choice survives Undo');
  assert.equal(sim.undo(), false, 'the barrier holds after the later edit is gone');
  const minute = sim.world.minute;
  skip(sim, 10);
  assert.ok(sim.world.minute > minute, 'the clock keeps running after Undo');
});
// [night-56a] Q-92 repro (N47a): before D-313 Undo removed the ExtendRoute from tick 2161, the re-simulation jammed
// KHI at tick 4124 (before the week-1 board at 4320) and the run ended in the past with the turboprop pick gone.
check('Q-92: Undo right after the week-1 pick never ends the run in the past (seed 42704 ASI class II)', () => {
  const run = EndlessRun.create(42704, 'endless', 'ASI', 2);
  for (let i = 0; i < 20_000 && run.sim.world.status === 'running'; i++) {
    if (run.tick % AUTOPLAY_ACTION_INTERVAL === 0) {
      const command = nextAutoplayCommand(run.sim);
      if (command) run.queue(command);
    }
    run.step();
  }
  assert.equal(run.sim.world.status, 'upgrade', 'bot reached the week-1 board');
  assert.equal(run.tick, 4320);
  assert.ok(run.queue({ type: 'ChooseUpgrade', week: run.sim.world.offer!.week, upgrade: 'turboprop' }));
  run.step();
  const tick = run.tick;
  const hash = run.sim.hash();
  assert.equal(run.networkUndoable, false, 'the HUD shows Undo disabled');
  assert.equal(run.undo(), null);
  assert.equal(run.sim.world.status, 'running');
  assert.equal(run.failed, null);
  assert.equal(run.tick, tick);
  assert.equal(run.sim.hash(), hash);
  assert.deepEqual(run.sim.world.upgrades, [{ week: 1, upgrade: 'turboprop' }]);
});
// [night-58a] Q-93 repro (N58a), pinned for the browser suite (`test:e2e:undo-refused-jam:stub`): D-313 stops Undo at
// the pick, but the edits after it still undo exactly, and without them the re-simulation can end the run in the past.
// Seed 42041 ASI class I, week-1 turboprop, 24 game hours of bot edits (AssignPlane 4591, ExtendRoute 5761): before
// N60a the second Undo ended the run at tick 5692 on DEL with the clock at 5761. [night-60a] D-321 (Q-93 → A): that
// Undo is refused, with the airport and the tick, and the run is exactly as before the tap.
// [night-86a] D-343: new runs start at local 07:00, so the repro moved to seed 42022 ASI (found by a scan of the same
// steps): AssignPlane 4411, ExtendRoute 5041; the second Undo would jam TAS at tick 5600 (clock at 5761).
const q93 = (): EndlessRun => {
  const run = EndlessRun.create(42022, 'endless', 'ASI');
  const bot = (until: number) => {
    while (run.tick < until && run.sim.world.status === 'running') {
      if (run.tick % AUTOPLAY_ACTION_INTERVAL === 0) {
        const command = nextAutoplayCommand(run.sim);
        if (command) run.queue(command);
      }
      run.step();
    }
  };
  bot(Number.MAX_SAFE_INTEGER);
  assert.equal(run.sim.world.status, 'upgrade');
  assert.equal(run.tick, 4320);
  assert.ok(run.queue({ type: 'ChooseUpgrade', week: 1, upgrade: 'turboprop' }));
  run.step();
  bot(run.tick + 24 * 60);
  assert.equal(run.tick, 5761);
  assert.deepEqual(run.sim.getCommandLog().slice(-2).map(([tick, command]) => [tick, command.type]),
    [[4411, 'AssignPlane'], [5041, 'ExtendRoute']]);
  return run;
};
const q93Run = q93();
check('Q-93 (D-321): an Undo whose re-simulation ends the run is refused, the run unchanged (seed 42022 ASI)', () => {
  const run = q93Run;
  assert.ok(run.undo(), 'first Undo (the ExtendRoute) is fine');
  assert.equal(run.failed, null);
  const snapshot = run.sim.snapshot();
  const log = JSON.stringify(run.sim.getCommandLog());
  const outcomes = JSON.stringify(run.sim.getCommandOutcomes());
  const revision = run.revision;
  const refusal = run.tryUndo();
  assert.ok(refusal && !(refusal instanceof EndlessRun), 'second Undo refused');
  assert.equal(refusal.cityId, 'TAS');
  assert.equal(refusal.tick, 5600, 'the tick the re-simulation jammed at (the run ended there before N60a)');
  assert.equal(run.undo(), null, 'refused again on a second tap');
  assert.equal(run.sim.world.status, 'running');
  assert.equal(run.failed, null);
  assert.equal(run.tick, 5761);
  assert.equal(run.revision, revision, 'nothing for the session to redraw');
  assert.equal(run.sim.snapshot(), snapshot, 'state, journal, queue and checkpoint ring as before the tap');
  assert.equal(JSON.stringify(run.sim.getCommandLog()), log);
  assert.equal(JSON.stringify(run.sim.getCommandOutcomes()), outcomes, 'outcomes kept too (not part of the snapshot)');
  assert.deepEqual(run.sim.world.upgrades, [{ week: 1, upgrade: 'turboprop' }]);
  assert.equal(run.networkUndoable, true, 'canUndo stays cheap: the button stays enabled, the tap is refused');
  assert.equal(run.sim.drainEvents().length, 0, 'the refused re-simulation leaks no events');
});
check('Q-93 (D-321): after a refusal the run plays on exactly like one that was never tapped', () => {
  const tapped = q93Run;
  const reference = q93();
  assert.ok(reference.undo());
  assert.equal(reference.sim.hash(), tapped.sim.hash());
  for (let i = 0; i < 3 * CHECKPOINT_EVERY_TICKS && reference.sim.world.status === 'running'; i++) {
    reference.step();
    tapped.step();
  }
  assert.equal(tapped.tick, reference.tick);
  assert.equal(tapped.sim.snapshot(), reference.sim.snapshot(), 'same hash, journal and checkpoints afterwards');
  const replayed = Sim.replay(tapped.sim.seed, tapped.sim.getCommandLog(), tapped.tick, tapped.sim.config);
  assert.equal(replayed.hash(), tapped.sim.hash(), 'the journal replays to the same state (Daily verification)');
});
// test:replay-cost style budget (600 ms per game week of replay on a CI runner, D-97): a refused Undo re-simulates
// from the checkpoint before the removed command to the jam, the same loop and length an accepted Undo of it runs
// up to the jam, then puts the old objects back (no copy of the world).
const UNDO_BUDGET_MS_PER_WEEK = 600;
check('Q-93 (D-321): a refused Undo costs one re-simulation to the jam, in the replay-cost budget', () => {
  const run = q93();
  assert.ok(run.undo());
  const removedTick = run.sim.getCommandLog().at(-1)![0];
  const fromTick = Math.floor((removedTick - 1) / CHECKPOINT_EVERY_TICKS) * CHECKPOINT_EVERY_TICKS;
  const runs = 5;
  let refusal: ReturnType<EndlessRun['tryUndo']> = null;
  const started = performance.now();
  for (let i = 0; i < runs; i++) refusal = run.tryUndo();
  const ms = (performance.now() - started) / runs;
  assert.ok(refusal && !(refusal instanceof EndlessRun));
  const ticks = refusal.tick - fromTick;
  const msPerWeek = ms * TICKS_PER_WEEK / ticks;
  console.log(`INFO refused Undo: ${ticks} ticks re-simulated (${fromTick} → ${refusal.tick}) in ${ms.toFixed(1)} ms, ` +
    `${msPerWeek.toFixed(0)} ms per game week (budget ${UNDO_BUDGET_MS_PER_WEEK})`);
  assert.ok(withinBudget('refused Undo', msPerWeek, UNDO_BUDGET_MS_PER_WEEK), `${msPerWeek.toFixed(0)} ms per week`);
});
check('a queued weekly choice is a barrier too', () => {
  const sim = new Sim(SEED);
  sim.apply(route('before'));
  sim.apply({ type: 'ChooseUpgrade', week: 1, upgrade: 'turboprop' });
  assert.equal(sim.canUndo, false);
  assert.equal(sim.undo(), false);
  assert.equal(sim.pendingCount, 2);
});
check('undo never removes a lone weekly choice', () => {
  const sim = new Sim(SEED);
  sim.apply({ type: 'ChooseUpgrade', week: 1, upgrade: 'turboprop' });
  assert.equal(sim.undo(), false);
  assert.equal(sim.pendingCount, 1);
});
console.log(`SUMMARY test:undo seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

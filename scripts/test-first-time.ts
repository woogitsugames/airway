// [night-11p] R6a/R6b (D-130): the first-time card registry and triggers, and the three-step training flight.
import assert from 'node:assert/strict';
import {
  FIRST_TIME_CARDS, FIRST_TIME_KEY, FIRST_TIME_VERSION, FirstTimeRegistry, LEGACY_SLOT_KEY, beyondRange, curfewAirport,
  fillingHub, surgeAnnouncement,
} from '../src/game/tutorial/first-time.ts';
import { clearFirstTimeCards } from '../src/game/tutorial/first-time.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from './bot.ts';
import { TUTORIAL_ACTION_STEPS, TUTORIAL_KEY, TUTORIAL_STEPS, TutorialController, type TutorialPort } from '../src/game/tutorial/controller.ts';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const port = (): TutorialPort & { paused: boolean } => ({ paused: false, perform: () => true, setPaused(p) { this.paused = p; } });

await test('registry: a card shows once per install, remembered under one versioned key', () => {
  const storage = memory();
  const first = new FirstTimeRegistry(storage);
  assert.equal(first.seen('hub-full'), false);
  first.mark('hub-full');
  first.mark('curfew');
  assert.deepEqual(JSON.parse(storage.data.get(FIRST_TIME_KEY)!), { v: FIRST_TIME_VERSION, seen: ['hub-full', 'curfew'] });
  const again = new FirstTimeRegistry(storage);
  assert.ok(again.seen('hub-full') && again.seen('curfew'));
  assert.equal(again.seen('weekly-board'), false);
});
await test('registry: the slot hint keeps its task-32 flag; other versions and junk are ignored', () => {
  assert.ok(new FirstTimeRegistry(memory({ [LEGACY_SLOT_KEY]: '1' })).seen('slots'));
  const storage = memory();
  new FirstTimeRegistry(storage).mark('slots');
  assert.equal(storage.data.get(LEGACY_SLOT_KEY), '1');
  assert.equal(storage.data.has(FIRST_TIME_KEY), false);
  assert.equal(new FirstTimeRegistry(memory({ [FIRST_TIME_KEY]: '{"v":99,"seen":["curfew"]}' })).seen('curfew'), false);
  assert.equal(new FirstTimeRegistry(memory({ [FIRST_TIME_KEY]: '{oops' })).seen('curfew'), false);
  assert.equal(new FirstTimeRegistry(memory({ [FIRST_TIME_KEY]: '{"v":1,"seen":["nope"]}' })).seen('curfew'), false);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const registry = new FirstTimeRegistry(blocked);
  registry.mark('curfew');
  assert.ok(registry.seen('curfew'), 'blocked storage still remembers within the session');
});
await test('hub-full trigger: a hub at 70 % of its places (not a plain airport), the fullest first', () => {
  const city = (id: string, hub: boolean, waiting: number, capacity: number) => ({ id, hub, waiting, capacity });
  assert.equal(fillingHub([city('A', true, 25, 36)]), null); // 69 %
  assert.equal(fillingHub([city('A', true, 26, 36)])?.id, 'A'); // 72 %
  assert.equal(fillingHub([city('A', false, 36, 36)]), null);
  assert.equal(fillingHub([city('A', true, 30, 0)]), null);
  assert.equal(fillingHub([city('A', true, 26, 36), city('B', true, 30, 36)])?.id, 'B');
});
await test('out-of-range trigger: nearest open airport beyond the turboprop range', () => {
  const km: Record<string, number> = { 'N-A': 3000, 'N-B': 2600, 'N-C': 900 };
  const distance = (a: string, b: string) => km[`${a}-${b}`] ?? 0;
  assert.equal(beyondRange('N', ['N', 'A', 'B'], 2500, distance), 2600);
  assert.equal(beyondRange('N', ['N', 'A', 'B', 'C'], 2500, distance), null);
  assert.equal(beyondRange('N', ['N'], 2500, distance), null, 'no other airport: nothing to compare');
});
await test('curfew trigger: the first closed airport', () => {
  assert.equal(curfewAirport([{ id: 'A' }, { id: 'B', curfewClosed: true }])?.id, 'B');
  assert.equal(curfewAirport([{ id: 'A', curfewClosed: false }]), null);
});
await test('training flight: three steps (route, aircraft, transfer), then cleared and saved', async () => {
  assert.deepEqual([...TUTORIAL_STEPS], ['route', 'aircraft', 'transfer', 'complete']);
  assert.equal(TUTORIAL_ACTION_STEPS, 3);
  const storage = memory();
  const tutorial = new TutorialController(port(), storage);
  assert.ok(await tutorial.submit({ type: 'route', from: 'LON', to: 'PAR' }));
  assert.ok(await tutorial.submit({ type: 'assign-aircraft', route: 'LON-PAR' }));
  assert.ok(await tutorial.submit({ type: 'inspect-transfer', hub: 'PAR' }));
  assert.equal(tutorial.getState().step, 'complete');
  assert.equal(JSON.parse(storage.data.get(TUTORIAL_KEY)!).status, 'completed');
});
await test('training flight: old saves (7-step list) — completed stays done, a removed step starts again', () => {
  const done = new TutorialController(port(), memory({ [TUTORIAL_KEY]: '{"version":1,"status":"completed","step":"complete","selectedUpgrade":"hub"}' }));
  assert.equal(done.getState().visible, false);
  const midway = new TutorialController(port(), memory({ [TUTORIAL_KEY]: '{"version":1,"status":"in-progress","step":"congestion"}' }));
  assert.equal(midway.getState().visible, true);
  assert.equal(midway.getState().step, 'route');
});

await test('[night-11r] D-192: "Replay tutorial" brings every first-time card back (slot hint included)', () => {
  const storage = memory();
  const registry = new FirstTimeRegistry(storage);
  registry.mark('hub-full'); registry.mark('weekly-board'); registry.mark('slots');
  storage.setItem(TUTORIAL_KEY, JSON.stringify({ version: 1, status: 'completed', step: 'complete' }));
  const controller = new TutorialController(port(), storage);
  controller.replay();
  const after = new FirstTimeRegistry(storage);
  for (const card of FIRST_TIME_CARDS) assert.equal(after.seen(card), false, card);
  after.mark('curfew');
  assert.equal(new FirstTimeRegistry(storage).seen('curfew'), true);
});
// [night-35a] D-272: the demand-surge card.
await test('surge card: a new id keeps every card an older install has seen, and is itself unseen (no version bump)', () => {
  assert.equal(FIRST_TIME_VERSION, 1);
  assert.ok((FIRST_TIME_CARDS as readonly string[]).includes('surge'));
  const old = JSON.stringify({ v: 1, seen: ['hub-full', 'out-of-range', 'curfew', 'weekly-board'] });
  const storage = memory({ [FIRST_TIME_KEY]: old, [LEGACY_SLOT_KEY]: '1' });
  const registry = new FirstTimeRegistry(storage);
  for (const card of ['slots', 'hub-full', 'out-of-range', 'curfew', 'weekly-board'] as const) assert.ok(registry.seen(card), card);
  assert.equal(registry.seen('surge'), false);
  registry.mark('surge');
  const again = new FirstTimeRegistry(storage);
  assert.ok(again.seen('surge'), 'shown once per install');
  assert.deepEqual(JSON.parse(storage.data.get(FIRST_TIME_KEY)!).seen, ['hub-full', 'out-of-range', 'curfew', 'weekly-board', 'surge']);
  clearFirstTimeCards(storage);
  assert.equal(new FirstTimeRegistry(storage).seen('surge'), false, '"Replay tutorial" brings it back');
});
await test('surge trigger: an announced surge on a visible airport in Endless; not running, unseen, Daily or puzzle', () => {
  const soon = { cityId: 'FRA', active: false };
  const visible = (id: string) => id === 'FRA';
  assert.equal(surgeAnnouncement('endless', soon, visible), soon);
  assert.equal(surgeAnnouncement('endless', { cityId: 'FRA', active: true }, visible), null, 'already running');
  assert.equal(surgeAnnouncement('endless', { cityId: 'SYD', active: false }, visible), null, 'airport not drawn yet');
  assert.equal(surgeAnnouncement('endless', null, visible), null);
  assert.equal(surgeAnnouncement('daily', soon, visible), null);
  assert.equal(surgeAnnouncement('puzzle', soon, visible), null);
});
/** The bot's Endless run on this seed lives to its week-3 surge (first announced near tick 8 880); 0xA1A1 ends first. */
const SURGE_SEED = 0xA1A2;
await test('surge trigger in real play: the bot\'s Endless run announces one; the same seed in Daily never does', () => {
  const play = (mode: 'endless' | 'daily') => {
    const session = createBalanceSession(SURGE_SEED, mode, null, mode === 'endless', mode === 'endless');
    for (let i = 0; i < 2000; i++) {
      const snapshot = session.snapshot();
      if (snapshot.status === 'finished' || snapshot.tick >= 18_000) break;
      const world = session.simulation.world;
      const announced = surgeAnnouncement(mode, world.surge, (id) => world.activeCityIds().includes(id));
      if (announced) return { announced, tick: snapshot.tick };
      const decision = chooseBotAction(snapshot);
      if (decision) session.dispatch(decision.command);
      session.advance(30);
    }
    return null;
  };
  const endless = play('endless');
  assert.ok(endless, 'Endless: a surge is announced within 18 000 ticks');
  assert.equal(endless.announced.active, false);
  assert.equal(play('daily'), null, 'Daily: never');
});
console.log(`SUMMARY test:first-time seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

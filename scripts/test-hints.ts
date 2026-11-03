// [m2] Contextual one-time ATC hints (D-54): priority queue, one strip at a time, never over the weekly
// board (except the board's own hint), dropped at game over, once per install, re-armed by replay.
import assert from 'node:assert/strict';
import {
  HINT_KEYS, HintQueue, resetHintFlags, type HintContent, type HintId, type HintStorage, type HintTimers,
} from '../src/game/tutorial/hints.ts';
import { TutorialController, TUTORIAL_KEY } from '../src/game/tutorial/controller.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

class MemoryStorage implements HintStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}
/** Manual clock: timers fire only when the test advances time. */
class FakeTimers implements HintTimers {
  now = 0;
  private next = 1;
  private readonly pending = new Map<number, { at: number; callback: () => void }>();
  set(callback: () => void, ms: number): unknown { const id = this.next++; this.pending.set(id, { at: this.now + ms, callback }); return id; }
  clear(handle: unknown): void { this.pending.delete(handle as number); }
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      let first: [number, { at: number; callback: () => void }] | null = null;
      for (const entry of this.pending) if (entry[1].at <= end && (!first || entry[1].at < first[1].at)) first = entry;
      if (!first) break;
      this.pending.delete(first[0]);
      this.now = first[1].at;
      first[1].callback();
    }
    this.now = end;
  }
}
function setup(options: { enabled?: () => boolean; storage?: MemoryStorage } = {}) {
  const storage = options.storage ?? new MemoryStorage();
  const timers = new FakeTimers();
  const log: string[] = [];
  const view = {
    shown: null as HintId | null,
    show(id: HintId, content: HintContent, onBoard: boolean) { this.shown = id; log.push(`${id}${onBoard ? '@board' : ''}:${content.text}`); },
    hide() { this.shown = null; },
  };
  const queue = new HintQueue({ storage, view, timers, enabled: options.enabled, visibleMs: 9000, gapMs: 700 });
  const ask = (id: HintId, valid?: () => boolean) => queue.request(id, { content: () => ({ step: id, tag: '', text: id }), valid });
  return { storage, timers, log, view, queue, ask };
}

test('a hint shows once, persists its seen flag and auto-hides', () => {
  const { storage, timers, log, queue, ask } = setup();
  ask('slots');
  assert.equal(queue.visible, 'slots');
  assert.equal(storage.getItem(HINT_KEYS.slots), '1');
  timers.advance(8999);
  assert.equal(queue.visible, 'slots');
  timers.advance(1);
  assert.equal(queue.visible, null);
  ask('slots');
  timers.advance(20000);
  assert.deepEqual(log, ['slots:slots']);
});

test('no stacking: later requests wait, highest priority first, with a gap', () => {
  const { timers, log, queue, ask } = setup();
  ask('curfew');
  ask('slots');
  ask('jam');
  assert.equal(queue.visible, 'curfew');
  assert.deepEqual(queue.pending, ['jam', 'slots']);
  queue.hide(); // tap
  assert.equal(queue.visible, null);
  timers.advance(699);
  assert.equal(queue.visible, null);
  timers.advance(1);
  assert.equal(queue.visible, 'jam');
  timers.advance(9000 + 700);
  assert.equal(queue.visible, 'slots');
  assert.deepEqual(log.map((line) => line.split(':')[0]), ['curfew', 'jam', 'slots']);
});

test('duplicate requests while queued or visible are ignored', () => {
  const { queue, ask } = setup();
  ask('jam'); ask('jam'); ask('curfew'); ask('curfew');
  assert.deepEqual(queue.pending, ['curfew']);
});

test('never over the weekly board; the board hint only on the board', () => {
  const { timers, log, queue, ask } = setup();
  ask('slots');
  queue.setContext('board');
  assert.equal(queue.visible, null, 'board hides a visible hint');
  ask('curfew');
  ask('upgrade');
  timers.advance(700);
  assert.equal(queue.visible, 'upgrade');
  assert.deepEqual(queue.pending, ['curfew']);
  queue.setContext('game');
  assert.equal(queue.visible, null, 'closing the board takes its hint away');
  timers.advance(700);
  assert.equal(queue.visible, 'curfew');
  assert.deepEqual(log, ['slots:slots', 'upgrade@board:upgrade', 'curfew:curfew']);
});

test('the board hint is never queued outside the board', () => {
  const { queue, ask } = setup();
  ask('upgrade');
  assert.equal(queue.visible, null);
  assert.deepEqual(queue.pending, []);
});

test('game over hides and drops everything; nothing is shown afterwards', () => {
  const { timers, queue, ask, log } = setup();
  ask('jam'); ask('curfew');
  queue.setContext('over');
  assert.equal(queue.visible, null);
  ask('slots');
  timers.advance(60000);
  assert.deepEqual(log, ['jam:jam']);
});

test('a stale queued hint is skipped (valid() false), the next one shows', () => {
  const { timers, queue, ask, log } = setup();
  ask('slots');
  let jammed = true;
  ask('jam', () => jammed); // higher priority than curfew, waits behind the visible slot strip
  ask('curfew');
  jammed = false;
  queue.hide();
  timers.advance(700);
  assert.equal(queue.visible, 'curfew');
  assert.deepEqual(log.map((line) => line.split(':')[0]), ['slots', 'curfew']);
});

test('switched off: nothing shown and nothing marked seen', () => {
  let on = false;
  const { storage, queue, ask } = setup({ enabled: () => on });
  ask('jam'); ask('slots');
  assert.equal(queue.visible, null);
  assert.equal(storage.data.size, 0);
  on = true;
  ask('jam');
  assert.equal(queue.visible, 'jam');
});

test('seen flags survive a new run (reload) and replay resets them', () => {
  const storage = new MemoryStorage();
  const first = setup({ storage });
  first.ask('jam');
  first.queue.dispose();
  const second = setup({ storage });
  second.ask('jam');
  assert.equal(second.queue.visible, null);
  storage.setItem(TUTORIAL_KEY, JSON.stringify({ version: 1, status: 'completed', step: 'complete' }));
  const controller = new TutorialController({ perform: () => true, setPaused: () => {} }, storage);
  controller.replay();
  for (const key of Object.values(HINT_KEYS)) assert.equal(storage.getItem(key), null, key);
  const third = setup({ storage });
  third.ask('jam');
  assert.equal(third.queue.visible, 'jam');
});

test('reset works on storage without removeItem; the legacy slot key is kept', () => {
  const data = new Map<string, string>([['aw-tutorial-slots', '1']]);
  const storage: HintStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
  assert.equal(HINT_KEYS.slots, 'aw-tutorial-slots');
  resetHintFlags(storage);
  let shown: HintId | null = null;
  const queue = new HintQueue({ storage, timers: new FakeTimers(), view: { show: (id) => { shown = id; }, hide: () => { shown = null; } } });
  queue.request('slots', { content: () => ({ step: '', tag: '', text: '' }) });
  assert.equal(shown, 'slots');
  assert.equal(data.get('aw-tutorial-slots'), '1');
});

console.log(`SUMMARY test:hints seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

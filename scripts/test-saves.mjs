// Requires Node 22+ with --experimental-strip-types (no third-party runner).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeSave, encodeSave, readGame, restoreGame, startOrRestore, writeGame, TICKS_PER_DAY, SAVE_VERSION, WEATHER_SAVE_VERSION } from '../src/game/save.ts';
import { createNativeStorage, createBrowserStorage, GAME_SAVE_KEY, SETTINGS_KEY, readSettings, writeSettings } from '../src/platform/storage.ts';
import { GameLifecycle } from '../src/platform/lifecycle.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
const checks = [];
function test(name, fn) { checks.push({ name, fn }); }

class MemoryStore {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value) { this.values.set(key, value); }
  async remove(key) { this.values.delete(key); }
}

class SimFixture {
  seed;
  tick = 0;
  state;
  commandLog = [];
  constructor(seed = SEED) { this.seed = seed; this.state = seed >>> 0; }
  tickOnce() {
    this.tick++;
    this.state = (Math.imul(this.state ^ (this.tick >>> 0), 1664525) + 1013904223) >>> 0;
    for (const [tick, cmd] of this.commandLog) {
      if (tick === this.tick) this.state = (this.state ^ cmd.delta) >>> 0;
    }
  }
  addCommand(tick, delta) { this.commandLog.push([tick, { type: 'AddRoute', delta }]); }
  snapshot() { return { v: 1, seed: this.seed, tick: this.tick, state: this.state, rng: this.state }; }
  restore(snapshot, commands) { this.seed = snapshot.seed; this.tick = snapshot.tick; this.state = snapshot.state; this.commandLog = commands; }
  hash() { return this.state.toString(16).padStart(8, '0'); }
}

function makePrefs() {
  const data = new Map();
  return {
    data,
    async get({ key }) { return { value: data.get(key) ?? null }; },
    async set({ key, value }) { data.set(key, value); },
    async remove({ key }) { data.delete(key); },
  };
}
function makeFiles() {
  const data = new Map();
  return {
    data,
    failNextWrite: false,
    async writeFile({ path, data: content }) {
      if (this.failNextWrite) { this.failNextWrite = false; throw new Error('disk full'); }
      data.set(path, content);
    },
    async readFile({ path }) {
      if (!data.has(path)) throw new Error('missing file');
      return { data: data.get(path) };
    },
    async deleteFile({ path }) { data.delete(path); },
  };
}

test('save -> load -> identical hash and 4000 further ticks', async () => {
  const storage = new MemoryStore();
  const original = new SimFixture();
  original.addCommand(50, 4);
  original.addCommand(100, 8);
  original.addCommand(15_000, 16);
  for (let i = 0; i < 5000; i++) original.tickOnce();
  assert.equal((await writeGame(storage, original)).ok, true);
  const loaded = await readGame(storage);
  assert.equal(loaded.status, 'ok');
  const restored = restoreGame(loaded.save, (seed) => new SimFixture(seed));
  assert.ok(restored);
  assert.equal(original.hash(), restored.hash());
  assert.deepEqual(restored.commandLog, original.commandLog);
  for (let i = 0; i < 4000; i++) { original.tickOnce(); restored.tickOnce(); }
  assert.equal(original.hash(), restored.hash());
});

test('v0 -> current envelope migration, preserving snapshot and journal', () => {
  const sim = new SimFixture(); sim.addCommand(4, 123);
  for (let i = 0; i < 20; i++) sim.tickOnce();
  const legacy = { v: 0, state: sim.snapshot(), log: sim.commandLog, seed: sim.seed, tick: sim.tick };
  const decoded = decodeSave(JSON.stringify(legacy));
  assert.equal(decoded.status, 'ok');
  assert.equal(decoded.migrated, true);
  assert.equal(decoded.save.v, SAVE_VERSION);
  assert.equal(decoded.save.stateHash, null);
  const restored = restoreGame(decoded.save, seed => new SimFixture(seed));
  assert.ok(restored);
  assert.equal(restored.hash(), sim.hash());
  const next = encodeSave(restored, 1234);
  assert.equal(decodeSave(JSON.stringify(next)).status, 'ok');
});

test('corrupt JSON, malformed version, checksum tamper and dangerous keys', async () => {
  const store = new MemoryStore();
  for (const text of [
    '{oops', 'null', JSON.stringify({ v: 1, snapshot: {} }),
    JSON.stringify({ v: -1, snapshot: {} }),
    JSON.stringify({ v: 0, snapshot: { __proto__: null }, seed: SEED, tick: -1 }),
  ]) assert.equal(decodeSave(text).status, 'error');
  const sim = new SimFixture();
  const record = encodeSave(sim, 1000);
  record.snapshot.state = 9999;
  assert.equal(decodeSave(JSON.stringify(record)).status, 'error');
  // [night-12bd] R2j: v6 is the weather-front envelope, so the first unknown version is WEATHER_SAVE_VERSION + 1.
  assert.equal(decodeSave(JSON.stringify({ v: WEATHER_SAVE_VERSION + 1, future: 'unknown' })).issue, 'unsupported');
  await store.set(GAME_SAVE_KEY, '{bad');
  const started = await startOrRestore(store, () => new SimFixture(17), seed => new SimFixture(seed));
  assert.equal(started.issue, 'corrupt');
  assert.equal(started.requiresResume, false);
  assert.equal(started.game.seed, 17);
  assert.equal(await store.get(GAME_SAVE_KEY), '{bad'); // Preserved for recovery.
  assert.equal(decodeSave('{"v":0,"snapshot":{"__proto__":{"isAdmin":true}},"seed":1,"tick":0}').issue, 'corrupt');
});

test('mismatch restored hash is rejected without corrupting a running Sim', () => {
  const sim = new SimFixture();
  for (let i = 0; i < 5; i++) sim.tickOnce();
  const record = encodeSave(sim, 1000);
  assert.equal(restoreGame(record, seed => {
    const bad = new SimFixture(seed);
    bad.restore = () => { bad.state = 3; };
    return bad;
  }), null);
});

test('settings and save have independent aw- keys', async () => {
  const store = new MemoryStore();
  await writeSettings(store, { language: 'pl', muted: true });
  assert.deepEqual(await readSettings(store), { language: 'pl', muted: true });
  assert.equal(await store.get(GAME_SAVE_KEY), null);
  await writeGame(store, new SimFixture());
  assert.equal((await readSettings(store)).language, 'pl');
});

test('Capacitor Filesystem alternating slots + Preferences pointer are crash-safe', async () => {
  const preferences = makePrefs();
  const files = makeFiles();
  const storage = createNativeStorage(preferences, files);
  assert.equal(await storage.get(GAME_SAVE_KEY), null);
  await storage.set(GAME_SAVE_KEY, 'first');
  assert.equal(preferences.data.get('aw-save-active'), 'a');
  assert.equal(await storage.get(GAME_SAVE_KEY), 'first');
  files.failNextWrite = true;
  await assert.rejects(storage.set(GAME_SAVE_KEY, 'incomplete'));
  assert.equal(await storage.get(GAME_SAVE_KEY), 'first');
  await storage.set(GAME_SAVE_KEY, 'second');
  assert.equal(preferences.data.get('aw-save-active'), 'b');
  assert.equal(await storage.get(GAME_SAVE_KEY), 'second');
  await storage.set(SETTINGS_KEY, '{"language":"en"}');
  assert.equal(preferences.data.get(SETTINGS_KEY), '{"language":"en"}');
  await storage.remove(GAME_SAVE_KEY);
  assert.equal(await storage.get(GAME_SAVE_KEY), null);
  assert.equal(await storage.get(SETTINGS_KEY), '{"language":"en"}');
  await assert.rejects(storage.set('invalid-key', '0'));
});

test('IndexedDB unavailability is handled as a recoverable error', async () => {
  const missing = createBrowserStorage(undefined);
  const result = await readGame(missing);
  assert.deepEqual(result, { status: 'error', issue: 'storage-unavailable' });
});

test('daily autosave, background pause, serialized writes and explicit Resume', async () => {
  let tick = 0, paused = 0, resumed = 0, saves = 0;
  const sequence = [];
  const hooks = {
    getTick: () => tick,
    pause: () => { paused++; },
    save: async () => { const capturedTick = tick; await Promise.resolve(); saves++; sequence.push(capturedTick); },
    requireResume: () => { resumed++; },
  };
  const lifecycle = new GameLifecycle(hooks);
  for (tick = 1; tick < TICKS_PER_DAY; tick++) lifecycle.onTick();
  await lifecycle.flush(); assert.equal(saves, 0);
  tick = TICKS_PER_DAY; lifecycle.onTick();
  tick = TICKS_PER_DAY + 1; lifecycle.onTick();
  await lifecycle.onBackground(); await lifecycle.flush();
  assert.equal(paused, 1); assert.equal(saves, 2);
  assert.deepEqual(sequence, [TICKS_PER_DAY + 1, TICKS_PER_DAY + 1]);
  await lifecycle.onBackground(); assert.equal(paused, 1);
  tick = 2 * TICKS_PER_DAY; lifecycle.onTick(); await lifecycle.flush(); assert.equal(saves, 2);
  lifecycle.onForeground(); assert.equal(resumed, 1);
  tick = 2 * TICKS_PER_DAY; lifecycle.onTick(); await lifecycle.flush(); assert.equal(saves, 3);
  await lifecycle.dispose();
});

test('native App.pause / resume listener wiring and cleanup', async () => {
  const listeners = new Map(); let removed = 0;
  let paused = 0, asked = 0, saves = 0;
  const app = { async addListener(name, listener) { listeners.set(name, listener); return { async remove() { removed++; listeners.delete(name); } }; } };
  const lifecycle = new GameLifecycle({ getTick: () => 7, pause: () => paused++, save: async () => { saves++; }, requireResume: () => asked++ });
  await lifecycle.attach({ app });
  listeners.get('pause')(); await lifecycle.flush();
  listeners.get('resume')();
  assert.deepEqual([paused, saves, asked], [1, 1, 1]);
  await lifecycle.dispose();
  assert.equal(removed, 2);
});

// [night-11i] D-99 (Q-59 → B), D-119: window blur pauses and saves like a hidden tab; focus only asks for Resume.
test('window blur pauses and saves, focus asks for Resume, never twice with visibility', async () => {
  const doc = new EventTarget(); doc.hidden = false;
  const win = new EventTarget();
  let paused = 0, asked = 0, saves = 0;
  const lifecycle = new GameLifecycle({ getTick: () => 7, pause: () => paused++, save: async () => { saves++; }, requireResume: () => asked++ });
  await lifecycle.attach({ document: doc, window: win });
  win.dispatchEvent(new Event('blur')); await lifecycle.flush();
  assert.deepEqual([paused, saves, asked], [1, 1, 0], 'blur pauses and saves');
  win.dispatchEvent(new Event('blur')); await lifecycle.flush();
  assert.deepEqual([paused, saves], [1, 1], 'a second blur does nothing');
  win.dispatchEvent(new Event('focus'));
  assert.equal(asked, 1, 'focus asks for the explicit Resume');
  win.dispatchEvent(new Event('focus'));
  assert.equal(asked, 1, 'a second focus does nothing');
  // Split screen, then the app is sent to the background and brought back: one pause, one Resume request.
  win.dispatchEvent(new Event('blur'));
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); await lifecycle.flush();
  win.dispatchEvent(new Event('focus')); // focus while still hidden is ignored
  assert.deepEqual([paused, saves, asked], [2, 2, 1]);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('focus'));
  assert.deepEqual([paused, saves, asked], [2, 2, 2]);
  await lifecycle.dispose();
  win.dispatchEvent(new Event('blur')); await lifecycle.flush();
  assert.equal(paused, 2, 'disposed lifecycle ignores blur');
});

test('main.ts: the lifecycle pauses only a running flight (not the upgrade picker or game over)', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const hooks = main.slice(main.indexOf('new GameLifecycle({'), main.indexOf('void lifecycle.attach();'));
  assert.match(hooks, /pause: \(\) => \{ if \(session\?\.screen === 'game'\) session\.setPaused\(true\); \}/);
  assert.match(hooks, /requireResume: \(\) => \{ if \(session\?\.screen === 'game'\) session\.setPaused\(true\); \}/);
});


test('IndexedDB persists across separate adapter instances', async () => {
  const backing = new Map();
  let opens = 0, closes = 0;
  const fakeFactory = {
    open() {
      opens++;
      const request = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => {},
          close: () => { closes++; },
          transaction() {
            const tx = {
              oncomplete: null, onerror: null, onabort: null,
              objectStore: () => ({
                get(key) { return perform(() => backing.get(key) ?? null); },
                put(value, key) { return perform(() => { backing.set(key, value); }); },
                delete(key) { return perform(() => { backing.delete(key); }); },
              }),
            };
            function perform(action) {
              const req = { result: undefined, onsuccess: null };
              queueMicrotask(() => {
                req.result = action();
                req.onsuccess?.();
                queueMicrotask(() => tx.oncomplete?.());
              });
              return req;
            }
            return tx;
          },
        };
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  const first = createBrowserStorage(fakeFactory);
  await first.set(GAME_SAVE_KEY, 'saved');
  const second = createBrowserStorage(fakeFactory);
  assert.equal(await second.get(GAME_SAVE_KEY), 'saved');
  await second.set(SETTINGS_KEY, 'settings');
  await first.remove(GAME_SAVE_KEY);
  assert.equal(await second.get(GAME_SAVE_KEY), null);
  assert.equal(await second.get(SETTINGS_KEY), 'settings');
  assert.equal(opens, closes);
});

test('a failed autosave is reported and background pause still succeeds', async () => {
  let errors = 0, pauses = 0;
  const lifecycle = new GameLifecycle({
    getTick: () => 1440,
    pause: () => { pauses++; },
    save: async () => ({ ok: false, issue: 'storage-unavailable' }),
    requireResume: () => {},
    onError: () => { errors++; },
  });
  await lifecycle.onBackground();
  await lifecycle.flush();
  assert.deepEqual([errors, pauses], [1, 1]);
});

for (const { name, fn } of checks) {
  try { await fn(); console.log(`PASS ${name}`); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
console.log(`SUMMARY test:saves seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

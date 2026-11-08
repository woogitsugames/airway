import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const mock = { native: false, platform: 'web', available: {}, plugins: {}, throwCheck: false, share: {}, fs: {}, prefs: {} };
globalThis.__platformMock = mock;
registerHooks({
  resolve(specifier, context, next) {
    if (['@capacitor/core', '@capacitor/share', '@capacitor/filesystem', '@capacitor/preferences'].includes(specifier) && context.parentURL?.includes('/src/platform/'))
      return { url: `mock:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    const sources = {
      'mock:@capacitor/core': `export const Capacitor = { isNativePlatform: () => { if (globalThis.__platformMock.throwCheck) throw Error('unavailable'); return globalThis.__platformMock.native }, getPlatform: () => globalThis.__platformMock.platform, isPluginAvailable: n => !!globalThis.__platformMock.available[n] }; export const registerPlugin = n => globalThis.__platformMock.plugins[n];`,
      'mock:@capacitor/share': `export const Share = { canShare: (...a) => globalThis.__platformMock.share.canShare(...a), share: (...a) => globalThis.__platformMock.share.share(...a) };`,
      'mock:@capacitor/filesystem': `export const Filesystem = new Proxy({}, { get: (_, k) => (...a) => globalThis.__platformMock.fs[k](...a) }); export const Directory = { Data: 'DATA', LibraryNoCloud: 'NO_CLOUD' }; export const Encoding = { UTF8: 'utf8' };`,
      'mock:@capacitor/preferences': `export const Preferences = new Proxy({}, { get: (_, k) => (...a) => globalThis.__platformMock.prefs[k](...a) });`,
    };
    if (sources[url]) return { format: 'module', source: sources[url], shortCircuit: true };
    return next(url, context);
  },
});
const app = await import('../src/platform/appCheck.ts');
const loop = await import('../src/platform/gameLoop.ts');
const install = await import('../src/platform/install.ts');
const storage = await import('../src/platform/storage.ts');
const share = await import('../src/platform/share.ts');
const textScale = await import('../src/platform/textScale.ts');
const back = await import('../src/platform/back.ts');
const { disabledAds } = await import('../src/platform/ads.ts');
const { freeEntitlements } = await import('../src/platform/store.ts');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function reset() { Object.assign(mock, { native: false, platform: 'web', available: {}, plugins: {}, throwCheck: false, share: {}, fs: {}, prefs: {} }); }
test('native plugin discovery handles web, absent, native and throwing registries', () => {
  reset(); assert.equal(app.nativeAppCheckPort(), null); assert.equal(loop.nativeGameLoopPort(), null);
  mock.native = true; mock.platform = 'android';
  assert.equal(app.nativeAppCheckPort(), null); assert.equal(loop.nativeGameLoopPort(), null);
  mock.available = { FirebaseAppCheck: true, AirwayGameLoop: true };
  mock.plugins = { FirebaseAppCheck: { token: 1 }, AirwayGameLoop: { launch: 1 } };
  assert.equal(app.nativeAppCheckPort(), mock.plugins.FirebaseAppCheck);
  assert.equal(loop.nativeGameLoopPort(), mock.plugins.AirwayGameLoop);
  mock.platform = 'ios'; assert.equal(loop.nativeGameLoopPort(), null);
  mock.throwCheck = true; assert.equal(app.nativeAppCheckPort(), null); assert.equal(loop.nativeGameLoopPort(), null);
});
test('native text scale handles missing, rejected, invalid and valid plugin values', async () => {
  reset(); assert.equal(await textScale.systemTextScale(), null);
  mock.native = true; mock.platform = 'android'; assert.equal(await textScale.systemTextScale(), null);
  mock.available.AirwayTextScale = true;
  for (const value of [NaN, 0, 4.1, '1']) { mock.plugins.AirwayTextScale = { get: async () => ({ scale: value }) }; assert.equal(await textScale.systemTextScale(), null); }
  mock.plugins.AirwayTextScale = { get: async () => ({ scale: 1.5 }) }; assert.equal(await textScale.systemTextScale(), 1.5);
  mock.plugins.AirwayTextScale = { get: async () => { throw Error('denied'); } }; assert.equal(await textScale.systemTextScale(), null);
  mock.platform = 'ios'; assert.equal(await textScale.systemTextScale(), null);
});
test('native install marker uses the no-backup location and reports missing files', async () => {
  reset(); assert.equal(await install.createNativeInstallMarker(), null);
  mock.native = true; mock.available.Filesystem = true;
  const calls = []; let exists = false;
  mock.fs = { stat: async o => { calls.push(['stat', o]); if (!exists) throw Error('missing'); }, writeFile: async o => { calls.push(['write', o]); exists = true; } };
  const marker = await install.createNativeInstallMarker();
  assert.equal(await marker.exists(), false); await marker.write(); assert.equal(await marker.exists(), true);
  assert.equal(calls[1][1].directory, 'NO_CLOUD'); assert.equal(calls[1][1].data, '{"v":1}');
  mock.throwCheck = true; assert.equal(await install.createNativeInstallMarker(), null);
});
test('default native storage selects injected plugins and preserves pointer on failed write', async () => {
  reset(); mock.native = true; mock.available = { Preferences: true, Filesystem: true };
  const values = new Map(), files = new Map(); let fail = false;
  mock.prefs = { get: async ({key}) => ({ value: values.get(key) ?? null }), set: async ({key,value}) => values.set(key,value), remove: async ({key}) => values.delete(key) };
  mock.fs = { readFile: async ({path}) => ({data: files.get(path)}), writeFile: async ({path,data}) => { if (fail) throw Error('disk full'); files.set(path,data); }, deleteFile: async ({path}) => files.delete(path) };
  const s = await storage.createDefaultStorage();
  await s.set(storage.GAME_SAVE_KEY, 'first'); fail = true;
  await assert.rejects(s.set(storage.GAME_SAVE_KEY, 'second'), /disk full/);
  assert.equal(await s.get(storage.GAME_SAVE_KEY), 'first');
  await s.set('aw-settings-v1', '{}'); assert.equal(await s.get('aw-settings-v1'), '{}');
  await s.remove(storage.GAME_SAVE_KEY); assert.equal(await s.get(storage.GAME_SAVE_KEY), null);
  mock.throwCheck = true; const fallback = await storage.createDefaultStorage(); await assert.rejects(fallback.get('aw-save-v1'), /IndexedDB is unavailable/);
});
test('share uses native share, respects dismissal, and falls back on clipboard denial', async () => {
  reset(); const result = {dateKey:'2026-11-08',kind:'official',score:100,weeks:3,ticket:'X'};
  const translate = (key, p) => key + (p ? JSON.stringify(p) : '');
  let called = 0;
  mock.share = { canShare: async () => ({value:true}), share: async () => { called++; } };
  assert.equal((await share.shareDailyResult(result, translate)).status, 'shared'); assert.equal(called, 1);
  mock.share.share = async () => { throw Error('cancelled'); };
  assert.equal((await share.shareDailyResult(result, translate)).status, 'failed');
  mock.share.canShare = async () => { throw Error('missing plugin'); };
  const old = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable:true, value: { clipboard: { writeText: async () => { throw Error('denied'); } } } });
    assert.equal((await share.shareDailyResult(result, translate)).status, 'unavailable');
    let copied; navigator.clipboard.writeText = async text => { copied = text; };
    const outcome = await share.shareDailyResult(result, translate); assert.equal(outcome.status, 'copied'); assert.equal(copied, outcome.text);
  } finally { if (old) Object.defineProperty(globalThis, 'navigator', old); else delete globalThis.navigator; }
});
test('disabled commercial adapters never initiate purchases or ads', async () => {
  assert.equal(disabledAds.isEnabled(), false); assert.equal(await disabledAds.showRewarded(), false);
  assert.equal(await disabledAds.showInterstitialBetweenRuns(), false);
  assert.equal(freeEntitlements.isUnlocked('any'), true);
  assert.equal(await freeEntitlements.purchase('any'), 'already-unlocked');
  assert.equal(await freeEntitlements.restore(), 'not-required');
});
test('back listener delegates consumption and detaches every registered source', () => {
  delete globalThis.window; back.installBackHandler(() => true)();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const target = () => { const handlers = new Map(); return { handlers, addEventListener: (n, f) => handlers.set(n, f), removeEventListener: (n, f) => { assert.equal(handlers.get(n), f); handlers.delete(n); } }; };
  const win = target(), doc = target();
  Object.defineProperty(globalThis, 'window', { configurable:true, value:win });
  Object.defineProperty(globalThis, 'document', { configurable:true, value:doc });
  let count = 0, prevented = 0, detached = 0, native;
  try {
    const remove = back.installBackHandler(() => { count++; return count !== 2; }, { browserHistory:true, registerNativeBack: fn => { native = fn; return () => detached++; } });
    win.handlers.get('keydown')({key:'Enter',preventDefault:()=>prevented++}); assert.equal(count, 0);
    win.handlers.get('keydown')({key:'Escape',preventDefault:()=>prevented++});
    win.handlers.get(back.ANDROID_BACK_EVENT)({preventDefault:()=>prevented++});
    doc.handlers.get('backbutton')({preventDefault:()=>prevented++});
    win.handlers.get('popstate')(); native();
    assert.equal(count, 5); assert.equal(prevented, 2); remove();
    assert.equal(detached, 1); assert.equal(win.handlers.size, 0); assert.equal(doc.handlers.size, 0);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document;
  }
});
let failed = 0;
for (const [name, fn] of tests) { try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}`, e); } }
console.log(`SUMMARY test:platform-fallbacks seed=0xA1A1 passed=${tests.length-failed} failed=${failed}`);
if (failed) process.exitCode = 1;

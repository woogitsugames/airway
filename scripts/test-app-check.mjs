// [night-12az] R3e (D-246): App Check for the leaderboard callables without an emulator or the plugin. Server: the
// real functions/src/index.ts with stubbed Firebase modules (as test:leaderboard-brake) and the APP_CHECK_ENFORCED
// param injected. Client: the token source against a fake plugin port, the REST client header against a fake fetch,
// the composition (main.ts → platform port by plugin name), the release guard and the docs.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { registerHooks } from 'node:module';

const stub = {
  values: { LEADERBOARDS_PAUSED: false, APP_CHECK_ENFORCED: false },
  params: [],
  touches: [],
  db: new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      stub.touches.push(String(prop));
      throw new Error(`Firestore touched: ${String(prop)}`);
    },
  }),
};
globalThis.__awAppCheckStub = stub;
const MODULES = {
  'firebase-admin/app': 'export function initializeApp() {}',
  'firebase-admin/auth': 'export function getAuth() { return globalThis.__awAppCheckStub.db; }',
  'firebase-admin/firestore': `
    export function getFirestore() { return globalThis.__awAppCheckStub.db; }
    export const FieldValue = { serverTimestamp: () => ({}), increment: (n) => ({ n }) };
    export const Timestamp = { fromMillis: (ms) => ({ ms }) };`,
  'firebase-functions/params': `
    export function defineBoolean(name, options) {
      globalThis.__awAppCheckStub.params.push({ name, options });
      return { name, value: () => globalThis.__awAppCheckStub.values[name] };
    }`,
  'firebase-functions/v2/https': `
    export class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    export function onCall(options, handler) { const call = (request) => handler(request); call.options = options; return call; }`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in MODULES) return { url: `aw-stub:${specifier}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('aw-stub:')) return { format: 'module', source: MODULES[url.slice(8)], shortCircuit: true };
    return nextLoad(url, context);
  },
});

const functions = await import('../functions/src/index.ts');
const logic = await import('../functions/src/logic.ts');
const { appCheckTokenSource, APP_CHECK_HEADER } = await import('../src/net/appCheck.ts');
const { FirebaseRestClient } = await import('../src/net/client.ts');
const { readNetConfig, appCheckDebug } = await import('../src/net/index.ts');
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
const BOARDS = { daily: 'd-2026-11-05', weekly: 'w-2026-W45' };
const APP = { appId: '1:123:android:abc', token: { app_id: '1:123:android:abc' } };
function request(uid, data, app) {
  const reads = { count: 0 };
  const req = { auth: uid ? { uid } : null, ...(app ? { app } : {}) };
  Object.defineProperty(req, 'data', { get() { reads.count++; return data; } });
  return { req, reads };
}
function set(enforced, paused) {
  stub.values.APP_CHECK_ENFORCED = enforced;
  stub.values.LEADERBOARDS_PAUSED = paused;
  stub.touches.length = 0;
}

await check('server: one deploy-time param APP_CHECK_ENFORCED, default off; guards submitDaily + getBoards only', () => {
  assert.equal(logic.APP_CHECK_PARAM, 'APP_CHECK_ENFORCED');
  assert.deepEqual(stub.params.filter((p) => p.name === 'APP_CHECK_ENFORCED').map((p) => p.options?.default), [false]);
  assert.deepEqual([...logic.APP_CHECK_GUARDED], ['submitDaily', 'getBoards']);
  for (const name of ['submitDaily', 'getBoards', 'deleteMyData']) {
    assert.equal(functions[name].options.enforceAppCheck, undefined, name + ': SDK enforcement stays off (param decides)');
  }
});
await check('server: appCheckRefusal — off lets everything through, on needs a verified app id', () => {
  assert.equal(logic.appCheckRefusal(false, undefined), null);
  assert.equal(logic.appCheckRefusal(true, APP), null);
  for (const app of [undefined, null, {}, { appId: '' }, { appId: 7 }]) {
    assert.deepEqual(logic.appCheckRefusal(true, app), { code: 'unauthenticated', message: 'App Check token missing or invalid' });
  }
});
await check('server off (default): calls without a token behave as before', async () => {
  set(false, true);
  assert.deepEqual(await functions.submitDaily(request('u1', {}).req), logic.PAUSED_SUBMIT);
  assert.equal((await functions.getBoards(request('u1', BOARDS).req)).daily.id, BOARDS.daily);
  assert.deepEqual(stub.touches, []);
});
await check('server on: no token → unauthenticated before the brake, the limiter, the body and Firestore', async () => {
  set(true, false);
  const submit = request('u2', { submission: { v: 1 } });
  await assert.rejects(functions.submitDaily(submit.req), (e) => e.code === 'unauthenticated' && /App Check/.test(e.message));
  assert.equal(submit.reads.count, 0, 'body not read');
  await assert.rejects(functions.getBoards(request('u2', BOARDS).req), (e) => e.code === 'unauthenticated');
  assert.deepEqual(stub.touches, []);
  await assert.rejects(functions.submitDaily(request(null, {}).req), (e) => e.code === 'unauthenticated' && /Sign in/.test(e.message));
});
await check('server on: a verified token goes through (brake answer / Firestore reached)', async () => {
  set(true, true);
  assert.deepEqual(await functions.submitDaily(request('u3', {}, APP).req), logic.PAUSED_SUBMIT);
  set(true, false);
  await assert.rejects(functions.getBoards(request('u3', BOARDS, APP).req), /Firestore touched: getAll/);
});
await check('server on: deleteMyData is not guarded (erasure without attestation)', async () => {
  set(true, false);
  await assert.rejects(functions.deleteMyData(request('u4', {}).req), /Firestore touched/);
  set(false, false);
});

function fakePort(options = {}) {
  const state = { inits: [], gets: 0, token: 0 };
  const port = {
    initialize: async (opts) => { state.inits.push(opts); if (options.initFails && state.inits.length === 1) throw new Error('no FirebaseApp'); },
    getToken: async () => {
      state.gets++;
      if (options.hang) return new Promise(() => {});
      return { token: 'tok-' + (++state.token), ...(options.noExpiry ? {} : { expireTimeMillis: options.expiry ?? 3_600_000 }) };
    },
  };
  return { port, state };
}
await check('client: token source — init once with the debug flag, no background refresh (quota), cached until 5 min before expiry', async () => {
  assert.equal(appCheckTokenSource(null, { debug: false }), null);
  let clock = 0;
  const { port, state } = fakePort();
  const source = appCheckTokenSource(port, { debug: true, now: () => clock });
  assert.equal(await source(), 'tok-1');
  clock = 3_600_000 - 5 * 60_000 - 1;
  assert.equal(await source(), 'tok-1');
  clock += 2;
  assert.equal(await source(), 'tok-2');
  assert.deepEqual(state.inits, [{ debugToken: true, isTokenAutoRefreshEnabled: false }]);
  assert.equal(state.gets, 2);
});
await check('client: token source never throws — failed init retried next time, a hanging provider times out', async () => {
  const failing = fakePort({ initFails: true });
  const source = appCheckTokenSource(failing.port, { debug: false });
  assert.equal(await source(), null);
  assert.equal(await source(), 'tok-1');
  assert.equal(failing.state.inits.length, 2);
  const hanging = appCheckTokenSource(fakePort({ hang: true }).port, { debug: false, timeoutMs: 20 });
  assert.equal(await hanging(), null);
  const thrower = appCheckTokenSource({ initialize: async () => {}, getToken: async () => { throw new Error('quota'); } }, { debug: false });
  assert.equal(await thrower(), null);
});
await check('client: X-Firebase-AppCheck on callables only, never on Auth; missing token → no header, call still made', async () => {
  assert.equal(APP_CHECK_HEADER, 'X-Firebase-AppCheck');
  const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'demo-airway' });
  const run = async (source) => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, headers: init.headers });
      if (url.includes('accounts:signUp')) return { ok: true, status: 200, json: async () => ({ localId: 'u', idToken: 'i', refreshToken: 'r', expiresIn: '3600' }) };
      return { ok: true, status: 200, json: async () => ({ result: { ok: true } }) };
    };
    const client = new FirebaseRestClient(config, fetcher, { load: () => null, save: () => {} }, () => 0, source);
    await client.call('getBoards', BOARDS);
    return calls;
  };
  const withToken = await run(async () => 'jwt-1');
  assert.equal(withToken.find((c) => c.url.endsWith('/getBoards')).headers['X-Firebase-AppCheck'], 'jwt-1');
  assert.equal(withToken.find((c) => c.url.includes('signUp')).headers['X-Firebase-AppCheck'], undefined);
  for (const source of [null, async () => null, async () => { throw new Error('x'); }]) {
    const calls = await run(source);
    const callable = calls.find((c) => c.url.endsWith('/getBoards'));
    assert.ok(callable && !('X-Firebase-AppCheck' in callable.headers));
  }
});
await check('debug provider: DEV or VITE_FIREBASE_APPCHECK_DEBUG=1 only; release builds refuse the flag', () => {
  assert.equal(appCheckDebug({ DEV: true }), true);
  assert.equal(appCheckDebug({ DEV: false, VITE_FIREBASE_APPCHECK_DEBUG: '1' }), true);
  assert.equal(appCheckDebug({ DEV: false }), false);
  assert.equal(appCheckDebug({ DEV: false, VITE_FIREBASE_APPCHECK_DEBUG: 'true' }), false);
  const build = read('scripts/build-android.mjs');
  assert.match(build, /if \(mode\.startsWith\('--release-'\)\) \{ validateSigning\(\); validateAppCheck\(\); \}/);
  assert.match(build, /process\.env\.VITE_FIREBASE_APPCHECK_DEBUG === '1'/);
  assert.match(build, /'\.env\.production'/);
});
await check('composition: main.ts passes the native port; the plugin is found by name, no package import in src', () => {
  assert.match(read('src/main.ts'), /createBrowserLeaderboards\(import\.meta\.env, nativeAppCheckPort\(\)\)/);
  const platform = read('src/platform/appCheck.ts');
  assert.match(platform, /APP_CHECK_PLUGIN = 'FirebaseAppCheck'/);
  assert.match(platform, /Capacitor\.isNativePlatform\(\) \|\| !Capacitor\.isPluginAvailable\(APP_CHECK_PLUGIN\)/);
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  const offenders = walk(new URL('../src', import.meta.url).pathname).filter((file) => /\.(ts|js)$/.test(file) &&
    /from ['"](firebase|@capacitor-firebase)\b/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], 'no Firebase SDK / plugin import in the bundle');
});
await check('docs: FIREBASE.md App Check steps (param, header, quota), RELEASE.md row, privacy sheet mentions it', () => {
  const doc = read('docs/FIREBASE.md');
  assert.match(doc, /## App Check/);
  for (const piece of ['APP_CHECK_ENFORCED=true', 'APP_CHECK_ENFORCED=false', 'X-Firebase-AppCheck', 'Play Integrity', 'App Attest',
    '10 000', '@capacitor-firebase/app-check', 'google-services.json', 'GoogleService-Info.plist', 'D-246']) {
    assert.ok(doc.includes(piece), piece);
  }
  assert.match(read('docs/RELEASE.md'), /App Check[^\n]*D-246/);
  assert.match(read('docs/store/privacy-declarations.md'), /App Check/);
});

console.log(`SUMMARY test:app-check passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

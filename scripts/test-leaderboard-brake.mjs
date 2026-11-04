// [night-12as] D-234 (R3d): the leaderboard budget brake without an emulator. The real functions/src/index.ts is
// loaded with firebase-admin / firebase-functions replaced by in-memory stubs (no network, no Java, no
// functions/node_modules): the `LEADERBOARDS_PAUSED` param is injected, and the Firestore stub counts and fails every
// access, so a paused callable that touches Firestore fails the test.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const stub = {
  paused: false,
  params: [],
  touches: [],
  /** Every property read on the database (or Auth) is a Firestore access: recorded, then refused. */
  db: new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      stub.touches.push(String(prop));
      throw new Error(`Firestore touched: ${String(prop)}`);
    },
  }),
};
globalThis.__awBrakeStub = stub;

const MODULES = {
  'firebase-admin/app': 'export function initializeApp() {}',
  'firebase-admin/auth': `export function getAuth() { return globalThis.__awBrakeStub.db; }`,
  'firebase-admin/firestore': `
    export function getFirestore() { return globalThis.__awBrakeStub.db; }
    export const FieldValue = { serverTimestamp: () => ({ op: 'serverTimestamp' }), increment: (n) => ({ op: 'increment', n }) };
    export const Timestamp = { fromMillis: (ms) => ({ ms }) };`,
  'firebase-functions/params': `
    export function defineBoolean(name, options) {
      globalThis.__awBrakeStub.params.push({ name, options });
      return { name, value: () => globalThis.__awBrakeStub.paused };
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

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
/** A request whose body counts its reads: a paused submitDaily must not even look at the run. */
function request(uid, data) {
  const reads = { count: 0 };
  const req = { auth: uid ? { uid } : null };
  Object.defineProperty(req, 'data', { get() { reads.count++; return data; } });
  return { req, reads };
}
function reset(paused) { stub.paused = paused; stub.touches.length = 0; }
const BOARDS = { daily: 'd-2026-11-04', weekly: 'w-2026-W45' };

await check('one deploy-time boolean param LEADERBOARDS_PAUSED, default off', () => {
  assert.equal(logic.PAUSE_PARAM, 'LEADERBOARDS_PAUSED');
  assert.deepEqual(stub.params.map((p) => [p.name, p.options?.default]), [['LEADERBOARDS_PAUSED', false]]);
});
await check('paused submitDaily answers { accepted: false, reason: "paused" } without Firestore or reading the run', async () => {
  reset(true);
  const { req, reads } = request('u1', { submission: { v: 1, journal: [] } });
  assert.deepEqual(await functions.submitDaily(req), { accepted: false, reason: 'paused' });
  assert.equal(reads.count, 0, 'request body read');
  assert.deepEqual(stub.touches, []);
});
await check('paused submitDaily ignores the per-player limit (no 429 after 6 calls)', async () => {
  reset(true);
  for (let i = 0; i < logic.RATE_LIMITS.submitDaily + 3; i++) {
    assert.deepEqual(await functions.submitDaily(request('u-many', {}).req), logic.PAUSED_SUBMIT);
  }
  assert.deepEqual(stub.touches, []);
});
await check('paused getBoards answers the two requested boards empty, without Firestore', async () => {
  reset(true);
  assert.deepEqual(await functions.getBoards(request('u1', BOARDS).req), {
    daily: { id: BOARDS.daily, entries: [], me: null }, weekly: { id: BOARDS.weekly, entries: [], me: null },
  });
  assert.deepEqual(stub.touches, []);
});
await check('paused callables still refuse a caller without sign-in and unknown board ids', async () => {
  reset(true);
  await assert.rejects(functions.submitDaily(request(null, {}).req), (e) => e.code === 'unauthenticated');
  await assert.rejects(functions.getBoards(request(null, BOARDS).req), (e) => e.code === 'unauthenticated');
  await assert.rejects(functions.getBoards(request('u1', { daily: 'boards', weekly: BOARDS.weekly }).req),
    (e) => e.code === 'invalid-argument');
  assert.deepEqual(stub.touches, []);
});
await check('brake off: getBoards reads Firestore and submitDaily reviews the run (the stub is really in the path)', async () => {
  reset(false);
  await assert.rejects(functions.getBoards(request('u2', BOARDS).req), /Firestore touched: getAll/);
  assert.deepEqual(stub.touches, ['getAll']);
  const { req, reads } = request('u2', { submission: { v: 1 } });
  assert.deepEqual(await functions.submitDaily(req), { accepted: false, reason: 'malformed' });
  assert.equal(reads.count, 1);
});
await check('deleteMyData is not braked (the right to erase stays on)', async () => {
  reset(true);
  await assert.rejects(functions.deleteMyData(request('u3', {}).req), /Firestore touched/);
  assert.ok(stub.touches.length > 0);
});
await check('docs/FIREBASE.md: 10 EUR budget, 50/90/100 % actual + 100 % forecast alerts, the brake steps', () => {
  const doc = readFileSync(new URL('../docs/FIREBASE.md', import.meta.url), 'utf8');
  assert.match(doc, /10 EUR/);
  for (const pct of ['50 %', '90 %', '100 %']) assert.ok(doc.includes(pct), pct);
  assert.match(doc, /Forecasted/);
  assert.match(doc, /## Gdy przyjdzie alert/);
  assert.match(doc, /LEADERBOARDS_PAUSED=true/);
  assert.match(doc, /LEADERBOARDS_PAUSED=false/);
});

console.log(`SUMMARY test:leaderboard-brake passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

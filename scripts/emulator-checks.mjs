// [night-06b] Runs INSIDE `firebase emulators:exec` (see scripts/test-firebase-emulator.mjs): the real client
// (src/net) against the Auth, Functions and Firestore emulators with the real Cloud Functions bundle.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { createLeaderboards, readNetConfig, buildDailySubmission, todayKey } = await import('../src/net/index.ts');
const { FirebaseRestClient } = await import('../src/net/client.ts');
const { boardsForDaily } = await import('../src/net/boards.ts');
const bot = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };
const { dailySeedForKey } = await import('../src/core/daily.ts');

const env = { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099' };
const config = readNetConfig(env);
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
function memory() { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; }
function memoryTokens() { let s = null; return { load: () => s, save: (v) => { s = v; } }; }

/** Today's official daily seed played by the balance bot to its game over (the server only accepts today/yesterday). */
function playToday(day) {
  const session = bot.createBalanceSession(dailySeedForKey(day), 'daily');
  for (let i = 0; i < 20_000; i++) {
    const snap = session.snapshot();
    if (snap.status === 'finished') break;
    const decision = bot.chooseBotAction(snap);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return buildDailySubmission(session.simulation, day);
}

const day = todayKey();
const run = playToday(day);
const ids = boardsForDaily(day);
const alice = createLeaderboards({ config, fetch, storage: memory() });
const raw = new FirebaseRestClient(config, fetch, memoryTokens());

await check('an honest official run is accepted and lands on both boards', async () => {
  assert.equal(await alice.submitDaily(run), 'sent');
  const boards = await alice.boards(day);
  assert.ok(boards, 'boards reachable');
  assert.equal(boards.daily.id, ids.daily);
  assert.equal(boards.daily.me?.score, run.claimedScore);
  assert.equal(boards.weekly.me?.score, run.claimedScore);
  assert.match(boards.daily.me.callSign, /^AW-[0-9A-F]{4}$/);
});
await check('a second run for the same day does not count', async () => {
  const result = await raw.call('submitDaily', { submission: run });
  assert.equal(result.accepted, true, 'first run of this player');
  const again = await raw.call('submitDaily', { submission: run });
  assert.deepEqual([again.accepted, again.reason], [false, 'duplicate']);
});
await check('a tampered score is rejected by the server replay', async () => {
  const cheat = new FirebaseRestClient(config, fetch, memoryTokens());
  const result = await cheat.call('submitDaily', { submission: { ...run, claimedScore: run.claimedScore + 50 } });
  assert.deepEqual([result.accepted, result.reason], [false, 'score_mismatch']);
});
await check('boards are ordered and rank the caller', async () => {
  const boards = await raw.call('getBoards', { daily: ids.daily, weekly: ids.weekly });
  assert.equal(boards.daily.entries.length, 2);
  assert.ok(boards.daily.entries.every((entry, i, all) => i === 0 || all[i - 1].score >= entry.score));
  assert.equal(boards.daily.entries.filter((entry) => entry.me).length, 1);
});
await check('unknown boards and unauthenticated calls are refused', async () => {
  await assert.rejects(raw.call('getBoards', { daily: 'x', weekly: 'y' }));
  const response = await fetch(`http://127.0.0.1:5001/demo-airway/europe-west1/getBoards`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { daily: ids.daily, weekly: ids.weekly } }) });
  assert.equal(response.status, 401);
});
await check('Firestore rules deny direct client reads and writes', async () => {
  const session = await raw.signIn();
  const base = 'http://127.0.0.1:8080/v1/projects/demo-airway/databases/(default)/documents';
  const read = await fetch(`${base}/boards/${ids.daily}/entries`, { headers: { Authorization: `Bearer ${session.idToken}` } });
  assert.equal(read.status, 403);
  const write = await fetch(`${base}/boards/${ids.daily}/entries?documentId=${session.uid}`, { method: 'POST',
    headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { score: { integerValue: '999999' } } }) });
  assert.equal(write.status, 403);
});

console.log(`SUMMARY test:firebase day=${day} score=${run.claimedScore} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

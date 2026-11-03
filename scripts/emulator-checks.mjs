// [night-06b] Runs INSIDE `firebase emulators:exec` (see scripts/test-firebase-emulator.mjs): the real client
// (src/net) against the Auth, Functions and Firestore emulators with the real Cloud Functions bundle.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { createLeaderboards, readNetConfig, buildDailySubmission, todayKey } = await import('../src/net/index.ts');
const { FirebaseRestClient } = await import('../src/net/client.ts');
const { boardsForDaily } = await import('../src/net/boards.ts');
const bot = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };
const { dailySeedForKey, dailyKey } = await import('../src/core/daily.ts');

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
// [night-09a] D-77: both board entries carry the TTL field, 90 days after the write (the emulator does not run
// TTL deletion itself; the policy is declared in firestore.indexes.json). `Bearer owner` is the emulator admin.
await check('board entries carry expireAt 90 days ahead (TTL, D-77)', async () => {
  const session = await raw.signIn();
  const base = 'http://127.0.0.1:8080/v1/projects/demo-airway/databases/(default)/documents';
  for (const board of [ids.daily, ids.weekly]) {
    const response = await fetch(`${base}/boards/${board}/entries/${session.uid}`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(response.status, 200, `${board} entry readable as admin`);
    const doc = await response.json();
    const expireAt = Date.parse(doc.fields?.expireAt?.timestampValue ?? '');
    const days = (expireAt - Date.now()) / 86_400_000;
    assert.ok(days > 89.9 && days <= 90, `${board} expireAt ${doc.fields?.expireAt?.timestampValue} (${days.toFixed(3)} d)`);
  }
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

// [night-12i] D-108 (R3a): one top document per board. Yesterday's daily board (still accepted) is filled by the
// emulator admin BEFORE any top document exists (a board written before the upgrade): 48 entries above the bot
// run's score S, 12 below. Three players then file S: the first write seeds the top from the old query, the
// boards equal that query, the caller outside the top is ranked by count(), and a later direct entry edit does
// not show, so getBoards reads the top document and not the 50-entry query.
const base = 'http://127.0.0.1:8080/v1/projects/demo-airway/databases/(default)/documents';
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function adminScore(board, uid, score) {
  const response = await fetch(`${base}/boards/${board}/entries/${uid}`, { method: 'PATCH', headers: ADMIN,
    body: JSON.stringify({ fields: { callSign: { stringValue: 'AW-5EED' }, score: { integerValue: String(score) } } }) });
  assert.equal(response.status, 200, `seed ${uid}`);
}
/** The pre-D-108 ranking straight from Firestore: score desc with its implicit document-id order. */
async function adminRanking(board) {
  const response = await fetch(`${base}/boards/${board}:runQuery`, { method: 'POST', headers: ADMIN, body: JSON.stringify({
    structuredQuery: { from: [{ collectionId: 'entries' }], orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit: 200 } }) });
  assert.equal(response.status, 200, 'admin query');
  return (await response.json()).filter((row) => row.document).map((row) => ({
    uid: row.document.name.split('/').pop(), callSign: row.document.fields.callSign.stringValue,
    score: Number(row.document.fields.score.integerValue) }));
}
const yesterday = dailyKey(new Date(Date.now() - 86_400_000));
const runY = playToday(yesterday);
const idsY = boardsForDaily(yesterday);
const S = runY.claimedScore;
const players = [0, 1, 2].map(() => new FirebaseRestClient(config, fetch, memoryTokens()));
await check('a pre-upgrade board seeds its top document from the old query (D-108)', async () => {
  for (let i = 0; i < 60; i++) await adminScore(idsY.daily, `seed-${String(i).padStart(2, '0')}`, i < 48 ? S + 48 - i : S - 1 - (i - 48));
  const responses = [];
  for (const player of players) responses.push(await player.call('submitDaily', { submission: runY }));
  assert.ok(responses.every((r) => r.accepted === true), JSON.stringify(responses));
  const ranking = await adminRanking(idsY.daily);
  assert.equal(ranking.length, 63);
  const uids = await Promise.all(players.map(async (player) => (await player.signIn()).uid));
  const placeOf = (uid) => ranking.findIndex((row) => row.uid === uid) + 1;
  assert.deepEqual(uids.map(placeOf).sort(), [49, 50, 51], 'the three runs tie at S behind the 48 seeds');
  // submitDaily now returns the caller's daily rank at that moment while it is inside the top 50 (ties: id desc).
  responses.forEach((response, i) => {
    const then = 49 + uids.slice(0, i).filter((uid) => uid > uids[i]).length;
    assert.equal(response.rank, then <= 50 ? then : undefined, `player ${i} rank at submission`);
  });
  const expected = ranking.slice(0, 50).map((row) => [row.callSign, row.score]);
  for (const [i, player] of players.entries()) {
    const boards = await player.call('getBoards', { daily: idsY.daily, weekly: idsY.weekly });
    assert.deepEqual(boards.daily.entries.map((row) => [row.callSign, row.score]), expected, 'top equals the old query');
    // Outside the top the rank is 1 + the entries with a higher score (count(), as before D-108): ties share it.
    const own = placeOf(uids[i]) <= 50 ? placeOf(uids[i]) : 1 + ranking.filter((row) => row.score > S).length;
    assert.equal(boards.daily.me?.rank, own, 'own rank (count() outside the top)');
    assert.equal(boards.daily.entries.filter((row) => row.me).length, placeOf(uids[i]) <= 50 ? 1 : 0);
  }
});
await check('getBoards reads the top document, not the entries query (D-108)', async () => {
  const response = await fetch(`${base}/boards/${idsY.daily}/meta/top`, { headers: ADMIN });
  assert.equal(response.status, 200, 'top document exists');
  const top = await response.json();
  assert.equal(top.fields.entries.arrayValue.values.length, 50);
  assert.ok(top.fields.expireAt?.timestampValue, 'top document carries the TTL field');
  await adminScore(idsY.daily, 'seed-59', 999_999);
  const boards = await players[0].call('getBoards', { daily: idsY.daily, weekly: idsY.weekly });
  assert.ok(boards.daily.entries.every((row) => row.score !== 999_999), 'a direct entry edit is not read back');
  assert.equal(boards.daily.entries.length, 50);
});

// [night-12k] D-114 (R1a): in-app deletion. A player inside yesterday's full top 50 deletes their data: both
// entries and the Auth account are gone, the top keeps 50 rows refilled from the entries, a second call is a
// no-op; the facade (alice, today's boards) clears its identity and the next run signs up a new account.
const AUTH_ADMIN = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-airway/accounts:lookup';
async function accountExists(uid) {
  const response = await fetch(AUTH_ADMIN, { method: 'POST', headers: ADMIN, body: JSON.stringify({ localId: [uid] }) });
  assert.equal(response.status, 200, 'auth admin lookup');
  return ((await response.json()).users ?? []).length > 0;
}
const entryStatus = async (board, uid) => (await fetch(`${base}/boards/${board}/entries/${uid}`, { headers: ADMIN })).status;
async function topUids(board) {
  const response = await fetch(`${base}/boards/${board}/meta/top`, { headers: ADMIN });
  return (await response.json()).fields.entries.arrayValue.values.map((v) => v.mapValue.fields.uid.stringValue);
}
await check('deleteMyData removes the entries, the top row and the anonymous account; repeat is a no-op (D-114)', async () => {
  const before = await topUids(idsY.daily);
  const uids = await Promise.all(players.map(async (player) => (await player.signIn()).uid));
  const index = uids.findIndex((uid) => before.includes(uid));
  assert.ok(index >= 0, 'one of the three players is in the full top');
  const uid = uids[index];
  assert.equal(await accountExists(uid), true);
  const first = await players[index].call('deleteMyData', {});
  assert.deepEqual(first, { deleted: true, entries: 2, account: true });
  assert.deepEqual([await entryStatus(idsY.daily, uid), await entryStatus(idsY.weekly, uid)], [404, 404]);
  assert.equal(await accountExists(uid), false, 'Auth user deleted');
  const after = await topUids(idsY.daily);
  assert.equal(after.length, 50, 'the full top is refilled');
  assert.ok(!after.includes(uid), 'uid gone from the top document');
  assert.ok(!(await topUids(idsY.weekly)).includes(uid), 'uid gone from the weekly top');
  const ranking = (await adminRanking(idsY.daily)).map((row) => row.uid);
  assert.ok(!ranking.includes(uid));
  assert.deepEqual([...after].sort(), ranking.slice(0, 50).sort(), 'top = the 50 best remaining entries');
  const again = await players[index].call('deleteMyData', {});
  assert.deepEqual(again, { deleted: true, entries: 0, account: false }, 'idempotent');
});
await check('the client facade deletes, forgets its identity and signs up afresh for the next run (D-114)', async () => {
  const storage = memory();
  const bob = createLeaderboards({ config, fetch, storage });
  assert.equal(bob.hasData(), false);
  assert.equal(await bob.submitDaily(run), 'sent');
  const oldUid = JSON.parse(storage.getItem('aw-net-session-v1')).uid;
  assert.equal(await entryStatus(ids.daily, oldUid), 200);
  assert.equal(await bob.deleteMyData(), 'deleted');
  assert.equal(bob.hasData(), false);
  assert.equal(await entryStatus(ids.daily, oldUid), 404);
  assert.equal(await accountExists(oldUid), false);
  const boards = await alice.boards(day);
  assert.ok(boards.daily.entries.every((row) => !row.me || row.score === run.claimedScore));
  assert.equal(await bob.submitDaily(run), 'sent', 'a new account may file today again');
  assert.notEqual(JSON.parse(storage.getItem('aw-net-session-v1')).uid, oldUid);
});

// [night-12j] D-109 (R3b): a fresh player's 21st getBoards inside a minute is refused with resource-exhausted
// (HTTP 429) before any Firestore read; another player is not affected. Last check: it spends the limit.
await check('per-player rate limit: getBoards 20/min, then resource-exhausted (D-109)', async () => {
  const hammer = new FirebaseRestClient(config, fetch, memoryTokens());
  for (let i = 0; i < 20; i++) await hammer.call('getBoards', { daily: ids.daily, weekly: ids.weekly });
  await assert.rejects(hammer.call('getBoards', { daily: ids.daily, weekly: ids.weekly }),
    (error) => error.reason === 'RESOURCE_EXHAUSTED' && error.code === 'server');
  const other = new FirebaseRestClient(config, fetch, memoryTokens());
  const boards = await other.call('getBoards', { daily: ids.daily, weekly: ids.weekly });
  assert.equal(boards.daily.id, ids.daily);
});

console.log(`SUMMARY test:firebase day=${day} score=${run.claimedScore} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

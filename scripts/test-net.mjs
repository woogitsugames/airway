// [night-06] D-66 leaderboards without Firebase: board ids, authoritative replay verdicts on real daily runs,
// the offline queue, and the REST client/facade against a fake fetch (auth → callable shapes, disabled path).
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { RULES_VERSION } = await import('../src/sim/state.ts');
const boards = await import('../src/net/boards.ts');
const { buildDailySubmission, verifyDailySubmission, MAX_REPLAY_TICKS } = await import('../src/net/submission.ts');
const { SubmissionQueue, MAX_QUEUED } = await import('../src/net/queue.ts');
const { createLeaderboards, readNetConfig } = await import('../src/net/index.ts');

const DAY = '2026-11-04'; // a bot run that crosses two weekly upgrades (score 116)
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}

const bot = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };
const { dailySeedForKey } = await import('../src/core/daily.ts');
/** The balance bot (scripts/bot.ts) plays today's daily seed to its game over, across weekly upgrades. */
function playDaily(dateKey) {
  const session = bot.createBalanceSession(dailySeedForKey(dateKey), 'daily');
  for (let i = 0; i < 20_000; i++) {
    const snap = session.snapshot();
    if (snap.status === 'finished') break;
    const decision = bot.chooseBotAction(snap);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}

const finished = playDaily(DAY);
const honest = buildDailySubmission(finished, DAY);

await check('board ids: Warsaw day and ISO week', () => {
  assert.deepEqual(boards.boardsForDaily('2026-11-03'), { daily: 'd-2026-11-03', weekly: 'w-2026-W45' });
  assert.equal(boards.weekKeyForDate('2027-01-01'), '2026-W53');
  assert.equal(boards.weekKeyForDate('2026-01-01'), '2026-W01');
  assert.deepEqual(boards.parseBoardId('w-2026-W45'), { kind: 'weekly', key: '2026-W45' });
  assert.equal(boards.parseBoardId('x-1'), null);
});
await check('an honest finished daily run is accepted with the replayed score', () => {
  assert.equal(finished.world.status, 'over', 'bot run must end');
  assert.ok(honest.claimedScore > 0 && honest.journal.length > 3, `score ${honest.claimedScore} cmds ${honest.journal.length}`);
  assert.ok(honest.journal.some(([, command]) => command.type === 'ChooseUpgrade'), 'the run should cross a weekly upgrade');
  const verdict = verifyDailySubmission(JSON.parse(JSON.stringify(honest)), [DAY]);
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.score, honest.claimedScore);
});
await check('tampering is rejected: score, seed, day, rules, journal, unfinished run', () => {
  const reject = (patch, days = [DAY]) => verifyDailySubmission({ ...honest, ...patch }, days);
  assert.deepEqual(reject({ claimedScore: honest.claimedScore + 1 }), { ok: false, reason: 'score_mismatch' });
  assert.deepEqual(reject({ seed: (honest.seed + 1) >>> 0 }), { ok: false, reason: 'wrong_seed' });
  assert.deepEqual(reject({}, ['2026-11-05']), { ok: false, reason: 'wrong_day' });
  assert.deepEqual(reject({ rulesVersion: RULES_VERSION - 1 }), { ok: false, reason: 'old_rules' });
  assert.deepEqual(reject({ endTick: MAX_REPLAY_TICKS + 1 }), { ok: false, reason: 'too_long' });
  assert.deepEqual(reject({ endTick: Math.floor(honest.endTick / 2) }).ok, false);
  assert.deepEqual(reject({ journal: honest.journal.slice(0, 1) }).ok, false);
  assert.deepEqual(reject({ journal: [[0, { type: 'AddRoute' }]] }), { ok: false, reason: 'malformed' });
  assert.deepEqual(verifyDailySubmission(null, [DAY]), { ok: false, reason: 'malformed' });
  assert.deepEqual(verifyDailySubmission({ ...honest, journal: [[5, { type: 'Nope' }]] }, [DAY]).ok, false);
});
await check('queue: one entry per day, bounded, backoff and removal', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let clock = 1_000;
  const queue = new SubmissionQueue(storage, () => clock);
  queue.add(honest);
  queue.add({ ...honest, claimedScore: 1 });
  assert.equal(queue.list().length, 1);
  assert.equal(queue.list()[0].submission.claimedScore, 1, 'newest run of the day wins');
  for (let d = 1; d <= MAX_QUEUED + 2; d++) queue.add({ ...honest, dateKey: `2026-10-${String(d).padStart(2, '0')}` });
  assert.equal(queue.list().length, MAX_QUEUED);
  let calls = 0;
  let result = await queue.flush(async () => { calls++; return 'retry'; });
  assert.equal(result.left, MAX_QUEUED);
  result = await queue.flush(async () => { calls++; return 'accepted'; });
  assert.equal(calls, MAX_QUEUED, 'entries in backoff are not retried at once');
  clock += 3_600_000;
  result = await queue.flush(async () => 'accepted');
  assert.deepEqual(result, { sent: MAX_QUEUED, left: 0 });
});
await check('disabled without config: no network, no throw', async () => {
  assert.equal(readNetConfig({}), null);
  assert.equal(readNetConfig({ VITE_FIREBASE_API_KEY: 'k' }), null);
  const boardsApi = createLeaderboards({ config: null, fetch: () => { throw new Error('no network expected'); } });
  assert.equal(boardsApi.enabled, false);
  assert.equal(await boardsApi.submitDaily(honest), 'disabled');
  assert.equal(await boardsApi.boards(DAY), null);
});
await check('REST client: anonymous sign-up once, callable shape, emulator URLs, offline queueing', async () => {
  const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
    VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099' });
  const calls = [];
  let online = false;
  const fakeFetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    if (!online) throw new Error('offline');
    if (url.includes('accounts:signUp')) return { ok: true, status: 200, json: async () => ({ localId: 'u1', idToken: 't1', refreshToken: 'r1', expiresIn: '3600' }) };
    if (url.endsWith('/submitDaily')) return { ok: true, status: 200, json: async () => ({ result: { accepted: true, score: init.body && JSON.parse(init.body).data.submission.claimedScore } }) };
    return { ok: true, status: 200, json: async () => ({ result: { daily: { id: 'd', entries: [], me: null }, weekly: { id: 'w', entries: [], me: null } } }) };
  };
  const store = new Map();
  let clock = 5_000;
  const api = createLeaderboards({ config, fetch: fakeFetch, now: () => clock, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  assert.equal(await api.submitDaily(honest), 'queued', 'offline run is queued');
  online = true;
  await api.flush();
  assert.ok(!calls.some((c) => c.auth), 'backoff holds the retry');
  clock += 60_000;
  await api.flush();
  const submit = calls.find((c) => c.url.endsWith('/submitDaily') && c.auth);
  assert.ok(submit, 'callable reached after auth');
  assert.equal(submit.url, 'http://127.0.0.1:5001/demo-airway/europe-west1/submitDaily');
  assert.equal(submit.auth, 'Bearer t1');
  assert.equal(submit.body.data.submission.claimedScore, honest.claimedScore);
  assert.ok(calls.some((c) => c.url.startsWith('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp')));
  const boardsResult = await api.boards(DAY);
  assert.equal(boardsResult.daily.id, 'd');
  assert.equal(calls.filter((c) => c.url.includes('accounts:signUp')).length, 2, 'one failed offline sign-up, then one real one; reused afterwards');
  assert.equal(JSON.parse(store.get('aw-net-queue-v1')).length, 0, 'queue drained');
});

console.log(`SUMMARY test:net seed=0xA1A1 day=${DAY} score=${honest.claimedScore} ticks=${honest.endTick} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

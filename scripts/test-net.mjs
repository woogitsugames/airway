// [night-06] D-66 leaderboards without Firebase: board ids, authoritative replay verdicts on real daily runs,
// the offline queue, and the REST client/facade against a fake fetch (auth → callable shapes, disabled path).
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { RULES_VERSION } = await import('../src/sim/state.ts');
const boards = await import('../src/net/boards.ts');
const { buildDailySubmission, verifyDailySubmission, MAX_REPLAY_TICKS, DAILY_CONFIG, DAILY_RULES_VERSION } = await import('../src/net/submission.ts');
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
// [night-07a] A daily run saved mid-game and resumed after an app restart submits the same journal.
await check('a daily saved and restored mid-run submits the uninterrupted journal', async () => {
  const { Sim } = await import('../src/sim/sim.ts');
  const save = await import('../src/game/save.ts');
  const half = Math.floor(honest.endTick / 2);
  let sim = Sim.replay(honest.seed, honest.journal.filter(([tick]) => tick <= half), half, DAILY_CONFIG);
  const text = JSON.stringify(save.encodeSave(save.saveSourceFromSim(sim)));
  const loaded = save.decodeSave(text);
  assert.equal(loaded.status, 'ok');
  sim = save.restoreSimFromSave(loaded.save);
  assert.ok(sim, 'restore failed');
  let index = honest.journal.findIndex(([tick]) => tick > half);
  if (index < 0) index = honest.journal.length;
  while (sim.tickCount < honest.endTick) {
    const next = sim.tickCount + 1;
    while (index < honest.journal.length && honest.journal[index][0] === next) sim.apply(honest.journal[index++][1]);
    sim.tick();
  }
  sim.worldValue.clearEvents();
  const resumed = buildDailySubmission(sim, DAY);
  assert.deepEqual(JSON.parse(JSON.stringify(resumed)), JSON.parse(JSON.stringify(honest)));
  assert.equal(verifyDailySubmission(JSON.parse(JSON.stringify(resumed)), [DAY]).ok, true);
});
await check('tampering is rejected: score, seed, day, rules, journal, unfinished run', () => {
  const reject = (patch, days = [DAY]) => verifyDailySubmission({ ...honest, ...patch }, days);
  assert.deepEqual(reject({ claimedScore: honest.claimedScore + 1 }), { ok: false, reason: 'score_mismatch' });
  assert.deepEqual(reject({ seed: (honest.seed + 1) >>> 0 }), { ok: false, reason: 'wrong_seed' });
  assert.deepEqual(reject({}, ['2026-11-05']), { ok: false, reason: 'wrong_day' });
  // [night-86a] D-343: the leaderboard's own rules version (7, the morning start); the kernel's RULES_VERSION (6) is old.
  assert.equal(honest.rulesVersion, DAILY_RULES_VERSION);
  assert.deepEqual(reject({ rulesVersion: RULES_VERSION }), { ok: false, reason: 'old_rules' });
  assert.deepEqual(reject({ rulesVersion: DAILY_RULES_VERSION - 1 }), { ok: false, reason: 'old_rules' });
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

await check('[night-06c] the default fetch is bound (browsers throw "Illegal invocation" otherwise)', async () => {
  const original = globalThis.fetch;
  let seenThis = 'unset';
  globalThis.fetch = function (url) {
    seenThis = this;
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve({ ok: true, status: 200, json: async () => (String(url).includes('signUp')
      ? { localId: 'u', idToken: 't', refreshToken: 'r', expiresIn: '3600' } : { result: { accepted: true } }) });
  };
  try {
    const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
    const api = createLeaderboards({ config, storage: null });
    assert.equal(await api.submitDaily(honest), 'sent');
    assert.ok(seenThis === globalThis || seenThis === undefined);
  } finally { globalThis.fetch = original; }
});

// [night-12j] D-109: the server's per-player limit answers 429 `resource-exhausted`; the run must stay queued.
await check('a rate-limited submission (429) stays queued and is sent on the next flush', async () => {
  const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
  let limited = true;
  const fakeFetch = async (url) => {
    if (url.includes('accounts:signUp')) return { ok: true, status: 200, json: async () => ({ localId: 'u', idToken: 't', refreshToken: 'r', expiresIn: '3600' }) };
    if (limited) return { ok: false, status: 429, json: async () => ({ error: { message: 'Too many requests', status: 'RESOURCE_EXHAUSTED' } }) };
    return { ok: true, status: 200, json: async () => ({ result: { accepted: true, score: honest.claimedScore } }) };
  };
  const store = new Map();
  let clock = 1_000;
  const api = createLeaderboards({ config, fetch: fakeFetch, now: () => clock, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  assert.equal(await api.submitDaily(honest), 'queued');
  assert.equal(JSON.parse(store.get('aw-net-queue-v1')).length, 1, 'still in the queue');
  limited = false;
  clock += 10 * 60_000;
  await api.flush();
  assert.equal(JSON.parse(store.get('aw-net-queue-v1')).length, 0, 'sent after the limit');
});

// [night-12as] D-234 (R3d): the server's budget brake answers `paused`; the run stays queued (not rejected).
await check('a paused server ("paused" answer) keeps the run queued and sends it after the brake is released', async () => {
  const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
  let paused = true;
  const fakeFetch = async (url) => {
    if (url.includes('accounts:signUp')) return { ok: true, status: 200, json: async () => ({ localId: 'u', idToken: 't', refreshToken: 'r', expiresIn: '3600' }) };
    if (paused) return { ok: true, status: 200, json: async () => ({ result: { accepted: false, reason: 'paused' } }) };
    return { ok: true, status: 200, json: async () => ({ result: { accepted: true, score: honest.claimedScore } }) };
  };
  const store = new Map();
  let clock = 1_000;
  const api = createLeaderboards({ config, fetch: fakeFetch, now: () => clock, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  assert.equal(await api.submitDaily(honest), 'queued');
  assert.equal(JSON.parse(store.get('aw-net-queue-v1')).length, 1, 'still in the queue');
  paused = false;
  clock += 10 * 60_000;
  await api.flush();
  assert.equal(JSON.parse(store.get('aw-net-queue-v1')).length, 0, 'sent after the brake');
});

// [night-12k] D-114 (R1a): in-app deletion clears the identity and the queue only after the server confirmed.
function fakeServer() {
  const calls = [];
  const state = { mode: 'ok', signUps: 0 };
  const fetcher = async (url, init) => {
    if (url.includes('accounts:signUp')) { state.signUps++; return { ok: true, status: 200, json: async () => ({ localId: `u${state.signUps}`, idToken: 't', refreshToken: 'r', expiresIn: '3600' }) }; }
    const name = url.split('/').pop();
    calls.push(name);
    if (state.mode === 'offline') throw new TypeError('Failed to fetch');
    if (name === 'deleteMyData' && state.mode === 'fail') return { ok: false, status: 500, json: async () => ({ error: { message: 'Account not deleted', status: 'INTERNAL' } }) };
    if (name === 'deleteMyData') return { ok: true, status: 200, json: async () => ({ result: { deleted: true, entries: 2, account: true } }) };
    if (state.mode === 'queue') throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => ({ result: { accepted: true, score: honest.claimedScore } }) };
  };
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
  return { calls, state, store, make: () => createLeaderboards({ config, fetch: fetcher, storage }) };
}
await check('deleting ranking data: server first, then identity and queue are gone; a new run signs up afresh', async () => {
  const server = fakeServer();
  const api = server.make();
  assert.equal(api.hasData(), false, 'no identity yet: the settings row stays hidden');
  assert.equal(await api.deleteMyData(), 'none');
  assert.deepEqual(server.calls, [], 'no account is created just to delete it');
  server.state.mode = 'queue';
  assert.equal(await api.submitDaily(honest), 'queued');
  assert.equal(api.hasData(), true);
  server.state.mode = 'ok';
  assert.equal(await api.deleteMyData(), 'deleted');
  assert.equal(server.calls.at(-1), 'deleteMyData');
  assert.equal(server.store.has('aw-net-session-v1'), false, 'token removed');
  assert.equal(JSON.parse(server.store.get('aw-net-queue-v1')).length, 0, 'queued run dropped');
  assert.equal(api.hasData(), false);
  assert.equal(server.make().hasData(), false, 'a restart does not bring the identity back');
  assert.equal(await api.submitDaily(honest), 'sent');
  assert.equal(server.state.signUps, 2, 'the next run uses a new anonymous account');
});
await check('deleting offline or on a server error changes nothing and never reports success', async () => {
  const server = fakeServer();
  const api = server.make();
  assert.equal(await api.submitDaily(honest), 'sent');
  const token = server.store.get('aw-net-session-v1');
  server.state.mode = 'offline';
  assert.equal(await api.deleteMyData(), 'offline');
  server.state.mode = 'fail';
  assert.equal(await api.deleteMyData(), 'failed');
  assert.equal(server.store.get('aw-net-session-v1'), token, 'identity kept for a retry');
  assert.equal(api.hasData(), true);
  server.state.mode = 'ok';
  assert.equal(await api.deleteMyData(), 'deleted');
});
await check('disabled leaderboards have nothing to delete', async () => {
  const api = createLeaderboards({ config: null });
  assert.equal(api.hasData(), false);
  assert.equal(await api.deleteMyData(), 'none');
});

// [night-12x] D-135, R7l: "Send my daily results" off is an objection that takes effect at once and is remembered.
await check('opt-out: nothing is sent, queued or fetched; queued runs are dropped; remembered; on again sends', async () => {
  const server = fakeServer();
  const api = server.make();
  assert.equal(api.isSharing(), true, 'default on');
  server.state.mode = 'queue';
  assert.equal(await api.submitDaily(honest), 'queued');
  api.setSharing(false);
  assert.equal(JSON.parse(server.store.get('aw-net-queue-v1')).length, 0, 'the waiting run is dropped');
  assert.equal(server.store.get('aw-net-share-v1'), '0');
  server.state.mode = 'ok';
  const before = server.calls.length;
  assert.equal(await api.submitDaily(honest), 'opted-out');
  await api.flush();
  assert.equal(await api.boards(DAY), null);
  assert.equal(server.calls.length, before, 'no submitDaily or getBoards call while off');
  assert.equal(JSON.parse(server.store.get('aw-net-queue-v1')).length, 0, 'nothing queued while off');
  const restarted = server.make();
  assert.equal(restarted.isSharing(), false, 'the choice survives a restart');
  assert.equal(await restarted.submitDaily(honest), 'opted-out');
  restarted.setSharing(true);
  assert.equal(server.store.has('aw-net-share-v1'), false, 'on = the default, no record');
  assert.equal(await restarted.submitDaily(honest), 'sent');
  assert.equal(server.calls.at(-1), 'submitDaily');
  const disabled = createLeaderboards({ config: null });
  assert.equal(disabled.isSharing(), false, 'disabled leaderboards never share');
  disabled.setSharing(true);
  assert.equal(await disabled.submitDaily(honest), 'disabled');
});

// [night-11ak] R7l, D-237: the switch turned off while a run is on its way. The queue used to finish its pass (sending
// the other waiting days) and write the retried runs back, so the objection was undone; a run queued during a
// flush was overwritten.
await check('queue: clear() during a flush stops it; nothing more is sent and nothing is written back', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const queue = new SubmissionQueue(storage, () => 1_000);
  for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) queue.add({ ...honest, dateKey: day });
  const sent = [];
  const result = await queue.flush(async (submission) => { sent.push(submission.dateKey); queue.clear(); return 'retry'; });
  assert.deepEqual(sent, ['2026-11-01'], 'the other waiting days are not sent');
  assert.equal(queue.list().length, 0, 'the retried run is not written back');
  assert.equal(result.left, 0);
});
await check('queue: a run added while a request is in flight is kept', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const queue = new SubmissionQueue(storage, () => 1_000);
  queue.add({ ...honest, dateKey: '2026-11-03' });
  await queue.flush(async () => { queue.add({ ...honest, dateKey: '2026-11-04' }); return 'accepted'; });
  assert.deepEqual(queue.list().map((item) => item.submission.dateKey), ['2026-11-04']);
  await queue.flush(async () => { queue.add({ ...honest, dateKey: '2026-11-05' }); return 'retry'; });
  assert.deepEqual(queue.list().map((item) => [item.submission.dateKey, item.attempts]), [['2026-11-04', 1], ['2026-11-05', 0]]);
});
await check('opt-out while a request is in flight: the waiting run stays dropped and the run reads "not ranked"', async () => {
  const server = fakeServer();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const base = createLeaderboards({ config: readNetConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' }),
    storage: { getItem: (k) => server.store.get(k) ?? null, setItem: (k, v) => server.store.set(k, v), removeItem: (k) => server.store.delete(k) },
    fetch: async (url) => {
      if (url.includes('accounts:signUp')) return { ok: true, status: 200, json: async () => ({ localId: 'u9', idToken: 't', refreshToken: 'r', expiresIn: '3600' }) };
      server.calls.push(url.split('/').pop());
      await held;
      throw new TypeError('Failed to fetch');
    } });
  const submitting = base.submitDaily(honest);
  await new Promise((resolve) => setTimeout(resolve, 0));
  base.setSharing(false);
  release();
  assert.equal(await submitting, 'opted-out', 'the report says not ranked');
  assert.equal(JSON.parse(server.store.get('aw-net-queue-v1')).length, 0, 'the objection is not undone by the flush');
  assert.deepEqual(server.calls, ['submitDaily'], 'only the request already in flight');
  await base.flush();
  assert.equal(await base.boards(DAY), null);
  assert.deepEqual(server.calls, ['submitDaily'], 'no call after the switch');
});

console.log(`SUMMARY test:net seed=0xA1A1 day=${DAY} score=${honest.claimedScore} ticks=${honest.endTick} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

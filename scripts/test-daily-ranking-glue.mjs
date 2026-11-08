import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';

// Keep the orchestration under test while replacing browser and network boundaries.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/game/dailyRanking.ts')) {
      if (specifier === '../ui/leaderboard') return { url: 'mock:ranking-view', shortCircuit: true };
      if (specifier === '../net') return { url: 'mock:ranking-net', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:ranking-view') return { format: 'module', source: 'export const createRankingView = (...args) => globalThis.__rankingMocks.view(...args)', shortCircuit: true };
    if (url === 'mock:ranking-net') return { format: 'module', source: 'export const buildDailySubmission = (...args) => globalThis.__rankingMocks.build(...args)', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { dailyRankingBoard } = await import('../src/game/dailyRanking.ts');
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ enabled = true, sharing = true, status = 'sent', boards = null } = {}) {
  const events = [], element = {}, submission = {}, sim = {};
  let shared = sharing;
  globalThis.__rankingMocks = {
    view: date => { events.push(['view', date]); return { element, update: state => events.push(['state', state]) }; },
    build: (actualSim, date) => { events.push(['build', actualSim, date]); return submission; },
  };
  const leaderboards = {
    enabled, isSharing: () => shared,
    submitDaily: async value => { events.push(['submit', value]); return await status; },
    boards: async date => { events.push(['boards', date]); return await boards; },
  };
  return { events, element, submission, sim, leaderboards, share: value => { shared = value; } };
}
const day = { dateKey: '2026-11-08', kind: 'official' };
const states = f => f.events.filter(e => e[0] === 'state').map(e => e[1]);
test('disabled leaderboards do not create a view or submit', async () => {
  const f = fixture({ enabled: false });
  assert.equal(dailyRankingBoard(f.leaderboards, { sim: f.sim }, day), undefined);
  assert.deepEqual(f.events, []);
});
test('practice and opted-out runs never submit', async () => {
  for (const [kind, sharing, expected] of [['practice', true, 'practice'], ['official', false, 'opted-out']]) {
    const f = fixture({ sharing });
    assert.equal(dailyRankingBoard(f.leaderboards, { sim: f.sim }, { ...day, kind }), f.element);
    assert.deepEqual(states(f), [{ kind: expected }]);
    assert.deepEqual(f.events.map(e => e[0]), ['view', 'state']);
  }
});
test('queued, rejected and opted-out submission results terminate without loading boards', async () => {
  for (const status of ['queued', 'rejected', 'opted-out']) {
    const f = fixture({ status });
    dailyRankingBoard(f.leaderboards, { sim: f.sim }, day);
    await flush();
    assert.deepEqual(states(f), [{ kind: 'sending' }, { kind: status }]);
    assert.deepEqual(f.events.map(e => e[0]), ['view', 'state', 'build', 'submit', 'state']);
    assert.deepEqual(f.events[2], ['build', f.sim, day.dateKey]);
    assert.deepEqual(f.events[3], ['submit', f.submission]);
  }
});
test('successful submission preserves empty boards and tied order', async () => {
  const daily = { entries: [{ rank: 1, score: 50 }, { rank: 1, score: 50 }], me: null };
  const weekly = { entries: [], me: null };
  const f = fixture({ boards: { daily, weekly } });
  dailyRankingBoard(f.leaderboards, { sim: f.sim }, day);
  await flush();
  assert.deepEqual(states(f), [{ kind: 'sending' }, { kind: 'ready', daily, weekly }]);
  assert.deepEqual(f.events.at(-2), ['boards', day.dateKey]);
});
test('missing boards are queued after a successful submit', async () => {
  const f = fixture(); dailyRankingBoard(f.leaderboards, { sim: f.sim }, day); await flush();
  assert.deepEqual(states(f), [{ kind: 'sending' }, { kind: 'queued' }]);
});
test('opting out while boards load takes precedence over their result', async () => {
  const pending = deferred(), f = fixture({ boards: pending.promise });
  dailyRankingBoard(f.leaderboards, { sim: f.sim }, day);
  await flush(); f.share(false); pending.resolve({ daily: {}, weekly: {} }); await flush();
  assert.deepEqual(states(f), [{ kind: 'sending' }, { kind: 'opted-out' }]);
});
let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
console.log(`SUMMARY test:daily-ranking-glue seed=0xA1A1 passed=${tests.length - failed} failed=${failed}`);
if (failed) process.exitCode = 1;

// Fixed-seed contract checks with a thin task-02 seed/simulation adapter.
import { DailyChallengeMode, dailyTicket, TICKET_GLYPHS } from '../src/game/modes/daily.ts';
import { LocalScoreService, MemoryScoreStorage, dateIndex } from '../src/game/scores.ts';
import { formatDailyShare } from '../src/platform/share.ts';

const SEED = 0xA1A1;
const errors = [];
let passed = 0;
const assert = (condition, label) => { if (!condition) throw Error(label); };
const equal = (a, b) => assert(a === b, String(a) + ' != ' + String(b));
const check = (name, fn) => {
  try { fn(); passed++; } catch (error) { errors.push(name + ': ' + String(error)); }
};
const now = (utc) => new Date(utc);
const calendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
});
const seeds = {
  dailyKey(date) {
    const parts = calendar.formatToParts(date);
    const part = (name) => parts.find((entry) => entry.type === name).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  },
  dailySeed(key) {
    let hash = SEED;
    for (const char of 'daily:' + key) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    return hash;
  },
};
const sim = (seed) => ({ hash: () => 'initial:' + seed.toString(16) });
const game = (scores = new LocalScoreService(new MemoryScoreStorage())) => new DailyChallengeMode(seeds, scores, sim);
const start = (mode, kind, date) => {
  const result = mode.start(kind, now(date));
  assert(result.status === 'started', 'not started');
  return result.session;
};

check('same Warsaw day has identical initial hash', () => {
  const a = start(game(), 'official', '2026-11-02T06:00:00Z');
  const b = start(game(), 'official', '2026-11-02T22:00:00Z');
  equal(a.seed, b.seed); equal(a.initialHash, b.initialHash);
});
check('midnight in Warsaw rotates seed', () => {
  const before = now('2026-11-02T22:59:59Z');
  const after = now('2026-11-02T23:00:00Z');
  equal(seeds.dailyKey(before), '2026-11-02');
  equal(seeds.dailyKey(after), '2026-11-03');
  assert(seeds.dailySeed(seeds.dailyKey(before)) !== seeds.dailySeed(seeds.dailyKey(after)), 'same seed');
  const mode = game();
  assert(start(mode, 'practice', before.toISOString()).initialHash !==
    start(mode, 'practice', after.toISOString()).initialHash, 'same world');
});
check('DST dates use actual Warsaw calendar midnight', () => {
  for (const [instant, key] of [
    ['2026-03-28T22:59:59Z', '2026-03-28'], ['2026-03-28T23:00:00Z', '2026-03-29'],
    ['2026-03-29T21:59:59Z', '2026-03-29'], ['2026-03-29T22:00:00Z', '2026-03-30'],
    ['2026-10-25T22:59:59Z', '2026-10-25'], ['2026-10-25T23:00:00Z', '2026-10-26'],
  ]) equal(seeds.dailyKey(now(instant)), key);
});
check('official reservation persists immediately, even without finishing', () => {
  const storage = new MemoryScoreStorage();
  start(game(new LocalScoreService(storage)), 'official', '2026-11-02T12:00:00Z');
  equal(game(new LocalScoreService(storage)).start('official', now('2026-11-02T16:00:00Z')).status, 'already-used');
});
check('unlimited practice runs preserve the daily practice best', () => {
  const scores = new LocalScoreService(new MemoryScoreStorage());
  const mode = game(scores);
  const date = '2026-11-02T12:00:00Z';
  const first = start(mode, 'practice', date);
  equal(mode.finish(first, 40, 2, [0, 1]).ticket, '‹⋈');
  equal(mode.finish(first, 900, 9, []), null);
  mode.finish(start(mode, 'practice', date), 12, 1, []);
  mode.finish(start(mode, 'practice', date), 70, 4, [2]);
  equal(scores.getProgress('2026-11-02').practiceBest.score, 70);
  equal(scores.getProgress('2026-11-02').officialUsed, false);
});
check('a completed official result cannot be overwritten or resubmitted', () => {
  const scores = new LocalScoreService(new MemoryScoreStorage());
  const mode = game(scores);
  const session = start(mode, 'official', '2026-11-02T12:00:00Z');
  equal(mode.finish(session, 200, 5, [1, 3]).score, 200);
  equal(mode.finish(session, 300, 6, []), null);
  equal(scores.finishOfficial(session.reservation, 400, 7, '--'), null);
  equal(scores.getProgress('2026-11-02').officialResult.score, 200);
});
check('best and streaks reload correctly including a one-day gap', () => {
  const storage = new MemoryScoreStorage();
  const mode = game(new LocalScoreService(storage));
  for (const key of ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-01', '2026-11-02']) {
    const session = start(mode, 'official', key + 'T12:00:00Z');
    mode.finish(session, key === '2026-10-29' ? 900 : 100, 1, []);
  }
  const saved = new LocalScoreService(storage);
  const progress = saved.getProgress('2026-11-02');
  equal(progress.bestOfficial.score, 900);
  equal(progress.currentStreak, 2);
  equal(progress.longestStreak, 3);
  equal(saved.getProgress('2026-11-03').currentStreak, 2);
  equal(saved.getProgress('2026-11-04').currentStreak, 0);
});
check('UTC streak day arithmetic ignores DST', () => {
  equal(dateIndex('2026-03-30') - dateIndex('2026-03-29'), 1);
  equal(dateIndex('2026-10-26') - dateIndex('2026-10-25'), 1);
});
check('invalid calendar dates are rejected', () => {
  for (const value of ['2026-02-29', '2026-13-01', '2026-00-01', '__proto__']) {
    let rejected = false;
    try { dateIndex(value); } catch { rejected = true; }
    assert(rejected, 'accepted ' + value);
  }
});
check('corrupt or outdated storage does not crash', () => {
  const store = new MemoryScoreStorage();
  store.setItem('aw-daily-scores-v1', '{broken');
  const scores = new LocalScoreService(store);
  equal(scores.getProgress('2026-11-02').officialUsed, false);
  store.setItem('aw-daily-scores-v1', '{"version":0,"days":{}}');
  equal(scores.reserveOfficial('2026-11-02').attemptId, 1);
});
check('noninteger scores and out-of-range glyphs are rejected', () => {
  const scores = new LocalScoreService(new MemoryScoreStorage());
  for (const score of [-1, 0.25, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    let rejected = false;
    try { scores.recordPractice('2026-11-02', score, 1, '--'); } catch { rejected = true; }
    assert(rejected, 'accepted score ' + score);
  }
  let rejected = false;
  try { dailyTicket([6]); } catch { rejected = true; }
  assert(rejected, 'invalid region accepted');
});
check('shared ticket is short, localized, and emoji-free', () => {
  equal(TICKET_GLYPHS.length, 6);
  const ticket = dailyTicket([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0]);
  equal(ticket, '‹⋈◖⌑⟆⟧‹⋈◖⌑⟆⟧+');
  const translator = (key, params = {}) => key + ' ' + Object.values(params).join('');
  const text = formatDailyShare({ dateKey: '2026-11-02', kind: 'official', score: 320, weeks: 5, ticket }, translator);
  assert(text.includes('02.11.2026') && text.includes('320') && text.includes('5'), 'missing values');
  assert(!/\p{Extended_Pictographic}/u.test(text), 'emoji in ticket');
});

for (const error of errors) console.error('FAIL ' + error);
console.log('SUMMARY test:daily-mode seed=0xA1A1 passed=' + passed + ' failed=' + errors.length);
if (errors.length) process.exitCode = 1;

// Fixed-seed contract checks with a thin task-02 seed/simulation adapter.
import { DailyChallengeMode, createDailyMode, dailyTicket, servedTicketRegions, TICKET_GLYPHS } from '../src/game/modes/daily.ts';
import { dailySeed } from '../src/core/daily.ts';
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
  equal(scores.getProgress('2026-11-02').persistent, false);
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
  try { dailyTicket([8]); } catch { rejected = true; }
  assert(rejected, 'invalid region accepted');
});
check('shared ticket is short, localized, and emoji-free', () => {
  equal(TICKET_GLYPHS.length, 8);
  const ticket = dailyTicket([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0]);
  equal(ticket, '‹⋈◖⌑⟆⟧‹⋈◖⌑⟆⟧+');
  const translator = (key, params = {}) => key + ' ' + Object.values(params).join('');
  const text = formatDailyShare({ dateKey: '2026-11-02', kind: 'official', score: 320, weeks: 5, ticket }, translator);
  assert(text.includes('02.11.2026') && text.includes('320') && text.includes('5'), 'missing values');
  assert(!/\p{Extended_Pictographic}/u.test(text), 'emoji in ticket');
});
check('production daily mode runs the real Sim with the Warsaw seed', () => {
  const mode = createDailyMode(new LocalScoreService(new MemoryScoreStorage()));
  const a = start(mode, 'practice', '2026-11-02T06:00:00Z');
  const b = start(mode, 'practice', '2026-11-02T22:30:00Z');
  equal(a.seed, dailySeed(now('2026-11-02T06:00:00Z')));
  equal(a.seed, b.seed);
  equal(a.simulation.config.mode, 'daily');
  equal(a.initialHash, b.initialHash);
  a.simulation.advance(500); b.simulation.advance(500);
  equal(a.simulation.hash(), b.simulation.hash());
  const other = start(mode, 'practice', '2026-11-03T12:00:00Z');
  assert(other.initialHash !== a.initialHash, 'next day must differ');
});

// [night-07a] A daily restored from the save slot keeps its kind.
check('resumed official run stays official and finishes the reservation', () => {
  const storage = new MemoryScoreStorage();
  const s1 = start(game(new LocalScoreService(storage)), 'official', '2026-11-02T08:00:00Z');
  // App restart: fresh services over the same storage.
  const scores = new LocalScoreService(storage);
  const mode = game(scores);
  const resumed = mode.resume(sim(s1.seed), s1.seed, now('2026-11-02T18:00:00Z'));
  assert(resumed && resumed.kind === 'official', 'not official');
  equal(resumed.dateKey, s1.dateKey);
  equal(resumed.reservation.attemptId, s1.reservation.attemptId);
  const result = mode.finish(resumed, 210, 3, [0, 1]);
  assert(result && result.kind === 'official' && result.score === 210, 'official result not recorded');
  equal(scores.getProgress(s1.dateKey).officialResult.score, 210);
  equal(scores.activeRun(), null);
  equal(scores.pendingOfficial(s1.dateKey), null);
});
check('practice saved after an abandoned official attempt resumes as practice', () => {
  const storage = new MemoryScoreStorage();
  const mode = game(new LocalScoreService(storage));
  start(mode, 'official', '2026-11-02T08:00:00Z');
  const practice = start(mode, 'practice', '2026-11-02T09:00:00Z');
  const resumed = game(new LocalScoreService(storage)).resume(sim(practice.seed), practice.seed, now('2026-11-02T10:00:00Z'));
  assert(resumed && resumed.kind === 'practice' && resumed.reservation === null, 'practice became official');
});
check('resume after midnight still finds yesterday; unknown seeds are not dailies', () => {
  const storage = new MemoryScoreStorage();
  const s1 = start(game(new LocalScoreService(storage)), 'official', '2026-11-02T21:00:00Z');
  const resumed = game(new LocalScoreService(storage)).resume(sim(s1.seed), s1.seed, now('2026-11-03T07:00:00Z'));
  assert(resumed && resumed.kind === 'official' && resumed.dateKey === s1.dateKey, 'yesterday lost');
  const empty = game(new LocalScoreService(new MemoryScoreStorage()));
  equal(empty.resume(sim(12345), 12345, now('2026-11-02T10:00:00Z')), null);
  // No active record (older save): the day's seed resumes as practice, never ranked.
  const fresh = new MemoryScoreStorage();
  const t = start(game(new LocalScoreService(fresh)), 'official', '2026-11-02T08:00:00Z');
  const scores = new LocalScoreService(fresh);
  scores.setActiveRun(null);
  const old = game(scores).resume(sim(t.seed), t.seed, now('2026-11-02T09:00:00Z'));
  assert(old && old.kind === 'practice', 'unmarked save became official');
});
check('a finished official attempt cannot be resumed as official', () => {
  const storage = new MemoryScoreStorage();
  const mode = game(new LocalScoreService(storage));
  const s1 = start(mode, 'official', '2026-11-02T08:00:00Z');
  mode.finish(s1, 100, 2, []);
  const scores = new LocalScoreService(storage);
  scores.setActiveRun({ dateKey: s1.dateKey, kind: 'official', attemptId: s1.reservation.attemptId });
  const again = game(scores).resume(sim(s1.seed), s1.seed, now('2026-11-02T09:00:00Z'));
  assert(again && again.kind === 'practice', 'second official result possible');
});

// [night-10e] The ticket is the served regions; the streak line only for official runs from 2 days.
check('ticket lists served regions once, in city opening order', () => {
  const cities = [
    { id: 'WAW', region: 'EUN' }, { id: 'SYD', region: 'OCE' }, { id: 'NYC', region: 'NAM' },
    { id: 'OSL', region: 'EUN' }, { id: 'TYO', region: 'ASI' }, { id: 'CAI', region: 'AFR' },
  ];
  const routes = [{ cityIds: ['NYC', 'WAW', 'OSL'] }, { cityIds: ['TYO', 'SYD'] }];
  const regions = servedTicketRegions(cities, routes);
  equal(dailyTicket(regions), '‹⌐⟆⌒');
  equal(servedTicketRegions(cities, []).length, 0);
  equal(dailyTicket([]), '--');
});
check('stored ticket with the ASI/OCE glyphs survives a reload', () => {
  const storage = new MemoryScoreStorage();
  new LocalScoreService(storage).recordPractice('2026-11-02', 40, 2, '‹⌒⌐');
  const best = new LocalScoreService(storage).getProgress('2026-11-02').practiceBest;
  equal(best?.ticket, '‹⌒⌐');
});
check('share text adds the streak to official runs only', () => {
  const translator = (key, params = {}) => key + ' ' + Object.values(params).join('');
  const base = { dateKey: '2026-11-02', score: 320, weeks: 5, ticket: '‹⌒' };
  const official = formatDailyShare({ ...base, kind: 'official' }, translator, { streak: 3 });
  assert(official.includes('daily.share.streak 3'), 'streak missing');
  assert(!formatDailyShare({ ...base, kind: 'official' }, translator, { streak: 1 }).includes('streak'), 'streak of 1');
  assert(!formatDailyShare({ ...base, kind: 'practice' }, translator, { streak: 3 }).includes('streak'), 'practice streak');
  assert(!/\p{Extended_Pictographic}/u.test(official), 'emoji in share text');
});

for (const error of errors) console.error('FAIL ' + error);
console.log('SUMMARY test:daily-mode seed=0xA1A1 passed=' + passed + ' failed=' + errors.length);
if (errors.length) process.exitCode = 1;

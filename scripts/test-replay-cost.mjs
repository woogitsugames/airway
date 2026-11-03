// [night-12d] D-97 replay-cost guard for the daily leaderboard (R3c). The server replays every submitted journal
// (D-66); before D-97 the replay kept ticking a finished world up to the claimed endTick, so a finished run sent
// with endTick = 30 weeks was accepted with `weeks: 30` and cost a 30-week replay. This suite checks that inflated
// end ticks are rejected, that honest bot runs (6 daily seeds) still verify with unchanged hashes, and that the
// replay stays inside a time budget per game week and for a dense journal near MAX_JOURNAL_ENTRIES.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { Sim } = await import('../src/sim/sim.ts');
const { TICKS_PER_WEEK } = await import('../src/sim/index.ts');
const { buildDailySubmission, verifyDailySubmission, MAX_REPLAY_TICKS, MAX_JOURNAL_ENTRIES } =
  await import('../src/net/submission.ts');
const { dailySeedForKey } = await import('../src/core/daily.ts');
const bot = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };

/** Budgets (ms) for one verification on a CI runner; local runs are several times faster. */
const BUDGET_MS_PER_WEEK = 600;
const BUDGET_WORST_MS = 5_000;
const DAYS = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
const clone = (value) => JSON.parse(JSON.stringify(value));
function timed(fn) {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

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

const runs = DAYS.map((day) => {
  const sim = playDaily(day);
  return { day, sim, submission: buildDailySubmission(sim, day) };
});

check('honest bot daily runs on 6 seeds verify with the live score, week count and hash', () => {
  for (const { day, sim, submission } of runs) {
    assert.equal(sim.world.status, 'over', `${day}: bot run must end`);
    const verdict = verifyDailySubmission(clone(submission), [day]);
    assert.equal(verdict.ok, true, `${day}: ${JSON.stringify(verdict)}`);
    assert.equal(verdict.score, sim.world.score, day);
    assert.equal(verdict.hash, sim.hash(), `${day}: replayed hash must equal the live hash (D-13)`);
    assert.equal(verdict.weeks, Math.floor(sim.tickCount / TICKS_PER_WEEK), day);
  }
});

check('Sim.replay with stopAtEnd stops on the game-over tick; without it the old tick count is kept', () => {
  const { sim, submission } = runs[0];
  const stopped = Sim.replay(submission.seed, submission.journal, submission.endTick + 500, { mode: 'daily' }, true);
  assert.equal(stopped.tickCount, sim.tickCount);
  assert.equal(stopped.hash(), sim.hash());
  const plain = Sim.replay(submission.seed, submission.journal, submission.endTick + 500, { mode: 'daily' });
  assert.equal(plain.tickCount, sim.tickCount + 500, 'default replay semantics unchanged');
});

const attackDay = DAYS[0];
const emptyLong = {
  v: 1, mode: 'daily', dateKey: attackDay, seed: dailySeedForKey(attackDay), rulesVersion: runs[0].submission.rulesVersion,
  endTick: MAX_REPLAY_TICKS, claimedScore: 0, journal: [],
};
// An empty journal never ends: the world waits on the first weekly board (frozen, cheap to tick) until endTick.
check('an empty journal claiming 30 weeks is rejected as not finished, quickly', () => {
  const { value: verdict, ms } = timed(() => verifyDailySubmission(clone(emptyLong), [attackDay]));
  assert.deepEqual(verdict, { ok: false, reason: 'not_finished' });
  console.log(`  empty 30-week claim rejected in ${ms.toFixed(0)} ms`);
  assert.ok(ms < BUDGET_WORST_MS, `${ms.toFixed(0)} ms`);
});

check('an honest run with endTick inflated past its game over is rejected', () => {
  for (const extra of [1, TICKS_PER_WEEK, MAX_REPLAY_TICKS]) {
    const { submission } = runs[1];
    const inflated = { ...clone(submission), endTick: Math.min(MAX_REPLAY_TICKS, submission.endTick + extra) };
    const verdict = verifyDailySubmission(inflated, [runs[1].day]);
    assert.deepEqual(verdict, { ok: false, reason: 'malformed' }, `+${extra}`);
  }
});

check('an honest run with an endTick before its game over is not finished', () => {
  const { submission, day } = runs[2];
  const verdict = verifyDailySubmission({ ...clone(submission), endTick: submission.endTick - 1 }, [day]);
  assert.deepEqual(verdict, { ok: false, reason: 'not_finished' });
});

check(`replay cost per game week stays within ${BUDGET_MS_PER_WEEK} ms (6 bot runs)`, () => {
  let worst = 0;
  for (const { day, submission } of runs) {
    const { value: verdict, ms } = timed(() => verifyDailySubmission(clone(submission), [day]));
    assert.equal(verdict.ok, true, day);
    const weeks = Math.max(1, submission.endTick / TICKS_PER_WEEK);
    const perWeek = ms / weeks;
    worst = Math.max(worst, perWeek);
    console.log(`  ${day}: ${weeks.toFixed(2)} weeks, ${submission.journal.length} commands, ${ms.toFixed(0)} ms, ${perWeek.toFixed(0)} ms/week`);
  }
  const projected = worst * (MAX_REPLAY_TICKS / TICKS_PER_WEEK);
  console.log(`  worst ${worst.toFixed(0)} ms/week → a 30-week run would cost ~${projected.toFixed(0)} ms`);
  assert.ok(worst <= BUDGET_MS_PER_WEEK, `${worst.toFixed(0)} ms/week`);
});

check(`a dense journal near MAX_JOURNAL_ENTRIES verifies within ${BUDGET_WORST_MS} ms`, () => {
  // The longest bot run plus rejected filler commands on its ticks, up to the journal cap. Filler names no real
  // airport or route, so the run and its score are unchanged; it measures per-command replay overhead.
  const longest = runs.reduce((a, b) => (b.submission.endTick > a.submission.endTick ? b : a));
  const base = longest.submission;
  const filler = MAX_JOURNAL_ENTRIES - base.journal.length;
  const extra = [];
  for (let i = 0; i < filler; i++) {
    const tick = 1 + Math.floor((i * (base.endTick - 1)) / filler);
    const kinds = [
      { type: 'AddRoute', cityIds: ['XX0', 'XX1'] },
      { type: 'RemoveRoute', routeId: 'no-such-route' },
      { type: 'AssignPlane', routeId: 'no-such-route', aircraft: 'turboprop' },
      { type: 'UpgradeHub', hubId: 'XX0' },
    ];
    extra.push([tick, kinds[i % kinds.length]]);
  }
  // Stable merge: honest commands keep their order within a tick; filler goes after them.
  const journal = [...base.journal.map((e, i) => [e, 0, i]), ...extra.map((e, i) => [e, 1, i])]
    .sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1] || a[2] - b[2]).map(([e]) => e);
  assert.equal(journal.length, MAX_JOURNAL_ENTRIES);
  const dense = { ...clone(base), journal };
  const { value: verdict, ms } = timed(() => verifyDailySubmission(dense, [longest.day]));
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.score, base.claimedScore);
  console.log(`  dense ${journal.length} commands over ${(base.endTick / TICKS_PER_WEEK).toFixed(2)} weeks: ${ms.toFixed(0)} ms`);
  assert.ok(ms <= BUDGET_WORST_MS, `${ms.toFixed(0)} ms`);
});

console.log(`SUMMARY test:replay-cost ${passed}/${passed + failed}`);
if (failed) process.exit(1);

// [night-06c] D-66 glue: after an official daily game over, submit the run (src/net) and show the ranking
// board on the game-over screen. Nothing is shown when leaderboards are disabled (no Firebase config).
import { buildDailySubmission, type Leaderboards } from '../net';
import { createRankingView, type RankingState } from '../ui/leaderboard';
import type { EndlessRun } from './run';

export function dailyRankingBoard(leaderboards: Leaderboards, run: EndlessRun,
  daily: { readonly dateKey: string; readonly kind: 'official' | 'practice' }): HTMLElement | undefined {
  if (!leaderboards.enabled) return undefined;
  const view = createRankingView(daily.dateKey);
  if (daily.kind !== 'official') { view.update({ kind: 'practice' }); return view.element; }
  // [night-12x] D-135, R7l: the player objected; the run is not sent and the report says it is not ranked.
  if (!leaderboards.isSharing()) { view.update({ kind: 'opted-out' }); return view.element; }
  view.update({ kind: 'sending' });
  const submission = buildDailySubmission(run.sim, daily.dateKey);
  void (async () => {
    const status = await leaderboards.submitDaily(submission);
    if (status === 'queued' || status === 'rejected' || status === 'opted-out') { view.update({ kind: status }); return; }
    // [night-11ak] R7l: switched off while the boards were loading: say "not ranked", not "queued".
    const boards = await leaderboards.boards(daily.dateKey);
    if (!leaderboards.isSharing()) { view.update({ kind: 'opted-out' }); return; }
    const state: RankingState = boards ? { kind: 'ready', daily: boards.daily, weekly: boards.weekly } : { kind: 'queued' };
    view.update(state);
  })();
  return view.element;
}

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
  view.update({ kind: 'sending' });
  const submission = buildDailySubmission(run.sim, daily.dateKey);
  void (async () => {
    const status = await leaderboards.submitDaily(submission);
    if (status === 'queued' || status === 'rejected') { view.update({ kind: status }); return; }
    const boards = await leaderboards.boards(daily.dateKey);
    const state: RankingState = boards ? { kind: 'ready', daily: boards.daily, weekly: boards.weekly } : { kind: 'queued' };
    view.update(state);
  })();
  return view.element;
}

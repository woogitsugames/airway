// [night-10d] The daily row on the departure board: today's official score and the streak of days played.
// Pure (progress → text); the scores store already counted both, the menu never showed them.
import { localNumber, t } from '../i18n';
import type { DailyProgress } from './scores';

/** Subtitle of the daily row: score once today's official run ended, else the streak to keep, else the hint. */
export function dailyRowHint(progress: Pick<DailyProgress, 'officialResult' | 'currentStreak'>): string {
  const result = progress.officialResult;
  const streak = progress.currentStreak;
  if (result) {
    const count = localNumber(result.score);
    return streak >= 2 ? t('menu.dailyScoreStreak', { count, days: streak }) : t('menu.dailyScore', { count });
  }
  return streak >= 1 ? t('menu.dailyStreak', { days: streak }) : t('menu.dailyHint');
}

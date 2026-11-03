// Share a daily result as offline text; never send a score or replay to a server.
import type { DailyResult } from '../game/scores';
import type { TranslationKey, TranslationParams } from '../i18n';

export type DailyShareTranslator = (key: TranslationKey, params?: TranslationParams) => string;
export type ShareOutcome = { readonly status: 'shared' | 'copied' | 'unavailable' | 'failed'; readonly text: string };

/** [night-10e] Extra lines the report knows; the streak counts only from two official days in a row. */
export interface DailyShareExtras { readonly streak?: number }

export function formatDailyShare(result: DailyResult, translate: DailyShareTranslator, extras: DailyShareExtras = {}): string {
  const date = `${result.dateKey.slice(8, 10)}.${result.dateKey.slice(5, 7)}.${result.dateKey.slice(0, 4)}`;
  const headline = result.kind === 'official' ? 'daily.share.official' : 'daily.share.practice';
  const streak = result.kind === 'official' && (extras.streak ?? 0) >= 2
    ? [translate('daily.share.streak', { days: extras.streak ?? 0 })] : [];
  return [
    translate('daily.share.title'),
    translate(headline),
    translate('daily.share.date', { date }),
    translate('daily.share.score', { score: result.score }),
    translate('daily.share.weeks', { weeks: result.weeks }),
    translate('daily.share.ticket', { ticket: result.ticket }),
    ...streak,
  ].join('\n');
}

/** Native @capacitor/share first, then clipboard on browsers without Web Share support. */
export async function shareDailyResult(result: DailyResult, translate: DailyShareTranslator,
  extras: DailyShareExtras = {}): Promise<ShareOutcome> {
  const text = formatDailyShare(result, translate, extras);
  try {
    const { Share } = await import('@capacitor/share');
    if ((await Share.canShare()).value) {
      try {
        await Share.share({ title: translate('daily.share.title'), text,
          dialogTitle: translate('daily.share.dialog') });
        return { status: 'shared', text };
      } catch {
        // Do not copy without consent if the player dismisses a native share sheet.
        return { status: 'failed', text };
      }
    }
  } catch {
    // Missing plugin or unsupported browser: the string remains locally available.
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { status: 'copied', text };
    }
  } catch {
    // Clipboard may be denied; caller can still show and select the returned text.
  }
  return { status: 'unavailable', text };
}

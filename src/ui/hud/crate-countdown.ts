// [night-11s] R6c: an empty dock tag (no turboprop, widebody or hub expansion in stock) counts down to the next weekly
// board instead of showing a bare "0" for the whole first week. Pure: the short tag text and the spoken text, both
// from the game minutes left until the board, through the catalogs (PL plural forms).
import { t } from '../../i18n';

export interface CrateCountdown {
  /** Short line on the tag: "2 days", "5 h", "40 min" / "2 dni", "5 godz.", "40 min". */
  readonly short: string;
  /** Spoken suffix for the tag's aria-label: "Next crates in 2 days 5 h". */
  readonly spoken: string;
}

/** Null when there is no weekly board to wait for (puzzles) or it is due now. */
export function crateCountdown(minutesToBoard: number | null | undefined): CrateCountdown | null {
  if (minutesToBoard === null || minutesToBoard === undefined || !Number.isFinite(minutesToBoard)) return null;
  const minutes = Math.floor(minutesToBoard);
  if (minutes <= 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const short = days > 0 ? t('hud.crates.days', { days })
    : hours > 0 ? t('hud.crates.hours', { hours }) : t('hud.crates.minutes', { minutes });
  const when = days > 0 ? t('pause.summary.inDays', { days, hours }) : t('pause.summary.inHours', { hours, minutes: minutes % 60 });
  return { short, spoken: t('hud.crates.next', { when }) };
}

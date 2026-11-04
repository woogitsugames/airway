// [night-12am] R1o: the logbook's "Copy summary" text for closed-test feedback (docs/PLAYTEST.md). Plain text in the
// player's language: runs, lengths at 1x, weeks reached, training outcome, dailies played, and the per-run notes the
// owner needs for Q-73 (run length), Q-78 (hub expansion card) and Q-80 ("+2 slots" card). Counts only, no
// identifiers; it leaves the device only when the player pastes it somewhere (D-16). Pure apart from i18n.
import type { Logbook, RunNote } from '../../game/logbook';
import { RUN_NOTES } from '../../game/logbook';
import { encodePlaytestRecord } from '../../game/playtestRecord';
import type { TutorialOutcome } from '../../game/tutorial/controller';
import { localNumber, t, type TranslationKey } from '../../i18n';

export interface SummaryInput {
  readonly book: Logbook;
  readonly tutorial: TutorialOutcome;
  readonly puzzlesSolved: number;
  readonly puzzlesTotal: number;
  /** Local day the summary was copied, YYYY-MM-DD. */
  readonly today: string;
  /** [night-12ap] R3j: app version (src/core/version.ts). */
  readonly version: string;
}

const TUTORIAL: Record<TutorialOutcome, TranslationKey> = {
  completed: 'logbook.summary.tutorial.completed',
  skipped: 'logbook.summary.tutorial.skipped',
  'in-progress': 'logbook.summary.tutorial.started',
  none: 'logbook.summary.tutorial.none',
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
const minutes = (tenths: number): string => localNumber(tenths / 10, 1);

function runLine(run: RunNote): string {
  return t('logbook.summary.run', {
    date: run.day,
    mode: t(run.mode === 'daily' ? 'logbook.mode.daily' : 'logbook.mode.endless'),
    minutes: minutes(run.tenths), weeks: run.weeks, passengers: run.passengers,
    hubPicked: run.hubPicked, hubOffered: run.hubOffered,
    slotsPicked: run.slotsPicked, slotsOffered: run.slotsOffered, held: run.held,
  });
}

/** [night-12ap] R3j: real minutes over the runs that have them (none before R3j: no line). */
function realLine(runs: readonly RunNote[]): string[] {
  const real = runs.flatMap((run) => (run.real === undefined ? [] : [run.real]));
  if (!real.length) return [];
  return [t('logbook.summary.real', { count: real.length, median: minutes(median(real)), longest: minutes(Math.max(...real)) })];
}

/** The full summary, one fact per line; the run table lists the newest run first. */
export function logbookSummary(input: SummaryInput): string {
  const { book } = input;
  const runs = book.runs;
  const lines = [
    t('logbook.summary.title', { date: input.today }),
    t('logbook.summary.flights', { count: book.flights, endless: book.flights - book.dailies, daily: book.dailies }),
    t('logbook.summary.tutorial', { state: t(TUTORIAL[input.tutorial]) }),
    t('logbook.summary.puzzles', { solved: input.puzzlesSolved, total: input.puzzlesTotal }),
    t('logbook.summary.version', { version: input.version }),
  ];
  // [night-12ap] R3j: the machine line for `npm run playtest:decode` goes last, under the readable text.
  const record = encodePlaytestRecord(input);
  if (!runs.length) {
    lines.push(t('logbook.summary.noRuns'), record);
    return lines.join('\n');
  }
  const tenths = runs.map((run) => run.tenths);
  const weeks = runs.map((run) => run.weeks);
  const sum = (pick: (run: RunNote) => number): number => runs.reduce((total, run) => total + pick(run), 0);
  lines.push(
    t('logbook.summary.noted', { count: runs.length, max: RUN_NOTES }),
    t('logbook.summary.length', { median: minutes(median(tenths)), longest: minutes(Math.max(...tenths)) }),
    ...realLine(runs),
    t('logbook.summary.weeks', { median: localNumber(median(weeks), 1), best: Math.max(...weeks) }),
    t('logbook.summary.held', { count: runs.filter((run) => run.held > 0).length, total: runs.length }),
    t('logbook.summary.card', { card: t('upgrade.hub'), offered: sum((run) => run.hubOffered), picked: sum((run) => run.hubPicked) }),
    t('logbook.summary.card', { card: t('upgrade.slots'), offered: sum((run) => run.slotsOffered), picked: sum((run) => run.slotsPicked) }),
    t('logbook.summary.runsHead'),
    ...runs.map(runLine),
    record,
  );
  return lines.join('\n');
}

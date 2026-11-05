// [night-12ax] R1n, D-242: milestone text for the game-over row and the logbook section. Pure apart from i18n (no DOM,
// no stylesheet), so the headless test reads exactly what the screens print.
import { MILESTONES, milestoneItems, type MilestoneId } from '../game/milestones';
import { milestoneFlights, type Logbook } from '../game/logbook';
import { t, type TranslationKey } from '../i18n';

const PARAMS: Record<MilestoneId, Record<string, number>> = {
  'first-hub': {}, 'all-regions': {},
  'week-2': { week: 2 }, 'week-3': { week: 3 }, 'week-5': { week: 5 },
  'passengers-500': { count: 500 }, 'passengers-1000': { count: 1000 },
};

export function milestoneLabel(id: MilestoneId): string {
  return t(`milestone.${id}` as TranslationKey, PARAMS[id]);
}

export interface MilestoneRowItem {
  readonly id: MilestoneId;
  readonly text: string;
  /** Spoken label: the state in words (the screen shows it by the mark's shape). */
  readonly label: string;
  readonly reached: boolean;
  readonly first: boolean;
}

/** The game-over row: a title with the count, then every milestone in order. */
export function gameOverMilestones(reached: readonly MilestoneId[], first: readonly MilestoneId[]):
  { readonly title: string; readonly items: readonly MilestoneRowItem[] } {
  const items = milestoneItems(reached, first).map((item) => {
    const text = milestoneLabel(item.id);
    const key: TranslationKey = item.first ? 'gameover.milestones.firstLabel'
      : item.reached ? 'gameover.milestones.reachedLabel' : 'gameover.milestones.openLabel';
    return { ...item, text, label: t(key, { milestone: text }) };
  });
  return { title: t('gameover.milestones.title', { reached: items.filter((item) => item.reached).length, total: items.length }), items };
}

/** The logbook section: [id, milestone, "first on flight N" or "not yet"] per milestone. */
export function logbookMilestones(book: Logbook): [MilestoneId, string, string][] {
  const firsts = milestoneFlights(book); // [night-11ao] older/hand-built logbooks have no `milestones`
  return MILESTONES.map((id) => {
    const run = firsts[id];
    return [id, milestoneLabel(id), run ? t('logbook.milestones.first', { run }) : t('logbook.milestones.open')];
  });
}

// [night-06c] D-66 ranking board on the daily game-over screen: a second split-flap style board with the
// day's and the ISO week's standings. Read-only view of src/net results; shows its own sending state.
import { localNumber, t, type TranslationKey } from '../../i18n';
import './leaderboard.css';

export interface RankingEntry { readonly rank: number; readonly callSign: string; readonly score: number; readonly me: boolean }
export interface RankingBoard { readonly entries: readonly RankingEntry[]; readonly me: RankingEntry | null }
export type RankingState =
  | { readonly kind: 'sending' }
  | { readonly kind: 'queued' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'practice' }
  | { readonly kind: 'ready'; readonly daily: RankingBoard; readonly weekly: RankingBoard };

const TOP = 3;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function column(title: string, board: RankingBoard): HTMLElement {
  const section = element('section', 'airway-rank-column');
  section.append(element('h3', 'airway-rank-column-title', title));
  const list = element('ol', 'airway-rank-list');
  const rows = board.entries.slice(0, TOP);
  if (board.me && !rows.some((entry) => entry.me)) rows.push(board.me);
  for (const entry of rows) {
    const row = element('li', entry.me ? 'airway-rank-row is-me' : 'airway-rank-row');
    row.append(element('span', 'airway-rank-pos', String(entry.rank)),
      element('span', 'airway-rank-sign', entry.me ? t('rank.you', { sign: entry.callSign }) : entry.callSign),
      element('span', 'airway-rank-score', localNumber(entry.score)));
    list.append(row);
  }
  if (!rows.length) list.append(element('li', 'airway-rank-empty', t('rank.empty')));
  section.append(list);
  return section;
}

export interface RankingView {
  readonly element: HTMLElement;
  update(state: RankingState): void;
}

const STATUS: Record<Exclude<RankingState['kind'], 'ready'>, TranslationKey> = {
  sending: 'rank.sending', queued: 'rank.queued', rejected: 'rank.rejected', practice: 'rank.practice',
};

export function createRankingView(dateLabel: string): RankingView {
  const root = element('section', 'airway-rank');
  root.dataset.testid = 'daily-ranking';
  root.setAttribute('aria-live', 'polite');
  const title = element('h2', 'airway-rank-title', t('rank.title', { date: dateLabel }));
  const body = element('div', 'airway-rank-body');
  root.append(title, body);
  return {
    element: root,
    update(state) {
      body.replaceChildren();
      root.dataset.state = state.kind;
      if (state.kind !== 'ready') { body.append(element('p', 'airway-rank-status', t(STATUS[state.kind]))); return; }
      body.append(column(t('rank.today'), state.daily), column(t('rank.week'), state.weekly));
    },
  };
}

// [night-10n] Logbook screen: a pilot's logbook page with lifetime totals, records and the last flights.
// Presentation only; the composition root gathers the local stores (src/game/logbook.ts, best record, daily
// scores, puzzle stars). Opened from the departure board's service row; Back returns to the menu.
import { airportLabel } from '../airportLabel';
import { favouriteHub, type Logbook, type LogEntry } from '../../game/logbook';
import { localNumber, t } from '../../i18n';
import '../menu/menu.css';
import './logbook.css';

export interface LogbookData {
  readonly book: Logbook;
  readonly best: { readonly score: number; readonly weeks: number } | null;
  readonly dailyBest: number | null;
  readonly longestStreak: number;
  readonly puzzlesSolved: number;
  readonly puzzlesTotal: number;
  readonly stars: number;
}

export interface LogbookHandle { readonly element: HTMLElement; readonly firstFocus: HTMLElement; }

function e<K extends keyof HTMLElementTagNameMap>(tag: K, klass: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = klass;
  if (text !== undefined) node.textContent = text;
  return node;
}
const weeks = (count: number): string => t('logbook.weeksValue', { count });
function cityName(code: string): string {
  // Code and name together: the code is what the globe shows by default, the name says which city it is.
  const name = airportLabel(code, 'name');
  return name === code ? code : `${name} · ${code}`;
}
function shortDate(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/** Label/value rows of the two upper sections (pure apart from i18n; exported for the headless test). */
export function logbookRows(data: LogbookData): { totals: [string, string, string][]; records: [string, string, string][] } {
  const { book } = data;
  const favourite = favouriteHub(book);
  return {
    totals: [
      ['flights', t('logbook.flights'), localNumber(book.flights)],
      ['passengers', t('logbook.passengers'), localNumber(book.passengers)],
      ['weeks', t('logbook.weeks'), localNumber(book.weeks)],
      ['longest', t('logbook.longest'), book.flights ? weeks(book.longestWeeks) : t('logbook.none')],
    ],
    records: [
      ['best', t('logbook.best'), data.best
        ? t('logbook.bestValue', { count: data.best.score, weeks: data.best.weeks })
        : t('logbook.none')],
      ['hub', t('logbook.favourite'), favourite
        ? t('logbook.favouriteValue', { city: cityName(favourite.code), count: favourite.flights })
        : t('logbook.none')],
      ['daily', t('logbook.dailyBest'), data.dailyBest === null ? t('logbook.none') : localNumber(data.dailyBest)],
      ['streak', t('logbook.streak'), data.longestStreak ? t('logbook.days', { count: data.longestStreak }) : t('logbook.none')],
      ['puzzles', t('logbook.puzzles'), t('logbook.puzzlesValue', {
        solved: data.puzzlesSolved, total: data.puzzlesTotal, stars: data.stars, starsTotal: data.puzzlesTotal * 3,
      })],
    ],
  };
}

function section(title: string, testId: string): HTMLElement {
  const node = e('section', 'airway-logbook__section');
  node.dataset.testid = testId;
  const heading = e('h2', 'airway-settings__group-title', title);
  heading.id = 'logbook-' + testId;
  node.setAttribute('aria-labelledby', heading.id);
  node.append(heading);
  return node;
}
function list(rows: [string, string, string][], klass: string): HTMLElement {
  const dl = e('dl', klass);
  for (const [key, label, value] of rows) {
    const cell = e('div', 'airway-logbook__cell');
    cell.dataset.row = key;
    // Values wrap only at their " · " separators, never between a number and its word ("3 / weeks").
    const dd = e('dd', '');
    value.split(' · ').forEach((piece, index) => {
      if (index) dd.append(' · ');
      dd.append(e('span', 'airway-logbook__piece', piece));
    });
    cell.append(e('dt', '', label), dd);
    dl.append(cell);
  }
  return dl;
}
function recentTable(recent: readonly LogEntry[]): HTMLElement {
  const table = e('table', 'airway-logbook__flights');
  const head = e('thead', '');
  const headRow = e('tr', '');
  for (const key of ['logbook.col.date', 'logbook.col.flight', 'logbook.col.hub', 'logbook.col.weeks', 'logbook.col.pax'] as const) {
    headRow.append(e('th', '', t(key)));
  }
  head.append(headRow);
  const body = e('tbody', '');
  for (const flight of recent) {
    const row = e('tr', '');
    row.dataset.mode = flight.mode;
    row.append(
      e('td', '', shortDate(flight.day)),
      e('td', 'airway-logbook__mode', t(flight.mode === 'daily' ? 'logbook.mode.daily' : 'logbook.mode.endless')),
      e('td', '', flight.hub ?? t('logbook.none')),
      e('td', 'is-num', localNumber(flight.weeks)),
      e('td', 'is-num', localNumber(flight.passengers)),
    );
    body.append(row);
  }
  table.append(head, body);
  return table;
}

export function createLogbook(onBack: () => void, data: LogbookData): LogbookHandle {
  const root = e('section', 'airway-settings airway-logbook');
  root.dataset.testid = 'logbook';
  const paper = e('div', 'airway-settings__paper airway-logbook__paper');
  const top = e('div', 'airway-settings__heading');
  const back = e('button', 'airway-settings__back', t('action.back'));
  back.type = 'button';
  back.addEventListener('click', onBack);
  top.append(back, e('h1', '', t('logbook.title')));
  paper.append(top);
  const rows = logbookRows(data);
  const columns = e('div', 'airway-logbook__columns');
  const totals = section(t('logbook.totals'), 'totals');
  totals.append(list(rows.totals, 'airway-logbook__totals'));
  const records = section(t('logbook.records'), 'records');
  records.append(list(rows.records, 'airway-logbook__records'));
  columns.append(totals, records);
  paper.append(columns);
  const recent = section(t('logbook.recent'), 'recent');
  if (data.book.recent.length) recent.append(recentTable(data.book.recent));
  else recent.append(e('p', 'airway-logbook__empty', t('logbook.empty')));
  paper.append(recent, e('p', 'airway-setting__hint airway-logbook__local', t('logbook.local')));
  root.append(paper);
  return { element: root, firstFocus: back };
}

// [night-10n] Logbook screen: a pilot's logbook page with lifetime totals, records and the last flights.
// Presentation only; the composition root gathers the local stores (src/game/logbook.ts, best record, daily
// scores, puzzle stars). Opened from the departure board's service row; Back returns to the menu.
import { airportLabel } from '../airportLabel';
import { APP_VERSION } from '../../core/version'; // [night-12ap] R3j
import { favouriteHub, localDay, milestoneFlights, type Logbook, type LogEntry } from '../../game/logbook'; // [night-11ao] milestoneFlights
import type { TutorialOutcome } from '../../game/tutorial/controller';
import { localNumber, t, type TranslationKey } from '../../i18n';
import type { RegionId } from '../../data/regions';
import { logbookSummary } from './summary';
import { logbookMilestones } from '../milestones'; // [night-12ax] R1n
import '../skin/current.css'; // [night-11aq] skin tokens read by menu.css
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
  /** [night-12am] R1o: the training vignette's outcome for "Copy summary". */
  readonly tutorial: TutorialOutcome;
}

/** [night-12am] Writes the summary to the clipboard; false when the platform refuses (the page then shows the text). */
export type ClipboardWriter = (text: string) => Promise<boolean>;

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
const REGION_SHORT: Record<RegionId, TranslationKey> = {
  NAM: 'region.short.NAM', SAM: 'region.short.SAM', EUN: 'region.short.EUN', EUS: 'region.short.EUS',
  AFR: 'region.short.AFR', ME: 'region.short.ME', ASI: 'region.short.ASI', OCE: 'region.short.OCE',
};
/** [night-11aj] R2g: an Endless flight with a chosen home region names it under the mode. */
function modeCell(flight: LogEntry): HTMLElement {
  const cell = e('td', 'airway-logbook__mode', t(flight.mode === 'daily' ? 'logbook.mode.daily' : 'logbook.mode.endless'));
  if (flight.region) {
    const region = e('span', 'airway-logbook__region', t(REGION_SHORT[flight.region]));
    region.dataset.region = flight.region;
    cell.append(region);
  }
  return cell;
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
      modeCell(flight),
      e('td', '', flight.hub ?? t('logbook.none')),
      e('td', 'is-num', localNumber(flight.weeks)),
      e('td', 'is-num', localNumber(flight.passengers)),
    );
    body.append(row);
  }
  table.append(head, body);
  return table;
}

/** Async Clipboard API first, then a selected off-screen textarea and `copy` (older Android WebViews). */
export const writeClipboard: ClipboardWriter = async (text) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Denied: try the legacy path. */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

/**
 * [night-12am] R1o: "Copy summary" — the closed-test summary (src/ui/logbook/summary.ts) to the clipboard on a tap,
 * in release builds too. No network: if copying is refused the text appears selected below for a manual copy.
 */
function summarySection(data: LogbookData, copy: ClipboardWriter): HTMLElement {
  const box = e('div', 'airway-logbook__summary');
  box.dataset.testid = 'logbook-summary';
  const button = e('button', 'airway-settings__licenses airway-logbook__copy', t('logbook.copy'));
  button.type = 'button';
  button.dataset.testid = 'logbook-copy';
  const status = e('p', 'airway-setting__hint airway-logbook__copy-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const area = e('textarea', 'airway-logbook__summary-text');
  area.readOnly = true;
  area.hidden = true;
  area.rows = 8;
  area.setAttribute('aria-label', t('logbook.summary.label'));
  area.dataset.testid = 'logbook-summary-text';
  button.addEventListener('click', () => {
    const text = logbookSummary({ book: data.book, tutorial: data.tutorial, puzzlesSolved: data.puzzlesSolved,
      puzzlesTotal: data.puzzlesTotal, today: localDay(new Date()), version: APP_VERSION });
    area.value = text;
    void copy(text).catch(() => false).then((ok) => {
      status.textContent = t(ok ? 'logbook.copied' : 'logbook.copyFailed');
      status.dataset.state = ok ? 'copied' : 'failed';
      area.hidden = ok;
      if (!ok) { area.focus(); area.select(); }
    });
  });
  box.append(button, e('p', 'airway-setting__hint', t('logbook.copyHint')), status, area);
  return box;
}

export function createLogbook(onBack: () => void, data: LogbookData, copy: ClipboardWriter = writeClipboard): LogbookHandle {
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
  // [night-12ax] R1n, D-242: the flight in which each Endless milestone was first reached ("not yet" otherwise).
  const milestones = section(t('logbook.milestones'), 'milestones');
  const reachedRows = logbookMilestones(data.book);
  const firsts = milestoneFlights(data.book); // [night-11ao] pre-R1n logbook objects render with every row open
  milestones.append(list(reachedRows, 'airway-logbook__records airway-logbook__milestones'));
  for (const [id] of reachedRows) {
    const cell = milestones.querySelector(`[data-row="${id}"]`);
    if (cell instanceof HTMLElement) cell.dataset.reached = String(firsts[id] !== undefined);
  }
  paper.append(milestones);
  const recent = section(t('logbook.recent'), 'recent');
  if (data.book.recent.length) recent.append(recentTable(data.book.recent));
  else recent.append(e('p', 'airway-logbook__empty', t('logbook.empty')));
  paper.append(recent, summarySection(data, copy), e('p', 'airway-setting__hint airway-logbook__local', t('logbook.local')));
  root.append(paper);
  return { element: root, firstFocus: back };
}

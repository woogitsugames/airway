// [night-11ag] R4d: the hub cause board, a small departures-board sheet opened by a long press on an airport (or a tap
// when it is at least 70 % full). One row per destination region: the region glyph, how many wait for it, and one
// cause mark with its sentence (the game-over wording). It draws the model from src/game/hubBoard.ts and nothing else.
import { t, type TranslationKey } from '../i18n';
import { regionGlyph } from './glyphs';
import { watchHudLayout } from './layout';
import { HUB_BOARD_CAUSE_KEYS, type HubBoardCause, type HubBoardModel } from '../game/hubBoard';
import { CURFEW_END_HOUR } from '../sim/params';
import './skin/current.css'; // [night-11aq] skin tokens read by hubBoard.css
import './hubBoard.css';
import { setClass } from './classes'; // [night-59a] D-321

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Cause marks, told apart by shape (never by colour alone): a broken leg (no onward flight), a striped barrier (curfew),
 * a filled seat block (left full), an hourglass (waiting for a slot) and a short dash (nothing recorded).
 */
const MARKS: Record<HubBoardCause, { d: string; fill: boolean }> = {
  'no-route': { d: 'M1 9h5M12 9h5M7 14 11 4', fill: false },
  curfew: { d: 'M1 6h16v6H1zM5 6l-4 6M10 6l-4 6M15 6l-4 6M17 9l-2 3M3 12v4M15 12v4', fill: false },
  'left-full': { d: 'M2 4h14v10H2z', fill: true },
  slot: { d: 'M4 2h10L4 16h10z', fill: false },
  none: { d: 'M5 9h8', fill: false },
};

function mark(cause: HubBoardCause): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('airway-hub-board__mark');
  svg.dataset.cause = cause;
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', MARKS[cause].d);
  path.setAttribute('fill', MARKS[cause].fill ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'square');
  path.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(path);
  return svg;
}

export interface HubBoardView {
  /** The sheet's model; null closes it. The airport `code` is the D-68 label chosen by the caller. */
  show(model: (HubBoardModel & { readonly code: string }) | null): void;
  /** The airport the open sheet shows, or null. */
  readonly openId: string | null;
  /**
   * [night-21a] D-268: the open sheet's box in the host's coordinates (layout box, without the step-in transform), or
   * null while closed; cached and re-measured on open and on a size or layout change, so a frame reads no layout.
   */
  readonly box: { readonly l: number; readonly t: number; readonly r: number; readonly b: number } | null;
  dispose(): void;
}

function causeSentence(row: HubBoardModel['rows'][number]): string {
  const key: TranslationKey = HUB_BOARD_CAUSE_KEYS[row.cause];
  return t(key, { count: row.waiting, minutes: row.minutes, time: String(CURFEW_END_HOUR).padStart(2, '0') + ':00' });
}

export function mountHubBoard(host: HTMLElement, callbacks: { close(): void }): HubBoardView {
  const sheet = document.createElement('section');
  sheet.className = 'airway-hub-board';
  sheet.dataset.testid = 'hub-board';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'false');
  sheet.hidden = true;
  const head = document.createElement('header');
  head.className = 'airway-hub-board__head';
  const title = document.createElement('h2');
  title.className = 'airway-hub-board__title';
  const fill = document.createElement('span');
  fill.className = 'airway-hub-board__fill';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'airway-hub-board__close';
  close.dataset.testid = 'hub-board-close';
  const cross = document.createElementNS(SVG, 'svg');
  cross.setAttribute('viewBox', '0 0 16 16');
  cross.setAttribute('width', '16');
  cross.setAttribute('height', '16');
  cross.setAttribute('aria-hidden', 'true');
  const crossPath = document.createElementNS(SVG, 'path');
  crossPath.setAttribute('d', 'M2 2l12 12M14 2 2 14');
  crossPath.setAttribute('stroke', 'currentColor');
  crossPath.setAttribute('stroke-width', '2.4');
  cross.appendChild(crossPath);
  close.appendChild(cross);
  head.append(title, fill, close);
  const list = document.createElement('ol');
  list.className = 'airway-hub-board__rows';
  const empty = document.createElement('p');
  empty.className = 'airway-hub-board__empty';
  sheet.append(head, list, empty);
  host.appendChild(sheet);
  let box: { l: number; t: number; r: number; b: number } | null = null;
  const measure = (): void => {
    // offset* is the layout box relative to the host (the positioned game layer), unaffected by the step-in transform.
    box = sheet.hidden || !sheet.offsetWidth ? null : { l: sheet.offsetLeft, t: sheet.offsetTop,
      r: sheet.offsetLeft + sheet.offsetWidth, b: sheet.offsetTop + sheet.offsetHeight };
  };
  const stopLayout = watchHudLayout(host, (layout) => { sheet.dataset.layout = layout; measure(); });
  const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  sizes?.observe(sheet);
  sizes?.observe(host);

  let openId: string | null = null;
  let renderedKey = '';
  close.addEventListener('click', () => callbacks.close());
  // Back/Escape reaches the session's back() (src/platform/back.ts), which closes the board first.

  return {
    get openId() { return openId; },
    get box() { return box; },
    show(model) {
      if (!model) {
        if (!sheet.hidden) sheet.hidden = true;
        openId = null;
        box = null;
        renderedKey = '';
        return;
      }
      const opening = openId !== model.cityId || sheet.hidden;
      const key = [model.code, model.waiting, model.capacity, model.jammed,
        ...model.rows.map((row) => `${row.region}:${row.waiting}:${row.cause}:${row.minutes}`)].join('|');
      const changed = key !== renderedKey || opening;
      if (changed) {
        renderedKey = key;
        title.textContent = t('hubBoard.title', { code: model.code });
        fill.textContent = t('hubBoard.fill', { waiting: model.waiting, capacity: model.capacity });
        sheet.setAttribute('aria-label', t('hubBoard.label', { code: model.code }));
        close.setAttribute('aria-label', t('hubBoard.close'));
        setClass(sheet, 'airway-hub-board--jammed', model.jammed);
        list.replaceChildren(...model.rows.map((row) => {
          const item = document.createElement('li');
          item.className = 'airway-hub-board__row';
          item.dataset.region = row.region;
          item.dataset.cause = row.cause;
          const region = t(`gameover.region.${row.region}` as TranslationKey);
          const glyph = regionGlyph(row.region, 18);
          glyph.classList.add('airway-hub-board__glyph');
          const count = document.createElement('span');
          count.className = 'airway-hub-board__count';
          count.textContent = String(row.waiting);
          count.setAttribute('aria-label', t('hubBoard.rowAria', { count: row.waiting, region }));
          const text = document.createElement('span');
          text.className = 'airway-hub-board__text';
          text.textContent = causeSentence(row);
          item.append(glyph, count, mark(row.cause), text);
          return item;
        }));
        empty.textContent = model.rows.length ? '' : t('hubBoard.empty');
        empty.hidden = model.rows.length > 0;
      }
      openId = model.cityId;
      if (opening) {
        sheet.hidden = false;
        close.focus({ preventScroll: true });
      }
      if (changed) measure(); // new rows change the height (the observer catches it too, a frame later)
    },
    dispose() {
      stopLayout();
      sizes?.disconnect();
      sheet.remove();
    },
  };
}

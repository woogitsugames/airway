/**
 * [night-77a] D-332 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T5; UI-A-SPEC.md §3 "Wydruk"; mockups
 * `makiety/ui-a/ui-a-menu.png`, `ui-a-raport.png`): the main menu as a departures board and the game-over report as a
 * teleprinter print-out, for the UI-A preview. DEV only until the flip (T6): src/main.ts loads this module with
 * `?skin=board` and hands it to the menu and the report through `sheetSkin` (src/ui/sheet-skin.ts); a release has none
 * of it. The other sheets (pause, settings, licences, privacy and terms, logbook, puzzles, ranking, the training flight
 * and the no-WebGL page) keep their DOM and take the same language from board.css "T5" alone.
 *
 * - **Menu = departures board.** The title AIRWAY on flap tiles (the board's own tiles, still: nothing flips on the menu,
 *   so "Reduce motion" has nothing to stop), the tagline, an empty frame where the night globe shows (R4 frames the globe
 *   to it: `[data-globe-frame]`, with a caption line it may fill), then the board "ODLOTY · WYBIERZ" with the date:
 *   Today (status), Puzzles (progress on flaps), Logbook and Settings (an arrow: they lead to a page), each at its gate
 *   ("C2") printed as the map's airport sign (cream code in a cream frame), so the board reads as a real departures board. The run-starting
 *   row (Continue, else Endless) leaves the board and becomes the screen's one yellow sign at the thumb ("LOT BEZ KOŃCA"
 *   + the record + an arrow), its home-region and licence choices on the line above it. The rows are the menu's own
 *   buttons, moved: they keep their listeners, test ids and spoken names; what this module draws in them is aria-hidden.
 * - **Report = print-out.** One paper roll with perforated margins and a torn top edge, Chivo Mono: the head, the
 *   closed hub with the week, day and clock of the jam, the queue at closing as D-08 glyphs (one per passenger, a row per
 *   direction), the figures on dotted leaders with "REKORD", the weeks table (new routes, aircraft placed, the crate
 *   taken; the jam on the last line), the causes, milestones, contracts, departures and share row of the shipped report
 *   (moved in), and a footer with its own stamp field: a plain red rectangle "ZATOR" with the code and the time, upright,
 *   apart from every line of text. The actions stand under the roll on the console: Menu, Map, Same world (enamel) and
 *   "JESZCZE RAZ" (new world) as the yellow direction sign.
 *
 * No runtime imports: src/main.ts hands in i18n and the glyph builder. Every text is a catalog key.
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { RegionId } from '../../data/regions';
import type { TimelineWeek } from '../../game/runTimeline';
import type { SheetMenuFlight, SheetMenuParts, SheetReport, SheetReportParts, SheetSkin } from '../sheet-skin';

export interface BoardSheetsDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** The D-08 glyph builder of src/ui/glyphs.ts. */
  glyph(region: RegionId, size: number): SVGSVGElement;
  /** Region order of src/data/regions.ts (the tie-break of equal queues). */
  regions: readonly RegionId[];
}

// ---- Model (pure; `test:board` checks it) ----------------------------------------------------------------------------

/** The rows of the departures board after the main action left it (spec: Dziś, Zadania, Dziennik, Ustawienia). */
export const MENU_LIST_ORDER = ['continue', 'endless', 'daily', 'puzzles', 'logbook', 'settings'] as const;

/** The main action (Continue when a flight is saved, else Endless) and the board's rows, in order. */
export function menuPlan(flights: readonly Pick<SheetMenuFlight, 'id' | 'hot'>[]): { main: string | null; list: string[] } {
  const ids = new Set(flights.map((flight) => flight.id));
  const main = flights.find((flight) => flight.hot)?.id ?? (ids.has('endless') ? 'endless' : null);
  return { main, list: MENU_LIST_ORDER.filter((id) => ids.has(id) && id !== main) };
}

/** "08.11" for the board's date. */
export function boardDate(day: Date): string {
  return `${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}`;
}

/** "08.11.2026" for the print-out's head. */
export function printDate(day: Date): string {
  return `${boardDate(day)}.${day.getFullYear()}`;
}

/** "04:12" from a home-clock minute (wrapped into one day). */
export function printClock(minute: number): string {
  const m = ((Math.trunc(Number.isFinite(minute) ? minute : 0) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** At most this many glyphs a direction prints on the roll; past it "+n". */
export const PRINT_GLYPHS_PER_REGION = 30;

/** The queue at closing: one row per direction with passengers, most numerous first (ties in region order). */
export function printQueue(queue: Readonly<Partial<Record<RegionId, number>>>, regions: readonly RegionId[]):
  { region: RegionId; glyphs: number; more: number }[] {
  return regions
    .map((region, index) => ({ region, index, count: Math.max(0, Math.floor(queue[region] ?? 0)) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ region, count }) => ({ region, glyphs: Math.min(count, PRINT_GLYPHS_PER_REGION), more: Math.max(0, count - PRINT_GLYPHS_PER_REGION) }));
}

/** One line of the weeks table: the week, its new routes and aircraft placed, and the note (the crate, the jam). */
export interface PrintWeek { readonly week: number; readonly routes: number; readonly aircraft: number; readonly notes: readonly string[] }

/** The weeks table from the run timeline; `pick` words a crate, the last line also carries the jam. */
export function printWeeks(weeks: readonly TimelineWeek[], pick: (choice: NonNullable<TimelineWeek['pick']>) => string, jam: string): PrintWeek[] {
  return weeks.map((week, index) => ({
    week: week.week, routes: week.routes, aircraft: week.aircraft,
    notes: [...(week.pick ? [pick(week.pick)] : []), ...(index === weeks.length - 1 ? [jam] : [])],
  }));
}

// ---- DOM ---------------------------------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setText(node: Element, text: string): void { if (node.textContent !== text) node.textContent = text; }
const SVG = 'http://www.w3.org/2000/svg';
/** The direction sign's arrow (drawn, not a font glyph: Chivo Mono has no U+2192). */
function arrow(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add(className);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M1 9.2h13.2V3.5L23 12l-8.8 8.5v-5.7H1z');
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}
/** Still flap tiles for a short text (one character a tile; the board's tile look without the fold). */
function tiles(className: string, text: string): HTMLSpanElement {
  const row = el('span', `bd-tiles ${className}`);
  row.setAttribute('aria-hidden', 'true');
  fillTiles(row, text);
  return row;
}
function fillTiles(row: HTMLElement, text: string): void {
  if (row.dataset.text === text) return;
  row.dataset.text = text;
  row.replaceChildren(...Array.from(text).map((char) => {
    const tile = el('span', /[\d\p{L}]/u.test(char) ? 'bd-tile' : 'bd-tile bd-tile--sign', char);
    return tile;
  }));
}

interface MenuState {
  readonly head: HTMLElement;
  readonly title: HTMLElement;
  readonly tagline: HTMLElement;
  readonly listHead: HTMLElement;
  readonly listWord: HTMLElement;
  readonly listChoose: HTMLElement;
  readonly date: HTMLElement;
  readonly go: HTMLElement;
  readonly options: HTMLElement | null;
  readonly lines: readonly HTMLElement[];
}

export function createBoardSheets(deps: BoardSheetsDeps): SheetSkin {
  const { t, localNumber } = deps;
  const menus = new WeakMap<HTMLElement, MenuState>();

  function buildMenu(parts: SheetMenuParts): MenuState {
    const { root, board } = parts;
    root.classList.add('bd-menu');
    const head = el('header', 'bd-menu__head');
    const title = el('h1', 'bd-menu__title');
    title.append(tiles('bd-tiles--title', ''));
    const tagline = el('p', 'bd-menu__tagline');
    head.append(title, tagline);
    // R4 frames the night globe into this box (the menu owns no WebGL; the box only keeps the room and says where).
    const frame = el('div', 'bd-menu__globe');
    frame.dataset.globeFrame = 'menu';
    frame.setAttribute('aria-hidden', 'true');
    const caption = el('p', 'bd-menu__caption');
    caption.hidden = true;
    frame.append(caption);
    const listHead = el('div', 'bd-list__head');
    listHead.setAttribute('aria-hidden', 'true');
    const listWord = el('span', 'bd-list__word');
    const listChoose = el('span', 'bd-list__choose');
    const label = el('span', 'bd-list__label');
    label.append(listWord, ' · ', listChoose);
    const date = tiles('bd-tiles--date', '');
    listHead.append(label, date);
    board.prepend(listHead);
    root.prepend(head, frame);
    const go = el('div', 'bd-menu__go');
    board.after(go);
    const lines = [...new Set(parts.options.map((cell) => cell.parentElement).filter((line): line is HTMLElement => !!line))];
    let options: HTMLElement | null = null;
    if (parts.options.length) {
      options = el('div', 'bd-menu__options');
      options.append(...parts.options);
    }
    for (const line of lines) if (!line.querySelector('select')) line.hidden = true;
    return { head, title, tagline, listHead, listWord, listChoose, date, go, options, lines };
  }

  function decorateRow(button: HTMLButtonElement, flight: SheetMenuFlight, end: 'arrow' | 'status' | 'count' | null, sub: string,
    title: string, count?: string): void {
    let box = button.querySelector<HTMLElement>(':scope > .bd-item');
    if (!box) {
      box = el('span', 'bd-item');
      box.setAttribute('aria-hidden', 'true');
      button.append(box);
    }
    button.classList.add('bd-row');
    button.classList.remove('bd-go');
    box.dataset.end = end ?? 'none';
    const gateEl = box.querySelector('.bd-item__gate') ?? box.appendChild(el('span', 'bd-item__gate'));
    setText(gateEl, flight.gate);
    const titleEl = box.querySelector('.bd-item__title') ?? box.appendChild(el('span', 'bd-item__title'));
    const subEl = box.querySelector('.bd-item__sub') ?? box.appendChild(el('span', 'bd-item__sub'));
    setText(titleEl, title);
    setText(subEl, sub);
    (subEl as HTMLElement).hidden = !sub;
    box.querySelector('.bd-item__end')?.remove();
    if (end === 'arrow') box.append(arrow('bd-item__end'));
    else if (end === 'status' && flight.status) box.append(el('span', 'bd-item__end bd-item__status', flight.status));
    else if (end === 'count' && count) box.append(tiles('bd-item__end bd-tiles--count', count));
  }

  function decorateGo(button: HTMLButtonElement, flight: SheetMenuFlight): void {
    let box = button.querySelector<HTMLElement>(':scope > .bd-item');
    if (!box) {
      box = el('span', 'bd-item');
      box.setAttribute('aria-hidden', 'true');
      button.append(box);
    }
    button.classList.add('bd-go');
    button.classList.remove('bd-row');
    box.dataset.end = 'go';
    box.replaceChildren(el('span', 'bd-item__title', flight.title), el('span', 'bd-item__sub', flight.sub), arrow('bd-item__end'));
  }

  function menu(parts: SheetMenuParts): void {
    const state = menus.get(parts.root) ?? buildMenu(parts);
    menus.set(parts.root, state);
    const appTitle = t('app.title').toLocaleUpperCase();
    const titleTiles = state.title.querySelector<HTMLElement>('.bd-tiles')!;
    fillTiles(titleTiles, appTitle);
    state.title.setAttribute('aria-label', t('app.title'));
    setText(state.tagline, t('board.menu.tagline'));
    setText(state.listWord, t('board.menu.list'));
    setText(state.listChoose, t('board.menu.choose'));
    fillTiles(state.date, boardDate(parts.today));
    const plan = menuPlan(parts.flights);
    const byId = new Map(parts.flights.map((flight) => [flight.id, flight]));
    const placed: HTMLElement[] = [];
    for (const id of plan.list) {
      const button = parts.buttons.get(id);
      const flight = byId.get(id);
      if (!button || !flight) continue;
      if (id === 'daily') decorateRow(button, flight, 'status', flight.sub, t('board.menu.daily'));
      else if (id === 'puzzles') decorateRow(button, flight, parts.total ? 'count' : 'arrow', flight.sub, flight.title,
        parts.total ? `${parts.solved}/${parts.total}` : undefined);
      else if (id === 'logbook') decorateRow(button, flight, 'arrow', t('board.menu.logbookHint'), flight.title);
      else if (id === 'settings') decorateRow(button, flight, 'arrow', t('board.menu.settingsHint'), flight.title);
      else decorateRow(button, flight, 'arrow', flight.sub, flight.title);
      placed.push(button);
      if (id === 'endless' && state.options) placed.push(state.options);
    }
    parts.board.append(...placed);
    const main = plan.main ? parts.buttons.get(plan.main) : undefined;
    const mainFlight = plan.main ? byId.get(plan.main) : undefined;
    if (main && mainFlight) {
      decorateGo(main, mainFlight);
      state.go.replaceChildren(...(plan.main === 'endless' && state.options ? [state.options] : []), main);
    }
    // The emptied service row and Endless line stay out of the way (the board's own rows stand in their place).
    for (const node of parts.board.querySelectorAll<HTMLElement>(':scope > .airway-board__service, :scope > .airway-board__header')) node.hidden = true;
    for (const line of state.lines) line.hidden = !line.querySelector('button, select');
  }

  function pickName(choice: NonNullable<TimelineWeek['pick']>): string {
    switch (choice.upgrade) {
      case 'turboprop': return t('board.dock.turbopropShort');
      case 'widebody': return t('board.dock.widebodyShort');
      case 'hub-expansion': return choice.hubId ? t('board.report.pickHub', { hub: choice.hubId }) : t('board.dock.hub');
      case 'departure-slots': return t('board.report.pickSlots');
    }
  }

  function figure(label: string, value: string, extra?: HTMLElement, testid?: string): HTMLDivElement {
    const row = el('div', 'bd-print__figure');
    if (testid) row.dataset.testid = testid;
    const dt = el('dt', 'bd-print__label', label);
    const dd = el('dd', 'bd-print__value', value);
    if (extra) dd.append(extra);
    row.append(dt, dd);
    return row;
  }

  function weeksTable(report: SheetReport): HTMLElement {
    const box = el('section', 'bd-print__block bd-print__weeks');
    box.dataset.testid = 'board-report-weeks';
    const heading = el('h3', 'bd-print__sub', t('board.report.weeksTitle'));
    const table = el('table', 'bd-print__table');
    const head = el('tr', '');
    for (const key of ['board.report.colWeek', 'board.report.colRoutes', 'board.report.colAircraft', 'board.report.colNote'] as const) {
      const th = el('th', '', t(key));
      th.scope = 'col';
      head.append(th);
    }
    const thead = el('thead', '');
    thead.append(head);
    const body = el('tbody', '');
    const note = el('p', 'bd-print__note', t('board.report.printing'));
    note.setAttribute('role', 'status');
    table.append(thead, body);
    box.append(heading, table, note);
    box.dataset.state = 'loading';
    const load = report.timeline;
    if (!load) { box.hidden = true; return box; }
    void load().catch(() => null).then((result) => {
      if (!result) {
        box.dataset.state = 'unavailable';
        note.textContent = t('gameover.timeline.unavailable');
        return;
      }
      const dash = '—';
      const rows = printWeeks(result.weeks, pickName, t('board.report.jamNote', { code: report.hubCode }));
      body.replaceChildren(...rows.map((row) => {
        const tr = el('tr', '');
        tr.dataset.week = String(row.week);
        const cells = [String(row.week), row.routes ? localNumber(row.routes) : dash, row.aircraft ? localNumber(row.aircraft) : dash,
          row.notes.length ? row.notes.join(' · ') : dash];
        for (const text of cells) tr.append(el('td', '', text));
        tr.setAttribute('aria-label', t('board.report.weeksAria', { week: row.week, routes: row.routes, aircraft: row.aircraft,
          note: row.notes.join(', ') }));
        return tr;
      }));
      box.dataset.state = 'ready';
      note.textContent = '';
      note.hidden = true;
    });
    return box;
  }

  function report(parts: SheetReportParts): void {
    const { overlay, content, sign, map, departures, strip, actions, same, next, menu: menuButton, report: data } = parts;
    overlay.classList.add('bd-report');
    const extras = [...content.children].filter((child) => child !== sign && child !== departures && child !== strip && child !== actions);
    const print = el('section', 'bd-print');
    print.dataset.testid = 'board-print';
    print.setAttribute('aria-labelledby', 'airway-gameover-heading');
    const roll = el('div', 'bd-print__roll');
    const top = el('div', 'bd-print__block bd-print__top');
    top.append(el('p', 'bd-print__head', t('board.report.head')),
      el('p', 'bd-print__line', [printDate(new Date()), data.mode === 'daily' ? t('board.report.daily')
        : data.mode === 'puzzle' ? t('board.report.puzzle') : data.mode === 'endless' ? t('menu.endless') : ''].filter(Boolean).join(' · ')));
    // The shipped heading ("Sieć zamknięta") stays the dialog's name; the sign around it becomes a print line.
    sign.classList.add('bd-print__sign');
    const hub = el('div', 'bd-print__block bd-print__hub');
    hub.dataset.testid = 'board-report-hub';
    hub.append(sign, el('p', 'bd-print__strong', t(data.hubIsHub ? 'board.report.hubClosed' : 'board.report.airportClosed',
      { code: data.hubCode, name: data.hubName })));
    if (data.clock) hub.append(el('p', 'bd-print__line', t('board.report.when', { week: data.clock.week, day: data.clock.day, time: printClock(data.clock.minute) })));
    hub.append(el('p', 'bd-print__line', t('board.report.queue', { waiting: data.waiting, capacity: data.capacity })));
    const queue = el('div', 'bd-print__queue');
    queue.setAttribute('aria-hidden', 'true');
    queue.dataset.testid = 'board-report-queue';
    for (const row of printQueue(data.queue, deps.regions)) {
      const line = el('span', 'bd-print__glyphs');
      line.dataset.region = row.region;
      for (let i = 0; i < row.glyphs; i++) line.append(deps.glyph(row.region, 16));
      if (row.more) line.append(el('span', 'bd-print__more', `+${localNumber(row.more)}`));
      queue.append(line);
    }
    if (queue.childElementCount) hub.append(queue);
    const figures = el('dl', 'bd-print__block bd-print__figures');
    figures.dataset.testid = 'board-report-figures';
    const record = data.newRecord ? el('span', 'bd-print__record', t('board.report.record')) : undefined;
    figures.append(figure(t('board.report.delivered'), localNumber(data.delivered), record),
      figure(t('board.report.weeks'), localNumber(data.completedWeeks)));
    if (data.network) {
      figures.append(figure(t('board.report.routes'), localNumber(data.network.routes)),
        figure(t('board.report.aircraft'), localNumber(data.network.aircraft)));
      if (data.network.hubs.length) figures.append(figure(t('board.report.hubs'), data.network.hubs.join(' · ')));
    }
    // [night-81a] D-336: the shipped report's test ids for these two lines (the print-out replaces them).
    if (data.homeRegion) figures.append(figure(t('board.report.region'), data.homeRegion, undefined, 'gameover-home-region'));
    if (data.licence) figures.append(figure(t('board.report.licence'), data.licence, undefined, 'gameover-licence'));
    const causes = el('section', 'bd-print__block bd-print__causes');
    const panel = strip.querySelector<HTMLElement>('.airway-go-causes-panel') ?? strip.querySelector<HTMLElement>('.airway-go-causes');
    if (panel) {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      panel.hidden = false;
      causes.append(el('h3', 'bd-print__sub', t('gameover.causes')), panel);
    }
    const moved = [...strip.querySelectorAll<HTMLElement>(':scope > .airway-go-milestones, :scope > .airway-go-share')];
    const more = el('div', 'bd-print__block bd-print__more-rows');
    more.append(...moved);
    departures.classList.add('bd-print__block');
    const foot = el('footer', 'bd-print__block bd-print__foot');
    const field = el('div', 'bd-stamp-field');
    field.setAttribute('aria-hidden', 'true');
    field.dataset.testid = 'board-report-stamp';
    const stamp = el('div', 'bd-stamp');
    stamp.append(el('span', 'bd-stamp__word', t('board.report.stamp')),
      el('span', 'bd-stamp__code', data.clock ? `${data.hubCode} · ${printClock(data.clock.minute)}` : data.hubCode));
    field.append(el('span', 'bd-stamp-field__label', t('board.report.stampField')), stamp);
    foot.append(el('p', 'bd-print__line', t('board.report.end')), field);
    roll.append(top, hub, figures, weeksTable(data), causes);
    if (more.childElementCount) roll.append(more);
    roll.append(departures, ...extras, foot);
    print.append(roll);
    strip.hidden = true;
    // Actions on the console under the roll: the secondary three in enamel, "Jeszcze raz" (a new world) the yellow sign.
    menuButton.classList.add('bd-key');
    map.classList.add('bd-key');
    same.classList.add('bd-key');
    same.textContent = t('board.report.same');
    next.classList.add('bd-go', 'bd-go--report');
    const nextBox = el('span', 'bd-item');
    nextBox.dataset.end = 'go';
    nextBox.append(el('span', 'bd-item__title', t('board.report.again')), el('span', 'bd-item__sub', t('board.report.againSub')), arrow('bd-item__end'));
    next.replaceChildren(nextBox);
    next.setAttribute('aria-label', `${t('board.report.again')}. ${t('board.report.againSub')}`);
    const keys = el('div', 'bd-report__keys');
    keys.append(menuButton, map, same);
    actions.replaceChildren(keys, next);
    content.replaceChildren(print, actions);
  }

  return { menu, report };
}

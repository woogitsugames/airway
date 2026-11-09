/**
 * [night-76a] D-331 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T4; UI-A-SPEC.md; mockup
 * makiety/ui-a/ui-a-koniec-tygodnia.png): the weekly board of the UI-A skin, "take one strip". src/main.ts loads it at boot and hands it to the board view through `upgradeSkin`
 * (src/ui/upgrade/skin.ts); a release build folds that branch away.
 *
 * The sheet:
 * - a split-flap board on black enamel, "KONIEC TYGODNIA" over "TYDZ 1" on large tiles, and the closed week's figures
 *   (passengers and transfers of that week, routes and aircraft in service) on small tiles, one spoken label;
 * - the contract as a paper slip (last week's result as a filled or hollow square, next week's pair and target);
 * - one flight strip per offer (paper in a coloured holder whose symbol says the kind: turboprop, widebody, hub, slots),
 *   the description from the sim's own numbers and the quantity "+2" in its own column. Tapping a strip chooses it: an
 *   outline in cream and a "WYBRANY" clip (spec §2: a choice is shown by cream and a clip, never by yellow);
 * - one main action, black on yellow (the only yellow on the sheet): "WEŹ TURBOŚMIGŁOWCE →" and the line under it says
 *   when the next week starts, or, for a hub or slots, that the next step is the airport on the globe;
 * - the airport pick: a yellow direction sign "WSKAŻ HUB NA GLOBUSIE" with a round enamel Back key; the globe stays free.
 * Nothing moves but a key going down 1 px (none under "Reduce motion", board.css). No runtime imports (as board.ts):
 * src/main.ts hands in i18n and the symbol paths.
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { UpgradeKind } from '../../sim/upgrades';
import type { CardModel, UpgradeFacts, WeekFigures } from '../upgrade/cards';
import type { UpgradeSkin, UpgradeSkinInput } from '../upgrade/skin';

export interface BoardWeekDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** The board's symbol paths (board.ts SYMBOL), 100 × 100 boxes. */
  symbols: { readonly turboprop: string; readonly widebody: string; readonly hub: string };
}

/** Departure slots: a runway with its centre-line dashes cut out and a take-off chevron above it (own symbol). */
export const SLOTS_SYMBOL = 'M36 34H64V96H36ZM46 44V56H54V44ZM46 66V78H54V66ZM50 4L78 28H22Z';
/** The direction arrow of the main action and the pick sign (square shaft, 90° head; ISO 7001 proportions). */
const ARROW = 'M2 12H26V3L44 18 26 33V24H2Z';
const BACK = 'M3 12 12 3v6h9v6h-9v6z';

/** Most digits a figure tile row shows (more is clamped to nines). */
export const WEEK_FIGURE_CELLS = 5;

/** The large tiles of the board's title: the word (without a trailing dot, capitals), a blank tile, the week. */
export function weekTiles(word: string, week: number): string[] {
  const w = Number.isFinite(week) ? Math.min(999, Math.max(1, Math.trunc(week))) : 1;
  return [...Array.from(word.replace(/\.$/, '').toLocaleUpperCase()), ' ', ...Array.from(String(w))];
}

/** One figure on tiles: passengers padded to three digits (as the HUD board), others as they are; null = "–". */
export function figureTiles(value: number | null, pad = 1): string[] {
  if (value === null || !Number.isFinite(value)) return ['–'];
  const n = Math.min(10 ** WEEK_FIGURE_CELLS - 1, Math.max(0, Math.trunc(value)));
  return Array.from(String(n).padStart(pad, '0'));
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
/** "06:00" for a local minute of day. */
export function clockText(minute: number): string {
  const m = Number.isFinite(minute) ? ((Math.trunc(minute) % 1440) + 1440) % 1440 : 0;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** The strip the sheet chooses when the player has not chosen yet: the first that can act. */
export function defaultChoice(models: readonly Pick<CardModel, 'kind' | 'unavailable'>[]): UpgradeKind | null {
  return models.find((model) => !model.unavailable)?.kind ?? null;
}

/** The quantity column of a strip: the figure and its caption key (plural on the figure). */
export function stripQuantity(kind: UpgradeKind, facts: UpgradeFacts): { amount: number; key: TranslationKey } {
  if (kind === 'turboprop' || kind === 'widebody') return { amount: facts.planes[kind].count, key: 'board.sheet.qty.aircraft' };
  if (kind === 'hub-expansion') return { amount: facts.hub.extraSeats, key: 'board.sheet.qty.seats' };
  return { amount: facts.slots.count, key: 'board.sheet.qty.departures' };
}

const TAKE_KEY: Readonly<Record<UpgradeKind, TranslationKey>> = {
  turboprop: 'board.sheet.take.turboprop', widebody: 'board.sheet.take.widebody',
  'hub-expansion': 'board.sheet.take.hub', 'departure-slots': 'board.sheet.take.slots',
};
/** The holder's class (its colour) and symbol for each kind. */
const HOLDER: Readonly<Record<UpgradeKind, 'prop' | 'jet' | 'hub' | 'slots'>> = {
  turboprop: 'prop', widebody: 'jet', 'hub-expansion': 'hub', 'departure-slots': 'slots',
};

const NS = 'http://www.w3.org/2000/svg';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(path: string, className: string, box = '0 0 100 100'): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', box);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  const shape = document.createElementNS(NS, 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill-rule', 'evenodd');
  svg.append(shape);
  return svg;
}
function tiles(chars: readonly string[], className: string): HTMLSpanElement {
  const row = el('span', `bw-tiles ${className}`);
  row.setAttribute('aria-hidden', 'true');
  for (const char of chars) {
    const tile = el('span', char === ' ' ? 'bw-tile bw-tile--blank' : 'bw-tile', char === ' ' ? '' : char);
    row.append(tile);
  }
  return row;
}

export function createBoardWeek(deps: BoardWeekDeps): UpgradeSkin {
  const { t, localNumber } = deps;
  /** The player's choice per board week, so a re-render (an airport pick cancelled) keeps it. */
  const chosen = new Map<number, UpgradeKind>();
  const symbol = (kind: UpgradeKind): string => kind === 'turboprop' ? deps.symbols.turboprop : kind === 'widebody'
    ? deps.symbols.widebody : kind === 'hub-expansion' ? deps.symbols.hub : SLOTS_SYMBOL;

  function board(input: UpgradeSkinInput): HTMLElement {
    const { state, figures } = input;
    const head = el('header', 'bw-board');
    head.setAttribute('role', 'img');
    head.dataset.testid = 'board-week';
    const f: WeekFigures = figures ?? { passengers: null, transfers: null, routes: 0, aircraft: 0, startMinute: 0 };
    const whole = f.passengers !== null && f.transfers !== null;
    head.setAttribute('aria-label', whole
      ? t('board.sheet.aria', { week: state.week, passengers: f.passengers ?? 0, transfers: f.transfers ?? 0, routes: f.routes, aircraft: f.aircraft })
      : t('board.sheet.ariaPartial', { week: state.week, routes: f.routes, aircraft: f.aircraft }));
    const kicker = el('span', 'bw-label bw-kicker', t('board.sheet.kicker'));
    kicker.setAttribute('aria-hidden', 'true');
    const title = tiles(weekTiles(t('board.sheet.week'), state.week), 'bw-tiles--title');
    const row = el('span', 'bw-figs');
    row.setAttribute('aria-hidden', 'true');
    const figure = (key: TranslationKey, chars: string[], name: string) => {
      const cell = el('span', `bw-fig bw-fig--${name}`);
      cell.append(el('span', 'bw-label', t(key)), tiles(chars, 'bw-tiles--fig'));
      row.append(cell);
    };
    figure('board.sheet.passengers', figureTiles(f.passengers, 3), 'passengers');
    figure('board.sheet.routes', figureTiles(f.routes), 'routes');
    figure('board.sheet.aircraft', figureTiles(f.aircraft), 'aircraft');
    figure('board.sheet.transfers', figureTiles(f.transfers), 'transfers');
    head.append(kicker, title, row);
    return head;
  }

  function slip(input: UpgradeSkinInput): HTMLElement | null {
    const contract = input.contract;
    if (!contract || (!contract.next && !contract.last)) return null;
    const box = el('section', 'bw-slip');
    box.dataset.testid = 'upgrade-contract';
    const holder = el('span', 'bw-slip-head', t('board.sheet.contract'));
    const text = el('span', 'bw-slip-text');
    if (contract.last) {
      const last = el('span', 'bw-slip-last', t(contract.last.met ? 'upgrade.contract.lastMet' : 'upgrade.contract.lastMissed',
        { delivered: contract.last.delivered, target: contract.last.target }));
      last.dataset.met = String(contract.last.met);
      text.append(last);
    }
    if (contract.next) {
      const [from, to] = contract.next.regions;
      const route = el('b', 'bw-slip-route', t('upgrade.contract.route', {
        from: t(`region.name.${from}` as TranslationKey), to: t(`region.name.${to}` as TranslationKey) }));
      route.dataset.regions = `${from} ${to}`;
      const task = el('span', 'bw-slip-task');
      task.append(route, ' ', t('board.sheet.contractTask', { target: contract.next.target }));
      // The one-line form a short page shows instead (board-week.css); the full slip stays for screen readers.
      const line = el('span', 'bw-slip-line', t('board.sheet.contractLine', {
        from: t(`region.short.${from}` as TranslationKey), to: t(`region.short.${to}` as TranslationKey), target: contract.next.target }));
      line.setAttribute('aria-hidden', 'true');
      text.append(task, line);
    }
    box.append(holder, text);
    return box;
  }

  function strip(model: CardModel, index: number, input: UpgradeSkinInput, facts: UpgradeFacts): HTMLButtonElement {
    const button = el('button', `bw-strip bw-strip--${HOLDER[model.kind]}`);
    button.type = 'button';
    button.dataset.testid = `upgrade-option-${index}`;
    button.dataset.upgrade = model.kind;
    button.disabled = model.unavailable;
    const holder = el('span', 'bw-holder');
    holder.append(icon(symbol(model.kind), 'bw-symbol'));
    const main = el('span', 'bw-main');
    const head = el('span', 'bw-title');
    head.append(el('span', '', model.title));
    if (input.extraCrate === model.kind) {
      head.append(el('span', 'bw-extra', t('board.sheet.contract')));
      button.dataset.extra = 'contract'; // [night-81a] D-336: as the base view marks the crate a contract added
    }
    const text = el('span', 'bw-text', describe(model.kind, facts));
    main.append(head, text);
    if (model.stamp) main.append(el('span', 'bw-note', model.stampCaption ? `${model.stampCaption}: ${model.stamp}` : model.stamp));
    const { amount, key } = stripQuantity(model.kind, facts);
    const qty = el('span', 'bw-qty');
    qty.append(el('b', '', `+${localNumber(amount)}`), el('span', 'bw-qty-caption', t(key, { count: amount })));
    const clip = el('span', 'bw-clip', t('board.sheet.chosen'));
    clip.setAttribute('aria-hidden', 'true');
    button.append(holder, main, qty, clip);
    return button;
  }

  function describe(kind: UpgradeKind, facts: UpgradeFacts): string {
    if (kind === 'turboprop' || kind === 'widebody') {
      const plane = facts.planes[kind];
      return t(kind === 'turboprop' ? 'board.sheet.text.turboprop' : 'board.sheet.text.widebody',
        { km: localNumber(plane.rangeKm), seats: plane.seats });
    }
    if (kind === 'hub-expansion') {
      return t('board.sheet.text.hub', { seats: facts.hub.extraSeats, from: facts.hub.transferFrom, to: facts.hub.transferTo });
    }
    return t('board.sheet.text.slots', { count: facts.slots.count });
  }

  function crates(input: UpgradeSkinInput, sheet: HTMLElement): void {
    const { state, models } = input;
    const facts = input.facts;
    const remembered = chosen.get(state.week);
    let choice = remembered && models.some((m) => m.kind === remembered && !m.unavailable) ? remembered : defaultChoice(models);
    const pick = el('section', 'bw-pick');
    const allot = el('h2', 'bw-label bw-allot', t('board.sheet.allot', { week: state.week + 1 }));
    allot.id = `bw-allot-${state.week}`;
    const list = el('div', 'bw-strips');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', allot.id);
    list.dataset.count = String(models.length);
    const buttons = models.map((model, i) => strip(model, i, input, facts));
    list.append(...buttons);
    pick.append(allot, list);
    const take = el('button', 'bw-take');
    take.type = 'button';
    take.dataset.testid = 'upgrade-take';
    const takeText = el('span', 'bw-take-text');
    const takeMain = el('b', 'bw-take-main');
    const takeSub = el('span', 'bw-take-sub');
    takeText.append(takeMain, takeSub);
    take.append(takeText, icon(ARROW, 'bw-arrow', '0 0 46 36'));
    const show = () => {
      for (const button of buttons) {
        const on = button.dataset.upgrade === choice;
        button.setAttribute('aria-pressed', String(on));
        if (on) button.classList.add('is-chosen'); else button.classList.remove('is-chosen');
      }
      take.disabled = choice === null;
      take.dataset.upgrade = choice ?? '';
      if (!choice) { takeMain.textContent = t('board.sheet.none'); takeSub.textContent = ''; return; }
      takeMain.textContent = t(TAKE_KEY[choice], { count: stripQuantity(choice, facts).amount });
      takeSub.textContent = choice === 'hub-expansion' ? t('board.sheet.thenHub') : choice === 'departure-slots'
        ? t('board.sheet.thenAirport')
        : t('board.sheet.starts', { week: state.week + 1, time: clockText(input.figures?.startMinute ?? 0) });
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      choice = button.dataset.upgrade as UpgradeKind;
      chosen.set(state.week, choice);
      show();
    }));
    take.addEventListener('click', () => { if (choice) input.take(choice); });
    show();
    const head = board(input);
    const contract = slip(input);
    sheet.append(head, el('div', 'bw-gap'));
    if (contract) sheet.append(contract);
    sheet.append(pick, take);
  }

  function airportPick(input: UpgradeSkinInput, sheet: HTMLElement): void {
    const sign = el('header', 'bw-pick-sign');
    if (input.back) {
      const back = el('button', 'bw-back');
      back.type = 'button';
      back.dataset.testid = 'upgrade-pick-back';
      back.setAttribute('aria-label', t('upgrade.backLabel'));
      const face = el('span', 'bw-back-face');
      face.append(icon(BACK, 'bw-back-arrow', '0 0 24 24'));
      back.append(face, el('span', 'bw-back-caption', t('upgrade.back')));
      const go = input.back;
      back.addEventListener('click', () => go());
      sign.append(back);
    }
    const plate = el('div', 'bw-direction');
    plate.setAttribute('role', 'status');
    const words = el('span', 'bw-direction-text');
    const kind = input.state.selected === 'departure-slots' ? 'departure-slots' : 'hub-expansion';
    const model = input.models.find((m) => m.kind === kind);
    words.append(el('span', 'bw-direction-kicker', `${t('notice.week', { week: input.state.week })} · ${model?.title ?? ''}`),
      el('b', 'bw-direction-main', t(input.mode === 'pick-airport' ? 'upgrade.selectAirport' : 'upgrade.selectHub')));
    plate.append(words, icon(ARROW, 'bw-arrow bw-arrow--down', '0 0 46 36'));
    sign.append(plate);
    sheet.append(sign);
  }

  return {
    sheet(input) {
      for (const week of chosen.keys()) if (week < input.state.week) chosen.delete(week);
      const sheet = el('section', 'bw-sheet');
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', String(input.mode === 'crates'));
      sheet.setAttribute('aria-label', t('notice.week', { week: input.state.week }));
      sheet.dataset.mode = input.mode;
      sheet.dataset.strips = String(input.models.length);
      if (input.mode === 'crates') crates(input, sheet); else airportPick(input, sheet);
      return sheet;
    },
  };
}

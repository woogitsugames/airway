/**
 * [night-69a] D-324 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T1; D-323): helpers of the UI-A skin
 * "Lotniskowa tablica i paski lotu" (mockups and spec: docs/styles/kierunki-2026-11c/makiety/ui-a/). A DEV-only preview
 * until the flip (T6): src/main.ts loads this module and src/ui/skin/board.css only in a DEV build with `?skin=board`,
 * sets <html data-skin="board"> and hands the helpers to the HUD through `hudSkin` (src/ui/hud/skin.ts); a release
 * build folds that branch away, so neither file reaches dist/.
 *
 * T1 draws two things:
 * - the HUD top band as a split-flap departures board on black enamel: the local time, the week, the day "2/3" and the
 *   passengers on flap tiles (src/ui/flap.ts mechanics; only the cells whose figure changed flip, 120 ms a cell, 30 ms
 *   apart, never under "Reduce motion"), a 24-hour bar under them (night hours 20–06 drawn lower and darker, hours
 *   already flown lighter, a white "now" mark), and the pause key as a round push button with its own caption;
 * - the dock as a controller's console where shape says what a control does: a round push button = an instant action
 *   (Undo), an enamel plate screwed to the panel = an aircraft to place (its route line printed on it: dashed =
 *   turboprop, solid = widebody; the count on a flap), an octagon = something to build (Hub), a rotary selector with
 *   the stops 1/2/4 = a setting (Speed). The chosen plate turns cream with its lamp lit (not yellow: yellow means only
 *   "where to / what next", spec §2); an empty plate or hub is hatched and carries a paper tag with the wait.
 *
 * No runtime imports (as linoryt.ts): src/main.ts hands in i18n and the SplitFlap class. Every text is a catalog key;
 * the flaps and drawings are aria-hidden, the board carries one spoken label (`board.label`).
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { FlapOptions, SplitFlap } from '../flap';
import type { HudSkin, HudSkinTag, HudSkinTagState } from '../hud/skin';
import type { HudState } from '../hud/types';

/** What the helpers need from the rest of the app, handed in by src/main.ts. */
export interface BoardDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** The SplitFlap class of src/ui/flap.ts. */
  Flap: new (value: string, options?: FlapOptions) => SplitFlap;
  /** The game's "Reduce motion" switch (src/ui/motion.ts). */
  reducedMotion(): boolean;
  /** Cell budgets of src/i18n/limits.ts (BOARD_CELLS). */
  cells: { clock: number; week: number; day: number; passengers: number; count: number };
  /** Days in a game week (src/sim/clock.ts DAYS_PER_WEEK). */
  daysPerWeek: number;
}

/** The spec's flap timing (UI-A-SPEC.md §3): 120 ms a cell, the next cell 30 ms later; no bounce. */
export const BOARD_FLIP_MS = 120;
export const BOARD_STAGGER_MS = 30;
/**
 * A cell that changed again sooner than this after its last flip is set without the flip: the minute digit changes every
 * 100 ms of real time at 1× (one tick = one game minute), and a flap that never finishes reads as flicker (plan T1,
 * risks). The tens of minutes, the hour, the week and the day still flip.
 */
export const BOARD_REFLIP_MS = BOARD_FLIP_MS * 3;
/** Night hours of the 24-hour bar: the 20:00–06:00 quiet-demand band of D-285 L3. */
export const BOARD_NIGHT = { from: 20, to: 6 } as const;
export const isBoardNight = (hour: number): boolean => hour >= BOARD_NIGHT.from || hour < BOARD_NIGHT.to;

/** The dial angle of the speed selector for 1×, 2× and 4× (degrees clockwise from 12 o'clock). */
export const SPEED_ANGLE: Readonly<Record<number, number>> = { 1: -135, 2: 0, 4: 135 };

const pad2 = (n: number): string => String(n).padStart(2, '0');
const clamp = (value: number, lo: number, hi: number): number =>
  Number.isFinite(value) ? Math.min(hi, Math.max(lo, Math.trunc(value))) : lo;

/** The figures the board shows for one HUD state (pure; `test:board` checks them). */
export function boardFigures(state: Pick<HudState, 'timeMinutes' | 'week' | 'day' | 'passengers'>, cells: BoardDeps['cells'], days: number):
  { clock: string; week: string; day: string; passengers: string; minute: number } {
  const minute = clamp(state.timeMinutes, 0, 1439);
  const week = String(clamp(state.week, 1, 10 ** cells.week - 1));
  const day = `${clamp(state.day, 1, days)}/${days}`;
  const passengers = String(clamp(state.passengers, 0, 10 ** cells.passengers - 1)).padStart(3, '0');
  return { clock: `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`, week, day, passengers, minute };
}

/**
 * The CSS of the shipped Linoryt structure re-scoped to the board preview: the board draws only the HUD band and the
 * dock in T1, so every other screen (notes, sheets, menu) keeps Linoryt's look under <html data-skin="board"> until
 * its own stage (T2–T5). DEV only (src/main.ts reads linoryt.css as text); the release never sees it.
 */
export function boardTwin(linorytCss: string): string {
  let css = linorytCss;
  for (const [fromMark, toMark] of BOARD_TWIN_CUTS) {
    const from = css.indexOf(fromMark);
    const to = css.indexOf(toMark, from);
    if (from >= 0 && to > from) css = css.slice(0, from) + css.slice(to);
  }
  return css.split('[data-skin="linoryt"]').join('[data-skin="board"]');
}

/**
 * Sections of linoryt.css the twin leaves out (from the first marker up to the second), because a stage prints them in
 * the board's own language (board.css):
 * - [night-73a] D-328 (T2): the airport notes, edge chips and slot tags (U2);
 * - [night-77a] D-332 (T5): the menu index (Part 4), the game-over report and the U4 screens (settings, licences,
 *   privacy and terms, logbook, puzzles, daily ranking). The pause and the training flight keep the twin's geometry
 *   (their fits for short and landscape screens) and take only the board's inks and faces (board.css "T5").
 */
export const BOARD_TWIN_CUTS: readonly (readonly [string, string])[] = [
  ['/* ---- Part 4: menu', '/* U2 notes */'],
  ['/* U2 notes */', '/* end U2 */'],
  ['/* ---- Game-over report:', '/* ---- Hub cause board:'],
  ['/* U4 screens */', '/* end U4 */'],
];

// ---- Flap rows -----------------------------------------------------------------------------------------------------

/** One row of one-cell flaps: each cell flips on its own, so a fast minute digit never cuts the hour's flip short. */
class FlapRow {
  readonly element: HTMLSpanElement;
  private flaps: SplitFlap[] = [];
  private values: string[] = [];
  private lastFlip: number[] = [];

  constructor(private readonly deps: BoardDeps, className: string) {
    this.element = document.createElement('span');
    this.element.className = `bd-flaps ${className}`;
  }

  set(text: string): void {
    const chars = Array.from(text);
    const first = this.flaps.length === 0;
    if (chars.length !== this.flaps.length) {
      for (const flap of this.flaps) flap.dispose();
      this.element.replaceChildren();
      this.flaps = chars.map((char) => {
        const flap = new this.deps.Flap(char, { maxCells: 1, durationMs: BOARD_FLIP_MS, staggerMs: BOARD_STAGGER_MS, silent: true });
        flap.element.removeAttribute('role');
        flap.element.removeAttribute('aria-label');
        if (!/\d/.test(char)) flap.element.classList.add('bd-flap--sign');
        this.element.append(flap.element);
        return flap;
      });
      this.values = [...chars];
      this.lastFlip = chars.map(() => -Infinity);
      if (first) return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let order = 0;
    chars.forEach((char, index) => {
      if (this.values[index] === char) return;
      const flip = !this.deps.reducedMotion() && now - this.lastFlip[index] >= BOARD_REFLIP_MS;
      this.flaps[index].set(char, flip, flip ? order++ * BOARD_STAGGER_MS : 0);
      this.flaps[index].element.removeAttribute('aria-label');
      if (flip) this.lastFlip[index] = now;
      this.values[index] = char;
    });
  }
}

// ---- Symbols -------------------------------------------------------------------------------------------------------

/** Airway's own symbols (the UI-A mockup set, docs/styles/kierunki-2026-11c/makiety/src/scene.js), 100 × 100 boxes. */
const SYMBOL = {
  undo: 'M78 70L78 46Q78 26 58 26L30 26 30 12 8 32 30 52 30 38 58 38Q66 38 66 46L66 70Z',
  turboprop: 'M46 8L54 8 56 40 92 44 92 54 56 56 55 80 68 86 68 92 32 92 32 86 45 80 44 56 8 54 8 44 44 40ZM20 34L30 34 30 46 20 46ZM70 34L80 34 80 46 70 46Z',
  widebody: 'M47 6L53 6 56 36 94 62 94 70 56 56 55 80 70 90 70 95 50 90 30 95 30 90 45 80 44 56 6 70 6 62 44 36ZM16 58L22 55 24 64 18 66ZM30 49L36 46 38 55 32 57ZM64 46L70 49 68 57 62 55ZM78 55L84 58 82 66 76 64Z',
  hub: 'M44 6L56 6 56 94 44 94ZM12 22L18 12 88 78 82 88ZM82 12L88 22 18 88 12 78Z',
  pause: 'M30 20H44V80H30ZM56 20H70V80H56Z',
  resume: 'M32 16L82 50 32 84Z',
} as const;
type BoardSymbol = keyof typeof SYMBOL;

const symbol = (name: BoardSymbol): string =>
  `<svg class="bd-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${SYMBOL[name]}"/></svg>`;
const SCREW = '<svg class="bd-screw" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><circle cx="5" cy="5" r="4.2"/><path d="M2.4 6.6 7.6 3.4"/></svg>';
/** The speed selector: ticks and stops 1/2/4 engraved round a knob; the pointer turns with `--bd-dial`. */
const DIAL = '<svg class="bd-dial" viewBox="0 0 60 60" aria-hidden="true" focusable="false">' +
  '<path class="bd-dial__ticks" d="M14 44 18 40M30 8V13M46 44 42 40"/>' +
  '<text x="8" y="57">1</text><text x="26.5" y="6.5">2</text><text x="47" y="57">4</text>' +
  '<g class="bd-dial__knob"><circle cx="30" cy="31" r="17"/><path d="M30 31V15"/></g></svg>';

// ---- The skin ------------------------------------------------------------------------------------------------------

interface PassParts {
  board: HTMLElement; clock: FlapRow; week: FlapRow; day: FlapRow; passengers: FlapRow;
  labels: Record<'localTime' | 'week' | 'day' | 'passengers', HTMLElement>;
  cells: HTMLElement[]; now: HTMLElement; hour: number; at: number; label: string;
}
interface DockParts { caption: HTMLElement; short: HTMLElement; wait: HTMLElement; waitShort: HTMLElement; count: FlapRow | null; speed: number }

function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
function span(className: string, text = ''): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

const CAPTION: Record<HudSkinTag, readonly [TranslationKey, TranslationKey]> = {
  undo: ['board.dock.undo', 'board.dock.undo'],
  turboprop: ['board.dock.turboprop', 'board.dock.turbopropShort'],
  widebody: ['board.dock.widebody', 'board.dock.widebodyShort'],
  hub: ['board.dock.hub', 'board.dock.hub'],
  speed: ['board.dock.speed', 'board.dock.speed'],
};

/** The HUD skin of the board preview; src/main.ts puts it in `hudSkin.current`. */
export function createBoardSkin(deps: BoardDeps): HudSkin {
  const { t } = deps;
  const passParts = new WeakMap<HTMLElement, PassParts>();
  const dockParts = new WeakMap<HTMLElement, DockParts>();

  function buildPass(section: HTMLElement): PassParts {
    const board = document.createElement('div');
    board.className = 'bd-board';
    board.setAttribute('role', 'img');
    const row = document.createElement('div');
    row.className = 'bd-row';
    row.setAttribute('aria-hidden', 'true');
    const clock = new FlapRow(deps, 'bd-flaps--clock');
    const week = new FlapRow(deps, 'bd-flaps--small');
    const day = new FlapRow(deps, 'bd-flaps--small');
    const passengers = new FlapRow(deps, 'bd-flaps--small');
    const labels = { localTime: span('bd-label'), week: span('bd-label'), day: span('bd-label'), passengers: span('bd-label') };
    const cell = (kind: string, label: HTMLElement, flaps: FlapRow): HTMLElement => {
      const el = document.createElement('div');
      el.className = `bd-cell bd-cell--${kind}`;
      el.append(label, flaps.element);
      return el;
    };
    row.append(cell('clock', labels.localTime, clock), cell('week', labels.week, week), cell('day', labels.day, day),
      cell('passengers', labels.passengers, passengers));
    const hours = document.createElement('div');
    hours.className = 'bd-hours';
    hours.setAttribute('aria-hidden', 'true');
    const cells: HTMLElement[] = [];
    for (let h = 0; h < 24; h++) {
      const i = document.createElement('i');
      if (isBoardNight(h)) i.className = 'is-night';
      cells.push(i);
      hours.append(i);
    }
    const now = document.createElement('b');
    now.className = 'bd-hours__now';
    hours.append(now);
    board.append(row, hours);
    section.querySelector('.airway-pass__ticket')?.appendChild(board);
    const parts: PassParts = { board, clock, week, day, passengers, labels, cells, now, hour: -1, at: -1, label: '' };
    passParts.set(section, parts);
    publishBoardBottom(section);
    return parts;
  }

  function dockState(button: HTMLElement, tag: HudSkinTag, state: HudSkinTagState): DockParts {
    let parts = dockParts.get(button);
    if (!parts) {
      const captionBox = span('bd-eng');
      captionBox.setAttribute('aria-hidden', 'true');
      const caption = span('bd-long');
      const short = span('bd-short');
      captionBox.append(caption, short);
      const waitBox = span('bd-wait');
      waitBox.setAttribute('aria-hidden', 'true');
      const wait = span('bd-long');
      const waitShort = span('bd-short');
      waitBox.append(wait, waitShort);
      const face = button.querySelector('.bd-face');
      let count: FlapRow | null = null;
      if (face && (tag === 'turboprop' || tag === 'widebody' || tag === 'hub')) {
        count = new FlapRow(deps, 'bd-flaps--count');
        count.element.setAttribute('aria-hidden', 'true');
        (tag === 'hub' ? button : face).append(count.element); // the octagon's clip would cut a corner flap
      }
      button.append(waitBox);
      button.append(captionBox);
      parts = { caption, short, wait, waitShort, count, speed: 0 };
      dockParts.set(button, parts);
    }
    const [longKey, shortKey] = CAPTION[tag];
    setText(parts.caption, t(longKey));
    setText(parts.short, t(shortKey));
    setText(parts.wait, state.wait === null ? '' : t('dock.in', { when: state.wait }));
    setText(parts.waitShort, state.wait ?? '');
    (parts.wait.parentElement as HTMLElement).hidden = state.wait === null;
    if (parts.count) parts.count.set(state.count.slice(-deps.cells.count).padStart(1, '0'));
    if (tag === 'speed' && parts.speed !== state.speed) {
      parts.speed = state.speed;
      button.style.setProperty('--bd-dial', `${SPEED_ANGLE[state.speed] ?? 0}deg`);
    }
    return parts;
  }

  return {
    pass(section, state) {
      const parts = passParts.get(section) ?? buildPass(section);
      const figures = boardFigures(state, deps.cells, deps.daysPerWeek);
      setText(parts.labels.localTime, t('board.localTime'));
      setText(parts.labels.week, t('board.week'));
      setText(parts.labels.day, t('board.day'));
      setText(parts.labels.passengers, t('board.passengers'));
      parts.clock.set(figures.clock);
      parts.week.set(figures.week);
      parts.day.set(figures.day);
      parts.passengers.set(figures.passengers);
      const passengers = clamp(state.passengers, 0, Number.MAX_SAFE_INTEGER);
      const label = t('board.label', { time: figures.clock, week: figures.week, day: clamp(state.day, 1, deps.daysPerWeek),
        days: deps.daysPerWeek, count: passengers }).replace(String(passengers), deps.localNumber(passengers));
      if (parts.label !== label) { parts.label = label; parts.board.setAttribute('aria-label', label); }
      const hour = Math.floor(figures.minute / 60);
      if (parts.hour !== hour) {
        parts.hour = hour;
        parts.cells.forEach((cell, h) => {
          const next = `${isBoardNight(h) ? 'is-night' : ''}${h < hour ? ' is-past' : ''}`.trim();
          if (cell.className !== next) cell.className = next;
        });
      }
      // D-88: with "Reduce motion" the "now" mark steps once per game hour instead of creeping every game minute.
      const at = deps.reducedMotion() ? hour * 60 : figures.minute;
      if (parts.at !== at) { parts.at = at; parts.now.style.setProperty('--at', (at / 1440).toFixed(4)); }
      const pause = section.querySelector('.airway-pass__pause .bd-eng');
      if (pause) setText(pause, t(state.paused ? 'board.go' : 'board.stop'));
    },
    pauseFace(paused) {
      return `<span class="bd-face bd-face--round"><span class="bd-cap">${symbol(paused ? 'resume' : 'pause')}</span></span>` +
        `<span class="bd-eng" aria-hidden="true">${t(paused ? 'board.go' : 'board.stop')}</span>`;
    },
    dockFace(tag) {
      if (tag === 'undo') return `<span class="bd-face bd-face--round"><span class="bd-cap">${symbol('undo')}</span></span>`;
      if (tag === 'speed') return `<span class="bd-face bd-face--rotary">${DIAL}</span>`;
      if (tag === 'hub') return `<span class="bd-face bd-face--oct"><span class="bd-cap">${symbol('hub')}</span></span>`;
      // The route line the aircraft flies, printed on its plate as on the map: dashed = turboprop, solid = widebody.
      const line = `<svg class="bd-line" viewBox="0 0 46 4" aria-hidden="true" focusable="false"><path d="M1 2H45"${tag === 'turboprop' ? ' stroke-dasharray="7 5"' : ''}/></svg>`;
      return `<span class="bd-face bd-face--plate">${SCREW}${SCREW}<i class="bd-lamp"></i>${symbol(tag)}${line}</span>`;
    },
    dockState(button, tag, state) { dockState(button, tag, state); },
  };
}

/**
 * The sheets (pause, hub board, weekly board, report) start under the top band, whose height depends on the screen and
 * the safe area: its bottom edge is published as `--lin-pass-bottom` (the Linoryt sheets read it, D-301) whenever the
 * band changes size.
 */
function publishBoardBottom(section: HTMLElement): void {
  const root = document.documentElement;
  const publish = (): void => {
    const bottom = section.getBoundingClientRect().bottom;
    if (bottom > 0) root.style.setProperty('--lin-pass-bottom', `${Math.ceil(bottom)}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(publish).observe(section);
  publish();
}

/** Turns the preview on: <html data-skin="board"> scopes board.css and the re-scoped Linoryt structure. */
export function startBoard(): void {
  document.documentElement.dataset.skin = 'board';
}

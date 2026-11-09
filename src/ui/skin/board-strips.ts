/**
 * [night-75a] D-330 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T3; UI-A-SPEC.md §3 "Pasek lotu"): the bay
 * of hub flight strips of the UI-A skin. src/main.ts loads this module at boot and hands it to the session through `stripSkin` (src/ui/strip-skin.ts).
 *
 * - **Strip** (one per hub, a controller's paper flight-progress strip in its holder): the holder's colour says the state
 *   (blue = in order, red = jammed) and carries the hub mark (the asterisk of the hub's pin); then the columns HUB (code,
 *   city), QUEUE (one D-08 glyph per passenger, a row per destination, most numerous first; past two rows the remaining
 *   directions as glyph + count), SEATS ("36/36") and CLOSES (the jam countdown ringed in red pencil, or "none"). The
 *   whole strip is one button (≥ 48 px tall) that opens the full strip: the hub cause board (src/ui/hubBoard.ts), restyled
 *   as a long strip by board.css "T3". A long press on the airport still opens it as before.
 * - **Bay**: at most two strips one above the other (one at text ≥ 130 %, on a short screen and in the landscape
 *   fallback), the most urgent first (jammed by the time left, then the fullest; a strip on show keeps its place until
 *   another hub is clearly fuller, so strips do not swap at every passenger); the rest fold into a "+N paski" tile that
 *   unfolds them in a list. Portrait and foldable: on the console, full width (foldable: centred, ≤ 560 px). Landscape:
 *   the right column beside the console, level with the split-flap board; where the board leaves too little room (a
 *   phone under ~860 px wide) one strip over the map's lower left.
 * - The bay is a game panel (src/game/world.ts `GAME_PANELS`, camera insets like the dock) and a margin of the notes and
 *   direction signs (src/ui/skin/base.ts `baseMargins`; the notes keep off its box through the board slot). It
 *   writes its place on the layer (`--bd-bay-*`, `data-bd-bay`) so the full strip, the ATC strip and the cards stand on it.
 *
 * Nothing moves: no strip slides, swaps or blinks (D-88 "Reduce motion" has nothing to stop). No runtime imports:
 * src/main.ts hands in i18n and the glyph builder. Every text is a catalog key; the strip's insides are aria-hidden and
 * the button carries one spoken label.
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { RegionId } from '../../data/regions';
import type { StripBay, StripHub, StripSkin } from '../strip-skin';

export interface BoardStripsDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** The D-08 glyph builder of src/ui/glyphs.ts. */
  glyph(region: RegionId, size: number): SVGSVGElement;
  /** Region order of src/data/regions.ts (the tie-break of equal queues). */
  regions: readonly RegionId[];
}

// ---- Model (pure; `test:board` checks it) ----------------------------------------------------------------------------

/** Strip height at 100 % text (px); the bay holds two of them. */
export const STRIP_H = 56;
/** Gap between two strips and round the bay (px). */
export const STRIP_GAP = 4;
/**
 * Glyph size on a strip (px): the theme's D-08 floor `--airway-glyph-size` (16 px, 21 px with enhanced glyphs; the bay
 * reads it), one glyph per passenger, 1 px apart; a glyph + count pair takes the glyph and about 20 px more.
 */
export const STRIP_GLYPH = 16;
const PAIR_EXTRA = 20;
/** The free map height (px) two strips must leave between the board and the bay, else the bay shows one. */
export const MAP_KEEP = 300;
/** A strip on show keeps its place until another hub is fuller by this share of its seats. */
export const STRIP_STAY = 0.15;
/** Landscape: the right column beside the console needs this width, else one strip goes over the map's lower left. */
export const COLUMN_MIN = 260;
/** Text at this step or more shows one strip and the queue as glyph + count (spec §5). */
export const STRIP_TEXT_ONE = 130;

/** Urgency of a hub: a jam outranks any fill (the sooner it closes, the higher), then the share of seats taken. */
export function stripUrgency(hub: Pick<StripHub, 'waiting' | 'capacity' | 'jamSeconds'>): number {
  if (hub.jamSeconds !== null) return 10 + 1 / (1 + Math.max(0, hub.jamSeconds));
  return hub.capacity > 0 ? Math.min(2, hub.waiting.length / hub.capacity) : 0;
}

/**
 * The hubs in bay order: most urgent first; one already on show (`shown`) is ranked as if `STRIP_STAY` fuller, so two hubs
 * at about the same fill do not swap at every passenger. Ties: the code order (stable on screen).
 */
export function stripOrder<T extends Pick<StripHub, 'id' | 'code' | 'waiting' | 'capacity' | 'jamSeconds'>>(
  hubs: readonly T[], shown: readonly string[]): T[] {
  const score = (hub: T): number => stripUrgency(hub) + (hub.jamSeconds === null && shown.includes(hub.id) ? STRIP_STAY : 0);
  return hubs.slice().sort((a, b) => score(b) - score(a) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

export type BayAnchor = 'bottom' | 'top';
export interface BayBox { readonly l: number; readonly t: number; readonly r: number; readonly b: number }
export interface BayPlace {
  readonly anchor: BayAnchor;
  /** Left edge and right offset (px from the layer's right). */
  readonly left: number;
  readonly right: number;
  /** `bottom`: offset of the bay's bottom from the layer's bottom; `top`: its top. */
  readonly y: number;
  readonly slots: 1 | 2;
}

/**
 * Where the bay stands and how many strips it holds. `column`: the console is a column on the right (landscape);
 * `board` is the split-flap board's box (with the pause key), `dock` the console's; `inset*` the 8 px margin plus the safe
 * area; `strip` one strip's height and `extra` the "+N" tile row under the strips (0 when the tile stands beside them).
 */
export function bayPlace(input: { width: number; height: number; column: boolean; board: BayBox; dock: BayBox;
  insetLeft: number; insetRight: number; insetBottom: number; strip: number; extra?: number; textScale: number }): BayPlace {
  const { width, height, column, board, dock, strip, textScale } = input;
  const one = textScale >= STRIP_TEXT_ONE;
  const two = strip * 2 + STRIP_GAP + (input.extra ?? 0) + STRIP_GAP * 2;
  if (!column) {
    const free = dock.t - board.b - STRIP_GAP * 2;
    const slots: 1 | 2 = !one && free - two >= MAP_KEEP ? 2 : 1;
    return { anchor: 'bottom', left: input.insetLeft, right: input.insetRight, y: Math.max(0, height - dock.t + STRIP_GAP), slots };
  }
  const room = dock.l - board.r - STRIP_GAP * 4;
  if (room >= COLUMN_MIN) {
    const slots: 1 | 2 = !one && board.t + two <= height * 0.45 ? 2 : 1;
    return { anchor: 'top', left: Math.round(board.r + STRIP_GAP * 2), right: Math.max(0, Math.round(width - dock.l + STRIP_GAP * 2)), y: Math.round(board.t), slots };
  }
  return { anchor: 'bottom', left: input.insetLeft, right: Math.max(0, Math.round(width - dock.l + STRIP_GAP * 2)), y: input.insetBottom, slots: 1 };
}

export interface QueueRow { readonly region: RegionId; readonly count: number }
export interface StripQueue {
  /** Rows of one glyph per passenger: `glyphs` drawn, then "+more". */
  readonly rows: readonly { region: RegionId; glyphs: number; more: number }[];
  /** Further directions as glyph + count, then "+pairsMore" passengers of the directions past them. */
  readonly pairs: readonly QueueRow[];
  readonly pairsMore: number;
  readonly directions: number;
}

/**
 * The queue column (two rows): directions most numerous first (ties in region order). One or two directions: a row of
 * single glyphs each (`perRow` fit; a longer row shows `perRow - 2` glyphs and "+n", which takes two glyphs' room). More:
 * the first direction's row, then the others as glyph + count pairs (`pairsFit` fit a row; past them "+n" passengers).
 * `compact` (text ≥ 130 % or a narrow column) gives every direction as a pair, the row wrapping (spec §5: "glif + liczba").
 */
export function stripQueue(waiting: readonly RegionId[], order: readonly RegionId[], perRow: number, pairsFit: number, compact: boolean): StripQueue {
  const counts = new Map<RegionId, number>();
  for (const region of waiting) counts.set(region, (counts.get(region) ?? 0) + 1);
  const sorted: QueueRow[] = [...counts].map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.region) - order.indexOf(b.region));
  if (compact) return { rows: [], pairs: sorted, pairsMore: 0, directions: sorted.length };
  const fit = Math.max(3, perRow);
  const glyphRows = sorted.length <= 2 ? sorted.length : 1;
  const rows = sorted.slice(0, glyphRows).map(({ region, count }) => count <= fit
    ? { region, glyphs: count, more: 0 } : { region, glyphs: fit - 2, more: count - (fit - 2) });
  const rest = sorted.slice(glyphRows);
  const room = Math.max(1, pairsFit);
  if (rest.length <= room) return { rows, pairs: rest, pairsMore: 0, directions: sorted.length };
  const pairs = rest.slice(0, room - 1);
  return { rows, pairs, pairsMore: rest.slice(room - 1).reduce((sum, row) => sum + row.count, 0), directions: sorted.length };
}

/** Room round the strip paper (bay padding and frame, the holder) and the fixed columns at 100 % text (hub, seats, closes). */
const BAY_CHROME = 8 + 2 + 22;
/** The hub, seats and closes columns at 100 % text, as laid out by board.css (hub 64, seats and closes as wide as their longest figure: about 160 together). */
const FIXED_COLS = 160;
const COL_PAD = 10;
const MORE_W = 56;
/** The bay's widest (foldables, tablets; board.css `.bd-bay` max-width). */
const BAY_MAX = 560;
/** Below this queue width (px) the queue moves to its own row under the other columns ("stacked" strip). */
export const QUEUE_MIN = 80;
/** A stacked strip's top row at 100 % text: code, seats "36/36" and the countdown (px, without paddings). */
const STACK_ROW = 140;
/** A stacked strip is this much taller than a side-by-side one (the queue row), at 100 % text; the tile row's height. */
export const STACK_EXTRA = 40;
export const TILE_ROW = 48;

/**
 * How a strip lays out in a bay `bayWidth` px wide, first that fits: side by side (hub | queue | seats | closes) with the
 * "+N" tile beside the strips; side by side with the tile as a row under them; stacked (the queue on a row of its own
 * under the rest; always at text ≥ 130 %) with the tile beside, or under them when the top row would not fit. `height` is
 * one strip's height, `extra` the tile row's; `perRow` glyphs fit a queue row; `compact` gives the queue as glyph + count.
 */
export function stripLayout(bayWidth: number, textScale: number, folded: boolean, glyph = STRIP_GLYPH):
  { stack: boolean; tileRow: boolean; perRow: number; pairsFit: number; compact: boolean; height: number; extra: number } {
  const scale = textScale / 100;
  const paper = bayWidth - BAY_CHROME;
  const tile = MORE_W + STRIP_GAP;
  const side = paper - FIXED_COLS * scale - COL_PAD;
  const big = textScale >= STRIP_TEXT_ONE;
  let stack = false;
  let tileRow = false;
  let queue = side - (folded ? tile : 0);
  if (big || queue < QUEUE_MIN) {
    if (!big && folded && side >= QUEUE_MIN) { tileRow = true; queue = side; } else {
      stack = true;
      tileRow = folded && paper - tile < STACK_ROW * scale + COL_PAD * 3;
      queue = paper - COL_PAD - (folded && !tileRow ? tile : 0);
    }
  }
  const { perRow, pairsFit } = queueFit(queue, glyph);
  return { stack, tileRow, perRow, pairsFit, compact: big || perRow < 4,
    height: (STRIP_H + (stack ? STACK_EXTRA : 0) + (glyph - STRIP_GLYPH) * 2) * Math.max(1, scale), extra: tileRow ? TILE_ROW + STRIP_GAP : 0 };
}

/** Chivo Mono advance (em; every glyph of the mono face) and the strip's type sizes at 100 % text (board.css "T3"). */
const MONO = 0.6;
const LABEL_PX = 7.5;
const LABEL_TRACK = 0.08;
const VALUE_PX = 17;
const VALUE_TRACK = -0.03;
const NONE_PX = 13;

/**
 * Widths (px) of the seats and closes columns, shared by every strip in the bay so their queue columns line up and hold
 * the same glyphs: the longer of the column label and the longest figure any strip prints there, plus the paddings.
 */
export function stripColumns(hubs: readonly Pick<StripHub, 'waiting' | 'capacity' | 'jamSeconds'>[], labels: { seats: string; close: string; none: string },
  textScale: number): { seats: number; close: number } {
  const s = textScale / 100;
  const label = (text: string): number => [...text].length * (MONO + LABEL_TRACK) * LABEL_PX * s;
  let seats = 0;
  let jam = false;
  for (const hub of hubs) {
    seats = Math.max(seats, String(hub.waiting.length).length + 1 + String(hub.capacity).length);
    if (hub.jamSeconds !== null) jam = true;
  }
  const figure = (chars: number, px: number, track: number): number => chars * (MONO + track) * px * s;
  return {
    seats: Math.ceil(Math.max(label(labels.seats), figure(seats, VALUE_PX, VALUE_TRACK))) + COL_PAD + 2,
    close: Math.ceil(Math.max(label(labels.close), figure([...labels.none].length, NONE_PX, 0), jam ? figure(4, VALUE_PX, VALUE_TRACK) + 8 : 0)) + COL_PAD + 2,
  };
}

/** Glyphs (1 px apart) and glyph + count pairs (6 px apart) a queue row `width` px wide holds. */
export function queueFit(width: number, glyph = STRIP_GLYPH): { perRow: number; pairsFit: number } {
  return { perRow: Math.max(2, Math.floor((width + 1) / (glyph + 1))), pairsFit: Math.max(1, Math.floor((width + 6) / (glyph + PAIR_EXTRA + 6))) };
}

/** The jam countdown as the strip prints it, "0:42" (as the airport sign). */
export const stripClock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---- DOM -------------------------------------------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, cls: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  el.setAttribute('class', cls);
  return el;
}
function path(d: string): SVGPathElement {
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  return el;
}
function span(cls: string, text = ''): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = cls;
  if (text) el.textContent = text;
  return el;
}
function setClass(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) === on) return;
  if (on) el.classList.add(name); else el.classList.remove(name);
}

/** The mark on the holder: the six-spoke asterisk of a hub's pin, or the plain point of an airport's. */
function holderMark(hub: boolean): SVGSVGElement {
  const el = svg('0 0 16 16', hub ? 'bd-strip__mark' : 'bd-strip__mark bd-strip__mark--point');
  el.append(path(hub ? 'M8 1.5V14.5M2.4 4.75 13.6 11.25M2.4 11.25 13.6 4.75' : 'M8 3.5A4.5 4.5 0 1 1 7.99 3.5Z'));
  return el;
}
/** The red pencil ring round a jam's countdown: one open hand-drawn loop (no fill, no glow). */
function pencilRing(): SVGSVGElement {
  const el = svg('0 0 60 30', 'bd-strip__ring');
  el.setAttribute('preserveAspectRatio', 'none');
  el.append(path('M9 6C20 1 46 1 55 8C61 14 55 25 38 27C22 29 5 26 3 17C2 11 8 7 16 5'));
  return el;
}

interface StripEl { el: HTMLButtonElement; key: string }

/** Creates the UI-A strip skin (UI-A). */
export function createBoardStrips(deps: BoardStripsDeps): StripSkin {
  const { t, localNumber } = deps;
  return {
    mount(layer, callbacks): StripBay {
      const bay = document.createElement('section');
      bay.className = 'airway-strip-bay bd-bay';
      bay.dataset.testid = 'strip-bay';
      bay.hidden = true;
      const column = span('bd-bay__strips');
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'bd-bay__more';
      more.dataset.testid = 'strip-more';
      more.setAttribute('aria-expanded', 'false');
      const moreN = span('bd-bay__more-n');
      const moreWord = span('bd-bay__more-word');
      more.append(moreN, moreWord);
      const list = span('bd-bay__list');
      list.hidden = true;
      bay.append(column, more, list);
      layer.append(bay);

      const strips = new Map<string, StripEl>();
      let hubs: readonly StripHub[] = [];
      let order: StripHub[] = [];
      let shown: string[] = [];
      let place: BayPlace | null = null;
      let lastKey = '';
      let lastHubsKey = '';
      let columnsKey = '';
      let perRow = 8;
      let pairsFit = 3;
      let glyph = STRIP_GLYPH;
      let compact = false;
      /** Sets the glyphs a queue row holds and the compact queue; strips rebuild only when that changed. */
      const setQueue = (nextPerRow: number, nextPairs: number, nextCompact: boolean): boolean => {
        if (nextPerRow === perRow && nextPairs === pairsFit && nextCompact === compact) return false;
        perRow = nextPerRow;
        pairsFit = nextPairs;
        compact = nextCompact;
        for (const entry of strips.values()) entry.key = '';
        return true;
      };
      let textScale = 100;
      let open = false;
      let box: BayBox | null = null;

      const stripFor = (hub: StripHub): StripEl => {
        let entry = strips.get(hub.id);
        if (!entry) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'bd-strip';
          el.dataset.hub = hub.id;
          el.dataset.testid = `strip-${hub.id}`;
          el.addEventListener('click', () => { setOpen(false); callbacks.open(hub.id); });
          entry = { el, key: '' };
          strips.set(hub.id, entry);
        }
        return entry;
      };

      const fill = (entry: StripEl, hub: StripHub): void => {
        const queue = stripQueue(hub.waiting, deps.regions, perRow, pairsFit, compact);
        const key = `${hub.code}|${hub.name}|${hub.hub}|${hub.waiting.length}|${hub.capacity}|${hub.jamSeconds}|${perRow}|${compact}|${glyph}|` +
          queue.rows.map((row) => `${row.region}${row.glyphs}+${row.more}`).join(',') + '/' + queue.pairs.map((p) => `${p.region}${p.count}`).join(',') + `+${queue.pairsMore}`;
        if (key === entry.key) return;
        entry.key = key;
        const el = entry.el;
        const jam = hub.jamSeconds !== null;
        setClass(el, 'bd-strip--jam', jam);
        const seats = `${localNumber(hub.waiting.length)}/${localNumber(hub.capacity)}`;
        const time = jam ? stripClock(hub.jamSeconds ?? 0) : '';
        el.setAttribute('aria-label', jam
          ? t(hub.hub ? 'board.strip.ariaJam' : 'board.strip.ariaJamAirport', { code: hub.code, name: hub.name, time, waiting: hub.waiting.length, capacity: hub.capacity })
          : t('board.strip.aria', { code: hub.code, name: hub.name, waiting: hub.waiting.length, capacity: hub.capacity, count: queue.directions }));
        const grip = span('bd-strip__grip');
        grip.append(holderMark(hub.hub));
        const hubCol = span('bd-strip__col bd-strip__hub');
        hubCol.append(span('bd-strip__lab', t(hub.hub ? 'board.strip.hub' : 'board.strip.airport')), span('bd-strip__code', hub.code), span('bd-strip__city', hub.name));
        const queueCol = span('bd-strip__col bd-strip__queue');
        const narrow = perRow < 6;
        const label = queue.directions === 0 || narrow || compact ? t('board.strip.queueShort') : t('board.strip.queue', { count: queue.directions });
        const rows = span('bd-strip__rows');
        for (const row of queue.rows) {
          const line = span('bd-strip__row');
          for (let i = 0; i < row.glyphs; i++) line.append(deps.glyph(row.region, glyph));
          if (row.more) line.append(span('bd-strip__plus', `+${localNumber(row.more)}`));
          rows.append(line);
        }
        if (queue.pairs.length) {
          const line = span(compact ? 'bd-strip__row bd-strip__row--pairs bd-strip__row--wrap' : 'bd-strip__row bd-strip__row--pairs');
          for (const pair of queue.pairs) {
            const item = span('bd-strip__pair');
            item.append(deps.glyph(pair.region, glyph), span('bd-strip__n', localNumber(pair.count)));
            line.append(item);
          }
          if (queue.pairsMore) line.append(span('bd-strip__plus', `+${localNumber(queue.pairsMore)}`));
          rows.append(line);
        }
        if (!queue.directions) rows.append(span('bd-strip__none', t('board.strip.queueEmpty')));
        queueCol.append(span('bd-strip__lab', label), rows);
        const seatsCol = span('bd-strip__col bd-strip__seats');
        seatsCol.append(span('bd-strip__lab', t('board.strip.seats')), span('bd-strip__val', seats));
        const closeCol = span('bd-strip__col bd-strip__close');
        const value = span(jam ? 'bd-strip__val bd-strip__val--jam' : 'bd-strip__val bd-strip__val--none', jam ? time : t('board.strip.closeNone'));
        if (jam) value.append(pencilRing());
        closeCol.append(span('bd-strip__lab', t('board.strip.close')), value);
        const inner = span('bd-strip__paper');
        inner.setAttribute('aria-hidden', 'true');
        inner.append(hubCol, queueCol, seatsCol, closeCol);
        el.replaceChildren(grip, inner);
      };

      const setOpen = (next: boolean): void => {
        open = next && order.length > (place?.slots ?? 1);
        list.hidden = !open;
        more.setAttribute('aria-expanded', String(open));
        render(true);
      };
      more.addEventListener('click', () => setOpen(!open));
      const onKey = (event: KeyboardEvent): void => {
        if (open && event.key === 'Escape') { event.preventDefault(); setOpen(false); more.focus({ preventScroll: true }); }
      };
      document.addEventListener('keydown', onKey);

      /** Lays the strips out in the bay and the list (DOM only when the order, a strip or the "+N" count changed). */
      function render(force = false): void {
        const slots = place?.slots ?? 1;
        const cols = stripColumns(hubs, { seats: t('board.strip.seats'), close: t('board.strip.close'), none: t('board.strip.closeNone') }, textScale);
        const colKey = `${cols.seats}/${cols.close}`;
        if (colKey !== columnsKey) {
          columnsKey = colKey;
          bay.style.setProperty('--bd-seats-w', `${cols.seats}px`);
          bay.style.setProperty('--bd-close-w', `${cols.close}px`);
          schedule(); // the queue column changed width: count its glyphs again
        }
        order = stripOrder(hubs, shown);
        const key = order.map((hub) => hub.id).join(',') + `|${slots}|${open}`;
        for (const hub of order) fill(stripFor(hub), hub);
        for (const [id, entry] of strips) if (!hubs.some((hub) => hub.id === id)) { entry.el.remove(); strips.delete(id); }
        if (!force && key === lastKey) return;
        lastKey = key;
        const front = order.slice(0, slots);
        shown = front.map((hub) => hub.id);
        const rest = order.slice(slots);
        column.replaceChildren(...front.map((hub) => stripFor(hub).el));
        list.replaceChildren(...rest.map((hub) => stripFor(hub).el));
        if (!rest.length && open) { open = false; list.hidden = true; more.setAttribute('aria-expanded', 'false'); }
        more.hidden = rest.length === 0;
        setClass(bay, 'bd-bay--more', rest.length > 0);
        moreN.textContent = `+${localNumber(rest.length)}`;
        moreWord.textContent = t('board.strip.moreWord', { count: rest.length });
        more.setAttribute('aria-label', open ? t('board.strip.lessAria') : t('board.strip.moreAria', { count: rest.length }));
        bay.setAttribute('aria-label', t('board.strip.bay'));
        const hidden = order.length === 0;
        if (bay.hidden !== hidden) bay.hidden = hidden;
        bay.dataset.slots = String(front.length);
      }

      /** Reads the board and console boxes and places the bay (on a size change; deferred a frame, never in a callback). */
      let raf = 0;
      const measure = (): void => {
        raf = 0;
        const origin = layer.getBoundingClientRect();
        const passEl = layer.querySelector('.airway-pass');
        const boardEl = layer.querySelector('.bd-board') ?? passEl;
        const dockEl = layer.querySelector('.airway-dock');
        if (!passEl || !boardEl || !dockEl || origin.width < 1) return;
        const rel = (el: Element): BayBox => {
          const r = el.getBoundingClientRect();
          return { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top };
        };
        const dock = rel(dockEl);
        // The top band's side paddings and the console's bottom padding are the 8 px margin plus the safe area (board.css).
        const passStyle = getComputedStyle(passEl);
        const insetLeft = parseFloat(passStyle.paddingLeft) || 8;
        const insetRight = parseFloat(passStyle.paddingRight) || 8;
        const insetBottom = (parseFloat(getComputedStyle(dockEl).paddingBottom) || 6) + 2;
        textScale = Number(document.documentElement.dataset.airwayTextScale ?? 100) || 100;
        // The board's top and bottom, and the top band's right edge (the pause key stands beside the board).
        const boardBox = rel(boardEl);
        const passBox = rel(passEl);
        const geo = { width: origin.width, height: origin.height, column: dock.b - dock.t > dock.r - dock.l,
          board: { l: boardBox.l, t: boardBox.t, r: Math.max(boardBox.r, passBox.r), b: Math.max(boardBox.b, passBox.b) }, dock,
          insetLeft, insetRight, insetBottom, textScale };
        // The bay's width does not depend on the strips; their layout decides the height, and the height how many show
        // (two strips that no longer fit leave one and a "+N" tile, which can change the layout once more).
        const first = bayPlace({ ...geo, strip: STRIP_H });
        const bayWidth = first.anchor === 'top' ? origin.width - first.left - first.right : Math.min(BAY_MAX, origin.width - first.left - first.right);
        glyph = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--airway-glyph-size')) || STRIP_GLYPH;
        let lay = stripLayout(bayWidth, textScale, hubs.length > 2, glyph);
        let next = bayPlace({ ...geo, strip: lay.height, extra: lay.extra });
        if (hubs.length > next.slots && hubs.length <= 2) {
          lay = stripLayout(bayWidth, textScale, true, glyph);
          next = bayPlace({ ...geo, strip: lay.height, extra: lay.extra });
        }
        place = next;
        setQueue(lay.perRow, lay.pairsFit, lay.compact);
        setClass(bay, 'bd-bay--stack', lay.stack);
        setClass(bay, 'bd-bay--tilerow', lay.tileRow);
        bay.dataset.anchor = next.anchor;
        layer.dataset.bdBay = next.anchor;
        layer.style.setProperty('--bd-bay-l', `${next.left}px`);
        layer.style.setProperty('--bd-bay-r', `${next.right}px`);
        layer.style.setProperty('--bd-bay-y', `${next.y}px`);
        render(true);
        // The queue column as laid out (the other columns size to their content): the glyphs a row really holds.
        const queueCol = column.querySelector('.bd-strip__queue');
        if (queueCol && queueCol.clientWidth > 0) {
          const fit = queueFit(queueCol.clientWidth - COL_PAD - 1, glyph);
          if (setQueue(fit.perRow, fit.pairsFit, textScale >= STRIP_TEXT_ONE || fit.perRow < 4)) render(true);
        }
        const r = bay.hidden ? null : bay.getBoundingClientRect();
        box = r && r.width >= 1 ? { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top } : null;
        // The free band over the lower chrome (console or bay) for the ATC strip and the cards; the top band's bottom for the
        // full strip's reach.
        const low = box && next.anchor === 'bottom' ? origin.height - box.t : geo.column ? insetBottom - STRIP_GAP * 2 : origin.height - dock.t;
        layer.style.setProperty('--bd-low-l', `${Math.round(insetLeft)}px`);
        layer.style.setProperty('--bd-low-r', `${Math.round(geo.column ? origin.width - dock.l + STRIP_GAP * 2 : insetRight)}px`);
        layer.style.setProperty('--bd-low-b', `${Math.round(low + STRIP_GAP * 2)}px`);
        layer.style.setProperty('--bd-pass-b', `${Math.round(rel(passEl).b)}px`);
      };
      const schedule = (): void => { if (!raf) raf = requestAnimationFrame(measure); };
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
      observer?.observe(layer);
      observer?.observe(bay);
      const watched = new Set<Element>();
      const watch = (): void => {
        for (const selector of ['.bd-board', '.airway-dock']) {
          const el = layer.querySelector(selector);
          if (el && !watched.has(el)) { watched.add(el); observer?.observe(el); }
        }
      };
      watch();
      schedule();

      return {
        get box() { return box; },
        update(next) {
          let key = '';
          for (const hub of next) key += `${hub.id}:${hub.waiting.length}:${hub.waiting.join('')}:${hub.capacity}:${hub.jamSeconds};`;
          const scale = Number(document.documentElement.dataset.airwayTextScale ?? 100) || 100;
          if (scale !== textScale) { watch(); schedule(); }
          if (key === lastHubsKey) return;
          const count = hubs.length;
          lastHubsKey = key;
          hubs = next.slice();
          render(next.length !== count);
          if (next.length !== count) { watch(); schedule(); }
        },
        dispose() {
          if (raf) cancelAnimationFrame(raf);
          observer?.disconnect();
          document.removeEventListener('keydown', onKey);
          delete layer.dataset.bdBay;
          bay.remove();
        },
      };
    },
  };
}

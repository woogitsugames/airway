/**
 * [night-28a] D-283 / D-284: the "Linoryt" skin helpers (docs/styles/kierunki-2026-11b/KIERUNKI.md, direction A; plan
 * docs/styles/kierunki-2026-11b/PLAN-LINORYT.md). A relief print in three inks on paper: the HUD is printed on a
 * paper margin at the top (a big Besley clock, the week, "day 2 of 3 · 34 passengers" and a day bar of 24 carved
 * hours, night hours inked solid, a red cut for "now") and a paper dock at the bottom behind a double print rule (five
 * cut symbols with captions, the chosen aircraft a solid ink block, an empty one only its outline); the menu is a
 * printed index under the title (the run-starting entry on the one red block).
 *
 * [night-46a] D-301 (step U5): the shipped skin. src/main.ts calls startLinoryt() on every boot (index.html sets
 * <html data-skin="linoryt">); the helpers restyle the base ("Diorama") DOM of the HUD, overlay and menu together with
 * linoryt.css. Róża and the DEV `?skin=` previews are gone.
 *
 * This module has no runtime imports (only types): src/main.ts hands in what it needs. Player text uses the
 * skin-neutral catalog keys (`hud.*`, `dock.*`, `note.*`, `menu.*`).
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { DestinationRegion } from '../glyphs';
import type { EdgeBounds, TagBounds, TagSlot } from '../overlay-layout';

export const linoryt = { on: false };

/** What the helpers need from the rest of the app, handed in by src/main.ts. */
export interface LinorytDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
}
let deps: LinorytDeps = { t: (key) => key, localNumber: String };
const t: LinorytDeps['t'] = (key, params) => deps.t(key, params);

/** Turns the preview on: <html data-skin="linoryt"> scopes linoryt.css (call before the HUD and menu are mounted). */
export function startLinoryt(next: LinorytDeps): void {
  deps = next;
  linoryt.on = true;
  document.documentElement.dataset.skin = 'linoryt';
}

/** Night hours of the day bar, inked solid: the same 20:00–06:00 band the Róża dial hatched (quiet demand hours). */
export const LINORYT_NIGHT = { from: 20, to: 6 } as const;
export const isNightHour = (hour: number): boolean => hour >= LINORYT_NIGHT.from || hour < LINORYT_NIGHT.to;

function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
const pad2 = (n: number): string => String(n).padStart(2, '0');

// ---- Symbols ---------------------------------------------------------------------------------------------------------

/**
 * Cut symbols drawn for Airway (docs/styles/kierunki-2026-11b/src/icons.js, 100 × 100 boxes): solid ink shapes, as a
 * linocut prints them; linoryt.css draws an empty (unavailable) one as its outline only. The speed arrow carries one
 * wind barb per 1× of game speed.
 */
const SYMBOL = {
  undo: 'M78 70L78 46Q78 26 58 26L30 26 30 12 8 32 30 52 30 38 58 38Q66 38 66 46L66 70Z',
  turboprop: 'M46 8L54 8 56 40 92 44 92 54 56 56 55 80 68 86 68 92 32 92 32 86 45 80 44 56 8 54 8 44 44 40ZM20 34L30 34 30 46 20 46ZM70 34L80 34 80 46 70 46Z',
  widebody: 'M47 6L53 6 56 36 94 62 94 70 56 56 55 80 70 90 70 95 50 90 30 95 30 90 45 80 44 56 6 70 6 62 44 36ZM16 58L22 55 24 64 18 66ZM30 49L36 46 38 55 32 57ZM64 46L70 49 68 57 62 55ZM78 55L84 58 82 66 76 64Z',
  hub: 'M44 6L56 6 56 94 44 94ZM12 22L18 12 88 78 82 88ZM82 12L88 22 18 88 12 78Z',
  speed: 'M8 46L68 46 68 30 94 52 68 74 68 58 8 58Z',
  pause: 'M30 18H44V82H30ZM56 18H70V82H56Z',
  resume: 'M30 14L82 50 30 86Z',
} as const;
export type LinorytSymbol = keyof typeof SYMBOL;

/** One symbol as inline SVG (same class as the HUD icons, so the base layout sizes it). */
export function linorytIcon(name: LinorytSymbol, barbs = 1): string {
  const extra = name === 'speed'
    ? Array.from({ length: Math.max(1, barbs) }, (_, i) => `M${20 + i * 14} 46L${12 + i * 14} 22 ${22 + i * 14} 22 ${30 + i * 14} 46Z`).join('')
    : '';
  return `<svg class="airway-hud__icon lin-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${SYMBOL[name]}${extra}" fill="currentColor" stroke-linejoin="round"/></svg>`;
}

// ---- HUD: clock, week, day/passengers, day bar ------------------------------------------------------------------------

interface PassParts { clock: HTMLElement; week: HTMLElement; sub: HTMLElement; cells: HTMLElement[]; now: HTMLElement; bar: HTMLElement; minute: number; at: number }
const passParts = new WeakMap<HTMLElement, PassParts>();

/**
 * The top margin of the HUD (inside the boarding pass section, whose old fields linoryt.css hides): the clock, the week
 * and "day 2 of 3 · 34 passengers" beside it, and under them the day bar — 24 carved hours, night hours solid ink, the
 * hours already flown today in Prussian blue, the rest hollow, a red cut at "now", figures at 0/6/12/18. The clock is
 * real text (it is the HUD's time); the bar repeats it graphically and is aria-hidden.
 */
export function linorytPass(section: HTMLElement, minute: number, week: number, day: number, days: number, passengers: number): void {
  let parts = passParts.get(section);
  if (!parts) {
    const box = document.createElement('div');
    box.className = 'lin-pass';
    const clock = document.createElement('div');
    clock.className = 'lin-clock';
    const lines = document.createElement('div');
    lines.className = 'lin-lines';
    const weekLine = document.createElement('div');
    weekLine.className = 'lin-week';
    const sub = document.createElement('div');
    sub.className = 'lin-sub';
    lines.append(weekLine, sub);
    const bar = document.createElement('div');
    bar.className = 'lin-day';
    bar.setAttribute('aria-hidden', 'true');
    const cells: HTMLElement[] = [];
    const row = document.createElement('div');
    row.className = 'lin-day__cells';
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('i');
      if (isNightHour(h)) cell.className = 'is-night';
      cells.push(cell);
      row.append(cell);
    }
    const now = document.createElement('b');
    now.className = 'lin-day__now';
    row.append(now);
    const figures = document.createElement('div');
    figures.className = 'lin-day__hours';
    for (const h of [0, 6, 12, 18]) {
      const span = document.createElement('span');
      span.textContent = String(h);
      span.style.setProperty('--h', String(h));
      figures.append(span);
    }
    bar.append(row, figures);
    box.append(clock, lines, bar);
    section.querySelector('.airway-pass__ticket')?.appendChild(box);
    parts = { clock, week: weekLine, sub, cells, now, bar, minute: -1, at: -1 };
    passParts.set(section, parts);
    publishPassBottom(section);
  }
  setText(parts.clock, `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`);
  setText(parts.week, t('hud.weekLine', { week }));
  const count = t('hud.passengerLine', { count: passengers }).replace(String(passengers), deps.localNumber(passengers));
  setText(parts.sub, `${t('hud.dayOf', { day, days })} · ${count}`);
  if (parts.minute !== minute) {
    const hour = Math.floor(minute / 60);
    if (Math.floor(parts.minute / 60) !== hour) {
      parts.cells.forEach((cell, h) => {
        const next = isNightHour(h) ? 'is-night' : h < hour ? 'is-past' : h === hour ? 'is-now' : '';
        if (cell.className !== next) cell.className = next;
      });
    }
    parts.minute = minute;
  }
  // [night-48a] U6, D-88: with reduce motion the red "now" cut steps once per game hour (to the hour just begun) instead
  // of creeping every game minute; the switch can change mid-run, so the value is compared, not the minute.
  const reduce = document.documentElement.dataset['airwayMotion'] === 'reduce';
  const at = reduce ? Math.floor(minute / 60) * 60 : minute;
  if (parts.at !== at) {
    parts.at = at;
    parts.now.style.setProperty('--at', (at / 1440).toFixed(4));
  }
}

/**
 * [night-29a] U3: the sheets (pause, hub board, weekly board, report) start under the top margin, whose height depends on
 * the screen, the safe area and whether the day bar is folded away; its bottom edge is published as `--lin-pass-bottom`
 * on <html> and re-measured whenever the margin changes size.
 */
function publishPassBottom(section: HTMLElement): void {
  const root = document.documentElement;
  const publish = (): void => {
    const bottom = section.getBoundingClientRect().bottom;
    if (bottom > 0) root.style.setProperty('--lin-pass-bottom', `${Math.ceil(bottom)}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(publish).observe(section);
  publish();
}

// ---- Dock: captions ----------------------------------------------------------------------------------------------------

/**
 * The caption under a dock symbol, and the wait for the next crates under an empty aircraft or hub ("za 1 dzień", in
 * blue). Captions repeat the button's accessible name, so they are aria-hidden.
 */
export function linorytDockLabel(button: HTMLElement, name: string, speed: number, wait: string | null): void {
  const text = name === 'undo' ? t('dock.undo')
    : name === 'turboprop' ? t('dock.turboprop')
    : name === 'widebody' ? t('dock.widebody')
    : name === 'hub' ? t('dock.hub')
    : t('dock.speed', { speed });
  let caption = button.querySelector<HTMLElement>('.lin-caption');
  let when = button.querySelector<HTMLElement>('.lin-wait');
  if (!caption || !when) {
    caption = document.createElement('span');
    caption.className = 'lin-caption';
    caption.setAttribute('aria-hidden', 'true');
    when = document.createElement('span');
    when.className = 'lin-wait';
    when.setAttribute('aria-hidden', 'true');
    button.append(caption, when);
  }
  setText(caption, text);
  setText(when, wait === null ? '' : t('dock.in', { when: wait }));
  when.hidden = wait === null;
}

// ---- Game-over report -----------------------------------------------------------------------------------------------

/**
 * [night-29a] U3: the failing hub's code on the report's one red block, beside the heading (the jam block of the map).
 * The heading and the "Map" button already name the hub for screen readers, so the block is aria-hidden.
 */
export function linorytReportHub(sign: HTMLElement, hubCode: string): void {
  const block = document.createElement('span');
  block.className = 'lin-hub';
  block.setAttribute('aria-hidden', 'true');
  block.textContent = hubCode;
  sign.querySelector('.airway-go-heading')?.after(block);
}

// ---- U2: airport notes, the jam block, edge chips ------------------------------------------------------------------
// [night-30a] PLAN-LINORYT.md step U2 (D-283, D-284). The world prints each airport as a stamp (E2: square, hub octagon);
// the DOM prints its note beside it (frame png/a-game.png): the city name in Besley, a fill bar of cut ticks (one tick =
// two places, filled = taken), and the waiting passengers as D-08 glyphs with a count each, every row on a paper ground;
// a newly opened airport leads with the red "NOWE" stub, a jam prints its note in red with the red jam block under it
// ("Zator za / 0:42 / 36 z 36"). The note keeps the D-262…D-268/D-281 behaviour of the Róża notes through the same layout
// engine (src/ui/overlay-layout.ts layoutTags): priority jam > new > hub > fuller, the compact "code + 14 z 24" form
// (code + NOWE for a new airport) before it hides, the busiest hub's and a new airport's note must show, never over a
// stamp and only where it is clearly its own airport's, apart from other notes, fixed in-world sizes at every text step,
// the open hub board is an obstacle. The stamp replaces the rose ring as the fixed obstacle. All sizes are CSS px and
// match linoryt.css ("U2 notes" section); widths are computed (no DOM measuring), so the layout box is the printed box.

/**
 * Clearance between the stamp's disc (see stampReach) and a note: the layout's 4 px gap (TagBounds.gap) and 1 px, so a
 * note's first place is free of its own stamp.
 */
const NOTE_GAP = 5;

/** Where the world prints a stamp this frame: centre, half side (px), and whether it is drawn. */
export interface StampBox { x: number; y: number; half: number; visible: boolean }

/**
 * The stamp box when the world has no `projectAirport` answer (a world without stamps, an airport not yet in its set):
 * the projected airport and half the world's stamp side (`STAMP_SIZE_PX` of src/render, spec §5/§8: a 22 px square,
 * a 30 px hub octagon), which the caller passes in (this module has no runtime imports).
 */
export function linorytStampFallback(out: StampBox, x: number, y: number, half: number, visible: boolean): StampBox {
  out.x = x;
  out.y = y;
  out.half = half;
  out.visible = visible;
  return out;
}

/**
 * Radius (px) of the disc the layout keeps every note off: it holds the whole inked stamp (the square's corners at
 * half·√2, the hub octagon's at half / cos 22.5°; the 2 px paper outline may meet a note's paper ground). The layout
 * engine measures a fixed `ring` obstacle as the disc inscribed in its box (D-263), so the stamp obstacle is that
 * disc's box.
 */
export const stampReach = (half: number, hub: boolean): number => half * (hub ? 1 / Math.cos(Math.PI / 8) : Math.SQRT2);

/** Priority of a note (D-262, D-281): a jam, then a newly opened airport, then a hub, then the fuller airport. */
export const linorytRank = (note: { jam: boolean; fresh: boolean; hub: boolean; fill: number }): number =>
  (note.jam ? 8 : 0) + (note.fresh ? 4 : 0) + (note.hub ? 2 : 0) + Math.max(0, Math.min(1, note.fill));
/** D-281: a newly opened airport's note must show (code + NOWE at least) while the mark lasts; a jam goes first anyway. */
export const linorytNoteMust = (note: { jam: boolean; fresh: boolean }): boolean => note.fresh && !note.jam;
/** D-263: how far (px from the stamp's centre) a note's nearest edge may lie: its first place and 13 px more. */
export const linorytHomeReach = (half: number, hub: boolean): number => stampReach(half, hub) + NOTE_GAP + 13;

/**
 * The stamp as the note layout's fixed obstacle (D-263: never covered, not even by a forced note; D-264: the note's
 * ownership check measures its gap to it). Inactive while the stamp is not drawn.
 */
export function linorytStampObstacle(slot: TagSlot, stamp: StampBox, hub: boolean, code: string, rank: number): void {
  const reach = stampReach(stamp.half, hub);
  slot.active = stamp.visible;
  slot.fixed = true;
  slot.ring = true;
  slot.rose = code;
  slot.rank = rank;
  slot.x = stamp.x - reach;
  slot.y = stamp.y - reach;
  slot.width = slot.height = reach * 2;
}

/**
 * The places a note may take, for layoutTags (the Róża places with the stamp for the rose): right of the stamp with
 * the name level with its centre (frame: Ryga, Wenecja, Ankara), else left of it; the other side; under the stamp and
 * over it, centred; under it to the left and to the right (frame: Ateny, Bagdad, Amman), sliding outward. A note stays
 * within `linorytHomeReach` of its stamp (a jam's: 160 px, as D-263), else it tries the compact form, then hides.
 * `tag.width`/`height` are the full note's.
 */
export function linorytNotePlaces(tag: TagSlot, stamp: StampBox, hub: boolean, jam: boolean, code: string, viewWidth: number): void {
  const { x, y, half } = stamp;
  const reach = stampReach(half, hub) + NOTE_GAP;
  const side = reach;
  const right = x + side + tag.width / 2, left = x - side - tag.width / 2;
  const rightFirst = x + side + tag.width <= viewWidth - 6 || x - side - tag.width < 6;
  tag.anchorX = rightFirst ? right : left;
  tag.altAnchorX = rightFirst ? left : right;
  tag.maxShift = jam ? 160 : tag.height + 6;
  // layoutTags puts a tag's top at anchorY − height − 11: the name line's middle level with the stamp's centre.
  tag.anchorY = y - NAME_LINE / 2 + tag.height + 11;
  const below = Math.ceil(y + reach), above = Math.floor(y - reach);
  tag.belowX = x;
  tag.belowY = below;
  tag.aboveY = above;
  // Under the stamp to its left (the note's right edge at the stamp's right edge) and to its right.
  tag.besideLeft = x + half;
  tag.besideRight = x - half;
  tag.besideY = below + tag.height / 2;
  tag.rose = code; // D-264, D-266: the note's own airport
  tag.homeX = x;
  tag.homeY = y;
  tag.homeReach = jam ? undefined : linorytHomeReach(half, hub);
}

// Note metrics (px). Besley 800 advances in em (measured in Chromium from public/fonts/Besley-800.woff2, the subset's
// every letter); a sum of advances runs at most 0.05 em short of the kerned text, so names get 0.08 em of slack.
const BESLEY: Record<string, number> = {
  ' ': .3, 0: .66, 1: .58, 2: .68, 3: .6, 4: .63, 5: .62, 6: .64, 7: .58, 8: .62, 9: .64,
  A: .93, B: .83, C: .84, D: .9, E: .82, F: .79, G: .93, H: .98, I: .53, J: .69, K: .95, L: .77, M: 1.16, N: .94, O: .89,
  P: .77, Q: .89, R: .91, S: .73, T: .8, U: .91, V: .93, W: 1.26, X: .91, Y: .86, Z: .8,
  a: .66, b: .71, c: .61, d: .71, e: .61, f: .45, g: .67, h: .73, i: .41, j: .38, k: .74, l: .41, m: 1.05, n: .75, o: .63,
  p: .71, q: .7, r: .61, s: .56, t: .45, u: .75, v: .66, w: .93, x: .69, y: .69, z: .58,
  'á': .66, 'ã': .66, 'é': .61, 'í': .41, 'ó': .63, 'Ć': .84, 'ł': .41, 'ń': .75, 'ż': .58,
};
/** Schibsted Grotesk 700 with tabular figures (em): digits, the separators of "14 z 24", "2 408 km · 8 z 12". */
const SCHIBSTED: Record<string, number> = { ' ': .23, '·': .31, '+': .64, ':': .3, z: .55, o: .62, f: .38, k: .61, m: .92 };
const FIGURE = .64;
/** Width (px) of a name or code set in Besley 800 at `px`. */
export function besleyWidth(text: string, px: number): number {
  let em = .08;
  for (const ch of text) em += BESLEY[ch] ?? .95;
  return Math.ceil(em * px);
}
/** Width (px) of figures and short words set in Schibsted Grotesk 600/700 with tabular figures at `px`. */
export function figureWidth(text: string, px: number): number {
  let em = .04;
  for (const ch of text) em += ch >= '0' && ch <= '9' ? FIGURE : SCHIBSTED[ch] ?? .66;
  return Math.ceil(em * px);
}

/** Row heights of a note (linoryt.css "U2 notes"): name line, fill bar, glyph row; the jam block and its gap. */
export const NAME_LINE = 19;
const TICK_LINE = 12;
/** The glyph row: a D-08 glyph at the theme's size (16 px, 21 px with enhanced glyphs) and 2 px of paper over and under it. */
const glyphSize = (): number => (typeof document !== 'undefined' && document.documentElement.dataset.airwayCvd === 'enhanced' ? 21 : 16);
const JAM_GAP = 3;
const JAM_BLOCK = 46;
/** Name sizes: an airport's 14 px, a hub's 16 px (the frame sets hub names larger). */
const namePx = (hub: boolean): number => (hub ? 16 : 14);
/** Horizontal paper padding at each end of a row. */
const ROW_PAD = 4;
/** One glyph group: the glyph, 2 px gap, the count at 12.5 px, 6 px to the next group. */
const groupWidth = (count: number, glyph = glyphSize()): number => glyph + 2 + figureWidth(String(count), 12.5) + 6;
/** The "NOWE" stub: Schibsted Grotesk 700 at 10.5 px, capitals with .04 em tracking, 4 px padding, 4 px to the name. */
export const freshWidth = (label: string): number => Math.ceil(8 + label.length * 8.1) + 4;
/** The fill bar: one tick per two places; 5 px a tick up to 12 ticks, 4 px up to 18, then 72 px in all. */
export function tickPitch(ticks: number): number { return ticks <= 12 ? 5 : ticks <= 18 ? 4 : 72 / ticks; }

/** What one note shows (pure input of the metrics; the DOM builder below fills it from the overlay's entry). */
export interface NoteShape {
  name: string;
  code: string;
  hub: boolean;
  /** Waiting places and how many are taken (0 capacity: no fill bar yet). */
  capacity: number;
  taken: number;
  /** Count of each glyph group (one per region, ready first, then the connecting ones hollow), in order. */
  groups: readonly number[];
  /** Waiting passengers folded into "+N" when the groups overflow `room`. */
  folded: number;
  /** Width of the stubs in the glyph row (curfew barrier, surge, front) and of the fill trend chevron (0 = none). */
  stubs: number;
  trend: number;
  /** The "NOWE"/"NEW" label while the airport is newly opened, else null. */
  fresh: string | null;
  jamSeconds: number | null;
  /** The jam block's head line and fill figure ("Zator za", "36 z 36"); only read with a jam. */
  jamHead?: string;
  fillText?: string;
}
export interface NoteSize { width: number; height: number; compactWidth: number; compactHeight: number }

/** The jam block's width: head line over the big countdown and the fill figure. */
function jamWidth(head: string, time: string, fill: string): number {
  return Math.max(104, Math.ceil(16 + Math.max(figureWidth(head, 12.5) + 4, besleyWidth(time, 22) + 8 + figureWidth(fill, 12.5))));
}
/** The jam countdown as the block prints it, "0:42". */
export const jamClock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Full and compact size of a note (px). */
export function noteSize(note: NoteShape): NoteSize {
  const px = namePx(note.hub);
  const fresh = note.fresh ? freshWidth(note.fresh) : 0;
  const nameRow = fresh + besleyWidth(note.name, px) + ROW_PAD * 2;
  const ticks = note.capacity > 0 ? Math.ceil(note.capacity / 2) : 0;
  const tickRow = ticks ? Math.ceil(ticks * tickPitch(ticks)) + ROW_PAD * 2 : 0;
  let glyphs = note.stubs + note.trend;
  for (const count of note.groups) glyphs += groupWidth(count);
  if (note.folded > 0) glyphs += figureWidth('+' + note.folded, 12.5) + 6;
  const glyphRow = glyphs > 0 ? glyphs + ROW_PAD * 2 : 0;
  const jam = note.jamSeconds !== null
    ? jamWidth(note.jamHead ?? '', jamClock(note.jamSeconds), note.fillText ?? '') : 0;
  const jamHeight = jam ? JAM_GAP + JAM_BLOCK : 0;
  const code = besleyWidth(note.code, 14) + ROW_PAD * 2;
  const second = note.fresh && !note.jamSeconds ? fresh : note.capacity > 0 ? figureWidth(note.fillText ?? '', 12.5) + 4 : 0;
  return {
    width: Math.max(nameRow, tickRow, glyphRow, jam),
    height: NAME_LINE + (ticks ? TICK_LINE : 0) + (glyphRow ? glyphSize() + 4 : 0) + jamHeight,
    compactWidth: Math.max(code + second, jam),
    compactHeight: NAME_LINE + jamHeight,
  };
}

/** The jam block's head ("Zator za" / "Jam in") from the catalogue until U5 adds its own key (the preview adds none). */
function jamHead(): string {
  const word = t('note.jam', { seconds: 0 }).split(/[,，]/)[0].trim();
  return `${word} ${t('dock.in', { when: '' }).trim()}`;
}

interface NoteParts {
  name: HTMLSpanElement; code: HTMLSpanElement; fill: HTMLSpanElement; ticks: SVGSVGElement; filled: SVGPathElement;
  empty: SVGPathElement; br: HTMLElement[]; counts: Map<string, HTMLSpanElement>; more: HTMLSpanElement;
  jam: HTMLSpanElement; jamHead: HTMLSpanElement; jamTime: HTMLSpanElement; jamFill: HTMLSpanElement;
  tickKey: string; size: NoteSize;
}
const noteParts = new WeakMap<HTMLElement, NoteParts>();
const SVG_NS = 'http://www.w3.org/2000/svg';

function noteState(bubble: HTMLElement): NoteParts {
  let parts = noteParts.get(bubble);
  if (!parts) {
    const span = (cls: string): HTMLSpanElement => {
      const el = document.createElement('span');
      el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      return el;
    };
    const ticks = document.createElementNS(SVG_NS, 'svg');
    ticks.setAttribute('class', 'lin-ticks');
    ticks.setAttribute('aria-hidden', 'true');
    ticks.setAttribute('focusable', 'false');
    const filled = document.createElementNS(SVG_NS, 'path');
    filled.setAttribute('class', 'lin-ticks__on');
    const empty = document.createElementNS(SVG_NS, 'path');
    empty.setAttribute('class', 'lin-ticks__off');
    ticks.append(filled, empty);
    const jam = span('lin-jam');
    const jamHeadEl = span('lin-jam__head');
    const jamTime = span('lin-jam__time');
    const jamFill = span('lin-jam__fill');
    jam.append(jamHeadEl, jamTime, jamFill);
    parts = {
      name: span('lin-name'), code: span('lin-code'), fill: span('lin-fill'), ticks, filled, empty,
      br: [span('lin-br'), span('lin-br'), span('lin-br')], counts: new Map(), more: span('lin-count lin-more airport-bubble__count'),
      jam, jamHead: jamHeadEl, jamTime, jamFill, tickKey: '', size: { width: 0, height: 0, compactWidth: 0, compactHeight: 0 },
    };
    noteParts.set(bubble, parts);
  }
  return parts;
}

/** The fill bar's two paths (filled ticks, empty ones as outlines), redrawn only when the fill changes. */
function drawTicks(parts: NoteParts, taken: number, capacity: number): void {
  const key = `${taken}/${capacity}`;
  if (parts.tickKey === key) return;
  parts.tickKey = key;
  const ticks = Math.ceil(capacity / 2), on = Math.ceil(Math.min(taken, capacity) / 2);
  const pitch = tickPitch(ticks), mark = Math.max(1.5, pitch - 1.5);
  let full = '', open = '';
  for (let i = 0; i < ticks; i++) {
    const x = +(i * pitch).toFixed(2);
    if (i < on) full += `M${x} 0h${mark}v8h${-mark}z`;
    else open += `M${+(x + .6).toFixed(2)} .6h${+(mark - 1.2).toFixed(2)}v6.8h${-(mark - 1.2).toFixed(2)}z`;
  }
  const width = Math.ceil(ticks * pitch);
  parts.ticks.setAttribute('viewBox', `0 0 ${width} 8`);
  parts.ticks.setAttribute('width', String(width));
  parts.ticks.setAttribute('height', '8');
  parts.filled.setAttribute('d', full || 'M0 0');
  parts.empty.setAttribute('d', open || 'M0 0');
}

/** What the overlay hands the note builder (its nodes are reused: the stubs, trend, timer and glyph pool are the entry's). */
export interface LinorytNoteInput {
  name: string; code: string; hub: boolean;
  waiting: readonly DestinationRegion[]; connecting: number; capacity: number; jamSeconds: number | null;
  /** The entry's NOWE stub (its text already set) or null. */
  fresh: HTMLElement | null;
  /** Curfew barrier, surge and front stubs shown in the glyph row, and their total width. */
  stubs: readonly Node[]; stubsWidth: number;
  /** The fill trend chevron (entry.trendUp/Down) or null, and its width. */
  trend: Node | null; trendWidth: number;
  timer: Node;
  /** Glyph groups beyond this width fold into "+N". */
  room: number;
  glyph: (region: DestinationRegion, hollow: boolean) => SVGSVGElement;
}

/**
 * Rewrites the note's child list in `want` (flat, so the overlay's diff and the e2e probes read it as before): the name
 * row (NOWE stub, name; code and fill for the compact form), the fill bar, the glyph row (stubs, one glyph per region
 * with its count, "+N", the trend chevron right after the last count, the hidden timer), the jam block. Returns the
 * note's size, also kept for linorytNoteSize().
 */
export function linorytNoteChildren(bubble: HTMLElement, want: Node[], input: LinorytNoteInput): NoteSize {
  const parts = noteState(bubble);
  want.length = 0;
  setText(parts.name, input.name);
  setText(parts.code, input.code);
  const taken = Math.min(input.waiting.length, input.capacity);
  const fillText = t('note.fill', { taken, capacity: input.capacity });
  setText(parts.fill, input.capacity > 0 ? fillText : '');
  parts.name.classList.toggle('lin-name--hub', input.hub);
  if (input.fresh) want.push(input.fresh);
  want.push(parts.name, parts.code, parts.fill, parts.br[0]);
  if (input.capacity > 0) {
    drawTicks(parts, taken, input.capacity);
    want.push(parts.ticks, parts.br[1]);
  }
  want.push(...input.stubs);
  // Glyph groups: each region once with how many wait for it, ready ones first, connecting ones hollow after them.
  const ready = input.waiting.length - Math.min(input.connecting, input.waiting.length);
  const groups = new Map<string, number>();
  input.waiting.forEach((region, i) => { const key = i < ready ? region : region + '~'; groups.set(key, (groups.get(key) ?? 0) + 1); });
  const counts: number[] = [];
  let used = input.stubsWidth + input.trendWidth;
  let folded = 0;
  for (const [key, count] of groups) {
    const cost = groupWidth(count);
    if (folded > 0 || (counts.length > 0 && used + cost > input.room)) { folded += count; continue; }
    used += cost;
    counts.push(count);
    const hollow = key.endsWith('~');
    want.push(input.glyph((hollow ? key.slice(0, -1) : key) as DestinationRegion, hollow));
    let span = parts.counts.get(key);
    if (!span) {
      span = document.createElement('span');
      span.className = 'lin-count airport-bubble__count';
      span.setAttribute('aria-hidden', 'true');
      parts.counts.set(key, span);
    }
    setText(span, String(count));
    want.push(span);
  }
  if (folded > 0) {
    setText(parts.more, '+' + folded);
    want.push(parts.more);
  }
  if (input.trend && input.waiting.length > 0) want.push(input.trend);
  want.push(input.timer);
  const head = jamHead();
  if (input.jamSeconds !== null) {
    setText(parts.jamHead, head);
    setText(parts.jamTime, jamClock(input.jamSeconds));
    setText(parts.jamFill, input.capacity > 0 ? fillText : '');
    want.push(parts.br[2], parts.jam);
  }
  const size = noteSize({
    name: input.name, code: input.code, hub: input.hub, capacity: input.capacity, taken, groups: counts, folded,
    stubs: input.stubsWidth, trend: input.trend && input.waiting.length > 0 ? input.trendWidth : 0,
    fresh: input.fresh ? input.fresh.textContent ?? '' : null, jamSeconds: input.jamSeconds, jamHead: head, fillText,
  });
  parts.size = size;
  // The paper rows are as wide as the note (a printed label), the jam block keeps its own width.
  bubble.style.width = size.width + 'px';
  bubble.style.setProperty('--lin-compact-w', size.compactWidth + 'px');
  bubble.style.setProperty('--lin-jam-w', (input.jamSeconds !== null ? jamWidth(head, jamClock(input.jamSeconds), input.capacity > 0 ? fillText : '') : 0) + 'px');
  return size;
}
/** The note's size from its last rebuild (zero before the first). */
export function linorytNoteSize(bubble: HTMLElement): NoteSize {
  return noteParts.get(bubble)?.size ?? { width: 0, height: 0, compactWidth: 0, compactHeight: 0 };
}

// ---- U2: frame state (priority, the busiest hub, stamps) ------------------------------------------------------------

/** One airport's layout state in the preview, kept beside the overlay's tag (no new field on the shipped entry). */
interface NoteFrame {
  stamp: TagSlot; box: StampBox; hub: boolean;
  /** The compact form's box (code and fill on one line, the slot tag under it) and whether this frame placed it. */
  compactWidth: number; compactHeight: number; compact: boolean;
}
const frames = new WeakMap<TagSlot, NoteFrame>();
/** The stamp obstacle of a note's airport (created once; the overlay adds it to its layout slots). */
export function linorytStampSlot(tag: TagSlot): TagSlot {
  let frame = frames.get(tag);
  if (!frame) {
    frame = {
      stamp: { id: tag.id + '~stamp', anchorX: 0, anchorY: 0, width: 0, height: 0, active: false, jammed: false, fixed: true, ring: true,
        x: 0, y: 0, placed: false },
      box: { x: 0, y: 0, half: 0, visible: false }, hub: false, compactWidth: 0, compactHeight: NAME_LINE, compact: false,
    };
    frames.set(tag, frame);
  }
  return frame.stamp;
}
/** The reused stamp box of a note (filled by AirportOverlayOptions.projectAirport, else linorytStampFallback). */
export function linorytStampBox(tag: TagSlot): StampBox { linorytStampSlot(tag); return frames.get(tag)!.box; }

let busiest: TagSlot | null = null;
/** The top margin as a fixed obstacle of the note layout, one per overlay host (active where it is a corner block). */
const marginSlots = new WeakMap<HTMLElement, TagSlot>();
export function linorytMarginSlot(host: HTMLElement): TagSlot {
  let slot = marginSlots.get(host);
  if (!slot) {
    slot = { id: 'margin~', anchorX: 0, anchorY: 0, width: 0, height: 0, active: false, jammed: false, fixed: true, rank: Infinity,
      x: 0, y: 0, placed: false };
    marginSlots.set(host, slot);
  }
  return slot;
}
/**
 * Starts a frame of the note layout: the busiest hub is chosen anew, and the HUD's paper margins bound the notes and
 * the edge chips (they are taller than the shipped HUD's bands the session reserves). Portrait: notes and chips between
 * the top margin and the dock. Landscape (the dock a column on the right): notes left of the dock and off the top
 * margin's corner block, chips under the top margin and left of the dock.
 */
export function linorytFrameStart(host: HTMLElement, width: number, height: number, bounds: TagBounds, edge: EdgeBounds): void {
  busiest = null;
  const m = linorytMargins(host);
  const slot = linorytMarginSlot(host);
  slot.active = false;
  if (!m) return;
  edge.top = Math.max(0, m.top);
  if (m.column) {
    bounds.top = 0;
    bounds.bottom = 0;
    bounds.width = Math.max(120, Math.min(width, m.dockLeft));
    edge.bottom = 0;
    edge.right = Math.max(0, width - m.dockLeft);
    if (m.pass) {
      slot.active = true;
      slot.x = m.pass.l;
      slot.y = m.pass.t;
      slot.width = m.pass.r - m.pass.l;
      slot.height = m.pass.b - m.pass.t;
    }
  } else {
    bounds.top = Math.max(0, m.top);
    bounds.bottom = Math.max(0, height - m.dockTop);
    edge.bottom = bounds.bottom;
    edge.right = 0;
  }
}

export interface NoteFrameInput {
  code: string; hub: boolean; jam: boolean; fresh: boolean; fill: number;
  /** Note sizes (full in tag.width/height already; compact here) and the layout's view width. */
  size: NoteSize; viewWidth: number;
  /** D-268: the open hub board's box (null while closed): a note whose stamp it covers steps back. */
  board?: { readonly l: number; readonly t: number; readonly r: number; readonly b: number } | null;
}
/** D-268: the board covers the stamp (its disc, with a 2 px margin): the airport's note steps back while it is open. */
export function linorytBoardCovers(stamp: StampBox, hub: boolean, board: { l: number; t: number; r: number; b: number }): boolean {
  const reach = stampReach(stamp.half, hub) + 2;
  const dx = Math.max(board.l - stamp.x, 0, stamp.x - board.r), dy = Math.max(board.t - stamp.y, 0, stamp.y - board.b);
  return dx * dx + dy * dy < reach * reach;
}
/**
 * One airport's note for this frame: the stamp obstacle, the note's places round the stamp, its priority and compact
 * form, whether it must show. `tag.active` (the overlay's: in view, off the board, something to show) is kept; a note
 * whose stamp is not drawn steps back.
 */
export function linorytNoteFrame(tag: TagSlot, input: NoteFrameInput): void {
  linorytStampSlot(tag);
  const frame = frames.get(tag)!;
  const rank = linorytRank(input);
  frame.hub = input.hub;
  frame.compactWidth = Math.max(input.size.compactWidth, 30);
  frame.compactHeight = input.size.compactHeight + Math.max(0, tag.height - input.size.height); // + the slot tag
  frame.compact = false;
  linorytStampObstacle(frame.stamp, frame.box, input.hub, input.code, rank);
  if (!frame.box.visible || (input.board && linorytBoardCovers(frame.box, input.hub, input.board))) tag.active = false;
  tag.rank = rank;
  tag.must = linorytNoteMust(input);
  tag.compactWidth = undefined; // the compact form is laid out by linorytCompactPasses (it is lower, not only narrower)
  linorytNotePlaces(tag, frame.box, input.hub, input.jam, input.code, input.viewWidth);
  if (input.hub && tag.active && (!busiest || (tag.rank ?? 0) > (busiest.rank ?? 0))) busiest = tag;
}
/** Ends the frame's setup: the busiest hub in view always shows at least its code and fill (D-262). */
export function linorytFrameEnd(): void { if (busiest) busiest.must = true; }

/**
 * D-262 compact form, after the layout: the Linoryt note's compact form is one line, so it is lower as well as narrower
 * than the full note, which layoutTags' own compact try (narrower, same height) cannot use. Every active note the layout
 * left unplaced turns compact (code and fill, or code and NOWE; a jam keeps its block) and the layout runs again, so in
 * priority order each note takes its full form where it fits and its compact form where only that fits, before it hides
 * (D-262/D-281: the busiest hub's and a new airport's note too). A note a compact one displaced gets its own compact try
 * in the next run; at most three runs. Allocation-free; `layout` is the overlay's layoutTags (no runtime import here).
 */
export function linorytCompactPasses(slots: readonly TagSlot[], bounds: TagBounds,
  layout: (slots: readonly TagSlot[], bounds: TagBounds) => number): void {
  for (let run = 0; run < 3; run++) {
    let changed = false;
    for (const slot of slots) {
      const frame = slot.fixed ? undefined : frames.get(slot);
      if (!frame || frame.compact || !slot.active || slot.placed) continue;
      frame.compact = true;
      slot.width = frame.compactWidth;
      slot.height = frame.compactHeight;
      changed = true;
    }
    if (!changed) break;
    layout(slots, bounds);
  }
  for (const slot of slots) {
    const frame = slot.fixed ? undefined : frames.get(slot);
    if (frame) slot.compact = frame.compact && slot.placed;
  }
}

const markerList: StampBox[] = [];
/** The stamps of the overlay's airports (parallel to its tags): where the edge chips must not lie (placeSizedEdgeChips). */
export function linorytMarkers(tags: readonly TagSlot[]): readonly StampBox[] {
  markerList.length = tags.length;
  for (let i = 0; i < tags.length; i++) markerList[i] = linorytStampBox(tags[i]);
  return markerList;
}

/** One stamp as the DEV probe reports it (page coordinates of the overlay layer, px). */
export interface StampProbe { id: string; x: number; y: number; half: number; hub: boolean; visible: boolean }
/**
 * DEV probe for the browser audits (e2e/screen-audit.mjs, the U2 shots): `window.__awLinoryt.stamps()` lists where the
 * notes' layout put each stamp this frame, so the audit checks the printed notes against the same stamps.
 */
export function linorytProbe(stamps: () => StampProbe[]): void {
  (globalThis as { __awLinoryt?: { stamps: () => StampProbe[] } }).__awLinoryt = { stamps };
}
/** The stamp of a note's airport as the probe reports it. */
export function linorytStampProbe(tag: TagSlot): StampProbe {
  const frame = frames.get(tag);
  const box = frame?.box ?? { x: 0, y: 0, half: 0, visible: false };
  return { id: tag.id, x: box.x, y: box.y, half: box.half, hub: frame?.hub ?? false, visible: box.visible };
}

// ---- U2: the paper margins as layout bounds ---------------------------------------------------------------------------

/** The HUD's paper margins in the overlay's coordinates, re-measured only when they change size (ResizeObserver). */
export interface LinorytMargins {
  /** Bottom of the top margin; top of the bottom dock (portrait) or left of the dock column (landscape), px. */
  top: number; dockTop: number; dockLeft: number;
  /** The top margin's box (in landscape a block in the top-left corner). */
  pass: { l: number; t: number; r: number; b: number } | null;
  column: boolean;
}
const margins = new WeakMap<HTMLElement, { value: LinorytMargins; observer: ResizeObserver | null; pass: Element | null; dock: Element | null }>();
/** The paper margins of the HUD mounted in `host` (null until both are there). Reads layout only after a resize. */
export function linorytMargins(host: HTMLElement): LinorytMargins | null {
  let entry = margins.get(host);
  const pass = host.querySelector('.airway-pass');
  const dock = host.querySelector('.airway-dock');
  if (!pass || !dock) return null;
  if (!entry || entry.pass !== pass || entry.dock !== dock) {
    entry?.observer?.disconnect();
    const value: LinorytMargins = { top: 0, dockTop: 0, dockLeft: 0, pass: null, column: false };
    const measure = (): void => {
      const origin = host.getBoundingClientRect();
      const p = pass.getBoundingClientRect(), d = dock.getBoundingClientRect();
      value.column = d.height > d.width;
      value.top = p.bottom - origin.top;
      value.pass = { l: p.left - origin.left, t: p.top - origin.top, r: p.right - origin.left, b: p.bottom - origin.top };
      value.dockTop = d.top - origin.top;
      value.dockLeft = d.left - origin.left;
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(pass);
    observer?.observe(dock);
    observer?.observe(host);
    measure();
    entry = { value, observer, pass, dock };
    margins.set(host, entry);
  }
  return entry.value;
}

// ---- U2: edge chips ----------------------------------------------------------------------------------------------------

const EARTH_KM = 6371;
/** Edge chip (frame "Karaczi → / 2 408 km · 8 z 12"): its smallest and largest width, px; height stays 48. */
const EDGE_MIN = 58;
const EDGE_MAX = 136;
/**
 * Prints an off-screen airport's chip: the city name in Besley with the arrow, under it the great-circle distance from
 * the view centre and the fill ("2 408 km · 8 z 12"). The code stays the chip's text node (its accessible name and the
 * e2e probes read it); linoryt.css prints the name and the line from data attributes. A name too long for the chip
 * gives way to the code. Returns the chip's width.
 */
export function linorytEdge(edge: HTMLElement, name: string, code: string, normal: { x: number; y: number; z: number },
  camera: { x: number; y: number; z: number }, taken: number, capacity: number): number {
  const length = Math.hypot(camera.x, camera.y, camera.z) || 1;
  const cos = Math.max(-1, Math.min(1, (normal.x * camera.x + normal.y * camera.y + normal.z * camera.z) / length));
  const km = t('upgrade.value.km', { km: deps.localNumber(Math.round(Math.acos(cos) * EARTH_KM / 10) * 10) });
  const line = capacity > 0 && taken > 0 ? `${km} · ${t('note.fill', { taken, capacity })}` : km;
  const second = figureWidth(line, 11.5);
  let title = name;
  let width = 18 + Math.max(besleyWidth(title, 14) + 16, second);
  if (width > EDGE_MAX && title !== code) { title = code; width = 18 + Math.max(besleyWidth(title, 14) + 16, second); }
  width = Math.min(EDGE_MAX, Math.max(EDGE_MIN, width));
  if (edge.dataset.linName !== title) edge.dataset.linName = title;
  if (edge.dataset.linLine !== line) edge.dataset.linLine = line;
  const w = width + 'px';
  if (edge.style.width !== w) edge.style.width = w;
  return width;
}

// ---- Menu ------------------------------------------------------------------------------------------------------------

/** The tagline under the title ("Sieć lotnicza na całym globie"). */
export function linorytTagline(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'lin-tagline';
  line.textContent = t('menu.tagline');
  return line;
}


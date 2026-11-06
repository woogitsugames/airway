/**
 * [night-11az] D-257: the "Róża" skin helpers (KARTA v2, variant C, docs/styles/ui-2026-11/KARTA-V2.md; the owner's
 * pick of 2026-11-05). One shape carries the game: every airport is a small compass rose whose ticks are its waiting
 * places (long = taken) with the city name set along the ring; the HUD is one rose in the thumb corner — a 24-hour dial
 * (night hatched, a heading bug for "now", the time and "day 2 of 3" inside) with the dock laid out on an arc around
 * it; a jam is the only vermilion, with a heavy countdown arc around the rose. src/main.ts turns this on in every
 * build; only a DEV build with `?skin=current` leaves it off to show the previous "Diorama" skin for comparison.
 *
 * The 3D airport medallion stays the renderer's (src/render/**, ext session); the overlay rose is drawn around it at the
 * airport's screen position, sized from the medallion's footprint (MEDAL_RADIUS). What the ext session should change
 * so the medallion becomes the rose's centre (runway pattern, hub double ring) is in docs/notes/roza-render-spec.md.
 *
 * This module has no runtime imports (only types): src/main.ts hands in what it needs (RozaDeps), which keeps the
 * module graph (and the release bundle order) as it was. Every helper is called only from a branch guarded by
 * `skin.roza`. All player text comes from the catalogs (`roza.*` keys with length budgets, src/i18n/limits.ts).
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { DestinationRegion } from '../glyphs';
import type { TagSlot } from '../overlay-layout';

export const skin = { roza: false };

/** What the helpers need from the rest of the app, handed in by src/main.ts. */
export interface RozaDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** CONGESTION_GRACE_TICKS / SIM_TICKS_PER_SECOND: the jam countdown's full length in seconds. */
  jamGraceSeconds: number;
}
let deps: RozaDeps = { t: (key) => key, localNumber: String, jamGraceSeconds: 45 };
const t: RozaDeps['t'] = (key, params) => deps.t(key, params);

/** Turns the skin on: <html data-skin="roza"> scopes roza.css (call before the HUD and overlay are mounted). */
export function startRoza(next: RozaDeps): void {
  deps = next;
  skin.roza = true;
  document.documentElement.dataset.skin = 'roza';
}

const SVG = 'http://www.w3.org/2000/svg';
/** Inks of the drawn rose (SVG attributes; roza.css holds the same values for HTML). Chalk on a dark halo over the
 *  photo; vermilion only for a jam (docs/notes/roza-contrast.md: #F2603F, 5.8:1 on the halo); dim = chalk at 62 %. */
const CHALK = '#F5F2EA';
const HALO = '#0C1418';
const RED = '#F2603F';
const DIM = '#9C9E9A';
const DEG = Math.PI / 180;

function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
const f1 = (n: number): string => n.toFixed(1);

// ---- HUD: week line, passengers, day dial ---------------------------------------------------------------------------

interface PassLines { week: HTMLElement; passengers: HTMLElement }
const passLines = new WeakMap<HTMLElement, PassLines>();
/** The week and passenger lines on the sky (top-left corner); landscape adds the day to the week line. */
export function rozaPass(section: HTMLElement, week: number, day: number, days: number, passengers: number, landscape: boolean): void {
  let lines = passLines.get(section);
  if (!lines) {
    const box = document.createElement('div');
    box.className = 'roza-pass';
    const w = document.createElement('div');
    w.className = 'roza-pass__week';
    const p = document.createElement('div');
    p.className = 'roza-pass__passengers';
    box.append(w, p);
    section.querySelector('.airway-pass__ticket')?.appendChild(box);
    lines = { week: w, passengers: p };
    passLines.set(section, lines);
  }
  setText(lines.week, landscape ? t('roza.weekDay', { week, day, days }) : t('roza.week', { week }));
  setText(lines.passengers, t('roza.passengers', { count: passengers }).replace(String(passengers), deps.localNumber(passengers)));
}

export interface RozaDial { readonly element: HTMLElement; render(minute: number, day: number, days: number): void }
/**
 * The day dial: a 24-hour ring (0 at the top, 6 on the right), night 20:00–06:00 hatched inside it, a tick per hour and
 * a long one every 6 h with its figure, a heading bug outside the ring for "now", and the time with "day 2 of 3" in the
 * middle. Drawn once; a render turns the bug and rewrites the two lines. 120 × 120 viewBox, roza.css sizes it.
 */
export function rozaDial(root: HTMLElement): RozaDial {
  const element = document.createElement('div');
  element.className = 'roza-dial';
  element.setAttribute('role', 'img');
  const R = 46;
  let s = '';
  for (let h = 20; h < 30; h += 0.5) {
    const a = (-90 + ((h % 24) / 24) * 360) * DEG;
    const d = `M${f1(Math.cos(a) * (R - 10))} ${f1(Math.sin(a) * (R - 10))}L${f1(Math.cos(a + .08) * R)} ${f1(Math.sin(a + .08) * R)}`;
    s += `<path d="${d}" class="roza-dial__halo" stroke-width="3"/><path d="${d}" class="roza-dial__dim" stroke-width="1.1"/>`;
  }
  s += `<circle r="${R}" class="roza-dial__halo" stroke-width="4" fill="none"/><circle r="${R}" class="roza-dial__ink" stroke-width="1.6" fill="none"/>`;
  for (let h = 0; h < 24; h++) {
    const a = (-90 + (h / 24) * 360) * DEG, l = h % 6 ? 5 : 10;
    const d = `M${f1(Math.cos(a) * R)} ${f1(Math.sin(a) * R)}L${f1(Math.cos(a) * (R - l))} ${f1(Math.sin(a) * (R - l))}`;
    s += `<path d="${d}" class="roza-dial__halo" stroke-width="${h % 6 ? 3.2 : 4.4}"/><path d="${d}" class="roza-dial__ink" stroke-width="${h % 6 ? 1.2 : 2.2}"/>`;
  }
  for (const h of [0, 6, 12, 18]) {
    const a = (-90 + (h / 24) * 360) * DEG;
    s += `<text class="roza-dial__hour" x="${f1(Math.cos(a) * (R - 15))}" y="${f1(Math.sin(a) * (R - 15) + 3.5)}">${h}</text>`;
  }
  s += '<g class="roza-dial__bug"><path d="M-7-55h14l-7 9z"/></g>';
  s += '<text class="roza-dial__time" y="5"></text><text class="roza-dial__day" y="18"></text>';
  element.innerHTML = `<svg viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">${s}</svg>`;
  root.appendChild(element);
  const bug = element.querySelector('.roza-dial__bug') as SVGGElement;
  const time = element.querySelector('.roza-dial__time') as SVGTextElement;
  const dayLine = element.querySelector('.roza-dial__day') as SVGTextElement;
  let lastMinute = -1;
  return {
    element,
    render(minute, day, days): void {
      const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      setText(time, clock);
      setText(dayLine, t('roza.dayOf', { day, days }));
      const label = t('roza.dial', { time: clock, day, days });
      if (element.getAttribute('aria-label') !== label) element.setAttribute('aria-label', label);
      if (minute !== lastMinute) {
        lastMinute = minute;
        bug.setAttribute('transform', `rotate(${f1((minute / 1440) * 360)})`);
      }
    },
  };
}

/**
 * The caption beside a symbol on the dock arc (roza.css places it outside the arc), and the wait for the next crates on
 * an empty aircraft or hub symbol ("za 1 dzień"). Captions repeat the button's accessible name, so they are aria-hidden.
 */
export function rozaDockLabel(button: HTMLElement, name: string, globeMode: string | undefined, speed: number, wait: string | null): void {
  const text = wait !== null ? t('roza.dock.in', { when: wait })
    : name === 'undo' ? t('roza.dock.undo')
    : name === 'turboprop' ? t('roza.dock.turboprop')
    : name === 'widebody' ? t('roza.dock.widebody')
    : name === 'hub' ? t('roza.dock.hub')
    : name === 'globe' ? t(globeMode === 'map' ? 'roza.dock.map' : 'roza.dock.satellite')
    : t('roza.dock.speed', { speed });
  let span = button.querySelector<HTMLElement>('.roza-caption');
  if (!span) {
    span = document.createElement('span');
    span.className = 'roza-caption';
    span.setAttribute('aria-hidden', 'true');
    button.appendChild(span);
  }
  setText(span, text);
}

// ---- Airport note (the label beside the rose) ------------------------------------------------------------------------

/** Atkinson Hyperlegible Next 700 figures (~0.6 em): occupancy 14.5 px, counts 13.5 px; a glyph 16 px + its margin. */
const FILL_CHAR = 8.2;
const COUNT_DIGIT = 7.8;
const GLYPH = 18;

interface NoteState { fill: HTMLSpanElement; more: HTMLSpanElement; jam: HTMLSpanElement; counts: Map<string, HTMLSpanElement>; extra: number; jamWidth: number; fillWidth: number }
const notes = new WeakMap<HTMLElement, NoteState>();
function noteState(bubble: HTMLElement): NoteState {
  let state = notes.get(bubble);
  if (!state) {
    const span = (cls: string): HTMLSpanElement => {
      const el = document.createElement('span');
      el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      return el;
    };
    state = { fill: span('roza-fill'), more: span('roza-count roza-more'), jam: span('roza-jam'), counts: new Map(), extra: 0, jamWidth: 0, fillWidth: 0 };
    notes.set(bubble, state);
  }
  return state;
}

/**
 * Rewrites the note's child list: code, "14 z 24", then each region once with how many wait for it (ready ones first,
 * connecting ones hollow after them), as the mockup groups them; a jam adds the countdown sentence as a second line.
 * The single glyphs and the "+N" overflow of the old tag are dropped. `removed` is the width of the glyph row it
 * replaced; the width difference is handed to the tag layout through rozaExtraWidth().
 */
export function rozaNoteChildren(bubble: HTMLElement, want: Node[], plate: Node | null, waiting: readonly DestinationRegion[],
  connecting: number, capacity: number, removed: number, room: number, jamSeconds: number | null,
  glyph: (region: DestinationRegion, hollow: boolean) => SVGSVGElement): void {
  const state = noteState(bubble);
  const kept = want.filter((node) => !(node instanceof SVGSVGElement) && !(node as Element).classList.contains('airport-bubble__count'));
  // The fill trend follows the occupancy figure ("ATH 14 z 24 ▲"), as on the mockup.
  const trendAt = kept.findIndex((node) => (node as Element).classList.contains('airport-bubble__trend'));
  const trend = trendAt >= 0 && plate && capacity > 0 ? kept.splice(trendAt, 1)[0] : null;
  const at = plate ? kept.indexOf(plate) + 1 : 0;
  const added: Node[] = [];
  let width = -removed;
  const taken = Math.min(waiting.length, capacity);
  state.fillWidth = 0;
  if (capacity > 0 && plate) {
    const text = t('roza.fill', { taken, capacity });
    setText(state.fill, text);
    added.push(state.fill);
    width += 2 + 5 + text.length * FILL_CHAR;
    state.fillWidth = 3 + 3 + text.length * FILL_CHAR;
    if (trend) added.push(trend);
  }
  const ready = waiting.length - Math.min(connecting, waiting.length);
  const groups = new Map<string, number>();
  waiting.forEach((region, i) => { const key = i < ready ? region : region + '~'; groups.set(key, (groups.get(key) ?? 0) + 1); });
  let folded = 0;
  let used = 0;
  for (const [key, count] of groups) {
    const cost = GLYPH + 8 + String(count).length * COUNT_DIGIT;
    if (folded > 0 || used + cost > room) { folded += count; continue; }
    used += cost;
    const hollow = key.endsWith('~');
    added.push(glyph((hollow ? key.slice(0, -1) : key) as DestinationRegion, hollow));
    let span = state.counts.get(key);
    if (!span) {
      span = document.createElement('span');
      span.className = 'roza-count';
      span.setAttribute('aria-hidden', 'true');
      state.counts.set(key, span);
    }
    setText(span, String(count));
    added.push(span);
    width += cost;
  }
  if (folded > 0) {
    const text = '+' + folded;
    setText(state.more, text);
    added.push(state.more);
    width += 2 + 6 + text.length * COUNT_DIGIT;
  }
  state.jamWidth = 0;
  if (jamSeconds !== null) {
    const text = t('roza.jam', { seconds: Math.max(0, Math.ceil(jamSeconds)) });
    setText(state.jam, text);
    added.push(state.jam);
    state.jamWidth = Math.ceil(text.length * 7.8 + 10);
    width -= 53; // the inline timer the old tag reserved is hidden (the sentence says it)
  }
  kept.splice(at, 0, ...added);
  want.length = 0;
  want.push(...kept);
  state.extra = Math.ceil(width);
}

/** Width the note adds to the label over the old glyph row (see rozaNoteChildren). */
export function rozaExtraWidth(bubble: HTMLElement): number { return notes.get(bubble)?.extra ?? 0; }
/** Width of the jam line under the note (0 without a jam); the note's layout box is at least this wide. */
export function rozaJamWidth(bubble: HTMLElement): number { return notes.get(bubble)?.jamWidth ?? 0; }
/** Code plate: Atkinson Hyperlegible Next 700 at 14.5 px, ~0.62 em a letter (roza.css .airport-bubble__plate). */
const PLATE_CHAR = 9;
/**
 * [night-16a] D-262: the width of the note's compact form, code and "14 z 24" only (roza.css .airport-bubble--compact),
 * tried where the full note does not fit before it hides; a jam keeps its sentence line under it.
 */
export function rozaCompactWidth(bubble: HTMLElement, code: string): number {
  const state = notes.get(bubble);
  return Math.ceil(Math.max(2 + code.length * PLATE_CHAR + (state?.fillWidth ?? 0) + 4, state?.jamWidth ?? 0));
}
/** Height the jam line adds under the note (roza.css: an 18 px line). */
export const ROZA_JAM_LINE = 18;

const EARTH_KM = 6371;
/**
 * The note of an off-screen airport: great-circle distance from the point under the view centre to the airport,
 * "1 790 km", rounded to 10 km; `side` lets roza.css keep it on screen.
 */
export function rozaEdgeNote(edge: HTMLElement, normal: { x: number; y: number; z: number },
  camera: { x: number; y: number; z: number }, side: number): void {
  const length = Math.hypot(camera.x, camera.y, camera.z) || 1;
  const cos = Math.max(-1, Math.min(1, (normal.x * camera.x + normal.y * camera.y + normal.z * camera.z) / length));
  const text = t('upgrade.value.km', { km: deps.localNumber(Math.round(Math.acos(cos) * EARTH_KM / 10) * 10) });
  if (edge.dataset.rozaKm !== text) edge.dataset.rozaKm = text;
  if (edge.dataset.rozaSide !== String(side)) edge.dataset.rozaSide = String(side);
}

/** Hides an edge note that would cover an airport note: a note, a jam above all, always wins over the distance. */
export function rozaEdgeClash(edge: HTMLElement, chip: { x: number; y: number; side: number },
  tags: readonly { x: number; y: number; width: number; height: number; placed: boolean }[]): void {
  const w = (edge.dataset.rozaKm ?? '').length * 6.8 + 4;
  const x = chip.side === 0 ? chip.x : chip.side === 1 ? chip.x + 58 - w : chip.x + 29 - w / 2;
  const y = chip.side === 3 ? chip.y - 17 : chip.y + 51;
  const clash = tags.some((tag) => tag.placed && tag.width > 0 && x < tag.x + tag.width && x + w > tag.x && y < tag.y + tag.height && y + 14 > tag.y);
  if ((edge.dataset.rozaClash === '1') !== clash) edge.dataset.rozaClash = clash ? '1' : '';
}

/** Share of the jam grace still left (1 = just jammed, 0 = the network closes), for the countdown arc. */
export function rozaJamShare(seconds: number | null): number | null {
  return seconds === null ? null : Math.max(0, Math.min(1, seconds / deps.jamGraceSeconds));
}

// ---- Airport rose (around the renderer's medallion) ------------------------------------------------------------------

/**
 * Angular radius (radians of the unit globe) of the renderer's airport medallion at the gameplay zoom: the dark
 * outline disc of the `medal` style (src/render/airports.ts: 0.038 × 1.2 for an airport, × 1.7 for a hub). Read-only
 * knowledge of the renderer; the overlay projects it to find the rose's inner radius on screen.
 */
export const MEDAL_RADIUS = { airport: 0.038 * 1.2, hub: 0.038 * 1.7 } as const;
/** At most this many ticks around one rose; a larger waiting area folds 2–3 places into one tick (KARTA-V2, risks). */
const MAX_TICKS = 24;

export interface RoseState {
  cap: number; taken: number; hub: boolean; jam: number | null; name: string;
  /** [night-16a] D-262: the name runs along the bottom of the ring (its top is taken by a neighbour). */
  below?: boolean;
}
export interface Rose {
  readonly element: SVGSVGElement;
  /** Redraws when the state or the radius bucket changed; returns quickly otherwise. */
  draw(state: RoseState, radius: number): void;
  place(x: number, y: number, visible: boolean): void;
}
let roseId = 0;

/**
 * The radius of the name's path round a rose of inner radius `r` and the name's font size (shared by draw and layout).
 * [night-16a] D-262: along the bottom the letters stand inward of the path, so that path runs one cap height further out.
 */
function roseNameMetrics(r: number, hub: boolean, jam: boolean, name: string, below = false): { R: number; size: number } {
  const R0 = r + (jam ? 22 : hub ? 13 : 11);
  const size = Math.min(jam ? 15 : 13.5, (Math.PI * 1.5 * R0) / Math.max(1, name.length * .62));
  return { R: below ? R0 + size * .75 : R0, size };
}

/**
 * What a rose shows along its ring: the city name, the IATA code (a short name for a crowded spot) or nothing;
 * [night-16a] D-262: `-below` sets it along the bottom of the ring when the top is taken.
 */
export type RoseLabelMode = 'name' | 'code' | 'name-below' | 'code-below' | 'none';
/** The text a mode shows ('' for none). */
export const roseLabelText = (label: Pick<RoseLabel, 'name' | 'code'>, mode: RoseLabelMode | undefined): string =>
  mode === 'name' || mode === 'name-below' ? label.name : mode === 'code' || mode === 'code-below' ? label.code : '';
export const roseLabelBelow = (mode: RoseLabelMode | undefined): boolean => mode === 'name-below' || mode === 'code-below';
export interface RoseLabel {
  x: number; y: number;
  /** The rose's inner radius on screen (px), as handed to Rose.draw. */
  r: number;
  hub: boolean; jam: boolean;
  /** Waiting share 0–1: a fuller airport keeps its name first. */
  fill: number;
  name: string; code: string;
  /** What it showed last frame: it keeps that with a little less clearance, so names do not flicker while panning. */
  last?: RoseLabelMode;
}
export interface Box { l: number; t: number; r: number; b: number }

/**
 * The screen box of a name set along the top of a rose (centred on twelve o'clock, as Rose.draw sets it), or along its
 * bottom (centred on six o'clock) with `below`.
 */
export function roseNameBox(label: Pick<RoseLabel, 'x' | 'y' | 'r' | 'hub' | 'jam'>, text: string, below = false): Box {
  const r = Math.max(8, Math.round(label.r * 2) / 2);
  const { R, size } = roseNameMetrics(r, label.hub, label.jam, text, below);
  // Half the angle the text spans on its path (the draw budget is .62 em a letter), at most the path's 135°.
  const half = Math.min(135 * DEG, (text.length * .62 * size) / (2 * R));
  // On top the letters stand outward of the path; along the bottom they stand inward and the descenders hang out.
  const outer = below ? R + size * .3 : R + size * .8;
  const inner = below ? R - size * .8 : R - size * .3;
  const w = half >= 90 * DEG ? outer : Math.sin(half) * outer;
  if (below) return { l: label.x - w, r: label.x + w, t: label.y + Math.cos(half) * inner, b: label.y + outer };
  return { l: label.x - w, r: label.x + w, t: label.y - outer, b: label.y - Math.cos(half) * inner };
}

/** Half the size of a rose's ring of ticks (and of a jam's countdown arc) around its centre, px. */
export const roseRingHalf = (label: Pick<RoseLabel, 'r' | 'jam'>): number => Math.max(8, label.r) + (label.jam ? 20 : 9);

/**
 * [night-16a] D-262: the screen box a rose takes with what it shows this frame (its ring, and its name on top or along
 * the bottom), for the note layout's fixed obstacle; a rose without a name is only its ring.
 */
export function roseBox(label: RoseLabel, mode: RoseLabelMode | undefined): Box {
  const half = roseRingHalf(label);
  const box = { l: label.x - half, t: label.y - half, r: label.x + half, b: label.y + half };
  const text = roseLabelText(label, mode);
  if (!text) return box;
  const name = roseNameBox(label, text, roseLabelBelow(mode));
  return { l: Math.min(box.l, name.l), t: Math.min(box.t, name.t), r: Math.max(box.r, name.r), b: Math.max(box.b, name.b) };
}

const hits = (a: Box, b: Box, pad: number): boolean =>
  a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
const hitsDisc = (a: Box, x: number, y: number, radius: number, pad: number): boolean => {
  const dx = Math.max(a.l - x, 0, x - a.r), dy = Math.max(a.t - y, 0, y - a.b);
  return dx * dx + dy * dy < (radius + pad) * (radius + pad);
};

/**
 * Priority of a rose's labels (D-262): a jam, then a hub, then the fuller airport; the higher one is laid out first and
 * so takes the room a lower one wanted. Shared by the names (rozaNameLayout) and the notes (the overlay's tag rank).
 */
export const roseRank = (label: Pick<RoseLabel, 'jam' | 'hub' | 'fill'>): number =>
  (label.jam ? 4 : 0) + (label.hub ? 2 : 0) + Math.max(0, Math.min(1, label.fill));

/**
 * Name collisions in a dense cluster at close zoom (D-259, D-262): each rose keeps its name only where it clears every
 * name already placed and every other rose's ring of ticks. It tries the name on top of the ring, then along its
 * bottom, then the IATA code on top and along the bottom, else no name (the note beside the rose still reads the
 * code). Priority (roseRank): a jam, a hub, the fuller airport, then list order; a higher-priority rose is placed
 * first, so it displaces the lower ones. A label a rose already showed needs 3 px less clearance, so labels do not
 * flicker. [night-21a] D-268: no name is set over a `blocked` box (the open hub board); it tries the next form or hides.
 */
export function rozaNameLayout(labels: readonly RoseLabel[], blocked: readonly Box[] = []): RoseLabelMode[] {
  const order = labels.map((_, i) => i).sort((a, b) => roseRank(labels[b]) - roseRank(labels[a]) || a - b);
  // [night-21a] D-268: `blocked` boxes (the open hub board) take their room before any name.
  const placed: Box[] = [...blocked];
  const out: RoseLabelMode[] = labels.map(() => 'none');
  for (const i of order) {
    const label = labels[i];
    const fits = (mode: RoseLabelMode): Box | null => {
      const text = roseLabelText(label, mode);
      if (!text) return null;
      const box = roseNameBox(label, text, roseLabelBelow(mode));
      const pad = label.last === mode ? 0 : 3;
      if (placed.some((other) => hits(box, other, pad))) return null;
      // Every other rose's ticks (inner radius + the 7 px hub tick + its halo).
      return labels.some((other, j) => j !== i && hitsDisc(box, other.x, other.y, Math.max(8, other.r) + 9, pad)) ? null : box;
    };
    const modes: RoseLabelMode[] = label.name && label.name !== label.code
      ? ['name', 'name-below', 'code', 'code-below'] : ['code', 'code-below'];
    for (const mode of modes) {
      const box = fits(mode);
      if (box) { placed.push(box); out[i] = mode; break; }
    }
  }
  return out;
}

/**
 * [night-21a] D-268: the open hub board `board` covers this rose's ring of ticks (with a 2 px margin): the rose and its
 * note step back while the board is open (the board is drawn over the map; a ring half under its edge read as a stray
 * mark). A rose clear of the board stays, its name and note laid out round the board. Pure.
 */
export const rozaBoardCovers = (label: Pick<RoseLabel, 'x' | 'y' | 'r' | 'jam'>, board: Box): boolean =>
  hitsDisc(board, label.x, label.y, roseRingHalf(label), 2);

/**
 * [night-16a] D-262: the places a rose's note may take, for layoutTags: right of the rose level with its centre
 * (KARTA-V2 C: "RIX 0 z 12" beside the ring) when it fits on screen, else left of it (the mockup's VCE / ATH notes); the
 * other side, the place under the rose and the one over it (clear of its name) are the fallbacks, then the compact
 * form (TagSlot.compactWidth). A note never drifts more than its own height away (a jam's: 160 px); it hides instead:
 * the rose's ticks still show the fill, and zooming in makes room. `tag.width`/`height` are the full note's.
 * [night-16b] D-263: two more places left and right of the rose's own name (the forced busiest-hub note reads
 * "Amman · AMM 3 z 36"), and a home: a note stays within one rose radius (at least 16 px) of the ring (a jam's: no limit).
 */
export function rozaNotePlaces(tag: TagSlot, label: RoseLabel, mode: RoseLabelMode | undefined, viewWidth: number): void {
  const { x, y, r, jam } = label;
  // layoutTags centres a tag on anchorX and puts its top at anchorY − height − 11, then moves it off others.
  const side = r + (jam ? 26 : 14);
  const right = x + side + tag.width / 2, left = x - side - tag.width / 2;
  const rightFirst = x + side + tag.width <= viewWidth - 6 || x - side - tag.width < 6;
  tag.anchorX = rightFirst ? right : left;
  tag.altAnchorX = rightFirst ? left : right;
  tag.maxShift = jam ? 160 : tag.height + 6;
  tag.anchorY = y - 10 + tag.height + 11;
  const box = roseBox(label, mode);
  tag.belowX = x;
  tag.belowY = box.b + 4;
  tag.aboveY = box.t - 4;
  const text = roseLabelText(label, mode);
  if (text) {
    const name = roseNameBox(label, text, roseLabelBelow(mode));
    tag.besideLeft = name.l - 4;
    tag.besideRight = name.r + 4;
    tag.besideY = (name.t + name.b) / 2;
  } else {
    tag.besideLeft = tag.besideRight = tag.besideY = undefined;
  }
  tag.rose = label.code; // [night-18a] D-264
  tag.homeX = x;
  tag.homeY = y;
  tag.homeReach = jam ? undefined : roseHomeReach(r);
}
/** [night-16b] D-263: how far (px from the rose's centre) a note's box may lie: the ring plus one radius, at least 16. */
export const roseHomeReach = (r: number): number => Math.max(8, r) + Math.max(16, r);

/**
 * [night-16a] D-262: the rose as fixed obstacles for the notes. [night-16b] D-263: two of them: its ring of ticks
 * (`ring`, which no note ever covers, not even a forced one) and its name this frame (inactive without one; a forced
 * busiest-hub note may cover a lower-ranked rose's name, which then steps back).
 */
export function rozaRoseObstacles(ring: TagSlot, name: TagSlot, label: RoseLabel, mode: RoseLabelMode | undefined): void {
  const half = roseRingHalf(label);
  ring.ring = true;
  ring.rose = name.rose = label.code; // [night-18a] D-264: the note's ownership check (overlay-layout ownsPlace)
  ring.x = label.x - half;
  ring.y = label.y - half;
  ring.width = ring.height = half * 2;
  const text = roseLabelText(label, mode);
  name.active = ring.active && text !== '';
  if (!name.active) return;
  const box = roseNameBox(label, text, roseLabelBelow(mode));
  name.x = box.l;
  name.y = box.t;
  name.width = box.r - box.l;
  name.height = box.b - box.t;
}

/** One airport's rose in the overlay layer: seat ticks, the name along the ring, the jam countdown arc. */
export function rozaRose(layer: HTMLElement): Rose {
  const element = document.createElementNS(SVG, 'svg');
  element.setAttribute('class', 'roza-rose');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  element.setAttribute('width', '0');
  element.setAttribute('height', '0');
  element.style.display = 'none';
  layer.prepend(element);
  const id = `roza-arc-${roseId++}`;
  let key = '';
  let shown = false;
  let lx = NaN;
  let ly = NaN;
  return {
    element,
    draw(state, radius): void {
      const r = Math.max(8, Math.round(radius * 2) / 2);
      const jamStep = state.jam === null ? -1 : Math.round(state.jam * 90);
      const next = `${state.cap} ${state.taken} ${state.hub} ${jamStep} ${r} ${state.name} ${state.below === true}`;
      if (next === key) return;
      key = next;
      const col = state.jam !== null ? RED : CHALK;
      const per = Math.max(1, Math.ceil(state.cap / MAX_TICKS));
      const ticks = Math.ceil(state.cap / per);
      const takenTicks = Math.min(ticks, Math.ceil(state.taken / per));
      const len = state.hub ? 7 : 6;
      let s = '';
      for (let i = 0; i < ticks; i++) {
        const a = (-90 + (i * 360) / ticks) * DEG, c = Math.cos(a), sn = Math.sin(a), taken = i < takenTicks;
        const l = taken ? len : len * .45, w = taken ? 2.2 : 1.3;
        const d = `M${f1(c * (r + 1))} ${f1(sn * (r + 1))}L${f1(c * (r + 1 + l))} ${f1(sn * (r + 1 + l))}`;
        s += `<path d="${d}" stroke="${HALO}" stroke-width="${w + 2.2}"/><path d="${d}" stroke="${taken ? col : DIM}" stroke-width="${w}"/>`;
      }
      // A thin ring at the medallion's edge ties the ticks to the airport (the hub's is double, KARTA-V2 C).
      s += `<circle r="${r}" fill="none" stroke="${HALO}" stroke-width="3.6"/><circle r="${r}" fill="none" stroke="${col}" stroke-width="1.3"/>`;
      if (state.hub) s += `<circle r="${r - 3.2}" fill="none" stroke="${col}" stroke-width=".9"/>`;
      if (state.jam !== null) {
        // Time left before the network closes: a heavy arc outside the rose from twelve o'clock, shrinking clockwise;
        // its start tick has the halo too (docs/notes/roza-contrast.md, fix 3).
        const R = r + 14, share = Math.max(.002, state.jam), e = (-90 + share * 360) * DEG;
        const arc = share >= .999 ? `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}`
          : `M0 ${-R}A${R} ${R} 0 ${share > .5 ? 1 : 0} 1 ${f1(Math.cos(e) * R)} ${f1(Math.sin(e) * R)}`;
        s += `<path d="${arc}" fill="none" stroke="${HALO}" stroke-width="8"/><path d="${arc}" fill="none" stroke="${RED}" stroke-width="4"/>`;
        s += `<path d="M0 ${-R - 6}V${-R + 6}" stroke="${HALO}" stroke-width="5"/><path d="M0 ${-R - 6}V${-R + 6}" stroke="${RED}" stroke-width="2"/>`;
      }
      if (state.name) {
        // The name along the top of the ring, centred on twelve o'clock; the path runs 270° so a long name still fits.
        // [night-16a] D-262: or along the bottom, centred on six o'clock, running anticlockwise so it reads left to right.
        const below = state.below === true;
        const { R, size } = roseNameMetrics(r, state.hub, state.jam !== null, state.name, below);
        const a0 = (below ? 225 : 135) * DEG, a1 = (below ? -45 : 45) * DEG;
        s += `<path id="${id}" d="M${f1(Math.cos(a0) * R)} ${f1(Math.sin(a0) * R)}A${f1(R)} ${f1(R)} 0 1 ${below ? 0 : 1} ${f1(Math.cos(a1) * R)} ${f1(Math.sin(a1) * R)}" fill="none"/>`;
        s += `<text class="roza-rose__name" font-size="${f1(size)}" fill="${col}"><textPath href="#${id}" startOffset="50%" text-anchor="middle"></textPath></text>`;
      }
      const span = r + 46; // [night-16a] room for a name along the bottom
      element.setAttribute('viewBox', `${-span} ${-span} ${span * 2} ${span * 2}`);
      element.setAttribute('width', String(span * 2));
      element.setAttribute('height', String(span * 2));
      element.style.marginLeft = element.style.marginTop = `${-span}px`;
      element.innerHTML = s;
      const path = element.querySelector('textPath');
      if (path) path.textContent = state.name;
    },
    place(x, y, visible): void {
      if (visible !== shown) { shown = visible; element.style.display = visible ? '' : 'none'; }
      if (!visible || (x === lx && y === ly)) return;
      lx = x;
      ly = y;
      element.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,0)`;
    },
  };
}

/** A screen rectangle (layer coordinates). */
export interface CaptionRect { l: number; t: number; r: number; b: number }
/**
 * Which dock captions clash with a rose in view (D-259): a caption that would overlap a rose's ring of ticks or its
 * name steps back (hidden) — the caption repeats its button's accessible name, the rose carries the game. Pure.
 */
export function rozaCaptionClashes(captions: readonly CaptionRect[], labels: readonly RoseLabel[], modes: readonly RoseLabelMode[]): boolean[] {
  return captions.map((c) => labels.some((label, i) => {
    if (hitsDisc(c, label.x, label.y, Math.max(8, label.r) + (label.jam ? 20 : 9), 2)) return true;
    const mode = modes[i];
    const text = roseLabelText(label, mode);
    return text !== '' && hits(c, roseNameBox(label, text, roseLabelBelow(mode)), 2);
  }));
}
const captionCache = { els: [] as HTMLElement[], rects: [] as CaptionRect[], dock: [] as CaptionRect[], frame: 0 };
/**
 * Re-measures the dock captions and the dock symbols every 15th frame (they move only with a layout change or a new
 * text), so a frame reads no layout.
 */
function measureDock(host: HTMLElement): void {
  if (captionCache.frame++ % 15 !== 0) return;
  const root = host.getRootNode() as Document | ShadowRoot;
  const origin = host.getBoundingClientRect();
  const rect = (el: Element): CaptionRect => {
    const r = el.getBoundingClientRect();
    return { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top };
  };
  captionCache.els = [...(root.querySelectorAll?.('.airway-hud .roza-caption') ?? [])] as HTMLElement[];
  captionCache.rects = captionCache.els.map(rect);
  captionCache.dock = ([...(root.querySelectorAll?.('.airway-hud .airway-dock__holder') ?? [])] as HTMLElement[])
    .map(rect).filter((r) => r.r - r.l >= 1 && r.b - r.t >= 1);
}

/**
 * [night-16a] D-262: the dock symbols on their arc as fixed obstacles for the notes (a note under a rose near the dock
 * stood on the hub symbol in the store shot). `slots` is the overlay's fixed pool; unused ones go inactive. Call once a
 * frame before layoutTags; it also re-measures the dock (see measureDock).
 */
export function rozaDockObstacles(host: HTMLElement, slots: readonly TagSlot[]): void {
  measureDock(host);
  slots.forEach((slot, i) => {
    const r = captionCache.dock[i];
    slot.active = r !== undefined;
    if (!r) return;
    slot.x = r.l;
    slot.y = r.t;
    slot.width = r.r - r.l;
    slot.height = r.b - r.t;
    slot.rank = Infinity; // never given up for a must note's pass over lower-ranked roses
  });
}

/**
 * Hides the dock captions that clash with a rose ([night-16a] D-262: or with a note shown) this frame; call after
 * layoutTags. A caption repeats its button's accessible name, the rose and the note carry the game.
 */
export function rozaCaptionsYield(host: HTMLElement, labels: readonly RoseLabel[], modes: readonly RoseLabelMode[],
  notes: readonly TagSlot[] = []): void {
  if (!captionCache.frame) measureDock(host);
  const clash = rozaCaptionClashes(captionCache.rects, labels, modes);
  captionCache.els.forEach((el, i) => {
    const c = captionCache.rects[i];
    const covered = clash[i] || notes.some((n) => n.placed && !n.fixed && c.l < n.x + n.width + 2 && n.x < c.r + 2 && c.t < n.y + n.height + 2 && n.y < c.b + 2);
    const want = covered ? '1' : undefined;
    if (el.dataset.rozaYield !== want) { if (want) el.dataset.rozaYield = want; else delete el.dataset.rozaYield; }
  });
}

// ---- Main menu: the big compass rose ---------------------------------------------------------------------------------

/** The menu's compass rose (decorative; the entries are the board's own buttons, laid out on its western arc by roza.css). */
export function rozaMenuRose(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'roza-menu-rose';
  box.setAttribute('aria-hidden', 'true');
  const R = 70;
  let s = `<circle r="${R}" fill="none" stroke="${HALO}" stroke-width="4"/><circle r="${R}" fill="none" stroke="${CHALK}" stroke-width="1.6"/>`;
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * DEG, l = i % 18 ? (i % 2 ? 3 : 6) : 12;
    s += `<path d="M${f1(Math.cos(a) * R)} ${f1(Math.sin(a) * R)}L${f1(Math.cos(a) * (R - l))} ${f1(Math.sin(a) * (R - l))}" stroke="${CHALK}" stroke-width="${i % 18 ? 1 : 2}"/>`;
  }
  s += `<path d="M0-50 8 0 0 50-8 0Z" fill="${CHALK}" stroke="${HALO}" stroke-width="2"/><path d="M-50 0 0-8 50 0 0 8Z" fill="none" stroke="${CHALK}" stroke-width="1.4"/>`;
  s += `<text class="roza-menu-rose__n" y="${-R - 10}">N</text>`;
  box.innerHTML = `<svg viewBox="-96 -96 192 192" focusable="false">${s}</svg>`;
  return box;
}

/**
 * Lays the board's entries on the menu rose's western arc: each entry's right end (and its dot) sits on a circle around
 * the rose, a leader line runs from the dot to the rose's ring, as on the mockup. Entries keep their row pitch (≥ 48 px
 * targets); only their horizontal place follows the arc. Re-measured on resize and on refresh.
 */
export function rozaMenuArc(board: HTMLElement, rose: HTMLElement): { layout(): void; dispose(): void } {
  let frame = 0;
  const entries = (): HTMLElement[] => [...board.querySelectorAll<HTMLElement>(':scope > .airway-flight, :scope > .airway-flight-line, .airway-board__service > .airway-flight')];
  const measure = (): void => {
    frame = 0;
    const box = rose.getBoundingClientRect();
    if (!box.width) return;
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2, ring = box.width * (74 / 192);
    const reach = ring + Math.min(64, box.width * .36);
    const right = board.getBoundingClientRect().right;
    for (const entry of entries()) {
      entry.style.marginRight = '0px';
      entry.style.maxWidth = '';
      const r = entry.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const dy = y - cy;
      const dx = Math.abs(dy) < reach ? Math.sqrt(reach * reach - dy * dy) : 0;
      const dot = cx - Math.max(dx, ring * .45);
      const margin = Math.max(0, right - (dot - 14));
      entry.style.marginRight = `${margin.toFixed(1)}px`;
      // A long subtitle wraps instead of running off the left edge.
      entry.style.maxWidth = `calc(100% - ${margin.toFixed(1)}px)`;
      const lx = cx - dot, ly = cy - y, length = Math.hypot(lx, ly);
      entry.style.setProperty('--roza-ll', `${Math.max(0, length - ring - 2).toFixed(1)}px`);
      entry.style.setProperty('--roza-la', `${(Math.atan2(ly, lx) * 180 / Math.PI).toFixed(1)}deg`);
    }
  };
  const layout = (): void => { if (!frame) frame = requestAnimationFrame(measure); };
  layout();
  void document.fonts?.ready.then(layout);
  window.addEventListener('resize', layout);
  return { layout, dispose(): void { if (frame) cancelAnimationFrame(frame); window.removeEventListener('resize', layout); } };
}

/** The menu title's tagline (the mockup's "Sieć lotnicza na całym globie"). */
export function rozaTagline(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'roza-tagline';
  line.textContent = t('roza.menu.tagline');
  return line;
}

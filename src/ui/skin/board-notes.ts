/**
 * [night-73a] D-328 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T2; UI-A-SPEC.md §3, §6): the airport
 * notes of the UI-A skin as airport signs. src/main.ts loads this module at boot and hands it to the overlay through `noteSkin` (src/ui/overlay-skin.ts).
 *
 * - **Airport sign** (enamel, cream letters): the IATA code in a cream inner frame (the D-68 setting may put the city
 *   name there), the waiting queue behind it on the same enamel as D-08 glyphs (shape first, each with a cream outline,
 *   so the dark Africa keyhole reads on black), the city name on its own enamel strip under the sign, a cream "NOWE"
 *   tag hung over the sign's edge while the airport is new. A **hub** sign has a double frame, a larger code and the
 *   hub mark (the asterisk in a ring of the hub's pin). A **jam** turns the sign white on red with the countdown
 *   ("AMM 0:42"), the only red on the map (spec §2).
 * - **Levels of detail** (spec §6): 1 = one glyph per passenger (7, then "+n") and the city under every sign; 2 = one
 *   glyph per direction (most numerous first) and the total, the city only under hubs, no country names; the layout's
 *   compact form is level 3, the code alone (with NOWE and a jam's countdown). Level 2 when the frame spans more than
 *   `LOD1_MAX_SPAN_KM`, the text is at 130 % or more, or more than `DENSE_SIGNS` airports are on screen (hysteresis).
 * - **Direction sign** for an off-screen airport (replaces the edge chip): black on yellow, code over "city 2 408 km",
 *   the SVG arrow on the side it points to; yellow means "where to" only, so at most `YELLOW_SIGNS` signs are yellow at a
 *   time (a jam's is red, the rest are enamel with cream letters).
 * - **Atlas labels** (R2's `ATLAS_LABELS`, i18n PL/EN): letter-spaced capitals for countries, spaced lower case for seas,
 *   projected with `projectLonLat`, placed after the signs and never over a sign, a pin, the chrome or each other
 *   (they yield: spec §6.6), the lighter weights first.
 *
 * The layout engine is the shipped one (src/ui/overlay-layout.ts with the Linoryt frame helpers): priority jam > new >
 * hub > fuller, never over a pin or another note, at home, clearly its own (D-262…D-268, D-280, D-281); only the
 * geometry below changes. Sizes are CSS px fixed in the world at every text step (D-267) and match board.css "T2".
 * No runtime imports: src/main.ts hands in i18n, the label list and its helpers.
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { DestinationRegion } from '../glyphs';
import type { NoteSkin, NoteSkinBox, NoteSkinFrame, NoteSkinInput, NoteSkinSize, NoteSkinView } from '../overlay-skin';
import type { AtlasLabel } from '../../data/atlasLabels';
import type { TagSlot } from '../overlay-layout';

export interface BoardNotesDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** R2's atlas labels (src/data/atlasLabels.ts) and their helpers. */
  labels: readonly AtlasLabel[];
  eligible(label: AtlasLabel, frameSpanKm: number): boolean;
  labelKey(label: AtlasLabel): string;
}

// ---- Metrics -------------------------------------------------------------------------------------------------------

/**
 * Advances (em) of the three Archivo instances, measured in Chromium from public/fonts/ (canvas measureText at 100 px,
 * rounded up to 0.01 em): 800 at 80 % width for codes and countdowns, 700 at 80 % for counts, 600 for city names and
 * atlas labels. Unknown characters count as a wide letter.
 */
const A800: Record<string, number> = {
  0: .53, 1: .49, 2: .52, 3: .52, 4: .52, 5: .53, 6: .53, 7: .5, 8: .52, 9: .53, ' ': .16, ':': .28, '·': .27, '+': .58,
  A: .62, B: .61, C: .63, D: .63, E: .57, F: .52, G: .67, H: .64, I: .29, J: .53, K: .63, L: .52, M: .79, N: .64, O: .67,
  P: .58, Q: .67, R: .62, S: .57, T: .57, U: .64, V: .6, W: .84, X: .61, Y: .6, Z: .57,
  a: .52, b: .53, c: .51, d: .53, e: .52, f: .31, g: .51, h: .52, i: .25, j: .25, k: .52, l: .25, m: .78, n: .52, o: .53,
  p: .53, q: .53, r: .34, s: .48, t: .33, u: .52, v: .48, w: .72, x: .51, y: .47, z: .45, 'ł': .25, '-': .29, '.': .27,
};
const A600: Record<string, number> = {
  0: .58, 1: .58, 2: .58, 3: .58, 4: .58, 5: .58, 6: .58, 7: .58, 8: .58, 9: .58, ' ': .2, '+': .64, ':': .34, '·': .34,
  '-': .34, '.': .3, ',': .3, "'": .25, '(': .36, ')': .36, '/': .3,
  A: .71, B: .71, C: .73, D: .73, E: .68, F: .61, G: .8, H: .74, I: .29, J: .59, K: .7, L: .57, M: .85, N: .74, O: .79,
  P: .67, Q: .79, R: .72, S: .67, T: .62, U: .73, V: .68, W: .96, X: .69, Y: .68, Z: .64,
  a: .56, b: .6, c: .55, d: .6, e: .57, f: .31, g: .6, h: .59, i: .26, j: .25, k: .55, l: .26, m: .87, n: .59, o: .6,
  p: .6, q: .6, r: .37, s: .55, t: .32, u: .59, v: .53, w: .76, x: .55, y: .53, z: .51,
  'ą': .56, 'ć': .55, 'ę': .57, 'ł': .26, 'ń': .59, 'ó': .6, 'ś': .55, 'ź': .51, 'ż': .51,
  'Ą': .71, 'Ć': .73, 'Ę': .68, 'Ł': .57, 'Ń': .74, 'Ó': .79, 'Ś': .67, 'Ź': .64, 'Ż': .64,
  'á': .56, 'ã': .56, 'é': .57, 'í': .26, 'ú': .59, 'ü': .59, 'ç': .55, 'ñ': .59, 'ö': .6, 'ä': .56, 'å': .56, 'è': .57,
  'â': .56, 'ê': .57, 'ô': .6, 'õ': .6,
};
const advance = (table: Record<string, number>, text: string, px: number, tracking = 0): number => {
  let em = .06;
  for (const ch of text) em += (table[ch] ?? .8) + tracking;
  return Math.ceil(em * px);
};
/** Width (px) of a code or countdown in Archivo 800 at 80 % width. */
export const codeWidth = (text: string, px: number): number => advance(A800, text, px);
/** Width (px) of text in Archivo 600 (city names, atlas labels); `tracking` in em per letter. */
export const textWidth = (text: string, px: number, tracking = 0): number => advance(A600, text, px, tracking);

/** Sign row height, the NOWE tag row over it, the city strip under it (px). */
export const SIGN_ROW = 24;
export const FRESH_ROW = 14;
export const CITY_ROW = 17;
/** Code sizes: an airport's 15 px, a hub's 17 px; the city 11.5 px; NOWE 9.5 px capitals. */
const CODE_PX = 15;
const HUB_CODE_PX = 17;
const CITY_PX = 11.5;
const FRESH_PX = 9.5;
/** The code plate: 2 px enamel, the cream frame (1.5 px; a hub's double frame 3 px), 4 px inside, each side. */
const plateExtra = (hub: boolean): number => 2 * (2 + (hub ? 3 : 1.5) + 4);
/** The hub mark before a hub's code: a 14 px ring and 3 px to the frame. */
const HUB_MARK = 17;
/** The jam countdown after the code: 6 px each side. */
const TIMER_PAD = 12;
/** Queue cells: a glyph at the theme's D-08 size (16 px, 21 px with enhanced glyphs) and 2 px; the row's 4 px lead and end. */
const glyphPx = (): number => (typeof document !== 'undefined' && document.documentElement.dataset.airwayCvd === 'enhanced' ? 21 : 16);
const QUEUE_PAD = 4;
/** Level 1 shows a glyph per passenger up to this many, then "+n" (spec §6). */
export const LOD1_GLYPHS = 7;
/** The count ("+3", "12") in Archivo 700 at 80 %, 14 px, 3 px before and 2 px after. */
const countWidth = (text: string): number => codeWidth(text, 14) + 5;

/** Levels of detail. */
export type SignLod = 1 | 2;
/**
 * Widest frame (km across the shorter side) that keeps level 1. The spec's "< 1,500 km" is closer than the game's camera
 * goes: the opening framing spans about 4,400 km on a 412 × 915 phone and the closest zoom about 3,300 km, so level 1
 * holds up to the opening framing and the density decides the rest.
 */
export const LOD1_MAX_SPAN_KM = 5200;
/** Frames this close (the camera's closest zoom steps) allow twice the density before level 2: zooming in shows more. */
export const LOD1_CLOSE_SPAN_KM = 3700;
/** More airports than this on screen switch to level 2; it comes back under `DENSE_SIGNS - 2` (no flicker). */
export const DENSE_SIGNS = 10;
/** Text at this scale or more uses level 2 (spec §6). */
export const LOD2_TEXT_SCALE = 120;
/** Direction signs that may be yellow at a time (spec §2: at most three yellow things on the game screen). */
export const YELLOW_SIGNS = 2;

/** The level of detail for a frame (pure; `prev` gives the density hysteresis). */
export function signLod(spanKm: number, textScale: number, visible: number, prev: SignLod): SignLod {
  if (textScale >= LOD2_TEXT_SCALE || spanKm > LOD1_MAX_SPAN_KM) return 2;
  const dense = spanKm <= LOD1_CLOSE_SPAN_KM ? DENSE_SIGNS * 2 : DENSE_SIGNS;
  if (visible > dense) return 2;
  if (prev === 2 && visible > dense - 2) return 2;
  return 1;
}

/** What one sign shows (pure input of the metrics). */
export interface SignShape {
  label: string;
  name: string;
  hub: boolean;
  lod: SignLod;
  /** Glyph cells in the queue and the count text after them ('' = none). */
  glyphs: number;
  count: string;
  /** Width of the curfew/surge/front stubs and the trend chevron (0 = none). */
  stubs: number;
  fresh: string | null;
  jamSeconds: number | null;
}

/** The jam countdown as the sign prints it, "0:42". */
export const signClock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** Does the city strip show under this sign? (level 1 always, level 2 only a hub; never when the sign already says it). */
export const showsCity = (shape: Pick<SignShape, 'lod' | 'hub' | 'label' | 'name'>): boolean =>
  (shape.lod === 1 || shape.hub) && shape.name !== '' && shape.name !== shape.label;

/** Full and compact size of a sign (px), and where the sign row's middle lies under the note's top. */
export function signSize(shape: SignShape): NoteSkinSize & { lineMid: number } {
  const plate = codeWidth(shape.label, shape.hub ? HUB_CODE_PX : CODE_PX) + plateExtra(shape.hub) + (shape.hub ? HUB_MARK : 0);
  const timer = shape.jamSeconds !== null ? codeWidth(signClock(shape.jamSeconds), CODE_PX) + TIMER_PAD : 0;
  const queueCells = shape.glyphs * (glyphPx() + 2) + (shape.count ? countWidth(shape.count) : 0) + shape.stubs;
  const queue = queueCells > 0 ? queueCells + QUEUE_PAD * 2 : 0;
  const fresh = shape.fresh ? Math.ceil(textWidth(shape.fresh.toUpperCase(), FRESH_PX, .08)) + 8 : 0;
  const city = showsCity(shape) ? textWidth(shape.name, CITY_PX) + 8 : 0;
  const top = shape.fresh ? FRESH_ROW : 0;
  return {
    width: Math.max(plate + timer + queue, fresh, city),
    height: top + SIGN_ROW + (city ? CITY_ROW : 0),
    compactWidth: Math.max(plate + timer, fresh),
    compactHeight: top + SIGN_ROW,
    lineMid: top + SIGN_ROW / 2,
  };
}

/**
 * The queue of one sign: which glyphs (region, hollow) and the count text. Level 1: every passenger in queue order (the
 * ready ones, then the connecting ones hollow, at most half hollow when it overflows), at most 7, then "+n". Level 2: one
 * glyph per direction, the most numerous first (hollow only when every passenger of that direction is still
 * connecting), then the total.
 */
export function signQueue(waiting: readonly DestinationRegion[], connecting: number, lod: SignLod):
  { glyphs: { region: DestinationRegion; hollow: boolean }[]; count: string } {
  const total = waiting.length;
  const hollowAll = Math.min(Math.max(0, connecting), total);
  if (lod === 1) {
    const limit = Math.min(LOD1_GLYPHS, total);
    const hollow = Math.min(hollowAll, total > LOD1_GLYPHS ? Math.ceil(limit / 2) : limit);
    const glyphs: { region: DestinationRegion; hollow: boolean }[] = [];
    for (let i = 0; i < limit - hollow; i++) glyphs.push({ region: waiting[i], hollow: false });
    for (let i = total - hollow; i < total; i++) glyphs.push({ region: waiting[i], hollow: true });
    return { glyphs, count: total > LOD1_GLYPHS ? '+' + (total - LOD1_GLYPHS) : '' };
  }
  const ready = total - hollowAll;
  const counts = new Map<DestinationRegion, { n: number; ready: number; first: number }>();
  waiting.forEach((region, i) => {
    const c = counts.get(region) ?? { n: 0, ready: 0, first: i };
    c.n++;
    if (i < ready) c.ready++;
    counts.set(region, c);
  });
  const glyphs = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .map(([region, c]) => ({ region, hollow: c.ready === 0 }));
  return { glyphs, count: total > 0 ? String(total) : '' };
}

// ---- Atlas labels ----------------------------------------------------------------------------------------------------

/** Country names: 10.5 px capitals, tracking .3 em; seas 12 px, tracking .12 em; both 14 px high boxes with 3 px air. */
export const ATLAS_COUNTRY_PX = 10.5;
export const ATLAS_SEA_PX = 12;
const ATLAS_HEIGHT = 16;
const ATLAS_AIR = 3;
export const atlasLabelWidth = (text: string, kind: 'country' | 'sea'): number => kind === 'country'
  ? textWidth(text.toLocaleUpperCase(), ATLAS_COUNTRY_PX, .3)
  : textWidth(text, ATLAS_SEA_PX, .12);

export interface AtlasCandidate { id: string; kind: 'country' | 'sea'; weight: number; x: number; y: number; width: number }
export interface AtlasPlaced { id: string; x: number; y: number; width: number; height: number }
type Box = { l: number; t: number; r: number; b: number };
const meets = (a: Box, b: Box): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * Greedy, deterministic placement of the atlas labels after the signs (spec §6.6: they yield to signs and pins): the
 * lighter weight first (oceans, then seas and big countries…), seas before countries of the same weight; a label
 * centred on its anchor is kept when its box (with 3 px air) stays inside the band and meets no obstacle and no label
 * already kept. Pure and allocation-light; `out` is reused.
 */
export function placeAtlas(candidates: readonly AtlasCandidate[], obstacles: readonly Box[], band: Box, out: AtlasPlaced[]): AtlasPlaced[] {
  out.length = 0;
  const order = [...candidates].sort((a, b) => a.weight - b.weight || (a.kind === b.kind ? 0 : a.kind === 'sea' ? -1 : 1) || (a.id < b.id ? -1 : 1));
  const kept: Box[] = [];
  for (const c of order) {
    const box = { l: c.x - c.width / 2 - ATLAS_AIR, t: c.y - ATLAS_HEIGHT / 2 - ATLAS_AIR, r: c.x + c.width / 2 + ATLAS_AIR, b: c.y + ATLAS_HEIGHT / 2 + ATLAS_AIR };
    if (box.l < band.l || box.r > band.r || box.t < band.t || box.b > band.b) continue;
    if (obstacles.some((o) => meets(box, o)) || kept.some((k) => meets(box, k))) continue;
    kept.push(box);
    out.push({ id: c.id, x: Math.round(c.x - c.width / 2), y: Math.round(c.y - ATLAS_HEIGHT / 2), width: c.width, height: ATLAS_HEIGHT });
  }
  return out;
}

/** The yellow budget (spec §2): which shown direction signs stay yellow — new airports first, then the fuller. */
export function yellowSigns(edges: readonly { jam: boolean; fresh: boolean; fill: number }[], budget = YELLOW_SIGNS): boolean[] {
  const order = edges.map((_, i) => i).filter((i) => !edges[i].jam)
    .sort((a, b) => Number(edges[b].fresh) - Number(edges[a].fresh) || edges[b].fill - edges[a].fill || a - b);
  const keep = edges.map(() => false);
  for (const i of order.slice(0, budget)) keep[i] = true;
  return keep;
}

// ---- DOM ---------------------------------------------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
/** Add/remove, never a forced toggle (D-322; no runtime import here, so not setClass). */
function toggle(el: Element, name: string, on: boolean): void {
  if (el.classList.contains(name) === on) return;
  if (on) el.classList.add(name); else el.classList.remove(name);
}

/** The hub mark: the six-spoke asterisk in a ring, as the hub's pin on the map (shape, not colour). */
function hubMark(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'bd-hubmark');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '7');
  ring.setAttribute('cy', '7');
  ring.setAttribute('r', '6');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', 'currentColor');
  ring.setAttribute('stroke-width', '1.5');
  const star = document.createElementNS(SVG_NS, 'path');
  star.setAttribute('d', 'M7 3V11M3.5 5 10.5 9M3.5 9 10.5 5');
  star.setAttribute('stroke', 'currentColor');
  star.setAttribute('stroke-width', '1.5');
  star.setAttribute('stroke-linecap', 'round');
  svg.append(ring, star);
  return svg;
}

interface SignParts {
  fresh: HTMLSpanElement; plate: HTMLSpanElement; mark: SVGSVGElement; code: HTMLSpanElement; count: HTMLSpanElement;
  city: HTMLSpanElement; br: HTMLSpanElement[]; size: NoteSkinSize & { lineMid: number };
}

/** Creates the UI-A note skin (UI-A). */
export function createBoardNotes(deps: BoardNotesDeps): NoteSkin & { readonly lod: SignLod } {
  const parts = new WeakMap<HTMLElement, SignParts>();
  let lod: SignLod = 1;
  let atlasLayer: HTMLDivElement | null = null;
  const atlasNodes = new Map<string, { el: HTMLSpanElement; x: number; y: number; shown: boolean; text: string; width: number }>();
  const candidates: AtlasCandidate[] = [];
  const obstacles: Box[] = [];
  const placed: AtlasPlaced[] = [];
  const point = { x: 0, y: 0, visible: false };
  // DEV probe for the browser audits (e2e/board.mjs): the level of detail and the frame span this frame.
  const probe = { lod: 1 as SignLod, spanKm: 0, visible: 0 };
  (globalThis as { __awBoardSigns?: typeof probe }).__awBoardSigns = probe;

  const span = (cls: string): HTMLSpanElement => {
    const el = document.createElement('span');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    return el;
  };
  function state(bubble: HTMLElement): SignParts {
    let p = parts.get(bubble);
    if (!p) {
      const plate = span('bd-plate');
      const code = span('bd-code');
      const mark = hubMark();
      plate.append(code);
      p = {
        fresh: span('bd-new airport-bubble__new'), plate, mark, code, count: span('bd-count airport-bubble__count'),
        city: span('bd-city'), br: [span('bd-br'), span('bd-br')],
        size: { width: 0, height: 0, compactWidth: 0, compactHeight: 0, lineMid: SIGN_ROW / 2 },
      };
      parts.set(bubble, p);
    }
    return p;
  }

  const textScale = (): number => Number(document.documentElement.dataset.airwayTextScale ?? 100) || 100;

  return {
    get lod() { return lod; },
    mount(layer) {
      layer.classList.add('bd-notes');
      atlasLayer = document.createElement('div');
      atlasLayer.className = 'bd-atlas';
      atlasLayer.setAttribute('aria-hidden', 'true');
      layer.prepend(atlasLayer);
    },
    frame(view: NoteSkinView) {
      const next = signLod(view.spanKm, textScale(), view.visible, lod);
      probe.lod = next;
      probe.spanKm = Math.round(view.spanKm);
      probe.visible = view.visible;
      if (next === lod) return false;
      lod = next;
      return true;
    },
    children(bubble, want, input: NoteSkinInput) {
      const p = state(bubble);
      want.length = 0;
      const jam = input.jamSeconds !== null;
      bubble.classList.add('bd-sign');
      toggle(bubble, 'bd-sign--hub', input.hub);
      toggle(bubble, 'bd-sign--lod2', lod === 2);
      const fresh = input.isNew ? deps.t('airport.new') : null;
      if (fresh) {
        setText(p.fresh, fresh);
        want.push(p.fresh, p.br[0]);
      }
      setText(p.code, input.label);
      if (input.hub !== (p.mark.parentNode === p.plate)) {
        if (input.hub) p.plate.prepend(p.mark); else p.mark.remove();
      }
      want.push(p.plate);
      if (jam) want.push(input.timer);
      // The queue: stubs first (curfew, surge, front: the airport's state), then the glyphs and the count, the trend.
      want.push(...input.stubs);
      const queue = signQueue(input.waiting, input.connecting, lod);
      for (const g of queue.glyphs) want.push(input.glyph(g.region, g.hollow));
      if (queue.count) {
        setText(p.count, queue.count);
        toggle(p.count, 'bd-count--more', queue.count.startsWith('+'));
        want.push(p.count);
      }
      const trend = input.trend && input.waiting.length > 0 ? input.trend : null;
      if (trend) want.push(trend);
      const shape: SignShape = {
        label: input.label, name: input.name, hub: input.hub, lod, glyphs: queue.glyphs.length, count: queue.count,
        stubs: input.stubsWidth + (trend ? input.trendWidth : 0), fresh, jamSeconds: input.jamSeconds,
      };
      if (showsCity(shape)) {
        setText(p.city, input.name);
        want.push(p.br[1], p.city);
      }
      const size = signSize(shape);
      p.size = size;
      bubble.style.width = size.width + 'px';
      bubble.style.setProperty('--bd-compact-w', size.compactWidth + 'px');
      return size;
    },
    size(bubble) { return parts.get(bubble)?.size ?? { width: 0, height: 0, compactWidth: 0, compactHeight: 0 }; },
    lineMid(bubble) { return parts.get(bubble)?.size.lineMid ?? SIGN_ROW / 2; },
    edge(edge, input) {
      const km = deps.t('upgrade.value.km', { km: deps.localNumber(Math.round(input.km / 10) * 10) });
      let line = `${input.name} ${km}`;
      const arrow = 26;
      const width = (text: string): number => 10 + Math.max(codeWidth(input.code, CODE_PX), textWidth(text, CITY_PX)) + arrow;
      if (width(line) > EDGE_MAX && line !== km) line = km;
      const w = Math.min(EDGE_MAX, Math.max(EDGE_MIN, width(line)));
      if (edge.dataset.bdCode !== input.code) edge.dataset.bdCode = input.code;
      if (edge.dataset.bdLine !== line) edge.dataset.bdLine = line;
      const css = w + 'px';
      if (edge.style.width !== css) edge.style.width = css;
      return w;
    },
    frameEnd(frame: NoteSkinFrame) {
      // The yellow budget of the direction signs.
      const keep = yellowSigns(frame.edges);
      frame.edges.forEach((e, i) => toggle(e.el, 'bd-edge--quiet', !keep[i] && !e.jam));
      // Atlas labels.
      const layer = atlasLayer;
      if (!layer) return;
      candidates.length = 0;
      obstacles.length = 0;
      if (frame.project) {
        for (const label of deps.labels) {
          if (label.kind === 'country' && lod === 2) continue; // spec §6: level 2 hides the country names, seas stay
          if (!deps.eligible(label, frame.spanKm)) continue;
          frame.project(label.lon, label.lat, point);
          if (!point.visible) continue;
          let node = atlasNodes.get(label.id);
          if (!node) {
            const el = document.createElement('span');
            el.className = 'bd-atlas__label bd-atlas__label--' + label.kind;
            el.hidden = true;
            layer.append(el);
            node = { el, x: NaN, y: NaN, shown: false, text: '', width: 0 };
            atlasNodes.set(label.id, node);
          }
          const text = deps.t(deps.labelKey(label) as TranslationKey);
          if (node.text !== text) { node.text = text; node.el.textContent = text; node.width = atlasLabelWidth(text, label.kind); }
          candidates.push({ id: label.id, kind: label.kind, weight: label.weight, x: point.x, y: point.y, width: node.width });
        }
        for (const slot of frame.slots) collectObstacle(slot, obstacles);
        for (const e of frame.edges) obstacles.push({ l: e.box.x, t: e.box.y, r: e.box.x + e.box.width, b: e.box.y + e.box.height });
      }
      const b = frame.bounds;
      placeAtlas(candidates, obstacles, { l: 4, t: b.top + 4, r: b.width - 4, b: b.height - b.bottom - 4 }, placed);
      const shown = new Set<string>();
      for (const at of placed) {
        const node = atlasNodes.get(at.id);
        if (!node) continue;
        shown.add(at.id);
        if (!node.shown) { node.el.hidden = false; node.shown = true; }
        if (node.x !== at.x || node.y !== at.y) {
          node.el.style.transform = `translate3d(${at.x}px,${at.y}px,0)`;
          node.x = at.x;
          node.y = at.y;
        }
      }
      for (const [id, node] of atlasNodes) if (node.shown && !shown.has(id)) { node.el.hidden = true; node.shown = false; }
    },
  };
}

/** A placed note, an active stamp, the board or a margin as an obstacle box for the atlas labels. */
function collectObstacle(slot: TagSlot, out: Box[]): void {
  if (slot.fixed ? !slot.active : !slot.placed) return;
  if (slot.width <= 0 || slot.height <= 0) return;
  out.push({ l: slot.x, t: slot.y, r: slot.x + slot.width, b: slot.y + slot.height });
}

/** Direction sign width bounds (px); its height is the edge chip's 48. */
const EDGE_MIN = 64;
const EDGE_MAX = 168;

export type { NoteSkinBox };

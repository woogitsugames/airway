// Projection-only UI. The simulation supplies read-only snapshots and navigation is a callback.
import { Camera, Object3D, Vector3 } from 'three';
import { t } from '../i18n';
import { isDestinationRegion as isValidRegion, regionGlyph, type DestinationRegion } from './glyphs';
import {
  attachSlotTag, EDGE_CHIP_HEIGHT, EDGE_CHIP_WIDTH, layoutTags, placeEdgeChips, projectEdgeChip, sizeTagGroup, slotCountdownText,
  placeSizedEdgeChips, SLOT_TAG_GAP, SLOT_TAG_HEIGHT,
  type EdgeBounds, type EdgeChip, type SlotTagRect, type TagBounds, type TagSlot,
} from './overlay-layout'; // [task-38] slot tag; [night-11x] R5h edge chips
import { REGIONS } from '../data/regions';
import type { FillTrend } from '../game/fillTrend'; // [night-11af] R4c (type only)
import type { SurgeMark } from '../game/surge'; // [night-12bb] R2i (type only)
import type { FrontMark } from '../game/weather'; // [night-12bd] R2j (type only)
import './skin/current.css'; // [night-11aq] skin tokens read by overlay.css
import {
  skin, rozaEdgeClash, rozaEdgeNote, rozaExtraWidth, rozaJamShare, rozaJamWidth, rozaCaptionsYield, rozaNameLayout, rozaNoteChildren, rozaRose, MEDAL_RADIUS,
  rozaCompactWidth, rozaDockObstacles, rozaBoardCovers, rozaNotePlaces, rozaRoseObstacles, roseLabelBelow, roseLabelText, roseNoteMust, roseRank,
  ROZA_JAM_LINE, type Rose, type RoseLabel, type RoseLabelMode,
} from './skin/roza'; // [night-11az] D-257: Róża skin helpers
import {
  linoryt, linorytCompactPasses, linorytEdge, linorytFrameEnd, linorytFrameStart, linorytMarginSlot, linorytNoteChildren, linorytNoteFrame,
  linorytMarkers, linorytNoteSize, linorytProbe, linorytStampBox, linorytStampFallback, linorytStampProbe, linorytStampSlot, type StampBox,
} from './skin/linoryt'; // [night-30a] D-284 U2: Linoryt preview notes (DEV only; every call guarded)
import './overlay.css';

const DEG = Math.PI / 180;
const MAX_GLYPHS = 6;
const SVG = 'http://www.w3.org/2000/svg';

export interface OverlayAirport {
  id: string;
  code: string;
  lon: number;
  lat: number;
  hub?: boolean;
  /** [night-11m] D-128: text of the airport's code plate (code or city name per the D-68 setting); default `code`. */
  label?: string;
  /** [night-11az] D-257 Róża: the localized city name set along the airport's rose; default `code`. */
  name?: string;
}

export interface AirportOverlayOptions {
  radius?: number;
  reservedTop?: number;
  reservedBottom?: number;
  /**
   * [night-08b] Live HUD clearance (read every frame, so return a reused object): overrides reservedTop/Bottom
   * and adds a right band, for the landscape tag dock that edge buttons must not cover.
   */
  reserved?: () => { readonly top: number; readonly bottom: number; readonly right: number };
  globeTransform?: Object3D;
  onNavigate?: (id: string) => void;
  /** The render facade's projection (WorldRenderer.project; altitude is a radius); preferred over the local fallback. */
  project?: (lon: number, lat: number, altitude: number, out: { x: number; y: number; visible: boolean }) => unknown;
  /**
   * [night-21a] D-268: the open hub board's box in the layer's coordinates, or null while it is closed (read every
   * frame, so return a cached object). Notes, rose names and edge chips keep off it; a rose under it steps back.
   */
  board?: () => { readonly l: number; readonly t: number; readonly r: number; readonly b: number } | null;
  /**
   * [night-30a] PLAN-LINORYT.md U2: the world's airport stamp on screen (E2: `WorldRenderer.projectAirport(id, out)`,
   * centre and half side, no allocation); returns false (or nothing) when it has none, and the Linoryt preview falls
   * back to the projected airport and LINORYT_STAMP_PX. Read only by the preview's note layout.
   */
  projectAirport?: (id: string, out: StampBox) => unknown;
}

interface BubbleEntry {
  airport: OverlayAirport;
  normal: Vector3;
  anchor: Vector3;
  bubble: HTMLDivElement;
  edge: HTMLButtonElement;
  /** [night-11d] Waiting-area gauge on the edge chip: track and fill, sized from `waiting.length / capacity`. */
  gauge: HTMLSpanElement;
  gaugeFill: HTMLSpanElement;
  /** [night-11d] Waiting places of the terminal (0 = unknown: no gauge). */
  capacity: number;
  lastGauge: string;
  timer: HTMLSpanElement;
  /** [night-10a] Ink "NEW" stub at the front of the tag while the airport is newly opened. */
  fresh: HTMLSpanElement;
  isNew: boolean;
  /** [night-24a] D-281: the NEW stub's layout width (0 without the mark), for the note's compact form. */
  freshWidth: number;
  /**
   * [night-10u] Glyph nodes kept per kind ("EUN", "EUN~" hollow) and reused on every rebuild, plus the "+N" count
   * and the children last written, so a passenger change edits only the nodes that differ.
   */
  glyphPool: Map<string, SVGSVGElement[]>;
  more: HTMLSpanElement;
  children: Node[];
  ariaLabel: string;
  /** [night-11m] D-128 code plate at the front of the tag, and whether this airport is a hub now. */
  plate: HTMLSpanElement;
  plateWidth: number;
  hub: boolean;
  /** [night-10h] Red-white boom-barrier stub while the night curfew closes the airport. */
  barrier: HTMLSpanElement;
  closed: boolean;
  /** [night-12bb] R2i: pennant stub with "+N HH:00" while a demand surge is announced or running; null hides it. */
  surgeStub: HTMLSpanElement;
  surgeText: HTMLSpanElement;
  surgeEdge: HTMLSpanElement;
  surge: SurgeMark | null;
  surgeWidth: number;
  /** [night-12bd] R2j: front-line stub with "−1 HH:MM" ahead of / under a weather front; null hides it. */
  frontStub: HTMLSpanElement;
  frontText: HTMLSpanElement;
  front: FrontMark | null;
  frontWidth: number;
  tag: TagSlot;
  /** [task-38] Departure-slot tag hung under the passenger tag (D-50). */
  slot: HTMLDivElement;
  slotLabel: HTMLSpanElement;
  slotTime: HTMLSpanElement;
  slotCount: HTMLSpanElement;
  slotRect: SlotTagRect;
  slotHeld: number;
  slotMinutes: number;
  mainWidth: number;
  slotVisible: boolean;
  lastSlotX: number;
  lastSlotY: number;
  waiting: readonly DestinationRegion[];
  /** [night-10i] Tail of `waiting` still inside the minimum connection time (drawn as hollow glyphs). */
  connecting: number;
  jamSeconds: number | null;
  /** [night-11af] R4c: last game hour's fill trend and its chevron nodes (one per direction, kept). */
  trend: FillTrend;
  trendUp: HTMLSpanElement;
  trendDown: HTMLSpanElement;
  /** [night-11x] R5h: edge chip state, placed by `placeEdgeChips` (`chips[i]` belongs to `slots[i]`). */
  chip: EdgeChip;
  bubbleVisible: boolean;
  lastBubbleX: number;
  lastBubbleY: number;
  lastEdgeX: number;
  lastEdgeY: number;
  lastEdgeSide: number;
  lastOpacity: number;
  /** [night-11az] D-257 Róża: the rose around the renderer's medallion (null in the Diorama comparison skin). */
  rose: Rose | null;
  /** The rose's box as a fixed obstacle for the note layout (inactive without a rose). */
  roseSlot: TagSlot;
  /** [night-16b] D-263: the rose's name as a fixed obstacle (the ring is `roseSlot`; inactive without a name). */
  nameSlot: TagSlot;
  /** [night-14b] D-259: what the rose shows along its ring this frame (name, code or nothing; rozaNameLayout). */
  roseLabel: RoseLabelMode;
  /** Screen position of the airport itself (the tag anchor is moved beside the rose for the note's layout). */
  screenX: number;
  screenY: number;
  /** [night-16a] D-262: the note shows its compact form (code and fill) this frame. */
  compact: boolean;
}

export interface AirportOverlay {
  readonly layer: HTMLDivElement;
  addAirport(airport: OverlayAirport): void;
  /** `connecting`: how many of the last `waiting` entries are transfers still making their connection. */
  setPassengers(id: string, waiting: readonly DestinationRegion[], connecting?: number): void;
  setJamCountdown(id: string, seconds: number | null): void;
  /** [night-11d] Waiting places of the terminal; the edge chip of an off-screen airport draws how many are taken. */
  setCapacity(id: string, capacity: number): void;
  /** [task-38] Aircraft held for a departure slot and game minutes to the next slot; held 0 hides the tag. */
  setSlotHold(id: string, held: number, minutes: number): void;
  /** [night-10a] Newly opened airport: ink "NEW" stub on its tag and an ink edge chip. */
  setNew(id: string, isNew: boolean): void;
  /** [night-10h] Closed by the night curfew: barrier stub on its tag and a striped bar on its edge chip. */
  setCurfew(id: string, closed: boolean): void;
  /**
   * [night-12bb] R2i, D-249: announced (hollow pennant, "+N" and the local start time) or running (filled pennant,
   * "+N to" the local end time) demand surge on the tag, and a pennant on the edge chip; null removes both.
   */
  setSurge(id: string, surge: SurgeMark | null): void;
  /**
   * [night-12bd] R2j: weather front ahead (hollow front line, "−1" and the local arrival time) or overhead (filled
   * front line, "−1 to" the local clearing time) on the tag; null removes it.
   */
  setFront(id: string, front: FrontMark | null): void;
  /**
   * [night-11af] R4c: chevron beside the passenger count, 'filling' (up) or 'emptying' (down); null hides it.
   * The game layer decides (≥ 50 % full, last game hour's balance beyond ±1); the overlay only draws it.
   */
  setFillTrend(id: string, trend: FillTrend): void;
  /** [night-11m] D-128: hubs always carry their code plate. */
  setHub(id: string, hub: boolean): void;
  /** [night-11m] D-128: zoomed in past the gameplay framing, every on-screen airport carries its code plate. */
  setZoomedIn(zoomedIn: boolean): void;
  update(): void;
  getPoolStats(): { airports: number; bubbles: number; slotTags: number; edgeButtons: number; domElements: number };
  dispose(): void;
}


/**
 * [night-11af] R4c: fill trend mark, a thin double chevron in the tag's text ink (paper on a jammed tag) behind a
 * hairline, so it never reads as a passenger: the Northern Europe glyph is a solid single V. Up and down differ by
 * shape, never by colour alone. 3 px gap + 1.5 px hairline + 3 px pad + 9 px mark: TREND_WIDTH in the tag width sum.
 */
const TREND_WIDTH = 17;
function trendChevron(up: boolean): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'airport-bubble__trend airport-bubble__trend--' + (up ? 'up' : 'down');
  span.dataset.trend = up ? 'filling' : 'emptying';
  span.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 9 12');
  svg.setAttribute('width', '9');
  svg.setAttribute('height', '12');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', up ? 'M1 6 4.5 2.5 8 6M1 10.5 4.5 7 8 10.5' : 'M1 1.5 4.5 5 8 1.5M1 6 4.5 9.5 8 6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'square');
  path.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(path);
  span.appendChild(svg);
  return span;
}

function placeEl(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate3d(${x}px,${y}px,0)`;
}

function updateVisibility(el: HTMLElement, visible: boolean): void { if (el.hidden === visible) el.hidden = !visible; }

/** Single SVG, shared design with the airport wayfinding direction. */
function arrow(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M3 8 H13 M8 3 L13 8 L8 13');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.4');
  path.setAttribute('stroke-linecap', 'square');
  svg.appendChild(path);
  return svg;
}

/** [task-38] Slot mark: a clock face over a runway threshold bar, drawn in currentColor (no emoji). */
function slotClock(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('airport-slot__mark');
  const face = document.createElementNS(SVG, 'circle');
  face.setAttribute('cx', '8');
  face.setAttribute('cy', '7');
  face.setAttribute('r', '5.2');
  face.setAttribute('fill', 'none');
  face.setAttribute('stroke', 'currentColor');
  face.setAttribute('stroke-width', '1.8');
  const hands = document.createElementNS(SVG, 'path');
  hands.setAttribute('d', 'M8 4 V7 H10.6 M2 15 H14');
  hands.setAttribute('fill', 'none');
  hands.setAttribute('stroke', 'currentColor');
  hands.setAttribute('stroke-width', '1.8');
  hands.setAttribute('stroke-linecap', 'square');
  svg.append(face, hands);
  return svg;
}

/** [task-38] Fixed glyph widths (px) so the layout box matches the CSS width exactly. */
const SLOT_STUB = 22;
const SLOT_LABEL_CHAR = 7.4;
const SLOT_DIGIT = 7.4;
/** [night-10a] "NEW" stub: fixed per-letter width plus padding, so the layout box matches the CSS width. */
const NEW_CHAR = 7.6;
/** [night-10h] Barrier stub: 26 px mark + 2 px margin + 4 px gap, as laid out by .airport-bubble__curfew. */
const BARRIER_WIDTH = 32;
/** The boom barrier the globe draws on a closed airport, same drawing as the puzzle strips (N7d). [night-11aq] Inks are
 * skin tokens (src/ui/skin/current.css); the SVG is inline in the tag, so the custom properties resolve. */
const BARRIER_SVG = '<svg viewBox="0 0 22 12" width="26" height="14" aria-hidden="true" focusable="false">' +
  '<rect x="1" y="2" width="3" height="9" style="fill:var(--skin-tag-barrier-post)"/>' +
  '<rect x="4" y="3" width="17" height="4" style="fill:var(--skin-tag-barrier-boom);stroke:var(--skin-tag-barrier-post)" stroke-width="1"/>' +
  '<path d="M7 3h3l-2 4H5zM13 3h3l-2 4h-3zM19 3h2v1.6L20 7h-3z" style="fill:var(--skin-tag-barrier-stripe)"/></svg>';
const NEW_PAD = 10;
/**
 * [night-12bb] R2i: surge stub: 12 px pennant + 3 px gap + mono 12 px text (fixed advance) + padding + 2 px margin,
 * as laid out by .airport-bubble__surge. A floor (min-width), so a wider translation grows the stub.
 */
const SURGE_CHAR = 7.2;
const SURGE_FIXED = 12 + 3 + 10 + 2;
/**
 * A pennant on a pole: the shape says "announcement" without colour. Hollow while announced, filled while running.
 * `phase` picks the fill; the outline and the pole are the same, so the two read as one sign in two states.
 */
function pennant(filled: boolean): string {
  return '<svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true" focusable="false">' +
    '<rect x="1" y="1" width="1.6" height="14" fill="currentColor"/>' +
    `<path d="M2.6 1.8 L11 5.3 L2.6 8.8 Z" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
/**
 * [night-12bd] R2j: front stub: 16 px front line + 3 px gap + mono 12 px text + padding + 2 px margin, as laid out by
 * .airport-bubble__front (a floor, like the surge stub).
 */
const FRONT_FIXED = 16 + 3 + 10 + 2;
/**
 * The weather-map cold-front line: a rule with three teeth on its leading side. The shape (not the colour) says
 * "front"; hollow teeth while it is forecast, filled while the airport is under it.
 */
function frontLine(filled: boolean): string {
  return '<svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true" focusable="false">' +
    '<rect x="0" y="9" width="16" height="1.6" fill="currentColor"/>' +
    `<path d="M1.5 9 L4 4 L6.5 9 Z M6.75 9 L9.25 4 L11.75 9 Z M12 9 L14.5 4 L16 7 L16 9 Z" fill="${filled ? 'currentColor' : 'none'}" ` +
    'stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
}
/** [night-11m] Code plate: Overpass Mono 12 px (fixed advance) plus padding and the divider, as in overlay.css. */
const PLATE_CHAR = 7.2;
const PLATE_PAD = 9;

/** [night-10i] A transfer passenger still inside the minimum connection time: the region glyph drawn hollow. */
function connectingGlyph(region: DestinationRegion): SVGSVGElement {
  const svg = regionGlyph(region);
  svg.classList.add('airport-region-glyph--connecting');
  const path = svg.firstElementChild;
  if (path) {
    (path as SVGElement).style.fill = 'var(--skin-tag-glyph-hollow)'; // [night-11aq] skin token (src/ui/skin/current.css)
    (path as SVGElement).style.stroke = REGIONS[region].color; // [night-11as] beats regionGlyph's inline outline
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    path.removeAttribute('paint-order');
  }
  return svg;
}

export function createAirportOverlay(host: HTMLElement, camera: Camera, options: AirportOverlayOptions = {}): AirportOverlay {
  const layer = document.createElement('div');
  layer.className = 'airport-overlay';
  host.appendChild(layer);
  const entries: BubbleEntry[] = [];
  const slots: TagSlot[] = [];
  // [night-11az] D-257 Róża: the tags plus one fixed obstacle per airport rose, so a note never covers a rose.
  const layoutSlots: TagSlot[] = [];
  const roseLabels: RoseLabel[] = []; // [night-14b] D-259: this frame's roses in view, for rozaNameLayout
  const roseEntries: BubbleEntry[] = [];
  // [night-16a] D-262: the Róża dock symbols as fixed obstacles for the notes (filled by rozaDockObstacles).
  const dockSlots: TagSlot[] = skin.roza ? Array.from({ length: 8 }, (_, i) => ({ id: 'dock~' + i, anchorX: 0, anchorY: 0, width: 0,
    height: 0, active: false, jammed: false, fixed: true, x: 0, y: 0, placed: false })) : [];
  layoutSlots.push(...dockSlots);
  // [night-21a] D-268: the open hub board as a fixed obstacle no note ever covers (rank Infinity, as the dock).
  const boardSlot: TagSlot = { id: 'board~', anchorX: 0, anchorY: 0, width: 0, height: 0, active: false, jammed: false,
    fixed: true, rank: Infinity, x: 0, y: 0, placed: false };
  layoutSlots.push(boardSlot);
  // [night-30a] D-284 U2: the Linoryt top margin as a fixed obstacle (in landscape a block in the top-left corner).
  if (import.meta.env.DEV && linoryt.on) layoutSlots.push(linorytMarginSlot(host));
  // [night-30a] U2: the DEV probe of the browser audits (where the notes' layout puts each stamp).
  if (import.meta.env.DEV && linoryt.on) linorytProbe(() => slots.map(linorytStampProbe));
  const boardBlocked: { l: number; t: number; r: number; b: number }[] = [];
  const chips: EdgeChip[] = []; // [night-11x] parallel to `slots`
  const byId = new Map<string, BubbleEntry>();
  const marker = new Vector3();
  const transformedNormal = new Vector3();
  const cameraPosition = new Vector3();
  const toCamera = new Vector3();
  const projected = { x: 0, y: 0, visible: false };
  const bounds: TagBounds = { width: host.clientWidth, height: host.clientHeight, top: 0, bottom: 0, gap: 4 };
  // [night-08b] The right band (landscape dock) applies to edge chips only; tag layout keeps using `bounds`.
  const edgeBounds: EdgeBounds = { width: host.clientWidth, height: host.clientHeight, top: 0, bottom: 0, right: 0 };
  let zoomedIn = false; // [night-11m] D-128
  const radius = options.radius ?? 1;
  let disposed = false;
  let width = Math.max(1, host.clientWidth);
  let height = Math.max(1, host.clientHeight);
  const refreshSize = (): void => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshSize);
  observer?.observe(host);
  window.addEventListener('resize', refreshSize);

  function get(id: string): BubbleEntry {
    const entry = byId.get(id);
    if (!entry || disposed) throw new RangeError('Unknown airport overlay ID: ' + id);
    return entry;
  }

  /** [night-10u] The nth glyph of one kind in this rebuild: an existing node from the pool, or a new one. */
  function pooledGlyph(entry: BubbleEntry, region: DestinationRegion, hollow: boolean, used: Map<string, number>): SVGSVGElement {
    const key = hollow ? region + '~' : region;
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    let list = entry.glyphPool.get(key);
    if (!list) { list = []; entry.glyphPool.set(key, list); }
    return list[n] ??= hollow ? connectingGlyph(region) : regionGlyph(region);
  }

  const usedKinds = new Map<string, number>();
  const nextChildren: Node[] = [];

  function rebuildBubble(entry: BubbleEntry): void {
    const bubble = entry.bubble;
    const want = nextChildren;
    want.length = 0;
    usedKinds.clear();
    const limit = Math.min(MAX_GLYPHS, entry.waiting.length);
    const jammedNow = entry.jamSeconds !== null;
    // [night-11m] D-128: the plate names the airport wherever the UI speaks of it (hub, jam countdown, NEW stub, slot
    // hold, curfew) and on every airport once the player zooms in; otherwise the disc stays unlabelled.
    // [night-11az] D-257: Róża names every airport (the note beside its rose).
    const plated = skin.roza || zoomedIn || entry.hub || jammedNow || entry.isNew ||
      entry.slotHeld > 0 || entry.closed || entry.surge !== null || entry.front !== null;
    if (plated) want.push(entry.plate);
    let freshWidth = 0;
    if (entry.isNew) {
      const label = t('airport.new');
      if (entry.fresh.textContent !== label) entry.fresh.textContent = label;
      freshWidth = Math.ceil(NEW_PAD + label.length * NEW_CHAR);
      // [night-11ac] R7h: a floor, not a cap — a translation with wide letters (W, M, accents) grows the stub instead of clipping.
      entry.fresh.style.minWidth = freshWidth + 'px';
      want.push(entry.fresh);
    }
    entry.freshWidth = freshWidth;
    if (entry.closed) want.push(entry.barrier);
    if (entry.surge) want.push(entry.surgeStub); // [night-12bb] R2i
    if (entry.front) want.push(entry.frontStub); // [night-12bd] R2j
    // [night-10i] Transfers still inside the connection time are drawn hollow: the same shape, not yet "boardable".
    // When the tag overflows, at most half of the shown glyphs are hollow so ready passengers stay visible.
    const total = entry.waiting.length;
    const hollow = Math.min(entry.connecting, total > MAX_GLYPHS ? Math.ceil(limit / 2) : limit);
    for (let i = 0; i < limit - hollow; i++) want.push(pooledGlyph(entry, entry.waiting[i], false, usedKinds));
    for (let i = total - hollow; i < total; i++) want.push(pooledGlyph(entry, entry.waiting[i], true, usedKinds));
    if (entry.waiting.length > MAX_GLYPHS) {
      const more = '+' + (entry.waiting.length - MAX_GLYPHS);
      if (entry.more.textContent !== more) entry.more.textContent = more;
      want.push(entry.more);
    }
    // [night-11af] R4c: the trend chevron sits right after the count (the "+N" or the last glyph).
    const trendNode = entry.trend === 'filling' ? entry.trendUp : entry.trend === 'emptying' ? entry.trendDown : null;
    if (trendNode && entry.waiting.length > 0) want.push(trendNode);
    want.push(entry.timer);
    // [night-11az] D-257 Róża: "14 z 24" after the code, one glyph per region with a count, the jam sentence.
    if (skin.roza) {
      usedKinds.clear();
      rozaNoteChildren(bubble, want, plated ? entry.plate : null, entry.waiting, entry.connecting, entry.capacity,
        limit * 18 + (entry.waiting.length > MAX_GLYPHS ? 27 : 0), Math.max(60, bounds.width - (entry.jamSeconds !== null ? 230 : 210)), entry.jamSeconds,
        (region, hollowGlyph) => pooledGlyph(entry, region, hollowGlyph, usedKinds));
    }
    // [night-30a] D-284 U2 Linoryt preview: the printed note (name, fill bar of cut ticks, glyphs with counts, jam block).
    if (import.meta.env.DEV && linoryt.on) {
      usedKinds.clear();
      linorytNoteChildren(bubble, want, {
        name: entry.airport.name ?? entry.airport.code, code: entry.airport.code, hub: entry.hub, waiting: entry.waiting,
        connecting: entry.connecting, capacity: entry.capacity, jamSeconds: entry.jamSeconds, fresh: entry.isNew ? entry.fresh : null,
        stubs: [...(entry.closed ? [entry.barrier] : []), ...(entry.surge ? [entry.surgeStub] : []), ...(entry.front ? [entry.frontStub] : [])],
        stubsWidth: (entry.closed ? BARRIER_WIDTH : 0) + (entry.surge ? entry.surgeWidth : 0) + (entry.front ? entry.frontWidth : 0),
        trend: trendNode, trendWidth: TREND_WIDTH, timer: entry.timer, room: Math.max(90, bounds.width - 190),
        glyph: (region, hollowGlyph) => pooledGlyph(entry, region, hollowGlyph, usedKinds),
      });
    }
    // [night-10u] Write only where the child list differs from the last rebuild (most changes touch one glyph).
    const last = entry.children;
    let same = last.length === want.length;
    for (let i = 0; same && i < want.length; i++) same = last[i] === want[i];
    if (!same) {
      for (let i = 0; i < want.length; i++) {
        const current = bubble.childNodes[i] ?? null;
        if (current !== want[i]) bubble.insertBefore(want[i]!, current);
      }
      while (bubble.childNodes.length > want.length) bubble.lastChild!.remove();
      entry.children = want.slice();
    }
    const jammed = entry.jamSeconds !== null;
    bubble.classList.toggle('airport-bubble--jam', jammed);
    entry.edge.classList.toggle('airport-edge--jam', jammed);
    entry.tag.jammed = jammed;
    // [task-38] mainWidth 0 = no passenger tag; the group box also holds the slot tag.
    const surged = entry.surge !== null; // [night-12bb] R2i
    const fronted = entry.front !== null; // [night-12bd] R2j
    const plateOnly = plated && !(entry.waiting.length > 0 || jammed || entry.isNew || entry.closed || surged || fronted);
    bubble.classList.toggle('airport-bubble--plate-only', plateOnly);
    entry.tag.minor = plateOnly; // a plate never takes the place of a passenger tag
    entry.mainWidth = entry.waiting.length > 0 || jammed || entry.isNew || entry.closed || surged || fronted || plated
      ? Math.max(30, 23 + limit * 18 + (entry.waiting.length > MAX_GLYPHS ? 27 : 0) + (jammed ? 53 : 0) +
        (freshWidth ? freshWidth + (limit || jammed ? 4 : 0) : 0) + (entry.closed ? BARRIER_WIDTH : 0) +
        (surged ? entry.surgeWidth : 0) + (fronted ? entry.frontWidth : 0) +
        (trendNode && entry.waiting.length > 0 ? TREND_WIDTH : 0) +
        (plated ? entry.plateWidth - (plateOnly ? 8 : 0) : 0)) : 0;
    if (skin.roza && entry.mainWidth > 0) entry.mainWidth = Math.max(entry.mainWidth + rozaExtraWidth(bubble), rozaJamWidth(bubble)); // [night-11az]
    // [night-30a] D-284 U2: every airport prints its note (name and fill bar at least); an empty one is placed last.
    if (import.meta.env.DEV && linoryt.on) {
      entry.mainWidth = linorytNoteSize(bubble).width;
      entry.tag.minor = !(entry.waiting.length > 0 || jammed || entry.isNew || entry.closed || surged || fronted);
    }
    bubble.classList.toggle('airport-bubble--new', entry.isNew);
    entry.edge.classList.toggle('airport-edge--new', entry.isNew && !jammed);
    entry.edge.classList.toggle('airport-edge--curfew', entry.closed && !jammed); // [night-10h]
    entry.edge.classList.toggle('airport-edge--surge', surged); // [night-12bb] R2i
    entry.surgeEdge.hidden = !surged;
    const surgeAria = entry.surge ? t(entry.surge.phase === 'active' ? 'airport.surgeActiveAria' : 'airport.surgeSoonAria',
      { code: entry.airport.code, count: entry.surge.passengers, time: entry.surge.time }) : '';
    const frontAria = entry.front ? t(entry.front.phase === 'under' ? 'airport.frontUnderAria' : 'airport.frontSoonAria',
      { code: entry.airport.code, minutes: entry.front.minutes, time: entry.front.time }) : ''; // [night-12bd] R2j
    const taken = Math.min(entry.waiting.length, entry.capacity);
    const edgeAria = t('airport.focus', { code: entry.airport.code }) +
      (entry.closed ? ' ' + t('airport.curfewAria', { code: entry.airport.code }) : '') +
      (surgeAria ? ' ' + surgeAria : '') + (frontAria ? ' ' + frontAria : '') +
      (taken > 0 && entry.capacity > 0 ? ' ' + t('airport.edgeFillAria', { count: taken, capacity: entry.capacity }) : '');
    if (entry.edge.getAttribute('aria-label') !== edgeAria) entry.edge.setAttribute('aria-label', edgeAria);
    rebuildGauge(entry, taken);
    sizeGroup(entry);
    entry.timer.hidden = !jammed;
    if (jammed) {
      const seconds = Math.max(0, Math.ceil(entry.jamSeconds ?? 0));
      entry.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const label = jammed ? t('airport.jammed', { code: entry.airport.code, seconds: Math.ceil(entry.jamSeconds ?? 0) }) : t('airport.waiting', { code: entry.airport.code, count: entry.waiting.length });
    const aria = (entry.isNew ? t('airport.newAria', { code: entry.airport.code }) + ' ' : '') +
      (entry.closed ? t('airport.curfewAria', { code: entry.airport.code }) + ' ' : '') +
      (surgeAria ? surgeAria + ' ' : '') + (frontAria ? frontAria + ' ' : '') + label +
      (entry.connecting > 0 ? ' ' + t('airport.connectingAria', { count: entry.connecting }) : '') +
      (trendNode && entry.waiting.length > 0 ? ' ' + t(entry.trend === 'filling' ? 'airport.trendFillingAria' : 'airport.trendEmptyingAria') : '');
    if (aria !== entry.ariaLabel) { bubble.setAttribute('aria-label', aria); entry.ariaLabel = aria; }
    bubble.classList.toggle('airport-bubble--connecting', entry.connecting > 0);
  }

  /**
   * [night-11d] An off-screen airport used to show only its code until its waiting area was already full (red chip,
   * 45 s of grace). The chip now carries a gauge under the code: its length is the share of waiting places taken
   * (readable without colour); from three quarters full the fill turns signal red. Hidden while nobody waits.
   */
  function rebuildGauge(entry: BubbleEntry, taken: number): void {
    const show = taken > 0 && entry.capacity > 0;
    const percent = show ? Math.max(8, Math.round(taken * 100 / entry.capacity)) : 0;
    const high = show && taken * 4 >= entry.capacity * 3;
    const key = show ? `${taken}/${entry.capacity}` : '';
    if (key === entry.lastGauge) return;
    entry.lastGauge = key;
    entry.gauge.hidden = !show;
    entry.edge.classList.toggle('airport-edge--gauge', show);
    entry.gauge.classList.toggle('airport-edge__gauge--high', high);
    entry.gaugeFill.style.width = percent + '%';
    entry.edge.dataset.fill = show ? `${taken}/${entry.capacity}` : '';
  }

  /** The note's layout box; [night-11az] D-257 Róża: a jam adds its sentence as a second line under the note. */
  function sizeGroup(entry: BubbleEntry): void {
    sizeTagGroup(entry.tag, entry.mainWidth, entry.slotRect);
    if (skin.roza && entry.mainWidth > 0 && entry.jamSeconds !== null) entry.tag.height += ROZA_JAM_LINE;
    // [night-30a] D-284 U2: the printed note's own height, the slot tag hung under it.
    if (import.meta.env.DEV && linoryt.on && entry.mainWidth > 0) {
      entry.tag.height = linorytNoteSize(entry.bubble).height + (entry.slotRect.width > 0 ? SLOT_TAG_GAP + SLOT_TAG_HEIGHT : 0);
    }
  }

  /** [task-38] Rebuild the slot tag text only when the held count or the countdown changes. */
  function rebuildSlot(entry: BubbleEntry): void {
    const held = entry.slotHeld > 0;
    if (held) {
      const label = t('airport.slot.label');
      const time = slotCountdownText(entry.slotMinutes);
      const count = entry.slotHeld > 1 ? '\u00d7' + entry.slotHeld : '';
      entry.slotLabel.textContent = label;
      entry.slotTime.textContent = time;
      entry.slotCount.textContent = count;
      entry.slotCount.hidden = count === '';
      entry.slotRect.width = Math.ceil(SLOT_STUB + 6 + label.length * SLOT_LABEL_CHAR + 5 + time.length * SLOT_DIGIT +
        (count ? 4 + count.length * SLOT_DIGIT : 0) + 9);
      entry.slot.style.width = entry.slotRect.width + 'px';
      entry.slot.setAttribute('aria-label', t('airport.slotHeld', { code: entry.airport.code, count: entry.slotHeld, time }));
    } else {
      entry.slotRect.width = 0;
    }
    if (held !== entry.plate.isConnected) rebuildBubble(entry); // [night-11m] a slot hold names the airport
    sizeGroup(entry);
  }

  return {
    layer,
    addAirport(airport): void {
      if (disposed) throw new Error('Airport overlay is disposed');
      if (!airport.id || byId.has(airport.id) || !Number.isFinite(airport.lon) || !Number.isFinite(airport.lat) || Math.abs(airport.lat) > 90 || Math.abs(airport.lon) > 180) {
        throw new RangeError('Invalid or duplicate airport overlay entry');
      }
      const phi = airport.lat * DEG;
      const lambda = airport.lon * DEG;
      const normal = new Vector3(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda));
      const anchor = normal.clone().multiplyScalar(radius * (airport.hub ? 1.075 : 1.045));
      const bubble = document.createElement('div');
      bubble.className = 'airport-bubble';
      bubble.dataset.airport = airport.id; // [night-11m] which airport a tag belongs to (E2E, DEV checks)
      bubble.hidden = true;
      bubble.setAttribute('role', 'img');
      const timer = document.createElement('span');
      timer.className = 'airport-bubble__timer';
      const fresh = document.createElement('span');
      fresh.className = 'airport-bubble__new';
      // [night-11m] D-128 code plate; the tag's role="img" label already names the airport for assistive tech.
      const plate = document.createElement('span');
      plate.className = 'airport-bubble__plate';
      plate.setAttribute('aria-hidden', 'true');
      const plateText = airport.label ?? airport.code;
      plate.textContent = plateText;
      const plateWidth = Math.ceil(PLATE_PAD + plateText.length * PLATE_CHAR);
      plate.style.width = plateWidth + 'px';
      const barrier = document.createElement('span');
      barrier.className = 'airport-bubble__curfew';
      barrier.innerHTML = BARRIER_SVG;
      // [night-12bb] R2i: surge stub (pennant + text) and the edge chip's pennant, hidden until a surge is set.
      const surgeStub = document.createElement('span');
      surgeStub.className = 'airport-bubble__surge';
      surgeStub.setAttribute('aria-hidden', 'true');
      const surgeFlag = document.createElement('span');
      surgeFlag.className = 'airport-bubble__pennant';
      const surgeText = document.createElement('span');
      surgeText.className = 'airport-bubble__surge-text';
      surgeStub.append(surgeFlag, surgeText);
      const surgeEdge = document.createElement('span');
      surgeEdge.className = 'airport-edge__surge';
      surgeEdge.hidden = true;
      surgeEdge.setAttribute('aria-hidden', 'true');
      // [night-12bd] R2j: weather-front stub (front line + text), hidden until a front is set.
      const frontStub = document.createElement('span');
      frontStub.className = 'airport-bubble__front';
      frontStub.setAttribute('aria-hidden', 'true');
      const frontIcon = document.createElement('span');
      frontIcon.className = 'airport-bubble__front-line';
      const frontText = document.createElement('span');
      frontText.className = 'airport-bubble__front-text';
      frontStub.append(frontIcon, frontText);
      const more = document.createElement('span');
      more.className = 'airport-bubble__count';
      const edge = document.createElement('button');
      edge.type = 'button';
      edge.className = 'airport-edge';
      edge.hidden = true;
      edge.setAttribute('aria-label', t('airport.focus', { code: airport.code }));
      const gauge = document.createElement('span');
      gauge.className = 'airport-edge__gauge';
      gauge.hidden = true;
      gauge.setAttribute('aria-hidden', 'true');
      const gaugeFill = document.createElement('span');
      gaugeFill.className = 'airport-edge__fill';
      gauge.appendChild(gaugeFill);
      edge.append(arrow(), document.createTextNode(airport.code), gauge, surgeEdge);
      edge.addEventListener('click', () => options.onNavigate?.(airport.id));
      // [task-38] Slot tag: stub with the clock mark, "SLOT" label, h:mm countdown, optional ×N.
      const slot = document.createElement('div');
      slot.className = 'airport-slot';
      slot.hidden = true;
      slot.setAttribute('role', 'img');
      const stub = document.createElement('span');
      stub.className = 'airport-slot__stub';
      stub.appendChild(slotClock());
      const slotLabel = document.createElement('span');
      slotLabel.className = 'airport-slot__label';
      const slotTime = document.createElement('span');
      slotTime.className = 'airport-slot__time';
      const slotCount = document.createElement('span');
      slotCount.className = 'airport-slot__count';
      slotCount.hidden = true;
      slot.append(stub, slotLabel, slotTime, slotCount);
      layer.append(bubble, slot, edge);
      const chip: EdgeChip = { offscreen: false, jammed: false, side: 0, x: 0, y: 0, placed: false };
      const tag: TagSlot = { id: airport.id, anchorX: 0, anchorY: 0, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false };
      const entry: BubbleEntry = {
        airport, normal, anchor, bubble, edge, gauge, gaugeFill, capacity: 0, lastGauge: '', timer, fresh, isNew: false, freshWidth: 0, barrier, closed: false, tag,
        surgeStub, surgeText, surgeEdge, surge: null, surgeWidth: 0,
        frontStub, frontText, front: null, frontWidth: 0,
        plate, plateWidth, hub: airport.hub === true,
        glyphPool: new Map(), more, children: [], ariaLabel: '',
        slot, slotLabel, slotTime, slotCount, slotRect: { width: 0, x: 0, y: 0, visible: false }, slotHeld: 0, slotMinutes: 0,
        mainWidth: 0, slotVisible: false, lastSlotX: NaN, lastSlotY: NaN,
        waiting: [], connecting: 0, jamSeconds: null,
        trend: null, trendUp: trendChevron(true), trendDown: trendChevron(false),
        chip, bubbleVisible: false,
        lastBubbleX: NaN, lastBubbleY: NaN, lastEdgeX: NaN, lastEdgeY: NaN, lastEdgeSide: -1, lastOpacity: NaN,
        rose: skin.roza ? rozaRose(layer) : null, screenX: 0, screenY: 0,
        roseSlot: { id: airport.id + '~rose', anchorX: 0, anchorY: 0, width: 0, height: 0, active: false, jammed: false, fixed: true, x: 0, y: 0, placed: false },
        nameSlot: { id: airport.id + '~name', anchorX: 0, anchorY: 0, width: 0, height: 0, active: false, jammed: false, fixed: true, x: 0, y: 0, placed: false },
        roseLabel: 'name', compact: false,
      };
      entries.push(entry);
      slots.push(tag);
      layoutSlots.push(tag);
      if (import.meta.env.DEV && linoryt.on) layoutSlots.push(linorytStampSlot(tag)); // [night-30a] U2: the stamp, a fixed obstacle
      if (entry.rose) layoutSlots.push(entry.roseSlot, entry.nameSlot);
      chips.push(chip);
      byId.set(airport.id, entry);
      rebuildBubble(entry);
    },
    setPassengers(id, waiting, connecting = 0): void {
      const entry = get(id);
      for (const region of waiting) if (!isValidRegion(region)) throw new RangeError('Invalid destination region: ' + region);
      if (!Number.isSafeInteger(connecting) || connecting < 0 || connecting > waiting.length) {
        throw new RangeError('Invalid connecting count');
      }
      entry.waiting = waiting.slice();
      entry.connecting = connecting;
      rebuildBubble(entry);
    },
    setFillTrend(id, trend): void {
      const entry = get(id);
      if (trend !== null && trend !== 'filling' && trend !== 'emptying') throw new RangeError('Invalid fill trend');
      if (entry.trend === trend) return;
      entry.trend = trend;
      rebuildBubble(entry);
    },
    setJamCountdown(id, seconds): void {
      const entry = get(id);
      if (seconds !== null && (!Number.isFinite(seconds) || seconds < 0)) throw new RangeError('Invalid jam countdown');
      if (entry.jamSeconds === seconds) return;
      entry.jamSeconds = seconds;
      rebuildBubble(entry);
    },
    setCapacity(id, capacity): void {
      const entry = get(id);
      if (!Number.isSafeInteger(capacity) || capacity < 0) throw new RangeError('Invalid waiting capacity');
      if (entry.capacity === capacity) return;
      entry.capacity = capacity;
      rebuildBubble(entry);
    },
    setSlotHold(id, held, minutes): void {
      const entry = get(id);
      if (!Number.isSafeInteger(held) || held < 0 || !Number.isFinite(minutes) || minutes < 0) throw new RangeError('Invalid slot hold');
      const nextMinutes = held > 0 ? Math.ceil(minutes) : 0;
      if (entry.slotHeld === held && entry.slotMinutes === nextMinutes) return;
      entry.slotHeld = held;
      entry.slotMinutes = nextMinutes;
      rebuildSlot(entry);
    },
    setCurfew(id, closed): void {
      const entry = get(id);
      if (entry.closed === closed) return;
      entry.closed = closed;
      rebuildBubble(entry);
    },
    setSurge(id, surge): void {
      const entry = get(id);
      if (surge !== null && ((surge.phase !== 'announced' && surge.phase !== 'active') ||
          !Number.isSafeInteger(surge.passengers) || surge.passengers < 1 || !/^\d\d:\d\d$/.test(surge.time))) {
        throw new RangeError('Invalid surge mark');
      }
      const prev = entry.surge;
      if (prev === surge || (prev && surge && prev.phase === surge.phase && prev.passengers === surge.passengers && prev.time === surge.time)) return;
      entry.surge = surge ? { ...surge } : null;
      if (surge) {
        const text = t(surge.phase === 'active' ? 'airport.surgeActive' : 'airport.surgeSoon', { count: surge.passengers, time: surge.time });
        entry.surgeText.textContent = text;
        entry.surgeWidth = Math.ceil(SURGE_FIXED + text.length * SURGE_CHAR);
        entry.surgeStub.style.minWidth = (entry.surgeWidth - 2) + 'px';
        entry.surgeStub.dataset.phase = surge.phase;
        (entry.surgeStub.firstElementChild as HTMLElement).innerHTML = pennant(surge.phase === 'active');
        entry.surgeEdge.innerHTML = pennant(surge.phase === 'active');
      } else {
        entry.surgeWidth = 0;
      }
      rebuildBubble(entry);
    },
    setFront(id, front): void {
      const entry = get(id);
      if (front !== null && ((front.phase !== 'ahead' && front.phase !== 'under') ||
          !Number.isSafeInteger(front.minutes) || front.minutes < 1 || !/^\d\d:\d\d$/.test(front.time))) {
        throw new RangeError('Invalid front mark');
      }
      const prev = entry.front;
      if (prev === front || (prev && front && prev.phase === front.phase && prev.minutes === front.minutes && prev.time === front.time)) return;
      entry.front = front ? { ...front } : null;
      if (front) {
        const text = t(front.phase === 'under' ? 'airport.frontUnder' : 'airport.frontSoon', { minutes: front.minutes, time: front.time });
        entry.frontText.textContent = text;
        entry.frontWidth = Math.ceil(FRONT_FIXED + text.length * SURGE_CHAR);
        entry.frontStub.style.minWidth = (entry.frontWidth - 2) + 'px';
        entry.frontStub.dataset.phase = front.phase;
        (entry.frontStub.firstElementChild as HTMLElement).innerHTML = frontLine(front.phase === 'under');
      } else {
        entry.frontWidth = 0;
      }
      rebuildBubble(entry);
    },
    setHub(id, hub): void {
      const entry = get(id);
      if (entry.hub === hub) return;
      entry.hub = hub;
      rebuildBubble(entry);
    },
    setZoomedIn(next): void {
      if (zoomedIn === next || disposed) return;
      zoomedIn = next;
      for (const entry of entries) rebuildBubble(entry);
    },
    setNew(id, isNew): void {
      const entry = get(id);
      if (entry.isNew === isNew) return;
      entry.isNew = isNew;
      rebuildBubble(entry);
    },
    update(): void {
      if (disposed) return;
      camera.updateMatrixWorld();
      const cam = camera.matrixWorld.elements;
      cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      const transform = options.globeTransform;
      if (transform) transform.updateWorldMatrix(true, false);
      bounds.width = width;
      bounds.height = height;
      const live = options.reserved?.();
      bounds.top = live ? live.top : options.reservedTop ?? 72;
      bounds.bottom = live ? live.bottom : options.reservedBottom ?? 92;
      // [night-11az] D-257 Róża: in landscape the dock arc's captions reach about twice the dock band into the screen;
      // notes stay left of them.
      if (skin.roza && live && live.right > 0) bounds.width = Math.max(120, width - live.right * 2);
      edgeBounds.width = width;
      edgeBounds.height = height;
      edgeBounds.top = bounds.top;
      edgeBounds.bottom = bounds.bottom;
      // [night-23a] Róża: the edge buttons keep left of the same arc band as the notes; the Diorama column width (96)
      // let a button sit on the arc's hub symbol in landscape (e2e/edge-dock.mjs at 915 × 412).
      edgeBounds.right = live ? (skin.roza && live.right > 0 ? live.right * 2 : live.right) : 0;
      const board = options.board?.() ?? null;
      boardSlot.active = board !== null;
      boardBlocked.length = 0;
      if (board) {
        boardSlot.x = board.l;
        boardSlot.y = board.t;
        boardSlot.width = board.r - board.l;
        boardSlot.height = board.b - board.t;
        boardBlocked.push(board);
      }
      // [night-30a] D-284 U2: the Linoryt paper margins (top margin, dock) bound the notes and the edge chips.
      if (import.meta.env.DEV && linoryt.on) linorytFrameStart(host, width, height, bounds, edgeBounds);
      for (const entry of entries) {
        marker.copy(entry.anchor);
        transformedNormal.copy(entry.normal);
        if (transform) {
          marker.applyMatrix4(transform.matrixWorld);
          transformedNormal.transformDirection(transform.matrixWorld);
        }
        let x: number;
        let y: number;
        let front: boolean;
        if (options.project && !transform) {
          options.project(entry.airport.lon, entry.airport.lat, entry.airport.hub ? 1.075 : 1.045, projected);
          x = projected.x;
          y = projected.y;
          front = projected.visible;
        } else {
          toCamera.subVectors(cameraPosition, marker);
          front = transformedNormal.dot(toCamera) > 0;
          marker.project(camera);
          x = (marker.x + 1) * width / 2;
          y = (1 - marker.y) * height / 2;
          front = front && marker.z >= -1 && marker.z <= 1;
        }
        // Only the viewport edge hides a tag; HUD clearance is handled by layoutTags(bounds).
        const inView = front && x >= 10 && x <= width - 10 && y >= 10 && y <= height - 10;
        // [night-21a] D-268: an airport under the open hub board shows no note (the board is drawn over it).
        const underBoard = board !== null && inView && x > board.l - 2 && x < board.r + 2 && y > board.t - 2 && y < board.b + 2;
        entry.tag.active = inView && !underBoard && (entry.mainWidth > 0 || entry.slotRect.width > 0); // [task-38]
        entry.tag.anchorX = x;
        entry.tag.anchorY = y;
        entry.screenX = x;
        entry.screenY = y;
        if (entry.rose) {
          // [night-11az] D-257 Róża: the rose rings the renderer's medallion; its inner radius is the medallion's
          // footprint projected here (the larger of a north and an east offset, so a limb airport keeps its size).
          let r = entry.hub ? 18 : 12;
          if (inView && options.project && !transform) {
            const angle = entry.hub ? MEDAL_RADIUS.hub : MEDAL_RADIUS.airport;
            const lat = entry.airport.lat, alt = entry.airport.hub ? 1.075 : 1.045;
            options.project(entry.airport.lon, lat + (lat > 80 ? -1 : 1) * angle / DEG, alt, projected);
            const north = Math.hypot(projected.x - x, projected.y - y);
            options.project(entry.airport.lon + angle / DEG / Math.max(.2, Math.cos(lat * DEG)), lat, alt, projected);
            r = Math.min(40, Math.max(north, Math.hypot(projected.x - x, projected.y - y)));
          }
          // Drawn after this loop, once rozaNameLayout has seen every rose in view.
          const jam = entry.jamSeconds !== null;
          const fill = entry.capacity > 0 ? Math.min(1, entry.waiting.length / entry.capacity) : 0;
          const label: RoseLabel = { x, y, r, hub: entry.hub, jam, name: entry.airport.name ?? entry.airport.code,
            code: entry.airport.code, fill, fresh: entry.isNew, last: entry.roseLabel };
          // [night-21a] D-268: a rose whose ring the open hub board covers steps back with its note (D-259 does the same
          // for the upgrade crates); the board's own airport keeps its rose wherever the board leaves it in view.
          const shown = inView && !(board !== null && rozaBoardCovers(label, board));
          if (shown) roseLabels.push(label);
          if (shown) roseEntries.push(entry);
          entry.rose.place(x, y, shown);
          // [night-16a] D-262: the note's full width again (the last layout may have left the compact one), its compact
          // form, and its priority: a jam, a hub, the fuller airport; the rose's box shares it (a must note's pass).
          sizeGroup(entry);
          entry.tag.compactWidth = Math.max(rozaCompactWidth(entry.bubble, entry.plate.textContent ?? entry.airport.code,
            roseNoteMust(label) ? entry.freshWidth : 0), entry.slotRect.width);
          entry.tag.rank = entry.roseSlot.rank = entry.nameSlot.rank = roseRank(label);
          // [night-24a] D-281: a newly opened airport's note must show (code + NEW at least) for as long as the mark lasts.
          entry.tag.must = roseNoteMust(label);
          // The rose's box (ticks and the name arc) is a fixed obstacle for the notes; it and the note's places beside
          // and under the rose are set from the rose's name after the name layout below.
          entry.roseSlot.active = shown;
          entry.nameSlot.active = false;
          if (!shown) entry.tag.active = false;
        }
        // [night-30a] D-284 U2: the note beside the world's stamp (projectAirport once E2 lands, else the constant size).
        if (import.meta.env.DEV && linoryt.on) {
          const stamp = linorytStampBox(entry.tag);
          if (!options.projectAirport?.(entry.airport.id, stamp)) {
            // The stamp lies on the ground (a quad tangent to the globe), not at the marker's height.
            if (options.project && !transform) options.project(entry.airport.lon, entry.airport.lat, 1, projected);
            else { projected.x = x; projected.y = y; projected.visible = true; }
            linorytStampFallback(stamp, projected.x, projected.y, entry.hub, inView && projected.visible);
          }
          sizeGroup(entry);
          linorytNoteFrame(entry.tag, { code: entry.airport.code, hub: entry.hub, jam: entry.jamSeconds !== null, fresh: entry.isNew,
            fill: entry.capacity > 0 ? Math.min(1, entry.waiting.length / entry.capacity) : 0, size: linorytNoteSize(entry.bubble),
            viewWidth: bounds.width, board });
        }
        const chip = entry.chip;
        chip.offscreen = !inView;
        chip.jammed = entry.jamSeconds !== null;
        if (chip.offscreen) {
          const dx = transformedNormal.x * cam[0] + transformedNormal.y * cam[1] + transformedNormal.z * cam[2];
          const dy = -(transformedNormal.x * cam[4] + transformedNormal.y * cam[5] + transformedNormal.z * cam[6]);
          projectEdgeChip(chip, dx, dy, entry.airport.lon, edgeBounds);
          // [night-11az] D-257 Róża: the distance note "1 790 km" from the view centre.
          if (skin.roza) rozaEdgeNote(entry.edge, transformedNormal, cameraPosition, chip.side);
          // [night-30a] D-284 U2: the printed chip "Karaczi → / 2 408 km · 8 z 12", as wide as its lines.
          if (import.meta.env.DEV && linoryt.on) {
            chip.width = linorytEdge(entry.edge, entry.airport.name ?? entry.airport.code, entry.airport.code, transformedNormal, cameraPosition,
              Math.min(entry.waiting.length, entry.capacity), entry.capacity);
          }
        }
      }
      if (skin.roza) {
        // [night-14b] D-259: in a dense cluster at close zoom a lower-priority rose shortens its name to the code or drops it,
        // and a dock caption that would lie over a rose steps back.
        const modes = roseEntries.length ? rozaNameLayout(roseLabels, boardBlocked) : [];
        let busiest: BubbleEntry | null = null;
        roseEntries.forEach((entry, i) => {
          const label = roseLabels[i];
          const mode = modes[i];
          entry.roseLabel = mode;
          entry.rose?.draw({ cap: entry.capacity, taken: Math.min(entry.waiting.length, entry.capacity), hub: entry.hub,
            jam: rozaJamShare(entry.jamSeconds), name: roseLabelText(label, mode), below: roseLabelBelow(mode) }, label.r);
          // [night-16a] D-262: the rose's box is what it shows (a rose without a name is only its ring), and the note's
          // place under the rose starts below that box.
          rozaRoseObstacles(entry.roseSlot, entry.nameSlot, label, mode);
          rozaNotePlaces(entry.tag, label, mode, width);
          if (entry.hub && entry.tag.active && (!busiest || (entry.tag.rank ?? 0) > (busiest.tag.rank ?? 0))) busiest = entry;
        });
        // The busiest hub in view always shows at least its code and fill (TagSlot.must).
        if (busiest) (busiest as BubbleEntry).tag.must = true;
        rozaDockObstacles(host, dockSlots);
        layoutTags(layoutSlots, bounds);
        // [night-16b] D-263: a forced note (the busiest hub's; [night-24a] D-281: a new airport's) over a lower-ranked rose's
        // name: that name steps back this frame.
        roseEntries.forEach((entry, i) => {
          const name = entry.nameSlot;
          if (!name.active) return;
          const covered = roseEntries.some((other) => {
            const forced = other.tag;
            return other !== entry && forced.must === true && forced.placed && forced.x < name.x + name.width && name.x < forced.x + forced.width &&
              forced.y < name.y + name.height && name.y < forced.y + forced.height;
          });
          if (!covered) return;
          name.active = false;
          modes[i] = 'none';
          entry.roseLabel = 'none';
          const label = roseLabels[i];
          entry.rose?.draw({ cap: entry.capacity, taken: Math.min(entry.waiting.length, entry.capacity), hub: entry.hub,
            jam: rozaJamShare(entry.jamSeconds), name: '' }, label.r);
        });
        rozaCaptionsYield(host, roseLabels, modes, slots);
        roseEntries.length = 0;
        roseLabels.length = 0;
      } else {
        if (import.meta.env.DEV && linoryt.on) linorytFrameEnd(); // [night-30a] U2: the busiest hub's note must show
        layoutTags(layoutSlots, bounds);
      }
      // [night-30a] D-284 U2: a note with no room takes its one-line compact form (layout again); chips of their own width.
      if (import.meta.env.DEV && linoryt.on) linorytCompactPasses(layoutSlots, bounds, layoutTags);
      if (import.meta.env.DEV && linoryt.on) placeSizedEdgeChips(chips, slots, edgeBounds, linorytMarkers(slots));
      else placeEdgeChips(chips, slots, edgeBounds);
      for (const entry of entries) {
        const tag = entry.tag;
        const showBubble = tag.placed && entry.mainWidth > 0; // [task-38] the box may hold only a slot tag
        const compact = showBubble && tag.compact === true; // [night-16a] D-262
        if (compact !== entry.compact) { entry.compact = compact; entry.bubble.classList.toggle('airport-bubble--compact', compact); }
        attachSlotTag(tag, entry.mainWidth > 0, entry.slotRect);
        // [night-30a] D-284 U2: the slot tag hangs under the printed note (taller than the luggage tag).
        if (import.meta.env.DEV && linoryt.on && entry.slotRect.visible && entry.mainWidth > 0) entry.slotRect.y = tag.y + tag.height - SLOT_TAG_HEIGHT;
        const showSlot = entry.slotRect.visible;
        if (entry.slotVisible !== showSlot) { updateVisibility(entry.slot, showSlot); entry.slotVisible = showSlot; }
        if (showSlot && (entry.slotRect.x !== entry.lastSlotX || entry.slotRect.y !== entry.lastSlotY)) {
          placeEl(entry.slot, entry.slotRect.x, entry.slotRect.y);
          entry.lastSlotX = entry.slotRect.x;
          entry.lastSlotY = entry.slotRect.y;
        }
        if (entry.bubbleVisible !== showBubble) { updateVisibility(entry.bubble, showBubble); entry.bubbleVisible = showBubble; }
        if (tag.placed) {
          if (showBubble && (tag.x !== entry.lastBubbleX || tag.y !== entry.lastBubbleY)) {
            placeEl(entry.bubble, tag.x, tag.y);
            entry.lastBubbleX = tag.x;
            entry.lastBubbleY = tag.y;
          }
          const fade = Math.max(.2, Math.min(1, (entry.screenX - 10) / 28, (width - 10 - entry.screenX) / 28, (entry.screenY - 10) / 28, (height - 10 - entry.screenY) / 28));
          const opacity = Math.round(fade * 10) / 10;
          if (opacity !== entry.lastOpacity) {
            entry.bubble.style.opacity = String(opacity);
            entry.slot.style.opacity = String(opacity); // [task-38]
            entry.lastOpacity = opacity;
          }
        }
        const chip = entry.chip;
        // [night-30a] D-284 U2: the same for a Linoryt chip, measured with its own width.
        if (import.meta.env.DEV && linoryt.on && board !== null && chip.placed && chip.x < board.r && chip.x + (chip.width ?? EDGE_CHIP_WIDTH) > board.l &&
          chip.y < board.b && chip.y + EDGE_CHIP_HEIGHT > board.t) chip.placed = false;
        // [night-21a] D-268: an edge chip the open hub board would cover steps back while it is open.
        const showEdge = chip.offscreen && chip.placed && !(board !== null && chip.x < board.r && chip.x + EDGE_CHIP_WIDTH > board.l &&
          chip.y < board.b && chip.y + EDGE_CHIP_HEIGHT > board.t);
        if (showEdge !== (entry.edge.hidden === false)) updateVisibility(entry.edge, showEdge);
        if (showEdge && (entry.chip.x !== entry.lastEdgeX || entry.chip.y !== entry.lastEdgeY)) {
          placeEl(entry.edge, entry.chip.x, entry.chip.y);
          entry.lastEdgeX = entry.chip.x;
          entry.lastEdgeY = entry.chip.y;
        }
        if (skin.roza && showEdge) rozaEdgeClash(entry.edge, entry.chip, slots); // [night-11az]
        if (showEdge && entry.lastEdgeSide !== entry.chip.side) {
          const icon = entry.edge.firstElementChild as SVGElement | null;
          if (icon) icon.style.transform = `rotate(${entry.chip.side === 0 ? 180 : entry.chip.side === 1 ? 0 : entry.chip.side === 2 ? -90 : 90}deg)`;
          entry.lastEdgeSide = entry.chip.side;
        }
      }
    },
    getPoolStats() {
      return { airports: entries.length, bubbles: entries.length, slotTags: entries.length, edgeButtons: entries.length, domElements: layer.querySelectorAll('*').length };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', refreshSize);
      layer.remove();
      entries.length = 0;
      slots.length = 0;
      layoutSlots.length = 0;
      chips.length = 0;
      byId.clear();
    },
  };
}

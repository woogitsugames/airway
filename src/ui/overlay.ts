// Projection-only UI. The simulation supplies read-only snapshots and navigation is a callback.
import { Camera, Object3D, Vector3 } from 'three';
import { t } from '../i18n';
import { isDestinationRegion as isValidRegion, regionGlyph, type DestinationRegion } from './glyphs';
import {
  attachSlotTag, layoutTags, sizeTagGroup, slotCountdownText, type SlotTagRect, type TagBounds, type TagSlot,
} from './overlay-layout'; // [task-38] slot tag
import { REGIONS } from '../data/regions';
import './overlay.css';

const DEG = Math.PI / 180;
const EDGE_WIDTH = 58;
const EDGE_HEIGHT = 48;
const MAX_GLYPHS = 6;
const EDGE_PAD = 7;
/** [night-10v] Clearance between an edge chip and the marker of an on-screen airport (inside the 28 dp tap radius). */
const EDGE_CLEAR = 16;
const SVG = 'http://www.w3.org/2000/svg';

export interface OverlayAirport {
  id: string;
  code: string;
  lon: number;
  lat: number;
  hub?: boolean;
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
  /**
   * [night-10u] Glyph nodes kept per kind ("EUN", "EUN~" hollow) and reused on every rebuild, plus the "+N" count
   * and the children last written, so a passenger change edits only the nodes that differ.
   */
  glyphPool: Map<string, SVGSVGElement[]>;
  more: HTMLSpanElement;
  children: Node[];
  ariaLabel: string;
  /** [night-10h] Red-white boom-barrier stub while the night curfew closes the airport. */
  barrier: HTMLSpanElement;
  closed: boolean;
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
  edgeSide: 0 | 1 | 2 | 3;
  edgeX: number;
  edgeY: number;
  edgePlaced: boolean;
  bubbleVisible: boolean;
  edgeVisible: boolean;
  lastBubbleX: number;
  lastBubbleY: number;
  lastEdgeX: number;
  lastEdgeY: number;
  lastEdgeSide: number;
  lastOpacity: number;
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
  update(): void;
  getPoolStats(): { airports: number; bubbles: number; slotTags: number; edgeButtons: number; domElements: number };
  dispose(): void;
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
/** The boom barrier the globe draws on a closed airport, same drawing as the puzzle strips (N7d). */
const BARRIER_SVG = '<svg viewBox="0 0 22 12" width="26" height="14" aria-hidden="true" focusable="false">' +
  '<rect x="1" y="2" width="3" height="9" fill="#13302e"/>' +
  '<rect x="4" y="3" width="17" height="4" fill="#fbf8f1" stroke="#13302e" stroke-width="1"/>' +
  '<path d="M7 3h3l-2 4H5zM13 3h3l-2 4h-3zM19 3h2v1.6L20 7h-3z" fill="#b8322a"/></svg>';
const NEW_PAD = 10;

/** [night-10i] A transfer passenger still inside the minimum connection time: the region glyph drawn hollow. */
function connectingGlyph(region: DestinationRegion): SVGSVGElement {
  const svg = regionGlyph(region);
  svg.classList.add('airport-region-glyph--connecting');
  const path = svg.firstElementChild;
  if (path) {
    path.setAttribute('fill', '#FBF8F1');
    path.setAttribute('stroke', REGIONS[region].color);
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
  const byId = new Map<string, BubbleEntry>();
  const marker = new Vector3();
  const transformedNormal = new Vector3();
  const cameraPosition = new Vector3();
  const toCamera = new Vector3();
  const projected = { x: 0, y: 0, visible: false };
  const bounds: TagBounds = { width: host.clientWidth, height: host.clientHeight, top: 0, bottom: 0, gap: 4 };
  let reservedRight = 0; // [night-08b] edge buttons only; tag layout keeps using `bounds`
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
    let freshWidth = 0;
    if (entry.isNew) {
      const label = t('airport.new');
      if (entry.fresh.textContent !== label) entry.fresh.textContent = label;
      freshWidth = Math.ceil(NEW_PAD + label.length * NEW_CHAR);
      entry.fresh.style.width = freshWidth + 'px';
      want.push(entry.fresh);
    }
    if (entry.closed) want.push(entry.barrier);
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
    want.push(entry.timer);
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
    entry.mainWidth = entry.waiting.length > 0 || jammed || entry.isNew || entry.closed
      ? Math.max(30, 23 + limit * 18 + (entry.waiting.length > MAX_GLYPHS ? 27 : 0) + (jammed ? 53 : 0) +
        (freshWidth ? freshWidth + (limit || jammed ? 4 : 0) : 0) + (entry.closed ? BARRIER_WIDTH : 0)) : 0;
    bubble.classList.toggle('airport-bubble--new', entry.isNew);
    entry.edge.classList.toggle('airport-edge--new', entry.isNew && !jammed);
    entry.edge.classList.toggle('airport-edge--curfew', entry.closed && !jammed); // [night-10h]
    const taken = Math.min(entry.waiting.length, entry.capacity);
    const edgeAria = t('airport.focus', { code: entry.airport.code }) +
      (entry.closed ? ' ' + t('airport.curfewAria', { code: entry.airport.code }) : '') +
      (taken > 0 && entry.capacity > 0 ? ' ' + t('airport.edgeFillAria', { count: taken, capacity: entry.capacity }) : '');
    if (entry.edge.getAttribute('aria-label') !== edgeAria) entry.edge.setAttribute('aria-label', edgeAria);
    rebuildGauge(entry, taken);
    sizeTagGroup(entry.tag, entry.mainWidth, entry.slotRect);
    entry.timer.hidden = !jammed;
    if (jammed) {
      const seconds = Math.max(0, Math.ceil(entry.jamSeconds ?? 0));
      entry.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const label = jammed ? t('airport.jammed', { code: entry.airport.code, seconds: Math.ceil(entry.jamSeconds ?? 0) }) : t('airport.waiting', { code: entry.airport.code, count: entry.waiting.length });
    const aria = (entry.isNew ? t('airport.newAria', { code: entry.airport.code }) + ' ' : '') +
      (entry.closed ? t('airport.curfewAria', { code: entry.airport.code }) + ' ' : '') + label +
      (entry.connecting > 0 ? ' ' + t('airport.connectingAria', { count: entry.connecting }) : '');
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
    sizeTagGroup(entry.tag, entry.mainWidth, entry.slotRect);
  }

  function edgeLayout(entry: BubbleEntry, dx: number, dy: number): void {
    const left = EDGE_PAD + EDGE_WIDTH / 2;
    const right = width - reservedRight - left;
    const top = bounds.top + EDGE_PAD + EDGE_HEIGHT / 2;
    const bottom = height - bounds.bottom - EDGE_PAD - EDGE_HEIGHT / 2;
    // [night-08b] The horizontal centre of the free band (width / 2 without a right reservation).
    const centreX = (left + right) / 2;
    let x = centreX;
    let y = (top + bottom) / 2;
    if (dx === 0 && dy === 0) dx = entry.airport.lon >= 0 ? 1 : -1;
    const halfW = Math.max(1, right - centreX);
    const halfH = Math.max(1, (bottom - top) / 2);
    const factor = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
    x = Math.max(left, Math.min(right, x + dx * factor));
    y = Math.max(top, Math.min(bottom, y + dy * factor));
    const onVertical = Math.abs(dx / halfW) >= Math.abs(dy / halfH);
    entry.edgeSide = onVertical ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3);
    entry.edgeX = Math.round(x - EDGE_WIDTH / 2);
    entry.edgeY = Math.round(y - EDGE_HEIGHT / 2);
  }

  function distributeEdges(): void {
    // Two passes ensure congested hub warnings win edge space over ordinary codes.
    for (let pass = 1; pass >= 0; pass--) for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.edgeVisible || Number(entry.jamSeconds !== null) !== pass) continue;
      const vertical = entry.edgeSide < 2;
      const start = vertical ? entry.edgeY : entry.edgeX;
      const min = vertical ? bounds.top + EDGE_PAD : EDGE_PAD;
      const max = vertical ? height - bounds.bottom - EDGE_HEIGHT - EDGE_PAD : width - reservedRight - EDGE_WIDTH - EDGE_PAD;
      const step = (vertical ? EDGE_HEIGHT : EDGE_WIDTH) + 3;
      entry.edgePlaced = false;
      // [night-10z] First look for a place clear of the luggage tags as well (a tag drawn over a chip hid its
      // code); only when the edge is too crowded may a chip sit under a tag, never on an airport marker.
      for (let avoidTags = 1; avoidTags >= 0 && !entry.edgePlaced; avoidTags--)
      for (let offset = 0; offset <= entries.length; offset++) {
        const delta = offset === 0 ? 0 : (offset % 2 ? 1 : -1) * Math.ceil(offset / 2) * step;
        const coord = Math.round(start + delta);
        if (coord < min || coord > max) continue;
        const x = vertical ? entry.edgeX : coord;
        const y = vertical ? coord : entry.edgeY;
        let collides = false;
        for (let j = 0; j < entries.length; j++) {
          const other = entries[j];
          // [night-10v] A chip must never sit on an airport that is on screen: the button would take the tap
          // meant for that airport (route start, hub or "+2 slots" pick). It slides along the edge instead.
          if (!other.edgeVisible) {
            const ax = other.tag.anchorX;
            const ay = other.tag.anchorY;
            if (ax > x - EDGE_CLEAR && ax < x + EDGE_WIDTH + EDGE_CLEAR && ay > y - EDGE_CLEAR && ay < y + EDGE_HEIGHT + EDGE_CLEAR) {
              collides = true;
              break;
            }
            const tag = other.tag;
            if (avoidTags && tag.placed && x < tag.x + tag.width + 3 && x + EDGE_WIDTH + 3 > tag.x &&
                y < tag.y + tag.height + 3 && y + EDGE_HEIGHT + 3 > tag.y) { collides = true; break; }
            continue;
          }
          if (!other.edgePlaced || other.edgeSide !== entry.edgeSide) continue;
          if (x < other.edgeX + EDGE_WIDTH + 3 && x + EDGE_WIDTH + 3 > other.edgeX &&
              y < other.edgeY + EDGE_HEIGHT + 3 && y + EDGE_HEIGHT + 3 > other.edgeY) { collides = true; break; }
        }
        if (!collides) {
          entry.edgeX = x;
          entry.edgeY = y;
          entry.edgePlaced = true;
          break;
        }
      }
    }
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
      bubble.hidden = true;
      bubble.setAttribute('role', 'img');
      const timer = document.createElement('span');
      timer.className = 'airport-bubble__timer';
      const fresh = document.createElement('span');
      fresh.className = 'airport-bubble__new';
      const barrier = document.createElement('span');
      barrier.className = 'airport-bubble__curfew';
      barrier.innerHTML = BARRIER_SVG;
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
      edge.append(arrow(), document.createTextNode(airport.code), gauge);
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
      const tag: TagSlot = { id: airport.id, anchorX: 0, anchorY: 0, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false };
      const entry: BubbleEntry = {
        airport, normal, anchor, bubble, edge, gauge, gaugeFill, capacity: 0, lastGauge: '', timer, fresh, isNew: false, barrier, closed: false, tag,
        glyphPool: new Map(), more, children: [], ariaLabel: '',
        slot, slotLabel, slotTime, slotCount, slotRect: { width: 0, x: 0, y: 0, visible: false }, slotHeld: 0, slotMinutes: 0,
        mainWidth: 0, slotVisible: false, lastSlotX: NaN, lastSlotY: NaN,
        waiting: [], connecting: 0, jamSeconds: null,
        edgeSide: 0, edgeX: 0, edgeY: 0, edgePlaced: false, bubbleVisible: false, edgeVisible: false,
        lastBubbleX: NaN, lastBubbleY: NaN, lastEdgeX: NaN, lastEdgeY: NaN, lastEdgeSide: -1, lastOpacity: NaN,
      };
      entries.push(entry);
      slots.push(tag);
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
      reservedRight = live ? live.right : 0;
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
        entry.tag.active = inView && (entry.mainWidth > 0 || entry.slotRect.width > 0); // [task-38]
        entry.tag.anchorX = x;
        entry.tag.anchorY = y;
        entry.edgeVisible = !inView;
        entry.edgePlaced = false;
        if (entry.edgeVisible) {
          const dx = transformedNormal.x * cam[0] + transformedNormal.y * cam[1] + transformedNormal.z * cam[2];
          const dy = -(transformedNormal.x * cam[4] + transformedNormal.y * cam[5] + transformedNormal.z * cam[6]);
          edgeLayout(entry, dx, dy);
        }
      }
      layoutTags(slots, bounds);
      distributeEdges();
      for (const entry of entries) {
        const tag = entry.tag;
        const showBubble = tag.placed && entry.mainWidth > 0; // [task-38] the box may hold only a slot tag
        attachSlotTag(tag, entry.mainWidth > 0, entry.slotRect);
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
          const fade = Math.max(.2, Math.min(1, (tag.anchorX - 10) / 28, (width - 10 - tag.anchorX) / 28, (tag.anchorY - 10) / 28, (height - 10 - tag.anchorY) / 28));
          const opacity = Math.round(fade * 10) / 10;
          if (opacity !== entry.lastOpacity) {
            entry.bubble.style.opacity = String(opacity);
            entry.slot.style.opacity = String(opacity); // [task-38]
            entry.lastOpacity = opacity;
          }
        }
        const showEdge = entry.edgeVisible && entry.edgePlaced;
        if (showEdge !== (entry.edge.hidden === false)) updateVisibility(entry.edge, showEdge);
        if (showEdge && (entry.edgeX !== entry.lastEdgeX || entry.edgeY !== entry.lastEdgeY)) {
          placeEl(entry.edge, entry.edgeX, entry.edgeY);
          entry.lastEdgeX = entry.edgeX;
          entry.lastEdgeY = entry.edgeY;
        }
        if (showEdge && entry.lastEdgeSide !== entry.edgeSide) {
          const icon = entry.edge.firstElementChild as SVGElement | null;
          if (icon) icon.style.transform = `rotate(${entry.edgeSide === 0 ? 180 : entry.edgeSide === 1 ? 0 : entry.edgeSide === 2 ? -90 : 90}deg)`;
          entry.lastEdgeSide = entry.edgeSide;
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
      byId.clear();
    },
  };
}

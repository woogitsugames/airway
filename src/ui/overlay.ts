// Projection-only UI. The simulation supplies read-only snapshots and navigation is a callback.
import { Camera, Object3D, Vector3 } from 'three';
import { t } from '../i18n';
import { isDestinationRegion as isValidRegion, regionGlyph, type DestinationRegion } from './glyphs';
import { layoutTags, type TagBounds, type TagSlot } from './overlay-layout';
import './overlay.css';

const DEG = Math.PI / 180;
const EDGE_WIDTH = 58;
const EDGE_HEIGHT = 48;
const MAX_GLYPHS = 6;
const EDGE_PAD = 7;
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
  globeTransform?: Object3D;
  onNavigate?: (id: string) => void;
  /** The render facade's projection (WorldRenderer.project); preferred over the local fallback. */
  project?: (lon: number, lat: number, altitude: number, out: { x: number; y: number; visible: boolean }) => unknown;
}

interface BubbleEntry {
  airport: OverlayAirport;
  normal: Vector3;
  anchor: Vector3;
  bubble: HTMLDivElement;
  edge: HTMLButtonElement;
  timer: HTMLSpanElement;
  tag: TagSlot;
  waiting: readonly DestinationRegion[];
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
  setPassengers(id: string, waiting: readonly DestinationRegion[]): void;
  setJamCountdown(id: string, seconds: number | null): void;
  update(): void;
  getPoolStats(): { airports: number; bubbles: number; edgeButtons: number; domElements: number };
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

  function rebuildBubble(entry: BubbleEntry): void {
    const bubble = entry.bubble;
    bubble.replaceChildren();
    const limit = Math.min(MAX_GLYPHS, entry.waiting.length);
    for (let i = 0; i < limit; i++) bubble.appendChild(regionGlyph(entry.waiting[i]));
    if (entry.waiting.length > MAX_GLYPHS) {
      const more = document.createElement('span');
      more.className = 'airport-bubble__count';
      more.textContent = '+' + (entry.waiting.length - MAX_GLYPHS);
      bubble.appendChild(more);
    }
    bubble.appendChild(entry.timer);
    const jammed = entry.jamSeconds !== null;
    bubble.classList.toggle('airport-bubble--jam', jammed);
    entry.edge.classList.toggle('airport-edge--jam', jammed);
    entry.tag.jammed = jammed;
    entry.tag.width = Math.max(30, 23 + limit * 18 + (entry.waiting.length > MAX_GLYPHS ? 27 : 0) + (jammed ? 53 : 0));
    entry.timer.hidden = !jammed;
    if (jammed) {
      const seconds = Math.max(0, Math.ceil(entry.jamSeconds ?? 0));
      entry.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    bubble.setAttribute('aria-label', jammed ? t('airport.jammed', { code: entry.airport.code, seconds: Math.ceil(entry.jamSeconds ?? 0) }) : t('airport.waiting', { code: entry.airport.code, count: entry.waiting.length }));
  }

  function edgeLayout(entry: BubbleEntry, dx: number, dy: number): void {
    const left = EDGE_PAD + EDGE_WIDTH / 2;
    const right = width - left;
    const top = bounds.top + EDGE_PAD + EDGE_HEIGHT / 2;
    const bottom = height - bounds.bottom - EDGE_PAD - EDGE_HEIGHT / 2;
    let x = width / 2;
    let y = (top + bottom) / 2;
    if (dx === 0 && dy === 0) dx = entry.airport.lon >= 0 ? 1 : -1;
    const halfW = Math.max(1, right - width / 2);
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
      const max = vertical ? height - bounds.bottom - EDGE_HEIGHT - EDGE_PAD : width - EDGE_WIDTH - EDGE_PAD;
      const step = (vertical ? EDGE_HEIGHT : EDGE_WIDTH) + 3;
      entry.edgePlaced = false;
      for (let offset = 0; offset <= entries.length; offset++) {
        const delta = offset === 0 ? 0 : (offset % 2 ? 1 : -1) * Math.ceil(offset / 2) * step;
        const coord = Math.round(start + delta);
        if (coord < min || coord > max) continue;
        const x = vertical ? entry.edgeX : coord;
        const y = vertical ? coord : entry.edgeY;
        let collides = false;
        for (let j = 0; j < entries.length; j++) {
          const other = entries[j];
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
      const edge = document.createElement('button');
      edge.type = 'button';
      edge.className = 'airport-edge';
      edge.hidden = true;
      edge.setAttribute('aria-label', t('airport.focus', { code: airport.code }));
      edge.append(arrow(), document.createTextNode(airport.code));
      edge.addEventListener('click', () => options.onNavigate?.(airport.id));
      layer.append(bubble, edge);
      const tag: TagSlot = { id: airport.id, anchorX: 0, anchorY: 0, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false };
      const entry: BubbleEntry = {
        airport, normal, anchor, bubble, edge, timer, tag, waiting: [], jamSeconds: null,
        edgeSide: 0, edgeX: 0, edgeY: 0, edgePlaced: false, bubbleVisible: false, edgeVisible: false,
        lastBubbleX: NaN, lastBubbleY: NaN, lastEdgeX: NaN, lastEdgeY: NaN, lastEdgeSide: -1, lastOpacity: NaN,
      };
      entries.push(entry);
      slots.push(tag);
      byId.set(airport.id, entry);
      rebuildBubble(entry);
    },
    setPassengers(id, waiting): void {
      const entry = get(id);
      for (const region of waiting) if (!isValidRegion(region)) throw new RangeError('Invalid destination region: ' + region);
      entry.waiting = waiting.slice();
      rebuildBubble(entry);
    },
    setJamCountdown(id, seconds): void {
      const entry = get(id);
      if (seconds !== null && (!Number.isFinite(seconds) || seconds < 0)) throw new RangeError('Invalid jam countdown');
      if (entry.jamSeconds === seconds) return;
      entry.jamSeconds = seconds;
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
      bounds.top = options.reservedTop ?? 72;
      bounds.bottom = options.reservedBottom ?? 92;
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
          options.project(entry.airport.lon, entry.airport.lat, entry.airport.hub ? 0.075 : 0.045, projected);
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
        entry.tag.active = inView && (entry.waiting.length > 0 || entry.jamSeconds !== null);
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
        const showBubble = tag.placed;
        if (entry.bubbleVisible !== showBubble) { updateVisibility(entry.bubble, showBubble); entry.bubbleVisible = showBubble; }
        if (showBubble) {
          if (tag.x !== entry.lastBubbleX || tag.y !== entry.lastBubbleY) {
            placeEl(entry.bubble, tag.x, tag.y);
            entry.lastBubbleX = tag.x;
            entry.lastBubbleY = tag.y;
          }
          const fade = Math.max(.2, Math.min(1, (tag.anchorX - 10) / 28, (width - 10 - tag.anchorX) / 28, (tag.anchorY - 10) / 28, (height - 10 - tag.anchorY) / 28));
          const opacity = Math.round(fade * 10) / 10;
          if (opacity !== entry.lastOpacity) { entry.bubble.style.opacity = String(opacity); entry.lastOpacity = opacity; }
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
      return { airports: entries.length, bubbles: entries.length, edgeButtons: entries.length, domElements: layer.querySelectorAll('*').length };
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

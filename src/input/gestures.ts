/**
 * Deterministic pointer gesture state machine. Coordinates and thresholds are CSS
 * pixels (mobile dp), not backing-store pixels; no game state is changed here.
 */
export type GestureHit =
  | { kind: 'city'; id: string }
  | { kind: 'route-handle'; id: string }
  | { kind: 'route-body'; id: string }
  | { kind: 'empty' };

export type GestureMode = 'idle' | 'press-route' | 'press-orbit' | 'second-tap' |
  'route' | 'orbit' | 'one-hand-zoom' | 'pinch' | 'context' | 'blocked';

export type GesturePointerType = 'touch' | 'mouse' | 'pen';
export interface GesturePointerSample {
  type: 'down' | 'move' | 'up' | 'cancel';
  pointerId: number;
  x: number;
  y: number;
  timeMs: number;
  pointerType?: GesturePointerType;
  button?: number;
  /**
   * [night-08d] When the app handled the sample (same clock as timeMs/rAF). A down that waited behind a long
   * frame is older than it looks: the long press counts from here, so a quick drag is never read as a hold.
   */
  handledMs?: number;
}

export interface GestureCallbacks {
  /** Hit tester must use the supplied 28 dp radius for city centres. */
  hitTest(x: number, y: number, cityRadiusDp: number): GestureHit;
  onRotate?(deltaX: number, deltaY: number, elapsedMs: number): void;
  /** >1 zooms in, <1 zooms out. Camera clamps the result to [1,4]. */
  onZoom?(factor: number, x: number, y: number): void;
  onDoubleTap?(hit: GestureHit, x: number, y: number): void;
  onTap?(hit: GestureHit, x: number, y: number): void;
  onRouteStart?(hit: GestureHit, startX: number, startY: number): void;
  onRouteMove?(x: number, y: number): void;
  onRouteEnd?(x: number, y: number): void;
  onRouteCancel?(reason: 'pinch' | 'cancel'): void;
  onContextMenu?(hit: GestureHit, x: number, y: number): void;
  /** Signed depth of the 40 dp globe-limb band, [-1,1], left/right. */
  getLimbEdgeFactor?(x: number, y: number): number;
  /** Signed delta degrees, capped to 60 degrees/second; no orbit inertia. */
  onEdgeRotate?(deltaDegrees: number): void;
  /** The camera stops inertia at pointer-down and resumes only after orbit. */
  onInteractionChange?(active: boolean, allowInertia: boolean): void;
}

interface TrackedPointer {
  x: number;
  y: number;
  timeMs: number;
  kind: GesturePointerType;
}

interface LastTap {
  x: number;
  y: number;
  timeMs: number;
  kind: GesturePointerType;
}

const CITY_RADIUS_DP = 28;
const DRAG_THRESHOLD_DP = 8;
const DOUBLE_TAP_MS = 260;
const LONG_PRESS_MS = 350;
const EDGE_DWELL_MS = 120;
const EDGE_MAX_DEGREES_PER_SECOND = 60;
const MAX_EDGE_TICK_MS = 60;
/**
 * [night-08d] A frame later than this after the previous one may have input queued behind it (the browser
 * dispatches it before the next rAF), so the long press is judged one frame later.
 */
const LONG_PRESS_LATE_FRAME_MS = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function separationSquared(x1: number, y1: number, x2: number, y2: number): number {
  const x = x1 - x2;
  const y = y1 - y2;
  return x * x + y * y;
}

export class GestureRecognizer {
  private pointers = new Map<number, TrackedPointer>();
  private mode: GestureMode = 'idle';
  private primaryId = -1;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private pressSinceMs = 0; // [night-08d] long-press clock: when the down was handled
  private longPressDeferred = false; // [night-08d] the deadline already waited one late frame
  private lastMotionTime = 0;
  private downHit: GestureHit = { kind: 'empty' };
  private lastTap: LastTap | null = null;
  private pinchDistance = 0;
  private edgeSinceMs = -1;
  private lastAdvanceMs = 0;

  constructor(private readonly callbacks: GestureCallbacks) {}

  get activePointers(): number {
    return this.pointers.size;
  }

  get currentMode(): GestureMode {
    return this.mode;
  }

  handle(sample: GesturePointerSample): void {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y) ||
        !Number.isFinite(sample.timeMs)) return;
    if (sample.type === 'down') {
      this.down(sample);
      return;
    }
    const pointer = this.pointers.get(sample.pointerId);
    if (!pointer) return;
    const oldX = pointer.x;
    const oldY = pointer.y;
    const oldTime = pointer.timeMs;
    pointer.x = sample.x;
    pointer.y = sample.y;
    pointer.timeMs = sample.timeMs;
    // [night-08d] Judge the long press at the sample's own position: a move that waited behind a long frame
    // past the 350 ms deadline is a drag, not a hold.
    // [night-55a] D-312: a release is itself the queued input the late-frame deferral waits for, so it is judged
    // at once: a finger held still past the deadline and lifted during a stalled frame still opens the long press.
    this.advanceTime(sample.timeMs, sample.type === 'up');
    if (sample.type === 'cancel') {
      this.cancelAll();
      return;
    }
    if (sample.type === 'up') {
      this.up(sample, pointer);
      return;
    }
    if (this.mode === 'pinch') {
      const next = this.distanceOfFirstTwoPointers();
      if (this.pinchDistance > 1 && next > 1) {
        const factor = clamp(next / this.pinchDistance, 0.7, 1.4);
        const center = this.firstTwoMidpoint();
        this.callbacks.onZoom?.(factor, center.x, center.y);
      }
      this.pinchDistance = next;
      return;
    }
    if (sample.pointerId !== this.primaryId) return;
    const deltaX = sample.x - oldX;
    const deltaY = sample.y - oldY;
    const total = separationSquared(sample.x, sample.y, this.startX, this.startY);
    if (this.mode === 'press-route' || this.mode === 'press-orbit' || this.mode === 'second-tap') {
      if (total <= DRAG_THRESHOLD_DP * DRAG_THRESHOLD_DP) return;
      this.lastMotionTime = sample.timeMs;
      if (this.mode === 'second-tap') {
        this.mode = 'one-hand-zoom';
        // A vertical drag controls the zoom; no other camera movement is allowed.
        this.callbacks.onZoom?.(Math.exp(-deltaY * 0.012), sample.x, sample.y);
      } else if (this.mode === 'press-route') {
        this.mode = 'route';
        this.callbacks.onRouteStart?.(this.downHit, this.startX, this.startY);
        this.callbacks.onRouteMove?.(sample.x, sample.y);
      } else {
        this.mode = 'orbit';
        this.callbacks.onRotate?.(sample.x - this.startX, sample.y - this.startY,
          Math.max(8, sample.timeMs - this.startTime));
      }
      return;
    }
    if (this.mode === 'route') {
      if (deltaX || deltaY) {
        this.lastMotionTime = sample.timeMs;
        this.edgeSinceMs = -1;
        this.callbacks.onRouteMove?.(sample.x, sample.y);
      }
    } else if (this.mode === 'orbit') {
      if (deltaX || deltaY) {
        this.lastMotionTime = sample.timeMs;
        this.callbacks.onRotate?.(deltaX, deltaY, Math.max(8, sample.timeMs - oldTime));
      }
    } else if (this.mode === 'one-hand-zoom' && deltaY) {
      this.callbacks.onZoom?.(Math.exp(-deltaY * 0.012), sample.x, sample.y);
    }
  }

  /**
   * Drive with requestAnimationFrame while a pointer is down, or with fixed test times. `release` judges a due long
   * press without the late-frame deferral (the sample is a pointer-up: no further input can be queued behind it).
   */
  advanceTime(nowMs: number, release = false): void {
    if (!Number.isFinite(nowMs)) return;
    const gap = nowMs - this.lastAdvanceMs;
    const elapsed = clamp(gap, 0, MAX_EDGE_TICK_MS);
    this.lastAdvanceMs = nowMs;
    if (this.pointers.size !== 1) return;
    const pointer = this.pointers.get(this.primaryId);
    if (!pointer) return;
    if ((this.mode === 'press-route' || this.mode === 'press-orbit') &&
        nowMs - this.pressSinceMs >= LONG_PRESS_MS &&
        separationSquared(pointer.x, pointer.y, this.startX, this.startY) <= DRAG_THRESHOLD_DP ** 2) {
      // [night-08d] After a late frame, give queued moves one frame to arrive (once: a slow device still opens it).
      if (gap > LONG_PRESS_LATE_FRAME_MS && !this.longPressDeferred && !release) {
        this.longPressDeferred = true;
        return;
      }
      this.mode = 'context';
      this.callbacks.onContextMenu?.(this.downHit, pointer.x, pointer.y);
      return;
    }
    if (this.mode !== 'route' || !this.callbacks.getLimbEdgeFactor || !this.callbacks.onEdgeRotate) return;
    const factor = clamp(this.callbacks.getLimbEdgeFactor(pointer.x, pointer.y), -1, 1);
    if (!Number.isFinite(factor) || Math.abs(factor) < 0.001) {
      this.edgeSinceMs = -1;
      return;
    }
    if (this.edgeSinceMs < 0) this.edgeSinceMs = nowMs;
    if (nowMs - this.edgeSinceMs < EDGE_DWELL_MS || elapsed <= 0) return;
    this.callbacks.onEdgeRotate(factor * EDGE_MAX_DEGREES_PER_SECOND * elapsed / 1000);
    // Route preview tracks the globe as it moves under a stationary finger.
    this.callbacks.onRouteMove?.(pointer.x, pointer.y);
  }

  cancelAll(): void {
    if (this.mode === 'route') this.callbacks.onRouteCancel?.('cancel');
    const hadPointers = this.pointers.size > 0;
    this.pointers.clear();
    this.primaryId = -1;
    this.mode = 'idle';
    this.pinchDistance = 0;
    this.edgeSinceMs = -1;
    this.lastTap = null;
    if (hadPointers) this.callbacks.onInteractionChange?.(false, false);
  }

  private down(sample: GesturePointerSample): void {
    if (sample.pointerType === 'mouse' && (sample.button ?? 0) !== 0) return;
    if (this.pointers.has(sample.pointerId)) return;
    const kind = sample.pointerType ?? 'touch';
    if (this.pointers.size === 0) {
      this.primaryId = sample.pointerId;
      this.startX = sample.x;
      this.startY = sample.y;
      this.startTime = sample.timeMs;
      this.pressSinceMs = Math.max(sample.timeMs, sample.handledMs ?? sample.timeMs);
      this.longPressDeferred = false;
      this.lastAdvanceMs = sample.timeMs;
      this.lastMotionTime = sample.timeMs;
      this.edgeSinceMs = -1;
      this.downHit = this.callbacks.hitTest(sample.x, sample.y, CITY_RADIUS_DP);
      const tap = this.lastTap;
      const isSecondTap = !!tap && kind === tap.kind &&
        sample.timeMs >= tap.timeMs && sample.timeMs - tap.timeMs <= DOUBLE_TAP_MS &&
        separationSquared(sample.x, sample.y, tap.x, tap.y) <= CITY_RADIUS_DP ** 2;
      this.lastTap = null;
      this.mode = isSecondTap ? 'second-tap' :
        (this.downHit.kind === 'city' || this.downHit.kind === 'route-handle' ? 'press-route' : 'press-orbit');
      this.callbacks.onInteractionChange?.(true, false);
    }
    this.pointers.set(sample.pointerId, { x: sample.x, y: sample.y, timeMs: sample.timeMs, kind });
    if (this.pointers.size === 2) {
      if (this.mode === 'route') this.callbacks.onRouteCancel?.('pinch');
      this.mode = 'pinch';
      this.pinchDistance = this.distanceOfFirstTwoPointers();
      this.edgeSinceMs = -1;
      this.lastTap = null;
    } else if (this.pointers.size > 2) {
      this.mode = 'blocked';
    }
  }

  private up(sample: GesturePointerSample, pointer: TrackedPointer): void {
    this.pointers.delete(sample.pointerId);
    if (this.pointers.size > 0) {
      this.mode = 'blocked';
      this.pinchDistance = 0;
      return;
    }
    const previousMode = this.mode;
    if (previousMode === 'route') {
      this.callbacks.onRouteEnd?.(sample.x, sample.y);
    } else if (previousMode === 'press-route' || previousMode === 'press-orbit') {
      this.callbacks.onTap?.(this.downHit, sample.x, sample.y);
      this.lastTap = { x: sample.x, y: sample.y, timeMs: sample.timeMs, kind: pointer.kind };
    } else if (previousMode === 'second-tap') {
      this.callbacks.onDoubleTap?.(this.downHit, sample.x, sample.y);
      this.callbacks.onZoom?.(1.6, sample.x, sample.y);
      this.lastTap = null;
    } else {
      this.lastTap = null;
    }
    const inertia = previousMode === 'orbit' && sample.timeMs - this.lastMotionTime <= 120;
    this.mode = 'idle';
    this.primaryId = -1;
    this.edgeSinceMs = -1;
    this.pinchDistance = 0;
    this.callbacks.onInteractionChange?.(false, inertia);
  }

  private distanceOfFirstTwoPointers(): number {
    const iter = this.pointers.values();
    const first = iter.next().value as TrackedPointer | undefined;
    const second = iter.next().value as TrackedPointer | undefined;
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }

  private firstTwoMidpoint(): { x: number; y: number } {
    const iter = this.pointers.values();
    const first = iter.next().value as TrackedPointer;
    const second = iter.next().value as TrackedPointer;
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }
}

export interface AttachedGestures {
  recognizer: GestureRecognizer;
  dispose(): void;
}

/** Pointer Events bridge, safe to attach to a canvas only (not the HUD). */
export function attachPointerGestures(element: HTMLElement, callbacks: GestureCallbacks): AttachedGestures {
  const recognizer = new GestureRecognizer(callbacks);
  const previousTouchAction = element.style.touchAction;
  element.style.touchAction = 'none';
  let frameId = 0;
  let disposed = false;
  const frame = (now: number): void => {
    frameId = 0;
    if (disposed || recognizer.activePointers === 0) return;
    recognizer.advanceTime(now);
    frameId = requestAnimationFrame(frame);
  };
  const ensureFrame = (): void => {
    if (!frameId && recognizer.activePointers > 0) frameId = requestAnimationFrame(frame);
  };
  const handle = (event: PointerEvent, type: GesturePointerSample['type']): void => {
    if (disposed) return;
    if (type === 'down' && event.pointerType === 'mouse' && event.button !== 0) return;
    const bounds = element.getBoundingClientRect();
    recognizer.handle({
      type, pointerId: event.pointerId,
      x: event.clientX - bounds.left, y: event.clientY - bounds.top,
      timeMs: event.timeStamp,
      handledMs: performance.now(), // [night-08d] a down queued behind a long frame is not yet a hold
      pointerType: event.pointerType === 'mouse' ? 'mouse' : event.pointerType === 'pen' ? 'pen' : 'touch',
      button: event.button,
    });
    if (type === 'down') {
      try { element.setPointerCapture(event.pointerId); } catch { /* Pointer was cancelled. */ }
      ensureFrame();
    } else if (type === 'up' || type === 'cancel') {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    }
    if (recognizer.activePointers === 0 && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    event.preventDefault();
  };
  const down = (e: PointerEvent): void => handle(e, 'down');
  const move = (e: PointerEvent): void => handle(e, 'move');
  const up = (e: PointerEvent): void => handle(e, 'up');
  const cancel = (e: PointerEvent): void => handle(e, 'cancel');
  const lost = (e: PointerEvent): void => {
    if (recognizer.activePointers) handle(e, 'cancel');
  };
  const wheel = (e: WheelEvent): void => {
    if (recognizer.activePointers) return;
    const rect = element.getBoundingClientRect();
    callbacks.onZoom?.(Math.exp(-clamp(e.deltaY, -300, 300) * 0.002), e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
  };
  const blur = (): void => recognizer.cancelAll();
  // [night-11ai] R4g: a right click (or a long press that a mouse emulation turns into one) over the globe never
  // opens the browser menu; the game's own long press already offers the route menu and the airport board.
  const contextMenu = (e: Event): void => { e.preventDefault(); };
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('lostpointercapture', lost);
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('contextmenu', contextMenu);
  window.addEventListener('blur', blur);
  return {
    recognizer,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      recognizer.cancelAll();
      if (frameId) cancelAnimationFrame(frameId);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', lost);
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('blur', blur);
      element.style.touchAction = previousTouchAction;
    },
  };
}

// [m2] Contextual one-time ATC hints in a live run (D-54): first hub jam, first night curfew, first
// departure-slot hold (task 32, "SLOTS 07") and the first weekly board. One strip at a time from a
// priority queue; each hint shows once per install, leaves on a tap or after a few seconds, and is
// reset by the tutorial replay. Pure scheduling: no DOM, timers and the view are injected.
import { SLOT_HINT_KEY } from './slot-hint';

export type HintId = 'jam' | 'slots' | 'curfew' | 'upgrade';
/** Where the run is: hints wait while the weekly board is open and are dropped at game over. */
export type HintContext = 'game' | 'board' | 'over';

/** Seen flags, one key per hint (the slot key predates the queue and is kept for old installs). */
export const HINT_KEYS: Readonly<Record<HintId, string>> = {
  jam: 'aw-tutorial-jam',
  slots: SLOT_HINT_KEY,
  curfew: 'aw-tutorial-curfew',
  upgrade: 'aw-tutorial-upgrade',
};
/** Lower shows first: a jam can end the run, a slot hold costs time now, the rest is background. */
export const HINT_PRIORITY: Readonly<Record<HintId, number>> = { jam: 0, slots: 1, curfew: 2, upgrade: 3 };
/** Only the weekly-board hint may show while the board is open (it explains the board). */
const ON_BOARD: ReadonlySet<HintId> = new Set<HintId>(['upgrade']);
export const HINT_VISIBLE_MS = 9000;
export const HINT_GAP_MS = 700;

export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface HintContent {
  /** Strip index, e.g. "ATC / SLOTS 07". */
  readonly step: string;
  /** Airport tag, e.g. "ATH · SLOT 0:58"; empty hides the field. */
  readonly tag: string;
  readonly text: string;
}
export interface HintView {
  show(id: HintId, content: HintContent, onBoard: boolean): void;
  hide(): void;
}
export interface HintTimers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
export interface HintQueueOptions {
  readonly storage: HintStorage | null;
  readonly view: HintView;
  /** Settings switch "ATC hints"; false = nothing is shown or marked seen. */
  readonly enabled?: () => boolean;
  readonly timers?: HintTimers;
  /** Read at every show, so QA can hold a strip for screenshots. */
  readonly visibleMs?: number | (() => number);
  readonly gapMs?: number;
}
export interface HintRequest {
  /** Built when the strip is actually shown, so queued hints carry current numbers. */
  readonly content: () => HintContent;
  /** Re-checked before a queued hint is shown (e.g. the hub is still jammed). */
  readonly valid?: () => boolean;
}

export function hintSeen(storage: HintStorage | null, id: HintId): boolean {
  try { return storage?.getItem(HINT_KEYS[id]) === '1'; } catch { return false; }
}

/** Tutorial replay: every contextual hint becomes new again. */
export function resetHintFlags(storage: HintStorage | null): void {
  for (const key of Object.values(HINT_KEYS)) {
    try {
      if (storage?.removeItem) storage.removeItem(key);
      else storage?.setItem(key, '0');
    } catch { /* storage is optional */ }
  }
}

const browserTimers: HintTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class HintQueue {
  private readonly storage: HintStorage | null;
  private readonly view: HintView;
  private readonly enabled: () => boolean;
  private readonly timers: HintTimers;
  private readonly visibleMs: () => number;
  private readonly gapMs: number;
  private readonly seen = new Map<HintId, boolean>();
  private queue: { id: HintId; request: HintRequest }[] = [];
  private current: HintId | null = null;
  private context: HintContext = 'game';
  private timer: unknown = null;
  private cooling = false;
  private disposed = false;

  constructor(options: HintQueueOptions) {
    this.storage = options.storage;
    this.view = options.view;
    this.enabled = options.enabled ?? (() => true);
    this.timers = options.timers ?? browserTimers;
    const visible = options.visibleMs ?? HINT_VISIBLE_MS;
    this.visibleMs = typeof visible === 'number' ? () => visible : visible;
    this.gapMs = options.gapMs ?? HINT_GAP_MS;
  }

  get visible(): HintId | null { return this.current; }
  get pending(): readonly HintId[] { return this.queue.map((entry) => entry.id); }

  /** Ask for a hint; ignored when it was shown before, is already queued/visible or hints are off. */
  request(id: HintId, request: HintRequest): void {
    if (this.disposed || this.context === 'over' || this.isSeen(id)) return;
    if (this.current === id || this.queue.some((entry) => entry.id === id)) return;
    if (ON_BOARD.has(id) && this.context !== 'board') return; // the board it explains is gone
    if (!this.enabled()) return; // not marked seen: switching hints back on shows them later
    this.queue.push({ id, request });
    this.queue.sort((a, b) => HINT_PRIORITY[a.id] - HINT_PRIORITY[b.id]);
    this.pump();
  }

  setContext(context: HintContext): void {
    if (this.disposed || context === this.context) return;
    this.context = context;
    if (context === 'over') {
      this.queue = [];
      this.hide();
      return;
    }
    // Board hints belong to the board; other hints never cover it. A hidden hint stays seen (task 32).
    if (this.current && ON_BOARD.has(this.current) !== (context === 'board')) this.hide();
    if (context === 'game') this.queue = this.queue.filter((entry) => !ON_BOARD.has(entry.id));
    this.pump();
  }

  /** Tap on the strip or anywhere in the run, or the auto-hide timer. */
  hide(): void {
    if (this.current === null) return; // nothing shown (the gap timer keeps running)
    if (this.timer !== null) { this.timers.clear(this.timer); this.timer = null; }
    this.current = null;
    this.view.hide();
    if (this.disposed) return;
    // A short gap so two strips never read as one.
    this.cooling = true;
    this.timer = this.timers.set(() => { this.timer = null; this.cooling = false; this.pump(); }, this.gapMs);
  }

  dispose(): void {
    this.disposed = true;
    this.queue = [];
    if (this.timer !== null) { this.timers.clear(this.timer); this.timer = null; }
    if (this.current !== null) { this.current = null; this.view.hide(); }
  }

  private isSeen(id: HintId): boolean {
    let value = this.seen.get(id);
    if (value === undefined) { value = hintSeen(this.storage, id); this.seen.set(id, value); }
    return value;
  }

  private pump(): void {
    if (this.disposed || this.current !== null || this.cooling || this.context === 'over') return;
    if (!this.enabled()) { this.queue = []; return; }
    const at = this.queue.findIndex((entry) => this.context !== 'board' || ON_BOARD.has(entry.id));
    if (at < 0) return;
    const [entry] = this.queue.splice(at, 1);
    if (entry.request.valid && !entry.request.valid()) { this.pump(); return; }
    this.current = entry.id;
    this.seen.set(entry.id, true);
    try { this.storage?.setItem(HINT_KEYS[entry.id], '1'); } catch { /* storage is optional */ }
    this.view.show(entry.id, entry.request.content(), ON_BOARD.has(entry.id));
    this.timer = this.timers.set(() => { this.timer = null; this.hide(); }, this.visibleMs());
  }
}

// Airport split-flap mechanics. All calculations are made on Unicode code points.
import { reducedMotion } from './motion'; // [night-11g] D-88
export const FLAP_DURATION_MS = 76;
export const FLAP_STAGGER_MS = 24;

export function splitFlapCells(value: string, maxCells = 48): string[] {
  if (!Number.isInteger(maxCells) || maxCells < 0) throw new RangeError('maxCells must be a non-negative integer');
  const points = Array.from(value.normalize('NFC'));
  if (points.length <= maxCells) return points;
  if (maxCells === 0) return [];
  return [...points.slice(0, maxCells - 1), '…'];
}

export interface FlapStep {
  readonly index: number;
  readonly from: string;
  readonly to: string;
  readonly delay: number;
  readonly duration: number;
}

/** [night-69a] D-324: `timing` overrides the flip and the stagger (the UI-A board flips 120 ms per cell, 30 ms apart)
 *  and `offset` delays the whole change (several one-cell boards flipping as one row). */
export function planFlapChange(previous: string, next: string, maxCells = 48,
  timing: { durationMs?: number; staggerMs?: number; offsetMs?: number } = {}): FlapStep[] {
  const duration = timing.durationMs ?? FLAP_DURATION_MS;
  const stagger = timing.staggerMs ?? FLAP_STAGGER_MS;
  const offset = timing.offsetMs ?? 0;
  const before = splitFlapCells(previous, maxCells);
  const after = splitFlapCells(next, maxCells);
  const length = Math.max(before.length, after.length);
  const steps: FlapStep[] = [];
  let changed = 0;
  for (let index = 0; index < length; index++) {
    const from = before[index] ?? ' ';
    const to = after[index] ?? ' ';
    if (from !== to) {
      steps.push({ index, from, to, delay: offset + changed++ * stagger, duration });
    }
  }
  return steps;
}

export interface FlapOptions {
  maxCells?: number;
  highlight?: boolean;
  initialAnimation?: boolean;
  /** [night-69a] D-324: flip length and stagger in ms (default FLAP_DURATION_MS / FLAP_STAGGER_MS). */
  durationMs?: number;
  staggerMs?: number;
  /** [night-69a] D-324: no rattle (the in-game board flips every game minute; the sound hook is for the menu boards). */
  silent?: boolean;
}

/** [night-07e] Called when a board starts flipping `cells` tiles over `durationMs` (sound hook, D-71). */
export type SplitFlapListener = (cells: number, durationMs: number) => void;
let flapListener: SplitFlapListener | null = null;
/** [night-07e] One listener for every SplitFlap; the UI layer stays free of audio imports. */
export function onSplitFlapAnimate(listener: SplitFlapListener | null): void { flapListener = listener; }

function panel(className: string, letter: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  const ink = document.createElement('span');
  ink.className = 'flap-ink';
  ink.textContent = letter === ' ' ? '\u00a0' : letter;
  node.append(ink);
  return node;
}

/** Controls a reusable row of physically hinged half-tiles; no bouncing or per-frame work. */
export class SplitFlap {
  readonly element: HTMLSpanElement;
  private readonly maxCells: number;
  private readonly durationMs: number;
  private readonly staggerMs: number;
  private readonly silent: boolean;
  private readonly tiles: HTMLSpanElement[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private value = '';
  private disposed = false;

  constructor(value: string, options: FlapOptions = {}) {
    this.maxCells = options.maxCells ?? 48;
    this.durationMs = options.durationMs ?? FLAP_DURATION_MS;
    this.staggerMs = options.staggerMs ?? FLAP_STAGGER_MS;
    this.silent = options.silent ?? false;
    this.element = document.createElement('span');
    this.element.className = 'split-flap' + (options.highlight ? ' split-flap--highlight' : '');
    // [night-82b] T7: one image with a text name for screen readers (the board's label), not two letters per tile read
    // one by one: `role="text"` is no ARIA role and was ignored outside WebKit.
    this.element.setAttribute('role', 'img');
    this.set(value, false);
    if (options.initialAnimation) this.enter();
  }

  private isReducedMotion(): boolean {
    return reducedMotion(); // [night-11g] D-88: the game's switch, defaulting to the system
  }

  private schedule(action: () => void, delay: number): void {
    const timer = setTimeout(() => { this.timers.delete(timer); if (!this.disposed) action(); }, delay);
    this.timers.add(timer);
  }

  private cancel(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const tile of this.tiles) {
      tile.querySelectorAll('.flap-fold-out, .flap-fold-in').forEach((node) => node.remove());
    }
  }

  private buildTile(letter: string): HTMLSpanElement {
    const tile = document.createElement('span');
    tile.className = 'flap-tile';
    tile.setAttribute('aria-hidden', 'true');
    tile.append(panel('flap-half flap-half--top', letter), panel('flap-half flap-half--bottom', letter));
    return tile;
  }

  private putLetter(tile: HTMLSpanElement, letter: string): void {
    const nodes = tile.children;
    this.putHalfLetter(nodes[0] as HTMLElement, letter);
    this.putHalfLetter(nodes[1] as HTMLElement, letter);
  }

  private putHalfLetter(half: HTMLElement, letter: string): void {
    const ink = half.firstElementChild as HTMLElement;
    ink.textContent = letter === ' ' ? '\u00a0' : letter;
  }

  private ensureTiles(length: number): void {
    while (this.tiles.length < length) {
      const tile = this.buildTile(' ');
      this.tiles.push(tile);
      this.element.append(tile);
    }
    while (this.tiles.length > length) this.tiles.pop()?.remove();
  }

  /** Apply status or language changes; animates only changed cells ([night-69a] `delayMs`: start the flips later). */
  set(value: string, animate = true, delayMs = 0): void {
    if (this.disposed) return;
    const normalized = splitFlapCells(value, this.maxCells).join('');
    const previous = this.value;
    this.cancel();
    const steps = planFlapChange(previous, normalized, this.maxCells, { durationMs: this.durationMs, staggerMs: this.staggerMs, offsetMs: delayMs });
    const target = splitFlapCells(normalized, this.maxCells);
    const shouldAnimate = animate && !this.isReducedMotion();
    this.ensureTiles(shouldAnimate ? Math.max(target.length, splitFlapCells(previous, this.maxCells).length) : target.length);
    this.value = normalized;
    this.element.setAttribute('aria-label', normalized);
    this.element.dataset.value = normalized;
    if (!shouldAnimate) {
      target.forEach((letter, index) => this.putLetter(this.tiles[index], letter));
      return;
    }
    if (steps.length && !this.silent) flapListener?.(steps.length, steps[steps.length - 1].delay + this.durationMs);
    const stepsByIndex = new Map(steps.map((step) => [step.index, step]));
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      const step = stepsByIndex.get(i);
      if (!step) { this.putLetter(tile, target[i] ?? ' '); continue; }
      this.putLetter(tile, step.from);
      this.schedule(() => {
        const top = tile.children[0] as HTMLElement;
        const bottom = tile.children[1] as HTMLElement;
        this.putHalfLetter(top, step.to);
        this.putHalfLetter(bottom, step.from);
        const foldOut = panel('flap-half flap-fold-out', step.from);
        const foldIn = panel('flap-half flap-fold-in', step.to);
        tile.append(foldOut, foldIn);
        // Force style calculation once per flipped cell so the CSS hinge starts reliably.
        void foldOut.offsetWidth;
        foldOut.classList.add('flap-fold-out--active');
        foldIn.classList.add('flap-fold-in--active');
      }, step.delay);
      this.schedule(() => this.putLetter(tile, step.to), step.delay + step.duration / 2);
      this.schedule(() => {
        this.putLetter(tile, step.to);
        tile.querySelectorAll('.flap-fold-out, .flap-fold-in').forEach((node) => node.remove());
      }, step.delay + step.duration + 12);
    }
    if (this.tiles.length > target.length) {
      const last = steps[steps.length - 1];
      this.schedule(() => this.ensureTiles(target.length), (last?.delay ?? 0) + this.durationMs + 15);
    }
  }

  /** Animate the first reveal without changing the accessible final label. */
  enter(): void {
    const next = this.value;
    this.value = ' '.repeat(splitFlapCells(next, this.maxCells).length);
    this.set(next);
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.element.remove();
  }
}

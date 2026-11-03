// Airport split-flap mechanics. All calculations are made on Unicode code points.
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

export function planFlapChange(previous: string, next: string, maxCells = 48): FlapStep[] {
  const before = splitFlapCells(previous, maxCells);
  const after = splitFlapCells(next, maxCells);
  const length = Math.max(before.length, after.length);
  const steps: FlapStep[] = [];
  let changed = 0;
  for (let index = 0; index < length; index++) {
    const from = before[index] ?? ' ';
    const to = after[index] ?? ' ';
    if (from !== to) {
      steps.push({ index, from, to, delay: changed++ * FLAP_STAGGER_MS, duration: FLAP_DURATION_MS });
    }
  }
  return steps;
}

export interface FlapOptions {
  maxCells?: number;
  highlight?: boolean;
  initialAnimation?: boolean;
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
  private readonly tiles: HTMLSpanElement[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private value = '';
  private disposed = false;

  constructor(value: string, options: FlapOptions = {}) {
    this.maxCells = options.maxCells ?? 48;
    this.element = document.createElement('span');
    this.element.className = 'split-flap' + (options.highlight ? ' split-flap--highlight' : '');
    this.element.setAttribute('role', 'text');
    this.set(value, false);
    if (options.initialAnimation) this.enter();
  }

  private isReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /** Apply status or language changes; animates only changed cells. */
  set(value: string, animate = true): void {
    if (this.disposed) return;
    const normalized = splitFlapCells(value, this.maxCells).join('');
    const previous = this.value;
    this.cancel();
    const steps = planFlapChange(previous, normalized, this.maxCells);
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
    if (steps.length) flapListener?.(steps.length, steps[steps.length - 1].delay + FLAP_DURATION_MS);
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
      this.schedule(() => this.ensureTiles(target.length), (last?.delay ?? 0) + FLAP_DURATION_MS + 15);
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

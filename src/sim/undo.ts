import { copyState, type SimState } from './state.ts';

export const CHECKPOINT_EVERY_TICKS = 600;
export const MAX_CHECKPOINTS = 64;

export interface Checkpoint {
  readonly tick: number;
  readonly commandCount: number;
  readonly state: SimState;
}

function copyCheckpoint(value: Checkpoint): Checkpoint {
  return { tick: value.tick, commandCount: value.commandCount, state: copyState(value.state) };
}

/** A bounded in-memory ring. The seed always provides a fallback tick-zero checkpoint. */
export class CheckpointRing {
  private readonly items: Checkpoint[] = [];

  capture(state: SimState): void {
    const point = { tick: state.tick, commandCount: state.commandCount, state: copyState(state) };
    const last = this.items[this.items.length - 1];
    if (last?.tick === point.tick) this.items[this.items.length - 1] = point;
    else this.items.push(point);
    if (this.items.length > MAX_CHECKPOINTS) this.items.shift();
  }

  /** A checkpoint at the edited command's tick is already too late for undo. */
  before(tick: number): Checkpoint | undefined {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].tick < tick) return copyCheckpoint(this.items[i]);
    }
    return undefined;
  }

  truncateAfter(tick: number): void {
    while (this.items.length && this.items[this.items.length - 1].tick > tick) this.items.pop();
  }

  export(): Checkpoint[] { return this.items.map(copyCheckpoint); }

  /**
   * [night-60a] D-321: the ring as it stands, for a refused Undo to put back. Checkpoints are never changed in place
   * (capture and replace store fresh copies, before() hands out copies), so keeping the references is enough.
   */
  keep(): readonly Checkpoint[] { return this.items.slice(); }

  /** [night-60a] Put back a ring taken by keep(). */
  putBack(points: readonly Checkpoint[]): void {
    this.items.length = 0;
    this.items.push(...points);
  }

  replace(points: readonly Checkpoint[]): void {
    this.items.length = 0;
    for (const point of points) this.items.push(copyCheckpoint(point));
  }
}

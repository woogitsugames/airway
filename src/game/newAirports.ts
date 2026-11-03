// [night-10a] Which airports carry the "new" mark: one that opened during this session stays marked until a
// route serves it or NEW_MARK_TICKS pass. Presentation only — reads ticks and route lists, never run state.

/** 12 game hours (one tick = one game minute): long enough to notice, short enough not to linger. */
export const NEW_MARK_TICKS = 12 * 60;

const NO_CHANGES: ReadonlyArray<readonly [string, boolean]> = [];

export interface MarkRoute { readonly cityIds: readonly string[] }

export class NewAirportMarks {
  private readonly until = new Map<string, number>();
  private readonly shown = new Set<string>();
  private served = new Set<string>();
  private servedRevision = NaN;

  /** A CitySpawned event: mark it from `tick`. Airports present at start or on Continue are never marked. */
  opened(id: string, tick: number): void { this.until.set(id, tick + NEW_MARK_TICKS); }

  /**
   * `routes` is read only while a mark is live and the network `revision` changed, so the per-frame call
   * normally allocates nothing.
   * The ids whose mark changed since the last call, with the new state. `known` limits the result to airports
   * the overlay already has (the spawn event arrives before the first sync adds the airport).
   */
  update(tick: number, revision: number, routes: () => readonly MarkRoute[], known: (id: string) => boolean): ReadonlyArray<readonly [string, boolean]> {
    if (!this.until.size) return NO_CHANGES;
    if (revision !== this.servedRevision) {
      this.servedRevision = revision;
      this.served = new Set(routes().flatMap((route) => route.cityIds));
    }
    const served = this.served;
    let changes: Array<readonly [string, boolean]> | null = null;
    for (const [id, end] of this.until) {
      const on = tick < end && !served.has(id);
      if (!on) this.until.delete(id);
      if (on && !this.shown.has(id) && known(id)) { this.shown.add(id); (changes ??= []).push([id, true]); }
      else if (!on && this.shown.delete(id)) (changes ??= []).push([id, false]);
    }
    return changes ?? NO_CHANGES;
  }

  isMarked(id: string): boolean { return this.shown.has(id); }
}

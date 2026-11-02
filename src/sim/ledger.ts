// [task-08] Deterministic event and live-waiting accounting for the postmortem screen.
export type CauseEvent = 'delivered' | 'longWait' | 'noRoute' | 'full';
export interface CauseCounters {
  delivered: number;
  longWait: number;
  noRoute: number;
  full: number;
  waiting: number;
}
export interface CauseLedgerSnapshot {
  readonly totals: CauseCounters;
  readonly byHub: Record<string, CauseCounters>;
  readonly byRegion: Record<string, CauseCounters>;
  readonly waitingByHubRegion: Record<string, Record<string, number>>;
}
function zero(): CauseCounters { return { delivered: 0, longWait: 0, noRoute: 0, full: 0, waiting: 0 }; }
function clone(c: CauseCounters): CauseCounters { return { ...c }; }
function validCounters(value: CauseCounters): boolean {
  return ['delivered', 'longWait', 'noRoute', 'full', 'waiting'].every((key) => {
    const n = value[key as keyof CauseCounters];
    return Number.isSafeInteger(n) && n >= 0;
  });
}
function sortedCounters(values: Record<string, CauseCounters>): Record<string, CauseCounters> {
  const result: Record<string, CauseCounters> = {};
  for (const key of Object.keys(values).sort()) result[key] = clone(values[key]);
  return result;
}

export class CauseLedger {
  readonly totals = zero();
  private readonly byHub: Record<string, CauseCounters> = {};
  private readonly byRegion: Record<string, CauseCounters> = {};
  private readonly waitingByHubRegion: Record<string, Record<string, number>> = {};

  private bucket(collection: Record<string, CauseCounters>, id: string): CauseCounters {
    return collection[id] ?? (collection[id] = zero());
  }

  record(event: CauseEvent, cityId: string, regionId: string): void {
    this.totals[event]++;
    this.bucket(this.byHub, cityId)[event]++;
    this.bucket(this.byRegion, regionId)[event]++;
  }

  adjustWaiting(cityId: string, regionId: string, delta: 1 | -1): void {
    const hub = this.bucket(this.byHub, cityId);
    const region = this.bucket(this.byRegion, regionId);
    if (this.totals.waiting + delta < 0 || hub.waiting + delta < 0 || region.waiting + delta < 0) {
      throw new Error('Passenger waiting balance would become negative');
    }
    const counts = this.waitingByHubRegion[cityId] ?? (this.waitingByHubRegion[cityId] = {});
    const next = (counts[regionId] ?? 0) + delta;
    if (next < 0) throw new Error('Passenger region balance would become negative');
    counts[regionId] = next;
    this.totals.waiting += delta;
    hub.waiting += delta;
    region.waiting += delta;
  }

  waitingRegions(cityId: string): Record<string, number> {
    return { ...(this.waitingByHubRegion[cityId] ?? {}) };
  }

  hub(cityId: string): CauseCounters { return clone(this.byHub[cityId] ?? zero()); }
  region(regionId: string): CauseCounters { return clone(this.byRegion[regionId] ?? zero()); }

  snapshot(): CauseLedgerSnapshot {
    const waitingByHubRegion: Record<string, Record<string, number>> = {};
    for (const city of Object.keys(this.waitingByHubRegion).sort()) {
      const rows: Record<string, number> = {};
      for (const region of Object.keys(this.waitingByHubRegion[city]).sort()) rows[region] = this.waitingByHubRegion[city][region];
      waitingByHubRegion[city] = rows;
    }
    return { totals: clone(this.totals), byHub: sortedCounters(this.byHub),
      byRegion: sortedCounters(this.byRegion), waitingByHubRegion };
  }

  restore(saved: CauseLedgerSnapshot): void {
    if (!saved || !saved.totals || !validCounters(saved.totals) || !saved.byHub || !saved.byRegion ||
        !saved.waitingByHubRegion) throw new Error('Invalid cause ledger snapshot');
    for (const counters of Object.values(saved.byHub)) if (!validCounters(counters)) throw new Error('Invalid hub counters');
    for (const counters of Object.values(saved.byRegion)) if (!validCounters(counters)) throw new Error('Invalid region counters');
    for (const rows of Object.values(saved.waitingByHubRegion)) for (const n of Object.values(rows)) {
      if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ledger waiting count');
    }
    Object.assign(this.totals, saved.totals);
    for (const key of Object.keys(this.byHub)) delete this.byHub[key];
    for (const key of Object.keys(this.byRegion)) delete this.byRegion[key];
    for (const key of Object.keys(this.waitingByHubRegion)) delete this.waitingByHubRegion[key];
    for (const [key, value] of Object.entries(saved.byHub)) this.byHub[key] = clone(value);
    for (const [key, value] of Object.entries(saved.byRegion)) this.byRegion[key] = clone(value);
    for (const [key, value] of Object.entries(saved.waitingByHubRegion)) this.waitingByHubRegion[key] = { ...value };
  }
}

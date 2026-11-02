// [integration-ui] adapter: replace when src/sim exposes one gameplay facade ("Sim API" in
// docs/ARCHITECTURE.md). Until then this composes the pure sim modules that exist today
// (spawner 05, demand 08, network 08, plane params 09, weekly upgrades 12) into one run.
// Deterministic: the whole state is a function of seed + ordered command journal + tick count,
// so undo and save/load are journal replays. No DOM, no wall clock, no Math.random here.
import { Rng } from '../core/rng';
import { CITIES } from '../data/cities';
import { distanceKm as distanceByIndex } from '../data/generated/distances';
import type { RegionId } from '../data/regions';
import { advanceCitySpawner, createCitySpawner, type CitySpawnerState } from '../sim/spawner';
import { RegionalDemand, type DemandCity } from '../sim/demand';
import {
  CITY_WAITING_CAPACITY, CONGESTION_GRACE_TICKS, HUB_WAITING_CAPACITY, INITIAL_PLANE_RESERVE,
  MIN_AIRPORT_SERVICE_TICKS, PLANE_PROGRESS_SCALE, PLANE_TYPES, WAIT_TOO_LONG_TICKS,
} from '../sim/params';
import {
  chooseUpgrade, startWeeklyUpgrade, TICKS_PER_WEEK,
  type HubPressure, type UpgradeKind, type WeeklyUpgradeState,
} from '../sim/upgrades';
import type { HubCauseLedger } from './causes';

export type AircraftType = 'turboprop' | 'widebody';
export type RunCommand =
  | { readonly type: 'AddRoute'; readonly cityIds: readonly string[]; readonly aircraft: AircraftType }
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly cityIds: readonly string[] }
  | { readonly type: 'RemoveRoute'; readonly routeId: string }
  | { readonly type: 'ShortenRoute'; readonly routeId: string; readonly end: 'start' | 'end' }
  | { readonly type: 'AssignPlane'; readonly routeId: string; readonly aircraft: AircraftType }
  | { readonly type: 'ChooseUpgrade'; readonly upgrade: UpgradeKind; readonly hubId?: string }
  /** QA-only (window.aw in dev builds): fills one terminal so the jam path can be tested. */
  | { readonly type: 'DevOverload'; readonly cityId: string };
export type JournalEntry = readonly [tick: number, command: RunCommand];

export interface RunCity {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly region: RegionId;
  readonly waiting: readonly RegionId[];
  readonly capacity: number;
  readonly hub: boolean;
  /** Ticks left before this terminal jams the run, or null while it has room. */
  readonly jamTicksLeft: number | null;
}
export interface RunRoute { readonly id: string; readonly cityIds: readonly string[]; readonly aircraft: AircraftType }
export interface RunPlane {
  readonly id: string; readonly routeId: string; readonly type: AircraftType;
  readonly segment: number; readonly progress01: number; readonly direction: 1 | -1;
  readonly load: number; readonly capacity: number;
}
export interface RunFailure {
  readonly tick: number;
  readonly cityId: string;
  readonly ledger: HubCauseLedger;
  readonly departures: readonly { routeId: string; destination: string }[];
}
export type RunEvent =
  | { readonly type: 'arrival' | 'transfer'; readonly cityId: string }
  | { readonly type: 'new-city'; readonly cityId: string }
  | { readonly type: 'week'; readonly week: number }
  | { readonly type: 'jam'; readonly cityId: string; readonly jammed: boolean }
  | { readonly type: 'failure'; readonly cityId: string };

interface Passenger { id: number; region: RegionId; since: number }
interface CityState {
  index: number; id: string; region: RegionId; waiting: Passenger[]; extra: number; jam: number;
  noRoute: number; seatsUnavailable: number; waitingTooLong: number; congested: number;
}
interface PlaneState {
  id: string; routeId: string; type: AircraftType; segment: number; km: number; direction: 1 | -1;
  dwell: number; load: Passenger[];
}
interface RouteState { id: string; cityIds: string[]; aircraft: AircraftType }

const CITY_INDEX = new Map(CITIES.map((city, index) => [city.code, index]));
const START_MINUTE = 6 * 60;

export function cityDistanceKm(a: string, b: string): number {
  const i = CITY_INDEX.get(a);
  const j = CITY_INDEX.get(b);
  return i === undefined || j === undefined ? -1 : distanceByIndex(i, j);
}

function demandCity(index: number): DemandCity {
  const city = CITIES[index];
  // Local time from longitude in whole hours; fine-grained zones are a sim-data concern.
  return { cityId: city.code, regionId: city.region, population: city.population,
    utcOffsetMinutes: Math.max(-720, Math.min(840, Math.round(city.lon / 15) * 60)) };
}

function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, '0');
}

export class EndlessRun {
  readonly seed: number;
  private tickValue = 0;
  private journal: JournalEntry[] = [];
  private pending: RunCommand[] = [];
  private spawner: CitySpawnerState;
  private demand: RegionalDemand;
  private readonly cities = new Map<string, CityState>();
  private routes = new Map<string, RouteState>();
  private planes: PlaneState[] = [];
  private stock = { turboprop: INITIAL_PLANE_RESERVE.turboprop, widebody: INITIAL_PLANE_RESERVE.widebody, hub: 0 };
  private delivered = 0;
  private nextPassenger = 1;
  private nextRoute = 1;
  private nextPlane = 1;
  private upgrade: WeeklyUpgradeState | null = null;
  private readonly upgradeRng: Rng;
  private failure: RunFailure | null = null;
  private networkRevision = 0;
  private hops = new Map<RegionId, Map<string, number>>();
  private events: RunEvent[] = [];

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const root = new Rng(this.seed);
    this.upgradeRng = root.fork('upgrades');
    const demandRng = root.fork('demand');
    this.spawner = createCitySpawner(this.seed);
    this.demand = new RegionalDemand(CITIES.map((_, i) => demandCity(i)), cityDistanceKm, {
      fork: () => ({
        next: () => demandRng.next(),
        snapshot: () => demandRng.state,
        restore: (state: number) => demandRng.setState(state),
      }),
    }, []);
    for (const index of this.spawner.activeCityIndices) this.activate(index);
  }

  /** Rebuild a run from its journal; used by undo and by save/load. */
  static replay(seed: number, journal: readonly JournalEntry[], untilTick: number): EndlessRun {
    const run = new EndlessRun(seed);
    let at = 0;
    while (run.tickValue < untilTick && !run.failure) {
      // Upgrade choices are journaled at the boundary tick they resolve; others at the next tick.
      while (at < journal.length && journal[at][0] <= run.tickValue + 1) run.pending.push(journal[at++][1]);
      const advanced = run.step();
      run.events.length = 0;
      if (!advanced) break;
    }
    // A choice made at the final boundary resolves without advancing time.
    while (at < journal.length) run.pending.push(journal[at++][1]);
    run.resolveBoundary();
    return run;
  }

  get tick(): number { return this.tickValue; }
  get clockMinute(): number { return this.tickValue + START_MINUTE; }
  get nextWeekTick(): number { return (Math.floor(this.tickValue / TICKS_PER_WEEK) + 1) * TICKS_PER_WEEK; }
  get passengers(): number { return this.delivered; }
  get revision(): number { return this.networkRevision; }
  get failed(): RunFailure | null { return this.failure; }
  get weeklyUpgrade(): WeeklyUpgradeState | null { return this.upgrade?.paused ? this.upgrade : null; }
  get inventory(): Readonly<{ turboprop: number; widebody: number; hub: number }> { return { ...this.stock }; }
  get commandLog(): readonly JournalEntry[] { return this.journal; }
  get assignments(): number { return this.planes.length; }
  get networkUndoable(): boolean { return this.journal.some(([, c]) => c.type !== 'ChooseUpgrade' && c.type !== 'DevOverload'); }

  /** Commands take effect at the next tick boundary, in submission order. */
  queue(command: RunCommand): boolean {
    if (this.failure || !this.validate(command)) return false;
    this.pending.push(command);
    return true;
  }

  drainEvents(): RunEvent[] { const out = this.events; this.events = []; return out; }

  /** Advance one minute. Returns false when the clock is held (weekly board or failure). */
  step(): boolean {
    this.resolveBoundary();
    if (this.failure || this.upgrade?.paused) return false;
    this.tickValue++;
    const now = this.pending;
    this.pending = [];
    for (const command of now) {
      this.journal.push([this.tickValue, command]);
      this.execute(command);
    }
    this.spawn();
    this.demand.tick(this.tickValue, (p) => this.board(p.originCityId, p.destinationRegion as RegionId));
    this.fly();
    this.congestion();
    if (!this.failure && this.tickValue % TICKS_PER_WEEK === 0) {
      this.upgrade = startWeeklyUpgrade(this.tickValue, { nextInt: (max) => this.upgradeRng.int(0, max - 1) });
      if (this.upgrade) this.events.push({ type: 'week', week: this.upgrade.week });
    }
    return true;
  }

  /** While the weekly board holds the clock, the choice executes at the current tick. */
  resolveBoundary(): void {
    if (!this.upgrade?.paused || !this.pending.some((c) => c.type === 'ChooseUpgrade')) return;
    const rest: RunCommand[] = [];
    for (const command of this.pending) {
      if (command.type === 'ChooseUpgrade' && this.upgrade?.paused) {
        this.journal.push([this.tickValue, command]);
        this.execute(command);
      } else rest.push(command);
    }
    this.pending = rest;
  }

  /** Undo the last network command by replaying the journal without it. */
  undo(): EndlessRun | null {
    for (let i = this.journal.length - 1; i >= 0; i--) {
      const command = this.journal[i][1];
      if (command.type === 'ChooseUpgrade' || command.type === 'DevOverload') continue;
      const journal = this.journal.filter((_, index) => index !== i);
      return EndlessRun.replay(this.seed, journal, this.tickValue);
    }
    return null;
  }

  cityList(): RunCity[] {
    const out: RunCity[] = [];
    for (const city of this.cities.values()) {
      const data = CITIES[city.index];
      const capacity = this.capacity(city);
      out.push({ id: city.id, lon: data.lon, lat: data.lat, region: city.region,
        waiting: city.waiting.map((p) => p.region), capacity, hub: this.routesAt(city.id) >= 2,
        jamTicksLeft: city.waiting.length > capacity ? Math.max(0, CONGESTION_GRACE_TICKS - city.jam) : null });
    }
    return out;
  }
  routeList(): RunRoute[] {
    return [...this.routes.values()].map((r) => ({ id: r.id, cityIds: [...r.cityIds], aircraft: r.aircraft }));
  }
  planeList(): RunPlane[] {
    return this.planes.map((p) => {
      const route = this.routes.get(p.routeId)!;
      const leg = Math.max(1, this.legKm(route, p.segment));
      const progress = Math.round(Math.max(0, Math.min(1, p.km / leg)) * PLANE_PROGRESS_SCALE);
      return { id: p.id, routeId: p.routeId, type: p.type, segment: p.segment, progress01: progress,
        direction: p.direction, load: p.load.length, capacity: PLANE_TYPES[p.type].seats };
    });
  }
  hubPressure(): HubPressure[] {
    return this.cityList().filter((c) => c.hub).map((c) => ({ hubId: c.id, waiting: c.waiting.length,
      capacity: c.capacity, label: c.id }));
  }

  /** Stable digest of everything a save must restore (excludes transient event buffers). */
  hash(): string {
    return hashText(JSON.stringify({
      seed: this.seed, tick: this.tickValue, delivered: this.delivered, stock: this.stock,
      cities: [...this.cities.values()].map((c) => [c.id, c.waiting.map((p) => p.id + p.region), c.extra, c.jam]),
      routes: this.routeList(), planes: this.planes.map((p) => [p.id, p.segment, p.km, p.direction, p.dwell, p.load.length]),
      upgrade: this.upgrade, journal: this.journal.length,
    }));
  }

  // ---- rules -------------------------------------------------------------------------

  private validate(command: RunCommand): boolean {
    switch (command.type) {
      case 'AddRoute':
        return this.stock[command.aircraft] > 0 && this.validPath(command.cityIds, command.aircraft);
      case 'ExtendRoute': {
        const route = this.routes.get(command.routeId);
        return !!route && command.cityIds.length > route.cityIds.length && this.validPath(command.cityIds, route.aircraft);
      }
      case 'RemoveRoute': return this.routes.has(command.routeId);
      case 'ShortenRoute': return (this.routes.get(command.routeId)?.cityIds.length ?? 0) > 2;
      case 'AssignPlane': {
        const route = this.routes.get(command.routeId);
        return !!route && route.aircraft === command.aircraft && this.stock[command.aircraft] > 0;
      }
      case 'ChooseUpgrade': return !!this.upgrade?.paused;
      case 'DevOverload': return this.cities.has(command.cityId);
    }
  }

  private validPath(ids: readonly string[], aircraft: AircraftType): boolean {
    if (ids.length < 2 || new Set(ids).size !== ids.length) return false;
    for (let i = 0; i < ids.length; i++) {
      if (!this.cities.has(ids[i])) return false;
      if (i > 0) {
        const km = cityDistanceKm(ids[i - 1], ids[i]);
        if (km <= 0 || km > PLANE_TYPES[aircraft].rangeKm) return false;
      }
    }
    return true;
  }

  private execute(command: RunCommand): void {
    if (!this.validate(command)) return;
    switch (command.type) {
      case 'AddRoute': {
        const id = 'R' + this.nextRoute++;
        this.routes.set(id, { id, cityIds: [...command.cityIds], aircraft: command.aircraft });
        this.addPlane(id, command.aircraft);
        break;
      }
      case 'ExtendRoute': {
        const route = this.routes.get(command.routeId)!;
        const first = route.cityIds[0];
        const shift = command.cityIds.indexOf(first);
        route.cityIds = [...command.cityIds];
        // Keep aircraft on the same physical leg when stops were prepended.
        for (const plane of this.planes) if (plane.routeId === route.id && shift > 0) plane.segment += shift;
        break;
      }
      case 'RemoveRoute': {
        this.routes.delete(command.routeId);
        this.planes = this.planes.filter((plane) => {
          if (plane.routeId !== command.routeId) return true;
          this.stock[plane.type]++;
          return false;
        });
        break;
      }
      case 'ShortenRoute': {
        const route = this.routes.get(command.routeId)!;
        if (command.end === 'start') route.cityIds.shift(); else route.cityIds.pop();
        const legs = route.cityIds.length - 1;
        for (const plane of this.planes) {
          if (plane.routeId !== route.id) continue;
          if (command.end === 'start') plane.segment--;
          if (plane.segment < 0 || plane.segment >= legs) { plane.segment = Math.max(0, Math.min(legs - 1, plane.segment)); plane.km = 0; plane.dwell = 0; }
        }
        break;
      }
      case 'AssignPlane': this.addPlane(command.routeId, command.aircraft); break;
      case 'ChooseUpgrade': {
        if (!this.upgrade) return;
        const week = this.upgrade.week;
        try {
          this.upgrade = chooseUpgrade(this.upgrade, { type: 'ChooseUpgrade', week, upgrade: command.upgrade, hubId: command.hubId }, {
            grantPlane: (type, count) => { this.stock[type] += count; },
            expandHub: (hubId, extra) => { const city = this.cities.get(hubId); if (city) { city.extra += extra; city.jam = 0; } },
            addDepartureSlots: () => { this.stock.hub++; },
          }, this.hubPressure().map((h) => h.hubId));
        } catch { /* Invalid choice: board stays open. */ }
        break;
      }
      case 'DevOverload': {
        const city = this.cities.get(command.cityId)!;
        const other = [...this.cities.values()].find((c) => c.region !== city.region)?.region ?? 'NAM';
        while (city.waiting.length <= this.capacity(city)) city.waiting.push({ id: this.nextPassenger++, region: other, since: this.tickValue });
        city.jam = CONGESTION_GRACE_TICKS - 1;
        break;
      }
    }
    if (command.type !== 'ChooseUpgrade' && command.type !== 'DevOverload') {
      this.networkRevision++;
      this.hops.clear();
    }
  }

  private addPlane(routeId: string, type: AircraftType): void {
    this.stock[type]--;
    this.planes.push({ id: 'P' + this.nextPlane++, routeId, type, segment: 0, km: 0, direction: 1,
      dwell: MIN_AIRPORT_SERVICE_TICKS, load: [] });
  }

  private activate(index: number): void {
    const city = CITIES[index];
    if (this.cities.has(city.code)) return;
    this.cities.set(city.code, { index, id: city.code, region: city.region, waiting: [], extra: 0, jam: 0,
      noRoute: 0, seatsUnavailable: 0, waitingTooLong: 0, congested: 0 });
    this.demand.setActiveCities([...this.cities.keys()]);
    this.hops.clear();
  }

  private spawn(): void {
    const result = advanceCitySpawner(this.spawner, this.tickValue);
    this.spawner = result.state;
    for (const index of result.spawnedCityIndices) {
      this.activate(index);
      this.events.push({ type: 'new-city', cityId: CITIES[index].code });
    }
  }

  private routesAt(cityId: string): number {
    let count = 0;
    for (const route of this.routes.values()) if (route.cityIds.includes(cityId)) count++;
    return count;
  }
  private capacity(city: CityState): number {
    return (this.routesAt(city.id) >= 2 ? HUB_WAITING_CAPACITY : CITY_WAITING_CAPACITY) + city.extra;
  }

  /** Hop count from each city to the nearest city of a region through the current network. */
  private hopsTo(region: RegionId): Map<string, number> {
    let table = this.hops.get(region);
    if (table) return table;
    table = new Map();
    const frontier: string[] = [];
    for (const city of this.cities.values()) if (city.region === region) { table.set(city.id, 0); frontier.push(city.id); }
    const neighbours = new Map<string, string[]>();
    for (const route of this.routes.values()) {
      for (const a of route.cityIds) for (const b of route.cityIds) {
        if (a === b) continue;
        (neighbours.get(a) ?? neighbours.set(a, []).get(a)!).push(b);
      }
    }
    for (let i = 0; i < frontier.length; i++) {
      const at = frontier[i];
      const next = table.get(at)! + 1;
      for (const other of neighbours.get(at) ?? []) {
        if (table.has(other)) continue;
        table.set(other, next);
        frontier.push(other);
      }
    }
    this.hops.set(region, table);
    return table;
  }

  private board(cityId: string, region: RegionId): void {
    const city = this.cities.get(cityId);
    if (!city) return;
    if (!this.hopsTo(region).has(cityId)) city.noRoute++;
    city.waiting.push({ id: this.nextPassenger++, region, since: this.tickValue });
  }

  private legKm(route: RouteState, segment: number): number {
    return cityDistanceKm(route.cityIds[segment], route.cityIds[segment + 1]);
  }

  private fly(): void {
    for (const plane of this.planes) {
      const route = this.routes.get(plane.routeId);
      if (!route || route.cityIds.length < 2) continue;
      if (plane.dwell > 0) { plane.dwell--; continue; }
      plane.km += PLANE_TYPES[plane.type].speedKmPerTick;
      const leg = this.legKm(route, plane.segment);
      if (plane.km < leg) continue;
      // Arrived at the leg's far end.
      const arrivedIndex = plane.direction === 1 ? plane.segment + 1 : plane.segment;
      this.serve(plane, route, arrivedIndex);
      if (arrivedIndex === route.cityIds.length - 1 && plane.direction === 1) plane.direction = -1;
      else if (arrivedIndex === 0 && plane.direction === -1) plane.direction = 1;
      else plane.segment += plane.direction;
      plane.km = 0;
      plane.dwell = MIN_AIRPORT_SERVICE_TICKS;
    }
  }

  /** Unload, transfer and board at the stop with the given route index. */
  private serve(plane: PlaneState, route: RouteState, index: number): void {
    const cityId = route.cityIds[index];
    const city = this.cities.get(cityId);
    if (!city) return;
    const nextDirection = index === route.cityIds.length - 1 ? -1 : index === 0 ? 1 : plane.direction;
    const downstream: string[] = [];
    for (let i = index + nextDirection; i >= 0 && i < route.cityIds.length; i += nextDirection) downstream.push(route.cityIds[i]);
    const stay: Passenger[] = [];
    let arrivals = 0;
    for (const passenger of plane.load) {
      if (city.region === passenger.region) { this.delivered++; arrivals++; continue; }
      const table = this.hopsTo(passenger.region);
      const here = table.get(cityId) ?? Infinity;
      const ahead = Math.min(...downstream.map((id) => table.get(id) ?? Infinity));
      if (ahead < here) stay.push(passenger);
      else { city.waiting.push(passenger); this.events.push({ type: 'transfer', cityId }); }
    }
    plane.load = stay;
    if (arrivals) this.events.push({ type: 'arrival', cityId });
    const seats = PLANE_TYPES[plane.type].seats;
    const remaining: Passenger[] = [];
    for (const passenger of city.waiting) {
      const table = this.hopsTo(passenger.region);
      const here = table.get(cityId) ?? Infinity;
      const ahead = Math.min(...downstream.map((id) => table.get(id) ?? Infinity));
      if (ahead < here) {
        if (plane.load.length < seats) { plane.load.push(passenger); continue; }
        city.seatsUnavailable++;
      }
      remaining.push(passenger);
    }
    city.waiting = remaining;
  }

  private congestion(): void {
    for (const city of this.cities.values()) {
      for (const passenger of city.waiting) {
        if (this.tickValue - passenger.since === WAIT_TOO_LONG_TICKS) city.waitingTooLong++;
      }
      const over = city.waiting.length > this.capacity(city);
      if (over) {
        if (city.jam === 0) this.events.push({ type: 'jam', cityId: city.id, jammed: true });
        city.jam++;
        city.congested++;
        if (city.jam >= CONGESTION_GRACE_TICKS) { this.fail(city); return; }
      } else if (city.jam > 0) {
        city.jam = 0;
        this.events.push({ type: 'jam', cityId: city.id, jammed: false });
      }
    }
  }

  private fail(city: CityState): void {
    const byRegion: Partial<Record<RegionId, number>> = {};
    for (const passenger of city.waiting) byRegion[passenger.region] = (byRegion[passenger.region] ?? 0) + 1;
    const departures: { routeId: string; destination: string }[] = [];
    for (const route of this.routes.values()) {
      const at = route.cityIds.indexOf(city.id);
      if (at < 0) continue;
      for (const neighbour of [route.cityIds[at - 1], route.cityIds[at + 1]]) if (neighbour) departures.push({ routeId: route.id, destination: neighbour });
    }
    this.failure = {
      tick: this.tickValue, cityId: city.id, departures,
      ledger: { waiting: city.waiting.length, capacity: this.capacity(city), waitingByRegion: byRegion,
        noRoute: city.noRoute, seatsUnavailable: city.seatsUnavailable, waitingTooLong: city.waitingTooLong,
        congestedSeconds: Math.round(city.congested / 10) },
    };
    this.events.push({ type: 'failure', cityId: city.id });
  }
}

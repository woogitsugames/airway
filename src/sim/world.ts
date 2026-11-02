// The authoritative game world owned by the kernel (sim.ts): it composes the task 05 spawner,
// task 08 passengers/network/hubs/ledger, task 09 aircraft, task 11 day/night curfew and the
// task 12 weekly upgrade. Everything is integer and deterministic; RNG comes from kernel streams.
import { Rng } from '../core/rng.ts';
import { CITIES } from '../data/cities.ts';
import { CITY_RECORDS, cityDistanceKm, cityIndex } from '../data/index.ts';
import { TICKS_PER_WEEK } from './clock.ts';
import type { Command, CommandCheck, RejectReason } from './commands.ts';
import { CurfewPlanner, isLocalCurfewHour, localHourAt, type CurfewSnapshot } from './daynight.ts';
import type { DemandCity } from './demand.ts';
import type { HubFailure } from './hubs.ts';
import type { CauseCounters } from './ledger.ts';
import {
  CONGESTION_GRACE_TICKS, DEPARTURE_SLOTS_PER_HOUR_CITY, DEPARTURE_SLOTS_PER_HOUR_HUB, GAME_TICKS_PER_HOUR,
  INITIAL_PLANE_RESERVE, PLANE_TYPES, type PlaneType,
} from './params.ts';
import { PassengerSimulation, type PassengerSimulationSnapshot } from './passengers.ts';
import {
  assignPlane, createPlaneFleet, createScheduledRoute, grantPlanes, isPlaneType, planeTouchesStop,
  reshapeScheduledRoute, unassignPlane, validatePlaneRange, type PlaneFleet, type PlaneState,
  type ScheduledRoute,
} from './planes.ts';
import {
  tickPlaneSchedule, type DepartureSlotGate, type PlaneCurfewGate, type PlanePassengerPort,
} from './schedule.ts';
import { advanceCitySpawner, createCitySpawner, type CitySpawnerState } from './spawner.ts';
import type { RngStream } from './state.ts';
import {
  cancelUpgradePick, chooseUpgrade, startWeeklyUpgrade, type UpgradeCommand, type UpgradeKind, type WeeklyUpgradeState,
} from './upgrades.ts';

export const WORLD_VERSION = 1 as const;
export type GameMode = 'endless' | 'daily' | 'puzzle';
export type WorldStatus = 'running' | 'upgrade' | 'won' | 'over';

/** Scripted passengers (puzzles): `passengers` tickets every `everyMinutes`, from `firstMinute`. */
export interface DemandWave {
  readonly fromCityId: string;
  readonly toRegion: string;
  readonly passengers: number;
  readonly firstMinute: number;
  readonly everyMinutes: number;
}

/**
 * Mode rules. Endless/Daily: seeded spawner, random regional demand, weekly upgrades, curfew from
 * week 4 (D-17). A puzzle scenario fixes cities, stock, scripted demand and its own curfew cities.
 */
export interface Scenario {
  readonly startCityIds: readonly string[] | null;
  readonly randomDemand: boolean;
  readonly demandWaves: readonly DemandWave[];
  readonly reserve: Readonly<Record<PlaneType, number>>;
  readonly hubUpgrades: number;
  readonly weeklyUpgrades: boolean;
  /** null = endless weekly selection (from week 4); a list = always-on puzzle curfew cities. */
  readonly curfewCityIds: readonly string[] | null;
  /** Puzzle runs end at this world minute (status 'won'; the puzzle goal grades the result). */
  readonly endMinute: number | null;
  /** Per-city base waiting capacity overrides (puzzles). */
  readonly capacityByCity: Readonly<Record<string, number>>;
}

export const ENDLESS_SCENARIO: Scenario = Object.freeze({
  startCityIds: null, randomDemand: true, demandWaves: [], reserve: INITIAL_PLANE_RESERVE,
  hubUpgrades: 0, weeklyUpgrades: true, curfewCityIds: null, endMinute: null, capacityByCity: {},
});

export interface UpgradeRecord { readonly week: number; readonly upgrade: UpgradeKind; readonly hubId?: string }

export interface WorldSnapshot {
  readonly version: typeof WORLD_VERSION;
  readonly minute: number;
  readonly status: WorldStatus;
  readonly nextRouteSerial: number;
  readonly passengers: PassengerSimulationSnapshot;
  readonly fleet: PlaneFleet;
  readonly manifests: Record<string, number[]>;
  readonly spawner: CitySpawnerState | null;
  readonly curfew: CurfewSnapshot;
  readonly upgrade: WeeklyUpgradeState | null;
  readonly upgradeHistory: readonly UpgradeRecord[];
  readonly hubUpgradeStock: number;
  /** [task-32] D-41 departure slots (D-28 per-airport hourly limit), enforced. */
  readonly slots: DepartureSlotsSnapshot;
}

/** [task-32] Departure-slot bookkeeping; every record is keyed by city id and sorted on save. */
export interface DepartureSlotsSnapshot {
  /** Game hour (floor(minute / 60)) that `used` counts. */
  readonly hour: number;
  readonly used: Record<string, number>;
  /** Extra hourly departures from "+2 slots" upgrades. */
  readonly bonus: Record<string, number>;
  /** Aircraft-minutes spent waiting for a slot (cause ledger, task 15). */
  readonly waitMinutes: Record<string, number>;
  /** True once any aircraft was held for a slot (one-time tutorial hint). */
  readonly everHeld: boolean;
}

/** Non-authoritative notifications for UI/audio; drained by the caller, never hashed or saved. */
export type SimEvent =
  | { readonly type: 'CitySpawned'; readonly minute: number; readonly cityId: string }
  | { readonly type: 'RouteAdded'; readonly minute: number; readonly routeId: string; readonly planeId: string | null }
  | { readonly type: 'RouteChanged'; readonly minute: number; readonly routeId: string }
  | { readonly type: 'RouteRemoved'; readonly minute: number; readonly routeId: string }
  | { readonly type: 'PlaneAssigned'; readonly minute: number; readonly planeId: string; readonly routeId: string }
  | { readonly type: 'PlaneUnassigned'; readonly minute: number; readonly planeId: string }
  | { readonly type: 'Delivered'; readonly minute: number; readonly cityId: string; readonly count: number }
  | { readonly type: 'HubUpgraded'; readonly minute: number; readonly hubId: string }
  | { readonly type: 'CommandRejected'; readonly minute: number; readonly command: Command; readonly reason: RejectReason }
  | { readonly type: 'CurfewAnnounced'; readonly minute: number; readonly week: number; readonly cityIds: readonly string[] }
  | { readonly type: 'UpgradeOffered'; readonly minute: number; readonly week: number; readonly offers: readonly UpgradeKind[] }
  | { readonly type: 'UpgradeChosen'; readonly minute: number; readonly week: number; readonly upgrade: UpgradeKind; readonly hubId?: string }
  | { readonly type: 'HubJamStarted'; readonly minute: number; readonly cityId: string }
  | { readonly type: 'HubJamCleared'; readonly minute: number; readonly cityId: string }
  /** [task-32] An aircraft became ready but its airport had no departure slot left this hour. */
  | { readonly type: 'DepartureHeld'; readonly minute: number; readonly cityId: string; readonly planeId: string; readonly first: boolean }
  | { readonly type: 'GameOver'; readonly minute: number; readonly failure: HubFailure | null; readonly status: 'won' | 'over' };

/** Read-only per-city view for HUD, overlay, render and audio. */
export interface CityView {
  readonly id: string;
  readonly regionId: string;
  readonly waiting: number;
  readonly capacity: number;
  readonly isHub: boolean;
  readonly upgradeLevels: number;
  readonly transferTicks: number;
  /** Ticks of continuous congestion so far; 0 when the terminal is not full. */
  readonly fullTicks: number;
  /** Ticks left before this terminal ends the game, or null when not congested. */
  readonly jamTicksRemaining: number | null;
  readonly waitingByRegion: Readonly<Record<string, number>>;
  readonly localHour: number;
  readonly curfewCity: boolean;
  readonly curfewClosed: boolean;
  readonly routes: number;
  /** [task-32] Hourly departure allowance (base for city/hub + upgrades). */
  readonly departureSlots: number;
  /** [task-32] Departures already used in the current game hour. */
  readonly departuresThisHour: number;
  /** [task-32] Ready aircraft held on the ground for a slot right now. */
  readonly slotHeldPlanes: number;
  /** [task-32] Minutes until the next game hour frees the slots (meaningful when slotHeldPlanes > 0). */
  readonly nextSlotMinutes: number;
}
export interface RouteView { readonly id: string; readonly cityIds: readonly string[]; readonly legKm: readonly number[]; readonly planeIds: readonly string[] }

/** Shape consumed by src/game/causes.ts buildCauseReport (task 15); only real counters are filled. */
export interface HubCauseLedgerView {
  readonly waiting: number;
  readonly capacity: number;
  readonly waitingByRegion: Readonly<Record<string, number>>;
  readonly noRoute: number;
  readonly waitingTooLong: number;
  readonly congestedSeconds: number;
  /** [task-32] Aircraft-minutes spent waiting for a departure slot at this airport. */
  readonly slotWaitMinutes: number;
}

/** Read-only face of the world handed to UI, render, audio, modes and tools (Sim.world). */
export interface WorldView {
  readonly minute: number;
  readonly status: WorldStatus;
  readonly score: number;
  readonly failure: HubFailure | null;
  readonly offer: Readonly<WeeklyUpgradeState> | null;
  readonly upgrades: readonly UpgradeRecord[];
  readonly hubUpgradesInStock: number;
  /** Total extra hourly departures granted by "+2 slots" upgrades (all airports). */
  readonly departureSlots: number;
  /** [task-32] Hourly departure allowance of one airport. */
  departureSlotLimit(cityId: string): number;
  readonly planes: readonly Readonly<PlaneState>[];
  readonly reserve: Readonly<Record<PlaneType, number>>;
  readonly curfewCityIds: readonly string[];
  readonly totals: Readonly<CauseCounters>;
  readonly scenario: Scenario;
  activeCityIds(): string[];
  cityView(cityId: string): CityView;
  cities(): CityView[];
  routes(): RouteView[];
  hubCauseLedger(cityId: string): HubCauseLedgerView;
}

function sortedRecord(values: ReadonlyMap<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...values.keys()].sort()) out[key] = values.get(key)!;
  return out;
}
function validRecord(value: unknown): value is Record<string, number> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every((n) => Number.isSafeInteger(n) && (n as number) >= 0);
}
function validSlots(value: DepartureSlotsSnapshot | undefined): boolean {
  return !!value && Number.isSafeInteger(value.hour) && value.hour >= 0 && validRecord(value.used) &&
    validRecord(value.bonus) && validRecord(value.waitMinutes) && typeof value.everHeld === 'boolean';
}
function loadRecord(target: Map<string, number>, values: Record<string, number>): void {
  target.clear();
  for (const key of Object.keys(values)) target.set(key, values[key]);
}

function routeDistance(a: string, b: string): number | undefined { return cityDistanceKm(a, b); }

const DEMAND_CITIES: readonly DemandCity[] = CITY_RECORDS.map((city) => ({
  cityId: city.code, regionId: city.region, population: city.population, utcOffsetH: city.utcOffsetH,
}));
const CURFEW_CITIES = CITY_RECORDS.map((city) => ({ cityId: city.code, utcOffsetH: city.utcOffsetH }));
const UTC_OFFSET = new Map(CITY_RECORDS.map((city) => [city.code, city.utcOffsetH]));
const MAX_RANGE_KM = PLANE_TYPES.widebody.rangeKm;

type Mutation = () => void;
type Plan = { readonly ok: true; readonly run: Mutation } | { readonly ok: false; readonly reason: RejectReason };
const reject = (reason: RejectReason): Plan => ({ ok: false, reason });
const accept = (run: Mutation): Plan => ({ ok: true, run });

export class World implements WorldView {
  readonly passengers: PassengerSimulation;
  private readonly curfew: CurfewPlanner;
  private readonly streams: Readonly<Record<RngStream, Rng>>;
  private fleet: PlaneFleet;
  private schedules: ScheduledRoute[] = [];
  private manifests = new Map<string, number[]>();
  private spawner: CitySpawnerState | null;
  private upgrade: WeeklyUpgradeState | null = null;
  private upgradeHistory: UpgradeRecord[] = [];
  private minuteValue = 0;
  private statusValue: WorldStatus = 'running';
  private nextRouteSerial = 1;
  private hubUpgradeStock: number;
  private slotHour = 0;
  private readonly slotsUsed = new Map<string, number>();
  private readonly slotBonus = new Map<string, number>();
  private readonly slotWait = new Map<string, number>();
  private slotEverHeld = false;
  private readonly jammed = new Set<string>();
  private events: SimEvent[] = [];

  constructor(seed: number, readonly scenario: Scenario, streams: Readonly<Record<RngStream, Rng>>) {
    this.streams = streams;
    let startIds: string[];
    if (scenario.startCityIds) {
      this.spawner = null;
      startIds = [...scenario.startCityIds];
    } else {
      this.spawner = createCitySpawner(streams.cities);
      startIds = this.spawner.activeCityIndices.map((index) => CITIES[index].code);
    }
    this.passengers = new PassengerSimulation(DEMAND_CITIES, (a, b) => {
      const km = routeDistance(a, b);
      if (km === undefined) throw new Error(`Unknown city pair ${a}-${b}`);
      return km;
    }, streams.demand, startIds, scenario.capacityByCity);
    this.curfew = new CurfewPlanner(scenario.curfewCityIds ? 'puzzle' : 'endless', CURFEW_CITIES,
      new Rng(seed >>> 0), scenario.curfewCityIds ?? []);
    this.curfew.setActiveCities(this.activeCityIds());
    this.curfew.advance(0);
    this.fleet = createPlaneFleet(scenario.reserve);
    this.hubUpgradeStock = scenario.hubUpgrades;
  }

  get minute(): number { return this.minuteValue; }
  get status(): WorldStatus { return this.statusValue; }
  get score(): number { return this.passengers.score; }
  get failure(): HubFailure | null { return this.passengers.failure; }
  get offer(): Readonly<WeeklyUpgradeState> | null { return this.upgrade; }
  get upgrades(): readonly UpgradeRecord[] { return this.upgradeHistory; }
  get hubUpgradesInStock(): number { return this.hubUpgradeStock; }
  get departureSlots(): number {
    let total = 0;
    for (const value of this.slotBonus.values()) total += value;
    return total;
  }

  departureSlotLimit(cityId: string): number {
    return (this.isHub(cityId) ? DEPARTURE_SLOTS_PER_HOUR_HUB : DEPARTURE_SLOTS_PER_HOUR_CITY) +
      (this.slotBonus.get(cityId) ?? 0);
  }
  /** Live, read-only aircraft states for the renderer (no copy per frame). */
  get planes(): readonly Readonly<PlaneState>[] { return this.fleet.planes; }
  get reserve(): Readonly<Record<PlaneType, number>> { return this.fleet.available; }
  get curfewCityIds(): readonly string[] { return this.curfew.curfewCityIds; }
  get totals(): Readonly<CauseCounters> { return this.passengers.ledger.totals; }

  activeCityIds(): string[] {
    const ids: string[] = [];
    for (const city of DEMAND_CITIES) if (this.passengers.isActive(city.cityId)) ids.push(city.cityId);
    return ids;
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
  clearEvents(): void { this.events = []; }

  // ---------------------------------------------------------------- commands

  check(command: Command): CommandCheck {
    const plan = this.plan(command);
    return plan.ok ? { ok: true } : { ok: false, reason: plan.reason };
  }

  /** Executes a validated command or records a rejection event. Never throws for domain errors. */
  apply(command: Command): CommandCheck {
    const plan = this.plan(command);
    if (!plan.ok) {
      this.events.push({ type: 'CommandRejected', minute: this.minuteValue, command, reason: plan.reason });
      return { ok: false, reason: plan.reason };
    }
    plan.run();
    return { ok: true };
  }

  private plan(command: Command): Plan {
    if (command.type === 'SetSpeed') return accept(() => undefined);
    if (this.statusValue === 'over' || this.statusValue === 'won') return reject('GAME_OVER');
    if (this.statusValue === 'upgrade' && command.type !== 'ChooseUpgrade' && command.type !== 'CancelUpgradePick') return reject('UPGRADE_PENDING'); // [task-39]
    switch (command.type) {
      case 'AddRoute': return this.planAddRoute(command.cityIds, command.aircraft);
      case 'ExtendRoute': return this.planExtend(command.routeId, command.end, command.cityIds);
      case 'ShortenRoute': return this.planShorten(command.routeId, command.end);
      case 'RemoveRoute': return this.planRemove(command.routeId);
      case 'AssignPlane': return this.planAssign(command.routeId, command.aircraft);
      case 'UnassignPlane': return this.planUnassign(command.planeId);
      case 'UpgradeHub': return this.planUpgradeHub(command.hubId);
      case 'ChooseUpgrade': return this.planChooseUpgrade(command);
      case 'CancelUpgradePick': return this.planCancelUpgradePick(command.week); // [task-39]
    }
  }

  private checkStops(cityIds: readonly string[], allowed: ReadonlySet<string> = new Set()): RejectReason | null {
    if (new Set(cityIds).size !== cityIds.length) return 'DUPLICATE_CITY';
    for (const id of cityIds) {
      if (cityIndex(id) === undefined) return 'UNKNOWN_CITY';
      if (!allowed.has(id) && !this.passengers.isActive(id)) return 'CITY_NOT_ACTIVE';
    }
    for (let i = 1; i < cityIds.length; i++) {
      const km = routeDistance(cityIds[i - 1], cityIds[i]);
      if (km === undefined || km <= 0) return 'UNKNOWN_CITY';
      if (km > MAX_RANGE_KM) return 'RANGE_EXCEEDED';
    }
    return null;
  }

  private planAddRoute(cityIds: readonly string[], aircraft?: PlaneType): Plan {
    const problem = this.checkStops(cityIds);
    if (problem) return reject(problem);
    const routeId = `R${this.nextRouteSerial}`;
    const schedule = createScheduledRoute(routeId, cityIds, routeDistance);
    if (aircraft !== undefined) {
      if (!isPlaneType(aircraft)) return reject('INVALID_PLANE_TYPE');
      if (!validatePlaneRange(schedule, aircraft).ok) return reject('RANGE_EXCEEDED');
    }
    return accept(() => {
      this.nextRouteSerial++;
      this.passengers.apply({ type: 'AddRoute', routeId, cities: cityIds });
      this.schedules.push(schedule);
      let planeId: string | null = null;
      if (aircraft !== undefined && this.fleet.available[aircraft] > 0) {
        const result = assignPlane(this.fleet, schedule, aircraft);
        if (result.ok) { planeId = result.value.id; this.manifests.set(planeId, []); }
      }
      this.events.push({ type: 'RouteAdded', minute: this.minuteValue, routeId, planeId });
    });
  }

  private route(routeId: string): ScheduledRoute | undefined {
    return this.schedules.find((route) => route.id === routeId);
  }

  private planesOn(routeId: string): PlaneState[] {
    return this.fleet.planes.filter((plane) => plane.routeId === routeId);
  }

  private rangeFits(schedule: ScheduledRoute, routeId: string): boolean {
    return this.planesOn(routeId).every((plane) => validatePlaneRange(schedule, plane.type).ok);
  }

  private planExtend(routeId: string, end: 'start' | 'end', cityIds: readonly string[]): Plan {
    const previous = this.route(routeId);
    if (!previous) return reject('UNKNOWN_ROUTE');
    const old = previous.cityIds;
    const added = cityIds.length - old.length;
    if (added < 1) return reject('ROUTE_MISMATCH');
    const offset = end === 'start' ? added : 0;
    for (let i = 0; i < old.length; i++) if (cityIds[offset + i] !== old[i]) return reject('ROUTE_MISMATCH');
    const problem = this.checkStops(cityIds, new Set(old));
    if (problem) return reject(problem);
    const probe = createScheduledRoute(routeId, cityIds, routeDistance);
    if (!this.rangeFits(probe, routeId)) return reject('RANGE_EXCEEDED');
    return accept(() => {
      // Prepend outward from the old first stop, or append outward from the old last stop.
      if (end === 'start') {
        for (let i = added - 1; i >= 0; i--) this.passengers.apply({ type: 'ExtendRoute', routeId, cityId: cityIds[i], end: 'start' });
      } else {
        for (let i = old.length; i < cityIds.length; i++) this.passengers.apply({ type: 'ExtendRoute', routeId, cityId: cityIds[i], end: 'end' });
      }
      this.replaceSchedule(reshapeScheduledRoute(this.fleet, previous, cityIds, offset, routeDistance));
      this.events.push({ type: 'RouteChanged', minute: this.minuteValue, routeId });
    });
  }

  private planShorten(routeId: string, end: 'start' | 'end'): Plan {
    const previous = this.route(routeId);
    if (!previous) return reject('UNKNOWN_ROUTE');
    if (previous.cityIds.length <= 2) return reject('ROUTE_TOO_SHORT');
    const removed = end === 'start' ? 0 : previous.cityIds.length - 1;
    if (this.planesOn(routeId).some((plane) => planeTouchesStop(plane, removed))) return reject('PLANE_AT_STOP');
    const cityIds = end === 'start' ? previous.cityIds.slice(1) : previous.cityIds.slice(0, -1);
    return accept(() => {
      this.passengers.apply({ type: 'ShortenRoute', routeId, end });
      this.replaceSchedule(reshapeScheduledRoute(this.fleet, previous, cityIds, end === 'start' ? -1 : 0, routeDistance));
      this.events.push({ type: 'RouteChanged', minute: this.minuteValue, routeId });
    });
  }

  private replaceSchedule(next: ScheduledRoute): void {
    const index = this.schedules.findIndex((route) => route.id === next.id);
    this.schedules[index] = next;
  }

  private planRemove(routeId: string): Plan {
    if (!this.route(routeId)) return reject('UNKNOWN_ROUTE');
    for (const plane of this.planesOn(routeId)) {
      if (plane.phase === 'flight') return reject('PLANE_IN_FLIGHT');
      if (plane.load > 0) return reject('PLANE_OCCUPIED');
    }
    return accept(() => {
      for (const plane of this.planesOn(routeId)) {
        unassignPlane(this.fleet, plane.id);
        this.manifests.delete(plane.id);
      }
      this.passengers.apply({ type: 'RemoveRoute', routeId });
      this.schedules = this.schedules.filter((route) => route.id !== routeId);
      this.events.push({ type: 'RouteRemoved', minute: this.minuteValue, routeId });
    });
  }

  private planAssign(routeId: string, aircraft: PlaneType): Plan {
    const schedule = this.route(routeId);
    if (!schedule) return reject('UNKNOWN_ROUTE');
    if (!isPlaneType(aircraft)) return reject('INVALID_PLANE_TYPE');
    if (!validatePlaneRange(schedule, aircraft).ok) return reject('RANGE_EXCEEDED');
    if (this.fleet.available[aircraft] === 0) return reject('NO_SPARE_PLANE');
    return accept(() => {
      const result = assignPlane(this.fleet, schedule, aircraft);
      if (!result.ok) throw new Error('validated plane assignment failed');
      this.manifests.set(result.value.id, []);
      this.events.push({ type: 'PlaneAssigned', minute: this.minuteValue, planeId: result.value.id, routeId });
    });
  }

  private planUnassign(planeId: string): Plan {
    const plane = this.fleet.planes.find((item) => item.id === planeId);
    if (!plane) return reject('UNKNOWN_PLANE');
    if (plane.phase === 'flight') return reject('PLANE_IN_FLIGHT');
    if (plane.load > 0) return reject('PLANE_OCCUPIED');
    return accept(() => {
      unassignPlane(this.fleet, planeId);
      this.manifests.delete(planeId);
      this.events.push({ type: 'PlaneUnassigned', minute: this.minuteValue, planeId });
    });
  }

  private isHub(cityId: string): boolean {
    return cityIndex(cityId) !== undefined && this.passengers.hubs.city(cityId).isHub;
  }

  private planUpgradeHub(hubId: string): Plan {
    if (this.hubUpgradeStock <= 0) return reject('NO_HUB_UPGRADE');
    if (!this.isHub(hubId)) return reject('NOT_A_HUB');
    return accept(() => {
      this.hubUpgradeStock--;
      this.passengers.upgradeHub(hubId);
      this.events.push({ type: 'HubUpgraded', minute: this.minuteValue, hubId });
    });
  }

  private hubIds(): string[] {
    const ids: string[] = [];
    for (const queue of this.passengers.hubs.all()) if (queue.isHub) ids.push(queue.cityId);
    return ids.sort();
  }

  private planChooseUpgrade(command: Extract<Command, { type: 'ChooseUpgrade' }>): Plan {
    const offer = this.upgrade;
    if (this.statusValue !== 'upgrade' || !offer) return reject('NO_UPGRADE_PENDING');
    const choice: UpgradeCommand = command.hubId === undefined
      ? { type: 'ChooseUpgrade', week: command.week, upgrade: command.upgrade }
      : { type: 'ChooseUpgrade', week: command.week, upgrade: command.upgrade, hubId: command.hubId };
    // Dry-run on a throwaway effect set to validate without mutating anything.
    try {
      chooseUpgrade(offer, choice, { grantPlane: () => undefined, expandHub: () => undefined,
        addDepartureSlots: () => undefined }, this.hubIds(), this.activeCityIds());
    } catch {
      return reject('UPGRADE_INVALID');
    }
    return accept(() => {
      const next = chooseUpgrade(offer, choice, {
        grantPlane: (type, count) => grantPlanes(this.fleet, type, count),
        expandHub: (hubId, extra, mct) => this.passengers.upgradeHub(hubId, extra, mct),
        addDepartureSlots: (count, cityId) => { this.slotBonus.set(cityId, (this.slotBonus.get(cityId) ?? 0) + count); },
      }, this.hubIds(), this.activeCityIds());
      if (next.paused) { this.upgrade = next; return; }
      this.upgrade = null;
      this.statusValue = 'running';
      const record: UpgradeRecord = choice.hubId === undefined
        ? { week: choice.week, upgrade: choice.upgrade } : { week: choice.week, upgrade: choice.upgrade, hubId: choice.hubId };
      this.upgradeHistory.push(record);
      this.events.push({ type: 'UpgradeChosen', minute: this.minuteValue, ...record });
    });
  }

  /** [task-39] Back from the airport pick to the offers (D-49); the world stays frozen on the board. */
  private planCancelUpgradePick(week: number): Plan {
    const offer = this.upgrade;
    if (this.statusValue !== 'upgrade' || !offer) return reject('NO_UPGRADE_PENDING');
    let next: WeeklyUpgradeState;
    try { next = cancelUpgradePick(offer, week); } catch { return reject('UPGRADE_INVALID'); }
    return accept(() => { this.upgrade = next; });
  }

  // ---------------------------------------------------------------- time

  private readonly port: PlanePassengerPort = {
    boardAt: (cityId, routeId, freeSeats, planeId, nextCityId) => {
      const tickets = this.passengers.boardAt(cityId, routeId, freeSeats, nextCityId);
      const manifest = this.manifests.get(planeId)!;
      for (const ticket of tickets) manifest.push(ticket.id);
      return tickets.length;
    },
    alightAt: (cityId, routeId, onBoard, planeId, onwardCityId) => {
      const manifest = this.manifests.get(planeId)!;
      if (manifest.length !== onBoard) throw new Error(`Manifest mismatch on ${planeId}`);
      if (onBoard === 0) return 0;
      const result = this.passengers.alightAt(cityId, routeId, manifest, onwardCityId);
      this.manifests.set(planeId, [...result.stayingOnboard]);
      if (result.delivered.length) {
        this.events.push({ type: 'Delivered', minute: this.minuteValue, cityId, count: result.delivered.length });
      }
      return onBoard - result.stayingOnboard.length;
    },
  };

  private readonly gate: PlaneCurfewGate = {
    canDepart: (from, to, duration) => this.curfew.canScheduleLeg(from, to, this.minuteValue, duration),
    canLand: (cityId) => this.curfew.canLand(cityId, this.minuteValue),
  };

  // [task-32] D-41: per-airport hourly departure allowance; slots reset at every game hour.
  private readonly slotGate: DepartureSlotGate = {
    tryTake: (cityId) => {
      const used = this.slotsUsed.get(cityId) ?? 0;
      if (used >= this.departureSlotLimit(cityId)) return false;
      this.slotsUsed.set(cityId, used + 1);
      return true;
    },
    held: (cityId, plane) => {
      this.slotWait.set(cityId, (this.slotWait.get(cityId) ?? 0) + 1);
      if (plane.slotWaitTicks === 1) {
        this.events.push({ type: 'DepartureHeld', minute: this.minuteValue, cityId, planeId: plane.id, first: !this.slotEverHeld });
        this.slotEverHeld = true;
      }
    },
  };

  /** Advance one world minute. Frozen while an upgrade is pending or after the run ended. */
  step(): void {
    if (this.statusValue !== 'running') return;
    const minute = ++this.minuteValue;
    if (this.spawner) {
      const spawned = advanceCitySpawner(this.spawner, minute, this.streams.cities);
      this.spawner = spawned.state;
      for (const index of spawned.spawnedCityIndices) {
        const cityId = CITIES[index].code;
        this.passengers.activateCity(cityId);
        this.events.push({ type: 'CitySpawned', minute, cityId });
      }
      if (spawned.spawnedCityIndices.length) this.curfew.setActiveCities(this.activeCityIds());
    }
    const notice = this.curfew.advance(minute);
    if (notice) this.events.push({ type: 'CurfewAnnounced', minute, week: notice.week, cityIds: notice.cityIds });

    this.passengers.beginMinute(minute, this.scenario.randomDemand);
    for (const wave of this.scenario.demandWaves) {
      const elapsed = minute - wave.firstMinute;
      if (elapsed >= 0 && elapsed % wave.everyMinutes === 0) {
        for (let i = 0; i < wave.passengers; i++) this.passengers.seedPassenger(wave.fromCityId, wave.toRegion);
      }
    }
    const hour = Math.floor(minute / GAME_TICKS_PER_HOUR);
    if (hour !== this.slotHour) { this.slotHour = hour; this.slotsUsed.clear(); }
    tickPlaneSchedule(this.fleet, this.schedules, this.port, this.gate, this.slotGate);
    const failure = this.passengers.endMinute();
    this.trackJams(minute);
    if (failure) {
      this.statusValue = 'over';
      this.events.push({ type: 'GameOver', minute, failure, status: 'over' });
      return;
    }
    if (this.scenario.endMinute !== null && minute >= this.scenario.endMinute) {
      this.statusValue = 'won';
      this.events.push({ type: 'GameOver', minute, failure: null, status: 'won' });
      return;
    }
    if (this.scenario.weeklyUpgrades && minute % TICKS_PER_WEEK === 0) {
      const offer = startWeeklyUpgrade(minute, { nextInt: (max) => this.streams.upgrades.int(max) });
      if (offer) {
        this.upgrade = offer;
        this.statusValue = 'upgrade';
        this.events.push({ type: 'UpgradeOffered', minute, week: offer.week, offers: offer.offers.map((o) => o.id) });
      }
    }
  }

  private trackJams(minute: number): void {
    for (const queue of this.passengers.hubs.all()) {
      const full = queue.fullTicks > 0;
      if (full && !this.jammed.has(queue.cityId)) {
        this.jammed.add(queue.cityId);
        this.events.push({ type: 'HubJamStarted', minute, cityId: queue.cityId });
      } else if (!full && this.jammed.has(queue.cityId)) {
        this.jammed.delete(queue.cityId);
        this.events.push({ type: 'HubJamCleared', minute, cityId: queue.cityId });
      }
    }
  }

  // ---------------------------------------------------------------- views

  cityView(cityId: string): CityView {
    const queue = this.passengers.hubs.city(cityId);
    const offset = UTC_OFFSET.get(cityId)!;
    const curfewCity = this.curfew.curfewCityIds.includes(cityId);
    return {
      id: cityId, regionId: this.passengers.regionOf(cityId)!, waiting: queue.waiting.length,
      capacity: queue.capacity, isHub: queue.isHub, upgradeLevels: queue.upgradeLevels,
      transferTicks: queue.transferTicks, fullTicks: queue.fullTicks,
      jamTicksRemaining: queue.fullTicks > 0 ? Math.max(0, CONGESTION_GRACE_TICKS - queue.fullTicks) : null,
      waitingByRegion: this.passengers.ledger.waitingRegions(cityId),
      localHour: localHourAt(this.minuteValue, offset), curfewCity,
      curfewClosed: curfewCity && isLocalCurfewHour(this.minuteValue, offset),
      routes: this.passengers.network.routesAt(cityId),
      departureSlots: this.departureSlotLimit(cityId),
      departuresThisHour: Math.floor(this.minuteValue / GAME_TICKS_PER_HOUR) === this.slotHour
        ? this.slotsUsed.get(cityId) ?? 0 : 0,
      slotHeldPlanes: this.slotHeldAt(cityId),
      nextSlotMinutes: GAME_TICKS_PER_HOUR - (this.minuteValue % GAME_TICKS_PER_HOUR),
    };
  }

  private slotHeldAt(cityId: string): number {
    let count = 0;
    for (const plane of this.fleet.planes) {
      if (plane.phase !== 'ground' || plane.slotWaitTicks === 0) continue;
      const route = this.route(plane.routeId);
      if (route && route.cityIds[plane.cityIndex] === cityId) count++;
    }
    return count;
  }

  cities(): CityView[] { return this.activeCityIds().map((id) => this.cityView(id)); }

  routes(): RouteView[] {
    return this.schedules.map((route) => ({
      id: route.id, cityIds: route.cityIds, legKm: route.segments.map((segment) => segment.distanceKm),
      planeIds: this.planesOn(route.id).map((plane) => plane.id),
    }));
  }

  hubCauseLedger(cityId: string): HubCauseLedgerView {
    const queue = this.passengers.hubs.city(cityId);
    const counters = this.passengers.ledger.hub(cityId);
    return {
      waiting: queue.waiting.length, capacity: queue.capacity,
      waitingByRegion: this.passengers.ledger.waitingRegions(cityId),
      noRoute: counters.noRoute, waitingTooLong: counters.longWait,
      // One tick is 1/10 s at 1x; whole seconds only.
      congestedSeconds: Math.floor(queue.fullTicks / 10),
      slotWaitMinutes: this.slotWait.get(cityId) ?? 0,
    };
  }

  // ---------------------------------------------------------------- persistence

  snapshot(): WorldSnapshot {
    const manifests: Record<string, number[]> = {};
    for (const key of [...this.manifests.keys()].sort()) manifests[key] = [...this.manifests.get(key)!];
    return {
      version: WORLD_VERSION, minute: this.minuteValue, status: this.statusValue,
      nextRouteSerial: this.nextRouteSerial, passengers: this.passengers.snapshot(),
      fleet: { available: { ...this.fleet.available }, nextPlaneSerial: this.fleet.nextPlaneSerial,
        planes: this.fleet.planes.map((plane) => ({ ...plane })) },
      manifests, spawner: this.spawner ? { ...this.spawner, activeCityIndices: [...this.spawner.activeCityIndices] } : null,
      curfew: this.curfew.snapshot(),
      upgrade: this.upgrade ? JSON.parse(JSON.stringify(this.upgrade)) as WeeklyUpgradeState : null,
      upgradeHistory: this.upgradeHistory.map((item) => ({ ...item })),
      hubUpgradeStock: this.hubUpgradeStock,
      slots: { hour: this.slotHour, used: sortedRecord(this.slotsUsed), bonus: sortedRecord(this.slotBonus),
        waitMinutes: sortedRecord(this.slotWait), everHeld: this.slotEverHeld },
    };
  }

  restore(saved: WorldSnapshot): void {
    const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
    if (!saved || saved.version !== WORLD_VERSION || !count(saved.minute) || !count(saved.nextRouteSerial) ||
        !['running', 'upgrade', 'won', 'over'].includes(saved.status) || !count(saved.hubUpgradeStock) ||
        !validSlots(saved.slots) || !saved.fleet || !Array.isArray(saved.fleet.planes) ||
        !saved.manifests || typeof saved.manifests !== 'object' || !Array.isArray(saved.upgradeHistory) ||
        (saved.spawner === null) !== (this.scenario.startCityIds !== null)) {
      throw new TypeError('invalid or incompatible world snapshot');
    }
    this.passengers.restore(saved.passengers);
    if (this.passengers.tick !== saved.minute) throw new TypeError('world clock mismatch');
    this.curfew.restore(saved.curfew);
    this.minuteValue = saved.minute;
    this.statusValue = saved.status;
    this.nextRouteSerial = saved.nextRouteSerial;
    this.spawner = saved.spawner ? { ...saved.spawner, activeCityIndices: [...saved.spawner.activeCityIndices] } : null;
    const fleet = createPlaneFleet(saved.fleet.available);
    if (!count(saved.fleet.nextPlaneSerial) || saved.fleet.nextPlaneSerial < 1) throw new TypeError('invalid fleet');
    fleet.nextPlaneSerial = saved.fleet.nextPlaneSerial;
    fleet.planes = saved.fleet.planes.map((plane) => ({ ...plane }));
    this.fleet = fleet;
    // Schedules are derived data: rebuilt from the network and the static distance table.
    this.schedules = this.passengers.network.routes.map((route) => createScheduledRoute(route.id, route.cities, routeDistance));
    this.manifests = new Map();
    let aboard = 0;
    for (const plane of fleet.planes) {
      const manifest = saved.manifests[plane.id];
      const route = this.route(plane.routeId);
      if (!Array.isArray(manifest) || manifest.length !== plane.load || !route || !isPlaneType(plane.type) ||
          plane.cityIndex < 0 || plane.cityIndex >= route.cityIds.length ||
          !Number.isSafeInteger(plane.slotWaitTicks) || plane.slotWaitTicks < 0) {
        throw new TypeError('aircraft does not match its manifest or route');
      }
      this.manifests.set(plane.id, [...manifest]);
      aboard += manifest.length;
    }
    if (aboard !== this.passengers.airborneCount || Object.keys(saved.manifests).length !== fleet.planes.length) {
      throw new TypeError('airborne passenger count mismatch');
    }
    this.upgrade = saved.upgrade ? JSON.parse(JSON.stringify(saved.upgrade)) as WeeklyUpgradeState : null;
    if ((this.upgrade !== null) !== (saved.status === 'upgrade')) throw new TypeError('upgrade state mismatch');
    this.upgradeHistory = saved.upgradeHistory.map((item) => ({ ...item }));
    this.hubUpgradeStock = saved.hubUpgradeStock;
    loadRecord(this.slotsUsed, saved.slots.used);
    loadRecord(this.slotBonus, saved.slots.bonus);
    loadRecord(this.slotWait, saved.slots.waitMinutes);
    this.slotHour = saved.slots.hour;
    this.slotEverHeld = saved.slots.everHeld;
    this.jammed.clear();
    for (const queue of this.passengers.hubs.all()) if (queue.fullTicks > 0) this.jammed.add(queue.cityId);
    this.events = [];
  }
}

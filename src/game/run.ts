// Read-model adapter between the authoritative Sim (src/sim, "Sim API") and the in-game layers.
// It only queues Commands and converts read-only views; it holds no game rules of its own.
import { cityByCode, cityDistanceKm as dataDistanceKm } from '../data';
import { REGION_IDS, type RegionId } from '../data/regions';
import {
  createGame, PLANE_TYPES, TICKS_PER_WEEK,
  type Command, type CommandEntry, type GameMode, type SimEvent, type UpgradeKind, type WeeklyUpgradeState,
} from '../sim';
import type { Sim } from '../sim';
import type { HubPressure } from '../sim/upgrades';
import type { SlotPressure } from '../ui/upgrade/cards'; // [task-32]
import { airportLabel, readAirportLabelMode } from '../ui/airportLabel'; // [night-05] D-68
import type { HubCauseLedger } from './causes';

export type AircraftType = 'turboprop' | 'widebody';
export type RunCommand = Command;
export type JournalEntry = CommandEntry;

export interface RunCity {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly region: RegionId;
  readonly waiting: readonly RegionId[];
  readonly capacity: number;
  readonly hub: boolean;
  readonly jamTicksLeft: number | null;
  /** [m2] Closed by the night curfew right now (read-only view, first-curfew hint). */
  readonly curfewClosed: boolean;
  /** [task-38] Aircraft held on the ground for a departure slot, and game minutes to the next slot. */
  readonly slotHeld: number;
  readonly nextSlotMinutes: number;
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
  | { readonly type: 'failure'; readonly cityId: string }
  /** [task-32] An aircraft is held on the ground for a departure slot (D-41). */
  | { readonly type: 'slot-held'; readonly cityId: string; readonly limit: number; readonly minutesToSlot: number };

/** Integer table distance from src/data; -1 for unknown pairs (route tool contract). */
export function cityDistanceKm(a: string, b: string): number {
  return dataDistanceKm(a, b) ?? -1;
}

function isRegion(value: string): value is RegionId {
  return (REGION_IDS as readonly string[]).includes(value);
}

export class EndlessRun {
  private revisionValue = 0;
  private readonly homeOffsetMinutes: number;

  constructor(readonly sim: Sim) {
    const home = sim.world.activeCityIds()[0];
    this.homeOffsetMinutes = Math.round((home ? cityByCode(home)?.utcOffsetH ?? 0 : 0) * 60);
  }

  static create(seed: number, mode: GameMode = 'endless'): EndlessRun {
    return new EndlessRun(createGame(seed, mode === 'daily' ? 'daily' : 'endless'));
  }

  get seed(): number { return this.sim.seed; }
  get mode(): GameMode { return this.sim.config.mode; }
  get tick(): number { return this.sim.tickCount; }
  /** UTC world minute: drives the sun and terminator. */
  get clockMinute(): number { return this.sim.world.minute; }
  /** Wall-clock minute at the home airport, for the boarding pass. */
  get localMinute(): number { return this.sim.world.minute + this.homeOffsetMinutes; }
  /** Authoritative tick at which the next weekly board opens (the calendar stops while it is open). */
  get nextWeekTick(): number {
    const minute = this.sim.world.minute;
    return this.tick + (TICKS_PER_WEEK - (minute % TICKS_PER_WEEK));
  }
  get passengers(): number { return this.sim.world.score; }
  get revision(): number { return this.revisionValue; }
  get weeklyUpgrade(): WeeklyUpgradeState | null {
    return this.sim.world.status === 'upgrade' ? this.sim.world.offer : null;
  }
  get inventory(): Readonly<{ turboprop: number; widebody: number; hub: number }> {
    const reserve = this.sim.world.reserve;
    return { turboprop: reserve.turboprop, widebody: reserve.widebody, hub: this.sim.world.hubUpgradesInStock };
  }
  get commandLog(): readonly JournalEntry[] { return this.sim.getCommandLog(); }
  get assignments(): number { return this.sim.world.planes.length; }
  get networkUndoable(): boolean {
    return this.sim.pendingCount > 0 || this.sim.getCommandLog().some(([, command]) => command.type !== 'ChooseUpgrade' && command.type !== 'CancelUpgradePick' && command.type !== 'SetSpeed'); // [task-39]
  }
  get failed(): RunFailure | null {
    if (this.sim.world.status !== 'over') return null;
    const failure = this.sim.world.failure;
    if (!failure) return null;
    const ledger = this.sim.world.hubCauseLedger(failure.cityId);
    const departures: { routeId: string; destination: string }[] = [];
    for (const route of this.sim.world.routes()) {
      const at = route.cityIds.indexOf(failure.cityId);
      if (at < 0) continue;
      for (const neighbour of [route.cityIds[at - 1], route.cityIds[at + 1]]) if (neighbour) departures.push({ routeId: route.id, destination: neighbour });
    }
    const byRegion: Partial<Record<RegionId, number>> = {};
    for (const [region, count] of Object.entries(ledger.waitingByRegion)) if (isRegion(region)) byRegion[region] = count;
    return {
      tick: failure.tick, cityId: failure.cityId, departures,
      ledger: { ...ledger, waitingByRegion: byRegion },
    };
  }

  /** Pre-flight check, then queue for the next tick (rejections are journaled by the sim). */
  queue(command: RunCommand): boolean {
    if (!this.sim.check(command).ok) return false;
    return this.sim.apply(command);
  }

  /** Advance one tick when the sim wants to run (not on an unanswered weekly board or after the end). */
  step(): boolean {
    if (this.sim.schedulingSpeed === 0 && this.sim.world.status !== 'running') return false;
    this.sim.tick();
    return true;
  }

  /** Resolve a queued weekly choice immediately, even while the player clock is paused. */
  resolveBoundary(): void {
    if (this.sim.world.status === 'upgrade' && this.sim.schedulingSpeed !== 0) this.sim.tick();
  }

  /** Undo in place; returns this run (or null when nothing can be undone). */
  undo(): EndlessRun | null {
    if (!this.sim.undo()) return null;
    this.revisionValue++;
    return this;
  }

  drainEvents(): RunEvent[] {
    const out: RunEvent[] = [];
    for (const event of this.sim.drainEvents() as SimEvent[]) {
      switch (event.type) {
        case 'CitySpawned': out.push({ type: 'new-city', cityId: event.cityId }); break;
        case 'RouteAdded': case 'RouteChanged': case 'RouteRemoved': case 'PlaneAssigned': case 'PlaneUnassigned':
          this.revisionValue++; break;
        case 'Delivered': out.push({ type: 'arrival', cityId: event.cityId }); break;
        case 'UpgradeOffered': out.push({ type: 'week', week: event.week }); break;
        case 'HubJamStarted': out.push({ type: 'jam', cityId: event.cityId, jammed: true }); break;
        case 'HubJamCleared': out.push({ type: 'jam', cityId: event.cityId, jammed: false }); break;
        case 'DepartureHeld': { // [task-32]
          const view = this.sim.world.cityView(event.cityId);
          out.push({ type: 'slot-held', cityId: event.cityId, limit: view.departureSlots, minutesToSlot: view.nextSlotMinutes });
          break;
        }
        case 'GameOver': if (event.failure) out.push({ type: 'failure', cityId: event.failure.cityId }); break;
        default: break;
      }
    }
    return out;
  }

  cityList(): RunCity[] {
    return this.sim.world.cities().map((view) => {
      const data = cityByCode(view.id);
      const waiting: RegionId[] = [];
      for (const region of REGION_IDS) {
        const count = view.waitingByRegion[region] ?? 0;
        for (let i = 0; i < count; i++) waiting.push(region);
      }
      return {
        id: view.id, lon: data?.lon ?? 0, lat: data?.lat ?? 0,
        region: isRegion(view.regionId) ? view.regionId : 'NAM',
        waiting, capacity: view.capacity, hub: view.isHub, jamTicksLeft: view.jamTicksRemaining,
        slotHeld: view.slotHeldPlanes, nextSlotMinutes: view.nextSlotMinutes, // [task-38]
        curfewClosed: view.curfewClosed, // [m2]
      };
    });
  }

  routeList(): RunRoute[] {
    const types = new Map(this.sim.world.planes.map((plane) => [plane.id, plane.type]));
    return this.sim.world.routes().map((route) => ({
      id: route.id, cityIds: route.cityIds,
      aircraft: (route.planeIds.map((id) => types.get(id)).find(Boolean) ?? 'turboprop') as AircraftType,
    }));
  }

  planeList(): RunPlane[] {
    return this.sim.world.planes.map((plane) => ({
      id: plane.id, routeId: plane.routeId, type: plane.type, segment: plane.segment,
      progress01: plane.progress01, direction: plane.direction, load: plane.load,
      capacity: PLANE_TYPES[plane.type].seats,
    }));
  }

  hubPressure(): HubPressure[] {
    const mode = readAirportLabelMode();
    return this.sim.world.cities().filter((city) => city.isHub)
      .map((city) => ({ hubId: city.id, waiting: city.waiting, capacity: city.capacity, label: airportLabel(city.id, mode) }));
  }

  // [task-32] Departure-slot pressure of every active airport (upgrade stamp + "+2 slots" airport pick).
  slotPressure(): SlotPressure[] {
    const world = this.sim.world;
    const mode = readAirportLabelMode();
    return world.cities().map((city) => ({
      cityId: city.id, label: airportLabel(city.id, mode), held: city.slotHeldPlanes, waitMinutes: world.hubCauseLedger(city.id).slotWaitMinutes,
    }));
  }

  hash(): string { return this.sim.hash(); }
}

export type { UpgradeKind };

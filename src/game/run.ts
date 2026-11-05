// Read-model adapter between the authoritative Sim (src/sim, "Sim API") and the in-game layers.
// It only queues Commands and converts read-only views; it holds no game rules of its own.
import { cityByCode, cityDistanceKm as dataDistanceKm } from '../data';
import { REGION_IDS, type RegionId } from '../data/regions';
import {
  createGame, PLANE_TYPES, TICKS_PER_SECOND_1X, TICKS_PER_WEEK,
  type Command, type CommandEntry, type GameMode, type SimEvent, type UpgradeKind, type WeeklyUpgradeState,
} from '../sim';
import type { Sim } from '../sim';
import type { HubPressure } from '../sim/upgrades';
import type { SlotPressure } from '../ui/upgrade/cards'; // [task-32]
import { airportLabel, readAirportLabelMode } from '../ui/airportLabel'; // [night-05] D-68
import { buildCauseReport, type HubCauseLedger } from './causes';
import { PICK_LETTERS, type RunRecord, type RunStats } from './logbook';

export type AircraftType = 'turboprop' | 'widebody';
/** [night-12ap] Longest single frame counted as real play time (seconds). */
const MAX_PLAY_FRAME_S = 0.5;
export type RunCommand = Command;
export type JournalEntry = CommandEntry;

export interface RunCity {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly region: RegionId;
  readonly waiting: readonly RegionId[];
  /** [night-10i] How many of `waiting` (its tail) are transfers still inside the minimum connection time. */
  readonly connecting: number;
  readonly capacity: number;
  readonly hub: boolean;
  readonly jamTicksLeft: number | null;
  /** [task-38] Aircraft held on the ground for a departure slot, and game minutes to the next slot. */
  readonly slotHeld: number;
  readonly nextSlotMinutes: number;
  /** [night-10g] Closed by the night curfew right now (no take-offs or landings). */
  readonly curfewClosed: boolean;
}
export interface RunRoute { readonly id: string; readonly cityIds: readonly string[]; readonly aircraft: AircraftType }
export interface RunPlane {
  readonly id: string; readonly routeId: string; readonly type: AircraftType;
  readonly segment: number; readonly progress01: number; readonly direction: 1 | -1;
  readonly load: number; readonly capacity: number;
  /**
   * [night-11ag] R4d: 'ground' at `route.cityIds[cityIndex]`, or 'flight' that left `cityIndex` towards
   * `cityIndex + direction`; `slotWaitTicks` > 0 while held on the ground for a departure slot (read-only copies).
   */
  readonly phase?: 'ground' | 'flight';
  readonly cityIndex?: number;
  readonly slotWaitTicks?: number;
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
  /** [night-12am] R1o: weekly-board offers drained so far (a resumed run counts the boards after resuming). */
  private readonly offered = { hub: 0, slots: 0 };
  /** [night-12ap] R3j: real seconds on the game screen or weekly board this session (not paused, app in front). */
  private playSeconds = 0;
  private readonly homeOffsetMinutes: number;

  constructor(readonly sim: Sim) {
    const home = sim.world.activeCityIds()[0];
    this.homeOffsetMinutes = Math.round((home ? cityByCode(home)?.utcOffsetH ?? 0 : 0) * 60);
  }

  /** [night-11aj] R2g: `homeRegion` (Endless only; null = Random) anchors the start cluster in that region. */
  static create(seed: number, mode: GameMode = 'endless', homeRegion: RegionId | null = null): EndlessRun {
    return mode === 'daily' ? new EndlessRun(createGame(seed, 'daily'))
      : new EndlessRun(createGame(seed, 'endless', undefined, homeRegion));
  }

  get seed(): number { return this.sim.seed; }
  get mode(): GameMode { return this.sim.config.mode; }
  /** [night-11aj] R2g: the chosen home region, or null for a Random start (and every Daily). */
  get homeRegion(): RegionId | null { return this.sim.config.homeRegion ?? null; }
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
        case 'UpgradeOffered':
          if (event.offers.includes('hub-expansion')) this.offered.hub++;
          if (event.offers.includes('departure-slots')) this.offered.slots++;
          out.push({ type: 'week', week: event.week }); break;
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
      // [night-10i] Ready passengers first, then the transfers still making their connection (drawn hollow).
      let connecting = 0;
      for (const region of REGION_IDS) {
        const count = (view.waitingByRegion[region] ?? 0) - (view.connectingByRegion[region] ?? 0);
        for (let i = 0; i < count; i++) waiting.push(region);
      }
      for (const region of REGION_IDS) {
        const count = view.connectingByRegion[region] ?? 0;
        for (let i = 0; i < count; i++) waiting.push(region);
        connecting += count;
      }
      return {
        id: view.id, lon: data?.lon ?? 0, lat: data?.lat ?? 0,
        region: isRegion(view.regionId) ? view.regionId : 'NAM',
        waiting, connecting, capacity: view.capacity, hub: view.isHub, jamTicksLeft: view.jamTicksRemaining,
        slotHeld: view.slotHeldPlanes, nextSlotMinutes: view.nextSlotMinutes, // [task-38]
        curfewClosed: view.curfewClosed, // [night-10g]
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
      phase: plane.phase, cityIndex: plane.cityIndex, slotWaitTicks: plane.slotWaitTicks, // [night-11ag] R4d
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

  /**
   * [night-12am] R1o closed-test stats for the logbook at game over: length at 1x, slot-held aircraft-minutes over
   * every airport, and how often the hub expansion and "+2 slots" cards were offered and picked (Q-73, Q-78, Q-80).
   */
  /**
   * [night-12ap] R3j: add real time from one frame on the game screen or weekly board. A frame longer than
   * MAX_PLAY_FRAME_S (app in the background, a debugger stop) counts only up to it.
   */
  addPlayTime(seconds: number): void {
    if (Number.isFinite(seconds) && seconds > 0) this.playSeconds += Math.min(seconds, MAX_PLAY_FRAME_S);
  }

  playtestStats(): RunStats & Pick<RunRecord, 'real' | 'cause' | 'picks'> {
    const world = this.sim.world;
    let held = 0;
    for (const city of world.cities()) held += world.hubCauseLedger(city.id).slotWaitMinutes;
    const picks = (kind: UpgradeKind): number => world.upgrades.filter((item) => item.upgrade === kind).length;
    const hubPicked = picks('hub-expansion');
    const slotsPicked = picks('departure-slots');
    return {
      tenths: Math.round(this.sim.tickCount * 10 / (TICKS_PER_SECOND_1X * 60)), held: Math.round(held),
      hubOffered: Math.max(this.offered.hub, hubPicked), hubPicked,
      slotsOffered: Math.max(this.offered.slots, slotsPicked), slotsPicked,
      // [night-12ap] R3j: real minutes (a resumed run counts this session only), the board's first cause, weekly picks.
      real: Math.round(this.playSeconds / 6),
      ...(this.failed ? { cause: buildCauseReport(this.failed.ledger)[0]!.kind } : {}),
      picks: [...world.upgrades].sort((a, b) => a.week - b.week).map((item) => PICK_LETTERS[item.upgrade]).join('').slice(0, 60),
    };
  }

  hash(): string { return this.sim.hash(); }
}

export type { UpgradeKind };

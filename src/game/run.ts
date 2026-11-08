// Read-model adapter between the authoritative Sim (src/sim, "Sim API") and the in-game layers.
// It only queues Commands and converts read-only views; it holds no game rules of its own.
import { cityByCode, cityDistanceKm as dataDistanceKm } from '../data';
import { REGION_IDS, type RegionId } from '../data/regions';
import {
  createGame, PLANE_TYPES, TICKS_PER_SECOND_1X, TICKS_PER_WEEK,
  type Command, type CommandEntry, type GameMode, type LicenceClass, type SimEvent, type UpgradeKind, type WeeklyUpgradeState,
} from '../sim';
import type { Sim } from '../sim';
import type { HubPressure } from '../sim/upgrades';
import type { SlotPressure } from '../ui/upgrade/cards'; // [task-32]
import type { ContractBoard } from '../ui/upgrade/cards'; // [night-12ba] R2k
import type { WeeklyContract } from '../sim/contracts';
import type { AirportWeatherView, SurgeView, WeatherView } from '../sim';
import { airportLabel, readAirportLabelMode } from '../ui/airportLabel'; // [night-05] D-68
import { buildCauseReport, type HubCauseLedger } from './causes';
import { MILESTONE_LETTERS, PICK_LETTERS, type RunRecord, type RunStats } from './logbook';
import { contractsSummary } from './contractsSummary'; // [night-37a] D-295
import { surgesSummary } from './surgesSummary'; // [night-37a] D-295
import { MilestoneTracker, milestoneView, type MilestoneId, type MilestoneView } from './milestones'; // [night-12ax] R1n

export type AircraftType = 'turboprop' | 'widebody';
/** [night-60a] D-321: an Undo refused because its re-simulation jams `cityId` at `localMinute` (home clock), `tick`. */
export interface UndoRefusal { readonly cityId: string; readonly localMinute: number; readonly tick: number }
/** [night-12ap] Longest single frame counted as real play time (seconds). */
const MAX_PLAY_FRAME_S = 0.5;
/** [night-12ba] R2k, D-247: new Endless runs carry the weekly contract (one switch, should the owner hold it back). */
export const ENDLESS_WEEKLY_CONTRACT = true;
/** [night-12bb] R2i, D-249: new Endless runs carry the announced demand surge (one switch, like the contract). */
export const ENDLESS_DEMAND_SURGE = true;
/**
 * [night-12bd] R2j: the weather front is a post-launch candidate, so shipped Endless runs leave it OFF; only the DEV
 * query switch (`?weather=front`, src/main.ts), tests and the balance bot turn it on per run.
 */
export const ENDLESS_WEATHER_FRONT = false;
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
  /** Weather runs: cumulative actual slot-wait minutes by airport. */
  readonly slotWaitTotals?: Readonly<Record<string, number>>;
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

/** A same-world restart keeps the EUS pool version, including the absent flag on old saves. */
export function restartEusClusterV2(seed: number, run: Pick<EndlessRun, 'seed' | 'sim'>): boolean {
  return seed === run.seed ? run.sim.config.eusClusterV2 === true : true;
}

export class EndlessRun {
  private revisionValue = 0;
  /** [night-12am] R1o: weekly-board offers drained so far (a resumed run counts the boards after resuming). */
  private readonly offered = { hub: 0, slots: 0 };
  /** [night-12ap] R3j: real seconds on the game screen or weekly board this session (not paused, app in front). */
  private playSeconds = 0;
  private readonly homeOffsetMinutes: number;
  /** [night-12ax] R1n, D-242: milestones reached (a resumed run counts what it reaches after resuming, and its end). */
  private readonly milestoneTracker = new MilestoneTracker();

  constructor(readonly sim: Sim) {
    const home = sim.world.activeCityIds()[0];
    this.homeOffsetMinutes = Math.round((home ? cityByCode(home)?.utcOffsetH ?? 0 : 0) * 60);
  }

  /**
   * [night-11aj] R2g: `homeRegion` (Endless only; null = Random) anchors the start cluster in that region.
   * [night-12ba] R2k, D-247: every new Endless run has the weekly contract (ENDLESS_WEEKLY_CONTRACT); Daily never.
   * [night-12bb] R2i, D-249: and the announced demand surge (ENDLESS_DEMAND_SURGE); Daily never.
   * [night-12bc] R2h, D-251: `licenceClass` (Endless only; 1 = today's rules) picks the class's scenario knobs.
   * [night-12bd] R2j: `weatherFront` (Endless only) adds the weekly weather front; off unless a switch asks for it.
   */
  static create(seed: number, mode: GameMode = 'endless', homeRegion: RegionId | null = null,
      licenceClass: LicenceClass = 1, weatherFront = ENDLESS_WEATHER_FRONT, eusClusterV2 = true): EndlessRun {
    return mode === 'daily' ? new EndlessRun(createGame(seed, 'daily'))
      : new EndlessRun(createGame(seed, 'endless', undefined, homeRegion, ENDLESS_WEEKLY_CONTRACT, ENDLESS_DEMAND_SURGE,
        licenceClass, weatherFront, eusClusterV2));
  }

  get seed(): number { return this.sim.seed; }
  get mode(): GameMode { return this.sim.config.mode; }
  /** [night-11aj] R2g: the chosen home region, or null for a Random start (and every Daily). */
  get homeRegion(): RegionId | null { return this.sim.config.homeRegion ?? null; }
  /** [night-12bc] R2h: the run's licence class (1 for class I runs, every Daily and older saves). */
  get licenceClass(): LicenceClass { return this.sim.config.licenceClass ?? 1; }
  /** [night-12bd] R2j: does this run carry the weather front (never in shipped Endless or Daily)? */
  get weatherFront(): boolean { return this.sim.config.weatherFront === true; }
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
    return this.sim.canUndo; // [night-56a] D-313: false right after a weekly choice (a closed week is a barrier)
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

  /** Undo in place; returns this run (or null when nothing can be undone, or the Undo was refused). */
  undo(): EndlessRun | null {
    const result = this.tryUndo();
    return result instanceof EndlessRun ? result : null;
  }

  /**
   * [night-60a] D-321 (Q-93 → A): undo() that also says why a tap changed nothing because it would end the run: the
   * airport that would jam and when, on the home clock the HUD shows. The run is then exactly as before the tap.
   */
  tryUndo(): EndlessRun | UndoRefusal | null {
    const result = this.sim.tryUndo();
    if (result.done) {
      this.revisionValue++;
      return this;
    }
    if (result.reason !== 'jam') return null;
    return { cityId: result.cityId, tick: result.tick, localMinute: result.minute + this.homeOffsetMinutes };
  }

  drainEvents(): RunEvent[] {
    const out: RunEvent[] = [];
    for (const event of this.sim.drainEvents() as SimEvent[]) {
      switch (event.type) {
        case 'CitySpawned': out.push({ type: 'new-city', cityId: event.cityId }); break;
        case 'RouteAdded': case 'RouteChanged':
          this.revisionValue++;
          this.milestoneTracker.observe(this.milestoneView()); // [night-12ax] a hub that later closes still counts
          break;
        case 'RouteRemoved': case 'PlaneAssigned': case 'PlaneUnassigned':
          this.revisionValue++; break;
        case 'Delivered': out.push({ type: 'arrival', cityId: event.cityId }); break;
        case 'UpgradeOffered':
          if (event.offers.includes('hub-expansion')) this.offered.hub++;
          if (event.offers.includes('departure-slots')) this.offered.slots++;
          this.milestoneTracker.observe(this.milestoneView(), true); // [night-12ax] the week closes: every region served?
          out.push({ type: 'week', week: event.week }); break;
        case 'HubJamStarted': out.push({ type: 'jam', cityId: event.cityId, jammed: true }); break;
        case 'HubJamCleared': out.push({ type: 'jam', cityId: event.cityId, jammed: false }); break;
        case 'DepartureHeld': { // [task-32]
          if (event.reason === 'weather') break;
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
    const world = this.sim.world;
    return world.planes.map((plane) => {
      return {
        id: plane.id, routeId: plane.routeId, type: plane.type, segment: plane.segment,
        progress01: plane.progress01, direction: plane.direction, load: plane.load,
        capacity: PLANE_TYPES[plane.type].seats,
        phase: plane.phase, cityIndex: plane.cityIndex, slotWaitTicks: this.weatherFront ? (plane.weatherSlotWaitTicks ?? 0) : plane.slotWaitTicks, // [night-11ag] R4d
        ...(this.weatherFront ? { slotWaitTotals: plane.weatherSlotWaitTotals ?? {} } : {}),
      };
    });
  }

  /** [night-12ba] R2k, D-247: the running weekly contract (null without one, and in Daily). */
  get contract(): WeeklyContract | null { return this.sim.world.contract; }

  /** [night-12bb] R2i, D-249: the announced or running demand surge (null otherwise, and in Daily). */
  get surge(): SurgeView | null { return this.sim.world.surge; }

  /** [night-12bd] R2j: the week's weather front (null without the rule) and one airport's forecast or deck. */
  get weather(): WeatherView | null { return this.sim.world.weather; }
  airportWeather(cityId: string): AirportWeatherView | null { return this.sim.world.airportWeather(cityId); }

  /** [night-12ba] R2k: what the open weekly board shows: next week's contract and the one that just ended. */
  contractBoard(): ContractBoard | null {
    const world = this.sim.world;
    const offer = world.offer;
    if (!offer || !world.scenario.weeklyContract) return null;
    const last = world.contractHistory.at(-1);
    return {
      next: world.contract,
      last: last && last.week === offer.week - 1 ? last : null,
      extraCrate: offer.extraCrate ?? null,
    };
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

  playtestStats(): RunStats & Omit<RunRecord, 'tutorial' | 'quality' | 'preset' | 'adapt' | 'version'> {
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
      ...(this.mode === 'endless' ? this.endlessRecord() : {}),
    };
  }

  /**
   * [night-37a] D-295, playtest record v2: what the closed test measures for D-270…D-273 — contracts met/offered,
   * surges announced/opened/extra/lost at, licence class, home region, milestones. Endless only; read-only.
   */
  private endlessRecord(): Pick<RunRecord, 'contractsMet' | 'contractsOffered' | 'surges' | 'surgesOpened' | 'surgeExtra'
      | 'surgeLost' | 'licence' | 'home' | 'milestones'> {
    const world = this.sim.world;
    const contracts = world.scenario.weeklyContract ? contractsSummary(world.contract, world.contractHistory) ?? { met: 0, offered: 0 } : null;
    const surges = world.scenario.demandSurge ? surgesSummary(world.surgeRecords(), this.sim.tickCount, world.failure) : null;
    return {
      ...(contracts ? { contractsMet: contracts.met, contractsOffered: contracts.offered } : {}),
      ...(surges ? { surges: surges.announced, surgesOpened: surges.opened, surgeExtra: surges.extra,
        surgeLost: surges.lostAtSurge ? 1 : 0 } as const : {}),
      licence: this.licenceClass, home: this.homeRegion ?? 'random',
      milestones: this.milestones().map((id) => MILESTONE_LETTERS[id]).join(''),
    };
  }

  /** [night-12ax] R1n: the read-model counts the milestones look at (hubs, regions open/served, week, score). */
  milestoneView(): MilestoneView {
    const world = this.sim.world;
    const cities = world.cities().map((city) => ({ id: city.id, region: city.regionId, hub: city.isHub }));
    return milestoneView(cities, world.routes(), this.sim.tickCount, TICKS_PER_WEEK, world.score);
  }

  /** [night-12ax] R1n, D-242: milestones this run has reached, in report order (reads the sim, never writes it). */
  milestones(): MilestoneId[] {
    this.milestoneTracker.observe(this.milestoneView());
    return this.milestoneTracker.list();
  }

  hash(): string { return this.sim.hash(); }
}

export type { UpgradeKind };

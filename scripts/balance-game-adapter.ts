/**
 * Task 22 production adapter: the autoplay bot drives the REAL authoritative Sim through commands.
 * It only reads public views (sim.world.*) and submits commands via Sim.check/Sim.apply.
 */
import { createGame, CONGESTION_GRACE_TICKS, type LicenceClass, type Sim } from '../src/sim/index.ts';
import type { RegionId } from '../src/data/regions.ts';
import { botCommandToSim, botSnapshot } from '../src/game/dev/autoplay.ts';
import type { BotCommand, BotSnapshot } from './bot.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import { PLANE_TYPES, SIM_MINUTES_PER_WEEK } from '../src/sim/params.ts';
import { drawFront } from '../src/sim/weather.ts';
import { surgesSummary } from '../src/game/surgesSummary.ts';

/**
 * [night-12ab] R8d: what a run used, counted from the sim's own events (no prototype wrapping) and read-only views.
 * Fill from `GameSession.outcome().mechanics`; the report prints them (scripts/balance-report.ts spreadReport).
 */
export interface RunMechanics {
  /** Aircraft-minutes held by a curfew on the ground / in the air (`CurfewHeld`). */
  readonly curfewGroundMin: number;
  readonly curfewAirMin: number;
  /** Departures held for a slot (`DepartureHeld`) and aircraft-minutes waited (`hubCauseLedger().slotWaitMinutes`). */
  readonly slotHolds: number;
  readonly slotWaitMin: number;
  /** Delivered passengers (`Delivered`) and how many of them changed planes on the way. */
  readonly delivered: number;
  readonly deliveredAfterTransfer: number;
  /** Weekly cards: every card on every board (`UpgradeOffered`) and the picks (`UpgradeChosen`), in board order. */
  readonly offered: readonly string[];
  readonly picked: readonly string[];
  /** The losing airport (null when the run did not end): hub, routes at the loss, spare aircraft in the reserve. */
  readonly loss: { readonly week: number; readonly isHub: boolean; readonly routes: number; readonly spareAircraft: number } | null;
}

/** [night-12bb] R2i, D-249: demand surges of one run (only with `demandSurge`). */
export interface RunSurges {
  /** Surges announced (shown on the globe), of which the window opened before the run ended. */
  readonly announced: number;
  readonly opened: number;
  /** Extra passengers the surges generated. */
  readonly extra: number;
  /** The run was lost at a surge airport during its window or within 6 game hours after it. */
  readonly lostAtSurge: boolean;
}

/** [night-12bd] R2j: the weather front in one run (only with `weatherFront`). */
export interface RunWeather {
  /** Fronts that formed before the run ended. */
  readonly fronts: number;
  /** Airport-minutes a served airport (≥ 1 route) spent under a front. */
  readonly servedUnderMin: number;
  /** Departures actually held by weather (`DepartureHeld` with reason weather). */
  readonly slotHoldsUnder: number;
  /** The run was lost at an airport while it was under a front or within 6 game hours after. */
  readonly lostUnderFront: boolean;
}

/** [night-12ba] R2k, D-247: weekly contracts of one run (only with `weeklyContract`). */
export interface RunContracts {
  /** Contracts whose week ended before the run did, and how many of them were met. */
  readonly closed: number;
  readonly met: number;
  /** Boards that showed a contract crate, and how often the bot took that crate. */
  readonly extraBoards: number;
  readonly extraPicked: number;
  /** Targets of every issued contract (closed or running at the end). */
  readonly targets: readonly number[];
}

class GameSession {
  private readonly sim: Sim;
  private warned = false;
  private leadTicks = 0;
  /** [night-12f] Nearest airport (km) that was already open when each airport opened (start airports: each other). */
  private readonly reachAtOpen = new Map<string, number>();
  private readonly counts = { curfewGroundMin: 0, curfewAirMin: 0, slotHolds: 0, delivered: 0, deliveredAfterTransfer: 0 };
  private readonly offered: string[] = [];
  private readonly picked: string[] = [];
  private extraBoards = 0;
  private extraPicked = 0;
  private extraOnBoard: string | undefined;
  /** [night-12bd] R2j: weather-front counters (stay zero without the rule). */
  private readonly weatherCounts = { servedUnderMin: 0, slotHoldsUnder: 0 };
  private readonly lastUnder = new Map<string, number>();

  constructor(seed: number, mode: 'endless' | 'daily' = 'endless', homeRegion: RegionId | null = null, weeklyContract = false,
      demandSurge = false, licenceClass: LicenceClass = 1, weatherFront = false) {
    // [night-11aj] R2g: per-region balance check. [night-12ba] R2k: with or without the weekly contract.
    // [night-12bb] R2i: with or without the demand surge. [night-12bc] R2h: per licence class (balance:licences).
    // [night-12bd] R2j: with or without the weather front (balance:weather).
    this.sim = createGame(seed, mode, undefined, homeRegion, weeklyContract, demandSurge, licenceClass, weatherFront);
    const start = [...this.sim.world.cities()].map((city) => city.id);
    for (const id of start) this.reachAtOpen.set(id, nearestKm(id, start));
  }

  /** The underlying authoritative Sim (tests replay its journal). */
  get simulation(): Sim { return this.sim; }

  // [integration-ui] Sim <-> bot conversion is shared with DEV window.aw.autoplay (src/game/dev/autoplay.ts).
  snapshot(): BotSnapshot { return botSnapshot(this.sim); }

  dispatch(command: BotCommand): boolean {
    const simCommand = botCommandToSim(this.sim, command);
    if (!this.sim.check(simCommand).ok) return false;
    return this.sim.apply(simCommand);
  }

  advance(ticks: number): void {
    // Commands take effect on the next tick, also when the world is paused for an upgrade.
    this.tick();
    for (let i = 1; i < ticks && this.sim.world.status === 'running'; i++) this.tick();
  }

  private tick(): void {
    this.sim.tick();
    const weather = this.sim.config.weatherFront === true && this.sim.world.weather !== null;
    if (weather) {
      for (const city of this.sim.world.cities()) {
        if (this.sim.world.airportWeather(city.id)?.phase !== 'under') continue;
        this.lastUnder.set(city.id, this.sim.world.minute);
        if (city.routes > 0) this.weatherCounts.servedUnderMin++;
      }
    }
    for (const event of this.sim.drainEvents()) {
      if (weather && event.type === 'DepartureHeld' && event.reason === 'weather') {
        this.weatherCounts.slotHoldsUnder++;
      }
      if (event.type === 'HubJamStarted') this.warned = true;
      if (event.type === 'CitySpawned') this.reachAtOpen.set(event.cityId, nearestKm(event.cityId, [...this.reachAtOpen.keys()]));
      if (event.type === 'GameOver' && event.failure) this.leadTicks = CONGESTION_GRACE_TICKS;
      // [night-12ab] R8d mechanic use.
      if (event.type === 'CurfewHeld') this.counts[event.where === 'ground' ? 'curfewGroundMin' : 'curfewAirMin']++;
      if (event.type === 'DepartureHeld') this.counts.slotHolds++;
      if (event.type === 'Delivered') { this.counts.delivered += event.count; this.counts.deliveredAfterTransfer += event.afterTransfer; }
      if (event.type === 'UpgradeOffered') {
        this.offered.push(...event.offers);
        this.extraOnBoard = this.sim.world.offer?.extraCrate;
        if (this.extraOnBoard) this.extraBoards++;
      }
      if (event.type === 'UpgradeChosen') {
        this.picked.push(event.upgrade);
        if (this.extraOnBoard && event.upgrade === this.extraOnBoard) this.extraPicked++;
        this.extraOnBoard = undefined;
      }
    }
  }

  outcome(): { reason: 'hubOverflow' | 'timeLimit'; score: number; warned: boolean; warningLeadTicks: number; week1Unreachable: boolean; mechanics: RunMechanics } {
    const world = this.sim.world;
    // [night-12f] D-95: a week-1 loss at an airport that opened beyond turboprop range of every open airport.
    const failure = world.status === 'over' ? world.failure : null;
    const week1Unreachable = failure !== null && world.minute < SIM_MINUTES_PER_WEEK &&
      (this.reachAtOpen.get(failure.cityId) ?? 0) > PLANE_TYPES.turboprop.rangeKm;
    return {
      reason: world.status === 'over' ? 'hubOverflow' : 'timeLimit', score: world.score,
      warned: this.warned, warningLeadTicks: this.leadTicks, week1Unreachable, mechanics: this.mechanics(),
    };
  }

  /** [night-12bb] R2i, D-249: the run's demand surges (all zero without the surge rule). */
  surges(): RunSurges {
    // [night-37a] D-295: shared with the playtest record (src/game/surgesSummary.ts).
    return surgesSummary(this.sim.world.surgeRecords(), this.sim.tickCount, this.sim.world.failure);
  }

  /** [night-12bd] R2j: the run's weather fronts (all zero without the rule). */
  weather(): RunWeather {
    const world = this.sim.world;
    const failure = world.failure;
    let fronts = 0;
    for (let week = 2; (week - 1) * SIM_MINUTES_PER_WEEK <= world.minute; week++) {
      const front = drawFront(this.sim.seed, week);
      if (this.sim.config.weatherFront === true && front && front.formTick <= world.minute) fronts++;
    }
    const last = failure ? this.lastUnder.get(failure.cityId) : undefined;
    return { fronts, ...this.weatherCounts, lostUnderFront: last !== undefined && world.minute - last <= 360 };
  }

  /** [night-12ba] R2k: the run's weekly contracts (all zero without the contract rule). */
  contracts(): RunContracts {
    const world = this.sim.world;
    const history = world.contractHistory;
    return {
      closed: history.length, met: history.filter((item) => item.met).length,
      extraBoards: this.extraBoards, extraPicked: this.extraPicked,
      targets: [...history, ...(world.contract ? [world.contract] : [])].map((item) => item.target),
    };
  }

  private mechanics(): RunMechanics {
    const world = this.sim.world;
    const failure = world.status === 'over' ? world.failure : null;
    const city = failure ? world.cityView(failure.cityId) : null;
    return {
      ...this.counts,
      slotWaitMin: world.cities().reduce((sum, item) => sum + world.hubCauseLedger(item.id).slotWaitMinutes, 0),
      offered: [...this.offered], picked: [...this.picked],
      loss: failure && city ? {
        week: Math.floor(world.minute / SIM_MINUTES_PER_WEEK) + 1, isHub: city.isHub, routes: city.routes,
        spareAircraft: world.reserve.turboprop + world.reserve.widebody,
      } : null,
    };
  }
}

function nearestKm(id: string, others: readonly string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const other of others) if (other !== id) best = Math.min(best, cityDistanceKm(id, other));
  return best;
}

export function createBalanceSession(seed: number, mode: 'endless' | 'daily' = 'endless',
    homeRegion: RegionId | null = null, weeklyContract = false, demandSurge = false, licenceClass: LicenceClass = 1,
    weatherFront = false): GameSession {
  return new GameSession(seed >>> 0, mode, homeRegion, weeklyContract, demandSurge, licenceClass, weatherFront);
}

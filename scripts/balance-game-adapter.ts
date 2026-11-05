/**
 * Task 22 production adapter: the autoplay bot drives the REAL authoritative Sim through commands.
 * It only reads public views (sim.world.*) and submits commands via Sim.check/Sim.apply.
 */
import { createGame, CONGESTION_GRACE_TICKS, type Sim } from '../src/sim/index.ts';
import type { RegionId } from '../src/data/regions.ts';
import { botCommandToSim, botSnapshot } from '../src/game/dev/autoplay.ts';
import type { BotCommand, BotSnapshot } from './bot.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import { PLANE_TYPES, SIM_MINUTES_PER_WEEK } from '../src/sim/params.ts';

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

class GameSession {
  private readonly sim: Sim;
  private warned = false;
  private leadTicks = 0;
  /** [night-12f] Nearest airport (km) that was already open when each airport opened (start airports: each other). */
  private readonly reachAtOpen = new Map<string, number>();
  private readonly counts = { curfewGroundMin: 0, curfewAirMin: 0, slotHolds: 0, delivered: 0, deliveredAfterTransfer: 0 };
  private readonly offered: string[] = [];
  private readonly picked: string[] = [];

  constructor(seed: number, mode: 'endless' | 'daily' = 'endless', homeRegion: RegionId | null = null) {
    this.sim = createGame(seed, mode, undefined, homeRegion); // [night-11aj] R2g: per-region balance check
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
    for (const event of this.sim.drainEvents()) {
      if (event.type === 'HubJamStarted') this.warned = true;
      if (event.type === 'CitySpawned') this.reachAtOpen.set(event.cityId, nearestKm(event.cityId, [...this.reachAtOpen.keys()]));
      if (event.type === 'GameOver' && event.failure) this.leadTicks = CONGESTION_GRACE_TICKS;
      // [night-12ab] R8d mechanic use.
      if (event.type === 'CurfewHeld') this.counts[event.where === 'ground' ? 'curfewGroundMin' : 'curfewAirMin']++;
      if (event.type === 'DepartureHeld') this.counts.slotHolds++;
      if (event.type === 'Delivered') { this.counts.delivered += event.count; this.counts.deliveredAfterTransfer += event.afterTransfer; }
      if (event.type === 'UpgradeOffered') this.offered.push(...event.offers);
      if (event.type === 'UpgradeChosen') this.picked.push(event.upgrade);
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
    homeRegion: RegionId | null = null): GameSession {
  return new GameSession(seed >>> 0, mode, homeRegion);
}

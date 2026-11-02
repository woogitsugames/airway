/**
 * Task 22 production adapter: the autoplay bot drives the REAL authoritative Sim through commands.
 * It only reads public views (sim.world.*) and submits commands via Sim.check/Sim.apply.
 */
import { createGame, CONGESTION_GRACE_TICKS, PLANE_TYPES, type Command, type Sim, type UpgradeKind } from '../src/sim/index.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import type { BotCommand, BotSnapshot, LedgerCause, UpgradeKind as BotUpgradeKind } from './bot.ts';

const TO_BOT: Record<UpgradeKind, BotUpgradeKind> = {
  turboprop: 'turboprop', widebody: 'widebody', 'hub-expansion': 'hub', 'departure-slots': 'slots',
};

class GameSession {
  private readonly sim: Sim;
  private warned = false;
  private leadTicks = 0;

  constructor(seed: number) { this.sim = createGame(seed); }

  /** The underlying authoritative Sim (tests replay its journal). */
  get simulation(): Sim { return this.sim; }

  snapshot(): BotSnapshot {
    const world = this.sim.world;
    const cities = world.cities();
    const waiting = new Map(cities.map((city) => [city.id, city.waiting]));
    const routes = world.routes().map((route) => {
      const assigned = { turboprop: 0, widebody: 0 };
      for (const plane of world.planes) if (plane.routeId === route.id) assigned[plane.type]++;
      return {
        id: route.id, stops: route.cityIds, distanceKm: Math.max(...route.legKm),
        waiting: route.cityIds.reduce((sum, id) => sum + (waiting.get(id) ?? 0), 0), assigned,
      };
    });
    const distancesKm: Record<string, Record<string, number>> = {};
    for (const a of cities) {
      distancesKm[a.id] = {};
      for (const b of cities) distancesKm[a.id][b.id] = cityDistanceKm(a.id, b.id) ?? 0;
    }
    const ledger: LedgerCause[] = [];
    for (const city of cities) {
      const causes = world.hubCauseLedger(city.id);
      if (city.fullTicks > 0) ledger.push({ kind: 'hubOverflow', cityId: city.id, count: city.waiting });
      if (causes.noRoute) ledger.push({ kind: 'unrouted', cityId: city.id, count: causes.noRoute });
      if (causes.waitingTooLong) ledger.push({ kind: 'longWait', cityId: city.id, count: causes.waitingTooLong });
    }
    const status = world.status === 'running' ? 'running' : world.status === 'upgrade' ? 'upgrade' : 'finished';
    return {
      tick: world.minute, status,
      cities: cities.map((city) => ({
        id: city.id, active: true, connectedRoutes: city.routes, isHub: city.isHub,
        waiting: city.waiting, capacity: city.capacity, warningTicksRemaining: city.jamTicksRemaining,
      })),
      routes, distancesKm, inventory: { ...world.reserve },
      offers: world.offer ? world.offer.offers.map((offer) => ({ id: offer.id, kind: TO_BOT[offer.id] })) : [],
      ledger,
    };
  }

  private toCommand(command: BotCommand): Command {
    if (command.type === 'AddRoute') {
      // Like the route tool: drawing a route also assigns a spare aircraft that can fly it.
      const km = cityDistanceKm(command.from, command.to) ?? Infinity;
      const reserve = this.sim.world.reserve;
      const aircraft = km <= PLANE_TYPES.turboprop.rangeKm && reserve.turboprop > 0 ? 'turboprop'
        : km <= PLANE_TYPES.widebody.rangeKm && reserve.widebody > 0 ? 'widebody' : undefined;
      const cityIds = [command.from, command.to];
      return aircraft ? { type: 'AddRoute', cityIds, aircraft } : { type: 'AddRoute', cityIds };
    }
    if (command.type === 'AssignPlane') return { type: 'AssignPlane', routeId: command.routeId, aircraft: command.aircraftType };
    const week = this.sim.world.offer?.week ?? 0;
    const upgrade = command.offerId as UpgradeKind;
    return command.cityId && upgrade === 'hub-expansion'
      ? { type: 'ChooseUpgrade', week, upgrade, hubId: command.cityId }
      : { type: 'ChooseUpgrade', week, upgrade };
  }

  dispatch(command: BotCommand): boolean {
    const simCommand = this.toCommand(command);
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
      if (event.type === 'GameOver' && event.failure) this.leadTicks = CONGESTION_GRACE_TICKS;
    }
  }

  outcome(): { reason: 'hubOverflow' | 'timeLimit'; score: number; warned: boolean; warningLeadTicks: number } {
    const world = this.sim.world;
    return {
      reason: world.status === 'over' ? 'hubOverflow' : 'timeLimit', score: world.score,
      warned: this.warned, warningLeadTicks: this.leadTicks,
    };
  }
}

export function createBalanceSession(seed: number): GameSession {
  return new GameSession(seed >>> 0);
}

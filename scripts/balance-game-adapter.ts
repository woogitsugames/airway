/**
 * Task 22 production adapter: the autoplay bot drives the REAL authoritative Sim through commands.
 * It only reads public views (sim.world.*) and submits commands via Sim.check/Sim.apply.
 */
import { createGame, CONGESTION_GRACE_TICKS, type Sim } from '../src/sim/index.ts';
import { botCommandToSim, botSnapshot } from '../src/game/dev/autoplay.ts';
import type { BotCommand, BotSnapshot } from './bot.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import { PLANE_TYPES, SIM_MINUTES_PER_WEEK } from '../src/sim/params.ts';

class GameSession {
  private readonly sim: Sim;
  private warned = false;
  private leadTicks = 0;
  /** [night-12f] Nearest airport (km) that was already open when each airport opened (start airports: each other). */
  private readonly reachAtOpen = new Map<string, number>();

  constructor(seed: number, mode: 'endless' | 'daily' = 'endless') {
    this.sim = createGame(seed, mode);
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
    }
  }

  outcome(): { reason: 'hubOverflow' | 'timeLimit'; score: number; warned: boolean; warningLeadTicks: number; week1Unreachable: boolean } {
    const world = this.sim.world;
    // [night-12f] D-95: a week-1 loss at an airport that opened beyond turboprop range of every open airport.
    const failure = world.status === 'over' ? world.failure : null;
    const week1Unreachable = failure !== null && world.minute < SIM_MINUTES_PER_WEEK &&
      (this.reachAtOpen.get(failure.cityId) ?? 0) > PLANE_TYPES.turboprop.rangeKm;
    return {
      reason: world.status === 'over' ? 'hubOverflow' : 'timeLimit', score: world.score,
      warned: this.warned, warningLeadTicks: this.leadTicks, week1Unreachable,
    };
  }
}

function nearestKm(id: string, others: readonly string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const other of others) if (other !== id) best = Math.min(best, cityDistanceKm(id, other));
  return best;
}

export function createBalanceSession(seed: number, mode: 'endless' | 'daily' = 'endless'): GameSession {
  return new GameSession(seed >>> 0, mode);
}

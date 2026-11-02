/**
 * Task 22 production adapter: the autoplay bot drives the REAL authoritative Sim through commands.
 * It only reads public views (sim.world.*) and submits commands via Sim.check/Sim.apply.
 */
import { createGame, CONGESTION_GRACE_TICKS, type Sim } from '../src/sim/index.ts';
import { botCommandToSim, botSnapshot } from '../src/game/dev/autoplay.ts';
import type { BotCommand, BotSnapshot } from './bot.ts';

class GameSession {
  private readonly sim: Sim;
  private warned = false;
  private leadTicks = 0;

  constructor(seed: number) { this.sim = createGame(seed); }

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

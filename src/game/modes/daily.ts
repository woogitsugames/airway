// Daily mode composition: game state is seeded by task 02, never by the device RNG.
import type { DailyResult, OfficialReservation, ScoreService } from '../scores';

/** Inject dailyKey/dailySeed from src/core/daily.ts when task 02 lands. */
export interface DailySeedSource {
  dailyKey(date: Date): string;
  dailySeed(dateKey: string): number;
}

/** The authoritative simulation must expose the deterministic hash from task 02. */
export interface DailySimulation {
  hash(): string;
}

export interface DailySession<TSimulation extends DailySimulation = DailySimulation> {
  readonly dateKey: string;
  readonly seed: number;
  readonly kind: 'official' | 'practice';
  readonly initialHash: string;
  readonly simulation: TSimulation;
  readonly reservation: OfficialReservation | null;
}

export type DailyStart<TSimulation extends DailySimulation> =
  | { readonly status: 'started'; readonly session: DailySession<TSimulation> }
  | { readonly status: 'already-used'; readonly dateKey: string };

/** The symbols correspond to the six non-emoji destination shapes of D-08. */
export const TICKET_GLYPHS = ['‹', '⋈', '◖', '⌑', '⟆', '⟧'] as const;

/** A short offline share ticket; invalid region codes are rejected, never coerced. */
export function dailyTicket(regions: readonly number[]): string {
  if (regions.length === 0) return '--';
  const glyphs: string[] = [];
  for (const index of regions.slice(0, 12)) {
    if (!Number.isInteger(index) || index < 0 || index >= TICKET_GLYPHS.length) {
      throw new RangeError('Unknown destination region');
    }
    glyphs.push(TICKET_GLYPHS[index]);
  }
  return glyphs.join('') + (regions.length > 12 ? '+' : '');
}

export class DailyChallengeMode<TSimulation extends DailySimulation> {
  private readonly active = new WeakSet<DailySession<TSimulation>>();
  private readonly seeds: DailySeedSource;
  private readonly scores: ScoreService;
  private readonly createSimulation: (seed: number) => TSimulation;
  private readonly now: () => Date;

  constructor(
    seeds: DailySeedSource,
    scores: ScoreService,
    createSimulation: (seed: number) => TSimulation,
    now: () => Date = () => new Date(),
  ) {
    this.seeds = seeds;
    this.scores = scores;
    this.createSimulation = createSimulation;
    this.now = now;
  }

  /** Recompute the Warsaw calendar key on every start, including after midnight. */
  start(kind: 'official' | 'practice', instant: Date = this.now()): DailyStart<TSimulation> {
    const dateKey = this.seeds.dailyKey(instant);
    const seed = this.seeds.dailySeed(dateKey);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Daily seed must be an unsigned 32-bit integer');
    }
    // Build before consuming the official attempt: failed initialization is not a played game.
    const simulation = this.createSimulation(seed);
    const initialHash = simulation.hash();
    if (typeof initialHash !== 'string' || !initialHash) throw new Error('Simulation hash is missing');
    const reservation = kind === 'official' ? this.scores.reserveOfficial(dateKey) : null;
    if (kind === 'official' && !reservation) return { status: 'already-used', dateKey };
    const session: DailySession<TSimulation> = {
      dateKey, seed, kind, initialHash, simulation, reservation,
    };
    this.active.add(session);
    return { status: 'started', session };
  }

  /** Accept one result per session; an official result requires its durable reservation. */
  finish(session: DailySession<TSimulation>, score: number, weeks: number, regions: readonly number[]): DailyResult | null {
    if (!this.active.has(session)) return null;
    const ticket = dailyTicket(regions);
    this.active.delete(session);
    if (session.kind === 'official') {
      if (!session.reservation) return null;
      return this.scores.finishOfficial(session.reservation, score, weeks, ticket);
    }
    return this.scores.recordPractice(session.dateKey, score, weeks, ticket);
  }
}

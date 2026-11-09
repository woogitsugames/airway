// Daily mode composition: the run is seeded from the Warsaw calendar day, never by the device RNG.
import { dailyKey, dailySeedForKey } from '../../core/daily.ts';
import { Sim } from '../../sim/index.ts';
import { DAILY_CONFIG } from '../../net/submission.ts';
import { REGIONS, type RegionGlyph, type RegionId } from '../../data/regions.ts';
import type { DailyResult, OfficialReservation, ScoreService } from '../scores';

export interface DailySeedSource {
  dailyKey(date: Date): string;
  dailySeed(dateKey: string): number;
}

/** Production seed source (src/core/daily.ts). */
export const DAILY_SEEDS: DailySeedSource = { dailyKey, dailySeed: dailySeedForKey };

/** Anything with the kernel's deterministic state hash; the production simulation is Sim. */
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

/** The symbols correspond to the six non-emoji destination shapes of D-08, then the provisional ASI wing and
 *  OCE hook (D-20) [night-10e]; order follows RegionGlyph, not REGION_IDS. */
export const TICKET_GLYPHS = ['‹', '⋈', '◖', '⌑', '⟆', '⟧', '⌒', '⌐'] as const;
const TICKET_ORDER: readonly RegionGlyph[] = ['chevron', 'bowtie', 'crescent', 'keyhole', 'fin', 'bracket', 'wing', 'hook'];

/** [night-10e] Ticket indexes of the regions a network serves: distinct, in city opening order. */
export function servedTicketRegions(cities: readonly { readonly id: string; readonly region: RegionId }[],
  routes: readonly { readonly cityIds: readonly string[] }[]): number[] {
  const served = new Set<string>();
  for (const route of routes) for (const id of route.cityIds) served.add(id);
  const out: number[] = [];
  for (const city of cities) {
    if (!served.has(city.id)) continue;
    const index = TICKET_ORDER.indexOf(REGIONS[city.region].glyph);
    if (index >= 0 && !out.includes(index)) out.push(index);
  }
  return out;
}

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
    this.scores.setActiveRun({ dateKey, kind, attemptId: reservation?.attemptId });
    return { status: 'started', session };
  }

  /**
   * [night-07a] Re-attach a daily run restored from the save slot. It stays official only when
   * the run that was saved is the day's open official attempt (same date, seed and attempt);
   * otherwise it continues as practice. Null when the seed belongs to neither today nor yesterday.
   */
  resume(simulation: TSimulation, seed: number, instant: Date = this.now()): DailySession<TSimulation> | null {
    const active = this.scores.activeRun();
    const today = this.seeds.dailyKey(instant);
    const yesterday = this.seeds.dailyKey(new Date(instant.getTime() - 86_400_000));
    let dateKey: string | null = null;
    if (active && this.seeds.dailySeed(active.dateKey) === seed) dateKey = active.dateKey;
    else dateKey = [today, yesterday].find((key) => this.seeds.dailySeed(key) === seed) ?? null;
    if (!dateKey) return null;
    const pending = this.scores.pendingOfficial(dateKey);
    const official = active?.kind === 'official' && active.dateKey === dateKey && pending !== null &&
      pending.attemptId === active.attemptId;
    const session: DailySession<TSimulation> = {
      dateKey, seed, kind: official ? 'official' : 'practice', initialHash: simulation.hash(), simulation,
      reservation: official ? pending : null,
    };
    this.active.add(session);
    return session;
  }

  /** Accept one result per session; an official result requires its durable reservation. */
  finish(session: DailySession<TSimulation>, score: number, weeks: number, regions: readonly number[]): DailyResult | null {
    if (!this.active.has(session)) return null;
    const ticket = dailyTicket(regions);
    const result = session.kind === 'official'
      ? (session.reservation ? this.scores.finishOfficial(session.reservation, score, weeks, ticket) : null)
      : this.scores.recordPractice(session.dateKey, score, weeks, ticket);
    this.active.delete(session);
    this.scores.setActiveRun(null);
    return result;
  }
}

/** Daily challenge on the real simulation: same Endless rules, the day's seed, mode 'daily'. */
export function createDailyMode(scores: ScoreService, now?: () => Date): DailyChallengeMode<Sim> {
  // [night-86a] D-343: a new Daily starts at local 07:00 at its first airport, exactly the config the leaderboard
  // replays (DAILY_CONFIG, src/net/submission.ts).
  return new DailyChallengeMode(DAILY_SEEDS, scores, (seed) => new Sim(seed >>> 0, DAILY_CONFIG), now);
}

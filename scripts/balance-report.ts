/**
 * Task 22: headless, seeded balance sampler.
 *
 * Production mode REQUIRES a real engine adapter and never falls back to the
 * fixture silently. The fixture is deliberately small and is NOT game balance.
 * Run with Node 22 --experimental-strip-types (no runtime dependencies).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chooseBotAction } from './bot.ts';
import type { AircraftType, BotCity, BotCommand, BotRoute, BotSnapshot, LedgerCause, UpgradeOffer } from './bot.ts';
import { CURFEW_ENDLESS_START_WEEK, SIM_DAYS_PER_WEEK, SIM_MINUTES_PER_WEEK, SIM_TICKS_PER_SECOND } from '../src/sim/params.ts';
import type { RunContracts, RunMechanics } from './balance-game-adapter.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_SEED = 0xa1a1;
// [task-31] The week length comes from the single source in params.ts (D-40); 1 sim minute per tick.
const TICKS_PER_WEEK = SIM_MINUTES_PER_WEEK;
const MAX_TICKS = 30 * 60 * SIM_TICKS_PER_SECOND; // 30 minutes at 1x.
const ACTION_INTERVAL = 30; // one command opportunity every 3 seconds at 1x.
const WARNING_TICKS = 45 * SIM_TICKS_PER_SECOND; // fixture only; not a gameplay parameter.
const TARGET_MIN = 10; // [night-09b] D-79: bot session target 10–18 min (was 8–15, D-40/D-43)
const TARGET_MAX = 18;
// [task-31] Share of bot runs that must reach the first / second weekly upgrade choice.
const TARGET_FIRST_UPGRADE = 0.6;
const TARGET_SECOND_UPGRADE = 0.3;
// [night-12f] D-95: week-1 losses at an airport that opened beyond turboprop reach (old rules: 6 of 50).
const TARGET_WEEK1_UNREACHABLE = 0;

interface BalanceOutcome {
  readonly reason: 'hubOverflow' | 'timeLimit';
  readonly score: number;
  readonly warned: boolean;
  readonly warningLeadTicks: number;
  /** [night-12f] Lost in week 1 at an airport that opened beyond turboprop reach (real adapter only). */
  readonly week1Unreachable?: boolean;
  /** [night-12ab] R8d: what the run used (real adapter only). */
  readonly mechanics?: RunMechanics;
}

/** Real engine adapter contract. Task 08/09/12 integration must implement this. */
export interface BalanceSession {
  snapshot(): BotSnapshot;
  dispatch(command: BotCommand): boolean;
  advance(ticks: number): void;
  outcome(): BalanceOutcome;
  /** [night-12ba] R2k: the run's weekly contracts (real adapter only). */
  contracts?(): RunContracts;
}

export interface BalanceAdapter {
  /** [night-11aj] R2g: `homeRegion` (real adapter only) starts the run in that Endless home region. */
  createBalanceSession(seed: number, mode?: 'endless', homeRegion?: string | null, weeklyContract?: boolean): BalanceSession;
}

interface RunResult {
  seed: number;
  ticks: number;
  minutes: number;
  weeks: number;
  score: number;
  reason: string;
  warned: boolean;
  warningLeadTicks: number;
  commands: number;
  rejected: number;
  upgrades: number;
  week1Unreachable: boolean;
  mechanics: RunMechanics | null;
  /** [night-12ba] R2k: only in the contract comparison (balance:contracts). */
  contracts?: RunContracts;
}

// LCG exists only inside the isolated fixture; the real sim must use src/core/rng.ts.
class FixtureRandom {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(max: number): number {
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    return this.state % max;
  }
}

interface MutableCity {
  id: string;
  active: boolean;
  connectedRoutes: number;
  waiting: number;
  capacity: number;
  warningStart: number | null;
}
interface MutableRoute {
  id: string;
  stops: string[];
  distanceKm: number;
  assigned: Record<AircraftType, number>;
}

/** Mechanical smoke fixture, intentionally NOT a replacement for the real game. */
class FixtureSession implements BalanceSession {
  private readonly rng: FixtureRandom;
  private readonly cities: MutableCity[];
  private readonly routes: MutableRoute[] = [];
  private readonly distances: Record<string, Record<string, number>> = {};
  private readonly inventory: Record<AircraftType, number> = { turboprop: 7, widebody: 1 };
  private readonly ledger: LedgerCause[] = [];
  private readonly offers: UpgradeOffer[] = [
    { id: 'a', kind: 'turboprop' }, { id: 'b', kind: 'widebody' }, { id: 'c', kind: 'hub' },
  ];
  private tick = 0;
  private phase: BotSnapshot['status'] = 'running';
  private nextCity = 2;
  private readonly emergenceInterval: number;
  private score = 0;
  private warningEver = false;
  private firstWarningTick = -1;
  private warningLeadTicks = 0;
  private endReason: BalanceOutcome['reason'] = 'timeLimit';

  constructor(seed: number) {
    this.rng = new FixtureRandom(seed);
    this.emergenceInterval = 530 + this.rng.next(225);
    this.cities = Array.from({ length: 18 }, (_, i) => ({
      id: `C${String(i).padStart(2, '0')}`,
      active: i < 2, connectedRoutes: 0, waiting: 0,
      capacity: 26 + this.rng.next(7), warningStart: null,
    }));
    for (let i = 0; i < this.cities.length; i++) {
      const first = this.cities[i].id;
      this.distances[first] = {};
      for (let j = 0; j < this.cities.length; j++) {
        const a = i < j ? i : j;
        const b = i < j ? j : i;
        this.distances[first][this.cities[j].id] = i === j ? 0 : 250 + 120 * (b - a) + (a * 17 + b * 23) % 75;
      }
    }
  }

  snapshot(): BotSnapshot {
    const cities: BotCity[] = this.cities.map((city) => ({
      id: city.id, active: city.active, connectedRoutes: city.connectedRoutes,
      isHub: city.connectedRoutes > 1, waiting: city.waiting,
      capacity: city.capacity + (city.connectedRoutes > 1 ? 15 : 0),
      warningTicksRemaining: city.warningStart === null ? null :
        Math.max(0, WARNING_TICKS - (this.tick - city.warningStart)),
    }));
    const routes: BotRoute[] = this.routes.map((route) => ({
      id: route.id, stops: [...route.stops], distanceKm: route.distanceKm,
      waiting: this.cities.filter((city) => route.stops.includes(city.id))
        .reduce((sum, city) => sum + city.waiting, 0),
      assigned: { ...route.assigned },
    }));
    return {
      tick: this.tick, status: this.phase, cities, routes,
      distancesKm: this.distances, inventory: { ...this.inventory },
      offers: this.phase === 'upgrade' ? this.offers : [], ledger: [...this.ledger],
    };
  }

  dispatch(command: BotCommand): boolean {
    if (this.phase === 'finished') return false;
    if (command.type === 'AddRoute' && this.phase === 'running') {
      const from = this.cities.find((city) => city.id === command.from && city.active);
      const to = this.cities.find((city) => city.id === command.to && city.active);
      if (!from || !to || from === to ||
          this.routes.some((route) => route.stops.includes(from.id) && route.stops.includes(to.id))) return false;
      const distanceKm = this.distances[from.id][to.id];
      if (distanceKm > 11_000) return false;
      this.routes.push({
        id: `R${this.routes.length.toString().padStart(2, '0')}`,
        stops: [from.id, to.id], distanceKm,
        assigned: { turboprop: 0, widebody: 0 },
      });
      from.connectedRoutes++;
      to.connectedRoutes++;
      return true;
    }
    if (command.type === 'ExtendRoute' && this.phase === 'running') { // [night-07w]
      const route = this.routes.find((item) => item.id === command.routeId);
      const city = this.cities.find((item) => item.id === command.cityId && item.active);
      if (!route || !city || route.stops.includes(city.id)) return false;
      const terminal = command.end === 'start' ? route.stops[0] : route.stops[route.stops.length - 1];
      const legKm = this.distances[terminal][city.id];
      if (legKm > (route.assigned.turboprop > 0 ? 2_500 : 11_000)) return false;
      route.stops = command.end === 'start' ? [city.id, ...route.stops] : [...route.stops, city.id];
      route.distanceKm = Math.max(route.distanceKm, legKm);
      city.connectedRoutes++;
      return true;
    }
    if (command.type === 'AssignPlane' && this.phase === 'running') {
      const route = this.routes.find((item) => item.id === command.routeId);
      if (!route || this.inventory[command.aircraftType] < 1 ||
          route.distanceKm > (command.aircraftType === 'turboprop' ? 2_500 : 11_000)) return false;
      route.assigned[command.aircraftType]++;
      this.inventory[command.aircraftType]--;
      return true;
    }
    if (command.type === 'ChooseUpgrade' && this.phase === 'upgrade') {
      const offer = this.offers.find((item) => item.id === command.offerId);
      if (!offer) return false;
      if (offer.kind === 'hub') {
        const city = this.cities.find((item) => item.id === command.cityId && item.connectedRoutes > 0);
        if (!city) return false;
        city.capacity += 6;
      } else if (offer.kind === 'turboprop' || offer.kind === 'widebody') {
        this.inventory[offer.kind]++;
      }
      this.phase = 'running';
      return true;
    }
    return false;
  }

  advance(ticks: number): void {
    for (let n = 0; n < ticks && this.phase === 'running'; n++) {
      this.tick++;
      if (this.tick % this.emergenceInterval === 0 && this.nextCity < this.cities.length) {
        this.cities[this.nextCity++].active = true;
      }
      if (this.tick % 45 === 0) {
        for (const city of this.cities) {
          if (city.active) city.waiting += 1 + this.rng.next(3);
        }
      }
      if (this.tick % 160 === 0) {
        for (const route of this.routes) {
          const seats = 10 * route.assigned.turboprop + 25 * route.assigned.widebody;
          for (const cityId of route.stops) {
            const city = this.cities.find((item) => item.id === cityId);
            if (!city) continue;
            const boarded = Math.min(seats, city.waiting);
            city.waiting -= boarded;
            this.score += boarded;
          }
        }
      }
      for (const city of this.cities) {
        if (!city.active) continue;
        const limit = city.capacity + (city.connectedRoutes > 1 ? 15 : 0);
        if (city.waiting >= limit) {
          if (city.warningStart === null) {
            city.warningStart = this.tick;
            if (!this.warningEver) this.firstWarningTick = this.tick;
            this.warningEver = true;
            this.ledger.push({ kind: 'hubOverflow', cityId: city.id, count: 1 });
          } else if (this.tick - city.warningStart >= WARNING_TICKS) {
            this.warningLeadTicks = this.tick - city.warningStart;
            this.endReason = 'hubOverflow';
            this.phase = 'finished';
            break;
          }
        } else {
          city.warningStart = null;
        }
      }
      if (this.tick % TICKS_PER_WEEK === 0 && this.phase === 'running') this.phase = 'upgrade';
    }
  }

  outcome(): BalanceOutcome {
    return {
      reason: this.endReason,
      score: this.score,
      warned: this.warningEver && this.firstWarningTick >= 0,
      warningLeadTicks: this.warningLeadTicks,
    };
  }
}

function reachedShare(results: readonly RunResult[], upgrades: number): number {
  return results.length ? results.filter((r) => r.upgrades >= upgrades).length / results.length : 0;
}
function share(results: readonly RunResult[], upgrades: number): string {
  return `${results.filter((r) => r.upgrades >= upgrades).length}/${results.length} (${Math.round(reachedShare(results, upgrades) * 100)}%)`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function loadAdapter(path: string, fixture: boolean): Promise<BalanceAdapter> {
  if (fixture) return { createBalanceSession: (seed) => new FixtureSession(seed) };
  const filename = resolve(ROOT, path);
  if (!existsSync(filename)) {
    throw new Error(`Production simulation adapter missing: ${path}. ` +
      'Tasks 08/09/12 must be merged and the adapter must implement createBalanceSession(seed).');
  }
  const module: Record<string, unknown> = await import(pathToFileURL(filename).href);
  if (typeof module.createBalanceSession !== 'function') {
    throw new Error(`Missing named export createBalanceSession(seed) in ${path}`);
  }
  return { createBalanceSession: module.createBalanceSession as BalanceAdapter['createBalanceSession'] };
}

function play(adapter: BalanceAdapter, seed: number, homeRegion: string | null = null, weeklyContract = false): RunResult {
  const session = weeklyContract ? adapter.createBalanceSession(seed, 'endless', homeRegion, true)
    : homeRegion ? adapter.createBalanceSession(seed, 'endless', homeRegion) : adapter.createBalanceSession(seed);
  let commands = 0;
  let rejected = 0;
  let upgrades = 0;
  for (let attempts = 0; attempts <= MAX_TICKS / ACTION_INTERVAL; attempts++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= MAX_TICKS) break;
    const decision = chooseBotAction(snapshot);
    if (decision) {
      if (session.dispatch(decision.command)) {
        commands++;
        if (decision.command.type === 'ChooseUpgrade') upgrades++;
      } else rejected++;
    }
    session.advance(Math.min(ACTION_INTERVAL, MAX_TICKS - snapshot.tick));
  }
  const snapshot = session.snapshot();
  const end = session.outcome();
  return {
    seed, ticks: snapshot.tick,
    minutes: snapshot.tick / (SIM_TICKS_PER_SECOND * 60),
    weeks: snapshot.tick / TICKS_PER_WEEK,
    score: end.score, reason: snapshot.status === 'finished' ? end.reason : 'censored',
    warned: end.warned, warningLeadTicks: end.warningLeadTicks, commands, rejected, upgrades,
    week1Unreachable: end.week1Unreachable === true, mechanics: end.mechanics ?? null,
    ...(weeklyContract && session.contracts ? { contracts: session.contracts() } : {}),
  };
}

// ---- [night-12ab] R8d: spread and mechanic use (no gate; the next balance PR can quote the tail) ----

/** Linear-interpolated quantile, the same as scripts/research/r8-audit.ts (q = .5 equals median()). */
export function quantile(values: readonly number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q; const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const QUANTILES = [['p10', 0.1], ['p25', 0.25], ['median', 0.5], ['p75', 0.75], ['p90', 0.9]] as const;
type QuantileKey = (typeof QUANTILES)[number][0];
const CARD_KINDS = ['turboprop', 'widebody', 'hub-expansion', 'departure-slots'] as const;

export interface SpreadData {
  readonly runs: number;
  readonly minutes: Readonly<Record<QuantileKey, number>>;
  readonly weeks: Readonly<Record<QuantileKey, number>>;
  /** Losses per week (1-based) and runs still flying at the cap. */
  readonly lossWeeks: Readonly<Record<number, number>>;
  readonly censored: number;
  /** Real adapter only (null for the fixture). */
  readonly mechanics: null | {
    readonly lost: number; readonly lostAtHub: number; readonly lostAtSpoke: number; readonly lostUnserved: number;
    readonly spareAtLossMedian: number; readonly lostWithNoSpare: number;
    readonly cards: Readonly<Record<string, { offered: number; picked: number }>>;
    readonly curfewWeekRuns: number; readonly curfewHoldRuns: number;
    readonly curfewGroundMinMedian: number; readonly curfewAirMinMedian: number;
    readonly slotHoldRuns: number; readonly slotHolds: number; readonly slotWaitMinMedian: number; readonly slotWaitMinP90: number;
    readonly delivered: number; readonly deliveredAfterTransfer: number; readonly transferRuns: number;
  };
}

export function spreadData(results: readonly RunResult[]): SpreadData {
  const at = (values: number[]) => Object.fromEntries(QUANTILES.map(([key, q]) => [key, quantile(values, q)])) as Record<QuantileKey, number>;
  const lossWeeks: Record<number, number> = {};
  for (const r of results) if (r.reason !== 'censored') {
    const week = r.mechanics?.loss?.week ?? Math.floor(r.ticks / TICKS_PER_WEEK) + 1;
    lossWeeks[week] = (lossWeeks[week] ?? 0) + 1;
  }
  const base = {
    runs: results.length, minutes: at(results.map((r) => r.minutes)), weeks: at(results.map((r) => r.weeks)),
    lossWeeks, censored: results.filter((r) => r.reason === 'censored').length,
  };
  const measured = results.map((r) => r.mechanics).filter((m): m is RunMechanics => m !== null);
  if (!results.length || measured.length !== results.length) return { ...base, mechanics: null };
  const losses = measured.map((m) => m.loss).filter((l): l is NonNullable<RunMechanics['loss']> => l !== null);
  const cards: Record<string, { offered: number; picked: number }> = {};
  for (const kind of CARD_KINDS) cards[kind] = { offered: 0, picked: 0 };
  for (const m of measured) {
    for (const kind of m.offered) (cards[kind] ??= { offered: 0, picked: 0 }).offered++;
    for (const kind of m.picked) (cards[kind] ??= { offered: 0, picked: 0 }).picked++;
  }
  // A run "reaches the curfew" once it plays into the week the curfew starts (D-151: week 3 in Endless).
  const curfewRuns = results.filter((r) => r.ticks > (CURFEW_ENDLESS_START_WEEK - 1) * TICKS_PER_WEEK).map((r) => r.mechanics!);
  const held = curfewRuns.filter((m) => m.curfewGroundMin + m.curfewAirMin > 0);
  return {
    ...base,
    mechanics: {
      lost: losses.length,
      lostAtHub: losses.filter((l) => l.isHub).length,
      lostAtSpoke: losses.filter((l) => !l.isHub && l.routes > 0).length,
      lostUnserved: losses.filter((l) => !l.isHub && l.routes === 0).length,
      spareAtLossMedian: quantile(losses.map((l) => l.spareAircraft), 0.5),
      lostWithNoSpare: losses.filter((l) => l.spareAircraft === 0).length,
      cards,
      curfewWeekRuns: curfewRuns.length, curfewHoldRuns: held.length,
      curfewGroundMinMedian: quantile(held.map((m) => m.curfewGroundMin), 0.5),
      curfewAirMinMedian: quantile(held.map((m) => m.curfewAirMin), 0.5),
      slotHoldRuns: measured.filter((m) => m.slotHolds > 0).length,
      slotHolds: measured.reduce((sum, m) => sum + m.slotHolds, 0),
      slotWaitMinMedian: quantile(measured.map((m) => m.slotWaitMin), 0.5),
      slotWaitMinP90: quantile(measured.map((m) => m.slotWaitMin), 0.9),
      delivered: measured.reduce((sum, m) => sum + m.delivered, 0),
      deliveredAfterTransfer: measured.reduce((sum, m) => sum + m.deliveredAfterTransfer, 0),
      transferRuns: measured.filter((m) => m.deliveredAfterTransfer > 0).length,
    },
  };
}

const pct = (n: number, d: number): string => d ? `${Math.round((100 * n) / d)} %` : '—';

/** The "Spread and mechanic use" section of game-summary.md (Markdown tables). */
export function spreadReport(data: SpreadData): string {
  const row = (label: string, values: Readonly<Record<string, number>>, digits: number) =>
    `| ${label} | ${QUANTILES.map(([key]) => values[key].toFixed(digits)).join(' | ')} |`;
  const weeks = Object.keys(data.lossWeeks).map(Number).sort((a, b) => a - b);
  let out = `## Spread and mechanic use (R8d)\n\n` +
    `| ${data.runs} runs | ${QUANTILES.map(([key]) => key).join(' | ')} |\n| --- |${' ---: |'.repeat(QUANTILES.length)}\n` +
    `${row('Session, min at 1x', data.minutes, 2)}\n${row('Game weeks', data.weeks, 2)}\n\n` +
    `| Loss week | ${weeks.map((w) => `W${w}`).join(' | ')} | not over at the cap |\n| --- |${' ---: |'.repeat(weeks.length + 1)}\n` +
    `| Runs | ${weeks.map((w) => data.lossWeeks[w]).join(' | ')} | ${data.censored} |\n\n`;
  const m = data.mechanics;
  if (!m) return out + 'Mechanic use: not measured (the fixture has no curfew, slots or transfers).\n\n';
  out += `| Losing airport | Hub | Spoke (served) | Unserved (no route) | Spare aircraft at the loss, median | Lost with no spare |\n` +
    `| --- | ---: | ---: | ---: | ---: | ---: |\n` +
    `| ${m.lost} losses | ${m.lostAtHub} (${pct(m.lostAtHub, m.lost)}) | ${m.lostAtSpoke} (${pct(m.lostAtSpoke, m.lost)}) | ` +
    `${m.lostUnserved} (${pct(m.lostUnserved, m.lost)}) | ${m.spareAtLossMedian.toFixed(1)} | ${m.lostWithNoSpare} (${pct(m.lostWithNoSpare, m.lost)}) |\n\n` +
    `| Weekly card | Offered | Picked | Picked when offered |\n| --- | ---: | ---: | ---: |\n` +
    Object.entries(m.cards).map(([kind, c]) => `| ${kind} | ${c.offered} | ${c.picked} | ${pct(c.picked, c.offered)} |`).join('\n') + '\n\n' +
    `| Mechanic | Runs | Share | Detail |\n| --- | ---: | ---: | --- |\n` +
    `| Curfew reached (week ${CURFEW_ENDLESS_START_WEEK}+) | ${m.curfewWeekRuns} | ${pct(m.curfewWeekRuns, data.runs)} | of all runs |\n` +
    `| Curfew hold | ${m.curfewHoldRuns} | ${pct(m.curfewHoldRuns, m.curfewWeekRuns)} | of runs that reached it; aircraft-min median ground ${m.curfewGroundMinMedian.toFixed(0)}, air ${m.curfewAirMinMedian.toFixed(0)} |\n` +
    `| Slot hold | ${m.slotHoldRuns} | ${pct(m.slotHoldRuns, data.runs)} | ${m.slotHolds} held departures; slot-wait aircraft-min median ${m.slotWaitMinMedian.toFixed(1)}, p90 ${m.slotWaitMinP90.toFixed(1)} |\n` +
    `| Transfer delivery | ${m.transferRuns} | ${pct(m.transferRuns, data.runs)} | ${m.deliveredAfterTransfer} of ${m.delivered} delivered changed planes (${pct(m.deliveredAfterTransfer, m.delivered)}) |\n\n`;
  return out;
}

/** [night-12ab] Fast check of the section's shape (no balance gate): consistent counts, ordered quantiles. */
export function checkSpread(data: SpreadData, results: readonly RunResult[], requireMechanics: boolean): string[] {
  const problems: string[] = [];
  if (requireMechanics && !data.mechanics) problems.push('the real adapter reported no mechanics (RunMechanics)');
  for (const key of ['minutes', 'weeks'] as const) {
    const values = QUANTILES.map(([q]) => data[key][q]);
    if (values.some((v, i) => !Number.isFinite(v) || (i > 0 && v < values[i - 1]))) problems.push(`${key} quantiles not ordered: ${values.join(',')}`);
  }
  if (Math.abs(data.minutes.median - median(results.map((r) => r.minutes))) > 1e-9) problems.push('median differs from the gate median');
  const losses = Object.values(data.lossWeeks).reduce((a, b) => a + b, 0);
  if (losses + data.censored !== data.runs) problems.push(`loss weeks ${losses} + censored ${data.censored} != ${data.runs}`);
  const m = data.mechanics;
  if (m) {
    if (m.lost !== losses) problems.push(`losing airports ${m.lost} != losses ${losses}`);
    if (m.lostAtHub + m.lostAtSpoke + m.lostUnserved !== m.lost) problems.push('hub + spoke + unserved != losses');
    const picked = Object.values(m.cards).reduce((sum, c) => sum + c.picked, 0);
    if (picked !== results.reduce((sum, r) => sum + r.upgrades, 0)) problems.push(`picked ${picked} != accepted ChooseUpgrade`);
    for (const [kind, c] of Object.entries(m.cards)) if (c.picked > c.offered) problems.push(`${kind} picked ${c.picked} > offered ${c.offered}`);
    if (m.curfewHoldRuns > m.curfewWeekRuns || m.curfewWeekRuns > data.runs) problems.push('curfew runs out of range');
    if (m.deliveredAfterTransfer > m.delivered) problems.push('transfer deliveries > deliveries');
    if (m.delivered !== results.reduce((sum, r) => sum + r.score, 0)) problems.push(`delivered ${m.delivered} != score sum`);
    if ((m.slotHolds > 0) !== (m.slotHoldRuns > 0)) problems.push('slot holds without a run');
  }
  const text = spreadReport(data);
  for (const heading of ['## Spread and mechanic use', '| Session, min at 1x |', '| Loss week |']) if (!text.includes(heading)) problems.push(`missing "${heading}"`);
  if (m) for (const heading of ['| Losing airport |', '| Weekly card |', '| Curfew hold |', '| Slot hold |', '| Transfer delivery |']) if (!text.includes(heading)) problems.push(`missing "${heading}"`);
  return problems;
}

function csv(results: RunResult[]): string {
  const header = 'seed,ticks,game_weeks,wall_minutes_1x,score,reason,warning_seen,warning_lead_ticks,commands,rejected,upgrades,week1_unreachable';
  return header + '\n' + results.map((item) => [
    item.seed, item.ticks, item.weeks.toFixed(3), item.minutes.toFixed(3), item.score,
    item.reason, item.warned ? 1 : 0, item.warningLeadTicks, item.commands, item.rejected, item.upgrades,
    item.week1Unreachable ? 1 : 0,
  ].join(',')).join('\n') + '\n';
}

function report(results: RunResult[], mode: string): string {
  const times = results.map((r) => r.minutes);
  const scores = results.map((r) => r.score);
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.reason, (counts.get(result.reason) ?? 0) + 1);
  const causes = [...counts].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => `- ${key}: ${count}`).join('\n');
  return `# Airway balance sample — ${mode}\n\n` +
    `Mode: **${mode}**, seeds: **${results.length}**, starting at **0xA1A1**, deterministic autoplay.\n\n` +
    (mode === 'fixture' ? '**NOT GAME DATA.** This stand-in has artificial queues, flights, city emergence, and capacity. ' +
      'It is useful only for testing the bot interface and report pipeline. No real parameter tuning or MVP balance is implied.\n\n' :
      'Production adapter results; inspect scenario coverage before treating these as player performance.\n\n') +
    `- Median session: ${median(times).toFixed(2)} min at 1x (target ${TARGET_MIN}–${TARGET_MAX} min, D-79).\n` +
    `- Session range: ${Math.min(...times).toFixed(2)}–${Math.max(...times).toFixed(2)} min.\n` +
    `- Median game weeks: ${median(results.map((r) => r.weeks)).toFixed(2)}.\n` +
    `- Median delivered passengers: ${median(scores).toFixed(0)}.\n` +
    `- Warnings before failure: ${results.filter((r) => r.reason === 'hubOverflow' && r.warned && r.warningLeadTicks > 0).length} / ${results.filter((r) => r.reason === 'hubOverflow').length} recorded.\n` +
    `- Rejected commands: ${results.reduce((sum, r) => sum + r.rejected, 0)}.\n` +
    `- Lost in week 1 at an airport beyond turboprop reach when it opened (D-95): ` +
    `${results.filter((r) => r.week1Unreachable).length}/${results.length}.\n` +
    `- Reached the 1st weekly upgrade: ${share(results, 1)} (target ≥ ${TARGET_FIRST_UPGRADE * 100}%); ` +
    `2nd: ${share(results, 2)} (target ≥ ${TARGET_SECOND_UPGRADE * 100}%); 3rd: ${share(results, 3)}.\n\n` +
    `## Outcomes\n${causes}\n\n` +
    spreadReport(spreadData(results)) +
    `## Time scale\n` +
    `At ${SIM_TICKS_PER_SECOND} ticks per second and one simulated minute per tick, a ${SIM_DAYS_PER_WEEK}-day week (D-40) ` +
    `lasts ${(TICKS_PER_WEEK / SIM_TICKS_PER_SECOND / 60).toFixed(2)} real minutes at 1x, so the first weekly upgrade ` +
    `opens at that point of a run and the second at ${(2 * TICKS_PER_WEEK / SIM_TICKS_PER_SECOND / 60).toFixed(2)} min.\n\n` +
    `## Reproduction\n` +
    `\`npm run ${mode === 'fixture' ? 'balance:fixture' : 'balance:report'}\`\n`;
}

function verifyPolicy(): void {
  const first: BotCity = { id: 'A', active: true, connectedRoutes: 2, isHub: true,
    waiting: 18, capacity: 20, warningTicksRemaining: null };
  const second: BotCity = { id: 'B', active: true, connectedRoutes: 0, isHub: false,
    waiting: 8, capacity: 12, warningTicksRemaining: null };
  const third: BotCity = { id: 'C', active: true, connectedRoutes: 1, isHub: false,
    waiting: 1, capacity: 20, warningTicksRemaining: null };
  const route: BotRoute = { id: 'r1', stops: ['A', 'C'], distanceKm: 800,
    waiting: 70, assigned: { turboprop: 0, widebody: 0 } };
  const base: BotSnapshot = {
    tick: BASE_SEED, status: 'running', cities: [first, second, third], routes: [route],
    distancesKm: { A: { B: 1200, C: 800 }, B: { A: 1200, C: 400 }, C: { A: 800, B: 400 } },
    inventory: { turboprop: 1, widebody: 0 }, offers: [], ledger: [],
  };
  assert.deepEqual(chooseBotAction(base)?.command, { type: 'AddRoute', from: 'B', to: 'A' });
  assert.deepEqual(chooseBotAction({ ...base, cities: [first, third] })?.command,
    { type: 'AssignPlane', routeId: 'r1', aircraftType: 'turboprop' });
  assert.equal(chooseBotAction({ ...base, status: 'finished' }), null);
  const upgrade: BotSnapshot = {
    ...base, status: 'upgrade', offers: [
      { id: 'plane', kind: 'turboprop' }, { id: 'hub', kind: 'hub' },
    ], ledger: [{ kind: 'hubOverflow', cityId: 'A', count: 100 }],
  };
  assert.deepEqual(chooseBotAction(upgrade)?.command,
    { type: 'ChooseUpgrade', offerId: 'hub', cityId: 'A' });
}

/**
 * [night-11aj] R2g / D-236: the same 50-seed bot sample once per Endless home region. Report only: a region whose
 * median leaves the D-79 target (10–18 min) is flagged, never gated or retuned here; the run fails only on invalid
 * runs (rejected commands, a hub loss without warning, a non-deterministic replay) or a start outside the region.
 */
async function regionsMain(test: boolean): Promise<void> {
  const label = test ? 'test:balance:regions' : 'balance:regions';
  const n = 50;
  try {
    const { HOME_REGIONS } = await import('../src/sim/index.ts');
    const { CITIES } = await import('../src/data/cities.ts');
    const adapter = await loadAdapter('scripts/balance-game-adapter.ts', false);
    const rows: { region: string; median: number; p10: number; p90: number; first: number; week1: number; flagged: boolean }[] = [];
    let invalid = 0;
    for (const region of HOME_REGIONS) {
      const results = Array.from({ length: n }, (_, i) => play(adapter, BASE_SEED + i, region));
      invalid += results.filter((item) => item.ticks <= 0 || !Number.isFinite(item.score) || item.rejected > 0 ||
        (item.reason === 'hubOverflow' && (!item.warned || item.warningLeadTicks <= 0))).length;
      const replay = play(adapter, BASE_SEED, region);
      if (JSON.stringify(results[0]) !== JSON.stringify(replay)) invalid++;
      const probe = adapter.createBalanceSession(BASE_SEED, 'endless', region).snapshot();
      const regions = new Set(probe.cities.map((city) => CITIES.find((item) => item.code === city.id)?.region));
      if (!regions.has(region as never)) { console.error(`${region}: start cluster outside the region`); invalid++; }
      const minutes = results.map((item) => item.minutes).sort((a, b) => a - b);
      const med = median(minutes);
      rows.push({ region, median: med, p10: minutes[Math.floor(n * 0.1)]!, p90: minutes[Math.floor(n * 0.9)]!,
        first: reachedShare(results, 1), week1: results.filter((item) => item.week1Unreachable).length,
        flagged: med < TARGET_MIN || med > TARGET_MAX });
    }
    const table = `| Home region | Median min | p10 | p90 | Reached 1st board | Week-1 unreachable losses | D-79 10–18 |\n` +
      `| --- | ---: | ---: | ---: | ---: | ---: | --- |\n` + rows.map((row) =>
        `| ${row.region} | ${row.median.toFixed(2)} | ${row.p10.toFixed(2)} | ${row.p90.toFixed(2)} | ${row.first.toFixed(2)} | ` +
        `${row.week1} | ${row.flagged ? '**flagged**' : 'ok'} |`).join('\n') + '\n';
    console.log(table);
    if (!test) {
      writeFileSync(resolve(ROOT, 'docs/balance/regions-summary.md'), `# Bot sessions per Endless home region (R2g, D-236)\n\n` +
        `Generated by \`npm run balance:regions\`: the \`test:balance\` bot on seeds 0xA1A1…+${n - 1} per home region ` +
        `(Oceania has no start cluster). Flagged = median outside the D-79 target of ${TARGET_MIN}–${TARGET_MAX} min; ` +
        `report only, nothing is retuned here.\n\n${table}`, 'utf8');
    }
    const flagged = rows.filter((row) => row.flagged).map((row) => row.region);
    console.log(`SUMMARY ${label} seed=0xA1A1 regions=${rows.length} seeds=${n} ` +
      rows.map((row) => `${row.region}=${row.median.toFixed(2)}`).join(' ') +
      ` flagged=${flagged.length ? flagged.join(',') : 'none'} passed=${invalid ? 0 : 1} failed=${invalid}`);
    if (invalid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.log(`SUMMARY ${label} seed=0xA1A1 regions=0 passed=0 failed=1`);
    process.exitCode = 1;
  }
}

/**
 * [night-12ba] R2k / D-247: the same bot sample without and with the weekly contract (the bot does not aim at the
 * contract; it plays as before and takes a contract crate only when its usual card preference picks it). Report:
 * medians against D-79 (10–18 min), contract completion rate, contract crates shown and taken. Fails only on
 * invalid runs (rejected commands, a loss without warning, a non-deterministic replay) or when a run whose
 * contracts were never met differs from the same run without contracts (the contract must not touch the run).
 */
async function contractsMain(test: boolean): Promise<void> {
  const label = test ? 'test:balance:contracts' : 'balance:contracts';
  const n = Number(process.argv.find((arg) => arg.startsWith('--seeds='))?.slice(8) ?? 50);
  try {
    const adapter = await loadAdapter('scripts/balance-game-adapter.ts', false);
    const off = Array.from({ length: n }, (_, i) => play(adapter, BASE_SEED + i));
    const on = Array.from({ length: n }, (_, i) => play(adapter, BASE_SEED + i, null, true));
    let invalid = [...off, ...on].filter((item) => item.ticks <= 0 || !Number.isFinite(item.score) || item.rejected > 0 ||
      (item.reason === 'hubOverflow' && (!item.warned || item.warningLeadTicks <= 0))).length;
    if (JSON.stringify(play(adapter, BASE_SEED, null, true)) !== JSON.stringify(on[0])) invalid++;
    let untouched = 0;
    for (let i = 0; i < n; i++) {
      if (on[i]!.contracts!.extraBoards > 0) continue;
      untouched++;
      if (on[i]!.ticks !== off[i]!.ticks || on[i]!.score !== off[i]!.score) {
        console.error(`seed ${BASE_SEED + i}: no contract crate shown, yet the run differs`);
        invalid++;
      }
    }
    const sum = (key: 'closed' | 'met' | 'extraBoards' | 'extraPicked'): number => on.reduce((total, item) => total + item.contracts![key], 0);
    const targets = on.flatMap((item) => item.contracts!.targets);
    const closed = sum('closed');
    const met = sum('met');
    const runsMet = on.filter((item) => item.contracts!.met > 0).length;
    const medOff = median(off.map((item) => item.minutes));
    const medOn = median(on.map((item) => item.minutes));
    const longer = on.filter((item, i) => item.minutes > off[i]!.minutes).length;
    const shorter = on.filter((item, i) => item.minutes < off[i]!.minutes).length;
    const rate = closed ? (100 * met) / closed : 0;
    const lines = [
      `| | Without contract | With contract |`, `| --- | ---: | ---: |`,
      `| Median session (min, D-79 10–18) | ${medOff.toFixed(2)} | ${medOn.toFixed(2)} |`,
      `| Median delivered passengers | ${median(off.map((item) => item.score)).toFixed(0)} | ${median(on.map((item) => item.score)).toFixed(0)} |`,
      `| Reached the 2nd board | ${share(off, 2)} | ${share(on, 2)} |`,
    ].join('\n');
    const facts = [
      `- Contracts closed (their week ended inside the run): ${closed}; met: ${met} (${rate.toFixed(1)} %); runs with ≥ 1 met: ${runsMet}/${n}.`,
      `- Contract targets: median ${targets.length ? median(targets).toFixed(0) : '—'}, range ${targets.length ? Math.min(...targets) : '—'}–${targets.length ? Math.max(...targets) : '—'} passengers.`,
      `- Boards with a contract crate: ${sum('extraBoards')}; the bot took that crate ${sum('extraPicked')} times.`,
      `- Same seed with vs without: ${longer} longer, ${shorter} shorter, ${n - longer - shorter} equal; ${untouched} runs never saw a contract crate (identical to the run without contracts).`,
    ].join('\n');
    console.log(`${lines}\n\n${facts}`);
    if (!test) {
      writeFileSync(resolve(ROOT, 'docs/balance/contracts-summary.md'), `# Bot sessions with and without the weekly contract (R2k, D-247)\n\n` +
        `Generated by \`npm run balance:contracts -- --seeds=${n}\`: the \`test:balance\` bot on seeds 0xA1A1…+${n - 1}, ` +
        `each seed once without and once with \`GameConfig.weeklyContract\`. The bot does not aim at the contract; ` +
        `it takes the contract crate only when its usual card preference picks it. Report only, nothing is retuned.\n\n` +
        `${lines}\n\n${facts}\n`, 'utf8');
    }
    console.log(`SUMMARY ${label} seed=0xA1A1 seeds=${n} median_off=${medOff.toFixed(2)} median_on=${medOn.toFixed(2)} ` +
      `contracts=${closed} met=${met} rate=${rate.toFixed(1)} extra_boards=${sum('extraBoards')} passed=${invalid ? 0 : 1} failed=${invalid}`);
    if (invalid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    console.log(`SUMMARY ${label} seed=0xA1A1 seeds=0 passed=0 failed=1`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--regions')) { await regionsMain(args.includes('--test')); return; }
  if (args.includes('--contracts')) { await contractsMain(args.includes('--test')); return; }
  const fixture = args.includes('--fixture');
  const test = args.includes('--test');
  // [task-31] The 50-seed sample runs in seconds, so the gate checks the same sample as the report.
  const n = 50;
  const mode = fixture ? 'fixture' : 'game';
  const adapterPath = args.find((arg) => arg.startsWith('--adapter='))?.slice('--adapter='.length)
    ?? 'scripts/balance-game-adapter.ts';
  const label = test ? 'test:balance' : 'balance:report';
  try {
    if (test) verifyPolicy();
    const adapter = await loadAdapter(adapterPath, fixture);
    const results = Array.from({ length: n }, (_, i) => play(adapter, BASE_SEED + i));
    const med = median(results.map((item) => item.minutes));
    const invalid = results.filter((item) => item.ticks <= 0 || !Number.isFinite(item.score) ||
      item.rejected > 0 || (item.reason === 'hubOverflow' && (!item.warned || item.warningLeadTicks <= 0)));
    // [night-12ab] R8d: the spread section's shape (no gate on its values).
    const spreadProblems = checkSpread(spreadData(results), results, !fixture);
    for (const problem of spreadProblems) console.error(`spread: ${problem}`);
    if (test) {
      const replay = play(adapter, BASE_SEED);
      if (JSON.stringify(results[0]) !== JSON.stringify(replay)) invalid.push(replay);
    } else {
      const csvPath = resolve(ROOT, `docs/balance/${mode}-50.csv`);
      mkdirSync(dirname(csvPath), { recursive: true });
      writeFileSync(csvPath, csv(results), 'utf8');
      writeFileSync(resolve(ROOT, `docs/balance/${mode}-summary.md`), report(results, mode), 'utf8');
    }
    // The median gate is meaningful only for a real, integrated game adapter.
    const inRange = fixture || (med >= TARGET_MIN && med <= TARGET_MAX);
    // [task-31] The weekly upgrade must be a common sight, not a lucky-seed event (D-40).
    const first = reachedShare(results, 1);
    const second = reachedShare(results, 2);
    const upgradesOk = fixture || (first >= TARGET_FIRST_UPGRADE && second >= TARGET_SECOND_UPGRADE);
    // [night-12f] D-95: no week-1 loss at an airport that the starting turboprops could not reach.
    const week1Unreachable = results.filter((item) => item.week1Unreachable).length;
    const fairOk = week1Unreachable <= TARGET_WEEK1_UNREACHABLE;
    const passed = invalid.length === 0 && inRange && upgradesOk && fairOk && spreadProblems.length === 0;
    console.log(`SUMMARY ${label} seed=0xA1A1 mode=${mode} seeds=${n} median_min=${med.toFixed(2)} ` +
      `upgrade1=${first.toFixed(2)} upgrade2=${second.toFixed(2)} week1_unreachable=${week1Unreachable} ` +
      `spread=${spreadProblems.length ? 'bad' : 'ok'} ` +
      `passed=${passed ? 1 : 0} failed=${invalid.length + (inRange ? 0 : 1) + (upgradesOk ? 0 : 1) + (fairOk ? 0 : 1) + (spreadProblems.length ? 1 : 0)}`);
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.log(`SUMMARY ${label} seed=0xA1A1 mode=${mode} seeds=0 passed=0 failed=1`);
    process.exitCode = 1;
  }
}
await main();

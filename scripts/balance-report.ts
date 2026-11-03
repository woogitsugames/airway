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
import { SIM_DAYS_PER_WEEK, SIM_MINUTES_PER_WEEK, SIM_TICKS_PER_SECOND } from '../src/sim/params.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_SEED = 0xa1a1;
// [task-31] The week length comes from the single source in params.ts (D-40); 1 sim minute per tick.
const TICKS_PER_WEEK = SIM_MINUTES_PER_WEEK;
const MAX_TICKS = 30 * 60 * SIM_TICKS_PER_SECOND; // 30 minutes at 1x.
const ACTION_INTERVAL = 30; // one command opportunity every 3 seconds at 1x.
const WARNING_TICKS = 45 * SIM_TICKS_PER_SECOND; // fixture only; not a gameplay parameter.
const TARGET_MIN = 8;
const TARGET_MAX = 15;
// [task-31] Share of bot runs that must reach the first / second weekly upgrade choice.
const TARGET_FIRST_UPGRADE = 0.6;
const TARGET_SECOND_UPGRADE = 0.3;

interface BalanceOutcome {
  readonly reason: 'hubOverflow' | 'timeLimit';
  readonly score: number;
  readonly warned: boolean;
  readonly warningLeadTicks: number;
}

/** Real engine adapter contract. Task 08/09/12 integration must implement this. */
export interface BalanceSession {
  snapshot(): BotSnapshot;
  dispatch(command: BotCommand): boolean;
  advance(ticks: number): void;
  outcome(): BalanceOutcome;
}

export interface BalanceAdapter {
  createBalanceSession(seed: number): BalanceSession;
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

function play(adapter: BalanceAdapter, seed: number): RunResult {
  const session = adapter.createBalanceSession(seed);
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
  };
}

function csv(results: RunResult[]): string {
  const header = 'seed,ticks,game_weeks,wall_minutes_1x,score,reason,warning_seen,warning_lead_ticks,commands,rejected,upgrades';
  return header + '\n' + results.map((item) => [
    item.seed, item.ticks, item.weeks.toFixed(3), item.minutes.toFixed(3), item.score,
    item.reason, item.warned ? 1 : 0, item.warningLeadTicks, item.commands, item.rejected, item.upgrades,
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
    `- Median session: ${median(times).toFixed(2)} min at 1x (target 8–15 min).\n` +
    `- Session range: ${Math.min(...times).toFixed(2)}–${Math.max(...times).toFixed(2)} min.\n` +
    `- Median game weeks: ${median(results.map((r) => r.weeks)).toFixed(2)}.\n` +
    `- Median delivered passengers: ${median(scores).toFixed(0)}.\n` +
    `- Warnings before failure: ${results.filter((r) => r.reason === 'hubOverflow' && r.warned && r.warningLeadTicks > 0).length} / ${results.filter((r) => r.reason === 'hubOverflow').length} recorded.\n` +
    `- Rejected commands: ${results.reduce((sum, r) => sum + r.rejected, 0)}.\n` +
    `- Reached the 1st weekly upgrade: ${share(results, 1)} (target ≥ ${TARGET_FIRST_UPGRADE * 100}%); ` +
    `2nd: ${share(results, 2)} (target ≥ ${TARGET_SECOND_UPGRADE * 100}%); 3rd: ${share(results, 3)}.\n\n` +
    `## Outcomes\n${causes}\n\n` +
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
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
    const passed = invalid.length === 0 && inRange && upgradesOk;
    console.log(`SUMMARY ${label} seed=0xA1A1 mode=${mode} seeds=${n} median_min=${med.toFixed(2)} ` +
      `upgrade1=${first.toFixed(2)} upgrade2=${second.toFixed(2)} ` +
      `passed=${passed ? 1 : 0} failed=${invalid.length + (inRange ? 0 : 1) + (upgradesOk ? 0 : 1)}`);
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.log(`SUMMARY ${label} seed=0xA1A1 mode=${mode} seeds=0 passed=0 failed=1`);
    process.exitCode = 1;
  }
}
await main();

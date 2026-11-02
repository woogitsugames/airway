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
import { SIM_TICKS_PER_SECOND } from '../src/sim/params.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_SEED = 0xa1a1;
const TICKS_PER_WEEK = 7 * 24 * 60; // 1 simulation minute per tick (architecture task 01).
const MAX_TICKS = 30 * 60 * SIM_TICKS_PER_SECOND; // 30 minutes at 1x.
const ACTION_INTERVAL = 30; // one command opportunity every 3 seconds at 1x.
const WARNING_TICKS = 45 * SIM_TICKS_PER_SECOND; // fixture only; not a gameplay parameter.
const TARGET_MIN = 8;
const TARGET_MAX = 15;

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
  for (let attempts = 0; attempts <= MAX_TICKS / ACTION_INTERVAL; attempts++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= MAX_TICKS) break;
    const decision = chooseBotAction(snapshot);
    if (decision) {
      if (session.dispatch(decision.command)) commands++;
      else rejected++;
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
    warned: end.warned, warningLeadTicks: end.warningLeadTicks, commands, rejected,
  };
}

function csv(results: RunResult[]): string {
  const header = 'seed,ticks,game_weeks,wall_minutes_1x,score,reason,warning_seen,warning_lead_ticks,commands,rejected';
  return header + '\n' + results.map((item) => [
    item.seed, item.ticks, item.weeks.toFixed(3), item.minutes.toFixed(3), item.score,
    item.reason, item.warned ? 1 : 0, item.warningLeadTicks, item.commands, item.rejected,
  ].join(',')).join('\n') + '\n';
}

function report(results: RunResult[], mode: string): string {
  const times = results.map((r) => r.minutes);

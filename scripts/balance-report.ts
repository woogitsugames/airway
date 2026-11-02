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
      this.routes.push
// Task 17 puzzle mode on the authoritative simulation (D-32 completed during integration).
// A level (src/data/puzzles) becomes a Sim scenario (src/sim/puzzles.ts): fixed cities, aircraft
// stock, scripted passenger waves, always-on curfew cities (D-17) and a deadline. This module keeps
// the task-17 session contract (immutable sessions, unlimited undo by exact replay) and grades goals.
import type { PuzzleLevel, PuzzleGoal, PuzzleCommand } from '../../data/puzzles';
import { cityByCode } from '../../data/index.ts';
import { createGame, Sim, type Command } from '../../sim/index.ts';

export type PuzzleAction = PuzzleCommand | { readonly type: 'advance'; readonly ticks: number };
export type PuzzleStatus = 'playing' | 'won' | 'lost';
export interface PuzzleSnapshot {
  readonly tick: number;
  readonly delivered: number;
  readonly coveredContinents: number;
  readonly nightsSurvived: number;
  readonly waiting: Readonly<Record<string, number>>;
  readonly routes: readonly string[];
  readonly stock: Readonly<{ turboprops: number; jets: number; hubUpgrades: number }>;
  readonly upgradedCities: readonly string[];
  readonly status: PuzzleStatus;
  readonly reason: 'none' | 'hub-jam' | 'deadline';
  readonly jammedCity: string | null;
  readonly marginPercent: number;
  readonly stars: number;
}
export interface PuzzleSession {
  readonly levelId: string;
  readonly history: readonly PuzzleAction[];
  readonly snapshot: PuzzleSnapshot;
}

/** The first night ends at 06:00 on day 2 (minute 1800); each further day adds one. */
const FIRST_NIGHT_END = 1_800;
const DAY = 1_440;

function routeId(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
function assertInt(value: number, label: string, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`Invalid ${label}`);
}

export function validatePuzzle(level: PuzzleLevel): void {
  if (!/^\d{2}$/.test(level.id) || level.version !== 1 || level.titleKey !== `puzzle.${level.id}.title`) {
    throw new Error('Invalid puzzle identity/version');
  }
  assertInt(level.durationTicks, 'duration', 1);
  assertInt(level.demandSeed, 'demand seed');
  for (const [name, value] of Object.entries(level.stock)) assertInt(value, `stock ${name}`);
  const cities = new Set<string>();
  for (const city of level.startCities) {
    if (!/^[A-Z]{3}$/.test(city.id) || cities.has(city.id)) throw new Error('Invalid or duplicate airport code');
    if (!cityByCode(city.id)) throw new Error(`Airport ${city.id} is not in the city dataset`);
    cities.add(city.id);
    assertInt(city.hubCapacity, 'hub capacity', 1);
  }
  if (cities.size < 2) throw new Error('A puzzle requires at least two cities');
  const routes = new Set<string>();
  for (const route of level.availableRoutes) {
    if (!cities.has(route.from) || !cities.has(route.to) || route.from === route.to) throw new Error('Unknown route city');
    if (routes.has(routeId(route.from, route.to))) throw new Error('Duplicate route');
    if (route.plane !== 'turboprop' && route.plane !== 'jet') throw new Error('Unknown plane');
    routes.add(routeId(route.from, route.to));
  }
  if (!level.availableRoutes.length) throw new Error('Missing routes');
  for (const demand of level.demand) {
    if (!cities.has(demand.from) || !cities.has(demand.to) || demand.from === demand.to) throw new Error('Invalid demand endpoints');
    assertInt(demand.passengers, 'demand passengers', 1);
    assertInt(demand.firstTick, 'first demand tick');
    assertInt(demand.everyTicks, 'demand interval', 1);
    if (demand.firstTick >= level.durationTicks) throw new Error('Demand outside deadline');
  }
  if (!level.demand.length) throw new Error('Missing demand');
  assertInt(level.goal.targetDelivered, 'goal target', 1);
  if (!['deliver', 'continents', 'curfewNights'].includes(level.goal.kind)) throw new Error('Invalid goal kind');
  if (level.goal.kind === 'continents') assertInt(level.goal.continents, 'required continents', 2);
  if (level.goal.kind === 'curfewNights') assertInt(level.goal.nights, 'required nights', 1);
  for (const command of level.referenceCommands) {
    if (command.type === 'connect') {
      if (!routes.has(routeId(command.from, command.to))) throw new Error('Reference route unavailable');
    } else if (command.type === 'upgradeHub') {
      if (!cities.has(command.city)) throw new Error('Unknown reference hub');
    } else throw new Error('Unsupported reference command');
  }
}

/** Translate a puzzle command after the level's own rules (offered routes, plane type, no duplicates). */
function toSimCommand(level: PuzzleLevel, sim: Sim, command: PuzzleCommand): Command {
  if (command.type === 'connect') {
    const route = level.availableRoutes.find((entry) => routeId(entry.from, entry.to) === routeId(command.from, command.to));
    const connected = sim.world.routes().some((entry) => entry.cityIds.length === 2 &&
      routeId(entry.cityIds[0], entry.cityIds[1]) === routeId(command.from, command.to));
    if (!route || route.plane !== command.plane || connected) throw new Error('Route unavailable or already connected');
    const aircraft = route.plane === 'jet' ? 'widebody' : 'turboprop';
    if (sim.world.reserve[aircraft] <= 0) throw new Error('No aircraft remaining');
    return { type: 'AddRoute', cityIds: [route.from, route.to], aircraft };
  }
  if (command.type === 'upgradeHub') {
    const view = sim.world.cityView(command.city);
    if (!level.startCities.some((city) => city.id === command.city) || view.upgradeLevels > 0) {
      throw new Error('Hub upgrade unavailable');
    }
    return { type: 'UpgradeHub', hubId: command.city };
  }
  throw new Error('Unsupported puzzle command');
}

function coveredContinents(level: PuzzleLevel, sim: Sim): number {
  const base = level.startCities[0]?.id;
  if (!base) return 0;
  const routes = sim.world.routes();
  const seen = new Set([base]);
  const todo = [base];
  for (let index = 0; index < todo.length; index++) {
    for (const route of routes) {
      if (!route.cityIds.includes(todo[index])) continue;
      for (const id of route.cityIds) if (!seen.has(id)) { seen.add(id); todo.push(id); }
    }
  }
  return new Set(level.startCities.filter((city) => seen.has(city.id)).map((city) => city.continent)).size;
}

function nightsAt(minute: number): number {
  return minute < FIRST_NIGHT_END ? 0 : Math.floor((minute - FIRST_NIGHT_END) / DAY) + 1;
}

function eligible(goal: PuzzleGoal, delivered: number, continents: number, nights: number): boolean {
  if (delivered < goal.targetDelivered) return false;
  if (goal.kind === 'continents' && continents < goal.continents) return false;
  if (goal.kind === 'curfewNights' && nights < goal.nights) return false;
  return true;
}

function snapshotOf(level: PuzzleLevel, sim: Sim): PuzzleSnapshot {
  const world = sim.world;
  const waiting: Record<string, number> = Object.create(null);
  const upgraded: string[] = [];
  for (const city of level.startCities) {
    const view = world.cityView(city.id);
    waiting[city.id] = view.waiting;
    if (view.upgradeLevels > 0) upgraded.push(city.id);
  }
  const delivered = world.score;
  const continents = coveredContinents(level, sim);
  const nights = nightsAt(world.minute);
  let status: PuzzleStatus = 'playing';
  let reason: PuzzleSnapshot['reason'] = 'none';
  if (world.status === 'over') { status = 'lost'; reason = 'hub-jam'; }
  else if (world.status === 'won') {
    status = eligible(level.goal, delivered, continents, nights) ? 'won' : 'lost';
    reason = status === 'lost' ? 'deadline' : 'none';
  }
  const margin = Math.trunc(((delivered - level.goal.targetDelivered) * 100) / level.goal.targetDelivered);
  return {
    tick: world.minute, delivered, coveredContinents: continents, nightsSurvived: nights, waiting,
    routes: world.routes().map((route) => routeId(route.cityIds[0], route.cityIds[route.cityIds.length - 1])).sort(),
    stock: { turboprops: world.reserve.turboprop, jets: world.reserve.widebody, hubUpgrades: world.hubUpgradesInStock },
    upgradedCities: upgraded.sort(), status, reason, jammedCity: world.failure?.cityId ?? null,
    marginPercent: status === 'won' ? margin : 0,
    stars: status !== 'won' ? 0 : margin >= 30 ? 3 : margin >= 15 ? 2 : 1,
  };
}

/** One action on a live puzzle Sim. A command takes effect on the next tick, so it costs one game minute. */
function perform(level: PuzzleLevel, sim: Sim, action: PuzzleAction): void {
  if (sim.world.status !== 'running') throw new Error('Puzzle has finished');
  if (action.type === 'advance') {
    assertInt(action.ticks, 'advance ticks', 1);
    // Clamped at the deadline; after a hub jam the clock is frozen.
    for (let i = 0; i < action.ticks && sim.world.status === 'running'; i++) sim.tick();
    sim.drainEvents();
    return;
  }
  const command = toSimCommand(level, sim, action);
  const verdict = sim.check(command);
  if (!verdict.ok) throw new Error(`Puzzle command rejected: ${verdict.reason}`);
  sim.apply(command);
  sim.tick();
  sim.drainEvents();
}

// Live Sims keyed by the immutable session they produced; the next dispatch continues it.
const live = new WeakMap<PuzzleSession, Sim>();

function session(level: PuzzleLevel, history: readonly PuzzleAction[], sim: Sim): PuzzleSession {
  const result: PuzzleSession = { levelId: level.id, history: history.slice(), snapshot: snapshotOf(level, sim) };
  live.set(result, sim);
  return result;
}

export function replayPuzzle(level: PuzzleLevel, history: readonly PuzzleAction[]): PuzzleSession {
  validatePuzzle(level);
  const sim = createGame(level.demandSeed, 'puzzle', level.id);
  for (const action of history) perform(level, sim, action);
  return session(level, history, sim);
}
export function startPuzzle(level: PuzzleLevel): PuzzleSession { return replayPuzzle(level, []); }
export function dispatchPuzzle(level: PuzzleLevel, current: PuzzleSession, action: PuzzleAction): PuzzleSession {
  if (current.levelId !== level.id) throw new Error('Puzzle session does not match level');
  // Work on a copy so a rejected action leaves the previous session (and its Sim) untouched.
  const base = live.get(current) ?? live.get(replayPuzzle(level, current.history))!;
  const sim = Sim.fromSnapshot(base.snapshot());
  perform(level, sim, action);
  return session(level, [...current.history, action], sim);
}
export function undoPuzzle(level: PuzzleLevel, current: PuzzleSession): PuzzleSession {
  if (current.levelId !== level.id) throw new Error('Puzzle session does not match level');
  return replayPuzzle(level, current.history.slice(0, -1));
}
export function resetPuzzle(level: PuzzleLevel): PuzzleSession { return startPuzzle(level); }
export function runReference(level: PuzzleLevel): PuzzleSession {
  return replayPuzzle(level, [...level.referenceCommands, { type: 'advance', ticks: level.durationTicks }]);
}


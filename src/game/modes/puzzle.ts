// Task 17: isolated, deterministic puzzle adapter until the authoritative simulation lands.
// Commands, seeds, and goals remain serializable for migration to the real sim kernel.
import type { PuzzleLevel, PuzzleGoal, PuzzleCommand, PuzzleCity, PuzzleRoute } from '../../data/puzzles';

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
interface Group { target: string; passengers: number; readyTick: number }
interface Flight { target: string; destination: string; passengers: number; arrivalTick: number }
interface State {
  tick: number; delivered: number; nights: number; status: PuzzleStatus;
  reason: PuzzleSnapshot['reason']; jammedCity: string | null;
  stock: { turboprops: number; jets: number; hubUpgrades: number };
  queues: Record<string, Group[]>;
  overloadTicks: Record<string, number>;
  activeRoutes: PuzzleRoute[];
  upgraded: Set<string>;
  flights: Flight[];
}
const JAM_GRACE_TICKS = 18;
const TRANSFER_TICKS = 18;
const HUB_UPGRADE_SEATS = 32;
const PLANE_CAPACITY: Readonly<Record<'turboprop' | 'jet', number>> = { turboprop: 32, jet: 56 };

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
    cities.add(city.id);
    assertInt(city.hubCapacity, 'hub capacity', 1);
    if (city.curfew) {
      assertInt(city.curfew.startMinuteOfDay, 'curfew start');
      assertInt(city.curfew.endMinuteOfDay, 'curfew end');
      if (city.curfew.startMinuteOfDay >= 1440 || city.curfew.endMinuteOfDay >= 1440 ||
          city.curfew.startMinuteOfDay === city.curfew.endMinuteOfDay) throw new Error('Invalid curfew');
    }
  }
  if (cities.size < 2) throw new Error('A puzzle requires at least two cities');
  const routes = new Set<string>();
  for (const route of level.availableRoutes) {
    if (!cities.has(route.from) || !cities.has(route.to) || route.from === route.to) throw new Error('Unknown route city');
    if (routes.has(routeId(route.from, route.to))) throw new Error('Duplicate route');
    if (route.plane !== 'turboprop' && route.plane !== 'jet') throw new Error('Unknown plane');
    assertInt(route.flightTicks, 'flight time', 1);
    assertInt(route.intervalTicks, 'service interval', 1);
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
function freshState(level: PuzzleLevel): State {
  const queues: Record<string, Group[]> = Object.create(null);
  const overloadTicks: Record<string, number> = Object.create(null);
  for (const city of level.startCities) { queues[city.id] = []; overloadTicks[city.id] = 0; }
  return {
    tick: 0, delivered: 0, nights: 0, status: 'playing', reason: 'none', jammedCity: null,
    stock: { ...level.stock }, queues, overloadTicks, activeRoutes: [], upgraded: new Set(), flights: [],
  };
}
function cityFor(level: PuzzleLevel, id: string): PuzzleCity {
  const city = level.startCities.find((entry) => entry.id === id);
  if (!city) throw new Error(`Unknown airport ${id}`);
  return city;
}
function isCurfew(city: PuzzleCity, tick: number): boolean {
  if (!city.curfew) return false;
  const minute = tick % 1440;
  const { startMinuteOfDay: start, endMinuteOfDay: end } = city.curfew;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
function applyCommand(level: PuzzleLevel, state: State, command: PuzzleCommand): void {
  if (state.status !== 'playing') throw new Error('Puzzle has finished');
  if (command.type === 'connect') {
    const route = level.availableRoutes.find((entry) => routeId(entry.from, entry.to) === routeId(command.from, command.to));
    if (!route || route.plane !== command.plane || state.activeRoutes.some((entry) => routeId(entry.from, entry.to) === routeId(command.from, command.to))) {
      throw new Error('Route unavailable or already connected');
    }
    const key = route.plane === 'jet' ? 'jets' : 'turboprops';
    if (!state.stock[key]) throw new Error('No aircraft remaining');
    state.stock[key]--;
    state.activeRoutes.push(route);
    state.activeRoutes.sort((a, b) => routeId(a.from, a.to).localeCompare(routeId(b.from, b.to)));
  } else {
    cityFor(level, command.city);
    if (!state.stock.hubUpgrades || state.upgraded.has(command.city)) throw new Error('Hub upgrade unavailable');
    state.stock.hubUpgrades--;
    state.upgraded.add(command.city);
  }
}
function nextHop(state: State, from: string, destination: string): string | null {
  if (from === destination) return null;
  const frontier = [from];
  const visited = new Set([from]);
  const firstHop: Record<string, string> = Object.create(null);
  for (let index = 0; index < frontier.length; index++) {
    const city = frontier[index];
    const neighbors: string[] = [];
    for (const edge of state.activeRoutes) {
      if (edge.from === city) neighbors.push(edge.to);
      else if (edge.to === city) neighbors.push(edge.from);
    }
    neighbors.sort();
    for (const adjacent of neighbors) {
      if (visited.has(adjacent)) continue;
      visited.add(adjacent);
      firstHop[adjacent] = city === from ? adjacent : firstHop[city];
      if (adjacent === destination) return firstHop[adjacent];
      frontier.push(adjacent);
    }
  }
  return null;
}
function coveredContinents(level: PuzzleLevel, state: State): number {
  const baseCity = level.startCities[0]?.id;
  if (!baseCity) return 0;
  const seen = new Set([baseCity]);
  const todo = [baseCity];
  for (let index = 0; index < todo.length; index++) {
    const from = todo[index];
    for (const route of state.activeRoutes) {
      const to = route.from === from ? route.to : route.to === from ? route.from : null;
      if (to && !seen.has(to)) { seen.add(to); todo.push(to); }
    }
  }
  return new Set(level.startCities.filter((city) => seen.has(city.id)).map((city) => city.continent)).size;
}
function eligible(goal: PuzzleGoal, state: State, continents: number): boolean {
  if (state.delivered < goal.targetDelivered) return false;
  if (goal.kind === 'continents' && continents < goal.continents) return false;
  if (goal.kind === 'curfewNights' && state.nights < goal.nights) return false;
  return true;
}
function simulateTick(level: PuzzleLevel, state: State): void {
  if (state.status !== 'playing' || state.tick >= level.durationTicks) return;
  const tick = state.tick;
  // The demand seed selects a fixed 0..8 minute wave offset; no ad-hoc PRNG is used.
  const offset = level.demandSeed % 9;
  for (const wave of level.demand) {
    const elapsed = tick - wave.firstTick - offset;
    if (elapsed >= 0 && elapsed % wave.everyTicks === 0) {
      state.queues[wave.from].push({ target: wave.to, passengers: wave.passengers, readyTick: tick });
    }
  }
  for (let i = state.flights.length - 1; i >= 0; i--) {
    const flight = state.flights[i];
    if (flight.arrivalTick !== tick) continue;
    if (flight.destination === flight.target) state.delivered += flight.passengers;
    else state.queues[flight.destination].push({ target: flight.target, passengers: flight.passengers, readyTick: tick + TRANSFER_TICKS });
    state.flights.splice(i, 1);
  }
  for (const edge of state.activeRoutes) {
    if (tick % edge.intervalTicks !== 0) continue;
    for (const [from, to] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      if (isCurfew(cityFor(level, from), tick)) continue;
      let free = PLANE_CAPACITY[edge.plane];
      const queue = state.queues[from];
      for (let i = 0; i < queue.length && free > 0;) {
        const group = queue[i];
        if (group.readyTick > tick || nextHop(state, from, group.target) !== to) { i++; continue; }
        const boarded = Math.min(free, group.passengers);
        group.passengers -= boarded;
        free -= boarded;
        state.flights.push({ destination: to, target: group.target, passengers: boarded, arrivalTick: tick + edge.flightTicks });
        if (group.passengers === 0) queue.splice(i, 1);
        else i++;
      }
    }
  }
  for (const city of level.startCities) {
    let waiting = 0;
    for (const group of state.queues[city.id]) waiting += group.passengers;
    const capacity = city.hubCapacity + (state.upgraded.has(city.id) ? HUB_UPGRADE_SEATS : 0);
    state.overloadTicks[city.id] = waiting > capacity ? state.overloadTicks[city.id] + 1 : 0;
    if (state.overloadTicks[city.id] >= JAM_GRACE_TICKS) {
      state.status = 'lost'; state.reason = 'hub-jam'; state.jammedCity = city.id;
      break;
    }
  }
  state.tick++;
  if (state.tick >= 1800 && (state.tick - 1800) % 1440 === 0) state.nights++;
  if (state.status === 'playing' && state.tick === level.durationTicks) {
    state.status = eligible(level.goal, state, coveredContinents(level, state)) ? 'won' : 'lost';
    state.reason = state.status === 'lost' ? 'deadline' : 'none';
  }
}
function snapshot(level: PuzzleLevel, state: State): PuzzleSnapshot {
  const waiting: Record<string, number> = Object.create(null);
  for (const city of level.startCities) {
    waiting[city.id] = state.queues[city.id].reduce((sum, group) => sum + group.passengers, 0);
  }
  const margin = Math.trunc(((state.delivered - level.goal.targetDelivered) * 100) / level.goal.targetDelivered);
  return {
    tick: state.tick, delivered: state.delivered, coveredContinents: coveredContinents(level, state),
    nightsSurvived: state.nights, waiting, routes: state.activeRoutes.map((route) => routeId(route.from, route.to)),
    stock: { ...state.stock }, upgradedCities: [...state.upgraded].sort(), status: state.status,
    reason: state.reason, jammedCity: state.jammedCity,
    marginPercent: state.status === 'won' ? margin : 0,
    stars: state.status !== 'won' ? 0 : margin >= 30 ? 3 : margin >= 15 ? 2 : 1,
  };
}
export function replayPuzzle(level: PuzzleLevel, history: readonly PuzzleAction[]): PuzzleSession {
  validatePuzzle(level);
  const state = freshState(level);
  for (const action of history) {
    if (action.type === 'advance') {
      if (state.status !== 'playing') throw new Error('Puzzle has finished');
      assertInt(action.ticks, 'advance ticks', 1);
      if (state.tick + action.ticks > level.durationTicks) throw new Error('Cannot advance beyond deadline');
      for (let i = 0; i < action.ticks && state.status === 'playing'; i++) simulateTick(level, state);
      // The clock is frozen after a hub jam. Remaining ticks do not create new events.
    } else applyCommand(level, state, action);
  }
  return { levelId: level.id, history: history.slice(), snapshot: snapshot(level, state) };
}
export function startPuzzle(level: PuzzleLevel): PuzzleSession { return replayPuzzle(level, []); }
export function dispatchPuzzle(level: PuzzleLevel, session: PuzzleSession, action: PuzzleAction): PuzzleSession {
  if (session.levelId !== level.id) throw new Error('Puzzle session does not match level');
  return replayPuzzle(level, [...session.history, action]);
}
export function undoPuzzle(level: PuzzleLevel, session: PuzzleSession): PuzzleSession {
  if (session.levelId !== level.id) throw new Error('Puzzle session does not match level');
  return replayPuzzle(level, session.history.slice(0, -1));
}
export function resetPuzzle(level: PuzzleLevel): PuzzleSession { return startPuzzle(level); }
export function runReference(level: PuzzleLevel): PuzzleSession {
  return replayPuzzle(level, [...level.referenceCommands, { type: 'advance', ticks: level.durationTicks }]);
}

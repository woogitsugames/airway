// DEV/QA autoplay (task 22 policy) on the real Sim: it reads public world views and returns real
// Commands for Sim.check/apply. No rule shortcuts. Imported by the balance tools and, only through dynamic
// imports, by src/main.ts: DEV-guarded for window.aw.autoplay and store shots; [night-12ay] R3i (D-245) a lazy
// production chunk loaded only when Android starts the app as a Firebase Test Lab game loop.
import { PLANE_TYPES, type Command, type Sim, type UpgradeKind } from '../../sim/index.ts';
import { cityDistanceKm } from '../../data/index.ts';
import {
  chooseBotAction, type BotCommand, type BotSnapshot, type LedgerCause, type UpgradeKind as BotUpgradeKind,
} from './bot-policy.ts';

const TO_BOT: Record<UpgradeKind, BotUpgradeKind> = {
  turboprop: 'turboprop', widebody: 'widebody', 'hub-expansion': 'hub', 'departure-slots': 'slots',
};

/** Read-only conversion of the Sim's world views into the bot's snapshot contract. */
export function botSnapshot(sim: Sim): BotSnapshot {
  const world = sim.world;
  const cities = world.cities();
  const waiting = new Map(cities.map((city) => [city.id, city.waiting]));
  const routes = world.routes().map((route) => {
    const assigned = { turboprop: 0, widebody: 0 };
    const movable: { id: string; type: 'turboprop' | 'widebody' }[] = [];
    for (const plane of world.planes) {
      if (plane.routeId !== route.id) continue;
      assigned[plane.type]++;
      if (plane.phase === 'ground' && plane.load === 0) movable.push({ id: plane.id, type: plane.type }); // [night-12z]
    }
    return {
      id: route.id, stops: route.cityIds, distanceKm: Math.max(...route.legKm),
      waiting: route.cityIds.reduce((sum, id) => sum + (waiting.get(id) ?? 0), 0), assigned, movable,
    };
  });
  const distancesKm: Record<string, Record<string, number>> = {};
  for (const a of cities) {
    distancesKm[a.id] = {};
    for (const b of cities) distancesKm[a.id][b.id] = cityDistanceKm(a.id, b.id) ?? 0;
  }
  const ledger: LedgerCause[] = [];
  for (const city of cities) {
    const causes = world.hubCauseLedger(city.id);
    if (city.fullTicks > 0) ledger.push({ kind: 'hubOverflow', cityId: city.id, count: city.waiting });
    if (causes.noRoute) ledger.push({ kind: 'unrouted', cityId: city.id, count: causes.noRoute });
    if (causes.waitingTooLong) ledger.push({ kind: 'longWait', cityId: city.id, count: causes.waitingTooLong });
    if (causes.slotWaitMinutes) ledger.push({ kind: 'slots', cityId: city.id, count: causes.slotWaitMinutes }); // [task-32]
  }
  const status = world.status === 'running' ? 'running' : world.status === 'upgrade' ? 'upgrade' : 'finished';
  return {
    tick: world.minute, status,
    cities: cities.map((city) => ({
      id: city.id, active: true, connectedRoutes: city.routes, isHub: city.isHub,
      waiting: city.waiting, capacity: city.capacity, warningTicksRemaining: city.jamTicksRemaining,
    })),
    routes, distancesKm, inventory: { ...world.reserve },
    offers: world.offer ? world.offer.offers.map((offer) => ({ id: offer.id, kind: TO_BOT[offer.id] })) : [],
    ledger,
  };
}

/** The same Commands the route tool, the dock and the weekly board send. */
export function botCommandToSim(sim: Sim, command: BotCommand): Command {
  if (command.type === 'AddRoute') {
    // Like the route tool: drawing a route also assigns a spare aircraft that can fly it.
    const km = cityDistanceKm(command.from, command.to) ?? Infinity;
    const reserve = sim.world.reserve;
    const aircraft = km <= PLANE_TYPES.turboprop.rangeKm && reserve.turboprop > 0 ? 'turboprop'
      : km <= PLANE_TYPES.widebody.rangeKm && reserve.widebody > 0 ? 'widebody' : undefined;
    const cityIds = [command.from, command.to];
    return aircraft ? { type: 'AddRoute', cityIds, aircraft } : { type: 'AddRoute', cityIds };
  }
  if (command.type === 'ExtendRoute') { // [night-07w]
    const stops = sim.world.routes().find((route) => route.id === command.routeId)?.cityIds ?? [];
    const cityIds = command.end === 'start' ? [command.cityId, ...stops] : [...stops, command.cityId];
    return { type: 'ExtendRoute', routeId: command.routeId, end: command.end, cityIds };
  }
  if (command.type === 'AssignPlane') return { type: 'AssignPlane', routeId: command.routeId, aircraft: command.aircraftType };
  if (command.type === 'UnassignPlane') return { type: 'UnassignPlane', planeId: command.planeId }; // [night-12z] R8e
  const week = sim.world.offer?.week ?? 0;
  const upgrade = command.offerId as UpgradeKind;
  return command.cityId && (upgrade === 'hub-expansion' || upgrade === 'departure-slots') // [task-32]
    ? { type: 'ChooseUpgrade', week, upgrade, hubId: command.cityId }
    : { type: 'ChooseUpgrade', week, upgrade };
}

/** One autoplay decision for the current world, or null when the bot would wait. */
export function nextAutoplayCommand(sim: Sim): Command | null {
  const decision = chooseBotAction(botSnapshot(sim));
  return decision ? botCommandToSim(sim, decision.command) : null;
}

/** Ticks between decisions; the balance report uses the same cadence (3 s at 1x). */
export const AUTOPLAY_ACTION_INTERVAL = 30;

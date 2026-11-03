/**
 * Task 22: deterministic, read-only autoplay policy (shared by scripts/balance-* and DEV window.aw).
 *
 * The adapter converts real simulation snapshots and commands to this contract.
 * This module neither imports rendering code nor mutates authoritative state.
 */
export type AircraftType = 'turboprop' | 'widebody';
export type UpgradeKind = AircraftType | 'hub' | 'slots';

export interface BotCity {
  readonly id: string;
  readonly active: boolean;
  readonly connectedRoutes: number;
  readonly isHub: boolean;
  readonly waiting: number;
  readonly capacity: number;
  readonly warningTicksRemaining: number | null;
}

export interface BotRoute {
  readonly id: string;
  readonly stops: readonly string[];
  readonly distanceKm: number;
  readonly waiting: number;
  readonly assigned: Readonly<Record<AircraftType, number>>;
}

export interface LedgerCause {
  readonly kind: 'hubOverflow' | 'unrouted' | 'longWait' | 'range' | 'slots';
  readonly count: number;
  readonly cityId?: string;
  readonly routeId?: string;
}

export interface UpgradeOffer {
  readonly id: string;
  readonly kind: UpgradeKind;
}

export interface BotSnapshot {
  readonly tick: number;
  readonly status: 'running' | 'upgrade' | 'finished';
  readonly cities: readonly BotCity[];
  readonly routes: readonly BotRoute[];
  readonly distancesKm: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly inventory: Readonly<Record<AircraftType, number>>;
  readonly offers: readonly UpgradeOffer[];
  readonly ledger: readonly LedgerCause[];
}

export type BotCommand =
  | { readonly type: 'AddRoute'; readonly from: string; readonly to: string }
  | { readonly type: 'AssignPlane'; readonly routeId: string; readonly aircraftType: AircraftType }
  // [night-07w] Append a stop at one end of a served route (the route tool's drag from a route end).
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly end: 'start' | 'end'; readonly cityId: string }
  | { readonly type: 'ChooseUpgrade'; readonly offerId: string; readonly cityId?: string };

export interface BotDecision {
  readonly command: BotCommand;
  readonly reason: string;
}

const TURBOPROP_RANGE_KM = 2_500;
const WIDEBODY_RANGE_KM = 11_000;

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pressure(city: BotCity): number {
  return city.capacity > 0 ? city.waiting / city.capacity : 0;
}

function availableForDistance(snapshot: BotSnapshot, km: number): boolean {
  return (km <= TURBOPROP_RANGE_KM && snapshot.inventory.turboprop > 0)
    || (km <= WIDEBODY_RANGE_KM && snapshot.inventory.widebody > 0);
}

function planeForRoute(route: BotRoute, inventory: BotSnapshot['inventory']): AircraftType | null {
  if (route.distanceKm > WIDEBODY_RANGE_KM) return null;
  if (route.distanceKm > TURBOPROP_RANGE_KM) {
    return inventory.widebody > 0 ? 'widebody' : null;
  }
  // Save long-range aircraft for routes a turboprop cannot serve.
  if (inventory.turboprop > 0) return 'turboprop';
  return inventory.widebody > 0 ? 'widebody' : null;
}

function chooseAircraft(snapshot: BotSnapshot): BotDecision | null {
  let selected: BotRoute | undefined;
  let selectedType: AircraftType | null = null;
  let best = -Infinity;
  for (const route of snapshot.routes) {
    const aircraftType = planeForRoute(route, snapshot.inventory);
    if (!aircraftType || !route.stops.length) continue;
    const assigned = route.assigned.turboprop + route.assigned.widebody;
    // Do not spend the entire fleet on a route that already has enough lift.
    if (assigned > 0 && route.waiting < 24 * (assigned + 1)) continue;
    const priority = (assigned === 0 ? 10_000 : 0) + route.waiting / (assigned + 1);
    if (priority > best || (priority === best && selected && compareId(route.id, selected.id) < 0)) {
      selected = route;
      selectedType = aircraftType;
      best = priority;
    }
  }
  if (!selected || !selectedType) return null;
  // Avoid allocating scarce aircraft to empty, already-served routes.
  return {
    command: { type: 'AssignPlane', routeId: selected.id, aircraftType: selectedType },
    reason: 'Highest unserved or waiting passengers per assigned plane',
  };
}

function connectCity(snapshot: BotSnapshot): BotDecision | null {
  const cities = snapshot.cities.filter((city) => city.active);
  if (cities.length < 2) return null;
  const disconnected = cities.filter((city) => city.connectedRoutes === 0);
  if (!disconnected.length) return null;
  const connected = cities.filter((city) => city.connectedRoutes > 0);
  let best: { from: string; to: string; distance: number; hubPenalty: number; overload: number; backlog: number } | null = null;
  for (const city of disconnected) {
    const candidates = connected.length ? connected : cities.filter((other) => other.id !== city.id);
    for (const candidate of candidates) {
      if (city.id === candidate.id) continue;
      const distance = snapshot.distancesKm[city.id]?.[candidate.id];
      if (!Number.isFinite(distance) || distance <= 0 || distance > WIDEBODY_RANGE_KM) continue;
      if (!availableForDistance(snapshot, distance)) continue;
      const entry = {
        from: city.id,
        to: candidate.id,
        distance,
        hubPenalty: candidate.isHub ? 0 : 1,
        overload: pressure(candidate),
        backlog: pressure(city),
      };
      const better = !best
        || entry.hubPenalty < best.hubPenalty
        || (entry.hubPenalty === best.hubPenalty && entry.distance < best.distance)
        || (entry.hubPenalty === best.hubPenalty && entry.distance === best.distance && entry.overload < best.overload)
        || (entry.hubPenalty === best.hubPenalty && entry.distance === best.distance && entry.overload === best.overload && entry.backlog > best.backlog)
        || (entry.hubPenalty === best.hubPenalty && entry.distance === best.distance && entry.overload === best.overload && entry.backlog === best.backlog &&
          (compareId(entry.from, best.from) < 0 || (entry.from === best.from && compareId(entry.to, best.to) < 0)));
      if (better) best = entry;
    }
  }
  if (!best) return null;
  return {
    command: { type: 'AddRoute', from: best.from, to: best.to },
    reason: 'Connect an unserved city to the closest eligible hub',
  };
}

// [night-07w] No spare aircraft for a new route (e.g. after "+2 slots", which adds none): bring the city onto
// the nearest end of a route that already has aircraft, as a player drags a route end to it. The new leg must
// fit the shortest range among the route's aircraft (the Sim refuses it otherwise), and very long routes are
// left alone so the bot does not dilute one line's frequency across the whole map.
const MAX_EXTENDED_STOPS = 5;

function extendToCity(snapshot: BotSnapshot): BotDecision | null {
  const disconnected = snapshot.cities.filter((city) => city.active && city.connectedRoutes === 0);
  if (!disconnected.length) return null;
  let best: { routeId: string; end: 'start' | 'end'; cityId: string; distance: number } | null = null;
  for (const city of disconnected) {
    for (const route of snapshot.routes) {
      const planes = route.assigned.turboprop + route.assigned.widebody;
      if (!planes || route.stops.length < 2 || route.stops.length >= MAX_EXTENDED_STOPS) continue;
      const range = route.assigned.turboprop > 0 ? TURBOPROP_RANGE_KM : WIDEBODY_RANGE_KM;
      for (const end of ['start', 'end'] as const) {
        const terminal = end === 'start' ? route.stops[0] : route.stops[route.stops.length - 1];
        const distance = snapshot.distancesKm[terminal]?.[city.id];
        if (!Number.isFinite(distance) || distance <= 0 || distance > range) continue;
        const better = !best || distance < best.distance || (distance === best.distance &&
          (compareId(city.id, best.cityId) < 0 || (city.id === best.cityId && compareId(route.id, best.routeId) < 0)));
        if (better) best = { routeId: route.id, end, cityId: city.id, distance };
      }
    }
  }
  if (!best) return null;
  return {
    command: { type: 'ExtendRoute', routeId: best.routeId, end: best.end, cityId: best.cityId },
    reason: 'No spare aircraft: extend the nearest served route to an unserved city',
  };
}

function chooseUpgrade(snapshot: BotSnapshot): BotDecision | null {
  if (!snapshot.offers.length) return null;
  // Only interchange hubs can be expanded (task 12); rank them by pressure and overflow history.
  const activeCities = snapshot.cities.filter((city) => city.active && city.isHub);
  const ranked = activeCities.map((city) => ({
    city,
    impact: pressure(city) * 100 + snapshot.ledger
      .filter((entry) => entry.cityId === city.id && entry.kind === 'hubOverflow')
      .reduce((sum, entry) => sum + entry.count, 0),
  })).sort((a, b) => b.impact - a.impact || compareId(a.city.id, b.city.id));
  const worst = ranked[0];
  const loadByKind = (kind: LedgerCause['kind']): number => snapshot.ledger
    .filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.count, 0);
  const routeLoad = snapshot.routes.reduce((sum, route) => sum + route.waiting, 0);
  const hasLongRoute = snapshot.routes.some((route) => route.distanceKm > TURBOPROP_RANGE_KM);
  const rankedOffers = snapshot.offers.map((offer) => {
    let value = 0;
    if (offer.kind === 'hub') value = worst ? 30 + worst.impact + loadByKind('hubOverflow') : -Infinity;
    if (offer.kind === 'turboprop') value = 40 + routeLoad / 4 + loadByKind('longWait');
    if (offer.kind === 'widebody') value = 35 + (hasLongRoute ? 80 : 0) + routeLoad / 6 + loadByKind('range');
    if (offer.kind === 'slots') value = 20 + loadByKind('slots') * 2;
    return { offer, value };
  }).sort((a, b) => b.value - a.value || compareId(a.offer.id, b.offer.id));
  const choice = rankedOffers[0];
  if (!choice || !Number.isFinite(choice.value)) return null;
  return {
    command: {
      type: 'ChooseUpgrade', offerId: choice.offer.id,
      ...(choice.offer.kind === 'hub' && worst ? { cityId: worst.city.id } : {}),
      // [task-32] "+2 slots" targets the airport whose aircraft waited longest for a slot.
      ...(choice.offer.kind === 'slots' ? { cityId: slotTarget(snapshot) } : {}),
    },
    reason: 'Upgrade selected by congestion ledger and current network demand',
  };
}

// [task-32] Airport with the most slot-wait minutes, else the busiest hub, else the busiest city.
function slotTarget(snapshot: BotSnapshot): string | undefined {
  const waits = new Map<string, number>();
  for (const entry of snapshot.ledger) if (entry.kind === 'slots' && entry.cityId) waits.set(entry.cityId, (waits.get(entry.cityId) ?? 0) + entry.count);
  const cities = snapshot.cities.filter((city) => city.active)
    .sort((a, b) => (waits.get(b.id) ?? 0) - (waits.get(a.id) ?? 0) || Number(b.isHub) - Number(a.isHub) ||
      b.connectedRoutes - a.connectedRoutes || compareId(a.id, b.id));
  return cities[0]?.id;
}

/** Return at most one deterministic command; never mutate the snapshot. */
export function chooseBotAction(snapshot: BotSnapshot): BotDecision | null {
  if (snapshot.status === 'finished') return null;
  if (snapshot.status === 'upgrade') return chooseUpgrade(snapshot);
  const urgent = snapshot.cities.some((city) => city.warningTicksRemaining !== null);
  if (urgent) {
    const aircraft = chooseAircraft(snapshot);
    if (aircraft) return aircraft;
  }
  return connectCity(snapshot) ?? chooseAircraft(snapshot) ?? extendToCity(snapshot);
}

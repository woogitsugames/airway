import { MIN_AIRPORT_SERVICE_TICKS, PLANE_PROGRESS_SCALE, PLANE_TYPES } from './params.ts';
import type { PlaneFleet, PlaneState, ScheduledRoute } from './planes.ts';

/**
 * Passenger bridge used at every stop (task 09 <-> task 08). Counts are authoritative in the
 * passenger subsystem's per-plane manifests (src/sim/world.ts); this module only owns on-board
 * totals. The optional onward/next city selects the travel direction for routing decisions.
 */
export interface PlanePassengerPort {
  alightAt(cityId: string, routeId: string, onBoard: number, planeId: string, onwardCityId?: string): number;
  boardAt(cityId: string, routeId: string, freeSeats: number, planeId: string, nextCityId?: string): number;
}

/** Day/night gate (task 11). Departure checks the planned leg; landing is re-checked on arrival. */
export interface PlaneCurfewGate {
  canDepart(fromCityId: string, toCityId: string, durationTicks: number): boolean;
  canLand(cityId: string): boolean;
}

const EMPTY_PASSENGERS: PlanePassengerPort = {
  alightAt: () => 0,
  boardAt: () => 0,
};
const OPEN_SKIES: PlaneCurfewGate = {
  canDepart: () => true,
  canLand: () => true,
};

function transferCount(value: number, limit: number, action: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) {
    throw new RangeError(`${action} returned invalid passenger count ${value} (limit ${limit})`);
  }
  return value;
}

function advancePlane(
  plane: PlaneState, route: ScheduledRoute, passengers: PlanePassengerPort, gate: PlaneCurfewGate,
): void {
  if (plane.phase === 'ground') {
    if (plane.remainingServiceTicks > 0) plane.remainingServiceTicks--;
    if (plane.remainingServiceTicks > 0) return;

    const segment = plane.direction === 1 ? plane.cityIndex : plane.cityIndex - 1;
    const from = route.cityIds[plane.cityIndex];
    const to = route.cityIds[plane.cityIndex + plane.direction];
    // A closed departure or arrival airport keeps the aircraft (and its boarding) on the ground.
    if (!gate.canDepart(from, to, route.segments[segment].durationTicks[plane.type])) return;

    // Board only after the minimum service window, allowing eligible transfers.
    const seats = PLANE_TYPES[plane.type].seats;
    const boarded = transferCount(
      passengers.boardAt(from, route.id, seats - plane.load, plane.id, to),
      seats - plane.load, 'boardAt',
    );
    plane.load += boarded;
    plane.segment = segment;
    plane.elapsedFlightTicks = 0;
    plane.progress01 = 0;
    plane.phase = 'flight';
    return;
  }

  const duration = route.segments[plane.segment].durationTicks[plane.type];
  if (plane.elapsedFlightTicks < duration) plane.elapsedFlightTicks++;
  if (plane.elapsedFlightTicks < duration) {
    plane.progress01 = Math.floor(plane.elapsedFlightTicks * PLANE_PROGRESS_SCALE / duration);
    return;
  }

  const arrivalIndex = plane.cityIndex + plane.direction;
  const arrivalCity = route.cityIds[arrivalIndex];
  if (!gate.canLand(arrivalCity)) {
    // Holding pattern above a curfew airport; retry every minute.
    plane.progress01 = PLANE_PROGRESS_SCALE;
    return;
  }
  let direction = plane.direction;
  if (arrivalIndex === route.cityIds.length - 1) direction = -1;
  else if (arrivalIndex === 0) direction = 1;
  const alighted = transferCount(
    passengers.alightAt(arrivalCity, route.id, plane.load, plane.id, route.cityIds[arrivalIndex + direction]),
    plane.load, 'alightAt',
  );
  plane.load -= alighted;
  plane.cityIndex = arrivalIndex;
  plane.direction = direction;
  plane.segment = direction === 1 ? arrivalIndex : arrivalIndex - 1;
  plane.phase = 'ground';
  plane.elapsedFlightTicks = 0;
  plane.progress01 = 0;
  plane.remainingServiceTicks = MIN_AIRPORT_SERVICE_TICKS;
}

/**
 * One call = one fixed simulation minute. Call after applying queued commands.
 * Stable array order and no allocation per tick keep replays deterministic.
 */
export function tickPlaneSchedule(
  fleet: PlaneFleet, routes: readonly ScheduledRoute[],
  passengers: PlanePassengerPort = EMPTY_PASSENGERS, gate: PlaneCurfewGate = OPEN_SKIES,
): void {
  for (let i = 0; i < fleet.planes.length; i++) {
    const plane = fleet.planes[i];
    // Keep route lookup order deterministic; routes change only at command boundaries.
    let route: ScheduledRoute | undefined;
    for (let j = 0; j < routes.length; j++) {
      if (routes[j].id === plane.routeId) { route = routes[j]; break; }
    }
    if (!route) throw new Error(`Plane ${plane.id} lost route ${plane.routeId}`);
    advancePlane(plane, route, passengers, gate);
  }
}

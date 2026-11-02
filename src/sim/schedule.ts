import { MIN_AIRPORT_SERVICE_TICKS, PLANE_PROGRESS_SCALE, PLANE_TYPES } from './params';
import type { PlaneFleet, PlaneState, ScheduledRoute } from './planes';

/**
 * Thin task-08 passenger adapter. Counts are authoritative in task 08's hub/manifest
 * store; this module only owns on-board totals. The plane id permits per-plane manifests.
 * An alighted transfer must respect task 08's minimum connection time in boardAt().
 */
export interface PlanePassengerPort {
  alightAt(cityId: string, routeId: string, onBoard: number, planeId: string): number;
  boardAt(cityId: string, routeId: string, freeSeats: number, planeId: string): number;
}

const EMPTY_PASSENGERS: PlanePassengerPort = {
  alightAt: () => 0,
  boardAt: () => 0,
};

function transferCount(value: number, limit: number, action: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) {
    throw new RangeError(`${action} returned invalid passenger count ${value} (limit ${limit})`);
  }
  return value;
}

function advancePlane(
  plane: PlaneState, route: ScheduledRoute, passengers: PlanePassengerPort,
): void {
  if (plane.phase === 'ground') {
    if (plane.remainingServiceTicks > 0) plane.remainingServiceTicks--;
    if (plane.remainingServiceTicks > 0) return;

    // Board only after the minimum service window, allowing eligible transfers.
    const seats = PLANE_TYPES[plane.type].seats;
    const boarded = transferCount(
      passengers.boardAt(route.cityIds[plane.cityIndex], route.id, seats - plane.load, plane.id),
      seats - plane.load, 'boardAt',
    );
    plane.load += boarded;
    plane.segment = plane.direction === 1 ? plane.cityIndex : plane.cityIndex - 1;
    plane.elapsedFlightTicks = 0;
    plane.progress01 = 0;
    plane.phase = 'flight';
    return;
  }

  const duration = route.segments[plane.segment].durationTicks[plane.type];
  plane.elapsedFlightTicks++;
  if (plane.elapsedFlightTicks < duration) {
    plane.progress01 = Math.floor(plane.elapsedFlightTicks * PLANE_PROGRESS_SCALE / duration);
    return;
  }

  const arrivalIndex = plane.cityIndex + plane.direction;
  const alighted = transferCount(
    passengers.alightAt(route.cityIds[arrivalIndex], route.id, plane.load, plane.id),
    plane.load, 'alightAt',
  );
  plane.load -= alighted;
  plane.cityIndex = arrivalIndex;
  if (arrivalIndex === route.cityIds.length - 1) plane.direction = -1;
  else if (arrivalIndex === 0) plane.direction = 1;
  plane.segment = plane.direction === 1 ? arrivalIndex : arrivalIndex - 1;
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
  passengers: PlanePassengerPort = EMPTY_PASSENGERS,
): void {
  for (let i = 0; i < fleet.planes.length; i++) {
    const plane = fleet.planes[i];
    // Keep route lookup order deterministic; routes change only at command boundaries.
    let route: ScheduledRoute | undefined;
    for (let j = 0; j < routes.length; j++) {
      if (routes[j].id === plane.routeId) { route = routes[j]; break; }
    }
    if (!route) throw new Error(`Plane ${plane.id} lost route ${plane.routeId}`);
    advancePlane(plane, route, passengers);
  }
}

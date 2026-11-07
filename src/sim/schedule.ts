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

/**
 * [task-32] D-41 departure slots: a per-airport hourly departure allowance. `tryTake` consumes one
 * slot and returns true, or returns false when the airport has no slot left this game hour.
 */
export interface DepartureSlotGate {
  tryTake(cityId: string, plane: PlaneState): boolean;
  /** Called once per ready minute, even if a curfew blocks departure. */
  ready?(cityId: string, plane: PlaneState): void;
  /** Reset a slot-wait streak when curfew interrupts it. */
  curfewHeld?(plane: PlaneState): void;
  /** Called once per minute for every ready aircraft that is held for a slot. */
  held?(cityId: string, plane: PlaneState): void;
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
  slots: DepartureSlotGate | null,
): void {
  if (plane.phase === 'ground') {
    if (plane.remainingServiceTicks > 0) plane.remainingServiceTicks--;
    if (plane.remainingServiceTicks > 0) return;

    const segment = plane.direction === 1 ? plane.cityIndex : plane.cityIndex - 1;
    const from = route.cityIds[plane.cityIndex];
    const to = route.cityIds[plane.cityIndex + plane.direction];
    slots?.ready?.(from, plane);
    // A closed departure or arrival airport keeps the aircraft (and its boarding) on the ground.
    if (!gate.canDepart(from, to, route.segments[segment].durationTicks[plane.type])) {
      slots?.curfewHeld?.(plane);
      return;
    }
    // [task-32] No free departure slot this hour: keep waiting; passengers board only at departure.
    if (slots && !slots.tryTake(from, plane)) {
      plane.slotWaitTicks++;
      slots.held?.(from, plane);
      return;
    }
    plane.slotWaitTicks = 0;
    delete plane.weatherReadyTicks;
    delete plane.weatherWaitReported;
    delete plane.slotWaitReported;
    delete plane.weatherSlotWaitTicks;

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
  plane.slotWaitTicks = 0;
}

function findRoute(routes: readonly ScheduledRoute[], plane: PlaneState): ScheduledRoute {
  // Keep route lookup order deterministic; routes change only at command boundaries.
  for (let j = 0; j < routes.length; j++) if (routes[j].id === plane.routeId) return routes[j];
  throw new Error(`Plane ${plane.id} lost route ${plane.routeId}`);
}

// Reused scratch buffer: fleet indices already advanced this minute by the slot-priority pass.
const handled: boolean[] = [];

/**
 * One call = one fixed simulation minute. Call after applying queued commands.
 * Stable array order and no allocation per tick keep replays deterministic.
 */
export function tickPlaneSchedule(
  fleet: PlaneFleet, routes: readonly ScheduledRoute[],
  passengers: PlanePassengerPort = EMPTY_PASSENGERS, gate: PlaneCurfewGate = OPEN_SKIES,
  slots: DepartureSlotGate | null = null,
): void {
  const planes = fleet.planes;
  handled.length = planes.length;
  for (let i = 0; i < planes.length; i++) handled[i] = false;
  // [task-32] Slot priority: aircraft already held for a slot go first, longest wait first; equal
  // waits keep fleet order (= ascending plane serial). Aircraft that become ready this minute follow
  // in fleet order below, so the queue is "first ready, first out" and fully deterministic.
  if (slots) {
    for (;;) {
      let best = -1;
      for (let i = 0; i < planes.length; i++) {
        if (handled[i] || planes[i].slotWaitTicks === 0) continue;
        if (best === -1 || planes[i].slotWaitTicks > planes[best].slotWaitTicks) best = i;
      }
      if (best === -1) break;
      handled[best] = true;
      advancePlane(planes[best], findRoute(routes, planes[best]), passengers, gate, slots);
    }
  }
  for (let i = 0; i < planes.length; i++) {
    if (handled[i]) continue;
    advancePlane(planes[i], findRoute(routes, planes[i]), passengers, gate, slots);
  }
}

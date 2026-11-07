import {
  INITIAL_PLANE_RESERVE,
  MAX_ROUTE_SEGMENT_KM,
  MIN_AIRPORT_SERVICE_TICKS,
  PLANE_TYPES,
  type PlaneType,
} from './params.ts';

export type { PlaneType } from './params.ts';

/** Adapter for task 05's precomputed, integer city-to-city distance table. */
export type DistanceKm = (fromCityId: string, toCityId: string) => number | undefined;

export interface FlightSegment {
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly distanceKm: number;
  readonly durationTicks: Readonly<Record<PlaneType, number>>;
}

/** Segment times are frozen at route creation, never recalculated during flight. */
export interface ScheduledRoute {
  readonly id: string;
  readonly cityIds: readonly string[];
  readonly segments: readonly FlightSegment[];
}

export interface RangeExceeded {
  readonly ok: false;
  readonly reason: 'RANGE_EXCEEDED';
  readonly routeId: string;
  readonly segment: number;
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly distanceKm: number;
  readonly maxRangeKm: number;
  readonly planeType: PlaneType;
}

type PlaneErrorCode =
  | 'INVALID_PLANE_TYPE'
  | 'NO_SPARE_PLANE'
  | 'UNKNOWN_ROUTE'
  | 'UNKNOWN_PLANE'
  | 'PLANE_IN_FLIGHT'
  | 'PLANE_OCCUPIED';
export type PlaneError = RangeExceeded | { readonly ok: false; readonly reason: PlaneErrorCode };
export type PlaneResult<T> = { readonly ok: true; readonly value: T } | PlaneError;

/** Serializable authoritative state; renderer reads routeId/segment/progress01/load. */
export interface PlaneState {
  readonly id: string;
  readonly type: PlaneType;
  readonly routeId: string;
  /** Index of the edge (between cityIds[segment] and cityIds[segment + 1]). */
  segment: number;
  /** Progress in the travel direction, 0..PLANE_PROGRESS_SCALE. */
  progress01: number;
  load: number;
  direction: 1 | -1;
  /** Ground: the current city; flight: the departure city. */
  cityIndex: number;
  phase: 'ground' | 'flight';
  elapsedFlightTicks: number;
  remainingServiceTicks: number;
  /** [task-32] D-41: minutes this ready aircraft has waited on the ground for a departure slot. */
  slotWaitTicks: number;
  /** Weather runs only: elapsed ready minutes, including time blocked by curfew. */
  weatherReadyTicks?: number;
  /** Weather runs only: one report per cause for the current departure. */
  weatherWaitReported?: true;
  slotWaitReported?: true;
  /** Weather runs only: consecutive minutes actually blocked by the slot limit. */
  weatherSlotWaitTicks?: number;
  /** Weather runs only: actual slot-wait minutes by airport, across departures. */
  weatherSlotWaitTotals?: Record<string, number>;
}

export interface PlaneFleet {
  available: Record<PlaneType, number>;
  planes: PlaneState[];
  nextPlaneSerial: number;
}

export function isPlaneType(type: unknown): type is PlaneType {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(PLANE_TYPES, type);
}

function checkType(type: string): type is PlaneType {
  return Object.prototype.hasOwnProperty.call(PLANE_TYPES, type);
}

function checkCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('Plane reserve must be a non-negative safe integer');
  }
}

/** Task 12 can grant additional planes without needing to know fleet internals. */
export function createPlaneFleet(
  reserve: Readonly<Partial<Record<PlaneType, number>>> = INITIAL_PLANE_RESERVE,
): PlaneFleet {
  const turboprop = reserve.turboprop ?? 0;
  const widebody = reserve.widebody ?? 0;
  checkCount(turboprop);
  checkCount(widebody);
  return { available: { turboprop, widebody }, planes: [], nextPlaneSerial: 1 };
}

export function grantPlanes(fleet: PlaneFleet, type: PlaneType, count: number): void {
  if (!checkType(type)) throw new RangeError('Unknown plane type');
  checkCount(count);
  const total = fleet.available[type] + count;
  checkCount(total);
  fleet.available[type] = total;
}

/** Uses task 05 distance data; no geographic maths can enter the simulation. */
export function createScheduledRoute(
  id: string,
  cityIds: readonly string[],
  distanceKm: DistanceKm,
): ScheduledRoute {
  if (!id.trim() || cityIds.length < 2) {
    throw new RangeError('Route needs an id and at least two cities');
  }
  const segments: FlightSegment[] = [];
  for (let i = 0; i < cityIds.length - 1; i++) {
    const from = cityIds[i];
    const to = cityIds[i + 1];
    if (!from || !to || from === to) {
      throw new RangeError('Adjacent route cities must be distinct and non-empty');
    }
    const distance = distanceKm(from, to);
    if (distance === undefined || !Number.isSafeInteger(distance) || distance <= 0 || distance > MAX_ROUTE_SEGMENT_KM) {
      throw new RangeError(`Missing or invalid integer distance: ${from} -> ${to}`);
    }
    segments.push({
      fromCityId: from,
      toCityId: to,
      distanceKm: distance,
      durationTicks: {
        turboprop: Math.ceil(distance / PLANE_TYPES.turboprop.speedKmPerTick),
        widebody: Math.ceil(distance / PLANE_TYPES.widebody.speedKmPerTick),
      },
    });
  }
  return { id, cityIds: cityIds.slice(), segments };
}

/** UI can call this before AssignPlane and show the ATC flight strip. */
export function validatePlaneRange(route: ScheduledRoute, type: PlaneType):
  { readonly ok: true } | RangeExceeded {
  if (!checkType(type)) throw new RangeError('Unknown plane type');
  const range = PLANE_TYPES[type].rangeKm;
  for (let i = 0; i < route.segments.length; i++) {
    const edge = route.segments[i];
    if (edge.distanceKm > range) {
      return {
        ok: false, reason: 'RANGE_EXCEEDED', routeId: route.id, segment: i,
        fromCityId: edge.fromCityId, toCityId: edge.toCityId,
        distanceKm: edge.distanceKm, maxRangeKm: range, planeType: type,
      };
    }
  }
  return { ok: true };
}

/** Called by the kernel's command dispatcher (world.ts), at a simulation tick boundary. */
export function assignPlane(
  fleet: PlaneFleet, route: ScheduledRoute | undefined, type: PlaneType,
): PlaneResult<PlaneState> {
  if (!checkType(type)) return { ok: false, reason: 'INVALID_PLANE_TYPE' };
  if (!route) return { ok: false, reason: 'UNKNOWN_ROUTE' };
  const valid = validatePlaneRange(route, type);
  if (!valid.ok) return valid;
  if (fleet.available[type] === 0) return { ok: false, reason: 'NO_SPARE_PLANE' };
  const plane: PlaneState = {
    id: `plane-${fleet.nextPlaneSerial++}`,
    type, routeId: route.id, segment: 0, progress01: 0, load: 0,
    direction: 1, cityIndex: 0, phase: 'ground', elapsedFlightTicks: 0,
    remainingServiceTicks: MIN_AIRPORT_SERVICE_TICKS, slotWaitTicks: 0,
  };
  fleet.available[type]--;
  fleet.planes.push(plane);
  return { ok: true, value: plane };
}

/** Never delete an airborne or occupied aircraft: that would lose passengers. */
export function unassignPlane(fleet: PlaneFleet, planeId: string): PlaneResult<PlaneState> {
  const index = fleet.planes.findIndex((plane) => plane.id === planeId);
  if (index === -1) return { ok: false, reason: 'UNKNOWN_PLANE' };
  const plane = fleet.planes[index];
  if (plane.phase === 'flight') return { ok: false, reason: 'PLANE_IN_FLIGHT' };
  if (plane.load > 0) return { ok: false, reason: 'PLANE_OCCUPIED' };
  fleet.planes.splice(index, 1);
  fleet.available[plane.type]++;
  return { ok: true, value: plane };
}

/** Used by task 08 RemoveRoute validation: never orphan assigned aircraft. */
export function routeHasAssignedPlanes(fleet: PlaneFleet, routeId: string): boolean {
  return fleet.planes.some((plane) => plane.routeId === routeId);
}

/**
 * Re-time a route after ExtendRoute/ShortenRoute. `shift` is the index offset of the old stops in
 * the new list (+n when n stops were prepended, -1 when the first stop was removed). Aircraft keep
 * their position and direction; the caller guarantees no aircraft sits on a removed stop or leg.
 */
export function reshapeScheduledRoute(
  fleet: PlaneFleet, previous: ScheduledRoute, cityIds: readonly string[], shift: number,
  distanceKm: DistanceKm,
): ScheduledRoute {
  const next = createScheduledRoute(previous.id, cityIds, distanceKm);
  for (const plane of fleet.planes) {
    if (plane.routeId !== previous.id) continue;
    plane.cityIndex += shift;
    plane.segment += shift;
    // A former terminus that is now an intermediate stop keeps the current heading.
    if (plane.phase === 'ground') {
      if (plane.cityIndex === cityIds.length - 1) plane.direction = -1;
      else if (plane.cityIndex === 0) plane.direction = 1;
      plane.segment = plane.direction === 1 ? plane.cityIndex : plane.cityIndex - 1;
    }
    if (plane.cityIndex < 0 || plane.cityIndex >= cityIds.length ||
        plane.segment < 0 || plane.segment >= next.segments.length) {
      throw new RangeError(`Aircraft ${plane.id} would leave route ${previous.id}`);
    }
  }
  return next;
}

/** Stops an aircraft currently occupies: its ground city, or both ends of the leg it flies. */
export function planeTouchesStop(plane: PlaneState, stopIndex: number): boolean {
  if (plane.phase === 'ground') return plane.cityIndex === stopIndex;
  return plane.cityIndex === stopIndex || plane.cityIndex + plane.direction === stopIndex;
}

import { isSimSpeed, type SimSpeed } from './clock.ts';
import type { PlaneType } from './params.ts';
import type { UpgradeKind } from './upgrades.ts';

export type RouteEnd = 'start' | 'end';

/**
 * Every player action is one of these serializable commands. `Sim.apply()` queues it; the next
 * `tick()` validates it against the world and executes or rejects it (a rejection is journaled too,
 * so replays stay identical). City IDs are `src/data/cities.ts` codes; distances and flight times are
 * looked up by the simulation itself, never supplied by the caller.
 */
export type Command =
  /** New route over 2+ distinct active cities. `aircraft` also assigns one spare plane of that type. */
  | { readonly type: 'AddRoute'; readonly cityIds: readonly string[]; readonly aircraft?: PlaneType }
  /** `cityIds` is the FULL resulting stop list (route-tool format); the old route must be its prefix/suffix. */
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly end: RouteEnd; readonly cityIds: readonly string[] }
  /** Drop one terminal stop; refused while an aircraft is at, or flying to/from, that stop. */
  | { readonly type: 'ShortenRoute'; readonly routeId: string; readonly end: RouteEnd }
  /** Refused while any assigned aircraft is airborne or loaded; idle aircraft return to the reserve. */
  | { readonly type: 'RemoveRoute'; readonly routeId: string }
  | { readonly type: 'AssignPlane'; readonly routeId: string; readonly aircraft: PlaneType }
  | { readonly type: 'UnassignPlane'; readonly planeId: string }
  /** Spends one stocked hub upgrade (puzzles); weekly upgrades use ChooseUpgrade. */
  | { readonly type: 'UpgradeHub'; readonly hubId: string }
  /** Task 12 offer choice; `hubId` completes a 'hub-expansion' choice (may arrive in a second command). */
  | { readonly type: 'ChooseUpgrade'; readonly week: number; readonly upgrade: UpgradeKind; readonly hubId?: string }
  | { readonly type: 'SetSpeed'; readonly speed: SimSpeed };

/** The command journal uses the [executionTick, command] replay format. */
export type CommandEntry = readonly [tick: number, command: Command];

export type CommandType = Command['type'];
const TYPES: readonly CommandType[] = [
  'AddRoute', 'ExtendRoute', 'ShortenRoute', 'RemoveRoute', 'AssignPlane', 'UnassignPlane',
  'UpgradeHub', 'ChooseUpgrade', 'SetSpeed',
];
const PLANES: readonly string[] = ['turboprop', 'widebody'];
const UPGRADES: readonly string[] = ['turboprop', 'widebody', 'hub-expansion', 'departure-slots'];
const MAX_ROUTE_STOPS = 64;

export function isCommandType(value: unknown): value is CommandType {
  return typeof value === 'string' && (TYPES as readonly string[]).includes(value);
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('command must be an object');
  return value as Record<string, unknown>;
}
function id(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    throw new TypeError(`command field ${field} must be a nonempty string`);
  }
  return value;
}
function ids(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_ROUTE_STOPS) {
    throw new TypeError(`command field ${field} must list 2-${MAX_ROUTE_STOPS} cities`);
  }
  return value.map((item, index) => id(item, `${field}[${index}]`));
}
function end(value: unknown): RouteEnd {
  if (value !== 'start' && value !== 'end') throw new TypeError('route end must be start or end');
  return value;
}
function plane(value: unknown): PlaneType {
  if (typeof value !== 'string' || !PLANES.includes(value)) throw new TypeError('unknown aircraft type');
  return value as PlaneType;
}

/**
 * Structural validation and normalisation: returns a fresh, canonical command with only the known
 * fields (extra UI fields such as the route tool's `legDistancesKm` are dropped). Throws TypeError.
 */
export function normalizeCommand(value: unknown): Command {
  const input = record(value);
  switch (input.type) {
    case 'AddRoute': return input.aircraft === undefined
      ? { type: 'AddRoute', cityIds: ids(input.cityIds, 'cityIds') }
      : { type: 'AddRoute', cityIds: ids(input.cityIds, 'cityIds'), aircraft: plane(input.aircraft) };
    case 'ExtendRoute': return {
      type: 'ExtendRoute', routeId: id(input.routeId, 'routeId'), end: end(input.end),
      cityIds: ids(input.cityIds, 'cityIds'),
    };
    case 'ShortenRoute': return { type: 'ShortenRoute', routeId: id(input.routeId, 'routeId'), end: end(input.end) };
    case 'RemoveRoute': return { type: 'RemoveRoute', routeId: id(input.routeId, 'routeId') };
    case 'AssignPlane': return { type: 'AssignPlane', routeId: id(input.routeId, 'routeId'), aircraft: plane(input.aircraft) };
    case 'UnassignPlane': return { type: 'UnassignPlane', planeId: id(input.planeId, 'planeId') };
    case 'UpgradeHub': return { type: 'UpgradeHub', hubId: id(input.hubId, 'hubId') };
    case 'ChooseUpgrade': {
      if (!Number.isSafeInteger(input.week) || (input.week as number) < 1) throw new TypeError('invalid upgrade week');
      if (typeof input.upgrade !== 'string' || !UPGRADES.includes(input.upgrade)) throw new TypeError('unknown upgrade');
      const base = { type: 'ChooseUpgrade' as const, week: input.week as number, upgrade: input.upgrade as UpgradeKind };
      return input.hubId === undefined ? base : { ...base, hubId: id(input.hubId, 'hubId') };
    }
    case 'SetSpeed':
      if (!isSimSpeed(input.speed)) throw new RangeError('invalid SetSpeed value');
      return { type: 'SetSpeed', speed: input.speed };
    default: throw new TypeError('unknown command type');
  }
}

/** Why the world refused a command (stable codes for i18n keys in the UI). */
export type RejectReason =
  | 'GAME_OVER' | 'UPGRADE_PENDING' | 'NO_UPGRADE_PENDING' | 'UPGRADE_INVALID'
  | 'UNKNOWN_CITY' | 'CITY_NOT_ACTIVE' | 'DUPLICATE_CITY' | 'RANGE_EXCEEDED'
  | 'UNKNOWN_ROUTE' | 'ROUTE_MISMATCH' | 'ROUTE_TOO_SHORT'
  | 'PLANE_AT_STOP' | 'PLANE_IN_FLIGHT' | 'PLANE_OCCUPIED' | 'UNKNOWN_PLANE'
  | 'NO_SPARE_PLANE' | 'INVALID_PLANE_TYPE'
  | 'NOT_A_HUB' | 'NO_HUB_UPGRADE';

export type CommandCheck = { readonly ok: true } | { readonly ok: false; readonly reason: RejectReason };

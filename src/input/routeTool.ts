/** Finger-route editor. Adapter boundaries keep camera, renderer and sim independent. */
export type AircraftType = 'turboprop' | 'widebody';
export type RouteEnd = 'start' | 'end';
export interface GeoPoint { readonly lon: number; readonly lat: number }
export interface ProjectedCity extends GeoPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}
export interface NetworkRoute {
  readonly id: string;
  readonly cityIds: readonly string[];
  readonly aircraft: AircraftType;
}
export interface AircraftSpec { readonly type: AircraftType; readonly rangeKm: number }
export interface RoutePreviewModel {
  readonly points: readonly GeoPoint[];
  readonly legDistancesKm: readonly number[];
  readonly rangeKm: number;
  readonly aircraft: AircraftType;
}
export interface RangeWarning {
  readonly from: string;
  readonly to: string;
  readonly distanceKm: number;
  readonly rangeKm: number;
  readonly aircraft: AircraftType;
}
export interface RouteMenuRequest { readonly routeId: string; readonly end: RouteEnd; readonly x: number; readonly y: number; readonly canShorten: boolean }

// [task-07] Map these serializable intents to the authoritative sim schema in src/game.
export type RouteToolCommand =
  | { readonly type: 'AddRoute'; readonly cityIds: readonly string[]; readonly aircraft: AircraftType; readonly legDistancesKm: readonly number[] }
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly end: RouteEnd; readonly cityIds: readonly string[]; readonly aircraft: AircraftType; readonly legDistancesKm: readonly number[] }
  | { readonly type: 'RemoveRoute'; readonly routeId: string }
  | { readonly type: 'ShortenRoute'; readonly routeId: string; readonly end: RouteEnd }
  | { readonly type: 'SetSpeed'; readonly speed: number };
export interface RouteToolPorts {
  cities(): readonly ProjectedCity[];
  routes(): readonly NetworkRoute[];
  selectedAircraft(): AircraftType;
  aircraft(type: AircraftType): AircraftSpec;
  /** Deterministic integer table supplied by src/data; never measure sim distances on screen. */
  distanceKm(a: string, b: string): number;
  /** Optional screen-to-globe hit from task 04, for a free-pointer arc. */
  cursorGeo?(x: number, y: number): GeoPoint | null;
  speed(): number;
  dispatch(command: RouteToolCommand): boolean;
  /** Undo the last network mutation; transient SetSpeed intents are not network undo steps. */
  undo(): void;
  preview(model: RoutePreviewModel | null): void;
  warning(info: RangeWarning | null): void;
  /** Hit-test from the network renderer, independent of the camera gesture recognizer. */
  routeAt?(x: number, y: number): string | null;
  menu?(request: RouteMenuRequest | null): void;
  handles?(handles: readonly RouteHandle[]): void;
  haptics?: { snap(): void; confirm(): void };
}

export const CITY_START_RADIUS_DP = 28;
export const CITY_SNAP_RADIUS_DP = 36;
export const ENDPOINT_TARGET_DP = 48;
export const ENDPOINT_OFFSET_DP = 20;
const EARTH_RADIUS_KM = 6371;

export interface RouteHandle { readonly routeId: string; readonly end: RouteEnd; readonly cityId: string; readonly x: number; readonly y: number }

/** Closest visible airport; deterministic ID tie-break for overlapping hit targets. */
export function nearestCity(cities: readonly ProjectedCity[], x: number, y: number, radiusDp: number): ProjectedCity | null {
  let nearest: ProjectedCity | null = null;
  let distance = radiusDp * radiusDp;
  for (const city of cities) {
    if (!city.visible || !Number.isFinite(city.x) || !Number.isFinite(city.y)) continue;
    const dx = x - city.x;
    const dy = y - city.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < distance || (d2 === distance && (nearest === null || city.id < nearest.id))) {
      distance = d2;
      nearest = city;
    }
  }
  return nearest;
}

export function routeHandles(routes: readonly NetworkRoute[], cities: readonly ProjectedCity[]): RouteHandle[] {
  const byId = new Map(cities.filter((c) => c.visible).map((c) => [c.id, c]));
  const handles: RouteHandle[] = [];
  for (const route of routes) {
    if (route.cityIds.length < 2) continue;
    for (const end of ['start', 'end'] as const) {
      const at = end === 'start' ? 0 : route.cityIds.length - 1;
      const adjacent = end === 'start' ? 1 : at - 1;
      const city = byId.get(route.cityIds[at]);
      const neighbour = byId.get(route.cityIds[adjacent]);
      if (!city || !neighbour) continue;
      const dx = city.x - neighbour.x;
      const dy = city.y - neighbour.y;
      const length = Math.hypot(dx, dy);
      const ux = length > 0 ? dx / length : 0;
      const uy = length > 0 ? dy / length : -1;
      handles.push({ routeId: route.id, end, cityId: city.id,
        x: city.x + ux * ENDPOINT_OFFSET_DP, y: city.y + uy * ENDPOINT_OFFSET_DP });
    }
  }
  return handles;
}

/** Fallback segment hit test until the projected 3D route renderer in task 10 exists. */
export function hitTestRouteSegments(routes: readonly NetworkRoute[], cities: readonly ProjectedCity[], x: number, y: number, radiusDp = 16): string | null {
  const byId = new Map(cities.filter((city) => city.visible).map((city) => [city.id, city]));
  let closest: string | null = null;
  let best = radiusDp * radiusDp;
  for (const route of routes) {
    for (let i = 1; i < route.cityIds.length; i++) {
      const a = byId.get(route.cityIds[i - 1]);
      const b = byId.get(route.cityIds[i]);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const denom = dx * dx + dy * dy;
      const t = denom === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / denom));
      const d2 = (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2;
      if (d2 < best) { best = d2; closest = route.id; }
    }
  }
  return closest;
}

/** Input-only distance for an uncommitted pointer; sim uses the integer data table. */
export function pointerDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const r = Math.PI / 180;
  const latA = a.lat * r;
  const latB = b.lat * r;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))));
}

interface Edit {
  pointerId: number;
  ids: string[];
  route: NetworkRoute | null;
  end: RouteEnd;
  aircraft: AircraftSpec;
  previousSpeed: number;
  hoverId: string | null;
}

export class RouteTool {
  private active: Edit | null = null;
  private context: RouteMenuRequest | null = null;
  constructor(private readonly ports: RouteToolPorts) {}

  get drawing(): boolean { return this.active !== null; }

  /** Call after a camera projection or network snapshot changes to redraw handle overlays. */
  refreshHandles(): void {
    this.ports.handles?.(routeHandles(this.ports.routes(), this.ports.cities()));
  }

  /** Return false to let task-04 gestures rotate/zoom the globe instead. */
  pointerDown(pointerId: number, x: number, y: number): boolean {
    if (this.active !== null) return false;
    const cities = this.ports.cities();
    const handles = routeHandles(this.ports.routes(), cities);
    let chosen: RouteHandle | null = null;
    let best = (ENDPOINT_TARGET_DP / 2) ** 2;
    for (const handle of handles) {
      const d2 = (x - handle.x) ** 2 + (y - handle.y) ** 2;
      if (d2 < best) { best = d2; chosen = handle; }
    }
    // The city centre remains available for a *new* route despite overlapping 48dp handles.
    if (nearestCity(cities, x, y, 8)) chosen = null;
    const city = chosen ? cities.find((item) => item.id === chosen.cityId) ?? null :
      nearestCity(cities, x, y, CITY_START_RADIUS_DP);
    if (!city) return false;
    const route = chosen ? this.ports.routes().find((item) => item.id === chosen.routeId) ?? null : null;
    if (chosen && !route) return false;
    const type = route?.aircraft ?? this.ports.selectedAircraft();
    const aircraft = this.ports.aircraft(type);
    if (!(Number.isInteger(aircraft.rangeKm) && aircraft.rangeKm > 0)) return false;
    this.closeMenu();
    const previousSpeed = this.ports.speed();
    if (!this.ports.dispatch({ type: 'SetSpeed', speed: previousSpeed === 0 ? 0 : 0.25 })) return false;
    this.active = { pointerId, ids: [city.id], route, end: chosen?.end ?? 'end', aircraft, previousSpeed, hoverId: city.id };
    this.ports.haptics?.snap();
    this.ports.warning(null);
    this.renderPreview(city);
    return true;
  }

  pointerMove(pointerId: number, x: number, y: number): void {
    const edit = this.active;
    if (!edit || edit.pointerId !== pointerId) return;
    const city = nearestCity(this.ports.cities(), x, y, CITY_SNAP_RADIUS_DP);
    if (city?.id !== edit.hoverId) {
      if (city) this.ports.haptics?.snap();
      edit.hoverId = city?.id ?? null;
    }
    if (city && city.id !== edit.ids[edit.ids.length - 1]) {
      if (edit.ids.length > 1 && city.id === edit.ids[edit.ids.length - 2]) {
        edit.ids.pop(); // Backtracking removes the last stop.
      } else {
        const occupied = edit.route?.cityIds ?? [];
        const nextDistance = this.safeDistance(edit.ids[edit.ids.length - 1], city.id);
        const lastDistance = edit.ids.length > 1 ? this.safeDistance(edit.ids[edit.ids.length - 2], edit.ids[edit.ids.length - 1]) : 0;
        // Replace an invalid endpoint, so a stopover can be inserted after a failed attempt.
        if (edit.ids.length > 1 && lastDistance !== null && lastDistance > edit.aircraft.rangeKm && !edit.ids.includes(city.id) && !occupied.includes(city.id)) {
          edit.ids[edit.ids.length - 1] = city.id;
        } else if (!edit.ids.includes(city.id) && !occupied.includes(city.id) && nextDistance !== null) {
          edit.ids.push(city.id);
        }
      }
    }
    this.renderPreview(city ?? this.ports.cursorGeo?.(x, y) ?? null);
  }

  pointerUp(pointerId: number, x: number, y: number): boolean {
    const edit = this.active;
    if (!edit || edit.pointerId !== pointerId) return false;
    this.pointerMove(pointerId, x, y);
    const releasedAt = nearestCity(this.ports.cities(), x, y, CITY_SNAP_RADIUS_DP);
    let accepted = false;
    if (releasedAt && releasedAt.id === edit.ids[edit.ids.length - 1] && edit.ids.length > 1) {
      const newIds = edit.ids;
      const original = edit.route?.cityIds ?? [];
      const fullIds = edit.route ? (edit.end === 'end' ? [...original, ...newIds.slice(1)] :
        [...newIds.slice(1).reverse(), ...original]) : [...newIds];
      const distances = this.distances(fullIds);
      if (distances && distances.every((km) => km <= edit.aircraft.rangeKm)) {
        const command: RouteToolCommand = edit.route ? {
          type: 'ExtendRoute', routeId: edit.route.id, end: edit.end, aircraft: edit.aircraft.type,
          cityIds: fullIds, legDistancesKm: distances,
        } : { type: 'AddRoute', aircraft: edit.aircraft.type, cityIds: fullIds, legDistancesKm: distances };
        accepted = this.ports.dispatch(command);
        if (accepted) this.ports.haptics?.confirm();
      }
    }
    this.finish(accepted);
    return accepted;
  }

  pointerCancel(pointerId: number): void {
    if (this.active?.pointerId === pointerId) this.finish(false);
  }

  /** Task-04 invokes this for a 350ms long press outside an active edit. */
  longPress(x: number, y: number): boolean {
    if (this.active) return false;
    const routeId = this.ports.routeAt ? this.ports.routeAt(x, y) :
      hitTestRouteSegments(this.ports.routes(), this.ports.cities(), x, y);
    const route = this.ports.routes().find((item) => item.id === routeId);
    if (!route || route.cityIds.length < 2) return false;
    const cities = this.ports.cities();
    const first = cities.find((city) => city.id === route.cityIds[0]);
    const last = cities.find((city) => city.id === route.cityIds[route.cityIds.length - 1]);
    const startDist = first ? (x - first.x) ** 2 + (y - first.y) ** 2 : Infinity;
    const endDist = last ? (x - last.x) ** 2 + (y - last.y) ** 2 : Infinity;
    this.context = { routeId: route.id, x, y, end: startDist < endDist ? 'start' : 'end', canShorten: route.cityIds.length > 2 };
    this.ports.menu?.(this.context);
    return true;
  }

  removeRoute(): boolean {
    const request = this.context;
    this.closeMenu();
    const accepted = request ? this.ports.dispatch({ type: 'RemoveRoute', routeId: request.routeId }) : false;
    if (accepted) this.refreshHandles();
    return accepted;
  }

  shortenRoute(): boolean {
    const request = this.context;
    this.closeMenu();
    const accepted = request?.canShorten ? this.ports.dispatch({ type: 'ShortenRoute', routeId: request.routeId, end: request.end }) : false;
    if (accepted) this.refreshHandles();
    return accepted;
  }

  closeMenu(): void {
    if (this.context) { this.context = null; this.ports.menu?.(null); }
  }

  undo(): void {
    if (this.active) this.finish(false);
    this.closeMenu();
    this.ports.undo(); // Composition root wires this directly to sim.undo().
  }

  private safeDistance(a: string, b: string): number | null {
    const value = this.ports.distanceKm(a, b);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  private distances(ids: readonly string[]): number[] | null {
    const result: number[] = [];
    for (let i = 1; i < ids.length; i++) {
      const km = this.safeDistance(ids[i - 1], ids[i]);
      if (km === null) return null;
      result.push(km);
    }
    return result;
  }

  private renderPreview(cursor: GeoPoint | null): void {
    const edit = this.active;
    if (!edit) return;
    const visible = new Map(this.ports.cities().map((city) => [city.id, city]));
    const points: GeoPoint[] = [];
    const distances: number[] = [];
    for (const id of edit.ids) {
      const item = visible.get(id);
      if (!item) { this.ports.preview(null); return; }
      points.push({ lon: item.lon, lat: item.lat });
    }
    const committed = this.distances(edit.ids);
    if (!committed) { this.ports.preview(null); return; }
    distances.push(...committed);
    if (cursor && edit.hoverId === null) {
      const last = points[points.length - 1];
      if (last && Number.isFinite(cursor.lon) && Number.isFinite(cursor.lat)) {
        points.push(cursor);
        distances.push(pointerDistanceKm(last, cursor));
      }
    }
    this.ports.preview({ points, legDistancesKm: distances, aircraft: edit.aircraft.type, rangeKm: edit.aircraft.rangeKm });
    const firstInvalid = distances.findIndex((km) => km > edit.aircraft.rangeKm);
    if (firstInvalid >= 0 && firstInvalid + 1 < edit.ids.length) {
      this.ports.warning({ from: edit.ids[firstInvalid], to: edit.ids[firstInvalid + 1],
        distanceKm: distances[firstInvalid], rangeKm: edit.aircraft.rangeKm, aircraft: edit.aircraft.type });
    } else if (firstInvalid >= 0 && cursor && edit.hoverId === null) {
      this.ports.warning({ from: edit.ids[edit.ids.length - 1], to: '…',
        distanceKm: distances[firstInvalid], rangeKm: edit.aircraft.rangeKm, aircraft: edit.aircraft.type });
    } else this.ports.warning(null);
  }

  private finish(accepted: boolean): void {
    const edit = this.active;
    if (!edit) return;
    this.active = null;
    this.ports.preview(null);
    if (accepted) this.ports.warning(null);
    this.ports.dispatch({ type: 'SetSpeed', speed: edit.previousSpeed });
    if (accepted) this.refreshHandles();
  }
}

/** Standalone pointer bridge until task 04 supplies its gesture arbitration callbacks. */
export function bindRoutePointerEvents(target: HTMLElement, tool: RouteTool): () => void {
  let owned: number | null = null;
  const down = (event: PointerEvent): void => {
    if (owned !== null || !event.isPrimary || event.button !== 0) return;
    const rect = target.getBoundingClientRect();
    if (!tool.pointerDown(event.pointerId, event.clientX - rect.left, event.clientY - rect.top)) return;
    owned = event.pointerId;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const move = (event: PointerEvent): void => {
    if (owned !== event.pointerId) return;
    const rect = target.getBoundingClientRect();
    tool.pointerMove(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
    event.preventDefault();
    event.stopPropagation();
  };
  const end = (event: PointerEvent): void => {
    if (owned !== event.pointerId) return;
    const rect = target.getBoundingClientRect();
    tool.pointerUp(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
    owned = null;
    event.preventDefault();
    event.stopPropagation();
  };
  const cancel = (event: PointerEvent): void => {
    if (owned !== event.pointerId) return;
    tool.pointerCancel(event.pointerId);
    owned = null;
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('lostpointercapture', cancel);
  return () => {
    if (owned !== null) tool.pointerCancel(owned);
    for (const [type, listener] of [['pointerdown', down], ['pointermove', move], ['pointerup', end],
      ['pointercancel', cancel], ['lostpointercapture', cancel]] as const) target.removeEventListener(type, listener);
  };
}

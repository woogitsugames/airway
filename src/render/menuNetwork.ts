/**
 * [task-34] Decorative network behind the menu (mockup `menu-p.png`: routes, hubs and planes above the
 * departures board). Visual only: no simulation, no scores, never shown during a run. Planes ping-pong
 * along the routes on a private 10 Hz clock, using the same snapshot interpolation as the game.
 */
import type { AircraftKind } from './routes';
import type { PlaneRenderSnapshot } from './planes';

interface MenuNetworkTarget {
  setCities(cities: readonly { id: string; lon: number; lat: number; hub?: boolean }[]): void;
  setRoutes(routes: readonly { id: string; aircraft: AircraftKind; cityIds: readonly string[] }[], revision?: number | string): void;
  setHubLoad(loads: readonly { id: string; used: number; cap: number }[]): void;
  setPlanes(previous: readonly PlaneRenderSnapshot[], current: readonly PlaneRenderSnapshot[]): void;
  setCurfew(closedIds: readonly string[]): void;
  setRoutePreview(model: null): void;
}

export interface MenuNetwork {
  start(): void;
  stop(): void;
  /** Advance the demo planes; returns the interpolation alpha while active, else `null`. */
  frame(dtSeconds: number): number | null;
}

const HUBS = new Set(['LON', 'MAD']);
const ROUTES: readonly { id: string; aircraft: AircraftKind; cityIds: readonly string[] }[] = [
  { id: 'menu-1', aircraft: 'widebody', cityIds: ['NYC', 'LON'] },
  { id: 'menu-2', aircraft: 'widebody', cityIds: ['MAD', 'DKR'] },
  { id: 'menu-3', aircraft: 'turboprop', cityIds: ['LIS', 'MAD', 'PAR', 'LON'] },
  { id: 'menu-4', aircraft: 'turboprop', cityIds: ['DUB', 'LON', 'OSL'] },
  { id: 'menu-5', aircraft: 'turboprop', cityIds: ['CMN', 'MAD'] },
];
const SCALE = 10_000;
const STEP_PER_TICK = 28;
const TICK_SECONDS = 0.1;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function createMenuNetwork(
  target: MenuNetworkTarget, lookup: (code: string) => { lon: number; lat: number } | null,
): MenuNetwork {
  const codes = [...new Set(ROUTES.flatMap((route) => route.cityIds))];
  const cities = codes.flatMap((id) => {
    const city = lookup(id);
    return city ? [{ id, lon: city.lon, lat: city.lat, hub: HUBS.has(id) }] : [];
  });
  const known = new Set(cities.map((city) => city.id));
  const routes = ROUTES.filter((route) => route.cityIds.every((id) => known.has(id)));
  const legs = routes.flatMap((route) => route.cityIds.slice(1).map((_, segment) => ({ route, segment })));
  const make = (): Mutable<PlaneRenderSnapshot>[] => legs.map(({ route, segment }, i) => ({
    id: 'menu-plane-' + i, routeId: route.id, segment, progress01: 0, direction: 1,
    type: route.aircraft, load: 12 + (i * 7) % 30, capacity: route.aircraft === 'widebody' ? 48 : 24,
  }));
  let previous = make();
  let current = make();
  let tick = 0;
  let accumulator = 0;
  let active = false;
  const place = (list: Mutable<PlaneRenderSnapshot>[], at: number): void => {
    for (let i = 0; i < list.length; i++) {
      // Ping-pong 0 → 1 → 0 so a plane never jumps between the two ends of its leg.
      const raw = (at * STEP_PER_TICK + i * 3_517) % (2 * SCALE);
      const forward = raw < SCALE;
      list[i].progress01 = forward ? raw : raw - SCALE; // direction -1 measures from the far end
      list[i].direction = forward ? 1 : -1;
    }
  };
  return {
    start() {
      if (active) return;
      active = true;
      target.setRoutePreview(null);
      target.setCurfew([]);
      target.setCities(cities);
      target.setRoutes(routes, 'menu');
      target.setHubLoad([{ id: 'LON', used: 30, cap: 36 }, { id: 'MAD', used: 15, cap: 24 }]);
      place(previous, tick);
      place(current, tick + 1);
      target.setPlanes(previous, current);
    },
    stop() {
      if (!active) return;
      active = false;
      target.setPlanes([], []);
      target.setRoutes([], 'menu-off');
      target.setHubLoad([]);
      target.setCities([]);
    },
    frame(dtSeconds) {
      if (!active) return null;
      accumulator += Math.max(0, Math.min(0.25, dtSeconds));
      while (accumulator >= TICK_SECONDS) {
        accumulator -= TICK_SECONDS;
        tick++;
        const swap = previous;
        previous = current;
        current = swap;
        place(current, tick + 1);
        target.setPlanes(previous, current);
      }
      return accumulator / TICK_SECONDS;
    },
  };
}

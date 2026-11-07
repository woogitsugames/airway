// [night-11ag] R4d: hub cause board. A read-only rolling view (the last game hour) of what happened at each airport,
// derived in the game layer from the run's read model after every simulated stretch: departures (a plane seen in
// flight on a new leg since the last look, with the seats it left with) and aircraft held for a departure slot. One row
// per destination region waiting there, with one cause mark in the game-over wording. Presentation only: it reads the
// run, never writes it, and nothing goes into the sim or its hash (D-13). The Sim emits no departure event, so the
// departures come from comparing two plane read models, like the trend readings in fillTrend.ts compare two hours.
import { REGION_IDS, type RegionId } from '../data/regions';
import { RouteRouter } from '../sim/routing';
import { GAME_TICKS_PER_HOUR } from '../sim/params';
import { HUB_FULL_SHARE } from './tutorial/first-time';
import { cityDistanceKm, type RunCity, type RunPlane, type RunRoute } from './run';
import type { TranslationKey } from '../i18n';

/** One cause per row, strongest first: no onward flight, curfew, last departure left full, waiting for a slot. */
export type HubBoardCause = 'no-route' | 'curfew' | 'left-full' | 'slot' | 'none';

export interface HubBoardRow {
  readonly region: RegionId;
  readonly waiting: number;
  readonly cause: HubBoardCause;
  /** 'slot': aircraft-minutes held on the ground for a slot on this row's leg in the last game hour. */
  readonly minutes: number;
}

export interface HubBoardModel {
  readonly cityId: string;
  readonly waiting: number;
  readonly capacity: number;
  readonly jammed: boolean;
  readonly rows: readonly HubBoardRow[];
}

/** The rolling window, in game minutes (one simulation tick is one game minute). */
export const BOARD_WINDOW_MINUTES = GAME_TICKS_PER_HOUR;

/**
 * The sentence behind each mark: the game-over cause strings where one exists (same wording, same plural rules),
 * and two board-only lines for the night curfew and a row with nothing recorded against it.
 */
export const HUB_BOARD_CAUSE_KEYS = {
  'no-route': 'gameover.cause.noRoute',
  curfew: 'hubBoard.cause.curfew',
  'left-full': 'gameover.cause.seatShortage',
  slot: 'gameover.cause.slotWait',
  none: 'hubBoard.cause.none',
} as const satisfies Record<HubBoardCause, TranslationKey>;

/** A tap opens the board from this share of the waiting places taken; a long press opens it at any fill. */
export function boardOpensOnTap(waiting: number, capacity: number): boolean {
  return capacity > 0 && waiting >= capacity * HUB_FULL_SHARE;
}

/** What the board reads from the run (EndlessRun satisfies it). */
export interface HubBoardRun {
  readonly clockMinute: number;
  cityList(): readonly RunCity[];
  routeList(): readonly RunRoute[];
  planeList(): readonly RunPlane[];
}

interface Departure { readonly minute: number; readonly cityId: string; readonly routeId: string; readonly next: string; readonly full: boolean }
interface SlotSample { readonly minute: number; readonly cityId: string; readonly routeId: string; readonly minutes: number }

function planeKey(plane: RunPlane): string {
  return `${plane.routeId}|${plane.phase}|${plane.cityIndex}|${plane.direction}`;
}

export class HubDepartureLog {
  private minute = -1;
  private planes = new Map<string, string>();
  private slotTotals = new Map<string, Readonly<Record<string, number>>>();
  private departures: Departure[] = [];
  private slots: SlotSample[] = [];

  /** Forget everything (a new run, or the clock went back by an undo or a restore). */
  reset(): void {
    this.minute = -1;
    this.planes.clear();
    this.slotTotals.clear();
    this.departures = [];
    this.slots = [];
  }

  /** Look at the run after a simulated stretch; cheap, called once per synced frame. */
  observe(run: HubBoardRun): void {
    const now = run.clockMinute;
    if (now < this.minute) this.reset();
    const elapsed = this.minute < 0 ? 0 : Math.min(now - this.minute, BOARD_WINDOW_MINUTES);
    const routes = new Map(run.routeList().map((route) => [route.id, route.cityIds]));
    const seen = new Map<string, string>();
    const seenTotals = new Map<string, Readonly<Record<string, number>>>();
    for (const plane of run.planeList()) {
      if (plane.phase === undefined || plane.cityIndex === undefined) continue;
      const key = planeKey(plane);
      seen.set(plane.id, key);
      const stops = routes.get(plane.routeId);
      if (!stops) continue;
      const at = stops[plane.cityIndex];
      if (!at) continue;
      const before = this.planes.get(plane.id);
      if (plane.phase === 'flight' && before !== undefined && before !== key) {
        const next = stops[plane.cityIndex + plane.direction];
        if (next) this.departures.push({ minute: now, cityId: at, routeId: plane.routeId, next, full: plane.load >= plane.capacity });
      }
      if (plane.slotWaitTotals !== undefined) {
        const previous = this.slotTotals.get(plane.id);
        for (const [cityId, total] of Object.entries(plane.slotWaitTotals)) {
          // A newly seen plane has no earlier counters in this log. On its first observation the elapsed time is zero;
          // if it appeared between later observations, its counter began within this interval.
          const delta = Math.min(elapsed, Math.max(0, total - (previous?.[cityId] ?? 0)));
          if (delta > 0) this.slots.push({ minute: now, cityId, routeId: plane.routeId, minutes: delta });
        }
        seenTotals.set(plane.id, { ...plane.slotWaitTotals });
      } else if (plane.phase === 'ground' && (plane.slotWaitTicks ?? 0) > 0 && elapsed > 0) {
        this.slots.push({ minute: now, cityId: at, routeId: plane.routeId, minutes: Math.min(elapsed, plane.slotWaitTicks ?? 0) });
      }
    }
    this.planes = seen;
    this.slotTotals = seenTotals;
    this.minute = now;
    const since = now - BOARD_WINDOW_MINUTES;
    if (this.departures.length && this.departures[0].minute <= since) this.departures = this.departures.filter((item) => item.minute > since);
    if (this.slots.length && this.slots[0].minute <= since) this.slots = this.slots.filter((item) => item.minute > since);
  }

  /** The board for one airport, or null when the run does not list it. */
  board(run: HubBoardRun, cityId: string): HubBoardModel | null {
    const cities = run.cityList();
    const city = cities.find((item) => item.id === cityId);
    if (!city) return null;
    const counts = new Map<RegionId, number>();
    for (const region of city.waiting) counts.set(region, (counts.get(region) ?? 0) + 1);
    // The first leg the sim itself would pick for a new passenger (same router, same distance table).
    const router = counts.size ? routerFor(cities, run.routeList()) : null;
    const since = run.clockMinute - BOARD_WINDOW_MINUTES;
    const rows: HubBoardRow[] = [];
    for (const region of REGION_IDS) {
      const waiting = counts.get(region) ?? 0;
      if (!waiting) continue;
      const leg = router?.nextLeg(cityId, region) ?? null;
      let cause: HubBoardCause = 'none';
      let minutes = 0;
      if (!leg) cause = 'no-route';
      else if (city.curfewClosed) cause = 'curfew';
      else {
        let last: Departure | undefined;
        for (const item of this.departures) {
          if (item.minute > since && item.cityId === cityId && item.routeId === leg.routeId && item.next === leg.nextCityId) last = item;
        }
        for (const item of this.slots) if (item.minute > since && item.cityId === cityId && item.routeId === leg.routeId) minutes += item.minutes;
        if (last?.full) cause = 'left-full';
        else if (minutes > 0) cause = 'slot';
      }
      rows.push({ region, waiting, cause, minutes: cause === 'slot' ? minutes : 0 });
    }
    rows.sort((a, b) => b.waiting - a.waiting || REGION_IDS.indexOf(a.region) - REGION_IDS.indexOf(b.region));
    return { cityId, waiting: city.waiting.length, capacity: city.capacity, jammed: city.jamTicksLeft !== null, rows };
  }
}

function routerFor(cities: readonly RunCity[], routes: readonly RunRoute[]): RouteRouter {
  const known = new Set(cities.map((city) => city.id));
  const router = new RouteRouter(cities.map((city) => ({ cityId: city.id, regionId: city.region })),
    (a, b) => Math.max(0, cityDistanceKm(a, b)));
  router.rebuild(routes.filter((route) => route.cityIds.every((id) => known.has(id)))
    .map((route) => ({ id: route.id, cities: route.cityIds })), 0);
  return router;
}

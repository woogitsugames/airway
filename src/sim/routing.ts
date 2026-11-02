// [task-08] Cached lexicographic 0/1-transfer shortest paths over ordered flight routes.
import type { AirlineRoute } from './network.ts';

export interface RoutingCity { readonly cityId: string; readonly regionId: string }
/** Integer great-circle distance provided by task 05's generated distance table. */
export type DistanceLookup = (fromCityId: string, toCityId: string) => number;

export interface RouteLeg {
  readonly routeId: string;
  readonly nextCityId: string;
  readonly destinationCityId: string;
  readonly transfers: number;
  readonly distanceKm: number;
}

interface Edge { readonly to: string; readonly routeId: string; readonly km: number }
interface SearchNode {
  readonly cityId: string;
  readonly routeId: string;
  readonly firstRouteId: string;
  readonly firstNextCityId: string;
  readonly transfers: number;
  readonly km: number;
}

function compareString(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function compare(a: SearchNode, b: SearchNode): number {
  return a.transfers - b.transfers || a.km - b.km ||
    compareString(a.firstRouteId, b.firstRouteId) ||
    compareString(a.firstNextCityId, b.firstNextCityId) ||
    compareString(a.cityId, b.cityId) || compareString(a.routeId, b.routeId);
}

export class RouteRouter {
  private readonly cityById = new Map<string, RoutingCity>();
  private readonly distanceKm: DistanceLookup;
  private readonly edges = new Map<string, Edge[]>();
  private readonly cache = new Map<string, RouteLeg | null>();
  private revisionValue = -1;
  private searchesValue = 0;

  constructor(cities: readonly RoutingCity[], distanceKm: DistanceLookup) {
    for (const city of cities) {
      if (this.cityById.has(city.cityId)) throw new Error('Duplicate routing city');
      this.cityById.set(city.cityId, city);
      this.edges.set(city.cityId, []);
    }
    this.distanceKm = distanceKm;
  }

  get revision(): number { return this.revisionValue; }
  /** Diagnostics: repeated queries cannot run a new search until the network changes. */
  get searches(): number { return this.searchesValue; }

  rebuild(routes: readonly AirlineRoute[], revision: number): void {
    if (revision === this.revisionValue) return;
    for (const edges of this.edges.values()) edges.length = 0;
    for (const route of [...routes].sort((a, b) => compareString(a.id, b.id))) {
      for (let i = 1; i < route.cities.length; i++) {
        const from = route.cities[i - 1], to = route.cities[i];
        if (!this.edges.has(from) || !this.edges.has(to)) throw new Error('Route references an unknown city');
        const km = this.distanceKm(from, to);
        if (!Number.isSafeInteger(km) || km < 0) throw new Error(`Missing integer distance: ${from} - ${to}`);
        this.edges.get(from)!.push({ to, routeId: route.id, km });
        this.edges.get(to)!.push({ to: from, routeId: route.id, km });
      }
    }
    for (const edges of this.edges.values()) {
      edges.sort((a, b) => compareString(a.routeId, b.routeId) || compareString(a.to, b.to));
    }
    this.revisionValue = revision;
    this.cache.clear();
  }

  /** A passenger stores the region only; resolve the next flight again at every hub. */
  nextLeg(cityId: string, targetRegion: string, arrivedOnRoute?: string): RouteLeg | null {
    if (!this.cityById.has(cityId)) throw new Error(`Unknown city: ${cityId}`);
    const key = `${cityId}\0${targetRegion}\0${arrivedOnRoute ?? ''}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    this.searchesValue++;
    const best = new Map<string, SearchNode>();
    const pending: SearchNode[] = [];
    const add = (node: SearchNode): void => {
      const k = `${node.cityId}\0${node.routeId}`;
      const old = best.get(k);
      if (!old || compare(node, old) < 0) { best.set(k, node); pending.push(node); }
    };
    for (const edge of this.edges.get(cityId)!) {
      add({ cityId: edge.to, routeId: edge.routeId,
        firstRouteId: edge.routeId, firstNextCityId: edge.to,
        transfers: arrivedOnRoute && arrivedOnRoute !== edge.routeId ? 1 : 0, km: edge.km });
    }
    let winner: SearchNode | null = null;
    while (pending.length) {
      // Small city counts; scan the frontier for stable lexicographic order, avoiding a heap dependency.
      let n = 0;
      for (let i = 1; i < pending.length; i++) if (compare(pending[i], pending[n]) < 0) n = i;
      const current = pending[n];
      pending.splice(n, 1);
      if (best.get(`${current.cityId}\0${current.routeId}`) !== current) continue;
      if (winner && compare(current, winner) > 0) break;
      if (current.cityId !== cityId && this.cityById.get(current.cityId)!.regionId === targetRegion) {
        if (!winner || compare(current, winner) < 0) winner = current;
        continue;
      }
      for (const edge of this.edges.get(current.cityId)!) {
        // A change of route costs one transfer; intermediate stops on the same route cost zero.
        add({ cityId: edge.to, routeId: edge.routeId,
          firstRouteId: current.firstRouteId, firstNextCityId: current.firstNextCityId,
          transfers: current.transfers + (current.routeId === edge.routeId ? 0 : 1),
          km: current.km + edge.km });
      }
    }
    const leg: RouteLeg | null = winner ? {
      routeId: winner.firstRouteId, nextCityId: winner.firstNextCityId,
      destinationCityId: winner.cityId, transfers: winner.transfers, distanceKm: winner.km,
    } : null;
    this.cache.set(key, leg);
    return leg;
  }
}

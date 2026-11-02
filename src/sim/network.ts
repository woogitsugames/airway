// [task-08] Pure, serializable route graph. A route is an ordered sequence of cities.
export interface AirlineRoute {
  readonly id: string;
  readonly cities: readonly string[];
}

export type RouteCommand =
  | { readonly type: 'AddRoute'; readonly routeId: string; readonly cities: readonly string[] }
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly cityId: string; readonly end?: 'start' | 'end' }
  | { readonly type: 'RemoveRoute'; readonly routeId: string };

export interface NetworkSnapshot {
  readonly routes: AirlineRoute[];
  readonly revision: number;
}

function validId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0');
}

export class RouteNetwork {
  private readonly knownCities: Set<string>;
  private readonly routesById = new Map<string, AirlineRoute>();
  private revisionValue = 0;

  constructor(cityIds: readonly string[]) {
    this.knownCities = new Set(cityIds);
    if (this.knownCities.size !== cityIds.length || cityIds.some((id) => !validId(id))) {
      throw new Error('City IDs must be unique, nonempty strings');
    }
  }

  get revision(): number { return this.revisionValue; }

  get routes(): readonly AirlineRoute[] {
    return Array.from(this.routesById.values(), (route) => ({ id: route.id, cities: [...route.cities] }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  getRoute(id: string): AirlineRoute | undefined {
    const route = this.routesById.get(id);
    return route ? { id: route.id, cities: [...route.cities] } : undefined;
  }

  hasSegment(routeId: string, from: string, to: string): boolean {
    const route = this.routesById.get(routeId);
    if (!route) return false;
    for (let i = 1; i < route.cities.length; i++) {
      const a = route.cities[i - 1], b = route.cities[i];
      if ((a === from && b === to) || (a === to && b === from)) return true;
    }
    return false;
  }

  routesAt(cityId: string): number {
    let count = 0;
    for (const route of this.routesById.values()) if (route.cities.includes(cityId)) count++;
    return count;
  }

  apply(command: RouteCommand): void {
    switch (command.type) {
      case 'AddRoute': this.addRoute(command.routeId, command.cities); break;
      case 'ExtendRoute': this.extendRoute(command.routeId, command.cityId, command.end ?? 'end'); break;
      case 'RemoveRoute': this.removeRoute(command.routeId); break;
    }
  }

  addRoute(id: string, cities: readonly string[]): void {
    if (!validId(id) || this.routesById.has(id)) throw new Error(`Invalid or duplicate route: ${id}`);
    if (!Array.isArray(cities) || cities.length < 2 || new Set(cities).size !== cities.length ||
        cities.some((city) => !this.knownCities.has(city))) {
      throw new Error('A route needs at least two distinct known cities, without loops');
    }
    this.routesById.set(id, { id, cities: [...cities] });
    this.revisionValue++;
  }

  extendRoute(id: string, cityId: string, end: 'start' | 'end' = 'end'): void {
    const previous = this.routesById.get(id);
    if (!previous || !this.knownCities.has(cityId) || previous.cities.includes(cityId) ||
        (end !== 'start' && end !== 'end')) throw new Error('Invalid route extension');
    const cities = end === 'start' ? [cityId, ...previous.cities] : [...previous.cities, cityId];
    this.routesById.set(id, { id, cities });
    this.revisionValue++;
  }

  removeRoute(id: string): void {
    if (!this.routesById.delete(id)) throw new Error(`Unknown route: ${id}`);
    this.revisionValue++;
  }

  snapshot(): NetworkSnapshot { return { routes: [...this.routes], revision: this.revisionValue }; }

  restore(saved: NetworkSnapshot): void {
    if (!saved || !Array.isArray(saved.routes) || !Number.isSafeInteger(saved.revision) || saved.revision < 0) {
      throw new Error('Invalid network snapshot');
    }
    this.routesById.clear();
    this.revisionValue = 0;
    for (const route of saved.routes) this.addRoute(route.id, route.cities);
    this.revisionValue = saved.revision;
  }
}

// Passenger subsystem (task 08): demand, route network, routing, terminal queues and the cause
// ledger. It is owned by the authoritative kernel (src/sim/sim.ts via world.ts), which feeds route
// commands at tick boundaries; aircraft (task 09) call boardAt/alightAt at their stops.
// It can also run standalone with step() for focused passenger tests.
import { RegionalDemand, type DemandCity, type DemandRandom, type DemandSnapshot } from './demand.ts';
import { TerminalQueues, type HubFailure, type HubsSnapshot, type WaitingPassenger } from './hubs.ts';
import { CauseLedger, type CauseLedgerSnapshot } from './ledger.ts';
import { RouteNetwork, type NetworkSnapshot, type RouteCommand } from './network.ts';
import { RouteRouter, type DistanceLookup } from './routing.ts';
import { PASSENGER_SIM_VERSION } from './params.ts';

export interface PassengerTicket {
  readonly id: number;
  readonly destinationRegion: string;
  readonly createdTick: number;
}
export interface AlightResult {
  readonly delivered: readonly number[];
  readonly transferred: readonly number[];
  readonly stayingOnboard: readonly number[];
  /** [night-12ab] How many of `delivered` changed planes on the way (alighted at a hub before). */
  readonly deliveredAfterTransfer: number;
}
/** Task 09 integration point; optional next-stop arguments select the correct travel direction. */
export interface PassengerTransport {
  boardAt(cityId: string, routeId: string, seats: number, nextCityId?: string): PassengerTicket[];
  alightAt(cityId: string, routeId: string, passengerIds: readonly number[], onwardCityId?: string): AlightResult;
}
interface InFlight { passenger: WaitingPassenger; routeId: string }
export interface PassengerSimulationSnapshot {
  readonly version: typeof PASSENGER_SIM_VERSION;
  readonly tick: number;
  readonly nextPassengerId: number;
  readonly activeCityIds: readonly string[];
  readonly network: NetworkSnapshot;
  readonly demand: DemandSnapshot;
  readonly hubs: HubsSnapshot;
  readonly ledger: CauseLedgerSnapshot;
  readonly inFlight: { readonly passenger: WaitingPassenger; readonly routeId: string }[];
  readonly failure: HubFailure | null;
}

export class PassengerSimulation implements PassengerTransport {
  readonly network: RouteNetwork;
  readonly router: RouteRouter;
  readonly hubs: TerminalQueues;
  readonly ledger = new CauseLedger();
  private readonly demand: RegionalDemand;
  private readonly citiesById = new Map<string, DemandCity>();
  private readonly activeCityIds = new Set<string>();
  private readonly inFlight = new Map<number, InFlight>();
  private nextPassengerId = 1;
  private currentTick = 0;
  private currentFailure: HubFailure | null = null;
  /**
   * [night-12ba] R2k: when true, every new passenger carries `originRegion` (Endless runs with the weekly contract
   * only; otherwise the field is never written, so other snapshots and hashes are unchanged).
   */
  trackOrigins = false;
  /** [night-12ba] R2k: called for every delivered passenger (origin region when tracked, destination region). */
  onDelivered: ((originRegion: string | undefined, destinationRegion: string) => void) | null = null;

  constructor(cities: readonly DemandCity[], distanceKm: DistanceLookup, demandRng: DemandRandom,
      initiallyActive?: readonly string[], baseCapacity?: Readonly<Record<string, number>>) {
    for (const city of cities) {
      if (!city.cityId || !city.regionId || this.citiesById.has(city.cityId)) {
        throw new Error('Duplicate or invalid passenger city');
      }
      this.citiesById.set(city.cityId, city);
    }
    const ids = initiallyActive ?? cities.map((city) => city.cityId);
    if (new Set(ids).size !== ids.length || ids.some((id) => !this.citiesById.has(id))) {
      throw new Error('Invalid active city IDs');
    }
    for (const id of ids) this.activeCityIds.add(id);
    this.network = new RouteNetwork(cities.map((city) => city.cityId));
    this.router = new RouteRouter(cities, distanceKm);
    this.hubs = new TerminalQueues(cities.map((city) => city.cityId), baseCapacity);
    this.demand = new RegionalDemand(cities, distanceKm, demandRng, ids);
    this.router.rebuild(this.network.routes, this.network.revision);
  }

  get tick(): number { return this.currentTick; }
  get score(): number { return this.ledger.totals.delivered; }
  get failed(): boolean { return this.currentFailure !== null; }
  get failure(): HubFailure | null { return this.currentFailure ? { ...this.currentFailure,
    waitingByRegion: { ...this.currentFailure.waitingByRegion } } : null; }
  get airborneCount(): number { return this.inFlight.size; }

  isActive(cityId: string): boolean { return this.activeCityIds.has(cityId); }
  regionOf(cityId: string): string | undefined { return this.citiesById.get(cityId)?.regionId; }

  /** Reveal a city when task 05's spawner fires. Data for all possible cities is preloaded. */
  activateCity(cityId: string): void {
    if (this.failed || !this.citiesById.has(cityId)) throw new Error('Unknown or unavailable city');
    if (this.activeCityIds.has(cityId)) return;
    this.activeCityIds.add(cityId);
    this.demand.setActiveCities([...this.activeCityIds]);
  }

  /** The kernel invokes this only at authoritative tick boundaries, after validation. */
  apply(command: RouteCommand): void {
    if (this.failed) throw new Error('Cannot edit a finished run');
    if (command.type === 'AddRoute' && command.cities.some((id) => !this.activeCityIds.has(id))) {
      throw new Error('Route references a city not yet revealed');
    }
    if (command.type === 'ExtendRoute' && !this.activeCityIds.has(command.cityId)) {
      throw new Error('Cannot extend to a city not yet revealed');
    }
    this.network.apply(command);
    this.router.rebuild(this.network.routes, this.network.revision);
    this.hubs.syncNetwork(this.network);
    // A network edit permits passengers previously stranded to be re-evaluated.
    for (const city of this.hubs.all()) for (const passenger of city.waiting) {
      if (this.router.nextLeg(city.cityId, passenger.destinationRegion, passenger.arrivedOnRoute)) {
        passenger.noRouteNoted = false;
      }
    }
  }

  upgradeHub(cityId: string, extraCapacity?: number, transferTicks?: number): void {
    if (this.failed) throw new Error('Cannot edit a finished run');
    this.hubs.upgrade(cityId, extraCapacity, transferTicks);
  }

  /** Also usable for fixed passenger scenarios in puzzle mode and seeded tests. */
  seedPassenger(cityId: string, destinationRegion: string): number {
    if (this.failed || !this.activeCityIds.has(cityId) ||
        ![...this.citiesById.values()].some((city) => city.regionId === destinationRegion)) {
      throw new Error('Invalid scripted passenger');
    }
    const id = this.nextPassengerId++;
    if (!Number.isSafeInteger(id)) throw new Error('Passenger ID overflow');
    const passenger: WaitingPassenger = {
      id, destinationRegion, createdTick: this.currentTick, readyAtTick: this.currentTick,
      longWaitNoted: false, noRouteNoted: false,
    };
    if (this.trackOrigins) passenger.originRegion = this.citiesById.get(cityId)!.regionId;
    this.hubs.enqueue(cityId, passenger, this.ledger);
    return id;
  }

  /** [night-12ba] R2k: expected passengers from one region to another over `days` days (read-only). */
  expectedPassengers(fromRegion: string, toRegion: string, days: number): number {
    return this.demand.expectedPassengers(fromRegion, toRegion, days);
  }

  /** [night-12bb] R2i, D-249: one extra surge passenger from `cityId` (after beginMinute); false when none was created. */
  surgePassenger(cityId: string, rng: DemandRandom): boolean {
    if (this.currentFailure) return false;
    return this.demand.surgePassenger(cityId, rng, (generated) => {
      this.seedPassenger(generated.originCityId, generated.destinationRegion);
    });
  }

  /** Phase 1 of a world minute: set the clock and generate demand. Returns passengers created. */
  beginMinute(tick: number, generateDemand = true): number {
    if (!Number.isSafeInteger(tick) || tick < this.currentTick) throw new Error('Passenger clock must not run backwards');
    this.currentTick = tick;
    if (this.currentFailure || !generateDemand) return 0;
    let created = 0;
    this.demand.tick(this.currentTick, (generated) => {
      this.seedPassenger(generated.originCityId, generated.destinationRegion);
      created++;
    });
    return created;
  }

  /** Phase 3 (after aircraft moved): waiting notes, congestion countdown and failure. */
  endMinute(): HubFailure | null {
    if (this.currentFailure) return this.failure;
    this.currentFailure = this.hubs.tick(this.currentTick, this.router, this.ledger);
    return this.failure;
  }

  /** Standalone minute without aircraft (tests and teleport fixtures). */
  step(): HubFailure | null {
    if (this.currentFailure) return this.failure;
    this.beginMinute(this.currentTick + 1);
    return this.endMinute();
  }

  boardAt(cityId: string, routeId: string, seats: number, nextCityId?: string): PassengerTicket[] {
    if (this.failed) return [];
    if (!Number.isSafeInteger(seats) || seats < 0) throw new Error('Invalid aircraft seat count');
    if (!this.network.getRoute(routeId) || (nextCityId !== undefined && !this.network.hasSegment(routeId, cityId, nextCityId))) {
      throw new Error('Aircraft must board at a connected stop on its route');
    }
    const queue = this.hubs.city(cityId);
    const boarded: PassengerTicket[] = [];
    for (let i = 0; i < queue.waiting.length && boarded.length < seats;) {
      const passenger = queue.waiting[i];
      if (passenger.readyAtTick > this.currentTick) { i++; continue; }
      const leg = this.router.nextLeg(cityId, passenger.destinationRegion, passenger.arrivedOnRoute);
      if (!leg || leg.routeId !== routeId || (nextCityId !== undefined && leg.nextCityId !== nextCityId)) {
        i++;
        continue;
      }
      this.hubs.remove(cityId, i, this.ledger);
      this.inFlight.set(passenger.id, { passenger, routeId });
      boarded.push({ id: passenger.id, destinationRegion: passenger.destinationRegion,
        createdTick: passenger.createdTick });
    }
    return boarded;
  }

  alightAt(cityId: string, routeId: string, passengerIds: readonly number[], onwardCityId?: string): AlightResult {
    if (this.failed) throw new Error('Cannot alight in a finished run');
    if (!this.citiesById.has(cityId)) throw new Error('Unknown arrival city');
    const delivered: number[] = [], transferred: number[] = [], stayingOnboard: number[] = [];
    let deliveredAfterTransfer = 0;
    const seen = new Set<number>();
    // Validate the whole manifest before making any mutation (no partial unload).
    for (const id of passengerIds) {
      if (seen.has(id) || this.inFlight.get(id)?.routeId !== routeId) throw new Error('Invalid aircraft manifest');
      seen.add(id);
    }
    if (onwardCityId !== undefined && !this.network.hasSegment(routeId, cityId, onwardCityId)) {
      throw new Error('Invalid aircraft onward segment');
    }
    for (const id of passengerIds) {
      const flight = this.inFlight.get(id)!;
      const passenger = flight.passenger;
      if (this.citiesById.get(cityId)!.regionId === passenger.destinationRegion) {
        this.inFlight.delete(id);
        this.ledger.record('delivered', cityId, passenger.destinationRegion);
        this.onDelivered?.(passenger.originRegion, passenger.destinationRegion);
        delivered.push(id);
        if (passenger.arrivedOnRoute !== undefined) deliveredAfterTransfer++;
        continue;
      }
      const leg = this.router.nextLeg(cityId, passenger.destinationRegion, routeId);
      if (onwardCityId && leg && leg.routeId === routeId && leg.nextCityId === onwardCityId) {
        stayingOnboard.push(id);
        continue;
      }
      this.inFlight.delete(id);
      passenger.arrivedOnRoute = routeId;
      passenger.readyAtTick = this.currentTick + this.hubs.city(cityId).transferTicks;
      passenger.noRouteNoted = false;
      this.hubs.enqueue(cityId, passenger, this.ledger);
      transferred.push(id);
    }
    return { delivered, transferred, stayingOnboard, deliveredAfterTransfer };
  }

  /** Conservation: all passengers are delivered, queued, or carried; no other states. */
  passengerBalance(): { created: number; waiting: number; airborne: number; delivered: number } {
    return { created: this.nextPassengerId - 1, waiting: this.ledger.totals.waiting,
      airborne: this.inFlight.size, delivered: this.ledger.totals.delivered };
  }

  snapshot(): PassengerSimulationSnapshot {
    return { version: PASSENGER_SIM_VERSION, tick: this.currentTick, nextPassengerId: this.nextPassengerId,
      activeCityIds: [...this.activeCityIds].sort(),
      network: this.network.snapshot(), demand: this.demand.snapshot(), hubs: this.hubs.snapshot(),
      ledger: this.ledger.snapshot(), inFlight: [...this.inFlight.values()]
        .sort((a, b) => a.passenger.id - b.passenger.id)
        .map((item) => ({ passenger: { ...item.passenger }, routeId: item.routeId })),
      failure: this.failure };
  }

  restore(saved: PassengerSimulationSnapshot): void {
    if (!saved || saved.version !== PASSENGER_SIM_VERSION ||
        !Number.isSafeInteger(saved.tick) || saved.tick < 0 ||
        !Number.isSafeInteger(saved.nextPassengerId) || saved.nextPassengerId < 1 ||
        !Array.isArray(saved.inFlight) || !Array.isArray(saved.activeCityIds) ||
        new Set(saved.activeCityIds).size !== saved.activeCityIds.length ||
        saved.activeCityIds.some((id) => !this.citiesById.has(id))) {
      throw new Error('Incompatible passenger simulation snapshot');
    }
    this.activeCityIds.clear();
    for (const id of saved.activeCityIds) this.activeCityIds.add(id);
    this.demand.setActiveCities([...this.activeCityIds]);
    this.network.restore(saved.network);
    this.router.rebuild(this.network.routes, this.network.revision);
    this.demand.restore(saved.demand);
    this.hubs.restore(saved.hubs);
    this.ledger.restore(saved.ledger);
    this.inFlight.clear();
    for (const flight of saved.inFlight) {
      if (this.inFlight.has(flight.passenger.id)) throw new Error('Duplicate airborne passenger');
      this.inFlight.set(flight.passenger.id, { passenger: { ...flight.passenger }, routeId: flight.routeId });
    }
    this.nextPassengerId = saved.nextPassengerId;
    this.currentTick = saved.tick;
    this.currentFailure = saved.failure ? { ...saved.failure, waitingByRegion: { ...saved.failure.waitingByRegion } } : null;
    const balance = this.passengerBalance();
    if (balance.created !== balance.waiting + balance.airborne + balance.delivered) {
      throw new Error('Passenger conservation failed on restore');
    }
  }

  /** Stable FNV-1a fingerprint of the complete serializable state (including the demand RNG). */
  hash(): string {
    const serialized = JSON.stringify(this.snapshot());
    let h = 0x811c9dc5;
    for (let i = 0; i < serialized.length; i++) {
      h ^= serialized.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

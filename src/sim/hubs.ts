// [task-08] Terminal queues, minimum connection time, congestion countdown and failure.
import {
  CITY_WAITING_CAPACITY, HUB_WAITING_CAPACITY, HUB_CAPACITY_UPGRADE,
  CONGESTION_GRACE_TICKS, WAIT_TOO_LONG_TICKS,
} from './params.js';
import type { CauseLedger } from './ledger.js';
import type { RouteNetwork } from './network.js';
import type { RouteRouter } from './routing.js';

export interface WaitingPassenger {
  id: number;
  destinationRegion: string;
  createdTick: number;
  readyAtTick: number;
  arrivedOnRoute?: string;
  longWaitNoted: boolean;
  noRouteNoted: boolean;
}
export interface CityQueue {
  cityId: string;
  waiting: WaitingPassenger[];
  capacity: number;
  isHub: boolean;
  upgradeLevels: number;
  fullTicks: number;
  fullNoted: boolean;
}
export interface HubFailure {
  readonly tick: number;
  readonly cityId: string;
  readonly capacity: number;
  readonly waiting: number;
  readonly waitingByRegion: Record<string, number>;
  readonly leadingRegion: string | null;
  readonly leadingRegionPercent: number;
}
export interface HubsSnapshot { readonly cities: CityQueue[] }

export class TerminalQueues {
  private readonly queues = new Map<string, CityQueue>();

  constructor(cityIds: readonly string[]) {
    for (const cityId of cityIds) {
      this.queues.set(cityId, { cityId, waiting: [], capacity: CITY_WAITING_CAPACITY,
        isHub: false, upgradeLevels: 0, fullTicks: 0, fullNoted: false });
    }
  }

  city(id: string): CityQueue {
    const result = this.queues.get(id);
    if (!result) throw new Error(`Unknown terminal: ${id}`);
    return result;
  }

  all(): IterableIterator<CityQueue> { return this.queues.values(); }

  syncNetwork(network: RouteNetwork): void {
    for (const queue of this.queues.values()) {
      queue.isHub = network.routesAt(queue.cityId) >= 2;
      queue.capacity = (queue.isHub ? HUB_WAITING_CAPACITY : CITY_WAITING_CAPACITY) +
        queue.upgradeLevels * HUB_CAPACITY_UPGRADE;
    }
  }

  upgrade(cityId: string): void {
    const queue = this.city(cityId);
    if (!queue.isHub) throw new Error('Only an interchange hub can be upgraded');
    queue.upgradeLevels++;
    queue.capacity += HUB_CAPACITY_UPGRADE;
    queue.fullTicks = 0;
    queue.fullNoted = false;
  }

  enqueue(cityId: string, passenger: WaitingPassenger, ledger: CauseLedger): void {
    const queue = this.city(cityId);
    queue.waiting.push(passenger);
    ledger.adjustWaiting(cityId, passenger.destinationRegion, 1);
  }

  remove(cityId: string, index: number, ledger: CauseLedger): WaitingPassenger {
    const passenger = this.city(cityId).waiting.splice(index, 1)[0];
    if (!passenger) throw new Error('Missing passenger in terminal queue');
    ledger.adjustWaiting(cityId, passenger.destinationRegion, -1);
    return passenger;
  }

  tick(tick: number, router: RouteRouter, ledger: CauseLedger): HubFailure | null {
    for (const queue of this.queues.values()) {
      for (const passenger of queue.waiting) {
        if (!passenger.longWaitNoted && tick - passenger.createdTick >= WAIT_TOO_LONG_TICKS) {
          passenger.longWaitNoted = true;
          ledger.record('longWait', queue.cityId, passenger.destinationRegion);
        }
        if (!passenger.noRouteNoted && !router.nextLeg(queue.cityId, passenger.destinationRegion, passenger.arrivedOnRoute)) {
          passenger.noRouteNoted = true;
          ledger.record('noRoute', queue.cityId, passenger.destinationRegion);
        }
      }
      if (queue.waiting.length >= queue.capacity) {
        queue.fullTicks++;
        if (!queue.fullNoted) {
          queue.fullNoted = true;
          for (const passenger of queue.waiting) ledger.record('full', queue.cityId, passenger.destinationRegion);
        }
        if (queue.fullTicks >= CONGESTION_GRACE_TICKS) {
          const waitingByRegion = ledger.waitingRegions(queue.cityId);
          let leadingRegion: string | null = null;
          let highest = 0;
          for (const regionId of Object.keys(waitingByRegion).sort()) {
            if (waitingByRegion[regionId] > highest) { highest = waitingByRegion[regionId]; leadingRegion = regionId; }
          }
          return { tick, cityId: queue.cityId, capacity: queue.capacity, waiting: queue.waiting.length,
            waitingByRegion, leadingRegion,
            leadingRegionPercent: Math.floor(highest * 100 / queue.waiting.length) };
        }
      } else {
        // The grace period requires continuous congestion, not cumulative isolated spikes.
        queue.fullTicks = 0;
        queue.fullNoted = false;
      }
    }
    return null;
  }

  snapshot(): HubsSnapshot {
    return { cities: [...this.queues.values()].sort((a, b) => a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0)
      .map((queue) => ({ ...queue, waiting: queue.waiting.map((passenger) => ({ ...passenger })) })) };
  }

  restore(saved: HubsSnapshot): void {
    if (!saved || !Array.isArray(saved.cities) || saved.cities.length !== this.queues.size) {
      throw new Error('Invalid terminal snapshot');
    }
    for (const input of saved.cities) {
      const queue = this.city(input.cityId);
      if (!Array.isArray(input.waiting) || !Number.isSafeInteger(input.fullTicks) || input.fullTicks < 0 ||
          !Number.isSafeInteger(input.upgradeLevels) || input.upgradeLevels < 0) {
        throw new Error('Invalid terminal queue state');
      }
      queue.capacity = input.capacity;
      queue.isHub = input.isHub;
      queue.upgradeLevels = input.upgradeLevels;
      queue.fullTicks = input.fullTicks;
      queue.fullNoted = input.fullNoted;
      queue.waiting = input.waiting.map((passenger) => ({ ...passenger }));
    }
  }
}

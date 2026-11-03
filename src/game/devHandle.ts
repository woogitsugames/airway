// [task-28] Development-only bridge between browser QA and the real game composition root.
// This module never supplies fake game state; integrations must register a real adapter.
export type AwScreen = 'menu' | 'game' | 'upgrade' | 'gameover' | 'settings';
// [night-07q] 'pick': a tap (from === to) on an airport the weekly board is waiting for (hub expansion, slots).
export type AwGesture = 'route' | 'plane' | 'pick';

export interface AwPoint {
  readonly x: number;
  readonly y: number;
}

export interface AwDevState {
  readonly screen: AwScreen;
  readonly seed: number;
  readonly tick: number;
  readonly nextWeekTick: number;
  readonly routeCount: number;
  readonly aircraftAssignments: number;
  readonly snapshotHash: string;
  /** [night-07q] Weekly upgrades taken so far, with the picked airport of targeted ones. */
  readonly upgrades?: readonly { readonly week: number; readonly upgrade: string; readonly hubId?: string }[];
}

export interface AwDevAdapter {
  // These actions MUST operate on production state and UI, not a shadow model.
  state(): AwDevState;
  prepareSeed(seed: number): void | Promise<void>;
  advanceTicks(ticks: number): void | Promise<void>;
  gesture(kind: AwGesture): { from: AwPoint; to: AwPoint };
  forceHubOverload(): void | Promise<void>;
  /** Play with the task-22 bot through real Commands until the weekly board for `untilWeek` opens. */
  autoplay(untilWeek: number): AwDevState | Promise<AwDevState>;
}

export interface AwDevHandle extends AwDevAdapter {
  readonly version: 1;
  readonly ready: boolean;
}

declare global {
  interface Window {
    aw?: AwDevHandle;
  }
}

let adapter: AwDevAdapter | null = null;

function requireAdapter(): AwDevAdapter {
  if (!adapter) {
    throw new Error('Airway dev adapter not connected: integrate tasks 13-16 before running gameplay E2E');
  }
  return adapter;
}

function validInteger(value: number, name: string, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

export function installDevHandle(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined' || window.aw) return;
  const handle: AwDevHandle = {
    version: 1,
    get ready() { return adapter !== null; },
    state: () => requireAdapter().state(),
    prepareSeed(seed) {
      validInteger(seed, 'seed', 0, 0xffffffff);
      return requireAdapter().prepareSeed(seed);
    },
    advanceTicks(ticks) {
      validInteger(ticks, 'ticks', 1, 1_000_000);
      return requireAdapter().advanceTicks(ticks);
    },
    gesture(kind) {
      if (kind !== 'route' && kind !== 'plane' && kind !== 'pick') throw new TypeError('Unknown gesture');
      return requireAdapter().gesture(kind);
    },
    forceHubOverload: () => requireAdapter().forceHubOverload(),
    autoplay(untilWeek) {
      validInteger(untilWeek, 'untilWeek', 1, 520);
      return requireAdapter().autoplay(untilWeek);
    },
  };
  Object.defineProperty(window, 'aw', { value: Object.freeze(handle), configurable: true });
}

export function registerDevGameAdapter(next: AwDevAdapter): void {
  if (!import.meta.env.DEV) return;
  adapter = next;
  installDevHandle();
}


// [task-28] Development-only bridge between browser QA and the real game composition root.
// This module never supplies fake game state; integrations must register a real adapter.
export type AwScreen = 'menu' | 'game' | 'upgrade' | 'gameover' | 'settings' | 'logbook';
// [night-07q] 'pick': a tap (from === to) on an airport the weekly board is waiting for (hub expansion, slots).
export type AwGesture = 'route' | 'plane' | 'pick';

export interface AwPoint {
  readonly x: number;
  readonly y: number;
}

export interface AwDevState {
  readonly screen: AwScreen;
  readonly seed: number;
  /** [night-11aj] R2g: the running Endless run's home region (null = Random, Daily, no run). */
  readonly homeRegion?: string | null;
  /** [night-12bc] R2h: the running run's licence class (1 for class I, Daily and no run). */
  readonly licenceClass?: number;
  readonly tick: number;
  readonly nextWeekTick: number;
  readonly routeCount: number;
  readonly aircraftAssignments: number;
  readonly snapshotHash: string;
  /** [night-07q] Weekly upgrades taken so far, with the picked airport of targeted ones. */
  readonly upgrades?: readonly { readonly week: number; readonly upgrade: string; readonly hubId?: string }[];
  /** [night-10g] Airports the sim closes by curfew now, and how many the renderer draws with the barrier. */
  readonly curfewClosed?: readonly string[];
  readonly curfewDrawn?: number;
  /** [night-11d] Waiting passengers (transfers included) and waiting places per airport. */
  readonly airports?: readonly { readonly id: string; readonly waiting: number; readonly capacity: number; readonly hub?: boolean }[];
  /** [night-15b] R4f: the orbit camera's target (where it looks, how close); view-only, not in the hash. */
  readonly camera?: { readonly longitude: number; readonly latitude: number; readonly zoom: number };
}

export interface AwDevAdapter {
  // These actions MUST operate on production state and UI, not a shadow model.
  state(): AwDevState;
  /** `options.firstTime`: [night-11p] show the R6a first-time cards in seeded runs (off by default). */
  prepareSeed(seed: number, options?: { readonly firstTime?: boolean }): void | Promise<void>;
  advanceTicks(ticks: number): void | Promise<void>;
  gesture(kind: AwGesture): { from: AwPoint; to: AwPoint };
  forceHubOverload(): void | Promise<void>;
  /** Play with the task-22 bot through real Commands until the weekly board for `untilWeek` opens. */
  autoplay(untilWeek: number): AwDevState | Promise<AwDevState>;
  /**
   * [night-07x] Queue at most one bot decision on the visible run without advancing time (the clock keeps
   * its own pace), for long real-time play-throughs. Resolves to the queued command type, or null.
   */
  botStep?(): string | null | Promise<string | null>;
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
    prepareSeed(seed, options) {
      validInteger(seed, 'seed', 0, 0xffffffff);
      return requireAdapter().prepareSeed(seed, options?.firstTime === true ? { firstTime: true } : undefined);
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
    botStep() {
      const next = requireAdapter();
      if (!next.botStep) throw new Error('botStep not supported by the registered adapter');
      return next.botStep();
    },
  };
  Object.defineProperty(window, 'aw', { value: Object.freeze(handle), configurable: true });
}

export function registerDevGameAdapter(next: AwDevAdapter): void {
  if (!import.meta.env.DEV) return;
  adapter = next;
  installDevHandle();
}


// Native haptics are presentation-only: never feed results into the simulation (D-13).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { readAccessibilitySettings } from '../ui/a11y';

/** Feedback vocabulary shared by the route tool, HUD and hub overlays. */
export type HapticKind = 'snap' | 'confirm' | 'jam';

/** Native bridge; tests and other shells may inject their own. Web is a no-op. */
export interface NativeHapticDriver {
  /**
   * [night-12r] D-137: @capacitor/haptics 8 only ticks `selectionChanged` inside `selectionStart`…`selectionEnd`
   * (Android checks a `selectionStarted` flag, iOS needs the generator `selectionStart` creates).
   */
  selectionStart(): void | Promise<void>;
  selectionChanged(): void | Promise<void>;
  selectionEnd(): void | Promise<void>;
  impactLight(): void | Promise<void>;
  impactHeavy(): void | Promise<void>;
}

export interface HapticsConfig {
  /** Player toggle(s). Default: the accessibility "Haptic feedback" switch. */
  isEnabled?: () => boolean;
  /** Default: @capacitor/haptics on a native platform, nothing on the web. */
  driver?: NativeHapticDriver | null;
}

const capacitorDriver: NativeHapticDriver = {
  selectionStart: () => Haptics.selectionStart(),
  selectionChanged: () => Haptics.selectionChanged(),
  selectionEnd: () => Haptics.selectionEnd(),
  impactLight: () => Haptics.impact({ style: ImpactStyle.Light }),
  impactHeavy: () => Haptics.impact({ style: ImpactStyle.Heavy }),
};

function defaultDriver(): NativeHapticDriver | null {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics') ? capacitorDriver : null;
  } catch {
    return null;
  }
}

let isEnabled: () => boolean = () => readAccessibilitySettings().hapticsEnabled;
let driver: NativeHapticDriver | null | undefined;
/** The driver a native selection was opened on (null: none open), so it is closed even if the switch flips. */
let selection: NativeHapticDriver | null = null;

/**
 * Composition root hook. Call once at boot if the settings screen keeps its own
 * haptics switch, e.g. `isEnabled: () => settings.haptics && a11y.hapticsEnabled`.
 */
export function configureHaptics(config: HapticsConfig): void {
  if (config.isEnabled) isEnabled = config.isEnabled;
  if (config.driver !== undefined) { driver = config.driver; selection = null; }
}

function enabled(): boolean {
  try { return isEnabled(); } catch { return false; }
}

function nativeDriver(): NativeHapticDriver | null {
  if (driver === undefined) driver = defaultDriver();
  return driver;
}

function call(effect: () => void | Promise<void>): void {
  try {
    void Promise.resolve(effect()).catch(() => { /* optional effect */ });
  } catch {
    // Native service unavailable.
  }
}

/**
 * Fire-and-forget; a missing vibrator or denied service never interrupts a gesture. A `snap` inside an open
 * selection (a route drag) is one selection tick; outside one it opens and closes its own selection around the tick.
 */
export function haptic(kind: HapticKind): void {
  if (!enabled()) return;
  const native = nativeDriver();
  if (!native) return;
  if (kind !== 'snap') {
    call(kind === 'confirm' ? () => native.impactLight() : () => native.impactHeavy());
  } else if (selection === native) {
    call(() => native.selectionChanged());
  } else {
    call(() => native.selectionStart());
    call(() => native.selectionChanged());
    call(() => native.selectionEnd());
  }
}

/** [night-12r] D-137: a route drag began; following snaps tick inside one native selection. */
export function hapticSelectionStart(): void {
  if (selection || !enabled()) return;
  const native = nativeDriver();
  if (!native) return;
  selection = native;
  call(() => native.selectionStart());
}

/** [night-12r] D-137: the drag ended or was cancelled; always closes an open selection, even with the switch off. */
export function hapticSelectionEnd(): void {
  const native = selection;
  if (!native) return;
  selection = null;
  call(() => native.selectionEnd());
}

/** Call after a route end or airport snaps into place. */
export function hapticSnap(): void { haptic('snap'); }
/** Call once on transition into congestion, not on every simulation tick. */
export function hapticJam(): void { haptic('jam'); }

/** Route-tool port shape (`RouteToolPorts.haptics` in src/input/routeTool.ts). */
export interface RouteHaptics {
  start(): void;
  snap(): void;
  confirm(): void;
  end(): void;
}

/** Port for the route tool; the accessibility toggle is checked on every call. */
export const routeHaptics: Readonly<RouteHaptics> = Object.freeze({
  start: hapticSelectionStart,
  snap: () => haptic('snap'),
  end: hapticSelectionEnd,
  confirm: () => haptic('confirm'),
});

/**
 * [night-10f] Commands the player commits outside the route tool: an aircraft dropped on a route and the weekly
 * pick get a light confirm when the simulation accepted them; a refused one stays silent (nothing happened).
 */
export function hapticCommand(type: 'AssignPlane' | 'ChooseUpgrade', accepted: boolean): void {
  if (accepted && (type === 'AssignPlane' || type === 'ChooseUpgrade')) haptic('confirm');
}

/** [night-10f] Once when the network closes (game over); the jam start already warned. */
export function hapticNetworkClosed(): void { haptic('jam'); }

/** Edge-triggered jam feedback for consumers rendering hub state each tick. */
export function createJamHaptics(): {
  setJammed: (hubId: string, jammed: boolean) => void;
  reset: () => void;
} {
  const jammedHubs = new Set<string>();
  return {
    setJammed(hubId, jammed) {
      if (!jammed) { jammedHubs.delete(hubId); return; }
      if (jammedHubs.has(hubId)) return;
      jammedHubs.add(hubId);
      hapticJam();
    },
    reset() { jammedHubs.clear(); },
  };
}

// Native haptics are presentation-only: never feed results into the simulation (D-13).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { readAccessibilitySettings } from '../ui/a11y';

/** Feedback vocabulary shared by the route tool, HUD and hub overlays. */
export type HapticKind = 'snap' | 'confirm' | 'jam';

/** Native bridge; tests and other shells may inject their own. Web is a no-op. */
export interface NativeHapticDriver {
  selectionChanged(): void | Promise<void>;
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
  selectionChanged: () => Haptics.selectionChanged(),
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

/**
 * Composition root hook. Call once at boot if the settings screen keeps its own
 * haptics switch, e.g. `isEnabled: () => settings.haptics && a11y.hapticsEnabled`.
 */
export function configureHaptics(config: HapticsConfig): void {
  if (config.isEnabled) isEnabled = config.isEnabled;
  if (config.driver !== undefined) driver = config.driver;
}

function enabled(): boolean {
  try { return isEnabled(); } catch { return false; }
}

/** Fire-and-forget; a missing vibrator or denied service never interrupts a gesture. */
export function haptic(kind: HapticKind): void {
  if (!enabled()) return;
  if (driver === undefined) driver = defaultDriver();
  const native = driver;
  if (!native) return;
  try {
    const result = kind === 'snap' ? native.selectionChanged() :
      kind === 'confirm' ? native.impactLight() : native.impactHeavy();
    void Promise.resolve(result).catch(() => { /* optional effect */ });
  } catch {
    // Native service unavailable.
  }
}

/** Call after a route end or airport snaps into place. */
export function hapticSnap(): void { haptic('snap'); }
/** Call once on transition into congestion, not on every simulation tick. */
export function hapticJam(): void { haptic('jam'); }

/** Route-tool port shape (`RouteToolPorts.haptics` in src/input/routeTool.ts). */
export interface RouteHaptics {
  snap(): void;
  confirm(): void;
}

/** Port for the route tool; the accessibility toggle is checked on every call. */
export const routeHaptics: Readonly<RouteHaptics> = Object.freeze({
  snap: () => haptic('snap'),
  confirm: () => haptic('confirm'),
});

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

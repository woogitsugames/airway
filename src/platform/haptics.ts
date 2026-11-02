// [task-20] Capacitor haptics are presentation-only; never feed results into the simulation.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { readAccessibilitySettings } from '../ui/a11y';

async function impact(style: ImpactStyle): Promise<void> {
  if (!readAccessibilitySettings().hapticsEnabled || !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable('Haptics')) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // Missing haptic hardware / native service must never interrupt gameplay.
  }
}
/** Call after a route or airport snaps into place. */
export function hapticSnap(): Promise<void> {
  return impact(ImpactStyle.Light);
}
/** Call once on transition into congestion, not on every simulation tick. */
export function hapticJam(): Promise<void> {
  return impact(ImpactStyle.Heavy);
}
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
      void hapticJam();
    },
    reset() { jammedHubs.clear(); },
  };
}

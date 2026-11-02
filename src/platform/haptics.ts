/** Optional native Capacitor haptic bridge; desktop/web is intentionally a no-op. */
export interface RouteHaptics {
  snap(): void;
  confirm(): void;
}
export interface NativeHapticDriver {
  selectionChanged(): void | Promise<void>;
  impactLight(): void | Promise<void>;
}

/** Inject a native driver from src/platform's composition root when installed. */
export function createRouteHaptics(native?: NativeHapticDriver): RouteHaptics {
  const emit = (action: () => void | Promise<void>): void => {
    try { void Promise.resolve(action()).catch(() => { /* Unavailable vibrator must not interrupt a gesture. */ }); }
    catch { /* Browser or OS denied the optional effect. */ }
  };
  return {
    snap() { if (native) emit(() => native.selectionChanged()); },
    confirm() { if (native) emit(() => native.impactLight()); },
  };
}

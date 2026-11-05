// Platform boundary: one module per native concern. Nothing here may be imported by src/sim (D-13).
export { configureHaptics, haptic, hapticSnap, hapticJam, hapticCommand, hapticNetworkClosed, hapticSelectionStart, hapticSelectionEnd, routeHaptics, createJamHaptics } from './haptics';
export type { HapticKind, HapticsConfig, NativeHapticDriver, RouteHaptics } from './haptics';
export { installBackHandler, ANDROID_BACK_EVENT } from './back';
export type { BackOptions, RegisterNativeBack, RemoveBackListener } from './back';
export { GameLifecycle } from './lifecycle';
export type { LifecycleHooks } from './lifecycle';
export {
  GAME_SAVE_KEY, SETTINGS_KEY, createDefaultStorage, createPlatformStorage, readSettings, writeSettings,
} from './storage';
export type { KeyValueStorage } from './storage';
export { INSTALL_MARKER_PATH, createNativeInstallMarker, forgetIdentityOnNewInstall } from './install';
export type { InstallCheck, InstallMarker } from './install';
export { APP_CHECK_PLUGIN, nativeAppCheckPort } from './appCheck'; // [night-12az] D-246
export { formatDailyShare, shareDailyResult } from './share';
export type { ShareOutcome } from './share';
export { freeEntitlements } from './store';
export type { Entitlements } from './store';
export { disabledAds } from './ads';
export type { AdService } from './ads';

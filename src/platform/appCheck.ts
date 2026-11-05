/**
 * [night-12az] R3e (D-246): the native App Check provider. `@capacitor-firebase/app-check` (Apache-2.0, Capawesome)
 * registers the `FirebaseAppCheck` plugin with Play Integrity (Android), App Attest (iOS) and a debug provider. The
 * game talks to it by name through Capacitor's plugin registry, so nothing changes until the owner installs it with
 * the Firebase config files (docs/FIREBASE.md, "App Check"): without the plugin this returns null and the REST
 * client sends no App Check header.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppCheckPort } from '../net/appCheck';

export const APP_CHECK_PLUGIN = 'FirebaseAppCheck';

export function nativeAppCheckPort(): AppCheckPort | null {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable(APP_CHECK_PLUGIN)) return null;
    return registerPlugin<AppCheckPort>(APP_CHECK_PLUGIN);
  } catch {
    return null;
  }
}

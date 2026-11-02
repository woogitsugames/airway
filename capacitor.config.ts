// Owner-confirmed application identifier (D-15). Kept untyped: @capacitor/cli is pinned
// in scripts (npm exec @capacitor/cli@8.5.3), not installed as a dependency.
export default {
  appId: 'pl.samsufi.airway',
  appName: 'Airway',
  webDir: 'dist',
  // Edge-to-edge on both platforms: the web layer pads with env(safe-area-inset-*).
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    // No ad, analytics or push plugins (D-16). Native plugins in use:
    // @capacitor/haptics, @capacitor/share, @capacitor/preferences, @capacitor/filesystem.
  },
};

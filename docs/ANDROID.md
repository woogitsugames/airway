# Airway — Android build and signing

The native project is under `android/`, based on the Capacitor **8.5.3** Android template.
Application ID: `pl.samsufi.airway` (owner decision D-15). No ads, IAP, analytics or Play
Games dependencies are bundled for the MVP (D-16). The app runs packaged Vite assets,
not a remote website.

## Requirements

- Node.js 22+, npm, Java **JDK 21** (`JAVA_HOME` recommended).
- Android Studio Otter 2025.2.1+ or Android command-line tools.
- `ANDROID_HOME` set to an installed Android SDK directory; Android SDK Platform **36**,
  Build Tools 36.x and Platform Tools installed. Accept the Android SDK licences.
- Gradle **8.14.3** is pinned by the checked-in wrapper; Android Gradle Plugin **8.13.0**.
  The wrapper downloads its distribution on first use, so a network connection is required
  unless the distribution is already cached.
- `npm ci` and first `cap sync` require npm access. The project intentionally invokes
  pinned `@capacitor/cli@8.5.3` using `npm exec` instead of changing task 01's lockfile.

Do not use unpinned `npx cap`; it could install a different Capacitor major release.
The Android source tree follows the output of `npx cap add android` with only the
Airway-specific changes described below. The native generation step was reconstructed
from the official template because the task runner did not have access to npm/SDK.

## Debug APK

```sh
npm ci
export ANDROID_HOME="$HOME/Android/Sdk"   # adjust for your machine
npm run test:android-config
npm run android
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android` performs, in order: SVG raster generation, `npm run build`,
`npm exec --yes --package=@capacitor/cli@8.5.3 -- cap sync android`, then
`android/gradlew assembleDebug`. On Windows, use the corresponding environment
variable syntax; the script selects `gradlew.bat` automatically.

If you only want to refresh icons/splash without Android SDK, use
`npm run android:assets`. This generates 5 densities each of legacy launcher,
round launcher and adaptive foreground PNG, plus `drawable-nodpi/splash.png`,
all from original repository SVG. Regenerated PNGs are intentionally ignored
by Git to avoid keeping duplicate binary assets; **run the npm script before
opening the native project in Android Studio on a new checkout**.

## Release signing — key outside Git

Create an upload keystore once and keep a secure backup outside this repository:

```sh
keytool -genkeypair -v -keystore /secure/airway-upload.jks \
  -alias upload -keyalg RSA -keysize 3072 -validity 10000
```

Use secret environment variables or CI secret storage, never `local.properties`,
`key.properties`, source files, process arguments, logs or committed credentials.

```sh
export AW_KEYSTORE=/secure/airway-upload.jks  # absolute path, outside checkout
export AW_KEYSTORE_PASS='...'               # secret
export AW_KEY_ALIAS=upload                  # optional; defaults to upload
export AW_KEY_PASS='...'                    # optional; defaults to AW_KEYSTORE_PASS
export ANDROID_HOME="$HOME/Android/Sdk"
npm run android:release                     # signed APK
npm run android:aab                         # signed Android App Bundle for Play
```

Outputs:
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Both scripts reject a missing keystore/password, a relative path or a key
located inside the repository. Gradle also refuses direct release tasks without
signing material. Version code/name currently `1` / `0.1.0`; coordinate future
store version bumps in this native file when releasing.

## Android 15+, foldables and back navigation

- **Edge-to-edge:** transparent status/navigation bars, no opt-out flag.
  Capacitor 8's built-in SystemBars integration supplies safe-area inset values.
  Game UI must respect `env(safe-area-inset-top)` and
  `env(safe-area-inset-bottom)` in both orientations (owned by UI tasks).
- **Rotation / folding:** no `screenOrientation` restriction. The main activity is
  resizable and declares `orientation|screenSize|smallestScreenSize|screenLayout|density`
  and related `configChanges`, so ordinary changes update the WebView without
  recreating the activity. Game canvas/layout must still handle window resizes.
- **Back button:** `MainActivity` delivers the platform event
  `airway:android-back`. `src/platform/back.ts` exports `onAndroidBack(handler)`;
  the future game/menu lifecycle from tasks 14/16 must register a policy for
  closing menus, pausing or confirmation. Until then, the adapter consumes the
  event without guessing the intended menu/exit behaviour.

## Pre-release device checklist (not covered by static tests)

Test on a physical Android 15+ device and emulator/API 36: 412x915 and 915x412,
foldables 673x841 and 904x1000, back navigation, startup splash, safe-area
at status/navigation bars, split-screen resize, losing/restoring focus, and
unfolding without resetting a session. No device run was performed in this task
environment; passing `test:android-config` is a static guarantee only.

Do **not** add APK, AAB, keystore or Gradle build products to Git.

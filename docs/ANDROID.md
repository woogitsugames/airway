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

After Gradle, every build checks its output for 16 KB native-library alignment (`scripts/native-align.mjs`, D-98):
64-bit `lib/<abi>/*.so` must have ELF LOAD segments aligned to ≥ 16 KB, and stored APK entries must start on a
16 KB boundary (what `zipalign -c -P 16 4` checks). The line `SUMMARY native-align …: no native libs` is the normal
result for this web-only Capacitor app; a misaligned library fails `android:release` / `android:aab` (debug builds
only print it). Run it on any bundle with `node scripts/native-align.mjs <file.aab|file.apk>`. Play's target-API
floor (targetSdk ≥ 36 from 31.08.2026) is asserted by `test:android-config`; raise `PLAY_MIN_TARGET_SDK` there and
`targetSdkVersion` in `android/variables.gradle` each August when Google moves it.

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
- **Back button:** `MainActivity` dispatches the cancelable window event
  `airway:android-back`. `installBackHandler(onBack)` in `src/platform/back.ts` is the
  single JS entry point (also Escape and optional `popstate`); a screen that consumes
  back returns `true` (preventDefault). If nothing consumes it, the activity calls
  `moveTaskToBack(true)` (the OS owns app exit; the run is saved by the lifecycle).
- **Native plugins:** `@capacitor/haptics`, `@capacitor/share`, `@capacitor/preferences`,
  `@capacitor/filesystem` (saves in app-private `Directory.Data`). `capacitor.settings.gradle`
  and `app/capacitor.build.gradle` list them as `cap sync android` would. The haptics plugin
  merges the normal-level `android.permission.VIBRATE`; no runtime permission prompts, no ad,
  analytics or billing SDKs (D-16).

## Backup and phone change (D-92)

Auto Backup is on (`android:allowBackup="true"`) with **include-only** rules:
`res/xml/data_extraction_rules.xml` (Android 12+, cloud backup and device-to-device transfer) and
`res/xml/backup_rules.xml` (`fullBackupContent`, Android 11 and older), both with the same list:

| Domain / path | What it holds |
|---|---|
| `sharedpref` `CapacitorStorage.xml` | `@capacitor/preferences`: committed save pointer and native settings (`src/platform/storage.ts`) |
| `file` `aw-save-a.json`, `aw-save-b.json` | `@capacitor/filesystem` `Directory.Data`: the two save slots |
| `root` `app_webview/Default/Local Storage/` (and the pre-profile `app_webview/Local Storage/`) | WebView `localStorage`: logbook, daily streak and best scores, settings, puzzle stars, tutorial flag |

Everything else (WebView cache, cookies, code cache, `files/aw-install-v1.json`) stays on the phone. The
leaderboard session token and offline queue (`aw-net-session-v1`, `aw-net-queue-v1`) share the WebView
`localStorage` with the logbook, so file rules cannot split them; instead `src/platform/install.ts` keeps an
install marker that is never backed up (Filesystem `Directory.LibraryNoCloud` = app files directory on Android).
On a launch without the marker (fresh install or restore onto another phone) it writes the marker first and then
removes both keys before the leaderboards start, so the restored phone signs in as a new anonymous player. The
encrypted backup itself still contains the token; moving it out of `localStorage` is a follow-up. Note: the
first launch of this version on an existing test install also counts as new once (pre-release, no players yet).

`test:android-config` checks the manifest attributes, identical include lists, no wildcard include, the save paths
against `SAVE_PATHS`, and that the marker is not included; `test:install-identity` checks the reset logic.
Device check (not possible here): `adb shell bmgr backupnow pl.samsufi.airway`, uninstall, reinstall from the same
signed build with restore (`adb shell bmgr restore`), then confirm the logbook and save are back and the first
official daily gets a new call sign.

## Per-app language (D-115)

`android:localeConfig="@xml/locales_config"` lists the game's languages (`en`, `pl`), so Android 13+ shows Airway
under **Settings → Apps → Airway → Language** (and in the system per-app language list). Older Android ignores the
attribute. No in-app native picker is added: the game's own setting (Settings → Game → Language) stays the
authority (D-31) — `src/i18n` reads the saved choice first and only falls back to the device language
(`navigator.languages`) when the player never chose one. `test:android-config` checks that the list equals the
`Language` type in `src/i18n/index.ts` and iOS `CFBundleLocalizations` (D-91), and that the saved choice wins.
`aapt2 link` against `android-36` accepts the attribute with `minSdk 24`.

Device check (not possible here): on Android 13+ set Airway's per-app language to Polish while the phone is in
English, start a fresh install and confirm the game opens in Polish (i.e. the WebView's `navigator.languages`
follows the per-app locale — documented for the app's `LocaleList`, not verified for the WebView). Then pick
English in the game and confirm it stays English after a restart. The activity handles `locale` in
`configChanges`, so a per-app language change while the game runs takes effect at the next start (the game does
not switch language mid-run).

## Pre-release device checklist (not covered by static tests)

Test on a physical Android 15+ device and emulator/API 36: 412x915 and 915x412,
foldables 673x841 and 904x1000, back navigation, startup splash, safe-area
at status/navigation bars, split-screen resize, losing/restoring focus, and
unfolding without resetting a session, a backup restore and the per-app language (sections above). No device run was performed in this task
environment; passing `test:android-config` is a static guarantee only.

Do **not** add APK, AAB, keystore or Gradle build products to Git.

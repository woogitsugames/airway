# Airway — iOS build, signing and TestFlight

Status: task 25. Bundle ID: `pl.samsufi.airway` (owner decision D-15). Store title: *Airway: Globe Route Builder* (D-18).

## Requirements

- macOS with **Xcode 26.0+**, iOS Simulator and command-line tools (`xcode-select --install`).
- Node.js 22+ and npm (`npm ci` uses the checked-in lockfile).
- **CocoaPods** (`brew install cocoapods`), required for this platform's Pods integration. Capacitor 8 uses SPM by default; this project deliberately uses its official CocoaPods template (D-20).
- Ruby and Bundler; `bundle install` from the repository root installs the Fastlane version pinned by `Gemfile`.
- For distribution: Apple Developer Program account, App Store Connect app record, signing certificate and provisioning profile for `pl.samsufi.airway`. App Store Connect API key authorization alone is insufficient for signing.

## Generate and sync

This repository tracks the native iOS project from the official **Capacitor 8.5.3 CocoaPods template**. The native CLI command could not be run in the Linux offline workspace (Xcode and CocoaPods are unavailable). For reference, a **fresh** project can be generated on a Mac using:

```sh
npm ci
npm run build
npx --yes @capacitor/cli@8.5.3 add ios --packagemanager CocoaPods
```

**Do not run `add ios` over the tracked `ios/` directory.** For the existing project:

```sh
npm ci
npm run typecheck
npm run test:fast
npm run build
npx --yes @capacitor/cli@8.5.3 sync ios
open ios/App/App.xcworkspace
```

The CLI is pinned separately because task 01 did not include `@capacitor/cli` in `package-lock.json`. Its initial download requires an npm connection. Sync generates `App/App/public`, `capacitor.config.json` and `config.xml`, then installs CocoaPods and configures the workspace. Always use the **`.xcworkspace`**, not `App.xcodeproj`. The shared scheme is `App`.

If dependencies are stale: `cd ios/App && pod install`. Do not commit `Pods/`, generated `public/`, DerivedData or any signing files.

## Safe areas, orientations and audio

- `index.html` sets `viewport-fit=cover`. The sky / 3D world canvas remains edge-to-edge. HUD and interactive controls must use `--aw-safe-top`, `--aw-safe-right`, `--aw-safe-bottom`, `--aw-safe-left` (CSS `env(safe-area-inset-*)`) to avoid the notch, Dynamic Island and home indicator.
- `Info.plist` allows portrait and both landscape orientations on iPhone and all four on iPad. Full-screen-only mode is not requested; test rotation, iPad Split View and window resizing.
- `AppDelegate.swift` sets `AVAudioSession.Category.ambient`: the device's Ring/Silent switch mutes the game by default, without stopping other apps' audio. The Web Audio engine (`src/audio`) also requests `navigator.audioSession.type = 'ambient'` where WKWebView supports it; a play-in-silent-mode override would need a reviewed native bridge.
- No camera, photo library, location, contacts, microphone, tracking or background privileges are requested. Native plugins: Haptics, Share, Preferences (UserDefaults, reason CA92.1) and Filesystem (file timestamps, reason C617.1), each with a pod in the `Podfile`; `test:ios-config` checks the pod list against `package.json` and forbids ad/analytics/billing SDKs. Review `PrivacyInfo.xcprivacy` whenever a plugin is added.

## Original icon and launch art

`ios/Brand/app-icon.svg` and `ios/Brand/splash.svg` are exact copies of task 24's original `resources/icon.svg` and `resources/splash.svg` (PR #12). The shared wayfinding mark uses black `#1C1E20` and yellow `#FFC72C`. The iOS icon is opaque 1024×1024; the 2732×2732 iOS launch PNG composites the shared transparent splash SVG over the **same black launch background used by Android**. All PNGs are procedural, with identical 1×/2×/3× splash image slots matching the Capacitor template. No third-party artwork.

Task 24 exists as draft PR #12 and is not yet merged. The two iOS SVG copies are currently **byte-identical** to its asset sources; after merge, decide whether to generate both platforms from the common `resources/` SVGs rather than maintaining copies.

## TestFlight

Create `pl.samsufi.airway` in Apple Developer and App Store Connect. Install a distribution certificate and matching App Store profile (or configure automatic signing with a capable Xcode account). The lane cannot create signing credentials from just an App Store Connect API key.

Generate a **Team App Store Connect API key** and keep the downloaded `.p8` outside the repository:

```sh
export ASC_KEY_ID='YOUR_KEY_ID'
export ASC_ISSUER_ID='YOUR_ISSUER_UUID'
export ASC_KEY_PATH="$HOME/.secrets/AuthKey_YOUR_KEY_ID.p8"
export APPLE_TEAM_ID='YOUR_10_CHARACTER_TEAM_ID'
# Optional monotonic build number:
# export IOS_BUILD_NUMBER=12
bundle install
bundle exec fastlane ios beta
```

`fastlane ios beta` reads the marketing version from `package.json` (currently 0.1.0) and uses `IOS_BUILD_NUMBER` or increments the latest TestFlight build number. It runs `npm ci`, web build, pinned `cap sync ios`, an Xcode Release archive, an App Store IPA export and `upload_to_testflight`. Output: `ios/App/output/Airway.ipa` (ignored). It does not release to the App Store.

No API secrets, `.p8`, `.p12`, provisioning profiles, IPA or Fastlane logs belong in the repository.

## Required manual checks before release

1. Run `npm run test:ios-config` and the full `npm ci`, `npm run typecheck`, `npm run test:fast`, `npm run build` gate.
2. On a Mac, execute pinned `cap sync ios`, `pod install`, and `xcodebuild -list -workspace ios/App/App.xcworkspace`.
3. Build with Xcode on an iPhone and iPad simulator, check landscape, portrait, safe areas, Split View and resizing.
4. Test on an actual iPhone: silent switch, interruption/resume, and audio playback after task 19 is merged.
5. Set up signing, archive for a device, run `bundle exec fastlane ios beta` and verify the resulting TestFlight build.
6. Revisit privacy and platform capabilities after tasks 16, 19, 24 and 27, before store submission.

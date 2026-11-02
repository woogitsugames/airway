# Airway store deliverables — task 26

The Polish and English copy is ready to paste from [pl.md](pl.md) and [en.md](en.md). Verify every described feature against the integrated release build before publishing.

## Naming and store limits

- D-18 specifies **Airway: Globe Route Builder** (EN, 27 characters) and **Airway: Buduj siatkę lotów na globusie** (PL, 38 characters).
- Both Google Play and App Store cap localized names at 30 characters. The approved Polish title cannot fit; the provisional store-field value in pl.md is **Airway: Buduj trasy lotów** (25 characters). This shortened title is an owner decision, not a change to D-18.
- App Store subtitles: up to 30 characters; App Store keyword field: up to 100 characters. Google Play short description: 80 characters; long description: 4,000 characters.
- Google Play has no separate keyword field. Its keywords should occur naturally in the descriptions. Store copy contains no competitor names, prices, rankings, or unverifiable accolades.

Official sources:
- [Google Play fields](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Google Play screenshot requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Apple name/subtitle requirements](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- [Apple keyword guidance](https://developer.apple.com/app-store/product-page/)

## Browser screenshot capture

When the gameplay is integrated, run these commands:

1. npm ci
2. npm run test:store-shots
3. npm run store:shots

The capture uses the environment-provided Playwright/Chromium and launches Vite. A running server can be selected with the option --base-url=http://127.0.0.1:5173/ (after the npm run store:shots -- separator).

Five deterministic scenes are captured for both Polish and English:
- **game-dusk**: Europe at dusk, active routes and in-world HUD.
- **upgrade**: three weekly freight-label upgrades.
- **menu**: split-flap departures board and airport sign.
- **failure**: overloaded hub, cancelled flights and cause report.
- **night**: night-side globe with real city and airport lights.

Each is captured at three viewport sizes:

| Device | CSS viewport | DPR | Output PNG |
| --- | --- | --- | --- |
| Phone | 360×640 | 3 | 1080×1920 (9:16) |
| Foldable | 673×841 | 2 | 1346×1682 |
| Tablet | 768×1024 | 2 | 1536×2048 |

The expected output is **30 genuine game screenshots** in docs/store/shots/{pl,en}/{scene}-{device}.png. Captures are first staged in a temporary directory and only installed after the entire matrix succeeds. No promotional text, overlays, fake globes or mockup composites are inserted.

The phone profile matches the Google Play 9:16 minimum game screenshot dimensions. App Store Connect can require different exact sizes for selected iPhone/iPad device classes; capture the appropriate Apple sizes before submitting, rather than treating generic 1080×1920 as an iPhone slot.

## Development-only integration contract

The application composition root, once the dependencies are merged, must support URL-driven deterministic scene setup on development builds ONLY. Example:

- /?storeShot=game-dusk&seed=41377&lang=pl&storeHour=18%3A30
- /?storeShot=night&seed=41377&lang=en&storeHour=22%3A30

The capture script writes the chosen language to the existing airway.settings localStorage key before page startup. Scene setup must use real renderer/game modules and a stable seeded game state. After the globe, lighting, translated UI and fonts are fully ready, it must mark the HTML root element with the dataset fields **storeShotReady = sceneId** and **storeShotSeed = '41377'**. The capture script checks these markers along with language, visible canvas, horizontal overflow and uncaught page errors; absent or incomplete scenarios cause a nonzero exit. A sky-only scaffold must not pass.

This branch intentionally does not alter src/main.ts or app logic owned by other task PRs. Tasks 13, 14, 12 and 15, as well as the production renderer/simulation, were not merged into dev at implementation time. The real fixtures and completed PNGs are therefore **blocked on integration**: docs/store/shots/ remains empty until the actual gameplay can be captured. npm run test:store-shots validates listing fields and the matrix but does not imply that screenshots already exist.

## Publication visual checklist

Review every generated PNG at native size: no flat schematic map, purple-blue glass cards, generic stock art or emoji icons; rich Diorama globe; passenger identity not colour-only; airport-object UI (boarding pass, luggage tags, freight labels, departure board); PL accents and EN translations correct; nonclipped interactive objects and safe areas; visible night-side lights; cause report on failure; no debugging overlay. Only mark images accepted in the PR after they have been genuinely captured and inspected.

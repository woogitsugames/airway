# Airway store deliverables — tasks 26 and 36

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

## Development-only integration contract (task 36, D-48)

`src/main.ts` serves `/?storeShot=<scene>&seed=41377&lang=<pl|en>` on DEV builds only. Every scene starts a real
endless run on seed 0xA1A1 and is played by the DEV autoplay bot through real Commands (route tool, dock, weekly
board); nothing writes game state directly:

- **game-dusk / night**: about one game day of autoplay, then the bot keeps playing until the sun stands 95° west
  of the camera centre (terminator crossing the view) or 180° away (midnight under the camera).
- **upgrade**: autoplay until the first weekly board.
- **failure**: one game day of autoplay, then the player stops building and real demand jams a hub.
- **menu**: the real departures board over the turning globe.

When the scene is reached the root element gets `data-store-shot-ready` and `data-store-shot-seed`; a scene that is
not reached (e.g. an early jam) never sets them and the capture fails.

## Automatic checks

`npm run store:shots` stages all 30 PNGs and publishes them only when every one passes:
exact pixel size; not blank or white (pixel statistics from a built-in PNG reader); no developer text in the visible
page text (raw i18n keys, `{param}` placeholders, DEV/debug/NaN/undefined/localhost); no Vite overlay; passenger
glyphs painted on top only from the six D-08 shapes (chevron, bow-tie, crescent, keyhole, tail-fin, bracket — never
the provisional Asia/Oceania glyphs). Results go to `shots/manifest.json`; the contact sheet is
[contact-sheet.png](contact-sheet.png). `npm run test:store-shots` re-checks the committed PNGs, manifest and sheet.
Preview one scene without publishing: `node scripts/store-shots.mjs --only=night --out=/tmp/x`.

## Publication visual checklist

Review every generated PNG at native size: no flat schematic map, purple-blue glass cards, generic stock art or emoji icons; rich Diorama globe; passenger identity not colour-only; airport-object UI (boarding pass, luggage tags, freight labels, departure board); PL accents and EN translations correct; nonclipped interactive objects and safe areas; visible night-side lights; cause report on failure; no debugging overlay. Only mark images accepted in the PR after they have been genuinely captured and inspected.

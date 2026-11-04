# Airway store deliverables — tasks 26, 36 and 40

The Polish and English copy is ready to paste from [pl.md](pl.md) and [en.md](en.md). Verify every described feature against the integrated release build before publishing.

## Naming and store limits

- D-18 specifies **Airway: Globe Route Builder** (EN, 27 characters) and **Airway: Buduj siatkę lotów na globusie** (PL, 38 characters); D-202 (owner, Q-77 → B) changed the PL title to
  **Airway: Buduj sieć lotów na globusie** (36 characters), the word the game uses (D-195).
- Both Google Play and App Store cap localized names at 30 characters. The approved Polish title cannot fit; the store-field value in pl.md is **Airway: Buduj sieć lotów** (24 characters, D-202; was "Airway: Buduj trasy lotów"). PL store texts say "sieć", never "siatka" (`test:store-shots`).
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

Five deterministic scenes are captured for both Polish and English, in the store order of D-63 (the same order
as `SCENES` in `scripts/store-shots.mjs`, the contact-sheet columns, the manifest and the captions in pl.md/en.md):
1. **night**: night-side globe with real city and airport lights.
2. **game**: the network in golden low-sun light just before sunset, active routes and in-world HUD
   (called `game-dusk` before task 40).
3. **upgrade**: three weekly freight-label upgrades.
4. **failure**: overloaded hub, cancelled flights and cause report.
5. **menu**: split-flap departures board and airport sign.

Each is captured at six viewport sizes ([N12o] D-123 added the last three):

| Device | CSS viewport | DPR | Output PNG | Console slot |
| --- | --- | --- | --- | --- |
| `phone` | 360×640 | 3 | 1080×1920 (9:16) | Play → Phone screenshots |
| `foldable` | 673×841 | 2 | 1346×1682 (4:5) | Play → 7-inch tablet screenshots (not eligible for large-screen promotion) |
| `tablet` | 768×1024 | 2 | 1536×2048 (3:4) | Play → 10-inch tablet screenshots (not eligible for large-screen promotion) |
| `iphone` | 440×956 | 3 | 1320×2868 | App Store Connect → iPhone 6.9" Display (scaled by Apple to the smaller iPhones) |
| `ipad` | 1032×1376 | 2 | 2064×2752 | App Store Connect → iPad 13" Display (scaled to the smaller iPads) |
| `landscape` | 960×540 | 2 | 1920×1080 (16:9) | Play → 10-inch tablet screenshots, first ones (16:9 with short side ≥ 1080 qualifies for large-screen / Chromebook promotion); landscape HUD |

Play allows up to 8 images per device type: upload the five scenes in store order per slot (for tablets the five
`landscape` shots first, then `tablet`). App Store Connect takes up to 10 per size; upload the five scenes per class.
Apple rejects screenshots with an alpha channel: every shot is written as 8-bit RGB and `test:store-shots` checks it.

The expected output is **60 genuine game screenshots** in docs/store/shots/{pl,en}/{scene}-{device}.png. Captures are first staged in a temporary directory and only installed after the entire matrix succeeds. No promotional text, overlays, fake globes or mockup composites are inserted.

The phone profile matches the Google Play 9:16 minimum game screenshot dimensions. Apple slots use their own exact
sizes (`iphone`, `ipad`), never the generic 1080×1920 phone shot. `checkStoreSizes` in `scripts/store-shots.mjs`
holds the accepted Apple sizes (6.9": 1320×2868, 1290×2796, 1260×2736; 13": 2064×2752, 2048×2732) and Play's rules
(320–3840 px, at most 2:1, one 9:16 and one 16:9 profile with a short side ≥ 1080); re-check them against the
console help pages before each submission, they change with new devices.

## Google Play feature graphic (N12n, D-117)

`docs/store/feature-graphic.png` — 1024×500, 24-bit RGB PNG without alpha (Play: JPEG or 24-bit PNG, ≤ 15 MB),
console slot **Main store listing → Graphics → Feature graphic**; it is also the cover of the preview video once R2b
exists (Play draws the play button in the centre, so the wordmark stays on the left third). One image for both
languages: the only words are the "AIRWAY" wayfinding sign (`brand/wayfinding.svg`, Overpass 800). Alt text: field
**Play feature graphic alt text** in [pl.md](pl.md) / [en.md](en.md).

`npm run store:feature` renders it from the real `game` scene (seed 0xA1A1, the same autoplay and evening sun as the
store shot) in a 1024×500 viewport at DPR 2: the DOM HUD is hidden, the DEV probe `featureView` sets zoom 1.6 and
slides the globe right and down so the network sits in the middle, the sign is added on the left, then Chromium
downscales to 1024×500 and the script writes opaque RGB. Checks (also in `test:store-shots`): exact size, no alpha,
≤ 15 MB, middle third not empty, at most 20 % dark unsaturated pixels (Google's "no black/dark-grey fields" rule —
the night scene is not used), wordmark inside the left third, globe limb visible. Re-render after a visual change
of the globe or the `game` scene and inspect the PNG before committing.

## Development-only integration contract (task 36, D-48)

`src/main.ts` serves `/?storeShot=<scene>&seed=41377&lang=<pl|en>` on DEV builds only. Every scene starts a real
endless run on seed 0xA1A1 and is played by the DEV autoplay bot through real Commands (route tool, dock, weekly
board); nothing writes game state directly:

- **night**: about one game day of autoplay, then the bot keeps playing until the sun stands 180° from the camera
  centre (midnight under the camera).
- **game** ([task-40], D-63): the same day of autoplay, then the bot plays on until the sun elevation over the network
  centroid (spherical mean of the open airports) is 0.05 (`STORE_GAME_SUN_DOT`, daynight.ts units) in the evening:
  just on the sunny side of the terminator, inside the warm band. On seed 0xA1A1 that is hour angle −70.7° at
  31.2°E 38.2°N (≈17:05 on the boarding pass). The old fixed −95° from the camera centre left the network past the
  terminator (the oblique camera centre lies far south of the network). The chosen angle is written to
  `data-store-shot-sun` and recorded in the manifest.
- **upgrade**: autoplay until the first weekly board.
- **failure**: one game day of autoplay, then the player stops building and real demand jams a hub.
- **menu**: the real departures board over the turning globe.

When the scene is reached the root element gets `data-store-shot-ready` and `data-store-shot-seed`; a scene that is
not reached (e.g. an early jam) never sets them and the capture fails.

## Automatic checks

`npm run store:shots` stages all 60 PNGs and publishes them only when every one passes:
exact pixel size; not blank or white (pixel statistics from a built-in PNG reader); no developer text in the visible
page text (raw i18n keys, `{param}` placeholders, DEV/debug/NaN/undefined/localhost); no Vite overlay; passenger
glyphs painted on top only from the six D-08 shapes (chevron, bow-tie, crescent, keyhole, tail-fin, bracket — never
the provisional Asia/Oceania glyphs). Results go to `shots/manifest.json`; the contact sheet is
[contact-sheet.png](contact-sheet.png). `npm run test:store-shots` re-checks the committed PNGs, manifest and sheet.
Preview one scene without publishing: `node scripts/store-shots.mjs --only=night --out=/tmp/x`.

[task-40] Light checks, recorded per shot in the manifest (`sun`, `contrast`, `warmth`) and re-checked by
`--validate`: the manifest must list the shots in store order; in `game` and `night` routes, airports and planes keep
≥ 4.5:1 against the globe (D-47 probe, `src/render/contrast.ts` via the DEV `window.__awWorld`); in `game` the globe
alone (DOM overlay hidden, inside the projected disc) must have a golden-pixel share ≥ 0.045 (R > 1.3 G, G > 1.05 B;
seed 0xA1A1 phone: noon 0.005, mid-afternoon 0.029, the old −95° shot 0.015, the new golden shot ≈ 0.08).
A full fresh run can be checked outside the repo: `node scripts/store-shots.mjs --out=/tmp/x` then
`node scripts/store-shots.mjs --validate --out=/tmp/x`.

## Publication visual checklist

Review every generated PNG at native size: no flat schematic map, purple-blue glass cards, generic stock art or emoji icons; rich Diorama globe; passenger identity not colour-only; airport-object UI (boarding pass, luggage tags, freight labels, departure board); PL accents and EN translations correct; nonclipped interactive objects and safe areas; visible night-side lights; cause report on failure; no debugging overlay. Only mark images accepted in the PR after they have been genuinely captured and inspected.

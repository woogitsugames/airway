# Assets and licences

Stage 0 (mockups only). Every font is SIL Open Font License 1.1; the licence text sits next to the font file in
`mockups/fonts/OFL-<Family>.txt` (downloaded from github.com/google/fonts/ofl/<dir>/OFL.txt). Font binaries were fetched
from Google Fonts (static TTF per weight) on 2026-11-02 by `mockups/fetch-fonts.sh`.

## Fonts (SIL OFL 1.1)
| Family | Weights | Used in | Polish glyphs |
|---|---|---|---|
| Overpass | 400, 800 | Diorama headlines | yes |
| Atkinson Hyperlegible Next | 400, 700 | Diorama text | yes |
| Young Serif | 400 | Poczta lotnicza headlines/numbers | yes |
| Familjen Grotesk | 400, 700 | Poczta lotnicza text, overview sheets | yes |
| Alegreya SC | 500, 800 | Atlas headlines/labels | yes |
| Alegreya | 400, 700 | Atlas text | yes |
| Big Shoulders Display | 500, 800 | Mapa pilota (rejected) | yes |
| IBM Plex Sans Condensed | 400, 600 | Mapa pilota (rejected) | yes |
| IBM Plex Mono | 400, 600 | Mapa pilota (rejected) | yes |
| Martian Mono, Overpass Mono | 400, 700 | downloaded for evaluation, currently unused | yes |
| Barlow Condensed | 500, 700 | UI direction mockups 2026-11 "Karta" (`mockups/ui-2026-11/`) | yes |
| Archivo Narrow | 500, 700 | UI direction mockups 2026-11 "Kokpit" | yes |
| Atkinson Hyperlegible Mono | 400, 700 | UI direction mockups 2026-11 "Kokpit" | yes |

Rejected: **B612 / B612 Mono** (OFL, Airbus cockpit face) — no Polish diacritics (ą ć ę ł ń ś ź ż missing), checked with fontTools.

## Map data
- `world-atlas` 2.0.2 (ISC) — TopoJSON of **Natural Earth** land 110m/50m (public domain). npm dev dependency.

- [N12ai] `src/data/city-names.json` — German, French, Spanish and Brazilian Portuguese names of the 165 cities and
  8 regions from **Wikidata** labels (CC0 1.0, https://www.wikidata.org/wiki/Wikidata:Licensing), snapshot
  `scripts/data/wikidata-labels.json` (retrieved 2026-11-04), item ids `scripts/data/city-wikidata.json`, 19 reviewed
  corrections in `scripts/data/city-names-overrides.json` (own work). Rebuilt by `npm run data:city-names` (D-217).
  Not shown in the game until those languages ship.

## Libraries (dev only, mockups)
- `d3-geo` 3.x (ISC), `topojson-client` 3.x (ISC), `three` 0.170 (MIT). Playwright is pre-installed in the environment (Apache-2.0), not a dependency.

## Graphics
- [night-11ah] `docs/mockups/ui-2026-11/_frames/*.png` are captures of the game itself (DEV `storeShot` fixture,
  seed 0xA1A1, UI hidden for the backgrounds); every UI element in the direction mockups is drawn in SVG in
  `mockups/ui-2026-11/` (own work). Fonts above fetched 2026-11-04 by `mockups/fetch-fonts.sh`, licences next to them.
All mockup graphics (globes, terrain, planes, glyphs, stamps, medallions, icons, 3D models) are drawn procedurally in code in this
repository. No third-party images, icon packs or stock art. No CC0 assets used yet.

<!-- [task-01] Runtime font provenance: existing stage-0 font binaries are reused unchanged. -->
## Production font copies (task 01)
The game ships `public/fonts/Overpass-400.ttf`, `Overpass-800.ttf`,
`OverpassMono-700.ttf`, `AtkinsonHyperlegibleNext-400.ttf`, and
`AtkinsonHyperlegibleNext-700.ttf`. All five are byte-identical copies of
`mockups/fonts/` in this repository. The corresponding SIL OFL 1.1 texts
are `public/fonts/OFL-Overpass.txt`, `OFL-OverpassMono.txt`,
and `OFL-AtkinsonHyperlegibleNext.txt`; each is colocated with the
fonts it covers. No downloaded graphics are included.

<!-- [task-03] -->
## Production land raster (task 03)
- `public/data/land-50m.json`: compact RLE land texture pre-generated with
  `npm run build:land` from the **Natural Earth land 50m** TopoJSON distributed
  in `world-atlas@2.0.2` (ISC; underlying Natural Earth geography is public domain).
- Regeneration: `node scripts/build-land.mjs`; CI can verify the committed copy
  with `node scripts/build-land.mjs --check`. Reproducible source requires the
  version pinned in `package-lock.json`. No map polygons or external images are
  downloaded or rasterized by a running browser.
- Terrain, forests, rock formations, cloud puffs, city-light points and the
  atmosphere are custom procedural meshes/shaders in `src/render/globe/`.
<!-- [task-33] -->
- Relief and biome regions (`src/render/globe/relief.ts`): ~45 mountain-range ridge lines
  (Alps, Atlas, Scandes, Himalaya, Andes, Rockies, …) and ~16 desert/steppe regions, typed in
  by hand as rounded lon/lat polylines and ellipses from general geographic knowledge (facts,
  not copied map data; no external dataset). Coast distance is derived at runtime from the
  same Natural Earth raster above. Own work.
<!-- [task-06] Procedural assets; no additional third-party binary files. -->
## Task 06 — airport objects and passenger overlay
The pad, runway, terminal, hub tower, capacity-ring seats, and red-and-white curfew
barrier are procedural three.js geometries in `src/render/airports.ts`.
The destination glyph paths in `src/ui/glyphs.ts` are original SVG geometry
carried over from this repository's `mockups/lib/scene.mjs` (D-08).
<!-- [task-10] -->
## Procedural production route and aircraft assets
`src/render/routes.ts` constructs original spherical arc tubes (continuous light widebody, dashed warm turboprop) and horizon ghost materials. `src/render/models/planes.ts` builds original low-poly turboprops and widebodies procedurally: fuselages, wings, tails, propellers and engines. `src/render/planes.ts` adds instanced ground shadows, contrails and five-part occupancy tags. No external binary/image assets or third-party model licences are required.
<!-- [task-19] Runtime audio is procedural, with no external sound files. -->
## Procedural audio (task 19)
All hub tones, congestion drones, departure-board clicks, paper rustle, luggage-tag
clicks, stamps and city bells are synthesized at runtime via Web Audio in
`src/audio/`. The noise buffer is generated from a fixed local seed. No recorded
samples, licensed sound libraries or downloadable audio files are included.
[night-03] `docs/audio/preview-*.wav` are our own offline renders of that engine (`npm run audio:previews`), for listening
only; they are not shipped in the app.
<!-- [task-23] Original procedural art for the temporary first-run vignette. -->
## Onboarding artwork (task 23)
`src/ui/tutorial/index.ts` contains an original SVG-only illustrated globe, three airport terminals,
aircraft and route glyphs; `src/ui/tutorial/tutorial.css` contains the ATC flight strip and
luggage-tag styling. No downloaded imagery, packs, binaries or third-party artwork are used.
The production three.js world will replace this demo illustration after tasks 07/12/13 merge.
## Task 24 — Android launcher and splash
- `resources/icon.svg`, `resources/icon-foreground.svg`, `resources/splash.svg` — original SVG geometry (yellow `#FFC72C` / black `#1C1E20`) authored for Airway, no third-party licence. Node script `scripts/build-android.mjs` generates Android launcher/splash PNG raster assets; no network graphics are used.
- `brand/wayfinding.svg` — matching original airport wayfinding sign/wordmark; Overpass 800 (OFL licence already listed above).
- [N12n] `docs/store/feature-graphic.png` — Google Play feature graphic: our own render of the game scene (globe from Natural Earth data as in the game) with `brand/wayfinding.svg` on the left; no third-party imagery (`npm run store:feature`).
## iOS native art — task 25
- `ios/Brand/app-icon.svg`: byte-identical copy of task 24 `resources/icon.svg` from draft PR #12, original black/yellow Airway airport wayfinding mark.
- `ios/Brand/splash.svg`: byte-identical copy of task 24 `resources/splash.svg`; the opaque iOS PNG composites this mark over a black launch background matching Android.
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: opaque 1024×1024 rendering of the original icon SVG.
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png`: opaque 2732×2732 compositing of the shared transparent splash SVG over Android's black launch background, same PNG bytes across scale slots.
No external images or fonts were used. Sources match task 24 PR #12 as of this commit. After merging task 24, generate from one shared SVG source to avoid drift.
<!-- [task-29] Existing local licensed assets reused by the landing page. -->
## Site assets (task 29)
`site/assets/shots/{pl,en}/{night,game,upgrade,menu}.jpg` (N11ad, D-218) are project-made 540×960 JPEG downscales of our own store screenshots `docs/store/shots/<lang>/<scene>-phone.png`, produced by `npm run site:assets` (`site/make-assets.mjs`; source hashes in `site/assets/shots/sources.json`). The stage-0 concept copies `game-p.png`, `upgrade-p.png`, `menu-p.png` were removed from `site/assets/`. The social preview `og-image.png` is a build-time copy of our own `docs/store/feature-graphic.png` (D-117) into `site/dist/` only. No store badge artwork is committed yet: when a store link is set, the official Google Play / App Store badge goes to `site/assets/badges/` with its own entry here (brand rules of Google and Apple). The five `site/fonts/*.ttf` files and three neighboring OFL notices are byte-identical to the existing files in `public/fonts/`. The new SVG favicon, illustrated fallback globe and Canvas 2D globe are project-authored procedural artwork. No external image or font source is loaded by the deployed site.

[N11ae] R2e, D-219: `site/assets/shots/{pl,en}/<scene>-landscape.jpg` are project-made 960×540 JPEG downscales of our own `docs/store/shots/<lang>/<scene>-landscape.png`; `site/assets/press/airway-wordmark.png` (1920×520) and `airway-icon.png` (1024×1024) are PNG renders of our own `brand/wayfinding.svg` (with the OFL Overpass 800 already listed) and `resources/icon.svg`, all made by `npm run site:assets`. The press kit ZIP (`site/dist/airway-press-kit.zip`, built, not committed) contains only these project files and the store PNGs; no third-party image.

## Globe look experiment (ext/03, DEV only — not in the build)
Textures under `dev/globe-look/assets/`, baked by `python3 -I dev/globe-look/bake.py <downloads>` (Pillow + NumPy) from
public-domain sources. Served only by the Vite dev server for `?globeLook=` (D-170); `npm run build` does not copy
`dev/`. Downloaded 2026-11-03; the originals are not committed.

| File | Source | Licence |
|---|---|---|
| `satellite-day-{4096,2048}.jpg` | NASA Earth Observatory, **Blue Marble Next Generation**, July 2004 (D-176), topography + bathymetry (`world.topo.bathy.200407.3x5400x2700.jpg`, Reto Stöckli, NASA GSFC) — graded (−haze, +8 % contrast), resized | Public domain (NASA imagery, no copyright; credit "NASA Earth Observatory") |
| `satellite-night-{2048,1024}.jpg` | NASA Earth Observatory, **Black Marble 2016** (`BlackMarble_2016_3km.jpg`, NASA Earth Observatory / Joshua Stevens, Suomi NPP VIIRS) — dark floor removed, greyscale | Public domain (NASA) |
| `map-{4096,2048}.jpg` | Blue Marble NG July classified into own map palette (vegetation / dry / ice / sea), ETOPO5 hillshade and depth, country borders from **Natural Earth admin-0 50m** (`world-atlas@2.0.2` `countries-50m.json`, via `dev/globe-look/borders.mjs`) | Public domain sources (NASA, NOAA, Natural Earth); processing own work (CC0) |
| `painted-{4096,2048}.jpg` | Blue Marble NG, July 2004 (`world.topo.bathy.200407…`) simplified (median, 56-colour palette, mode filter), own sea ramp and hillshade from ETOPO5 | Public domain sources; processing own work (CC0) |
| `painted-night-{2048,1024}.jpg` | Black Marble 2016, blurred | Public domain (NASA) |
| `elevation-2048.png` | NOAA NGDC **ETOPO5** 5-arc-minute relief (`ETOPO5.DAT`), land only, sqrt-encoded 8 bit | Public domain (US Government work, NOAA) |
| `clouds-2048.png` | Procedural fractal noise with latitude belts (`bake.py`) | Own work (CC0) |

Source URLs (2026-11-03): `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/`,
`https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg`,
`https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DAT`. NASA imagery policy: not copyrighted, use
"NASA Earth Observatory" as credit; it must not imply NASA endorsement and may not use the NASA insignia (we do not).

## Production globe textures (G1, D-170/D-171)
`public/data/globe/` ships with the app (1.77 MB; checked by `npm run test:globe-assets` against `manifest.json`:
SHA-256, size, format, 2:1 power-of-two dimensions, per-file caps, total ≤ 2 MB). Same bake and sources as the
experiment table above (`python3 -I dev/globe-look/bake.py <downloads> satellite elevation clouds`, then copy and
`node scripts/test-globe-assets.mjs --write`). Credited in Settings → Licences (PL/EN): "NASA Earth Observatory
(Blue Marble, Black Marble)" and "NOAA ETOPO5", both public domain. Not yet drawn by the game: G2/G3 switch the globe.

| File | Source | Licence |
|---|---|---|
| `day-4096.jpg`, `day-2048.jpg` | NASA Blue Marble NG, July 2004 (D-176), topography + bathymetry, graded | Public domain (NASA) |
| `night-2048.jpg`, `night-1024.jpg` | NASA Black Marble 2016, lights only | Public domain (NASA) |
| `elevation-2048.png` | NOAA ETOPO5, land elevation, `m = (v/255)² · 8000` | Public domain (NOAA) |
| `clouds-2048.png` | procedural (bake.py) | Own work (CC0) |
| `map-4096.jpg`, `map-2048.jpg` (G8, D-172) | Mapa mode: Blue Marble NG July classified into an own palette, ETOPO5 hillshade, Natural Earth admin-0 borders (`dev/globe-look/bake.py map`) | Public domain sources; own processing (CC0) |

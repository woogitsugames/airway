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
| Libre Franklin | 500, 700, 700 italic | KARTA v2 B "Nadruk" (fetched 2026-11-05) | yes |
| Source Serif 4 | 400, 700 | KARTA v2 B "Nadruk" clock (fetched 2026-11-05) | yes |
| Familjen Grotesk | 400, 700 | Poczta lotnicza text, overview sheets | yes |
| Alegreya SC | 500, 800 | Atlas headlines/labels | yes |
| Alegreya | 400, 700 | Atlas text; KARTA v2 C "Róża" mockups; [N11az] shipped Róża skin, 700 as a WOFF2 subset in `public/fonts/` (D-257); [N46a] removed from `public/fonts/` with Róża (D-301) | yes |
| Big Shoulders Display | 500, 800 | Mapa pilota (rejected) | yes |
| IBM Plex Sans Condensed | 400, 600 | Mapa pilota (rejected) | yes |
| IBM Plex Mono | 400, 600 | Mapa pilota (rejected); UI direction mockups 2026-11 "Karta"; [N11au] KARTA preview skin (D-256); [N11ax] KARTA skin WOFF2 subset (draft D-257, not shipped: [N11az] Róża was chosen) | yes |
| Martian Mono, Overpass Mono | 400, 700 | downloaded for evaluation, currently unused | yes |
| Barlow Condensed | 500, 700 | UI direction mockups 2026-11 "Karta" (`mockups/ui-2026-11/`); [N11au] KARTA preview skin (D-256); [N11ax] KARTA skin WOFF2 subset (draft D-257, not shipped: [N11az] Róża was chosen) | yes |
| Archivo Narrow | 500, 700 | UI direction mockups 2026-11 "Kokpit" | yes |
| Atkinson Hyperlegible Mono | 400, 700 | UI direction mockups 2026-11 "Kokpit" | yes |
| Besley | 800, 900 | [N27a] direction A "Linoryt" frames; [N28a] Linoryt preview skin (D-284), static WOFF2 subsets in `public/fonts/`; [N46a] shipped (D-301) | yes |
| Schibsted Grotesk | 500–700 (variable) | [N27a] directions A and C frames; [N28a] Linoryt preview skin (D-284), WOFF2 subset in `public/fonts/`; [N46a] shipped (D-301) | yes |
| Archivo | 600 (wdth 100); 700, 800 (wdth 80) | [N66a] UI-A mockups (`docs/styles/kierunki-2026-11c/makiety/ui-a/fonts/`); [N69a] UI-A preview skin (D-324), static WOFF2 subsets in `public/fonts/`, kept out of `dist/` until T6 | yes |
| Chivo Mono | 500–800 (variable) | [N66a] UI-A mockups; [N69a] UI-A preview skin (D-324), WOFF2 subset in `public/fonts/`, kept out of `dist/` until T6 | yes |

[N11au] D-256: the DEV-only KARTA preview skin (`src/ui/skin/karta.css`, `?skin=karta`) loads Barlow Condensed and IBM
Plex Mono straight from `mockups/fonts/` through the Vite dev server (licences `mockups/fonts/OFL-BarlowCondensed.txt`,
`OFL-IBMPlexMono.txt`); they are not in `public/fonts/` and never reach `dist/` or the apps. If the owner picks KARTA,
the shipped files move to `public/fonts/` with their licences (WOFF2 subset, see D-252 "Next levers").

[N11az] D-257 (owner, 2026-11-05): Róża (KARTA v2 C) is the shipped skin, so KARTA's Barlow Condensed and Airway
Chart Mono subsets are not shipped (removed from `public/fonts/` with their licence files). Róża sets names and titles in
**Alegreya 700**: `public/fonts/Alegreya-700.woff2` (23.9 kB) is a subset of `mockups/fonts/Alegreya-700.ttf` (SIL OFL
1.1, The Alegreya Project Authors), made with fontTools `pyftsubset --flavor=woff2
--unicodes="U+0020-007E,U+00A0-017F,U+2000-206F,U+20AC,U+2190-2199,U+2212,U+2116,U+2122,U+00B7"
--layout-features='kern,liga,tnum,lnum,case,ccmp,locl,mark,mkmk'`. The Alegreya OFL declares no Reserved Font Name, so
the subset keeps its name. Licence next to it: `public/fonts/OFL-Alegreya.txt`. The one glyph the subset lacks (U+202F)
falls back to the shipped Atkinson Hyperlegible Next / Overpass named after it in `--skin-face-display`.
[night-46a] D-301: Róża is gone (Linoryt ships), so `Alegreya-700.woff2` and `OFL-Alegreya.txt` are removed from
`public/fonts/` and Settings → Licences; the subset command above stays the recipe for the Linoryt subsets.

[night-28a] D-283/D-284 "Linoryt": **Besley** (SIL OFL 1.1, Copyright 2020 The Besley Project Authors,
github.com/indestructible-type/Besley) and **Schibsted Grotesk** (SIL OFL 1.1, Copyright 2023 The Schibsted-Grotesk
Project Authors, github.com/schibsted/schibsted-grotesk), from `docs/styles/kierunki-2026-11b/fonts/` (night 27a).
`public/fonts/Besley-800.woff2` (21.0 kB) and `Besley-900.woff2` (20.5 kB) are static instances of `Besley-VF.ttf`
(`fonttools varLib.instancer … wght=800` / `wght=900`); `public/fonts/SchibstedGrotesk-VF.woff2` (46.0 kB) is the
variable font limited to `wght=500:700`; all three subset with the Alegreya command above (same `--unicodes` and
`--layout-features`, `--flavor=woff2`). Neither licence declares a Reserved Font Name, so the subsets keep their names.
Licences next to them: `public/fonts/OFL-Besley.txt`, `public/fonts/OFL-SchibstedGrotesk.txt`. Gaps: Besley has no
U+2192 or U+202F, Schibsted Grotesk no U+2009 or U+202F. [night-46a] D-301 (step U5): the five files ship in `dist/`
and the apps (`PREVIEW_FONTS` is empty) and Settings → Licences lists both faces (`licenses.besley`,
`licenses.schibsted`). The gaps are covered by the `--skin-face-*` stacks (`'Besley', 'Atkinson Hyperlegible Next',
'Overpass', serif`; `'Schibsted Grotesk', 'Atkinson Hyperlegible Next', 'Overpass', sans-serif`): the browser draws a
missing character with the next shipped face that has it (Atkinson for U+2009, Overpass for U+202F and U+2192, as
Atkinson itself borrows U+2192 from Overpass by `unicode-range` in `src/ui/fonts.css`), so no extra `@font-face` is
needed; `npm run test:glyphs` checks every catalog string, city name and wave-1 letter against each face with that
fallback.

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
[N11ax] D-257: the game loads these five as `public/fonts/*.woff2` (`src/ui/fonts.css`),
a lossless WOFF2 conversion of the TTFs with fontTools (`TTFont(ttf).flavor = 'woff2'`; same glyphs and cmap, no
subsetting, names unchanged — none of the three licences declares a Reserved Font Name). The TTFs stay in `public/fonts/`
for `dev/globe.html` and `scripts/store-shots.mjs`; `scripts/vite-font-files.mjs` leaves them out of `dist/`.

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
<!-- [night-72a R2] -->
- `public/data/borders-50m.json` (D-327): country land borders for the NASA globe preview, generated with
  `npm run build:borders` (`scripts/build-borders.mjs`) from the **Natural Earth 1:50m admin-0 countries** TopoJSON in
  `world-atlas@2.0.2` (ISC; Natural Earth data public domain): arcs shared by two countries, simplified (0.02°) and
  quantised (0.01°); the Crimean isthmus line and the Northern Cyprus / Somaliland lines are left out. Verified by
  `npm run test:borders`. Left out of `dist/` until the flip (`PREVIEW_DATA_FILES`).
- Atlas label anchors (`src/data/atlasLabels.ts`) and their PL/EN names: own work from general geographic knowledge
  (conventional short names; Polish after the KSNG lists).
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
## App mark I-1 "Węzeł" — launcher, store and launch art (night 78a, D-333)
Our own mark (D-326): two circles and two triangles, cream `#EFE7D3` and yellow `#F3C317` on enamel `#0E0F0F`, no font, no
third-party shape. `resources/icon.svg`, `icon-foreground.svg`, `icon-monochrome.svg`, `splash.svg`, `ios/Brand/*.svg` and
`site/assets/favicon.svg` are written by `scripts/icon-assets.mjs` (`npm run icons`); PNGs (`docs/store/icon-512.png`, the iOS
`AppIcon-*.png` and `splash-2732x2732*.png`, the press-kit `airway-icon.png`, the git-ignored Android mipmaps and splash) are
rendered from them. This replaces the task 24/25 wayfinding-sign icon below.
## iOS native art — task 25 (superseded by the mark I-1 above)
- `ios/Brand/app-icon.svg`: byte-identical copy of task 24 `resources/icon.svg` from draft PR #12, original black/yellow Airway airport wayfinding mark.
- `ios/Brand/splash.svg`: byte-identical copy of task 24 `resources/splash.svg`; the opaque iOS PNG composites this mark over a black launch background matching Android.
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: opaque 1024×1024 rendering of the original icon SVG.
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png`: opaque 2732×2732 compositing of the shared transparent splash SVG over Android's black launch background, same PNG bytes across scale slots.
No external images or fonts were used. Sources match task 24 PR #12 as of this commit. After merging task 24, generate from one shared SVG source to avoid drift.
<!-- [task-29] Existing local licensed assets reused by the landing page. -->
## Site assets (task 29)
`site/assets/shots/{pl,en}/{night,game,upgrade,menu}.jpg` (N11ad, D-218) are project-made 540×960 JPEG downscales of our own store screenshots `docs/store/shots/<lang>/<scene>-phone.png`, produced by `npm run site:assets` (`site/make-assets.mjs`; source hashes in `site/assets/shots/sources.json`). The stage-0 concept copies `game-p.png`, `upgrade-p.png`, `menu-p.png` were removed from `site/assets/`. The social preview `og-image.png` is a build-time copy of our own `docs/store/feature-graphic.png` (D-117) into `site/dist/` only. No store badge artwork is committed yet: when a store link is set, the official Google Play / App Store badge goes to `site/assets/badges/` with its own entry here (brand rules of Google and Apple). The five `site/fonts/*.ttf` files and three neighboring OFL notices are byte-identical to the existing files in `public/fonts/`. The new SVG favicon, illustrated fallback globe and Canvas 2D globe are project-authored procedural artwork. No external image or font source is loaded by the deployed site.

[N11ae] R2e, D-219: `site/assets/shots/{pl,en}/<scene>-landscape.jpg` are project-made 960×540 JPEG downscales of our own `docs/store/shots/<lang>/<scene>-landscape.png`; `site/assets/press/airway-wordmark.png` (1920×520) and `airway-icon.png` (1024×1024) are PNG renders of our own `brand/wayfinding.svg` (with the OFL Overpass 800 already listed) and `resources/icon.svg`, all made by `npm run site:assets`. The press kit ZIP (`site/dist/airway-press-kit.zip`, built, not committed) contains only these project files and the store PNGs; no third-party image.

## Globe data (D-170 → E4, D-285 → D-323, D-325)
`public/data/globe/` holds five files, checked by `npm run test:globe-assets` against `manifest.json` (SHA-256, size,
format, 2:1 power-of-two dimensions, a cap per file) and against any source that still asks for a removed texture.

| File | Source | Licence |
|---|---|---|
| `elevation-2048.png` | NOAA NGDC **ETOPO5** 5-arc-minute relief (`ETOPO5.DAT`, `https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DAT`, downloaded 2026-11-03), land only, sqrt-encoded 8 bit `m = (v/255)² · 8000`; baked by `python3 -I dev/globe-look/bake.py <downloads> elevation` | Public domain (US Government work, NOAA) |
| `day-4096.webp` (529 kB), `day-2048.webp` (172 kB) | **NASA Blue Marble Next Generation**, topography + bathymetry, **July 2004** (D-176), `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg` (5400×2700, 8 km/px), downloaded 2026-11-08; resized (Lanczos) and saved as WebP q80 by `python3 -I dev/globe-look/bake-earth.py <downloads>`; the grading is in the shader | Public domain (US Government work, NASA Earth Observatory; NASA logos and insignia excluded, none used) |
| `night-2048.webp` (60 kB), `night-1024.webp` (18 kB) | **NASA Black Marble 2016**, colour, `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg` (13500×6750, Visible Earth record 144898; data VIIRS / Suomi NPP, M. Román, J. Stevens), downloaded 2026-11-08; resized, WebP q78, same script; the city lights are split from the blue base in the shader | Public domain (as above) |

[night-70a R1] D-325: WebP was chosen by measurement (the same four textures as JPEG q82–84 weigh 1 506 kB, as WebP
q78–80 778 kB, no visible difference at the game zoom; WebP decodes in every supported WebView: the Chromium Android System WebView and WKWebView on iOS 15+, the deployment target).
`eoimages.gsfc.nasa.gov` serves the same files but drops long transfers through the agent proxy; use assets.science.nasa.gov.
The 500 m/px Blue Marble tiles (`…3x21600x21600.{A1…D2}.jpg`) are not used: the 4096 level comes from the 5400 image
(an option for `high` only after a memory measurement on a device).

**In the release, not drawn yet.** [night-79a R4] D-334: the NASA globe is in the release build behind
`DEFAULT_GLOBE_LOOK` (still the print until the flip, PLAN-NOWY-KIERUNEK.md R5), so `dist/` and the apps carry the four
photo textures and `data/borders-50m.json` (`PREVIEW_GLOBE_FILES` / `PREVIEW_DATA_FILES` in
`scripts/vite-globe-preview.mjs` are empty; `npm run test:bundle` checks they are in `dist/`). Nothing in a release
loads them before the flip. Settings → Licences regains "NASA Earth Observatory (Blue Marble, Black Marble)" (key
`licenses.nasaEarth`, PL and EN) at the flip (T6), when they are drawn (the images are public domain). The Linoryt print (D-283) still draws everything from the elevation raster and the Natural Earth land
raster at load: the coast distance field and the Imhof shadow (D-298), the plane silhouettes from the skin's own icon
paths (D-299).
**Removed in E4 (ext/04, D-285) and still forbidden:** `map-{4096,2048}` (Mapa, D-172), `clouds-2048.png`
(procedural), the old JPEG names `day-{4096,2048}.jpg` / `night-{2048,1024}.jpg` (the E4 night files were lights only;
R1 needs the blue base) and the DEV comparison textures under `dev/globe-look/assets/`. The old production textures are in
git history (`git show 79d9001^:public/data/globe/day-4096.jpg` etc.). Never shipped: tiles or screenshots of Google
Earth/Maps, Apple Maps, Mapbox, Cesium Ion, Flightradar24 (look references only, D-323). Borders and labels stay vector
Natural Earth via `world-atlas`. The 2026-11c mockups fetch their own textures into a git-ignored folder (section
"Art-direction mockups 2026-11c", added by PR #346).

## Art-direction mockups 2026-11b (night 27a, D-282; not shipped)
`docs/styles/kierunki-2026-11b/fonts/` holds four SIL OFL 1.1 variable fonts, fetched 2026-11-06 straight from
github.com/google/fonts (`ofl/<dir>/<Family>[axes].ttf`), each with its licence `OFL-<dir>.txt` next to it. Polish
glyphs (ą ć ę ł ń ó ś ź ż and capitals) checked with fontTools: all present. Used only by the mockups in
`docs/styles/kierunki-2026-11b/src/`; nothing reaches `public/`, `dist/` or the apps.
[ext-04] D-317: `docs/styles/kierunki-2026-11b/znak/` (app mark sketches A/B/C, SVG + PNG + sheet) is our own work,
generated by `src/app-icon.mjs` from the project's dock silhouettes (`src/icons.js`); no font, image or third-party
shape. Not shipped (the launcher icons in `android/` and `ios/` are unchanged).

| Family | Axes | Used in | Licence file |
|---|---|---|---|
| Besley | wght 400–900 | A "Linoryt" headings, clock, names | `OFL-besley.txt` |
| Schibsted Grotesk | wght 400–900 | A "Linoryt" text; C "Makieta" text; contact sheet | `OFL-schibstedgrotesk.txt` |
| Anybody | wdth 50–150, wght 100–900 | B "Gwasz" all text | `OFL-anybody.txt` |
| Big Shoulders Stencil Display | wght 100–900 | C "Makieta" clock, numbers, title | `OFL-bigshouldersstencildisplay.txt` |

The globe in every frame is drawn by our own code (`src/globe.js`) from Natural Earth land via `world-atlas`
(public domain / ISC) and the game's own ETOPO5 elevation raster (`public/data/globe/elevation-2048.png`, see
"Production globe textures"); no photo texture is used. Icons, glyph layouts and all PNGs: own work (CC0). Games and
print references in `RESEARCH.md` are links only; no third-party image is committed.

## Art-direction mockups 2026-11c, K1 "Atlas satelitarny" / K2 "Nawigacja nocna" (night 64a; not shipped)
`docs/styles/kierunki-2026-11c/makiety/fonts/` holds static SIL OFL 1.1 TTFs fetched 2026-11-08 with
`mockups/fetch-fonts.sh` (Google Fonts CSS API; licence from github.com/google/fonts `ofl/<dir>/OFL.txt`, saved as
`OFL-<Family>.txt` next to the fonts). Polish glyphs (ą ć ę ł ń ó ś ź ż and capitals) checked with fontTools: all
present; U+2192 is missing in Newsreader (the mockups set arrows in Hanken Grotesk). Used only by
`docs/styles/kierunki-2026-11c/makiety/src/`; nothing reaches `public/`, `dist/` or the apps.

| Family | Weights | Used in | Licence file |
|---|---|---|---|
| Newsreader (+ Italic 500) | 400–700 | K1 city/country/sea labels, headings, title | `OFL-Newsreader.txt` |
| Hanken Grotesk | 400–700 | K1 UI text and numbers (tabular) | `OFL-HankenGrotesk.txt` |
| Manrope | 400–800 | K2 labels, UI text, title | `OFL-Manrope.txt` |
| Sofia Sans Condensed | 500–800 | K2 clock and numbers | `OFL-SofiaSansCondensed.txt` |

### UI-A "Lotniskowa tablica i paski lotu" (night 66a; not shipped)
`docs/styles/kierunki-2026-11c/makiety/ui-a/fonts/` holds two SIL OFL 1.1 variable TTFs fetched 2026-11-08 from
github.com/google/fonts (`ofl/archivo/Archivo[wdth,wght].ttf`, `ofl/chivomono/ChivoMono[wght].ttf`), licences saved
next to them. Polish glyphs (ą ć ę ł ń ó ś ź ż and capitals) checked with fontTools: all present in both; U+2192 is
missing in Chivo Mono (browser fallback; the mockup draws its arrows as SVG). Used only by `makiety/ui-a/src/`, which
reuses the K2 globe (`makiety/src/globe.js`, same NASA textures in the git-ignored `makiety/.tex/`).

| Family | Axes | Used in | Licence file |
|---|---|---|---|
| Archivo (Copyright 2020 The Archivo Project Authors) | wdth 62–125, wght 100–900 | split-flap board, airfield signs, labels, keys | `OFL-Archivo.txt` |
| Chivo Mono (Copyright 2019 The Chivo Project Authors) | wght 100–900 | flight strips, teleprinter report | `OFL-ChivoMono.txt` |

[night-69a] D-324 (PLAN-NOWY-KIERUNEK.md step T1): the game's DEV-only UI-A preview (`?skin=board`,
`src/ui/skin/board.css`) loads WOFF2 subsets of those two TTFs from `public/fonts/`, with the licences copied next to them
(`public/fonts/OFL-Archivo.txt`, `public/fonts/OFL-ChivoMono.txt`). Archivo ships as static instances of the used widths
and weights only (the full variable file is 659 kB): `Archivo-600.woff2` (wght 600, wdth 100; 14.0 kB),
`Archivo-80-700.woff2` (wght 700, wdth 80; 15.2 kB) and `Archivo-80-800.woff2` (wght 800, wdth 80; 15.1 kB), made with
`fonttools varLib.instancer Archivo-VF.ttf wght=W wdth=D`; `ChivoMono-VF.woff2` (18.8 kB) is the variable font limited to
`wght=500:800`. All four are subset with the Alegreya command above (same `--unicodes` and `--layout-features`,
`--flavor=woff2`). Neither licence declares a Reserved Font Name, so the subsets keep their names. Gaps: U+202F in all,
U+2192 in Chivo Mono; the `--board-face` / `--board-mono` stacks (`'Archivo'|'Chivo Mono', 'Atkinson Hyperlegible Next',
'Overpass', …`) draw them with the shipped faces (`npm run test:glyphs`). Until the flip (T6) the six files are listed in
`PREVIEW_FONTS` (`scripts/vite-font-files.mjs`), so `dist/` and the apps do not carry them and Settings → Licences does
not list them yet; T6 ships them (and adds the licence entries). The source TTFs stay in `makiety/ui-a/fonts/`
(the mockup renderer reads them there).

Globe imagery (downloaded 2026-11-08 by `src/fetch-textures.sh` from assets.science.nasa.gov into the git-ignored
`makiety/.tex/`; **not committed, not shipped**): NASA Blue Marble Next Generation, June 2004, topography + bathymetry
(`world.topo.bathy.200406.3x5400x2700.jpg` and the 500 m/px tile `…3x21600x21600.C1.jpg`, cropped to 0–64°E,
18–66°N) and NASA Black Marble 2016 colour (`BlackMarble_2016_3km.jpg`, 13500×6750, resized to 8192×4096). NASA
imagery is not copyrighted in the US (public domain; NASA logos/insignia excluded, none used); credit "NASA Earth
Observatory". It appears baked into the committed mockup PNGs only. Borders: Natural Earth via `world-atlas`
(public domain / ISC). Shader, atmosphere, routes, labels, HUD, aircraft silhouettes (from 2026-11b `icons.js`) and
D-08 glyphs: own work (CC0).

## Reference material — real aeronautical charts (task 12bl, not shipped)
`docs/references/charts/` holds 16 JPEG crops (each < 1 MB, ≈ 3.5 MB total) and a contact sheet `plansza.png` used
only to choose the UI direction (KARTA). Nothing there is imported by the app, the site or the store builds. All
crops are U.S. Government works — FAA sectional / terminal area charts and d-TPP (airport diagram, ILS, SID, STAR),
U.S. Coast and Geodetic Survey and Department of Commerce sectional charts 1935–1956 scanned by the Library of
Congress (`gct00089`) — public domain under 17 U.S.C. § 105. Per-file source URL, title, date and retrieval route:
`docs/references/charts/SOURCES.md`. Contact-sheet layout: own work (CC0).

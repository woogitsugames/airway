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

Rejected: **B612 / B612 Mono** (OFL, Airbus cockpit face) — no Polish diacritics (ą ć ę ł ń ś ź ż missing), checked with fontTools.

## Map data
- `world-atlas` 2.0.2 (ISC) — TopoJSON of **Natural Earth** land 110m/50m (public domain). npm dev dependency.

## Libraries (dev only, mockups)
- `d3-geo` 3.x (ISC), `topojson-client` 3.x (ISC), `three` 0.170 (MIT). Playwright is pre-installed in the environment (Apache-2.0), not a dependency.

## Graphics
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

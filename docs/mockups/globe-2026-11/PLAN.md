# Globe look (D-170) — implementation plan: direction B "Realistyczny"

Owner's choice 2026-11-03 (D-170): the globe moves from the low-poly "Diorama" terrain to a **realistic satellite
globe** — NASA Blue Marble colours, Black Marble city lights at night, real relief (NOAA ETOPO5), a cloud shell,
an ocean surface with sun glint and a sun-aware atmosphere. The airport objects, routes, planes and the paper UI of
D-11 stay as they are: they are the illustrated layer on top of a real Earth.

The experiment that produced the mockups is in the tree behind a DEV flag (`?globeLook=satellite`, see
`README.md` here): `src/render/globe/look.ts`, `TerrainStyle` in `terrain.ts`, assets in `dev/globe-look/assets/`.
Production still builds the diorama until G2. Each step below is one PR to `dev`, in order; every step keeps
`npm run test:fast` and `npm run build` green and updates `docs/PERFORMANCE.md` where it changes a number.

Budgets this plan works to (SwiftShader orientation numbers in `README.md`; device targets unchanged, PERFORMANCE.md):
draw calls ≤ 50; terrain triangles per preset unchanged (≤ 35 k / 160 k / 200 k drawn); full-screen transparent
layers ≤ 2 on `low`/`saver`, ≤ 3 on `medium`/`high`; GPU texture memory ≤ 16 MB `low`, ≤ 48 MB `medium`/`high`;
shipped globe assets ≤ 2.2 MB (bundle `total` budget raised accordingly, D-171).

## G1 — Production assets and licences
- Move the bake to a reproducible, checked tool: `scripts/build-globe-textures.mjs` (or keep `bake.py` as the one
  documented dev tool) writing `public/data/globe/`: `day-4096.jpg`, `day-2048.jpg`, `night-2048.jpg`,
  `night-1024.jpg`, `elevation-2048.png`, `clouds-2048.png` (~1.9 MB together). Originals are downloaded by the
  script from the URLs in `docs/ASSETS.md`, never committed; outputs committed with SHA-256 in a manifest.
- Season: Blue Marble NG **July** for the whole game (D-176, owner).
- `docs/ASSETS.md`: move the experiment table to a production section (NASA Earth Observatory credit; ETOPO5 NOAA).
  Credits line in the settings "About" page (PL/EN i18n) — "Obrazy Ziemi: NASA Earth Observatory (Blue Marble,
  Black Marble); rzeźba terenu: NOAA ETOPO5".
- `scripts/test-bundle.mjs`: raise `total` from 2 200 kB to 4 300 kB (D-171), main JS unchanged.
- New fast test `test:globe-assets`: files exist, dimensions are powers of two (2:1), JPEG/PNG headers, sizes under
  per-file caps, manifest hashes match.

## G2 — Terrain from real elevation (lands together with G3)
- [ext-03, after G1] G2 alone would draw a white globe (the textured style has white vertex colours), so G2 and G3
  are one PR (or G2 stays behind the DEV flag until G3); that PR changes the shipped look, so its gate adds
  `test:e2e:smoke`, `ui:matrix` and `store:shots --validate` to `test:fast` + `build`.
- `src/render/globe/terrain.ts`: make the `textured` `TerrainStyle` the production path: land height from
  `elevation-2048.png` (sqrt exaggeration, `0.0004 + 0.0052·√km`), airport pads still flattened (`airportFlatten`),
  coast snapping and adaptive refinement unchanged, smooth vertex normals (`normals` in `TerrainArrays`, already
  carried by `lod.ts`). Sea floor drops below the ocean shell at the coast.
- Elevation decode moves off the critical path: decode once (canvas `getImageData`, ~20 ms desktop) in parallel
  with the land mask; `createGlobe` awaits both.
- Remove the per-facet biome colouring from the production path (`biomeColor`, `refinedColor`, the `refined` style);
  `relief.ts` keeps only what decorations still need (nothing after G5 → delete in G5).
- Tests: `test:land` (triangle budgets unchanged, vertex count, no folded facets, airport pads at 1.0036),
  `test:quality` (LOD culling unchanged), `test:framing`.

## G3 — Textured material, day/night and city lights
- `look.ts` → `src/render/globe/surface.ts`: the textured terrain material (equirectangular lookup by direction with
  seam-safe `textureGrad`, the shipped day/night grade via `patchDayNightShader`, Black Marble emission on the night
  side). Texture size per preset: `low`/`saver` 2048 day + 1024 night, `medium`/`high` 4096 + 2048; adaptive
  quality gets a new first step "day texture 4096 → 2048" (D-173) before DPR.
- Drop the `Points` city lights (Black Marble replaces them); `setDecorDensity` no longer thins lights.
- Retune `daynight.ts` for photographic albedo: the D-49 sand mask works on texture colour (check Arabia/Sahara at
  night), the warm terminator band must still pass the D-63 golden gate (`GOLD_MIN = 0.045`, `test:store-shots`).
- Tests: `test:daynight` (grade constants), `test:render-layers`, D-47 contrast probe ≥ 4.5:1 for routes/airports/
  planes in `game` and `night` (mockup values in `README.md`).

## G4 — Ocean, atmosphere, clouds (fill-rate aware)
- Fold the ocean glint/fresnel and the near-limb haze into the terrain fragment shader (sea mask = elevation ≤ 0 or
  a 1-bit water channel), so they cost no extra full-screen layer; keep the outer halo (`createScatterAtmosphere`
  outer shell) as the only transparent shell on `low`/`saver`.
- Cloud shell (`clouds-2048.png`, under the airport pads at r = 1.0048, slow drift by uniform offset): `medium` and
  `high` only; battery saver and the adaptive "decorations" step turn it off.
- Tests: `test:quality` (layer list per preset), `world.stats()` gets `transparentLayers`.

## G5 — Decorations and dead code
- Remove trees, rocks and puffy clouds from the globe (`decorations.ts`, `decor-cull.ts`, D-75 → superseded),
  `DECOR` counts, and their adaptive/battery-saver steps (D-73 ladder: DPR → clouds off → texture 2048 → terrain).
- Delete `relief.ts` and the diorama colouring if nothing else imports them; `test:arch` stays green.
- Update `docs/PERFORMANCE.md` "Globe detail budget" and "LOD" tables (decorations gone: −75 k triangles medium).

## G6 — Menu, store, site and style docs
- Menu globe framing (`menuFraming`, `menuNetwork.ts`): check the dark-sky contrast of the departure board over a
  realistic globe; `test:contrast`.
- Regenerate `npm run store:shots` (60 PNGs + feature graphic, D-117), `npm run ui:matrix`, `npm run shots:site`;
  inspect every PNG against the forbidden list (no generic "Google Earth" stock look: the airport objects and paper
  UI must carry the identity).
- `docs/styles/diorama.md` → new `docs/styles/realistyczny.md` (Polish): palette is now the photo + UI palette,
  what stays from D-11. D-11 status note: "globe superseded by D-170, UI in force".

## G7 — Performance and device verification
- `npm run perf:scene` for `saver`/`low`/`medium`/`high` with the final globe; `npm run perf:overlay`.
- Hardware checklist (PERFORMANCE.md): GPU memory (4096² RGBA + mips ≈ 43 MB uncompressed — if a Mali-G52 class
  phone stutters, G7b: KTX2/ETC1S via `KTX2Loader` + Basis transcoder, ~4–6× less GPU memory, D-174), first-frame
  time (JPEG decode of the 4096 texture ≈ 100–200 ms on a phone), sustained 30 FPS on `low`.
- Fold 8 Ultra (owner's device): `medium`, unfolded portrait/landscape, compare with the owner's screenshot.

## G8 — Second mode "Mapa" (D-172)
- A second surface texture set (`map-day-{4096,2048}.jpg`, `map-night-1024.jpg`) baked by the same tool from the
  look the owner picks from her reference (candidates: C "Pomiędzy" + Natural Earth country borders, or a
  hypsometric atlas), same relief mesh and shaders; switching swaps the `awDay`/`awNightLights` uniforms (no rebuild,
  one upload, the previous texture disposed).
- Setting `globeMode: 'satellite' | 'map'` (default `satellite`) in `src/ui/settings/settings.ts` (PL/EN i18n);
  one luggage tag in the dock (64×62 dp, ≥ 48 dp target, icon by shape: globe-photo vs folded map, own SVG) toggles it
  in game; `test:i18n`, `test:overlay-layout`, `edge-dock` E2E, `ui:matrix` (dock now has one more tag: check 320 dp).
- Store shots stay in Satelita; one optional extra listing image in Mapa only if the owner asks.

## G9 — Airport objects, routes and planes for the new globe (D-175)
- Owner style decision first: render 2–3 variants from the engine (`dev/globe-look/shots.mjs`, same seed-15 frame,
  Satelita and Mapa, day/dusk, Fold/phone) — e.g. (a) dark-ink pad with a light runway and a coloured rim,
  (b) a realistic apron (asphalt grey, white markings) with a coloured hub ring, (c) a cut-out "map pin" medallion
  that is not a Google pin; routes as a dark-cored tube with a light halo (readable on both modes), planes with
  an ink outline. Present side by side, ask the owner, record D-17x.
- Variants rendered 2026-11-03 night: `g9/` (V1 Tusz, V2 Płyta, V3 Medalion; DEV `?airportStyle=`), Claude
  recommends V3; the owner picks.
- D-177: `measureLayerContrast` must measure edge contrast (the outline vs the globe, the core vs the outline),
  not the median of all layer pixels, or outlined designs score lower than they read.
- Implement in `src/render/airports.ts`, `routes.ts`, `planes.ts`, `routePreview.ts` with a mode-dependent ink
  uniform (`setGlobeMode`), no extra draw calls; the D-47 probe (`measureLayerContrast`) must give ≥ 4.5:1 for
  routes/airports/planes in both modes in `game` and `night`; `test:contrast`, `test:render-layers`, `store:shots`.

## Risks
- **Distinctiveness**: a Blue Marble globe is a common sight; the game's identity now rests on the airport
  objects, routes and paper UI (D-11). Keep them; no generic map pins.
- **Forbidden list**: no flat pastel background (the globe is 3D, lit), no subway-map look, no AI slop in UI — none
  of these is touched by B. Check every store PNG.
- **Licence**: NASA/NOAA imagery is public domain; credit is courtesy, not a condition, but we give it.
- **Readability**: deserts and the Mapa land are bright; airport pads and dashed turboprop routes must keep
  ≥ 4.5:1 (D-47). The mockups pass on seed 15 (README); check the store seed 0xA1A1 in G3.

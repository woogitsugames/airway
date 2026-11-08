# Linoryt: staged implementation plan (D-283, D-284)

Night 28a, 2026-11-07. The owner chose direction **A "Linoryt"** (D-283): world and UI are one relief print in three
inks on paper. This plan turns the frames (`png/a-game.png`, `png/a-menu.png`, sources in `src/dir-a.js`) into the
shipped game in ordered steps. **Each step is one PR to `dev`, owned by one side**: **ext** = the globe session the
owner starts (`src/render/**`, `dev/`), **agent** = UI and everything else (`src/ui/**`, `src/game/**`, `src/i18n/**`,
`e2e/`, `scripts/`, docs). The render hand-off for ext is `docs/notes/linoryt-ext-prompt.md` (paste-ready) with
`docs/notes/linoryt-render-spec.md` (inks, hatching, shapes, API).

## Strategy: preview first, one flip, then removal

`dev` is never broken between steps:

1. **Preview behind DEV flags.** UI: `?skin=linoryt` (DEV only, D-284). Render: `?look=linoryt` (DEV only; the UI
   preview turns it on too once E1 lands). A release build folds both away, so every intermediate PR leaves `dist/`
   unchanged or nearly (budgets untouched while the CSS budget is 99 % used, D-258). Róża and the satellite globe stay
   the shipped look until the flip.
2. **One flip PR (U5)** makes Linoryt the default skin and look, deletes Róża (`roza.css`, `roza.ts`, the Róża i18n
   keys) and the `?skin=current` Diorama comparison, and reclaims CSS budget.
3. **Removal after the flip (E4)** deletes the satellite/map/diorama looks and their textures (~1.9 MB) once nothing
   can select them.

Rejected: shipping Linoryt as a non-default skin in release (`?skin=` in production) — the CSS budget has 1.2 kB
headroom and the skin would double the structure CSS (two skins over the Diorama base); a big-bang PR — untestable and
it would block the store re-record for a week.

Why the UI preview builds on the **base (Diorama) DOM**, not on Róża's: after the flip only the base components remain
(Róża's dial, dock arc, roses and menu arc go), so every Linoryt rule written now survives the flip unchanged except for
its scope (`:root[data-skin="linoryt"] X` → folded into the component CSS or kept under `:root:root` as Róża did).

## What is drawn where (DOM overlay vs world)

| Element (frame) | Where | Why |
| --- | --- | --- |
| Clock, week, "dzień 2 z 3 · 34 pasażerów", day bar (24 carved hours, night solid, red "now" cut) | **DOM** (HUD top margin) | text + i18n + screen readers; fixed to the screen, not the globe |
| Pause block, dock (6 cut symbols + captions, chosen = ink block, empty = outline, wait in blue) | **DOM** (paper margins) | ≥ 48 dp targets, thumb reach, safe areas |
| Airport stamp (square with a cut runway; hub = octagon with three) | **world** (ext) | sits on the globe: hides behind the horizon, follows the camera with no lag, sorts with routes and planes, scales with zoom; one instanced draw |
| City name (Besley), fill bar (cut ticks, 1 tick = 2 places), passenger glyphs + counts, "NOWE" stub | **DOM** (note beside the stamp) | text, D-08 glyph SVGs in their colours, D-262…D-266 layout engine that keeps notes apart; changes every tick |
| Jam zone: red hatched disc around the hub + countdown arc | **world** (ext) | a geographic zone that scales with zoom and must stay under labels; drawn with the stamp |
| Jam block "Zator za 0:42 · 36 z 36" | **DOM** | text; it is the jam note (one red block on the screen) |
| Off-screen chip "Karaczi → 2 408 km · 8 z 12" | **DOM** | screen edge, tappable |
| Routes (double line), planned route (dashed), planes (cut silhouettes) | **world** (ext) | geometry on the globe |
| Paper sky, atmosphere lines, inked limb, sea lines, ochre land with relief hatching, coastline, night cross-hatch | **world** (ext) | the globe material |
| Sheets (pause, weekly board, crates, contract slip, game-over report, hub board), menu, settings, about | **DOM** | panels |

## Steps

Budgets: CSS = all `dist/**/*.css` (`test:bundle`, budget 109 kB, D-258), JS = main chunk raw/gzip (1,180 / 360 kB),
total = all of `dist/` (4,300 kB). Render budgets per frame at 412×915 (`docs/PERFORMANCE.md`): draw calls ≤ 50 on
every preset; terrain triangles low/saver ≤ 35 k, medium ≤ 160 k; full-screen transparent layers low/saver ≤ 1,
medium/high ≤ 2 (G4). "Shots" = PNGs to inspect against the CLAUDE.md forbidden list before committing.

### U1 — agent — Linoryt preview foundation: inks, fonts, HUD top, dock, menu index (this PR, night 28a)
- **Files:** `src/ui/skin/linoryt.{ts,css}` (new), hooks in `src/ui/hud/{boarding-pass,tag-dock}.ts`,
  `src/ui/menu/menu.ts`, `src/main.ts` (DEV branch); `public/fonts/Besley-{800,900}.woff2`,
  `SchibstedGrotesk-VF.woff2` (+ OFL licences), `scripts/vite-font-files.mjs` (`PREVIEW_FONTS` out of `dist/`),
  `scripts/vite-skin-inline.mjs` (the preview is DEV-only like `diorama.css`), `e2e/browser.mjs` (`--skin=linoryt`),
  `e2e/linoryt-preview.mjs`.
- **Interim for sheets (until U3):** the preview re-inks Róża's palette for paper, uses a paper scrim instead of the
  dark one, and folds the day bar away while the weekly board or the report is open (game time stands still then), so
  the old sheet geometry still clears the taller top margin (`ui:matrix:stub -- --skin=linoryt` 96/96).
- **Budgets:** release `dist/` byte-identical to `origin/dev` (sha256 of all 32 files); CSS 108.8 kB, JS unchanged.
- **Tests:** `test:skin-tokens` (+8 Linoryt guards: scope, DEV-only import, guarded call sites, no runtime import,
  fonts + licences present and kept out of `dist/`, ink contrast ≥ 4.5:1), `test:e2e:linoryt:stub` (new, in `test:ci`:
  12 size/step/notch cases × PL/EN × menu and game = 48 audited screens), `ui:matrix:stub -- --skin=linoryt`, `test:bundle`, `test:fast`.
- **Shots:** `docs/shots/28a/` (`npm run shots:linoryt`), plus two real-renderer frames.
- **Done when:** preview reads like the frames on 320×568 … 1088×904, portrait/landscape/foldable, notch, 150 %; every
  HUD/menu target ≥ 48 px inside safe areas; release unchanged. **Status: done (this PR).**

### E1 — ext — the Linoryt globe material behind DEV `?look=linoryt`
- **Files:** `src/render/globe/look.ts` (`'linoryt'` look, no textures), new `src/render/globe/linoryt.ts` (shader),
  `src/render/globe/coast-distance` data (`public/data/globe/coast-2048.png`, generated by a new
  `scripts/build-coast.mjs` from `world-atlas`), `src/render/world.ts` (sky = paper, atmosphere lines, inked limb),
  `src/render/sun.ts` (night density uniform), `dev/globe.html` (`?look=linoryt`).
- **Visual:** spec §2–§4 (sea lines along parallels + three water lines along the coast, ochre land with relief
  hatching on slopes away from the NW light, 1.5 px coastline, night as cross-hatching that densifies past the
  terminator, paper sky with three blue atmosphere lines). Clouds, ocean shell and haze shell off for this look.
- **Budgets:** + ≤ 8 kB main JS (shader source), + ≤ 350 kB `dist/` (coast distance PNG; the photo textures leave in
  E4), **no extra draw call** (replaces the terrain material; atmosphere lines in the sky pass or one ring mesh: ≤ +1),
  full-screen transparent layers low/saver 0–1; fragment cost ≤ the satellite material (≤ 2 texture fetches,
  ≤ 6 `smoothstep`/`fwidth` pairs). Triangles unchanged (same terrain mesh).
- **Shimmer risk (budget phones):** lines are computed in lat/lon (object space, they do not swim), two octaves
  cross-fade with zoom so screen spacing stays 4–8 px, line width ≥ 1.5 device px with `fwidth` AA, no line below
  3 px period. **Measurable check:** new `npm run test:hatch-alias` (headless: for every preset DPR and zoom step 1…4
  in 0.25 steps, both octaves' screen period ≥ 3 device px and the cross-fade weights sum to 1) and
  `npm run shots -- linoryt-motion` (SwiftShader: 8 frames, camera turned 0.15° per frame; flicker score = share of
  pixels in edge-free land/sea tiles whose luminance changes by > 25 % between consecutive frames; budget ≤ 2 %), plus
  a Test Lab game-loop run on a budget phone (D-245) before U5. Fallback if a budget GPU still shimmers: `saver` drops
  the fine octave (solid ochre/blue fields with coast lines only).
- **Tests:** `test:render-layers` (look list, no textures for linoryt), `test:quality`, `test:daynight`
  (night density monotonic across the terminator), `test:hatch-alias` (new, fast), `perf:scene` (low/saver/medium,
  record draw calls/triangles in `docs/PERFORMANCE.md`).
- **Shots:** `npm run shots -- globe globe-menu` with `?look=linoryt` (day, terminator, night; zoom 1/2/3.3), the
  motion strip.
- **Done when:** the globe at `?look=linoryt` matches `png/a-game.png`/`a-menu.png` in technique; budgets and the
  flicker check pass; Róża + satellite stay default.

### E2 — ext — stamps, routes, planes, jam zone in print (DEV look) + `projectAirport`
- **Files:** `src/render/airports.ts` (new `AirportStyle 'stamp'`: one InstancedMesh of screen-constant quads with an
  SDF stamp; regular square, hub octagon, closed-by-curfew = outline only), `src/render/routes.ts` (double line),
  `src/render/routePreview.ts` (dashed ink, no red), `src/render/planes.ts` (cut silhouettes as instanced sprites
  from one SDF atlas), jam zone (hatched red disc + countdown arc, same SDF pass), `src/render/index.ts` exports
  `LINORYT_INKS`, `STAMP_SIZE_PX`, `WorldRenderer.projectAirport(id, out)` (spec §8).
- **Budgets:** draw calls: stamps 1 + jam 1 + planes 1 per type (replaces medallion parts and plane meshes: net ≤ 0);
  triangles −(medallion meshes); + ≤ 6 kB JS.
- **Tests:** `test:render-layers` (stamp kinds by shape, jam share → arc, curfew outline), `test:e2e:airport-plates`,
  `e2e/curfew-barrier.mjs`, `test:e2e:new-airport`, `perf:scene`.
- **Done when:** in `?look=linoryt` the world matches the frame; shipped look unchanged.

### U2 — agent — airport notes, jam block, edge chips in Linoryt (preview)
- **Files:** `src/ui/overlay.ts` (Linoryt note: name in Besley, fill bar of cut ticks, glyph chips with counts in the
  D-08 colours on paper, "NOWE" red stub, jam block), `src/ui/overlay-layout.ts` (stamp box from `projectAirport`
  as the fixed obstacle instead of the rose ring; until E2 lands: a constant `STAMP_SIZE_PX` fallback),
  `src/ui/skin/linoryt.{ts,css}`.
- **Kept behaviour (Róża layout rules that are not Róża-specific):** priority jam > new > hub > fuller (D-262, D-281),
  compact "code + 14 z 24" form and the must-show busiest hub (D-262), a note never covers a stamp and stays at its
  own airport (D-263, ring → stamp box), owns its place (D-264), notes apart (D-266), in-world sizes at every text step
  (D-267), the open hub board is an obstacle (D-268), "NEW" always shows (D-281). Dropped: names set along a ring
  (`rozaNameLayout` name-below/code-below), tick-per-place rings, `MEDAL_RADIUS`, captions yielding to the dock arc.
- **Budgets:** release unchanged (preview); later CSS cost estimate ≤ 6 kB.
- **Tests:** `test:roza-names` → renamed `test:note-layout` with the same fixtures (Levant 360×640, iPhone 440×956,
  tablet, landscape with board) re-run with stamp boxes; `test:overlay-layout`; `test:e2e:linoryt:stub` (+ notes
  audit: no note over a stamp/another note/the margins); `test:e2e:fill-trend`, `test:e2e:transfer-glyphs`,
  `test:e2e:edge-chip-*` with `--skin=linoryt`.
- **Shots:** `docs/shots/<night>/` Levant cluster real renderer (`?look=linoryt&skin=linoryt`), jam, night.
- **Done when:** the game frame reads like `png/a-game.png` at 360×640, 412×915, 915×412, 768×1024. **Status: done
  (night 30a, PR to `dev`, D-288):** notes, jam block, NOWE stub and printed edge chips on the `STAMP_SIZE_PX` fallback
  (`LINORYT_STAMP_PX`); E2 swaps in `projectAirport(id, out)` as one overlay option. `test:roza-names` stays for Róża
  next to the new `test:note-layout` until U5 deletes Róża. Shots on the stub world (stamps drawn as outlines in the PNGs
  only) in `docs/shots/30a/`; the real-renderer shots wait for E1/E2.

### U3 — agent — sheets in print (preview)
- **Files:** `src/ui/upgrade/*` (weekly board: crates as printed slips, contract slip incl. the D-280 one-liner),
  `src/ui/gameover/*` (report: one paper sheet, double neatline, red only for the failing hub; D-267 sticky actions),
  pause sheet (`src/ui/game.css`/`hud.css`), `src/ui/hubBoard.*`, `src/ui/atcStrip.*`, tutorial and first-time cards.
- **Rule:** paper with a double print rule; the only filled blocks are the chosen action (ink) and danger (red); no
  translucent dark sheets, no shadows, no rounded cards.
- **Tests:** `test:e2e:screens-fit(-320)`, `test:e2e:board-short`, `test:e2e:gameover-short`, `test:e2e:pause-reach`,
  `test:e2e:text-scale-150` and `ui:matrix:stub`, all with `--skin=linoryt` (the harness flag from U1);
  `test:pause-summary`, `test:crate-stamps`.
- **Done when:** every sheet at 320×568 … tablets, 100/150 %, no scroll where today there is none.

### U4 — agent — menu, settings, about, logbook, puzzles, leaderboard (preview)
- **Files:** `src/ui/menu/*` (title + globe + index; framing via `src/game/world.ts`: the index is the board box,
  `menu-clear` measures the index rows instead of the rose arc), `src/ui/settings/settings.ts` (+ licences list gains
  Besley and Schibsted Grotesk), `src/ui/logbook/*`, `src/ui/puzzles/*`, `src/ui/leaderboard/*`, privacy/terms pages.
- **Settings:** the globe-view setting (D-172) is hidden in the preview; see U5.
- **Tests:** `test:e2e:menu-clear` (real renderer), `test:menu-clear`, `test:e2e:settings-groups`,
  `test:e2e:logbook`, `test:e2e:puzzle-board-scroll`, `test:e2e:privacy-page`, `test:e2e:terms-page`,
  `test:e2e:pseudo-320` with `--skin=linoryt`.
- **Done when:** every screen of `e2e/screen-fixtures.mjs` is in print. **Status: done (night 29b, PR to `dev`):** settings,
  licences, privacy, terms, logbook, puzzles (board and desk), daily ranking in print (`linoryt.css` section "U4 screens");
  the menu globe is printed whole between title and index, also at 320×568 as a smaller disc (D-286: the horizon cannot
  clear the index at any tilt); release `dist/` byte-identical; shots `docs/shots/29b/`. Open for U3: the weekly board
  overflows at 320 px in the harsh pseudo-locale (`test:e2e:pseudo-320 -- --skin=linoryt`, upgrade screen).

### E3 — ext — the Linoryt look ships (not yet default)
- **Files:** `src/render/globe/look.ts` (`DEFAULT_GLOBE_LOOK` constant, `'linoryt'` selectable in release builds),
  coast data in `public/data/globe/`.
- **Budgets:** total ≤ 4,300 kB (+ coast PNG ≤ 350 kB: today 3,968.5 kB measured, so it fits before E4).
- **Done when:** a release build can render the Linoryt look; nothing selects it yet.

### U5 — agent — the flip: Linoryt is the shipped skin and look; Róża and the Diorama comparison go
- **Files:** `index.html` (`data-skin="linoryt"`), `src/main.ts` (`startLinoryt` always; `?skin=` removed),
  `src/ui/skin/current.css` (Linoryt token values), `linoryt.css` scope folded (`:root:root`, as Róża), delete
  `roza.css`, `roza.ts`, `diorama.css`, `scripts/vite-skin-prune.mjs` structure file → `linoryt.css`;
  `PREVIEW_FONTS` emptied (fonts ship), Alegreya removed; i18n `roza.*` → `hud.week`, `dock.caption.*`, … (PL/EN,
  `src/i18n/limits.ts`); render default look via E3's constant; globe-view setting and the dock's globe tag removed
  (see open question L1 of PR #285: what the sixth dock slot becomes).
- **Budgets:** CSS: the budget becomes the measurement after the flip + 3 kB (D-297, owner; ~135 kB projected by
  D-294 measurements, about 138 kB budget) — the earlier ≤ 100 kB target is dropped, no Linoryt slimming pass before
  U5; JS −~20 kB (roza.ts); total + 87 kB fonts − 24 kB Alegreya.
- **Tests:** whole `test:ci`; `test:skin-tokens` rewritten for Linoryt as the shipped skin; `test:glyphs` (Besley
  lacks U+2192 and U+202F, Schibsted lacks U+2009 and U+202F: borrowed through `unicode-range` from Atkinson, as
  today); `test:bundle` font check (named WOFF2 ≥ 4 instead of 6); `skin:pixels` proves inline/prune pixel-identical.
- **Done when:** release = Linoryt everywhere; `test:ci` green; store shots marked stale. **Status: done (night 46a,
  draft PR to `dev`, D-301):** CSS 129.0 kB → budget 132 kB (D-297), JS 1,167.6 kB, `dist/` 4,099.5 kB; `skin:pixels`
  94/120 identical (the rest: the removed globe tag, one-level anti-aliasing); `test:e2e:text-scale-150` green on the
  Linoryt board; notes use E2's `projectAirport` / `STAMP_SIZE_PX`; shots `docs/shots/u5/` (`node scripts/shots-u5.mjs`);
  store shots marked stale in `docs/store/README.md`. Left for U6: inline the `var(--lin-*)` references of
  `linoryt.css` (~3 kB), retire the `--skin=` no-op helpers of `e2e/browser.mjs`, rename `test:e2e:linoryt:stub`.

### E4 — ext — remove Satelita, Mapa (recommended) and the photo textures
- **Files:** `src/render/globe/look.ts` (satellite, map, painted, refined, diorama looks), `public/data/globe/{day,
  night,map,clouds}-*.{jpg,png}` (−1.9 MB), cloud shell, `test:globe-assets`, the D-177 probe re-targeted to Linoryt.
- **Mapa (D-172) — recommendation: remove.** It is a texture set of the satellite pipeline (+0.54 MB) and a second
  look next to an authored print would bring back the "two techniques" problem of D-282. If the owner keeps a second
  view, it should be a Linoryt variant (e.g. no relief hatching, political outlines), not a texture set.
- **Budgets:** total −~1.9 MB (→ ~2.1 MB); draw calls −1 (cloud shell).
- **Done when:** nothing in `dist/` or `src/` references the photo textures; `test:ci` green.

### U6 — agent — accessibility and polish pass on the shipped Linoryt
- D-47: `test:contrast` gains the Linoryt pairs (today checked in `test:skin-tokens`), the D-177 probe on real frames
  (labels on ochre land, on blue sea, on night cross-hatch; stamps ≥ 3:1 against both); `test:cvd`: the D-08 glyph
  colours on paper and on ochre (simulated deuteranopia/protanopia/tritanopia) — shape stays the primary carrier.
- Reduce motion (D-88): no line-draw animation of a new route, the jam arc does not pulse, the "now" cut steps per
  game hour.
- Text scale (D-248/D-267), RTL-safe layout of the index (future), `test:e2e:notch`, `ui:matrix` on the real renderer.
- Budget: CSS budget lowered to the measured value + 3 kB.
- **Status: done (night 48a, draft PR to `dev`, D-305):** `test:contrast` +25 Linoryt pairs, `test:cvd` glyphs on paper
  and ochre, `test:e2e:linoryt-contrast` (real frames: 18 notes, 19 stamps; night stamps WARN only, render follow-ups in
  the PR), the "now" cut steps per game hour (`test:e2e:reduce-motion-game:stub`), paper system bars on Android and iOS,
  inks written in place (CSS 129.4 → 127.4 kB, budget 132 → 130 kB), board layouts, `test:e2e:screen-audit:stub`
  (renamed). Left: the `--skin=` no-op helpers of `e2e/browser.mjs`, RTL of the index (no RTL language yet).
- **Audit (night 54a, D-312):** the UI against the frames: the index's double rule (its thin line never printed), the
  labelled home-region choice over it, the paused control without red, the report's stamp per airport kind; shots
  `docs/shots/n54a/`.

### U7 — agent (coordinator) — store shots, preview video, landing page
- `npm run store:shots` (60 PNGs), `npm run store:video` (D-265, D-269: files to the owner's Drive), `npm run
  site:assets`; GPT-09/10/21 orders stay obsolete (D-283). Only after the owner has seen U5 on a phone.
- Copy (D-296): the full store description EN/PL, `press.long`, site `about.p2`, screenshot/feature-graphic alt texts
  and site captions are rewritten here, from `docs/store/copy-review-2026-11.md` (mechanics only, no promise of a look).

### Order and dependencies
U1 → E1 → (E2 ∥ U2 with the constant fallback) → U3 → U4 → E3 → **U5 flip** → E4 → U6 → U7. U3/U4 do not depend on
render and may run in parallel with E1/E2.

## The `?skin=` previews
- `?skin=current` (Diorama tokens, D-257): kept until U5 because the Linoryt preview needs the same base DOM and the
  skin pruner proof (`skin:pixels`) compares against it; **removed in U5** (it only costs budget: the pruner must keep
  every base declaration the comparison reads).
- `?skin=karta` (D-256) no longer exists in the tree (removed with D-257); nothing to do.
- `?skin=linoryt`: removed in U5 (it becomes the default).

## Day/night as hatching density
Night is a second hatching layer (cross-hatch at −45°) whose coverage rises from 0 at the terminator (sun 0°) to full
at −12° (nautical night), modulated by the same subsolar point the sun uses today; the day bar in the HUD inks the
same night hours (20:00–06:00, `LINORYT_NIGHT` in `linoryt.ts`; to be tied to the demand quiet hours in U6 if the
owner prefers the curfew 23:00–06:00). City lights become paper dots cut out of the night hatch (no glow).

## i18n
U1 reuses existing keys (`roza.*`, `menu.*`). U5 renames the Róża keys to skin-neutral ones in PL and EN with length
budgets in `src/i18n/limits.ts` (dock captions ≤ 10 characters: at 320 px a dock cell is 52 px wide and a caption
at 10.5 px Schibsted Grotesk Bold fits 9–10 characters, checked by `test:e2e:screen-audit:stub`, formerly `test:e2e:linoryt:stub`).

## Risks
1. **Hatching shimmer** on budget GPUs and low-density screens (E1 check above; fallback in `saver`).
2. **Labels on hatched land** may lose contrast: notes carry a paper ground (no halo, no shadow), checked by the
   D-177 probe in U6.
3. **Dense networks on ochre**: stamps and double routes are ink on ochre (6.9:1); planes get a paper outline.
4. **Menu height at 320×568** with Continue: the index takes ~60 % of the screen; the globe shows as a horizon only
   (accepted in the frame; U4 measures).

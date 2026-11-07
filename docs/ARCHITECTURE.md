# Airway — production architecture

Status (2026-11-07): production, MVP polish after integration. Tasks 01–36 are merged and integrated on `dev`
(PR #30, #33–#37); the night work since then is on `dev` too, recorded up to D-297 in [Decisions](DECISIONS.md). Read
D-11 (Diorama world), D-12 (Airway), D-13 (deterministic pure simulation), the task decisions D-19…D-37 and
[Research](RESEARCH.md) sections 3–5.

**The look is in transition (D-282, D-283).** What ships today is the **Róża** UI skin (D-257 and its polish
D-259…D-268, D-279…D-281) over the **satellite** globe (D-170, with the "Mapa" view D-172). The owner chose **Linoryt**
(D-283) to replace both; it is built in steps per `docs/styles/kierunki-2026-11b/PLAN-LINORYT.md` (D-284, D-285):

- **Done (UI, DEV preview only):** U1–U4 — `src/ui/skin/linoryt.{ts,css}` behind `?skin=linoryt` in a DEV build
  (HUD margin and dock, menu index, airport notes, sheets, settings/logbook/puzzles/ranking pages; D-286…D-288). A
  release build folds every Linoryt branch away and drops its fonts (`PREVIEW_FONTS` in `scripts/vite-font-files.mjs`).
- **Pending (render session, `src/render/**`, `dev/`):** E1 (Linoryt globe material behind a DEV `?look=linoryt`), E2
  (stamps, routes, planes and the jam zone in print, `projectAirport`), E3 (the look selectable in release builds), E4
  (satellite, Mapa and the photo textures removed). None of these exists in the code yet.
- **Pending (UI):** **U5, the flip** — Linoryt becomes the shipped skin and look; `roza.{ts,css}`, `diorama.css`, the
  `?skin=` previews, the `roza.*` keys and the dock's globe-view tag go; the CSS budget becomes the measurement + 3 kB
  (D-297). Then U6 (accessibility pass) and U7 (store shots, video, site copy, D-296).

Rows below describe the code as it is; "(U5)" or "(E1–E4)" marks what those steps will change.

## Module map

| Module | Owns (main files) | Dependencies allowed |
| --- | --- | --- |
| `src/core` | Seeded mulberry32 RNG with serializable state and named forks (`rng.ts`), fixed-step clock (`clock.ts`), Warsaw-calendar daily seed (`daily.ts`), number/duration formatting (`format.ts`, D-61), localization facade (`i18n.ts`), app version for the playtest record (`version.ts`) | Pure TypeScript; device settings only outside the simulation |
| `src/sim` | Deterministic kernel: `Sim` (`sim.ts`: tick, journal, per-entry outcomes, checkpoints, snapshot/replay), state and `GameConfig` (`state.ts`, `RULES_VERSION`), command schema and validation (`commands.ts`), world calendar (`clock.ts`), undo (`undo.ts`), every balance knob with its `*_PARAMS_VERSION` (`params.ts`), facade (`index.ts`). World (`world.ts`, the read-only `WorldView`): city spawning and the home-region start clusters (`spawner.ts`, D-236, EUS v2 D-290), route graph (`network.ts`), regional demand (`demand.ts`), passengers and terminal queues (`passengers.ts`), routing (`routing.ts`), hub queues/MCT/failure (`hubs.ts`), failure ledger (`ledger.ts`), aircraft (`planes.ts`) and leg scheduling with departure slots (`schedule.ts`), day/night curfew (`daynight.ts`), weekly upgrades (`upgrades.ts`); Endless rules switched by `GameConfig` flags: weekly contract (`contracts.ts`, D-247/D-271), announced demand surge (`surge.ts`, D-249/D-272), licence classes II/III as scenario knobs (`licence.ts`, D-251/D-273), weather front with a ground hold (`weather.ts`, D-253/D-274/D-291; off in shipped Endless); config → rules (`scenarios.ts`), puzzle levels as scenarios (`puzzles.ts`) | `src/core` pure helpers and `src/data` integer/immutable records only (D-13, `test:arch`) |
| `src/data` | 165 versioned cities (`cities.ts`, names `city-names.json`), destination regions + glyph/colour ids (`regions.ts`, D-08), airline colour palette (`airline-colours.json`, D-80), generated integer distance table (`generated/distances.ts`, from `build:distances`), JSON puzzles (`puzzles/NN.json`, contiguous ids; `puzzles/levels.generated.ts` from `build:puzzles` lists them, D-160; packs after 30 in `puzzles/packs.ts`, D-162; 16+ tagged with the mechanics they teach) | Types and static data; no rendering assumptions |
| `src/render` | Maintained by the render session (see *Render API*). three.js world: scene/canvas and the one facade (`world.ts`, `index.ts`), globe terrain, land mask, clouds, geo maths and the globe looks (`globe/`; [ext-04] Linoryt print look: inks and hatch rules `globe/linoryt.ts`, material and sky band `globe/linoryt-globe.ts`, DEV `?look=linoryt` until E3, D-298; stamps, jam zone, route ribbon, dashed preview and plane silhouettes `linoryt-objects.ts`, `WorldRenderer.projectAirport`, D-299; `globe/look.ts`: `satellite` shipped, D-170, `map` view D-172, the rest DEV comparisons), orbit camera (`camera.ts`), airports (`airports.ts`), route tubes and ghost (`routes.ts`, `routePreview.ts`), instanced planes (`planes.ts`, `models/planes.ts`), sun/terminator (`sun.ts`), quality tiers and pacing (`quality.ts`), WebGL 2 check and context loss (`contextGuard.ts`, D-118), decorative menu network (`menuNetwork.ts`), model window meshes (`modelPreview.ts`). (E1–E4: the Linoryt look replaces the globe looks.) | Read-only game snapshots, three.js, browser canvas |
| `src/ui` — skin | [night-11aq] D-250: every visual value of the HUD, airport labels and chips, sheets, boards, game over, menu/settings, ATC strip, logbook, puzzles, ranking and tutorial is a token of one file `skin/current.css` (Róża values today, D-257; inventory `docs/styles/ui-2026-11/INVENTORY.md`; guard `test:skin-tokens`); release builds write the values in place (`scripts/vite-skin-inline.mjs`, D-252). Róża structure `skin/roza.css` (scoped to `<html data-skin="roza">`, which `index.html` sets) and its helpers `skin/roza.ts` (`startRoza` from `src/main.ts`; the day dial and the dock arc of the HUD, the compass rose per airport with its note layout, the menu rose and arc). DEV-only comparisons: `?skin=current` loads the previous "Diorama" tokens `skin/diorama.css`; `?skin=linoryt` runs `startLinoryt` (`skin/linoryt.ts`) with `skin/linoryt.css` (U1–U4, D-284). Palette and D-248 text-size tokens `theme/theme.css` (`theme/tokens.json`), fonts `fonts.css`. (U5: Linoryt values in `current.css`, `linoryt.css` folded in, Róża and `diorama.css` deleted.) | HTML/CSS/SVG; skin helpers have no runtime imports (dependencies are handed in by `src/main.ts`) |
| `src/ui` — in run | HUD (`hud/`): `mountHud` builds the base components — the "boarding pass" (`hud/boarding-pass.ts`: week, day, time, passengers, pause) and the dock (`hud/tag-dock.ts`: undo, turboprop, widebody, hub, globe view, speed; drag a plane onto a route; empty tags count down to the weekly board, `hud/crate-countdown.ts`), symbols `hud/icons.ts`; the shipped Róża skin turns the pass into the 24-hour day dial and lays the dock on an arc around it (`rozaDial`, `rozaPass`, `rozaDockLabel` in `skin/roza.ts`; D-257). Airport overlay and its pure, allocation-free layout (`overlay.ts`, `overlay-layout.ts`: passenger notes with D-08 glyphs, jam countdown, slot hold, NEW, curfew, surge and weather-front stubs, fill trend, code plates, off-screen edge chips; Róża roses and note placement D-262…D-268, D-281), hub cause board (`hubBoard.ts`, D-228), ATC strip, route menu and handles (`atcStrip.ts`), weekly upgrade board with the contract waybill and the airport pick sign (`upgrade/`, D-247/D-279/D-280), game-over report (`gameover/`: causes, timeline via `src/game/runTimeline.ts` and the live Sim's `getCommandOutcomes()`, milestones `milestones.ts` D-242, met contracts D-293, daily ranking board `leaderboard/` D-66), airport code/name labels (`airportLabel.ts`, D-68), destination glyphs (`glyphs.ts`), responsive layout (`layout.ts`). The pause sheet is built in `src/game/session.ts` | Read-only state, localization, HTML/CSS/SVG; emits intents through callbacks |
| `src/ui` — screens | Menu (`menu/`: departures board, home-region and licence-class selects, D-236/D-251; Róża menu rose), split-flap engine (`flap.ts`), settings (`settings/`: language, a11y, graphics, audio, globe view D-172, privacy policy and terms pages from `legalText`, D-255), pilot's logbook (`logbook/`, store in `src/game/logbook.ts`; "Copy summary" `logbook/summary.ts`, D-227, with the `AW1:` playtest line, D-295), puzzle board (`puzzles/`), tutorial overlay (`tutorial/`), unsupported-device page (`unsupported.ts`, D-118), a11y settings (`a11y.ts`), the one "reduce motion" source (`motion.ts`, root `data-airway-motion`, D-88), airline colour (`airlineColour.ts`, D-80) | Read-only state, localization, HTML/CSS/SVG; emits intents through callbacks |
| `src/input` | Pointer/touch gesture recognizer and camera adapter (`gestures.ts`), finger route editor (`routeTool.ts`), keyboard shortcuts (`keyboard.ts`, D-233) | View hit-testing/projection and a command dispatcher |
| `src/audio` | Event-driven hub resonators: engine (mix bus, limiter, offline render hook), 125 ms lookahead scheduler, region-scaled pitch (D-30, D-71); run events → cues live in `src/game/audioCues.ts` | Read-only events/state; Web Audio behind adapter |
| `src/net` | [night-06] D-66 online leaderboards: board ids (Warsaw day / ISO week, `boards.ts`), daily submission = command journal + authoritative replay verdict on the same Sim (`submission.ts`, shared with `functions/`), dependency-free Firebase REST client (anonymous Auth, callables; `client.ts`), App Check token port (`appCheck.ts`, D-246), offline queue (`queue.ts`), build-time config (`config.ts`), facade disabled without `VITE_FIREBASE_*` config (`index.ts`) | `src/core`, `src/sim` (read-only replay); never imported by `src/sim` (`test:arch`) |
| `functions/` | [night-06b] Callable Cloud Functions `submitDaily` / `getBoards` (europe-west1); esbuild bundles `src/net/submission.ts` + `src/sim` so the server replays with the exact game code; pure rules in `functions/src/logic.ts`; Firestore server-only (`firestore.rules`) | `firebase-functions`, `firebase-admin`, shared `src/net` + `src/sim` |
| `src/platform` | Capacitor bridges: storage/IndexedDB/native dual-slot saves (`storage.ts`), lifecycle + background pause (`lifecycle.ts`), hardware back (`back.ts`), never-backed-up install marker that drops a restored leaderboard identity (`install.ts`, D-92), haptics (`haptics.ts`), share (`share.ts`), native App Check provider by plugin name (`appCheck.ts`, D-246), Firebase Test Lab game loop (`gameLoop.ts`, D-245), system text size on first launch (`textScale.ts`, D-248), no-op ads/store (`ads.ts`, `store.ts`, D-16) | Capacitor APIs; never imported by the simulation |
| `src/game` | Composition root and orchestration: in-run session (`session.ts`: one run, one world, every in-game layer, the pause sheet), read-model adapter over the Sim (`run.ts`, `EndlessRun`; new Endless runs carry the weekly contract and the demand surge, weather off: `ENDLESS_WEEKLY_CONTRACT`, `ENDLESS_DEMAND_SURGE`, `ENDLESS_WEATHER_FRONT`), frame loop and framing (`world.ts`, `framing.ts`, D-47), screen router (`screens.ts`), modes (`modes/daily.ts`, `modes/puzzle.ts`), save envelope (`save.ts`: v5, a weather run v7, D-291), scores (`scores.ts`), failure causes (`causes.ts`), tutorial controller and the one-time first-time cards (`tutorial/`: `controller.ts` 3 steps, `first-time.ts` registry + triggers incl. the surge card D-292, `first-time-card.ts`, `slot-hint.ts`; D-130). Device choices: home region (`homeRegion.ts`, D-236), licence classes open and chosen (`licence.ts`, D-251/D-273). Pure read-only views for the UI: surge stub (`surge.ts`), weather-front stub (`weather.ts`), hourly fill trend (`fillTrend.ts`, D-221), last-hour hub cause board (`hubBoard.ts`, D-228), milestones (`milestones.ts`, D-242/D-270), contracts summary (`contractsSummary.ts`, D-271), surges summary (`surgesSummary.ts`, D-295), pause summary (`pauseSummary.ts`), new-airport marks (`newAirports.ts`), game-over tip (`gameoverTip.ts`), run timeline (`runTimeline.ts`), menu-entry clearance from the menu network (`menu-clear.ts`, D-262). Records: logbook (`logbook.ts`), playtest `AW1:` line (`playtestRecord.ts`, D-231/D-295), puzzle bests (`puzzleBest.ts`). Daily ranking glue (`dailyRanking.ts`, D-66), daily row (`dailyRow.ts`), audio cues (`audioCues.ts`, `flapSound.ts`), adaptive quality memory (`adaptiveMemory.ts`, D-74), Test Lab game loop (`gameLoop.ts`, D-245), content gate (`gating.ts`). DEV only: E2E handle `window.aw` (`devHandle.ts`), autoplay bot (`dev/autoplay.ts`, `dev/bot-policy.ts`), WebGL-free stub `World` for browser journeys through the real session (`dev/stubWorld.ts`, `?render=stub&clock=frozen`, D-254) | Wires all modules through explicit interfaces |
| `src/i18n` | Catalogs `en.ts` and `pl.ts` (identical keys and parameters), language table (`languages.ts`: shipped PL/EN, planned wave-1 languages not shipped, D-185/D-212), length budgets of fixed-width text (`limits.ts`, D-211), DEV pseudo-locale (`pseudo.ts`, `?pseudo`); saved language → device language → `en`; the privacy policy and terms bodies in `legal/`, a chunk loaded on demand (`loadLegalText`, D-255). (U5: `roza.*` keys renamed to skin-neutral ones.) | — |
| `src/main.ts` | Bootstrap: mounts the composition root; picks the skin (Róża by default; DEV `?skin=current` / `?skin=linoryt`), DEV switches (`?render=stub`, `?weather=front`, `?pseudo`, `?preview=gameover`); installs `window.aw` only in DEV | — |

Outside `src/`:

| Path | Purpose |
| --- | --- |
| `index.html` | App page; sets `<html data-skin="roza">` so the first paint is Róża (U5: `linoryt`) |
| `public/` | Fonts as WOFF2 (+ the TTFs the dev pages read; a release drops TTFs with a WOFF2 twin) with OFL licences, `docs/ASSETS.md`; land mask and the satellite/Mapa globe textures (`public/data/globe/`, E4 removes the photo textures) |
| `dev/globe.html`, `dev/world.html` | Standalone globe and full-stack pages for visual QA (`npm run shots -- globe`); render-owned |
| `scripts/` | Generators (`build-distances.mjs`, `build-land.mjs`, `build-puzzles.mjs`), Node unit tests (`test-*.mjs/ts`, TypeScript through `ts-test-loader.mjs`), the bot/balance harness (`bot.ts`, `balance-*.ts`), perf, playtest decoder (`playtest-decode.ts`), Android build, the suite runner `run-suite.mjs` (`test:fast` / `test:ci`; parallel jobs, output in list order, D-289) and the browser tooling: `lib/harness.mjs` (Vite + SwiftShader Chromium), `shots.mjs`, `ui-matrix.mjs`, `store-shots.mjs`, `store-video.mjs` (D-265). Vite plugins: `vite-skin-inline.mjs` (skin tokens written in place, D-252) with `vite-skin-prune.mjs` (drops base declarations the Róża structure always overrides, D-257), `vite-font-files.mjs` (WOFF2 only in `dist/`; Linoryt preview fonts left out until U5) |
| `e2e/` | Playwright journeys on the real game (`window.aw`, contract in `e2e/README.md`); shared harness `browser.mjs` with `--render=stub` (D-254) and `--skin=linoryt` (D-284); the harness-only fixture |
| `site/` | Framework-free landing page airway.games (`docs/SITE.md`) |
| `android/`, `ios/`, `resources/`, `fastlane/` | Capacitor native projects and store tooling (`docs/ANDROID.md`, `docs/IOS.md`) |
| `mockups/` | Stage-0 reference mockups (read-only history) |
| `docs/` | Decisions, research, styles (`styles/kierunki-2026-11b/PLAN-LINORYT.md` for the look in progress), tasks, testing, store copy, screenshots (`docs/shots/README.md`) |

No module other than the composition root should orchestrate multiple world and input subsystems.
`src/sim` MUST NOT import three.js, DOM/browser UI, input, audio, render, net or Capacitor. The
`npm run test:arch` check enforces the direct-import boundary and banned globals/operations.

## Flow of authority

```text
finger / keyboard
      ↓
input (screen hit-test, gesture recognition, coordinate projection)
      ↓
Command { type, payload, tick }  ─────→  command log / undo / replay
      ↓
game scheduler validates and applies commands at fixed tick boundaries
      ↓
sim(seed, priorState, Command[])  ────→  State(tick, integer counters, RNG state)
      ↓                                    ↓
immutable/read-only snapshot             event stream
      ↓                                    ↓
render (three.js interpolation)         UI and audio
```

**Only a `Command` may mutate authoritative state.** UI, renderer and input must never
write to `State` directly. Commands are validated and ordered deterministically by
simulation tick and monotonic sequence number. Preserve the initial seed, parameter
version and the command log to enable undo, reproducible replays and offline daily
challenges. Never generate simulation randomness outside `src/core/rng.ts`.

## Tick model and determinism

- At 1×, advance at **10 ticks per wall-clock second** (100 ms fixed-step accumulator).
  The intended game calendar advances by one simulated minute per tick; the gameplay
  scaling stays in `src/sim/params.ts`.
- The browser scheduler may read `performance.now()` in `src/game`; its elapsed
  time never enters `src/sim` except as an integer count of whole ticks.
- Apply a bounded catch-up budget on resume to avoid minute-long frame stalls.
  Backgrounding pauses the wall-clock scheduler before saving (D-29).
- Render can interpolate between two immutable tick snapshots using fractional
  accumulator progress. Interpolation and spherical geometry are **visual only**;
  fractional coordinates never round-trip into authoritative simulation state.
- Simulate durations, distances and capacities as **integers**. Projection,
  trigonometry and other transcendental operations belong to `src/render` or
  `src/input`; precompute/round game distances and travel times before submitting
  validated integer commands to `src/sim`.
- Keep RNG state serializable and deterministic; iterate collections in a defined
  order, use stable tie-breakers, and prohibit `Date.now`, `Math.random`,
  transcendental `Math` calls and browser globals inside simulation (D-13).
- The same `seed + initial data version + ordered commands + tick count` must
  produce the same bitwise-relevant state across Android and iOS engines.

## Naming, types, and balance

- Source files start lower-case: most are `camelCase` (`fillTrend.ts`, `hubBoard.ts`), some older ones
  kebab-case (`overlay-layout.ts`, `first-time.ts`); follow the folder you add to. Exported types/interfaces:
  `PascalCase`; functions/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep transport objects serializable; avoid `three.Vector3`, `Date`, floating-point
  angles and DOM references in simulation models. Use readonly snapshots and
  discriminated command unions as the kernel expands (task 02).
- Translation identifiers: descriptive dotted keys (e.g. `action.pause`) in both
  `src/i18n/en.ts` and `src/i18n/pl.ts`; values must not be empty or mismatched.
- Change balancing only through named constants/tables in `src/sim/params.ts`;
  when tuning, version the parameters and rerun fixed-seed regression tests.
- UI values come from the skin tokens (`src/ui/skin/current.css`, D-250; component CSS holds no colour or
  font literal, `test:skin-tokens`) and the D-248 text-size tokens; player text has length budgets
  (`src/i18n/limits.ts`). SIL OFL fonts, 48 dp targets, safe areas, portrait, landscape and foldable layouts.
  Use procedural or documented CC0 assets only.

## Ownership

Two sides work on `dev` in parallel (PLAN-LINORYT.md): the **render session** ("ext") owns `src/render/**` and
`dev/` and maintains the *Render API* section; **agents** own everything else — **sim** (`src/sim`, `src/core`,
`src/data`, the *Sim API* section), **ui** (`src/ui`, `src/input`, `src/game`, `src/main.ts`, `src/i18n`), **platform**
(`src/platform`, `src/audio`, `src/net`, `functions/`, `android/`, `ios/`) and **tooling** (`package.json` scripts,
`scripts/`, `e2e/`, `site/`, `docs/`). Dependencies stay one-way: `sim ← game → render/ui/input/audio/platform/net`.

## Render API

Maintained by the render session. It describes today's renderer; the Linoryt steps E1–E4 (PLAN-LINORYT.md, spec
`docs/notes/linoryt-render-spec.md`) will add the Linoryt look, `projectAirport` and remove the satellite/Mapa looks.

One renderer stack, one entry point: `createWorldRenderer(canvas?, opts)` in
`src/render/world.ts` (re-exported by `src/render/index.ts`; import from there). It owns the
single `WebGLRenderer`, `Scene`, light rig (subsolar `DirectionalLight` + sky
`HemisphereLight`, `globe/createSunLights`), quality profile (`quality.ts`, D-33) and
`GlobeOrbitCamera`. Layers: globe terrain/decor/atmosphere (`globe/`), airports with hub
capacity rings and curfew barriers (`airports.ts`), route tubes (`routes.ts`), instanced
planes (`planes.ts`, `models/planes.ts`), route-drawing ghost (`routePreview.ts`),
upgrade-card models (`modelPreview.ts`). All lon/lat → cartesian math goes through
`globe/geo-math.ts` (`setLatLonVec3` writes into a caller vector; `latLonToVec3` allocates).

Inputs are plain read-only view objects; the renderer never imports `src/sim` values (type
imports only) and never mutates state. The game composition root adapts sim snapshots.

| Call | When | Notes |
| --- | --- | --- |
| `setCities(CityView[])` | city spawn / new game | `{id, lon, lat, hub?}`; diffed, a hub flag change or removal rebuilds |
| `setRoutes(RouteView[], revision?)` | network change | `{id, aircraft, cityIds}` resolved via cities; same revision = no rebuild |
| `setHubLoad(HubLoadView[])` | tick | `{id, used, cap}`; ring rebuild deferred to the next frame |
| `setCurfew(closedIds)` | tick / curfew change | full set of closed airports |
| `setPlanes(previous, current)` | tick boundary | `PlaneView` = `{id, routeId, segment, progress01 (0..10 000), direction?, type?, load, capacity?}` |
| `setTime(tick, fraction)` / `setSun(lon, lat)` | frame | day/night terminator, city lights, exposure |
| `setRoutePreview(model \| null)` | pointer move | structurally `RoutePreviewModel` from `src/input/routeTool.ts` |
| `render(alpha, dtSeconds)` | every frame | `alpha` = tick accumulator fraction; camera inertia, plane interpolation; [night-04] terrain LOD/chunk culling, battery-saver 30 fps cap (returns `false` on a skipped frame, dt carries over), adaptive quality (D-73) |
| `contextLost()` / `onContextChange(fn)` | [night-11h] D-118 | true while the WebGL context is lost (`render` and `drawModelPreview` draw nothing); listeners get `true` on loss and `false` after the restore re-applied quality and size; `game/world.ts` holds the run's frame hook and shows the notice |
| `pick(x, y)` | tap | `{kind:'city', id}` within 28 dp, else `{kind:'globe', lon, lat}`, else `null` |
| `pickGlobe(x, y)` | route tool `cursorGeo` | analytic sphere hit |
| `project(lon, lat, alt, out)` | HTML overlay, per frame | writes `{x, y, visible}` into `out`; no allocation |
| `orbit` | input | `GlobeOrbitCamera`: pass to `cameraGestureCallbacks(orbit, …)` |
| `camera` | overlay | three.js camera for `createAirportOverlay(host, camera)` |
| `resize(w, h, insets)` / `opts.autoResize` | layout | CSS px; insets keep the globe clear of HUD and safe areas. [task-34] `src/game/world.ts` measures them from the HUD/menu boxes (`insetsFromLayout`, `menuFraming` in `framing.ts`, D-47) |
| `setQuality(pref)` | settings | `'auto' \| 'saver' \| 'low' \| 'medium' \| 'high'`; rebuilds terrain only when the preset changes, DPR ≤ 2, shadows on high only; `saver` = low terrain, DPR 1, 30 fps, 60 % decorations (D-73) |
| `forceTerrainLevel(n \| null)` | tests, shots | pins the terrain LOD level (0 = preset mesh, 1 = far mesh) |
| `drawModelPreview(kind, canvas2d)` | upgrade card | renders through the shared context into a 2D canvas |
| `ready`, `stats()`, `dispose()` | lifecycle | `ready` resolves after the land mask/terrain load |

Screen coordinates are CSS pixels relative to the canvas' top-left corner. Frame pacing:
`AdaptiveFrameScheduler` (30 FPS idle, full rate while interacting, stopped when hidden).
Dev pages: `dev/world.html` (full stack, `?frozen&clean&quality=&zoom=`), `dev/globe.html`.

## Sim API

One authoritative simulation: `Sim` (`src/sim/sim.ts`), facade `src/sim/index.ts`. Everything
else (UI, render, audio, input, modes, bot) reads views and submits commands; nothing writes state.

```ts
import { createGame, Sim, type Command } from './sim';
// createGame(seed, mode = 'endless', puzzleId?, homeRegion = null, weeklyContract = false, demandSurge = false,
//            licenceClass = 1, weatherFront = false, eusClusterV2 = true): Sim
const sim = createGame(seed, 'endless');      // plain Endless (class I, no contract, surge or weather)
createGame(seed, 'daily');                    // Daily: every Endless-only argument is ignored
createGame(level.demandSeed, 'puzzle', level.id); // puzzle scenario (src/sim/puzzles.ts)
createGame(seed, 'endless', undefined, 'EUN', true, true, 2); // home region (HOME_REGIONS, D-236), weekly contract
                                              // (D-247), demand surge (D-249), licence class II (D-251)
// weatherFront = true adds the weekly weather front (D-253/D-291; DEV `?weather=front`, tests and the bot only).
// eusClusterV2 applies only with homeRegion 'EUS' (D-290); pass false to rebuild an old EUS world.
// Each flag becomes an optional GameConfig field (src/sim/state.ts), set only when it differs from the default,
// so older saves, every Daily and the leaderboard replay keep their hashes. A new Endless run comes from
// EndlessRun.create (src/game/run.ts): contract and surge on, weather off (ENDLESS_* constants there).
sim.check(cmd);          // { ok: true } | { ok: false, reason: RejectReason } — instant UI feedback, no side effect
sim.apply(cmd);          // queue for the next tick; false only for malformed input
sim.tick();              // ONE kernel step: queued commands, then one game minute — spawner -> curfew -> demand (+ surge)
                         //   -> planes (departure slots, weather hold) -> hubs/jam -> game over -> week end
                         //   (upgrade offer, next contract and surge)
sim.advance(n);          // n ticks (headless tools, tests, bot)
sim.schedulingSpeed;     // 0 | 1 | 2 | 4 ticks/s multiplier src/game should use (0 while paused, at an upgrade offer, after game over)
sim.drainEvents();       // SimEvent[] since last call: CitySpawned, RouteAdded/Changed/Removed, PlaneAssigned/Unassigned,
                         //   Delivered, DepartureHeld, CurfewAnnounced/Held, HubJamStarted/Cleared, HubUpgraded,
                         //   UpgradeOffered/Chosen, ContractMet, SurgeAnnounced, Surge, GameOver, CommandRejected
sim.world;               // WorldView (read-only): minute, status, score, failure, offer, upgrades, hubUpgradesInStock,
                         //   reserve, planes (live array), curfewCityIds, totals, scenario, departureSlots,
                         //   cities(), activeCityIds(), cityView(id), routes(), hubCauseLedger(id), departureSlotLimit(id),
                         //   contract / contractHistory (D-247), surge / surgeHistory / surgeRecords() (D-249),
                         //   weather = { front, band } | null (render draws `band`),
                         //   airportWeather(id) = { phase: 'ahead' | 'under', fromTick, toTick, fromLocalMinute, toLocalMinute } | null
sim.clock;               // calendar of the world minute (frozen while an upgrade is pending)
sim.seed; sim.config; sim.tickCount; sim.getCommandLog(); sim.getCommandOutcomes(); // journal + per-entry { minute, accepted }
sim.hash(); sim.snapshot(); sim.restore(json); Sim.fromSnapshot(json); sim.undo();
Sim.replay(seed, journal, ticks, config?, stopAtEnd?); // stopAtEnd: stop on the game-over tick (server verification, D-97)
```

- **Commands** (`src/sim/commands.ts`): `AddRoute {cityIds, aircraft?}` (route id `R<n>` assigned by
  the sim, announced by `RouteAdded`; `aircraft` also assigns a spare plane), `ExtendRoute {routeId,
  end, cityIds}` (full resulting list, route-tool format), `ShortenRoute {routeId, end}`, `RemoveRoute`,
  `AssignPlane {routeId, aircraft}`, `UnassignPlane {planeId}`, `UpgradeHub {hubId}` (stocked, puzzles),
  `ChooseUpgrade {week, upgrade, hubId?}` (task 12 UI shape), `CancelUpgradePick {week}` (task 39, D-49: back
  from the hub/airport pick of a targeted upgrade to the week's offers), `SetSpeed {speed}`. City ids are
  `src/data/cities.ts` codes; distances/flight times come from the generated table, never from callers.
  Unknown extra fields (e.g. `legDistancesKm`) are dropped. Rejected commands are journaled too.
- **Time**: `tick` = kernel step (journal index); `world.minute` = game minute. They differ only if
  someone ticks while an upgrade offer is pending (the world is frozen then).
- **Balance and rules versions**: knobs and their `*_PARAMS_VERSION` in `src/sim/params.ts` (licence knobs in
  `src/sim/licence.ts`), the rules version `RULES_VERSION` in `src/sim/state.ts`.
- **Renderer**: `world.planes[i]` has `routeId, segment, progress01 (0..10000), direction, phase, load`;
  `world.routes()` gives `cityIds` and `legKm` per route.
- **Saves**: `saveSourceFromSim(sim)` / `restoreSimFromSave(save)` in `src/game/save.ts` (envelope v5; a run with
  the weather front is written as v7, D-291).
- **Modes**: Endless and Daily = `EndlessRun.create(seed, mode, homeRegion?, licenceClass?, …)` (`src/game/run.ts`);
  Daily = `createDailyMode(scores)` (`src/game/modes/daily.ts`, Warsaw seed); Puzzles = `src/game/modes/puzzle.ts`
  sessions on `createGame(level.demandSeed, 'puzzle', level.id)`.
- **Pure read-only views in `src/game`** (no Sim writes, no hash change): `surge.ts`, `weather.ts`, `fillTrend.ts`,
  `hubBoard.ts`, `milestones.ts`, `contractsSummary.ts`, `surgesSummary.ts`, `pauseSummary.ts`, `runTimeline.ts`.
- **Distances for input/UI**: `cityDistanceKm(a, b)` from `src/data/index.ts`.

# Airway — production architecture

Status: production, integration of tasks 01–29 (all task branches merged into `integration/merge-train`, then unified
per area). Read [Decisions](DECISIONS.md) — especially D-11 (Diorama), D-12 (Airway), D-13 (deterministic pure
simulation) and the task decisions D-19…D-37 — and [Research](RESEARCH.md) sections 3–5.

## Module map

| Module | Owns (main files) | Dependencies allowed |
| --- | --- | --- |
| `src/core` | Seeded mulberry32 RNG with serializable state and named forks (`rng.ts`), fixed-step clock (`clock.ts`), Warsaw-calendar daily seed (`daily.ts`), number/duration formatting (`format.ts`), localization facade (`i18n.ts`) | Pure TypeScript; device settings only outside the simulation |
| `src/sim` | Deterministic kernel (`sim.ts`, `state.ts`, `commands.ts`, `clock.ts`, `undo.ts`, `params.ts`); world: city spawning (`spawner.ts`), route graph (`network.ts`), regional demand (`demand.ts`), routing (`routing.ts`), hub queues/MCT/failure (`hubs.ts`), failure ledger (`ledger.ts`), aircraft (`planes.ts`) and leg scheduling (`schedule.ts`), day/night + curfew (`daynight.ts`), weekly upgrades (`upgrades.ts`) | `src/core` pure helpers and `src/data` integer/immutable records only (D-13, `test:arch`) |
| `src/data` | 165 versioned cities (`cities.ts`), destination regions + glyph/colour ids (`regions.ts`), generated integer distance table (`generated/distances.ts`, from `build:distances`), 30 JSON puzzles (`puzzles/`, 16–30 tagged with the mechanics they teach) | Types and static data; no rendering assumptions |
| `src/render` | three.js world: scene/canvas (`scene.ts`), Diorama globe — terrain, land mask, clouds, geo maths (`globe/`), orbit camera (`camera.ts`), airports (`airports.ts`), route tubes and ghost (`routes.ts`, `routePreview.ts`), instanced planes (`planes.ts`, `models/planes.ts`), sun/terminator (`sun.ts`), quality tiers and pacing (`quality.ts`), model window meshes (`modelPreview.ts`) | Read-only game snapshots, three.js, browser canvas |
| `src/ui` | Airport-object UI (D-11): HUD boarding pass + luggage-tag dock (`hud/`), airport tags/overlay and its pure layout (`overlay.ts`, `overlay-layout.ts`), ATC strip (`atcStrip.ts`), split-flap engine (`flap.ts`) and menu (`menu/`), weekly cargo-label upgrade (`upgrade/`), game-over board (`gameover/`), puzzle board (`puzzles/`), settings (`settings/`), airport code/name labels (`airportLabel.ts`, D-68), daily ranking board (`leaderboard/`, D-66), tutorial overlay (`tutorial/`), glyphs, a11y adapters, responsive layout, theme tokens (`theme/`) | Read-only state, localization, HTML/CSS/SVG; emits intents through callbacks |
| `src/input` | Pointer/touch gesture recognizer and camera adapter (`gestures.ts`), finger route editor (`routeTool.ts`) | View hit-testing/projection and a command dispatcher |
| `src/audio` | Event-driven hub resonators: engine (mix bus, limiter, offline render hook), 125 ms lookahead scheduler, region-scaled pitch (D-30, D-71); run events → cues live in `src/game/audioCues.ts` | Read-only events/state; Web Audio behind adapter |
| `src/net` | [night-06] D-66 online leaderboards: board ids (Warsaw day / ISO week, `boards.ts`), daily submission = command journal + authoritative replay verdict on the same Sim (`submission.ts`, shared with `functions/`), dependency-free Firebase REST client (anonymous Auth, callables; `client.ts`), offline queue (`queue.ts`), facade disabled without `VITE_FIREBASE_*` config (`index.ts`) | `src/core`, `src/sim` (read-only replay); never imported by `src/sim` (`test:arch`) |
| `functions/` | [night-06b] Callable Cloud Functions `submitDaily` / `getBoards` (europe-west1); esbuild bundles `src/net/submission.ts` + `src/sim` so the server replays with the exact game code; pure rules in `functions/src/logic.ts`; Firestore server-only (`firestore.rules`) | `firebase-functions`, `firebase-admin`, shared `src/net` + `src/sim` |
| `src/platform` | Capacitor bridges: storage/IndexedDB/native dual-slot saves (`storage.ts`), lifecycle + background pause (`lifecycle.ts`), hardware back (`back.ts`), haptics, share, no-op ads/store (`ads.ts`, `store.ts`, D-16) | Capacitor APIs; never imported by the simulation |
| `src/game` | Composition root and orchestration: screen router (`screens.ts`), modes (`modes/daily.ts`, `modes/puzzle.ts`), save envelope v1 (`save.ts`), scores, failure causes (`causes.ts`), tutorial controller (`tutorial/`), daily ranking glue (`dailyRanking.ts`, D-66), content gate (`gating.ts`), DEV-only E2E handle (`devHandle.ts`) | Wires all modules through explicit interfaces |
| `src/i18n` | English and Polish catalogs (identical keys), saved language → device language → `en` | — |
| `src/main.ts` | Bootstrap: mounts the composition root; installs `window.aw` only in DEV | — |

Outside `src/`:

| Path | Purpose |
| --- | --- |
| `dev/globe.html`, `dev/globe.ts` | Standalone globe page for visual QA (`npm run shots -- globe`) |
| `scripts/` | Generators (`build-distances.mjs`, `build-land.mjs`), Node unit tests (`test-*.mjs/ts`), the bot/balance harness, perf, Android build, and the browser tooling: `lib/harness.mjs` (Vite + SwiftShader Chromium), `shots.mjs`, `ui-matrix.mjs`, `store-shots.mjs`, `run-suite.mjs` (`test:fast` / `test:ci`) |
| `e2e/` | Playwright smoke and its harness-only fixture (contract in `e2e/README.md`) |
| `site/` | Framework-free landing page airway.games (`docs/SITE.md`) |
| `android/`, `ios/`, `resources/`, `fastlane/` | Capacitor native projects and store tooling (`docs/ANDROID.md`, `docs/IOS.md`) |
| `mockups/` | Stage-0 reference mockups (read-only history) |
| `docs/` | Decisions, research, styles, tasks, testing, store copy, screenshots (`docs/shots/README.md`) |

No module other than the composition root should orchestrate multiple world and input subsystems.
`src/sim` MUST NOT import three.js, DOM/browser UI, input, audio, render or Capacitor. The
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

- Source files: lower-case kebab-case; exported types/interfaces: `PascalCase`;
  functions/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep transport objects serializable; avoid `three.Vector3`, `Date`, floating-point
  angles and DOM references in simulation models. Use readonly snapshots and
  discriminated command unions as the kernel expands (task 02).
- Translation identifiers: descriptive dotted keys (e.g. `action.pause`) in both
  `src/i18n/en.ts` and `src/i18n/pl.ts`; values must not be empty or mismatched.
- Change balancing only through named constants/tables in `src/sim/params.ts`;
  when tuning, version the parameters and rerun fixed-seed regression tests.
- Respect the Diorama palette, SIL OFL fonts, 48 dp targets, safe areas, portrait,
  landscape and foldable layouts. Use procedural or documented CC0 assets only.

## Ownership during integration

The merged code is unified by five areas: **sim** (`src/sim`, `src/core`, `src/data`), **render** (`src/render`,
`dev/`), **ui** (`src/ui`, `src/input`, `src/game`, `src/main.ts`, `src/i18n`), **platform** (`src/platform`,
`src/audio`, `android/`, `ios/`, monetization docs) and **tooling** (`package.json` scripts, `scripts/` browser tooling,
`e2e/`, `site/`, `docs/`). The *Sim API* and *Render API* sections of this document are maintained by the sim and render
areas. Dependencies stay one-way: `sim ← game → render/ui/input/audio/platform`.

## Render API

One renderer stack, one entry point: `createWorldRenderer(canvas?, opts)` in
`src/render/world.ts` (re-exported by `src/render/index.ts`; import from there). It owns the
single `WebGLRenderer`, `Scene`, light rig (subsolar `DirectionalLight` + sky
`HemisphereLight`, `globe/createSunLights`), quality profile (`quality.ts`, D-33) and
`GlobeOrbitCamera`. Layers: globe terrain/decor/atmosphere (`globe/`), airports with hub
capacity rings and curfew barriers (`airports.ts`; regional look, palms/snow and landmarks from
`models/airportStyle.ts` on the shared instanced kit `models/airportKit.ts`, D-53), route tubes (`routes.ts`), instanced
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
const sim = createGame(seed, 'endless');            // 'endless' | 'daily' | 'puzzle' (+ puzzleId)
sim.check(cmd);          // { ok } | { ok: false, reason: RejectReason } — instant UI feedback, no side effect
sim.apply(cmd);          // queue for the next tick; false only for malformed input
sim.tick();              // ONE game minute: commands -> spawner -> curfew -> demand -> planes -> hubs/jam -> game over -> week end
sim.schedulingSpeed;     // ticks/s multiplier src/game should use (0 while paused, at an upgrade offer, after game over)
sim.drainEvents();       // SimEvent[] since last call (CitySpawned, Delivered, HubJamStarted, DepartureHeld (task 32), UpgradeOffered, GameOver, CommandRejected…)
sim.world;               // WorldView (read-only): minute, status, score, failure, offer, reserve, planes (live array),
                         //   cities(), cityView(id), routes(), hubCauseLedger(id), curfewCityIds, upgrades
sim.clock;               // calendar of the world minute (frozen while an upgrade is pending)
sim.hash(); sim.snapshot(); Sim.fromSnapshot(json); Sim.replay(seed, journal, ticks, config); sim.undo();
```

- **Commands** (`src/sim/commands.ts`): `AddRoute {cityIds, aircraft?}` (route id `R<n>` assigned by
  the sim, announced by `RouteAdded`; `aircraft` also assigns a spare plane), `ExtendRoute {routeId,
  end, cityIds}` (full resulting list, route-tool format), `ShortenRoute {routeId, end}`, `RemoveRoute`,
  `AssignPlane {routeId, aircraft}`, `UnassignPlane {planeId}`, `UpgradeHub {hubId}` (stocked, puzzles),
  `ChooseUpgrade {week, upgrade, hubId?}` (task 12 UI shape), `CancelUpgradePick {week}` (task 39, D-49: back
  from the hub/airport pick of a targeted upgrade to the week's offers), `SetSpeed`. City ids are
  `src/data/cities.ts` codes; distances/flight times come from the generated table, never from callers.
  Unknown extra fields (e.g. `legDistancesKm`) are dropped. Rejected commands are journaled too.
- **Time**: `tick` = kernel step (journal index); `world.minute` = game minute. They differ only if
  someone ticks while an upgrade offer is pending (the world is frozen then).
- **Renderer**: `world.planes[i]` has `routeId, segment, progress01 (0..10000), direction, phase, load`;
  `world.routes()` gives `cityIds` and `legKm` per route.
- **Saves**: `saveSourceFromSim(sim)` / `restoreSimFromSave(save)` in `src/game/save.ts`.
- **Modes**: Daily = `createDailyMode(scores)` (`src/game/modes/daily.ts`, Warsaw seed); Puzzles =
  `src/game/modes/puzzle.ts` sessions on `createGame(level.demandSeed, 'puzzle', level.id)`.
- **Distances for input/UI**: `cityDistanceKm(a, b)` from `src/data/index.ts`.

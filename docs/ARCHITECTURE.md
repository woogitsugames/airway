# Airway — production architecture

Status: MVP foundation, task 01. Read [Decisions](DECISIONS.md), especially D-11 (Diorama),
D-12 (Airway), D-13 (deterministic pure simulation), and [Research](RESEARCH.md) sections 3–5.

## Dependency boundaries

| Module | Owns | Dependencies allowed |
| --- | --- | --- |
| `src/core` | Seeded RNG with serializable state, fixed clock, formatting, localization facade | Pure TypeScript; localization may access device settings only outside the simulation |
| `src/sim` | Commands, routes, demand, passengers, aircraft, hub queues, failure, upgrades, balance | `src/core` pure helpers and `src/data` integer/immutable records only |
| `src/data` | Versioned city/airport definitions, region shapes and precalculated travel numbers | Types and static assets; no rendering assumptions |
| `src/render` | three.js world (Diorama globe, sunlight/terminator, terrain, airports, planes) | Read-only game snapshots, three.js, browser canvas |
| `src/ui` | Accessible boarding-pass HUD, luggage-tag dock, flight strips and split-flap menus | Read-only state, localization, HTML/CSS/SVG |
| `src/input` | Pointer/touch/keyboard interpretation; gesture conflict resolution | View hit-testing/projection and a command dispatcher |
| `src/audio` | Procedural resonating-hub audio and feedback | Read-only events/state; Web Audio behind adapter |
| `src/platform` | Capacitor bridges, persistence, lifecycle, safe areas | Capacitor APIs; no dependency from simulation |
| `src/game` | Composition root, mode lifecycle, tick scheduling, replay/undo coordination | Wires all modules through explicit interfaces |
| `src/i18n` | English and Polish dictionaries, saved language and translation | Settings → device language → `en` fallback |

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
  Define pause/background behavior in task 16, not in this scaffold.
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

## Ownership and next steps

Task 01 intentionally contains an **empty** sky-color WebGL scene, not a playable
globe. The globe, geometry, camera, simulation, input, game modes, UI and audio
belong to the follow-on tasks in `docs/tasks/00-INDEX.md`. Dependencies remain
one-way so parallel tasks can be merged into `dev` independently.

## Render API

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
| `render(alpha, dtSeconds)` | every frame | `alpha` = tick accumulator fraction; camera inertia, plane interpolation |
| `pick(x, y)` | tap | `{kind:'city', id}` within 28 dp, else `{kind:'globe', lon, lat}`, else `null` |
| `pickGlobe(x, y)` | route tool `cursorGeo` | analytic sphere hit |
| `project(lon, lat, alt, out)` | HTML overlay, per frame | writes `{x, y, visible}` into `out`; no allocation |
| `orbit` | input | `GlobeOrbitCamera`: pass to `cameraGestureCallbacks(orbit, …)` |
| `camera` | overlay | three.js camera for `createAirportOverlay(host, camera)` |
| `resize(w, h, insets)` / `opts.autoResize` | layout | CSS px; insets keep the globe clear of HUD and safe areas |
| `setQuality(pref)` | settings | `'auto' \| 'low' \| 'medium' \| 'high'`; rebuilds terrain, DPR ≤ 2, shadows on high only |
| `drawModelPreview(kind, canvas2d)` | upgrade card | renders through the shared context into a 2D canvas |
| `ready`, `stats()`, `dispose()` | lifecycle | `ready` resolves after the land mask/terrain load |

Screen coordinates are CSS pixels relative to the canvas' top-left corner. Frame pacing:
`AdaptiveFrameScheduler` (30 FPS idle, full rate while interacting, stopped when hidden).
Dev pages: `dev/world.html` (full stack, `?frozen&clean&quality=&zoom=`), `dev/globe.html`.

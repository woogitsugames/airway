# Airway — production architecture

Status: production, integration of tasks 01–29 (all task branches merged into `integration/merge-train`, then unified
per area). Read [Decisions](DECISIONS.md) — especially D-11 (Diorama), D-12 (Airway), D-13 (deterministic pure
simulation) and the task decisions D-19…D-37 — and [Research](RESEARCH.md) sections 3–5.

## Module map

| Module | Owns (main files) | Dependencies allowed |
| --- | --- | --- |
| `src/core` | Seeded mulberry32 RNG with serializable state and named forks (`rng.ts`), fixed-step clock (`clock.ts`), Warsaw-calendar daily seed (`daily.ts`), number/duration formatting (`format.ts`), localization facade (`i18n.ts`) | Pure TypeScript; device settings only outside the simulation |
| `src/sim` | Deterministic kernel (`sim.ts`, `state.ts`, `commands.ts`, `clock.ts`, `undo.ts`, `params.ts`); world: city spawning (`spawner.ts`), route graph (`network.ts`), regional demand (`demand.ts`), routing (`routing.ts`), hub queues/MCT/failure (`hubs.ts`), failure ledger (`ledger.ts`), aircraft (`planes.ts`) and leg scheduling (`schedule.ts`), day/night + curfew (`daynight.ts`), weekly upgrades (`upgrades.ts`) | `src/core` pure helpers and `src/data` integer/immutable records only (D-13, `test:arch`) |
| `src/data` | 165 versioned cities (`cities.ts`), destination regions + glyph/colour ids (`regions.ts`), generated integer distance table (`generated/distances.ts`, from `build:distances`), 15 JSON puzzles (`puzzles/`) | Types and static data; no rendering assumptions |
| `src/render` | three.js world: scene/canvas (`scene.ts`), Diorama globe — terrain, land mask, clouds, geo maths (`globe/`), orbit camera (`camera.ts`), airports (`airports.ts`), route tubes and ghost (`routes.ts`, `routePreview.ts`), instanced planes (`planes.ts`, `models/planes.ts`), sun/terminator (`sun.ts`), quality tiers and pacing (`quality.ts`), model window meshes (`modelPreview.ts`) | Read-only game snapshots, three.js, browser canvas |
| `src/ui` | Airport-object UI (D-11): HUD boarding pass + luggage-tag dock (`hud/`), airport tags/overlay and its pure layout (`overlay.ts`, `overlay-layout.ts`), ATC strip (`atcStrip.ts`), split-flap engine (`flap.ts`) and menu (`menu/`), weekly cargo-label upgrade (`upgrade/`), game-over board (`gameover/`), puzzle board (`puzzles/`), settings (`settings/`), tutorial overlay (`tutorial/`), glyphs, a11y adapters, responsive layout, theme tokens (`theme/`) | Read-only state, localization, HTML/CSS/SVG; emits intents through callbacks |
| `src/input` | Pointer/touch gesture recognizer and camera adapter (`gestures.ts`), finger route editor (`routeTool.ts`) | View hit-testing/projection and a command dispatcher |
| `src/audio` | Event-driven hub resonators: engine, 125 ms lookahead scheduler, pitch, sim-event → cue mapping (D-30) | Read-only events/state; Web Audio behind adapter |
| `src/platform` | Capacitor bridges: storage/IndexedDB/native dual-slot saves (`storage.ts`), lifecycle + background pause (`lifecycle.ts`), hardware back (`back.ts`), haptics, share, no-op ads/store (`ads.ts`, `store.ts`, D-16) | Capacitor APIs; never imported by the simulation |
| `src/game` | Composition root and orchestration: screen router (`screens.ts`), modes (`modes/daily.ts`, `modes/puzzle.ts`), save envelope v1 (`save.ts`), scores, failure causes (`causes.ts`), tutorial controller (`tutorial/`), content gate (`gating.ts`), DEV-only E2E handle (`devHandle.ts`) | Wires all modules through explicit interfaces |
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

# Airway — test and build contract

The canonical smoke sequence, before each push:

```sh
npm ci
npm run typecheck
npm run test:fast
npm run build
```

| Command | What it checks | Expected final summary |
| --- | --- | --- |
| `npm run typecheck` | Strict TypeScript on app and config | Exit code 0 (tsc is intentionally silent on success) |
| `npm run test:i18n` | PL/EN dictionary key parity, duplicates, empty values, interpolation placeholders | `SUMMARY test:i18n seed=0xA1A1 files=2 keys=N passed=1 failed=0` |
| `npm run test:geo-math` | Globe coordinates, analytic sphere intersection, London/Lisbon/Cairo picking (including off-center) at fixed seed | `SUMMARY test:geo-math seed=0xA1A1 tests=N passed=N failed=0` |
| `npm run test:arch` | TS-AST guard: simulation imports only pure modules; no DOM, Capacitor, three.js, wall clock or transcendental Math | `SUMMARY test:arch seed=0xA1A1 files=N passed=1 failed=0` |
| `npm run test:rng` | [task-02] mulberry32 vectors, RNG state, independent streams, UTF-8 FNV, bounds | `SUMMARY test:rng seed=0xA1A1 passed=6 failed=0` |
| `npm run test:sim-kernel` | [task-02] 50,000-tick replay, clock, command queue, JSON restore and hash | `SUMMARY test:sim-kernel seed=0xA1A1 passed=7 failed=0` |
| `npm run test:undo` | [task-02] exact rollback, same-tick ordering, checkpoint boundaries, ring eviction, restore | `SUMMARY test:undo seed=0xA1A1 passed=7 failed=0` |
| `npm run test:daily` | [task-02] Warsaw midnight in CET/CEST, DST transitions, stable daily seed, ISO weeks | `SUMMARY test:daily seed=0xA1A1 passed=7 failed=0` |
| `npm run test:fast` | `typecheck`, then i18n, architecture and all four kernel tests | All test summaries and exit code 0 |
| `npm run build` | `tsc --noEmit && vite build` | Exit code 0; `dist/` output |
| `npm run build:land` | Generate 2048×1024 prebuilt RLE Natural Earth 50m raster; `--check` compares tracked file | `SUMMARY build-land seed=0xA1A1 ... failed=0` |
| `npm run shots:globe` | Standalone Diorama globe visual QA in 412×915 and 915×412, with FPS/draw calls | `SUMMARY shots:globe seed=0xA1A1 captured=2 failed=0` |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/01/` |
| `npm run mockups` | Preserve stage-0 Diorama and other reference mockup generation | Exit code 0 |
| `npm run shots:mockups` | Preserve stage-0 Playwright captures of reference mockups | Existing PNG output under `mockups/*/png/` |
| `npm run test:fast` | Typecheck, i18n, architecture, cities and city spawner regression | Four test summaries and exit code 0 |
| `npm run build:distances` | Regenerate the integer distance table from rounded city coordinates | `SUMMARY distances seed=0xA1A1 cities=165 pairs=13530 passed=1 failed=0` |
| `npm run test:cities` | Validate bilingual names, codes, regions, table freshness and all 13,530 great-circle pairs within 1 km | `SUMMARY test:cities seed=0xA1A1 cities=165 pairs=13530 passed=1 failed=0` |
| `npm run test:replay` | [integration-sim] 3 seeds × 2 game weeks of scripted commands on the real Sim: mid-run snapshot/restore, journal-only replay, save envelope round trip, undo, a bot run across a weekly upgrade, puzzle scenario | `SUMMARY test:replay seeds=3 ticks=20160 passed=20 failed=0 ...` |
| `npm run test:spawner` | Test 16 seeded replays, 6-degree spacing, startup locality, game-hour timing and 40-city cap | `SUMMARY test:spawner seed=0xA1A1 seeds=16 pairsChecked=278076 passed=1 failed=0` |
| `npm run test:gestures` | 31 pointer/camera sequences: route/edit, orbit, pinch, long press, one-hand zoom, fit, edge pan, DPR and layouts | `SUMMARY test:gestures seed=0xA1A1 cases=31 passed=31 failed=0` |
| `npm run test:fast` | `typecheck`, `test:i18n`, `test:arch` and `test:gestures` | All test summaries and exit code 0 |
| `npm run test:overlay-layout` | 30-city collisions, jam priority, boundaries, repeatability, overflow | `SUMMARY test:overlay-layout seed=0xA1A1 cases=7 passed=7 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch` | All three test summaries and exit code 0 |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=6 failed=0`; images in `docs/shots/01/` and `docs/shots/06/` |
| `npm run test:routing` | Minimum transfers, distance ties, graph edits and stable region destinations | `SUMMARY test:routing seed=0xA1A1 cases=7 passed=7 failed=0` |
| `npm run test:hubs` | Hub formation, MCT, queue grace, recovery and aircraft passenger conservation | `SUMMARY test:hubs seed=0xA1A1 cases=6 passed=6 failed=0` |
| `npm run test:sim-week` | Three deterministic seven-day runs, snapshots and expected no-route failure tick | `SUMMARY test:sim-week seeds=3 ... cases=6 passed=6 failed=0` |
| `npm run test:planes` | Plane types, reserves, range rejections with exact km, assignment and release | `SUMMARY test:planes seed=0xA1A1 cases=8 passed=8 failed=0` |
| `npm run test:schedule` | Dwell, back-and-forth movement, capacity, passenger balance and 7-day replay | `SUMMARY test:schedule seed=0xA1A1 cases=7 passed=7 failed=0` |
| `npm run test:route-tool` | Fixed-seed airport snapping, multi-stop AddRoute/ExtendRoute, range guards, endpoint handles, menu, speed restore and undo | `SUMMARY test:route-tool seed=0xA1A1 passed=17 failed=0` |
| `npm run test:fast` | `typecheck`, `test:i18n`, `test:arch` and `test:route-tool` | All test summaries and exit code 0 |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch`, then `test:interp` | Both test summaries and exit code 0 |
| `npm run test:interp` | <!-- [task-10] --> 17 seeded checks of great-circle geometry, route-boundary interpolation, 40 routes, 100 instanced planes and per-frame route rebuild guard | `SUMMARY test:interp seed=0xA1A1 passed=17 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch`, then `test:daynight` | All test summaries and exit code 0 |
| `npm run test:daynight` | Fixed-seed local time, demand, weekly curfew, snapshot, sun interpolation and render adapters | `SUMMARY test:daynight seed=0xA1A1 passed=N failed=0` |
| `npm run shots` | Browser smoke: game canvas and responsive HUD at portrait / landscape / foldable dimensions | `SUMMARY shots seed=0xA1A1 captured=2 failed=0` and `SUMMARY test:hud-targets ... shots=4`; images in `docs/shots/01/` and `docs/shots/13/` |
| `npm run test:hud-targets` | Playwright: 6 controls, ≥48 dp targets, synthetic safe-area clearance, no overlaps or overflow, live rotation, drag-to-route callback, empty-stock disabling, stable render nodes; saves four review screenshots | `SUMMARY test:hud-targets seed=0xA1A1 passed=N failed=0 shots=4` and PNGs in `docs/shots/13/` <!-- [task-13] --> |
| `npm run test:upgrades` | Fixed-seed weekly offers, selected upgrade effects and congestion tie-breaking | `SUMMARY test:upgrades seed=0xA1A1 cases=5 passed=5 failed=0` |
| `npm run test:flap` | Unicode split-flap segmentation, Polish diacritics, truncation, 60–90 ms cascade plan | `SUMMARY test:flap seed=0xA1A1 passed=15 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch`, then `test:flap` | All test summaries and exit code 0 |
| `npm run shots:14` | Actual menu screenshot at 412×915 and 915×412 | `SUMMARY shots:14 seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/14/` |
| `npm run test:causes` | Six fixed-seed checks for hub-ledger cause ranking, missing evidence, world identity and local records | `SUMMARY test:causes seed=0xA1A1 scenarios=3 passed=6 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch` | Three test summaries and exit code 0 |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=4 failed=0`; images in `docs/shots/01/` and `docs/shots/15/` |
| `npm run test:saves` | [task-16] Fixed-seed save/load hash, v0 migration, corrupt JSON, IndexedDB, native dual-slot saves, background pause | `SUMMARY test:saves seed=0xA1A1 passed=11 failed=0` |
| `npm run test:fast` | `typecheck`, `test:i18n`, `test:arch`, then `test:saves` | All three test summaries and exit code 0 |
| `npm run test:audio-sched` | 125 ms lookahead, stable order, voice cap at 4x, immediate mute, pitch | `SUMMARY test:audio-sched seed=0xA1A1 tests=8 passed=8 failed=0` |
| `npm run test:fast` | `typecheck`, i18n, architecture and audio scheduler | All test summaries and exit code 0 |
| `npm run test:fast` | `typecheck`, i18n, architecture, CVD and contrast checks | All four test summaries and exit code 0 |
| `npm run test:cvd` | Machado 2009 full-severity protan/deutan/tritan; 6 destination colours, minimum pairwise CIE76 ≥ 15; CSS token parity | `SUMMARY test:cvd seed=0xA1A1 modes=3 colours=6 comparisons=45 passed=1 failed=0` |
| `npm run test:contrast` | WCAG 2.x contrast ratio ≥ 4.5:1 for all declared text/background pairs; CSS token parity | `SUMMARY test:contrast seed=0xA1A1 pairs=16 threshold=4.5 passed=1 failed=0` |
| `npm run test:puzzles` | Task-17 JSON puzzle validation, zero-action loss, 15 reference wins at ≥15%, deterministic replay, unlimited undo/reset, rejected commands | `SUMMARY test:puzzles seed=0xA1A1 levels=15 cases=N passed=N failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, `test:arch`, `test:puzzles` | All test summaries and exit code 0 |
| `npm run shots:puzzles` | [task-17] Puzzle selector screenshot smoke in two orientations | `SUMMARY shots:puzzles seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/17/` |
| `npm run test:daily-mode` | [task-18] Warsaw midnight/DST, offline attempts, best scores, streaks and emoji-free ticket (fixed adapter seed) | `SUMMARY test:daily-mode seed=0xA1A1 passed=12 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch`, then `test:daily-mode` | All three test summaries and exit code 0 |
| `npm run test:perf-scene` / `npm run perf:scene` | [task-21] Synthetic Chromium/SwiftShader fixture: 40 cities, 100 planes, 40 routes, 120 wall seconds at 4x. JSON at `.perf/scene.json`; Playwright and Chromium required. | `SUMMARY perf:scene seed=0xA1A1 frames=N samples=N failed=0` |
| `npm run test:balance` | Real engine: 10 seeded games, deterministic replay, zero invalid commands, 8–15 minute median, and hub-overflow warning | `SUMMARY test:balance seed=0xA1A1 mode=game seeds=10 ... passed=1 failed=0`; fails until the production adapter exists |
| `npm run test:balance:fixture` | 10 seeded stand-in sessions and bot-policy assertions; **not production balance** | `SUMMARY test:balance seed=0xA1A1 mode=fixture seeds=10 ... passed=1 failed=0` |
| `npm run balance:report` | Real engine: 50 seeded sessions to `docs/balance/game-50.csv` and summary | `SUMMARY balance:report seed=0xA1A1 mode=game seeds=50 ... passed=1 failed=0` |
| `npm run balance:fixture` | Stand-in: 50 synthetic runs in `docs/balance/fixture-50.csv` | `SUMMARY balance:report seed=0xA1A1 mode=fixture seeds=50 ... passed=1 failed=0` |
| `npm run test:e2e:tutorial` | [task-23] Six training actions, replay/skip/persistence, 412×915 and responsive screenshot matrix | `SUMMARY test:e2e:tutorial seed=0xA1A1 passed=N failed=0 screenshots=10` |
| `npm run test:android-config` | Fixed-seed, SDK-free checks for Android manifest, foldable, edge-to-edge and signing setup | `SUMMARY test:android-config seed=0xA1A1 checks=14 passed=14 failed=0` |
| `npm run test:fast` | `typecheck`, `test:i18n`, `test:arch`, then `test:android-config` | Three test summaries and exit code 0 |
| `npm run test:ios-config` | Verify iOS orientations, permissions, bundle ID, CocoaPods, native audio, safe-area tokens and PNG dimensions | `SUMMARY test:ios-config seed=0xA1A1 checks=N passed=1 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, `test:arch`, `test:ios-config` | All three test summaries and exit code 0 |
| `npm run test:store-shots` | [task-26] Validate PL/EN store copy limits, owner titles and 30-shot matrix (fixed seed) | `SUMMARY test:store-shots seed=0xA1A1 listings=2 fields=12 scenes=5 devices=3 passed=1 failed=0` |
| `npm run store:shots` | [task-26] Capture 5 actual game scenes in PL/EN on phone, foldable and tablet; requires integrated dev-only fixture | `SUMMARY store:shots seed=0xA1A1 expected=30 captured=30 passed=1 failed=0`; PNGs in `docs/store/shots/` |
| `npm run test:gating` | Free entitlements, no-op ads, disabled content gate, and no new monetization SDK dependencies | `SUMMARY test:gating seed=0xA1A1 passed=8 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, `test:arch`, and `test:gating` | All three test summaries and exit code 0 |
| `npm run test:e2e:smoke` | Real Playwright gameplay journey: boot, menu, seeded start, route, aircraft, week, upgrade, save/load, overload and return | `SUMMARY test:e2e:smoke seed=0xA1A1 mode=game passed=9 failed=0 durationMs=N` |
| `npm run ui:matrix` | Real game menu/game/upgrade/gameover in PL/EN at 412×915, 915×412, 673×841, 904×1000 (DPR 1) | `SUMMARY ui:matrix seed=0xA1A1 mode=game captured=32 expected=32 failed=0 durationMs=N` |
| `npm run test:site` | Local links, 3 preview alt texts, PL/EN catalog parity, privacy page and no trackers | `SUMMARY test:site seed=0xA1A1 assertions=N passed=N failed=0` |
| `npm run build:site` | Copies framework-free page into ignored `site/dist` | `SUMMARY build:site seed=0xA1A1 files=6 assetFolders=2 failed=0` |
| `npm run shots:site` | Captures landing page 412×915 and 915×412 with Playwright | `SUMMARY shots:site seed=0xA1A1 captured=2 failed=0` |

Every future test must have a fixed seed (use `0xA1A1` where no gameplay seed
is needed), terminate with one `SUMMARY ...` line, set a nonzero exit code on
failure, expose a `test:<name>` npm command and have a row in this table.

Kernel tests use Node.js 22+ TypeScript type stripping (`node --experimental-strip-types`).
The game uses `*.ts` module imports so the same source is executed by Node tests
and bundled by Vite; `tsconfig.json` enables `allowImportingTsExtensions` with `noEmit`.
The game scheduler reads `sim.schedulingSpeed` to wake a paused sim from a queued
`SetSpeed` resume command; the committed `sim.speed` changes only on the next tick.

### Boundary regression

To verify the guard itself, temporarily add
`import { Scene } from 'three';` to `src/sim/__arch-negative.ts`,
run `npm run test:arch`, verify exit code nonzero and a `forbidden
dependency` line, **delete the temporary file**, and rerun the test clean.
Never commit the negative-control file.

### Screenshot prerequisites

`npm run shots` uses the environment-provided **Playwright and Chromium**;
neither is intentionally added as an npm dependency. A missing browser/runtime
produces a failing summary. Screenshot files are only committed after review.
The two PNG dimensions are **412×915** and **915×412** at DPR 1 (exact pixel
size). Foldable 673×841 / 904×1000 checks are part of later UI tasks.
<!-- [task-05] Generated geography and seeded city-spawner regressions. -->
Task 05: the production `prebuild` step regenerates the checked-in distance matrix. The `test:cities` step also runs the generator in `--check` mode to detect stale generated output. These tests use a temporary, isolated CommonJS transpilation of the production modules to avoid changes to the app build tooling.
<!-- [task-04] Standalone gesture scenarios, tested at a fixed seed. -->
<!-- [task-06] Screenshot coverage pending fixture execution. -->
The `npm run shots` command also captures `?dev=airports` at 1× and 2.5× in
portrait and landscape, writing four PNGs under `docs/shots/06/`.
This temporary sea-sphere fixture exercises the airport/overlay layer;
it is not a substitute for task 03's production globe.
// [task-07] Isolated task 07 has no integrated globe or sim. Its screenshot status is in docs/shots/07/README.md.
### Task 11 integration boundary
Until tasks 02/03/05/06/08/09 have been merged, the sun, curfew and demand
adapters are deliberately not connected to the empty baseline scene. The
production screenshot target `docs/shots/11/` must be captured and reviewed
after the real globe is available on `dev`. Never present empty-sky captures
as verified day/night screenshots. The task 08 hourly demand table intentionally
matches task 11 and must be kept as a single definition when merging.
<!-- [task-15] Failure-screen visual fixture and camera adapter. -->
Task 15 screenshots use `npm run shots` with `?preview=gameover` (development-only)
to capture `docs/shots/15/game-p.png` and `docs/shots/15/game-l.png`. This fixture
does not replace an integration test with task 08's real ledger or task 04's
camera. The game-over controller pauses simulation immediately and drives an
injected renderer focus callback for 700ms with cubic ease-out, then freezes
the scene and presents the report. It never mutates the simulation.
<!-- [task-19] Audio scheduling regression: no browser or AudioContext required. -->
<!-- [task-17] The additional puzzle-board screenshots are captured as docs/shots/17/board-p.png
and docs/shots/17/board-l.png after opening the puzzle selector. -->
<!-- [task-22] Balance harness: production test intentionally fails until 08/09/12 are integrated. -->
[task-23] The onboarding test also expects environment-provided Playwright and
Chromium, and captures seven portrait steps plus landscape and foldable checks
into `docs/shots/23/`. The temporary three-city adapter is not a simulation test:
integration with real route/HUD/upgrade events requires tasks 07/12/13.
[task-26] Store screenshots are intentionally fail-closed: without a complete deterministic game fixture, `npm run store:shots` exits nonzero and produces no publishable PNGs. The text-only validation command is independent of Playwright. See `docs/store/README.md`.
### Task 28 browser integration
The real E2E runner and screen matrix use the environment's Playwright + Chromium,
start a disposable Vite development server, and exit nonzero on missing features,
page errors, incomplete snapshots or failed assertions. They never replace real
gameplay with a mock. Requirements and exact selectors are documented in
[`e2e/README.md`](../e2e/README.md).
The dev-only `window.aw` bridge is installed by a DEV-guarded dynamic import.
It reports `ready=false` until a real `AwDevAdapter` is registered by the game.
Tasks 13-16 and their upstream dependencies are not yet merged on the task-28
branch's base; the complete gameplay smoke and production UI matrix are BLOCKED.
To validate the harness itself without game features, use
`node e2e/smoke.mjs --fixture` and `node scripts/shot.mjs --fixture`.
The fixture is a labeled, isolated test double; passing it does **not** satisfy
the gameplay acceptance criteria, and its 32 images are saved only to
`docs/shots/matrix-fixture/` (not `docs/shots/matrix/`).
<!-- [task-29] -->
Task 29 adds `test:site` to `test:fast`, a standalone `build:site` command and a `shots:site` capture command. `npm run shots` continues to capture the game shell.

# Airway — test and build contract

Before each push:

```sh
npm ci
npm run test:fast     # typecheck + every headless unit test, ends with test:arch (~30 s)
npm run build
```

`npm run test:ci` runs `test:fast`, the build and every browser/perf/screenshot suite (~6–8 min). Both suites use
`scripts/run-suite.mjs`: every step runs even after a failure, one `PASS|FAIL <step> <seconds> <SUMMARY>` line is
printed per step (with the output tail on failure), and the run ends with
`SUMMARY <suite> seed=0xA1A1 steps=N passed=N failed=N durationS=N [failing=…]` and a nonzero exit if any step failed.
Add a new fast test by appending its script name to the `test:fast` step list in `package.json` (before `test:arch`).

## Rules for tests

- Fixed seed (`0xA1A1` where no gameplay seed is needed), nonzero exit on failure, exactly one final
  `SUMMARY <name> seed=… passed=N failed=N` line, an npm script `test:*` / `perf:*` / `shots*`, and one row below.
- Node tests use Node 22+ type stripping (`node --experimental-strip-types`); sources import `*.ts` so the same modules
  run under Node and Vite (`allowImportingTsExtensions` + `noEmit`).
- Browser suites use the **environment's** Playwright 1.63 + Chromium (CI: `npm install --no-save playwright@1.63.0`);
  neither is an npm dependency. They start a disposable Vite dev server (`AIRWAY_E2E_URL` reuses a running one) and
  launch Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`
  (`scripts/lib/harness.mjs`). `CHROMIUM_PATH` overrides the browser binary. SwiftShader FPS is never device evidence.
- Fail closed (D-37): a missing screen, adapter or fixture is a FAIL, never a skipped pass. Harness-only fixtures
  report `mode=fixture` and write only to ignored folders.

## Commands

Times are measured in the integration container (8 vCPU, SwiftShader); “ci” = part of `test:ci`, “fast” = part of
`test:fast`.

| Command | Suite | ~Time | What it checks | Expected summary |
| --- | --- | --- | --- | --- |
| `npm run typecheck` | fast | 4 s | Strict `tsc --noEmit` on app and config | exit 0 (silent) |
| `npm run test:i18n` | fast | 1 s | PL/EN key parity, duplicates, empty values, interpolation placeholders | `SUMMARY test:i18n … files=2 keys=N passed=1 failed=0` |
| `npm run test:rng` | fast | <1 s | mulberry32 vectors, RNG state, independent streams, UTF-8 FNV, bounds | `… passed=6 failed=0` |
| `npm run test:sim-kernel` | fast | <1 s | 50 000-tick replay, clock, command queue, JSON restore and hash (D-19) | `… passed=7 failed=0` |
| `npm run test:undo` | fast | <1 s | Exact rollback, same-tick ordering, checkpoint boundaries, ring eviction | `… passed=7 failed=0` |
| `npm run test:daily` | fast | <1 s | Warsaw midnight CET/CEST, DST, stable daily seed, ISO weeks | `… passed=7 failed=0` |
| `npm run test:cities` | fast | 2 s | 165 bilingual cities, codes, regions, distance-table freshness (`build:distances --check`), 13 530 pairs ≤ 1 km | `… cities=165 pairs=13530 passed=1 failed=0` |
| `npm run test:spawner` | fast | 1 s | 16 seeded replays, 6° spacing, start cluster, 4-game-hour cadence, 40-city cap (D-20) | `… seeds=16 … passed=1 failed=0` |
| `npm run test:land` | fast | ~6 s | `build:land --check`: committed land raster matches Natural Earth 50m; [task-33] builds the terrain for all presets and checks watertight mesh (no T-junction cracks), no folded facets, coast teeth/stray from the smooth coastline, no Sahara terraces, open sea coarser than coasts, triangle budgets, determinism, mountains/snow where they are in reality, seamless Arctic ice, terrain below airport pads, tree/rock counts and placement (`scripts/build-land.check.mjs`) | `SUMMARY build-land … checked=1 checks=59 … failed=0` |
| `npm run test:geo-math` | fast | 1 s | Globe coordinates, ray–sphere picking (London/Lisbon/Cairo, off-centre) | `… tests=N passed=N failed=0` |
| `npm run test:gestures` | fast | 1 s | 31 pointer/camera sequences: route edit, orbit, pinch, long press, one-hand zoom, edge pan, DPR | `… cases=31 passed=31 failed=0` |
| `npm run test:overlay-layout` | fast | <1 s | 30-city tag collisions, jam priority, boundaries, repeatability; slot tag stacked under the passenger tag (no overlap, release, h:mm) | `… cases=19 passed=19 failed=0` |
| `npm run test:routing` | fast | 1 s | Minimum transfers, distance ties, graph edits, region destinations | `… cases=7 passed=7 failed=0` |
| `npm run test:hubs` | fast | 1 s | Hub formation, MCT, queue grace, recovery, passenger conservation (D-23) | `… cases=6 passed=6 failed=0` |
| `npm run test:sim-week` | fast | 1 s | Three seeded full-week runs (3 days, D-40), day-1 checkpoint/restore, no-route failure tick | `… seeds=3 weekTicks=4320 cases=6 passed=6 failed=0 …` |
| `npm run test:replay` | fast | 3 s | 3 seeds × 2 game weeks of scripted commands on the real Sim: mid-run snapshot/restore, journal-only replay, save envelope round trip, undo, a bot run across a weekly upgrade (ordinary seed 0xA1A1), puzzle scenario | `SUMMARY test:replay seeds=3 ticks=8640 passed=20 failed=0 …` |
| `npm run test:planes` | fast | 4 s | Plane types, reserves, exact-km range rejections, assign/release (D-24) | `… cases=8 passed=8 failed=0` |
| `npm run test:schedule` | fast | 3 s | Dwell, back-and-forth legs, capacity, passenger balance, 7-day replay | `… cases=7 passed=7 failed=0` |
| `npm run test:route-tool` | fast | 1 s | Airport snapping, multi-stop Add/ExtendRoute, range guards, handles, undo | `… passed=17 failed=0` |
| `npm run test:interp` | fast | 1 s | Great-circle geometry, route-boundary interpolation, 40 routes / 100 instanced planes, no per-frame rebuild | `… passed=17 failed=0` |
| `npm run test:render-layers` | fast | 1 s | Headless (no WebGL): route preview range split on the committed arc, deferred airport ring/curfew rebuild and `clear()`, pooled plane tracks; [task-34] camera insets measured from HUD/menu boxes (pass → top, tag rail → right, dock → bottom), disc clear of the panels, menu horizon/disc framing, WCAG contrast helpers, menu demo network, plane shadows off at night | `… passed=33 failed=0` |
| `npm run test:daynight` | fast | 1 s | Local time, demand curve, weekly curfew, snapshot, sun interpolation (D-27) | `… passed=N failed=0` |
| `npm run test:upgrades` | fast | <1 s | Seeded weekly offers, upgrade effects, congestion tie-breaks (D-28) | `… cases=5 passed=5 failed=0` |
| `npm run test:slots` | fast | 1 s | Departure slots (D-41, task 32): limit 1/h never lets two aircraft leave one city in the same game hour, first-ready-first-out queue, real Sim hold/cause/event/snapshot/replay, "+2 slots" airport pick raises hourly throughput, "slot-wait" game-over cause | `SUMMARY test:slots seed=0xA1A1 passed=5 failed=0` |
| `npm run test:flap` | fast | <1 s | Split-flap segmentation, Polish diacritics, truncation, 60–90 ms cascade | `… passed=15 failed=0` |
| `npm run test:causes` | fast | 1 s | Hub-ledger cause ranking, missing evidence, world identity, local records | `… scenarios=3 passed=6 failed=0` |
| `npm run test:saves` | fast | <1 s | Save/load hash, v0 migration, corrupt JSON, IndexedDB, native dual slot, background pause (D-29) | `… passed=11 failed=0` |
| `npm run test:audio-sched` | fast | <1 s | 125 ms lookahead, stable order, voice cap at 4×, immediate mute, pitch (D-30) | `… tests=8 passed=8 failed=0` |
| `npm run test:cvd` | fast | <1 s | Machado 2009 protan/deutan/tritan, 6 destination colours, min ΔE76 ≥ 15, CSS token parity (D-08) | `… comparisons=45 passed=1 failed=0` |
| `npm run test:contrast` | fast | <1 s | WCAG contrast ≥ 4.5:1 for declared text/background pairs | `… pairs=16 threshold=4.5 passed=1 failed=0` |
| `npm run test:puzzles` | fast | 1 s | 15 JSON puzzles: validation, zero-action loss, reference wins ≥ 15 %, replay, undo/reset | `… levels=15 cases=N passed=N failed=0` |
| `npm run test:daily-mode` | fast | <1 s | Daily mode: Warsaw midnight/DST, offline attempts, best scores, streaks, emoji-free ticket | `… passed=12 failed=0` |
| `npm run test:balance:fixture` | fast | <1 s | Bot policy on 50 seeded stand-in sessions — **not production balance** | `SUMMARY test:balance … mode=fixture seeds=50 … passed=1 failed=0` |
| `npm run test:week-source` | fast | <1 s | The 3-day week (D-40) has one source, `SIM_DAYS_PER_WEEK` in `src/sim/params.ts`: every week constant equals it by import, no literal week length elsewhere in `src/`/`scripts/`, curfew from day 10, calendar/day bar | `SUMMARY test:week-source … days=3 … passed=6 failed=0` |
| `npm run test:gating` | fast | 1 s | Free entitlements, no-op ads, disabled content gate, no monetization SDKs (D-16) | `… passed=8 failed=0` |
| `npm run test:android-config` | fast | <1 s | SDK-free Android manifest, foldable, edge-to-edge, signing checks (D-35) | `… checks=14 passed=14 failed=0` |
| `npm run test:ios-config` | fast | <1 s | iOS orientations, permissions, bundle ID, CocoaPods, audio session, safe-area tokens, PNG sizes (D-36) | `… checks=N passed=1 failed=0` |
| `npm run test:store-shots` | fast | ~3 s | PL/EN store copy limits, D-18 titles, no competitor names; [task-36] the 30 committed PNGs: size, not blank/white, manifest without dev text, glyphs only D-08, contact sheet | `… listings=2 fields=12 scenes=5 devices=3 shots=30 passed=1 failed=0` |
| `npm run test:site` | fast | <1 s | Landing page: local links, preview alt texts, PL/EN parity, privacy page, no trackers | `… assertions=N passed=N failed=0` |
| `npm run test:arch` | fast (last) | 1 s | TS-AST guard: `src/sim` imports only pure modules; no DOM, Capacitor, three, wall clock, `Math.random` or transcendentals (D-13) | `… files=N passed=1 failed=0` |
| `npm run test:fast` | — | 30 s | All rows marked “fast”, in order | `SUMMARY test:fast … steps=36 passed=36 failed=0` |
| `npm run build` | ci | 10 s | `prebuild` (`build:distances`, `build:land`), `tsc --noEmit`, `vite build` | exit 0; `dist/` |
| `npm run test:hud-targets` | ci | 40 s | Playwright HUD: 6 controls ≥ 48 dp, safe-area clearance, no overlap/overflow, rotation, drag-to-route; 4 PNGs in `docs/shots/13/`. [task-35] Weekly upgrade board PL/EN × 4 sizes (+ "+2 slots" variant): labels ≥ 48 dp inside the viewport, no overlap or clipped text, model window size, 3 rendered models, stamp only on the hub label, sim numbers, tap → ChooseUpgrade, hub-pick mode, no-hub state; 16 PNGs in `docs/shots/35/` | `… passed=N failed=0 shots=20` |
| `npm run test:e2e:tutorial` | ci | 35 s | Onboarding: six training actions, replay/skip/persistence; 10 PNGs in `docs/shots/23/` | `… passed=N failed=0 screenshots=10` |
| `npm run test:e2e:smoke` | ci | 15–40 s | Real gameplay journey, 9 dependent steps (menu → seeded start → route drag → aircraft drag → week → upgrade → save/continue hash → overload → menu). Each step prints PASS/FAIL/SKIP; failure screenshot in `.e2e/` | `SUMMARY test:e2e:smoke … mode=game steps=9 passed=9 failed=0 skipped=0` |
| `npm run ui:matrix` | ci | 30–90 s | Real menu/game/upgrade/gameover × PL/EN × 412×915, 915×412, 673×841, 904×1000 → `docs/shots/matrix/`; runs on the ordinary seed 0xA1A1; autoplay reaches the week-1 board on it (task 31) | `… weekSeed=41377 mode=game captured=32 expected=32 failed=0` |
| `npm run test:e2e:fixture` | — | 6 s | Harness self-test against `e2e/fixtures/airway.html` (smoke + matrix); output to ignored `docs/shots/matrix-fixture/`. Does **not** test the game | `… mode=fixture … failed=0` (both) |
| `npm run test:balance` | fast | ~4 s | Real engine: the same 50 seeded bot games as `balance:report`, deterministic replay, 0 invalid commands, 8–15 min median, ≥ 60 % reach the 1st weekly upgrade and ≥ 30 % the 2nd (task 31), hub-overflow warning | `SUMMARY test:balance … mode=game seeds=50 median_min=12.92 upgrade1=0.86 upgrade2=0.44 passed=1 failed=0` |
| `npm run perf:scene` / `test:perf-scene` | ci | 2.5 min | SwiftShader scene: 40 cities, 100 planes, 40 routes, 120 wall s at 4×; JSON in `.perf/scene.json` (D-33) | `SUMMARY perf:scene … frames=N samples=N failed=0` |
| `npm run shots` | ci | 1–2 min | All app/dev-page screenshots (see below) | `SUMMARY shots … expected=N captured=N failed=0` |
| `npm run shots:site` | ci | 6 s | `build:site`, then landing page at 412×915 / 915×412 → `docs/shots/29/` | `SUMMARY shots:site … captured=2 failed=0` |
| `npm run store:shots` | ci | ~4 min | 5 autoplayed scenes × PL/EN × phone/foldable/tablet → `docs/store/shots/{pl,en}/` + `manifest.json` + `docs/store/contact-sheet.png`; every PNG checked, published only when all 30 pass | `… expected=30 captured=30 checked=30 passed=1 failed=0` |
| `npm run test:ci` | — | 6–8 min | `test:fast`, `build` and every “ci” row | `SUMMARY test:ci … failed=0` |
| `npm run build:distances` | — | 1 s | Regenerate `src/data/generated/distances.ts` (`--check` compares) | `SUMMARY distances … pairs=13530 passed=1 failed=0` |
| `npm run build:land` | — | <1 s | Regenerate `public/data/land-50m.json` (D-21) | `SUMMARY build-land … failed=0` |
| `npm run build:site` | — | <1 s | Copy the framework-free landing page into ignored `site/dist/` | `SUMMARY build:site … files=6 assetFolders=2 failed=0` |
| `npm run balance:report` | — | 5–15 min | Real engine: 50 seeded sessions → `docs/balance/game-50.csv` | `SUMMARY balance:report … mode=game seeds=50 … failed=0` |
| `npm run balance:fixture` | — | 1 s | Stand-in: 50 synthetic runs → `docs/balance/fixture-50.csv` | `… mode=fixture seeds=50 … failed=0` |
| `npm run audio:demo` | — | 1 s | Render a WAV demo of the hub audio scheduler (listening check, no assertion) | WAV path |
| `npm run mockups` / `shots:mockups` | — | 30 s | Stage-0 reference mockups (HTML/SVG → `mockups/*/png/`) | exit 0 |
| `npm run android` / `android:assets` / `android:release` / `android:aab` | — | minutes | Android debug/release builds; needs `ANDROID_HOME` (docs/ANDROID.md) | APK/AAB path |

## Screenshots (`npm run shots`)

`scripts/shots.mjs` is the single screenshot pipeline for the app and dev pages. Targets (`npm run shots -- --list`):

| Target | URL | Output | Ready when |
| --- | --- | --- | --- |
| `game` | `/` | `docs/shots/01/game-{p,l}.png` | `#app canvas` |
| `globe` | `/dev/globe.html?quality=medium` | `docs/shots/03/game-{p,l}.png` | `window.__globeReady`; also asserts ≤ 60 draw calls, ≥ 1000 triangles |
| `airports`, `airports-zoom` | `/?dev=airports&zoom=1` / `2.5` | `docs/shots/06/airports-{p,l}-{1x,2_5x}.png` | `.airport-bubble` |
| `menu` | `/` (PL) | `docs/shots/14/menu-{p,l}.png` | `.airway-board .airway-flight` + 1.1 s flap settle |
| `gameover` | `/?preview=gameover` | `docs/shots/15/game-{p,l}.png` | `[data-gameover-state="open"]` |
| `puzzles` | `/` → click `[data-mode="puzzles"]` | `docs/shots/17/board-{p,l}.png` | `.puzzle-departures .puzzle-flap` |
| `npm run shots:world` | Full world-renderer lab (`dev/world.html?frozen&clean`: globe, airports, hub rings, curfew, routes, planes, preview, overlay) in 412×915 and 915×412 into `docs/shots/render/`; compare with `mockups/diorama/png/game-p.png` | `SUMMARY shots:world seed=0xA1A1 captured=2 failed=0` |

Options: target names to filter (`npm run shots -- menu globe`), `--fold` (adds 673×841 and 904×1000),
`--lang=pl|en`, `--dpr=1..3`. Default is 412×915 and 915×412 at DPR 1. Each capture fails independently; the summary
lists every failed target/size. Add a view by appending one entry to `TARGETS`. Screenshot PNGs are committed only after
someone has looked at every image (Diorama checklist in `docs/styles/diorama.md`). Folder layout: `docs/shots/README.md`.

## E2E contract

`test:e2e:smoke` and `ui:matrix` drive the real Vite game through the DEV-only `window.aw` handle
(`src/game/devHandle.ts`) and stable `data-testid`s; the contract is in [`e2e/README.md`](../e2e/README.md). They need
`src/main.ts` to call `installDevHandle()` in DEV and the composition root to `registerDevGameAdapter()` with the real
game. `store:shots` additionally needs the DEV-only `?storeShot=<scene>` fixture (`docs/store/README.md`); a scene that
is not actually reached (e.g. the run jams before the weekly board) never sets `data-store-shot-ready`.

Reaching the week-1 board: `window.aw.autoplay(untilWeek)` lets the task-22 bot (`src/game/dev/bot-policy.ts` +
`src/game/dev/autoplay.ts`, shared with `test:balance`) keep playing the visible run through real Commands until the
board for `untilWeek` opens, and returns `state()`. It is DEV-only (dynamic import behind `import.meta.env.DEV`, absent
from `dist/`). Since task 31 (3-day week, D-40) the bot reaches the week-1 board from a clean start on 86 % of the 50
balance seeds, including the ordinary test seed 0xA1A1, so the smoke, `ui:matrix` and the store `upgrade` scene all use
0xA1A1. If a balance change moves this, fix the balance rather than picking a lucky seed or adding shortcuts.
`npm run shots:34` (task 34) captures the real game, seed 0xA1A1, PL: `docs/shots/34/{menu,day,dusk,night}-{p,l}.png`
and measures night readability in the browser (each gameplay layer rendered with/without itself, median WCAG
contrast; luggage tags against the globe under them); every value must be ≥ 4.5:1
(`CONTRAST …` lines, then `SUMMARY shots:34 seed=0xA1A1 captured=8 expected=8 failed=0`).
`node scripts/shots-31.mjs` captures the task-31 evidence (`docs/shots/31/`: week-1 board and the day bar at day 2/3).
`node scripts/shots-32.mjs` captures the task-32 evidence (`docs/shots/32/`: first held departure with the one-time slot strip, week-1 board with the "+2 slots" label and its stamp, airport-pick sign), PL/EN × 412×915 / 915×412; `SUMMARY shots:32 seed=0xA1A1 captured=12 expected=12 failed=0`.

`npm run shots:38` (task 38) captures the departure-slot tag on the real game, seed 0xA1A1, PL/EN × 412×915 / 915×412 × day/night: `docs/shots/38/{day,night}-{pl,en}-{p,l}.png`. Each page jumps the clock to the wanted sun angle (shots-34 formula), draws a route and drags three more turboprops onto it with real gestures, so the slot gate holds aircraft. It checks the localised `SLOT h:mm` text, no overlap with passenger tags, no passenger glyph inside, the paper body's WCAG contrast against the globe ≥ 4.5:1 (`__awWorld.nightContrast('.airport-slot')`; ink stub reported only) and, on day portrait, that the tag disappears after release. A page that sees no hold (wall-clock frames can split the aircraft over two minutes) is retried once. Ends with `SUMMARY shots:38 seed=0xA1A1 captured=8 expected=8 failed=0`.

## Boundary regression

To verify the architecture guard itself, temporarily add `import { Scene } from 'three';` to
`src/sim/__arch-negative.ts`, run `npm run test:arch`, confirm a nonzero exit with a `forbidden dependency` line,
**delete the file** and rerun clean. Never commit the negative-control file.

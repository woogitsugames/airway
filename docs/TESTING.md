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

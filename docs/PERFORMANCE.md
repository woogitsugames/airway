# Airway performance contract (task 21)

Status: **provisional infrastructure**, 2026-11-02. On the branch baseline, only task
01 was merged; task 03 (globe), task 06 (airports/overlay), task 10 (routes/planes),
and task 11 (day/night) had not been integrated. **No production-scene performance
measurement is possible on this base.** The fixture below exercises GPU/DOM mechanics
but does **not** measure gameplay, demand simulation, real terrain, or production UI.

## Budgets (device acceptance targets, not laboratory findings)

| Device class | Interactive frame target (p95) | Idle rendering | Foreground/background |
| --- | --- | --- | --- |
| Mid-range Android | <= 16.7 ms (60 FPS) | 30 FPS cap | Pause rendering when hidden |
| Low-end Android | <= 33 ms (30 FPS) | 30 FPS cap | Pause rendering when hidden |
| iOS / foldable | Measure against the device refresh rate | 30 FPS cap | Pause rendering when hidden |

Use **CPU frame time + GPU frame time**, not only `renderer.render()` submission
time, for device acceptance. Measure main-thread long tasks and missed vsync,
GPU raster time/overdraw, sustained frame rate and thermal throttling. The
16.7/33 ms figures are **targets**, not observed results.

Provisional *mid-range* per-frame breakdown: simulation <= 2 ms,
input/HUD/DOM <= 2 ms, render-side animation and draw submission <= 4 ms,
GPU <= 6 ms, scheduling/GC headroom >= 2.7 ms. Measure and rebalance this
allocation after tasks 06/10/11 are merged. Limit DPR to 2; shadows off in
low/medium and on in high only, with a 1024 shadow map. Prefer instancing,
pooled DOM and shared materials. Do not rebuild route geometry each frame.

## Shared quality API

`src/render/quality.ts` is the only quality system; `createWorldRenderer` resolves one
profile and hands it to every layer:

- `chooseQualityPreset(pref, hints)`: auto-detect from hardware concurrency and reported
  device memory; missing hints default to medium. Persisting a manual choice belongs to
  the settings screen, which passes it to `world.setQuality(pref)`.
- `resolveQualityProfile()`: preset (drives terrain subdivision and tree/rock/cloud/light
  counts in `globe/`), capped DPR (1 / 1.5 / 2), antialias, shadows (high only, 2048 map),
  overlay allowance.
- `applyQualityProfile(renderer, profile)`: the single place that sets DPR, shadow map,
  colour space and tone mapping. Antialiasing is fixed at context creation.
- `AdaptiveFrameScheduler`: 30 rendered frames/sec at rest; each display RAF
  during pointer/keyboard interaction and for 350 ms after input. Cancels RAF
  on `document.hidden`, resumes with no background time accumulation, and
  disposes all listeners. It controls *rendering*, not the authoritative
  simulation clock (task 16 owns simulation lifecycle).

## Reproducible SwiftShader run (production world renderer)

Prerequisites: Node >= 22, `npm ci`, environment-provided Playwright package
and Chromium. Set `CHROMIUM_PATH` if Playwright does not manage the browser.

```sh
npm run perf:scene
# Short smoke run (not a comparable benchmark):
npm run perf:scene -- --duration-ms 5000 --preset low
# Landscape / manually selected quality:
npm run perf:scene -- --viewport 915x412 --preset medium
```

Default test: `createWorldRenderer` with the real terrain, airports (8 hubs with
capacity rings, 2 curfews), route tubes, instanced planes, day/night and a scripted
(non-simulated) plane schedule on a fixed lattice: **40 cities, 40 routes, 100
planes, 120 seconds wall clock at 4x animation speed**, medium preset,
412x915 viewport, DPR 1, Chromium forced to ANGLE SwiftShader. The first
half is idle (30 FPS scheduling), the second half sustained interactive
rendering (every display RAF). Meshes/materials/geometry and the 40 DOM
overlay tags are allocated once; aircraft transforms reuse an `Object3D`
and `Vector3` instances, with a preallocated `Float32Array` history.
During the active half the camera orbits slowly and the 40 DOM tags are re-projected
every frame with `world.project()` (DOM writes only when a pixel position changes).
The menu no longer owns a WebGL context (it draws over the shared world canvas, `src/game/world.ts`), and
`src/main.ts` skips the game on the perf page, so the fixture measures a single context. The integration
results below (2026-11-02) were recorded while the old menu globe still opened a second context.

The output is `.perf/scene.json` (or `--output <path>`), including
CPU render-submit mean/p95/max, frame-interval mean/p95, sample-time draw
calls and triangles from `renderer.info`, Chrome DevTools Protocol
`JSHeapUsedSize`, renderer geometry/texture count, overlay DOM element
count, and phase FPS. The command always prints one `SUMMARY perf:scene
seed=0xA1A1 ... failed=N` line; errors give nonzero exit status. Missing
CDP memory metrics are represented as `null`, not zero.

### Results

Integration run, 2026-11-02, `npm run perf:scene` (defaults: medium, 412x915, DPR 1, 120 s),
ANGLE SwiftShader (Vulkan/Subzero), production world renderer:

| Measurement | SwiftShader (world renderer) | Physical device |
| --- | --- | --- |
| CPU render submit mean / p95 | 2.14 ms / 2.90 ms | Not measured |
| Draw calls / triangles (max) | 33 / 228 837 | Not measured |
| JS heap start / end / max | 6.5 MB / 7.1 MB / 11.0 MB (no growth trend) | Not measured |
| Overlay DOM elements | 40 (stable) | Not measured |
| Delivered FPS idle / active | 2.7 / 2.3 (software rasteriser; at the time also hosted the old menu's second WebGL context) | Not measured |

**SwiftShader figures are orientation-only**; they must never be compared
directly against mobile GPU acceptance targets. A working script, by itself,
does not establish that the performance budget is met.

## Globe detail budget (task 33, D-44)

Terrain triangles come from `buildTerrainArrays()` (`npm run test:land` prints them); frame
triangles and draw calls from `renderer.info` in `dev/world.html?frozen&clean` at 2.5x
(`npm run shots -- globe-<preset>-2_5x`, 412x915, no shadow pass except `high`). Build times are
Node 22 on the CI container (desktop-class CPU; expect roughly 3-4x on a mid-range phone). All
numbers measured 2026-11-02.

| Preset | Terrain triangles before → after (budget) | Trees / rocks / clouds before → after | Frame triangles before → after | Draw calls | Terrain build before → after |
| --- | --- | --- | --- | --- | --- |
| low | 8 283 → 34 904 (≤ 45 000) | 450 / 48 / 28 → 3 500 / 260 / 30 | 35 707 → 86 414 | 34 → 36 | 161 → ~160 ms |
| medium | 67 781 → 200 066 (≤ 210 000) | 2 200 / 160 / 58 → 11 000 / 700 / 60 | 119 317 → 314 398 | 34 → 36 | 494 → ~450-570 ms |
| high | 133 662 → 279 154 (≤ 300 000) | 5 100 / 300 / 95 → 18 000 / 1 200 / 90 | 222 278 → 436 042 | 34 → 36 | 485 → ~650-900 ms |

The two extra draw calls are the second tree shape (broadleaf crowns) and the instanced
cloud-shadow blobs. Mesh quality, also printed by `test:land` (before = `dev` mesh measured
with the same metrics): open (cracked) edges 13 225 → 0 on medium; coast teeth (land facets
with two sea neighbours) 6.8% → 2.3%; Sahara neighbour luminance step p99 0.365 → 0.029.
The land raster decode is ~60 → ~110-150 ms (adds the signed-distance field).

`perf:scene` (medium, 412x915, DPR 1, 120 s, SwiftShader), two runs each:

| Run | CPU submit mean / p95 | Median / 95%-trimmed mean of 1 s samples | Frames rendered | Triangles (max) | Draw calls |
| --- | --- | --- | --- | --- | --- |
| before #1 / #2 | 1.42 / 2.40 ms, 1.41 / 2.20 ms | 0.80 / 0.87 ms, 0.90 / 0.96 ms | 535, 526 | 228 837 | 33 |
| after #1 / #2 | 1.94 / 2.30 ms, 1.81 / 2.90 ms | 0.90 / 1.07 ms, 0.90 / 0.97 ms | 255, 255 | 423 918 | 35 |

Reading: p95 and the per-sample median/trimmed mean move by ≤ ~10%, inside run-to-run noise.
The summary *mean* rises ~30% because the one-off geometry upload spike on the first frame
(~90-120 ms, both before and after) is averaged over half as many frames: SwiftShader rasterises
~1.85x the triangles in software, so it delivers half the frames. That frame-rate drop is a
software-GPU effect and says nothing about a mobile GPU; it must be re-measured on the
hardware checklist below (the frame-triangle count is the number to watch on low-end Mali).

## Globe LOD, battery saver and adaptive quality (night N4, D-73)

**Terrain chunks.** `src/render/globe/lod.ts` cuts every terrain level into 184 chunks (15° latitude
bands, each split into sectors of ~15° of arc) stored in one vertex buffer in sector-major order.
Per rendered frame (only when the camera moved) each chunk is tested against a conservative horizon
(lowest terrain radius 0.995 as the occluder, the chunk's highest vertex as the target) and the view
frustum; consecutive visible chunks merge into one draw run from a pool of meshes sharing the buffer.
`test:quality` proves no visible vertex is ever culled and that runs stay ≤ 16.

**Terrain levels.** `medium` and `high` also build the next coarser mesh (`low`, `medium`) as a far
level; `low` keeps a single level so low-end CPUs pay no extra build. The far level is drawn while
its finest facet is under 4.5 device px on screen and the near (preset) mesh above 5.5 px
(hysteresis). On a 412 dp phone at DPR 1.5 the medium preset draws the far mesh at zoom 1 (menu,
zoomed-out globe) and the preset mesh from about zoom 1.7 (the game opens at zoom 2). Build time
grows by the far level: medium +~160 ms, high +~500 ms on the CI container (×3–4 on a phone).

**Battery saver** (`saver` in settings, PL "Oszczędna"): low terrain, DPR 1, no
antialiasing on a fresh context, shadows off, 60 % of trees/rocks/city lights, and `render()` draws at
most 30 frames per second (60 Hz → every second display frame, 120 Hz → every fourth; skipped
frames carry their dt to the camera).

**Adaptive quality** (`auto` only; off under `navigator.webdriver` so harnesses keep their preset):
`AdaptiveQualityMonitor` takes the interval between rendered frames in windows of 60; three windows
in a row with a median above 41.7 ms (under 24 fps) take one step: DPR → 1, then decorations → 60 %,
then terrain one preset lower (rebuild). A step is followed by one window of cooldown; it never
steps back up within a session. `world.stats().adaptations` lists the steps taken.
[night-07b] The steps are remembered between sessions (D-74, `src/game/adaptiveMemory.ts`, key
`airway.adaptiveQuality`, ignored after 30 days or when not a prefix of the device's ladder) and applied before the
first frame; an explicit graphics choice forgets them.

### Budgets (per frame, 412×915 portrait)

| Preset | Terrain triangles drawn, zoom 1 / 2 / 3.3 (budget) | Draw calls (budget) | Frame cap |
| --- | --- | --- | --- |
| saver / low | 26 k / 20 k / 11 k (≤ 35 k) | ≤ 50 | 30 / display |
| medium | 26 k / 125 k / 71 k (≤ 160 k) | ≤ 50 | display |
| high | 157 k / 125 k / 71 k (≤ 200 k; the high mesh only from ~zoom 4) | ≤ 50 | display |

### Measured 2026-11-03 (dev/world.html `?frozen&clean`, DPR 1.5 where the preset allows)

| Preset, zoom | Frame triangles before → after | Draw calls before → after |
| --- | --- | --- |
| low z1 / z2 / z3.3 | 86 254 → 77 619 / 71 222 / 62 353 | 36 → 43 / 47 / 43 |
| medium z1 / z2 / z3.3 | 313 502 → 140 441 / 239 462 / 185 312 | 36 → 43 / 47 / 43 |
| high z1 / z2 / z3.3 | 453 404 → 332 853 / 300 620 / 246 470 | 36 → 44 / 47 / 43 |

The remaining non-terrain triangles are mostly decorations (medium: trees 75 k, rocks 14 k) plus
routes and planes; trees are instanced and not chunked (a split would cost ~20 draw calls).

`perf:scene` (SwiftShader, 412×915, DPR 1; medium 120 s, low/saver 60 s; one run each):

| Run | CPU submit mean / p95 | Frames rendered | Idle / active FPS | Triangles (max) | Draw calls (max) |
| --- | --- | --- | --- | --- | --- |
| medium before | 2.36 / 2.10 ms | 307 | 2.75 / 2.38 | 423 022 | 35 |
| medium after | 1.35 / 1.60 ms | 384 | 3.44 / 2.98 | 250 217 | 43 |
| low before | 1.19 / 1.40 ms | 523 | 9.53 / 7.96 | 195 774 | 35 |
| low after | 1.07 / 1.40 ms | 605 | 10.43 / 9.74 | 187 395 | 42 |
| saver after | 0.63 / 1.20 ms | 1 012 | 14.12 / 19.33 | 175 666 | 43 |

Reading: on medium the triangle peak drops 41 % and SwiftShader renders 25 % more frames. In the
perf fixture most remaining triangles belong to its 100 planes and 40 route tubes (low terrain is
only ~26 k of the 187 k); those layers are the next candidates. SwiftShader numbers remain
orientation only; the hardware checklist below still decides.

## M1 — richer world (regional airports, landmarks, plane bank; D-53)

Airports are now one shared instanced kit (12 meshes: pad, block, gable, hip, dome, tiered, pyramid, tower, palm,
snow, lattice, arch) instead of 5 city + 7 hub part meshes; a piece with no instances issues no draw call. Plane
bank adds a few vector operations per plane per frame (no allocation) and the livery adds ~70 triangles per aircraft.

`perf:scene` (defaults: medium, 412x915, DPR 1, 120 s, SwiftShader), 2026-11-03, this container (4 cores,
load average ~11-13 from parallel agents, hence ~130 frames instead of ~530). Six runs each, interleaved
before/after (`dev` e057556 in a second worktree vs this branch), medians:

| Metric (median of 6) | before (`dev`) | after (M1) | change |
| --- | --- | --- | --- |
| CPU render submit mean | 7.31 ms | 7.75 ms | +6% |
| CPU render submit p95 | 14.0 ms | 11.35 ms | −19% |
| Mean without the one-off first-frame upload spike | 4.64 ms | 5.24 ms | +13% |
| 95%-trimmed mean of 1 s samples | 1.58 ms | 1.55 ms | −2% |
| Median of 1 s samples (0.1 ms resolution) | 1.02 ms | 1.15 ms | +0.13 ms |
| Frames rendered | 136 | 131.5 | −3% |
| Draw calls (max) | 35 | 32 | −3 |
| Triangles (max) | 423 022 | 433 450 | +2.5% |

Raw runs — before: mean 7.61/6.82/7.02/8.47/5.97/8.09, p95 13.3/4.6/14.2/49.9/13.8/20.8; after: mean
7.83/8.79/7.58/7.34/7.67/8.25, p95 12.2/10.5/12.8/6.5/22.0/7.2 ms. Run-to-run spread on this loaded machine
(before: mean 5.97–8.47 ms) is larger than every difference above; the headline mean/p95 stay inside the 10%
budget. Caveat: the fixture uses ids `C0…C39` (no dataset city), so it exercises regional roofs, palms and snow
through the lon/lat fallback but **no landmarks**; a landmark is 1–10 instances on the shared meshes plus at most two
extra draw calls (lattice, arch) for the whole world. Close-up evidence: `npm run shots:m1` (`docs/shots/m1/`).

## Allocation validation and hardware test checklist

1. Run `perf:scene` and save JSON; check stable DOM node count (=40),
   stable geometry/texture counts, and heap behavior (warm-up vs sustained
   load). JS heap samples do not prove zero allocations.
2. Record a Chrome DevTools **Performance > Memory > Allocation sampling**
   trace after warm-up. Inspect per-frame application call stacks for
   `Vector3`, arrays, geometry, route rebuilding and DOM node creation.
   Disable profiling overhead for frame timing measurements. Internal
   Three.js/WebGL allocations are outside the fixture's no-allocation claim.
3. On a real low-end Android GPU (especially Mali), mid-range Android,
   and iPhone, collect 2-minute portrait and landscape frame traces at
   4x, both idle and active; repeat sustained runs at 10 and 20 minutes
   for temperature, battery draw and dropped frames. Use Android GPU
   Inspector / Perfetto, Chrome remote debugging, and Safari Instruments.
4. Test 412x915, 915x412, 673x841 and 904x1000 plus hardware DPR 1/1.5/2.
   Measure overlays during real camera rotation and zoom, airport overload,
   route creation and hub transfer spikes; verify visibility pause/resume,
   return from app background and memory after scene disposal.
5. Once integration is available, benchmark **production** 40/100/40 state
   (real routes, passengers, day/night and DOM overlay), repeat before/after
   each optimization, and fail acceptance when the physical-device p95
   budget is exceeded.

### Known limitations

- Current benchmark is deliberately **synthetic**: no simulation ticks,
  hub pathfinding, production globe textures, real camera gestures or
  animated projection of all overlays. The speed parameter accelerates
  *visual aircraft progress*, not authoritative game time.
- The synthetic sample measures CPU time around `renderer.render()`, not
  GPU completion. FPS and long tasks must be corroborated with tracing.
- Low-memory detection uses best-effort browser hints; especially on iOS,
  memory may be unavailable. Provide a manual quality setting in the
  future settings UI; this task exports the preference API but does not
  introduce UI outside its ownership.
- Playwright and Chromium are supplied by the runner, not installed as
  production dependencies. An unavailable browser/network is a test
  failure to report, never a simulated successful measurement.

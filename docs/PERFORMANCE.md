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
Note: the page also mounts the menu (`src/main.ts`), whose `src/ui/menu/demo-globe.ts`
still creates a second WebGL context; numbers include that until the menu uses the world.

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
| Delivered FPS idle / active | 2.7 / 2.3 (software rasteriser; also hosts the menu's second WebGL context) | Not measured |

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

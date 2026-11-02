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

| Measurement | SwiftShader synthetic fixture | Integrated game | Physical device |
| --- | --- | --- | --- |
| CPU render frame p95 | **NOT RUN in this environment** | Not available (06/10/11 absent) | Not measured |
| Draw calls / triangles | **NOT RUN in this environment** | Not available | Not measured |
| JS heap / overlay elements | **NOT RUN in this environment** | Not available | Not measured |
| FPS / frame pacing | **NOT RUN in this environment** | Not available | Not measured |

**SwiftShader figures are orientation-only**; they must never be compared
directly against mobile GPU acceptance targets. A working script, by itself,
does not establish that the performance budget is met.

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

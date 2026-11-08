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
  device memory; missing hints default to medium. [N12m, D-116] Before that rule, the unmasked WebGL
  renderer string (`DeviceHints.gpu`, one throwaway context read by `readGpuRenderer`, cached, released at
  once) is matched against `LOW_GPU_FAMILIES`: Mali-G52, Mali-G57/G68 MC1–MC2, Mali-T8xx, PowerVR GE83xx,
  Adreno 5xx and 610/613 start on `low` (8 cores and 4 GB would give them `medium`). An unknown or capable
  string (SwiftShader, Apple GPU, Adreno 618+, Mali-G6xx/G7xx, MC3+) keeps the core/memory rule; an explicit
  choice wins, and remembered adaptation (D-74) is re-applied only when it is a prefix of the new ladder.
  Not measured on the listed phones here: the table rests on RESEARCH R3 and is checked by `test:quality`
  only; SwiftShader runs (`perf:scene` passes `--preset`) are unaffected. Persisting a manual choice belongs to
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
routes and planes.

[night-07f] **Decoration culling (D-75, `src/render/globe/decor-cull.ts`).** Trees and rocks are sorted into the
terrain chunks; the visible chunks are packed to the front of each instance buffer when the visible set or the
density changes (one draw call per mesh as before; `world.stats().decorDrawn / decorTotal`). Headless, over 16 random
cameras, 25 % of the 11 700 medium trees/rocks are drawn on average. `dev/world.html?frozen&clean`, DPR 1, 412×915
(portrait) / 915×412, same run before → after, images pixel-identical:

| Preset, zoom | Frame triangles before → after (portrait / landscape) | Draw calls |
| --- | --- | --- |
| low 1x / 2.5x | 77 619 → 75 572 / 76 170 → 73 892; 67 393 → 52 244 / 67 901 → 58 209 | unchanged (43–50) |
| medium 1x / 2.5x | 140 441 → 134 216 / 138 992 → 132 160; 216 081 → 173 035 / 216 188 → 186 569 | unchanged |
| high 1x / 2.5x | 332 853 → 322 550 / 328 819 → 317 182; 277 239 → 206 728 / 277 346 → 228 229 | unchanged |

At 1x most of the globe faces the camera, so the gain is small; zoomed in (the game opens at 2x) it is 14–25 %.

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

## N10u — airport tag overlay with 40 airports (2026-11-03)

Real game, 1280×800, bot to week 4 (17 airports, 6 routes), 4×, CDP sampling profile over 8 s: the page's
main-thread JavaScript was busy ~1.6 % of the time; `overlay.ts` + `overlay-layout.ts` together < 1 ms per
second, `session.ts`/`run.ts` (per-frame `syncWorld`) ~1–2 ms per second. Rendering, not the HTML overlay, sets the
frame rate. With 40 airports (`npm run perf:overlay`, synthetic tags on the real module) the cost is the tag
rebuild after a passenger change: every rebuild threw away and re-created all glyph SVG nodes. Tags now reuse
their glyph nodes per kind and only insert/remove the children that differ, and skip unchanged aria labels.

| ms per frame (update + style/layout), two runs each | idle | 5 tag changes | 40 tag changes |
|---|---|---|---|
| before | 0.24–0.25 | 0.96–1.03 | 3.81–3.84 |
| after | 0.16–0.19 | 0.76–0.81 | 2.58–2.88 |

## N11a — no globe frames behind opaque pages (2026-11-03)

Settings, licences, logbook, the puzzle board/levels and the tutorial replay cover the whole canvas with an opaque
paper or sky page, but `src/game/world.ts` kept drawing the menu globe (spin, demo planes, terrain) under them: on
SwiftShader 36 frames in 1.2 s behind settings, on a phone the full 60–120 Hz for as long as a puzzle takes. The
screen router now calls `world.setCovered(name !== 'menu' && name !== 'game')`; while covered and no run is attached,
the rAF loop returns before any camera, demo or render work (the loop itself stays, so the first frame after Back is
drawn on the next vsync). `test:e2e:covered-pages` reads the DEV probe `__awWorld.frames()`: 0 frames behind every
page, ≥ 3 per 1.2 s on the menu and in a game.

## Bundle budget (N12q, R5k, D-143)

`npm run test:bundle` (in `test:ci` right after `build`) measures the built `dist/` and fails above these budgets:

| Measure | Budget | Measured 2026-11-03 | Measured 2026-11-05 (D-252) | Measured 2026-11-05 (D-255) | Headroom |
| --- | --- | --- | --- | --- | --- |
| Main JS chunk (largest `dist/assets/*.js`), raw | 1,180 kB (D-252; 1,150 before) | 1,033.8 kB | 1,150.4 kB (1,181.6 before D-252) | 1,132.8 kB (1,157.5 on dev before) | +4.2 % |
| Main JS chunk, gzip (level 9) | 360 kB (D-252; 340 before) | 306.2 kB | 347.8 kB (353.1 before) | 338.9 kB (350.0 before) | +6.2 % |
| All CSS | 130 kB (D-305 after U6 = 127.4 kB + ~3 kB; 132 kB D-301 at the Linoryt flip = 129.0 kB + 3 kB, D-297; 109 kB D-258; 90 before) | 70.2 kB | 88.8 kB (105.0 before) | 89.5 kB (unchanged); 129.0 kB at U5 (105.3 before); 127.4 kB at U6 | +2.3 % |
| Everything under `dist/` (fonts, land mask, licences, globe textures) | 4,300 kB (D-171) | 3,597.7 kB with G1 globe textures (1,804.8 kB before) | 4,264.1 kB (4,311.5 before) | 4,272.3 kB (4,271.9 before) | +0.6 % |

[night-11ar] D-252: release CSS carries the UI skin values, not the tokens (`scripts/vite-skin-inline.mjs`; `npm run
dev` keeps the tokens, `AW_SKIN_INLINE=1` resolves them there too), and the distance table is packed (three base64url
digits per value). [night-11at] D-255: the privacy policy and terms bodies are a chunk of their own
(`dist/assets/legal-*.js`, 25.1 kB, loaded when a page opens, bundled with the app). Next levers: puzzle levels that
reference `cities.ts` (≤ ~12 kB, needs per-record overrides, D-255), WOFF2 fonts (`dist/` only).
Vite's chunk warning limit follows the raw budget (1,180 kB).
[night-11az] D-258: the Róża skin (D-257) is a structure over the component CSS, scoped to `<html data-skin="roza">`;
release CSS measured **107.2 kB** after the pruning of `scripts/vite-skin-prune.mjs` (declarations Róża overrides and
rules of elements it hides), so the CSS budget is 109 kB (the owner's ceiling, +1.7 % headroom). Folding `roza.css`
into the component CSS (and dropping the DEV `?skin=current` comparison) is the lever back towards 90 kB.
[night-36a] D-294: at 109.0 kB (no headroom) the three font-stack tokens became `var(--skin-face-*)` references in the
release (defined once on `:root` by the kept skin; `REFERENCED_TOKENS` in `scripts/vite-skin-inline.mjs`): release CSS
**105.3 kB** (−3.7 kB, +3.4 % headroom), pixel-identical by `skin:pixels` with `AW_SKIN_INLINE=1`. Per source:
`roza.css` 22.6 kB, `upgrade.css` 14.5, `gameover.css` 13.4, `menu.css` 10.7, `puzzles/board.css` 9.1, `tutorial.css`
8.3, `overlay.css` 6.1, `logbook.css` 5.4, `hud.css` 4.8, the rest 14.1. U5 (Linoryt default) projects ~135 kB with
today's `linoryt.css` (Q-91).
[night-46a] D-301 (PLAN-LINORYT.md step U5): Linoryt is the shipped skin; `roza.css` and the Diorama comparison are gone
and the pruner (`scripts/vite-skin-prune.mjs`) works against `linoryt.css`, whose scope is written `:root:root` and
whose inks (`--lin-*`, one plain `:root`) are constants written out inside the token values. Release CSS **129.0 kB**
(105.3 before; D-294 projected ~135); the CSS budget becomes 132 kB (measurement + 3 kB, owner D-297). Main JS
1,167.6 kB raw / 352.2 kB gzip (1,168.8 / 352.2 before: `roza.ts` left, the Linoryt helpers that were DEV-only arrived);
`dist/` 4,099.5 kB (4,009.0 before: + Besley 800/900 and Schibsted Grotesk WOFF2 with licences, − Alegreya). Next lever:
`linoryt.css` still names its inks as `var(--lin-*)` in its own rules (~3 kB of references; writing them out is U6).

The app is one chunk on purpose (three.js is about 494 kB of it; splitting puzzles, logbook, leaderboard and
tutorial would save < 40 kB, R5). Files come from disk in the Capacitor app, so size is not a download cost; the
risk is parse time on budget Android phones growing unnoticed. Raising a budget is a decision: record why in
`docs/DECISIONS.md` and update this table. Vite's own 500 kB chunk warning is raised to the raw budget (1,180 kB, D-252)
(`vite.config.ts`) so the build log does not cry wolf; this test is the authority. `test:bundle:static` (in
`test:fast`) also fails when a module is imported both statically and with `import()`: Vite cannot split such a
module and only warns (the old dynamic `import('@capacitor/core')` in `platform/install.ts` and `storage.ts`).
Not done: WOFF2 fonts (about −40 % of the 624 kB TTF; OFL allows the conversion, `docs/ASSETS.md` would need the
entry) — a size win only, no parse-time effect.


## Linoryt review (2026-11-08, D-302/D-304)
The shipped look after E4 and the object cleanup. `perf:scene` (SwiftShader, 412×915, DPR 1, 120 samples):
low 13 draw calls / 38,930 triangles / 20.7 fps / render CPU 0.57 ms (p95 1.5 ms) / JS heap max 21.4 MB; medium
14 / 38,766 / 10.6 fps / 0.66 ms (p95 1.4 ms) / 28.7 MB. Real game (`node dev/linoryt-frames.mjs`: Endless seed
0xA1A1 at 1× speed, rAF intervals, 8 s of play, then the first 3 s of the week-1 board), Chrome CPU throttle 1× and
4× (the "budget phone" profile; SwiftShader itself runs on the throttled CPU, so 4× is pessimistic for a real GPU):

| Throttle | Play: frames / p50 / p95 / max ms / fps | Board open: p50 / p95 / max ms |
| --- | --- | --- |
| 1× | 185 / 33.4 / 83.3 / 116.7 / 23.1 | 33.4 / 83.3 / 149.9 |
| 4× | 148 / 50.0 / 116.6 / 166.6 / 18.5 | 50.0 / 83.3 / 100.0 |

The weekly board's first frame no longer stalls (it held the page 1.4–3.2 s on SwiftShader while it compiled and read
back the crate models, #315; D-302 removed them). Nothing in the print is CPU-bound per frame: plane sprites write two
attributes per plane, the route ribbon rebuilds only on a network change, stamps only on an airport/curfew/jam change.
The SwiftShader frame time is fill: the terrain shader (one texture fetch, four derivatives) over the whole disc. The
real budget-phone check stays the Test Lab game loop (D-245), not run yet with the print.

## E4 — Satelita, Mapa and the photo textures removed (2026-11-08, D-285, D-302)
`test:bundle` on `dev` after U5 → E4: main JS **1,167.7 → 1,051.3 kB** raw (gzip 352.2 → 313.6 kB), `dist/`
**4,100.0 → 1,992.0 kB** (−2.1 MB: day/night/map/clouds textures and the satellite/diorama code), CSS unchanged
(129.4 kB). The print chunks grow a little because the look is no longer split from the rest (`linoryt-globe`
31.6 kB with the terrain builder, `linoryt-objects` 22.8 kB). `perf:scene` (SwiftShader, 412×915, the shipped look):
low 14 draw calls / 38,766 triangles / 21.8 fps, medium 14 / 38,766 / 11.5 fps (not comparable with devices; the fps
spread between runs on this container is ±30 %). The weekly board's first frame no longer compiles the crate model
shaders nor reads pixels back (`drawModelPreview` returns false, D-302).

## E3 — Linoryt in the release build (2026-11-08, D-300)
The print ships but is not selected (`DEFAULT_GLOBE_LOOK = 'satellite'`). Bundle (`test:bundle`): main chunk
1,165.8 → **1,168.8 kB** raw (budget 1,180), two lazy chunks `linoryt-globe` 12.6 kB and `linoryt-objects` 20.9 kB
(fetched only when the look is drawn), `dist/` 3,972.6 → 4,009.0 kB (budget 4,300; no new data file: the coast field
and the plane atlas are built at load, D-298/D-299). Render numbers as in E2, except the open-sea parallels (≥ 6 px
spacing): fewer, not more, fragments with lines.

## E2 — Linoryt stamps, routes and planes (2026-11-08, D-283, D-299)
DEV look `?look=linoryt` (release unchanged until E3). Medallion parts, hub seat rings, curfew barriers, route tubes
with outlines and horizon ghosts, 3D plane models, shadows and trails are replaced by **five screen-constant draws**:
stamps (1), jam zone (1, only while a jam exists), all routes as one ribbon (1), the route preview (1, while drawing),
planes as SDF sprites (1). Stamps/jam/planes are quads sized in CSS px in the vertex shader; the route ribbon is
rebuilt only on a network change; plane positions are two dynamic instanced attributes per frame (no allocation).
The plane atlas (256×128 R8 SDF from the two icon paths, ~85 kB GPU with mips) is built once per layer.
`perf:scene` (SwiftShader, 412×915, DPR 1, 120 samples; Linoryt look before → after E2; compare only within this
table, never with devices):

| Preset | Draw calls | Triangles | Idle fps | Render CPU ms |
| --- | --- | --- | --- | --- |
| low | 41 → **14** | 204 082 → **38 953** | 17.1 → 28.9 | 0.72 → 0.47 |
| saver | 41 → **14** | 204 082 → **38 882** | 17.6 → 27.9 | 0.58 → 0.32 |
| medium | 42 → **14** | 204 082 → **38 930** | 6.5 → 15.2 | 1.02 → 0.49 |

Terrain triangles are unchanged; the drop is the medallion, tube and plane-model geometry. Full-screen transparent
layers stay 0 (the object quads are small and transparent only at their AA edges).

## E1 — Linoryt globe material (2026-11-07, D-283, D-298)
DEV look `?look=linoryt` (release unchanged until E3). Same terrain mesh as the satellite look (textured relief); the
print material is one `ShaderMaterial` with **one texture fetch** (RGBA8 field 2048×1024 built at load: coast distance,
Imhof shadow, city dots; ~11 MB GPU with mips, like the `day-2048` texture it replaces) and four screen derivatives
(normal ×2, coast field ×2). No cloud, ocean or haze shells; the halo becomes one opaque sky quad (inked limb +
atmosphere lines): **full-screen transparent layers 0** on every preset. Field build on the CPU: ~0.3–0.6 s on a desktop
core (two exact EDTs + hillshade), once per globe load. `perf:scene` (SwiftShader, 412×915, DPR 1, 120 samples; compare
only within this table, never with devices):

| Preset | Look | Frames | Idle fps | Render CPU ms | Draw calls (max) | Triangles (max) |
| --- | --- | --- | --- | --- | --- | --- |
| low | satellite | 1303 | 10.7 | 0.94 | 41 | 209 072 |
| low | linoryt | 1995 | 17.1 | 0.72 | 41 | 204 082 |
| saver | satellite | 2019 | 13.7 | 0.63 | 41 | 209 072 |
| saver | linoryt | 2518 | 17.6 | 0.58 | 41 | 204 082 |
| medium | satellite | 558 | 4.8 | 1.49 | 43 | 228 528 |
| medium | linoryt | 806 | 6.5 | 1.02 | 42 | 204 082 |

Terrain triangles are unchanged (same mesh); the totals drop by the halo sphere (and the cloud shell on medium).
Shimmer: `npm run test:hatch-alias` (2 340 cases, smallest printed period 3.2 device px) and
`npm run shots -- linoryt-motion` (low preset, 8 frames at 0.15°/frame: flicker 0.00 %, budget 2 %; raw per-pixel
change ≈ 5 %, which is line motion; see D-298 for what the score can and cannot see). Still to do before U5: one Test
Lab game loop (D-245) on a budget phone with the Linoryt look.

## G9 — Medalion airports and route ink outline (2026-11-04, D-178)
The outline ring is one more part in the two airport instanced meshes' part lists (regular and hub: +2 draw calls
when both kinds exist) and the route ink outline one inflated back-face mesh per route batch (+2: widebody and
turboprop). Worst case +4 draw calls, inside the ≤ 50 budget (perf fixture: 42–43 → ≤ 47). No new geometry per frame;
routes still rebuild only on a network change.

## G4 — satellite globe fill rate (2026-11-04, D-173)
The satellite terrain material draws the sea surface (glint, fresnel sheen, night darkening) and the near-limb haze
itself; the ocean shell (r 1.0002) and the haze shell (r 1.0125) are no longer added for texture looks. Full-screen
transparent layers: low/saver 1 (the outer halo), medium/high 2 (halo + cloud shell). `perf:scene` (SwiftShader,
412×915, DPR 1, 40 s; orientation only): low 397 frames / 10.5–9.4 fps / 209 k triangles / 41 draw calls (375 frames
with the shells), medium 168 frames / 228 k / 41 (174). SwiftShader does not model mobile fill rate; G7 measures it.

## Test Lab game loop (R3i, D-245)

Real game on real budget phones: `docs/ANDROID.md` "Firebase Test Lab game loop" (scenario 1: Endless `0xA1A1`, bot,
4×, 120 s, release build). Numbers are rAF frame intervals in the WebView, not render CPU; the budgets are the ones
above (33 ms low-end, 16.7 ms mid-range). Fill one row per device after a run (owner, Q-07); not run yet.

| Date | Model (Test Lab ID, API) | GPU (report `renderer`) | Preset → adaptations | Frames | p50 / p95 ms | Mean fps | > 33 ms | Week, routes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | — | — |

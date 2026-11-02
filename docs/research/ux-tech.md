# Airway: UX and technical feasibility (globe, input, rendering, sim, audio, Capacitor)

Author: agent 3 (mobile game UX + graphics/audio). Date: 2026-11-02.
Scope: feasibility only. No game code was written. The snippets below only illustrate ideas.
Reference repos read (read-only): `/workspace/commutopia` and `/workspace/cebulak-express`.

---

## TL;DR recommendations

| Topic | Recommendation |
|---|---|
| Globe view | **Orthographic globe** (one hemisphere) with quaternion drag-rotate, a 1x–4x zoom, **lifted "flight altitude" arcs** that stay visible past the horizon, limb markers for cities on the far side, and auto-framing. No unrolled map. |
| Renderer | **Canvas 2D + d3-geo math** (ISC), with layer caching and sprite atlases. three.js stays an escape hatch behind a `GlobeRenderer` interface. Do not use SVG for the play field. |
| Input | A drag that starts on a city draws a route. A drag anywhere else rotates the globe. The globe auto-rotates while you drag near the limb. One-handed zoom is double-tap-and-drag. A long-press opens a radial menu. Undo is a 56 dp button in the thumb dock. Sim goes to 0.25x while drawing. |
| Sim | Integer ticks at a fixed step (1 tick = 1 game minute, 10 ticks per real second at 1x). Seeded mulberry32. **No trigonometry inside the sim**, because the leg durations are baked to integer ticks when an edge is created. That makes iOS JSC and Android V8 replay identically. Next-hop tables are recomputed on every network edit (40 nodes: well under 1 ms). |
| Audio | Raw Web Audio API on top of commutopia's `Engine` pattern. Tone.js (MIT, ~75 KB gz) is not needed. Original concept: **"Resonant Hubs"**: each hub is a tuned resonator, planes are gliding tones, load shows up as audible beating, and the terminator darkens the spectrum. |
| Platform | Capacitor 8 (the studio is already on 8.5.3), SystemBars with `insetsHandling: 'css'`, @capacitor/haptics, preferences/filesystem plus IndexedDB, and an orientation unlock with resize handling for foldables. |
| Prototype effort | About **10–12 person-weeks** for a vertical slice (globe, routes, sim, HUD, audio sketch, device perf pass), plus a 25% buffer. |

---

## 1. Globe presentation on 412×915 dp

### Options compared

| Option | Pros | Cons for us |
|---|---|---|
| **A. Full 3D sphere (perspective)** | Most "wow" | Perspective shrinks the limb even more. Needs WebGL. Arcs foreshorten. Hit-testing depends on depth. |
| **B. Orthographic hemisphere + drag-rotate** (d3 `geoOrthographic`) | Reads as a globe, but it is 2D math. Great circles are ellipse arcs and look right. Clipping is built in (`clipAngle(90)`). This is the established interactive-globe pattern (versor dragging; drawing 110m land during the drag and 50m at rest). | Only about 50% of the planet is visible at once. Arcs cross the horizon. |
| **C. Unrolled projection with wrap** (Equal Earth or Robinson, horizontally repeating) | All cities visible. Easy to scroll. | A great-circle arc becomes a strange curve that crosses the antimeridian. That breaks the core fantasy ("drag along great circles"). Polar routes are unreadable. Portrait 412 dp wide gives about 2.2 dp per degree of longitude. |
| **D. Azimuthal equidistant centred on the player's main hub** | One disc shows the whole world. Routes from the centre are straight lines. | Heavy distortion near the edge. It looks like a radar, not a globe. Fun as a "hub view" toggle, but not the main view. |

### Recommendation: B, with five readability aids

1. **Sizing.** Portrait: globe radius R = 0.47 × min(viewportW, viewportH − topBar − dock). On 412×915 that gives R ≈ 194 dp, so the disc is about 388 dp wide, centred at y ≈ 44% of the safe height (the globe sits slightly high so the lower 30% stays free for the thumb). Zoom range 1x–4x. Above 1x the disc overflows the screen, which is fine because orthographic zoom is just a larger R.
2. **Rotation model.** Use quaternion (versor) drag so the point under the finger stays under the finger. Clamp pitch to ±70° so the poles never flip the view and the player stays oriented. Add inertia with a decay of about 0.92 per 16 ms. A **"north up" snap** runs after 1.5 s idle (gentle 300 ms ease).
3. **Lifted arcs (key readability trick).** Draw each route at a "cruise altitude" h = clamp(0.02 + 0.06·(arcLength/π), 0.02, 0.08)·R above the surface. Long routes rise higher, as on flight-tracker sites. Project manually: p' = (1+h(t))·p, where h(t) = h·sin(πt). The point is hidden only if `z < 0 && x²+y² < R²` (behind the disc). So the mid-section of a long arc stays visible **just outside the limb**, and the player can see that a route continues around the planet. Segments that are truly occluded are drawn as a 20% alpha dashed ghost for 24 dp, then fade out.
4. **Limb markers.** For every connected city on the far side, draw a 10 dp chevron plus a three-letter code on the limb at the great-circle direction toward it, in the route colour. Tapping a marker auto-rotates the city into view (400 ms slerp). A jamming hub on the far side gets a red pulsing limb marker. This is the most important safety affordance.
5. **Auto-framing.** A "Fit" button (and a double-tap on empty ocean) computes the spherical centroid of all active cities and the smallest R that contains them. When a new city spawns off-screen, show a limb marker plus a one-shot gentle nudge, but **never** move the camera automatically while the finger is down.

### How many cities are readable at once

- Target: a 48 dp touch target per city, with a 12 dp visible dot plus a 3-letter label at 11–12 sp.
- At 1x and R = 194 dp, a separation of θ degrees near the centre maps to about 3.4·θ dp. Two cities 6° apart (about 670 km) are therefore about 20 dp apart at 1x, 48 dp at 2.4x, and 68 dp at 3.4x.
- **Design lever:** have the spawner enforce a minimum spacing of 6° great-circle distance (or 4.5° plus a guaranteed zoom stop). With a 2.5x zoom for dense clusters such as Europe, every city then satisfies the 48 dp rule.
- Practical count: at 1x, 15–25 cities on the visible hemisphere are readable as dots. Labels show only for hubs, selected cities, and cities with waiting passengers. At 2.5x, a Europe or East-Asia cluster of 8–12 cities is fully labelled. Late game (20–40 cities over the whole planet) works because only about half of them are ever on the front side.
- Label collision: use a greedy placement over 8 candidate positions, ordered by priority (hub > jammed > new > rest). Drop the label but keep the dot when it does not fit.

---

## 2. Minimal in-world HUD and layout

### In-world encodings (readable before reading any numbers)

| Concept | Encoding |
|---|---|
| City / airport | 12 dp disc. Hubs are a 16 dp rounded square with a capacity ring. New cities pop in with a 600 ms scale-in plus a ripple. |
| Route | 3 dp stroke in the route colour (8 colours, colour-blind-safe set with dash patterns as backup, as in commutopia `src/core/a11y.ts`), lifted arc. Directional "flow ticks" travel along the arc at a speed proportional to load. |
| Plane types | **Turboprop**: small silhouette (14 dp), flies the low arc (h × 0.5). The route shows a **diamond tech-stop marker** where its range forces a landing. **Widebody**: 20 dp silhouette with a faint contrail (8 trailing points) on the high arc. The silhouette alone tells them apart. |
| Waiting passengers | Up to 12 small dots stacked radially outside the hub ring, coloured by **destination region**, not by city (6 hues), so the player reads where the demand is going. Beyond 12, the dots merge into a thicker arc segment. |
| Transferring passengers inside the MCT | **Hollow** dots, which turn solid when the minimum connection time has elapsed. A thin 270° "MCT clock" sweep on the ring appears briefly when a plane arrives. |
| Hub load | Ring fill clockwise = (waiting + connecting) / capacity. Colour runs teal below 70%, amber 70–90%, red above 90%. From 90% the ring breathes at a 1 Hz pulse with a haptic tick. Above 100%, a **countdown sector** (grace period, for example 1 game hour = 60 ticks) drains. That is the game-over timer, readable at a glance. |
| Day/night | The terminator is a soft 6° gradient band. The night side gets a 35% navy multiply, and city light dots glow on the night side. |
| Night curfew zones | A diagonal hatch pattern (8 dp pitch, 15% alpha) over the night-side area of curfew cities, plus a moon badge on the airport. Planes into those cities wait at the origin, shown as a small "holding" halo. |
| Demand waves | Morning-side cities emit slow concentric rings (one every 2 s) when demand is spiking. |

### Portrait layout 412×915 dp

```
y=0   ┌────────────────────────────────┐  status bar: var(--safe-area-inset-top) ≈ 24–48 dp
      │ Week 7 ▸ 3d   ✈ 1 284  ☾ 18:40 │  top info bar, 44 dp, read-only (outside the thumb zone)
      │                                │
      │          (globe disc)          │  R≈194 dp, centre y≈ top+44+330
      │                                │
      │  ‹LIS                    TYO›  │  limb markers
      ├────────────────────────────────┤  ≈ y 640
      │ [hub peek sheet: 0 or 120 dp]  │  slides up when a hub/route is selected
      ├────────────────────────────────┤
      │ [↶]  [✈][✈][✈▲]  [⧉]  [▶▶]  │  thumb dock: 72 dp tall, 56 dp buttons, 8 dp gaps
y=915 └────────────────────────────────┘  + var(--safe-area-inset-bottom) (gesture bar ~24 dp Android / 34 pt iOS)
```

- Dock contents, left to right: Undo (56 dp, bottom-left, mirrored for left-handed mode), the plane inventory chips (drag them onto a route, or tap a route and then tap a chip), Fit/zoom, and speed (pause / 1x / 2x). Pause also lives in the top bar.
- The weekly upgrade choice is a modal bottom sheet with 2–3 cards, each at least 120×160 dp, with the sim paused.
- Minimum touch target is 48×48 dp with 8 dp spacing, per Google's accessibility guidance. Visual icons can be 24 dp inside 48 dp hit boxes.

### Landscape 915×412 dp

- The globe disc sits left of centre: R = 0.46 × (412 − insets) ≈ 180 dp.
- The **right edge holds a vertical rail**, 80 dp wide, with the same dock buttons stacked (thumb of the right hand). It mirrors to the left side in left-handed mode.
- The top-left holds the info chip row. Hub details open as a **side sheet**, 280 dp wide, between the globe and the rail, instead of a bottom sheet.
- Respect `--safe-area-inset-left/right` because of the camera cutout in landscape.

### Foldables (inner ~673×841 dp, square-ish; ≥ 600 dp is the "medium/expanded" width class)

- Width ≥ 600 dp uses the "expanded" layout: globe R = 0.42·min(w,h) (about 280 dp), a persistent side panel 300 dp wide (hub list sorted by load, upgrades), and a dock at the bottom of the panel column.
- Handle the fold or unfold with **no Activity restart**. Capacitor's default `configChanges` already include `screenSize|smallestScreenSize|screenLayout|orientation`, as both reference manifests show. In JS, listen to `ResizeObserver` on the canvas container plus `visualViewport.resize`. **Keep the camera quaternion and zoom-relative scale**, recompute R, and re-raster the sprite atlases only if DPR changed. Pause the sim for 300 ms while the layout settles.
- Verify actual inner-display dp values on real hardware or Samsung Remote Test Lab. My web search could not confirm 673×841; the Fold 6 panel is 2160×1856 px at 374 ppi, which works out to roughly 924×794 dp by my own calculation.

---

## 3. One-handed gesture set

Lessons from Mini Metro on mobile: reviews praise drag-to-connect as natural on touch, but they repeatedly complain about **grabbing line ends** and **accidental deletes or edits**. Design against both.

| Action | Gesture | Notes |
|---|---|---|
| **Rotate globe** | One-finger drag that starts on empty globe or space | Quaternion drag with inertia. |
| **Draw route** | Drag that **starts within 28 dp of a city centre** (a 56 dp target) and moves more than 8 dp | Preview arc follows the finger. **Magnetic snap** to the nearest city within 36 dp of the finger (44 dp in the "Assist" a11y setting). The snapped city enlarges by 1.3x and gives `Haptics.selectionChanged()`. Release on a city commits. Release elsewhere cancels with no penalty. |
| **Drawing to a far city** | Holding the finger within 40 dp of the limb **auto-rotates the globe** toward that direction at a speed proportional to depth (max 60°/s) | This is essential: without it, a one-hand player cannot reach cities over the horizon. |
| **Extend route** | Drag the **end handle**, a 48 dp tab offset 20 dp beyond the terminus along the arc tangent, so it is never under the city's own hit target | This solves the "grab line end" problem. |
| **Insert stop / reroute** | Long-press (350 ms) on the route body, which lifts it with a haptic, then drag onto a city | |
| **Shorten** | Drag the end handle back onto the previous city, or into empty space | Shows a "release to remove last leg" preview. |
| **Delete route** | Long-press the route, then choose Delete from a radial menu (3–4 items, 64 dp spokes). Or drag its end handle onto a trash target that appears in the dock | Never delete on a plain tap. Deleting a route with passengers on board waits until planes land (shown greyed). |
| **Assign plane** | Drag a plane chip from the dock onto a route. **Or** tap the route, then tap the chip | The tap-tap path needs no precision dragging. |
| **Zoom (one hand)** | **Double-tap-and-hold, then drag up/down** (the Google Maps pattern). Double-tap on a city zooms to it. Two-finger pinch is supported but never required. The Fit button sits in the dock. | |
| **Undo** | 56 dp dock button; long-press shows a history list (last 20 actions) | |
| **Pause / slow** | While any edit gesture is active, the sim runs at 0.25x by default (setting: 0x / 0.25x / 1x) | Accessibility: no time pressure during precise input. |

**Conflict resolution rule:** classify on pointerdown. If a hit-test hits a city or handle, the gesture is an edit. If it hits a route body and a 350 ms hold follows, it is a route edit. Otherwise it is rotate. A second pointer that arrives within 120 ms switches to pinch/rotate and cancels a pending draw.

Accessibility: an Assist mode with a bigger snap radius and auto-pause on edit, a left-handed mirror, colour-blind patterns (reuse the commutopia `a11y` approach), haptic intensity levels (commutopia `src/game/haptics.ts` has a `soft` level), and no hold timers below 350 ms.

---

## 4. Rendering technology

Target device: a 2021 mid-range phone (Snapdragon 6xx with Adreno 610/618, or a Helio with Mali-G52/G57), 1080×2400 at DPR ≈ 2.6, Android System WebView (Chromium). commutopia's `src/render/deviceTier.ts` already classifies Adreno 605–613 and Mali-G31/G5x as **low tier**, and the same classifier can be reused.

| Criterion | three.js (WebGL) | **Canvas 2D + d3-geo math** | SVG |
|---|---|---|---|
| Land (NE 110m: about 54 KB TopoJSON in world-atlas `land-110m.json`, a few thousand vertices) | Mesh once; rotation is free on the GPU | Re-project and fill per frame while rotating: about 4–6k points, ≈ 0.3–0.8 ms of JS plus the fill. Cache to an offscreen canvas when the camera is idle. | DOM path updates per frame: slow |
| Great-circle arcs | Need fat-line shaders (Line2) for widths above 1 px on mobile | `geoInterpolate` or own slerp, plus a stroke. Trivial. | OK, but redraws are costly |
| Terminator | Shader: very nice | One `geoCircle` (radius 90°, centred on the antisolar point), projected and filled with a gradient. Cheap. | OK |
| About 100 moving planes | Instanced sprites: trivial | 100 `drawImage` calls from an atlas: under 1 ms | 100 DOM transforms: janky in WebView |
| Text (city codes) | Needs SDF text (troika-three-text, MIT) or a DOM overlay | Native `fillText`, cached into an atlas: crisp, any locale | Good |
| Bundle | three ≈ 600 KB min (about 150 KB gz) | d3-geo + topojson-client: about 30 KB gz | 0 |
| Mobile risks | WebGL context loss, shader-compile stalls on Mali, more GPU power draw | CPU-bound fills at high DPR (mitigate with a DPR cap) | Layout and style recalc |
| Team familiarity | commutopia (three 0.186) | cebulak-express (Canvas2D) | – |

### Recommendation: Canvas 2D with d3-geo (or own ~150 lines of orthographic math)

The look is flat-vector minimalism, which is all 2D content. d3-geo gives correct horizon clipping and adaptive resampling for free. Canvas `fillText` handles all locales. The cebulak-express renderer and interpolation patterns (`src/render/renderer.ts`, `src/render/interpolation.ts`) transfer directly.

Implementation notes:
- **Layers.** (1) Ocean, land and graticule go to an offscreen canvas that redraws only when the camera changes. During a drag, draw 110m land; at rest, optionally 50m. (2) Night overlay redraws when the terminator moves more than 0.5° or the camera changes. (3) Routes. (4) Planes, passengers and rings every frame. (5) The HTML/CSS HUD sits above the canvas.
- **DPR cap.** Use min(devicePixelRatio, 2) on mid and high tiers and 1.5 on the low tier. This roughly halves the fill cost on a 2.6 DPR phone with little visible softness for vector art. commutopia's `src/render/perf.ts` reports the pixel ratio, and the same adaptive approach applies.
- **Frame pacing and battery.** Run 60 fps during gestures and camera animation, and **30 fps when idle** (planes move slowly). Stop the rAF loop when paused or in the background (`@capacitor/app` pause). Expected cost on a low-tier phone: about 4–7 ms of render plus ≤ 1 ms of sim at 1x.
- **Escape hatch.** Put rendering behind a `GlobeRenderer` interface. If profiling shows land fill above 8 ms on the low tier, swap only the base layer for a WebGL textured sphere (three.js or regl) and keep the Canvas2D overlay.

### Libraries and licences

| Library / data | Licence | Use |
|---|---|---|
| d3-geo 3.x | ISC | orthographic projection, clipping, `geoInterpolate`, `geoCircle`, `geoDistance` |
| topojson-client 3.x | ISC | decode land TopoJSON |
| world-atlas 2.x (land-110m ≈ 54 KB, land-50m) | ISC; data from Natural Earth | land shapes |
| Natural Earth (110m/50m, populated places) | Public domain | land and city candidates |
| versor (d3 versor dragging) | ISC (verify on npm) | quaternion drag |
| solar position: own ~40 lines (NOAA formulas) or `solar-calculator` | ISC | terminator (sim uses game time, not the real date) |
| three.js (escape hatch) / troika-three-text | MIT / MIT | optional |
| Tone.js 15.x (not recommended) / standardized-audio-context | MIT / MIT | optional |
| Capacitor 8 core + official plugins | MIT | platform |

Keep the studio's licence-summary tooling: cebulak-express `tools/licenses.mjs` (prebuild) and commutopia `src/ui/licenseSummary.ts`.

---

## 5. Deterministic simulation architecture

### Core design
- **Fixed step.** 1 tick = 1 game minute. At 1x the sim runs 10 ticks per real second (so 1 game day is 144 s); 2x is 20/s and 4x is 40/s. Use the commutopia `SimPacer` pattern (`src/game/simPacer.ts`): accumulator, maximum steps per frame, capped backlog, work counted rather than timed, and no allocation. Render interpolates as cebulak does (`src/render/interpolation.ts`, alpha = acc/TICK).
- **PRNG.** mulberry32 plus an FNV-1a seed from a string (copy cebulak `src/core/rng.ts` and commutopia `src/game/daily/seed.ts` `hash32`). Use **separate streams** for city spawns, demand, and events, so that adding one feature doesn't shift the other streams. Persist stream states in the save, as commutopia's `bikes.ts` `rngState` does.
- **Cross-engine determinism (important).** iOS runs JavaScriptCore and Android runs V8. `Math.sin/cos/atan2/exp` are **not guaranteed bit-identical** across engines, while `+ - * /` and `Math.sqrt` are (IEEE-754). Rules:
  - The sim never calls trigonometric functions. When the player creates a route edge, compute great-circle distance once, round flight time to an **integer number of ticks**, and store that integer in the command, so replays carry it.
  - City coordinates live in a fixed table, and distances are precomputed in build tooling into an integer matrix in the data file.
  - Plane position is purely render-side: `t = (tick − departTick)/(arriveTick − departTick)`, then `geoInterpolate`.
  - Demand curves use lookup tables, not `Math.exp`. The day/night phase is an integer minute of day per longitude band.
  - Use integer passenger counts everywhere.
- **Commands.** Every player action is a command `{tick, type, args}`: addEdge, removeEdge, extendRoute, assignPlane, chooseUpgrade, and so on. The sim applies commands only at tick boundaries. Replay = seed + rulesVersion + command list, which generalises cebulak's `flapTicks` (`src/core/game.ts` `replay()`, verified in `functions/src/index.ts` and `src/net/api.ts`).

### Passenger routing
- Graph: V ≤ 40–60 cities; edges come from routes, weighted by flight ticks.
- Generalised cost = flight ticks + transfer penalty (MCT + expected wait ≈ headway/2) + a hop penalty.
- On every network change, recompute **all-pairs next-hop tables**. For 40 nodes, Floyd–Warshall is 64k relaxations and Dijkstra×V is smaller still: well under 1 ms. Do it synchronously at the tick boundary. Break ties deterministically by city id.
- Passengers store only their destination. At each hub arrival they re-query the next hop, which is robust to edits. commutopia's RAPTOR-light router (`src/sim/transit2/router.ts`) is heavier than needed because it covers 384 stops and multiple lines. Borrow its ideas only: double-buffered plans, a generalised cost with wait weight α=1.5 and transfer penalty K, and flat typed-array matrices.
- **MCT.** On arrival a passenger becomes `connecting` with `readyTick = tick + MCT[hubClass]` and shows as a hollow dot. After that they are `waiting` (solid). Capacity counts both groups.
- **Jam.** If load exceeds capacity, a grace counter runs (for example 60 ticks). If it reaches zero, the game ends. The counter decays at 2x speed when load drops back under capacity.
- **Tech stops.** If a turboprop's range is below the leg length, the route requires an intermediate city. The edge stores a mandatory stop, and the plane makes two legs.
- **Curfew.** Arrivals into a city whose local minute-of-day falls in [23:00, 06:00) are blocked. The plane holds at the origin.

### Undo in a live simulation
- Puzzle mode: undo = pop the last command and **re-simulate from the nearest checkpoint**. Take snapshots every 600 ticks into a ring buffer (commutopia `src/game/history.ts` ring, test `test:history:ring`). Determinism makes this exact.
- Endless mode: allow undo for **network edits only, within N seconds or while paused**, so it cannot rewind a jam.
- Use commutopia's `src/game/undoTx.ts` (`recordPush` / `dropPush`) for cancelled or refused actions.

### Performance budget (low-tier phone, 60 fps = 16.7 ms)

| Item | Budget |
|---|---|
| Sim at 4x (40 ticks/s, about 0.7 tick per frame) | ≤ 1.5 ms |
| Route-table rebuild (per edit) | ≤ 1 ms |
| Render | ≤ 8 ms |
| Audio scheduling | ≤ 0.5 ms |
| GC | zero allocations in tick and render loops (both repos follow this rule) |

Scale limits: 60 cities, 24 routes, 120 planes, 3,000 passengers alive.

### What to reuse from the studio repos

| Pattern | File(s) |
|---|---|
| Pure, DOM-free sim class driven by `tick()` and inputs, shared by game, tests and server | cebulak `src/core/game.ts` |
| PRNG / seed | cebulak `src/core/rng.ts`; commutopia `src/game/daily/seed.ts` |
| Daily key (Warsaw time zone vs. local date) | cebulak `src/core/daily.ts` (fixed zone: global board); commutopia `src/game/daily/*` (local date, offline). Pick the cebulak model if there is a global leaderboard. |
| Server replay validation, rules version, rejection reasons | cebulak `src/net/api.ts`, `functions/src/index.ts`, `functions/src/validation.ts`, `functions/src/abuse.ts`, `src/core/rules.ts` |
| Offline submit queue | cebulak `src/net/queue.ts` (localStorage FIFO, permanent vs. transient rejections) |
| Fixed-step pacing and backlog | commutopia `src/game/simPacer.ts`; cebulak `src/main.ts` (lines ~926–962: accumulator with a cap of 24 steps) |
| Save slots, schema version, migration, IndexedDB with localStorage fallback | commutopia `src/game/save.ts`, `src/game/idb.ts` |
| Undo transactions | commutopia `src/game/undoTx.ts`, `src/game/history.ts` |
| Device tier and adaptive DPR | commutopia `src/render/deviceTier.ts`, `src/render/perf.ts` |
| Haptics wrapper | commutopia `src/game/haptics.ts`; cebulak `src/audio/haptics.ts` |
| Audio engine (buses, voice cap of 26, OfflineAudioContext tests) | commutopia `src/game/audio/engine.ts`; unlock and visibility handling in cebulak `src/audio/music.ts` |
| Keep-awake during play | commutopia `src/core/keepAwake.ts` |
| Vertical clip recorder (marketing, shares) | cebulak `src/record/recorder.ts`. This is a video recorder, not a replay system. |

---

## 6. Generative music and sound

Mini Metro's audio (Disasterpeace) is built around **lines as the means of authorship that carry pitch and rhythm**, serialist value sets applied to musical axes, and density that scales with the network. To stay clearly distinct, we avoid "one route = one instrument line sequenced on a station clock".

### Main concept: "Resonant Hubs" (physical, spatial, not sequenced)
- **Hubs are resonators.** Each hub is a tuned resonant body (a bank of 2–3 bandpass or Karplus-Strong strings). Its fundamental comes from **latitude**: map −60…+70° onto a pentatonic or lydian set over 2 octaves, so the world is "tuned" geographically and every map sounds different. Size or capacity sets the decay length.
- **Planes excite the world.** A departure is a soft pitch **glide upward** (portamento over the climb time); a landing glides downward and **excites** the arrival hub's resonator (a strike). Turboprops are a higher, buzzier filtered saw. Widebodies are a low sine and triangle pad with a slow swell. Long-haul flights sustain a quiet drone panned by screen x.
- **Transfers.** A passenger completing their MCT plucks the hub's resonator softly. A busy hub therefore "rings" more densely, organically.
- **Load is beating.** A second oscillator detunes from the hub tone by a beat rate proportional to load: 0 Hz when calm, about 6 Hz at 100%. **Players hear stress before they see it**, with no alarm sample.
- **Terminator.** The night hemisphere gets a lower filter cutoff, more reverb and sparser events. Dawn sweeping across a hub triggers a gentle chord bloom from the cities it passes (reading the sim state; never a timer independent of the sim). Curfew silences a resonator.
- **Weekly upgrade:** a key change (modulation to the relative or dominant) once per week, which gives the game a structural "chapter".
- Everything derives from deterministic sim events, so replays and daily-challenge clips sound identical (useful with cebulak's recorder audio-tap pattern).

### Alternative B: "Shortwave Atlas"
Little conventional melody. Each city has a call-sign rhythm (an FNV hash of the name gives a 5-pulse Morse-like pattern). Hubs emit their call-sign when planes are boarding. Background radio-static texture (filtered noise from the commutopia engine's `white`/`brown` buffers) gets louder with traffic. The terminator swaps between a day "AM band" and a night "longwave" spectrum. This is cheap to produce and distinctive, but less "musical".

### Alternative C: "Planet Music-Box"
The terminator **is the playhead**: as it sweeps across longitudes, each city it crosses (dawn edge only) plays its note. Notes come from the city's number of connections (more connections = richer chord). The tempo is literally the rotation of day. Very legible, but more sequencer-like, so it carries a slightly higher resemblance risk. Keep it as the fallback.

### Technology
- **Raw Web Audio API on the commutopia `Engine` pattern** (buses, compressor, voice-pool cap, OfflineAudioContext render tests). Tone.js 15 is MIT and about 329 KB min / 75 KB gz. It is convenient for its Transport, but adds weight and is unnecessary here because events come from the sim, not a musical clock.
- Use a lookahead scheduler: a 25 ms timer schedules events 100–150 ms ahead on `ctx.currentTime`. Sim ticks map to audio time, so audio latency only affects UI clicks. For instant feedback use haptics, not audio.
- **Android latency:** WebView Web Audio output latency varies by device (often tens of ms up to over 100 ms; Bluetooth more). Read `ctx.outputLatency` / `baseLatency` (available in Android WebView 102+) and offset visual sync accordingly.
- **Unlock:** create or resume the `AudioContext` inside the first `pointerup` (cebulak `src/audio/music.ts` `prepare()`). Suspend on `@capacitor/app` pause and `visibilitychange`, and resume on return.
- **iOS silent switch:** Web Audio counts as "ambient" and obeys the mute switch. `navigator.audioSession.type = 'playback'` makes audio play through it. Default to **ambient**, which respects the switch and mixes with the user's music, which is right for a calm puzzle game. Add a setting "Play sound in silent mode" that sets 'playback'. Test in WKWebView on iOS 17–26, since WebKit bug reports exist about backgrounding.
- Phone speakers: high-pass at 55 Hz (as commutopia's engine does). Keep resonators in 200 Hz–3 kHz.

---

## 7. Capacitor specifics (Capacitor 8.5.x, as both repos use)

- **Haptics.** `@capacitor/haptics` (MIT): `selectionChanged` on snap, light impact on commit, warning notification at 90% hub load, error on game over. Wrapper with soft/off levels: commutopia `src/game/haptics.ts`.
- **System bars and safe areas.** Android 15 (targetSdk 35) enforces edge-to-edge, and Android 16 removes the opt-out. Android WebView below 140 reports wrong `env(safe-area-inset-*)`. Use the core **SystemBars** config `insetsHandling: 'css'` and the injected `--safe-area-inset-*` variables (native insets since Capacitor 8.3). cebulak's `capacitor.config.ts` already does this (`SystemBars: { hidden: true, insetsHandling: 'css', initialViewportFitValueHint: 'cover' }`). For Airway, keep the status bar visible with style DARK or LIGHT per theme, and `viewport-fit=cover`.
- **Orientation.** cebulak locks portrait in the manifest. Airway should **not lock**: allow portrait and landscape, and use `@capacitor/screen-orientation` (MIT) only for an optional in-game "lock orientation" setting. On iPad and foldables, never lock (large-screen policies).
- **Foldables.** No Activity recreation (keep `configChanges` as in the reference manifests). Handle `resize` and `ResizeObserver` and re-layout without a sim reset (see §2).
- **Offline.** Bundle everything (land TopoJSON, city table, audio is synthesised so no samples). The network is only for leaderboards and daily-challenge verification, with offline queueing (cebulak `src/net/queue.ts`). The daily seed is computable offline.
- **Save/load.** Autosave per week tick and on `@capacitor/app` `pause`. Use IndexedDB through commutopia's `openKv` with localStorage fallback, plus `@capacitor/preferences` for settings. Use a versioned schema with migrations (commutopia `SAVE_VERSION`). Optionally store a save as seed + commands (tiny), which also serves as the replay.
- **Keep-awake** during active play only (commutopia `src/core/keepAwake.ts` with a native Screen plugin, or `@capacitor-community/keep-awake`, MIT).
- **Store builds.** Reuse cebulak's fastlane, `@capacitor/assets` generation, licence prebuild, and the `check:launch` script. Play: AAB with targetSdk 35+. iOS: SwiftPM (cebulak already configures it). Premium pricing means no ads SDK, which simplifies privacy labels.
- **Back button (Android).** Pass it through the back stack (commutopia `src/ui/backStack.ts`, `setBackIntercept`) to close sheets, then pause, then quit.

---

## 8. Risks and mitigations, effort

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | Cities too dense to touch (Europe) | High / High | Minimum-spacing rule in the spawner (≥ 6° great-circle), zoom to 2.5x, magnetic snap, a loupe during drag |
| 2 | Arcs past the horizon are confusing | High / Med | Lifted arcs, limb markers, auto-rotate at the limb, Fit button |
| 3 | Draw/rotate gesture conflicts | Med / High | Classify on pointerdown, 8 dp slop, end handles offset from cities, test with 10 one-handed playtesters |
| 4 | Canvas fill cost at DPR 2.6 on Mali-G52 | Med / Med | DPR cap 1.5–2, cache land and night layers, 30 fps when idle, WebGL base-layer escape hatch |
| 5 | Cross-device replay mismatch (JSC vs V8 maths) | Med / High | No trig in the sim; integer ticks; golden replay tests run in Node **and** on an iOS device in CI (Playwright WebKit as a proxy) |
| 6 | Android 15/16 edge-to-edge inset bugs (Samsung) | Med / Med | SystemBars CSS insets; device tests on S22/S23 class phones |
| 7 | Web Audio latency or backgrounding glitches on iOS WKWebView | Med / Low | Schedule ahead, suspend and resume on lifecycle events, haptics for immediacy |
| 8 | Audio resembles Mini Metro too closely | Low–Med / High (reputational) | Resonator/physical concept (§6), no route-as-sequencer-voice, design review against Disasterpeace talks |
| 9 | Foldable resize breaks the camera or sim | Med / Med | Resize = layout only, camera quaternion persisted, automated resize test in Playwright |
| 10 | Battery drain in long endless sessions | Med / Med | Frame-rate throttling, stop rAF when paused, no WebGL by default |
| 11 | Too much text on screen | Med / Med | Encode state through ring, colour and dot language; numbers only in the peek sheet |

### Rough effort (one senior TS dev who knows the studio's codebases)

| Work package | Person-weeks |
|---|---|
| Globe renderer (orthographic, land layers, terminator, lifted arcs, limb markers, zoom/rotate/inertia, Fit) | 2 |
| Route editing gestures (draw, snap, extend, insert, delete, radial menu, limb auto-rotate, undo UI) | 2 |
| Sim core (ticks, PRNG streams, cities and demand, routing tables, MCT, capacity and jam, planes, tech stops, curfew) + headless tests | 2 |
| HUD and layouts (portrait, landscape, foldable, safe areas, upgrade sheet, a11y options) | 1.5 |
| Audio prototype ("Resonant Hubs", engine reuse, lifecycle) | 1.5 |
| Save/load, daily seed, command-log replay (reusing cebulak and commutopia) | 1 |
| Capacitor builds and device performance pass (Adreno 610 / Mali-G52 / iPhone 12 / Fold) | 1 |
| **Total** | **≈ 11 (+25% buffer ≈ 14)** |

A "toy" prototype (globe + drag routes + planes moving + basic passengers, no audio or polish) is feasible in **3–4 weeks**.

---

## Sources
- d3 versor dragging and rotating orthographic (Canvas, 110m while dragging / 50m at rest): https://observablehq.com/@d3/rotating-orthographic , https://gist.github.com/mbostock/7ea1dde508cec6d2d95306f92642bc42 , https://gist.github.com/HarryStevens/57c0fd41825c1cd1f79b6d07b6a32223 , https://gist.github.com/gaubert/92579303a26e4b133166
- world-atlas (land-110m.json ≈ 53.9 KB): https://cdn.jsdelivr.net/npm/world-atlas@2/ , https://github.com/topojson/world-atlas
- Touch target 48×48 dp, 8 dp spacing: https://support.google.com/accessibility/android/answer/7101858
- Mini Metro mobile controls (praise and complaints): https://dinopoloclub.com/?p=872 , https://transitmap.net/mini-metro-review , https://toucharcade.com/community/threads/mini-metro-by-dinosaur-polo-club.295652/ , https://www.nintendoworldreport.com/review/48238
- Mini Metro audio approach (to avoid copying): https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace , https://www.killscreen.com/music-urban-commute-designing-mini-metros-soundtrack/ , https://disasterpeace.com/blog/tag.tools.procgen.p2
- Capacitor edge-to-edge, SystemBars, WebView < 140 inset bug: https://capacitorjs.com/docs/next/apis/system-bars , https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/ , https://capgo.app/blog/capacitor-edge-to-edge-display-native-config/ , https://forum.ionicframework.com/t/top-and-bottom-ui-overlapping-on-android-15-samsung-s22-s23-devices/249536
- iOS Web Audio silent switch / `navigator.audioSession`: https://bugs.webkit.org/show_bug.cgi?id=252746 , https://bugs.webkit.org/show_bug.cgi?id=251532 , https://bugs.webkit.org/show_bug.cgi?id=291892 , https://www.abratabia.com/web-game-audio/mobile-audio-issues.php
- AudioContext outputLatency / baseLatency: https://docs.w3cub.com/dom/audiocontext/outputlatency , https://docs.w3cub.com/dom/audiocontext/baselatency
- Tone.js size and licence: https://depscope.dev/pkg/npm/tone
- Galaxy Z Fold 6 panel spec (dp not confirmed): https://www.sammobile.com/?p=16587925
- Local repos: `/workspace/cebulak-express` (src/core/rng.ts, src/core/game.ts, src/core/daily.ts, src/net/api.ts, src/net/queue.ts, functions/src/*.ts, src/audio/music.ts, src/render/interpolation.ts, capacitor.config.ts) and `/workspace/commutopia` (src/game/simPacer.ts, src/game/daily/seed.ts, src/game/undoTx.ts, src/game/save.ts, src/game/idb.ts, src/sim/transit2/router.ts, src/sim/transit2/hub.ts, src/render/deviceTier.ts, src/game/haptics.ts, src/game/audio/engine.ts, src/core/keepAwake.ts)

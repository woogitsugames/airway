# Decisions

Format: **D-xx — title** (date, who) · decision · rationale · status.

## D-01 — Stage 0 is research and visual direction only (2026-11-02, owner)
No game code until the owner picks a visual direction. Deliverables: RESEARCH.md, 3–4 style directions with mockups,
recommendation. **Status: in force.**

## D-02 — Studio brand ≠ game title (2026-11-02, owner)
"Airway Games" (airway.games) is the studio brand. The game gets its own distinctive title: "airway" search results
are dominated by medicine and "airways" evokes Mini Airways. Title candidates in `docs/RESEARCH.md`.
**Status: superseded by D-12 (owner chose "Airway" as the game title).**

## D-03 — Core direction: design the airline network, planes fly themselves (2026-11-02, proposal)
Route-network design on a globe, not air traffic control. Addresses Mini Airways' main weakness (per-plane
micromanagement). Altitude layers/corridors are out of the core. **Status: recommended, to be confirmed with the
style decision.**

## D-04 — Mockup tooling: static HTML/SVG generated in Node, rendered by Playwright (2026-11-02, Claude)
Mockups are built by small Node scripts (d3-geo + world-atlas for real coastlines) into static HTML, then rendered to
PNG at 412×915 and 915×412. No framework, no game code. Rationale: deterministic, cheap, reviewable PNGs; the same
projection maths will be reused by the real renderer later. **Status: in force for stage 0.**

## D-05 — No minimal "diagram" look; the world must be rich and illustrated (2026-11-02, owner)
Owner feedback on the first "Mapa pilota" mockups: "too minimalist, which makes it resemble Mini Metro". All directions are now
rich, illustrated worlds (terrain, buildings/airports, clouds, light) with gameplay information drawn into that world. The chart
direction is kept only as a record (`docs/styles/chart.md`). **Status: in force.**

## D-06 — Four directions for the owner's choice (2026-11-02, Claude)
A Diorama (3D low-poly globe, three.js), B Poczta lotnicza (outlined illustration, family), C Atlas (engraving + watercolour),
D Mapa pilota (rejected, D-05). Dropped before mockups: split-flap mosaic (even more abstract) and screen-print overprint (too
close to AirWar's poster style). **Status: closed by D-11 (A Diorama).**

## D-07 — Market reality: Tiny Airline exists (2026-11-02, research)
Tiny Airline (Steam, coming soon, PC) already has drawn routes, range limits, nightly upgrades and a crowded-airport fail state on
a flat map. Our differentiators are therefore the globe, the day/night terminator (demand waves, curfews), hub transfers with
minimum connection time, and a portrait mobile-first design — not range or upgrades per se. **Status: informs D-03.**

## D-08 — Passenger identity by shape; colours CVD-checked (2026-11-02, Claude)
Destination regions use six glyphs that are none of Mini Metro's shapes: chevron, bow-tie, crescent, keyhole, tail-fin, bracket.
Colour only reinforces; every direction's six destination colours keep min ΔE76 ≥ 15 under protan/deutan/tritan simulation.
**Status: in force.**

## D-09 — Fonts must cover Polish (2026-11-02, Claude)
Every face is checked for ą ć ę ł ń ó ś ź ż before use. B612 rejected for this reason. **Status: in force.**

## D-10 — Working title "Hubline" in mockups only (2026-11-02, Claude) — superseded by D-12
Cleanest of the checked candidates. Placeholder until the owner chooses (see RESEARCH §7). **Status: placeholder.**

## D-11 — World style A "Diorama" chosen; UI reworked as airport objects (2026-11-02, owner)
Owner: "the map style of A is great, only the menus are too AI slop". The 3D low-poly globe is the game's world. The first UI
(dark rounded panels, list menu, orange CTA) is replaced by real airport artefacts: boarding pass (top bar), luggage tags on a
cord (dock, passenger bubbles), ATC flight strip (hints), air-cargo labels (weekly upgrade), split-flap departure board and
yellow wayfinding sign (menu). Details: `docs/styles/diorama.md`. **Status: accepted by the owner 2026-11-02 ("to ok"). Final.**

## D-12 — Game title: "Airway", domain airway.games (2026-11-02, owner)
The game is called **Airway** and lives at airway.games (same as the studio brand). Replaces D-02's "own title" and the
Hubline placeholder. Known trade-offs noted in research (generic search term with medical results; proximity to "Mini Airways"):
mitigate with store subtitle/keywords (e.g. "Airway: route network on a globe"), the distinctive 3D globe look in screenshots,
and a trademark check (EUIPO/USPTO/UPRP) before release. **Status: in force.**

## D-13 — Pure, transcendental-free simulation (2026-11-02, task 01)
The authoritative `src/sim/**` imports no three.js, Capacitor, renderer,
UI, input, audio or platform code and never accesses browser globals.
`Math.random`, `Date.now` and transcendentals such as
`Math.sin/cos/tan/exp/pow/atan` (including inverse variants) are forbidden.
Rendering/input may use projection/trigonometry; the simulation receives
precomputed integer durations, coordinates and other validated command data.
Use a fixed simulation step and a serializable seeded RNG in `src/core/rng.ts`.
**Rationale:** JS engines on iOS and Android need not produce bitwise-identical
transcendental results, whereas fixed integer simulation allows identical
replays, undo and daily challenge verification. Enforced by `npm run test:arch`.
**Status: in force.**

## D-14 — Production is split into 30 agent tasks (2026-11-02, owner request)
Briefs in `docs/tasks/` (index `00-INDEX.md`, generator `docs/tasks/tools/gen_tasks.py`). Each session branches
`task/NN-slug` from `dev`, pushes it and opens a draft PR to `dev`; the owner merges. Task 01 creates `dev` from this branch.
**Status: in force.**

## D-15 — App ID: `pl.samsufi.airway` (2026-11-02, owner)
Used in `capacitor.config.ts`, Android `applicationId` and iOS bundle identifier. Cannot change after the first store release.
**Status: in force.**

## D-16 — Business model: free for now; ads and a paid version later (2026-11-02, owner)
MVP ships fully free with no ads, no IAP, no analytics. Code keeps no-op `Entitlements`/`AdService` interfaces and a disabled
content gate (task 27) so ads/paid can be added later without a rewrite. Brief's rules still apply when they come: no
full-screen ads during play, no timers, no dark patterns. Supersedes the recommendation in RESEARCH §6. **Status: in force.**

## D-17 — Night curfew: from week 4 in Endless, always available in Puzzles (2026-11-02, owner)
**Status: in force.**

## D-18 — Store title: "Airway: Globe Route Builder" (PL: "Airway: Buduj siatkę lotów na globusie") (2026-11-02, owner)
**Status: in force.**

## Production decisions from the parallel tasks (integration, 2026-11-02)
Tasks 02–28 were developed in parallel and each picked the next free number (D-19 or D-20). During integration they
were renumbered D-19…D-37 in task order of the merge; each renumbered entry keeps its
_"renumbered from D-xx during integration"_ note. Mapping and the references that were updated:
[`docs/integration/RENUMBERING.md`](integration/RENUMBERING.md). New decisions continue at **D-38**.

## D-19 — Canonical replay and checkpoint undo contract (2026-11-02, task 02)
The simulation journals commands in FIFO order as `[executionTick, command]`; `apply()` only queues for the next tick.
Save schema v1 includes integer state, named RNG stream states, command journal, pending inputs and up to 64 checkpoints
at 600-tick intervals. The state hash is UTF-8 FNV-1a of recursively sorted-key JSON; command history has a rolling
fingerprint until gameplay models are introduced. Undo removes the newest player command and replays to the original
current tick from a checkpoint strictly before that command. A queued positive `SetSpeed` exposes
`schedulingSpeed` to wake a paused scheduler without applying a command outside a tick.
**Status: in force; domain command validation remains with later gameplay tasks.**

## D-20 — Indexed city geography and seeded spawning (2026-11-02, task 05)
Use a stable, versioned list of 165 real cities. City coordinates are rounded to 0.1 degree;
population figures are approximate demand weights, not authoritative census totals.
The build-time generator creates a triangular table of 13,530 integer kilometres
(great-circle haversine, Earth radius 6,371 km), stored in a `Uint16Array` and checked
against the city source hash. In the simulation, a conservative 668 km threshold
ensures no two active city coordinates are closer than 6 degrees without requiring
trigonometric calculations (D-13). A seed determines an initial 3–4-city cluster
in one destination region within 3,000 km of its anchor; a new city arrives every
four game hours, favouring existing nearby nodes until the 40-city MVP cap.
The original six Diorama destination glyphs and colours remain unchanged. The
additional Asia (`ASI`, wing) and Oceania (`OCE`, hook) glyphs/colours are provisional
until the owner approves the visual extension; neither replaces a D-08 glyph.
**Status: technical implementation proposed; new region visuals require approval.**
_(renumbered from D-19 during integration, branch `origin/task/05-cities-data`)_

## D-21 — Build-time RLE raster from Natural Earth land 50m (2026-11-02, task 03)
Generate `public/data/land-50m.json` using `scripts/build-land.mjs` at
build time, using the already pinned `world-atlas@2.0.2` Natural Earth 50m
land TopoJSON (ISC/public domain). Raster is equirectangular 2048×1024,
row-oriented land runs; the browser only decodes it and computes a small
coastal smoothing field once. The flat-shaded terrain mesh subdivides triangles
only around coasts, with explicit `low/medium/high` levels.
**Rationale:** no TopoJSON/d3 dependency in the mobile runtime, predictable
startup and bundle size, fine coast sampling without copying the stage-0
over-tessellated mesh. The build script corrects South Pole scanline closure.
**Status: implementation decision for task 03, owner may revise.**
_(renumbered from D-19 during integration, branch `origin/task/03-globe-renderer`)_

## D-22 — Airport and passenger tags are view-only pooled layers (2026-11-02, task 06)
Airport meshes use shared geometries and InstancedMesh per model component, with one
instanced capacity segment per hub seat. Passenger bubbles and edge markers are
created once per city, updated from read-only snapshots, and projected without DOM
creation in the render loop. Collision resolution prioritizes jammed hubs, moves
tags upward, then hides a tag that cannot fit without overlap. The 30-city fixture
is temporary until tasks 03 and 05 merge. **Status: in force for task 06.**
_(renumbered from D-19 during integration, branch `origin/task/06-airports-overlay`)_

## D-23 — Aircraft-driven passenger transfers with cached regional routing (2026-11-02, task 08)
The passenger model generates regional tickets from a dedicated seeded `demand` stream. Each passenger
stores only its destination region and the current incoming route; a route cache is recomputed only
when the network changes, minimizing transfers before total precomputed kilometres.
Aircraft call `boardAt` and `alightAt` at deterministic stops, while transfer queues enforce a global
25-tick minimum connection time. Ordinary cities have smaller queues, and a sustained full queue
fails after 450 simulation ticks; clearing the jam resets its countdown. These are versioned
defaults that may be balanced after integration with aircraft, not independent scheduling.
**Rationale:** deterministic replay, precise capacity failures, and a narrow adapter between
passengers, the task-02 command kernel and task-09 aircraft. **Status: proposed pending integration.**
_(renumbered from D-19 during integration, branch `origin/task/08-sim-passengers-hubs`)_

## D-24 — Integer route legs and guarded plane lifecycle (2026-11-02, task 09)
At route creation, resolve each city pair through task 05's precomputed integer-
kilometre table and store both aircraft types' integer travel durations. The
scheduler never recalculates geographic distances and uses 10,000 units for
renderer-facing progress. Aircraft traverse waypoints in both directions, allow
at least 25 ticks of ground service, and board after the dwell window. Task 08
provides the passenger adapter; task 02 wires the command bridge. To prevent
passenger loss, unassignment is refused in flight or with passengers aboard;
route deletion must refuse routes with assigned aircraft. Initial reserve is
**provisionally** 2 turboprops and 0 widebodies pending owner confirmation.
**Rationale:** deterministic replay, conservation, and parallel-task integration.
**Status: technical choice in task 09; initial reserve subject to balance review.**
_(renumbered from D-19 during integration, branch `origin/task/09-sim-planes`)_

## D-25 — Route-edit adapter contract (2026-11-02, task 07)
Until tasks 04/06/08 are merged, the finger editor communicates through ports for projected city hit tests, integer intercity distances, read-only route snapshots, command dispatch, undo, and native haptics. `AddRoute` and `ExtendRoute` carry ordered city IDs and integer per-leg distances; all authoritative network edits remain simulation commands, with great-circle trigonometry restricted to input/render. `ShortenRoute` is an adapter intent awaiting mapping to the final simulation network schema. The game composition root will connect these ports after the dependency tasks arrive. **Rationale:** keep the simulation pure (D-13), allow parallel PRs, and avoid inventing ownership of upstream modules. **Status: provisional, validate on integration.**
_(renumbered from D-19 during integration, branch `origin/task/07-route-drawing`)_

## D-26 — Batched in-world routes and instanced aircraft (2026-11-02, task 10)
Route tubes are prebuilt from visual-only great-circle interpolation when a network revision changes, batched into one visible and one ghost pass per aircraft type. The different route types remain distinguishable by altitude and continuity as well as colour. Aircraft meshes use three instanced material passes per class, with shared instance passes for shadows, contrails and occupancy tags; no geometry or objects are allocated in the animation frame loop. Render snapshots take the task-09 fixed-point `progress01` scale (10,000) and interpolate cumulative route distance to avoid discontinuity at intermediate cities. This does not change the authoritative simulation or introduce trigonometry into `src/sim`.
**Status: provisional technical implementation; real device profiling and screenshots depend on task 03 and task 09 integration.**
_(renumbered from D-20 during integration, branch `origin/task/10-render-routes-planes`)_

## D-27 — Deterministic day/night and curfew adapters (2026-11-02, task 11)
One UTC game day is 1,440 integer-minute ticks. City clock offsets are fixed whole hours derived from geographic longitude, without real time-zone or DST rules. The local 24-entry demand table is shared with task 08. The November-only subsolar latitude is -18.5 degrees; trigonometry and fractional-tick interpolation belong exclusively to the renderer. Endless curfew begins in week 4, selecting a sorted seeded subset of active cities from a dedicated `Rng.fork('daynight/curfew/week/N')`; puzzle curfew is an explicit level feature. The closure interval is local 23:00–06:00. A versioned curfew snapshot retains the cities eligible at the weekly boundary so later city spawns cannot change past selections. Rationale: deterministic replay without any browser clock or simulation transcendental functions. **Status: technical adapter pending integration of tasks 02/03/05/06/08/09; city-count balance remains tunable.**
_(renumbered from D-19 during integration, branch `origin/task/11-day-night`)_

## D-28 — Weekly departure slot upgrade contract (2026-11-02, task 12)
Departure slots are a **per-city per-simulated-hour departure limit**, not an aircraft
or runway count. The +2 upgrade increases the available departure allowance by two
through the authoritative simulation adapter. The host scheduler must enforce the
limit using integer elapsed simulation ticks, preserving the deterministic replay log.
The default baseline limit and whether the bonus applies globally or to one selected
city need owner confirmation before activating the upgrade in the game.
Until then, the UI and offer generator remain adapter-only and must not silently
modify a scheduler. **Status: provisional, requires integration decision.**
_Task 32: superseded by D-41/D-46 (enforced; base 2/3 per hour, +2 for one picked airport)._
_(renumbered from D-20 during integration, branch `origin/task/12-weekly-upgrade`)_

## D-29 — Versioned saves and background freeze (2026-11-02, task 16)
The v1 save envelope stores a serializable simulation snapshot, initial seed, simulated tick, parameter version,
ordered command log, and state hash. v0 records migrate on read. Browser persistence uses IndexedDB;
native persistence writes the alternate Filesystem/Data file before committing a Preferences pointer,
so an interrupted write does not replace the previous save. Player settings use separate `aw-settings-v1`.
Backgrounding pauses the wall-clock scheduler before saving rather than submitting a simulation speed command,
which avoids changing deterministic replay state. **Status: provisional; requires task 02/08/09 integration.**
_(renumbered from D-19 during integration, branch `origin/task/16-save-lifecycle`)_

## D-30 — Event-driven hub audio is bounded and non-authoritative (2026-11-02, task 19)
The presentation layer maps read-only simulation events to latitude-tuned pentatonic
Web Audio resonators. A 125 ms lookahead queue is capped at 20 transient voices
(with four effect-reserved slots) plus four congestion drones. It never reads or
writes simulation RNG or state. Default iOS audio session is `ambient`; playback
through the silent switch requires explicit player opt-in. **Rationale:** stable
4x behavior, predictable audio CPU use and user-controlled sound. **Status:
implementation awaiting event wiring and physical-device audio checks.**
_(renumbered from D-19 during integration, branch `origin/task/19-audio`)_

## D-31 — Accessibility presentation adapters (2026-11-02, task 20)
Destination identity remains the six Diorama silhouettes, with the fixed six-colour palette
verified against full-severity Machado (2009) protan/deutan/tritan simulation using CIE76
(minimum 15). UI text uses WCAG contrast-tested tokens (minimum 4.5:1).
Shared `airway.settings` stores text scale (100/115/130%), enhanced glyph outlines, and
haptics preference alongside the existing language selection. Native haptic events are
presentation-only and optional. Screen-reader announcements fire only on selection,
not on simulation ticks. Until tasks 06 and 13 merge, adapters are exported but cannot
be connected to their absent elements. **Status: technical implementation in task 20.**
_(renumbered from D-19 during integration, branch `origin/task/20-accessibility`)_

## D-32 — Task-17 puzzles use an isolated deterministic adapter before the sim merge (2026-11-02, task 17)
Tasks 07, 08, 09 and 12 are not yet merged into `dev`, so 15 versioned puzzle records
are playable against a strictly deterministic command/replay adapter in
`src/game/modes/puzzle.ts`. The adapter includes only the puzzle-specific traffic,
route, curfew and hub-capacity mechanics needed to prove solvability; it is **not**
the authoritative Endless simulation and does not model physical aircraft rotation.
When the dependencies merge, replace its tick implementation with calls to the
`src/sim` kernel while retaining the JSON records, command log, objective checks,
undo and fixed-seed reference tests. **Status: provisional integration decision.**
_(renumbered from D-19 during integration, branch `origin/task/17-puzzle-mode`)_

## D-33 — Shared quality profile and render-only pacing (2026-11-02, task 21)
An automatic low/medium/high quality tier uses browser hardware hints; users may
explicitly override it. Rendering is capped at 30 FPS while idle, runs every
available animation frame during interaction, and stops when the document is
hidden. The simulation clock stays independent. DPR never exceeds 2 and
shadows are reserved for high quality. Until tasks 03/06/10/11 land, use a
clearly labelled synthetic fixture; never treat SwiftShader as device evidence.
**Rationale:** predictable CPU/GPU load, energy use and an honest test contract
before all rendering components exist. **Status: provisional integration policy.**
_(renumbered from D-19 during integration, branch `origin/task/21-performance`)_

## D-34 — Separate onboarding choreography from live game adapters (2026-11-02, task 23)
The tutorial is an event-validated step controller with a versioned `aw-tutorial` first-run
setting (resume/skip/complete/replay). A deterministic three-city demo port and procedural
SVG flight-school scene are **temporary adapters** because tasks 07, 12 and 13 are not yet
merged; they do not write to `src/sim` or claim to represent real game simulation.
The composition root can inject a live `TutorialPort` once the authoritative route, aircraft,
transfer, dawn and upgrade APIs land. The port pauses authoritative ticks until each expected
action has been accepted. **Rationale:** prevent fabricated game state and parallel-task conflicts.
**Status: provisional integration decision; replace demo port after dependencies merge.**
_(renumbered from D-19 during integration, branch `origin/task/23-onboarding`)_

## D-35 — Android native build baseline (2026-11-02, task 24)
Capacitor 8.5.3 targets Android API 36 (minimum 24) and Java 21. The activity remains
resizable and orientation-unlocked; Android 15+ draws edge-to-edge, and the host
forwards Back through the `airway:android-back` event. The menu/lifecycle task owns
its handling policy. Android launcher/splash PNGs are built from original committed
SVGs on demand. Release APK/AAB signing requires a keystore stored outside Git and
supplied exclusively via environment variables.
**Rationale:** minimal native surface and permissions, repeatable source graphics,
foldable compatibility and separation of signing secrets. Physical device behaviour
is pending verification on Android hardware. **Status: task-24 technical baseline.**
_(renumbered from D-19 during integration, branch `origin/task/24-android-build`)_

## D-36 — iOS uses CocoaPods for Capacitor 8.5.3 (2026-11-02, task 25)
The native iOS project uses the official Capacitor 8.5.3 `ios-pods-template` with
CocoaPods, a shared Xcode workspace and iOS 15.0 as the minimum version. Capacitor 8's
default is SPM, but task 25 explicitly requires CocoaPods documentation and integration.
The AppDelegate configures an ambient audio session to honor the hardware silent switch.
**Rationale:** native dependency management matches the requested iOS build workflow.
**Status: in force for task 25.**
_(renumbered from D-20 during integration, branch `origin/task/25-ios-build`)_

## D-37 — E2E tests must not silently pass on missing gameplay (2026-11-02, task 28)
The production smoke suite fails when its real `AwDevAdapter` has not been
registered. The optional standalone contract fixture is isolated under
`e2e/fixtures` and reports `mode=fixture` in test summaries. `window.aw`
is added only in development with a dynamic import and forwards commands to
the real game instead of retaining a shadow simulation. **Rationale:** missing
dependencies must never yield false-green gameplay QA; the same harness can
be connected when the UI and persistence work merges. **Status: in force.**
_(renumbered from D-19 during integration, branch `origin/task/28-e2e-smoke`)_

## D-38 — One kernel owns the whole world; puzzles run on it (2026-11-02, integration/sim)
`Sim` (task 02) is the only simulation. `src/sim/world.ts` composes spawner (05), passengers/
network/routing/hubs/ledger (08), aircraft (09), curfew (11) and weekly upgrades (12); the world
snapshot is part of the hashed state, checkpoints and saves (snapshot v2, rules v2). The kernel
owns all RNG stream states (cities, demand, upgrades); subsystems receive the streams. Commands
are validated at the tick and rejections are journaled. Puzzle levels became Sim scenarios
(D-32 completed); HND was replaced by the dataset city TYO, some waiting capacities raised and
goal targets set to 80% of the real-sim reference result (`docs/balance/puzzles-real-sim.csv`).
Hub upgrades follow task 12 (+6 seats, MCT 15). Departure slots (D-28) are recorded only, not
enforced. **Status: in force for integration; puzzle content needs task-17/owner review.**

## D-39 — Mixed-region start and first balance pass (2026-11-02, integration/sim)
Passengers only travel to other regions (task 08), so the seeded start cluster now always contains
the anchor plus its nearest foreign-region city (amends D-20). Balance pass in `params.ts` (spawn
12 h, demand 1/M/day, capacities 30/20, 4 turboprops) gives a bot median of 10.1 min at 1x on 50
seeds (`docs/balance/`). **Status: provisional; the weekly time scale vs 8–15 min session needs
an owner decision.** _Task 31: the time scale was decided by D-40; the spawn interval and capacities were
re-tuned in D-43 (16 h, 36/24) — 50-seed bot median 12.92 min._


## D-40 — A game week lasts 3 in-game days (2026-11-02, owner)
With 7-day weeks the bot survived week 1 on ~5% of seeds, so players would almost never see the weekly upgrade. The cycle
keeps its name ("week" / "Tydzień") but is 3 days long, so the first choice lands around minutes 4–5 of a run. Curfew still
starts in week 4 (D-17), i.e. on day 10. Implemented by task 31. **Status: in force.**
_Task 31 numbers (50 bot seeds from 0xA1A1, `docs/balance/`): a 3-day week lasts 7.2 real minutes at 1× (not 4–5:
one tick is one game minute at 10 ticks/s), so the first board opens at 7.2 min and the second at 14.4 min. Bot reaching
the 1st / 2nd upgrade: 7-day week 6 % / 0 %; 3-day week alone 68 % / 12 %; with the D-43 rebalance 86 % / 44 %,
median session 12.92 min._

## D-41 — Departure slots are enforced (2026-11-02, owner)
The per-city hourly departure limit (D-28) blocks departures: planes wait on the ground for a free slot, and the "+2 slots"
upgrade is a real choice. Implemented by task 32. **Status: in force.**

## D-42 — Visual polish and real store screenshots go through a second task pack (2026-11-02, owner)
Tasks 31–36 in `docs/tasks/` (wave P). Same workflow as D-14: `task/NN-slug` from `dev`, draft PR to `dev`.
**Status: in force.**

## D-43 — One week-length source and the 3-day-week rebalance (2026-11-02, task 31)
`SIM_DAYS_PER_WEEK = 3` in `src/sim/params.ts` is the only definition of the week; `TICKS_PER_WEEK`, `DAYS_PER_WEEK`
(clock, upgrades, sim facade), `DAYNIGHT_MINUTES_PER_WEEK`, the HUD day bar, save/daily week counts and the balance
report derive from it (`npm run test:week-source`). The boarding pass shows the day as "N/3" with 3 squares, since
weekday names do not fit a 3-day week. Rebalance: `SPAWNER_INTERVAL_HOURS` 12 → 16, waiting capacities hub/city
30/20 → 36/24; bot (rules unchanged) median 12.92 min at 1×, 86 % of seeds reach the 1st upgrade and 44 % the 2nd
(`docs/balance/README.md`). `test:balance` gates the median and both shares on all 50 seeds. `RULES_VERSION` 2 → 3,
so saves from 7-day builds are rejected. Puzzles are unaffected (no weekly upgrades). **Status: in force;
the "N/3" day label and the balance values await owner review.**

## D-44 — Adaptive, crack-free globe terrain with hand-entered relief (2026-11-02, task 33)
The globe mesh is an icosphere refined **per edge** (an edge splits when either end or its midpoint
asks for more detail, so the two facets sharing it always agree: no T-junction cracks). Coasts,
mountain ranges and the pack-ice edge get the full depth, other land one level less, the open sea
stays coarse and is coloured per vertex (smooth depth gradient); land facets keep one flat colour.
Coast vertices snap onto the zero level of a signed-distance field (chamfer on the Natural Earth
raster, bilinear), which removes the raster "teeth". Mountains come from ~45 hand-typed ridge lines
(`src/render/globe/relief.ts`), deserts from superellipse regions; biome colours are smooth weights,
not thresholds (no terraces). Terrain is flattened under every dataset city so airport pads (1.0055)
never sink. Cloud shadows are a sun-projected instanced blob (works without shadow maps; clouds no
longer cast map shadows in `high`). Presets (terrain triangles): low 35k, medium 200k, high 279k;
budgets and measurements in `docs/PERFORMANCE.md`. **Status: in force; medium density is an
owner-visible trade-off (see the task-33 PR questions).**

## D-45 — Upgrade labels read their numbers from the sim; hub pick keeps only the sign (2026-11-02, task 35)
The weekly cargo labels (mockup `upgrade-*.png`) show range/seats from `PLANE_TYPES` and the effect of each upgrade
(+seats, transfer minutes, +slots) read back by a dry run of `chooseUpgrade()` on throwaway adapters — the same probe the
kernel uses to validate the command — so balance changes in `src/sim` reach the UI without copy edits. The red context
stamp appears only on the label it is about (hub expansion: busiest hub `CODE waiting/capacity`); the hub label is disabled
when no hub exists. While the player picks a hub, only the yellow sign stays (below the boarding pass) and the globe is
undimmed. The "+2 slots" label (task 32) already has its model and field set; it gains a stamp once the sim reports which
airport waits for slots. **Status: in force.**

## D-46 — Departure-slot rules: hourly allowance, queue order, targeted "+2 slots" (2026-11-02, task 32)
Implements D-41 and closes D-28. A slot is one departure from one airport in one UTC game hour
(`floor(minute / 60)`); the counters reset at every hour. Base allowance `DEPARTURE_SLOTS_PER_HOUR_CITY = 2`,
`DEPARTURE_SLOTS_PER_HOUR_HUB = 3` (`src/sim/params.ts`, bot sweep in `docs/balance/README.md`: 4/6 never binds).
An aircraft that finished its 25-min service and passes the curfew check takes a slot or waits on the ground
(`slotWaitTicks`); passengers still board only at departure. Order is first ready, first out: held aircraft go
first by longest wait, equal waits and newly ready aircraft by fleet order (= plane serial). "+2 slots"
(`DEPARTURE_SLOT_UPGRADE`) applies to **one airport the player picks** on the globe, with the same two-step
`ChooseUpgrade` as the hub expansion (`hubId` carries the target airport; any active city is valid). The world
reports per-airport allowance, used slots, held aircraft and minutes to the next slot (`CityView`), the
slot-wait aircraft-minutes in the hub cause ledger ("aircraft waited for a slot" on the game-over report) and a
`DepartureHeld` event, which opens a one-time ATC strip (training step "SLOTS 07", not part of the first-run
vignette). `RULES_VERSION` 3 → 4 (aircraft and world snapshots carry slot state). **Status: in force; the base
allowance and the per-airport (not global) bonus await owner review.**

## D-47 — Readable night and layout-measured camera framing (2026-11-02, task 34)
Night: an anti-solar "moon" light (cool, 0.6 vs sun 3.2, no shadows) plus a colour grade on the world's lit
materials only (`src/render/globe/daynight.ts`: cool palette where the sun is below the horizon, a soft warm band
±0.16 around the terminator). Gameplay layers are lighting-independent: routes, airports and planes carry an
emissive copy of their colour (routes 0.72, airports/planes 0.5) and plane shadows fade out at night. No bloom,
no post-processing. Measured on the real game at local midnight (`npm run shots:34`): routes 9.4:1, airports 8.6:1,
planes 9.9:1, luggage tags ≥ 11.6:1 against the globe behind them (threshold 4.5:1). Framing: camera insets are the
larger of the caller's safe-area insets and the measured boxes of the boarding pass and tag dock (each box goes to
the edge where it costs least free area), so landscape keeps the globe clear of the right rail. The menu follows
the mockups: portrait = a globe wider than the phone with its horizon 18 % below the sign and a still camera over a
small decorative network (routes, hubs, moving planes; visual only, cleared when a run starts); landscape = the whole
disc beside the departures board. **Status: in force; the menu network content and the night brightness are
owner-visible choices (task-34 PR questions).**

## D-48 — Store screenshots are played by the autoplay bot and lit by the sun angle (2026-11-02, task 36)
Store scenes (`?storeShot`, DEV only) run the real game on seed 0xA1A1 and let the DEV autoplay bot play about one
game day through real Commands before the shot, so the stores show a grown network. Dusk and night are chosen by the
sun's hour angle over the camera centre (−95° and 180°, the `sun.ts` formula used by task 34), not by the home-airport
clock. The failure scene stops building and lets real demand jam a hub. Every PNG is checked automatically (size,
blank/white, developer text, only the six D-08 passenger glyphs, which also keeps the provisional Asia/Oceania glyphs
out of store images) and recorded in `docs/store/shots/manifest.json`. **Status: in force.**


## D-49 — Back from the airport pick, framed first menu frame, darker night deserts (2026-11-02, task 39)
**Back from the pick.** A targeted weekly upgrade (hub expansion, "+2 slots") is two `ChooseUpgrade` commands; between
them the player can now go back with a new sim command `CancelUpgradePick {week}`. It is journaled and replayed like
every command, needs a pending pick of that week (otherwise `UPGRADE_INVALID`, or `NO_UPGRADE_PENDING` without a
board), and restores exactly the offer the board had before the label was taken (`pendingHub: false`, no
`selected`), so pick → back → another label ends in the same world as taking that label directly (`test:replay`).
The snapshot shape is unchanged, so `RULES_VERSION` stays 4 (old saves never contain the command). UI: a black
wayfinding tile with a yellow arrow and "Wróć"/"Back" set into the yellow pick sign (≥ 48 dp); Android back / Escape
on the pick does the same. **Menu first frame:** the frame loop applies a pending layout measurement before it
draws, and the first menu show holds the globe (≤ 1.5 s) until the sign and board are laid out, so the first
rendered menu frame already has its final framing (`shots:34` checks it). **Night deserts:** warm, bright albedo
(desert, beach sand; linear `r − b` mask 0.25 → 0.45) gets an extra night grade ×(0.60, 0.56, 0.48) on top of the
D-47 moon grade: darker and no longer blue-grey; moon light (0.6) unchanged. Night contrast after the change
(shots:34): routes 9.65, airports 9.0, planes 10.2, tags ≥ 12.3 (threshold 4.5). **Status: in force; the Back
tile position (top sign, outside thumb reach in portrait) is an owner question in the task-39 PR.**

## D-50 — Departure-slot tag hangs under the passenger tag (2026-11-02, task 38)
While aircraft are held for a departure slot (D-46), the airport shows a second luggage tag "SLOT h:mm" — game time to the
next free slot, from `CityView.nextSlotMinutes` — plus "×N" only when two or more aircraft wait. Shape, not colour, tells
it from the passenger tag: a squared ticket with a dark stub carrying a clock-over-runway-bar mark (inline SVG), ink outline
and chamfered right end, against the pointed passenger tag with its punched hole. Placement is deterministic: the
passenger tag and the slot tag form **one layout box** for `layoutTags` (passenger tag on top, slot tag 2 px below,
left-aligned, i.e. nearest the apron where the aircraft stand), so no other airport's tag can slide between them; with
nobody waiting the slot tag fills the box alone. The tag has no countdown animation and disappears as soon as nothing is
held. Readability: the paper body reaches ≥ 4.81:1 by day and ≥ 14.8:1 at night against the globe behind it
(`npm run shots:38`); ink on paper inside the tag is 12.7:1. **Status: in force; the tag's wording ("SLOT" in both
languages) is an owner-visible choice (task-38 PR question).**

<!-- Owner decisions below use D-60+ so they cannot collide with D-49… taken by the parallel task-37…40 session. -->

## D-51 — Player text never breaks inside a word without a hyphen (2026-11-02, task 37)
UI text must not use `overflow-wrap:anywhere` / `word-break` (they produced "Szerokokadłubowie / c" on the 360 px
store phone). Browser `hyphens:auto` is not relied on: its dictionaries are missing in some WebViews and headless
Chromium. Instead long single words carry soft hyphens (U+00AD) in the i18n catalogue ("Szeroko\u00ADkadłubowiec"),
and the upgrade-label title shrinks to fit its longest word (container query, down to 15 px) before the soft hyphen
is needed. Overpass ships the middle dot U+00B7 with a zero advance, so Overpass text borrows the dot from
Atkinson Hyperlegible Next via `unicode-range` (same OFL files) and " · " is symmetric. `npm run test:hud-targets`
checks menu, upgrade labels and game over in PL/EN at 360–915 px for bare mid-word breaks, header gaps ≥ 8 px and
dot symmetry. **Status: in force.**

## D-60 — First weekly upgrade at ~7.2 min is accepted (2026-11-02, owner)
Keeps 1 tick = 1 game minute and the D-43 balance (median 12.9 min, 86% / 44%). Supersedes the "4–5 min" estimate in D-40.
**Status: in force.**

## D-61 — Polish number format uses a space from four digits: "2 500 km" (2026-11-02, owner)
Player-facing numbers in PL group thousands from 4 digits (as in the mockups), unlike `Intl` pl-PL's default (5 digits).
One formatter in `src/core/format` / i18n helpers; EN unchanged ("2,500"). **Status: in force (task 37)** — `formatNumber()`
in `src/core/format.ts`, `localNumber()` in `src/i18n`; `t()` formats every numeric parameter with it; separator = the no-break
space Intl uses for five digits; tested by `npm run test:format`.

## D-62 — Menu globe rotates slowly (2026-11-02, owner)
About 1.2°/s, paused with `prefers-reduced-motion` and while the menu is hidden. **Status: in force (task 39).**

## D-63 — Store screenshot order: night, game, upgrade, failure, menu; dusk must read as dusk (2026-11-02, owner)
The "game" scene uses clearly golden low-sun light (not daylight). Implemented in task 40: the scene `game-dusk` is
renamed `game`; `SCENES`, contact-sheet columns, manifest order (checked by `--validate`) and the captions in
`docs/store/{pl,en}.md` follow the new order. The fixture puts the sun at elevation 0.05 (daynight.ts units) over the
network centroid in the evening instead of a fixed −95° from the camera centre (which left the network past the
terminator); `test:store-shots` requires a golden-pixel share ≥ 0.045 on the `game` globe and D-47 contrast ≥ 4.5:1
in `game` and `night`. **Status: in force (task 40); a stronger warm band in `daynight.ts` is proposed for the
render owner (task-40 PR).**

## D-64 — `main` follows green `dev` (2026-11-02, owner)
`dev` stays the integration branch for all task PRs. The coordinator regularly fast-forwards `main` to `dev` after the
full gate passes on `dev` (`test:fast`, `build`, `test:e2e:smoke`). Nobody commits to `main` directly. `main` is the
GitHub default branch. **Status: in force.**

## D-65 — Overnight continuous development by one coordinator agent (2026-11-03, owner)
Scope chosen by the owner: low-end performance, 15 new puzzles, audio and music, code quality and tests. Work queue and
log in `docs/NIGHT-BACKLOG.md`. **Status: in force.**

## D-66 — Online leaderboards are in the MVP (2026-11-03, owner)
Daily-challenge and weekly leaderboards on Firebase (pattern: cebulak-express `src/net/*`, server-side replay
validation). Until the owner provides a Firebase project the feature is built against the emulator and is disabled
when no config is present; privacy policy must be updated before release. Supersedes "post-MVP" in RESEARCH §5 and
task 18's note. **Status: in force (implemented in night N6, D-72; open owner questions Q-01…Q-07 in
`docs/OWNER-QUESTIONS.md`).**

## D-67 — airway.games site is not published yet (2026-11-03, owner)
Publish together with the store pre-registration, after the device test. **Status: in force.**

## D-68 — Hub stamp shows code or city name per player setting (2026-11-03, owner)
Settings toggle "Lotniska: kod / nazwa" (default: code). Applies to hub stamp and other airport labels that have room.
**Status: in force (night N5).** Implemented in `src/ui/airportLabel.ts` (setting `airportLabels` in `airway.settings`):
the weekly card's hub and slot stamps, the hub/airport pick pressure labels and the game-over departures title use the
PL/EN city name from `src/data/cities.ts`; the 58 px off-screen edge chips keep the code (no room). Long names wrap
at spaces inside the stamp.

## D-70 — Puzzles 16–30: mechanics tags and a tighter margin curve (2026-11-03, Claude, night N1)
Puzzles 16–30 carry an optional `mechanics` list (`slots`, `curfew`, `week`, `mct`, `transfer`); the briefing shows the
non-obvious ones and `test:puzzles` proves every tag on the reference run (a slot wait, a curfew airport, a wave that
starts in the second 3-day week, a hub expansion, a demand that needs a transfer). Targets are the reference result
divided by 1 + margin, the margin falling from 25 % (16) to 17 % (29–30), so later levels need a near-best network.
Several levels offer decoy strips (a curfewed hub, a five-spoke star that jams on slots). Data format stays version 1.
**Status: in force; difficulty is a proposal for the owner to playtest.**

## D-71 — Resonant hubs: region scales, tension, cadence, mix and limiter (2026-11-03, Claude, night N3)
Each destination region plays its own rotation of one pentatonic collection (`REGION_SCALES`), so every hub stays
consonant while regions sound different. `src/game/audioCues.ts` feeds the engine: graded hub load once per game hour
(top 4 hubs drone, a calmed hub is released), dawn blooms when a hub reaches 06:00 local (max 2 per hour), a
dominant→tonic cadence on the week turn (key moves a fifth), a two-tick "slot wait" effect (once per airport per hour),
and tag / paper / stamp for route add, route removal and upgrade choice. Mix: bus gains and make-up gain into the
glue compressor, then a −3 dB limiter and trim; previews peak −7…−9 dBFS and a 4x burst stays under −1 dBFS.
Previews in `docs/audio/`. **Status: in force; sound character is a proposal until the owner listens on a phone.**

_N7e:_ the split-flap boards (menu, puzzles, game over, ranking) now rattle when they flip: one merged rattle per
board, at most 8 clicks 45 ms apart; silent under reduced motion (no flip) and with Sound off.

## D-72 — Leaderboard client: journal submissions, server replay, no Firebase SDK (2026-11-03, Claude, night N6)
Implements D-66 on the client side. Only the **official** daily run (one per Warsaw day) is submitted: seed, day key,
rules version, end tick, claimed score and the full command journal. The server replays it with the same Sim
(`src/net/submission.ts`, shared code, D-13) and stores the replayed score; a mismatch, wrong seed/day, older rules,
unfinished run or a run longer than 30 game weeks is rejected. The client talks to Firebase over REST (anonymous
Identity Toolkit sign-up, callable functions) so the bundle carries no Firebase SDK; without `VITE_FIREBASE_API_KEY`
and `VITE_FIREBASE_PROJECT_ID` the feature is off and makes no request. Finished runs wait in a bounded local queue
(one per day, backoff) until the server answers. Players appear under a call sign derived from the anonymous uid, no
names or e-mail. **Status: in force (client, server N6b, UI N6c).**
_N6b:_ server in `functions/` — first accepted run per player and Warsaw day counts; the weekly board is the **sum** of a
player's accepted daily scores in the ISO week (proposal for the owner; alternative: best single day). Accepted days
are today and yesterday (late finishes, offline queue). Firestore is closed to clients. Owner steps: `docs/FIREBASE.md`.
_N6c:_ the official daily game-over screen shows a second split-flap board "Ranking · date" (today / this week, top 3
+ own rank, call sign marked "Ty/You"), or a status line: sending, offline-queued, rejected, practice run (not ranked).
Without Firebase config nothing is shown. Queued runs are retried at app start. A daily run resumed from a save is not
submitted (known gap, the journal is complete, so it can be added later).
_N7a:_ fixed — the daily run being played is remembered next to the scores (`aw-daily-active-v1`: day, kind,
attempt). A daily restored from the save slot stays **official** only if it is that day's open official attempt
(same day/seed/attempt, no result yet; today or yesterday), otherwise it continues as practice; its game over then
records the result and submits it like an uninterrupted run.

## D-73 — Globe LOD, battery saver and adaptive quality (2026-11-03, Claude, night N4)
The terrain is drawn in chunks culled by a conservative horizon test and the frustum (merged into ≤ 16
draw runs), and `medium`/`high` carry a coarser far level chosen by on-screen facet size (far below
4.5 device px, near above 5.5 px), so the zoomed-out globe never pays for sub-pixel coastlines; the
low preset keeps one level. A new graphics option **Battery saver** (PL "Oszczędna") (`saver`: low terrain, DPR 1,
no shadows, 60 % decorations, 30 fps cap) sits next to Automatic. `auto` steps down by itself when
frames stay under 24 fps (DPR → decorations → terrain), never back up within a session, and never
under automation. Budgets and before/after numbers in `docs/PERFORMANCE.md`.
**Status: in force; the saver look and the 24 fps trigger are proposals until measured on a low-end
Android phone.**


## D-74 — Adaptive quality is remembered between sessions (2026-11-03, Claude, night N7b)
With graphics on **Automatic**, the steps the adaptive monitor takes (D-73: DPR → decorations → terrain) are stored
in `airway.adaptiveQuality` (`{v:1, steps, at}`) and applied before the first frame of the next launch, so a slow
phone does not stutter through the same ~8 s of detection every time; the monitor then only offers the remaining
steps. The record is ignored when it is not a prefix of the device's current ladder, malformed, or older than
**30 days** (new OS/game version may be faster: detect afresh), and any explicit graphics choice in settings —
including picking Automatic again — forgets it. Nothing is shown to the player. Rationale: a downgrade costs
seconds of bad frames every session; never stepping back up within a session (D-73) already accepts that the
downgrade is sticky. **Status: in force; the 30-day window is a proposal for the owner.**

## D-75 — Trees and rocks are culled per chunk (2026-11-03, Claude, night N7f)
Trees and rocks were one instanced draw each over the whole globe, so about half were drawn behind the planet. Their
instances are now sorted into the terrain's spatial chunks (D-73) and, when the set of visible chunks or the density
changes, the visible chunks are packed to the front of the instance buffer: still **one draw call per mesh**, an
upload only when a chunk enters or leaves the view. Thinning (battery saver, adaptive quality) takes the same share
of every chunk. Rejected: one instanced mesh per chunk (~20 more draw calls, over the ≤ 50 budget). The rendered
image is pixel-identical (`dev/world.html` shots); `test:quality` proves no visible tree or rock is dropped.
**Status: in force.**

## D-76 — A save from older sim rules is replayed, not dropped (2026-11-03, Claude, night N7k)
Until now any change of `RULES_VERSION` (every balance or rules update) silently threw the player's saved flight
away: "Continue" disappeared without a word. The save keeps the seed and the full command journal (D-13, D-72), so
`restoreSimDetailed()` in `src/game/save.ts` now re-simulates such a save under the current rules to the saved tick
(`Sim.replay`, the same path the leaderboard server uses, so a resumed official daily is scored consistently) and
`loadSavedSim()` writes the result back once, so later launches restore directly. The outcome can differ from the
old build; a run the new rules already end is not offered, and neither is a save from newer rules, a replay longer
than 30 game weeks (~1–2 s on desktop) or a current-rules save whose state hash fails (corruption is never "fixed"
by replay). Commands queued in the saved tick are kept. Rejected: a per-version snapshot migration (one adapter per
rules change, easy to get wrong); dropping the save (status quo). **Status: in force.**

## D-77 — Leaderboard retention 90 days, deletion by e-mail (2026-11-03, owner, Q-02)
Firestore TTL deletes leaderboard entries after 90 days; deletion requests by e-mail (address in the privacy policy). An in-game
"delete my entry" button comes after release. **Status: implemented (N9a: `expireAt` + TTL policy in `firestore.indexes.json`, `docs/FIREBASE.md` steps 8–9, privacy draft).**

## D-78 — Widebody week-1 strength stays until human playtest (2026-11-03, owner, Q-35)
No parameter change now; revisit if testers always pick WB-300. **Status: in force.**

## D-79 — Bot session-length target is 10–18 min (2026-11-03, owner, Q-36)
`test:balance` gate changes from 8–15 to 10–18 min median (the target measures the bot, not a human). Supersedes the range in
D-40/D-43. **Status: implemented (N9b, `scripts/balance-report.ts`; median 14.55 min).**

## D-80 — Player picks their airline colour (2026-11-03, owner, Q-26)
A CVD-checked palette in settings; plane tail fin and livery accents use the airline colour. Separate task. **Status: partly implemented (N9c): palette `src/data/airline-colours.json` (CVD-checked by `test:cvd`), settings select, boarding pass band, render hook `onAirlineColour` in `src/ui/airlineColour.ts`; the tail fin/livery paint waits for M1 (#52, plane models) → N9d.**

## D-81 — Daily report shares the result; daily restart buttons keep their words (2026-11-03, Claude, night N10e)
The daily game-over report has a "Share result" action on the ATC strip: the native share sheet (@capacitor/share),
else the clipboard, else the text in a read-only box to select; a dismissed sheet copies nothing (consent). The text
stays offline (task 18): no score or replay leaves the device, no link until the owner approves the domain (Q-39).
The ticket is the regions the final network served, once each, in city opening order; ASI and OCE get the ticket
glyphs ⌒ and ⌐, provisional like their D-20 shapes (Q-38). An official run adds "STREAK N DAYS" from two days.
On a daily, "Same world" starts a practice of the same day's world (menu once the Warsaw day changed) and "New world"
starts Endless; both used to drop silently to the menu. Rationale: the share path existed since task 18 but was never
reachable, and a button must do what it says. **Status: in force (N10e, `test:e2e:daily-share`).**

## D-82 — Airline colour palette approved as is (2026-11-03, owner, Q-37)
The six colours of D-80 (navy default, sky blue, brick, ochre, rose, graphite; `src/data/airline-colours.json`, ΔE ≥ 15
under CVD via `test:cvd`) stay. Plane colours are judged once M1 (#52) paints the tail fin. **Status: in force.**

## D-83 — Share-ticket glyphs ⌒ and ⌐ for Asia and Oceania stay (2026-11-03, owner, Q-38)
The D-81 ticket glyphs stay; if the provisional ASI/OCE region glyphs change (Q-25), the ticket glyphs change with
them. **Status: in force.**

## D-84 — Shared daily result stays without a link (2026-11-03, owner, Q-39)
The share text keeps no link; `airway.games` is added once the domain and the landing page are ready (`docs/SITE.md`).
**Status: in force (no change now).**

## D-85 — Logbook entry stays half of the last menu board row (2026-11-03, owner, Q-40)
"SETTINGS D0 · LOGBOOK D1" keeps sharing the last split-flap row (option A of Q-40); no separate row, the logbook is not
moved into settings. **Status: in force.**

## D-90 — Balance bot plays for reach (2026-11-03, Claude, night N12a)
The DEV/balance bot (`src/game/dev/bot-policy.ts`) values the widebody on the weekly board like a turboprop-only
network needs it: +80 when the fleet owns no widebody or an active airport without a route lies beyond turboprop
range (2,500 km) of every other active airport (before, only an existing long route counted, which a turboprop-only
network never has, so the bot never took a widebody in 50 seeds). When no served airport is eligible for an unserved
one, it may pair two unserved airports with each other (a new network island). Rationale: 34 of 44 bot game overs
were at an airport no route served, 20 of them beyond turboprop reach — a measuring-stick fault, not game balance.
Now 7 of 40; `test:balance` median 14.55 → 17.81 min, 1st/2nd board 86/50 → 88/56 %. No game parameter changed;
the median now sits near the D-79 upper bound (Q-51). **Status: in force (N12a, `test:bot-policy`).**

## D-86 — Privacy policy inside the app, same text as the site (2026-11-03, Claude, night N11e)
Settings → Help gains a "Privacy policy / Polityka prywatności" row under the licences. It opens an in-app page
(router screen `privacy`, back → settings, the globe does not draw behind it) with the text of `site/privacy.html`:
title, the draft warning, its five sections and date, plus one line that the copy is stored in the game and opens
without a connection. The game catalogs hold a copy of the site's `privacy.*` strings; `test:privacy-text` fails when
they differ from `site/i18n.js`, so the site stays the one source. No public URL is shown until the site is published
(D-67); the leaderboard section waits for the owner (Q-56). Rationale: Google's User Data policy wants the policy
reachable inside the app (RESEARCH R1, R1b); an offline page works on every build and in every store review.
**Status: in force (N11e, `test:privacy-text`, `test:e2e:privacy-page`).**

## D-91 — iOS bundle declares export-exempt encryption and its languages (2026-11-03, Claude, night N12b)
`Info.plist` carries `ITSAppUsesNonExemptEncryption = false` and `CFBundleLocalizations = [en, pl]`. The game only
uses the system's HTTPS (WKWebView, Firebase over TLS), which Apple treats as exempt, so the key answers the
export-compliance question once instead of on every TestFlight upload; any own cryptography would reopen it. The
language list is what the App Store shows as the game's languages and what WKWebView may report in
`navigator.languages`; `test:ios-config` keeps it equal to the i18n catalogs (`src/i18n/<xx>.ts`, pseudo excluded),
so a third language cannot ship without the bundle knowing it. Rejected: answering the export question in App Store
Connect by hand per build (repetitive, easy to forget). **Status: in force (N12b, `test:ios-config` 23 checks).**

## D-92 — Backup carries the game to a new phone, not the leaderboard identity (2026-11-03, Claude, night N12c)
Android Auto Backup is on with include-only rules (`res/xml/data_extraction_rules.xml` for Android 12+ cloud backup
and device transfer, `res/xml/backup_rules.xml` for older versions): the Preferences file, the two save slots and the
WebView `localStorage` (logbook, streak, scores, settings, puzzle stars, tutorial). Before, `allowBackup="false"`
lost all of it on a phone change. The leaderboard session token and offline queue live in the same `localStorage`,
so instead of a file rule an install marker that no backup reaches (`aw-install-v1.json` in
`Directory.LibraryNoCloud`; on iOS `Library/NoCloud`) decides: no marker → write it, then remove `aw-net-session-v1`
and `aw-net-queue-v1` before the leaderboards start; a marker that cannot be written resets nothing. A restored phone
is a new anonymous player (Q-55); queued runs are not resent from a second device. Rejected: backing up everything
(identity copied to two phones), backing up only native files (logbook and streak still lost), moving the identity
into a separate store now (bigger net change; follow-up so the token is not in the encrypted backup at all).
**Status: in force (N12c, `test:android-config` 18 checks, `test:install-identity` 6 cases).**

## D-87 — One tip on the game-over report in the first ten flights (2026-11-03, Claude, night N11f)
The game-over report adds one line under the causes, "TIP / WSKAZÓWKA", chosen by the first ranked cause that has a
tip (`src/game/gameoverTip.ts`): full waiting area, long jam or long wait → "Expand hub" or a second hub; regional
demand → a route (or more aircraft) to that region; no route → give every region a route; seat shortage → a second
aircraft or a widebody; missed / not-ready transfer → "Expand hub" (it also shortens the minimum transfer time);
slot wait → "Departure slots" or move routes. It shows only while the logbook holds at most 10 flights (this one
included), never in puzzles, never during play, and not at an airport no route served (the N11b board hint already
says what would have helped). It sits in the causes tab panel, so Timeline hides it. On short screens (≤ 700 px
portrait phones, ≤ 550 px landscape) the tip keeps only the leading cause, so the actions stay on screen without
scrolling. Rationale: the report said why the network closed, not what to change (RESEARCH R1, R1j); ten flights
teach the four upgrades, after that the tip would be noise. **Status: in force (N11f, `test:gameover-tip`,
`test:e2e:gameover-tip`).**

## D-88 — "Reduce motion" is a game setting that starts at the system's (2026-11-03, Claude, night N11g)
Settings → Display gains "Reduce motion / Ogranicz ruch" (switch, ≥ 48 px, one hint line). Until the player touches it
the game follows the system `prefers-reduced-motion` (and later system changes); the first touch stores
`reduceMotion` in `airway.settings` and from then on the player's choice wins both ways. One helper,
`reducedMotion()` in `src/ui/motion.ts`, answers for everything that moves on its own: the split-flap cascade
(boards change at once), the game-over camera (cuts to the jammed hub instead of the 0.6 s pan), the menu globe
turn (D-62: 0°/s), and every CSS animation and transition through the root attribute
`data-airway-motion="reduce|full"` (stamp-ins, NEW stub, jam pulse, upgrade slip, tutorial guide, HUD transitions).
No other module or stylesheet reads the media query (`test:motion`), otherwise an explicit "off" on a reduce-motion
system could not bring a flap back. Direct manipulation stays: the globe still follows the finger and keeps the
short flick inertia, planes still fly (they are the game state, not decoration). Rationale: R1h; Apple's "Reduced
Motion" label needs an in-app control or full system support, and a player whose phone has no such switch (many
Android skins hide it) can now still the game. Rejected: a three-way "system / on / off" select (one more control
for a choice the hint explains), a catch-all `* { animation: none }` rule (changes the timing of every screen and
e2e suite at once). **Status: in force (N11g, `test:motion` 8 cases, `test:e2e:reduce-motion` 3 cases).**

## D-93 — Leaderboard data can be deleted from inside the app (2026-11-03, owner, Q-41 → A)
Settings gain a "Delete my leaderboard data" action that removes the player's board entries and the anonymous
Firebase account; e-mail stays as the web path that Google Play's data-deletion form needs. Extends D-77 (90-day TTL +
e-mail). Reason: Apple 5.1.1(v) requires account deletion, guest accounts included, to start in the app; e-mail alone
risks rejection. Rejected: e-mail only (B), first iOS release without leaderboards (C). Unblocks R1a.
**Status: to implement (R1a).**

## D-94 — Google Play organisation account (2026-11-03, owner, Q-42 → B)
Airway is published from a Google Play organisation account (D-U-N-S number, the company from Q-01), which is exempt
from the personal-account rule of a closed test with ≥ 12 testers × 14 days before production. A closed test is still
run, as a playtest (R1o, Q-52). The DSA trader declaration (address and contact visible in the EU) applies.
Rejected: personal account + mandatory closed test (A).
**Status: decided (owner action: D-U-N-S and Play Console organisation account).**

## D-95 — Week 1 is fair: new airports within reach, pace slightly faster (2026-11-03, owner, Q-51 → B)
In week 1 (before the first weekly board, where the first widebody can be taken) new airports appear only within
2,500 km of an active airport, so no loss is one the player could not have answered. To keep the session target, the
pace gets slightly faster (e.g. more frequent airports) so the bot median stays inside 10–18 min (D-79). Reason: after
N12a 5 of 50 bot runs were still lost in week 1 at an airport farther than 2,500 km from every other one. Rejected:
leave the rules (A), widen the target to 10–20 min (C).
**Status: in force (N12f, rules v5: spawner reach rule, D-105 start radius, D-106 pace; `test:week1-reach`,
`test:balance` `week1_unreachable` = 0 of 50, was 5 of 50; median 17.81 → 17.03 min).**

## D-96 — Post-launch languages, distribution and launch plan (2026-11-03, owner, Q-43 → A, Q-44 → A, Q-48 → A)
- **Languages:** after launch wave 1 adds DE, FR, ES and PT-BR (no technical change), then JA (an OFL CJK typeface,
  a few MB). Store listings first (R1k), then the game with a native-speaker review.
- **Distribution:** worldwide except mainland China (Apple needs an ISBN/ICP licence there; Google Play is not
  available).
- **Launch plan:** the T−12 weeks plan from R2 (`docs/LAUNCH.md`, R2f): closed test → iOS pre-order / Play
  pre-registration (≤ 90 days) → launch, Apple featuring nomination 6–12 weeks before. Showcases (Big Indie Pitch
  Mobile at PG Connects London, Digital Dragons 2027) only once a playable build exists.
Rejected: JA at launch, EU + UK + US only, no showcases or a silent launch.
**Status: decided (R2f writes `docs/LAUNCH.md`).**

## D-97 — The server replay ends at the game over; endTick must be the game-over tick (2026-11-03, Claude, night N12d) — merged as D-93 in PR #130, renumbered
`verifyDailySubmission` replays with `Sim.replay(..., stopAtEnd = true)`: the loop stops after the tick on which the
world reaches `over` (or `won`), and a submission whose `endTick` is not exactly that tick is `malformed` (one tick
early stays `not_finished`). Before, a finished run sent with `endTick` = 30 weeks replayed a dead world for the whole
budget and was stored with `weeks: 30`. The live game never ticks a finished world (`EndlessRun.step`), so honest
clients already send the game-over tick: their verdicts, scores and hashes are unchanged (D-13; `test:replay`
summary identical). `Sim.replay` keeps its default (tick to `untilTick`) for saves, undo and tests. Measured on this
container: bot daily runs 30–48 ms per game week (a 30-week run ~1.4 s), a 5 000-command journal ~0.2 s; budgets in
`test:replay-cost` are 600 ms/week and 5 s. Rejected: a new reject reason (`malformed` is already "not a real run",
and the client shows any rejection the same way); shortening `MAX_REPLAY_TICKS` (would cap real long runs).
**Status: in force (N12d, `test:replay-cost` 7 checks).**

## D-98 — Store-requirement guards: target-API floor and 16 KB native alignment (2026-11-03, Claude, night N12e) — merged as D-94 in PR #131, renumbered
`test:android-config` asserts Play's target-API floor numerically (`targetSdkVersion` ≥ `PLAY_MIN_TARGET_SDK` = 36,
the rule for new apps and updates from 31.08.2026; `compileSdkVersion` ≥ target; `app/build.gradle` reads the value
from `variables.gradle` only). The old exact-string check (`targetSdkVersion = 36`) would have blocked next year's
bump, so it now pins only `minSdkVersion = 24`. The floor is a constant raised by hand each August, not derived from
the clock (tests stay deterministic). Every Android build runs `scripts/native-align.mjs` on its APK/AAB: pure Node
(ZIP central directory + ELF program headers, no SDK), 64-bit `.so` LOAD segments ≥ 16 KB, stored APK entries on a
16 KB boundary; 32-bit libraries are listed but not required (Play's rule covers 64-bit). A misaligned library fails
the release builds; "no native libs" is the expected result for this web-only Capacitor app. Rejected: calling
`zipalign`/`bundletool` from the build (extra SDK/JAR dependency; `zipalign` does not read ELF headers) — the test
cross-checks our verdict against `zipalign -c -P 16` when the SDK is present.
**Status: in force (N12e, `test:android-config` 20 checks, `test:native-align` 7 cases).**

## D-99 — Restricted-airspace cities stay; Alexandria joins Cairo in ME; auto-pause on focus loss (2026-11-03, owner, Q-57 → A, Q-58 → A, Q-59 → B)
- **Q-57 → A:** cities in airspace that is closed or restricted today (Kyiv, Tel Aviv, Beirut, Baghdad, Tehran,
  Isfahan) stay in the data and in the draw: the game is a timeless network, not a news simulator. Kyiv's screen code
  is corrected (KIV → IEV, R4a) regardless.
- **Q-58 → A:** Alexandria moves from `AFR` to `ME`, the region of Cairo 180 km away (one glyph for Egypt), in the same
  sim-rules change as D-95 (it changes demand; old saves are replayed, D-76).
- **Q-59 → B:** the game pauses when its window loses focus in split screen / multi-window and shows the pause screen
  on return (the picture keeps refreshing, so multi-resume is still honoured). UI item for the UI agent, not done yet.
**Status: Q-57 in force (no change); Q-58 in force (N12f, rules v5, `CITY_DATA_VERSION` 2, `test:week1-reach`);
Q-59 in force (N11i, D-119).**

## D-105 — The start group also sits within turboprop range (2026-11-03, Claude, night N12f)
`SPAWNER_START_RADIUS_KM` 3,000 → 2,500: every start airport is within turboprop range of the start anchor, so the
start group obeys the same rule as the week-1 spawns of D-95. Under the old radius 33 of 1,403 start airports on 400
seeds were more than 2,500 km from every other start airport (e.g. Medellín–Mexico City 2,934 km); 78 of the 89 start
clusters remain and they cover the same seven regions. Rejected: checking pairwise reach inside a 3,000 km cluster
(more code for the same effect). **Status: in force (N12f, `test:week1-reach`).**

## D-106 — Faster pace for the fair week 1: 12 h spawns and 130 % demand (2026-11-03, Claude, night N12f)
D-95 asked for a slightly faster pace to keep the bot median inside 10–18 min (D-79). The reach rule alone made the
bot sample much longer than expected (50 seeds 17.81 → 24.43 min; 200 seeds 17.53 → 23.48): a compact week 1 also
keeps later weeks manageable. `SPAWNER_INTERVAL_HOURS` 16 → 12 (6 new airports per 3-day week instead of 4.5) and the
new integer `DEMAND_RATE_PERCENT` = 130 (demand credit kept in hundredths, D-13) bring it to 17.03 min (200 seeds
16.52), 1st/2nd board 100 % / 66 %, 0 week-1 losses beyond reach. Neither knob alone was enough without extremes
(spawns only: 10 h; demand only: 140 % still 20.81 min); the sweep is in `docs/balance/README.md`. `RULES_VERSION`
4 → 5, `SPAWNER_PARAMS_VERSION` 1 → 2. Rejected: smaller waiting rooms (24 → 20 seats still 22.7 min), widening the
target (owner rejected C in Q-51). It is a bigger change than "slightly"; a human playtest should confirm it (Q-60).
**Status: in force (N12f, `test:balance`).**

## D-107 — Screen airport codes separate from sim ids (2026-11-03, Claude, night N12h)
`City.code` stays the simulation id (saves, journals, logbook, puzzles, golden hashes, the sorted curfew draw), so
the six wrong codes from R4 are not renamed: an optional `City.displayCode` holds the code travellers know from a
ticket — the common city code, else the main airport (KIV → IEV, HCM → SGN, LUA → LAD, LUS → LUN, ISF → IFN,
ALX → ALY) — and everything the player reads goes through `displayCode()` / `airportLabel()`. `test:city-data`
freezes the id list (append only) and keeps display codes unique. Rejected: renaming the ids (would need a save,
journal and logbook migration and a `RULES_VERSION` bump for no gameplay change). **Status: in force (N12h).**

## D-108 — One top-50 document per board (2026-11-03, Claude, night N12i)
R3a: `getBoards` ran two 50-document queries per call (~105 reads), most of the Firestore bill and the cheapest way
to run it up. Each board now keeps `boards/{id}/meta/top` (`entries`: ≤ 50 `{uid, callSign, score}` in the old
query's order, score desc then document id desc), written by `submitDaily` inside the same transaction as the entry
and only when the run changes the list; `getBoards` reads the two top documents and the caller's two entries
(4 reads) and runs `count()` only for a caller outside the top 50. Response shape unchanged; `submitDaily` adds
`rank` while the caller is in the daily top 50. A board without a top document (written before the upgrade) is
seeded from the old query at its first write and read with the old query until then. The top document's `expireAt`
is fixed at its first write and never extended, so with its own TTL policy (`meta`) it never outlives the entries
it copies (D-77). The uid is stored because `me` needs it and Firestore is server-only; the call sign alone can
collide. Rejected: a scheduled job that rebuilds tops (extra function, stale boards between runs); sharded counters
(not needed at this size). Every write to a board now contends on one document; at well below one accepted run per
second per board this is fine, and the write is skipped once a run cannot reach the top. **Status: in force (N12i).**

## D-109 — Per-player rate limit and split function caps (2026-11-03, Claude, night N12j)
R3b: one shared `maxInstances: 10` with the 2nd-gen default concurrency of 80 neither capped a scripted caller nor
kept the CPU-bound replay from queueing 80 players behind one vCPU. Now `getBoards` has `maxInstances: 3`;
`submitDaily` has `maxInstances: 5`, `concurrency: 4` and `cpu: 1` (worst case 20 replays at once). Each instance
keeps an in-memory token bucket per uid (`getBoards` 20/min, `submitDaily` 6/min, burst = the per-minute limit,
at most 10 000 players remembered, least recently used forgotten), checked right after auth and before any
Firestore access or replay; over the limit → `resource-exhausted`. Instances share nothing, so the effective cap is
limit × instances (60 and 30/min), which still bounds the bill. The client used to treat every 4xx as a final
rejection and would have dropped a rate-limited run from its queue; 429 now counts as a temporary server error
(`retry`). Rejected: a Firestore counter per uid (a read and a write per call, the cost we are cutting); App Check
(separate decision, needs the store builds). **Status: in force (N12j).**


## D-113 — Week-1 pace stays 12 h × 130 %, tuned after the human playtest (2026-11-03, owner, Q-60 → C)
Q-60: N12f (D-95, D-106) sped up the start more than "slightly" — a new airport every 12 game hours instead of 16 and
130 % demand (bot median 17.03 min, 0/50 week-1 losses without a possible answer). The owner keeps that pace (rules
v5 unchanged) and tunes it only after the closed test with people: the balance bot measures the network, not a
player. Options rejected for now: B (11 h × 110 %, median 17.57) — no evidence from humans yet. **Status: in force
(rules v5); revisit with closed-test data.**

## D-114 — In-app deletion of leaderboard data (2026-11-03, Claude, night N12k)
Implements D-93 (R1a, Apple 5.1.1(v)). Settings → Help gains "Delete my ranking data", shown only once the device has
an anonymous identity or a queued run; it asks for an inline confirmation, then calls the new callable
`deleteMyData`. Entries carry no uid field (the uid is the document id), so the function reads the paths of every
daily and weekly board an entry can still live on — 97 days back (90-day retention, D-77, + yesterday's board +
TTL lag), 113 boards, one batched existence read per board — and, per board where the player left something, in a
transaction deletes the entry and removes the uid from `meta/top` (D-108; a full top is refilled from the 51 best
entries read before the delete, so it equals the old query). Then it deletes the anonymous Auth account; an account
already gone is not an error, so a repeat is a no-op. Capped at `maxInstances: 2` and 3 calls/min per player
(D-109). The client clears the token and the offline queue only after the server's answer; offline or on a server
error it says nothing was deleted and keeps the identity for a retry (never a faked success); a refresh that finds
the account already deleted counts as done. The e-mail path (D-77) stays as the web resource for Google Play.
Rejected: a `uid` field + collection-group query (needs a new index and a migration of existing entries); deleting
the whole top document (the next reads would fall back to the 50-document query and the re-seeded top would get a
later TTL than the entries it copies). **Status: in force (N12k).**

## D-115 — Android per-app language list (2026-11-03, Claude, night N12l)
R1d: Android 13+ offers a per-app language only for apps that declare their languages. The manifest now points
`android:localeConfig` at `res/xml/locales_config.xml` with `en` and `pl` — the same set as `src/i18n` and iOS
`CFBundleLocalizations` (D-91), kept equal by `test:android-config`. The in-game language setting stays the
authority (D-31): a saved choice is read before the device language, and the system per-app language only changes
what a player who never chose sees (through the WebView's `navigator.languages`, still to verify on a device).
Rejected: AppCompat `setApplicationLocales` with a native picker and the `autoStoreLocales` service (a second
language store that could disagree with the game's own; Android 12 and older have no system UI for it anyway);
AGP `generateLocaleConfig` (needs `resources.properties` and only sees Android string resources, while the game's
text lives in `src/i18n`). A per-app change while the game runs applies at the next start (`locale` is in
`configChanges`). **Status: in force (N12l); device check open.**

## D-116 — Budget GPUs start on the low preset (2026-11-03, Claude, night N12m)
R3f: Galaxy A06/A16, Redmi 14C and Moto G phones report 8 cores and 4 GB (`navigator.deviceMemory` is rounded
and capped), so the core/memory rule started them on `medium` and only adaptive quality (D-73) stepped down after
visible stutter. `auto` now reads the unmasked WebGL renderer once (a throwaway context, `WEBGL_debug_renderer_info`
or `RENDERER`, released at once, cached) and starts `low` for Mali-G52, Mali-G57/G68 MC1–MC2, Mali-T8xx, PowerVR
GE83xx and Adreno 5xx/610/613 (`LOW_GPU_FAMILIES` in `src/render/quality.ts`). An unknown string keeps today's rule,
an explicit graphics choice wins, and remembered adaptation steps (D-74) apply only when they still fit the new
ladder. Rejected: a benchmark at boot (costs seconds on exactly these phones, noisy under thermal throttling) and a
User-Agent model list (Chrome reduces the UA to "K"; renderer strings name the GPU directly). The table is not
verified on the devices themselves (R3i Test Lab would). **Status: in force (N12m).**

## D-117 — Play feature graphic from the real game scene (2026-11-03, Claude, night N12n)
R2d: Google Play needs a 1024×500 feature graphic to publish, and it doubles as the preview-video cover. It is rendered,
not drawn: the `game` store-shot scene (seed 0xA1A1, autoplayed network, evening sun) in a wide viewport at DPR 2 with
the HUD hidden, the globe zoomed in and slid right so the network is central, the existing wayfinding sign
(`brand/wayfinding.svg`) on the left third, downscaled to 1024×500 and saved as opaque RGB. One file for both
languages (the only word is the brand name). Checked by `test:store-shots`: size, no alpha, ≤ 15 MB, centre not
empty, ≤ 20 % dark unsaturated pixels (Google's rule — so not the night scene), plus PL/EN alt text ≤ 140 chars.
Rejected: a hand-made illustration (a second art style next to the game) and a tagline in the image (localised text,
risk of price/"free" wording; the store title already carries it). **Status: in force (N12n).**

## D-118 — WebGL context loss holds the run; no WebGL 2 gets a plain page (2026-11-03, Claude, night N11h)
A phone drops the GPU context under memory pressure, after a driver reset or when another app takes the GPU; until
now nothing listened, so the globe froze or went blank while the run kept going underneath. `src/render/contextGuard.ts`
listens to `webglcontextlost` (with `preventDefault`, otherwise the browser never restores) and
`webglcontextrestored`. While lost the renderer draws nothing and the world loop does not call the run's frame hook
(the frame hook is the run's only clock, as with a hidden tab), so the state hash stays the same; the blank canvas is
hidden so the sky shows, and one paper notice (`role="status"`, PL/EN) says the graphics are restarting and the game
waits. On restore three.js re-uploads its buffers on the next draw, the quality profile, lights and size are re-applied
and the frame cap restarts (the gap is not read as a slow frame); the run then carries on by itself — the loss is not
the player's doing, so no extra tap. If `createWorld` throws and `getContext('webgl2')` is null, a plain settings-paper
page ("This device's graphics are not supported", the device's renderer string for a support mail, no buttons)
replaces the blank sky whose Play led nowhere. Rejected: re-creating the whole `WebGLRenderer` on restore (three.js
restores its own state; a second renderer leaks the first context), and a WebGL 1 fallback (three.js r170 is
WebGL 2 only; Play filter is R3h). **Status: in force (N11h, `test:webgl-context` 8 cases,
`test:e2e:webgl-context` 4 cases).**

## D-119 — Focus loss pauses the flight; only Resume restarts it (2026-11-03, Claude, night N11i)
Implements D-99 (Q-59 → B). `GameLifecycle` now also listens to the window's `blur` and `focus`: a blur (split
screen or a floating window on Android/iPad, a click into another desktop window) takes the same path as a hidden
tab — pause, open the pause sheet and save — while the page stays visible, so the globe keeps drawing (multi-resume).
Focus coming back only asks for the explicit Resume (the sheet stays, the clock does not restart by itself); a blur
followed by `visibilitychange` pauses and saves once, and a focus while the page is still hidden is ignored. The
lifecycle hooks in `main.ts` now pause only a flight on the `game` screen: the weekly upgrade picker and the
game-over board already hold the clock, and a pause sheet over the picker would only add a tap (this also applies
to a hidden tab). Rejected: auto-resume on focus (the owner chose the pause screen on return; a run that restarts
while the player still looks at the other app can jam a hub), pausing only when `document.hasFocus()` stays false for
a while (a delay before the pause is time the hub fills unseen), and option C "only in multi-window mode" (no
reliable web signal for it). Known: the first-launch tutorial keeps its own controller and is not paused on blur.
**Status: in force (N11i, `test:saves` 13 cases, `test:e2e:focus-pause` 3 cases).**

## D-123 — Store shots in the exact Apple sizes and 16:9 (2026-11-03, Claude, night N12o)
R2a: App Store Connect requires iPhone 6.9" (1320×2868) and iPad 13" (2064×2752) screenshots, and Play's large-screen
promotion takes only 9:16 or 16:9 images with a short side ≥ 1080 px, which the foldable (4:5) and tablet (3:4) shots
are not. `scripts/store-shots.mjs` gains three device profiles — `iphone` 440×956 @3, `ipad` 1032×1376 @2 and
`landscape` 960×540 @2 (1920×1080, the game's own landscape HUD) — next to the existing three, so the store set is
5 scenes × 2 languages × 6 devices = 60 real screenshots, with the same per-shot checks (size, not blank, no dev text,
D-08 glyphs, contrast, warmth, boarding pass not covered). `checkStoreSizes` fails the copy check when a console size
rule is not met, and every shot must be RGB without alpha (Apple rejects alpha). Each profile names its console slot
(`docs/store/README.md`). Rejected: scaling the 1080×1920 phone shot up to Apple's size (blurry text, a different
aspect, Apple asks for the real device class) and a 1206×2622 iPhone 6.3" profile (6.9" is the one Apple requires; it
scales down). **Status: in force (N12o).**

## D-124 — Play device filter: OpenGL ES 3.0 required (2026-11-03, Claude, night N12p)
R3h: three r170 has no WebGL 1 renderer, and Android WebView offers WebGL 2 only on OpenGL ES 3.0 GPUs, so on an
ES 2.0 phone the game is a blank globe. The manifest now requires `glEsVersion 0x00030000`, so Play hides the game
from those devices instead of selling them a broken install. Both owner options that change anything in Q-54 (A and
B) include this filter, so it is done now; only the minSdk choice (24 vs 29) still waits for Q-54. Guarded by
`test:android-config` (`play-gles3-filter`, also ties the filter to three ≥ r163). Not covered: ES 3.0 devices whose
WebView blocklists WebGL 2 (R3g fallback page). **Status: in force (N12p); minSdk part decided in D-133 (Q-54 → B).**

## D-128 — Airport code plates at hubs and named airports; all when zoomed in (2026-11-03, owner, Q-61 → C)
R5 found that an on-screen airport shows neither code nor name, while the pause summary, crate stamps and the
game-over board speak in codes ("BEG 9/36"). The owner chose C: a small Diorama code plate (or name, per the D-68
setting) beside the airport disc at every hub and at every airport the UI currently names (pause summary, stamps,
game-over board), and at all airports once the camera is zoomed in. Plates go through the existing `layoutTags`
collision pass and never cover a passenger tag or a 48 dp target. Rejected: A (no plates — the code ↔ disc link is
never taught), D (always all — clutters the whole-network view). **Status: decided; implementation R5a.**

## D-129 — Tutorial vignette in the game's own marks + glyph legend (2026-11-03, owner, Q-62 → B)
The tutorial vignette draws cities as orange diamonds and the hub as a teal ring, while in the game an airport is a
runway disc and yellow diamonds are route-end handles; region glyphs are never taught and the game has no legend.
The owner chose B: redraw the vignette with the game's own marks (airport disc, hub ring, real glyph tag), one
sentence naming a glyph's region in the transfer step, and a glyph legend (shape, not colour) in settings → help,
in one PR. Rejected for now: A (keep), C (a new tutorial on the real globe) — reconsidered after the closed test.
**Status: decided; implementation R5b.**

## D-130 — A save the new rules cannot continue says "older rules version", not "damaged" (2026-11-03, Claude, night N11j)
Rules v5 (N12f) replay a v4 save from its journal (D-76); when the replay already ends the run, or the save is longer
than the replay cap, nothing can be offered. The menu said "The saved flight is damaged", which is untrue and reads
like a bug. `loadSavedSimChecked` now reports `old-rules` for any save with a rules version below `RULES_VERSION`
that cannot be continued, and the menu shows "Saved flight from an older rules version: the current rules cannot
continue it." / "Zapisany lot ze starszej wersji zasad: obecne zasady nie pozwalają go kontynuować." A save without a
rules version (legacy) or with the current version that fails stays `corrupt`: there it really is damage. The save
is still not deleted. Rejected: silently dropping the notice (the Continue row would vanish without a word, N10c).
**Status: in force (N11j, `test:save-golden` 21 checks, `test:e2e:save-notice` 6 steps).**

## D-133 — Android minSdk 29 (Android 10) (2026-11-03, owner, Q-54 → B)
The owner chose B: raise `minSdkVersion` from 24 (Android 7) to 29 (Android 10) and keep the OpenGL ES 3.0 Play
filter (D-124). Android 7–9 are about 8 % of Play devices, their WebView no longer receives Chrome updates (Chrome
139+ needs Android 10), the game is never tested on them, and most are below the low quality preset. Fewer untested
web engines outweigh the lost reach. `android/variables.gradle` sets 29; `test:android-config` (`sdk-versions`)
requires exactly 29 and no hard-coded minSdk in `app/build.gradle`, and `play-gles3-filter` requires minSdk ≥ 29.
Rejected: A (24 + filter) and C (no change). Not checked: a Gradle build and the Play device count with the new
floor. **Status: in force (N12q).**

## D-134 — Terms of use and trader status (2026-11-03, owner, Q-65 → A, Q-66 → A)
Q-65 A: short PL/EN terms of use on the site plus a line in the game (R7b), and Apple's standard EULA in the App
Store; the terms are reviewed by a lawyer in the same consultation as the privacy policy. Q-66 A: the publisher
declares **trader** status in both App Store and Google Play, with the company address and phone from Q-01 (business,
not private details). Rationale: Polish e-services law requires terms for the leaderboard and site, Google shows the
trader's terms link from 1.03.2027, and a non-trader declaration conflicts with the organisation account (D-94) and
the business model (D-16). **Status: decided; terms text and store declarations not written yet.**

## D-135 — Leaderboard on legitimate interest, no age gate, opt-out toggle (2026-11-03, owner, Q-68 → A)
The daily leaderboard and its anti-cheat checks run on legitimate interest (GDPR art. 6(1)(f)), not consent, so no age
gate is needed (the 16-year limit of art. 8 applies to consent only). The player can object: settings gain a toggle
"Send results to the leaderboard" / „Wysyłaj wyniki do rankingu” (R7l); when off, official daily runs are not
submitted. The privacy policy names the basis and the right to object. **Status: decided; toggle not implemented yet
(R7l).**

## D-136 — UK representative, wave-1 translations, no newsletter (2026-11-03, owner, Q-67 → A, Q-69 → A, Q-70 → A)
Q-67 A: ask the lawyer, in the same consultation as D-134, whether a UK GDPR art. 27 representative is needed, and
appoint one if so. Q-69 A: wave-1 languages (DE, FR, ES, PT-BR, D-96) are translated by an agent and corrected by a
native speaker; city names from Wikidata (CC0); code preparation (R7e–R7j) comes first. Q-70 A: no newsletter on
airway.games — Play pre-registration and the App Store pre-order notify players; the site keeps store links and the
press kit only (no new data processor). **Status: decided.**

## D-137 — Route snap haptic inside a native selection (2026-11-03, Claude, night N12r)
R6d: `haptic('snap')` called `Haptics.selectionChanged()` alone, and `@capacitor/haptics` 8.0.2 drops that on both
platforms (Android ignores it unless `selectionStarted`; iOS ticks only the generator `selectionStart` created), so
the game's most frequent haptic never fired. The route tool now opens a selection when a drag begins
(`RouteHaptics.start` → `selectionStart`) and closes it once when the drag ends, is refused, cancelled or undone
(`end` → `selectionEnd`); snaps tick inside it. A `snap` outside a drag sends its own start → changed → end. The
player switch silences ticks but an open selection is always closed. Rejected: replacing the snap with `impactLight`
(the plugin's selection tick is the platform's lighter "detent" feel, and confirm already uses the light impact).
`test:haptics` models the plugin's rule (every snap must vibrate) and `test:route-tool` asserts start/end order.
Not checked: a real Android phone and iPhone. **Status: in force (N12r).**

## D-143 — Bundle budget guard instead of code splitting (2026-11-03, Claude, night N12q)
R5k: the game ships as one 1,033.8 kB main chunk (306.2 kB gzip); in the Capacitor app files come from disk, so the
cost is parse time on budget phones, not download. Splitting the rare screens would save < 40 kB, so the decision is a
budget with ~11 % headroom instead: main JS ≤ 1,150 kB raw / 340 kB gzip, CSS ≤ 90 kB, all of `dist/` ≤ 2,200 kB
(`docs/PERFORMANCE.md` "Bundle budget"), enforced by `npm run test:bundle` in `test:ci` after the build. Raising a
budget needs a new decision. `test:bundle:static` in `test:fast` also forbids importing one module both statically and
with `import()`; the two useless dynamic `import('@capacitor/core')` calls (`platform/install.ts`, `storage.ts`)
became static imports (the module was already in the main chunk through `platform/haptics.ts`), which removes Vite's
warning. Vite's chunk warning limit is set to the same 1,150 kB. Rejected: `manualChunks` for three.js (one more file
to parse at boot, no gain from disk) and WOFF2 fonts for now (size only). **Status: in force (N12q).**

## D-144 — Every catalog key is used; dead adapters removed (2026-11-03, Claude, night N12q)
R5i: the task-20 adapters `describeCity`, `createCityAnnouncer`, `bindCityAccessibility` and `labelAirportActions`
(`src/ui/a11y.ts`) were never wired into the overlay or HUD, which label their own buttons; they and their 13
`a11y.city*` / `a11y.action.*` keys are removed, with `status.loading` / `status.ready` (408 keys left). Also removed:
the unused `mountEmptyScene` (`src/render/scene.ts`), `createTerrain`, `AIRPORT_LABEL_MODES` and `dailyGame`.
`test:i18n` now fails when an English key is not referenced from `src/` as a literal or under a template or
concatenation prefix (`privacy.s${n}`, `'settings.airline.' + id`); on the old catalogs it reports 15 unused keys.
Kept: `SIM_TICK_MS` and `DAYNIGHT_PARAMS_VERSION` (versioned simulation parameters, documentation of the rules).
**Status: in force (N12q).**


## D-145 — Plural form from the number, read with the language's own separators (2026-11-03, Claude, night N12s)
R7e: callers pass counts already formatted by `localNumber`, and the plural reader took "." as a decimal point, so
with German/Spanish/Brazilian grouping "1.000" picked the singular ("1.000 Passagier"), pt-BR "1.500" read as 1.5,
and "1.000.000" was NaN, which leaked the raw `{n|…}` token. Of 24 fake de/pt-BR/es/fr cases (0, 1, 2, 1 000,
1 500, 1 000 000) the old reader got 6 wrong. The reader is now `parseLocalNumber(text, locale)`
(`src/core/format.ts`): it takes the group and decimal symbols from `Intl.NumberFormat#formatToParts` of the same
locale that formatted the number, treats every space as a group separator, and returns NaN for anything else (codes,
seeds), which keeps the token as before. Numeric params are used as they are. `fillPluralTokens` and `pluralFormIn`
take a locale and form order, so tests cover languages not shipped yet; PL/EN output is unchanged. Rejected: making
every caller pass raw numbers (touches ~10 UI call sites owned by the screens and still needs the string path for
`dailyRow`-style pre-formatted text). Limit: a pre-formatted string must come from the active language's formatter;
"1.5" handed to a German catalog reads as 15. **Status: in force (N12s).**

## D-146 — No U+202F in numbers, borrowed arrow for the body font, glyph coverage test (2026-11-03, Claude, night N12s)
R7g: Atkinson Hyperlegible Next (body font, 362-glyph subset) has neither U+202F (narrow no-break space, Intl fr-FR's
thousands separator) nor U+2192 "→", which the upgrade card sets in body text ("{from} → {to} min"); the browser
then takes the glyph from a system font. `formatNumberIn` replaces U+202F with U+00A0 (same no-break, present in every
face), and `src/ui/fonts.css` gives the Atkinson family the arrow from the already shipped Overpass 400/800 through
`unicode-range: U+2192` (the same mechanism as the Overpass middle dot, task-37). New fast `test:glyphs` parses each
TTF `cmap` (formats 4/12, `scripts/lib/ttf-cmap.mjs`, no dependency) plus the borrowed ranges and fails when any face
lacks a code point of the PL/EN catalogs, city/region names, numbers formatted for pl/en/de/fr/es/pt-BR, or the
PL/EN/DE/FR/ES/PT-BR letter set; soft hyphens and zero-width characters are exempt. It checks every face for every
string (stricter than the real CSS mapping) so a key may move between faces freely. Rejected: subsetting a new
Atkinson file with U+202F/U+2192 (a rebuilt font file and licence trail for two glyphs). Not covered: French
typography's narrow space before ": ; ! ?" in future catalogs, which a translator must write as U+00A0 — the test
will fail on U+202F. **Status: in force (N12s).**

## D-160 — Puzzle list generated from the folder, not `import.meta.glob` (2026-11-03, Claude, ext/01)
R6f: `src/data/puzzles/index.ts` imported 30 JSON files by hand and `test:puzzles` hard-coded 30 levels. The list is
now `src/data/puzzles/levels.generated.ts`, written by `npm run build:puzzles` (`scripts/build-puzzles.mjs`, also run
by `prebuild` and `predev`) from the `NN.json` files: two-digit ids, contiguous from 01, at most 99, any other
`*.json` name refused. `index.ts` keeps the types and re-exports `PUZZLES`. `test:puzzles` takes the count from the
folder and fails when the game's index differs from it; `test:puzzle-packs` adds a level to a copy of the folder and
checks that it reaches `PUZZLES` without touching `index.ts`, and that the committed file is fresh. Rejected:
`import.meta.glob` — the list is imported by the Sim (`src/sim/puzzles.ts` → `scenarios.ts`), so it also runs under
Node (the TS test loader, every headless test) and in the esbuild bundle of `functions/` (server replay, D-72), where
`import.meta.glob` does not exist; a generated file works in all three without a Vite-only transform (same pattern as
`generated/distances.ts`). Adding a pack: drop `31.json`…`35.json`, run `npm run build:puzzles`, add the
`puzzle.NN.title` keys. **Status: in force (ext/01).**

## D-161 — `npm run puzzle:report`: one difficulty row per level from its reference run (2026-11-03, Claude, ext/01)
R6f: a pack PR shows its curve as a Markdown table, one row per level computed from the real reference run: time at
1× (ticks / 10 per second), goal, cities and offered routes, stock (T/W/H), number of reference actions and
widebodies among them, `mechanics` tags plus what the run actually met (minutes of slot waits, curfew airports),
reference result with stars, margin over the target and the ★★ (+15 %) / ★★★ (+30 %) thresholds in passengers.
`-- --from NN` limits it to one pack, `-- --json` prints the rows. Developer tool only; nothing in the game reads it.
**Status: in force (ext/01).**

## D-162 — Puzzle packs: `packs.ts` and a pack header on the departures board (2026-11-03, Claude, ext/02)
R6h / D-131 (owner, Q-64 → A, recorded on `night/11k-clean-gameover`, not yet on `dev`): levels after 30 come in
packs. `src/data/puzzles/packs.ts` lists each pack's first level and name key (`longHaul` from 31); a pack runs to
the next pack or the last level. The puzzle board draws one non-interactive row above the pack's first flap — "Pack:
Long haul · 5 puzzles" / "Paczka: Daleki zasięg · 5 zadań" (`puzzle.pack.line`, plural `{count|…}`), printed in the
board's yellow mono on black, wrapping inside the list (checked at 320×568 by `test:e2e:screens-fit-320`). No new
mechanic tag: the long-haul lesson (widebody range, ocean legs) is in the levels themselves; `test:puzzles` checks
that the pack starts outside Europe, uses a widebody leg beyond turboprop range and offers no out-of-range strip.
**Status: in force (ext/02); whether the pack ships at launch or waits for T+4 is Q-74.**

## D-163 — "Long haul" 31–35: a steeper curve built with a network search (2026-11-03, Claude, ext/02)
Five levels outside Europe, each two 3-day weeks (8 640 ticks, 14:24 at 1×), designed with an exhaustive search over
every network the stock allows (all strip subsets × hub-upgrade choices) on the real Sim:
31 Islands to Los Angeles (Auckland feeder star, one widebody, Suva wave in week 2; 1 of 59 networks clears it),
32 South Atlantic by night (São Paulo under curfew must not be the hub; 2 of 65), 33 Santiago to Sydney (Santiago–Sydney
is beyond widebody range, Auckland transfers, 3 continents; 9 of 327 avoid a jam), 34 Dusk over Africa (four
turboprop spokes queue for Singapore's slots, Johannesburg under curfew, Perth needs its own widebody; 8 of 1 253),
35 Around the world (5 continents, Sydney curfew, week-2 waves, Buenos Aires reached westwards via Singapore and
Johannesburg, and the single hub upgrade must go to Sydney; 1 of 1 525 networks × 1 of 5 upgrade choices). Targets
give the reference +16 % (31–33) and +15 % (34–35), below 26–30 (+17…18 %). `test:long-haul` pins the curve and one
tempting decoy per level that must lose. Titles are short enough not to break words on the 320 px board.
**Status: in force; difficulty is a proposal for the owner to playtest (as D-70).**

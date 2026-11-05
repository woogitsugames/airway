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
yellow wayfinding sign (menu). Details: `docs/styles/diorama.md`. **Status: accepted by the owner 2026-11-02 ("to ok"). Final. [2026-11-04] The globe part is
superseded by D-170 (satellite globe, `docs/styles/realistyczny.md`); the airport-artefact UI stays in force.**

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

## D-18 — Store title: "Airway: Globe Route Builder" (PL: "Airway: Buduj siatkę lotów na globusie") (2026-11-02, owner) — PL title superseded by D-203
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

## D-86 — Privacy policy inside the app, same text as the site (2026-11-03, Claude, night N11e)
Settings → Help gains a "Privacy policy / Polityka prywatności" row under the licences. It opens an in-app page
(router screen `privacy`, back → settings, the globe does not draw behind it) with the text of `site/privacy.html`:
title, the draft warning, its five sections and date, plus one line that the copy is stored in the game and opens
without a connection. The game catalogs hold a copy of the site's `privacy.*` strings; `test:privacy-text` fails when
they differ from `site/i18n.js`, so the site stays the one source. No public URL is shown until the site is published
(D-67); the leaderboard section waits for the owner (Q-56). Rationale: Google's User Data policy wants the policy
reachable inside the app (RESEARCH R1, R1b); an offline page works on every build and in every store review.
**Status: in force (N11e, `test:privacy-text`, `test:e2e:privacy-page`).**

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

## D-90 — Balance bot plays for reach (2026-11-03, Claude, night N12a)
The DEV/balance bot (`src/game/dev/bot-policy.ts`) values the widebody on the weekly board like a turboprop-only
network needs it: +80 when the fleet owns no widebody or an active airport without a route lies beyond turboprop
range (2,500 km) of every other active airport (before, only an existing long route counted, which a turboprop-only
network never has, so the bot never took a widebody in 50 seeds). When no served airport is eligible for an unserved
one, it may pair two unserved airports with each other (a new network island). Rationale: 34 of 44 bot game overs
were at an airport no route served, 20 of them beyond turboprop reach — a measuring-stick fault, not game balance.
Now 7 of 40; `test:balance` median 14.55 → 17.81 min, 1st/2nd board 86/50 → 88/56 %. No game parameter changed;
the median now sits near the D-79 upper bound (Q-51). **Status: in force (N12a, `test:bot-policy`).**

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

## D-130 — Pre-run training shortened to 3 steps; the rest as first-time cards in the game (2026-11-03, owner, Q-63 → B)
The pre-run vignette teaches 7 steps, though upgrades and congestion first happen about 7 minutes into a real run,
and the game has only one in-game "first time" hint (departure slot). The owner chose B: the vignette keeps three
steps (route, aircraft, transfer) and the others become one-time cards in the real game at the moment the event
happens (R6a + R6b), done in one PR with R5b (D-129). Rejected for now: A (keep 7 steps), C (no vignette, straight
into a real run with cards only) — reconsidered after the closed test. **Status: decided; implementation R6a/R6b
with R5b.**

## D-131 — An update every 4 weeks after launch; first pack ready before launch (2026-11-03, owner, Q-64 → A)
Apple In-App Events last up to 31 days and a Play "Major update" promotion 28 days, so a 4-week rhythm keeps one
store event running in both stores. The owner chose A: every 4 weeks one new mechanic plus 5–10 puzzles that teach it
(T+4 pack 31–40 "Long haul", T+8 weather front R2j + 41–45, T+12 weekly contract R2k + a Sunday daily variant), and
the first pack (R6h) is prepared before launch as a buffer. Rejected: B (6–8 weeks, bigger updates — gaps without a
store event), C (no plan until launch data). **Status: decided; unblocks R6g/R6h.**

## D-132 — A save the new rules cannot continue says "older rules version", not "damaged" (2026-11-03, Claude, night N11j)
Rules v5 (N12f) replay a v4 save from its journal (D-76); when the replay already ends the run, or the save is longer
than the replay cap, nothing can be offered. The menu said "The saved flight is damaged", which is untrue and reads
like a bug. `loadSavedSimChecked` now reports `old-rules` for any save with a rules version below `RULES_VERSION`
that cannot be continued, and the menu shows "Saved flight from an older rules version: the current rules cannot
continue it." / "Zapisany lot ze starszej wersji zasad: obecne zasady nie pozwalają go kontynuować." A save without a
rules version (legacy) or with the current version that fails stays `corrupt`: there it really is damage. The save
is still not deleted. Rejected: silently dropping the notice (the Continue row would vanish without a word, N10c).
(Numbered D-130 in PR #147; renumbered because the owner's Q-63/Q-64 answers took D-130/D-131.) **Status: in force (N11j, `test:save-golden` 21 checks, `test:e2e:save-notice` 6 steps).**

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

## D-150 — Weekly board offers only cards that can act (2026-11-03 22:20 CET, owner, Q-71 → B)
R8a: the "+2 slots" card enters the weekly draw only after the run's first departure hold, the hub expansion card only
while the network has a hub; an empty place is filled by the other aircraft card. To be measured with `r8-audit`
and `test:balance` (median 10–18 min, D-79). **Status: in force (N12v, rules v6; numbers in D-155).**

## D-151 — Curfew from week 3 in Endless (2026-11-03 22:20 CET, owner, Q-72 → B)
R8c: the night curfew (D-17) starts in week 3 instead of week 4 in Endless; Daily the same; puzzles unchanged.
Check the median 10–18 min (D-79) and question 5 of R8 in the closed test. **Status: in force (N12v, rules v6; numbers in D-155).**

## D-152 — Run length decided after the closed test (2026-11-03 22:20 CET, owner, Q-73 → C)
The end-of-run shape (network +6 airports a week vs fleet +1 aircraft; no bot run past 31.6 min) stays as in rules v5
until the closed test gives the distribution of human run lengths (D-113); the R8f review is prepared before it.
**Status: decided (wait for the closed test).**

## D-153 — Sound survives the phone: tap retries, system suspension, frozen clock, tick clock (2026-11-04, Claude, night N12t)
Owner report: no music on a Galaxy Z Fold (APK debug from ce9ef74, music on by default). Not reproducible in desktop
Chromium (the context runs and the chimes play), so the fix closes every path in the engine that can leave a
phone silent for the rest of the session, and adds a way to read the engine's state on the device:
1. The first-gesture listener removed itself before `resume()` settled. A first resume that stays suspended (another
   app holds audio focus, WebView keeps the context suspended) or is refused left the game silent until restart. The
   listener now stays until the context really runs.
2. A context the system suspends or interrupts later (call, audio focus, Samsung sound settings) fired nothing. A
   `statechange` away from "running" that the game did not cause re-arms the tap listener; so does a lifecycle
   `resume()` refused outside a gesture (back from the background).
3. A context can report "running" while its clock stands still; then nothing scheduled ever plays. If `currentTime`
   has moved < 0.3 s after 1.2 s (page visible, not paused), the context is closed and the next tap builds a new
   one with `latencyHint: 'playback'` (larger buffer, the more compatible output path) instead of `'interactive'`.
4. `main.ts` set the engine clock to the world minute while every cue carries `run.tick`; the minute stands still for
   the ticks weekly offer commands take (hub pick, back from a pick), so every later chime was placed 0.1 s (1x)
   further ahead per such tick. The engine clock is now the tick (`audioClockTick`).
`globalThis.airwayAudioStatus()` returns state, clock, latency hint, unlock attempts, rebuilds, scheduled/dropped
cues and volumes (read-only, no setter) for `chrome://inspect`; the device checklist is `docs/ANDROID.md`
"Sound check". `test:audio-unlock` (fake AudioContext) covers 1–4; 6 of its 7 checks fail on the old engine.
Not changed: the sound design (D-71); whether "music" should also play on the menu is Q-75. Not verified: the Fold
itself. **Status: in force (N12t).**

## D-154 — Unfolded large foldable in the screen matrix (2026-11-04, Claude, night N12u)
The owner plays on a Galaxy Z Fold class phone; its inner screen (~1812×2176 px) is ~904×1088 CSS px at device pixel
ratio 2, taller than the matrix's 904×1000. `ui:matrix` gained 904×1088 and 1088×904 (unfolded, held in landscape),
both rendered at DPR 2 like the device (`newGamePage` takes `deviceScaleFactor`): 6 sizes × 4 screens × PL/EN = 48
shots with the same overlap/scroll checks. All 16 new shots pass and were inspected; in landscape the menu board
sits small in the lower-left corner with much empty sky (layout is agent #1's; noted, not changed). The cover screen
is covered by 412×915. **Status: in force (N12u).**

## D-155 — Rules v6: eligible weekly cards and curfew from week 3 (2026-11-04, Claude, night N12v)
Implements D-150 (R8a) and D-151 (R8c) as `RULES_VERSION` 5 → 6. `drawUpgradeOffers` takes an eligibility
(`hub`: the network has a hub, `slots`: the run had its first `DepartureHeld`); an ineligible card is removed from
the pool before the draw, so its place goes to the other aircraft and a board can show only the two aircraft
(the board UI already lays out any count). The draw stays on the `upgrades` RNG stream. `CURFEW_ENDLESS_START_WEEK`
4 → 3 (Endless and Daily; puzzles keep their own curfew lists; extra curfew airports still every 2 weeks from the
start week). Older saves are replayed under v6 (D-76); the v5 golden is frozen as `save-golden-v5.json`.
Numbers (bot, before → after): `test:balance` 50 seeds median 17.03 → 17.25 min (inside 10–18, D-79), board 1/2
reach 100 %/66 % unchanged; `r8-audit` 200 seeds median 16.52 → 16.64 min, p90 22.4 → 22.8; "+2 slots" offered
239 → 4 times and hub expansion 235 → 360 (hubs exist on almost every board, so the hub card now takes the place
slots used to); boards with a card that could not act 100 % → 0 % by construction; runs reaching curfew weeks
29 → 134 of 200 and runs with a curfew hold 20 → 123 (10 % → 62 %, target ≥ 50 %). The bot still almost never takes
the hub card (2 of 360), so the share of boards with a card it values did not change much — a human may.
Test changes: the golden save's policy never causes a departure hold before its save point, so its "+2 slots"
coverage moved to `test:slots` (the bonus survives a snapshot); `test:bot-policy`'s week-1 "+2 slots" check now
answers the first board that offers the card (seed 0xA1AA, board 2) and checks the pick is accepted and the run lasts
another game day (it takes 2 boards vs 3 with a turboprop — the R8 finding, left for humans); `test:replay` finds
its slots board on seed 0x0001; `test:e2e:curfew-barrier` uses 0xA1A2 (0xA1A1 ends in week 2 since rules v5, so the
e2e had no curfew to see). **Status: in force (N12v).**

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

## D-164 — A puzzle's reference network must win in any order of its strips (2026-11-04, Claude, ext/04)
Each connect costs one game minute, so the order in which a player taps the strips shifts every plane's first
departure. On long legs this can decide a jam: puzzle 35 (ext-02) cleared in its reference order but jammed
Singapore in 17 of 40 random orders. `test:long-haul` now replays every long-haul reference in 8 orders (forward,
reverse, 6 seeded shuffles; hub upgrades after the strips, because a city is a hub only once it has routes) and each
must clear the goal; the ≥ 15 % margin stays a property of the reference order (in other orders the result moves by a
few per cent, e.g. 40: 1 224–1 376). Fix for 35: Singapore holds 210 instead of 190 waiting passengers and the
target is 1 147 (was 1 154): still 1 of 1 525 networks, still only with the Sydney upgrade, now 60 of 60 orders.
Rejected: knife-edge capacities that make a hub upgrade decisive only in some orders (tried for 37 and 40).
**Status: in force (ext/04).**

## D-165 — "Long haul" 36–40: the second half of the pack (2026-11-04, Claude, ext/04)
Same method as D-163 (every network the stock allows, on the real Sim, plus D-164's order check), two 3-day weeks
each, all starts outside Europe, every one with an ocean leg only a widebody flies:
36 North Pacific (Tokyo feeds Los Angeles-bound traffic; chaining Osaka–Busan and Seoul–Shanghai instead of a star,
Osaka under curfew, Shanghai wave in week 2; 1 of 284 networks), 37 Two oceans (Johannesburg to Bombay and Perth,
Cape Town under curfew must not get its own ocean leg; 2 of 681), 38 Andes queue (four turboprop spokes queue for
Bogotá's slots, Lima's week-2 wave needs its own widebody to Accra; 11 of 1 583, all with the same two widebodies),
39 Gulf to Sydney (Dubai–Sydney is beyond range, Singapore is the stopover, Sydney under curfew, Johannesburg wave in
week 2; 16 of 3 647, all with the same Singapore pair), 40 Last call (5 continents from Nairobi, São Paulo under
curfew, Bombay–Sydney at the edge of widebody range; 3 of 2 444, all with the same four widebodies). Reference margins
+15 % (36–39) and +16 % (40), below 26–30 (+17…18 %). No hub upgrade in 36–40: in 37 and 40 the +6 seats decided only
on a knife edge that broke in some strip orders (D-164), so robustness won over an MCT tag; each level carries at
least two of slots/curfew/week. Titles keep every word ≤ 8 letters so the 320 px board never splits one.
**Status: in force; difficulty is a proposal for the owner to playtest (as D-70).**

## D-166 — Puzzle titles never split a word on the 320 px board (2026-11-04, Claude, ext/05)
The departures board sets titles in a narrow mono column with `overflow-wrap: anywhere`, so at 320×568 every word of
9+ letters broke mid-word ("ATLANTYK-U", "CONNECTIN-G"): 12 PL and 10 EN titles of 1–30. They are shortened with the
same sense, every word ≤ 8 letters: EN 02 Change of planes, 06 Three lands, 07 Change at Accra, 08 Night flights,
13 A long chain of flights, 14 Four lands, one path, 16 Hourly bank on the Main, 21 Bosporus link, 22 Gulf junction;
PL 02 Lot przez węzeł, 03 Lot do Afryki, 06 Trzy lądy, 07 Węzeł w Akrze, 13 Łańcuch lotów, 14 Cztery lądy, jedna
trasa, 16 Godzinna fala nad Menem, 17 Obok śpiącego węzła, 21 Węzeł nad Bosforem, 22 Rozstaje nad Zatoką, 23 Noce na
południu, 29 Brama na Atlantyk. `test:e2e:screens-fit-320` measures each title word with a DOM `Range` (one line box
per word) in PL/EN at 320×568 and 568×320. Rejected: `overflow-wrap: normal` (a long word would then overflow the
column instead) and a smaller font (already 12 px at this width). **Status: in force (ext/05); wording is a proposal.**

## D-170 — Globe look: direction B "Realistyczny" (satellite Earth) (2026-11-03, owner)
On the owner's Galaxy Fold the low-poly diorama globe read as large angular terrain facets, blocky mountains, orange
desert blobs, tree noise and a flat sea; the owner asked for "more realistic". Three directions were rendered from
the game engine itself (DEV flag `?globeLook=`, seed 15 = the owner's screenshot frame: Tehran, Lahore, Tashkent,
Almaty; day and dusk; Fold 1812×2176 and phone 412×915; `docs/mockups/globe-2026-11/`): A refined diorama, **B
realistic** (NASA Blue Marble NG colours, Black Marble city lights, NOAA ETOPO5 relief, cloud shell, ocean glint,
sun-aware atmosphere), C painted in-between. The owner chose **B** ("O ten kierunek jest ok"). The airport objects,
routes, planes and the paper/airport-artefact UI of D-11 stay; only the globe surface changes. Supersedes the
globe part of D-11 (world style A "Diorama"); D-05 (not minimal) is met by a real, lit, relief-rich Earth. Plan in
`docs/mockups/globe-2026-11/PLAN.md`, steps G1–G9 in `docs/NIGHT-BACKLOG.md`. Rejected: A (still reads as a
diagram where mountains are hand-traced bands), C (muddy at phone size, the simplification removes the realism the
owner asked for). **Status: accepted by the owner 2026-11-03; shipped on `dev` with G1–G3 and G9 (2026-11-04); G4–G8, G9b pending.**

## D-171 — Bundle `total` budget for the satellite globe (2026-11-03, Claude, ext/03)
B ships ~1.8 MB of textures (day 4096 + 2048, night 2048 + 1024, elevation, clouds) and the Mapa mode (D-172) ~0.55 MB more. The D-143 `total` budget
(2 200 kB, measured 1 805 kB) is raised to 4 300 kB in G1; main JS and CSS budgets are unchanged (the look adds
code, not a chunk). Rejected: streaming the 4096 texture from the network (the app must work offline, Capacitor
loads from disk) and shipping only 2048 (visibly soft at Fold zoom 2). **Status: in force (G1: `public/data/globe/`,
`test:globe-assets`, `scripts/test-bundle.mjs` `total` = 4 300 kB).**

## D-172 — Two globe modes, "Satelita" and "Mapa", like a maps app (2026-11-03, owner)
Owner, after choosing B: "Może zrobić dwa tryby jak w Google Maps. Realistyczny i taki jak mapa." The globe gets two
surface modes over the same relief mesh: **Satelita** (B, D-170) and **Mapa** (a cartographic surface; its look is
being chosen from the owner's reference screenshot). Switching swaps only the surface textures (no terrain rebuild),
so the cost is a second texture set (~0.5–0.8 MB) and one texture upload. Owner's answers: **Satelita is the
default** on first launch; the mode is switched in **Settings (remembered) and by a luggage tag in the in-game
dock** for quick changes. The Mapa mode must still respect the forbidden list (no flat pastel background, no
subway-map look) and D-05: it stays a lit 3D globe with relief. Mapa look: the owner's Google-Maps-like reference,
rebuilt in our own palette with ETOPO5 hillshade and Natural Earth borders (no copied colours, no labels).
**Status: in force (G8, 2026-11-04): Settings → Display → Globe view (`globeMode`, default `satellite`) and a sixth dock
tag (own globe/folded-map icons) swap the surface textures (`GlobeInstance.setSurfaceLook`, no rebuild; clouds only in
Satelita); `public/data/globe/map-{4096,2048}.jpg` (+0.54 MB); the dock grid has six columns (60 px at 412, 49 px at
320). Mapa readability: G9b.**

## D-173 — Adaptive quality steps down the globe texture first (2026-11-03, Claude, ext/03)
With B the largest GPU cost is the 4096×2048 day texture (~43 MB with mips, uncompressed). The D-73 ladder gets a
first step "day texture 4096 → 2048, cloud shell off" before DPR → 1; `low`/`saver` start on 2048 without clouds.
If devices still run out of memory, G7b moves to KTX2/ETC1S compression (D-174 follow-up). **Status: in force for the start
sizes and the cloud shell (G2/G3: low/saver load 2048 + 1024, no clouds; G4: sea surface and haze folded into the terrain
shader, so low/saver draw one transparent layer — the halo — and medium/high two); the adaptive texture step itself is
still open (G7).**

## D-174 — The look experiment stays in the tree behind a DEV flag (2026-11-03, Claude, ext/03)
`src/render/globe/look.ts` (loaded with a DEV-guarded dynamic `import()`, so Vite drops it from the production
bundle), the `TerrainStyle` parameter in `terrain.ts` (default `diorama` is byte-identical), `?globeLook=` in
`src/game/world.ts`, `perf:scene --look`, the store-shot fixture knobs `storePlay`/`storeSunDot`, and the textures in
`dev/globe-look/assets/` (served by the dev server only; `dist/` unchanged). G1–G5 turn the `satellite` path into
the production globe and delete `refined`/`painted`. **Status: in force until G5.**

## D-175 — Airport pads, routes and planes get redesigned for the new globe (2026-11-03, owner)
Mockup measurement: on B the D-47 contrast is the best of all directions (day: airports 4.9–5.2:1, tags 9.2–12.9:1;
today's diorama 2.3:1), but on the first "Mapa" texture the white pads and pale-yellow dashed routes drop to
1.3–1.7:1. The owner: "Trzeba będzie poprawić te płyty lotnisk itp., bo to brzydko wygląda i nie pasuje." The airport
objects (pad, runway, terminal, hub ring, curfew barrier), route tubes and plane colours are redesigned so they fit a
realistic Earth and read ≥ 4.5:1 in both modes (e.g. a dark ink outline / mode-dependent ink in Mapa). It is an owner
style decision: Claude renders 2–3 variants from the engine first (plan step G9), nothing ships before the owner
picks one. Shapes keep distinguishing types (D-08, CLAUDE.md). **Status: accepted by the owner; variants pending (G9).**

## D-176 — Satellite texture month: July (2026-11-03, owner)
The Satelita surface uses Blue Marble NG **July 2004** (green northern hemisphere) instead of November (snow over
Siberia and Kazakhstan, matching the in-game November sun of D-63). The owner chose July over Claude's recommendation
(November). Consequence: winter sun on a summer Earth is accepted; the D-63 golden-dusk gate is re-checked in G3.
**Status: in force (owner).**

## D-177 — The D-47 contrast probe measures edges, not the layer median (2026-11-03, Claude, ext/03 G9)
The G9 variants (`docs/mockups/globe-2026-11/g9/`) put a dark outline around light airport pads and route tubes.
`measureLayerContrast` (`src/render/contrast.ts`) compares the median luminance of every pixel a layer changes with
the globe behind it, so a two-tone object averages to mid-grey: on the Mapa texture the outlined pads clearly stand
out in the PNGs while the probe moves only 1.4 → 1.6–2.2, and on Satelita the outline lowers the route score
(3.8 → 2.3). Before G9 ships, the probe reports per layer the contrast of the outer edge against the globe and of
the core against the edge, and the gate takes the better of the two (WCAG non-text contrast reads either boundary).
Rejected: keeping the median (penalises the standard map-symbol design) and a pixel-count threshold (fragile at
different zooms). **Status: in force (G9, `layerContrast(…, width)` returns `edge`, `core`, `median`; `ratio` = max(edge,
core); `test:render-layers` checks an outlined disc on a dark sea).**

## D-178 — Airport objects: V3 "Medalion" (2026-11-04, owner)
Owner on the G9 variants (`docs/mockups/globe-2026-11/g9/`): "Daj medalion i scalaj." The airport keeps the D-11
diorama object (light pad, dark runway, terminal with a type-coloured roof, hub tower) and gets a thick dark outline
ring (r = 0.037–0.038·s under the pad); route tubes get a dark ink outline (inflated back faces, +1 draw call per
route batch, 2 in total). `createWorldRenderer` defaults to `airportStyle: 'medal'`; `current`, `ink` and `apron`
stay for DEV comparison only (`?airportStyle=`). Probe (D-177, seed 15, phone, day): routes 5.1 diorama / 6.8
Satelita / 3.4 Mapa (were 2.2 / 3.8 / 1.3), airports 2.6 / 3.2 / 3.1 (were 2.3 / 4.9 / 1.4 with the median probe).
Airports, planes and the Mapa tags still miss 4.5:1: follow-up G9b. Store screenshots are regenerated with G6.
**Status: in force (owner).**

## D-179 — The satellite globe ships; the diorama stays only as a fallback (2026-11-04, Claude, G2/G3)
`createGlobe` defaults to `look: 'satellite'` (D-170): land heights from `public/data/globe/elevation-2048.png`
(ETOPO5, `0.0004 + 0.0052·√km`, airport pads flattened), smooth normals, the Blue Marble day texture by surface
direction, the shipped day/night grade (D-63/D-49) and Black Marble lights on the night side, the ocean shell, the
sun-aware halo and haze; the cloud shell from `medium` up (none on `low`/`saver`, D-173). Trees, rocks, puffy clouds and
the city-light points are not built (G5 deletes their code). If any texture fails to load, `createGlobe` logs once and
builds the diorama, so the game never starts without a world. `?globeLook=diorama|refined|painted|map` remains a DEV
comparison. G2 and G3 land as one PR because the textured terrain alone is white. The ocean/haze shells are shipped as
separate transparent layers for now; folding them into the terrain shader (fill rate, G4) and measuring on phones
(G7) are still open. Store screenshots are regenerated in G6. **Status: in force (G2/G3).**

## D-180 — Training flight fits its row; one tag outline; night darkens only the globe (2026-11-04, Claude, night N11l)
Owner feedback from a real Galaxy Fold (unfolded). (1) The world vignette was sized from `100dvh − 308 px`, which
ignores the status and gesture bars (`env(safe-area-inset-*)` padding), so the ATC card overflowed into the hint line
under it. The world is now fitted by a `ResizeObserver` to the height its row really has (minus the card, which may
wrap); the CSS estimate stays as the first-frame fallback, and the hint row gets its own 6 px gap. (2) The plane tag
and the dawn/continue actions were cut with a stepped notch that read as a second button behind them; they now use
the dock's luggage-tag outline (`hud.css`, chamfered top corners) — one shape, the game's own. (3) At night the world
box turned dark blue, a rectangle wider than the globe that also covered the header's lower strip; the night wash was
already clipped to the globe, so the box now keeps the stage colour. Rejected: container-query units (iOS 15 target
has none), clipping the card (hides text). The vignette's marks are redrawn later with R5b/R6a/R6b (D-129, D-130).
**Status: in force (N11l, `test:e2e:tutorial-layout` 7 sizes).**

## D-181 — Airport code plates: on the luggage tag, all at gameplay zoom (2026-11-04, Claude, night N11m)
Implements D-128 (Q-61 → C, R5a) after the owner's Fold screenshot: four runway discs and a pink glyph tag
("⋈⋈⋈", Middle-East passengers) with no airport to read. The plate is the airport's code (or name, D-68) in the
departure-board mono, written on the address field of the existing luggage tag before the passenger glyphs and
closed by a hairline; with nobody waiting the tag is the plate alone. So it reuses the tag's collision pass, never
sits on a passenger tag and needs no new marker. Who carries one: hubs, airports the UI is naming (jam countdown,
NEW stub, a departure-slot hold, curfew barrier), and every on-screen airport while the camera is at the gameplay zoom
or closer (`PLATES_ALL_ZOOM` 2.75; the run opens at 3 of [1, 4]). Interpretation of "zoomed in": the run opens
zoomed in on its region, and that is exactly the view the owner found unlabelled; the whole-network view (zoomed out
below 2.75) keeps only hubs and named airports, as D-128 intends. In `layoutTags` plate-only tags are placed last
(jam → passengers → plates): a plate never takes a passenger tag's room. Aria unchanged (the tag's label already
names the airport; the plate is `aria-hidden`). Rejected: a separate signboard object beside the disc (a second
collision system and a third tag-like mark), plates only above zoom 3.5 (the opening view would stay unlabelled).
**Status: in force (N11m, `test:e2e:airport-plates` 4 sizes, `test:overlay-layout` 21).**

## D-182 — Empty dock tags are opaque, muted and dashed (2026-11-04, Claude, night N11n)
R5d and the owner's Fold screenshot: an empty dock tag (no widebody, no hub upgrade, nothing to undo) was drawn at
42 % opacity, so the globe — at night, under a cloud — showed through and hid its icon. It is now opaque: a paler,
greyer kraft (`--airway-kraft-empty` #D9CDB8) with muted ink (`--airway-kraft-empty-ink` #5A4E44, 5.1:1, a declared
pair in `test:contrast`) and a dashed "empty rack" outline under the eyelet — a shape cue that does not depend on
colour (hard rule: types and states by shape). Tap behaviour unchanged (the tag still says why it is empty).
Rejected: a higher opacity (still see-through), grey icon only (colour-only cue). **Status: in force (N11n,
`test:e2e:dock-empty-tags`, `test:contrast` 17 pairs).**

## D-183 — A NEW mark is checked per airport, and week-2 e2e reach week 2 through the week-1 board (2026-11-04, Claude, night N11o)
Rules v5 (N12f) open an airport every 12 game hours, exactly the lifetime of the NEW mark (`NEW_MARK_TICKS`), so the
moment the first mark expires the next airport opens marked; `test:e2e:new-airport` asserted that no tag at all was
marked and failed on every seed. It now follows the first marked airport by its `data-airport` id: marked 40 ticks
before its 12 hours end, unmarked 20 ticks after, and no airport that was already open carries a mark. This is
stricter than before (it also proves the mark lasts) and still fails if the mark never expires. `transfer-glyphs`
used `autoplay(2)`, whose seed-0xA1A1 run now ends before the week-2 board; like N11j (D-132) it plays to the week-1
board and makes one plain pick. Rejected: another seed (the spawn interval is fixed, no seed avoids the overlap),
a shorter mark (a rules/UI change made to suit a test). **Status: in force (N11o, new-airport 4/4, transfer-glyphs 2/2).**

## D-184 — Training flight: three steps in the game's own marks, glyph legend in help (2026-11-04, Claude, night N11p)
Implements D-129 and D-130 (R5b, R6b). The vignette keeps route → aircraft → transfer and then "cleared"; "STEP n / 3".
Its cities are the game's airport object (the colours of `src/render/airports.ts`: pad, rim, runway, terminal; the
hub with a teal rim and its ring of waiting places) under the game's own luggage tag (`.airport-bubble` with the code
plate per D-68 and the real region glyphs), so nothing in the vignette looks unlike the game: the old orange
diamonds read like the route-end handles. The passengers fly London → Paris → Rome, so the one glyph sentence is
"Crescent = Southern Europe" (true for the drawing), not the R5b example "bow tie = Middle East". The dawn is one
sentence on the last step. `TUTORIAL_VERSION` stays 1: completed/skipped saves stay valid and an in-progress save
at a removed step simply restarts the short flight. The planet radius went 228 → 196 of the 412 art units, so it no
longer crosses the sides of a 412 px phone. Settings → help shows 8 rows of glyph + region name (own i18n keys).
Rejected: a hollow (in-connection) glyph in the vignette (one more idea in a 3-step flight), keeping "Paris · HUB"
as text (the ring says it, as in the game; the button's aria-label still says "hub").
**Status: in force (N11p, `test:e2e:tutorial` 28, `test:e2e:tutorial-layout` 7).**

## D-185 — One language table drives every language list (2026-11-04, Claude, night N12w)
R7f. `src/i18n/languages.ts` lists each game language once (code, Intl locale, plural order and the forms a token
must give, settings label key, store locale, which data name field it shows) and builds the lookups with
`createLanguageTable`. The `Language` type, `normaliseLanguage`, the plural order of `{n|…}` tokens, the number locale
of `formatNumber`, the settings select, airport city names (`localName`), the `test:android-config` check against
`locales_config.xml`/`CFBundleLocalizations` and the catalog checks of `test:i18n` all derive from it; behaviour is
unchanged (PL/EN only). `test:i18n` proves that a stub entry is enough for the derived lookups and fails when a module
outside the table or the catalogs spells out `'pl'`/`'en'` again. City and region names stay in the data's
`namePl`/`nameEn` fields until R7j (the table maps a language to one of them; a new language shows English names until
then). Rejected: a registry in `src/core/` (the catalogs and their checks live in `src/i18n/`) and generating the
native locale files from the table (they change rarely; a check is enough). **Status: in force (N12w).**

## D-186 — Leaderboard opt-out lives in the net layer, takes effect at once (2026-11-04, Claude, night N12x)
R7l, implementing D-135's objection path. `Leaderboards.isSharing()` / `setSharing(on)` (default on, stored on the
device as `aw-net-share-v1` = `'0'` when off, not in `IDENTITY_KEYS`: a restored backup keeps the player's choice).
Off: `submitDaily` answers `opted-out` without queueing, `flush` and `boards` make no network call, and turning it
off drops the runs still waiting in the offline queue (an objection must stop processing, not just delay it). The
anonymous identity is kept (removing it is the separate D-114 deletion). The official daily report shows
"Not ranked: sending results is off in Settings." / „Poza rankingiem: wysyłanie wyników jest wyłączone w
Ustawieniach.” (`rank.optedOut`). The settings switch itself is agent #1's UI work on this API. Rejected: keeping
the choice in `airway.settings` (the net layer would read the settings store; the deletion row already talks to
`Leaderboards`), and still submitting but hiding the result (the objection is about processing). **Status: in force
for the net layer (N12x); switch pending.**

## D-187 — The unserved game-over line follows the reserve (2026-11-04, Claude, night N12y)
R8b. When no route served the airport that jammed, the departures board's action line is chosen by the aircraft left
in the reserve at the jam (`GameOverSnapshot.spareAircraft`, pure `unservedHint` in `src/game/gameoverTip.ts`): with a
spare plane the old "Connect a new airport before its waiting area fills up."; with none (99 % of R8 losses) "No spare
aircraft: drag a route end to it, or remove a quieter route to free its plane." / „Brak wolnych samolotów: przeciągnij
do niego koniec trasy albo usuń mniej obłożoną trasę, żeby zwolnić jej samolot.” The backlog's "take a plane off a
route" became "remove a quieter route": the game UI has no single-plane unassign, only removing a route returns its
aircraft. Unknown reserve (older callers) keeps the old line. Metric: unserved losses whose hint names a move the player
could make, 0 → 100 % (both branches). **Status: in force (N12y).**

## D-188 — The balance bot frees an idle aircraft for an unserved airport (2026-11-04, Claude, night N12z)
R8e. `src/game/dev/bot-policy.ts` gets one last step: when an active airport has no route, the reserve is empty and
no served route end can reach it, the bot sends one aircraft that is on the ground and empty back to the reserve
(`UnassignPlane`), taken from the route with the least waiting per plane that has two or more (every route keeps one),
of a type that reaches the airport; the next decision opens the new route with it. A jam at an airport without a
route is now connected before spare aircraft go to busy routes. Measured (`r8-audit --policy=bot`, 200 seeds, before
→ after): unserved-airport losses 52 → 48, median 16.64 → 16.64 min (p10 9.8, p90 22.8 unchanged), score p50 271.5;
`test:balance` 50 seeds median 17.25 → 17.25 (inside D-79's 10–18). The effect is small because the bot opens a route
per aircraft (at the loss every route has one plane in 35 of 37 sampled unserved losses), so "keep one per route"
leaves little to move. A variant that also closed a redundant one-plane route (all its airports keep another route)
cut unserved losses to 46 but lowered the median to 16.15 min and the score, so it was not kept. Note for the UI: a
player cannot take a single aircraft off a route today (no unassign gesture; only removing a route frees its planes,
D-187). **Status: in force (N12z); no gate changed.**

## D-189 — e2e seeds live in one file and are replayed headless in test:fast (2026-11-04, Claude, night N12aa)
Five browser suites were red on clean `dev` since rules v6 (N12v) because their fixed seeds ended the bot's run before
the board they test: board-short 0/4, edge-chip-airports 0/2, edge-chip-tags 5/6, run-timeline 0/4, upgrade-picks 4/6.
Their seeds and bot plans now sit in `e2e/seeds.mjs` (each suite reads its seed from there; the shared harness `SEED`
0xA1A1 stays for the other suites). `scripts/lib/e2e-plans.ts` replays each plan headless on the current rules with
the same `EndlessRun`, DEV bot, card click (queue + `resolveBoundary`) and forced overload as `window.aw`; because the
browser clock keeps running between calls, a plan must hold on 7 idle offsets (0, 1, 3, 7, 15, 30, 60 ticks after the
start and after every card). New fast suite `test:e2e-seeds` (7 cases, ~7 s; 2/7 on the old seeds) fails in
`test:fast` as soon as a rule change breaks a suite's seed; `npm run e2e:seeds -- <suite>` prints the first seed after
the current one that holds (deterministic scan). New seeds: board-short and run-timeline 0xA1A2, edge-chip-airports
and upgrade-picks 0xA3AA (the first after 0xA1A1 with a "+2 slots" board on all offsets: "+2 slots" is drawn only
after a departure hold, D-150), edge-chip-tags 0xA1C3 + 41817. Assertions unchanged; upgrade-picks' "Back took
nothing" now compares with the count before the pick (the "+2 slots" board is week 3, earlier crates exist). The PL
320×568 week-1 board scrolled 1 px since the N11r stamp caption (D-194): that size trims 3 px of stamp spacing.
**Status: in force (N12aa).**

## D-190 — First-time cards: one registry, four cards, never stopping time (2026-11-04, Claude, night N11p)
Implements D-130 (R6a). `src/game/tutorial/first-time.ts` holds one versioned storage key (`aw-first-time`,
`{v:1, seen:[…]}`) and pure triggers; the task-32 slot hint is the registry's `slots` card but keeps its old flag
(`aw-tutorial-slots`) so existing installs do not see it again. Cards: first hub at ≥ 70 % of its waiting places
(bypass or expand), first new airport whose nearest open airport is beyond turboprop range (widebody from a crate),
first curfew night, and right after the first weekly board closes (what a crate is and where its aircraft wait) —
after, not on, the board, which already fills a phone screen. A card is marked when shown, uses the slot hint's ATC
strip with a 48 px OK, leaves after 12 s, is `aria-live=polite`, never pauses, waits while the slot hint or the
board is up, and only one is on screen. Endless and Daily only (puzzles teach their own mechanic). DEV seeded runs
(`aw.prepareSeed`, store shots) turn them off so existing E2E, matrix and store screens are unchanged;
`prepareSeed(seed, { firstTime: true })` turns them on. Rejected: pausing for each card (the owner's B keeps the
run flowing), a card on the weekly board itself (covers crates in landscape).
**Status: in force (N11p, `test:first-time` 7, `test:e2e:first-time-cards` 4).**

## D-191 — Route-end handles: a quiet hollow mark at rest, full only on the route in hand, under the tags (2026-11-04, Claude, night N11q)
R5c: the 20 px yellow diamonds on every route end out-shouted the airports and their luggage tags, and their layer
(z-index 18) painted over the tags. At rest a handle is now a 10 px hollow diamond (2 px ink rim, paper halo) centred
in the unchanged 48 dp area; the full yellow diamond shows only on the route being extended from its end or selected
with the long-press menu (`RouteTool.activeRouteId`, passed to the `handles` port). The handle layer sits at z-index 1,
below the airport overlay (2), so a tag or edge chip always covers a handle, never the reverse; touch hit testing
stays in `routeTool` and does not depend on paint order. Rejected: hiding handles at rest (the extend gesture would
have no visible start), a hover state (touch first; the finger case is the drag itself).
**Status: in force (N11q, `test:e2e:route-handles` 2).**

## D-192 — "Replay tutorial" also brings the first-time cards back (2026-11-04, owner Q-76 → B, Claude, night N11r)
The owner chose B for Q-76: one button. `TutorialController.replay()` (both the settings "Replay tutorial" and the
training flight's own replay) now calls `clearFirstTimeCards()` (`src/game/tutorial/first-time.ts`), which writes
an empty `aw-first-time` list and clears the task-32 slot-hint flag, so a player coming back after a break sees each
card again at its own moment in the next run. The run in progress keeps its registry (read when the game screen
opens); a fresh game reads the cleared flags. Rejected: A (cards stay gone), C (a second help button).
**Status: in force (N11r, `test:first-time` 8, 7/8 on the old controller).**

## D-193 — "Long haul" (31–40) stays out of release builds until T+4 (2026-11-04, owner Q-74 → B, Claude, night N11u)
The owner chose B: the first puzzle pack is the content of the T+4 "Major update" store event (D-131), so a release
build shows puzzles 01–30 (DEV builds 40). A build-time flag, no remote config: `PuzzlePack.hiddenInRelease` in
`src/data/puzzles/packs.ts` (set on `longHaul`) and `releasedLevels()` drop a hidden pack's levels (from its first
level to the next pack) unless the build is DEV (`npm run dev`, every e2e, shots and the UI matrix, so
`e2e:puzzles` and `screens-fit-320` keep covering 31–40) or was made with `VITE_AW_ALL_PACKS=1` (a release check
build before T+4). Node tests have no Vite env and see all 40. At T+4: remove `hiddenInRelease`. Saved
progress for 31–40 from a DEV build is ignored in a release build (the board lists only exposed levels). Rejected:
deleting the JSON files from the branch (the pack would rot untested), a remote switch (no server for it, D-16).
**Status: in force (N11u, `test:release-packs` 4).**

## D-194 — Crate stamps name what they measure; an empty hub reads "none yet" (2026-11-04, Claude, night N11r)
R5e: the red stamps "BEG 9/36" and "BEG 13 min" were a code and a number with no word. Each stamp now carries a
small caption line inside the same red box ("fullest hub" / "longest slot wait"; PL "najpełniejszy hub" /
"najdłuższe czekanie na slot", 10 px Atkinson caps above the 12 px mono value) and the card's aria text reads
"caption: value". When the fullest hub has nobody waiting, both the hub stamp and the pause sheet's "Fullest hub" row
say "none yet" / "jeszcze brak" instead of "MAD 0/36" (a 0 next to a capacity read as a measurement of a jam).
"No hub yet" stays without a caption (it is not a measurement). Rejected: caption outside the stamp (it would read as
a card field), "MAD 0/36 · nobody waiting" (longer, wraps on 320 px).
**Status: in force (N11r, `test:crate-stamps` 5, `test:pause-summary` 6).**

## D-195 — One word per concept in PL/EN, guarded by test:i18n (2026-11-04, Claude, night N11t)
R5g: the catalogs mixed "siatka" and "sieć" for the network, "terminal" and "węzeł" for a hub, and the PL game-over
title "Siatka wstrzymana" (a pause you come back from) did not mean the same as "Network closed" (the end). The
glossary in `src/i18n/README.md` fixes crate/skrzynia (what a crate holds is an upgrade/ulepszenie), hub/hub,
network/sieć; PL game over is now "Sieć zamknięta" (title, map view, timeline: "sieć zamknięta", "bez zmian w
sieci"), puzzle copy says "hub" ("Pojemność hubów" / "Hub capacity", "hub {city} jest przepełniony", "Ciasny hub" /
"A tight hub", "Obok śpiącego huba", and the ext/05 short titles "Lot przez hub", "Hub w Akrze", "Hub nad
Bosforem"). `test:i18n` fails on a banned synonym in any catalog value (EN grid, node,
terminal, cargo/freight label, simulation; PL siatka, węzeł, terminal, etykieta frachtowa, symulacja, all inflected
forms, Unicode word boundaries), except the two diegetic signs `menu.terminal` and `puzzle.board.subtitle`.
Puzzle 17's title (ext/05: "Obok śpiącego węzła") becomes "Obok śpiącego huba"; the old word read better; it follows the rule unless the owner prefers the
exception. The D-18 PL store title ("Buduj siatkę lotów") is outside the catalogs: Q-77.
Rejected: "Siatka zamknięta" (keeps two words for the network).
**Status: in force (N11t, `test:i18n` with the glossary check, 12 failures on the old catalogs).**

## D-196 — balance:report prints the spread and mechanic use, counted from sim events (2026-11-04, Claude, night N12ab)
R8d. `game-summary.md` gains a "Spread and mechanic use" section: session length and game weeks at p10/p25/median/
p75/p90, loss-week histogram, losing airport hub / spoke / unserved, spare aircraft at the loss, weekly cards offered
vs picked, runs reaching the curfew and with a curfew hold, slot holds and slot-wait, and the share of delivered
passengers who changed planes. Counted in `scripts/balance-game-adapter.ts` (`RunMechanics`) from the sim's own
events and read-only views, not by wrapping prototypes as `r8-audit.ts` does; for that the sim gains two
non-authoritative event facts (never hashed or saved): `CurfewHeld` (one aircraft-minute refused by the curfew gate,
ground or air) and `Delivered.afterTransfer` (passenger had alighted at a hub before, `arrivedOnRoute` set). Gameplay,
goldens and the gate are unchanged (median 17.25 min before and after). No new gate: `test:balance` only checks the
section's shape (ordered quantiles, losses + still flying = runs, hub + spoke + unserved = losses, picks = accepted
choices, picked ≤ offered, delivered = score). The numbers match `r8-audit --seeds=50 --cap-min=30` except curfew
aircraft-minutes, where r8's `canLand` wrapper also counted the check inside `canScheduleLeg` (r8 air 586 vs 89 here).
**Status: in force (N12ab).**

## D-197 — The leaderboard objection switch in settings (2026-11-04, Claude, night N11v)
D-135 / R7l: the net layer has `Leaderboards.isSharing()` / `setSharing(on)` since N12x (D-186). Settings → Help
now shows "Send results to the leaderboard" / "Wysyłaj wyniki do rankingu", an ordinary settings switch (on by
default, ≥ 48 px, the ON/OFF ink of the other switches) with one hint line saying what off does (results stay on the
device, waiting runs are dropped). It sits after the privacy policy and before "Delete my ranking data" and, like
that row, exists only when the build has leaderboards (`Leaderboards.enabled`). The choice lives in the net layer's
own key (`aw-net-share-v1`), not in the settings record, so the daily report and the board read the same truth.
Rejected: the switch in the Game group (it is a privacy choice next to the policy and the deletion).
**Status: in force (N11v, `test:e2e:ranking-switch` 4).**

## D-198 — An empty dock tag counts down to the next crates (2026-11-04, Claude, night N11s)
R6c: in week 1 the turboprop, widebody and hub tags read "0" for about 7 minutes. An empty aircraft or hub tag now
stacks its icon over a small wait line, the game minutes left to the weekly board from the run's own clock
(`nextWeekTick − tick`): "2 days" / "2 dni" (PL plural forms), then "5 h" / "5 godz.", then "40 min"; its aria-label
adds "Next crates in 2 days 5 h" (the pause sheet's wording). The tag keeps the N11n opaque muted fill and dashed
outline; Undo (never a count) and puzzles (no weekly board) are unchanged. A crate can hold any of the four upgrades,
so the line says when the next choice comes, not that this aircraft will arrive. No sim change.
Rejected: "crates day 3" (the D-40 three-day week makes "day 3" ambiguous across weeks and does not fit a 52 px tag),
a separate countdown chip (one more HUD element, D-05/minimal HUD).
**Status: in force (N11s, `test:dock-countdown` 3, `test:e2e:dock-empty-tags` 4).**

## D-199 — The HUD target test counts seven controls; the landscape rack shrinks its tags to fit (2026-11-04, Claude, night N11w)
G8 (#178, D-172) added the globe-view tag to the dock, so the HUD has seven controls (pause on the boarding pass and
six dock tags) and `test:hud-targets` failed 293/300 on clean dev (five "six controls" checks plus the landscape
case below). The test now expects seven and asserts the new tag on its own: ≥ 48 dp, in line with the dock (same row
in portrait, same column on the landscape/foldable rack), in order between hub and speed, also after a live
rotation, and a tap emits `onToggleGlobeMode`. The count was not loosened to "≥ 6". Fixing the test showed a real
fault the count had hidden: on a 915×412 landscape phone with 24/16/22/16 insets six 58 px tags need 348 px but the
rack has 326, flex items do not shrink below their content, and the speed tag ended 1 px inside the bottom safe area.
The rack holders now shrink (`min-height: 48px`) and the tag fills its holder (`height: 100%`, max 58 px): 54 px tags
at that size, unchanged on foldables and wherever there is room. Rejected: dropping a tag from the rack in landscape
(every control must stay reachable), a smaller fixed height everywhere (foldables have room).
**Status: in force (N11w, `test:hud-targets`).**

## D-200 — every bot-driven e2e suite reads its seed from e2e/seeds.mjs and is replayed headless (2026-11-04, Claude, night N12ac)
Extends D-189 from five suites to all suites that play a fixed seed with the DEV bot or idle ticks. Moved (seed
unchanged, assertions unchanged): airport-plates, continue-framing, curfew-barrier, edge-chip-fill, edge-dock,
first-time-cards, focus-pause, gameover-map, gameover-short, gameover-tip, gameover-unserved (its served-jam seed
0xA1A3 as `gameover-unserved:served`), logbook, new-airport, pause-summary, pick-sign, pseudo-locale, transfer-glyphs,
undo-after-upgrade. The plan vocabulary in `scripts/lib/e2e-plans.ts` gains play-outs to a game over, a jam on a
served/unserved airport with the spare-aircraft count, idle play without the bot (`drift`, `opens`), hourly bot play
(`botStep` + 60 ticks) until a curfew closes or ends, minute stepping until a transfer is inside its connection time
and that airport's clear, a minimum route count, and the four first-time card triggers (the same `fillingHub` /
`beyondRange` / curfew / weekly-board conditions the session uses). Only sim state is checked: what is on screen
(tag positions, edge chips, gauges) stays with the browser suite. Not moved: smoke, leaderboard, daily-share and
daily-continue build their network by gestures on visible airports (or play the date's daily seed), so they have no
bot plan; their forced overload needs no seed. `test:e2e-seeds` 5 suites / 7 cases → 24 / 30, all passing on the
current seeds; on 0xA1A1 the curfew-barrier, gameover-tip, served-jam and first-time-cards plans fail as their suites
did before N12v/N12y re-seeded them. **Status: in force (N12ac).**

## D-201 — the balance bot takes the hub expansion when a hub is filling up; the card itself waits for the closed test (2026-11-04, Claude, night N12ad)
The bot took "Rozbudowa huba" 1 of 94 offers (N12ab). New read-only tool `scripts/research/card-value.ts` replays,
for every board that offered a card the bot skipped, the same seed with only that board answered by the card (paired,
deterministic). Hub expansion on 200 seeds, 60 min cap, 358 such boards: −0.99 min and −39 score on average; −2.49 min
where the bot took a widebody, −0.06 where it took a turboprop, but **+0.55 min / +17.5 score (18 longer, 8 shorter)
when the fullest hub was ≥ 70 % full and the bot took a turboprop**. So both: the card is weak in general (forced on
every board: mean 16.57 → 14.93 min, score 271.5 → 201.5 on 200 seeds; unserved losses 14 → 35 of 50), and the
policy ignored the one spot where it pays. Policy fix in `src/game/dev/bot-policy.ts`: the hub card outranks a
turboprop when the fullest hub is ≥ 60 % full (`HUB_CARD_FILL`) and at most one airport has no route
(`HUB_CARD_MAX_UNSERVED`); a needed widebody still wins. Sweep (200 seeds, 60 min; mean / p50 / score / unserved
losses / hub picks): off 16.57 / 16.64 / 271.5 / 48 / 1 %; fill 0.6 without the unserved limit 16.72 / 16.75 / 279 /
65 / 22 % (test:bot-policy failed: 7 of 19 unserved, limit 6); **0.6 + ≤ 1 unserved 16.74 / 16.75 / 279 / 54 / 11 %**;
0.7 or 0.8 + ≤ 1: 16.68 / 16.75 / 278 / 51 / 6–7 %. After the fix the skipped boards with a hub ≥ 70 % are neutral
(+0.02 min, n = 30). Gate (50 seeds, 30 min): median 17.25 → 17.41 min (10–18), 1st/2nd board 100 % / 66 %, hub
picks 1 → 7 of 95; `game-50.csv` and `game-summary.md` regenerated. No game rule changed (D-113: tune after the closed
test). Card tuning measured for the owner (Q-78): +12 or +18 places and a 10-minute connection change nothing (forced
14.99 / 15.02 min); a hub card that also brings a turboprop (forced 15.34 / 231 vs always-turboprop 15.10 / 216.5)
would beat the plain turboprop and empty the board choice. **Status: in force (N12ad); card tuning: Q-78.**

## D-202 — Edge-chip placement is a pure function in overlay-layout.ts, with the old loop as its test oracle (2026-11-04, Claude, night N11x)
R5h: `distributeEdges` (+ `edgeLayout`) lived inside `createAirportOverlay`, was patched three times (N10v markers,
N10z tags, N11 jammed priority) without a unit test and scanned every airport for every candidate place
(O(n²·k) per frame). It is now `projectEdgeChip(chip, dx, dy, lon, bounds)` and `placeEdgeChips(chips, tags,
bounds)` in `src/ui/overlay-layout.ts`: no DOM, no three.js, no per-frame allocation (module scratch arrays); the
overlay keeps one `EdgeChip` per airport parallel to its tag slots and the right dock band moved into `EdgeBounds`.
Behaviour is meant to be identical, so `test:overlay-layout` carries a verbatim port of the old loop and compares
the two on 200 random portrait/landscape scenes (200/200 identical), plus rule tests (jammed chip wins, a full edge
hides chips, never on an on-screen marker, avoids tags while there is room, projection sides and dock band,
deterministic). Cost on a 150-airport scene (100 off screen, Node, same harness): old 0.43–0.50 ms, new 0.14–0.16
ms per frame (~3×): on-screen airports are collected once and filtered per chip to its strip along the edge,
placed chips are kept per side, and the slide stops when both directions leave the edge. Budget in the test: < 1 ms.
Rejected: a spatial grid (more code for the same result at ≤ 165 airports). **Status: in force (N11x).**

## D-203 — "Sieć" in the Polish store title and description (2026-11-04, owner, Q-77 → B)
The game calls the network "sieć" everywhere (D-195), while the D-18 PL store title read "Buduj siatkę lotów" and the
description said "siatka połączeń" / "siatka lata dalej". The owner chose B: the player reads the same word in the store
as in the game, and the title can still change before the first release. Approved full PL title **"Airway: Buduj sieć
lotów na globusie"** (36 characters, supersedes the D-18 PL title), store-field title **"Airway: Buduj sieć lotów"**
(24 characters, ≤ 30; was "Airway: Buduj trasy lotów"), description and the night caption say "sieć". EN title
unchanged. `test:store-shots` holds the new title and fails on "siatka" in `docs/store/pl.md`. The committed store
screenshots still show the old game-over title "SIATKA WSTRZYMANA" in `docs/store/shots/manifest.json` text; they are
regenerated with the next `store:shots`. Rejected: A (keep "siatkę", the D-18 title), C (description only).
**Status: in force (N12ae).**

## D-204 — Hub-expansion card stays as it is until the closed test (2026-11-04, owner, Q-78 → A)
N12ad measured "Rozbudowa huba" (+6 places, connection 25 → 15 min) as weak on its own and useful only at a full hub
instead of a turboprop, which the bot now does (D-201). The owner keeps the card unchanged (rules v6) and evaluates it in
the closed playtest with people (D-113: tune after it). Rejected for now: B (hub + turboprop in one card — always better
than a turboprop, the board choice disappears), C (+12/+18 places — no measurable effect), D (another hub effect — not
measured yet). **Status: in force; revisit after the closed test.**

## D-205 — Decision and owner-question numbers are unique and decisions ascend, guarded in test:fast (2026-11-04, Claude, night N12ae)
Two agents take D- and Q-numbers in parallel, and dev had D-196 twice (N12ab's balance report and N11s's dock
countdown, the latter renumbered D-198 in N11v), Q-77 twice (N11t's store wording and ext/05's puzzle titles), D-202 taken by N11x while this item had reserved it
(this item moved to D-203…D-205), and
decisions appended out of order (D-86 after D-90, D-150 after D-179, D-164 after D-187, D-197 after D-200, …). The
sections of `docs/DECISIONS.md` are now sorted by number (text unchanged, only blank lines between sections
normalised); the ext/05 puzzle-title question became Q-79 (N11t kept Q-77, which the owner answered as D-203). New fast
`test:doc-ids` (`scripts/test-doc-ids.mjs`): every `## D-NN` heading once and ascending, every `| Q-NN` row of
`docs/OWNER-QUESTIONS.md` once, plus a self-check on synthetic text. A new decision goes in its numeric place, not at the
end of the file. **Status: in force (N12ae).**

## D-206 — Every safe-area inset goes through the --aw-safe-* tokens; a notch profile tests them (2026-11-04, Claude, night N11y)
R5j: only the HUD read the `--aw-safe-*` tokens (`src/ui/base.css`, task 25); menu, settings, upgrade, game over,
tutorial, puzzles, ATC strip, the overlay fixture and theme CSS used 56 raw `env(safe-area-inset-*)`. Chromium
cannot emulate `env()`, so no browser suite ever saw those insets. All 56 now read the tokens (same values on
devices: the tokens are `env()` with a 0 px fallback), and where a screen ignored a side it now keeps clear of it:
the menu notice (left/right, and its landscape top/right), the departures board and the sign's width (left/right),
the tutorial settings dialog (right). Guards: `test:safe-area` (fast, headless) fails on any raw `env()` outside the
four token definitions (56 on the old CSS); `test:e2e:notch` (ci, ~40 s, no globe so SwiftShader does not slow it)
sets the tokens on `:root` to iPhone-like values (portrait 393×852 59/0/34/0, landscape 852×393 0/59/21/59) on
menu, settings, puzzle board, upgrade board, game over and HUD in PL/EN and fails on any visible control inside an
inset (content inside a scroller that can still scroll toward an inset may pass under it). 24/24 now, 14/24 on the
old CSS. Rejected: a notch profile in `ui:matrix` (it plays the real game on the globe, which times out under
SwiftShader since G2–G4; the component mounts test the same CSS), per-screen inset variables (one token set is the
contract). **Status: in force (N11y).**

## D-207 — "+2 slots" keeps the D-150 offer rule; the card's value is measured, its future is a closed-test question (2026-11-04, Claude, night N12af)
The card has appeared about 3 times per 50 runs since D-150. `scripts/research/card-value.ts --card=slots` (now with
offer counts, the first-hold minute and a research-only `--slots-rule=always` what-if) on 200 seeds, 60 min cap: under
the rule 4 of 364 boards offered it (3 runs), the bot never took it, and forcing it lost −2.82 min on average (0 of 4
longer). Only 12 of 200 runs ever hold a departure (median at 11.6 min), so the rule is rarely met because the hourly
cap (D-46) rarely binds for the bot, not because the rule is too strict. With the card eligible from week 1 it is on
240 of 358 boards (161 runs), still never picked, worth −1.10 min when forced (−0.42 instead of a turboprop, no
positive subset), and the bot's mean drops 16.74 → 16.45 min because the card takes a place from the hub card or the
second aircraft. No rule changed (D-113); whether people reach the cap is asked in Q-80. Numbers in
`docs/balance/README.md` "N12af". **Status: in force (no change); revisit with Q-80 after the closed test.**

## D-208 — smoke and leaderboard read their seed from e2e/seeds.mjs; their pointer drags are replayed headless for every start pair (2026-11-04, Claude, night N12ag)
N12ac left smoke and leaderboard outside `test:e2e-seeds` because they build their first route with pointer drags
(`window.aw.gesture`), not with the bot. The drags are two Commands: the route tool's `AddRoute` between the pair that
`session.routeGesture()` finds (first pair of on-screen start airports within the dock's turboprop range) and the
dock-tag drop's `AssignPlane` on the first route whose aircraft is in reserve. New plan step `{ gesture: 'route-plane' }`
in `scripts/lib/e2e-plans.ts` sends exactly these. Which airports are on screen depends on the camera and viewport
(`src/render`, not replayable without a browser), so `checkPlan` runs a gesture plan for **every** start pair within
range (6 on 0xA1A1) × the 7 idle offsets: a superset of what any viewport can pick. Plans: smoke = drags, week-1
board, plain card, forced overload; leaderboard = drags, 240 ticks alive, forced overload. Both suites now take
`E2E_SEEDS.smoke/leaderboard.seeds[0]` (0xA1A1, unchanged). Still outside: daily-share and daily-continue (seeded by
the date). The on-screen filter itself and the drag hit-testing remain browser-only. **Status: in force (N12ag).**

## D-209 — Weekly board fits phone landscape with cut-outs; ATC strip clears both side insets (2026-11-04, Claude, night N11z/N11aa)
On a landscape phone with side cut-outs (852×393, 0/59/21/59) the weekly board left the sign beside the boarding pass
178 px wide, its line wrapped into a 15–44 px column (6–7 lines, sign 117–134 px tall), and the three labels ran
63–117 px past the bottom inset (the overlay scrolled 71–125 px); 720–740 × 360 phones without insets did the same.
Phone landscape (≥ 720 px wide, ≤ 520 px tall) now: the model window takes what the height leaves (`100vh − 300 px −
top/bottom insets`, 48–230 px; no 96 px floor); a board narrower than 860 px (container query) sets the week small
above its line and lets the sign run over the dimmed peg rack (not tappable while the board is open) up to 300 px, so
the line keeps 230–274 px and two lines; below 700 px the label columns tighten so the PL hub values stay on one
line. Boards ≥ 860 px wide (915×412 and up) are unchanged (ui:matrix PNGs unaffected). The sign's line is balanced
(no lone last word). The ATC paper strip (range warning and first-time cards) subtracted only the right inset from
its landscape width, so a first-time card ended 34–43 px under the right cut-out; it now subtracts both. Guards:
`test:e2e:notch` gains a small landscape profile (812×375, 0/50/21/50), checks the board over the real HUD (no scroll,
labels above the bottom inset, sign line ≥ 120 px and ≤ 3 lines, sign clear of the pass), the training flight through
its controller (route → aircraft → transfer → cleared) and the ATC strip and a first-time card as panels (46/54 on
the old CSS). **Status: in force.**

## D-210 — Airport-pick sign on narrow landscape boards drops the repeated week (2026-11-04, Claude, night N11ab)
After the hub or "+2 slots" crate the sign beside the boarding pass holds the Back tile, the week and the instruction.
On a board under 760 px (720–852 px landscape phones, or wider ones with side cut-outs) the instruction was a
68–96 px column (2–3 lines), the sign grew to 72–89 px beside a 60 px pass, and at 812×375 with cut-outs "Tydzień 7" /
"Week 7" ran 23 px past the sign's edge. Unlike the crates board, the peg rack stays live during the pick, so the
sign cannot widen over it (D-209); it may only reach the rack's cable (86 px + 6 px gap, was 100 px). The week is
already printed on the boarding pass right beside the sign, so here it is visually hidden (screen readers still read
it, and the dialog's label names the week); the instruction takes both rows (13 px/1.15, balanced, 4 px sign padding): 82–120 px wide, 2–3 lines,
the sign ≤ 60 px like the pass. Boards ≥ 760 px keep the week. Guard: `test:e2e:notch` "upgrade-pick" (hub, then slots
pick): sign parts and their text inside the sign, instruction ≥ 80 px and ≤ 3 lines, clear of the pass and the rack's
cable, no taller than the pass beside it (56/60 on the old CSS). **Status: in force.**

## D-211 — Translator files: JSON or CSV export, strict import into `src/i18n/<code>.ts` (2026-11-04, Claude, night N12ah)
R7i. `npm run i18n:export -- <code>` writes `docs/i18n/<code>.json` (format `airway-i18n/1`; `--csv` gives the same
rows as RFC 4180 CSV with `#` header rows for spreadsheets): per key the EN source, the PL reference, the catalog's
section/line comment as context, the `{param}`s, the plural parameters and the length budget (read from
`src/i18n/limits.ts` once R7h adds it; any exported `Record<key, number | { max }>`), plus the language's plural
categories in token order with sample counts. JSON was chosen over XLIFF: no dependency, diffable, and every CAT tool
and spreadsheet reads JSON or CSV; XLIFF can be generated from the same rows later if an agency asks. Re-export keeps a
translation while its EN source is unchanged. `npm run i18n:import -- <code>` writes the catalog only when every row
passes: all EN keys present once, no unknown key, non-empty text, the same `{param}` set as EN, plural tokens with
`requiredForms`…`plural.length` non-empty forms naming an EN parameter, no stray brace, length ≤ budget (plural tokens
count as their longest form, `{param}` as nothing), and the EN source of the row equal to today's EN (a stale
translation is rejected, not silently shipped). A count without its own plural token is only a warning (German
"Rekord: {count}" is fine). The written file has en.ts's key order and `satisfies Record<keyof typeof en, string>`,
so `tsc` and `test:i18n` check it as soon as the language is listed. Not covered yet: `site/i18n.js` and the store
texts in `docs/store/` (owned by the UI/site agent; same rows can be added as extra sources). Guard:
`test:i18n-exchange` (fast). **Status: in force.**

## D-212 — Wave-1 languages are planned entries, not shipped; `pt` means Brazilian Portuguese (2026-11-04, Claude, night N12ah)
`PLANNED_LANGUAGE_ENTRIES` in `src/i18n/languages.ts` lists de (de-DE), fr (fr-FR), es (es-ES) and pt (pt-BR) with the
plural order of their `{n|…}` tokens (de one|other; fr/es/pt one|other|many, `many` last so a two-form token falls back
to `other` for round millions) and the Wikidata label languages used for city names (R7j). They are not in
`LANGUAGE_CODES`, the settings select or the native locale lists, and no `src/i18n/<code>.ts` is committed until a
reviewed translation exists (`test:i18n-exchange` fails otherwise). The code is the base `pt` because `normalise`
reads base codes: a pt-PT device would get Brazilian text, the usual first choice of games that ship one Portuguese
(the larger market; R7 research). A separate pt-PT would need a region-aware `normalise`. **Status: in force.**

## D-213 — Length budgets per key, split-flap cells 15/10/8, harsh pseudo-locale at 320 px (2026-11-04, Claude, night N11ac)
R7h. `src/i18n/limits.ts` declares a budget (code points after `{param}`s are filled with a worst-case sample) for 63
keys that sit in fixed-width UI: departures-board split-flaps, column heads, boarding-pass labels, dock countdowns,
crate fields and stamp captions, settings select options and switch states, Back tiles, logbook column heads, the
OK tag, aircraft codes. Measured, the board's columns at 320×568 hold 15 title cells, 8 status cells and 11 half-row
cells, and 360–412 px phones hold no more; the old `maxCells` of 20/10 let a longer title disappear behind the column
edge without the "…" cell. `FLAP_CELLS` is now 15/10/8/2 and the menu takes `maxCells` from it, so the budget and the
board agree (every PL/EN title fits: longest "ENDLESS FLIGHT" 14). `test:i18n` fails when a catalog or the
pseudo-locale exceeds a budget; `i18n:export` (D-211) already reads `{ max }` from this module. The pseudo-locale fills
a budgeted key to exactly its budget — the longest translation allowed — instead of stretching it past (which only
tested the "…"). A second mode, `?pseudo=harsh` / `setPseudoLocale('harsh')`, doubles strings of up to 20 code points
(IBM/W3C expansion for short UI text) and stretches longer ones ~40 %; the classic `?pseudo` stays the default so
`test:e2e:pseudo-locale` keeps its meaning. The harsh run is a new globe-less suite at 320×568 (`test:e2e:pseudo-320`,
screens mounted on `?perf=scene`, ~30 s), because the globe suites crawl under SwiftShader (G7). Fixes it found: menu
hints and logbook cells wrap instead of an ellipsis; long words wrap in settings labels, the logbook/settings title,
the puzzle sign, game-over buttons and crate values; the game-over title wraps so the Map tab stays on screen; the
puzzle Back tile no longer shrinks; the airport NEW stub's estimated width is a floor (min-width), not a cap. Real PL/EN text renders as before (row heights unchanged at 320/360/568).
**Status: in force.**

## D-214 — Daily e2e suites run on a fixed date, replayed headless by test:e2e-seeds (2026-11-04, Claude, night N12aj)
The two browser suites seeded by the date (`test:e2e:daily-share`, `test:e2e:daily-continue`) played whatever daily
world the real calendar gave, so a rule change or simply the next day could break them and no headless check saw it
(D-189/D-200/D-208 cover only the fixed-seed suites). Their day is now `dates: ['2026-11-04']` in `e2e/seeds.mjs`: the
page clock starts at Warsaw noon of that day (`e2e/browser.mjs` `pinDate`, an init script that shifts `Date`/`Date.now`
by a fixed offset and lets time run; Playwright's `clock.setFixedTime` froze `Date` and stalled the game screens under
SwiftShader), daily-share seeds the day before as "yesterday" for the streak, and daily-continue asserts the official
run is of that day. `test:e2e-seeds` replays their plans in daily mode (`mode: 'daily'`, `createGame(seed, 'daily')`)
on `dailySeedForKey(date)` (route drag; route + aircraft drags; practice idle) and adds clock checks (both suites
declare a date; the init script lands on the right Warsaw day for four dates across both DST switches).
`npm run e2e:seeds -- daily-share` walks forward day by day to the next date that holds after a rule change.
**Status: in force.**

## D-215 — "+2 slots" card stays as it is; the closed playtest checks the departure limit (2026-11-04, owner, Q-80 → A)
Owner's answer to Q-80 (N12af, D-207): no rule change for the "+2 slots" card (D-150 offer rule stays). The closed
playtest (R3 playtest plan) records whether players hit the hourly departure limit (held departures, slot waits) before
anyone changes the card or its offer rule. **Status: in force.**

## D-216 — Shortened puzzle titles 1–30 stay; PL store text says "hub", not "terminal" (2026-11-04, owner, Q-79 → A)
Owner's answer to Q-79: the shortened titles of D-166 stay. Owner's instruction with it: the Polish store description
follows the D-195 glossary, so the two "terminal" sentences of `docs/store/pl.md` say "hub" ("zanim hub się przepełni";
the second sentence reads "Gdy któryś się przepełni" to avoid repeating the word). EN store text unchanged. **Status: in force.**

## D-217 — Wave-1 city and region names from Wikidata labels, reviewed, in one data file (2026-11-04, Claude, night N12ai)
R7j. `scripts/city-names.mjs` maps every city to its Wikidata item through its English Wikipedia article (our EN
name, or `titles[code]` where it is ambiguous: New York City, Washington D.C., City of Brussels, Córdoba
(Argentina), Salvador (Bahia), Phoenix (Arizona), La Paz, Santiago) and checks with one SPARQL query that every item
lies within 40 km of our coordinates (165/165); regions are chosen by hand (continents, UN Northern/Southern Europe,
Middle East). `--fetch` snapshots the labels (de, fr, es, pt-br, pt, mul) into `scripts/data/wikidata-labels.json`;
the default step rebuilds `src/data/city-names.json` offline from snapshot + `scripts/data/city-names-overrides.json`
(the human review, each with a reason: short forms such as Frankfurt/Francfort/Fráncfort, "New York" in German, Brazilian
spellings "Nova York", "Bruxelas", "Karachi" where Wikidata has only a pt-PT label, "Naher Osten" where the German label
was English). Labels fall back to `mul` (names shared by many languages: Oslo, Abuja), and pt-br to pt. A trailing
"(…)" disambiguation is dropped. Wikidata data is CC0 (`docs/ASSETS.md`). PL/EN names stay in `src/data/cities.ts` and
`regions.ts`, unchanged (D-107; digest in `test:city-data`); the planned names are not read by the game until a language
ships (D-212), when `localName` gains the planned codes. Kept as Wikidata has them, for a native reviewer: Kyiv as
"Kiew/Kiev", Bombay/Calcutta/Madras in French and Spanish, Spanish "Bangalore". Guard: `test:city-data` (every city and
region has every planned name, the file equals the offline rebuild, one item per city, overrides carry a reason).
**Status: in force.**

## D-218 — Site launch pack: one launch config, disabled store tags, real 540×960 shots, og:image, hreflang, 404 (2026-11-04, Claude, night N11ad)
R7k. `site/launch.js` is the single place for the public origin and the two store links. Both links stay empty until
the store pages exist; an empty link shows a disabled "link after the store page opens" tag (luggage-tag style), never
a guessed URL. A link counts only on the store's own host (`play.google.com`, `apps.apple.com`) and only together
with the official badge artwork in `site/assets/badges/` (Google/Apple brand rules, `docs/ASSETS.md` entry), so no
badge files are committed today. The stage-0 concept mockups leave the site: the four previews (night, game, upgrade,
menu) are real store screenshots, downscaled by `npm run site:assets` (`site/make-assets.mjs`, Chromium canvas, no
image library) to 540×960 JPEG under 250 kB per language; `sources.json` stores the source PNG hashes so a stale copy
fails `test:site`. The "failure" scene waits for a store:shots run with the N11t game-over wording. `og:image` is the
Play feature graphic (D-117), copied at build time instead of a second file in git; canonical points to the
language-neutral URL with `hreflang` pl/en/x-default; `404.html` is `noindex` with root-absolute URLs. Site copy follows
the D-195 glossary ("hub", not "terminal", in `about.p1`). Footer links to terms (R7b) and the publisher block (R7c)
wait for those pages; no newsletter (Q-70 → A). Guard: `test:site` (shots size/freshness, store host + badge rule,
og:image, canonical/hreflang, 404, glossary, `site:assets` script). **Status: in force.**

## D-219 — Press page and one press kit ZIP built from the store sources (2026-11-04, Claude, night N11ae)
R2e. `site/press.html` (PL/EN through `site/i18n.js`) holds the fact sheet, the store short/full description, eight
screenshots, logo/icon, a video slot and one ZIP link. The ZIP is built by `build:site` (`site/press-kit.mjs`, no
library, fixed timestamps) from the files that already exist: full-size store PNGs of the four `SITE_SHOTS` scenes in
the phone (1080×1920) and landscape (1920×1080) formats, 8 per language and both languages, plus the wordmark and
icon as SVG and PNG and a README per language. Built, not committed (~11.7 MB). The descriptions are copies of
`docs/store/{pl,en}.md` guarded by `test:site`; the EN copy says "a hub" where the EN store text says "a terminal"
(D-195 on the site; the store text itself stays as D-216 left it — the owner may align it). Price row: "no ads and no
in-app purchases" (D-16), never a price or "free" (launch rule of RESEARCH R2). Developer "publisher details to follow"
until R7c, release "to be announced", contact the proposed `contact@airway.games`. The video row says the capture
follows until R2b sets `PRESS_KIT.video`. The "failure" scene stays out with the landing page until store:shots has
the N11t wording. Rejected: committing the ZIP (large binary churn on every store:shots) and an SVG-only wordmark (its
`<text>` needs Overpass installed, so the PNG render ships too). Guard: `test:site`. **Status: in force.**

## D-220 — Privacy declarations derived from the code and guarded by a test; one privacy manifest for both builds (2026-11-04, Claude, night N12ak)
R1f. `docs/store/privacy-declarations.md` holds the Google Play Data safety and App Store App Privacy answers for
build (A) without a Firebase config (nothing collected: the leaderboard layer is the only network path besides bundled
assets) and build (B) with leaderboards: the anonymous Firebase uid (Play "Device or other IDs", Apple "User ID") and
the official daily run (Play "App activity → Other actions", Apple "Gameplay Content"), not shared, not for tracking,
encrypted in transit, optional through the "Send my daily results" switch (D-135), deletable in the app (D-114),
kept 90 days (D-77); purposes App functionality + fraud prevention (Apple: App Functionality only, which covers fraud
prevention). The sheet lists every endpoint, body field, command-journal field and stored Firestore field; the
journal is replayed, not stored. `test:privacy-declarations` (in `test:fast`) records every request against a fake
Firebase and reads the Cloud Functions' writes and the `Command` union, so a new field or endpoint without a
declaration fails. `PrivacyInfo.xcprivacy` declares the (B) types in both builds (one static file; over-declaring in
build A is harmless, under-declaring in B would be wrong); `test:ios-config` checks it. Play "Device or other IDs"
rather than "User IDs" is a recommendation for the owner's Q-03 answer, not a decision; Q-01 (data controller), Q-07
(Firebase project) and the lawyer's view on Cloud Run request logs (IP, user agent) stay open. **Status: in force.**

## D-221 — Fill trend mark on the passenger tag: last game hour's balance, from half full, hairline double chevron (2026-11-04, Claude, night N11af)
R4c. `src/game/fillTrend.ts` (`FillReadings`) notes every airport's waiting count once per game hour, on the same
boundary as the audio drone readings (`gameHour()` shared with `audioCues.ts`), and keeps the last two readings; their
difference is the hour's balance (arrivals minus departures). The rule (`fillTrend`): no mark below half the waiting
places (a calm airport needs no forecast), none while the balance is within ±1 (steady), up "filling" above +1, down
"emptying" below −1, none without two consecutive readings (new airport, undo across an hour, restored save). The
gate uses the live count, the balance the readings, so the mark disappears the moment a tag drops below half.
Presentation only: nothing enters the sim or its hash (D-13). The overlay draws a thin ink double chevron behind a
hairline right after the count (`+N` or the last glyph), not a single V: the Northern Europe region glyph is a solid
green V and a plain chevron read as one more passenger in the first shots. Ink is the tag's text colour (paper on a
jammed tag), so up/down differ by shape only. Aria appends "Filling up / Emptying over the last game hour"
(PL "Zapełnia się / Pustoszeje w ostatniej godzinie gry"). It steps in once (120 ms opacity + 2 px, ease-out, no
spring); none under "Reduce motion" (D-88). The tag grows by 17 px only while the mark shows. Rejected: a per-tick
rolling window (needs per-hub history of run events, which R4d may add), colour-coded counts (colour alone).
Guards: `test:fill-trend` (rule + readings, `test:fast`), `test:e2e:fill-trend` (overlay DOM, PL/EN). **Status: in force.**

## D-222 — The coordinator merges agent PRs; agents only open them (2026-11-04, owner)
The auto-mode permission filter blocks subagents from merging their own PRs into `dev`. Owner: "you are the
coordinator and you do everything, you may merge PRs". Agents push and open a PR; the coordinator reads the report,
merges `dev` into the branch when it moved (backlog Log conflicts keep both lines), re-runs only the cheap affected
checks, merges with a merge commit and syncs `main` (D-64). **Status: in force.**

## D-223 — "hub" in the store texts too (2026-11-04, owner)
The glossary word "hub" (D-195) also replaces "terminal" in the store listings (`docs/store/*.md`), so the game, the
site, the press kit and the stores use one word. Done together with R2c (keywords). Supersedes D-216 where it kept the
store wording. [N12bi] The menu's airport sign follows too: `menu.sign` "AIRWAY.GAMES · HUB 1" (PL = EN, was
`menu.terminal` "… · TERMINAL 1", 25-character budget); it left the `test:i18n` "terminal" allowlist, which keeps only
the puzzle board's "Route planning terminal" (a desk, not an airport). **Status: in force.**

## D-224 — Play Data safety: the anonymous leaderboard UID is "Device or other IDs" (2026-11-04, owner, Q-03)
Answers Q-03: when leaderboards ship, the anonymous Firebase UID goes under "Device or other IDs", not "User IDs"; it is
tied to no account or e-mail. `docs/store/privacy-declarations.md` (R1f, D-220) already says so. Final check with the
lawyer stays open. **Status: in force.**

## D-225 — No "Sufficient Contrast" label until G9b (2026-11-04, owner)
The App Store accessibility labels at launch are "Differentiate Without Color Alone" and "Reduced Motion" only
(`docs/store/accessibility.md`, R1i). "Sufficient Contrast" waits until the globe step G9b (ext session) lifts airports,
planes and tags in Map mode to ≥ 4.5:1 and `test:contrast` covers them. Corrects RESEARCH R1. **Status: in force.**

## D-226 — Overnight queue: the whole backlog in order (2026-11-04, owner)
Agents keep taking `[ ]` items in backlog order (#1: R4g, R2g, R1g, R7a–c, R7l; #2: R1k, R1l, R2c, R2f, R3d/e/i/j/k,
R6g, R6i, R7d), document items included; never globe steps (G, `src/render/**`), puzzles or N9d. **Status: in force.**

## D-227 — Closed-test protocol and a local "Copy summary" of the logbook (2026-11-04, Claude, night N12am)
R1o. `docs/PLAYTEST.md` holds the 14-day closed test (RESEARCH R3 calendar, fix release on day 8), the tester brief
and surveys A/B/C in PL and EN, and a reading of the logbook data for the owner's open questions Q-73 (run length),
Q-78 (hub expansion card) and Q-80 ("+2 slots" card); its thresholds are proposals for the R3k decision table. The
logbook (`airway.logbook.v1`, same key, older records load) now also counts finished daily challenges and keeps a note
for each of the last 30 runs: date, mode, passengers, weeks completed, length in tenths of a minute **at 1x** (sim
ticks / 600, the balance report's unit, so human runs compare with the bot; wall-clock minutes come with R3j),
aircraft-minutes held for a departure slot over all airports, and how many weekly boards showed the hub expansion and
"+2 slots" cards and how often they were picked (`EndlessRun.playtestStats()`; a resumed run counts the boards after
resuming, never fewer than its picks). "Copy summary" on the logbook page (release builds too) puts a plain-text
summary in the player's language on the clipboard; when the clipboard is refused the text is shown selected for a
manual copy. No airport codes, seed or identifiers in the text; no network, no analytics (D-16); nothing to add to
the store privacy answers (D-220: the app transmits nothing). Rejected: a JSON/base64 export now (R3j adds the
`AW1:` line), wall-clock timing (needs session hooks; R3j), a hub column (a city code is the one non-count field).
Guard: `test:playtest`. **Status: in force.**
## D-228 — Hub cause board: long press (or tap from 70 % full), last game hour, one cause per region row (2026-11-04, Claude, night N11ag)
R4d. A long press on an airport (the gesture's `city` hit) opens a small departures-board sheet for it; a tap opens it
when the airport is at least 70 % full (`HUB_FULL_SHARE`, the same share as the "hub filling" first-time card); any
other tap, Back/Escape, the weekly board and the game-over report close it. Elsewhere a long press is still the route
menu; on an airport it is now the board (the route menu stays on the route body). Hit testing uses the session's
existing projected-city test, no `src/render/**` change. The view is `src/game/hubBoard.ts` (`HubDepartureLog`), a
read-only rolling window of the last 60 game minutes taken after every simulated stretch: a departure is a plane seen in
flight on a new leg since the last look (the Sim has no departure event; `EndlessRun.planeList()` now also copies each
plane's `phase`, `cityIndex` and `slotWaitTicks`), kept with whether it left without a free seat; slot holds are
aircraft-minutes of planes waiting on the ground for a slot. Nothing enters the sim or its hash (D-13); an undo (clock
back) starts the window over. Rows: one per destination region waiting there, most first, with the region glyph, the
count and one cause mark, strongest first: **no onward flight** (the sim's own router, rebuilt on the run's routes,
finds no first leg towards that region), **curfew** (the airport is closed now; "until 06:00", `CURFEW_END_HOUR`),
**left full** (the latest departure on that region's first leg in the hour had no free seat; a later one with seats
clears it), **waiting for a slot** (minutes held on that leg in the hour), else a quiet dash "waiting for the next
departure". Sentences reuse the game-over strings `gameover.cause.noRoute`, `.seatShortage` and `.slotWait` with the
row's count (same wording and plural rules); curfew and the dash have their own lines (`hubBoard.cause.*`, PL/EN). Marks
differ by shape: broken leg, striped barrier, filled seat block, hourglass, dash; a jammed hub's board gets a hatched red
top rule. The sheet sits under the boarding pass: above the bottom dock in portrait (8 rows fit at 360×640), left of the
side rack in landscape and on foldables (rows scroll when they do not fit); close target 48 px; 140 ms step-in, none
under Reduce motion (D-88). Rejected: hourly buckets like D-221 (a cause from 59 minutes ago would vanish at the hour
boundary), the cumulative ledger counters (per hub, not per region, and run-long), a new sim departure event (sim change).
Guards: `test:hub-board` (`test:fast`), `test:e2e:hub-board` (menu-page fixture with a real run forced into a jam, G7-safe;
`test:ci`). **Status: in force.**

## D-229 — Store keywords without repeats, Play alt texts, "puzzle" in the Play short description (2026-11-04, Claude, night N12an)
R2c with D-223. App Store indexes name + subtitle + keywords as one set, so the keyword field repeats no word of
either and no other keyword. EN (96 bytes):
`airline,airport,flight,plane,aircraft,network,transfer,strategy,puzzle,logistics,travel,earth,3d`; PL (92 bytes):
`linie lotnicze,lotnisko,lot,samolot,przesiadka,strategia,logiczna,zagadka,ziemia,podróż,3d` — the backlog proposal
without `sieć`, which the PL store title "Airway: Buduj sieć lotów" already indexes. The "captions" section becomes
**Play alt text**: one descriptive line per scene in store order (D-63), unique, ≤ 140 characters, no "image of" or
price; App Store Connect has no caption field. The Play short description names the genre: EN "Route puzzle on a 3D
globe. Connect cities and keep airport hubs moving." (72/80), PL "Logiczna gra o trasach na globusie 3D. Łącz miasta i
chroń huby przed zatorem." (78/80); the press page follows (`test:site`). D-223 applied: the two EN "terminal"
sentences say "hub". Rejected: keeping the old short descriptions (Play has no keyword field, so the genre word must be
in the text), per-device alt texts (the same scene shows the same content). All texts await the owner's review before
upload. Guard: `test:store-shots` (keyword repeats, "terminal", alt-text lines). **Status: in force.**

## D-230 — Wave-1 store listings DE, FR, ES, PT-BR as text-only drafts awaiting native review (2026-11-04, Claude, night N12ao)
R1k after Q-43 → A (D-96). `docs/store/{de,fr,es,pt-br}.md` translate the R2c `en.md` (D-229) field by field: store
title, subtitle, short and full description, keywords, feature-graphic alt text and one Play alt text per scene. Each
file is marked `needs native review` and nothing is uploaded before that review. The store title is localised
("Airway: Flugrouten am Globus", "Airway : routes sur le globe", "Airway: rutas sobre el globo", "Airway: rotas pelo
globo"), always starting with the brand; the keyword field follows D-229 (no word of title/subtitle, no repeats,
≤ 100 bytes) and "hub" stays the glossary word (D-195, D-223). The full description ends with one line saying the game
is currently in English and Polish; it goes when the game itself is translated. These listings use the EN screenshots
(`shots/en/`); no localised screenshots until the game speaks the language. Rejected: the EN title in every store
(loses the local search words), machine translation without the review mark, localised screenshots of an English game.
Guard: `test:store-shots` (review mark, language note, limits, keyword repeats). **Status: in force (texts await
native review).**

## D-231 — Playtest record: an `AW1:` line under "Copy summary", real minutes, cause, weekly picks, device setting (2026-11-04, Claude, night N12ap)
R3j extends R1o (D-227). Each of the last 30 run notes in `airway.logbook.v1` may now also hold: real play time in
tenths of a minute (frames on the game screen or weekly board, not paused, each frame counted up to 0.5 s, so the app in
the background adds nothing; a resumed run counts from resuming), the first cause of the game-over board
(`buildCauseReport`), the card picked each week as letters (`T`/`W`/`H`/`S`, week order), the training state at the end
of the run, the graphics setting, the preset the renderer ended on and the number of adaptive downgrade steps (D-74),
and the app version (`package.json` via a Vite `define`, `src/core/version.ts`; "dev" headless). Every field is
optional and validated alone, so R1o notes and a bad field never drop a run. "Copy summary" adds two readable lines
(game version; real play time median / longest) and, last, one machine line `AW1:` + base64url of ASCII JSON
(`{v,d,app,f,dl,tut,pz,r}`, run columns fixed in `RUN_COLUMNS`), identical in PL and EN. `npm run playtest:decode --
file.txt` finds every `AW1:` token in pasted survey answers and prints CSV, one row per run, re-validating each field
with the logbook's own reader. Privacy: still counts, dates and fixed words only — no airport code, seed or identifier;
nothing leaves the device unless the player copies it (D-16, D-220); `docs/store/privacy-declarations.md` names the
line. Rejected: a per-run hub code (the one identifier-like field), compressed/encrypted payload (testers should be
able to read what they paste), a separate "Copy record" button (one paste per survey is simpler). Guard:
`test:playtest`. **Status: in force.**

## D-232 — Closed-test decision table, recruitment and production-access answers written before the test (2026-11-04, Claude, night N12aq)
R3k. `docs/PLAYTEST.md` now holds the recruitment plan (16–18 sign-ups, ≥ 6 PL and ≥ 6 EN, ≥ 3 budget Androids, ≥ 2
tablets/foldables, own contacts, Polish communities and the airway.games form; no paid tester services; one Google
Group), the final decision table and an answer sheet (EN drafts with placeholders) for the Play Console
production-access questions. Each table row names the signal (a `playtest:decode` CSV column or a survey answer), the
bot reference from the repo's own balance data (`docs/balance/game-summary.md` rules v6, the N12af 200-seed run, R8
`r8-audit-200.csv`), a minimum sample, the decision at the threshold and the default without data (the current rule).
Thresholds: **Q-73** → B (R8f review) when the median of testers' longest Endless runs is ≥ 22 min at 1× and ≥ 5 of 12
want longer runs; A when the median run is 10–18 min (D-79); a median < 10 min reopens week-1 pace (Q-60) instead.
**Q-78** → A at ≥ 10 % of offers picked and ≤ 3 of 12 not understanding the card; D (measure another effect) at < 5 %
or ≥ 4 of 12 not understanding. **Q-80** → A when ≥ 20 % of runs held a departure and ≥ 2 testers picked the card; B
(drop from the Endless/daily pool) when < 10 % of runs held one and the card was on < 3 % of boards. Plus rows for
Q-35, game-over cause, "don't know why I lost", unfinished training, first run, performance/adaptation, daily habit
(Q-45), what is missing (Q-50) and day-8 fix adoption. Changed from the R1o proposal (D-227): Q-73 B reads the testers'
longest runs, not the p90 of all runs (people losing earlier than the bot is a week-1 pace signal, not the week-3
wall). Thresholds are not moved after seeing data; a bad threshold becomes its own decision. The organisation account
(D-94) is exempt from the 12 × 14 rule, so the answer sheet is a ready description of the test, not a filing. Q-52
stays open for the owner; the plan follows its recommendation A. Guard: `test:playtest`. **Status: in force (Q-52 to
confirm).**

## D-233 — Keyboard and mouse basics: key map, where keys act, hover only on hover devices (2026-11-04, Claude, night N11ai)
R4g. `src/input/keyboard.ts` maps **Space** → pause/resume, **1/2/3** → speed 1×/2×/4× (the three speeds of the dock
tag; the physical digit row by `code`, so AZERTY works), **+/=/Numpad+** and **−/_/Numpad−** → one zoom step of ×1.25
through `GlobeOrbitCamera.zoomBy` (the same call as the wheel; one step ≈ one wheel notch). **Escape** stays the single
back entry point (`src/platform/back.ts`). Keys never act with Ctrl/Cmd/Alt (Ctrl + is browser zoom), in a text field
or select, or inside an open dialog (pause sheet, settings, boards): there Space activates the focused button, so on the
pause sheet Space resumes through the focused "Resume" and never toggles twice. Pause and speed act only on the running
`game` screen (not on the weekly board, the game-over report or behind the pause sheet); zoom also on the airport pick
and the game-over map. Space pressed on a focused HUD tag pauses and its release clicks nothing (consumed on press and
release). The globe canvas cancels `contextmenu` (right click and touch long press), the game's own long press stays.
Hover: under `@media (hover: hover) and (pointer: fine)` HUD buttons, airport tags (globe hit test, `.is-hover`) and
off-screen airport buttons get one inset rule in their own ink; the canvas shows a pointer cursor over an airport or a
route end. Settings → Help lists keys and mouse actions (PL/EN, key caps as `<kbd>`), hidden on `(any-hover: none)`
devices; pause and speed controls carry `aria-keyshortcuts`. Kept deliberately small and token-based for the UI
redesign (docs/styles/ui-2026-11). Rejected: arrow keys to turn the globe (not asked; drag and edge pan cover it),
showing the key list on touch-only phones, Space as a global toggle inside dialogs. Guards: `test:keyboard`
(`test:fast`), `test:e2e:keyboard-mouse` (`test:ci`). **Status: in force.**

## D-234 — Leaderboard budget brake: a `LEADERBOARDS_PAUSED` param, and budget alert steps (2026-11-04, Claude, night N12as)
R3d. `functions/src/index.ts` declares one deploy-time `defineBoolean('LEADERBOARDS_PAUSED', { default: false })`.
When it is `true`, `submitDaily` answers `{ accepted: false, reason: 'paused' }` right after the sign-in check and
`getBoards` answers the two requested boards empty after the board-id check — before the per-player limiter, the
request body, the replay and any Firestore access. The client (`src/net/index.ts`) treats `paused` as "retry later":
the run stays in the device queue and the result screen shows the existing "queued" state; when the brake is released
the queue sends it (the server still accepts only today and yesterday, D-66, so a long pause loses older runs).
`deleteMyData` is **not** braked: erasure is a player's right (D-93, D-114), rare and capped (2 instances, 3/min).
`docs/FIREBASE.md` step 4 gives exact console clicks for a 10 EUR monthly budget on the Airway project with alerts at
50/90/100 % actual and 100 % forecasted to billing admins (owner e-mail), and a section "Gdy przyjdzie alert": find
the SKU in Billing reports, read Firestore usage against invocations per function (each collection belongs to one
function; the console has no per-collection split), set `LEADERBOARDS_PAUSED=true` in `functions/.env.<project>` and
`firebase deploy --only functions`, release with `false`; disabling billing only as a last resort. The param is
deploy-time (redeploy, ~2 min) rather than a Firestore flag, because a flag would cost a read per call — the very cost
the brake stops. Rejected: also pausing `deleteMyData` (legal right), a client-side "paused" message (no new UI or
strings; "queued" is true), an emulator test (the Firestore emulator needs Java and a download, not offline; the test
loads the real handlers with stubbed Firebase modules instead). Who owns the project and budget stays **Q-07** (owner);
the steps are generic. Guards: `test:leaderboard-brake`, `test:net`. **Status: in force (Q-07 open).**

## D-235 — Release checklist: age-rating answers, target audience 13+, one version name for both native projects (2026-11-04, Claude, night N12at)
R1l. `docs/RELEASE.md` is the one release checklist (accounts, closed test, privacy URL, Data safety, App Privacy, age
questionnaires, DSA trader status, export compliance, accessibility labels, store shots per Apple device class,
version bump, plus the rest of RESEARCH R1), each line with owner/agent, a state and its D-/Q- entry. Three lines
had no entry, so they are decided here by RESEARCH R1's recommendations:
- **Age rating answers** (IARC in Play Console, Apple's 2026 age questions): no violence, fear, gambling, chat or
  user-generated content, no purchases or ads (D-16), no location sharing; the leaderboard shows generated call signs
  only (Q-05 A), so "users interact" is answered **No**. Expected PEGI 3 / USK 0 / Apple 4+. A nickname, chat or ads
  would reopen these answers.
- **Play target audience 13 and older** — the game is not designed for children, and an under-13 group would bring
  the Families policy (SDK and privacy duties for the leaderboard).
- **Version:** `package.json` `version` is the one marketing version; Android `versionName` and iOS
  `MARKETING_VERSION` equal it, Android `versionCode` grows by 1 per upload, the iOS build number comes from
  `fastlane ios beta`. Rejected: a version script that rewrites the native files (two string edits per release do not
  need tooling yet).
Guard: `test:release-checklist` (every reference exists, every line has an owner and a reference, the three version
names agree). The owner still files every console answer. **Status: in force (recommendations of RESEARCH R1; the
owner may override in the consoles).**

## D-236 — Endless home region: a menu choice that moves only the start cluster (2026-11-04, Claude, night N11aj)
R2g (Q-50 recommendation B). The Endless row of the menu board gets a native select in its status cell (the board
keeps its height): **Random** (default, the pre-R2g draw) or one of the 7 regions that have a start cluster.
**Oceania is not offered**: no other region lies within the 2,500 km start radius, so no cluster is anchored there
(adding it would need new start rules, not a menu option). The choice is stored as `homeRegion` in the settings
record (`airway.settings`, device only) and copied into the run's `GameConfig.homeRegion` (Endless only; Daily and
puzzles refuse it, so the daily world and the leaderboards are unchanged). `scenarioFor` gives such a run
`ENDLESS_SCENARIO` + `homeRegionId`; `createCitySpawner` then draws from the start clusters anchored in that region
with the same RNG calls, so the run is deterministic and later airports open by the ordinary rules anywhere. A Random
config carries no field, so its state hash is bit-for-bit the old one (pinned in `test:home-region`) and
`RULES_VERSION` stays 6. The save envelope goes **v1 → v2**: v1 saves (always Random) load unchanged (checksum
verified as v1, re-tagged), a pre-R2g build refuses a v2 save as "newer version" instead of continuing a home-region
run in a random world. The D-76 replay keeps the region (`replaySave` passes the saved config), and so does the run
timeline. "Same world" on the game-over report keeps the run's region; "New world" takes the menu's current choice.
The report shows "Home region: Northern Europe" / „Region startowy: Europa Północna” next to the score, and the
logbook's recent table shows the short name under "Endless". Bot check (`balance:regions`, 50 seeds per region,
report only, not retuned): median 11.71 (NAM), 11.89 (SAM), 17.95 (EUN), **18.49 (EUS, flagged: above 18)**, 17.10
(AFR), 15.91 (ME), 10.11 (ASI) min against D-79's 10–18; ASI and EUN sit at the edges
(`docs/balance/regions-summary.md`). Kept minimal and token-based for the pending UI redesign. Rejected: a separate
region row (the board would grow and overlap the sign in landscape), `Scenario.startCityIds` (it switches the spawner
off, so no airport would ever open), a rules-version bump (Random is unchanged; it would replay every save).
Guards: `test:home-region` (`test:fast`), `test:e2e:home-region` and `test:balance:regions` (`test:ci`).
**Status: in force (EUS median to be reviewed with the next balance pass).**


## D-237 — The leaderboard objection also stops a submission already under way (2026-11-04, Claude, night N11ak)
R7l closed (Q-68 answered A = D-135, legitimate interest with a one-tap objection; switch D-197, net layer D-186).
A gap remained when "Send results to the leaderboard" is switched off while a run is on its way (the start-up
flush or a game-over submission waiting on a slow network): the offline queue finished its pass, sending the other
waiting days, and then wrote the retried runs back, so the dropped runs came back and were sent later. Now
`SubmissionQueue.clear()` (used by the switch and by the D-114 deletion) bumps a generation: a flush that sees it
change sends nothing more and writes nothing back. The request already on the wire cannot be recalled; whatever it
answers, `submitDaily` reports `opted-out` and the daily report says "Not ranked" (also when the switch flips while
the boards load). The write-back now merges with the queue as it is at the end, so a run queued while a request was
in flight is no longer overwritten. No new UI or strings. Rejected: aborting the in-flight fetch (the server may
already have counted it; deletion is the D-114 path). Guards: `test:net` (3 new cases), `test:e2e:ranking-switch`
(a waiting run is dropped by the switch). **Status: in force.**

## D-238 — Launch plan in `docs/LAUNCH.md`: weeks from an unset T, the D-131 rhythm over R2's T+6, store-event drafts (2026-11-04, Claude, night N12au)
R2f + R6g. `docs/LAUNCH.md` (Polish, owner-facing) holds the launch timeline from RESEARCH R2 in weeks from **T**,
which stays unset until the owner picks the launch date (D-96): T−12 closed test + Firebase project + press page and
trailer, T−10 Apple featuring nomination, T−8 iOS pre-order and Play pre-registration (≤ 90 days, no reward: D-16 has
no IAP) + site with store links + showcase entries, T−4 builds to video creators under embargo and the "Opening week"
Apple event sent for review, T launch, T+4 / T+8 / T+12 updates. Where R2 put the first puzzle update and second event
at T+6, the plan follows the owner's later 4-week rhythm (D-131): T+4 "Long haul" 31–40 (D-193 flag removed), T+8
weather front (R2j) + puzzles 41–45, T+12 weekly contract (R2k) + Sunday daily variant — the mechanics after launch
still wait for Q-50; puzzle numbers 41–50 and their themes are a proposal. Every row names who acts (`właściciel`,
`agent` or both; owner-only steps in bold) and a D-/Q- reference. Showcases: Big Indie Pitch Mobile 18.01.2027
(ticket, playable build only) and Digital Dragons 2027 (dates unknown). The creator list is a template only; the filled
list with contact details is kept outside the repo (personal data). Draft PL/EN texts: four Apple In-App Events
(Opening week and Weekly contract as Challenge, Long haul and Weather front as Major Update; name ≤ 30, short ≤ 50,
long ≤ 120 chars) and three Play "Major update" promotions (title ≤ 30, text ≤ 80 — our own limit, the console's field
limits were not verified), never mentioning price, "free" or "best". Rejected: fixing a calendar date now (the owner's
call), keeping R2's T+6 (contradicts D-131), a pre-registration reward. Guard: `test:launch-plan`. **Status: in force
(T, Q-49, Q-50 open).**

## D-239 — Legal launch register in `docs/legal/README.md`, bound to the privacy declarations (2026-11-04, Claude, night N12av)
R7d. One Polish page for the owner and the lawyer, every section marked "to verify with the lawyer" and explicitly not
legal advice: (1) a GDPR art. 30 record of processing for build B — leaderboard (P1), score replay/anti-cheat (P2),
anonymous Auth account incl. IP in Auth logs and up to 180 days in backups (P3), deletion on request (P4), Cloud Run
request logs (P5, the D-220 open point), contact mailbox (P6), site hosting logs (P7) — each with purpose, GDPR art. 6
basis (legitimate interest per D-135; deletion as a legal obligation), data subjects, data, recipients, transfer,
retention and security; the controller, contact and UK representative stay placeholders (Q-01, Q-67); (2) the
Firebase Data Processing and Security Terms acceptance as an owner step in `docs/FIREBASE.md` step 1 with a date field
(the exact console location is uncertain, with a Google Cloud fallback); (3) trader declarations with dates (Google:
at account creation, existing accounts by 01.02.2027, shown from 01.03.2027; Apple: before the first EU submission;
D-134); (4) UK art. 27 waiting for the lawyer (Q-67 → A, D-136); (5) US state app-store age laws to re-check before
the US launch (Texas in force, Louisiana 01.07.2026, Alabama 01.01.2027, Utah 06.05.2027, COPPA); (6) other legal
launch items; (7) questions for one lawyer consultation. Proposed but not decided: keeping deletion and contact
e-mails 12 months (left to the lawyer). `docs/RELEASE.md` links the register (RL-03, RL-11, RL-15, new RL-29). Guard:
`test:legal-register` reads the endpoint and stored-field tables of `docs/store/privacy-declarations.md` (which
`test:privacy-declarations` keeps equal to the code), so a new data flow fails until the art. 30 record names it;
the leaderboard retention must equal `RETENTION_DAYS`. Rejected: an English-only register (the owner and a Polish
lawyer read it), filling the controller with guessed details. **Status: in force (Q-01, Q-67 and the lawyer open).**

## D-240 — The seven R8 questions join the closed-test sheet, each with a pre-written threshold on rules v6 (2026-11-04, Claude, night N12aw)
R8g. `docs/PLAYTEST.md` asks the seven questions of RESEARCH R8 ("Pytania do testu zamkniętego"): survey B gets B9
(moved an aircraft?), B10 (last card and why; a pointless card?), B11 (SLOT stamp seen; most aircraft at one airport),
survey C gets C8 (knew what could save the airport; spare aircraft then?), C9 (curfew reached and understood), C10
(anything to decide in the last minutes?), and the observation sheet gets O9 (aircraft moves counted from the recording)
and O10 (SLOT stamp noticed). A "Pytania R8" table maps each question to its survey/observation item, CSV column and the
RESEARCH R8 threshold, and the decision table gains rows R8-1…R8-7 in the D-232 format. Thresholds follow RESEARCH R8
where it gives one (R8-1 "no" > 30 %, R8-3 ≥ 1/3 of testers, R8-5 < 30 %, R8-6 > 30 min); where R8 gives a direction
only, the threshold is set here before the test: R8-2 ≥ 6 of 12 never moved a plane (or 0 moves for ≥ 2 observed),
R8-4 ≥ 4 of 12 saw SLOT or ≥ 3 of 12 had 5+ aircraft at one airport (feeds the Q-80 row, which decides), R8-7 ≥ 4 of
12 "just watched". The audit ran on rules v5; since rules v6 the curfew starts in week 3 (D-151) and the board shows
only cards that can act (D-150), so "reached the curfew" is an Endless run with `weeks` ≥ 2 and the bot reference is
`docs/balance/game-summary.md` (v6); Q-72 B is already in force, so R8-5 below 30 % reopens Q-72 C for the owner. The
logbook does not gain aircraft-move or spare-aircraft fields (D-16: it keeps only what Q-73/Q-78/Q-80 need); those two
come from the survey and the recordings. Guard: `test:playtest`. **Status: in force.**

## D-241 — One publisher block (`publisher.*`) for site, game and store consoles; release builds refuse its placeholders (2026-11-05, Claude, night N11al)
R7c (D-134, Q-66 → A). The publisher / service-provider details required by art. 5 of the Polish e-services act and
shown on the Apple/Google trader cards are one string set `publisher.*` in `site/i18n.js` (PL/EN): legal name,
address, register and tax ID (KRS or CEIDG, NIP), e-mail, phone, trader status, plus a title and one note naming the
law. `site/publisher.js` lists the rows (`PUBLISHER_FIELDS`) and the guard. Where it shows: a `#publisher` section on
`site/privacy.html` (the press fact-sheet rows on policy paper; the terms page R7b reuses it), a "Publisher" /
"Wydawca" link in every site footer, Settings → Help in the game (label/value rows after the privacy policy, offline,
text only) and a paste-ready table in `docs/store/README.md`. The game catalogs and the store table copy the site
strings word for word (`test:publisher`). Until the owner answers Q-01, identity fields hold visible
"[Q-01: … — to be filled in]" placeholders; the trader row is filled (D-134). Any value with "[Q-…" is a gap:
`AIRWAY_RELEASE=1 npm run test:site`, `build:site` with `AIRWAY_RELEASE=1` and `npm run android:release` /
`android:aab` refuse to run with gaps (the iOS archive has the manual check in `docs/IOS.md`). Rejected: guessed or
private details; the full block in every footer (one link keeps footers short and the block in one place); a
separate settings page and router screen for six rows. Not legal advice — the wording goes to the same lawyer
consultation as R7a/R7b. **Status: in force (Q-01 open).**

## D-242 — Endless run milestones: seven goals read from the run, shown on the game-over report and in the logbook (2026-11-05, Claude, night N12ax)
R1n. A first Endless run gets intermediate goals without a rule change: **first hub**, **every region served**,
**week 2 / 3 / 5 reached**, **500 / 1 000 passengers**. The check is pure (`src/game/milestones.ts`) and reads the run's
read model (`EndlessRun.cityList()`/`routeList()`, tick, score); `EndlessRun` keeps what was reached (a hub that later
closes still counts), so nothing is written into the Sim, its state or its hash (D-13; `test:milestones` compares
the hash with a raw Sim driven by the same bot). "Every region served" means: when a weekly board opens, every region
that has an open airport has an airport on a route, with at least two regions open (all eight regions is never
reached by the bot, and "served at any moment" is true at the first route). A resumed run counts what it reaches
after resuming and at its end (like the R1o board counts). The game-over report shows one ruled row "Etapy n/7"
under the score — reached milestones with a filled square, open ones hollow (shape, not only colour), a small
"pierwszy raz" stamp on one reached for the first time, which fades in over 160 ms and not at all under "Reduce
motion" (D-88); short screens keep the title and marks only, so the report does not scroll. The logbook stores, per
milestone, the flight number (Endless + daily, as the logbook counts flights) of its first reach, Endless only, and
lists them as "pierwszy raz w locie N" / "jeszcze nie". No reward, no unlock, no new rule, nothing in "Copy summary".
Inks are local custom properties (`--aw-ms-*`) so the pending UI redesign can swap them in one place.
Bot check (test:balance policy, 0xA1A1…, 60 min cap): 50 runs, median 17.51 min — first hub 50, every region 35,
week 2 50, week 3 33, week 5 1, 500 passengers 10, 1 000 passengers 0; 200 runs, median 16.80 min — 200 / 146 /
194 / 135 / 1 / 24 / 0. The median run reaches the first four; week 5 and 1 000 passengers are stretch goals no bot
run reaches (owner may prefer week 4 / 750 passengers). Guard: `test:milestones`, `test:e2e:gameover-milestones`.
**Status: in force (thresholds to confirm by the owner).**

## D-243 — Privacy policy v1: fourteen sections from RESEARCH R7, bound to the art. 30 record and the store declarations (2026-11-05, Claude, night N11am)
R7a. `privacy.*` in `site/i18n.js` (PL/EN; the game copy follows through `test:privacy-text`, D-86) becomes a full
draft in the order of RESEARCH R7: (1) controller and contact as "[Q-01 …]" placeholders, no DPO, UK representative
"[Q-67 …]"; (2) in short; (3) what stays on the device (save, settings, logbook; share and "Copy summary" only on
tap); (4) the daily leaderboard, merged from `docs/legal/leaderboards-privacy.md` (Q-56 per its recommendation A —
one text for every build; the owner may still choose B): what is sent, what is stored, the anonymous account, the
call sign, IP addresses in Google's request handling; (5) one purpose line per activity of the art. 30 record with
its GDPR art. 6 point (legitimate interest per D-135, deletion as a legal obligation); (6) recipients (Google as
processor under the Firebase DPST, `europe-west1`; host and mail provider placeholders); (7) transfers (EU-US DPF,
SCC); (8) retention (entries 90 days, D-77; record of moves not stored; anonymous account until deletion + up to 180
days in backups; Auth IP logs a few weeks; Cloud Run logs, e-mails and hosting logs as bracketed open items); (9)
rights incl. objection through "Send results to the leaderboard" (D-197), in-app deletion (D-114), e-mail deletion
within 30 days and a complaint to the President of UODO; (10) 13+; (11) no profiling, the server replay is the only
automated check; (12) the website; (13) security; (14) changes with a version history. The red banner now says
"draft v1 — to verify with a lawyer, not legal advice" and stays until the owner approves; the date line names the
effective date as set at publication. Bodies are paragraphs and "• " lists (site: `data-i18n-paragraphs`; game:
`policyBlocks`). Guards: `test:privacy-policy` maps every art. 30 activity, declared endpoint, submission field and
stored field to plain words in the policy (a new data flow fails until the text names it) and checks the retention
numbers against `RETENTION_DAYS` and the register; `AIRWAY_RELEASE=1 test:site` refuses bracketed placeholders.
Rejected: a separate leaderboard-only section shown only in build B (Q-56 B: two texts to keep in sync); field names
such as `expireAt` in player text. **Status: in force as a draft (Q-01, Q-56 confirmation, Q-67 and the lawyer open).**

## D-244 — Terms of use v1 on `site/terms.html` and in Settings → Help; Apple's standard EULA in the App Store (2026-11-05, Claude, night N11an)
R7b (D-134, Q-65 → A). A PL/EN terms page built like `privacy.html` (same header, footer, fonts, `site.js`,
canonical/hreflang, copied by `build:site`), linked from every site footer, with ten sections: provider and contact
("[Q-01 …]" placeholders), scope (game, daily leaderboard and website as electronic services, free, requirements),
licence to play (personal, non-transferable; store rules; Apple's standard Licensed Application EULA in the App Store),
leaderboard rules (only the first game of the day is ranked, the server replay rejects an unconfirmed score, entries
expire 90 days after the last write, the opt-out switch and in-app deletion, no cheating, no prizes), availability
(the leaderboard may be paused, changed or ended, the game works offline; consumer rights by law untouched), start
and end of the agreement, complaints (reply time a bracketed proposal of 14 days), privacy, changes (14 days' notice),
governing law (a bracketed proposal for the lawyer: Polish law without removing consumer protection of the country of
residence). Draft banner "draft v1 — to verify with a lawyer, not legal advice". The publisher block (D-241) sits on the terms page too, above the date, and its footer links it; the game renders terms and policy bodies with one `policyBlocks` (D-243). The game shows the same text offline
under Settings → Help → "Terms of use" / "Regulamin" (router screen `terms`, like D-86), after the privacy policy.
`docs/store/README.md` says to keep Apple's standard EULA and gives the terms URL for both consoles and the Play
trader card. Guards: `test:terms` (game copy word for word, sections, leaderboard rules vs `rank.practice`,
`RETENTION_DAYS` and the real switch labels, EULA and URL in the store notes), `test:site` (page, footers, banner;
`AIRWAY_RELEASE=1` refuses bracketed placeholders), `test:e2e:terms-page`. Rejected: Apple's EULA alone (Q-65 B; the
leaderboard and site need terms under the Polish e-services act); a custom App Store EULA. Not legal advice; goes to
the same lawyer consultation as R7a. **Status: in force as a draft (Q-01 and the lawyer open).**

## D-245 — Firebase Test Lab game loop plays the real release build with the bot (2026-11-05, Claude, night N12ay)
R3i. Real-device frame times on budget phones come from Firebase Test Lab's game-loop test type instead of borrowed
phones. `MainActivity` takes `com.google.intent.action.TEST_LOOP` (second intent filter; `com.google.test.loops` = 1,
label `perf`); a small Capacitor plugin (`GameLoopPlugin`, `AirwayGameLoop`) passes the scenario number to the web
game and writes the report to the result file URI, then finishes the activity (watchdog after 300 s). Scenario 1 is
the real game, not the perf fixture: Endless `0xA1A1`, no tutorial or first-time cards, 4×, the task-22 bot through
real Commands every 30 ticks (or every second on the weekly board), 120 s of real time; the report keeps the
`.perf/scene.json` frame fields (rAF interval p50/p95/max, mean fps) plus renderer string, graphics choice, running
preset and adaptation steps. The bot leaves the DEV-only path: `src/game/dev/autoplay.ts` becomes an 8 kB lazy chunk
of the release build, loaded only on a game-loop launch (or in DEV); the main chunk does not grow by it. `npm run
perf:testlab` only prints the `gcloud … --type=game-loop` command (the owner runs it in their project, Q-07; Spark: 5
physical runs/day); device rows go to `docs/PERFORMANCE.md`. Rejected: the perf fixture as the scenario (scripted
network, DEV-only module, not what players run), a separate test APK flavour (a second build to sign and keep in step),
fast-forwarding the sim (the point is the frame cost of real time). Not verified here: Gradle build of the plugin and a
real Test Lab run (no Android SDK offline). Guard: `test:game-loop`. **Status: in force (owner run waits for Q-07).**

## D-246 — App Check ready behind a server param, plugin found by name, no dependency yet (2026-11-05, Claude, night N12az)
R3e, prepares both answers of Q-53 without deciding it. Server: a deploy-time param `APP_CHECK_ENFORCED`
(`defineBoolean`, default off) — when on, `submitDaily` and `getBoards` refuse a call without a verified App Check
token (`request.app`) with `unauthenticated` before the brake, the limiter, the body and Firestore; the client keeps
the run queued. The SDK's `enforceAppCheck` stays off because it is a fixed option, not a param. `deleteMyData` is not
guarded (erasure must not depend on attestation). Client: `src/net/appCheck.ts` turns a native plugin port into a
cached, never-throwing token source (5 s timeout, reuse until 5 min before expiry, no background refresh to save the
Play Integrity quota of 10 000 calls/day); `src/net/client.ts` sends it as `X-Firebase-AppCheck` on callables only.
The port is the `FirebaseAppCheck` plugin of `@capacitor-firebase/app-check` (Capawesome, Apache-2.0, maintained,
Capacitor 8), looked up by name through Capacitor's registry. The package is **not installed yet**: its Android
plugin calls `FirebaseAppCheck.getInstance()` on load, which crashes the app without `google-services.json`, and its
web part needs the `firebase` JS SDK. So the owner first registers the apps (Play Integrity / App Attest) and adds the
config files, then the plugin is installed (`docs/FIREBASE.md` "App Check"), observed with enforcement off, then
enforced. Debug provider in DEV and with `VITE_FIREBASE_APPCHECK_DEBUG=1`; release Android builds refuse that flag.
Privacy: the token names the app, not the player, and nothing is stored — no new store data type (open point 6 in
`docs/store/privacy-declarations.md`). Rejected: installing the plugin now (crash without the owner's config), an own
native bridge to the Firebase SDK (more native code to keep, same config files), turning enforcement on in code,
`consumeAppCheckToken` replay protection (a second token per call, doubles the quota use). Guard: `test:app-check`.
**Status: in force (Q-53 and Q-07 open).**
## D-247 — Weekly contract: one optional contract per weekly board; meeting it adds a fourth crate next week (2026-11-05, Claude, night N12ba)
R2k. Every weekly board of a new Endless run names one **optional** contract for the coming week: carry N passengers
between two named regions, **either direction**. Meeting it adds one more crate to the next board; missing it costs
nothing (no accept step, no penalty). The rule sits behind `GameConfig.weeklyContract: true` (Endless only;
`EndlessRun.create` sets it for every new Endless run through one switch, `ENDLESS_WEEKLY_CONTRACT`). Daily, puzzles
and older saves carry no flag, so their state, hashes and the leaderboard replay are bit-for-bit unchanged (pinned in
`test:weekly-contract` against origin/dev 61f50fd bot runs) and `RULES_VERSION` stays 6; the save envelope goes
**v2 → v3** (v2 loads unchanged; a pre-R2k build refuses a v3 save as "newer version" instead of dropping the
contract), and the D-76 replay keeps the flag. **Draw** (`src/sim/contracts.ts`): unordered pairs of regions with an
open airport; target = 100 % of the pair's expected demand both ways over the coming 3-day week, read from the demand
weights of the current network (`RegionalDemand.expectedPassengers`), capped at 60; pairs under 8 are not drawn;
one pair uniformly from `new Rng(seed).fork('contract/<week>')` — no kernel RNG stream moves, so a run that never
meets a contract plays exactly as without contracts. **Counting**: only in contract runs a passenger carries
`originRegion`, and each delivery between the two regions counts; a `ContractMet` event fires once. **Fourth crate**:
the next board draws its cards as before, then one more from the cards not on it that can act at all (the hub card
needs a hub; "+2 slots" can always target an airport, so here it ignores D-150's first-hold rule); it is named in
`WeeklyUpgradeState.extraCrate`, kept by Back (D-49). A board with nothing left to add keeps the crate for the next
board. **UI** (minimal, local `--aw-contract-*` tokens for the pending redesign): a paper waybill under the yellow sign
(both region names, target, reward; last week's result with a filled/hollow square), the sign says "four crates",
the contract crate carries "· CONTRACT" in its stencil line; four crates go two by two without model windows on
portrait phones; the pause sheet gets a "Contract" row ("N. Europe – Mid. East 12/30", ", met"). All sizes of
`test:e2e:weekly-contract` fit without scrolling except 320×568 (scrolls by about the slip's height; crates reachable).
**Bot check** (`balance:contracts`, test:balance policy, which does not aim at contracts; nothing else retuned):
50 seeds from 0xA1A1: median 17.41 / 17.41 min without / with, 23 of 45 contracts met (51.1 %); 200 seeds: 16.75 /
16.75 min, 82 of 170 met (48.2 %), targets 8–60 (median 31), 82 boards with a contract crate, which the bot never took
(its card ranking always preferred one of the usual three), so every run is as long as without contracts
(`docs/balance/contracts-summary.md`). The share was set on this rate: 50 % share 96 %, 80 % 64 %, 100 % uncapped
38 % (the two busiest pairs ask for 300–450), 100 % capped at 60 → ~50 %. The reward is therefore modest: the
fourth card is often "+2 slots" or the second aircraft. Owner choices left open: share/cap (difficulty), either
direction vs one-way, no penalty, whether a contract also shows on the game-over report.
Guards: `test:weekly-contract` (`test:fast`), `test:e2e:weekly-contract`, `test:balance:contracts` (`test:ci`).
**Status: in force (difficulty to confirm after the closed test).**


## D-248 — Text size starts at the system's and goes to 150 % (2026-11-05, Claude, night N11ap)
R1g. Settings → Display "Text size" offers 100/115/130/150 %. On the first launch with no stored text size the game
reads the system size once and stores the nearest step: Android `Configuration.fontScale` through an app-local
Capacitor plugin (`TextScalePlugin`, `AirwayTextScale`, registered before the bridge like D-245's game loop), iOS the
Dynamic Type body size of the WKWebView (`-apple-system-body` / 17 px), browsers the `medium` font size / 16 px. A
stored size, even 100 %, or a choice made during the read always wins; a failed read stores nothing and the next
launch asks again. The WebView's own text zoom stays at 100, so only the game's step applies.
The step now scales the reading text of the menu sheets, settings, privacy/licences, logbook, leaderboard, puzzle
board, weekly upgrade labels, game-over strip and tutorial cards (`calc(Npx * var(--airway-text-scale))`). Screen
titles and the big logbook figures grow at 40 % of the step (`--airway-text-scale-title`), the dense recent-flights
table stops at 130 % (`--airway-text-scale-dense`). Fixed: split-flap cells and the departure/game-over boards (their
cells are the art), the in-world HUD, luggage tags, ATC strip and hub board (geometry drawn into the world; a later
pass after the UI redesign). At 130/150 % settings rows put the control under the label; at 150 % logbook records,
upgrade specs and (≤ 370 px) logbook totals stack. Apple's "Larger Text" label stays undeclared (needs 200 %).
Rejected: `@capacitor/text-zoom` (a dependency and a second scale applied by the WebView on top of ours), scaling
the HUD now (overlaps the dock/tag layout tests), a 200 % step (titles and boards would need the redesign).
Guards: `test:text-scale`, `test:e2e:text-scale-150`, `test:a11y-evidence`. **Status: in force.**
## D-249 — Announced demand surge: from week 3 one served airport per week announces +12 passengers a game day ahead (2026-11-05, Claude, night N12bb)
R2i. From the week-2 board on (so the first surge falls in week 3), every weekly board of a new Endless run draws one
**open airport that has a route** and a local start hour (08, 11, 14 or 16 — the 6-hour window never touches the
23–06 curfew). Exactly one game day before the window the airport **announces** the surge; during the window
(6 game hours on its local clock) it sends **12 more passengers** than usual, one every 30 minutes, to regions
drawn with its usual destination weights. The rule sits behind `GameConfig.demandSurge: true` (Endless only;
`EndlessRun.create` sets it for every new Endless run through one switch, `ENDLESS_DEMAND_SURGE`), exactly like the
weekly contract (D-247). Daily, puzzles, flagless and contract-only saves carry no flag, so their state, hashes,
ticks and the leaderboard replay are bit-for-bit unchanged (pinned in `test:demand-surge` against
origin/night/12ba-weekly-contract 4617dcb bot runs) and `RULES_VERSION` stays 6; the save envelope goes **v3 → v4**
(v3 loads unchanged; a pre-R2i build refuses a v4 save as "newer version" instead of dropping the surge), and the
D-76 replay keeps the flag. **Determinism** (`src/sim/surge.ts`): the airport, the hour and the extra passengers'
destinations come from `new Rng(seed).fork('surge/<week>')`, whose state is kept in the world snapshot; no kernel
stream moves — a surge run equals the run without surges until its first window opens, and the kernel demand stream
stays equal even through the window. Versioned params `SURGE_*` (`SURGE_PARAMS_VERSION` 1).
**Changed from the backlog's "e.g. ×2 for 6 hours"**: doubling this game's demand (1.3 passengers per million
inhabitants per day) gave a median of **1** extra passenger per window (bot, 50 seeds, range 0–5) — nothing to act
on, and a day-long notice for it would teach players to ignore the sign. A fixed count reads as a promise ("+12")
and does not depend on the city's size. **Drawn in the world** (no `src/render/**` change; the existing tag/edge-chip
DOM): a pennant stub on the airport's luggage tag right after its code plate — **hollow pennant + "+12 14:00"** (local
start) while announced, **filled pennant + "+12 do 20:00" / "+12 to 20:00"** while running; shape and words carry
the state, not colour; the off-screen edge chip carries the same pennant in its top-right corner; tag and chip aria
name the surge; the pause sheet gets a "Szczyt ruchu / Passenger surge" row ("WAW +12, 14:00–20:00 czasu lok.").
Local `--aw-surge-*` tokens until the UI redesign. Events `SurgeAnnounced` and `Surge` (start/end) for audio/HUD later.
**Bot check** (`balance:surges`, test:balance policy, contract on in both, the bot ignores the sign; nothing else
retuned): 50 seeds from 0xA1A1: median 17.41 / 17.41 min without / with, 26 windows opened in 23 runs, 6 runs
shorter, 1 lost at the surge airport; 200 seeds: **16.75 / 16.75 min** (D-79 10–18), 140 surges announced, 85
windows opened (79 runs), extra passengers per such run median 12 (3–24), 13 runs shorter, 0 longer, 4 lost at the
surge airport during or within 6 h after its window, 3rd board reached 34 → 30 of 200 (`docs/balance/surges-summary.md`).
Not done: a first-time card for the first announcement (would change the `first-time-cards` journey; the tag aria
and the pause row explain it), a sound on the announcement. Owner choices left open: size (+12) and length (6 h),
served airports only vs any open airport, the notice (one day), and whether the surge should also reach Daily.
Guards: `test:demand-surge` (`test:fast`), `test:e2e:surge-tag`, `test:balance:surges` (`test:ci`).
**Status: in force (size to confirm after the closed test).**


## D-250 — UI skin tokens before the redesign (2026-11-05, Claude, night N11aq)
Groundwork for the UI redesign (`docs/styles/ui-2026-11/KIERUNKI.md`: KARTA / KOKPIT / ZNAKI, the owner's pick is
still open), with no visual change. Every colour, typeface, weight, motion duration/delay, corner, shadow/hover rule
and icon size of the in-game HUD (boarding pass, tag dock), airport tags and chips (incl. the inline SVG inks of
`overlay.ts`), pause sheet, weekly board and contract waybill, hub cause board, game-over report and main menu /
settings is a semantic custom property `--skin-<component>-<role>` of one file, `src/ui/skin/current.css` (202 tokens,
461 literals moved; per-component names so a skin can split today's shared colours; values equal to a `theme.css`
palette entry point at it, so `test:contrast`/`test:cvd` still cover them). A new skin = a new token file imported
instead of it plus structural tweaks in the component CSS. The D-248 text-scale tokens stay in `theme.css`; sizes,
paddings, rules and die-cut shapes stay structural in the component CSS (`INVENTORY.md` lists both).
Evidence: with the skin substituted back every covered CSS file equals the old text; `npm run skin:pixels` (88
globe-less fixture shots — the eight `e2e/screen-fixtures.mjs` screens + pause, overlay, hub board — PL/EN × 412×915,
915×412, 320×568 at 100 % and 412×915 at 150 %) pixel-identical with equal computed styles against origin/dev.
Rejected: a TS token map (the values are CSS-only; inline styles would beat media queries), palette-named tokens
(`--skin-paper` used by every paper object would couple the components a direction separates), tokenising sizes and
paddings now (a new typeface changes them per component anyway; tag widths are tied to `overlay.ts` constants).
Not covered yet: ATC strip, logbook, puzzle board, leaderboard, tutorial, `glyphs.ts` outline, the globe. [N11as] Follow-up: all
of these but the globe are covered now (286 tokens; the tutorial's painted mini-world SVG stays art, like the globe).
Guards: `test:skin-tokens` (`test:fast`). **Status: in force.**

## D-251 — Endless licence classes: three difficulty tiers from scenario knobs only, unlocked on the device (2026-11-05, Claude, night N12bc)
R2h (Q-50 recommendation A/B). A new Endless run flies in **licence class I, II or III**. Class I is today's Endless;
the other classes change only scenario knobs, kept as data in one table (`LICENCE_PARAMS` in `src/sim/licence.ts`,
`LICENCE_PARAMS_VERSION` 1): **II** = curfew from week 2 (D-151: week 3) and a starting reserve of 3 turboprops (4);
**III** = II plus hubs 6 waiting seats smaller (36 → 30; upgrades still add 6) and 2 more curfew airports (the first
curfew week closes 4 instead of 2, then one more every two weeks as before, cap 8). No new rule: the curfew planner,
fleet and terminal queues take the class's values instead of the shared constants. The class sits in
`GameConfig.licenceClass: 2 | 3` (Endless only; Daily, puzzles, `1` and other values are refused); a class I run
carries no field, so its state, hashes, ticks and the Daily/leaderboard replay are bit-for-bit today's (pinned in
`test:licence-classes` against origin/dev 40bf2ae bot runs, Daily, flagless, contract and contract + surge Endless) and `RULES_VERSION`
stays 6. The save envelope goes **v4 → v5** (v3 and v4 — incl. a run with a surge — load unchanged; a pre-R2h build refuses a v5 save as "newer version"
instead of continuing a class II/III run under class I rules); the D-76 replay and "Same world" keep the class.
**Unlock** (device only, no new key, nothing leaves the device): the logbook (`airway.logbook.v1`) keeps the most
weeks flown per class (`licenceWeeks`); a class opens once a run of the class below reached **week 5** (4 weeks
flown). Class I counts Endless class I and daily challenges (same rules); a logbook from before R2h starts class I at
its `longestWeeks` (all its flights were class I rules). The menu choice is one field of the settings record
(`airway.settings.licenceClass`, beside the home region); a closed class falls back to I. **UI** (minimal, for the
pending redesign): nothing changes until class II opens; then the Endless row's decorative gate cell becomes the
**licence stamp** — a native select with a double-ruled border showing the numeral (I/II/III), ≥ 48 px, the board
keeps its height and columns; while the picker is open the options name what each class changes ("Class II: curfew
from week 2, 3 turboprops"). A newly opened class is announced once on the menu's paper notice ("Class II licence
issued…"); the game-over report shows "Licence class II" beside the score; the logbook gets a "Best by licence class"
row (I/II/III weeks) and the class numeral under "Endless" in the recent flights. PL + EN.
**Bot check** (`balance:licences`, the test:balance policy with the weekly contract and demand surge on, the bot does not adapt; nothing
tuned): 50 seeds from 0xA1A1: median **17.41 / 16.68 / 14.69** min (I / II / III); 200 seeds: **16.75 / 15.45 /
14.10** min, p10 9.93 / 7.95 / 7.51, 2nd board reached 68 / 58 / 48 %, week 5 reached 0 / 0 / 0 of 200
(`docs/balance/licences-summary.md`). Class I stays in D-79's 10–18 (gated); II and III are reported only. II is a
mild step for the bot (−1.3 min), III a clear one (−2.7 min, −32 % passengers). The week-5 bar is high for the bot
(no class I run of 200 got there); human players were not measured. Owner choices left open: the unlock week (5), whether
Daily counts toward class II, the class II/III knob sizes, the stamp under the "Gate" column head, whether classes
get their own records/leaderboards later. Rejected: a separate menu row (D-236: the board would grow), new rules per
class (backlog: scenario knobs only), a rules-version bump (class I is unchanged).
Guards: `test:licence-classes` (`test:fast`), `test:e2e:licence-classes`, `test:balance:licences` (`test:ci`).
**Status: in force (knobs and unlock week to confirm after the closed test).**

## D-252 — Bundle budget back to green: skin tokens resolved at build, packed distance table, JS budgets 1,180 / 360 kB (2026-11-05, Claude, night N11ar)
`test:bundle` was red on dev (7759457) with all four budgets over: main JS 1,181.6 kB raw (budget 1,150) / 353.1 kB
gzip (340), CSS 105.0 kB (90; 90.0 kB before D-250, +14.6 kB from the token indirection) and all of `dist/` 4,311.5 kB
(4,300). Waste removed, no behaviour or visual change: (1) release builds write every `var(--skin-x)` value in place
(`scripts/vite-skin-inline.mjs`, a Vite `transform` before `vite:css`; the source and `npm run dev` keep the tokens).
The skin is one static file per build, so each token has one value; palette references (`var(--airway-ink)`) are
written out too when the property is a constant (declared once, in a plain `:root`, never named by a script), which
gives the pre-D-250 CSS text. The plugin refuses fallbacks, unknown tokens, cycles and any skin token or read property
set outside `:root`; the tokens TypeScript reads (inline SVG inks) stay on `:root` with resolved values. (2) Dead CSS:
the DEV overlay fixture controls (`.airport-demo-controls`, and their two skin tokens) and the old a11y demo panel
(`.airway-a11y-controls`, `.airway-sr-only`) were used nowhere (−1.7 kB). (3) `src/data/generated/distances.ts`
stores the same 13,530 integers as three base64url digits each instead of a decimal list (72.0 → 40.6 kB raw,
32.0 → 27.7 kB gzip), decoded once at module load; every `distanceKm(a, b)` is unchanged (checked on all 27,225 pairs).
After: main JS 1,150.4 kB raw / 347.8 kB gzip, CSS 88.8 kB, `dist/` 4,264.1 kB. CSS and `total` budgets stay. The JS
budgets are raised, 1,150 → 1,180 kB raw and 340 → 360 kB gzip: the 31 kB cut leaves the chunk 0.4 kB over, and what
is left is content merged since D-143 (puzzles 31–40, the legal pages D-244, the globe G-series, weekly contract,
demand surge, licence classes D-251), not waste; the gzip cap keeps today's gzip/raw ratio (0.302). The raise is small
on purpose (+2.6 % headroom), so the next feature-sized growth is again a decision. Next levers, not done: the in-app
privacy policy and terms load on demand (≈ 28 kB raw / 10 kB gzip, needs an async i18n part), puzzle levels reference
`cities.ts` instead of repeating airport records (~64 kB raw of JSON; puzzle data, other owner), three.js is ~508 kB of
the chunk (`src/render/**`, other owner), WOFF2 fonts (−40 % of 624 kB, `dist/` only). Rejected: lightningcss/csso
as CSS minifier (−1 kB for a new dependency), short-name mangling of the tokens (resolving them is smaller and
simpler), raising the CSS budget. Guards: `test:skin-tokens` (plugin unit cases + the real skin inlines with nothing
left), `test:bundle` (no other `var(--skin-` in dist CSS), `test:cities` (packed table up to date). Evidence: built CSS
equals the pre-D-250 build apart from palette names written out and the kept `:root` block; `npm run skin:pixels` with
`AW_SKIN_INLINE=1` against origin/dev (see the PR). **Status: in force.**

## D-253 — Weather front: a weekly cloud band takes one departure slot from the airports under it; built, shipped OFF (2026-11-05, Claude, night N12bd)
R2j (post-launch update candidate; D-252 taken by N11ar). From week 2 every week has one **weather front**: a band
40° of latitude tall (southern edge drawn from 40°S…30°N in 10° steps) that forms 1–6 game hours after the weekly
board at a drawn longitude (15° steps) and drifts **east at 6° per game hour**, sweeping the whole circle once (64 h:
it forms over its first 4 h and thins out over its last 4 h) and is gone before the next board. Every airport inside
its latitudes is under the deck for exactly **4 game hours** a week and has **one hourly departure slot fewer**
(D-41: city 2 → 1, hub 3 → 2, upgrades keep their +2). The path is a pure function of the seed and the week
(`new Rng(seed).fork('weather/<week>')`, `src/sim/weather.ts`, integer tenths of a degree, no transcendentals, D-13);
nothing is added to the world snapshot and no kernel stream moves. Versioned params `WEATHER_*`
(`WEATHER_PARAMS_VERSION` 1). **Off by default:** the rule sits behind `GameConfig.weatherFront: true` (Endless only;
Daily and puzzles refuse it) and `EndlessRun.create` leaves it off (`ENDLESS_WEATHER_FRONT = false`); only the DEV
switch `?weather=front` (folded to false in a production build), tests and the balance bot turn it on. Daily, its
leaderboard replay and Endless with default flags are bit-for-bit origin/dev 7759457 — hashes, ticks, scores and the
saved bytes (pinned in `test:weather-front`); `RULES_VERSION` stays 6. **Save:** only a weather run is written as
envelope **v6**; every other save stays v5, byte for byte, so a pre-R2j build keeps loading them and refuses only a
weather run as "newer version" instead of continuing it without the front (a v5 with the flag or a v6 without it is
corrupt). The D-76 replay and "Same world" keep the flag. **Shown** (no `src/render/**` change; existing tag DOM, skin
tokens `--skin-tag-front-*`): the weather-map cold-front line (a rule with three teeth) as a stub on the airport's
luggage tag — **hollow teeth + "−1 14:20"** (local arrival) up to 6 game hours ahead, **filled teeth + "−1 to 18:20" /
"−1 do 18:20"** while under the deck; shape and words carry the state, not colour; the tag aria names it; the pause
sheet gets a "Front atmosferyczny / Weather front" row (airports under it and until when, else the next airport and
time, else "away from your airports"). `world.weather` gives render the band (`westLon10…eastLon10`, latitudes) for the
darker cloud deck (ext session). **Bot check** (`balance:weather`, the test:balance policy as a shipped Endless run,
contract + surge on, the bot ignores the front; nothing retuned): 50 seeds from 0xA1A1: median **17.41 / 17.41** min
without / with; 200 seeds: **16.75 / 16.75** min (D-79 10–18), 355 fronts formed (194 runs), served airports under a
front in 149 runs (median 36 airport-hours), **1** departure held for a slot under a front (all slot holds 16 / 17),
all 200 runs equal in length and passengers (`docs/balance/weather-summary.md`). As specified, "−1 slot" barely bites:
the bot's airports almost never use their full hourly slots (16 holds in 200 runs), so the front changes nothing for
the bot; a human who stacks aircraft on a hub would feel it. Not done: the darker cloud deck on the globe and its
shape-coded edge (render, ext session; low-preset perf check D-73), an edge-chip mark, a first-time card, a sound.
Owner choices left open: whether a front should bite harder (e.g. slots halved, or a ground hold) before it ships,
its size/speed/frequency, whether it ever reaches Daily.
Guards: `test:weather-front` (`test:fast`), `test:balance:weather` (`test:ci`).
**Status: implemented behind a flag, OFF in shipped Endless (post-launch candidate; strength to decide).**

## D-254 — The real session runs in browser tests on a DEV-only stub world without WebGL (2026-11-05, Claude, night N12be)
G7 workaround for tests only (no gameplay or render change). Since the satellite globe, SwiftShader draws ~10 frames
per second, so every browser suite that plays the real game times out and tonight's session wiring (R4c fill trend
D-221, R4d hub board D-228, R1n milestones D-242, R2k contract waybill + crate D-247, R2i surge pennant D-249, R2h
licence classes D-251, R2g home region D-236) was only typechecked. A Vite **dev** build now honours `?render=stub`:
`src/main.ts` loads `src/game/dev/stubWorld.ts` (behind the `import.meta.env.DEV` ternary, like the DEV bot) instead of
`createWorld()`. The stub implements the same `World` interface with the real `GlobeOrbitCamera` on a three.js
`PerspectiveCamera` and the same `project`/`pickGlobe` maths as `src/render/world.ts` (hit tests, `window.aw` gesture
points and tag anchors are where the game puts them), the same requestAnimationFrame clock feeding the session's frame
hook, and a 2D canvas with dots and lines instead of the globe. `&clock=frozen` gives the frame hook dt = 0, so game time
passes only through `window.aw` and a journey replays exactly at any frame rate; `window.__awStub.airportPoint(id)` gives
an airport's page point for real pointer taps and presses. Chosen over a Node + jsdom harness (no new dependency, the
real CSS/layout and the real pointer → gesture recognizer path are exercised) and over `?quality=saver` (still ~10 fps).
The stub never ships: `test:bundle` fails if its marker or `__awStub` is in `dist/`, `test:session-stub` fails on a
static import. Not covered by it: anything `src/render` draws (rings, barriers, planes, the globe). Guards:
`test:e2e:session-stub` (`test:ci`, ~25 s: the full journey from the menu through two weekly boards, surge, jam, hub
board, game over, logbook, class II; a DEV `&weather=front` run to the first front stub (R2j, D-253); the leaderboard
switch off (R7l, D-237) and a Daily whose results are unchanged and which never reaches the leaderboard) and its headless seed twin `test:session-stub` (`test:fast`).
**Status: in force (until G7 makes the real globe fast enough under SwiftShader; keep it for quick session journeys).**

## D-255 — The in-app privacy policy and terms texts load on demand from a bundled chunk (2026-11-05, Claude, night N11at)
D-252 left the main chunk 2.6 % under its raw budget and named this lever. The long legal texts of Settings → Help —
the draft banner, sections and date of the privacy policy (D-243) and the terms of use (D-244), PL and EN, 52 keys
per language — move from `src/i18n/{en,pl}.ts` to `src/i18n/legal/{en,pl}.ts`. `loadLegalText()` (`src/i18n`)
imports them with `import()` the first time the player opens either page, so Vite emits one chunk
`dist/assets/legal-*.js` (25.1 kB raw); it ships inside the app (Capacitor loads it from disk, no network, offline
as before). `legalText(key)` reads the active language like `t()` (pseudo-locale included). The router
(`src/game/screens.ts`) opens the page once the chunk is loaded and drops the open if the screen changes meanwhile;
the page itself is built synchronously as before (focus on Back, same DOM, same text). Short strings stay in the main
catalogs: row labels, page titles, overlines, offline notes and the publisher block (≈ 1 kB per language, shown on
the settings screen itself). After (on dev 6f7d48d): main JS **1,157.5 → 1,132.8 kB** raw, **350.0 → 338.9 kB** gzip;
CSS 89.5 kB unchanged; `dist/` 4,271.9 → 4,272.3 kB (+0.4 kB chunk overhead). Budgets unchanged (D-252): headroom
JS raw 1.9 % → 4.2 %, gzip 2.9 % → 6.2 %. Translator export (`i18n:export`) still reads only the main catalogs: a new
language adds `src/i18n/legal/<code>.ts` with a lawyer-checked translation (test:i18n fails without it once the
language ships). Not done: puzzle levels referencing `cities.ts` (other owner, ext/04+) — of 220 start-city records
45 have coordinates rounded differently from `cities.ts` (levels 01–09 style, e.g. LON 51.5/−0.5 vs 51.5/−0.1) and
`continent`/`hubCapacity` are per level, so a reference needs per-record overrides to keep the levels byte-identical;
all start-city records together are ~19 kB of compact JSON (the whole puzzle data ~70 kB), so the gain is ≤ ~12 kB raw.
Rejected: one chunk per language (a language switch would need a second load; both together are 25 kB), preloading
the chunk when Settings opens (the page opens within milliseconds anyway). Guards: `test:i18n` (legal catalogs: one
file per language, same keys, literal strings, used, no banned synonyms, no key in both), `test:privacy-text` (bodies
only in `src/i18n/legal/`, loaded only by `import()`, router waits), `test:terms`, `test:bundle` (exactly one non-main
chunk holds both documents in every language). **Status: in force.**

## D-256 — KARTA UI skin as a DEV-only preview (`?skin=karta`), pending the owner's choice (2026-11-05, Claude, night N11au)
The owner called the current UI "AI slop" and picks one of three directions (`docs/styles/ui-2026-11/KIERUNKI.md`);
the recommended one, **1 KARTA** (aeronautical-chart overprint on the photo globe), is built as an alternative skin so
it can be judged in the real game, not only on mockups. **Preview only — not a style decision.** `src/ui/skin/karta.css`
redefines every token of `current.css` (D-250) and adds structural tweaks, all scoped to `:root[data-skin="karta"]`:
ink margins with a double neatline, chart caps (Barlow Condensed) and mono figures (IBM Plex Mono), lettering with an
ink halo instead of cards, leader lines from each airport to its label, a seat scale (one segment per waiting place)
under the code, a week ruler with hatched nights and a "now" marker in the top margin, chart magenta only for a jam
(block + restricted-area ring), a quiet legend-strip dock, ruled 48 × 48 targets. `src/main.ts` turns it on only when
`import.meta.env.DEV && ?skin=karta` (`src/ui/skin/preview.ts` sets `<html data-skin="karta">`); the few geometry hooks
in `overlay.ts` / `boarding-pass.ts` are guarded by the same `import.meta.env.DEV`, so a release build folds them away.
Evidence: the whole `dist/` of the branch is byte-identical to origin/dev e4c3a37 (sha256 of every file; CSS
`index-D0mu2iKD.css` 89,463 B, main JS 1,132,834 B); `skin:pixels` default over three captures of each tree: 119/120
identical, the one left (`overlay-en-412x915`) differs in the same 261-pixel band of the jam tag that also flips between
two captures of origin/dev itself (run-to-run noise). Fonts are served from
`mockups/fonts/` (OFL, licences there, `docs/ASSETS.md`) by the dev server only — nothing added to `dist/`.
Label contrast over the brightest desert of the real frame (seed 0xA1A1, Sahara): paper letter on bare sand ≈ 1.1:1
(why the halo is required), ink halo on sand ≈ 14:1, paper letter on its ink halo 15.1:1. Guards: `test:skin-tokens`
(karta covers every token, adds none, every rule scoped, palette untouched, imported only by the DEV branch). Screens:
`docs/shots/ui-karta/` (fixtures + two real-game frames, contact sheet `zestawienie.png`). If the owner picks KARTA, the
next step is to make it `current.css` and move the fonts to `public/fonts/` (WOFF2 subset). `src/render/**` (flat sky
constant) belongs to the ext session and is untouched. **Status: preview only, pending owner choice.**
*Update (night N11av):* the preview closes the mockup gaps except route distance labels: occupancy figure after the
code, glyphs grouped by region with a count, time arc on the jam ring (`--karta-jam`, share of the 45 s grace),
off-screen note distance from the view centre, day names under the week ruler, names under the dock cells, graphic
scale on the menu title block. Helpers live in `src/ui/skin/preview.ts`, called only under `import.meta.env.DEV &&
skinPreview.karta`; the module has no runtime import (a static one reordered the release bundle although its code was
dropped — `src/main.ts` hands in `t`, `localNumber` and the grace), guarded by `test:skin-tokens`. Text reuses existing
catalog keys, so no string is added. Release `dist/`: all 30 files sha256-identical to origin/dev 163bf50. Route
distance labels need the route geometry (render or `session.ts`), outside this preview.

## D-257 — Róża (KARTA v2 C) becomes the default UI (owner, 2026-11-05; Claude, night N11az)
The owner picked variant **C „Róża”** of `docs/styles/ui-2026-11/KARTA-V2.md` (2026-11-05, verbatim „zrób C róża”), so
it ships as the default UI; the earlier draft of this entry (KARTA as default, N11ax, PR #252) is superseded and its
infrastructure reused: WOFF2 fonts (`scripts/vite-font-files.mjs`), release CSS without overridden rules
(`scripts/vite-skin-prune.mjs`), `test:glyphs` on WOFF2, the DEV `?skin=current` comparison with the old "Diorama"
tokens (`src/ui/skin/diorama.css`, never in a release).
**What the player sees.** One shape carries the game, the compass rose of an aeronautical chart. *HUD*: the top bar is
gone; the week ("Tydzień 7") in Alegreya and the passengers on the sky top-left, the pause a ringed 48 × 48 target, and
**one 24-hour day dial in the thumb corner** (night 20–06 hatched, a tick per hour, heading bug = now, time and "dzień 2
z 3" inside; landscape: a compact dial with the time, the day joins the week line). *Dock*: the six actions on an **arc
around the dial** (radius 154 px, 158°–274°; positions solved so every 48 × 48 target stays apart and inside the safe
areas at 320 × 568 and up), caption outside the arc, chosen aircraft ringed, an empty aircraft or hub reads "za 1 dzień";
symbols redrawn for Airway (`src/ui/hud/icons.ts`, the KARTA v2 SYM set: course-line undo, straight-wing turboprop,
swept four-engine widebody, three-runway hub, sheet-corner globe/map, a speed arrow whose wind barbs count the tempo).
Landscape: the arc runs down the right edge in sky ink; a short screen keeps 48 px targets. While a hub cause board is
open the arc lies flat along the bottom band. *Airports*: around the renderer's medallion the overlay draws a **rose**
(`src/ui/skin/roza.ts`, one SVG per airport at its screen position): one tick per waiting place, long = taken (2–3
places per tick above 24), the hub's ring doubled, the **city name set along the ring** in Alegreya; its inner radius is
the medallion's footprint (`MEDAL_RADIUS`, read-only knowledge of `src/render/airports.ts`) projected each frame. The
note beside it reads code, "14 z 24", the fill-trend chevron and the passengers grouped by region with a count; notes
keep off every rose (fixed obstacles in `layoutTags`). *Jam*: rose, name and note in vermilion `#F2603F`, a heavy
**countdown arc** round the rose (share of the grace left) and the sentence "Zator, sieć zamknie się za 42 s". *Menu*:
"Airway" and a tagline on the sky, the entries on the **western arc of a big rose** in the thumb corner with leader
lines (`rozaMenuArc` measures them), the run-starting entry marked by a vermilion diamond. Sheets (pause, settings,
weekly board, game over, logbook) keep the ink panel with a chalk neatline in Alegreya / Atkinson. All new text is in
the catalogs (`roza.*`, PL/EN, length budgets in `src/i18n/limits.ts`); captions that repeat an accessible name are
aria-hidden.
**Fonts.** Only the mockup's faces: **Alegreya 700** (new in the release: a WOFF2 Latin subset, 23.9 kB, OFL, no
Reserved Font Name, `docs/ASSETS.md`, listed in Settings → Licences) and the shipped **Atkinson Hyperlegible Next**
400/700 for figures and captions; KARTA's Barlow Condensed and Airway Chart Mono are dropped from `public/fonts/`; no
mono face and no spaced capitals in the HUD, notes and menu.
**Contrast** follows `docs/notes/roza-contrast.md` (PR #259): vermilion `#F2603F` (5.8:1 on the halo) with an 8 px halo
under the countdown arc and a haloed start tick; dim chalk at 62 % (`#9C9E9A`); dim on the sky `#4A5559`; a 1.6 px halo
for 12–12.5 px text; the sky lettering (week, passengers, pause, title, landscape dock and dial) gets a light halo
`#EEF3F2`; region glyphs keep a chalk outline under a dark one (AFR, NAM). Re-measured on real stills, see the PR.
**Structure.** Tokens: `src/ui/skin/current.css` (Róża values); structure and the rose palette: `src/ui/skin/roza.css`,
every rule under `:root[data-skin="roza"]` (`index.html` sets it for the first paint; `startRoza` in `src/main.ts`).
The pruner also drops every component rule of an element Róża hides outright (`display: none`, e.g. the old pass
fields). Proof: `skin:pixels` on this tree, dev tokens vs `AW_SKIN_INLINE=1` (inlined + pruned): 119/120 shots
pixel-identical (the tutorial differs by 1,267 channel values, the known run-to-run noise); computed styles differ only
on the elements Róża hides (`.airway-pass__band`, `.airway-sign__pictogram`, display:none).
**For the ext session (`src/render/**`, untouched here):** the medallion should become the rose's centre — the chart
airport symbol (runway pattern; hub = three runways), no own seat ring, no dark disc beyond the rose's inner radius
(today `0.038 × 1.2 / 1.7` globe radii), and `MEDAL_RADIUS` in `roza.ts` must follow any change; the handoff spec is
`docs/notes/roza-render-spec.md` (separate session).
Guards: `test:skin-tokens` (Róża tokens are the skin, Diorama covers every token and is DEV-only, structure scoped,
palette only `--roza-*`, Alegreya and its licence present, KARTA faces gone, helpers type-only and not DEV-guarded,
pruning cases incl. hidden elements), `test:glyphs` (Alegreya + fallbacks), `test:bundle` (6 WOFF2 named, none
missing), `test:hud-targets` (arc order), `test:e2e:fill-trend` (chevron after "14 z 24"). **Status: in force.**

## D-258 — CSS budget 90 → 109 kB for the Róża structure (owner-approved ceiling, 2026-11-05; Claude, night N11az)
Release CSS with Róża (D-257) measures **107.2 kB** (`npm run test:bundle`; origin/dev 89.5 kB): the rose structure
(`roza.css`) restyles the component CSS instead of replacing it, so the DEV `?skin=current` comparison still works.
Already applied: tokens inlined (D-252), declarations Róża overrides pruned, and new in N11az the rules of elements it
hides; the dock's flat-row positions from one `--i` rule. The owner approved a ceiling of 109 kB earlier; it is used
as the budget (+1.7 % headroom), so the next growth is again a decision. The way back towards 90 kB is to fold
`roza.css` into the component CSS and delete the Diorama structure (drops `?skin=current`). Main JS 1,146.8 kB raw /
344.6 kB gzip and `dist/` 3,955.5 kB stay within their budgets. **Status: in force.**

## D-259 — Róża polish: sentence-case sheets, rose names that make room, the pause sheet nearer the thumb (2026-11-05, Claude, night N14b)
Three leftovers of D-257 reported by its author, fixed without new fonts or new budget.
**Sheets in Róża typography.** The crates (weekly board), game-over report, leaderboard, puzzle board, settings,
logbook, hub cause board, pause sheet and ATC strip still carried the old split-flap look: letter-spaced capitals
(`letter-spacing: .04–.14em` + `text-transform: uppercase`) and catalog labels written in capitals. The tracking and
the uppercase transform are removed from the component CSS itself (not overridden in `roza.css`, so the release CSS
shrinks; the DEV `?skin=current` comparison loses its capitals too, which is accepted), the Róża overrides that only
undid them are deleted, the leaderboard title is set in Alegreya like the other sheet titles, and the catalog labels
the sheets show are in sentence case in PL and EN (`pause.title` "Krążenie", `upgrade.freight` "Fracht",
`gameover.report` "Raport zdarzenia ATC", `gameover.cancelled` "Odwołany", `action.back` "Wróć", `settings.on/off`
"Wł./Wył.", the stamp captions, the menu titles that head their sheets — "Ustawienia", "Dziennik", "Zadania" … — and
the rest of `upgrade.*`, `gameover.*`, `settings.*`, `menu.gate/status/onTime`). Kept in capitals: codes (IATA, flight
numbers, `PRY-001`), the brand line `menu.sign`, the daily-share text (pasted outside the game) and
`privacy.overline` (word for word with the landing page, `test:privacy-text`; `site/` belongs to another session).
**Rose names make room** (`rozaNameLayout`, `src/ui/skin/roza.ts`; `src/ui/overlay.ts` draws the roses after laying
the names out each frame). A curved city name is kept only where it clears every name already placed and every other
rose's ring of ticks; otherwise the rose shows its IATA code, else no name (the note beside it still reads the code).
Priority: a jam, a hub, the fuller airport, then the label already shown (it also needs 3 px less clearance, so
labels do not flicker while the globe turns). Guard: `test:roza-names` (fast).
**Pause.** The ringed pause target (top right) measures 48 × 48, hit-testable and clear of the week line, the dial and
the dock arc at every size — no change. The pause *sheet* stood under the week line, so on a tall phone Resume sat in
the top third, and at 320 × 568, 360 × 640, 1000 × 904 and in landscape it covered part of the dock arc, which stays
usable while paused (undo, aircraft, globe view). Now it fills from the bottom of the band between the week line and
the arc (the arc reaches 295 px above the bottom edge in portrait and foldable layouts; `align-self: safe end` keeps
it under the week line when the band is shorter — where a WebView lacks abspos alignment it falls back to the old
top position); in a landscape phone it stands left of the arc and its captions (176 px from the right edge). Short
screens (portrait < 680 px, landscape < 400 px tall) drop the network summary from the sheet (the HUD and the notes
still show it) so the actions never cover the arc. Resume now sits at 47–58 % of the height on 800–1088 px tall
screens (was 26–35 %). Guard: `test:e2e:pause-reach:stub` (11 sizes PL/EN, in `test:ci`; fails 11/11 on the old
placement).
**Store-shot follow-ups** (the real-renderer store shots of PR #265). *Dock captions* ("Satelita", "Tempo 1×") that
would lie over a rose's ticks or name step back for that frame (`rozaCaptionsYield`; the caption repeats its button's
accessible name, the rose carries the game; boxes re-measured every 15th frame, no layout read per frame). *Rose names*
already tested against every other rose's ring (Amman under Ankara now drops to its code or nothing). *Notes* no
longer get the third layout try that drifted 3 × their height (`layoutTags`): a note blocked on both sides of its rose
hides instead of standing beside another rose ("BGW 3 z 24" next to Ankara). *Menu* (`src/game/world.ts`, not the
renderer): in portrait the view looks 16° further south than `MENU_TARGET`, so the demo network (London–Dakar) rides
above the entries on the rose; in landscape the globe is a big horizon left of the entries under the title instead of
a small disc between them. *Crates*: while the weekly crates are on screen the overlay (roses, notes, edge flags)
steps back, and a 521–630 px tall wide screen with a waybill gives the model windows up 28 px more so the stats end on
screen (960 × 540). Not ours: the rose ring offset against the medallion on tablet/iPad (render session).
Release CSS 107.2 → 106.3 kB (D-258 budget 109 kB). **Status: in force.**

## D-260 — Large-screen matrix sizes and a stub-only resize journey (2026-11-05, Claude, night N15b)
R4f. `ui:matrix` (and `ui:matrix:stub`, `test:e2e:fixture`) gains Google's large-screen reference sizes 1024×640,
1280×800, 800×1280, 841×701 and 1600×900 plus a 500×700 free-form window: 12 sizes, 96 shots (`--size=WxH` runs a
subset). The mid-run resize journey `test:e2e:resize` exists **only as `test:e2e:resize:stub`** (in `test:ci`): its core
check — the snapshot hash and tick do not move while the window changes — needs the frozen stub clock (D-254); on the
real globe an open hub board leaves the run playing and SwiftShader is too slow for the sequence anyway (G7). The
camera target is read from a new view-only `window.aw.state().camera` (longitude, latitude, zoom; DEV adapter, not in
the hash), so the check is not tied to the stub. Two Róża layout bugs the new sizes exposed, fixed in CSS:
**landscape hub board** (640×360, 915×412, also without a resize) covered the dock captions and the dial left of the
dock column — while the board is open they are now put away in every layout, as portrait/foldable already did (the
symbols stay, each with its accessible name); **weekly crates at 1024×640** with the contract waybill ran the cards
39 px below the screen — on wide screens 600–679 px tall the model window gives up 50 px more (unchanged from 680 px up
and on the 960×540 store shot). `docs/shots/matrix/` gets the six new sizes on the next real-renderer `ui:matrix`.
**Status: in force.**

## D-261 — Store shots rerun after D-259: crates stay on the 960×540 screen (2026-11-05, Claude, night N15a)
The 60 store PNGs and the site shots were recaptured on the real renderer after D-259 and D-260. The D-259 layout fixes
hold: dock captions no longer lie over a rose, the curved names no longer collide (Amman under Ankara drops to its code
or nothing), notes stand beside their own rose (BGW right of Baghdad in landscape), the menu entries clear the airports
on every size except a near-touch of "Ustawienia" on the PL phone, the crates hide the airport layer. One defect was left:
at 960×540 the hub crate's "fullest hub" stamp ran 23 px below the screen. On wide screens 521–599 px tall with a waybill
the model window gives up 36 px more (`100vh - 436px`, a 12 px margin), and `store:shots` now fails when any part of a
crate or of the game-over report lies outside the viewport (it failed on the old CSS). Remaining items are listed in the
PR (render-owned rose ring offset and medallions between crates; "Ustawienia" touching the Dakar medallion on the PL
phone menu; on the 360×640 phone game shot Amman, Athens, Venice and Baghdad show no note and Amman no name, so the
busiest hub is unlabelled). **Status: in force.**

## D-262 — Róża labels by importance; the menu network clears the entries (2026-11-05, Claude, night N16a)
The store shot game-phone (360×640) left Amman, the busiest hub, with neither a curved name nor a note in the Levant
cluster, and Athens, Venice and Baghdad without notes: the notes were placed in array order, and a name blocked on top
of its ring had nowhere else to go. Now: (1) names and notes share one priority, **jam > hub > fuller airport**
(`roseRank`); the higher one is laid out first and so takes the room a lower one wanted (names: `rozaNameLayout`; notes:
`TagSlot.rank` inside the jam / passenger / plate tiers of `layoutTags`). (2) A name whose top is taken runs along the
bottom of the ring (`name-below`, read left to right) before it shortens to the code (on top, then below) or drops.
(3) A note tries its side, the other side, under its rose and over it (clear of the rose's name); where the full note
fits nowhere it tries the **compact form** — code and "14 z 24" only (`.airport-bubble--compact`; a jam keeps its
sentence) — before it hides. (4) The busiest hub in view (`must`) always shows at least its code and fill: compact over
a lower-ranked rose if need be, and as the very last resort anywhere. (5) A rose's obstacle box is what it shows (its
ring, plus its name on top or below), so a rose without a name no longer blocks notes above it; the Róża dock symbols
are fixed obstacles too, and a dock caption under a shown note steps back like one under a rose. (6) 3 px hysteresis
stays: a name already shown, and a note at the place it held last frame, need 3 px less clearance (the note's lenient
try only runs when the normal one fails, so an unchanged frame lays out exactly as before). On the PL phone menu
"Ustawienia" touched the Dakar medallion: D-259's 16° southward tilt is now a minimum; the view looks further south
(up to 32°) until no demo airport comes within 22 px of a menu entry at any turn of the menu spin
(`src/game/menu-clear.ts`, measured on the real projection in `src/game/world.ts`). Checked by `test:roza-names` and
`test:overlay-layout` (the Levant cluster fixture at 360×640), `test:menu-clear` and `test:e2e:menu-clear` (real
renderer, six sizes; the DEV probe `__awWorld.framing().menuClashes`). On the real renderer (`docs/shots/n16a/`, before
and after, half size) the phone shot now shows Amman's name along the bottom of its ring and the notes of Venice, Riga and
Baghdad; Amman's compact note "AMM 3 z 36" stands partly over Baghdad's ring (the must pass: on 360 px every free place
is taken), Athens and Ankara still show no note. The menu looks 24° south at 360×640 and Dakar clears "Ustawienia". Store
shots are recaptured by the coordinator after the merge. **Status: in force.**

## D-263 — Róża notes never cover a ring and stay at their rose (2026-11-05, Claude, night N16b)
After D-262 the phone shot (360×640) showed the forced compact note "AMM 3 z 36" on Baghdad's ring and "BGW 2 z 24"
floating above Baghdad's name next to Ankara; both read as belonging to the wrong airport. Rules now: (1) a rose is two
obstacles for the notes, its ring of ticks (`TagSlot.ring`, a disc: the corners of its box stay free) and its name; **no
note ever covers a ring, not even the forced busiest-hub one** — the forced passes may cover a lower-ranked rose's name
(which then steps back that frame) and any other obstacle but a ring, and boxed in by rings the note hides. (2) **A note
stays at its rose**: a place whose box lies farther than one rose radius (at least 16 px) beyond the ring is not taken,
the note hides instead (`homeReach`; a jam's note keeps its 160 px reach). (3) Two more places, **left and right of the
rose's own name** at its middle, sliding outward up to 36 px in 6 px steps: in the shot the busiest hub's compact note
reads "AMM 3 z 36 · Amman" under its ring, clear of the dock symbols. Checked by `test:roza-names` and
`test:overlay-layout` on the 360×640 Levant cluster fixture with the shot's dock symbols: no note rect meets any rose ring,
every shown note within one radius of its own ring, Amman's note level with its name. Venice, Athens and Baghdad show no
note on the phone (no free place near them); on the landscape shot nothing changes. **Status: in force.**

## D-264 — Róża: a note is shown only where it is clearly its own rose's (2026-11-05, Claude, night N18a)
The store shots game-iphone and night-iphone (440×956, after PR #271) still let two notes read as Ankara's: "ATH 2 z 36"
had slid up from beside Athens' name to hang right above "Ankara", and "BGW 2 z 24" stood over Baghdad's name but level
with Ankara's ring, right of it, where Ankara's own note would be. D-263 kept a note off every ring and near its rose, but
not nearer its rose than a neighbour's. Rule now (`ownsPlace` in `src/ui/overlay-layout.ts`, `TagSlot.rose` set by
`rozaNotePlaces` / `rozaRoseObstacles`): **a place is taken only when the note's gap to its own ring is at least
`OWN_MARGIN` = 12 px smaller than its gap to every other rose's ring, and the note keeps 12 px from every other rose's
curved name** (gaps from the note's nearest edge; a ring is its disc). A neighbour's name further off does not count: a
first try that weighed names like rings pushed "ANK 0 z 24" off its natural place right of Ankara on the foldable shot
because Baghdad's name stood 20 px below. Standing level beside its own name (D-263 places 4/5, e.g. the forced
busiest-hub "Amman · AMM 3 z 36") the name counts as its rose, so that case stays. A name the forced must pass covers
steps back and does not count. A note that fails tries its other places, then the compact form, then hides (the rose's ticks still show the fill). The
place held last frame gets 3 px less margin (hysteresis), and that lenient try now runs only after every slide of the
place failed at full clearance, so an unchanged frame lays out exactly as before. Checked by `test:roza-names` (the
iPhone cluster with inputs read from the real overlay in both scenes, fresh and with the shot's frame history: every
note clearly its own, ATH not over Ankara, BGW not level with Ankara, Amman and Ankara keep notes; plus the 360×640
Levant fixture) and `test:overlay-layout`. On the real renderer the iPhone shot now reads "Ankara · ANK 1 z 24", ATH
under Athens, AMM under "Amman"; Baghdad has no free owned place on that screen and hides its note (`docs/shots/n18a/`,
before and after). The 24 game/night store PNGs, their manifest records and the contact sheet were republished with the
new `store-shots.mjs --only=game,night --merge`. On the tablet shot (768×1024) "BGW 2 z 24" now stands over Baghdad's
name, 17 px from its ring and 34 px from Ankara's, under Ankara's note: within the rule, a little crowded.

## D-265 — Store preview video: fixed-step frames from real play, 24 s, poster at 5 s (2026-11-05, Claude, night N18b)
R2b. `npm run store:video` (`scripts/store-video.mjs`) films one seed 0xA1A1 run played by the DEV autoplay bot through
`window.aw` on the real renderer. **Frames, not a screen recording:** Playwright's fake clock is paused once the menu is
up and every frame is exactly one 1/30 s `clock.runFor` step (rAF, timers and `performance.now` of the page), CSS
animations are paused and advanced by the same 1/30 s, then a PNG screenshot is piped into ffmpeg; SwiftShader (G7) only
makes the run slower, never changes a frame. **Storyboard (24 s, 4× game speed, cuts between shots):** route drawn by a
pointer drag in the first second and its plane departing; day 2 from 15:30 with the evening terminator crossing the grown
network (poster frame at 5 s, the warm light of the `game` store shot); the weekly board with its crates and a tap on one;
building stops and the filling airport's edge chip is tapped, the camera turns to it and its ring goes red with the jam
countdown — the run stays alive (a near jam, not the game-over report). On seed 0xA1A1 the airport that fills first is
off the opening framing (Rio de Janeiro on the phone, Karachi on iPhone/iPad, whose first route differs), hence the real
edge-chip tap instead of a still shot of the network. The first-route tick varies by a few ticks with boot timing (148–152).
**Sizes:** App Store app previews iPhone 886×1920 (443×960 @2) and iPad 1200×1600 (768×1024 @1.5625, the tablet layout),
Play 1080×1920 (360×640 @3, the phone store shot) for the owner's YouTube upload (Q-49); PL and EN each, since the HUD
is localised. H.264 High 4.0 yuv420p, CRF 18 ≤ 12 Mbit/s, silent stereo AAC (no music, no added text or overlay).
Files over 10 MB are git-ignored by a generated `docs/store/video/.gitignore` and recorded with size, SHA-256 and ffprobe
facts in `manifest.json`; the 5 s posters are committed as JPEG. ffmpeg is a system tool (not an npm dependency, no
licence entry: nothing of it ships). `test:store-video` (fast) checks the manifest, posters and `.gitignore`, and any
preview present on disk. The press kit's video slot (`PRESS_KIT.video`, D-219) stays empty: the files are not in git.
**Status: in force.**

## D-266 — Róża: a note never stacks against another rose's note (2026-11-05, Claude, night N19a)
On the store shots game-tablet and night-tablet (768×1024, after D-264) "BGW 2 z 24" stood over Baghdad's name, 4 px
under "ANK 1 z 24": within D-264 (nearer its own ring), but the two notes read as one block, either rose's; "ATH 2 z 36"
under Athens hung 3 px over "AMM 3 z 36" the same way. Rule now (`clearOfNotes` in `src/ui/overlay-layout.ts`, on
notes with `TagSlot.rose`): **a place is taken only when the note keeps `NOTE_GAP_Y` = 8 px from another rose's note
above or below it (their columns overlap) and `NOTE_GAP_X` = 12 px from one beside it (their rows overlap), and when it
does not cross the band from another rose to that rose's note** (the line from the rose's centre to the nearest point
of its note, grown by 8 px), nor hold another rose's note in its own band. A first try that took the whole box from the
rose's centre to its note as the band hid "ATH" on the iPhone shot: a wide note under Amman made that box reach far left,
beside Amman's ring, where nothing reads as Amman's. Notes are placed in priority order (D-262), so the higher-ranked
note keeps its place and the other one tries its other places, then the compact form, then hides. The place held last
frame gets 3 px less gap (hysteresis, as D-262/D-264). Checked by `test:roza-names`: a new tablet fixture with the
inputs read from the real overlay in both scenes (fresh and with the shot's frame history; BGW no longer right under
ANK; Amman keeps its note), and the same "notes apart" check on the iPhone and 360×640 Levant fixtures, which stay as
they were. On the real renderer the tablet shots now read "ANK 1 z 24" over Ankara's name, "BGW 2 z 24" alone over
Baghdad's, and Athens' note in its compact form left of its rose, clear of Amman's (`docs/shots/n19a/`, before and
after). Of the 24 game/night store PNGs recaptured with `store-shots.mjs --only=game,night --merge` only the four tablet
ones changed their notes; the other 20 differed only by the clock and plane positions and were kept as committed (their
manifest records too); the contact sheet was rendered again from that set. `npm run site:assets` changed nothing (the
landing page uses the phone and landscape shots). **Status: in force.**

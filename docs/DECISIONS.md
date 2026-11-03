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
Q-59 to implement (UI).**

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


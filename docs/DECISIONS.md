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

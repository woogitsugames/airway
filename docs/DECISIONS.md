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

## D-20 — Weekly departure slot upgrade contract (2026-11-02, task 12)
Departure slots are a **per-city per-simulated-hour departure limit**, not an aircraft
or runway count. The +2 upgrade increases the available departure allowance by two
through the authoritative simulation adapter. The host scheduler must enforce the
limit using integer elapsed simulation ticks, preserving the deterministic replay log.
The default baseline limit and whether the bonus applies globally or to one selected
city need owner confirmation before activating the upgrade in the game.
Until then, the UI and offer generator remain adapter-only and must not silently
modify a scheduler. **Status: provisional, requires integration decision.**

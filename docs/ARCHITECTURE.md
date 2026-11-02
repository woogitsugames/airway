# Airway — production architecture

Status: MVP foundation, task 01. Read [Decisions](DECISIONS.md), especially D-11 (Diorama),
D-12 (Airway), D-13 (deterministic pure simulation), and [Research](RESEARCH.md) sections 3–5.

## Dependency boundaries

| Module | Owns | Dependencies allowed |
| --- | --- | --- |
| `src/core` | Seeded RNG with serializable state, fixed clock, formatting, localization facade | Pure TypeScript; localization may access device settings only outside the simulation |
| `src/sim` | Commands, routes, demand, passengers, aircraft, hub queues, failure, upgrades, balance | `src/core` pure helpers and `src/data` integer/immutable records only |
| `src/data` | Versioned city/airport definitions, region shapes and precalculated travel numbers | Types and static assets; no rendering assumptions |
| `src/render` | three.js world (Diorama globe, sunlight/terminator, terrain, airports, planes) | Read-only game snapshots, three.js, browser canvas |
| `src/ui` | Accessible boarding-pass HUD, luggage-tag dock, flight strips and split-flap menus | Read-only state, localization, HTML/CSS/SVG |
| `src/input` | Pointer/touch/keyboard interpretation; gesture conflict resolution | View hit-testing/projection and a command dispatcher |
| `src/audio` | Procedural resonating-hub audio and feedback | Read-only events/state; Web Audio behind adapter |
| `src/platform` | Capacitor bridges, persistence, lifecycle, safe areas | Capacitor APIs; no dependency from simulation |
| `src/game` | Composition root, mode lifecycle, tick scheduling, replay/undo coordination | Wires all modules through explicit interfaces |
| `src/i18n` | English and Polish dictionaries, saved language and translation | Settings → device language → `en` fallback |

No module other than the composition root should orchestrate multiple world and input subsystems.
`src/sim` MUST NOT import three.js, DOM/browser UI, input, audio, render or Capacitor. The
`npm run test:arch` check enforces the direct-import boundary and banned globals/operations.

## Flow of authority

```text
finger / keyboard
      ↓
input (screen hit-test, gesture recognition, coordinate projection)
      ↓
Command { type, payload, tick }  ─────→  command log / undo / replay
      ↓
game scheduler validates and applies commands at fixed tick boundaries
      ↓
sim(seed, priorState, Command[])  ────→  State(tick, integer counters, RNG state)
      ↓                                    ↓
immutable/read-only snapshot             event stream
      ↓                                    ↓
render (three.js interpolation)         UI and audio
```

**Only a `Command` may mutate authoritative state.** UI, renderer and input must never
write to `State` directly. Commands are validated and ordered deterministically by
simulation tick and monotonic sequence number. Preserve the initial seed, parameter
version and the command log to enable undo, reproducible replays and offline daily
challenges. Never generate simulation randomness outside `src/core/rng.ts`.

## Tick model and determinism

- At 1×, advance at **10 ticks per wall-clock second** (100 ms fixed-step accumulator).
  The intended game calendar advances by one simulated minute per tick; the gameplay
  scaling stays in `src/sim/params.ts`.
- The browser scheduler may read `performance.now()` in `src/game`; its elapsed
  time never enters `src/sim` except as an integer count of whole ticks.
- Apply a bounded catch-up budget on resume to avoid minute-long frame stalls.
  Define pause/background behavior in task 16, not in this scaffold.
- Render can interpolate between two immutable tick snapshots using fractional
  accumulator progress. Interpolation and spherical geometry are **visual only**;
  fractional coordinates never round-trip into authoritative simulation state.
- Simulate durations, distances and capacities as **integers**. Projection,
  trigonometry and other transcendental operations belong to `src/render` or
  `src/input`; precompute/round game distances and travel times before submitting
  validated integer commands to `src/sim`.
- Keep RNG state serializable and deterministic; iterate collections in a defined
  order, use stable tie-breakers, and prohibit `Date.now`, `Math.random`,
  transcendental `Math` calls and browser globals inside simulation (D-13).
- The same `seed + initial data version + ordered commands + tick count` must
  produce the same bitwise-relevant state across Android and iOS engines.

## Naming, types, and balance

- Source files: lower-case kebab-case; exported types/interfaces: `PascalCase`;
  functions/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep transport objects serializable; avoid `three.Vector3`, `Date`, floating-point
  angles and DOM references in simulation models. Use readonly snapshots and
  discriminated command unions as the kernel expands (task 02).
- Translation identifiers: descriptive dotted keys (e.g. `action.pause`) in both
  `src/i18n/en.ts` and `src/i18n/pl.ts`; values must not be empty or mismatched.
- Change balancing only through named constants/tables in `src/sim/params.ts`;
  when tuning, version the parameters and rerun fixed-seed regression tests.
- Respect the Diorama palette, SIL OFL fonts, 48 dp targets, safe areas, portrait,
  landscape and foldable layouts. Use procedural or documented CC0 assets only.

## Ownership and next steps

Task 01 intentionally contains an **empty** sky-color WebGL scene, not a playable
globe. The globe, geometry, camera, simulation, input, game modes, UI and audio
belong to the follow-on tasks in `docs/tasks/00-INDEX.md`. Dependencies remain
one-way so parallel tasks can be merged into `dev` independently.

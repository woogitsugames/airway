# E2E contract for production game integration (task 28)

`npm run test:e2e:smoke` runs **against the real Vite game**. It fails closed when
features or the adapter are missing; it never reports a successful gameplay run
because of a mock. `npm run ui:matrix` likewise captures *real* UI only.

The real smoke and matrix pass only once the integrated app shell installs the
handle and registers a production adapter (see below). `--fixture` can independently validate the **test
harness contract**: `node e2e/smoke.mjs --fixture` and
`node scripts/ui-matrix.mjs --fixture`. Fixture images go to
`docs/shots/matrix-fixture/`, never `docs/shots/matrix/`.

## Development-only integration

The composition root registers an `AwDevAdapter` from `src/game/devHandle.ts`
**only when `import.meta.env.DEV`**. The real adapter must forward to production
commands, persistence, scheduler and renderer; do not maintain a second game state
for tests. `src/main.ts` installs `window.aw` only through a DEV-guarded dynamic
import; release bundles must not expose the handle.

Adapter methods:

- `state()`: `{screen,seed,tick,nextWeekTick,routeCount,aircraftAssignments,snapshotHash}`
  with an authoritative deterministic hash **independent of view-only state**.
- `prepareSeed(seed)`: sets the seed **before** the user clicks New Game.
- `advanceTicks(ticks)`: advances real fixed-step simulation and awaits UI settling.
- `gesture('route'|'plane')`: returns actual viewport pixel points for
  draggable airport-to-airport and dock-to-route interactions; coordinates must
  be visible, actionable, and recalculated for the current camera/viewport.
- `autoplay(untilWeek)`: the task-22 bot keeps playing the visible run through real Commands until the weekly
  board for `untilWeek` opens (or the run ends); resolves to `state()`. Used to reach the upgrade screen honestly.
- `forceHubOverload()`: test-scenario action to trigger the real game-over flow,
  with a real cause report; not a replacement for simulation loss detection.

Stable `data-testid` attributes required on real UI:

| Screen | Test IDs |
| --- | --- |
| Menu | `menu-endless`, `menu-continue` |
| Game | `action-save`, `action-menu` (on the pause sheet: press Escape / Pause first), `action-resume` |
| Upgrade | `upgrade-option-0…2` (each card also has `data-upgrade=<kind>`; a `hub-expansion` card waits for a hub tap) |
| Game over | `game-over`, `gameover-menu` |

The Playwright test uses **actual pointer drags** for drawing routes and
assigning aircraft, and real UI clicks for starting, upgrading, saving,
loading and returning to the menu. The handle is used only to seed the game,
find stable gesture coordinates, fast-forward through simulated time and force
a deterministic failure. The smoke checks the seed, route/aircraft counts,
weekly upgrade, persistence hash and failure/menu transitions.

## Commands

```sh
npm run test:e2e:smoke
npm run ui:matrix
# Harness-only validation; does NOT test the shipped game:
npm run test:e2e:fixture   # = node e2e/smoke.mjs --fixture && node scripts/ui-matrix.mjs --fixture
```

The smoke prints one `PASS`/`FAIL`/`SKIP` line per step. Steps depend on each other, so everything after
the first failure is reported as `SKIP` with the step it waited for; a screenshot of the failing state is
saved to the git-ignored `.e2e/` folder. `ui:matrix` runs each language/size independently and stops early
when the dev adapter is missing altogether (every run would hit the same timeout).
Server and browser lifecycle is shared with `npm run shots` in `scripts/lib/harness.mjs`.

By default a temporary Vite dev server is started on localhost. Set
`AIRWAY_E2E_URL=http://127.0.0.1:5173/` to reuse a running **development**
server. Playwright comes from the execution environment. Set `CHROMIUM_PATH`
if Chromium is not discoverable by Playwright. Each real matrix run captures
32 PNGs: 4 screens × 2 languages × 4 viewport sizes at DPR 1.


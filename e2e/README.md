# E2E contract for production game integration (task 28)

`npm run test:e2e:smoke` runs **against the real Vite game**. It fails closed when
features or the adapter are missing; it never reports a successful gameplay run
because of a mock. `npm run ui:matrix` likewise captures *real* UI only.

The real smoke and matrix pass only once the integrated app shell installs the
handle and registers a production adapter (see below). `--fixture` can independently validate the **test
harness contract**: `node e2e/smoke.mjs --fixture` and
`node scripts/ui-matrix.mjs --fixture`. Fixture images go to
`docs/shots/matrix-fixture/`, never `docs/shots/matrix/`.
When the real handle (`src/game/devHandle.ts`) gains or loses a method, change
`e2e/fixtures/airway.html` in the same commit: `npm run test:fixture-adapter` (in `test:fast`) fails otherwise.

## Development-only integration

The composition root registers an `AwDevAdapter` from `src/game/devHandle.ts`
**only when `import.meta.env.DEV`**. The real adapter must forward to production
commands, persistence, scheduler and renderer; do not maintain a second game state
for tests. `src/main.ts` installs `window.aw` only through a DEV-guarded dynamic
import; release bundles must not expose the handle.

Adapter methods:

- `state()`: `{screen,seed,tick,nextWeekTick,routeCount,aircraftAssignments,snapshotHash}`
  with an authoritative deterministic hash **independent of view-only state**, plus optional fields that suites read
  (`homeRegion`, `licenceClass`, `upgrades`, `curfewClosed`, `curfewDrawn`, `airports`, and the view-only `camera`,
  which is not in the hash).
- `prepareSeed(seed, { firstTime? })`: sets the seed **before** the user clicks New Game; `firstTime: true` keeps the
  first-time cards on in a seeded run (off by default).
- `advanceTicks(ticks)`: advances real fixed-step simulation and awaits UI settling.
- `gesture('route'|'plane')`: returns actual viewport pixel points for
  draggable airport-to-airport and dock-to-route interactions; coordinates must
  be visible, actionable, and recalculated for the current camera/viewport.
- `autoplay(untilWeek)`: the task-22 bot keeps playing the visible run through real Commands until the weekly
  board for `untilWeek` opens (or the run ends); resolves to `state()`. Used to reach the upgrade screen honestly.
- `forceHubOverload()`: test-scenario action to trigger the real game-over flow,
  with a real cause report; not a replacement for simulation loss detection.
- `botStep()` (optional): queues at most one bot decision on the visible run without advancing time, for long
  real-time play-throughs (`ui:long-play`); resolves to the queued command type or `null`.

`window.aw` itself adds `version: 1` and `ready`; every suite waits for `ready` before calling it.

Stable `data-testid` attributes required on real UI:

| Screen | Test IDs |
| --- | --- |
| Menu | `menu-endless`, `menu-continue` |
| Game | `action-save`, `action-menu` (on the pause sheet: press Escape / Pause first), `action-resume` |
| Upgrade | `upgrade-option-0…2` (each card also has `data-upgrade=<kind>`; a `hub-expansion` card waits for a hub tap, a `departure-slots` card (task 32) for an airport tap) |
| Game over | `game-over`, `gameover-menu` |

The Playwright test uses **actual pointer drags** for drawing routes and
assigning aircraft, and real UI clicks for starting, upgrading, saving,
loading and returning to the menu. The handle is used only to seed the game,
find stable gesture coordinates, fast-forward through simulated time and force
a deterministic failure. The smoke checks the seed, route/aircraft counts,
weekly upgrade, persistence hash and failure/menu transitions.

## Stub world (`?render=stub`, night-12be, D-254)

Since the satellite globe, SwiftShader draws ~10 frames per second (G7) and journeys through the real globe time out.
In a DEV build, `?render=stub` makes `src/main.ts` load `src/game/dev/stubWorld.ts` instead of `createWorld()`: the
same `World` interface, the real `GlobeOrbitCamera` and projection maths, a plain 2D canvas, no WebGL. Everything
else — menu, `startSession`, overlay tags, weekly board, hub board, game over, logbook, `window.aw` — is the shipped
code. Add `&clock=frozen` to make the session's frame hook see dt = 0: game time then passes only through
`advanceTicks`, `autoplay` and `botStep`, so a journey replays exactly. `window.__awStub.airportPoint(id)` gives an
airport's page coordinates for real `page.mouse` taps and presses on the canvas. Release builds drop the module
(`test:bundle` checks `dist/`). `npm run test:e2e:session-stub` is the reference journey (seed in `e2e/seeds.mjs`
`SESSION_STUB`, replayed headless by `test:session-stub` in `test:fast`).

[night-12bj] Two load flakes:

- `clickTestId` (`e2e/browser.mjs`) waits within one budget (`CLICK_TIMEOUT_MS`, 20 s; it was 5 s) for the element to
  be attached, visible, stable and enabled, then clicks with Playwright's own checks. A failure keeps Playwright's error
  and call log and adds the check it waited for, the element's box/disabled/opacity/pointer-events/running animations,
  what `elementFromPoint` finds at its centre (an intercepting overlay) and the present test IDs, `(hidden)` marked.
  The first-time card and the slot hint cannot cover the weekly board (`pointer-events: none` strips at z-index 40,
  hidden when the week ends; the board is at z-index 70), so the smoke does not need to dismiss them; it picks the first
  enabled card that needs no globe tap and fails with the board's card list if there is none.
- Stub-world runs (`--render=stub`, and `test:e2e:session-stub`) launch Chromium with `--disable-gpu-compositing`
  (`scripts/lib/harness.mjs` `SOFTWARE_COMPOSITING_ARGS`). With SwiftShader GPU compositing every DOM frame was
  rastered on emulated GL: at 904×1088@2 the weekly board ran at 3.5 rAF/s and one `page.screenshot` took 18–28 s, which
  is what hit the 30 s limit under load. The real renderer keeps the old arguments.

[night-45a] A third: the weekly board draws each crate's 3D model in the frame after it opens (`src/game/session.ts`
`onPreviewModel`: shader compile and a synchronous `readPixels` on the shared WebGL context). On SwiftShader that one
frame holds the page's main thread for 1.4–3.2 s on an idle host (first board in a browser; the profile is ~1.25 s in
`readRenderTargetPixels`) and past the 20 s click budget while other browsers share the CPU: Playwright cannot even
run its "attached" / "visible" / "stable" check for `upgrade-option-N` until it ends. `test:e2e:transfer-glyphs` failed
5 of 36 runs that way (6 copies at once beside 4 busy-loop processes; 20/20 with the busy loops alone). The session now
sets `data-model="drawn"|"none"` on each crate when its draw is over, and `waitForBoardModels(page)` (`e2e/browser.mjs`,
up to 120 s, polling on a timer) waits for every crate before the click. Other suites that click a crate of a freshly
opened board on the real renderer can call it the same way.

## Commands

```sh
npm run test:e2e:smoke
npm run ui:matrix
npm run test:e2e:session-stub   # real session on the WebGL-free stub world (~10 s on 4 vCPU, 7 Nov 2026)
# [night-12bf] the same suites on the stub world (UI/flow only; the plain scripts stay on the real renderer):
npm run test:e2e:smoke:stub          # = node e2e/smoke.mjs --render=stub (or AW_RENDER=stub)
npm run ui:matrix:stub               # PNGs to the git-ignored .e2e/matrix-stub/, never docs/shots/matrix/
npm run test:e2e:edge-chip-tags:stub
npm run test:e2e:resize:stub         # [night-15b] R4f resize mid-run with a sheet open (stub only: needs the frozen clock)
npm run test:e2e:pause-reach:stub    # [night-14b] pause sheet reach (stub in test:ci; the plain script uses the real globe)
npm run test:e2e:gameover-contracts:stub
npm run test:e2e:screen-audit:stub   # every screen of the shipped Linoryt skin audited on the stub world
# [night-44a] 13 more bot-driven/overlay suites as `npm run test:e2e:<suite>:stub` (PNGs of a stub run go to .e2e/stub/<task>/
# through `shotsDir()`, never docs/shots/): new-airport, pause-summary, run-timeline, edge-chip-airports, edge-chip-fill,
# board-short, upgrade-picks, undo-after-upgrade, home-region, licence-classes, fill-trend, surge-tag, hub-board
# [night-45a] and transfer-glyphs (`npm run test:e2e:transfer-glyphs:stub`)
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
96 PNGs: 4 screens × 2 languages × 12 viewport sizes (phones, foldables at DPR 2, [night-15b] R4f tablets 1024×640,
1280×800, 800×1280, the book foldable 841×701, desktop 1600×900 and a 500×700 window); `--size=WxH` runs only those.


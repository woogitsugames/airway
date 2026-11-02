# Airway — test and build contract

The canonical smoke sequence, before each push:

```sh
npm ci
npm run typecheck
npm run test:fast
npm run build
```

| Command | What it checks | Expected final summary |
| --- | --- | --- |
| `npm run typecheck` | Strict TypeScript on app and config | Exit code 0 (tsc is intentionally silent on success) |
| `npm run test:i18n` | PL/EN dictionary key parity, duplicates, empty values, interpolation placeholders | `SUMMARY test:i18n seed=0xA1A1 files=2 keys=N passed=1 failed=0` |
| `npm run test:arch` | TS-AST guard: simulation imports only pure modules; no DOM, Capacitor, three.js, wall clock or transcendental Math | `SUMMARY test:arch seed=0xA1A1 files=N passed=1 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch` | Both test summaries and exit code 0 |
| `npm run build` | `tsc --noEmit && vite build` | Exit code 0; `dist/` output |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/01/` |
| `npm run test:e2e:smoke` | Real Playwright gameplay journey: boot, menu, seeded start, route, aircraft, week, upgrade, save/load, overload and return | `SUMMARY test:e2e:smoke seed=0xA1A1 mode=game passed=9 failed=0 durationMs=N` |
| `npm run ui:matrix` | Real game menu/game/upgrade/gameover in PL/EN at 412×915, 915×412, 673×841, 904×1000 (DPR 1) | `SUMMARY ui:matrix seed=0xA1A1 mode=game captured=32 expected=32 failed=0 durationMs=N` |
| `npm run mockups` | Preserve stage-0 Diorama and other reference mockup generation | Exit code 0 |
| `npm run shots:mockups` | Preserve stage-0 Playwright captures of reference mockups | Existing PNG output under `mockups/*/png/` |

Every future test must have a fixed seed (use `0xA1A1` where no gameplay seed
is needed), terminate with one `SUMMARY ...` line, set a nonzero exit code on
failure, expose a `test:<name>` npm command and have a row in this table.

### Boundary regression

To verify the guard itself, temporarily add
`import { Scene } from 'three';` to `src/sim/__arch-negative.ts`,
run `npm run test:arch`, verify exit code nonzero and a `forbidden
dependency` line, **delete the temporary file**, and rerun the test clean.
Never commit the negative-control file.

### Screenshot prerequisites

`npm run shots` uses the environment-provided **Playwright and Chromium**;
neither is intentionally added as an npm dependency. A missing browser/runtime
produces a failing summary. Screenshot files are only committed after review.
The two PNG dimensions are **412×915** and **915×412** at DPR 1 (exact pixel
size). Foldable 673×841 / 904×1000 checks are part of later UI tasks.

### Task 28 browser integration

The real E2E runner and screen matrix use the environment's Playwright + Chromium,
start a disposable Vite development server, and exit nonzero on missing features,
page errors, incomplete snapshots or failed assertions. They never replace real
gameplay with a mock. Requirements and exact selectors are documented in
[`e2e/README.md`](../e2e/README.md).

The dev-only `window.aw` bridge is installed by a DEV-guarded dynamic import.
It reports `ready=false` until a real `AwDevAdapter` is registered by the game.
Tasks 13-16 and their upstream dependencies are not yet merged on the task-28
branch's base; the complete gameplay smoke and production UI matrix are BLOCKED.

To validate the harness itself without game features, use
`node e2e/smoke.mjs --fixture` and `node scripts/shot.mjs --fixture`.
The fixture is a labeled, isolated test double; passing it does **not** satisfy
the gameplay acceptance criteria, and its 32 images are saved only to
`docs/shots/matrix-fixture/` (not `docs/shots/matrix/`).

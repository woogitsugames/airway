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
| `npm run test:causes` | Six fixed-seed checks for hub-ledger cause ranking, missing evidence, world identity and local records | `SUMMARY test:causes seed=0xA1A1 scenarios=3 passed=6 failed=0` |
| `npm run test:fast` | `typecheck`, then `test:i18n`, then `test:arch` | Three test summaries and exit code 0 |
| `npm run build` | `tsc --noEmit && vite build` | Exit code 0; `dist/` output |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=4 failed=0`; images in `docs/shots/01/` and `docs/shots/15/` |
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

<!-- [task-15] Failure-screen visual fixture and camera adapter. -->
Task 15 screenshots use `npm run shots` with `?preview=gameover` (development-only)
to capture `docs/shots/15/game-p.png` and `docs/shots/15/game-l.png`. This fixture
does not replace an integration test with task 08's real ledger or task 04's
camera. The game-over controller pauses simulation immediately and drives an
injected renderer focus callback for 700ms with cubic ease-out, then freezes
the scene and presents the report. It never mutates the simulation.

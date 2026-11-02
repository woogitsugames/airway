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
| `npm run test:rng` | [task-02] mulberry32 vectors, RNG state, independent streams, UTF-8 FNV, bounds | `SUMMARY test:rng seed=0xA1A1 passed=6 failed=0` |
| `npm run test:sim-kernel` | [task-02] 50,000-tick replay, clock, command queue, JSON restore and hash | `SUMMARY test:sim-kernel seed=0xA1A1 passed=7 failed=0` |
| `npm run test:undo` | [task-02] exact rollback, same-tick ordering, checkpoint boundaries, ring eviction, restore | `SUMMARY test:undo seed=0xA1A1 passed=7 failed=0` |
| `npm run test:daily` | [task-02] Warsaw midnight in CET/CEST, DST transitions, stable daily seed, ISO weeks | `SUMMARY test:daily seed=0xA1A1 passed=7 failed=0` |
| `npm run test:fast` | `typecheck`, then i18n, architecture and all four kernel tests | All test summaries and exit code 0 |
| `npm run build` | `tsc --noEmit && vite build` | Exit code 0; `dist/` output |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/01/` |
| `npm run mockups` | Preserve stage-0 Diorama and other reference mockup generation | Exit code 0 |
| `npm run shots:mockups` | Preserve stage-0 Playwright captures of reference mockups | Existing PNG output under `mockups/*/png/` |

Every future test must have a fixed seed (use `0xA1A1` where no gameplay seed
is needed), terminate with one `SUMMARY ...` line, set a nonzero exit code on
failure, expose a `test:<name>` npm command and have a row in this table.

Kernel tests use Node.js 22+ TypeScript type stripping (`node --experimental-strip-types`).
The game uses `*.ts` module imports so the same source is executed by Node tests
and bundled by Vite; `tsconfig.json` enables `allowImportingTsExtensions` with `noEmit`.
The game scheduler reads `sim.schedulingSpeed` to wake a paused sim from a queued
`SetSpeed` resume command; the committed `sim.speed` changes only on the next tick.

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

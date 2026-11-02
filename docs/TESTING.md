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
| `npm run test:fast` | `typecheck`, i18n, architecture, CVD and contrast checks | All four test summaries and exit code 0 |
| `npm run test:cvd` | Machado 2009 full-severity protan/deutan/tritan; 6 destination colours, minimum pairwise CIE76 ≥ 15; CSS token parity | `SUMMARY test:cvd seed=0xA1A1 modes=3 colours=6 comparisons=45 passed=1 failed=0` |
| `npm run test:contrast` | WCAG 2.x contrast ratio ≥ 4.5:1 for all declared text/background pairs; CSS token parity | `SUMMARY test:contrast seed=0xA1A1 pairs=16 threshold=4.5 passed=1 failed=0` |
| `npm run build` | `tsc --noEmit && vite build` | Exit code 0; `dist/` output |
| `npm run shots` | Browser smoke: game canvas at portrait/landscape dimensions | `SUMMARY shots seed=0xA1A1 captured=2 failed=0`; images in `docs/shots/01/` |
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

# Screenshots

Every folder is named after the task that owns the view. PNGs are committed only after they have been inspected
against the Diorama checklist (`docs/styles/diorama.md`) and the forbidden list in `CLAUDE.md`.

| Folder | Produced by | Content |
| --- | --- | --- |
| `01/` | `npm run shots -- game` | App boot screen, 412×915 / 915×412 |
| `03/` | `npm run shots -- globe` | Standalone Diorama globe (`dev/globe.html`) with draw-call telemetry |
| `06/` | `npm run shots -- airports airports-zoom` | Airport/overlay fixture at 1× and 2.5× |
| `07/` | — | Route-drawing gesture notes (README only) |
| `13/` | `npm run test:hud-targets` | HUD: portrait, landscape, foldable 673×841 / 904×1000 |
| `14/` | `npm run shots -- menu` | Split-flap main menu (PL) |
| `15/` | `npm run shots -- gameover` | Game-over board (`?preview=gameover`) |
| `17/` | `npm run shots -- puzzles` | Puzzle departure board |
| `23/` | `npm run test:e2e:tutorial` | Onboarding steps + landscape/foldable/wide |
| `29/` | `npm run shots:site` | Landing page |
| `33/` | `npm run shots -- globe-low-1x globe-low-2_5x globe-medium-1x globe-medium-2_5x globe-high-1x globe-high-2_5x globe-menu` | Globe detail per preset at 1× / 2.5× and the menu globe; `33/before/` = `dev` before task 33 |
| `35/` | `npm run test:hud-targets` (+ `ui:matrix` copies `game-*`) | Weekly upgrade cargo labels: PL/EN × 4 sizes, `-slots` variant, mockup comparison sheets |
| `matrix/` | `npm run ui:matrix` | 4 screens × PL/EN × 4 sizes (real game only) |
| `matrix-fixture/` | `npm run test:e2e:fixture` | Harness self-test images; git-ignored, never game evidence |

Store screenshots live in `docs/store/shots/{pl,en}/` (`npm run store:shots`). E2E failure screenshots go to the
git-ignored `.e2e/` folder.

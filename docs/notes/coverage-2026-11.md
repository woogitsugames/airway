# Headless coverage baseline (November 2026)

Measured from origin/dev 52d5713 using V8 process coverage; TypeScript loader output is mapped back with TypeScript source maps. Mapped executable source lines and function bodies are counted when hit at least once across processes; this is not branch coverage. Files not loaded are counted as zero. Temporary transpiled copies outside src are not attributed. `src/render/**` is excluded here.

The Windows baseline had 108/110 passing steps: the existing `test:week-source` and `test:app-check` fail on Windows path handling. A local, uncommitted runner compatibility patch was necessary to invoke npm.cmd. Results are therefore partial rather than a green reference.

## Areas

| Area | Lines | Functions |
| --- | ---: | ---: |
| `src/audio` | 69.7% (641/920) | 57.6% (53/92) |
| `src/core` | 96.2% (176/183) | 100.0% (33/33) |
| `src/data` | 99.9% (722/723) | 93.8% (15/16) |
| `src/game` | 62.9% (2822/4484) | 53.3% (348/653) |
| `src/i18n` | 98.1% (1655/1687) | 72.7% (24/33) |
| `src/input` | 27.1% (186/686) | 19.2% (14/73) |
| `src/main.ts` | 0.0% (0/624) | 0.0% (0/84) |
| `src/net` | 98.1% (422/430) | 91.8% (56/61) |
| `src/platform` | 72.5% (409/564) | 69.1% (67/97) |
| `src/sim` | 97.5% (3101/3180) | 97.0% (383/395) |
| `src/ui` | 19.2% (991/5155) | 20.6% (103/499) |

## Ten lowest covered files with logic

Includes DOM-heavy modules to show the measurement, not as headless-test recommendations.

| File | Lines | Functions |
| --- | ---: | ---: |
| `src/audio/index.ts` | 0.0% (0/19) | 0.0% (0/3) |
| `src/game/dailyRanking.ts` | 0.0% (0/24) | 0.0% (0/2) |
| `src/game/dev/stubWorld.ts` | 0.0% (0/170) | 0.0% (0/35) |
| `src/game/devHandle.ts` | 0.0% (0/48) | 0.0% (0/12) |
| `src/game/screens.ts` | 0.0% (0/85) | 0.0% (0/22) |
| `src/game/session.ts` | 0.0% (0/712) | 0.0% (0/116) |
| `src/game/tutorial/first-time-card.ts` | 0.0% (0/68) | 0.0% (0/7) |
| `src/game/tutorial/index.ts` | 0.0% (0/12) | 0.0% (0/2) |
| `src/game/tutorial/slot-hint.ts` | 0.0% (0/55) | 0.0% (0/6) |
| `src/game/tutorial/vignette-port.ts` | 0.0% (0/12) | 0.0% (0/3) |

## Pure gameplay gaps selected for headless tests

| Module | Baseline lines | After added tests | Baseline functions | After added tests |
| --- | ---: | ---: | ---: | ---: |
| `src/game/tutorial/controller.ts` | 82.3% (107/130) | 93.8% (122/130) | 61.1% (11/18) | 88.9% (16/18) |
| `src/sim/network.ts` | 87.2% (75/86) | 98.8% (85/86) | 94.4% (17/18) | 100.0% (18/18) |
| `src/game/audioCues.ts` | 90.8% (79/87) | 100.0% (87/87) | 70.6% (12/17) | 94.1% (16/17) |

After values first merged baseline V8 data with a separate run of `test:coverage-gaps`. The subsequent full instrumented run reproduced these values (110/112 steps; the same two Windows failures), so it is not a green reference.

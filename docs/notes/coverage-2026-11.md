# Headless coverage baseline (November 2026)

Measured from `dev` 0524a7b plus the Windows runner fix in PR #291. After `npm ci`, the baseline ran all 112 existing fast steps; the full measurement ran all 114 steps including the two added coverage tests. Both suites passed.

V8 process coverage is merged and transpiled TypeScript is mapped to source with TypeScript source maps. Mapped executable source lines and function bodies count as covered when hit at least once across processes; this is not branch coverage. Unloaded files count as zero. A data URL is attributed only when its decoded code exactly matches one unique generated source module; other temporary copies remain unattributed. `src/render/**` is excluded from conclusions.

## Areas before added tests

| Area | Lines | Functions |
| --- | ---: | ---: |
| `src/audio` | 69.7% (641/920) | 58.1% (54/93) |
| `src/core` | 96.2% (176/183) | 100.0% (33/33) |
| `src/data` | 99.9% (722/723) | 93.8% (15/16) |
| `src/game` | 62.9% (2846/4523) | 52.3% (349/667) |
| `src/i18n` | 98.1% (1655/1687) | 73.5% (25/34) |
| `src/input` | 27.1% (186/686) | 19.2% (14/73) |
| `src/main.ts` | 0.0% (0/630) | 0.0% (0/88) |
| `src/net` | 98.1% (422/430) | 90.0% (63/70) |
| `src/platform` | 72.5% (409/564) | 65.0% (67/103) |
| `src/sim` | 97.5% (3101/3180) | 96.8% (391/404) |
| `src/ui` | 25.5% (1513/5938) | 24.7% (140/567) |

## Ten lowest covered files with logic

Includes DOM-heavy modules as measurement results, not recommendations for headless tests. Linoryt includes DOM rendering and is kept unchanged.

| File | Lines | Functions |
| --- | ---: | ---: |
| `src/audio/index.ts` | 0.0% (0/19) | 0.0% (0/3) |
| `src/game/dailyRanking.ts` | 0.0% (0/24) | 0.0% (0/2) |
| `src/game/dev/stubWorld.ts` | 0.0% (0/170) | 0.0% (0/39) |
| `src/game/devHandle.ts` | 0.0% (0/48) | 0.0% (0/12) |
| `src/game/screens.ts` | 0.0% (0/85) | 0.0% (0/23) |
| `src/game/session.ts` | 0.0% (0/721) | 0.0% (0/120) |
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

The existing overlay-layout test loads a data URL; exact matching attributes it to the source (99.8% (453/454) lines in the baseline). Ambiguous identical generated modules are deliberately not attributed.

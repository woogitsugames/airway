# Decision renumbering (integration of tasks 01–29)

Tasks were developed in parallel from `dev`, which ended at D-18. Each task appended its own decision with the next
number it saw (mostly D-19; tasks 10, 12 and 25 used D-20 because they assumed task 02's D-19). The merge train
(`integration/merge-train`, 71d0a1b) kept task 02's D-19 and renumbered every other entry sequentially in merge
order. Numbers are now unique and gap-free: D-01…D-37. The next new decision is **D-38**.

| New | Old (on its task branch) | Task branch | Title |
| --- | --- | --- | --- |
| D-19 | D-19 (unchanged) | `task/02-core-sim-kernel` | Canonical replay and checkpoint undo contract |
| D-20 | D-19 | `task/05-cities-data` | Indexed city geography and seeded spawning |
| D-21 | D-19 | `task/03-globe-renderer` | Build-time RLE raster from Natural Earth land 50m |
| D-22 | D-19 | `task/06-airports-overlay` | Airport and passenger tags are view-only pooled layers |
| D-23 | D-19 | `task/08-sim-passengers-hubs` | Aircraft-driven passenger transfers with cached regional routing |
| D-24 | D-19 | `task/09-sim-planes` | Integer route legs and guarded plane lifecycle |
| D-25 | D-19 | `task/07-route-drawing` | Route-edit adapter contract |
| D-26 | D-20 | `task/10-render-routes-planes` | Batched in-world routes and instanced aircraft |
| D-27 | D-19 | `task/11-day-night` | Deterministic day/night and curfew adapters |
| D-28 | D-20 | `task/12-weekly-upgrade` | Weekly departure slot upgrade contract |
| D-29 | D-19 | `task/16-save-lifecycle` | Versioned saves and background freeze |
| D-30 | D-19 | `task/19-audio` | Event-driven hub audio is bounded and non-authoritative |
| D-31 | D-19 | `task/20-accessibility` | Accessibility presentation adapters |
| D-32 | D-19 | `task/17-puzzle-mode` | Task-17 puzzles use an isolated deterministic adapter |
| D-33 | D-19 | `task/21-performance` | Shared quality profile and render-only pacing |
| D-34 | D-19 | `task/23-onboarding` | Separate onboarding choreography from live game adapters |
| D-35 | D-19 | `task/24-android-build` | Android native build baseline |
| D-36 | D-20 | `task/25-ios-build` | iOS uses CocoaPods for Capacitor 8.5.3 |
| D-37 | D-19 | `task/28-e2e-smoke` | E2E tests must not silently pass on missing gameplay |

Tasks 01, 04, 13, 14, 15, 18, 22, 26, 27 and 29 recorded no new decision. No exact duplicate entries existed; nothing
was removed. The per-entry _"renumbered from …"_ notes are kept in `docs/DECISIONS.md`.

## References updated

A repository-wide search (`git grep -nE "D-(19|2[0-9]|3[0-7])\b"`, excluding `docs/DECISIONS.md`) at the merge
commit found one reference to an old number:

| File | Was | Now | Kind |
| --- | --- | --- | --- |
| `docs/IOS.md` | D-20 (task 25's CocoaPods decision) | D-36 | doc |

No source-code comment referenced D-19 or later, so no code file needed a change. When integrating further branches,
translate any `D-19`/`D-20` with this table using the branch the text came from (an old D-19 means a different decision
on each branch).

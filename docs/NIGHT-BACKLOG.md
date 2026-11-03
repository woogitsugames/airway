# Night backlog — continuous development (D-65)

One coordinator agent works through this list top to bottom, one item per branch `night/NN-slug` from fresh
`origin/dev`. Each item: implement → full gate on the merged tree → PR to `dev` → merge (merge commit) → tick the box
and add a log line below. Never touch `main` (the coordinator session fast-forwards it, D-64).

**Do not edit files owned by the parallel session's tasks 37–40** while their PRs are open
(`src/ui/upgrade/**`, `src/ui/menu/**`, `src/ui/gameover/**`, `src/ui/overlay*`, the night/framing parts of
`src/render/**`, `src/game/world.ts`, store shots). If an item needs them, wait until 37–40 are merged (check
`git log origin/dev`) and take another item meanwhile.

Gate (on a fresh worktree from origin/dev with your branch merged): `npm ci`, `npm install --no-save playwright@1.63.0`,
`npm run test:fast`, `npm run build`, `npm run test:e2e:smoke`, `npm run ui:matrix`, the item's tests, and
`npm run test:balance` + `npm run test:replay` when sim changes. WebGL headless: chromium with
`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Look at every PNG you produce.

## Queue
- [x] N1 **15 new puzzles (16–30)** — `src/data/puzzles/**`, puzzle tests. Curve of difficulty; each uses at least one
      newer mechanic (slots D-41, curfew D-17, 3-day week D-40, transfers/MCT). Rule from task 17: no action → loss,
      reference solution wins with ≥15% margin; `test:puzzles` covers all 30. Puzzle select screen shows 30.
- [x] N2 **Code quality after integration** — remove `docs/integration/pending/` leftovers that are no longer needed,
      stale `[task-NN] adapter` / "until task" stubs, dead exports (check with a script), duplicate helpers; add
      regression tests where coverage is thin (save migration v3→v4, replay across upgrades and slots). No behaviour change.
- [x] N3 **Audio & music** — `src/audio/**`: mix levels, "Resonant hubs" musicality (scale per region, tension at hub
      load, dawn bloom, week key change), UI SFX set (flap, tag, stamp, slot wait), limiter; offline render of 3 × 30 s WAV
      previews into `docs/audio/` for the owner to listen to.
- [x] N4 **Low-end performance** — globe LOD (distance/zoom-based mesh levels; medium now 424k tris/frame), "battery
      saver" preset (30 fps cap, no shadows, fewer decorations), adaptive quality from frame time, budgets in
      `docs/PERFORMANCE.md`, `perf:scene` before/after. Needs 37–40 merged first (render files).
- [x] N5 **Hub label setting (D-68)** — settings toggle code/name, applied to hub stamp and airport labels; PL/EN city
      names from `src/data/cities.ts`; test. Needs task 37 merged (upgrade card).
- [x] N6 **Online leaderboards (D-66)** — `src/net/**` + `functions/` (or equivalent) on the Firebase emulator:
      anonymous auth, daily + ISO-week boards, score submission with command journal, server-side replay validation using
      the same Sim (determinism D-13), offline queue, disabled without config, UI in the daily mode screen, privacy note
      draft in `docs/legal/`. Owner must later create the Firebase project — list exact steps in `docs/FIREBASE.md`.
- [x] N7a **Rank a resumed daily run** — known gap of N6c/D-72: a daily official run continued from the save slot
      was neither recorded nor submitted. Remember the active daily run (day, kind, attempt) beside the scores and
      re-attach it on resume; tests in `test:daily-mode` and `test:net`.
- [x] N7b **Remember the adaptive downgrade (D-74)** — `auto` re-detected from scratch every launch, so a slow phone
      stuttered ~8 s each session. Persist the steps taken, re-apply them before the first frame, forget them on an
      explicit graphics choice or after 30 days; also fix the stale `demo-globe.ts` note in `docs/PERFORMANCE.md`.
- [x] N7c **Browser e2e for Continue of a saved daily** — N7a was covered headless only. New `e2e/daily-continue.mjs`
      (`test:e2e:daily-continue`, in `test:ci`): official daily saved → continued → finished is recorded as official;
      a practice daily stays practice through Continue and leaves the official score untouched.
- [x] N7d **Curfew airports on the puzzle screen** — known issue of N1: the puzzle screen never said which airport
      closes at night (levels 08/11/15 had no hint at all, and the "23:00–06:00" note was wrong for 22:00 curfews).
      Route strips and the hub list carry the globe's red-and-white barrier next to a closed airport; the brief gets a
      "Night curfew: LON 22:00–06:00" line from the level data. Shots: `npm run shots -- puzzle-curfew-08 puzzle-curfew-30`.
- [x] N7e **Split-flap boards make their sound** — known issue of N3: the `flap` effect existed but was never
      played (menu files were reserved then). SplitFlap reports animations, a merged rattle plays ≤ 8 clicks per board.
- [x] N7f **Tree and rock culling (D-75)** — known limitation of N4: trees/rocks were drawn over the whole globe.
      Sort them into the terrain chunks and pack the visible chunks to the front of the instance buffer (no extra
      draw calls). (Tried first and dropped: the stronger golden-dusk grading proposed in #51 mostly turned deserts
      orange; left for the owner's question in #51.)
- [x] N7g **Browser e2e for the puzzle screen** — puzzles were tested on the pure engine only (`test:puzzles`). New
      `e2e/puzzles.mjs` (`test:e2e:puzzles`, in `test:ci`) solves all 30 levels through real clicks, plus loss and Undo.
- [x] N7h **Puzzle strips share one column grid** — N7d known issue: a strip with a curfew mark pushed its
      "TP/Jet" column ~30 px right of the others. CSS subgrid (fallback: the old per-strip columns); shots refreshed.
- [x] N7i **Owner question sheet** — every open "Pytania do właściciela" from PR #33–#61 and the docs (privacy
      draft, FIREBASE, RESEARCH, DECISIONS proposals) in one Polish table `docs/OWNER-QUESTIONS.md` (id, question,
      options, current default, recommendation, source), minus those decided by D-60…D-68. Later items add their
      owner questions there.
- [x] N7j **Polish plural forms and wording** — PL review of every catalog string: counts read "1 pasażerów",
      "3 sekund", "5 noce", "22 gwiazdek". New `{count|one|few|many}` plural token in `t()` (Intl.PluralRules; EN
      one|other) used for game-over causes, airport bubbles, puzzle board/goals, menu record; repo path removed from
      the licences intro, "Obróć globus do …". `test:i18n` validates tokens, `test:format` covers the forms.
- [x] N7k **Saves survive a rules update (D-76)** — any `RULES_VERSION` bump silently dropped the saved flight.
      An older-rules save is now replayed from its journal under the current rules and written back once; runs the
      new rules end, newer-rules saves, over-long replays and corrupt current-rules saves are still refused.
      Covered in `test:save-golden`.
- [x] N7l **Browser e2e for the daily ranking** — ranking was tested headless against the emulator only
      (`test:firebase`). New `e2e/leaderboard.mjs` (`test:e2e:leaderboard`, manual: emulators): official daily
      accepted and shown with the own row, practice not sent, offline run queued and sent at the next app start.
- [x] N7m **Game-over capacity cause** — N7j known issue: "Poczekalnia osiągnęła limit: 26 z 24 miejsc" read
      as a contradiction when the hub overflowed. Now "Poczekalnia przepełniona: 26 osób na 24 miejsca" (EN "The
      waiting area was full: 26 people for 24 places"), with plural forms.
- [x] N7n **Weekly board clears the boarding pass** — leftover: on a phone in landscape (915×412) and on the
      673×841 fold the yellow week sign sat over the HUD numbers (week, day, time, passengers). Narrow screens start
      the board below the pass; phone landscape puts the sign beside the pass (its line wraps) so the labels keep
      their height. `ui:matrix` now fails when the board covers the pass or scrolls.
- [x] N7o **Store shots after N7m/N7n** — the failure scene still showed the old capacity wording and the upgrade
      scene the old board layout; all 30 store PNGs, the manifest and the contact sheet re-rendered and checked.
- [x] N7p **Game-over report clears the boarding pass** — N7o known issue: on the 360×640 store phone the
      "NETWORK CLOSED" sign covered the final week/day/time/passengers. The report starts below the pass (short
      portrait trims gaps so it still fits); `ui:matrix` and `store:shots` fail when the board or report covers it.
- [x] N7q **Browser e2e for targeted weekly picks** — every browser suite took a card that completes on its own,
      so the globe tap of "+2 slots" and the hub expansion (and Back from the pick) ran only in DOM tests.
      New `e2e/upgrade-picks.mjs` (`test:e2e:upgrade-picks`, in `test:ci`) at 412×915 and 915×412; DEV-only
      `aw.gesture('pick')` and `aw.state().upgrades`.
- [x] N7r **Plural forms, last leftovers** — after N7j a review of every `{number} word` string left two: EN
      "Aircraft waited 1 minutes …" (slot-wait cause) and the puzzle goals' passenger count (PL "Dowieź 1 pasażerów",
      EN "deliver 1 passengers"). Both use the plural token now; `test:format` covers them.
- [x] N7s **Secondary screens fit small phones** — found while playing at 360×640: the settings selects cut
      "Automatyczna" and "Nazwa miasta". The control column keeps ≥ 156 px; new `e2e/screens-fit.mjs`
      (`test:e2e:screens-fit`, in `test:ci`) audits targets, clipped text and select widths on settings, puzzle
      board and pause sheet at three sizes in PL/EN.
- [x] N7t **Airport pick sign beside the pass in landscape** — N7n left the pick mode as it was: on 915×412 the
      sign sat at 86–136 px across the globe, over airport tags in the upper band where the player must tap. It
      now sits beside the boarding pass as on the board.
- [x] N7u **Airport-pick sign fits beside the pass** — N7t leftover, worse than reported: the instruction shared
      one row with the week and Back, so on 844/740 px landscape it got 11/0 px and the sign grew to 84–117 px
      (pass: 60 px); on 360 px portrait PL it took 4 lines. The week now sits small above the instruction; below
      880 px landscape Back keeps its arrow only. New `e2e/pick-sign.mjs` (`test:e2e:pick-sign`, in `test:ci`).
- [x] N7v **"Automatyczna" at 320 dp** — at 320×568 the settings selects were capped at 132 px (half the row), so
      "Automatyczna" and "Nazwa miasta" ran into the arrow. The control column now keeps ~156 px down to 320 dp
      (labels wrap instead). New `e2e/screens-fit-320.mjs` (`test:e2e:screens-fit-320`, in `test:ci`): the
      screens-fit audit at 320×568/568×320 with ≥ 8 px to spare in every select.
- [x] N7w **Fair balance bot after "+2 slots"** — the DEV/balance bot could only open new routes with a spare
      aircraft, so after "+2 slots" (no aircraft) new cities stayed unserved and seed 0xA1A1 jammed in week 2.
      With no spare aircraft it now extends the nearest served route (≤ 5 stops, leg within the shortest range
      of its aircraft). Forced week-1 picks, 30-min horizon: slots 13.8 → 16.4 min, turboprop 13.9 → 15.8,
      widebody 15.4 → 21.8 (Q-35); test:balance median 12.92 → 14.55 min (Q-36). No game parameter changed.
      New `scripts/test-bot-policy.ts` (`test:bot-policy`, in `test:fast`).
- [x] N7x **Long Playwright play-throughs** — 20–22 min real-time runs at 1× and 4× (PL 412×915 1×, EN 412×915
      4×, PL 915×412 4×, EN 915×412 1× for 17.5 min) with the new `scripts/long-play.mjs` (`ui:long-play`, DEV
      `aw.botStep`). Found a soft lock: Undo right after a weekly upgrade popped the choice itself, the world went
      back to the board the UI had closed and the clock froze. Undo now never removes weekly choices (the session
      also re-shows a reopened board). Regression: `test:undo` +2, new `e2e/undo-after-upgrade.mjs`
      (`test:e2e:undo-after-upgrade`, in `test:ci`).
- [ ] N7y **Long play-throughs, round 2** — EN 915×412 1× for the full 20 min, fold 673×841 and 904×1000 at 4×,
      plus Android back (Escape) / rotation during the board, pick and game over.
- [x] N7z **Opening camera frames a cluster, never an empty ocean** — found in N7y: Continue of a week-3 save
      (airports on several continents) centred the camera on their spherical mean, the empty Pacific; every airport
      was an edge arrow and the "+2 slots" pick had nothing to tap. `src/game/framing.ts` keeps the mean for a
      compact network, else frames the densest 30° cluster (hubs count double). `test:framing` (in `test:fast`) and
      `e2e/continue-framing.mjs` (`test:e2e:continue-framing`, in `test:ci`).
- [ ] N8a **Store shots after N7w** — the better bot grows a different network, so `store:shots` no longer matches
      the committed PNGs; re-render, inspect the contact sheet, commit.
- [ ] N8b **Edge arrows over the dock** — at 841×673 (fold rotated) the off-screen airport arrows in the right
      column sit on top of the dock tags; keep them clear of the dock.
- [ ] N8c **Weekly board at 360×640** — the third card ends at 737 px (off-screen); check it scrolls or fits.
- [ ] N7 When the queue is empty: pick the most valuable next improvement from `docs/HANDOVER*.md`, PR "Known issues"
      sections and the forbidden list review of current screenshots; add it here first, then do it.

## Log
<!-- one line per finished item: date UTC · item · PR · gate summary -->
- 2026-11-03 · N1 puzzles 16–30 (D-70) · night/01-puzzles · test:fast 42/42, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:puzzles levels=30 cases=168 failed=0 (merged tree with #40, #42)
- 2026-11-03 · N2 code quality · night/02-code-quality · test:fast 43/43, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:save-golden 9/9, test:replay 23/23
- 2026-11-03 · N3 audio & music (D-71) · night/03-audio · test:fast 44/44, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:audio-render 4/4, test:audio-cues 6/6
- 2026-11-03 · N5 hub label setting (D-68) · night/05-hub-labels · test:fast 45/45, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:airport-labels 4/4, shots:n5 6/6
- 2026-11-03 · N6a leaderboards client core (D-72) · night/06-leaderboards-core · test:fast 46/46, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:net 6/6, test:balance ok (N6 continues: server N6b, UI N6c)
- 2026-11-03 · N6b leaderboards server · night/06b-leaderboards-server · test:fast 47/47, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:firebase (emulator) 6/6, test:net-server 4/4 (N6c UI next)
- 2026-11-03 · N6c daily ranking UI (N6 done, D-66/D-72) · night/06c-leaderboards-ui · test:fast 47/47, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:firebase 6/6, test:net 7/7, shots:n6 3/3 (emulator)
- 2026-11-03 · N4 low-end performance (D-73) · night/04-low-end-perf · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:quality 32/32, perf:scene medium triangles 423 022 → 250 217, CPU mean 2.36 → 1.35 ms
- 2026-11-03 · N7a resumed daily run is ranked (D-72) · night/07a-daily-resume · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:daily-mode 17/17, test:net 8/8
- 2026-11-03 · N7b adaptive downgrade remembered (D-74) · night/07b-adaptive-memory · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:quality 50/50, browser check: remembered pixel-ratio step gives canvas 412 px instead of 824 px at DPR 2
- 2026-11-03 · N7c daily Continue e2e · night/07c-daily-continue-e2e · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:daily-continue 7/7 (fails 4/7 with the N7a resume disabled)
- 2026-11-03 · N7d puzzle curfew marks · night/07d-puzzle-curfew · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:puzzles 168/168, test:hud-targets 300/300, shots puzzle-curfew-08/30 8/8
- 2026-11-03 · N7e split-flap rattle · night/07e-flap-sfx · test:fast 48/48, build ok, e2e:smoke 9/9, e2e:daily-continue 7/7, ui:matrix 32/32, test:audio-cues 8/8, test:audio-render 4/4, browser: menu return plays 8 flap clicks
- 2026-11-03 · N7f tree/rock culling (D-75) · night/07f-tree-culling · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:quality 57/57, globe shots pixel-identical, medium z2.5 triangles 216 081 → 173 035, perf:scene medium max triangles 250 217 → 243 907
- 2026-11-03 · N7g puzzle screen e2e · night/07g-puzzles-e2e · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:puzzles 34/34 (30 levels)
- 2026-11-03 · N7h puzzle strip columns · night/07h-puzzle-strip-columns · test:fast 48/48, build ok, e2e:smoke 9/9, e2e:puzzles 34/34, test:hud-targets 300/300, ui:matrix 32/32
- 2026-11-03 · N7i owner question sheet (34 questions) · night/07i-owner-questions · docs only: test:fast 48/48, build ok
- 2026-11-03 · N7j PL plural forms · night/07j-pl-wording · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:format 11/11, test:i18n keys=300
- 2026-11-03 · N7k saves survive a rules update (D-76) · night/07k-save-robustness · test:fast 48/48, build ok, e2e:smoke 9/9, e2e:daily-continue 7/7, ui:matrix 32/32, test:save-golden 17/17
- 2026-11-03 · N7l daily ranking e2e · night/07l-leaderboard-e2e · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:leaderboard 5/5 (emulators; fails 4/5 without the start-up flush)
- 2026-11-03 · N7m capacity cause wording · night/07m-capacity-cause · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:format 11/11
- 2026-11-03 · N7n weekly board clears the boarding pass · night/07n-landscape-banner · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32 (new HUD-overlap check fails 4/32 on the old CSS), test:hud-targets 300/300
- 2026-11-03 · N7o store shots refreshed · night/07o-store-shots · store:shots captured=30 failed=0, test:store-shots shots=30 failed=0, test:fast 48/48, build ok
- 2026-11-03 · N7p game-over report clears the boarding pass · night/07p-gameover-pass · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, store:shots 30/30 (fails on the old CSS), test:store-shots 30/30
- 2026-11-03 · N7q targeted weekly pick e2e · night/07q-upgrade-picks-e2e · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:upgrade-picks 10/10 (6/10 with the globe tap disabled)
- 2026-11-03 · N7r plural leftovers · night/07r-plural-leftovers · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:puzzles 34/34, test:format 11/11, test:i18n keys=300
- 2026-11-03 · N7s secondary screens fit · night/07s-screens-fit · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:tutorial 21/21, test:e2e:screens-fit 18/18 (17/18 on the old settings grid)
- 2026-11-03 · N7t pick sign beside the pass · night/07t-pick-sign · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, test:hud-targets 300/300, shots:39 8/8
- 2026-11-03 · N7u airport-pick sign fits beside the pass · night/07u-pick-sign-height · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, test:hud-targets 300/300, test:e2e:pick-sign 10/10 (1/10 on the old CSS), shots:39 8/8
- 2026-11-03 · N7v settings selects at 320 dp · night/07v-settings-320 · test:fast 48/48, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:tutorial 21/21, e2e:screens-fit 18/18, test:e2e:screens-fit-320 12/12 (10/12 on the old grid)
- 2026-11-03 · N7w balance bot extends routes without spare aircraft · night/07w-bot-policy · test:fast 49/49, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, e2e:daily-continue 7/7, e2e:pick-sign 10/10, e2e:tutorial 21/21, test:hud-targets 300/300, test:replay 23/23, test:balance median 12.92 → 14.55 min upgrade2 0.44 → 0.50, test:bot-policy 6/6 (3/6 on the old bot)
- 2026-11-03 · N7x long play-throughs + Undo soft lock · night/07x-long-play · test:fast 49/49, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, e2e:daily-continue 7/7 (1 flaky 2/7 run of 6), e2e:tutorial 21/21, e2e:puzzles 34/34, test:hud-targets 300/300, test:replay 23/23, test:balance unchanged, test:save-golden 17/17, test:undo 9/9 (7/9 on the old Undo), test:e2e:undo-after-upgrade 2/2 (0/2 on the old Undo), 4 long runs 17.5–22 min issues=0 after the fix
- 2026-11-03 · N7z opening camera frames a cluster · night/07z-framing · test:fast 50/50, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:daily-continue 7/7, e2e:upgrade-picks 10/10, e2e:pick-sign 10/10, e2e:tutorial 21/21, test:hud-targets 300/300, test:framing 4/4, test:e2e:continue-framing 2/2 (1/2 on the old framing), store:shots 30/30 (PNG drift from N7w left for N8a)

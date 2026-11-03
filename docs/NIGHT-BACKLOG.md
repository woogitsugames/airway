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
- [x] N7y **Long play-throughs, round 2** — `ui:long-play` 21 min each: EN 915×412 1× (0 issues), EN 904×1000 4×
      (0), PL 673×841 4× (camera on an empty ocean after Continue → N7z; edge arrows over the dock → N8b), PL
      360×640 1× (third weekly crate below the screen → N8c).
- [x] N7z **Opening camera frames a cluster, never an empty ocean** — found in N7y: Continue of a week-3 save
      (airports on several continents) centred the camera on their spherical mean, the empty Pacific; every airport
      was an edge arrow and the "+2 slots" pick had nothing to tap. `src/game/framing.ts` keeps the mean for a
      compact network, else frames the densest 30° cluster (hubs count double). `test:framing` (in `test:fast`) and
      `e2e/continue-framing.mjs` (`test:e2e:continue-framing`, in `test:ci`).
- [x] N8a **Store shots after N7w/N8c** — the better bot grows a different network and the 360×640 phone board is
      compact now (all three crates on screen); 24 of 30 store PNGs and the contact sheet re-rendered and checked.
- [x] N8b **Edge buttons clear of the landscape dock** — in every landscape size the off-screen airport buttons of
      the right column sat on the dock tags (the overlay reserved only top/bottom bands, the portrait layout). The
      overlay takes a live reservation; landscape reserves a 96 px right band. New `e2e/edge-dock.mjs`
      (`test:e2e:edge-dock`, in `test:ci`).
- [x] N8c **Weekly board fits short phones** — at 360×640 the third crate sat half below the screen (overlay
      scrolled 51–111 px, 320×568: 190–232 px). Short portrait (≤ 719 × ≤ 760 px) gets a compact board: smaller
      model window (wider text column, fewer wraps), tighter gaps. 360×640 fits, 320×568 scrolls ≤ 19 px. New
      `e2e/board-short.mjs` (`test:e2e:board-short`, in `test:ci`).
- [x] N8d **Flaky `test:e2e:daily-continue`** — failed 1 of 6 runs in N7x (step 3, the route/aircraft drag).
      Three causes: (1) the spec counted the dock drag from before the route, but a new route already flies one
      aircraft, so a tick during a slow drag skipped the expected count (and a broken dock drag passed silently);
      (2) Playwright awaits the press before the first move, and on a loaded machine that round trip alone
      exceeded the 350 ms long press, so the globe opened the route menu; (3) the first gesture after start
      could read the pre-HUD framing. The spec now counts from after the route and sends the first moves with the
      press (CDP); `e2e/leaderboard.mjs` gets the same count fix. Game: the long press counts from when the
      press was handled (a press queued behind a long frame is no hold), a move is judged at its own position,
      a late frame defers the menu by one frame (`test:gestures` +4); the session measures pass and dock once
      mounted. 12 consecutive green runs right after a build; 16/16 with 4 runs in parallel (old spec: 12/16).
- [x] N8e **320×568 PL week-2 board scrolls 19 px** — N8c leftover; fit it. A ≤ 359 × ≤ 600 px tier trims the
      remaining gaps (overlay top, sign padding, label/grid gaps); targets, text sizes and torn edge stay.
      `test:e2e:board-short` now allows 0 px at 320×568 (failed 2/4 before: PL week 2 19 px, EN week 1 1 px).
- [x] N8f **Long play-throughs, round 3 (landscape foldables)** — `ui:long-play` 21 min each: PL 841×673 2×
      (4 runs, max week 1, 0 issues) and EN 1000×904 4× (5 runs, max week 2, 0 issues). Weekly board, game-over
      report, pause/save/Continue and rotation all fine on both; no soft lock. Note: seed 42232 (841×673) ends in
      week 2 day 2 every time with "no route to Africa" (32/24 waiting): the bot does not open a second continent;
      a bot-policy matter, not a game bug (balance gate unaffected).
- [ ] N7 When the queue is empty: pick the most valuable next improvement from `docs/HANDOVER*.md`, PR "Known issues"
      sections and the forbidden list review of current screenshots; add it here first, then do it.

## Owner decisions 2026-11-03 morning (do these before other N8 polish)
- [x] N9a **Leaderboard TTL 90 days (D-77)** — Firestore TTL policy/field + emulator test; privacy draft `docs/legal/` updated (retention + e-mail deletion); `docs/FIREBASE.md` step for enabling TTL.
      Done: `expireAt` (write + 90 days) on daily and weekly entries, TTL field override on `entries.expireAt`,
      `test:net-server` +1, `test:firebase` +1 (emulator reads both entries as admin), FIREBASE steps 8–9.
- [x] N9b **Balance target 10–18 min (D-79)** — `test:balance` thresholds and docs. Gate 10–18 min in
      `scripts/balance-report.ts`, report text, `docs/balance/`, TESTING row; median unchanged at 14.55 min.
- [x] N9c **Airline colour (D-80)** — settings palette (CVD min ΔE ≥ 15, check with `test:cvd`), applied to tail fin/livery accents. Plane render files belong to the parallel session's M1: check `git log origin/dev -- src/render/planes*` — if M1 is merged, proceed; otherwise do only the settings/palette part and leave a clear render hook.
      Done (M1 #52 still open): 6 colours in `src/data/airline-colours.json` (`test:cvd`: ΔE ≥ 15 in normal vision
      and all CVD modes, ≥ 40 from the cream body), settings select with a tail-fin swatch, boarding pass band,
      hook `onAirlineColour` (main.ts calls `renderer.setAirlineColour?.(hex)`), `test:airline-colour`,
      `e2e/airline-colour.mjs`; owner question Q-37.
- [ ] N9d **Airline colour on the planes** — after M1 (#52) merges: implement `setAirlineColour(hex)` on the world
      renderer and paint tail fins/livery accents with it (hook already wired in `src/main.ts`).

## Continuous development round N10 (picked by the night agent while N9d waits for #52)
- [x] N10a **Mark a newly opened airport** — a city that opens mid-run had no sign at all: no code on the globe and
      no tag until passengers wait, so the player could not tell which airport was new. Its luggage tag gets an
      ink "NEW / NOWE" stub (shape, not only colour) and its edge chip turns ink, until a route serves it or after
      12 game hours; a short stamp-in (no spring), none with reduced motion. Pure timing in `src/game/newAirports.ts`.
- [x] N10b **PL/EN text review** — one terminology per thing: the puzzle screen called the widebody "Jet" (PL
      "Odrzut.") while the rest of the game says widebody / WB-; EN mixed "Puzzle", "Assignment" and "Mission" for
      one puzzle; "Arrived" vs "Delivered"; PL "Tryb daltonistów" → "Tryb dla daltonistów", "Rozbudowy" → "Rozbudowy
      huba"; the speed button read "Simulation speed: 2x" / "2 razy" → "Game speed: 2×" / "Prędkość gry: 2×".
      Tutorial strings left alone (parallel M2 #88 owns them).
- [x] N10c **Say why a saved flight vanished** — a damaged save, or one from a newer version, silently lost its
      Continue row (the `save.error.*` strings existed but were never shown, and claimed "a new game has been
      started"). The menu now shows a one-line paper notice until the next flight starts; unreadable storage (private
      window) stays silent, the save itself is kept untouched. `loadSavedSimChecked` in `src/game/save.ts`.
- [x] N10d **Daily row: today's score and streak; plural bug from 1 000** — the score store counted today's official
      result and the streak of days, but the menu never showed them; the daily row now reads "today 1,250 · 3-day
      streak" / "2-day streak · play today". Found on the way: every plural with a `localNumber` count of 1 000 or
      more leaked its token ("rekord 2 500 {count|pasażer|…}" on the menu record and Continue rows); `t()` now
      reads formatted counts. `src/game/dailyRow.ts`, `test:format` +2, `e2e/daily-row.mjs`.
- [x] N10e **Daily report: share the result; honest restart buttons** — `shareDailyResult` (task 18) was never
      called: the daily game-over had no way to share, and `daily.finish` got no regions, so every ticket read "--".
      The report gets a "Share result" action (native sheet, else clipboard, else the text to select), the ticket is
      the regions the network served (8 glyphs, two new for ASI/OCE), the text adds the streak of days. On a daily,
      "Same world" and "New world" both silently went to the menu: same world now starts a practice of today's
      world (menu if the day changed), new world starts Endless.
- [x] N10f **Haptics for every committed action** — native haptics fired only on route snaps/commits and on a jam
      starting; dropping an aircraft on a route, picking the weekly card and the network closing were silent, and no
      test covered haptics at all. Light impact on an accepted aircraft drop and weekly pick, one heavy impact when
      the network closes; still behind the "Haptic feedback" switch, presentation only (D-13). `test:haptics`.
- [x] N10g **Draw the curfew barrier in the game** — the renderer has a red-white barrier ring for an airport closed
      by the night curfew (task 11), but the game never called `setCurfew` (only `reset` cleared it): from Endless
      week 4 and in the curfew puzzles a closed airport looked open while planes held. Session sync feeds the
      sim's `curfewClosed` per city to the world on change only. The ring is small at gameplay zoom → N10h.
- [x] N10h **Readable curfew sign on the tag and edge chip** — after N10g the globe draws the barrier ring, but at
      gameplay zoom it is a few pixels and an off-screen closed airport's edge chip said nothing. While the sim
      closes an airport, its luggage tag gets the red-white boom-barrier stub (the same mark as the puzzle strips,
      N7d: a shape, not only colour) and its edge chip a striped barrier bar; screen-reader labels say it is closed.
      Also removes a `node_modules` symlink committed by N10f (`.gitignore` matched only the directory).
- [x] N10i **Transfers visibly make their connection** — a passenger dropped at a hub waits the minimum connection
      time (25 min, 15 after a hub upgrade) before it can board, but its tag looked the same as a ready passenger, so
      the MCT and the hub upgrade that shortens it were invisible. The sim view gains `connectingByRegion` (read-only,
      no state change); the luggage tag draws those passengers as hollow region glyphs (same shape, outline only) at
      its tail, at most half the shown glyphs when the tag overflows, and they fill in when the time runs out; the
      screen-reader label adds "Making a connection: N". `test:transfers`, `e2e/transfer-glyphs.mjs`.
- [x] N10j **Pause sheet: a network summary** — the "Holding pattern" sheet had only Resume / Save / Menu, so a
      pause told the player nothing about the run. It now opens with three flight-strip fields read once on pause:
      routes and aircraft (with spare ones), the fullest hub by share of capacity (code or name per D-68) and the time
      to the next crates. Save and Menu share one row so the taller sheet still fits 915×412 and 320×568 under the
      boarding pass. Pure rows in `src/game/pauseSummary.ts`; `test:pause-summary`, `e2e/pause-summary.mjs`.
- [x] N10k **Settings in groups** — eleven controls stood in one flat list in no particular order (language,
      graphics, airport labels, airline colour, text size, then the switches). Now four labelled sections, each with a
      teal tab heading: Game (language, airport labels, airline colour), Display (graphics, text size, colour-vision
      mode and its hint), Sound and touch (sound, music, haptics), Help (tutorial replay, licences). Wide landscape
      paper (≥ 700 px) puts them in two columns, so 915×412 and the unfolded Fold need less scrolling.
      `e2e/settings-groups.mjs`.
- [x] N10l **Best result per puzzle** — the puzzle board kept only the stars, so a replay had nothing to beat
      once three stars were reached and the margin over the target was forgotten. The widest margin of a cleared run
      is stored per level (`airway.puzzles.margin.v1`, beside the unchanged stars record the menu reads), shown under
      the stars on the departure flap ("best +26%") and as "Your best" on the level ticket; beating it adds "new
      best" to the result. `src/game/puzzleBest.ts`, `test:puzzle-best`, `e2e/puzzle-best.mjs`, `e2e/puzzles.mjs`
      checks the margin on every level.
- [x] N10m **Long play at unusual sizes: game-over actions on short phones** — `ui:long-play` 14 min each, EN
      1280×800 4× (4 runs, issues=0) and PL 360×640 2× (2 runs, 4 issues). Found: the game-over report of a week-2
      jam (four cancelled departures, three PL causes, a new record) put "New world" and "Menu" below a 360×640
      screen (N7p fitted only the short fixture). Short portrait screens now put the three actions in one row and
      show 2½ (≤ 700 px tall) or 1½ (≤ 600 px) departure rows before the list scrolls. The other three issues were
      the long-play script clicking a disabled "Expand hub" crate (no hub yet); it now picks only enabled crates.
      `e2e/gameover-short.mjs`.

- [x] N10n **Logbook (run statistics)** — nothing in the game said how much had been played: the menu showed only
      the record. A pilot's logbook page, opened from the departure board's service row (Settings D0 and Logbook D1
      now share the last line, so the board keeps its height on 915×412 and 320×568): totals (flights, passengers
      carried, weeks in the air, longest flight), records (best flight from the existing best record, favourite hub,
      best official daily and longest streak from the daily scores, puzzles solved and stars) and the last six
      flights as ruled logbook lines (date, Endless/daily with the teal stub, hub code, weeks, passengers). One line
      per finished Endless or daily flight in a new device-local store (`airway.logbook.v1`, written at game over;
      older flights are not known). The run's hub is the hub on most routes, else the busiest airport.
      `src/game/logbook.ts`, `src/ui/logbook/`, `test:logbook`, `e2e/logbook.mjs`.

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
- 2026-11-03 · N7y long play-throughs round 2 (4 × 21 min) · found N7z, N8b, N8c · no code
- 2026-11-03 · N8c weekly board fits short phones · night/08c-board-short · test:fast 50/50, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, e2e:pick-sign 10/10, e2e:tutorial 21/21, test:hud-targets 300/300, e2e:screens-fit 18/18, test:e2e:board-short 4/4 (0/4 on the old CSS)
- 2026-11-03 · N8b edge buttons clear of the landscape dock · night/08b-edge-arrows · test:fast 50/50, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:tutorial 21/21, test:hud-targets 300/300, e2e:upgrade-picks 10/10, e2e:continue-framing 2/2, shots airports 4/4, test:e2e:edge-dock 3/3 (1/3 on the old overlay)
- 2026-11-03 · N8a store shots refreshed · night/08a-store-shots · store:shots captured=30 failed=0, test:store-shots shots=30 failed=0, test:fast 50/50, build ok
- 2026-11-03 · N8d flaky daily-continue fixed · night/08d-daily-continue-flake · test:fast 50/50, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:upgrade-picks 10/10, e2e:tutorial 21/21, e2e:continue-framing 2/2, e2e:edge-dock 3/3, test:gestures 35/35 (31/35 on the old recognizer), test:e2e:daily-continue 12/12 consecutive after a build, 16/16 at 4× parallel load (12/16 with the old spec)
- 2026-11-03 · N9b balance target 10–18 min (D-79) · night/09b-balance-target · test:fast 50/50 (test:balance median 14.55 in 10–18), build ok; no UI/sim change, so no e2e (owner rule: minimum runs)
- 2026-11-03 · N9a leaderboard TTL 90 days (D-77) · night/09a-leaderboard-ttl · test:fast 50/50, build ok, test:net-server 5/5, test:firebase (emulator) 7/7; no UI change, so no e2e
- 2026-11-03 · N9c airline colour, settings + pass band + hook (D-80) · night/09c-airline-colour · test:fast 51/51, build ok, e2e:smoke 9/9, e2e:screens-fit 18/18, e2e:screens-fit-320 12/12, test:cvd airline=6 (fails on the first palette draft, deutan 12.0), test:airline-colour 4/4, test:e2e:airline-colour 3/3
- 2026-11-03 · N8e weekly board fits 320×568 · night/08e-board-320 · test:fast 51/51, build ok, test:e2e:board-short 4/4 with 0 px allowed at 320×568 (2/4 on the old CSS); ui:matrix not run (no matrix size ≤ 359 px is affected)
- 2026-11-03 · N8f long play-throughs round 3 (2 × 21 min, landscape foldables) · night/08f-long-play-3 · no code; issues=0 in both runs
- 2026-11-03 · N10a new airport mark · night/10a-new-airport · test:fast 52/52, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:new-airports 5/5, test:e2e:new-airport 4/4 (EN+PL)
- 2026-11-03 · N10b PL/EN text review · night/10b-text-review · test:fast 52/52, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:puzzles 34/34, e2e:screens-fit 18/18, e2e:screens-fit-320 12/12
- 2026-11-03 · N10c saved-flight notice · night/10c-save-notice · test:fast 52/52, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:daily-continue 7/7, test:save-golden 19/19, test:e2e:save-notice 4/4
- 2026-11-03 · N10d daily row score/streak + plural fix · night/10d-daily-row · test:fast 52/52 (test:format 13/13), build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:save-notice 4/4, e2e:screens-fit-320 12/12, test:e2e:daily-row 4/4
- 2026-11-03 · N10e daily share + restart buttons (D-81) · night/10e-share · test:fast 52/52 (test:daily-mode 20/20), build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:daily-share 4/4
- 2026-11-03 · N10f haptics for every committed action · night/10f-haptics · test:fast 53/53 (test:haptics 6/6), build ok, e2e:smoke 9/9; ui:matrix not run (no visual change)
- 2026-11-03 · N10g curfew barrier drawn in the game · night/10g-curfew · test:fast 53/53, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:curfew-barrier 2/2 (0/2 without the sync)
- 2026-11-03 · N10h curfew sign on tag and edge chip · night/10h-curfew-tag · test:fast 53/53, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, e2e:new-airport 4/4, test:e2e:curfew-barrier 2/2 (tag/chip checks added)
- 2026-11-03 · N10i transfers drawn hollow inside the MCT · night/10i-mct · test:fast 54/54 (test:transfers 3/3, test:replay hashes unchanged), build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:transfer-glyphs 2/2
- 2026-11-03 · N10j pause sheet network summary · night/10j-pause-week · test:fast 55/55 (test:pause-summary 5/5), build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:screens-fit 18/18, e2e:screens-fit-320 12/12, test:e2e:pause-summary 4/4 (2/4 before Save and Menu shared a row)
- 2026-11-03 · N10k settings in groups · night/10k-settings-groups · test:fast 55/55, build ok, e2e:smoke 9/9, e2e:screens-fit 18/18, e2e:screens-fit-320 12/12, e2e:airline-colour 3/3, e2e:tutorial 21/21, test:e2e:settings-groups 4/4; ui:matrix not run (settings not in the matrix)
- 2026-11-03 · N10l best margin per puzzle · night/10l-puzzle-best · test:fast 56/56 (test:puzzle-best 4/4), build ok, e2e:smoke 9/9, e2e:puzzles 34/34 (margin checked on all 30), e2e:screens-fit 18/18, e2e:screens-fit-320 12/12, test:e2e:puzzle-best 2/2; ui:matrix not run (puzzle screens not in the matrix)
- 2026-11-03 · N10m long play at unusual sizes + game-over on short phones · night/10m-long-play · ui:long-play EN 1280×800 4× 14 min issues=0, PL 360×640 2× 14 min issues=4 → recheck 10 min issues=0; test:fast 56/56, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, test:e2e:gameover-short 4/4 (2/4 on the old CSS)

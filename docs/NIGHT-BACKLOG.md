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

- [x] N10o **Store shots refreshed (service row)** — the 30 store PNGs' `menu` scene still showed the old last
      board row after N10n (Settings alone); `store:shots` regenerated, `test:store-shots` checks them.

- [x] N10p **Localisation robustness: pseudo-locale audit** — a DEV-only `?pseudo` stretches every translated string
      ~40 % (doubled accented vowels, `[…]`), like German/Finnish copy would. `e2e/pseudo-locale.mjs` audits the
      departure board, settings, logbook, puzzle board, pause sheet, weekly upgrade board and game over at 360×640
      (PL, EN) and 915×412 (EN): no text cut by an overflow box, nothing outside the viewport, ≥ 48 px buttons.
      Found 3/21: the cargo label kicker "FREIGHT · SLOT+2" was cut by an ellipsis; it now wraps after the " · ".
      `src/i18n/pseudo.ts`.

- [x] N10q **Pseudo-locale on the in-game HUD** — the N10p audit stopped at menus and sheets. It now also covers the
      in-game HUD (boarding pass, plane-tag dock) and the airport tags/edge chips after a day of bot play, and flags
      a text run wider than its own box (the ticket's notch mask hid overflow that no overflow box reported). Found
      6/27: the pass label "PASSENGERS" ran under the ticket edge (cut by the mask at 360 and 915 px), and the
      departure board's "GATE / BRAMKA" head ran into "STATUS". Both now wrap inside their box.
- [x] N10r **End-of-run timeline on the game-over report** — the report said why the network closed but not how
      the run went. A "Timeline / Przebieg" tab beside "Causes" lists one ruled line per week: the weekly crate taken,
      routes opened/extended/closed and aircraft added, then "day 2: LIS jammed". Read from the command journal in a
      separate throw-away Sim (refused commands do not count; the live run is untouched), only when the tab is opened
      and in slices between frames. Both panels share one height, so the actions never move (short phones included).
      `src/game/runTimeline.ts`, `test:run-timeline`, `e2e/run-timeline.mjs`.
- [x] N10s **Store shots refreshed (game-over tabs)** — the 30 store PNGs' `failure` scene still showed the old
      "Three key causes" heading after N10r; `store:shots` regenerated, `test:store-shots` checks them.
- [x] N10t **Timeline without replaying the run** — the N10r timeline re-simulated the whole run from its seed
      (~6–7 µs per tick on the dev machine with 4 weeks; a 30-week run is ~130 000 ticks, so seconds of slices on
      a slow phone). The live Sim now records each journal entry's outcome (game minute, accepted) as it ticks,
      outside its state, hash and snapshot (`getCommandOutcomes()`; undo truncates and re-simulates them). The
      timeline is then read directly (0.13 ms instead of 84 ms for the 4-week test run); only a run continued
      from a save replays the prefix before the resume, and no further. Built once per report.
- [x] N10u **Airport tag overlay with 40 airports** — measured first: in the real game the overlay is < 1 ms of JS per
      second (rendering sets the frame rate); with 40 synthetic airports the cost is the tag rebuild after a
      passenger change, which re-created every glyph SVG. Tags now reuse glyph nodes and write only the children that
      differ (~25–30 % less per frame with 5 or 40 changes). New `npm run perf:overlay` measures it and checks that a
      reused tag equals a fresh build. Numbers in `docs/PERFORMANCE.md`.
- [x] N10v **Long play-throughs (1280×800 PL, 412×915 EN, 4×) + edge chips over airports** — `ui:long-play`
      12 min each. PL 1280×800: 4 runs, every one closed in week 1 (bot only; no UI issue). EN 412×915: 2 runs, max
      week 3, 1 issue: on the week-2 "+2 slots" pick the airport by the left screen edge sat under the edge chip of
      an off-screen airport, so the tap went to the chip and the pick never completed (a route drag starting there
      was blocked the same way). Edge chips now slide along the edge clear of every on-screen airport marker
      (16 px clearance inside the 28 dp tap radius). `e2e/edge-chip-airports.mjs` (fails 1/2 on the old overlay).
- [x] N10w **Next puzzle after a clear** — a cleared puzzle left its yellow action as a disabled "To deadline",
      so the only way on was Back → board → the next flap. The yellow action now reads "Next: 08" / "Dalej: 08"
      (screen-reader label with the next title) and has focus after the clear; after puzzle 30 it is "All puzzles" /
      "Wszystkie zadania" back to the board. `e2e/puzzles.mjs` checks it on all 30 levels and clicks 01 → 02.
      Also: the duplicate owner question id Q-39 (logbook entry) is now Q-40.
- [x] N10y **Puzzle board opens where the player is** — the 30-row departures board always opened at puzzle 01, so
      a player on puzzle 20 scrolled down every visit, and Back from a level threw the list back to the top. The
      board now centres the first departure not yet cleared, and coming back from a level (Back, "All puzzles",
      hardware back/Escape) centres that level's flap and focuses it. Only the list scrolls.
      `e2e/puzzle-board-scroll.mjs` (`test:e2e:puzzle-board-scroll`, in `test:ci`; 3/12 on the old board).
- [x] N10x **Long play 800×1280 PL 4× + edge buttons on the portrait Fold dock** — `ui:long-play` 12 min: 2 runs,
      max week 3, issues=0, but its shots showed edge buttons for off-screen airports inside the right-hand dock
      column. Every screen ≥ 600 × 600 uses the HUD's 'foldable' layout (dock as a right column) — the unfolded Fold
      in portrait (673×841), 904×1000 and tablets — yet the session reserved the right band only for width > height:
      on 673×841 "JED" sat on the aircraft tag and "JNB" under the hub tag, and the globe centred behind the dock.
      Overlay reservation and world insets now follow `resolveHudLayout`. `test:e2e:edge-dock` adds both portrait
      foldables and a dock-column check (2/5 fail on the old session); matrix fold game shots and the 30 store
      PNGs (foldable/tablet framing) refreshed.
- [x] N10z **Edge chips clear of airport tags** — seen in the N10x long play: the luggage tag of an on-screen airport
      near the left edge was drawn over the edge chip of an off-screen airport and hid its code ("←B…"). After the
      tags are laid out, a chip now first looks for a place along its edge clear of every placed tag (3 px gap); only
      when the edge is too crowded may it sit under a tag, and never on an airport marker (N10v). New
      `e2e/edge-chip-tags.mjs` (`test:e2e:edge-chip-tags`, in `test:ci`).

## Continuous development round N11 (night agent, after the N10 letters ran out)
- [x] N11a **No globe frames behind opaque pages** — settings, licences, logbook, the puzzle screens and the tutorial
      replay hide the canvas behind an opaque page, yet the menu globe kept drawing under them at full rate
      (SwiftShader: 36 frames in 1.2 s behind settings; on a phone 60–120 Hz for a whole puzzle session). The router
      now marks those pages as covering the world and the frame loop skips all camera, demo and render work while
      no run is attached. `e2e/covered-pages.mjs` (`test:e2e:covered-pages`, in `test:ci`), DEV probe
      `__awWorld.frames()`, `docs/PERFORMANCE.md` § N11a.
- [x] N11b **Game over at an unserved airport says so; no record for 0 passengers** — `ui:long-play` EN 673×841 2×
      12 min (3 runs, max week 1, issues=0) ended both game overs at an airport no route served (IST), like the
      673×841 matrix shot (REC): the departures board was an empty dark panel reading "No scheduled departures". Its
      rows are the jammed airport's route neighbours, so an empty board always means no route served it; it now reads
      "No route served IST: its passengers had no flight to board." with the hint "Connect a new airport before its
      waiting area fills up." (hint hidden on ≤ 600 px short phones, where the board shows 1½ rows). Also: the first
      run of a fresh profile that delivered 0 passengers was announced as a "new local record" and the menu then read
      "record 0"; a 0-passenger flight is no record now (`test:causes` +2 asserts). `e2e/gameover-unserved.mjs`
      (`test:e2e:gameover-unserved`, in `test:ci`).
- [x] N11c **Game-over map view** — the game-over report covered the network the run ended on; there was no way to
      look at where it went wrong. The closed-network sign gets a "Map / Mapa" tab: the report and the dim lift, the
      globe takes gestures (turn, zoom), and one paper strip at thumb height says "Network closed at REC" with "Back
      to report" (hardware back/Escape does the same; a second back leaves to the menu as before). While building it:
      the game over detached the frame hook, so airport tags and edge chips stayed where they were before the camera
      flew to the jammed hub (the jammed airport itself showed as an off-screen chip) and the globe was lit like the
      menu instead of at the final tick; the hook now stays (the paused run advances nothing). Route-end handles are
      hidden at game over (they stayed pinned on screen), and Undo / aircraft drops are ignored on the game-over screen.
      320×568: the sign keeps its height with the tab (title 17 px). Store PNGs refreshed. `e2e/gameover-map.mjs`
      (`test:e2e:gameover-map`, in `test:ci`).
- [x] N11d **Edge chips show how full the off-screen airport is** — `ui:long-play` EN 915×412 4× 10 min (3 runs, max
      week 1, issues=0) ended both game overs at ABJ, an airport off the screen: its edge chip showed only "← ABJ" until the
      waiting area was already full (red chip, 45 s of grace), while an on-screen airport shows its waiting passengers on
      the tag. The chip now carries a gauge under the code: an outlined track whose ink fill is the share of waiting
      places taken (a length, readable without colour; min 8 % so one passenger shows), signal red from three quarters
      full, hidden while nobody waits; the chip's label adds "12 of 24 waiting places taken" / "Zajęte miejsca
      w poczekalni: 12 z 24". Chip size and tap target unchanged; works with the NEW (ink) and curfew (striped) chips.
      DEV `aw.state().airports` (waiting, capacity). Also recorded the owner's answers Q-37…Q-40 as D-82…D-85.
      `e2e/edge-chip-fill.mjs` (`test:e2e:edge-chip-fill`, in `test:ci`; 0/4 on the old overlay).

## Continuous development round N12 (agent 2)
- [x] N12a **Balance bot plays for reach (D-90)** — the handover gap "the DEV bot rarely connects new airports; long
      plays end in weeks 1–3": measured, 34 of 44 bot game overs (50 seeds) were at an airport no route served, 20 of
      them more than 2,500 km from every other airport. The bot never took a widebody (a turboprop-only network has no
      "long route", so the turboprop always won the board) and paired an unserved airport only with a served one. It
      now values the widebody when its fleet has none or an airport is out of turboprop reach, and pairs two unserved
      airports beyond the network with each other. Unserved game overs 34/44 → 7/40; `test:balance` median 14.55 →
      17.81 min (still 10–18, near the top: Q-51), median weeks 2.02 → 2.47, boards 86/50/22 → 88/56/36 %. The 5 runs
      still lost in week 1 at a far airport cannot be answered by anyone (no widebody before the first board) → Q-51.
      Up to the week-1 board the bot plays as before (seed 0xA1A1 journal identical), so `ui:matrix`, smoke and store
      shots are unchanged. No game parameter changed. `test:bot-policy` +4.
- [x] N12b **iOS store plist keys (R1c, D-91)** — `Info.plist` gained `ITSAppUsesNonExemptEncryption = false`
      (HTTPS only, exempt: no export-compliance prompt per upload) and `CFBundleLocalizations = [en, pl]` (App Store
      language list; WKWebView reports only declared languages, so a Polish iPhone can start in Polish). Three new
      `test:ios-config` checks: the encryption key, the localizations equal to the `src/i18n/<xx>.ts` catalogs, and the
      development region is one of them (21/23 on the old plist, 23/23 now). Also removed stray merge-conflict markers
      left in `docs/DECISIONS.md` around D-82…D-85 on `dev`. `docs/IOS.md`, `docs/TESTING.md`.

## Research proposals (R-agent)
Proposals from the research agent (findings and sources: `docs/RESEARCH.md`, sections "R1 — …"). Each item is
sized for one PR; **Area** says where it lands so the coordinator can route it. Items marked *needs Q-xx* wait for
the owner's answer in `docs/OWNER-QUESTIONS.md`. Tick and log like the N items.

### R1 (2026-11-03) — release readiness, accessibility/localisation, onboarding
- [ ] R1a **In-app deletion of leaderboard data** — Apple 5.1.1(v) requires deletion to start in the app and
      explicitly covers auto-created guest accounts; e-mail only (D-77) is not accepted outside regulated industries.
      Settings row "Delete my ranking data" (shown once an anonymous identity exists): confirm sheet → callable
      `deleteMyData` removes every `entries` doc of the caller's uid (daily + weekly) and deletes the anonymous Auth
      user; client clears identity, call sign and offline queue (`aw-net-queue-v1`). Offline: say it needs a
      connection, never fake success. Keep the e-mail path as the web resource for Google. Tests: `test:net-server`,
      `test:firebase` (emulator: entries and user gone, second call idempotent), e2e on the settings row; update
      `docs/legal/leaderboards-privacy.md` and `docs/FIREBASE.md` step 9. **Area:** `functions/`, `src/net/**`,
      `src/ui/settings/**`, i18n. *Needs Q-41.*
- [ ] R1b **Privacy policy reachable in the app** — Google's User Data policy wants the policy inside the app when
      user data is handled; there is no "privacy" string in `src/` today. Settings/licences gain a "Privacy" row that
      opens the policy (bundled offline copy of `site/privacy.html` content as an in-app page, PL/EN, plus the public
      URL once D-67 publishes the site). **Area:** `src/ui/settings/**`, i18n, `site/` (shared text source).
- [x] R1c → N12b **iOS store plist keys** — add `ITSAppUsesNonExemptEncryption = false` (HTTPS only, exempt; avoids the
      export-compliance prompt on every upload) and `CFBundleLocalizations = [en, pl]` (App Store lists the game's
      languages from the bundle). `test:ios-config` asserts both. **Area:** `ios/App/App/Info.plist`, scripts.
- [ ] R1d **Android per-app language** — `res/xml/locales_config.xml` (en, pl) and `android:localeConfig` so
      Android 13+ shows Airway in system per-app language settings; check on a device that the WebView's
      `navigator.languages` follows the per-app locale (uncertain) and that the in-game language setting still wins
      (D-31). `test:android-config` asserts the config. **Area:** `android/`, `src/i18n/index.ts` only if needed.
- [ ] R1e **Saves survive a phone change (Android backup)** — `android:allowBackup="false"` loses the save,
      logbook, streak and settings on a new phone. Enable Auto Backup with `dataExtractionRules`
      (Android 12+) / `fullBackupContent` that include saves/settings (Filesystem `Directory.Data`, Preferences) and
      exclude the leaderboard identity/token and the net queue (a restored phone gets a new anonymous identity).
      Document the iOS side (Filesystem `Directory.Data` maps to Documents, which iCloud backs up — verify).
      **Area:** `android/app/src/main/**`, `docs/ANDROID.md`, `docs/IOS.md`.
- [ ] R1f **Privacy declarations for the leaderboard build** — new `docs/store/privacy-declarations.md`: exact
      Google Play Data safety answers and App Store App Privacy answers for (A) build without Firebase config and
      (B) with leaderboards (User ID / "Device or other IDs" pseudonymous, gameplay content = command journal and
      score; purpose App functionality + fraud prevention; not shared, not for tracking; encrypted in transit;
      deletion available — R1a; retention 90 days — D-77). Fill `NSPrivacyCollectedDataTypes` in
      `PrivacyInfo.xcprivacy` for (B) and make `test:ios-config` check it. **Area:** `docs/store/`, `ios/`.
      *Needs Q-03.*
- [ ] R1g **Text scale follows the system and goes to 150%** — read Android `fontScale` / iOS Dynamic Type once on
      first launch to preset `textScale` (explicit choice still wins), add a 150% step where layouts allow; run
      `ui:matrix` and `screens-fit` at 150% and fix overflow. Do not claim Apple's "Larger Text" label (needs ≥ 200%).
      **Area:** `src/ui/settings/**`, `src/ui/a11y.ts`, `src/platform/**`, CSS.
- [ ] R1h **"Reduce motion" setting in the game** — today only the flap and game-over read
      `prefers-reduced-motion`. A settings switch (default from the OS) that also stills the menu globe rotation, camera
      fly-tos (cut instead of pan), stamp-ins and the new-airport stub; one `reducedMotion()` helper used everywhere.
      Prerequisite for declaring Apple's "Reduced Motion" label. **Area:** `src/ui/**`, `src/render/camera*`, settings,
      i18n.
- [ ] R1i **Accessibility label evidence sheet** — `docs/store/accessibility.md`: per Apple label (Differentiate
      Without Color Alone, Sufficient Contrast, Reduced Motion after R1h) the common tasks checked, the tests that
      prove it (`test:cvd`, contrast tokens, screenshots) and what we do **not** claim (VoiceOver, Larger Text, Dark
      Interface) with the reason; short PL/EN accessibility paragraph for the store descriptions. **Area:** `docs/store/`.
- [ ] R1j **One tip on the game-over report** — the report says why the network closed but not what to change.
      Map each cause from the ledger to one matter-of-fact tip (hub overflow → hub expansion or a second hub; region
      without a route → connect it; slot wait → "+2 slots" or spread departures; unserved airport → route to it),
      shown as one line under the cause, only in the player's first ~10 runs (count from the logbook), never during
      play. PL/EN with plural tokens; `test:format`, game-over DOM test, shots. **Area:** `src/ui/gameover/**`, i18n.
- [ ] R1k **Store listing localisation, wave 1** — DE, FR, ES, PT-BR store texts from `docs/store/en.md` (title
      within 30 chars, short description 80, keywords) stating the game is in English and Polish until the game
      itself is translated; mark every text "needs native review". **Area:** `docs/store/`. *Needs Q-43.*
- [ ] R1l **Release checklist** — `docs/RELEASE.md`: one list from RESEARCH R1 (accounts, closed test 12×14, privacy
      URL, Data safety, App Privacy, IARC/Apple age questionnaire, DSA trader status, export compliance, accessibility
      labels, store shots per Apple device class, version bump in both native projects) with owner/agent and a link
      to the decision or question for each line. **Area:** `docs/`.
- [ ] R1m **Store-requirement guards in the config tests** — `test:android-config` fails when `targetSdkVersion`
      < 36 (Play rule from 31.08.2026; bump yearly) and `android:aab` checks the bundle for native libraries not aligned
      to 16 KB (`zipalign -c -P 16` or `bundletool` dump), reporting "no native libs" when there are none.
      **Area:** `scripts/`, `android/`.
- [ ] R1n **Run milestones in Endless** — give a first run intermediate goals without changing the sim: milestones
      read from the sim view (first hub, every region served, week 2/3/5 reached, 500/1 000 passengers) shown as a
      short "milestones" row on the game-over report and counted in the logbook ("first reached in run N"). Presentation
      only (D-13), no new rules, no rewards. **Area:** `src/game/**` (pure milestone check), `src/ui/gameover/**`,
      `src/ui/logbook/**`, i18n.
- [ ] R1o **Closed-test protocol and local logbook export** — `docs/PLAYTEST.md` (what testers do on days 1–14,
      what we ask, PL/EN feedback questions) and a "Copy summary" action (release builds too) in the logbook
      that copies a plain-text summary (runs, lengths, weeks reached, tutorial finished, dailies played) for the tester
      to paste into feedback — no network, no analytics (D-16). **Area:** `docs/`, `src/ui/logbook/**`, i18n.

### R2 (2026-11-03) — store page & ASO, launch marketing, gameplay depth
- [ ] R2a **Store shots in Apple and 16:9 sizes** — Apple requires iPhone 1320×2868 (or 1206×2622) and iPad 13"
      2064×2752; Play's large-screen promotion wants 9:16 or 16:9 (our foldable 4:5 and tablet 3:4 do not qualify).
      Add device profiles to `scripts/store-shots.mjs`: `iphone` 440×956 @3, `ipad` 1032×1376 @2, `landscape`
      960×540 @2 (1920×1080, game in landscape HUD); keep the existing three. Update the manifest, contact sheet,
      `test:store-shots` count and `docs/store/README.md` (which file goes to which console slot). Inspect every PNG.
      **Area:** platform/scripts (`scripts/store-shots.mjs`, `docs/store/`).
- [ ] R2b **Store preview video from real play** — `npm run store:video`: the DEV autoplay bot on seed 0xA1A1 played
      through deterministic steps, frames captured with Playwright screenshots (not screen recording) at 30 fps and
      encoded with ffmpeg to H.264: iPhone 886×1920, iPad 1200×1600, Play 1080×1920; 20–28 s; gameplay in the first
      second (route drawn, plane departs, dusk crosses the network, weekly crates, a hub near jam); no text, no music
      bed beyond game audio (optional), poster frame at 5 s. Output in `docs/store/video/` (git-ignored if > 10 MB,
      recorded in a manifest). **Area:** platform/scripts. Owner uploads to YouTube (*needs Q-49*).
- [ ] R2c **Keywords without repeats + Play alt texts** — App Store indexes name + subtitle + keywords together, so
      `globe`, `routes`, `hub` (EN) and `globus`, `trasy`, `hub` (PL) are wasted. Proposed EN (96 chars):
      `airline,airport,flight,plane,aircraft,network,transfer,strategy,puzzle,logistics,travel,earth,3d`; PL (≤ 100,
      check byte vs char count in App Store Connect): `linie lotnicze,lotnisko,lot,samolot,sieć,przesiadka,strategia,logiczna,zagadka,ziemia,podróż,3d`.
      Rename "captions" in `en.md`/`pl.md` to **Play alt text** (one unique line per screenshot, ≤ 140 chars, no "image
      of"); note that App Store has no caption field. Consider "puzzle" in the Play short description (80 chars).
      **Area:** docs (`docs/store/`).
- [ ] R2d **Play feature graphic 1024×500** — required to publish on Google Play; also the cover of the preview
      video (play button drawn in the centre). Render it from the real game (store-shot `game` scene at dusk, network
      centred, wide landscape viewport 1024×500 @1 and @2 then downscale) with the "Airway" wordmark in the game font
      on the left third; avoid pure black/dark-grey fields (Google's rule — the night scene is unsuitable). Add to
      `store:shots` checks (exact size, no alpha, centre band not empty) and an alt text (≤ 140 chars) PL/EN.
      **Area:** platform/scripts + docs (`scripts/store-shots.mjs`, `docs/store/`, `docs/ASSETS.md` if the wordmark is new art).
- [ ] R2e **Press page on the site** — `site/press.html` (PL/EN, same build and tests as `site/`): fact sheet
      (developer, platforms, release date placeholder, price "no ads, no purchases" wording, languages, contact),
      short and long description from `docs/store/`, 8–10 store shots, the R2b video file, logo/wordmark, one ZIP
      built by `build:site`; no trackers, no forms (D-67 still keeps the site unpublished). `test:site` checks links
      and that the ZIP exists. **Area:** site (`site/`, `docs/SITE.md`).
- [ ] R2f **Launch plan document** — `docs/LAUNCH.md` (Polish, owner-facing): timeline from RESEARCH R2 (T−12 weeks
      closed test + press page; T−10 Apple featuring nomination; T−8 iOS pre-order and Play pre-registration ≤ 90 days,
      no reward because D-16 has no IAP; T−4 builds to creators under embargo; T launch "Opening week" Apple in-app
      event; T+6 puzzle update + second event), showcase dates (Big Indie Pitch Mobile 18.01.2027, Digital Dragons
      2027 TBC), creator list template (name, channel, audience, contact, status), and the rule "never write free/
      price in event or graphic text". Link it from `docs/RELEASE.md` once R1l exists. **Area:** docs. *Needs Q-48.*
- [ ] R2g **Choose the home region in Endless** — menu option on the Endless entry: Random (default, today's
      behaviour) or one of the regions; maps to `Scenario.startCityIds`/spawner centre for the start cluster only.
      Daily and leaderboards unchanged; the choice is stored in `GameConfig` (save version bump, D-76 replay) and
      shown on the game-over report and logbook. Bot check: `test:balance` per region, flag regions whose median
      leaves 10–18 min (D-79). **Area:** sim/content (`src/sim/scenarios.ts`, `src/sim/world.ts`) + UI (menu), i18n.
      *Needs Q-50.*
- [ ] R2h **Licence classes (difficulty tiers) for Endless** — class I = today; class II unlocks after reaching week 5
      once (curfew from week 2, reserve 3 turboprops); class III after week 5 in class II (hub capacity −6, curfew city
      count +2). Only scenario knobs, no new rules; logbook stores the best week per class; the menu shows the class as a
      licence stamp. `test:balance` per class (II/III medians reported, not gated). **Area:** sim/content
      (`src/sim/scenarios.ts`, params) + UI (menu, logbook), i18n. *Needs Q-50.*
- [ ] R2i **Announced demand surge** — from week 3, one open city per week announces a surge a game day ahead
      (e.g. ×2 demand from that city for 6 local hours); drawn in the world as a pennant/board at the airport with the
      local time, and on the edge chip when off-screen. Deterministic via a new RNG stream; versioned params; replay and
      save-golden tests; bot medians stay in 10–18 min. **Area:** sim (`src/sim/demand.ts`, `spawner.ts`, params) +
      render/HUD overlay, i18n. *Needs Q-50.*
- [ ] R2j **Weather front** (post-launch update candidate) — a slow cloud band crossing the globe lowers departure
      slots by 1 for airports under it; visible hours ahead as a darker deck of the existing Diorama clouds with a
      shape-coded edge (not colour only). Sim owns the front path (deterministic), render only draws it. Needs perf
      check on low preset (D-73). **Area:** sim (`src/sim/schedule.ts`, new `weather.ts`) + render (clouds). *Needs Q-50.*
- [ ] R2k **Weekly contract** — the weekly board shows, beside the three crates, one optional contract (deliver N
      passengers between two named regions this week); fulfilling it adds a fourth crate next week. Sim tracks it from
      the ledger; drawn as a freight waybill on the board, progress on the pause sheet. Do after the closed test if
      testers report "no goal". **Area:** sim (`src/sim/upgrades.ts`, ledger) + UI (weekly board), i18n. *Needs Q-50.*

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
- 2026-11-03 · N10n logbook (run statistics) · night/10n-logbook · test:fast 57/57 (test:logbook 8/8), build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, test:e2e:logbook 4/4
- 2026-11-03 · N10o store shots refreshed (service row, N10m game-over row) · night/10o-store-shots · store:shots captured=30 failed=0, test:fast 57/57 (test:store-shots 30/30), build ok
- 2026-11-03 · N10p pseudo-locale audit + cargo kicker wrap · night/10p-pseudo-locale · test:fast 57/57, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, e2e:board-short 4/4, test:e2e:pseudo-locale 21/21 (18/21 before the kicker fix)
- 2026-11-03 · N10q pseudo-locale on the in-game HUD + pass label/board head wrap · night/10q-pseudo-hud · test:fast 57/57, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, test:e2e:pseudo-locale 27/27 (21/27 before the wrap)
- 2026-11-03 · N10r end-of-run timeline tab · night/10r-run-timeline · test:fast 58/58 (test:run-timeline 5/5, 4/5 with the rejection filter off), build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:gameover-short 4/4, e2e:pseudo-locale 27/27, test:e2e:run-timeline 4/4
- 2026-11-03 · N10s store shots refreshed (game-over tabs) · night/10s-store-shots · store:shots captured=30 failed=0, test:fast 58/58 (test:store-shots 30/30), build ok
- 2026-11-03 · N10t timeline from live command outcomes · night/10t-timeline-cache · test:fast 58/58 (test:run-timeline 9/9), build ok, e2e:smoke 9/9, test:e2e:run-timeline 4/4; ui:matrix not run (no visual change)
- 2026-11-03 · N10u overlay tags reuse glyph nodes · night/10u-overlay-perf · test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:transfer-glyphs 2/2, e2e:new-airport 4/4, e2e:curfew-barrier 2/2, perf:overlay mismatched=0 (40/40 with stale-child removal off), 40-airport frame 0.96–1.03 → 0.76–0.81 ms (5 changes), 3.8 → 2.6–2.9 ms (40)
- 2026-11-03 · N10v long play 1280×800 PL / 412×915 EN 4× + edge chips clear of airports · night/10v-edge-chips · ui:long-play PL runs=4 maxWeek=1 issues=0, EN runs=2 maxWeek=3 issues=1 (fixed); test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:edge-dock 3/3, e2e:upgrade-picks 10/10, e2e:new-airport 4/4, test:e2e:edge-chip-airports 2/2 (1/2 on the old overlay)
- 2026-11-03 · N10w next puzzle after a clear · night/10w-next-puzzle · test:fast 58/58, build ok, test:e2e:puzzles 34/34 (3/34 passed, failing at puzzle 01, on the old screen), test:i18n keys=378; e2e:smoke/ui:matrix not run (puzzle screen only)
- 2026-11-03 · N10y puzzle board opens where the player is · night/10y-board-scroll · test:fast 58/58, build ok, test:e2e:puzzle-board-scroll 12/12 (3 runs; 3/12 on the old board), e2e:puzzles 34/34; e2e:smoke/ui:matrix not run (puzzle board only)
- 2026-11-03 · N10x long play 800×1280 PL 4× + edge buttons on the portrait Fold dock · night/10x-fold-dock · ui:long-play runs=2 maxWeek=3 issues=0; test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:e2e:edge-dock 5/5 (3/5 on the old session), e2e:edge-chip-airports 2/2, e2e:continue-framing 2/2, store:shots 30 (test:store-shots 30/30)
- 2026-11-03 · N10z edge chips clear of airport tags · night/10z-chip-tags · test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:edge-dock 5/5, e2e:edge-chip-airports 2/2, e2e:upgrade-picks 10/10, test:e2e:edge-chip-tags 6/6 twice (4/6 on the old overlay)
- 2026-11-03 · N11a no globe frames behind opaque pages · night/11a-covered-pages · test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:tutorial 21/21, e2e:screens-fit 18/18, e2e:logbook 4/4, e2e:settings-groups 4/4, e2e:puzzle-board-scroll 12/12, test:e2e:covered-pages 2/2 ×3 (0/2 before)
- 2026-11-03 · N11b unserved game-over board + no record for 0 · night/11b-unserved-board · ui:long-play EN 673×841 2× runs=3 maxWeek=1 issues=0; test:fast 58/58 (test:causes 6/6), build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:gameover-short 4/4 (2/4 before the short-phone hint rule), e2e:run-timeline 4/4, e2e:pseudo-locale 27/27, e2e:daily-share 4/4, e2e:logbook 4/4, test:e2e:gameover-unserved 4/4
- 2026-11-03 · N11c game-over map view + live tags at game over · night/11c-gameover-map · test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:hud-targets 300/300, e2e:gameover-short 4/4 (2/4 before the 320 sign rule), e2e:run-timeline 4/4, e2e:daily-share 4/4, e2e:gameover-unserved 4/4, e2e:pseudo-locale 27/27, test:e2e:gameover-map 3/3, store:shots 30 (test:store-shots 30/30)
- 2026-11-03 · N12a balance bot plays for reach (D-90) · night/12a-bot-expansion · test:bot-policy 10/10 (6/10 on the old bot; 20 seeds unserved jams 14/18 → 4/16), test:balance median 14.55 → 17.81 min upgrade1 0.86 → 0.88 upgrade2 0.50 → 0.56, test:fast 58/58, build ok, bot-driven e2e past week 1: gameover-unserved 4/4, gameover-map 3/3, gameover-short 4/4, run-timeline 4/4, upgrade-picks 10/10, curfew-barrier 2/2, logbook 4/4, pause-summary 4/4, transfer-glyphs 2/2, board-short 4/4, pick-sign 10/10, edge-chip-tags 6/6, edge-chip-airports 2/2; smoke/ui:matrix/store:shots not run (bot unchanged up to the week-1 board)
- 2026-11-03 · N11d edge-chip waiting gauge + owner decisions D-82…D-85 · night/11d-edge-gauge · ui:long-play EN 915×412 4× 10 min runs=3 maxWeek=1 issues=0; test:fast 58/58, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:edge-chip-tags 6/6, e2e:edge-dock 5/5, e2e:edge-chip-airports 2/2, e2e:curfew-barrier 2/2, e2e:new-airport 4/4, test:e2e:edge-chip-fill 4/4 (0/4 on the old overlay), store:shots 30 (test:store-shots 30/30)
- 2026-11-03 · N12b iOS store plist keys (R1c, D-91) · night/12b-ios-plist-keys · test:ios-config 23/23 (21/23 on the old plist), test:fast 58/58, build ok; e2e/ui:matrix/store:shots not run (no web code changed)

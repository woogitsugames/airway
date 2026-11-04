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

- [x] N11e **Privacy policy reachable in the app (R1b, D-86)** — there was no "privacy" string in the game. Settings →
      Help gains "Privacy policy / Polityka prywatności" (≥ 48 px, under the licences); it opens an in-app page with the
      text of `site/privacy.html` (title, draft warning, five sections, date) in the player's language, offline, Back and
      hardware back/Escape return to settings, the globe does not draw behind it. The game catalogs copy the site's
      `privacy.*` strings and `test:privacy-text` (in `test:fast`) fails when they drift from `site/i18n.js`. No public
      URL until D-67; the leaderboard section of the policy waits for Q-56. The licences row got a test id
      (`e2e/covered-pages.mjs` clicked "the last Help button", which is now the privacy row). `e2e/privacy-page.mjs` (`test:e2e:privacy-page`, in `test:ci`; 0/4 on the old settings).

- [x] N11f **One tip on the game-over report (R1j, D-87)** — the report said why the network closed but not what to
      change. In the player's first 10 logged flights it now ends the causes with one "TIP / WSKAZÓWKA" line chosen by
      the leading cause (hub overflow → "Expand hub" or a second hub, regional demand → a route to that region, no
      route → a route for every region, seats → a second aircraft or a widebody, transfers → "Expand hub", slot wait →
      "Departure slots"); none in puzzles, none at an unserved airport (the N11b hint says it), the Timeline tab hides
      it. Short portrait phones and short landscape keep only the leading cause with the tip (the report scrolled
      48–64 px otherwise). Pure `src/game/gameoverTip.ts` + `test:gameover-tip` (in `test:fast`), DEV preview shows the
      tip, `e2e/gameover-tip.mjs` (`test:e2e:gameover-tip`, in `test:ci`; 1/4 on the old report).

- [x] N11g **"Reduce motion" setting in the game (R1h, D-88)** — only the split-flap, the game-over board and a few
      stylesheets read `prefers-reduced-motion`, each on its own, and a player could not choose. Settings → Display
      gains "Reduce motion / Ogranicz ruch" (switch ≥ 48 px + one hint line). It starts at the system setting (and
      follows system changes) until the player touches it; the choice is saved in `airway.settings` and wins both
      ways. One helper `reducedMotion()` (`src/ui/motion.ts`) now drives the split-flap cascade, the game-over camera
      (cut instead of the pan), the menu globe turn (D-62 → 0°/s) and, through the root attribute
      `data-airway-motion`, every CSS animation (stamp-in, NEW stub, jam pulse, upgrade slip, tutorial guide, HUD
      transitions); no stylesheet reads the media query itself any more. Globe drag/flick and flying planes stay.
      `test:motion` (in `test:fast`, 0/8 on the old code), `e2e/reduce-motion.mjs` (`test:e2e:reduce-motion`, in
      `test:ci`, 0/3 on the old settings), `test:e2e:settings-groups` counts the new row; `test:flap` now loads
      `flap.ts` through the TS test loader. E2E pages keep emulating a reduce-motion system, so their PNGs are
      unchanged except the settings shots.
- [x] N11h **WebGL context loss and "no WebGL 2" page (R3g, D-118)** — nothing listened to `webglcontextlost`: on a
      GPU reset the globe froze or went blank while the run kept going underneath. `src/render/contextGuard.ts` keeps
      the lost state (`preventDefault`, so the browser restores); while lost the renderer draws nothing, the world
      loop does not call the run's frame hook (same tick and state hash), the blank canvas is hidden and one paper
      notice (`role="status"`, PL/EN "Graphics are restarting…") stands over the sky; on restore the quality profile,
      lights and size are re-applied, the notice goes and the run carries on. No WebGL 2 → a plain settings-paper page
      ("This device's graphics are not supported" + the renderer string for a support mail) instead of a blank sky.
      `test:webgl-context` (in `test:fast`, 4/8 with the wiring reverted), `e2e/webgl-context.mjs`
      (`test:e2e:webgl-context`, in `test:ci`, 0/4 on the old code), shots `docs/shots/n11h/`.
- [x] N11i **Pause when the window loses focus (D-99 / Q-59 → B, D-119)** — in split screen or a floating window the
      page stays visible, so the run kept going (and a hub could jam) while the player typed in the other app.
      `GameLifecycle` now treats a window `blur` like a hidden tab: pause sheet + save, the globe keeps drawing; focus
      coming back leaves the sheet up until the player taps Resume. One pause and one save for blur + hidden, focus
      while hidden ignored. The lifecycle hooks pause only the `game` screen (the upgrade picker is not covered).
      `test:saves` +2 cases (11/13 on the old code), `e2e/focus-pause.mjs` (`test:e2e:focus-pause`, in `test:ci`,
      1/3 on the old code), shots `docs/shots/n11i/`.
- [x] N11j **Pause-summary e2e green again; old-rules save notice (D-132)** — since rules v5 (N12f) `autoplay(2)` on
      seed 0xA1A1 ends in a game over in week 2, before the week-2 board, so `test:e2e:pause-summary` failed 0/4 on
      `dev`. The bot now plays to the week-1 board (asserted), one pick (not hub/slots) puts the flight into week 2
      (asserted from the tick and the next board), then the same checks as before: three rows, sheet in the viewport,
      clear of the boarding pass, nothing clipped, three ≥ 48 px buttons. Also: a v4 save the v5 rules cannot continue
      showed "The saved flight is damaged"; it now says "Saved flight from an older rules version: the current rules
      cannot continue it." (PL/EN, `old-rules` notice). `test:save-golden` +1 (fails on the old code),
      `test:e2e:save-notice` +2 steps with the frozen v4 save (4/6 on the old code). Owner answers Q-61/Q-62 recorded
      as D-128/D-129.
- [x] N11k **Clean game-over report (R5f)** — over the report the off-screen edge chips (REK, DUB, VLC…) and the tag
      dock stayed on top of the dim and looked tappable, and an unserved-airport board printed the "FLIGHT / DEST ·
      GATE · STATUS" headings above a sentence with no rows (an unfinished table). While the report is open its host
      carries `data-gameover-report` and edge chips and the dock are hidden (the boarding pass stays); the "Map" view
      brings both back, "Back to report" hides them again. Column headings only above real departures. Also: since
      rules v5 the "served hub" case of `test:e2e:gameover-unserved` failed on `dev` (seed 0xA1A1's bot run now ends
      at unserved RIO); it plays seed 0xA1A3 (jams at served SEL, 2 rows). Owner answers Q-63/Q-64 recorded as
      D-130/D-131 (the N11j decision renumbered to D-132). `e2e/gameover-unserved.mjs` asserts both (0/4 on the old
      UI), shots `docs/shots/n11k/`, matrix and store failure shots refreshed.

- [x] N11l **Training flight on the Fold: hint gap, one-shape tags, night only on the globe (owner, D-180)** — owner
      screenshots from a Galaxy Fold (unfolded): the hint line ("Drag the tag onto the route marker", "Simulation
      paused…") overlapped the ATC card's bottom edge (the world was sized from `100dvh − 308 px`, blind to the status
      and gesture bars); the TURBOPROP tag and "Watch the sunrise" had a stepped notch that read as a second button
      behind; on the night step a dark rectangle stuck out beyond the globe over the header. The world is now fitted
      to its row by a `ResizeObserver`, the hint has its own gap, action tags use the dock's luggage-tag outline, and
      night darkens only the globe. `e2e/tutorial-layout.mjs` (`test:e2e:tutorial-layout`, in `test:ci`; 0/7 on the
      old tutorial, the Fold case with status/gesture-bar padding), shots `docs/shots/n11l/`.

- [x] N11m **Airport code plates on the globe (D-128 → D-181, R5a)** — owner's Fold screenshot: in game no airport
      had a code or name, and a pink "⋈⋈⋈" tag (Middle-East passengers) sat next to a disc nobody could name. The luggage
      tag now carries a code plate (code or name per D-68, departure-board mono) before its glyphs; with nobody waiting
      the tag is the plate alone. At the gameplay zoom (the run's opening view) every on-screen airport has one; zoomed
      out to the whole network only hubs and named airports (jam, NEW, slot hold, curfew). Plate-only tags are placed
      after passenger tags (`layoutTags`), so they never push a passenger tag off. G9 (#158) only restyles the 3D
      airport objects (DEV `?airportStyle=`); the plates are DOM and independent of it. `e2e/airport-plates.mjs`
      (`test:e2e:airport-plates`, in `test:ci`), `test:overlay-layout` +2, DEV `aw.state().airports[].hub`, shots
      `docs/shots/n11m/`.

- [x] N11n **Opaque empty dock tags (R5d, D-182)** — owner's Fold screenshot and R5: empty dock tags were 42 %
      transparent, so the globe showed through and hid the icon. They are now an opaque muted kraft with muted ink
      (5.1:1, new `test:contrast` pair) and a dashed rack outline (shape cue). `e2e/dock-empty-tags.mjs`
      (`test:e2e:dock-empty-tags`, in `test:ci`; 0/3 on the old tags), dock crops `docs/shots/n11n/`.

- [x] N11o **New-airport and transfer-glyph e2e green again under rules v5/v6 (D-183)** — two suites were red on
      `dev` with unchanged UI. `test:e2e:new-airport` 1/4: since rules v5 an airport opens every 12 game hours
      (`SPAWNER_INTERVAL_TICKS` = `NEW_MARK_TICKS`), so when the first NEW mark expires the next airport opens marked
      and "nothing marked" can never hold, on any seed. Step 2 now follows the first marked airport by
      `data-airport`: still marked 40 ticks before 12 h (new check), unmarked 20 after, and no airport that was
      already open is marked (only ones opened later). `test:e2e:transfer-glyphs` 0/2: `autoplay(2)` on seed 0xA1A1
      ends in a game over before week 2's board; as in N11j the bot plays to the week-1 board (asserted), one plain
      pick puts it into week 2 (asserted), the hollow → filled checks are unchanged. Shots `docs/shots/n10a/`,
      `docs/shots/n10i/` refreshed.

- [x] N11p **Training flight in 3 steps and the game's own marks; first-time cards in the real game (R5b, R6a, R6b;
      D-129, D-130 → D-184, D-190)** — the vignette taught 7 steps with orange diamonds for cities and a teal ring for
      the hub, and on a 412 px phone its planet ran ~11 px past both screen sides. Now 3 steps (route, aircraft,
      transfer; "STEP n / 3"), cities drawn as the game's airport object (pad, runway, terminal; the hub with its
      teal rim and ring of waiting places) under the game's luggage tag (code plate per D-68 + real region glyphs),
      the transfer hint names one glyph ("Crescent = Southern Europe"), the dawn is one sentence on the last step;
      the planet fits inside the art (r 228 → 196). Settings → help gains the 8-row glyph legend (shape + region).
      Upgrades, congestion and the night became one-time cards in the real game (`src/game/tutorial/first-time.ts`
      registry: one versioned key `aw-first-time`, the slot hint keeps its task-32 flag): first hub ≥ 70 % full,
      first airport beyond turboprop range, first curfew night, after the first weekly board. ATC paper strip,
      aria-live polite, 48 px OK, never stops time, one at a time; off in DEV seeded runs unless
      `prepareSeed(seed, { firstTime: true })`. `test:first-time` (fast, 7), `test:e2e:first-time-cards` (ci, 4),
      `test:e2e:tutorial` and `test:e2e:tutorial-layout` updated (night step → cleared step, planet check); shots
      `docs/shots/23/`, `docs/shots/n11l/`, `docs/shots/n11p/`.

- [x] N11q **Quiet route-end handles, never over airport tags (R5c, D-191)** — the yellow 20 px diamonds on every
      route end were the loudest marks on the map and the handle layer (z 18) painted over the luggage tags (z 2).
      At rest a handle is a 10 px hollow ink diamond with a paper halo in the same 48 dp area; the full yellow
      diamond only on the route in hand (dragged from its end, or selected with the long-press menu). The layer
      now paints below the airport overlay. Hit testing in `routeTool` unchanged (`RouteTool.activeRouteId`, the
      `handles` port gets it). `e2e/route-handles.mjs` (`test:e2e:route-handles`, in `test:ci`; 0/2 on the old
      handles), shots `docs/shots/n11q/`.
- [x] N11r **Crate stamps say what they measure; "none yet" for an empty hub; replay brings first-time cards back (R5e,
      D-194; owner Q-76 → B, D-192)** — the red stamps "BEG 9/36" / "BEG 13 min" carry a small caption inside the stamp
      ("fullest hub" / "longest slot wait", PL "najpełniejszy hub" / "najdłuższe czekanie na slot") and the card's aria
      text reads "caption: value"; a hub with nobody waiting reads "none yet" / "jeszcze brak" on the stamp and in the
      pause sheet instead of "MAD 0/36". "Replay tutorial" now also clears the first-time cards (slot hint included).
      `scripts/test-crate-stamps.ts` (`test:crate-stamps`, in `test:fast`; 1/5 on the old cards), `test:pause-summary`
      +1 (5/6 on the old summary), `test:first-time` +1 (7/8 on the old controller); board shots `docs/shots/35`, `37`,
      matrix and store upgrade shots refreshed.

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
- [x] N12c **Saves survive a phone change (R1e, D-92)** — Android Auto Backup on with include-only rules
      (`data_extraction_rules.xml` for 12+, `backup_rules.xml` for 11 and older): Preferences, both save slots and the
      WebView `localStorage` (logbook, streak, settings, puzzle stars, tutorial). The leaderboard token and offline
      queue share that `localStorage`, so `src/platform/install.ts` keeps a never-backed-up install marker
      (`Directory.LibraryNoCloud`) and drops both keys on the first launch without it (restored phone = new
      anonymous player, Q-55). iOS side documented (Documents, Preferences and WebKit are in iCloud backups; marker in
      `Library/NoCloud`). `test:android-config` +4 checks (14/18 on the old manifest), new `test:install-identity`
      6/6 (in `test:fast`). Resources pass `aapt2 compile`; Gradle lint and a device restore could not run here
      (Maven 429, no device) — `docs/ANDROID.md` lists the `bmgr` check.
- [x] N12d **Server replay ends at the game over (R3c, D-97)** — `Sim.replay` kept ticking a finished world up to
      the claimed `endTick`, so a finished daily run sent with `endTick` = 30 weeks replayed a dead world for the
      whole budget and was stored with `weeks: 30`. `verifyDailySubmission` now replays with `stopAtEnd` (new optional
      `Sim.replay` argument; default unchanged for saves/undo/tests) and requires `endTick` to equal the game-over tick
      (`malformed` otherwise; one tick early stays `not_finished`). Honest verdicts, scores and hashes unchanged
      (`test:replay` summary identical, D-13). New `test:replay-cost` (in `test:fast`): 6 bot daily seeds, inflated
      end ticks, empty 30-week claim, cost budgets — measured 30–48 ms per game week (30-week projection ~1.4 s),
      dense 5 000-command journal ~0.2 s. Note: an empty journal never ends (the world waits on the week-1 board),
      so it was already `not_finished`, not accepted as the R3c text assumed.
- [x] N12e **Store-requirement guards (R1m, D-98)** — `test:android-config` now fails when `targetSdkVersion` is
      below Play's floor (`PLAY_MIN_TARGET_SDK` = 36, raise each August) or `compileSdk` < target, and no longer pins
      target/compile to exactly 36 (that blocked the yearly bump). Every `npm run android*` build checks its APK/AAB
      with the new `scripts/native-align.mjs` (pure Node: ZIP directory + ELF program headers): 64-bit `.so` LOAD
      segments ≥ 16 KB, stored APK entries on a 16 KB boundary; release builds fail on a misaligned library, and the
      web-only app reports "no native libs". New `test:native-align` (in `test:fast`) on synthetic bundles, with a
      `zipalign -c -P 16` cross-check when the SDK is installed. `docs/ANDROID.md`.
- [x] N12g **Owner decisions D-93…D-96 recorded** — Q-41 → A (in-app leaderboard data deletion + e-mail web path,
      D-93), Q-42 → B (Play organisation account, D-94), Q-51 → B (week-1 airports within 2,500 km + slightly faster
      pace, D-95), Q-43/Q-44/Q-48 → A (languages wave, worldwide except mainland China, T−12 weeks plan, D-96); marked
      ✅ in `docs/OWNER-QUESTIONS.md`. N12d/N12e's own decisions renumbered D-93/D-94 → D-97/D-98 (docs and code
      comments only).
- [x] N12f **Fair week 1 + faster pace, Alexandria in ME (D-95, D-99, D-105, D-106, rules v5)** — before the first
      weekly board a new airport opens only within turboprop range (2,500 km) of an open airport (weighted draw keeps
      its proximity weights, falls back to the global draw only if nothing is in reach); the start radius is 2,500 km
      (D-105); Alexandria joins Cairo in `ME` (Q-58). The fair week 1 alone lengthened the bot median 17.81 → 24.43 min,
      so the pace rose: spawns every 12 h instead of 16 h and the new `DEMAND_RATE_PERCENT` = 130 (D-106, sweep in
      `docs/balance/README.md`; Q-60). `test:balance` median 17.03 min, boards 100/66 %, week-1 losses at an airport
      beyond reach 5/50 → 0/50 (new `week1_unreachable` gate and CSV column). `RULES_VERSION` 4 → 5,
      `SPAWNER_PARAMS_VERSION` 1 → 2, `CITY_DATA_VERSION` 1 → 2. New `test:week1-reach` (fast, 2/5 on rules v4: 507 of
      1,600 week-1 spawns and 33 start airports beyond reach). Re-locked deliberately: `test:sim-week` hashes and
      failure tick 2619 → 2174 (demand 1.3×), `save-golden` regenerated on seed 0xA1A3 (this simple policy now loses
      0xA1A1 in week 1) plus the frozen rules-v4 save as a D-76 replay check, `test:bot-policy` "+2 slots" check moved to
      seed 0xA1A5 and unserved-jam ceiling 4 → 6 (6 airports a week; measured 6 of 19). Store shots regenerated (seed
      0xA1A1 starts elsewhere: RIX VCE ATH… instead of ATH ZAG ANK…).
- [x] N12h **Six airport codes corrected on screen, city data guard (R4a, R4b test, D-107)** — `City.displayCode`
      (optional) for Kyiv IEV (was KIV, Chișinău's old code), Ho Chi Minh City SGN (HCM), Luanda LAD (LUA = Lukla),
      Lusaka LUN (LUS), Isfahan IFN (ISF), Alexandria ALY (ALX); `displayCode()` in `src/data/index.ts`, read by
      `airportLabel()` (code mode) and so by the airport tags, edge chips and their aria text, the game-over departures
      board and title, timeline picks, upgrade stamps, pause summary, plus the puzzle board codes. Sim ids unchanged:
      `test:replay`, `test:save-golden` and daily hashes identical. New `test:city-data` (fast, 1/5 before): ids frozen
      in order and spelling, display codes 3 capital letters and unique, names, population, on land or ≤ ~30 km from
      the coast of the game's land raster. `test:airport-labels` +1. The R4b "solar time" help line is left to the UI
      agent (settings/help is its area).
- [x] N12i **One top-50 document per board (R3a, D-108)** — `submitDaily` keeps `boards/{id}/meta/top` (≤ 50
      `{uid, callSign, score}`, old query order: score desc, doc id desc) in its transaction, writes it only when the
      run changes the list, and returns `rank` inside the daily top 50; `getBoards` reads 4 documents (two tops, two
      own entries) plus `count()` only outside the top, instead of two 50-document queries (~105 reads). Pre-upgrade
      boards are seeded from the old query at their first write. The top's `expireAt` is fixed at its first write
      (TTL policy on `meta` added), so it never outlives the entries. Pure `mergeTop`/`rankInTop`/`readTopRows` in
      `functions/src/logic.ts`; `docs/FIREBASE.md` (incl. step 9 manual deletion) updated.
- [x] N12j **Per-player rate limit and split function caps (R3b, D-109)** — pure `RateLimiter` (token bucket per
      uid per instance, burst = limit, 10 000 keys LRU) in `functions/src/logic.ts`; `getBoards` 20/min,
      `submitDaily` 6/min, checked after auth and before Firestore/replay → `resource-exhausted`. `FUNCTION_OPTIONS`:
      `getBoards` `maxInstances: 3`; `submitDaily` `maxInstances: 5`, `concurrency: 4`, `cpu: 1` (was one shared
      `maxInstances: 10`, concurrency 80). Client fix found on the way: HTTP 429 counted as a final rejection and
      dropped the run from the queue; it is now `retry`. `docs/FIREBASE.md` updated.
- [x] N12k **In-app deletion of leaderboard data (R1a, D-93, D-114) + Q-60 → D-113** — new callable `deleteMyData`
      (`functions/src/index.ts`): reads every daily/weekly board an entry can still live on (pure `retainedBoardIds`,
      97 days, 113 boards), deletes the caller's entries, removes the uid from `meta/top` (pure `dropFromTop`, a full
      top refilled by the 51st entry), then deletes the anonymous Auth user; idempotent; `maxInstances: 2`, 3/min per
      player. Client `Leaderboards.hasData()` / `deleteMyData()` → `deleted | none | offline | failed`; token and
      queue cleared only after the server's answer. Settings → Help row "Delete my ranking data" with inline
      confirmation (PL/EN), shown only with an identity. New `test:e2e:delete-ranking` (page.route, no emulator).
      `docs/FIREBASE.md`, `docs/legal/leaderboards-privacy.md` updated. Owner answer Q-60 → C recorded as D-113.
- [x] N12l **Android per-app language (R1d, D-115)** — `res/xml/locales_config.xml` (en, pl) and
      `android:localeConfig` so Android 13+ lists Airway under Settings → Apps → Language. `test:android-config`
      +2 checks: the list equals the `Language` type in `src/i18n` and iOS `CFBundleLocalizations`, and the saved
      in-game language is read before the device language (D-31). `aapt2 link` (android-36, minSdk 24) accepts the
      attribute. `docs/ANDROID.md` section "Per-app language" with the device check (does the WebView's
      `navigator.languages` follow the per-app locale — not verifiable here).
- [x] N12m **Budget GPUs start on the low preset (R3f, D-116)** — `auto` quality read only cores and memory, so
      8-core/4 GB budget phones began on `medium`. `readGpuRenderer` reads the unmasked WebGL renderer once (throwaway
      context, released, cached) into `DeviceHints.gpu`; `LOW_GPU_FAMILIES` maps Mali-G52, Mali-G57/G68 MC1–MC2,
      Mali-T8xx, PowerVR GE83xx, Adreno 5xx/610/613 to `low`. Unknown strings keep the old rule; explicit choice and
      remembered adaptation still win. `test:quality` +38 checks; perf note in `docs/PERFORMANCE.md`.
- [x] N12n **Play feature graphic 1024×500 (R2d, D-117)** — `npm run store:feature` renders
      `docs/store/feature-graphic.png` from the real `game` scene (1024×500 @2 → @1, HUD hidden, DEV probe
      `featureView` frames the network right of centre, `brand/wayfinding.svg` on the left third) and writes opaque
      RGB. `test:store-shots` checks size, no alpha, ≤ 15 MB, centre band, dark share ≤ 0.2 and the new PL/EN field
      "Play feature graphic alt text" (≤ 140). Console slot in `docs/store/README.md`, entry in `docs/ASSETS.md`.

- [x] N12o **Store shots in the exact Apple sizes and 16:9 (R2a, D-123)** — `store:shots` gained three device profiles
      next to phone/foldable/tablet: `iphone` 440×956 @3 (1320×2868, App Store iPhone 6.9"), `ipad` 1032×1376 @2
      (2064×2752, iPad 13") and `landscape` 960×540 @2 (1920×1080, Play 16:9 large-screen slot, landscape HUD) → 60 real
      shots. `checkStoreSizes` guards Apple's accepted sizes and Play's 320–3840 px / 2:1 / 9:16 + 16:9 ≥ 1080 rules,
      every shot must be RGB without alpha; contact sheet with six rows per language (landscape thumbnails wider);
      console slot per profile in `docs/store/README.md`.
- [x] N12p **Play device filter for OpenGL ES 3.0 (R3h, D-124)** — three r170 renders only through WebGL 2, which
      Android WebView builds on ES 3.0, so the manifest requires `glEsVersion 0x00030000` and Play hides the game from
      ES 2.0 phones (blank globe). `aapt2 dump badging` of the linked manifest shows `uses-gl-es: '0x30000'`.
      `test:android-config` check `play-gles3-filter` (one required declaration, three ≥ r163, minSdk ≥ 18).
      minSdk stays 24 until Q-54 (both A and B include the filter); note in `docs/ANDROID.md`.
- [x] N12q **Bundle budget, dead code and unused keys, minSdk 29 (R5k, R5i, Q-54 → B; D-133, D-143, D-144)** — new
      `test:bundle` (in `test:ci` after `build`) holds the main chunk ≤ 1,150 kB raw / 340 kB gzip, CSS ≤ 90 kB and
      `dist/` ≤ 2,200 kB (`docs/PERFORMANCE.md` "Bundle budget"; today 1,033.8 / 306.2 / 70.2 / 1,804.8) and prints the
      largest files; `test:bundle:static` (in `test:fast`) forbids a module imported both statically and with
      `import()` — the dynamic `@capacitor/core` imports in `platform/install.ts` / `storage.ts` became static (Vite
      warning gone). R5i: the four never-wired a11y adapters, their 13 keys and `status.loading/ready` removed, plus
      `mountEmptyScene`, `createTerrain`, `AIRPORT_LABEL_MODES`, `dailyGame`; `test:i18n` fails on a catalog key not
      referenced from `src/`. Owner D-133: `minSdkVersion` 24 → 29, guarded by `test:android-config`, `docs/ANDROID.md`.
      CLAUDE.md "30 store PNGs" → 60.
- [x] N12r **Route snap haptic actually fires (R6d, D-137) + owner decisions D-134…D-136** — `@capacitor/haptics`
      8.0.2 drops `selectionChanged()` without `selectionStart()`, so the snap never vibrated. `NativeHapticDriver` and
      `RouteHaptics` gained selection start/end; the route tool opens the selection at pointer-down and closes it once
      on drop, refusal, cancel or undo; a snap outside a drag brackets itself; the switch never leaves a selection
      open. Owner decisions recorded: D-134 (Q-65 A terms + Apple EULA, lawyer review; Q-66 A trader in both stores),
      D-135 (Q-68 A legitimate interest, no age gate, leaderboard toggle R7l), D-136 (Q-67 A, Q-69 A, Q-70 A). Own
      N12q decisions renumbered D-134/D-135 → D-143/D-144.
- [x] N12s **Plural form from the number, no U+202F, glyph coverage test (R7e, R7g; D-145, D-146)** — the plural reader
      took "." as a decimal point, so de/es/pt-BR "1.000" picked the singular and "1.000.000" leaked the token; it now
      reads pre-formatted counts with the active locale's own separators (`parseLocalNumber`, `fillPluralTokens`,
      `pluralFormIn`). `formatNumberIn` maps fr-FR's U+202F to U+00A0; Atkinson text borrows "→" (missing from the
      362-glyph subset, used on the upgrade card) from Overpass via `unicode-range`. New fast `test:glyphs` reads every
      TTF `cmap` + borrowed ranges against the PL/EN catalogs, city/region names, numbers in six locales and the
      PL/EN/DE/FR/ES/PT-BR letter set. PL/EN output unchanged.
- [x] N12t **Sound survives the phone (owner device bug, D-153) + owner decisions D-150…D-152** — no music on the
      owner's Galaxy Z Fold. The tap listener now stays until the AudioContext really runs, re-arms on a system
      suspension and on a lifecycle resume refused outside a gesture; a "running" context with a frozen clock is rebuilt
      with `latencyHint: 'playback'`; the engine clock is the sim tick (cues carry `run.tick`, main.ts passed the world
      minute). `airwayAudioStatus()` + `docs/ANDROID.md` "Sound check" for the device. New Q-75 (menu music / low
      chords). Recorded: D-150 (Q-71 B, R8a), D-151 (Q-72 B, R8c), D-152 (Q-73 C).
- [x] N12u **Unfolded Fold size in the screen matrix (D-154)** — `ui:matrix` 4 → 6 sizes: 904×1088@2 and 1088×904@2
      (Galaxy Z Fold inner screen ~1812×2176 px), 32 → 48 shots, same overlap/scroll checks; `newGamePage` takes a
      DPR. Landscape menu board looks small on the big screen (for agent #1).
- [x] N12v **Rules v6: weekly cards that can act + curfew from week 3 (R8a, R8c; D-150, D-151, D-155)** — "+2 slots"
      enters the draw only after the first departure hold, hub expansion only while a hub exists (the other aircraft
      takes the place); Endless/Daily curfew from week 3. `RULES_VERSION` 6, v5 golden frozen, older saves replayed
      (D-76). Bot median 17.03 → 17.25 min (50 seeds), 16.52 → 16.64 (200); runs with a curfew hold 10 % → 62 %.

## Globe look (D-170)
Owner's choice 2026-11-03: the satellite globe (direction B). Plan, budgets and test lists per step:
`docs/mockups/globe-2026-11/PLAN.md`; the DEV experiment to start from: `?globeLook=satellite`
(`src/render/globe/look.ts`, `dev/globe-look/`). One PR per step, in order; G2+ change the shipped look, so attach
before/after `npm run shots -- globe` PNGs and look at them.
- [x] G1 **Production globe assets** — reproducible bake into `public/data/globe/` (day 4096/2048, night 2048/1024,
      elevation 2048, clouds 2048, ~1.9 MB) with a SHA-256 manifest; NASA/NOAA entries in `docs/ASSETS.md`; credit
      line (PL/EN i18n) on the About page; bundle `total` budget → 4 300 kB (D-171); new fast test `test:globe-assets`.
- [x] G2 **Terrain from ETOPO5 elevation** (one PR with G3: G2 alone draws a white globe; gate + smoke/ui:matrix/store:shots) — production `textured` TerrainStyle: real heights (sqrt exaggeration),
      airport pads flattened, smooth normals, sea floor under the ocean shell; elevation decoded in parallel with the
      land mask; `test:land`/`test:quality`/`test:framing` green, triangle budgets unchanged.
- [x] G3 **Textured surface material and night lights** — Blue Marble by direction (seam-safe), shipped day/night
      grade, Black Marble emission replaces the city-light points; texture size per preset + adaptive step (D-173);
      D-63 golden gate and D-47 contrast ≥ 4.5:1 re-checked (`test:daynight`, `test:store-shots`).
- [x] G4 **Ocean, atmosphere, clouds within fill-rate budget** — glint/fresnel and limb haze folded into the terrain
      shader, outer halo as the only shell on low/saver, cloud shell on medium/high only; `transparentLayers` in
      `world.stats()`; `test:quality`.
- [ ] G5 **Remove diorama decorations and dead code** — trees, rocks, puffy clouds, decor culling (D-75 superseded),
      `relief.ts`, diorama colouring, `refined`/`painted` experiment; new adaptive ladder; PERFORMANCE.md tables.
- [x] G6 **Menu, store, site, style docs** — menu contrast, `store:shots` (60 + feature graphic), `ui:matrix`,
      `shots:site`, `docs/styles/realistyczny.md` (PL), D-11 status note; inspect every PNG.
- [ ] G7 **Performance and device check** — `perf:scene` saver/low/medium/high, `perf:overlay`, hardware checklist
      (GPU memory, first frame, 30 FPS on low); KTX2/ETC1S fallback only if a budget phone fails (D-174 follow-up).
- [ ] G8 **"Mapa" mode next to "Satelita" (D-172)** — second texture set from the owner's chosen map look, uniform
      swap without rebuild, `globeMode` setting (default satellite, PL/EN), dock tag toggle; dock/overlay tests,
      `ui:matrix` at 320 dp. Mapa look: owner's reference (Google-Maps-like) in our own palette (`map-*.jpg`).
- [x] G9 **Airport objects, routes and planes for the new globe (D-175)** — done 2026-11-04: V3 Medalion (D-178), route ink outline, edge probe (D-177) — first 2–3 engine-rendered variants for the
      owner (Satelita + Mapa, seed 15 frame), wait for the owner's pick, then implement with a mode-dependent ink;
      D-47 ≥ 4.5:1 for routes/airports/planes in both modes (`measureLayerContrast`), `store:shots`. Blocked on owner.
      Variants ready: `docs/mockups/globe-2026-11/g9/` (V1 Tusz, V2 Płyta, V3 Medalion — Claude recommends V3);
      the probe must measure edge contrast first (D-177).
- [ ] G9b **Close the D-47 gap after Medalion (D-178)** — airports (probe 2.6–3.2), planes (1.4–3.0) and the Mapa
      tags (1.6) are still under 4.5:1: try a light inner rim on the pad, an ink outline on planes (instanced
      inflated back faces, +1 draw call), a dark cord/shadow under the luggage tags in Mapa; re-measure with
      `node dev/globe-look/shots.mjs --looks=diorama,satellite,map --sizes=phone --play=300`.

## Research proposals (R-agent)
Proposals from the research agent (findings and sources: `docs/RESEARCH.md`, sections "R1 — …"). Each item is
sized for one PR; **Area** says where it lands so the coordinator can route it. Items marked *needs Q-xx* wait for
the owner's answer in `docs/OWNER-QUESTIONS.md`. Tick and log like the N items.

### R1 (2026-11-03) — release readiness, accessibility/localisation, onboarding
- [x] R1a → N12k **In-app deletion of leaderboard data** — Apple 5.1.1(v) requires deletion to start in the app and
      explicitly covers auto-created guest accounts; e-mail only (D-77) is not accepted outside regulated industries.
      Settings row "Delete my ranking data" (shown once an anonymous identity exists): confirm sheet → callable
      `deleteMyData` removes every `entries` doc of the caller's uid (daily + weekly) and deletes the anonymous Auth
      user; client clears identity, call sign and offline queue (`aw-net-queue-v1`). Offline: say it needs a
      connection, never fake success. Keep the e-mail path as the web resource for Google. Tests: `test:net-server`,
      `test:firebase` (emulator: entries and user gone, second call idempotent), e2e on the settings row; update
      `docs/legal/leaderboards-privacy.md` and `docs/FIREBASE.md` step 9. **Area:** `functions/`, `src/net/**`,
      `src/ui/settings/**`, i18n. *Needs Q-41.*
- [x] R1b → N11e **Privacy policy reachable in the app** — Google's User Data policy wants the policy inside the app when
      user data is handled; there is no "privacy" string in `src/` today. Settings/licences gain a "Privacy" row that
      opens the policy (bundled offline copy of `site/privacy.html` content as an in-app page, PL/EN, plus the public
      URL once D-67 publishes the site). **Area:** `src/ui/settings/**`, i18n, `site/` (shared text source).
- [x] R1c → N12b **iOS store plist keys** — add `ITSAppUsesNonExemptEncryption = false` (HTTPS only, exempt; avoids the
      export-compliance prompt on every upload) and `CFBundleLocalizations = [en, pl]` (App Store lists the game's
      languages from the bundle). `test:ios-config` asserts both. **Area:** `ios/App/App/Info.plist`, scripts.
- [x] R1d → N12l **Android per-app language** — `res/xml/locales_config.xml` (en, pl) and `android:localeConfig` so
      Android 13+ shows Airway in system per-app language settings; check on a device that the WebView's
      `navigator.languages` follows the per-app locale (uncertain) and that the in-game language setting still wins
      (D-31). `test:android-config` asserts the config. **Area:** `android/`, `src/i18n/index.ts` only if needed.
- [x] R1e → N12c **Saves survive a phone change (Android backup)** — `android:allowBackup="false"` loses the save,
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
- [x] R1h → N11g **"Reduce motion" setting in the game** — today only the flap and game-over read
      `prefers-reduced-motion`. A settings switch (default from the OS) that also stills the menu globe rotation, camera
      fly-tos (cut instead of pan), stamp-ins and the new-airport stub; one `reducedMotion()` helper used everywhere.
      Prerequisite for declaring Apple's "Reduced Motion" label. **Area:** `src/ui/**`, `src/render/camera*`, settings,
      i18n.
- [ ] R1i **Accessibility label evidence sheet** — `docs/store/accessibility.md`: per Apple label (Differentiate
      Without Color Alone, Sufficient Contrast, Reduced Motion after R1h) the common tasks checked, the tests that
      prove it (`test:cvd`, contrast tokens, screenshots) and what we do **not** claim (VoiceOver, Larger Text, Dark
      Interface) with the reason; short PL/EN accessibility paragraph for the store descriptions. **Area:** `docs/store/`.
- [x] R1j → N11f **One tip on the game-over report** — the report says why the network closed but not what to change.
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
- [x] R1m → N12e **Store-requirement guards in the config tests** — `test:android-config` fails when `targetSdkVersion`
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
- [x] R2a → N12o **Store shots in Apple and 16:9 sizes** — Apple requires iPhone 1320×2868 (or 1206×2622) and iPad 13"
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
- [x] R2d → N12n **Play feature graphic 1024×500** — required to publish on Google Play; also the cover of the preview
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

### R3 (2026-11-03) — leaderboard cost & abuse, closed-test playtest, device coverage
- [x] R3a → N12i **One "top 50" document per board** — `getBoards` reads ~105 documents per call today (two top-50 queries
      plus rank lookups), which is ~95 % of the Firestore bill and the main abuse vector. `submitDaily` keeps
      `boards/{id}/meta/top` (array of ≤ 50 `{callSign, score, uid-hash}`) up to date inside its transaction (read the
      doc, insert, trim, write; only when the new score beats the 50th) and returns the caller's rank in its response;
      `getBoards` reads the two `top` docs plus the caller's own entry, `count()` only when the caller is outside the
      top 50. Same response shape (client unchanged). Emulator test: 60 submissions → `top` equals the old query
      result; read count per `getBoards` ≤ 4 (count via emulator request log). **Area:** platform (`functions/`,
      `scripts/emulator-checks.mjs`, `docs/FIREBASE.md`).
- [x] R3b → N12j **Per-caller rate limit and split function caps** — in-memory token bucket per uid per instance
      (`getBoards` 20/min, `submitDaily` 6/min; over the limit → `resource-exhausted` before any Firestore access);
      `getBoards` `maxInstances: 3`, `submitDaily` `concurrency: 4` (CPU-bound replay must not queue 80 players behind
      one vCPU) with `maxInstances: 5`. Pure limiter in `functions/src/logic.ts` with `test:net-server` cases; the
      client already treats errors as "queued". **Area:** platform (`functions/`).
- [x] R3c → N12d **Replay stops at game over + replay-cost guard** — `Sim.replay` keeps ticking after `status === 'over'`, so
      an empty journal with `endTick` = 30 weeks is accepted with `weeks: 30` (score 0) and costs a full 30-week replay.
      Stop the replay loop at game over (or reject `endTick` more than one tick past the game-over tick as
      `malformed`) and compute `weeks` from the game-over tick. Add `test:replay-cost`: bot daily runs on 6 seeds plus
      a synthetic dense journal near `MAX_JOURNAL_ENTRIES`, prints ms per game week and fails above a budget (e.g.
      ≤ 5 s for the worst case on the CI runner). Check `test:replay` hashes are unchanged for normal runs.
      **Area:** sim (`src/sim/sim.ts` replay only) + net (`src/net/submission.ts`), scripts, `test:fast` list.
- [ ] R3d **Budget alerts and a manual brake** — `docs/FIREBASE.md` step 4 gets exact clicks for a 10 EUR budget with
      50/90/100 % actual and 100 % forecast alerts to the owner's e-mail, and a new "When an alert fires" section:
      check Firestore usage per collection, then set the `LEADERBOARDS_PAUSED` param (firebase-functions `defineBoolean`)
      and redeploy — both functions then answer `{ accepted: false, reason: 'paused' }` / empty boards without touching
      Firestore; the client shows the existing "queued" state. Emulator test for the paused path. **Area:** platform
      (`functions/`, `docs/FIREBASE.md`). *Needs Q-07.*
- [ ] R3e **App Check for the callables** — native attestation (Play Integrity / App Attest) through a Capacitor plugin,
      the token attached as `X-Firebase-AppCheck` by `src/net/client.ts`, `enforceAppCheck: true` on both callables,
      debug provider for emulator/dev builds, Play Integrity quota (10 000/day) noted in `docs/FIREBASE.md`; licence entry
      for the plugin. **Area:** platform (`src/net/**`, `android/`, `ios/`, `functions/`). *Needs Q-53.*
- [x] R3f → N12m **Quality preset from the GPU family** — budget phones (Galaxy A06/A16, Redmi 14C, Moto G) report 8 cores and
      4 GB, so `chooseQualityPreset` starts them on medium and only adaptation (D-73) steps down after visible stutter.
      Read `UNMASKED_RENDERER_WEBGL` once (`WEBGL_debug_renderer_info`, guarded) into `DeviceHints.gpu`; a small table in
      `src/render/quality.ts` maps Mali-G52/G57/G68 MC1–MC2, Mali-T8xx, PowerVR GE83xx, Adreno 5xx/610/613 to `low`
      (explicit choice and remembered adaptation still win). Unit cases in the quality test for each family plus
      "unknown string → today's rule". **Area:** render (`src/render/quality.ts`).
- [x] R3g → N11h **WebGL context loss and "no WebGL 2" screen** — no `webglcontextlost`/`webglcontextrestored` handling exists.
      On loss: pause the game clock (as on `document.hidden`), keep the sim, show a short in-world notice; on restore:
      re-apply the quality profile and redraw. If `WebGLRenderer` cannot be created (no WebGL 2), show a plain PL/EN page
      ("This device's graphics are not supported", with the device's renderer string) instead of a blank canvas. E2E:
      `WEBGL_lose_context.loseContext()`/`restoreContext()` mid-run → game resumes with the same state hash. **Area:**
      render (`src/render/world.ts`) + UI (`src/game/world.ts`, i18n).
- [x] R3h → N12p (filter), minSdk 29 → N12q (Q-54 → B, D-133) **Play device filter for OpenGL ES 3.0** — Three r170 needs WebGL 2; declare
      `<uses-feature android:glEsVersion="0x00030000" android:required="true"/>` so Play hides the game from devices
      that cannot run it, and make `test:android-config` assert it (and the minSdk chosen in Q-54). **Area:** platform
      (`android/app/src/main/AndroidManifest.xml`, `scripts/`). *minSdk part needs Q-54.*
- [ ] R3i **Firebase Test Lab game-loop perf run** — Android `MainActivity` recognises
      `com.google.intent.action.TEST_LOOP`, opens the WebView on the perf scene (or a DEV-free autoplay scenario of the
      real game) for 120 s, and a tiny native bridge writes the existing `.perf/scene.json` fields (frame p50/p95,
      preset, adaptations, renderer string) to the result file URI, then `finish()`. `npm run perf:testlab` prints the
      `gcloud firebase test android run --type game-loop` command for 4–5 low-end models; results table in
      `docs/PERFORMANCE.md`. Spark plan: 5 physical runs/day free. **Area:** platform (`android/`, `scripts/`, docs).
- [ ] R3j **Playtest record in the copied summary** — extends R1o: the logbook keeps, for the last 30 runs, game-over
      cause, real minutes played, upgrade picked each week, tutorial finished, quality preset and adaptation steps, app
      version; "Copy summary" adds one compact line (`AW1:` + base64url JSON, no identifiers) under the readable text.
      `npm run playtest:decode -- file.txt` turns pasted lines into CSV for the decision table in `docs/PLAYTEST.md`.
      Local only, no network (D-16). **Area:** game (`src/game/logbook.ts`), UI (`src/ui/logbook/**`), scripts, i18n.
- [ ] R3k **Closed-test plan, decision rules and production-access answers** — fill `docs/PLAYTEST.md` (with R1o) from
      RESEARCH R3: recruitment mix, 14-day schedule with the day-8 fix release, surveys A/B/C (PL/EN), decision table
      with thresholds written before the test, and an answer sheet for Google's production-access questions (recruiting,
      engagement, feedback summary, changes made, readiness evidence). **Area:** docs. *Needs Q-42, Q-52.*

### R4 (2026-11-03) — real-world data facts, mid-game jam diagnosis, large screens
- [x] R4a → N12h **Correct six airport codes on screen, keep city IDs** — `KIV` (Chișinău's old code, now RMO) for Kyiv,
      `HCM` for Ho Chi Minh, `LUA` (Lukla, Nepal) for Luanda, `LUS` for Lusaka, `ISF` for Isfahan and `ALX` for
      Alexandria are wrong. `City.code` is also the sim ID (saves, logbook, sorted curfew draw, puzzles, golden save), so
      do **not** rename it: add an optional `displayCode` to `City` (`IEV`, `SGN`, `LAD`, `LUN`, `IFN`, `ALY`) and read it
      through `airportLabel()` and every direct `airport.code` use in `src/ui/overlay.ts` (edge chips, aria), the
      game-over departures board and the logbook. Code comment states the rule ("code travellers know from a ticket:
      common city code, else main airport"). `test:replay`, `test:save-golden` and daily hashes must stay unchanged;
      shots of one affected airport. **Area:** content/UI (`src/data/cities.ts`, `src/ui/airportLabel.ts`,
      `src/ui/overlay.ts`).
- [ ] R4b (test part done → N12h; the help sentence remains, UI agent) **City data guard + "solar time" line** — new fast test `test:city-data`: display codes are 3 uppercase
      letters and unique, IDs unchanged against a frozen list (order and spelling, so a rename fails loudly), lat/lon in
      range and on land or within ~30 km of the coast using the existing land mask, PL/EN names non-empty, population
      > 0; add to `test:fast`. Plus one sentence in help/tutorial PL/EN that clocks show solar time, not official time
      zones (D-27 keeps them; it matches the day/night line). **Area:** content/scripts (`scripts/`, `src/data/`) + i18n.
- [ ] R4c **Fill trend chevron on the passenger tag** — when an airport is ≥ 50 % full, a small chevron beside the
      count shows the last game hour's balance (up = more arrived than departed, down = draining, none = steady ±1).
      Computed in `src/game/` from the hourly hub readings already taken for audio cues (no sim change, D-13); shape
      not colour; aria text "filling/emptying"; reduced motion = no animation. Unit test for the trend rule, overlay DOM
      test, shots portrait/landscape. **Area:** UI (`src/game/`, `src/ui/overlay.ts`, i18n).
- [ ] R4d **Hub cause board on long-press** — long-press (or tap when ≥ 70 % full) on an airport opens a small
      departures-board sheet: one row per destination region (glyph, waiting count, one cause mark: no onward flight /
      departures left full in the last hour / waiting for a slot / curfew until 06:00), same wording as the game-over
      causes. Needs a read-only per-hub rolling view (last game hour) derived in the game layer from run events, not
      stored in the sim hash. Sheet fits 360×640 and the landscape dock; 48 dp targets; e2e opens it on a forced jam.
      **Area:** UI (`src/ui/`, `src/game/`), i18n.
- [ ] R4e **Full-departure ticks on route legs** (after the closed test) — a leg whose last three departures from a
      hub left with no free seat gets short cross ticks near that hub for a few seconds; cleared when a departure has
      spare seats. Render-only from plane load events; low preset uses the same line batch. **Area:** render
      (`src/render/` routes) + `src/game/` event mapping.
- [ ] R4f **Large-screen matrix and resize mid-run** — add Google's reference sizes to `ui:matrix` (1024×640,
      1280×800, 800×1280, 841×701, 1600×900) and a narrow window (500×700); new e2e `test:e2e:resize`: start a run,
      resize portrait→landscape→narrow→wide and fold-like 673×841→841×701, assert the state hash, open sheets and the
      camera target survive and nothing overflows (Tier 3 Config_Changes/Config_Combinations). **Area:** platform/scripts
      (`scripts/ui-matrix.mjs`, `e2e/`).
- [ ] R4g **Keyboard and mouse basics** — Space pause/resume, 1/2/3 game speed, +/- zoom, existing Escape/Back;
      `@media (hover: hover)` hover state on HUD buttons and airports; no browser context menu on right-click over the
      globe; shortcuts listed in settings → help (PL/EN). E2E with Playwright keyboard. **Area:** input/UI
      (`src/input/`, `src/ui/`, CSS, i18n). Auto-pause on focus loss done in N11i (D-99, D-119).

### R5 (2026-11-03) — quality audit: first-time player, store reviewer, code health
Evidence: `docs/RESEARCH.md` "R5 — …", PNGs in `docs/research/r5/`.
- [x] R5a → N11m **Airport code plates on the globe** — on-screen airports have no code or name (only off-screen edge chips
      do), yet the pause summary ("Fullest hub JED 3/36"), crate stamps ("BEG 9/36") and the game-over board speak in
      codes. Draw a small Diorama signboard (code, or name per the D-68 setting) beside the airport disc for the
      airports chosen in Q-61, placed with the existing `layoutTags` collision pass (never over a passenger tag or a
      48 dp target); aria unchanged. Overlay DOM test + shots portrait/landscape/320 wide, PL/EN. **Area:** UI
      (`src/ui/overlay.ts`, `overlay-layout.ts`, `src/game/session.ts`). Q-61 → C (D-128): hubs + named airports, all when zoomed in.
- [x] R5b → N11p **Tutorial speaks the game's visual language** — the vignette uses orange diamonds for cities and a teal ring
      for the hub, while in the game airports are runway discs and yellow diamonds are route-end handles
      (`tutorial-vs-game-diamonds.png`); region glyphs are never taught and the game has no legend. Redraw the
      vignette's cities as the game's airport disc, the hub with the game's ring, passengers as the real glyph tag;
      step 3 (transfer) names the glyph's region once ("bow tie = Middle East"); the settings help gains a one-line
      glyph legend (8 glyph + region rows, shape not colour). `test:e2e:tutorial` and its shots updated.
      **Area:** UI (`src/ui/tutorial/**`, `src/ui/settings/**`), i18n. Q-62 → B (D-129).
- [x] R5c → N11q **Route-end handles quieter at rest** — the yellow 20 px diamonds on every route end are the loudest marks
      on the map. At rest draw them as a small hollow marker inside the same 48 dp hit area; full diamond only while
      a route is selected, being drawn, or under the finger. Hit testing in `routeTool` unchanged. Shots; `test:hud-targets`
      / `test:route-tool` unchanged. **Area:** UI (`src/ui/atcStrip.ts`, `atcStrip.css`).
- [x] R5d → N11n **Opaque disabled dock tags** — `.airway-dock__tag.is-empty { opacity: .42 }` lets the world show through;
      at night a cloud hides the turboprop icon (`dock-disabled-night.png`). Use an opaque muted fill plus a dashed
      outline (shape cue for "empty"), keep the count ≥ 4.5:1 against the tag; add the pair to `check-contrast`.
      **Area:** UI (`src/ui/hud.css`, `scripts/check-contrast.mjs`).
- [x] R5e → N11r **Stamps say what they measure** — crate stamps "BEG 13 min" / "BEG 9/36" get a short caption line
      ("longest slot wait" / "fullest hub", PL "najdłuższe czekanie na slot" / "najpełniejszy hub") and the aria
      text; the pause summary shows "none yet" (`pause.summary.noHub`) when the fullest hub has 0 waiting
      (`pause-fullest-hub-0.png`). `test:pause-summary` +1, `test:format`, shots. **Area:** UI
      (`src/ui/upgrade/**`, `src/game/pauseSummary.ts`), i18n.
- [x] R5f → N11k **Clean game-over board** — while the report is open hide edge chips, route handles and the dock (they stay
      on the "Map" view); drop the "FLIGHT / DEST · GATE · STATUS" column header when the departures board has no
      rows (unserved-airport cause shows only a sentence). E2E `gameover-unserved` asserts both; shots PL/EN.
      **Area:** UI (`src/ui/gameover/**`, `src/game/session.ts`).
- [ ] R5g **One word per concept in PL/EN** — weekly reward = "crates / skrzynie" (not "cargo label / etykieta
      frachtowa"; "upgrade / ulepszenie" stays the generic word for what a crate holds), hub = "hub" (not "węzeł", "terminal"),
      network = "sieć" (not "siatka"; game-over title "Sieć zamknięta" to match "Network closed"), "Simulation
      paused" → "Time is stopped / Czas stoi". Add a glossary table to `src/i18n/README.md` (or the top of `en.ts`)
      and a `test:i18n` check that fails on the banned synonyms. Puzzle titles may keep "węzeł" only if the owner
      prefers (say so in the PR). **Area:** i18n (`src/i18n/**`), `scripts/test-i18n.mjs`.
- [ ] R5h **Edge-chip placement as a pure, tested function** — move `distributeEdges` (+ the edge projection) from
      `createAirportOverlay` into `overlay-layout.ts` as `placeEdgeChips(entries, bounds)` with no DOM; unit tests in
      `test:overlay-layout`: jammed chips win space, a chip never covers an on-screen airport (N10v), avoids tags
      when there is room (N10z), deterministic output; a 150-airport case under a time budget (today O(n²·k) per
      frame). No visual change: e2e `edge-chip-*` and shots identical. **Area:** UI (`src/ui/overlay.ts`,
      `src/ui/overlay-layout.ts`, `scripts/test-overlay-layout.mjs`).
- [x] R5i → N12q **Remove dead code and unused keys** — `describeCity`, `createCityAnnouncer`, `bindCityAccessibility`,
      `labelAirportActions` (`src/ui/a11y.ts`, documented only in `src/ui/theme/README.md`) and their 13
      `a11y.city*` / `a11y.action.*` keys; unused exports `createTerrain`, `mountEmptyScene`, `SIM_TICK_MS`,
      `DAYNIGHT_PARAMS_VERSION`, `AIRPORT_LABEL_MODES`, `dailyGame` (check `functions/` first), keys
      `status.loading` / `status.ready`. Add an "every catalog key is referenced" check to `test:i18n` (allow
      template prefixes such as `privacy.s${n}`). `test:fast`, build. **Area:** UI/sim/net cleanup, i18n, docs.
- [ ] R5j **Safe-area tokens everywhere + notch profile** — 56 direct `env(safe-area-inset-*)` uses in menu, upgrade,
      game-over, tutorial, settings, puzzles and ATC strip CSS bypass the `--aw-safe-*` tokens, so only the HUD is
      tested with insets. Replace them with the tokens (menu notice gets a left/right inset in landscape) and add a
      `notch` profile to `ui:matrix` / `screens-fit` that sets the tokens to iPhone-like values (59/0/34/0 portrait,
      0/59/21/59 landscape) and fails on any button inside an inset. **Area:** UI CSS + platform/scripts
      (`scripts/ui-matrix.mjs`, `e2e/screens-fit.mjs`).
- [x] R5k → N12q (WOFF2 fonts not done) **Bundle budget guard** — after `npm run build`, a small `test:bundle` reads `dist/assets`: main JS
      ≤ 1,150 kB raw / 340 kB gzip (today 1,031.9 / 306.2), CSS ≤ 90 kB, total `dist/` ≤ 2.2 MB; prints the top
      chunks. Run it in `test:ci` after the build step. Also drop the useless dynamic `import('@capacitor/core')` in
      `src/platform/install.ts` / `storage.ts` (Vite warns: it is statically imported elsewhere). Optional: serve the
      three fonts as WOFF2 (−~40 %, OFL allows format conversion; update `docs/ASSETS.md`). **Area:** platform/scripts.

### R6 (2026-11-03) — content roadmap, first session on rules v5, haptics/audio on phones
Evidence: `docs/RESEARCH.md` "R6 — …".
- [x] R6a → N11p **First-time cards in the real game** — today only the departure slot has a one-time in-game hint
      (`src/game/tutorial/slot-hint.ts`). Generalise it into a small "first time" registry (one storage key, one
      flag per card, versioned) and add four cards, each shown once per install, never stopping time except where the
      game already pauses: first hub ≥ 70 % full ("bypass it or expand it"), first airport beyond turboprop range
      ("widebody from a crate"), first curfew night (week 4), first weekly board (what a crate is). Text PL/EN,
      ≤ 2 short sentences, Diorama paper style of the slot hint, 48 dp dismiss, aria-live polite, reduced motion
      respected. E2E with a seed that triggers every card + a second run that shows none; shots portrait/landscape.
      **Area:** UI (`src/game/tutorial/**`, `src/game/session.ts`, `src/ui/tutorial/**`), i18n.
- [x] R6b → N11p **Shorter pre-run training** — the vignette teaches 7 steps before the first real run; upgrade and congestion
      happen only after 7.2 min (week 1 at 1×). Keep route → aircraft → transfer in the vignette (dawn becomes one
      sentence on the "Start flying" step), move upgrade and congestion to R6a cards. Bump `TUTORIAL_VERSION` only if
      the stored step list needs it (completed players must not see it again). `test:e2e:tutorial` and its shots
      updated; do it in the same PR as R5b (both redraw the tutorial). **Area:** UI (`src/game/tutorial/**`,
      `src/ui/tutorial/**`), i18n. Q-63 → B (D-130). Depends on R6a.
- [ ] R6c **Empty dock tag counts down to the crates** — in week 1 the dock shows "0 / 0 / 0" for 7 minutes. While
      a tag is empty, its count line reads the arrival of the next weekly board ("crates day 3" / "skrzynie: dzień 3",
      or "tomorrow"/"jutro" on the last day) from the existing week/day clock; aria text the same. No sim change.
      Combine with R5d (opaque empty tags). DOM test + shots night/day. **Area:** UI (`src/ui/hud/**`, `hud.css`), i18n.
- [x] R6d → N12r **Snap haptic actually fires** — `haptic('snap')` calls `Haptics.selectionChanged()` without
      `selectionStart()`; in `@capacitor/haptics` 8.0.2 both Android (`selectionStarted` guard) and iOS (generator
      created only by `selectionStart`) ignore it, so the route snap never vibrates. Call `selectionStart()` when a
      route drag begins and `selectionEnd()` when it ends/cancels (add both to `NativeHapticDriver` and
      `RouteHaptics`, wire from `src/input/routeTool.ts`), or fall back to `impactLight` outside a drag. Unit test
      with a recording driver: start → changed×n → end order, toggle off = no calls. Check on one Android + one iPhone.
      **Area:** platform/input (`src/platform/haptics.ts`, `src/input/routeTool.ts`, test script).
- [ ] R6e **Android haptics through system constants** (after a budget-phone check) — the plugin plays raw
      `Vibrator` waveforms (light 50 ms @110, heavy 60 ms @255); Android guidance prefers `HapticFeedbackConstants`
      and warns that long one-shots feel buzzy. Add a tiny local Capacitor plugin in `android/app` that calls
      `View.performHapticFeedback`: snap → `CLOCK_TICK`, confirm → `CONFIRM` (API 30+, else `VIRTUAL_KEY`),
      jam/closed → `REJECT` (API 30+, else `LONG_PRESS`); inject it as the Android `NativeHapticDriver`, iOS
      unchanged. `test:android-config` asserts the plugin is registered; `docs/ANDROID.md` note. **Area:** platform
      (native Android, `src/platform/haptics.ts`).
- [x] R6f → ext/01 **Puzzle packs without hand-kept lists** — `src/data/puzzles/index.ts` imports 30 JSON files by hand and
      `scripts/test-puzzles.mjs` hard-codes `LEVELS = 30`. Use `import.meta.glob` (or a generated index) and derive
      the count from the folder (ids stay contiguous 01…NN, ≤ 99); add `npm run puzzle:report` printing per level:
      duration at 1×, goal, mechanics, reference margin and star thresholds, so a 5-level pack PR shows its
      difficulty curve. Board scroll e2e with 35 fake levels. **Area:** content/scripts (`src/data/puzzles/**`,
      `scripts/test-puzzles.mjs`, `src/ui/puzzles/**` only if a count is hard-coded).
- [ ] R6g **Content roadmap and store-event texts** — add a "Content after launch" section to `docs/LAUNCH.md`
      (with R2f; Polish): the T / T+4 / T+8 / T+12 weeks table from RESEARCH R6, one new mechanic per update with its
      teaching puzzles, and draft PL/EN texts for an Apple In-App Event (name ≤ 30, short ≤ 50, long ≤ 120 chars) and
      a Play "Major update" promotion (28 days, submit ≤ 60 days ahead, unique art). **Area:** docs. Q-64 → A (D-131).
- [x] R6h → ext/02 (31–35; 36–40 open, Q-74) **Puzzle pack 31–35 "Long haul"** (then 36–40 in a second PR) — five levels outside Europe that teach
      widebody range and ocean legs with today's rules only (no new mechanic tags): start cities in the Pacific /
      South Atlantic, stock with 1–2 widebodies, a `continents` goal in the last one. Each with `referenceCommands`,
      PL/EN titles, `test:puzzles` green, shots. **Area:** content (`src/data/puzzles/**`, i18n). Q-64 → A (D-131): ready before launch; after R6f.
- [ ] R6i **First-session observation sheet** — extends R1o/R3k in `docs/PLAYTEST.md`: what the observer notes in
      a tester's first 10 minutes (seconds to the first own route on the real globe, did they find the dock, first
      "nothing to do" moment, what the glyph means, did they open the weekly board without help) plus two device
      checks: Android — music from another app keeps playing when Airway opens (WebView audio focus, unknown), and
      the snap/jam vibration on a budget phone (R6d/R6e). **Area:** docs.

### R7 (2026-11-03) — legal/privacy launch pack, localisation wave 1 prep, site funnel
- [ ] R7a **Privacy policy v1 (site + game)** — rewrite `privacy.*` in `site/i18n.js` (the game copy follows via
      `test:privacy-text`) into the full structure from RESEARCH R7: controller (placeholder bound to Q-01), purposes
      and legal basis per purpose (leaderboard, anti-cheat, e-mail), recipients (Google Firebase as processor,
      `europe-west1`; host), transfers (EU-US DPF / SCC), retention (entries 90 days D-77; Auth IP logs "a few weeks";
      Auth record until deletion + up to 180 days in backups; e-mails; host logs), rights incl. objection and complaint
      to the Polish UODO, 13+ note, no profiling, effective date. Merge the leaderboard section from
      `docs/legal/leaderboards-privacy.md` (Q-56 → A). Keep the draft banner until the owner approves.
      **Area:** `site/`, `src/i18n` (copy), `docs/legal/`. *Needs Q-01, Q-56, Q-68.*
- [ ] R7b **Terms of use page** — `site/terms.html` (PL/EN, same build/tests as `privacy.html`): licence to play,
      leaderboard rules (one official run per day, server replay may reject, entries expire, no guarantee of service),
      contact, governing law placeholder; a "Terms / Regulamin" row under Help in settings (offline copy like D-86);
      reference Apple's standard EULA in `docs/store/`. Google shows a trader's ToS link from 1 Mar 2027.
      **Area:** `site/`, `src/ui/settings/**`, i18n. *Needs Q-65.*
- [ ] R7c **Publisher details block** — one source string set (`publisher.*`: legal name, address, e-mail, trader
      status) rendered in the site footer, on the privacy/terms pages and in Settings → Help (Polish e-services act
      art. 5; matches the Apple/Google trader card). Placeholders fail `test:site` in a release build until filled.
      **Area:** `site/`, `src/ui/settings/**`, i18n. *Needs Q-01, Q-66.*
- [ ] R7d **Legal launch register** — `docs/legal/README.md`: record of processing (GDPR art. 30: purposes,
      categories, recipients, retention, security), Firebase processing-terms acceptance step (add to
      `docs/FIREBASE.md`), trader declarations with dates (Google: at account creation / by 1 Feb 2027, display
      1 Mar 2027; Apple: before EU submission), UK art. 27 decision (Q-67), US state app-store age laws to re-check
      before the US launch (Texas in force, Louisiana 1 Jul 2026, Utah 6 May 2027, Alabama 1 Jan 2027). Link each line
      from `docs/RELEASE.md` when R1l lands. **Area:** `docs/legal/`, `docs/FIREBASE.md`.
- [ ] R7l **"Send my daily results" setting** — [night-12x → N12x: net layer + daily report done (`Leaderboards.isSharing/setSharing`, D-186); the settings switch is agent #1's] — a settings switch (default on) that stops leaderboard submissions
      and `getBoards` calls; when off, the daily report says the run is not ranked; queued submissions are dropped
      when it is turned off. Gives the GDPR art. 21 objection a one-tap path. `test:net`, settings e2e.
      **Area:** `src/net/**`, `src/ui/settings/**`, `src/ui/daily/**`, i18n. *Needs Q-68 (A).*
- [x] R7e → N12s **Plural form from the raw number** — `pluralValue` reads formatted strings and treats "." as a decimal
      point, so with DE/ES/PT-BR grouping "1.000" picks `one` ("1.000 Passagier") and PT-BR "1.500" → 1.5 → `one`.
      Let callers pass numbers (format inside `t()`), or parse with the active locale's group/decimal symbols from
      `Intl.NumberFormat#formatToParts`. `test:i18n` cases with fake de/pt-BR catalogs for 0, 1, 2, 1 000, 1 500,
      1 000 000. **Area:** `src/i18n/index.ts`, `src/core/format.ts`.
- [x] R7f → N12w **One language registry** — `src/i18n/languages.ts` lists each language once (code, Intl locale, plural
      order incl. `many` after `other` for fr/es/pt, native name, store locale) and drives `Language`,
      `normaliseLanguage`, `PLURAL_ORDER`, `formatNumber` locales, the settings select, airport/region names and a
      check that `CFBundleLocalizations` and `locales_config.xml` list the same codes (`test:ios-config`,
      `test:android-config`). `test:i18n` checks every catalog: same keys, same `{param}` set, plural tokens have
      the category count of their language. Only PL/EN enabled until the translations exist.
      **Area:** `src/i18n/**`, `src/core/format.ts`, `src/ui/settings/**`, `src/ui/airportLabel.ts`, scripts.
- [x] R7g → N12s **Glyph coverage test + French narrow space** — Atkinson Hyperlegible Next (body font, 362-glyph subset)
      lacks U+202F, which `Intl` fr-FR uses as the thousands separator. Map U+202F → U+00A0 in `formatNumber`, and
      add fast `test:glyphs` (reads the TTF `cmap` with a tiny parser, no new dependency) that fails when any catalog
      string or city name uses a code point missing from the font that renders it. **Area:** `src/core/format.ts`,
      `scripts/`, `test:fast` list.
- [ ] R7h **Length budgets and a harsher pseudo-locale** — `src/i18n/limits.ts` maps fixed-width keys to budgets
      (menu split-flap: half-row title 10, status 10, full title 20, gate 2; dock tags, stamps, select options);
      `test:i18n` fails when any catalog exceeds a budget. Pseudo-locale stretches strings ≤ 20 chars by ×2 (IBM/W3C
      expansion for short text), and `e2e/pseudo-locale.mjs` adds 320×568. **Area:** `src/i18n/**`, `e2e/`.
- [ ] R7i **Translator export/import** — `npm run i18n:export -- de` writes `docs/i18n/de.json` (key, EN, PL,
      context comment, max length from R7h, plural categories of the language, placeholder list) and
      `i18n:import` turns a filled file back into `src/i18n/de.ts`, rejecting missing placeholders, over-budget text and
      wrong plural counts. Also covers `site/i18n.js` and `docs/store/en.md` sections. **Area:** `scripts/`, `docs/i18n/`.
- [ ] R7j **City and region names per language** — replace `namePl`/`nameEn` with `names: Record<Language,string>`
      (sim `code` untouched, D-107); a one-off script fetches Wikidata labels (CC0) for de/fr/es/pt-BR into a
      reviewed JSON (pt-BR "Nova York", not "Nova Iorque"); `docs/ASSETS.md` entry; `test:city-data` checks every
      enabled language has every name. **Area:** `src/data/**`, `scripts/`, `docs/ASSETS.md`.
- [ ] R7k **Site launch pack** — store badges (official Apple/Google artwork, brand rules, ASSETS entry) with
      pre-registration/pre-order links from one config, hidden while empty; real shots from `docs/store/shots/`
      instead of stage-0 concepts; `og:image` from the feature graphic (D-117); `hreflang` + `canonical`; a `404.html`
      in the site style; footer links to terms (R7b) and publisher block (R7c). No newsletter (Q-70 → A).
      `test:site` and `shots:site` updated. **Area:** `site/`, `docs/SITE.md`. After D-67's publish decision.

### R8 (2026-11-03) — gameplay-depth and balance audit, rules v5 (data: `docs/RESEARCH.md` "R8", `scripts/research/r8-audit.ts`)
- [x] R8a → N12v **Weekly board offers only cards that can matter** — 200 bot seeds: "+2 slots" picked 0 % of the 239 times
      it was offered, hub expansion 3 % of 235; forcing either costs ~1 min median and 12–14 % score, because every
      board has at least one of them (a third have both) and the fleet is the bottleneck (99 % of losses with 0 spare
      aircraft). Rule: "+2 slots" enters the draw only after the run's first `DepartureHeld`, hub expansion only while a
      hub exists (Q-10's "disabled" stamp becomes rare); otherwise the slot is filled by the other aircraft card. Draw
      stays on the `upgrades` RNG stream; `RULES_VERSION` bump, save/daily golden updates. Metric (r8-audit
      `--policy=bot`): boards showing a card with no effect yet (no hub / no slot hold) 100 % → < 30 %; median stays in 10–18 (`test:balance`); slot holds
      still counted. **Area:** `src/sim/upgrades.ts`, `src/sim/world.ts`, tests. *Needs Q-71.*
- [x] R8b → N12y **"No spare aircraft" game-over hint** — 56 of 200 losses are at an airport with no route, and in 99 % of
      all losses the reserve was empty, yet `gameover.unservedHint` says "Connect a new airport before its waiting area
      fills up". When the failed airport had 0 routes and the reserve was 0, show "No spare aircraft: drag a route end
      to it or take a plane off a quieter route" (PL + EN, i18n); keep the old line when a plane was free. Pure choice
      in `src/game/gameoverTip.ts`/game-over report, `test:gameover-tip` cases for both. Metric: share of unserved
      losses whose hint names an action the player could take 0 → 100 %. **Area:** `src/game/`, `src/ui/gameover/`,
      `src/i18n/`.
- [x] R8c → N12v **Curfew from week 3 in Endless** — only 29 of 200 bot runs (15 %) reach week 4, so the curfew (D-17), one
      of the D-07 differentiators, is unseen in most runs; 66 % reach week 3. `CURFEW_ENDLESS_START_WEEK` 4 → 3,
      rules/params version bump, `test:daynight`/`test:balance`/goldens. Metric (r8-audit): runs with a curfew hold
      15 % → ≥ 50 %; median stays in 10–18 min (expect a small drop); week-1/2 untouched. **Area:** `src/sim/params.ts`,
      tests, `docs/balance/README.md`. *Needs Q-72 (D-17 is the owner's).*
- [ ] R8d **Balance report shows spread and mechanic use** — `balance:report`/`game-summary.md` print p10/p25/p75/p90,
      a loss-week histogram, hub/spoke/unserved losses, spare aircraft at the loss, cards offered vs picked, runs with
      curfew / slot holds and the transfer share (port the counters of `scripts/research/r8-audit.ts`, without
      prototype wrapping: read `DepartureHeld`/`Delivered` events and `hubCauseLedger` in the adapter). No new gate.
      Metric: the next balance PR can quote the tail, not only the median. **Area:** `scripts/balance-*.ts`,
      `docs/balance/`.
- [ ] R8e **Bot moves aircraft** — the bot never uses `UnassignPlane`/`RemoveRoute`, so with an empty reserve an
      unserved airport is lost unless a route end is within range (56 / 200 losses). Add one step: when an active
      airport has no route, no spare aircraft and no extendable route, take the plane from the route with the lowest
      waiting per plane (keep ≥ 1 per route) and open the new route with it. `test:bot-policy` cases; report the new
      median before touching any gate (if it leaves 10–18 min, ask the owner, D-79). Metric: unserved losses 56 → lower;
      median and spread reported. **Area:** `src/game/dev/bot-policy.ts`, `scripts/`.
- [ ] R8f **Prepared late-ramp sweep (apply only after the closed test, D-113)** — 0 of 200 runs see a 5th board;
      p90 22.4 min, max 31.6; the network grows 6 airports/week, the fleet 1 plane/week. Script variant (no rule
      change merged): sweep spawn interval after week 3 (12 → 14/16 h) and "aircraft card gives 2 turboprops from
      week 3", reporting p50/p90/max and week-4/5 reach, so the owner can pick with tester data (Q-73). **Area:**
      `scripts/research/`, `docs/balance/`.
- [ ] R8g **R8 questions in the closed-test sheet** — add the seven R8 questions (hint understood? planes moved?
      card that felt useless? SLOT stamp seen? curfew reached? run-length spread from the logbook, "anything to do in
      the last minutes?") to the survey/observation sheet with the thresholds from RESEARCH R8. **Area:** docs
      (`docs/PLAYTEST.md` with R3k/R6i).

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
- 2026-11-03 · N12c Android backup without leaderboard identity (R1e, D-92) · night/12c-android-backup · test:android-config 18/18 (14/18 on the old manifest), test:install-identity 6/6 (new), aapt2 compile ok, test:fast 59/59, build ok, e2e:smoke 9/9 (boot path touched); Gradle lint not run (Maven 429), no device restore; ui:matrix/store:shots not run (no UI change)
- 2026-11-03 · N11e privacy policy in the app (D-86) · night/11e-privacy · test:fast 60/60 (test:privacy-text 6/6, 1/6 before), build ok, test:e2e:privacy-page 4/4 (0/4 on the old settings), e2e:settings-groups 4/4, e2e:covered-pages 2/2, e2e:pseudo-locale 27/27; e2e:smoke/ui:matrix not run (settings only, no game screen)
- 2026-11-03 · N11f one tip on the game-over report (D-87) · night/11f-gameover-tip · test:fast 61/61 (test:gameover-tip 7/7, 6/7 on the old catalogs), build ok, e2e:smoke 9/9, ui:matrix 32/32 (its game overs are at unserved airports: no tip, PNGs unchanged), e2e:pseudo-locale 27/27, e2e:gameover-short 4/4 (0/4 before the short-screen rule), e2e:gameover-unserved 4/4, e2e:gameover-map 3/3, e2e:run-timeline 4/4, e2e:daily-share 4/4, test:e2e:gameover-tip 4/4 (1/4 on the old report), store:shots 30 (test:store-shots 30/30)
- 2026-11-03 · N12d server replay ends at the game over (R3c, D-97) · night/12d-replay-stop · test:replay-cost 7/7 (5/7 on the old replay), test:replay 23/23 (summary identical), test:net 8/8, test:net-server 5/5, test:fast 62/62, build ok, test:firebase 7/7 (emulator); e2e/ui:matrix/store:shots not run (no UI change)
- 2026-11-03 · N12e store-requirement guards (R1m, D-98) · night/12e-store-guards · test:android-config 20/20 (19/20 on the old build script; 19/20 with targetSdk 35), test:native-align 7/7 incl. zipalign cross-check (new; module absent before), test:fast 63/63, build ok; Gradle `assembleDebug --offline` could not resolve plugins here, so no real APK/AAB was checked
- 2026-11-03 · N11g reduce motion setting (D-88) · night/11g-reduce-motion · test:fast 63/63 (test:motion 8/8, 0/8 on the old code; test:flap 15/15 via the TS loader), build ok, test:e2e:reduce-motion 3/3 (0/3 on the old settings), e2e:settings-groups 4/4, e2e:screens-fit 18/18, e2e:screens-fit-320 12/12, e2e:pseudo-locale 27/27, e2e:privacy-page 4/4, e2e:covered-pages 2/2, e2e:airline-colour 3/3; e2e:smoke/ui:matrix not run (settings only; E2E pages emulate a reduce-motion system, game screens unchanged)
- 2026-11-03 · N12g owner decisions D-93…D-96, own D-97/D-98 renumbered · night/12g-owner-decisions · test:fast 64/64, build ok (docs and comments only)
- 2026-11-03 · N12f fair week 1 + faster pace, Alexandria in ME (D-95, D-99, D-105, D-106; rules v5) · night/12f-week1-reach · test:week1-reach 5/5 (new; 2/5 on rules v4: 507/1,600 week-1 spawns and 33 start airports beyond reach), test:balance median 17.81 → 17.03 min (reach rule alone 24.43; 200 seeds 17.53 → 16.52), upgrade1 0.88 → 1.00, upgrade2 0.56 → 0.66, week-1 losses beyond reach 5/50 → 0/50, test:replay 23/23 (summary changed with the rules: a1a1 min8640:upgrade:score109 → min4124:over:score48), test:sim-week 6/6 (re-locked), test:save-golden 20/20 (seed 0xA1A3, + v4 replay check), test:bot-policy 10/10 (2 checks re-pinned), test:daily-mode 20/20, test:net 8/8, test:fast 65/65, build ok, store:shots 30/30 regenerated and inspected (test:store-shots 30/30); e2e/ui:matrix not run (no UI code changed)
- 2026-11-03 · N12h six airport codes on screen + city data guard (R4a, R4b test, D-107) · night/12h-display-codes · test:city-data 5/5 (new; 4/5 before the display codes), test:airport-labels 5/5 (+1), test:replay 23/23 and test:save-golden 20/20 with summaries/hashes identical to dev (sim ids unchanged), test:balance median 17.03 (unchanged), test:fast 66/66, build ok; e2e/ui:matrix/store:shots not run (none of the six airports is in those scenes); no shot of an affected airport taken
- 2026-11-03 · N12i one top-50 document per board (R3a, D-108) · night/12i-top-board · test:net-server 9/9 (5/9 on the old functions), test:firebase 9/9 on the emulator (7/9 on the old functions: no `rank`, no `meta/top`), test:fast 66/66, build ok; e2e/ui:matrix/store:shots not run (client unchanged); read count proven behaviourally (a direct entry edit is not read back), no emulator request log
- 2026-11-03 · N12j per-player rate limit + split function caps (R3b, D-109) · night/12j-rate-limit · test:net-server 13/13 (9/13 on the old functions), test:net 9/9 (8/9 on the old client: a 429 dropped the queued run), test:firebase 10/10 on the emulator (9/10 on the old functions: no limit), test:fast 66/66, build ok; e2e/ui:matrix/store:shots not run (no UI change); caps not verified on a real deploy
- 2026-11-03 · N12k in-app deletion of leaderboard data (R1a, D-93, D-114) + Q-60 → D-113 · night/12k-delete-my-data · test:net-server 16/16 (12/16 on the old functions), test:net 12/12 (9/12 on the old client), test:firebase 12/12 on the emulator (new deletion checks; `deleteMyData` absent before), test:e2e:delete-ranking 4/4 (new; 2/4 on the old settings), test:fast 66/66, build ok; ui:matrix/store:shots not run (row hidden without Firebase config); no real deploy
- 2026-11-03 · N12l Android per-app language (R1d, D-115) · night/12l-android-locales · test:android-config 22/22 (21/22 on the old manifest), aapt2 link ok (android-36, minSdk 24), test:fast 66/66, build ok; no device run (WebView `navigator.languages` under a per-app locale unverified); e2e/ui:matrix not run (no web code changed)
- 2026-11-03 · N12m budget GPUs start on the low preset (R3f, D-116) · night/12m-gpu-preset · test:quality 95/95 (57 before; on the old quality.ts 19 of the new checks fail and the probe check throws: no `readGpuRenderer`), renderer probe checked in headless Chromium (SwiftShader string read, probe context lost after), test:fast 66/66, build ok; perf:scene not run (it forces `--preset`, SwiftShader is not in the table), e2e/ui:matrix/store:shots not run (SwiftShader keeps the old rule); table not verified on the phones themselves
- 2026-11-03 · N12n Play feature graphic 1024×500 (R2d, D-117) · night/12n-feature-graphic · store:feature 1/1 (centre luma std 62.1, 506 colours, dark share 0.038, 297,787 bytes; PNG inspected), test:store-shots fields 12 → 14 + feature=1 (fails on the old repo state: no feature graphic, no alt-text field), test:fast 66/66, build ok; store:shots not re-run (store scenes unchanged), e2e/ui:matrix not run (DEV probe only); PNG not byte-identical between runs (SwiftShader)
- 2026-11-03 · N11h WebGL context loss + no-WebGL-2 page (D-118) · night/11h-webgl-loss · test:fast 67/67 (test:webgl-context 8/8, 4/8 with the wiring reverted), build ok, test:e2e:webgl-context 4/4 (0/4 on the old code); e2e:smoke/ui:matrix not run (game screens unchanged unless the context is lost)
- 2026-11-03 · N12p Play OpenGL ES 3.0 device filter (R3h, D-124) · night/12p-gles3-filter · test:android-config 23/23 (22/23 on the old manifest), aapt2 link ok + `dump badging` uses-gl-es 0x30000 (android-36, minSdk 24, manifest without resource refs), test:fast 66/66, build ok; minSdk unchanged (Q-54); no Play Console device-catalogue check; e2e/ui:matrix/store:shots not run (no web code changed)
- 2026-11-03 · N11i pause on window focus loss (D-99, D-119) · night/11i-focus-pause · test:fast 67/67 (test:saves 13/13, 11/13 on the old code), build ok, test:e2e:focus-pause 3/3 (1/3 on the old code), e2e:save-notice 4/4; e2e:pause-summary 0/4 on this branch and on origin/dev alike (rules v5: `autoplay(2)` ends in a game over before week 2 — pre-existing, not this change); e2e:smoke/ui:matrix not run (no layout change)
- 2026-11-03 · N12o store shots in the exact Apple sizes and 16:9 (R2a, D-123) · night/12o-store-sizes · store:shots 60/60 (30 → 60: + iphone 1320×2868, ipad 2064×2752, landscape 1920×1080; contact sheet 2556×5361; new device PNGs and the sheet inspected), test:store-shots devices=6 shots=60 (new validator on the old 30-shot set: FAIL "Manifest lists 30/60"), test:fast 67/67, build ok; e2e/ui:matrix not run (no game code changed); App Store Connect / Play Console upload not tried; origin/dev (N11h context-loss guard, no visual change while the context lives) was merged during the run, so early shots predate it
- 2026-11-03 · N12q bundle budget + dead code/unused keys + minSdk 29 (R5k, R5i, Q-54 → B; D-133, D-143, D-144) · night/12q-bundle-guard · test:bundle 9/9 (main 1,034.1 kB / gzip 306.4 kB, CSS 70.2 kB, dist 1,805.1 kB), test:bundle:static 5/5 (4/5 on the old platform code: `@capacitor/core` mixed import; Vite warning gone), test:i18n keys 424 → 409 (15 unused keys on the old catalogs, 2 with the old a11y.ts), test:android-config 23/23 (21/23 on minSdk 24), aapt2 link + `dump badging` minSdkVersion 29 / uses-gl-es 0x30000, test:fast 68/68, build ok; e2e/ui:matrix/store:shots not run (no screen changed); no Gradle build, no device
- 2026-11-03 · N12r route snap haptic inside a native selection (R6d, D-137) + owner D-134…D-136, own N12q decisions → D-143/D-144 · night/12r-snap-haptic · test:haptics 9/9 (4/9 on the old driver: no selection start/end, a lone snap only `selectionChanged`), test:route-tool 18/18 (16/18 on the old tool), test:fast 68/68, build ok, test:bundle 9/9 (main 1,034.5 kB / gzip 306.5 kB); e2e/ui:matrix/store:shots not run (no visual change); no Android/iPhone vibration check
- 2026-11-03 · N12s plural form from the number + no U+202F + glyph coverage (R7e, R7g; D-145, D-146) · night/12s-plural-glyphs · test:format 16/16 (+3; on the old reader 6/24 fake de/pt-BR/es/fr cases wrong: 3 singulars, 3 leaked tokens; on old code the file fails to import `formatNumberIn`/`parseLocalNumber`/`fillPluralTokens`), test:glyphs 12/12 (new; 10/12 with dev's fonts.css: "→" missing from Atkinson 400/700 in `route.atc.distance` and `upgrade.value.transfer`, PL and EN), test:fast 69/69, build ok (main 1,035.0 kB / gzip 307.4 kB), test:e2e:pseudo-locale 27/27 (fonts.css changed); ui:matrix/store:shots not run; arrow not compared on a phone WebView
- 2026-11-03 · R6f puzzle packs without hand-kept lists + `puzzle:report` (D-160, D-161) · ext/01-puzzle-packs · test:puzzle-packs 7/7 (0/7 on the hand-kept index: a 31st `NN.json` left `PUZZLES` at 30, no generator/report), test:puzzles levels=30 cases=169 passed=169, test:fast 70/70 (98.7 s), build ok, test:e2e:puzzles levels=30 steps=34 passed=34 (merged tree with dev at ce9ef74)
- 2026-11-03 · R6h puzzle pack "Long haul" 31–35 (D-162, D-163; Q-74) · ext/02-puzzles-31-35 · test:long-haul 10/10 (0/10 on dev: no pack, no levels 31–35), test:puzzles levels=35 cases=204 passed=204, test:puzzle-packs 7/7, test:fast 71/71 (108.1 s), build ok, test:e2e:puzzles levels=35 steps=39 passed=39, test:e2e:screens-fit-320 12/12, shots ext-02 4/4 inspected (merged tree with dev at f1e4d53)
- 2026-11-03 · G1 production globe assets (D-170, D-171, D-176) · ext/03-g1-globe-assets · test:globe-assets 45/45 (new: 6 files, 1,773,908 B, manifest SHA-256), test:fast 72/72 (129.2 s), build ok (main 1,050.3 kB / gzip 310.6 kB), test:bundle 9/9 (dist 3,597.7 kB ≤ 4,300 kB); textures not drawn yet (G2/G3), licences screen lists NASA Earth Observatory + NOAA ETOPO5 (PL/EN); ui:matrix not run
- 2026-11-03 · G9 airport/route variants for the owner (D-175, D-177) · ext/03-g9-airport-variants · DEV-only `?airportStyle=ink|apron|medal` (default objects unchanged), 15 engine renders (Satelita/Mapa day, Satelita dusk; phone + Fold), comparison sheets in docs/mockups/globe-2026-11/g9/, probe numbers; test:fast 72/72 (102.2 s), build ok (main 1,051.6 kB / gzip 311.0 kB); waits for the owner pick (Claude recommends V3 Medalion)
- 2026-11-03 · N11j pause-summary e2e under rules v5 + old-rules save notice (D-132, numbered D-130 in PR #147), owner D-128/D-129 · night/11j-pause-summary-v4-save · test:e2e:pause-summary 4/4 (0/4 on origin/dev), test:save-golden 21/21 (20/21 on the old code), test:e2e:save-notice 6/6 (4/6 on the old code), test:fast 67/67, build ok; e2e:smoke/ui:matrix not run (no layout change)
- 2026-11-03 · N11k clean game-over report (R5f), owner D-130/D-131, N11j decision → D-132 · night/11k-clean-gameover · after merging dev (#154–#158): test:fast 72/72, build ok, e2e:gameover-unserved 4/4, e2e:gameover-map 3/3, e2e:smoke 9/9, ui:matrix 32/32; before: test:e2e:gameover-unserved 4/4 (0/4 on the old UI; its served case was 3/4-red on origin/dev since rules v5, now seed 0xA1A3), test:fast 67/67, build ok, e2e:smoke 9/9, ui:matrix 32/32, e2e:gameover-map 3/3, e2e:gameover-short 4/4, e2e:gameover-tip 4/4, store:shots 60 (test:store-shots ok); R5d stays a proposal
- 2026-11-04 · N12t sound survives the phone (D-153) + owner D-150…D-152 · night/12t-music-device · test:audio-unlock 7/7 (new; 6/7 fail on the old engine: tap listener gone after a still-suspended first resume, no re-arm after a system suspension or refused resume, no frozen-clock rebuild, no status; with the old minute clock a chime 40 ticks ahead does not play within 0.3 s), test:fast 73/73, build ok, test:e2e:smoke 9/9 (boot/audio path touched); desktop Chromium probe: context running, chimes scheduled; not verified on the Fold (checklist in docs/ANDROID.md)
- 2026-11-04 · N12u unfolded foldable in ui:matrix (D-154) · night/12u-fold-matrix · ui:matrix 48/48 (32 before; the 16 new 904×1088@2 / 1088×904@2 shots PL/EN inspected, older 32 not re-committed), test:fast 73/73, build ok
- 2026-11-04 · N11l training flight on the Fold: hint gap, one-shape tags, night only on the globe (owner feedback, D-180) · night/11l-tutorial-device · test:e2e:tutorial-layout 7/7 (0/7 on the old tutorial; Fold 686×762 with status/gesture-bar padding), after merging dev #160: test:fast 73/73, build ok, tutorial-layout 7/7; before: test:fast 72/72, build ok, e2e:tutorial 21/21 (shots docs/shots/23 refreshed), e2e:screens-fit 18/18, e2e:reduce-motion 3/3; e2e:smoke/ui:matrix not run (game screens unchanged)
- 2026-11-04 · N12v rules v6: cards that can act + curfew from week 3 (R8a, R8c; D-150, D-151, D-155) · night/12v-board-curfew · test:upgrades 7/7 (new eligibility case fails on the old draw: 6/7), test:daynight 44/44 and test:week-source 6/6 (curfew week 3 = day 7), test:save-golden 21/21 (rules 6, v5 golden frozen + replay check), test:slots 5/5 (+ bonus survives a snapshot), test:bot-policy 10/10 (slots check on 0xA1AA board 2), test:replay 23/23 (slots board on seed 0x0001; summaries unchanged), test:balance median 17.03 → 17.25 min (upgrade1 1.00, upgrade2 0.66), r8-audit 200 seeds median 16.52 → 16.64, curfew hold 20 → 123 runs, "+2 slots" offered 239 → 4, hub 235 → 360, test:e2e:curfew-barrier 2/2 (seed 0xA1A2; 0/2 on 0xA1A1, which ends in week 2 since v5), test:e2e:smoke 9/9, test:fast 73/73, build ok; store:shots/ui:matrix not regenerated (week-1 boards on 0xA1A1 now show turboprop/widebody/hub instead of slots)
- 2026-11-04 · N11m airport code plates on the luggage tags (D-128 → D-181, R5a) · night/11m-airport-plates · after merging dev (rules v6, #163): test:e2e:airport-plates 4/4, test:fast 73/73 (test:overlay-layout 21/21, 20/21 on the old layout), build ok, e2e:smoke 9/9, e2e:edge-chip-tags 6/6, e2e:curfew-barrier 2/2, ui:matrix 48/48, store:shots 60; before the merge also test:hud-targets 300/300, e2e:edge-chip-airports 2/2, e2e:edge-chip-fill 4/4, e2e:edge-dock 5/5, e2e:gameover-map 3/3. Pre-existing on origin/dev (same failure with the old src): e2e:new-airport 1/4 ("the mark goes after 12 game hours"), e2e:transfer-glyphs 0/2 (bot game over before the transfer)
- 2026-11-04 · N11n opaque empty dock tags (R5d, D-182) · night/11n-opaque-dock-tags · test:e2e:dock-empty-tags 3/3 (0/3 on the old tags), test:fast 73/73 (test:contrast 17 pairs), build ok, e2e:smoke 9/9, test:hud-targets 300/300, ui:matrix 48/48, store:shots 60
- 2026-11-04 · N11o new-airport + transfer-glyphs e2e under rules v5/v6 (D-183) · night/11o-e2e-seeds · test:e2e:new-airport 4/4 (1/4 on origin/dev), test:e2e:transfer-glyphs 2/2 (0/2 on origin/dev), test:fast 73/73, build ok; e2e:smoke/ui:matrix not run (no game code changed)
- 2026-11-04 · N11p 3-step training flight in the game's marks + first-time cards (R5b, R6a, R6b; D-184, D-190) · night/11p-short-tutorial · test:first-time 7/7 (new; the module does not exist on the old code), test:e2e:first-time-cards 4/4 (new; no cards on the old game), test:e2e:tutorial 28/28 (screenshots 8), test:e2e:tutorial-layout 7/7 (planet check fails on the old 228-unit planet at 412 px), test:fast 74/74, build ok, e2e:smoke 9/9, e2e:settings-groups 4/4, e2e:screens-fit 18/18, e2e:pseudo-locale 27/27; ui:matrix/store:shots not run (cards are off in seeded DEV runs, game screens unchanged)
- 2026-11-04 · G9 Medalion airports + route ink outline + edge contrast probe (D-177, D-178; owner "Daj medalion i scalaj") · ext/03-g9-medalion · test:render-layers 40/40 (+1 outlined-disc case), test:fast 74/74 (130.8 s), build ok (main 1,058.6 kB / gzip 314.2 kB); probe seed 15 phone day routes 5.1/6.8/3.4, airports 2.6/3.2/3.1 (diorama/Satelita/Mapa); renders in docs/mockups/globe-2026-11/g9/final/; store:shots/ui:matrix not run (G6), follow-up G9b
- 2026-11-04 · N11q quiet route-end handles below the tags (R5c, D-191) · night/11q-quiet-handles · test:e2e:route-handles 2/2 (0/2 on the old handles), test:fast 74/74, build ok, test:hud-targets 300/300, e2e:smoke 9/9, e2e:airport-plates 4/4, e2e:gameover-map 3/3, ui:matrix 48/48, store:shots 60 (test:store-shots ok); owner question Q-76
- 2026-11-04 · N11r crate stamp captions + "none yet" (R5e, D-194) + replay restores first-time cards (owner Q-76 → B, D-192) · night/11r-stamp-captions · after merging dev (#169–#171): test:fast 75/75 (test:crate-stamps 5/5, 1/5 on the old cards; test:pause-summary 6/6, 5/6 on the old summary; test:first-time 8/8, 7/8 on the old controller), build ok, test:hud-targets 300/300, e2e:smoke 9/9 (5/9 while another suite loaded the machine), store:shots 60 (test:store-shots ok); ui:matrix 38/48 — the upgrade screen at 904×1000 / 904×1088@2 / 1088×904@2 times out on origin/dev too since the new globe (G2+G3/G4, probe 12/16 on origin/dev); before the merge ui:matrix 48/48, e2e:smoke 9/9. e2e:board-short 0/4 on origin/dev and here (rules v5 game over before week 2, pre-existing)
- 2026-11-04 · G2+G3 satellite globe ships (D-179) · ext/03-g2g3-satellite · test:fast 74/74 (136.5 s), build ok (main 1,070.0 kB / gzip 317.7 kB), test:bundle 9/9 (dist 3,617.4 kB), test:e2e:smoke 9/9; built app (vite preview) loads data/globe/ day-2048 + night-1024 + elevation on auto→low, no fallback warning; game shots seed 15: routes 6.9/6.8, airports 3.2/6.0 (day/dusk); store:shots/ui:matrix not run (G6)
- 2026-11-04 · G4 sea surface + haze folded into the terrain shader (D-173) · ext/03-g4-fillrate · transparent full-screen layers on the satellite globe 3→1 (low/saver: halo) and 4→2 (medium/high: halo + clouds); perf:scene SwiftShader 40 s low 397 frames (375 with shells), medium 168 (174), draw calls 41; game shots seed 15 match the layered look (routes 6.8/6.7, airports 3.1/5.5 day/dusk); `world.stats().transparentLayers` not added (G7 measures on devices)
- 2026-11-04 · G6 store screenshots, feature graphic, ui:matrix and style doc on the satellite globe (D-170, D-178) · ext/03-g6-store · store:shots 60/60 (game: gold 0.13–0.17 ≥ 0.045, routes/airports/planes 9.4–11.6:1; night 9.4–11.4:1), store:feature 1/1, ui:matrix 48/48, contact sheet and feature graphic inspected; docs/styles/realistyczny.md (PL), D-11 globe superseded; shots:site not rerun
- 2026-11-04 · N12w one language table (R7f, D-185) · night/12w-language-registry · test:i18n 1/1 (now per table entry: catalogs, plural form counts, labels, number locales; stub `de` entry gives every derived lookup; fails on the old code: no table, `=== 'pl'` in airportLabel.ts), test:android-config 23/23 (reads the table), test:fast 74/74, build ok, test:e2e:settings-groups 4/4; behaviour unchanged (PL/EN)
- 2026-11-04 · N12x leaderboard opt-out, net layer + daily report line (R7l, D-135, D-186) · night/12x-leaderboard-optout · test:net 13/13 (new opt-out case fails on the old net layer: no isSharing/setSharing, run queued and sent), test:fast 74/74, build ok, test:e2e:delete-ranking 4/4; settings switch left to agent #1 (API: Leaderboards.isSharing/setSharing)
- 2026-11-04 · N12y no-spare-aircraft hint on the unserved game-over board (R8b, D-187) · night/12y-no-spare-tip · test:gameover-tip 8/8 (new case fails on the old code: no unservedHint), test:e2e:gameover-unserved 5/5 (+1 bot run on 0xA1A1 ending unserved with an empty reserve, PL 360×640 unclipped; docs/shots/n11k/gameover-nospare-pl-360x640.png), test:fast 74/74, build ok; ui:matrix not run (its game-over is a forced hub overload)

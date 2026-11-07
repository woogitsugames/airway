// [night-12aa] Seeds and bot plans of the e2e suites that need the DEV bot to reach a given weekly board.
// Each plan mirrors what its suite does through window.aw (autoplay, card clicks, forceHubOverload), so
// `npm run test:e2e-seeds` (in test:fast) replays it headless on the current rules and fails before the
// browser suite would; `npm run e2e:seeds -- <suite>` finds the next seed that holds (scripts/e2e-seeds.ts).
//
// Steps (the same Commands the browser sends; see scripts/lib/e2e-plans.ts):
//   { board: N }                       autoplay(N): the bot plays until the week-N board (the run must not end)
//   { take: 'plain' | 'plane' }        click the first card that is not hub/slots ('plain') or an aircraft
//                                      ('plane', index 0 when none); `strict: true` = such a card must exist
//   { find: kind, from, to, take }     autoplay week by week from `from` to `to` until `kind` is offered,
//                                      answering the other boards with `take`
//   { offers: n }                      the board shows n cards
//   { overload: true }                 window.aw.forceHubOverload(): the run must end on a jammed airport
//   { ticks: n }                       window.aw.advanceTicks(n) (the run may end here; `alive: true` = it must not)
// [night-12ac] For the suites that play without a fixed board (see scripts/lib/e2e-plans.ts):
//   { board: N, mayEnd: true }         autoplay(N), and a run that ends before the board is fine
//   { take, ifBoard: true }            click only when a board is open; take 'first' = upgrade-option-0
//   { find: [kinds…], from, to, take } stop at the first board offering any of the kinds
//   { playOut: W, take }               autoplay week 1…W, answering each board, until the run ends (must end)
//   { drift: n, max, take }            no bot: advanceTicks(n) up to `max` times, answering boards (must end)
//   { jam: 'served'|'unserved', spare } the jammed airport is (not) on a route; `spare` aircraft left in reserve
//   { hourly: h, until?, bot? }        botStep() + advanceTicks(60) per hour (bot: false = ticks only); `until`
//                                      ('curfew' | 'no-curfew') must hold in play within h hours, else the run must last
//   { minutes: n, until, botEvery }    advanceTicks(1) per minute (+ botStep every botEvery) until 'connecting'
//                                      (a transfer inside its connection time) or 'cleared' (that airport's are done)
//   { opens: n, chunk }                no bot: advanceTicks(chunk) until an airport opens, within n ticks
//   { routes: n }                      the run is going and has at least n routes
//   { triggers: [cards], ticks, every, take }  botStep() + advanceTicks(every) for `ticks`, answering boards, until
//                                      each first-time card's trigger fired (hub-full, out-of-range, curfew, weekly-board)
//   { gesture: 'route-plane' }         [night-12ag] the route drag + the dock-tag drag of smoke/leaderboard
//                                      (AddRoute turboprop + AssignPlane), checked for every start-airport pair in range
//   { gesture: 'route' }               [night-12aj] the route drag alone (daily-share)
// [night-12aj] Suites seeded by the date (daily-share, daily-continue) start the page calendar at `dates[0]`
// (e2e/browser.mjs pinDate, Warsaw noon) and replay in daily mode (`mode: 'daily'`) with seed
// dailySeedForKey(date); `npm run e2e:seeds -- daily-share` finds the next date that holds.

/** @type {Record<string, { seeds: number[], dates?: string[], plans: { name: string, mode?: 'daily', steps: object[] }[] }>} */
export const E2E_SEEDS = {
  'board-short': {
    seeds: [0xA1A2], // 0xA1A1 until rules v6 (its run ends in week 2)
    plans: [{ name: 'week-1 and week-2 boards', steps: [
      { board: 1 }, { offers: 3 }, { take: 'plain' }, { board: 2 }, { offers: 3 },
    ] }],
  },
  'run-timeline': {
    seeds: [0xA1A2], // 0xA1A1 until rules v6
    plans: [{ name: 'week-2 board, aircraft crate, hub overload', steps: [
      { board: 2 }, { take: 'plane', strict: true }, { overload: true },
    ] }],
  },
  'edge-chip-airports': {
    seeds: [0xA3AA], // 41817 until rules v6 (over in week 2, no "+2 slots" board)
    plans: [{ name: '"+2 slots" offered by week 5', steps: [
      { find: 'departure-slots', from: 2, to: 5, take: 'plane' },
    ] }],
  },
  'edge-chip-tags': {
    seeds: [0xA1C3, 41817], // 0xA1C2 until rules v6 (over before the week-2 board)
    plans: [{ name: 'week-1 and week-2 boards', steps: [
      { board: 1 }, { take: 'plane' }, { ticks: 1440 }, { board: 2 }, { take: 'plane' },
    ] }],
  },
  'upgrade-picks': {
    seeds: [0xA3AA], // 0xA1A1 until rules v6 (no "+2 slots" before the run ends)
    plans: [
      { name: '"+2 slots" offered by week 6', steps: [{ find: 'departure-slots', from: 1, to: 6, take: 'plain' }] },
      { name: 'hub expansion offered by week 6', steps: [{ find: 'hub-expansion', from: 1, to: 6, take: 'plain' }] },
    ],
  },
  // [night-12ac] Suites moved from hard-coded seeds (0xA1A1 = the harness SEED unless noted).
  'transfer-glyphs': {
    seeds: [0xA1A1],
    plans: [{ name: 'week 2, a transfer connecting within 10 h, cleared within 50 min', steps: [
      { board: 1 }, { take: 'plain', strict: true },
      { minutes: 600, until: 'connecting', botEvery: 60 }, { minutes: 50, until: 'cleared' },
    ] }],
  },
  'pause-summary': {
    seeds: [0xA1A1],
    plans: [{ name: 'week-1 board, then week 2', steps: [{ board: 1 }, { take: 'plain', strict: true }] }],
  },
  'curfew-barrier': {
    seeds: [0xA1A2],
    plans: [{ name: 'curfew closes after the week-3 board, night ends within 12 h', steps: [
      { board: 3 }, { hourly: 96, until: 'curfew' }, { hourly: 12, until: 'no-curfew', bot: false },
    ] }],
  },
  'gameover-map': {
    seeds: [0xA1A1],
    plans: [{ name: 'bot play-out ends the run by week 30', steps: [{ playOut: 30, take: 'plane' }] }],
  },
  'gameover-short': {
    seeds: [0xA1A1],
    plans: [{ name: 'week-2 board (or an earlier end), forced overload', steps: [
      { board: 2, mayEnd: true }, { take: 'plain', ifBoard: true }, { overload: true },
    ] }],
  },
  'gameover-tip': {
    seeds: [0xA1C2],
    plans: [{ name: 'forced jam lands on a served airport', steps: [
      { board: 2, mayEnd: true }, { take: 'plane', ifBoard: true }, { overload: true }, { jam: 'served' },
    ] }],
  },
  'gameover-unserved': {
    seeds: [0xA1A1],
    plans: [
      { name: 'no routes: the run jams unserved', steps: [{ drift: 600, max: 200, take: 'first' }, { jam: 'unserved' }] },
      { name: 'bot play-out ends unserved with no spare aircraft', steps: [
        { playOut: 30, take: 'plane' }, { jam: 'unserved', spare: 0 },
      ] },
    ],
  },
  'gameover-unserved:served': {
    seeds: [0xA1A3],
    plans: [{ name: 'bot play-out jams at a served airport', steps: [{ playOut: 30, take: 'plane' }, { jam: 'served' }] }],
  },
  'new-airport': {
    seeds: [4242],
    plans: [{ name: 'an airport opens within 3000 ticks, run lasts its 12-hour mark', steps: [
      { opens: 3000, chunk: 20 }, { ticks: 680 + 60, alive: true },
    ] }],
  },
  'first-time-cards': {
    seeds: [0xA1A2],
    plans: [{ name: 'all five first-time triggers within 4 weeks (surge: D-272)', steps: [
      { triggers: ['hub-full', 'out-of-range', 'curfew', 'weekly-board', 'surge'], ticks: 4 * 4320, every: 30, take: 'plain' },
    ] }],
  },
  'focus-pause': {
    seeds: [0xA1A1],
    plans: [{ name: 'week-1 board', steps: [{ board: 1 }] }],
  },
  'logbook': {
    seeds: [0xA1A1],
    plans: [{ name: 'week-2 board (or an earlier end), forced overload', steps: [
      { board: 2, mayEnd: true }, { take: 'plain', ifBoard: true }, { overload: true },
    ] }],
  },
  'pick-sign': {
    seeds: [0xA1A1],
    plans: [{ name: 'an airport-pick card by week 6', steps: [
      { find: ['departure-slots', 'hub-expansion'], from: 1, to: 6, take: 'first' },
    ] }],
  },
  'undo-after-upgrade': {
    seeds: [0xA1A1],
    plans: [{ name: 'aircraft card on the week-1 board', steps: [{ board: 1 }, { take: 'plane', strict: true }] }],
  },
  'continue-framing': {
    seeds: [0xA1C2],
    plans: [{ name: 'week-1 board, aircraft card', steps: [{ board: 1 }, { take: 'plane' }] }],
  },
  'edge-dock': {
    seeds: [0xA1C2],
    plans: [{ name: 'week-1 board, aircraft card', steps: [{ board: 1 }, { take: 'plane' }] }],
  },
  'edge-chip-fill': {
    seeds: [0xA1C2, 41817],
    // The suite samples the chips until the run closes (0xA1C2 ends ~4 h after the board), so only the board counts.
    plans: [{ name: 'week-1 board, aircraft card', steps: [{ board: 1 }, { take: 'plane' }] }],
  },
  'pseudo-locale': {
    seeds: [0xA1A1],
    plans: [
      { name: 'a day of hourly bot play builds routes', steps: [{ hourly: 24 }, { routes: 1 }] },
      { name: 'week-1 board', steps: [{ board: 1 }] },
      { name: 'forced overload', steps: [{ overload: true }] },
    ],
  },
  // [night-12ag] The two suites that build their first route with pointer drags.
  'daily-share': {
    seeds: [],
    dates: ['2026-11-04'],
    plans: [{ name: 'daily: route drag, 120 ticks alive, forced overload', mode: 'daily', steps: [
      { gesture: 'route' }, { ticks: 120, alive: true }, { overload: true },
    ] }],
  },
  'daily-continue': {
    seeds: [],
    dates: ['2026-11-04'],
    plans: [
      { name: 'official: route + aircraft drags, 120 ticks alive, forced overload', mode: 'daily', steps: [
        { gesture: 'route-plane' }, { ticks: 120, alive: true }, { overload: true },
      ] },
      { name: 'practice: 60 ticks alive, forced overload', mode: 'daily', steps: [{ ticks: 60, alive: true }, { overload: true }] },
    ],
  },
  'smoke': {
    seeds: [0xA1A1],
    plans: [{ name: 'route + aircraft drags, week-1 board, plain card, forced overload', steps: [
      { gesture: 'route-plane' }, { board: 1 }, { take: 'plain' }, { overload: true },
    ] }],
  },
  'leaderboard': {
    seeds: [0xA1A1],
    plans: [{ name: 'route + aircraft drags, 240 ticks alive, forced overload', steps: [
      { gesture: 'route-plane' }, { ticks: 240, alive: true }, { overload: true },
    ] }],
  },
  'airport-plates': {
    seeds: [0xA1A1],
    plans: [{ name: '120 ticks in play', steps: [{ ticks: 120, alive: true }] }],
  },
};

/**
 * [night-12be] e2e/session-stub.mjs (the real session on the DEV stub world): Endless seed with home region EUN whose
 * week-1 contract the bot meets (week-2 board: four crates, "+2 slots" marked Contract), whose demand surge is then
 * announced at `surge`, and which, left alone afterwards, fills a tag with a "filling" chevron and jams `jam` before
 * the run ends or the next board opens; with the DEV weather front (R2j) the bot sees the first forecast at `front` in
 * week 3. `date`: the pinned day of its Daily. Replayed headless in test:fast by
 * scripts/test-session-stub.ts (for every airport the "+2 slots" pick can take); `--find` there finds the next seed.
 */
export const SESSION_STUB = Object.freeze({ seed: 0xA1C1, homeRegion: 'EUN', surge: 'HEL', jam: 'WAW', front: 'SFO', date: '2026-11-04' });

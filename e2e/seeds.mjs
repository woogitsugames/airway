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
//   { ticks: n }                       window.aw.advanceTicks(n) (the run may end here)

/** @type {Record<string, { seeds: number[], plans: { name: string, steps: object[] }[] }>} */
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
};

# Airway balance sample — fixture

Mode: **fixture**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

**NOT GAME DATA.** This stand-in has artificial queues, flights, city emergence, and capacity. It is useful only for testing the bot interface and report pipeline. No real parameter tuning or MVP balance is implied.

- Median session: 11.59 min at 1x (target 8–15 min).
- Session range: 9.60–13.13 min.
- Median game weeks: 1.61.
- Median delivered passengers: 2002.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 0/50 (0%) (target ≥ 30%); 3rd: 0/50 (0%).

## Outcomes
- hubOverflow: 50

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:fixture`

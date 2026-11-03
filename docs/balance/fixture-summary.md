# Airway balance sample — fixture

Mode: **fixture**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

**NOT GAME DATA.** This stand-in has artificial queues, flights, city emergence, and capacity. It is useful only for testing the bot interface and report pipeline. No real parameter tuning or MVP balance is implied.

- Median session: 30.00 min at 1x (target 8–15 min).
- Session range: 30.00–30.00 min.
- Median game weeks: 4.17.
- Median delivered passengers: 10420.
- Warnings before failure: 0 / 0 recorded.
- Rejected commands: 0.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 50/50 (100%) (target ≥ 30%); 3rd: 50/50 (100%).

## Outcomes
- censored: 50

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:fixture`

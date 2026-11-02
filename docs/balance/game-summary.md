# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 12.92 min at 1x (target 8–15 min).
- Session range: 3.29–24.84 min.
- Median game weeks: 1.80.
- Median delivered passengers: 63.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.
- Reached the 1st weekly upgrade: 43/50 (86%) (target ≥ 60%); 2nd: 22/50 (44%) (target ≥ 30%); 3rd: 3/50 (6%).

## Outcomes
- hubOverflow: 50

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

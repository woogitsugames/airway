# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 17.81 min at 1x (target 10–18 min, D-79).
- Session range: 3.29–30.00 min.
- Median game weeks: 2.47.
- Median delivered passengers: 147.
- Warnings before failure: 40 / 40 recorded.
- Rejected commands: 0.
- Reached the 1st weekly upgrade: 44/50 (88%) (target ≥ 60%); 2nd: 28/50 (56%) (target ≥ 30%); 3rd: 18/50 (36%).

## Outcomes
- censored: 10
- hubOverflow: 40

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

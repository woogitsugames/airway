# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 17.03 min at 1x (target 10–18 min, D-79).
- Session range: 7.31–30.00 min.
- Median game weeks: 2.37.
- Median delivered passengers: 285.
- Warnings before failure: 49 / 49 recorded.
- Rejected commands: 0.
- Lost in week 1 at an airport beyond turboprop reach when it opened (D-95): 0/50.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 33/50 (66%) (target ≥ 30%); 3rd: 9/50 (18%).

## Outcomes
- censored: 1
- hubOverflow: 49

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

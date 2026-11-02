# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 10.09 min at 1x (target 8–15 min).
- Session range: 3.01–19.95 min.
- Median game weeks: 0.60.
- Median delivered passengers: 44.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.

## Outcomes
- hubOverflow: 50

## Time-scale caution
At 10 ticks per second and one simulated minute per tick, the first 7-day upgrade arrives after 16.80 real minutes. This is later than the upper bound of the 8–15-minute session target. The game-clock design needs an explicit owner decision before balancing weekly upgrades.

## Reproduction
`npm run balance:report`

# Airway balance sample — fixture

Mode: **fixture**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

**NOT GAME DATA.** This stand-in has artificial queues, flights, city emergence, and capacity. It is useful only for testing the bot interface and report pipeline. No real parameter tuning or MVP balance is implied.

- Median session: 10.54 min at 1x (target 8–15 min).
- Session range: 8.85–11.78 min.
- Median game weeks: 0.63.
- Median delivered passengers: 1679.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.

## Outcomes
- hubOverflow: 50

## Time-scale caution
At 10 ticks per second and one simulated minute per tick, the first 7-day upgrade arrives after 16.80 real minutes. This is later than the upper bound of the 8–15-minute session target. The game-clock design needs an explicit owner decision before balancing weekly upgrades.

## Reproduction
`node --experimental-strip-types scripts/balance-report.ts --fixture --report`

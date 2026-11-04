# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 17.41 min at 1x (target 10–18 min, D-79).
- Session range: 7.59–29.45 min.
- Median game weeks: 2.42.
- Median delivered passengers: 288.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.
- Lost in week 1 at an airport beyond turboprop reach when it opened (D-95): 0/50.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 33/50 (66%) (target ≥ 30%); 3rd: 11/50 (22%).

## Outcomes
- hubOverflow: 50

## Spread and mechanic use (R8d)

| 50 runs | p10 | p25 | median | p75 | p90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Session, min at 1x | 11.16 | 13.32 | 17.41 | 20.84 | 24.25 |
| Game weeks | 1.55 | 1.85 | 2.42 | 2.89 | 3.37 |

| Loss week | W2 | W3 | W4 | W5 | not over at the cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Runs | 17 | 22 | 10 | 1 | 0 |

| Losing airport | Hub | Spoke (served) | Unserved (no route) | Spare aircraft at the loss, median | Lost with no spare |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 losses | 21 (42 %) | 15 (30 %) | 14 (28 %) | 0.0 | 48 (96 %) |

| Weekly card | Offered | Picked | Picked when offered |
| --- | ---: | ---: | ---: |
| turboprop | 92 | 54 | 59 % |
| widebody | 95 | 34 | 36 % |
| hub-expansion | 95 | 7 | 7 % |
| departure-slots | 3 | 0 | 0 % |

| Mechanic | Runs | Share | Detail |
| --- | ---: | ---: | --- |
| Curfew reached (week 3+) | 33 | 66 % | of all runs |
| Curfew hold | 32 | 97 % | of runs that reached it; aircraft-min median ground 561, air 89 |
| Slot hold | 5 | 10 % | 8 held departures; slot-wait aircraft-min median 0.0, p90 1.7 |
| Transfer delivery | 50 | 100 % | 8151 of 16610 delivered changed planes (49 %) |

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

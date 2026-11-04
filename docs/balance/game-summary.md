# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 17.25 min at 1x (target 10–18 min, D-79).
- Session range: 7.59–29.45 min.
- Median game weeks: 2.40.
- Median delivered passengers: 288.
- Warnings before failure: 50 / 50 recorded.
- Rejected commands: 0.
- Lost in week 1 at an airport beyond turboprop reach when it opened (D-95): 0/50.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 33/50 (66%) (target ≥ 30%); 3rd: 10/50 (20%).

## Outcomes
- hubOverflow: 50

## Spread and mechanic use (R8d)

| 50 runs | p10 | p25 | median | p75 | p90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Session, min at 1x | 9.94 | 13.27 | 17.25 | 20.58 | 24.25 |
| Game weeks | 1.38 | 1.84 | 2.40 | 2.86 | 3.37 |

| Loss week | W2 | W3 | W4 | W5 | not over at the cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Runs | 17 | 23 | 9 | 1 | 0 |

| Losing airport | Hub | Spoke (served) | Unserved (no route) | Spare aircraft at the loss, median | Lost with no spare |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 losses | 22 (44 %) | 14 (28 %) | 14 (28 %) | 0.0 | 49 (98 %) |

| Weekly card | Offered | Picked | Picked when offered |
| --- | ---: | ---: | ---: |
| turboprop | 91 | 59 | 65 % |
| widebody | 94 | 34 | 36 % |
| hub-expansion | 94 | 1 | 1 % |
| departure-slots | 3 | 0 | 0 % |

| Mechanic | Runs | Share | Detail |
| --- | ---: | ---: | --- |
| Curfew reached (week 3+) | 33 | 66 % | of all runs |
| Curfew hold | 32 | 97 % | of runs that reached it; aircraft-min median ground 502, air 89 |
| Slot hold | 5 | 10 % | 8 held departures; slot-wait aircraft-min median 0.0, p90 1.7 |
| Transfer delivery | 50 | 100 % | 7765 of 15898 delivered changed planes (49 %) |

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

# Airway balance sample — game

Mode: **game**, seeds: **50**, starting at **0xA1A1**, deterministic autoplay.

Production adapter results; inspect scenario coverage before treating these as player performance.

- Median session: 17.67 min at 1x (target 10–18 min, D-79).
- Session range: 7.72–30.00 min.
- Median game weeks: 2.45.
- Median delivered passengers: 304.
- Warnings before failure: 49 / 49 recorded.
- Rejected commands: 0.
- Lost in week 1 at an airport beyond turboprop reach when it opened (D-95): 0/50.
- Reached the 1st weekly upgrade: 50/50 (100%) (target ≥ 60%); 2nd: 37/50 (74%) (target ≥ 30%); 3rd: 10/50 (20%).

## Outcomes
- censored: 1
- hubOverflow: 49

## Spread and mechanic use (R8d)

| 50 runs | p10 | p25 | median | p75 | p90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Session, min at 1x | 11.78 | 14.05 | 17.67 | 20.67 | 24.20 |
| Game weeks | 1.64 | 1.95 | 2.45 | 2.87 | 3.36 |

| Loss week | W2 | W3 | W4 | W5 | not over at the cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Runs | 13 | 27 | 8 | 1 | 1 |

| Losing airport | Hub | Spoke (served) | Unserved (no route) | Spare aircraft at the loss, median | Lost with no spare |
| --- | ---: | ---: | ---: | ---: | ---: |
| 49 losses | 20 (41 %) | 16 (33 %) | 13 (27 %) | 0.0 | 48 (98 %) |

| Weekly card | Offered | Picked | Picked when offered |
| --- | ---: | ---: | ---: |
| turboprop | 95 | 52 | 55 % |
| widebody | 99 | 37 | 37 % |
| hub-expansion | 99 | 10 | 10 % |
| departure-slots | 4 | 0 | 0 % |

| Mechanic | Runs | Share | Detail |
| --- | ---: | ---: | --- |
| Curfew reached (week 3+) | 37 | 74 % | of all runs |
| Curfew hold | 30 | 81 % | of runs that reached it; aircraft-min median ground 706, air 0 |
| Slot hold | 7 | 14 % | 9 held departures; slot-wait aircraft-min median 0.0, p90 17.7 |
| Transfer delivery | 50 | 100 % | 8265 of 17001 delivered changed planes (49 %) |

## Time scale
At 10 ticks per second and one simulated minute per tick, a 3-day week (D-40) lasts 7.20 real minutes at 1x, so the first weekly upgrade opens at that point of a run and the second at 14.40 min.

## Reproduction
`npm run balance:report`

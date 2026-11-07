# Weather ground-hold balance (D-290)

Paired Endless bot runs, fixed seeds 0xA1A1 onward, weekly contract and demand surge on; the bot does not react to weather. The shipped front remains disabled. Each variant holds every ready departure under the deck for up to the listed minutes, removes the old slot penalty and otherwise uses the same seed and bot. Counts include only `DepartureHeld` events whose reason is weather, once per ready departure, including a weather hold after an earlier slot hold.

| Hold | Seeds | Median off / on (min) | p10-p90 off / on (min) | Weather holds | Runs with a weather hold | Longer / shorter / equal |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 17.41 / 17.42 | 11.16-23.07 / 11.16-23.07 | 162 | 34 | 7 / 3 / 40 |
| 15 | 200 | 16.75 / 16.78 | 9.91-22.31 / 9.91-21.99 | 677 | 128 | 23 / 5 / 172 |
| 30 | 50 | 17.41 / 17.33 | 11.16-23.07 / 11.16-23.07 | 154 | 34 | 8 / 4 / 38 |
| 30 | 200 | 16.75 / 16.80 | 9.91-22.31 / 9.91-21.99 | 647 | 128 | 27 / 8 / 165 |
| 60 | 50 | 17.41 / 17.69 | 11.16-23.07 / 11.16-23.07 | 156 | 34 | 11 / 4 / 35 |
| 60 | 200 | 16.75 / 16.82 | 9.91-22.31 / 9.91-21.99 | 619 | 128 | 30 / 9 / 161 |

The old 200-seed slot-only rule produced one slot hold under a front and no changed run lengths (previous R2j report). The 15-minute variant was selected for its shorter hold while affecting most runs and keeping the D-79 median in range. This is bot evidence, not a measurement of player perception. The held-event count is not total wait time. Runs without a served airport under a front stayed identical in every sample.

Reproduce the selected variant with `npm run balance:weather -- --seeds=200` (the command regenerates this report). The alternatives require changing the versioned parameter locally and restoring it afterward.

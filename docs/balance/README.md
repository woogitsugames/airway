# Task 22 — autoplay and balance evidence

## N12ab — spread and mechanic use in `balance:report` (R8d, 2026-11-04, D-196, no gate)

`npm run balance:report` now ends `game-summary.md` with a "Spread and mechanic use" section, so a balance PR can
quote the tail and not only the median. It is counted in `scripts/balance-game-adapter.ts` from the sim's own events
and read-only views (no prototype wrapping, unlike `r8-audit.ts`): `CurfewHeld` (new: one aircraft-minute refused by
the curfew gate, on the ground or in the air), `DepartureHeld`, `Delivered` (new field `afterTransfer`: delivered
passengers who changed planes), `UpgradeOffered`/`UpgradeChosen`, `hubCauseLedger().slotWaitMinutes`, and the losing
airport's `cityView` (hub, routes) with the reserve at the loss. The events are non-authoritative (never hashed or
saved), so no golden, replay or balance number moved (median 17.25 min before and after). `test:balance` checks the
section's shape (ordered quantiles, counts that add up), not its values.

Same 50 seeds from 0xA1A1 as the gate, bot at 1×, 30 min cap (rules v6, N12z bot):

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

Cross-check with `r8-audit.ts --seeds=50 --cap-min=30` (prototype counters): the quantiles, loss airports (hub 44 %,
0 routes 14), spare aircraft (0 in 98 %), cards offered/picked, curfew runs 33/32, slot holds 5/50 (p90 1.7) and the
transfer share (7765/15898) match exactly. Only the curfew aircraft-minutes differ (r8: ground 468, air 586): r8's
`canLand` wrapper also counted the landing check inside `canScheduleLeg`, so its "air" minutes include ground
refusals; `CurfewHeld` counts each refused gate call once. Read with care: the loss weeks start at W2 because every
bot run reaches the first board (D-95), hub expansion is almost never the bot's pick, and "+2 slots" is rarely drawn
(it enters the draw only after the first hold, D-150) — the bot, not a human, makes these numbers.

## R8 — gameplay-depth audit script (research, 2026-11-03, no parameter change)

`scripts/research/r8-audit.ts` is a read-only measurement tool, not a test (not in `test:fast`/`test:ci`). It plays
the same bot through `balance-game-adapter.ts` at the same cadence as `balance:report`, with a longer cap, and
prints the session-length spread, loss week × cause (`buildCauseReport`), hub / spoke / unserved losses, spare
aircraft at the loss, weekly cards offered vs picked, curfew and slot holds, and the share of delivered passengers
who transferred. `--policy=turboprop|widebody|hub|slots|all` makes the bot take that card whenever offered.
Counting wraps `PassengerSimulation.prototype.alightAt` and `CurfewPlanner` gate methods inside its own process and
returns their results unchanged. Check: `--seeds=50 --cap-min=30` gives p50 17.03 min, equal to `test:balance`.
Results and tables: `docs/RESEARCH.md` "R8"; per-run data `r8-audit-200.csv`.

```sh
node --import ./scripts/ts-test-loader.mjs scripts/research/r8-audit.ts --seeds=200 --cap-min=60 --policy=all \
  --csv=docs/balance/r8-audit-200.csv
```

## N9b — bot session target 10–18 min (2026-11-03, D-79)

The owner moved the `test:balance` median gate from 8–15 to 10–18 min: the target measures the DEV bot, which plays
better since N7w (median 14.55 min), not a human. No game parameter changed; the 1st/2nd upgrade shares (≥ 60 % /
≥ 30 %) stay. Older sections below keep the 8–15 min target they were tuned against.

## Task 32 — departure slots enforced (2026-11-02, D-41, D-46)

Ready aircraft now wait on the ground until their airport has a free departure slot in the current game hour.
The base allowance was picked with the task-22 bot on the same 50 seeds (from 0xA1A1, 30 min cap, actions every
30 ticks); `task32-slot-sweep.csv` has the sweep:

| City / hub slots per hour | Held departures | Runs with a hold | Slot-wait aircraft-min | Bot "+2 slots" picks | Median | 1st / 2nd upgrade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 / 6 (task suggestion) | 0 | 0/50 | 0 | 0 | 12.92 min | 86 % / 44 % |
| 3 / 4 | 0 | 0/50 | 0 | 0 | 12.92 min | 86 % / 44 % |
| **2 / 3 (chosen)** | 16 | 9/50 | 225 | 0 | 12.92 min | 86 % / 44 % |
| 1 / 2 | 102 | 32/50 | 1600 | 14 | 12.92 min | 86 % / 40 % |

The bot runs 4–6 aircraft, so at 4/6 or 3/4 slots never bind and the rule would be invisible. 2/3 is the
largest allowance that the bot still meets (mostly when two aircraft share a stop or after curfew), without
moving any task-31 target; a human player who stacks several aircraft on one airport meets it sooner, which is
when "+2 slots" becomes a real choice. 1/2 starts to cost the 2nd upgrade. `game-50.csv` was regenerated with
2/3: only two seeds deliver one more passenger (the first-ready-first-out queue), session times are unchanged.
`npm run test:balance`: `median_min=12.92 upgrade1=0.86 upgrade2=0.44 passed=1`.

## Task 31 — 3-day week and rebalance (2026-11-02, D-40, D-43)

A game week now lasts **3 in-game days** (`SIM_DAYS_PER_WEEK` in `src/sim/params.ts`, the only definition).
At 1 game minute per tick and 10 ticks/s a week is **7.2 real minutes at 1×**, so the first weekly board opens at
7.2 min and the second at 14.4 min. The bot policy (`src/game/dev/bot-policy.ts`) is unchanged.
`npm run balance:report` / `npm run test:balance` now also count accepted `ChooseUpgrade` commands
(`upgrades` column) and gate ≥ 60 % of seeds at the 1st and ≥ 30 % at the 2nd upgrade; both use all 50 seeds.

| 50 seeds from 0xA1A1, bot at 1× | Median | Range | ≥ 1 upgrade | ≥ 2 upgrades | ≥ 3 | Median delivered | CSV |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Before: 7-day week, task-22 params | 10.09 min | 3.01–19.95 | 3 (6 %) | 0 | 0 | 44 | `task31-before-7day-50.csv` |
| 3-day week only, task-22 params | 10.28 min | 3.01–19.95 | 34 (68 %) | 6 (12 %) | 0 | 46 | `task31-3day-old-params-50.csv` |
| **After: 3-day week + rebalance** | **12.92 min** | 3.29–24.84 | **43 (86 %)** | **22 (44 %)** | 3 (6 %) | 63 | `game-50.csv` |

Parameter changes (marked `[task-31 balance]` in `params.ts`):

| Parameter | Before | After | Why |
| --- | --- | --- | --- |
| `SIM_DAYS_PER_WEEK` | 7 | 3 | Owner decision D-40 |
| `SPAWNER_INTERVAL_HOURS` | 12 | 16 | 4.5 new cities per 3-day week instead of 6; the network grows at a pace one bot upgrade can follow |
| `HUB_WAITING_CAPACITY` / `CITY_WAITING_CAPACITY` | 30 / 20 | 36 / 24 | More headroom before a jam, so runs reach the 2nd board |

The shorter week alone fixes the 1st upgrade (68 %) but not the 2nd (12 %). Variants tried on the same 50 seeds
(spawn h / hub cap / city cap / start turboprops → median, ≥1, ≥2): 12/30/20/5 → 11.24, 70 %, 16 %;
12/36/24/4 → 11.00, 76 %, 18 %; 12/40/26/4 → 11.61, 78 %, 30 %; 14/36/24/4 → 12.00, 82 %, 36 %;
18/30/20/4 → 13.03, 84 %, 40 %; **16/36/24/4 → 12.92, 86 %, 44 %** (chosen: best upgrade margins with the median
centred in 8–15 min); 16/40/26/4 → 13.32, 92 %, 44 %. The old 10-seed gate was biased high (its 10-seed median
was 15.72 min for the chosen set), so the gate now uses the full 50-seed sample (~4 s).

Puzzles (`src/data/puzzles/**`) do not use weekly upgrades and set their own hub capacities; on the new week the
reference solutions deliver exactly the same numbers as before (all 15 win with a 25–26 % margin, a zero-command run
loses), so the targets stay as recalibrated in D-38: `puzzles-week3.csv`.
The fixture stand-in (`fixture-50.csv`) changed only because it also opens its board every week (median 11.59 min).


## Integration status (2026-11-02, integration/sim)

The bot now drives the **real authoritative Sim** through `scripts/balance-game-adapter.ts`
(commands via `Sim.check/apply`, read-only `sim.world` views). Changes made to reach the
8–15 min target (all marked `[task-22 balance, integration]` in `src/sim/params.ts`):

| Parameter | Before | After |
| --- | --- | --- |
| `SPAWNER_INTERVAL_HOURS` | 4 | 12 |
| `DEMAND_PASSENGERS_PER_MILLION_PER_DAY` | 3 | 1 |
| `HUB_WAITING_CAPACITY` / `CITY_WAITING_CAPACITY` | 10 / 5 | 30 / 20 |
| `INITIAL_PLANE_RESERVE.turboprop` | 2 | 4 |
| Start cluster | one region | anchor + nearest foreign-region city (passengers only fly to other regions) |

Before (first real run): 10-seed median **1.59 min**, 0 passengers delivered in most runs.
After: 10-seed median **11.26 min**, 50-seed median **10.09 min** (range 3.01–19.95),
median 44 delivered, 50/50 failures preceded by a visible jam countdown (`game-50.csv`,
`game-summary.md`). Median session < 1 game week, so weekly upgrades rarely happen — the
time-scale question below still needs the owner. Puzzle targets were recalibrated against
the real Sim: `puzzles-real-sim.csv`.

## Commands

```sh
# Runs 10 real-game seeds, requires a wired engine adapter; fails if absent.
npm run test:balance

# Runs 50 real-game seeds and writes docs/balance/game-50.csv and summary.
npm run balance:report

# Smoke checks the bot policy and report loop with the isolated stand-in.
npm run test:balance:fixture

# Writes docs/balance/fixture-50.csv and fixture-summary.md.
npm run balance:fixture
```

The production runner looks for `scripts/balance-game-adapter.ts` by default;
`--adapter=relative/path/to/module.ts` overrides the path. The adapter exports
`createBalanceSession(seed)`, returning an object with four methods:

- `snapshot(): BotSnapshot` — observe immutable city, route, inventory, offered
  upgrades, ledger, warnings and game phase; see `scripts/bot.ts`.
- `dispatch(command: BotCommand): boolean` — forward each decision as an actual
  validated simulation command, returning false if rejected.
- `advance(ticks: number): void` — advance deterministic simulation time, not
  real wall-clock time.
- `outcome(): { reason, score, warned, warningLeadTicks }` — expose the real
  game-over cause, delivered-passenger score, and **consecutive** warning lead
  ticks preceding failure (not merely an earlier, cleared warning).

The runner checks deterministic replay on a fixed seed, rejects invalid bot
commands, fails if a real overflow lacks warning lead time and gates the actual
median at **10–18 wall minutes at 1×** (D-79, 2026-11-03; it was 8–15 until N9b). The 50-seed report has per-seed
CSV data, score, causes and real duration. **A snapshot warning field does not
verify that the UI displayed the countdown**; that requires an integrated UI
or screenshot/e2e test after task 06/15.

## Fixture-only exploratory comparison (50 identical seeds)

| Autoplay policy | Median at 1× | Range | Outcome |
| --- | ---: | ---: | --- |
| Before: assign every time a served route has 8+ waiting | 2.89 min | See `fixture-bot-before.csv` | Premature fleet depletion |
| After: preserve planes unless queue exceeds 24 × (assigned + 1) | 10.54 min | 8.85–11.78 min | Hub overflow with warning |

`fixture-bot-before.csv` and `fixture-bot-before-summary.md` are immutable
baseline artifacts; the report command regenerates only the *after* fixture
files (`fixture-50.csv` and `fixture-summary.md`). These are generated using
an **artificial deterministic queue service model** inside the reporting script,
not actual Airway gameplay. The comparison tests a bot decision rule; it does
not justify changing `src/sim/params.ts`.

## Calendar discrepancy requiring a decision (resolved by D-40, task 31)

Task 01 specifies 10 fixed ticks per real second and one game minute per tick.
At that speed a seven-day game week takes **16.8 real minutes**, beyond the
upper end of the target 8–15-minute median. Players would commonly lose before
their first weekly upgrade. Recommended option for owner review: keep the
fixed 100 ms simulation step but advance **three game minutes per tick**,
putting a game week at 5.6 real minutes. Revisit flight times, hub minimum
connection time, curfews and all relevant balance parameters together before
implementing this change. Nothing is changed unilaterally in this task.

## Conditions for real acceptance

After 08/09/12 are merged, adapt to the actual sim commands and snapshots;
run the 50-seed baseline, change only versioned values in `src/sim/params.ts`,
then produce before/after production CSVs and a green `npm run test:balance`.
Re-test after rebasing on the new `dev`. The owner must inspect the real failure
countdown in the game UI before calling the failure visually fair.

## Night N12f — week-1 reach and a faster pace (rules v5, D-95, D-105, D-106)

Owner decision D-95 (Q-51 → B): before the first weekly board (the first chance of a widebody) a new airport opens
only within turboprop range (2,500 km) of an open airport; D-105 narrows the start radius 3,000 → 2,500 km so the
start group follows the same rule; D-99 (Q-58) moves Alexandria to region ME with Cairo. The fairer week 1 alone made
the bot sample much longer (median 17.81 → 24.43 min, 200 seeds 17.53 → 23.48), so the pace was raised with two
versioned values in `src/sim/params.ts`: `SPAWNER_INTERVAL_HOURS` 16 → 12 (6 airports per week instead of 4.5) and
the new `DEMAND_RATE_PERCENT` = 130.

| Rules | Median (50 seeds) | Median (200 seeds) | 1st / 2nd board | Week-1 losses at an airport beyond reach |
| --- | --- | --- | --- | --- |
| v4 (before, `n12f-rules-v4-before-50.csv`) | 17.81 min | 17.53 min | 88 % / 56 % | 5 / 50 |
| reach rule only, 16 h, 100 % | 24.43 min | 23.48 min | — | 0 / 50 |
| **v5: 12 h, 130 %** (`game-50.csv`) | **17.03 min** | 16.52 min | 100 % / 66 % | **0 / 50** |

Sweep (50 seeds, median min): 16 h × 115 % 22.28, × 120 % 22.08, × 140 % 20.81; 14 h × 130 % 20.63; 13 h × 120 %
20.07; 12 h × 110 % 19.60, × 120 % 18.84, × 130 % 17.03; 11 h × 100 % 18.75, × 110 % 17.57; 10 h × 110 % 16.71,
× 120 % 16.21. The interval changes the whole spawn sequence, so neighbouring values are not monotonic; 12 h × 130 %
was chosen because its 200-seed median (16.52) agrees with the gated 50-seed one. `test:balance` now also fails on any
week-1 loss at an airport that opened beyond turboprop reach (`week1_unreachable`, CSV column `week1_unreachable`).

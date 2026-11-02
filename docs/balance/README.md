# Task 22 — autoplay and balance evidence

## Integration status (2026-11-02)

**Blocked on task 08 (passengers/hubs), 09 (aircraft) and 12 (weekly upgrades).**
The `dev` branch contains only task 01's scaffold. `src/sim/sim.ts`, the
passenger ledger, routes, aircraft and upgrades do not exist there yet.
Consequently **no production balance parameters were changed** and no
production 50-seed results exist. Do not ship or approve the MVP balance based
on the fixture outputs below.

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
10-seed median at **8–15 wall minutes at 1×**. The 50-seed report has per-seed
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

## Calendar discrepancy requiring a decision

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

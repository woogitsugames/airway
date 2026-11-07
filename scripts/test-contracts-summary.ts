// [night-33a] D-271: weekly contracts met on the Endless game-over report. The pure helper (src/game/contractsSummary.ts)
// counts closed contracts plus the running one (met once it reached its target), one mark per contract in week order,
// and returns null for a run that never saw a contract. Bot runs from 0xA1A1 with the contract (the test:balance bot,
// to the jam): the summary's `met` equals the run's ContractMet events and `offered` every contract the boards drew;
// reading it leaves the Sim hash unchanged (D-13). Daily has no contracts (null). The report text reads PL/EN within
// its length budget; the session passes the row in Endless only. Fails on the old code: no helper, no keys.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import type { ContractRecord, WeeklyContract } from '../src/sim/contracts.ts';
import { contractsSummary } from '../src/game/contractsSummary.ts';
import { t, setLanguage } from '../src/i18n/index.ts';
import { lengthBudget, textLength } from '../src/i18n/limits.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from './bot.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const contract = (week: number, delivered: number, target = 20): WeeklyContract =>
  ({ week, regions: ['EUN', 'NAM'], target, delivered });
const record = (week: number, met: boolean): ContractRecord => ({ ...contract(week, met ? 20 : 3), met });

function botRun(seed: number, mode: 'endless' | 'daily', withContract: boolean, maxTicks = 18_000) {
  const session = createBalanceSession(seed, mode, null, withContract);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}

test('no contract seen: no row (null)', () => {
  assert.equal(contractsSummary(null, []), null);
});
test('the running contract counts as offered; as met only once it reached its target', () => {
  assert.deepEqual(contractsSummary(contract(1, 5), []), { met: 0, offered: 1, marks: [false] });
  assert.deepEqual(contractsSummary(contract(1, 20), []), { met: 1, offered: 1, marks: [true] });
  assert.deepEqual(contractsSummary(contract(1, 31), []), { met: 1, offered: 1, marks: [true] });
});
test('closed contracts keep their recorded result, marks in week order (none, some, all met)', () => {
  assert.deepEqual(contractsSummary(null, [record(1, false), record(2, false)]), { met: 0, offered: 2, marks: [false, false] });
  assert.deepEqual(contractsSummary(contract(4, 2), [record(1, true), record(2, false), record(3, true)]),
    { met: 2, offered: 4, marks: [true, false, true, false] });
  assert.deepEqual(contractsSummary(contract(3, 25), [record(1, true), record(2, true)]), { met: 3, offered: 3, marks: [true, true, true] });
  // A week without a contract (no pair qualified) leaves no gap mark; out-of-order input is sorted by week.
  assert.deepEqual(contractsSummary(contract(5, 0), [record(3, true), record(1, false)]).marks, [false, true, false]);
});

test(`bot runs from 0x${SEED.toString(16).toUpperCase()}: met = ContractMet events, offered = contracts drawn; hash unchanged`, () => {
  let seen = 0;
  for (let seed = SEED; seed < SEED + 4; seed++) {
    const full = botRun(seed, 'endless', true);
    const log = full.getCommandLog();
    const sim = new Sim(full.seed, full.config);
    let metEvents = 0;
    let index = 0;
    while (sim.tickCount < full.tickCount) {
      while (index < log.length && log[index]![0] === sim.tickCount + 1) sim.apply(log[index++]![1]);
      sim.tick();
      metEvents += sim.drainEvents().filter((event) => event.type === 'ContractMet').length;
    }
    const before = sim.hash();
    assert.equal(before, full.hash(), `seed ${seed}: replay matches the run`);
    const summary = contractsSummary(sim.world.contract, sim.world.contractHistory);
    assert.equal(sim.hash(), before, 'reading the summary does not touch the Sim');
    const offered = sim.world.contractHistory.length + (sim.world.contract ? 1 : 0);
    if (!offered) { assert.equal(summary, null); continue; }
    assert.ok(summary, `seed ${seed}: a summary`);
    assert.equal(summary.met, metEvents, `seed ${seed}: met ${summary.met} vs ${metEvents} ContractMet events`);
    assert.equal(summary.offered, offered);
    assert.equal(summary.marks.length, offered);
    console.log(`  seed 0x${seed.toString(16).toUpperCase()}: week ${Math.floor(sim.tickCount / TICKS_PER_WEEK) + 1}, contracts ${summary.met}/${summary.offered} [${summary.marks.map((m) => (m ? '■' : '□')).join('')}]`);
    seen++;
  }
  assert.ok(seen >= 2, `only ${seen} runs saw a contract`);
});
test('Daily and an Endless run without the contract flag: no row', () => {
  for (const [mode, flag] of [['daily', false], ['endless', false]] as const) {
    const sim = botRun(SEED, mode, flag, 3 * TICKS_PER_WEEK);
    assert.equal(contractsSummary(sim.world.contract, sim.world.contractHistory), null, `${mode}`);
  }
});
test('report text PL/EN: "Kontrakty: 2 z 4" / "Contracts: 2 of 4", spoken label reads both numbers, within budget', () => {
  const budget = lengthBudget('gameover.contracts.title');
  assert.ok(budget);
  for (const [language, title, label] of [
    ['pl', 'Kontrakty: 2 z 4', 'Spełnione kontrakty tygodnia: 2 z 4'],
    ['en', 'Contracts: 2 of 4', 'Weekly contracts met: 2 of 4'],
  ] as const) {
    setLanguage(language);
    assert.equal(t('gameover.contracts.title', { met: 2, offered: 4 }), title);
    assert.equal(t('gameover.contracts.label', { met: 2, offered: 4 }), label);
    assert.ok(textLength(t('gameover.contracts.title', { met: 12, offered: 24 })) <= budget!, `${language} over budget`);
  }
  setLanguage('en');
});
test('the session passes the row in Endless only; the report draws it under the milestones', () => {
  const session = readFileSync(new URL('../src/game/session.ts', import.meta.url), 'utf8');
  assert.match(session, /run\.mode === 'endless' \? contractsSummary\(run\.sim\.world\.contract, run\.sim\.world\.contractHistory\) : null/);
  const report = readFileSync(new URL('../src/ui/gameover/index.ts', import.meta.url), 'utf8');
  const milestones = report.indexOf('strip.append(milestoneRow(');
  const contracts = report.indexOf('strip.append(contractRow(');
  assert.ok(milestones > 0 && contracts > milestones, 'contracts row after the milestones row');
});

console.log(`SUMMARY test:contracts-summary seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

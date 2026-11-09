// [night-12ba] R2k / D-247: the weekly contract. Daily (and its leaderboard replay) and Endless runs without the
// contract flag are bit-for-bit the pre-R2k game (hashes pinned from origin/dev 61f50fd); new Endless runs carry the
// flag; the board names a contract between two open regions with a demand-based target; deliveries between the two
// regions (either way) count; a met contract adds one card to the next board (marked, drawn after the usual ones,
// no extra RNG call without it) and a crate that cannot be shown waits; the contract survives save/restore, the
// v2 -> v3 envelope bump and the D-76 replay; the pause sheet shows the progress. Fails on the old code: no
// contracts module, no weeklyContract config, no extra crate.
import assert from 'node:assert/strict';
import { createGame, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import {
  closeContract, contractTarget, countsFor, drawContract, EMPTY_CONTRACTS, validContractSnapshot, type WeeklyContract,
} from '../src/sim/contracts.ts';
import { drawUpgradeBoard, drawUpgradeOffers, startWeeklyUpgrade, cancelUpgradePick } from '../src/sim/upgrades.ts';
import { CONTRACT_MAX_PASSENGERS, CONTRACT_MIN_PASSENGERS } from '../src/sim/params.ts';
import { REGION_IDS } from '../src/data/regions.ts';
import { decodeSave, encodeSave, restoreSimDetailed, saveSourceFromSim, SAVE_VERSION } from '../src/game/save.ts';
import { EndlessRun, ENDLESS_WEEKLY_CONTRACT } from '../src/game/run.ts';
import { pauseSummary } from '../src/game/pauseSummary.ts';
import { setLanguage } from '../src/i18n/index.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from './bot.ts';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The balance bot to the end of the run (or `maxTicks`), as test:balance plays it. */
function botRun(seed: number, mode: 'endless' | 'daily', contract: boolean, maxTicks = 18_000) {
  // [night-86a] D-343: pinned pre-D-343 bot runs, so the UTC-midnight start (new runs: test:morning-start).
  const session = createBalanceSession(seed, mode, null, contract, false, 1, false, false);
  for (let i = 0; i < 2000; i++) {
    const snapshot = session.snapshot();
    if (snapshot.status === 'finished' || snapshot.tick >= maxTicks) break;
    const decision = chooseBotAction(snapshot);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session;
}
/** FNV-1a over the envelope fields in the order save.ts checksums them (to forge an older envelope as written). */
function checksum(body: Record<string, unknown>): string {
  const data = JSON.stringify([body.v, body.savedAt, body.seed, body.tick, body.snapshot, body.commands,
    body.stateHash, body.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { hash ^= data.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function stateOf(sim: Sim) { return JSON.parse(sim.snapshot()).state; }

// Bot runs on origin/dev 61f50fd (before R2k): final hash, tick, score. Daily = the leaderboard world.
const GOLDEN: Record<string, { hash: string; tick: number; score: number }> = {
  'daily:41377': { hash: '61693056', tick: 6958, score: 163 },
  'daily:45746': { hash: '060b04c6', tick: 12178, score: 565 },
  'daily:50115': { hash: '1225dcd9', tick: 9659, score: 116 },
  'endless:41377': { hash: '6a2d0971', tick: 6958, score: 163 },
  'endless:45746': { hash: '72ed8fcb', tick: 12178, score: 565 },
  'endless:50115': { hash: '608b0fd2', tick: 9659, score: 116 },
};

// A contract run whose week-1 contract is met (found once; the scan is deterministic).
let metSeed = 0;
for (let seed = 0xA1A1; seed < 0xA1A1 + 60 && !metSeed; seed++) {
  const session = botRun(seed, 'endless', true, 2 * TICKS_PER_WEEK + 10);
  if (session.contracts().extraBoards > 0) metSeed = seed;
}

await test('Daily and Endless without the flag: bit-for-bit the pre-R2k bot runs (leaderboard replay unchanged)', () => {
  for (const [key, want] of Object.entries(GOLDEN)) {
    const [mode, seed] = key.split(':') as ['daily' | 'endless', string];
    const sim = botRun(Number(seed), mode, false).simulation;
    assert.deepEqual({ hash: sim.hash(), tick: sim.tickCount, score: sim.world.score }, want, key);
    assert.equal(stateOf(sim).world.contracts, undefined, `${key}: no contract record`);
    assert.equal(sim.world.contract, null);
    if (mode === 'daily') {
      const replay = Sim.replay(sim.seed, sim.getCommandLog(), sim.tickCount, { mode: 'daily' }, true);
      assert.equal(replay.hash(), want.hash, `${key}: server replay`);
    }
  }
  assert.equal(RULES_VERSION, 6, 'rules version unchanged (the flag keeps old runs as they were)');
});

await test('config: new Endless runs carry the contract; Daily, puzzles and bad values refuse it', () => {
  assert.equal(ENDLESS_WEEKLY_CONTRACT, true);
  // [night-12bb] R2i: new Endless runs also carry the demand surge (D-249, test:demand-surge).
  assert.deepEqual(EndlessRun.create(1).sim.config, { mode: 'endless', weeklyContract: true, demandSurge: true, morningStart: true });
  assert.deepEqual(EndlessRun.create(1, 'endless', 'EUN').sim.config, { mode: 'endless', homeRegion: 'EUN', weeklyContract: true, demandSurge: true, morningStart: true });
  assert.deepEqual(EndlessRun.create(1, 'daily').sim.config, { mode: 'daily', morningStart: true });
  assert.deepEqual(createGame(1).config, { mode: 'endless' }, 'the facade keeps the old default');
  assert.deepEqual(createGame(1, 'daily', undefined, null, true).config, { mode: 'daily' }, 'the facade drops it for Daily');
  assert.throws(() => new Sim(1, { mode: 'daily', weeklyContract: true }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'puzzle', puzzleId: 'p01', weeklyContract: true }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'endless', weeklyContract: false as never }), /configuration/);
});

await test('the week-1 board names a contract between two open regions, target within the bounds, deterministic', () => {
  let seen = 0;
  for (const seed of [0xA1A1, 0xB2B2, 0xC3C3, 7, 123456]) {
    assert.equal(createGame(seed, 'endless', undefined, null, true).world.contract, null, 'no contract before the first board');
    const sim = botRun(seed, 'endless', true, TICKS_PER_WEEK).simulation;
    if (sim.world.status !== 'upgrade') continue; // the bot lost in week 1
    seen++;
    const contract = sim.world.contract;
    if (!contract) continue; // too little demand between every pair: no contract this week (allowed)
    assert.equal(contract.week, 1);
    assert.equal(contract.delivered, 0);
    const open = new Set(sim.world.cities().map((city) => city.regionId));
    assert.ok(open.has(contract.regions[0]) && open.has(contract.regions[1]) && contract.regions[0] !== contract.regions[1]);
    assert.ok(REGION_IDS.indexOf(contract.regions[0] as never) < REGION_IDS.indexOf(contract.regions[1] as never));
    assert.ok(contract.target >= CONTRACT_MIN_PASSENGERS && contract.target <= CONTRACT_MAX_PASSENGERS, `target ${contract.target}`);
    const again = botRun(seed, 'endless', true, TICKS_PER_WEEK).simulation;
    assert.deepEqual(again.world.contract, contract);
    assert.equal(again.hash(), sim.hash());
  }
  assert.ok(seen >= 3, `${seen} runs reached the week-1 board`);
});

await test('the contract does not move the run: offers and passengers match the run without it', () => {
  const plain = createGame(0xB2B2);
  const contract = createGame(0xB2B2, 'endless', undefined, null, true);
  plain.advance(TICKS_PER_WEEK);
  contract.advance(TICKS_PER_WEEK);
  assert.deepEqual(contract.world.offer, plain.world.offer);
  assert.equal(contract.world.score, plain.world.score);
  assert.deepEqual(contract.world.cities(), plain.world.cities());
});

await test('pure rules: draw, target, either-direction counting, closing, extra crate draw', () => {
  const estimate = (a: string, b: string) => (a === 'EUN' && b === 'ME' ? 20 : b === 'EUN' && a === 'ME' ? 10 : a === 'NAM' ? 500 : 1);
  assert.equal(contractTarget('EUN', 'ME', estimate), 30);
  assert.equal(contractTarget('NAM', 'EUS', estimate), CONTRACT_MAX_PASSENGERS, 'capped');
  assert.equal(drawContract(1, 1, ['EUN'], estimate), null, 'one region: no contract');
  assert.equal(drawContract(1, 1, ['AFR', 'ASI'], estimate), null, 'too little demand: no contract');
  const only = drawContract(1, 2, ['ME', 'EUN', 'AFR'], estimate);
  assert.deepEqual(only, { week: 2, regions: ['EUN', 'ME'], target: 30, delivered: 0 }, 'the only pair over the minimum, in region order');
  const c: WeeklyContract = { week: 2, regions: ['EUN', 'ME'], target: 2, delivered: 0 };
  assert.ok(countsFor(c, 'EUN', 'ME') && countsFor(c, 'ME', 'EUN'));
  assert.ok(!countsFor(c, 'EUN', 'AFR') && !countsFor(c, undefined, 'ME'));
  const missed = closeContract({ ...EMPTY_CONTRACTS, current: { ...c, delivered: 1 } });
  assert.deepEqual(missed, { current: null, bonusCrates: 0, history: [{ ...c, delivered: 1, met: false }] });
  const met = closeContract({ current: { ...c, delivered: 2 }, bonusCrates: 1, history: [] });
  assert.equal(met.bonusCrates, 2);
  assert.ok(validContractSnapshot(met) && !validContractSnapshot({ ...met, bonusCrates: -1 }));
  assert.ok(!validContractSnapshot({ ...met, current: { ...c, regions: ['EUN', 'EUN'] } }));
  // Extra crate: same RNG calls without it; with it one card more, drawn from the cards not on the board.
  for (let seed = 1; seed < 40; seed++) {
    const calls = (extra: boolean, eligible = { hub: true, slots: true }) => {
      const seen: number[] = [];
      let state = seed;
      const rng = { nextInt: (max: number) => { state = (Math.imul(state, 1103515245) + 12345) >>> 0; seen.push(max); return state % max; } };
      return { board: drawUpgradeBoard(3, rng, eligible, extra), seen };
    };
    const base = calls(false);
    assert.deepEqual(drawUpgradeOffers(3, { nextInt: () => 0 }), drawUpgradeBoard(3, { nextInt: () => 0 }).offers);
    assert.equal(base.board.extraCrate, undefined);
    const extra = calls(true);
    assert.equal(extra.board.offers.length, 4, 'every card on a full pool');
    assert.ok(extra.board.extraCrate && extra.board.offers.some((o) => o.id === extra.board.extraCrate));
    assert.equal(new Set(extra.board.offers.map((o) => o.id)).size, 4);
    const noHub = calls(true, { hub: false, slots: false });
    assert.ok(!noHub.board.offers.some((o) => o.id === 'hub-expansion'), 'no hub card without a hub');
    assert.equal(noHub.board.offers.length, 3, 'two aircraft + slots');
    assert.equal(noHub.board.extraCrate, 'departure-slots', '+2 slots can always act');
    const full = calls(true, { hub: false, slots: true });
    if (full.board.offers.length === 3) assert.equal(full.board.extraCrate, undefined, 'nothing left: no card');
  }
  const offer = startWeeklyUpgrade(TICKS_PER_WEEK, { nextInt: () => 0 }, { hub: true, slots: true }, true)!;
  assert.ok(offer.extraCrate);
  const picked = { ...offer, pendingHub: true, selected: 'hub-expansion' as const };
  assert.equal(cancelUpgradePick(picked, offer.week).extraCrate, offer.extraCrate, 'Back keeps the contract crate');
});

await test(`a met contract adds a marked fourth crate to the next board (seed ${metSeed.toString(16)})`, () => {
  assert.ok(metSeed, 'some seed among 60 meets its week-1 contract');
  const session = botRun(metSeed, 'endless', true, 2 * TICKS_PER_WEEK + 10);
  const world = session.simulation.world;
  const first = world.contractHistory[0]!;
  assert.equal(first.week, 1);
  assert.ok(first.met && first.delivered >= first.target);
  const plain = botRun(metSeed, 'endless', false, 2 * TICKS_PER_WEEK + 10).simulation.world;
  const contracts = session.contracts();
  assert.equal(contracts.extraBoards, 1);
  // The week-2 board: replay to it and compare with the plain run's board.
  const sim = session.simulation;
  const log = sim.getCommandLog();
  const atBoard = Sim.replay(sim.seed, log.filter(([tick]) => tick <= 2 * TICKS_PER_WEEK), 2 * TICKS_PER_WEEK, sim.config);
  const plainSim = botRun(metSeed, 'endless', false, 2 * TICKS_PER_WEEK + 10).simulation;
  const plainBoard = Sim.replay(plainSim.seed, plainSim.getCommandLog().filter(([tick]) => tick <= 2 * TICKS_PER_WEEK), 2 * TICKS_PER_WEEK, plainSim.config);
  assert.equal(atBoard.world.status, 'upgrade');
  assert.equal(plainBoard.world.status, 'upgrade');
  {
    const offer = atBoard.world.offer!;
    assert.ok(offer.extraCrate, 'contract crate named');
    assert.equal(offer.offers.length, plainBoard.world.offer!.offers.length + 1, 'one card more than without the contract');
    const run = new EndlessRun(atBoard);
    const board = run.contractBoard()!;
    assert.equal(board.extraCrate, offer.extraCrate);
    assert.deepEqual(board.last, { ...first, met: true });
    assert.equal(board.next, atBoard.world.contract);
    assert.equal(new EndlessRun(plainBoard).contractBoard(), null, 'no waybill without the contract');
  }
  assert.ok(plain.contract === null);
});

await test('deliveries between the two regions count up during the week; ContractMet once; origins only in contract runs', () => {
  const full = botRun(metSeed, 'endless', true, 2 * TICKS_PER_WEEK + 10).simulation;
  const log = full.getCommandLog();
  const sim = new Sim(full.seed, full.config);
  const events: { type: string }[] = [];
  const tallies: number[] = [];
  let index = 0;
  while (sim.tickCount < 2 * TICKS_PER_WEEK - 1) {
    while (index < log.length && log[index]![0] === sim.tickCount + 1) sim.apply(log[index++]![1]);
    sim.tick();
    events.push(...sim.drainEvents());
    if (sim.tickCount > TICKS_PER_WEEK + 1 && sim.world.contract) tallies.push(sim.world.contract.delivered);
  }
  assert.equal(sim.hash(), Sim.replay(full.seed, log.filter(([tick]) => tick <= 2 * TICKS_PER_WEEK - 1), 2 * TICKS_PER_WEEK - 1, full.config).hash());
  const contract = sim.world.contract!;
  assert.equal(contract.week, 1);
  assert.ok(contract.delivered >= contract.target, `${contract.delivered}/${contract.target}`);
  assert.ok(tallies.every((n, i) => i === 0 || n >= tallies[i - 1]!), 'the tally never goes down');
  assert.ok(contract.delivered < sim.world.score, 'not every delivery counts');
  assert.equal(events.filter((event) => event.type === 'ContractMet').length, 1, 'one ContractMet event');
  assert.ok(JSON.stringify(stateOf(sim).world.passengers).includes('originRegion'));
  const plain = createGame(metSeed);
  plain.advance(600);
  assert.ok(!JSON.stringify(stateOf(plain).world.passengers).includes('originRegion'));
});

await test('save → load keeps the contract and the exact hash (envelope v3); v2 envelopes load; D-76 replay keeps it', () => {
  const sim = botRun(metSeed, 'endless', true, TICKS_PER_WEEK + 600).simulation;
  assert.ok(sim.world.contract);
  const save = encodeSave(saveSourceFromSim(sim), 1000);
  assert.equal(save.v, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 4); // [night-12bb] R2i: 3 -> 4 (demand surge); [night-12bc] R2h: 4 -> 5 (licence class)
  const decoded = decodeSave(JSON.stringify(save));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.deepEqual(restored.sim.world.contract, sim.world.contract);
  restored.sim.advance(400);
  sim.advance(400);
  assert.equal(restored.sim.hash(), sim.hash(), 'continues identically');
  // D-76: an older-rules save is replayed with its contract flag.
  const old = restoreSimDetailed(encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000));
  assert.ok(old && old.replayed);
  assert.equal(old.sim.config.weeklyContract, true);
  assert.equal(old.sim.hash(), sim.hash(), 'unchanged rules replay to the same hash');
  // A v2 envelope (pre-R2k, no contract) still loads to its hash, re-tagged; tampering is caught as v2.
  const plain = createGame(0xB2B2);
  plain.advance(1200);
  const current = encodeSave(saveSourceFromSim(plain), 1000);
  const { checksum: _drop, ...body } = { ...current, v: 2 };
  const v2 = { ...body, checksum: checksum(body) };
  const loaded = decodeSave(JSON.stringify(v2));
  assert.equal(loaded.status, 'ok');
  if (loaded.status !== 'ok') return;
  assert.equal(loaded.save.v, SAVE_VERSION);
  assert.equal(restoreSimDetailed(loaded.save)?.sim.hash(), plain.hash());
  assert.equal(decodeSave(JSON.stringify({ ...v2, checksum: current.checksum })).status, 'error', 'v2 is checked as v2');
  // A contract snapshot cannot be loaded into a run without the flag, nor the reverse.
  const snap = JSON.parse(sim.snapshot());
  snap.state.config = { mode: 'endless' };
  assert.throws(() => Sim.fromSnapshot(JSON.stringify(snap)));
});

await test('pause sheet: contract row with short region names and progress, "met" once reached (PL/EN)', () => {
  const base = { routes: 2, assigned: 2, spare: 0, hubs: [], minutesToBoard: 300 };
  setLanguage('en');
  assert.equal(pauseSummary(base).length, 3, 'no row without a contract');
  assert.equal(pauseSummary({ ...base, contract: null }).length, 3);
  const row = pauseSummary({ ...base, contract: { regions: ['EUN', 'ME'], delivered: 12, target: 30 } }).at(-1)!;
  assert.deepEqual(row, { key: 'contract', label: 'Contract', value: 'N. Europe – Mid. East 12/30' });
  assert.equal(pauseSummary({ ...base, contract: { regions: ['EUN', 'ME'], delivered: 31, target: 30 } }).at(-1)!.value,
    'N. Europe – Mid. East 31/30, met');
  setLanguage('pl');
  assert.deepEqual(pauseSummary({ ...base, contract: { regions: ['NAM', 'ASI'], delivered: 30, target: 30 } }).at(-1),
    { key: 'contract', label: 'Kontrakt', value: 'Am. Płn. – Azja 30/30, wykonany' });
  setLanguage('en');
});

console.log(`SUMMARY test:weekly-contract seed=0xA1A1 metSeed=0x${metSeed.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

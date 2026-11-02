// Fixed-seed goal, fairness, replay and undo checks for task-17 puzzles on the real simulation.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checked = 0;
let passed = 0;
const failures = [];
function check(name, fn) {
  checked++;
  try { fn(); passed++; } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
try {
  await import('./ts-test-loader.mjs');
  // The production engine: puzzle levels run on the authoritative Sim (src/sim/puzzles.ts).
  const engine = await import('../src/game/modes/puzzle.ts');
  const folder = resolve(ROOT, 'src/data/puzzles');
  const files = readdirSync(folder).filter((name) => /^\d{2}\.json$/.test(name)).sort();
  check('level count', () => assert(files.length === 15, `expected 15, got ${files.length}`));
  const levels = files.map((file) => JSON.parse(readFileSync(resolve(folder, file), 'utf8')));
  for (const [index, level] of levels.entries()) {
    const id = level.id;
    check(`${id} schema/order`, () => {
      engine.validatePuzzle(level);
      assert(id === String(index + 1).padStart(2, '0'), 'out-of-sequence puzzle identifier');
      assert(level.referenceCommands.length > 0, 'missing reference commands');
      assert(level.stock.turboprops + level.stock.jets > 0, 'no aircraft');
      assert(level.demandSeed > 0, 'missing demand seed');
    });
    check(`${id} no action loses`, () => {
      const lost = engine.dispatchPuzzle(level, engine.startPuzzle(level), { type: 'advance', ticks: level.durationTicks });
      assert(lost.snapshot.status === 'lost', 'zero-command run must lose');
      assert(lost.snapshot.stars === 0, 'failure cannot award stars');
    });
    check(`${id} reference wins >=15%`, () => {
      const won = engine.runReference(level);
      assert(won.snapshot.status === 'won', `reference lost: ${JSON.stringify(won.snapshot)}`);
      assert(won.snapshot.marginPercent >= 15, `insufficient margin ${won.snapshot.marginPercent}%`);
      assert(won.snapshot.stars >= 2, 'successful reference should earn >=2 stars');
      assert(won.snapshot.tick === level.durationTicks, 'reference must reach time limit');
      if (level.goal.kind === 'continents') assert(won.snapshot.coveredContinents >= level.goal.continents, 'missing continents');
      if (level.goal.kind === 'curfewNights') assert(won.snapshot.nightsSurvived >= level.goal.nights, 'insufficient nights');
    });
    check(`${id} undo/replay/reset`, () => {
      let session = engine.startPuzzle(level);
      for (const action of level.referenceCommands) session = engine.dispatchPuzzle(level, session, action);
      const before = JSON.stringify(session.snapshot);
      session = engine.dispatchPuzzle(level, session, { type: 'advance', ticks: 120 });
      session = engine.undoPuzzle(level, session);
      assert(JSON.stringify(session.snapshot) === before, 'undo must exactly reconstruct previous state');
      const rerun = engine.replayPuzzle(level, [...level.referenceCommands, { type: 'advance', ticks: level.durationTicks }]);
      assert(JSON.stringify(rerun.snapshot) === JSON.stringify(engine.runReference(level).snapshot), 'replay not deterministic');
      session = engine.resetPuzzle(level);
      assert(session.history.length === 0 && session.snapshot.tick === 0, 'reset failed');
    });
    check(`${id} invalid route rejected`, () => {
      let rejected = false;
      try { engine.dispatchPuzzle(level, engine.startPuzzle(level), { type: 'connect', from: 'BAD', to: 'ZZZ', plane: 'jet' }); }
      catch { rejected = true; }
      assert(rejected, 'invalid command must throw');
    });
  }
  const curfewLevel = levels.find((level) => level.id === '15');
  check('undo is unlimited', () => {
    let session = engine.startPuzzle(curfewLevel);
    for (const action of curfewLevel.referenceCommands) session = engine.dispatchPuzzle(curfewLevel, session, action);
    while (session.history.length) session = engine.undoPuzzle(curfewLevel, session);
    assert(JSON.stringify(session.snapshot) === JSON.stringify(engine.startPuzzle(curfewLevel).snapshot), 'full undo failed');
  });
  check('nonmutating command failure', () => {
    const level = levels[0];
    const before = engine.startPuzzle(level);
    let failed = false;
    try { engine.dispatchPuzzle(level, before, { type: 'upgradeHub', city: level.startCities[0].id }); }
    catch { failed = true; }
    assert(failed && before.history.length === 0, 'failed command mutated history');
  });
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error('FAIL setup:', failures.at(-1));
}
console.log(`SUMMARY test:puzzles seed=0xA1A1 levels=15 cases=${checked} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;

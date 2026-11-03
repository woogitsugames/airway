// Fixed-seed goal, fairness, replay and undo checks for task-17 puzzles on the real simulation.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let LEVELS = 0;
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
  const { createGame } = await import('../src/sim/index.ts');
  const { cityByCode } = await import('../src/data/index.ts');
  const { SIM_MINUTES_PER_WEEK } = await import('../src/sim/params.ts');

  // [ext-01] R6f, D-160: the count comes from the folder; ids must run 01…NN without a gap and PUZZLES (the
  // generated index the game imports) must list exactly those files in order.
  const { PUZZLES } = await import('../src/data/puzzles/index.ts');
  const { puzzleIds } = await import('./puzzle-index.mjs');
  const folder = resolve(ROOT, 'src/data/puzzles');
  const files = readdirSync(folder).filter((name) => /^\d{2}\.json$/.test(name)).sort();
  LEVELS = files.length;
  check('level ids contiguous from 01', () => assert(puzzleIds(folder).length === LEVELS, 'numbering'));
  check('game index lists the folder', () => {
    const listed = PUZZLES.map((level) => level.id).join(',');
    const want = files.map((name) => name.slice(0, 2)).join(',');
    assert(listed === want, `PUZZLES ${listed || '(none)'} != folder ${want}: run npm run build:puzzles`);
  });
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
    // [night-01] Levels 16-30 must each be built around a newer mechanic, proven on the reference run.
    if (Number(id) >= 16) check(`${id} mechanics proven`, () => {
      const tags = level.mechanics ?? [];
      assert(tags.some((tag) => tag === 'slots' || tag === 'curfew' || tag === 'week' || tag === 'mct'), 'no newer mechanic');
      const sim = createGame(level.demandSeed, 'puzzle', id);
      for (const command of level.referenceCommands) {
        sim.apply(command.type === 'connect'
          ? { type: 'AddRoute', cityIds: [command.from, command.to], aircraft: command.plane === 'jet' ? 'widebody' : 'turboprop' }
          : { type: 'UpgradeHub', hubId: command.city });
        sim.tick();
      }
      while (sim.world.status === 'running') sim.tick();
      assert(sim.world.status === 'won', 'reference must reach the deadline');
      const links = level.referenceCommands.filter((command) => command.type === 'connect');
      for (const tag of tags) {
        if (tag === 'slots') {
          const held = level.startCities.reduce((sum, city) => sum + sim.world.hubCauseLedger(city.id).slotWaitMinutes, 0);
          assert(held > 0, 'slots: no aircraft ever waited for a departure slot');
        } else if (tag === 'curfew') {
          assert(level.startCities.some((city) => city.curfew), 'curfew: no curfew airport');
        } else if (tag === 'week') {
          assert(level.durationTicks > SIM_MINUTES_PER_WEEK && level.demand.some((wave) => wave.firstTick >= SIM_MINUTES_PER_WEEK),
            'week: no new traffic in the second 3-day week');
        } else if (tag === 'mct') {
          assert(level.referenceCommands.some((command) => command.type === 'upgradeHub'), 'mct: reference expands no hub');
        } else if (tag === 'transfer') {
          const needsTransfer = level.demand.some((wave) => {
            const region = cityByCode(wave.to).region;
            return !links.some((link) => (link.from === wave.from && cityByCode(link.to).region === region) ||
              (link.to === wave.from && cityByCode(link.from).region === region));
          });
          assert(needsTransfer, 'transfer: every passenger flies direct');
        }
      }
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
console.log(`SUMMARY test:puzzles seed=0xA1A1 levels=${LEVELS} cases=${checked} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;

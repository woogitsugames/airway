// [night-12aa] e2e seeds on the current rules (e2e/seeds.mjs, scripts/lib/e2e-plans.ts).
//   --test (npm run test:e2e-seeds, in test:fast): every suite's seeds hold every plan on every idle offset.
//   --find <suite> [--from <seed>] (npm run e2e:seeds -- <suite>): the first seed at or after --from (default: the
//   suite's first seed + 1) that holds all the suite's plans, to paste into e2e/seeds.mjs after a rule change.
import { performance } from 'node:perf_hooks';
import { E2E_SEEDS } from '../e2e/seeds.mjs';
import { checkPlan, findSeed, IDLE_OFFSETS, playPlan, type E2ePlan } from './lib/e2e-plans.ts';

const started = performance.now();
const args = process.argv.slice(2);
const hex = (seed: number) => '0x' + seed.toString(16).toUpperCase();
const suites = E2E_SEEDS as Record<string, { seeds: number[]; plans: E2ePlan[] }>;

if (args.includes('--find')) {
  const name = args[args.indexOf('--find') + 1];
  const suite = name ? suites[name] : undefined;
  if (!suite) {
    console.error(`usage: npm run e2e:seeds -- <suite> [--from <seed>]; suites: ${Object.keys(suites).join(', ')}`);
    process.exit(2);
  }
  const fromArg = args.includes('--from') ? Number(args[args.indexOf('--from') + 1]) : suite.seeds[0]! + 1;
  const seed = findSeed(suite.plans, fromArg);
  if (seed === null) { console.error(`no seed in 2000 from ${hex(fromArg)}`); process.exit(1); }
  console.log(`${name}: ${hex(seed)} (${seed}) holds ${suite.plans.length} plan(s) on idle offsets ${IDLE_OFFSETS.join('/')}`);
  for (const plan of suite.plans) console.log(`  ${plan.name}: ${playPlan(seed, plan).trace.join(' | ')}`);
} else {
  let passed = 0;
  let failed = 0;
  for (const [name, suite] of Object.entries(suites)) for (const seed of suite.seeds) for (const plan of suite.plans) {
    const label = `${name} ${hex(seed)}: ${plan.name}`;
    const miss = checkPlan(seed, plan);
    if (!miss) { passed++; console.log(`PASS ${label}`); continue; }
    failed++;
    console.error(`FAIL ${label}: ${miss.result.why} (idle ${miss.idle}; ${miss.result.trace.join(' | ') || 'no board'}) — npm run e2e:seeds -- ${name}`);
  }
  console.log(`SUMMARY test:e2e-seeds suites=${Object.keys(suites).length} cases=${passed + failed} offsets=${IDLE_OFFSETS.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed) process.exitCode = 1;
}

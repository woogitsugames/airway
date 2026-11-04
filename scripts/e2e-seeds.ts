// [night-12aa] e2e seeds on the current rules (e2e/seeds.mjs, scripts/lib/e2e-plans.ts).
//   --test (npm run test:e2e-seeds, in test:fast): every suite's seeds hold every plan on every idle offset.
//   --find <suite> [--from <seed>] (npm run e2e:seeds -- <suite>): the first seed at or after --from (default: the
//   suite's first seed + 1) that holds all the suite's plans, to paste into e2e/seeds.mjs after a rule change.
import { performance } from 'node:perf_hooks';
//   [night-12aj] Suites seeded by the date list `dates` (Warsaw calendar keys); their seed is dailySeedForKey(date)
//   and --find walks forward day by day.
import { E2E_SEEDS } from '../e2e/seeds.mjs';
import { dailySeedForKey } from '../src/core/daily.ts';
import { checkPlan, findSeed, IDLE_OFFSETS, playPlan, type E2ePlan } from './lib/e2e-plans.ts';

const started = performance.now();
const args = process.argv.slice(2);
const hex = (seed: number) => '0x' + seed.toString(16).toUpperCase();
const suites = E2E_SEEDS as Record<string, { seeds: number[]; dates?: string[]; plans: E2ePlan[] }>;
/** Seeds to check with their labels: hex for seeded suites, the date for date-seeded ones. */
const seedsOf = (suite: { seeds: number[]; dates?: string[] }): { seed: number; label: string }[] =>
  suite.dates ? suite.dates.map((date) => ({ seed: dailySeedForKey(date), label: date }))
    : suite.seeds.map((seed) => ({ seed, label: hex(seed) }));
const nextDay = (date: string) => new Date(Date.parse(date + 'T12:00:00Z') + 86_400_000).toISOString().slice(0, 10);

if (args.includes('--find')) {
  const name = args[args.indexOf('--find') + 1];
  const suite = name ? suites[name] : undefined;
  if (!suite) {
    console.error(`usage: npm run e2e:seeds -- <suite> [--from <seed>]; suites: ${Object.keys(suites).join(', ')}`);
    process.exit(2);
  }
  if (suite.dates) {
    let date = args.includes('--from') ? args[args.indexOf('--from') + 1]! : nextDay(suite.dates[0]!);
    for (let n = 0; n < 366 && !suite.plans.every((plan) => checkPlan(dailySeedForKey(date), plan) === null); n++) date = nextDay(date);
    const seed = dailySeedForKey(date);
    if (!suite.plans.every((plan) => checkPlan(seed, plan) === null)) { console.error('no date in a year holds'); process.exit(1); }
    console.log(`${name}: ${date} (seed ${hex(seed)}) holds ${suite.plans.length} plan(s) on idle offsets ${IDLE_OFFSETS.join('/')}`);
    for (const plan of suite.plans) console.log(`  ${plan.name}: ${playPlan(seed, plan).trace.join(' | ')}`);
    process.exit(0);
  }
  const fromArg = args.includes('--from') ? Number(args[args.indexOf('--from') + 1]) : suite.seeds[0]! + 1;
  const seed = findSeed(suite.plans, fromArg);
  if (seed === null) { console.error(`no seed in 2000 from ${hex(fromArg)}`); process.exit(1); }
  console.log(`${name}: ${hex(seed)} (${seed}) holds ${suite.plans.length} plan(s) on idle offsets ${IDLE_OFFSETS.join('/')}`);
  for (const plan of suite.plans) console.log(`  ${plan.name}: ${playPlan(seed, plan).trace.join(' | ')}`);
} else {
  let passed = 0;
  let failed = 0;
  for (const [name, suite] of Object.entries(suites)) for (const { seed, label: seedLabel } of seedsOf(suite)) for (const plan of suite.plans) {
    const label = `${name} ${seedLabel}: ${plan.name}`;
    const miss = checkPlan(seed, plan);
    if (!miss) { passed++; console.log(`PASS ${label}`); continue; }
    failed++;
    console.error(`FAIL ${label}: ${miss.result.why} (idle ${miss.idle}; ${miss.result.trace.join(' | ') || 'no board'}) — npm run e2e:seeds -- ${name}`);
  }
  console.log(`SUMMARY test:e2e-seeds suites=${Object.keys(suites).length} cases=${passed + failed} offsets=${IDLE_OFFSETS.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed) process.exitCode = 1;
}

// [night-12be] D-254: headless twin of e2e/session-stub.mjs (the real session on the DEV stub world). It drives an
// EndlessRun with the same Commands as the browser journey (src/main.ts autoplayUntil, the weekly board's crate click
// and airport pick, window.aw.botStep / advanceTicks(10)) on the seed in e2e/seeds.mjs SESSION_STUB, so a rule change
// that breaks the journey fails here, in test:fast, before the browser suite. The "+2 slots" airport the browser picks
// depends on the camera (src/render), so the plan must hold for every airport the pick accepts.
// Also checks that the stub world never reaches a release bundle: src/main.ts loads it only behind the DEV ternary.
//   node --import ./scripts/ts-test-loader.mjs scripts/test-session-stub.ts           -> checks (test:fast)
//   node --import ./scripts/ts-test-loader.mjs scripts/test-session-stub.ts --find    -> next seed that holds
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EndlessRun } from '../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../src/game/dev/autoplay.ts';
import { FillReadings } from '../src/game/fillTrend.ts';
import { frontMarks } from '../src/game/weather.ts';
import { createGame } from '../src/sim/index.ts';
import type { RegionId } from '../src/data/regions.ts';
import { SESSION_STUB } from '../e2e/seeds.mjs';

interface Plan { seed: number; homeRegion: RegionId; surge: string; jam: string; front: string }
const plan = SESSION_STUB as Plan;
let checks = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string): void => { checks++; if (!ok) failures.push(message); };

/** session.advance: step until the sim stops (unanswered board or game over). */
const advance = (run: EndlessRun, ticks: number): void => { for (let i = 0; i < ticks; i++) if (!run.step()) break; };
/** src/main.ts autoplayUntil. */
function autoplay(run: EndlessRun, untilWeek: number): void {
  for (let guard = 0; guard < 200_000; guard++) {
    if (run.failed) break;
    const offer = run.weeklyUpgrade;
    if (offer && offer.week >= untilWeek && !offer.lastChoice) break;
    const command = nextAutoplayCommand(run.sim);
    if (command) run.queue(command);
    advance(run, AUTOPLAY_ACTION_INTERVAL);
  }
}
/** The board's crate click: the first crate that is not hub/slots (the journey's answerPlain). */
function answerPlain(run: EndlessRun): void {
  const offer = run.weeklyUpgrade!;
  const pick = offer.offers.find((item) => item.id !== 'hub-expansion' && item.id !== 'departure-slots') ?? offer.offers[0]!;
  run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
  run.resolveBoundary();
}

/** The journey up to the week-2 board; returns the run there or why it cannot get there. */
function toWeekTwo(seed: number, homeRegion: RegionId): EndlessRun | string {
  const run = EndlessRun.create(seed, 'endless', homeRegion, 1);
  autoplay(run, 1);
  if (run.failed || !run.weeklyUpgrade) return 'the run ends before the week-1 board';
  if (!run.contractBoard()?.next) return 'no contract on the week-1 board';
  answerPlain(run);
  autoplay(run, 2);
  if (run.failed || !run.weeklyUpgrade) return 'the run ends before the week-2 board';
  const board = run.contractBoard();
  if (!board?.last?.met) return `week-1 contract not met (${JSON.stringify(board?.last)})`;
  if (run.weeklyUpgrade.offers.length !== 4 || board.extraCrate !== 'departure-slots') return `extra crate ${board.extraCrate}`;
  return run;
}

/** The rest of the journey with the "+2 slots" crate on `pickId`: surge announced, then (no bot) a filling tag and a jam. */
function rest(seed: number, homeRegion: RegionId, pickId: string): { surge: string; jam: string } | string {
  const run = toWeekTwo(seed, homeRegion);
  if (typeof run === 'string') return run;
  const week = run.weeklyUpgrade!.week;
  run.queue({ type: 'ChooseUpgrade', week, upgrade: 'departure-slots' });
  run.resolveBoundary();
  run.queue({ type: 'ChooseUpgrade', week, upgrade: 'departure-slots', hubId: pickId });
  run.resolveBoundary();
  if (run.weeklyUpgrade) return `the pick of ${pickId} did not close the board`;
  for (let i = 0; i < 400 && !run.surge && !run.failed && !run.weeklyUpgrade; i++) {
    const command = nextAutoplayCommand(run.sim);
    if (command) run.queue(command);
    advance(run, 10);
  }
  if (!run.surge || run.surge.active) return 'no surge announced before the run ends or the next board';
  const surge = run.surge.cityId;
  const readings = new FillReadings();
  let filling = false;
  let jam: string | null = null;
  for (let i = 0; i < 600 && !run.failed && !run.weeklyUpgrade && !(filling && jam); i++) {
    advance(run, 10);
    readings.hourly(run);
    for (const city of run.cityList()) {
      if (readings.trend(city.id, city.waiting.length, city.capacity) === 'filling') filling = true;
      if (jam === null && city.jamTicksLeft !== null) jam = city.id;
    }
  }
  if (!jam || !filling || run.failed || run.weeklyUpgrade) return `no filling tag and jam in play (jam ${jam}, filling ${filling})`;
  return { surge, jam };
}

function holds(candidate: Plan): string[] {
  const run = toWeekTwo(candidate.seed, candidate.homeRegion);
  if (typeof run === 'string') return [run];
  // The journey reads the first start airport (the anchor of the start cluster, D-236) right after the start.
  const home = EndlessRun.create(candidate.seed, 'endless', candidate.homeRegion, 1).cityList()[0];
  const problems: string[] = [];
  if (home?.region !== candidate.homeRegion) problems.push(`home ${home?.id} not in ${candidate.homeRegion}`);
  for (const city of run.cityList()) {
    const result = rest(candidate.seed, candidate.homeRegion, city.id);
    if (typeof result === 'string') problems.push(`pick ${city.id}: ${result}`);
    else if (result.surge !== candidate.surge || result.jam !== candidate.jam) {
      problems.push(`pick ${city.id}: surge ${result.surge} jam ${result.jam}, expected ${candidate.surge} / ${candidate.jam}`);
    }
  }
  return problems;
}

if (process.argv.includes('--find')) {
  for (let seed = plan.seed + 1; seed < plan.seed + 400; seed++) {
    const run = toWeekTwo(seed, plan.homeRegion);
    if (typeof run === 'string') continue;
    const sample = rest(seed, plan.homeRegion, run.cityList()[0]!.id);
    if (typeof sample === 'string') continue;
    if (holds({ seed, homeRegion: plan.homeRegion, front: plan.front, ...sample }).length === 0) {
      console.log(`seed 0x${seed.toString(16).toUpperCase()} surge ${sample.surge} jam ${sample.jam}`);
      process.exit(0);
    }
  }
  console.log('no seed found');
  process.exit(1);
}

// 1. The journey's seed holds on the current rules, for every airport the "+2 slots" pick can take.
for (const problem of holds(plan)) check(false, `SESSION_STUB 0x${plan.seed.toString(16)}: ${problem}`);
check(true, 'plan replayed');

// 2. Daily stays free of tonight's Endless knobs (the journey compares hashes; here the rules themselves).
const daily = createGame(plan.seed, 'daily');
check(daily.world.contract === null && daily.world.surge === null && !daily.config.homeRegion && (daily.config.licenceClass ?? 1) === 1,
  'a daily run has no contract, surge, home region or licence class');

// 2b. R2j (DEV `?weather=front`): the same seed with the weather front shows a forecast at `front` in week 3 (the
// browser answers both boards with a plain crate and lets the bot play on).
{
  const run = EndlessRun.create(plan.seed, 'endless', plan.homeRegion, 1, true);
  let found: string | null = null;
  for (let i = 0; i < 2000 && !found && !run.failed; i++) {
    if (run.weeklyUpgrade) { if (run.weeklyUpgrade.week > 2) break; answerPlain(run); }
    const marks = frontMarks(run.cityList().map((city) => city.id), (id) => run.airportWeather(id));
    for (const [id, mark] of marks) if (!found && mark.phase === 'ahead') found = id;
    const command = nextAutoplayCommand(run.sim);
    if (command) run.queue(command);
    advance(run, 10);
  }
  check(found === plan.front, `weather front forecast at ${found}, expected ${plan.front}`);
  check(daily.config.weatherFront !== true, 'a daily run has no weather front');
}

// 3. The stub world ships only in DEV: main.ts imports it dynamically behind `import.meta.env.DEV`, nothing else does.
const ROOT = resolve(import.meta.dirname, '..');
const main = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
const imports = [...main.matchAll(/[^\n]*stubWorld[^\n]*/g)].map((match) => match[0]);
check(imports.length >= 1 && imports.every((line) => !/^\s*import\s/.test(line)), 'main.ts never imports the stub world statically');
check(/import\.meta\.env\.DEV && query\.get\('render'\) === 'stub' \? await import\('\.\/game\/dev\/stubWorld'\) : null/.test(main),
  'main.ts loads the stub world only behind the DEV ternary');

if (failures.length) for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(`SUMMARY test:session-stub seed=0x${plan.seed.toString(16).toUpperCase()} checks=${checks} passed=${checks - failures.length} failed=${failures.length}`);
if (failures.length) process.exit(1);

// Real-UI Playwright smoke. Missing gameplay features FAIL rather than silently pass (D-37).
// Steps depend on each other: after the first failure the rest are reported as SKIP.
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, dragGesture, state, assert, clickTestId, saveDiagnostics, SEED,
} from './browser.mjs';

const fixture = process.argv.includes('--fixture');
const started = performance.now();
const results = [];

const steps = [
  ['boot: dev adapter and menu', async (page) => {
    const ready = await page.evaluate(() => window.aw?.ready);
    assert(ready, 'window.aw.ready=false: no AwDevAdapter registered (src/game/devHandle.ts registerDevGameAdapter)');
    await waitForScreen(page, 'menu');
  }],
  ['new endless game with fixed seed', async (page) => {
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game');
    const current = await state(page);
    assert(current.seed === SEED, `Game seed mismatch: ${current.seed} !== ${SEED}`);
  }],
  ['draw route through real pointer events', async (page) => {
    const initial = await state(page);
    const gesture = await page.evaluate(() => window.aw.gesture('route'));
    await dragGesture(page, gesture);
    await page.waitForFunction((previous) => window.aw.state().routeCount === previous + 1,
      initial.routeCount, { timeout: 8000 })
      .catch(() => { throw new Error(`routeCount stayed ${initial.routeCount} after drag ${JSON.stringify(gesture)}`); });
  }],
  ['assign aircraft through dock pointer gesture', async (page) => {
    const initial = await state(page);
    const gesture = await page.evaluate(() => window.aw.gesture('plane'));
    await dragGesture(page, gesture);
    await page.waitForFunction((previous) => window.aw.state().aircraftAssignments === previous + 1,
      initial.aircraftAssignments, { timeout: 8000 })
      .catch(() => { throw new Error(`aircraftAssignments stayed ${initial.aircraftAssignments}`); });
  }],
  ['advance to next week and open upgrade', async (page) => {
    const before = await state(page);
    const remaining = before.nextWeekTick - before.tick;
    assert(Number.isSafeInteger(remaining) && remaining > 0 && remaining <= 1_000_000,
      `Invalid remaining ticks until next week: ${remaining}`);
    // A passive one-route network jams before week 1, so the task-22 bot keeps playing this run
    // through real Commands (window.aw.autoplay, DEV only) until the week-1 board opens.
    const reached = await page.evaluate(() => window.aw.autoplay(1));
    assert(reached.screen === 'upgrade', `Autoplay ended on "${reached.screen}" at tick ${reached.tick}`);
    await waitForScreen(page, 'upgrade');
  }],
  ['select one weekly upgrade', async (page) => {
    // A hub-expansion card waits for a hub tap; take the first card that completes on its own.
    const option = await page.evaluate(() => document.querySelector(
      '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"])')?.getAttribute('data-testid') ?? 'upgrade-option-0');
    await clickTestId(page, option);
    await waitForScreen(page, 'game');
  }],
  ['save, leave, continue and preserve snapshot hash', async (page) => {
    // Save and Menu live on the pause sheet; Escape opens it (same path as Android back).
    await page.keyboard.press('Escape');
    await page.getByTestId('action-save').waitFor({ timeout: 5000 });
    const before = await state(page);
    assert(Boolean(before.snapshotHash), 'Snapshot hash must not be empty');
    await clickTestId(page, 'action-save');
    await page.waitForFunction(() => /\S/.test(document.querySelector('.airway-pause__status')?.textContent ?? ''),
      null, { timeout: 8000 });
    await clickTestId(page, 'action-menu');
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-continue');
    await waitForScreen(page, 'game');
    const after = await state(page);
    assert(after.snapshotHash === before.snapshotHash,
      `Save/load changed state: ${before.snapshotHash} -> ${after.snapshotHash}`);
  }],
  ['test-only hub overload displays game over', async (page) => {
    await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover');
    await page.getByTestId('game-over').waitFor({ timeout: 5000 });
  }],
  ['return to menu after failure', async (page) => {
    await clickTestId(page, 'gameover-menu');
    await waitForScreen(page, 'menu');
  }],
];

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    let page;
    let errors = [];
    try {
      ({ page, errors } = await newGamePage(browser, url, 'pl'));
    } catch (error) {
      results.push({ label: steps[0][0], status: 'FAIL', why: 'page load: ' + message(error) });
      for (const [label] of steps.slice(1)) results.push({ label, status: 'SKIP', why: `after "${steps[0][0]}"` });
      return;
    }
    try {
      let blocked = null;
      for (const [label, run] of steps) {
        if (blocked) { results.push({ label, status: 'SKIP', why: `after "${blocked}"` }); continue; }
        try {
          await run(page);
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, 'smoke-' + (results.length + 1));
          results.push({ label, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
          blocked = label;
        }
      }
    } finally {
      await page.close();
    }
  }, { fixture });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { label, status, why } of results) {
    const line = `${status} ${label}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  const skipped = results.filter((item) => item.status === 'SKIP').length;
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`SUMMARY test:e2e:smoke seed=0x${SEED.toString(16).toUpperCase()} mode=${fixture ? 'fixture' : 'game'} steps=${steps.length} passed=${passed} failed=${failed} skipped=${skipped} durationMs=${elapsedMs}`);
  if (failed || passed !== steps.length) process.exitCode = 1;
}

// Real-UI Playwright smoke. Missing gameplay features FAIL rather than silently pass.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, dragGesture, state, assert, SEED } from './browser.mjs';

const fixture = process.argv.includes('--fixture');
let passed = 0;
let failed = 0;
const started = performance.now();

async function check(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

try {
  await withBrowser(async ({ browser, url }) => {
    const { page, errors } = await newGamePage(browser, url, 'pl');
    try {
      await check('boot: dev adapter and menu', async () => {
        const ready = await page.evaluate(() => window.aw?.ready);
        assert(ready, 'Game adapter missing: tasks 13-16 must expose production gameplay via registerDevGameAdapter');
        await waitForScreen(page, 'menu');
      });
      await check('new endless game with fixed seed', async () => {
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await page.getByTestId('menu-endless').click();
        await waitForScreen(page, 'game');
        assert((await state(page)).seed === SEED, 'Game seed mismatch');
      });
      await check('draw route through real pointer events', async () => {
        const initial = await state(page);
        const gesture = await page.evaluate(() => window.aw.gesture('route'));
        await dragGesture(page, gesture);
        await page.waitForFunction((previous) => window.aw.state().routeCount === previous + 1,
          initial.routeCount, { timeout: 8000 });
      });
      await check('assign aircraft through dock pointer gesture', async () => {
        const initial = await state(page);
        const gesture = await page.evaluate(() => window.aw.gesture('plane'));
        await dragGesture(page, gesture);
        await page.waitForFunction((previous) => window.aw.state().aircraftAssignments === previous + 1,
          initial.aircraftAssignments, { timeout: 8000 });
      });
      await check('advance to next week and open upgrade', async () => {
        const before = await state(page);
        const remaining = before.nextWeekTick - before.tick;
        assert(Number.isSafeInteger(remaining) && remaining > 0 && remaining <= 1_000_000,
          'Invalid remaining ticks until next week');
        await page.evaluate((ticks) => window.aw.advanceTicks(ticks), remaining);
        await waitForScreen(page, 'upgrade');
      });
      await check('select one weekly upgrade', async () => {
        await page.getByTestId('upgrade-option-0').click();
        await waitForScreen(page, 'game');
      });
      await check('save, leave, continue and preserve snapshot hash', async () => {
        const before = await state(page);
        assert(Boolean(before.snapshotHash), 'Snapshot hash must not be empty');
        await page.getByTestId('action-save').click();
        await page.getByTestId('action-menu').click();
        await waitForScreen(page, 'menu');
        await page.getByTestId('menu-continue').click();
        await waitForScreen(page, 'game');
        const after = await state(page);
        assert(after.snapshotHash === before.snapshotHash,
          `Save/load changed state: ${before.snapshotHash} → ${after.snapshotHash}`);
      });
      await check('test-only hub overload displays game over', async () => {
        await page.evaluate(() => window.aw.forceHubOverload());
        await waitForScreen(page, 'gameover');
        await page.getByTestId('game-over').waitFor();
      });
      await check('return to menu after failure', async () => {
        await page.getByTestId('gameover-menu').click();
        await waitForScreen(page, 'menu');
      });
      assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    } finally {
      await page.close();
    }
  }, { fixture });
} catch (error) {
  if (!failed) failed++;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`SUMMARY test:e2e:smoke seed=0x${SEED.toString(16).toUpperCase()} mode=${fixture ? 'fixture' : 'game'} passed=${passed} failed=${failed} durationMs=${elapsedMs}`);
  if (failed) process.exitCode = 1;
}


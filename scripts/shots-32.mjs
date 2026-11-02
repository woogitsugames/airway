// [task-32] Departure slots (D-41) on the real game, seed 0xA1A1, real pointer gestures + DEV autoplay.
// Writes docs/shots/32/: hint-<lang>-<p|l>.png (first held departure: one-time ATC strip),
// board-<lang>-<p|l>.png (week-1 board, "+2 slots" label) and pick-<lang>-<p|l>.png (airport pick sign).
import { resolve } from 'node:path';
import {
  withBrowser, newGamePage, waitForScreen, clickTestId, dragGesture, state, assert, ROOT, SEED,
} from '../e2e/browser.mjs';

const OUT = resolve(ROOT, 'docs/shots/32');
const VIEWS = [['p', 412, 915], ['l', 915, 412]];
const EXPECTED = 12;
let captured = 0;
const failures = [];
await withBrowser(async ({ browser, url }) => {
  for (const language of ['pl', 'en']) {
    for (const [tag, width, height] of VIEWS) {
      const { page } = await newGamePage(browser, url, language, { width, height });
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate(() => { try { localStorage.removeItem('aw-tutorial-slots'); } catch { /* optional */ } });
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
        await page.waitForFunction(() => window.aw.state().routeCount === 1, null, { timeout: 8000 });
        // Three more turboprops on the same route: four aircraft get ready at one airport together.
        for (let i = 0; i < 3; i++) {
          const before = (await state(page)).aircraftAssignments;
          await dragGesture(page, await page.evaluate(() => window.aw.gesture('plane')));
          await page.waitForFunction((n) => window.aw.state().aircraftAssignments === n + 1, before, { timeout: 8000 });
        }
        await page.evaluate(() => window.aw.advanceTicks(30));
        await page.getByTestId('slot-hint').waitFor({ state: 'visible', timeout: 8000 });
        await page.screenshot({ path: resolve(OUT, `hint-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
        const board = await page.evaluate(() => window.aw.autoplay(1));
        assert(board.screen === 'upgrade', `autoplay ended on ${board.screen}`);
        await waitForScreen(page, 'upgrade');
        const slots = page.locator('[data-upgrade="departure-slots"]');
        assert(await slots.count() === 1, 'week-1 board on seed 0xA1A1 offers "+2 slots"');
        await page.screenshot({ path: resolve(OUT, `board-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
        await slots.click();
        await page.waitForFunction(() => document.querySelector('.airway-upgrade-host')?.classList.contains('is-picking-hub'), null, { timeout: 5000 });
        await page.screenshot({ path: resolve(OUT, `pick-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
      } catch (error) {
        failures.push(`${language}/${tag}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
      } finally {
        await page.close();
      }
    }
  }
});
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots:32 seed=0xA1A1 captured=${captured} expected=${EXPECTED} failed=${failures.length}`);
if (failures.length || captured !== EXPECTED) process.exitCode = 1;

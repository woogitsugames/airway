// [task-31] Boarding-pass day bar with the 3-day week (D-40): real game, seed 0xA1A1, bot via DEV autoplay.
// Writes docs/shots/31/hud-<lang>-<p|l>.png (day 2/3 of week 2) and board-<lang>-<p|l>.png (week-1 board).
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, ROOT, SEED } from '../e2e/browser.mjs';

const OUT = resolve(ROOT, 'docs/shots/31');
const VIEWS = [['p', 412, 915], ['l', 915, 412]];
let captured = 0;
const failures = [];
await withBrowser(async ({ browser, url }) => {
  for (const language of ['pl', 'en']) {
    for (const [tag, width, height] of VIEWS) {
      const { page } = await newGamePage(browser, url, language, { width, height });
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        const board = await page.evaluate(() => window.aw.autoplay(1));
        assert(board.screen === 'upgrade', `autoplay ended on ${board.screen}`);
        await waitForScreen(page, 'upgrade');
        await page.screenshot({ path: resolve(OUT, `board-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
        const option = await page.evaluate(() => document.querySelector(
          '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])') /* [task-32] targeted picks wait for a globe tap */?.getAttribute('data-testid') ?? 'upgrade-option-0');
        await clickTestId(page, option);
        await waitForScreen(page, 'game');
        await page.evaluate(() => window.aw.advanceTicks(1440 + 600));
        const current = await state(page);
        assert(current.screen === 'game', `run ended before day 2: ${current.screen}`);
        const day = await page.evaluate(() => document.querySelector('[data-value="day"]')?.textContent);
        const squares = await page.evaluate(() => document.querySelectorAll('.airway-pass__days i').length);
        assert(day === '2/3' && squares === 3, `day bar shows ${day} with ${squares} squares`);
        await page.screenshot({ path: resolve(OUT, `hud-${language}-${tag}.png`), animations: 'disabled' });
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
console.log(`SUMMARY shots:31 seed=0xA1A1 captured=${captured} expected=8 failed=${failures.length}`);
if (failures.length || captured !== 8) process.exitCode = 1;

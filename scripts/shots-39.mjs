// [task-39] Back from the airport pick (D-49) on the real game, seed 0xA1A1, PL/EN x 412x915 / 915x412.
// Autoplay to the week-1 board, take "+2 slots", tap the Back tile in the pick sign, check the board is back
// with all three labels, then finish the week with another label. Writes docs/shots/39/pick-back-<lang>-<p|l>.png
// (pick sign with the Back tile) and board-back-<lang>-<p|l>.png (board after Back).
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, clickTestId, dragGesture, assert, ROOT, SEED } from '../e2e/browser.mjs';

const OUT = resolve(ROOT, process.argv[2] ?? 'docs/shots/39');
const VIEWS = [['p', 412, 915], ['l', 915, 412]];
const EXPECTED = 8;
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
        await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
        const board = await page.evaluate(() => window.aw.autoplay(1));
        assert(board.screen === 'upgrade', `autoplay ended on ${board.screen}`);
        await waitForScreen(page, 'upgrade');
        await page.locator('[data-upgrade="departure-slots"]').click();
        await page.waitForFunction(() => document.querySelector('.airway-upgrade-host')?.classList.contains('is-picking-hub'), null, { timeout: 5000 });
        const back = page.getByTestId('upgrade-pick-back');
        const box = await back.boundingBox();
        assert(box && box.width >= 48 && box.height >= 48, `back tile ${JSON.stringify(box)} < 48 px`);
        assert((await back.textContent()) === (language === 'pl' ? 'Wróć' : 'Back'), 'back tile text');
        await page.screenshot({ path: resolve(OUT, `pick-back-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
        const tick = (await page.evaluate(() => window.aw.state())).tick;
        await back.click();
        await page.waitForFunction(() => !document.querySelector('.airway-upgrade-host')?.classList.contains('is-picking-hub')
          && document.querySelectorAll('.airway-upgrade-tag').length === 3, null, { timeout: 5000 });
        const after = await page.evaluate(() => window.aw.state());
        assert(after.screen === 'upgrade' && after.tick > tick, `Back must run one journaled tick on the board (${tick} -> ${after.tick}, ${after.screen})`);
        await page.screenshot({ path: resolve(OUT, `board-back-${language}-${tag}.png`), animations: 'disabled' });
        captured++;
        await page.locator('[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])').first().click();
        await waitForScreen(page, 'game');
      } catch (error) {
        failures.push(`${language}/${tag}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
      } finally {
        await page.close();
      }
    }
  }
});
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots:39 seed=0xA1A1 captured=${captured} expected=${EXPECTED} failed=${failures.length}`);
if (failures.length || captured !== EXPECTED) process.exitCode = 1;

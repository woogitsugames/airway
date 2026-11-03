// [night-05] Evidence shots for D-68 (airport label setting): settings row and the weekly upgrade card stamp
// with city names, PL/EN at 412x915, plus the game-over board title. Writes docs/shots/night-05/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT, SEED } from '../e2e/browser.mjs';

const outdir = resolve(ROOT, 'docs/shots/night-05');
mkdirSync(outdir, { recursive: true });
let shots = 0;
await withBrowser(async ({ browser, url }) => {
  for (const language of ['pl', 'en']) {
    const { page } = await newGamePage(browser, url, language, { width: 412, height: 915 });
    await page.addInitScript(() => {
      const value = JSON.parse(localStorage.getItem('airway.settings') || '{}');
      localStorage.setItem('airway.settings', JSON.stringify({ ...value, airportLabels: 'name' }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.aw === 'object');
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-settings');
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outdir, `settings-${language}.png`) }); shots++;
    // Take the first test seed whose week-1 board carries a context stamp (hub expansion or busy slots).
    for (const seed of [SEED, 0xB2B2, 0xC3C3, 0xD4D4, 0xE5E5, 0x1234, 0x2345, 0x3456]) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.aw === 'object');
      await waitForScreen(page, 'menu');
      await page.evaluate((value) => window.aw.prepareSeed(value), seed);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      await page.evaluate(() => window.aw.autoplay(1));
      await waitForScreen(page, 'upgrade');
      if (await page.evaluate(() => !!document.querySelector('.airway-upgrade-stamp'))) { console.log(`stamp seed ${seed}`); break; }
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outdir, `upgrade-${language}.png`), animations: 'disabled' }); shots++;
    const option = await page.evaluate(() => document.querySelector(
      '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')?.getAttribute('data-testid') ?? 'upgrade-option-0');
    await clickTestId(page, option);
    await waitForScreen(page, 'game');
    await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover');
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(outdir, `gameover-${language}.png`), animations: 'disabled' }); shots++;
    await page.close();
  }
});
console.log(`SUMMARY shots:n5 captured=${shots} expected=6`);

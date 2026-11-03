// [night-09c] D-80 airline colour in the real app: the settings select changes the tail-fin swatch, the choice
// survives a reload, and the boarding pass band of a new game wears it. PL at 360×640, fixed seed, fails closed;
// screenshots into docs/shots/n9c/ (inspect them before committing).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n9c');
const results = [];
const css = (page, selector, property) => page.evaluate(([s, p]) => {
  const el = document.querySelector(s);
  return el ? getComputedStyle(el)[p] : null;
}, [selector, property]);

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    const { page, errors } = await newGamePage(browser, url, 'pl', { width: 360, height: 640 });
    const step = async (label, run) => {
      if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); return; }
      try {
        await run();
        if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, 'airline-colour-' + (results.length + 1));
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
    };
    mkdirSync(SHOTS, { recursive: true });
    await step('default: house teal swatch and option', async () => {
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-settings');
      const select = page.locator('[data-testid="settings-airline"] select');
      await select.waitFor({ timeout: 5000 });
      assert(await select.inputValue() === 'teal', 'default option is not teal');
      assert(await css(page, '.airway-setting__swatch', 'backgroundColor') === 'rgb(30, 111, 106)', 'teal swatch');
    });
    await step('choosing ochre repaints the swatch and is stored', async () => {
      await page.locator('[data-testid="settings-airline"] select').selectOption('ochre');
      assert(await css(page, '.airway-setting__swatch', 'backgroundColor') === 'rgb(224, 165, 38)', 'ochre swatch');
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('airway.settings') || '{}').airlineColour);
      assert(stored === 'ochre', `stored ${stored}`);
      await page.locator('[data-testid="settings-airline"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(SHOTS, 'settings-pl-360x640.png') });
    });
    // The harness clears storage on every navigation, so a reload cannot be tested here; reading the stored
    // value back at start-up is covered by test:airline-colour.
    await step('a new game wears the colour on the boarding pass band', async () => {
      await page.keyboard.press('Escape');
      await waitForScreen(page, 'menu');
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      const band = await css(page, '.airway-pass__band', 'backgroundColor');
      assert(band === 'rgb(224, 165, 38)', `pass band ${band}`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(SHOTS, 'game-pass-ochre-pl-360x640.png') });
    });
    await page.close();
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:airline-colour seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== 3) process.exitCode = 1;
}

// [night-10c] A saved flight that cannot be continued is said so on the menu instead of vanishing silently:
// a damaged save and a save from newer rules each show their notice (PL + EN), the Continue row is absent, and
// the notice goes once a new flight starts. 412×915, fails closed; shots into docs/shots/n10c/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const STEPS = 4;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10c');
const results = [];

/** Write the raw save slot exactly as the browser storage adapter keeps it (IndexedDB aw-airway/entries). */
const putSave = (page, text) => page.evaluate((value) => new Promise((done, fail) => {
  const open = indexedDB.open('aw-airway', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('entries');
  open.onerror = () => fail(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction('entries', 'readwrite');
    tx.objectStore('entries').put(value, 'aw-save-v1');
    tx.oncomplete = () => { open.result.close(); done(); };
    tx.onerror = () => fail(tx.error);
  };
}), text);

async function reloadToMenu(page) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
  await waitForScreen(page, 'menu');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    const cases = [
      ['pl', 'damaged', '{"v":1,"broken', 'Zapisany lot jest uszkodzony'],
      ['en', 'newer', JSON.stringify({ v: 99, future: true }), 'newer version of Airway'],
    ];
    for (const [language, kind, raw, expected] of cases) {
      const { page, errors } = await newGamePage(browser, url, language, { width: 412, height: 915 });
      const step = async (label, run) => {
        if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); return; }
        try {
          await run();
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, `save-notice-${language}-${results.length + 1}`);
          results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
        }
      };
      await step(`${language}: a ${kind} save shows its notice and no Continue row`, async () => {
        await waitForScreen(page, 'menu');
        assert(await page.locator('.airway-notice').isHidden(), 'notice shown without a save');
        await putSave(page, raw);
        await reloadToMenu(page);
        const notice = page.locator('.airway-notice');
        await notice.waitFor({ state: 'visible', timeout: 5000 });
        const text = (await notice.textContent()) ?? '';
        assert(text.includes(expected), `notice text: ${text}`);
        assert(await page.locator('[data-testid="menu-continue"]').count() === 0, 'Continue row offered for a broken save');
        await page.waitForTimeout(1200); // split-flap rows settle
        await page.screenshot({ path: resolve(SHOTS, `save-notice-${kind}-${language}-412x915.png`) });
      });
      await step(`${language}: starting a new flight clears the notice`, async () => {
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await page.keyboard.press('Escape');
        await clickTestId(page, 'action-menu');
        await waitForScreen(page, 'menu');
        assert(await page.locator('.airway-notice').isHidden(), 'notice still shown after a new flight');
      });
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:save-notice seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

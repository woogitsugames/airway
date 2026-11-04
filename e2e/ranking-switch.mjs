// [night-11v] D-197 (D-135, R7l): Settings → Help → "Send results to the leaderboard / Wysyłaj wyniki do rankingu".
// Phase 1, a build with a (fake) Firebase config: the switch is shown, on by default, its row ≥ 48 px tall and the
// switch inside the viewport; off writes the objection (`aw-net-share-v1` = '0') and is still off when settings open again; on again clears it. Phase 2, a build without leaderboards: no switch (like the delete-data row).
// PL 412×915, EN 320×568; shots docs/shots/n11v/. Fails on the old settings (no switch).
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const FIREBASE = {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099',
};
Object.assign(process.env, FIREBASE);
const { withBrowser, waitForScreen, clickTestId, assert, saveDiagnostics, SEED } = await import('./browser.mjs');
const { presetLanguage, ROOT } = await import('../scripts/lib/harness.mjs');
const SHOTS = resolve(ROOT, 'docs/shots/n11v');
mkdirSync(SHOTS, { recursive: true });

const started = performance.now();
const results = [];
const cases = [['pl', 412, 915], ['en', 320, 568]];
const LABEL = { pl: 'Wysyłaj wyniki do rankingu', en: 'Send results to the leaderboard' };

async function openPage(browser, url, language, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
    locale: language === 'pl' ? 'pl-PL' : 'en-US' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await presetLanguage(page, language, { clear: true });
  await page.route(/^http:\/\/127\.0\.0\.1:(5001|9099)\//, (route) => route.abort('internetdisconnected'));
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#app').waitFor({ timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
async function openSettings(page) {
  await waitForScreen(page, 'menu');
  await clickTestId(page, 'menu-settings');
  await page.locator('[data-testid="settings-group-help"]').waitFor({ timeout: 5000 });
}
const share = (page) => page.evaluate(() => localStorage.getItem('aw-net-share-v1'));

async function phase(configured) {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of cases) {
      const label = `${language} ${width}×${height}: ${configured ? 'switch on → off → reopen → on' : 'no leaderboards, no switch'}`;
      const { page, errors } = await openPage(browser, url, language, { width, height });
      try {
        await openSettings(page);
        const rowLocator = page.locator('[data-testid="settings-share-ranking-row"]');
        if (!configured) {
          assert(await rowLocator.count() === 0, 'switch shown in a build without leaderboards');
        } else {
          await rowLocator.scrollIntoViewIfNeeded();
          const text = await rowLocator.textContent();
          assert(text?.includes(LABEL[language]), `label "${text}"`);
          const input = page.locator('[data-testid="settings-share-ranking"]');
          assert(await input.isChecked(), 'on by default');
          await page.screenshot({ path: resolve(SHOTS, `settings-share-${language}-${width}x${height}.png`) });
          const box = await rowLocator.locator('.airway-setting').boundingBox();
          assert(box && box.height >= 48, `row height ${box?.height}`);
          const sw = await rowLocator.locator('.airway-setting__switch').boundingBox();
          assert(sw && sw.height >= 48 && sw.width >= 48 && sw.x >= 0 && sw.x + sw.width <= width + 0.5, `switch box ${JSON.stringify(sw)}`);
          await rowLocator.locator('.airway-setting__switch').click();
          assert(!(await input.isChecked()) && await share(page) === '0', `off not stored (${await share(page)})`);
          await page.keyboard.press('Escape');
          await openSettings(page);
          await rowLocator.scrollIntoViewIfNeeded();
          assert(!(await input.isChecked()), 'off survives reopening settings');
          await rowLocator.locator('.airway-setting__switch').click();
          assert(await input.isChecked() && (await share(page)) !== '0', 'on again clears the objection');
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'horizontal scroll');
        }
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `ranking-switch-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
}

let fatal = null;
try {
  await phase(true);
  for (const key of Object.keys(FIREBASE)) delete process.env[key];
  await phase(false);
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
}
for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
if (fatal) console.error('FAIL harness: ' + fatal);
const passed = results.filter((item) => item.status === 'PASS').length;
const failedCount = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:ranking-switch seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== cases.length * 2) process.exitCode = 1;

// [night-06c] Evidence shots for the D-66 daily ranking board, against the local Firebase emulators.
// Run: npm install --prefix functions --package-lock=false && npm --prefix functions run build &&
//      ./functions/node_modules/.bin/firebase emulators:exec --project demo-airway --only auth,functions,firestore "node scripts/shots-n6.mjs"
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099',
});
const { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT } = await import('../e2e/browser.mjs');
const outdir = resolve(ROOT, 'docs/shots/night-06');
mkdirSync(outdir, { recursive: true });
let shots = 0;
await withBrowser(async ({ browser, url }) => {
  for (const [language, width, height] of [['pl', 412, 915], ['en', 412, 915], ['pl', 915, 412]]) {
    const { page } = await newGamePage(browser, url, language, { width, height });
    page.on('requestfailed', (r) => console.log('requestfailed:', r.url(), r.failure()?.errorText));
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-daily');
    await page.waitForFunction(() => window.aw.state().screen === 'game' || window.aw.state().screen === 'tutorial', null, { timeout: 15000 });
    if (await page.evaluate(() => window.aw.state().screen) !== 'game') await page.evaluate(() => window.aw.skipTutorial?.());
    await waitForScreen(page, 'game', 15000);
    await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover', 20000);
    try {
      await page.waitForSelector('[data-testid="daily-ranking"][data-state="ready"]', { timeout: 30000 });
    } catch (error) {
      console.log('ranking state:', await page.evaluate(() => document.querySelector('[data-testid="daily-ranking"]')?.dataset.state ?? 'missing'));
      throw error;
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(outdir, `gameover-ranking-${language}-${width}x${height}.png`), fullPage: false });
    shots++;
    await page.close();
  }
});
console.log(`SUMMARY shots:n6 captured=${shots} expected=3`);

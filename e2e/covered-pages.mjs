// [night-11a] The globe stops drawing while an opaque page covers it: settings, licences, logbook, puzzle board and
// the tutorial replay each show 0 globe frames over 1.2 s (the DEV probe `__awWorld.frames()`), the menu and a
// running game keep drawing. EN 412×915 and PL 915×412.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, SEED } from './browser.mjs';

const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412]];
const WINDOW_MS = 1200;

async function framesOver(page) {
  const before = await page.evaluate(() => window.__awWorld.frames());
  await page.waitForTimeout(WINDOW_MS);
  return (await page.evaluate(() => window.__awWorld.frames())) - before;
}
async function expectDrawing(page, where) {
  await page.waitForTimeout(300);
  const n = await framesOver(page);
  assert(n >= 3, `${where}: only ${n} globe frames in ${WINDOW_MS} ms (should keep drawing)`);
  return n;
}
async function expectStill(page, where) {
  await page.waitForTimeout(300); // let the page mount and one in-flight frame finish
  const n = await framesOver(page);
  assert(n === 0, `${where}: ${n} globe frames in ${WINDOW_MS} ms behind an opaque page`);
}

async function journey(page) {
  await waitForScreen(page, 'menu');
  await page.waitForFunction(() => window.__awWorld?.ready, null, { timeout: 15000 });
  // The first menu show holds the globe until its sign and board are laid out.
  await page.waitForFunction(() => window.__awWorld.frames() > 5, null, { timeout: 15000 });
  const log = [];
  log.push(`menu ${await expectDrawing(page, 'menu')}`);
  await clickTestId(page, 'menu-settings');
  await expectStill(page, 'settings');
  await clickTestId(page, 'settings-licenses');
  await expectStill(page, 'licences');
  await page.keyboard.press('Escape'); // licences → settings
  await page.keyboard.press('Escape'); // settings → menu
  await waitForScreen(page, 'menu');
  log.push(`menu again ${await expectDrawing(page, 'menu after settings')}`);
  await clickTestId(page, 'menu-logbook');
  await expectStill(page, 'logbook');
  await page.keyboard.press('Escape');
  await clickTestId(page, 'menu-puzzles');
  await expectStill(page, 'puzzle board');
  await page.locator('button[data-action="open:01"]').click();
  await expectStill(page, 'puzzle 01');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'menu');
  await clickTestId(page, 'menu-settings');
  await clickTestId(page, 'settings-tutorial-replay');
  await page.getByTestId('tutorial-skip').waitFor({ timeout: 5000 });
  await expectStill(page, 'tutorial');
  await page.getByTestId('tutorial-skip').click();
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  log.push(`game ${await expectDrawing(page, 'game')}`);
  return log.join(', ');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}: no globe frames behind opaque pages`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        const detail = await journey(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${detail})`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `covered-pages-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:covered-pages seed=0x${SEED.toString(16).toUpperCase()} steps=${CASES.length} passed=${results.filter((r) => r.status === 'PASS').length} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed || results.length !== CASES.length ? 1 : 0;

// [night-12bc] R2h / D-251: Endless licence classes on the menu board. With only class I open the Endless row is
// unchanged (no licence select). Once the logbook has a class I flight that reached week 5 (4 weeks flown) and a class
// II one, the gate cell of the Endless row becomes the licence stamp select: I/II/III, class I by default, >= 48 px
// and inside the viewport, the Endless row no taller than the Puzzles row, the home-region select still there, no
// horizontal scroll. Picking a class stores it in 'airway.settings'; the logbook shows the per-class row. One case
// starts Endless and the running game reports the class (window.aw state). Menu-only otherwise (G7: no long runs).
// PL 412×915, EN 320×568, EN 915×412, PL 360×640; shots docs/shots/n12bc/. Fails on the old menu (no select).
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, SEED } from './browser.mjs';
import { ROOT } from '../scripts/lib/harness.mjs';

const SHOTS = resolve(ROOT, 'docs/shots/n12bc');
mkdirSync(SHOTS, { recursive: true });
const started = performance.now();
const results = [];
const CASES = [['pl', 412, 915, true], ['en', 320, 568, false], ['en', 915, 412, false], ['pl', 360, 640, false]];
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('airway.settings') || '{}').licenceClass ?? null);

/** Re-open the menu so it reads the stores again (the page clears storage on navigation, so no reload). */
async function reopenMenu(page) {
  await clickTestId(page, 'menu-settings');
  await waitForScreen(page, 'settings');
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'menu');
}

async function journey(page, language, width, height, startGame) {
  await waitForScreen(page, 'menu');
  await page.getByTestId('menu-home-region').waitFor({ timeout: 5000 });
  assert(await page.getByTestId('menu-licence').count() === 0, 'class I only: no licence select');

  await page.evaluate(() => localStorage.setItem('airway.logbook.v1', JSON.stringify({ flights: 3, passengers: 900,
    weeks: 10, longestWeeks: 5, hubs: {}, recent: [{ day: '2026-11-05', mode: 'endless', passengers: 300, weeks: 4, hub: null, licence: 2 }],
    licenceWeeks: { 1: 5, 2: 4 } })));
  await reopenMenu(page);
  const select = page.getByTestId('menu-licence');
  await select.waitFor({ timeout: 5000 });
  const values = await select.evaluate((node) => [...node.options].map((option) => option.value));
  assert(JSON.stringify(values) === '["1","2","3"]', `options ${values.join(',')}`);
  assert(await select.inputValue() === '1', 'class I by default');
  const label = await select.getAttribute('aria-label');
  assert(label === (language === 'pl' ? 'Klasa licencji' : 'Licence class'), `aria-label ${label}`);
  for (const testId of ['menu-licence', 'menu-home-region']) {
    const box = await page.getByTestId(testId).boundingBox();
    assert(box && box.height >= 48 && box.width >= 48 && box.x >= 0 && box.x + box.width <= width + 0.5 &&
      box.y >= 0 && box.y + box.height <= height + 0.5, `${testId} box ${JSON.stringify(box)}`);
  }
  const endless = await page.locator('.airway-flight-line').boundingBox();
  const puzzles = await page.getByTestId('menu-puzzles').boundingBox();
  assert(endless && puzzles && endless.height <= puzzles.height + 2, `Endless row ${endless?.height} vs ${puzzles?.height}`);
  const board = await page.locator('.airway-board').boundingBox();
  assert(board && board.y >= 0 && board.y + board.height <= height + 0.5, `board ${JSON.stringify(board)}`);
  const fits = await select.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
  assert(fits, 'closed stamp text overflows');

  await select.selectOption('3');
  assert(await stored(page) === 3, `stored ${await stored(page)}`);
  await page.screenshot({ path: resolve(SHOTS, `menu-licence-${language}-${width}x${height}.png`) });
  await reopenMenu(page);
  assert(await page.getByTestId('menu-licence').inputValue() === '3', 'choice shown again on the menu');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'horizontal scroll');

  await clickTestId(page, 'menu-logbook');
  await waitForScreen(page, 'logbook');
  const row = await page.evaluate(() => document.querySelector('[data-row="licences"] dd')?.textContent ?? '');
  const want = language === 'pl' ? 'I: 5 tygodni · II: 4 tygodnie · III: 0 tygodni' : 'I: 5 weeks · II: 4 weeks · III: 0 weeks';
  assert(row === want, `logbook row "${row}"`);
  assert(await page.locator('[data-licence="2"]').count() === 1, 'class II stamp in the recent flights');
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'menu');

  if (startGame) {
    await page.getByTestId('menu-licence').selectOption('2');
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game', 30000);
    const licence = await page.evaluate(() => window.aw.state().licenceClass);
    assert(licence === 2, `running game's licence class ${licence}`);
  } else {
    await page.getByTestId('menu-licence').selectOption('1');
    assert(await stored(page) === null, 'class I removes the stored class');
  }
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height, startGame] of CASES) {
      const label = `${language} ${width}×${height}: no stamp at class I, stamp once II is open, store, logbook${startGame ? ', start Endless in class II' : ', back to class I'}`;
      let page = null;
      try {
        ({ page } = await newGamePage(browser, url, language, { width, height }));
        await journey(page, language, width, height, startGame);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, `licence-classes-${results.length + 1}`) : null;
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page?.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
}
for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
if (fatal) console.error('FAIL harness: ' + fatal);
const passed = results.filter((item) => item.status === 'PASS').length;
const failedCount = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:licence-classes seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

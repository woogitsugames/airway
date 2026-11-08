// [night-11aj] R2g / D-236: Endless home region on the menu board. The select sits in the Endless row's status cell:
// Random by default, Random + 7 regions (no Oceania), ≥ 48 px tall and inside the viewport, the Endless and Puzzles
// entries ≥ 48 px and the Endless entry inside the viewport (night-55a, D-318: Linoryt's Endless slab may be taller than
// Puzzles) and the Endless line no more than the entry plus the select (night-23a: Róża sets the select
// under the entry), no horizontal scroll. Picking a region stores it in
// 'airway.settings' and the menu shows it again after a trip to Settings; Random removes it. One case then starts
// Endless and the running game reports the picked region (window.aw state). Menu-only otherwise (G7: no long runs).
// PL 412×915, EN 320×568, EN 915×412, PL 360×640; shots docs/shots/n11aj/. Fails on the old menu (no select).
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, SEED, RENDER, gameUrl, assertRender, shotsDir,
} from './browser.mjs';
import { ROOT } from '../scripts/lib/harness.mjs';

// [night-44a] `test:e2e:home-region:stub` (--render=stub): the menu and the started run on the stub world (D-254); its PNGs
// go to .e2e/stub/n11aj/.
const SHOTS = shotsDir(resolve(ROOT, 'docs/shots/n11aj'));
mkdirSync(SHOTS, { recursive: true });
const started = performance.now();
const results = [];
const CASES = [['pl', 412, 915, true], ['en', 320, 568, false], ['en', 915, 412, false], ['pl', 360, 640, false]];
const REGIONS = ['random', 'NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI'];
const overlaps = (a, b) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('airway.settings') || '{}').homeRegion ?? null);

async function journey(page, language, width, height, startGame) {
  await assertRender(page);
  await waitForScreen(page, 'menu');
  const select = page.getByTestId('menu-home-region');
  await select.waitFor({ timeout: 5000 });
  const values = await select.evaluate((node) => [...node.options].map((option) => option.value));
  assert(JSON.stringify(values) === JSON.stringify(REGIONS), `options ${values.join(',')}`);
  assert(await select.inputValue() === 'random', 'Random by default');
  const label = await select.getAttribute('aria-label');
  assert(label === (language === 'pl' ? 'Region startowy' : 'Home region'), `aria-label ${label}`);
  const box = await select.boundingBox();
  assert(box && box.height >= 48 && box.width >= 48 && box.x >= 0 && box.x + box.width <= width + 0.5 &&
    box.y >= 0 && box.y + box.height <= height + 0.5, `select box ${JSON.stringify(box)}`);
  // [night-23a] Measured against the page, not one skin's layout (Róża, D-257, sets the select in a controls row under
  // the entry): the Endless entry is no taller than the Puzzles entry, and the Endless line holds only the entry and
  // the select (no extra row), side by side or stacked, without overlap.
  const line = await page.locator('.airway-flight-line').boundingBox();
  const [entry, puzzles] = await Promise.all(['menu-endless', 'menu-puzzles'].map((testId) => page.getByTestId(testId).boundingBox()));
  // [night-55a] D-318: the Endless entry is the menu's prominent red slab in Linoryt (D-301, mockup a-menu.png), so it
  // may be taller than Puzzles; both stay ≥ 48 px targets and the Endless entry lies inside the viewport.
  for (const [name, item] of [['Endless', entry], ['Puzzles', puzzles]]) {
    assert(item && item.height >= 48 && item.width >= 48, `${name} entry below 48 px ${JSON.stringify(item)}`);
  }
  assert(entry.x >= 0 && entry.x + entry.width <= width + 0.5 && entry.y >= 0 && entry.y + entry.height <= height + 0.5,
    `Endless entry outside the viewport ${JSON.stringify(entry)}`);
  const span = Math.max(entry.y + entry.height, box.y + box.height) - Math.min(entry.y, box.y);
  // [night-55a] D-318: Linoryt spaces the slab off the next rule (4 px at 412×915); an extra row would hold a ≥ 48 px
  // control, so less than half of one is spacing, not a row.
  assert(line && line.height <= span + 24, `Endless line ${line?.height} taller than its entry and select (${span})`);
  assert(!overlaps(box, entry), `select overlaps the entry ${JSON.stringify(box)} ${JSON.stringify(entry)}`);
  const board = await page.locator('.airway-board').boundingBox();
  assert(board && board.y >= 0 && board.y + board.height <= height + 0.5, `board ${JSON.stringify(board)}`);
  const text = await select.evaluate((node) => node.selectedOptions[0]?.textContent ?? '');
  const fits = await select.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
  assert(text.length > 0 && fits, `closed select text "${text}" overflows`);

  await select.selectOption('EUN');
  assert(await stored(page) === 'EUN', `stored ${await stored(page)}`);
  await page.screenshot({ path: resolve(SHOTS, `menu-home-region-${language}-${width}x${height}.png`) });
  await clickTestId(page, 'menu-settings');
  await waitForScreen(page, 'settings');
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'menu');
  assert(await page.getByTestId('menu-home-region').inputValue() === 'EUN', 'choice shown again on the menu');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'horizontal scroll');

  if (startGame) {
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game', 30000);
    const region = await page.evaluate(() => window.aw.state().homeRegion);
    assert(region === 'EUN', `running game's home region ${region}`);
  } else {
    await page.getByTestId('menu-home-region').selectOption('random');
    assert(await stored(page) === null, 'Random removes the stored region');
  }
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height, startGame] of CASES) {
      const label = `${language} ${width}×${height}: select, store, reopen${startGame ? ', start Endless' : ', back to Random'}`;
      let page = null;
      try {
        ({ page } = await newGamePage(browser, gameUrl(url), language, { width, height }));
        await journey(page, language, width, height, startGame);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, `home-region-${results.length + 1}`) : null;
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
console.log(`SUMMARY test:e2e:home-region seed=0x${SEED.toString(16).toUpperCase()}${RENDER === 'stub' ? ' render=stub' : ''} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

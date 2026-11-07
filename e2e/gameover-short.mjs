// [night-10m] Game-over report on short portrait phones: found by a 14-minute PL 360×640 long play (ui:long-play),
// where a week-2 jam with four cancelled departures, three PL causes and a new record pushed "New world" and "Menu"
// below the screen. The bot plays Endless seed 0xA1A1 into week 2, a hub is overloaded, and every action button
// must lie inside the viewport without scrolling, with the report readable above them. PL/EN at 360×640 and
// 320×568; shots docs/shots/n10m/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, ARTIFACTS, SKIN, skinUrl } from './browser.mjs'; // [night-29a] --skin=linoryt
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['gameover-short'].seeds[0];

const started = performance.now();
// [night-29a] A `--skin` preview run keeps its frames out of the committed shots.
const SHOTS = SKIN ? resolve(ARTIFACTS, `gameover-short-${SKIN}`) : resolve(ROOT, 'docs/shots/n10m');
const results = [];
const cases = [['pl', 360, 640], ['en', 360, 640], ['pl', 320, 568], ['en', 320, 568]];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of cases) {
      const label = `${language} ${width}×${height}: game-over actions on screen`;
      const { page, errors } = await newGamePage(browser, skinUrl(url), language, { width, height });
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        let s = await page.evaluate(() => window.aw.autoplay(2));
        if (s.screen === 'upgrade') {
          const enabled = await page.evaluate(() =>
            [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => !n.disabled && !['hub-expansion', 'departure-slots'].includes(n.dataset.upgrade)));
          await clickTestId(page, `upgrade-option-${enabled.indexOf(true)}`);
          await waitForScreen(page, 'game');
          s = await state(page);
        }
        await page.evaluate(() => window.aw.forceHubOverload());
        await waitForScreen(page, 'gameover', 20000);
        await page.getByTestId('game-over').waitFor({ timeout: 5000 });
        await page.waitForTimeout(1500); // the board flips in; reduced motion keeps it short
        await checkActions(page, label, width, height);
        await page.screenshot({ path: resolve(SHOTS, `gameover-${language}-${width}x${height}.png`) });
        // Worst case from the long play: the DEV game-over preview has three departures from the jammed hub and three causes.
        await page.goto(skinUrl(url + '?preview=gameover'), { waitUntil: 'load' });
        await page.getByTestId('game-over').waitFor({ timeout: 8000 });
        await page.waitForTimeout(800);
        await checkActions(page, label + ' (3 departures)', width, height, 3);
        await page.screenshot({ path: resolve(SHOTS, `gameover-4-${language}-${width}x${height}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-short-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
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
  console.log(`SUMMARY test:e2e:gameover-short seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

/** Every action inside the viewport without scrolling, ≥ 48 px, below the report strip; `flights` rows expected. */
async function checkActions(page, label, width, height, flights = null) {
  const m = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
    const buttons = ['gameover-same', 'gameover-new', 'gameover-menu']
      .map((id) => [id, document.querySelector(`[data-testid="${id}"]`)]).filter(([, el]) => el).map(([id, el]) => ({ id, ...box(el) }));
    const overlay = document.querySelector('.airway-go-overlay');
    return { buttons, scrollTop: overlay?.scrollTop ?? 0, flights: document.querySelectorAll('.airway-go-flight').length,
      causes: document.querySelectorAll('.airway-go-causes li').length, strip: box(document.querySelector('.airway-go-strip')) };
  });
  console.log(`${label}: flights=${m.flights} causes=${m.causes}`);
  assert(m.buttons.length === 3, `${m.buttons.length} action buttons`);
  for (const b of m.buttons) {
    assert(b.top >= -0.5 && b.bottom <= height + 0.5 && b.left >= -0.5 && b.right <= width + 0.5,
      `${b.id} off-screen ${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}`);
    assert(b.height >= 47.5, `${b.id} target ${Math.round(b.height)} px`);
  }
  assert(m.scrollTop === 0, `report opened scrolled (${m.scrollTop})`);
  assert(m.strip.bottom <= Math.min(...m.buttons.map((b) => b.top)) + 0.5, 'report strip runs under the buttons');
  if (flights !== null) assert(m.flights === flights, `${m.flights} departures shown, expected ${flights}`);
}

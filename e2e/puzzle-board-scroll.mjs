// [night-10y] The puzzle board opens where the player is: with puzzles 01–19 cleared it shows flap 20 (the first
// departure not yet cleared) without scrolling, Back from puzzle 27 returns to flap 27 with focus on it, the
// hardware/system back (router `back()`) does the same, and a fresh profile still opens at puzzle 01. Only the
// departures list scrolls, never the page. EN 412×915, PL 915×412, PL 360×640.
import { performance } from 'node:perf_hooks';
import { gameUrl, withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, SEED } from './browser.mjs';

const started = performance.now();
const results = [];
const cases = [['en', { width: 412, height: 915 }], ['pl', { width: 915, height: 412 }], ['pl', { width: 360, height: 640 }]];
const cleared = Object.fromEntries(Array.from({ length: 19 }, (_, i) => [String(i + 1).padStart(2, '0'), 2]));

const click = async (page, action) => {
  const target = page.locator(`button[data-action="${action}"]`);
  await target.waitFor({ timeout: 5000 });
  await target.click();
};
/** Where a flap sits inside the departures list: fully visible, focused, list and page scroll. */
const flap = (page, id) => page.evaluate((flapId) => {
  const table = document.querySelector('.puzzle-departures');
  const node = document.querySelector(`button[data-action="open:${flapId}"]`);
  if (!table || !node) return null;
  const t = table.getBoundingClientRect(), r = node.getBoundingClientRect();
  return { visible: r.top >= t.top - 1 && r.bottom <= t.bottom + 1, focused: document.activeElement === node,
    listScroll: Math.round(table.scrollTop), pageScroll: Math.round(document.scrollingElement?.scrollTop ?? 0) };
}, id);
async function openBoard(page) {
  await clickTestId(page, 'menu-puzzles');
  await page.locator('.puzzle-departures .puzzle-flap').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(100); // the first-visit scroll may wait one frame for layout
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, viewport] of cases) {
      const size = `${language} ${viewport.width}×${viewport.height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, viewport);
      const step = async (label, run) => {
        try {
          await run();
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label: `${size}: ${label}`, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, `puzzle-board-scroll-${results.length + 1}`);
          results.push({ label: `${size}: ${label}`, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
        }
      };
      await waitForScreen(page, 'menu');
      await step('fresh profile opens at puzzle 01', async () => {
        await openBoard(page);
        const first = await flap(page, '01');
        assert(first?.visible && first.listScroll === 0 && first.pageScroll === 0, `flap 01 ${JSON.stringify(first)}`);
        await click(page, 'exit');
        await waitForScreen(page, 'menu');
      });
      await step('19 cleared: the board shows flap 20', async () => {
        await page.evaluate((p) => localStorage.setItem('airway.puzzles.v1', JSON.stringify(p)), cleared);
        await openBoard(page);
        const next = await flap(page, '20');
        assert(next?.visible && next.listScroll > 0 && next.pageScroll === 0, `flap 20 ${JSON.stringify(next)}`);
      });
      await step('Back from puzzle 27 returns to flap 27 with focus', async () => {
        await page.locator('.puzzle-departures').evaluate((t) => { t.scrollTop = t.scrollHeight; });
        await click(page, 'open:27');
        await click(page, 'back');
        const back = await flap(page, '27');
        assert(back?.visible && back.focused && back.pageScroll === 0, `flap 27 ${JSON.stringify(back)}`);
      });
      await step('system back from puzzle 05 returns to flap 05', async () => {
        await click(page, 'open:05');
        await page.keyboard.press('Escape');
        await page.locator('.puzzle-departures').waitFor({ timeout: 3000 });
        const back = await flap(page, '05');
        assert(back?.visible && back.focused, `flap 05 ${JSON.stringify(back)}`);
      });
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:puzzle-board-scroll seed=0x${SEED.toString(16).toUpperCase()} cases=${cases.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== cases.length * 4) process.exitCode = 1;
}

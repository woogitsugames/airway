// [night-10a] A newly opened airport is marked in the real app: no mark on the opening airports, the airport that
// opens mid-run carries the "NEW/NOWE" stub on its luggage tag, and the mark goes after 12 game hours.
// EN and PL at 412×915, fixed seed, fails closed; screenshots into docs/shots/n10a/ (inspect before committing).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT } from './browser.mjs';

const SEED = 4242; // opens its 5th airport in the first game day, on the visible side of the globe
const STEPS = 4; // 2 per language
const MARK_TICKS = 720;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10a');
const results = [];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, word, aria] of [['en', 'NEW', 'New airport'], ['pl', 'NOWE', 'Nowe lotnisko']]) {
      const { page, errors } = await newGamePage(browser, url, language, { width: 412, height: 915 });
      const step = async (label, run) => {
        if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); return; }
        try {
          await run();
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, `new-airport-${language}-${results.length + 1}`);
          results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
        }
      };
      await step(`${language}: the airport opened mid-run carries the ${word} stub`, async () => {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        const opening = await page.locator('.airport-bubble').count();
        assert(opening > 0, 'no airports');
        assert(await page.locator('.airport-bubble--new').count() === 0, 'an opening airport is marked new');
        let ticks = 0;
        while (await page.locator('.airport-bubble').count() === opening) {
          assert(ticks < 3000, 'no airport opened within 3000 ticks');
          await page.evaluate(() => window.aw.advanceTicks(20));
          ticks += 20;
        }
        const marked = page.locator('.airport-bubble--new');
        assert(await marked.count() === 1, `marked airports: ${await marked.count()}`);
        await marked.waitFor({ state: 'visible', timeout: 3000 });
        const text = (await marked.locator('.airport-bubble__new').textContent())?.trim();
        assert(text === word, `stub text ${text}`);
        const label = await marked.getAttribute('aria-label');
        assert(label?.startsWith(aria), `aria-label ${label}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: resolve(SHOTS, `new-airport-${language}-412x915.png`) });
      });
      await step(`${language}: the mark goes after 12 game hours`, async () => {
        await page.evaluate((ticks) => window.aw.advanceTicks(ticks), MARK_TICKS + 20);
        await page.waitForTimeout(200);
        const left = await page.locator('.airport-bubble--new, .airport-edge--new').count();
        assert(left === 0, `still marked: ${left}`);
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
  console.log(`SUMMARY test:e2e:new-airport seed=${SEED} steps=${results.length} passed=${passed} failed=${failedCount} ` +
    `durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

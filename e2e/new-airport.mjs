// [night-10a] A newly opened airport is marked in the real app: no mark on the opening airports, the airport that
// opens mid-run carries the "NEW/NOWE" stub on its luggage tag, and the mark goes after 12 game hours.
// [night-11o] Since rules v5 an airport opens every 12 game hours (SPAWNER_INTERVAL_TICKS = NEW_MARK_TICKS), so
// when the first mark expires the next airport opens marked: step 2 follows the first marked airport by id (still
// marked 40 ticks before the 12 hours, unmarked 20 after) and allows marks only on airports opened after it.
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
      let markedId = null;
      let known = [];
      let openedAt = 0;
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
        openedAt = ticks;
        assert(await marked.count() === 1, `marked airports: ${await marked.count()}`);
        await marked.waitFor({ state: 'visible', timeout: 3000 });
        const text = (await marked.locator('.airport-bubble__new').textContent())?.trim();
        assert(text === word, `stub text ${text}`);
        const label = await marked.getAttribute('aria-label');
        markedId = await marked.getAttribute('data-airport');
        assert(markedId, 'marked tag has no airport id');
        known = await page.evaluate(() => window.aw.state().airports.map((airport) => airport.id));
        assert(known.includes(markedId), `marked ${markedId} is not an open airport`);
        assert(label?.startsWith(aria), `aria-label ${label}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: resolve(SHOTS, `new-airport-${language}-412x915.png`) });
      });
      await step(`${language}: the mark goes after 12 game hours`, async () => {
        const isMarked = () => page.evaluate((id) =>
          document.querySelector(`.airport-bubble[data-airport="${id}"]`)?.classList.contains('airport-bubble--new') ?? false, markedId);
        // The opening was seen within 20 ticks of the spawn, so MARK_TICKS - 40 more is still inside the 12 hours.
        await page.evaluate((ticks) => window.aw.advanceTicks(ticks), MARK_TICKS - 40);
        await page.waitForTimeout(200);
        assert(await isMarked(), `${markedId} lost its mark before 12 game hours`);
        await page.evaluate(() => window.aw.advanceTicks(60));
        await page.waitForTimeout(200);
        assert(!(await isMarked()), `${markedId} still marked after 12 game hours`);
        const left = await page.evaluate(() => [...document.querySelectorAll('.airport-bubble--new')].map((node) => node.dataset.airport));
        const stale = left.filter((id) => known.includes(id));
        assert(stale.length === 0, `airports open since tick ${openedAt} still marked: ${stale.join(', ')}`);
        const edges = await page.locator('.airport-edge--new').count();
        assert(edges <= left.length, `edge marks ${edges} > newer marked airports ${left.length}`);
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

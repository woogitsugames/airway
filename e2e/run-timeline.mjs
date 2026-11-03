// [night-10r] End-of-run timeline on the game-over report: a real Endless run (bot through week 2, one weekly crate
// taken by click), a hub overloaded, then the "Timeline" tab: one line per week from the command journal (week 1
// opened routes, week 2 names the crate taken), a closing line with the jammed hub, the report keeps its height
// (actions do not move, stay on screen) and "Causes" brings the causes back. PL/EN at 412×915 and 360×640; shots
// docs/shots/n10r/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10r');
const cases = [['pl', 412, 915], ['en', 412, 915], ['pl', 360, 640], ['en', 360, 640]];
const results = [];

const actions = (page) => page.evaluate(() => ['gameover-same', 'gameover-new', 'gameover-menu'].map((id) => {
  const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
}));

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of cases) {
      const label = `${language} ${width}×${height}: timeline`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        const s = await page.evaluate(() => window.aw.autoplay(2));
        assert(s.screen === 'upgrade', `autoplay ended on ${s.screen}`);
        const picked = await page.evaluate(() => {
          const options = [...document.querySelectorAll('[data-testid^="upgrade-option-"]')];
          const index = options.findIndex((n) => !n.disabled && ['turboprop', 'widebody'].includes(n.dataset.upgrade));
          return { index, upgrade: options[index]?.dataset.upgrade };
        });
        assert(picked.index >= 0, 'no aircraft crate on the week-2 board');
        await clickTestId(page, `upgrade-option-${picked.index}`);
        await waitForScreen(page, 'game');
        const upgrades = (await state(page)).upgrades ?? [];
        await page.evaluate(() => window.aw.forceHubOverload());
        await waitForScreen(page, 'gameover', 20000);
        await page.getByTestId('game-over').waitFor({ timeout: 5000 });
        await page.waitForTimeout(1000);
        const before = await actions(page);
        assert(await page.getByTestId('gameover-tab-causes').getAttribute('aria-selected') === 'true', 'causes not first');
        await clickTestId(page, 'gameover-tab-timeline');
        await page.waitForFunction(() => document.querySelector('[data-testid="gameover-timeline"]')?.dataset.state === 'ready', null, { timeout: 15000 });
        const rows = await page.evaluate(() => [...document.querySelectorAll('.airway-go-timeline-week')].map((li) => li.textContent));
        const after = await actions(page);
        const endShown = await page.evaluate(() => {
          const panel = document.querySelector('[data-testid="gameover-timeline"]').getBoundingClientRect();
          const end = document.querySelector('.airway-go-timeline-end').getBoundingClientRect();
          return end.top >= panel.top - 1 && end.bottom <= panel.bottom + 1;
        });
        await page.screenshot({ path: resolve(SHOTS, `timeline-${language}-${width}x${height}.png`) });
        assert(rows.length >= 3, `rows ${rows.length}: ${rows.join(' | ')}`);
        const [week1, week2] = rows;
        assert(/^(W|T)1\+\d/.test(week1), `week 1 opens routes: ${week1}`);
        const names = { pl: { turboprop: 'Turbośmigłowiec', widebody: 'Szerokokadłubowiec' }, en: { turboprop: 'Turboprop', widebody: 'Widebody' } };
        const want = upgrades.filter((u) => u.week === 1).map((u) => names[language][u.upgrade]).filter(Boolean);
        for (const name of want) assert(week2.includes(name), `week 2 names the week-1 crate ${name}: ${week2}`);
        assert(/LIS|[A-Z]{3}/.test(rows.at(-1)) && rows.at(-1).includes(language === 'pl' ? 'zator' : 'jammed'), `closing line: ${rows.at(-1)}`);
        assert(endShown, 'closing line not visible in the panel');
        assert(JSON.stringify(before) === JSON.stringify(after), `actions moved: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        assert(after.every((b) => b.top >= 0 && b.bottom <= height), `actions off screen: ${JSON.stringify(after)}`);
        await clickTestId(page, 'gameover-tab-causes');
        assert(await page.locator('.airway-go-causes').isVisible(), 'causes not back');
        assert(!(await page.getByTestId('gameover-timeline').isVisible()), 'timeline still shown');
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `run-timeline-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:run-timeline seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

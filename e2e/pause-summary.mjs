// [night-10j] The pause sheet carries a network summary (routes and aircraft, fullest hub, time to the next
// crates). The bot plays Endless on the fixed seed into week 2, then Escape opens the sheet: three rows with real
// numbers in the player's language, the whole sheet inside the viewport and clear of the boarding pass, every
// button still a 48 px target. EN 412×915, PL 915×412, PL 360×640, EN 320×568; shots docs/shots/n10j/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10j');
const results = [];

const cases = [
  ['en', { width: 412, height: 915 }],
  ['pl', { width: 915, height: 412 }],
  ['pl', { width: 360, height: 640 }],
  ['en', { width: 320, height: 568 }],
];

const WORDS = {
  en: { network: /^\d+ routes? · \d+ aircraft(, \d+\sspare)?$/, hub: /^(\S.* \d+\/\d+|none yet)$/, board: /^in \d+ (days?|h) /u },
  pl: { network: /^\d+ tras[ay]? · \d+ samolot(y|ów)?(, \d+\sw\srezerwie)?$/, hub: /^(\S.* \d+\/\d+|jeszcze brak)$/, board: /^za \d+ /u },
};

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, viewport] of cases) {
      const label = `${language} ${viewport.width}×${viewport.height}: pause summary`;
      const { page, errors } = await newGamePage(browser, url, language, viewport);
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        let s = await page.evaluate(() => window.aw.autoplay(2));
        if (s.screen === 'upgrade') {
          const list = await page.evaluate(() =>
            [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
          await clickTestId(page, `upgrade-option-${list.findIndex((item) => item !== 'hub-expansion' && item !== 'departure-slots')}`);
          await waitForScreen(page, 'game');
          s = await state(page);
        }
        assert(s.screen === 'game', `not in the game: ${s.screen}`);
        await page.keyboard.press('Escape');
        await page.getByTestId('action-resume').waitFor({ timeout: 5000 });
        const m = await page.evaluate(() => {
          const sheet = document.querySelector('.airway-pause').getBoundingClientRect();
          const pass = document.querySelector('.airway-pass')?.getBoundingClientRect() ?? null;
          const rows = Object.fromEntries([...document.querySelectorAll('[data-testid="pause-summary"] dd')]
            .map((dd) => [dd.dataset.row, dd.textContent]));
          const buttons = [...document.querySelectorAll('.airway-pause button')].map((b) => b.getBoundingClientRect())
            .map((r) => ({ width: r.width, height: r.height }));
          const overlaps = pass ? !(sheet.right <= pass.left || sheet.left >= pass.right || sheet.bottom <= pass.top || sheet.top >= pass.bottom) : false;
          return { sheet: { top: sheet.top, bottom: sheet.bottom, left: sheet.left, right: sheet.right }, overlaps, rows, buttons,
            clipped: [...document.querySelectorAll('[data-testid="pause-summary"] > *')].some((el) => el.scrollWidth > el.clientWidth + 1) };
        });
        console.log('summary', JSON.stringify(m.rows));
        const words = WORDS[language];
        for (const key of ['network', 'hub', 'board']) assert(words[key].test(m.rows[key] ?? ''), `${key} row "${m.rows[key]}"`);
        assert(m.sheet.top >= -0.5 && m.sheet.bottom <= viewport.height + 0.5 && m.sheet.left >= -0.5 && m.sheet.right <= viewport.width + 0.5,
          `sheet outside the viewport: ${JSON.stringify(m.sheet)}`);
        assert(!m.overlaps, 'pause sheet overlaps the boarding pass');
        assert(!m.clipped, 'summary text clipped');
        assert(m.buttons.length === 3 && m.buttons.every((b) => b.width >= 47.5 && b.height >= 47.5), `buttons ${JSON.stringify(m.buttons)}`);
        await page.screenshot({ path: resolve(SHOTS, `pause-${language}-${viewport.width}x${viewport.height}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `pause-summary-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:pause-summary seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

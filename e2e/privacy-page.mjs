// [night-11e] R1b: the privacy policy is reachable in the app. Settings → Help has a "Privacy policy" row (≥ 48 px);
// it opens an in-app page with the site's policy (title, draft warning, its sections — 14 since R7a — date) in the player's
// language, with no network request, no horizontal scroll and the globe not drawing behind it; the Back button and
// hardware back/Escape return to settings. PL/EN at 412×915, 915×412 and 320×568; shots docs/shots/n11e/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gameUrl, withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, state, ROOT, SEED } from './browser.mjs';
import { translations } from '../site/i18n.js';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11e');
const results = [];
const cases = [['pl', 412, 915], ['en', 915, 412], ['en', 412, 915], ['pl', 320, 568]];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of cases) {
      const label = `${language} ${width}×${height}: settings → privacy policy → back`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      const external = [];
      // [night-11at] blob: URLs are in-memory globe textures (src/render/globe/look.ts), not network; they made this flaky.
      page.on('request', (request) => {
        const target = request.url();
        if (!target.startsWith('blob:') && !target.startsWith(url.replace(/\/[^/]*$/, ''))) external.push(target);
      });
      try {
        await waitForScreen(page, 'menu');
        await clickTestId(page, 'menu-settings');
        const row = page.getByTestId('settings-privacy');
        await row.waitFor({ timeout: 5000 });
        const box = await row.boundingBox();
        assert(box && box.height >= 48 && box.width >= 48, `privacy row ${box?.width}×${box?.height}`);
        await row.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(SHOTS, `settings-help-${language}-${width}x${height}.png`) });
        await row.click();
        await page.getByTestId('privacy-page').waitFor({ timeout: 5000 });
        const site = translations[language];
        const m = await page.evaluate(() => {
          const paper = document.querySelector('[data-testid="privacy-page"]');
          const back = paper?.querySelector('.airway-settings__back')?.getBoundingClientRect();
          return {
            title: paper?.querySelector('h1')?.textContent ?? '',
            warning: paper?.querySelector('.airway-privacy__warning')?.textContent ?? '',
            headings: [...(paper?.querySelectorAll('.airway-privacy__section h2') ?? [])].map((h) => h.textContent),
            // [night-11am] R7a: a body is paragraphs and lists; compare its blocks' text line by line.
            bodies: [...(paper?.querySelectorAll('.airway-privacy__section') ?? [])].map((section) =>
              [...section.querySelectorAll('p, li')].map((node) => node.textContent).join('\n')),
            date: paper?.querySelector('.airway-privacy__date')?.textContent ?? '',
            focus: document.activeElement?.classList.contains('airway-settings__back') ?? false,
            back: back ? [back.width, back.height] : null,
            scroll: document.documentElement.scrollWidth > innerWidth + 2
              || (paper ? paper.scrollWidth > paper.clientWidth + 2 : true),
            screen: document.querySelector('.airway-screen-root')?.dataset.screen,
          };
        });
        assert(m.screen === 'privacy', `router screen ${m.screen}`);
        assert(m.title === site['privacy.title'], `title "${m.title}"`);
        assert(m.warning === site['privacy.warning'], 'draft warning missing or different');
        const n = Object.keys(site).filter((key) => /^privacy\.s\d+\.title$/.test(key)).map((_, i) => i + 1);
        const plain = (text) => text.split(/\n\s*\n/).flatMap((block) => block.split('\n')).map((line) => line.replace(/^• /, '')).join('\n');
        assert(JSON.stringify(m.headings) === JSON.stringify(n.map((i) => site[`privacy.s${i}.title`])), `headings ${m.headings}`);
        assert(JSON.stringify(m.bodies) === JSON.stringify(n.map((i) => plain(site[`privacy.s${i}.body`]))), 'section text differs from the site');
        assert(m.date === site['privacy.date'], `date "${m.date}"`);
        assert(m.focus, 'focus not on Back');
        assert(m.back && m.back[0] >= 48 && m.back[1] >= 48, `back ${m.back}`);
        assert(!m.scroll, 'horizontal scroll');
        assert((await state(page)).screen === 'settings', 'DEV screen should read settings');
        await page.screenshot({ path: resolve(SHOTS, `privacy-${language}-${width}x${height}.png`) });
        await page.evaluate(() => { const s = document.querySelector('.airway-settings'); if (s) s.scrollTop = s.scrollHeight; });
        await page.screenshot({ path: resolve(SHOTS, `privacy-end-${language}-${width}x${height}.png`) });
        // Back button → settings; open again; Escape (hardware back) → settings; Escape → menu.
        await page.locator('[data-testid="privacy-page"] .airway-settings__back').click();
        await page.getByTestId('settings-privacy').waitFor({ timeout: 5000 });
        await clickTestId(page, 'settings-privacy');
        await page.getByTestId('privacy-page').waitFor({ timeout: 5000 });
        await page.keyboard.press('Escape');
        await page.getByTestId('settings-privacy').waitFor({ timeout: 5000 });
        await page.keyboard.press('Escape');
        await waitForScreen(page, 'menu');
        assert(external.length === 0, `network requests outside the app: ${external.slice(0, 3)}`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `privacy-page-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:privacy-page seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

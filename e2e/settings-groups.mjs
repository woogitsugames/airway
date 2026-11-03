// [night-10k] Settings are grouped: Game (language, airport labels, airline colour), Display (graphics, text size,
// colour-vision mode), Sound and touch (sound, music, haptics), Help (tutorial replay, licences, privacy policy —
// night-11e). Each group is a
// labelled section in that order; wide landscape paper puts the groups in two columns, phones in one. PL/EN at
// 412×915, 915×412, 1000×904 and 320×568; shots docs/shots/n10k/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10k');
const results = [];
const cases = [
  ['pl', 412, 915, 1], ['en', 915, 412, 2], ['pl', 1000, 904, 2], ['en', 320, 568, 1],
];
const GROUPS = [
  ['settings-group-game', { en: 'Game', pl: 'Gra' }, ['select', 'select', '[data-testid="settings-airline"] select']],
  ['settings-group-display', { en: 'Display', pl: 'Obraz' }, ['select', 'select', '[data-testid="settings-colorblind"]']],
  ['settings-group-sound', { en: 'Sound and touch', pl: 'Dźwięk i dotyk' },
    ['[data-testid="settings-sound"]', '[data-testid="settings-music"]', '[data-testid="settings-haptics"]']],
  ['settings-group-help', { en: 'Help', pl: 'Pomoc' }, ['[data-testid="settings-tutorial-replay"]', '[data-testid="settings-licenses"]', '[data-testid="settings-privacy"]']],
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height, columns] of cases) {
      const label = `${language} ${width}×${height}: four groups, ${columns} column(s)`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await waitForScreen(page, 'menu');
        await clickTestId(page, 'menu-settings');
        await page.locator('.airway-settings__group').first().waitFor({ timeout: 5000 });
        const m = await page.evaluate((groups) => {
          const sections = [...document.querySelectorAll('.airway-settings__group')];
          return {
            ids: sections.map((section) => section.dataset.testid),
            titles: sections.map((section) => document.getElementById(section.getAttribute('aria-labelledby'))?.textContent ?? ''),
            counts: groups.map(([id, , selectors]) => {
              const section = document.querySelector(`[data-testid="${id}"]`);
              if (!section) return -1;
              const rows = section.querySelectorAll('.airway-setting').length + section.querySelectorAll(':scope > button').length;
              const found = selectors.every((selector) => section.querySelector(selector));
              return found ? rows : -2;
            }),
            lefts: sections.map((section) => Math.round(section.getBoundingClientRect().left)),
            scroll: document.documentElement.scrollWidth > innerWidth + 2,
          };
        }, GROUPS);
        assert(JSON.stringify(m.ids) === JSON.stringify(GROUPS.map(([id]) => id)), `group order ${m.ids}`);
        assert(JSON.stringify(m.titles) === JSON.stringify(GROUPS.map(([, names]) => names[language])), `titles ${m.titles}`);
        assert(m.counts.every((count, i) => count === GROUPS[i][2].length), `controls per group ${m.counts}`);
        assert(new Set(m.lefts).size === columns, `${new Set(m.lefts).size} column(s), expected ${columns}: ${m.lefts}`);
        assert(!m.scroll, 'horizontal page scroll');
        await page.screenshot({ path: resolve(SHOTS, `settings-${language}-${width}x${height}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `settings-groups-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:settings-groups seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

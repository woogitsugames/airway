// [night-11f] R1j: one tip on the game-over report in the player's first flights. A real Endless run (bot into
// week 2, one crate taken, a hub overloaded) on a fresh profile ends with one "Tip / Wskazówka" line in the causes
// panel, chosen by the leading cause (data-tip = the tip for the first cause with one), in the player's language;
// the Timeline tab hides it with the causes; all actions stay on screen. The same run with ten flights already in
// the logbook (this one is the 11th) shows no tip. PL/EN at 412×915, 915×412 and 360×640; shots docs/shots/n11f/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, waitForBoardModels } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11f');
const SEED = E2E_SEEDS['gameover-tip'].seeds[0]; // [night-12ac] e2e/seeds.mjs (0xA1C2): its forced jam lands on a served hub (0xA1A1 ends at an unserved airport: no tip, N11b hint)
const LOGBOOK_KEY = 'airway.logbook.v1';
// [language, width, height, flights already logged before this run, tip expected]
const cases = [['pl', 412, 915, 0, true], ['en', 915, 412, 0, true], ['en', 360, 640, 3, true], ['pl', 412, 915, 10, false]];
const TIP_FOR = { capacity: 'hub-overflow', 'congestion-duration': 'hub-overflow', 'long-wait': 'hub-overflow',
  'regional-demand': 'region', 'no-route': 'no-route', 'seat-shortage': 'seats', 'missed-transfer': 'transfer',
  'transfer-not-ready': 'transfer', 'slot-wait': 'slot-wait' };
const LABEL = { en: 'Tip', pl: 'Wskazówka' };
const results = [];

async function playToGameOver(page) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const s = await page.evaluate(() => window.aw.autoplay(2));
  if (s.screen === 'upgrade') {
    const index = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')]
      .findIndex((n) => !n.disabled && ['turboprop', 'widebody'].includes(n.dataset.upgrade)));
    await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
    await clickTestId(page, `upgrade-option-${Math.max(0, index)}`);
    await waitForScreen(page, 'game');
  }
  await page.evaluate(() => window.aw.forceHubOverload());
  await waitForScreen(page, 'gameover', 20000);
  await page.getByTestId('game-over').waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
}

function measure(page) {
  return page.evaluate(() => {
    const tip = document.querySelector('[data-testid="gameover-tip"]');
    const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const actions = ['gameover-same', 'gameover-new', 'gameover-menu'].map((id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect());
    return {
      tips: document.querySelectorAll('[data-testid="gameover-tip"]').length,
      kind: tip?.dataset.tip ?? null,
      label: tip?.querySelector('.airway-go-tip-label')?.textContent ?? '',
      text: tip?.textContent ?? '',
      visible: visible(tip),
      inPanel: !!tip?.closest('[role="tabpanel"]')?.querySelector('.airway-go-causes'),
      departures: document.querySelectorAll('.airway-go-flight').length,
      actionsOnScreen: actions.every((r) => r.top >= -0.5 && r.bottom <= innerHeight + 0.5),
      scrollTop: document.querySelector('.airway-go-overlay')?.scrollTop ?? 0,
    };
  });
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height, logged, expectTip] of cases) {
      const label = `${language} ${width}×${height}, ${logged} flights logged: ${expectTip ? 'one tip' : 'no tip'}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        if (logged) {
          // An init script after the harness's storage wipe, so the reload keeps the record.
          await page.addInitScript(([key, flights]) => {
            const entry = { day: '2026-11-01', mode: 'endless', passengers: 50, weeks: 1, hub: null };
            localStorage.setItem(key, JSON.stringify({ flights, passengers: 50 * flights, weeks: flights, longestWeeks: 1,
              hubs: {}, recent: Array.from({ length: Math.min(6, flights) }, () => entry) }));
          }, [LOGBOOK_KEY, logged]);
          await page.reload({ waitUntil: 'load' });
          await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
        }
        await playToGameOver(page);
        const book = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').flights, LOGBOOK_KEY);
        assert(book === logged + 1, `logbook flights ${book}, expected ${logged + 1}`);
        const m = await measure(page);
        const lead = await page.evaluate(() => window.aw.state().screen);
        assert(lead === 'gameover', `screen ${lead}`);
        assert(m.departures > 0, `the jam landed on an unserved airport (${m.departures} departures): pick another seed`);
        if (!expectTip) {
          assert(m.tips === 0, `${m.tips} tip(s) after ${logged + 1} flights`);
        } else {
          assert(m.tips === 1, `${m.tips} tip lines`);
          assert(m.visible, 'tip not visible');
          assert(m.inPanel, 'tip is not inside the causes tab panel');
          assert(m.label === LABEL[language], `label "${m.label}"`);
          assert(Object.values(TIP_FOR).includes(m.kind), `kind ${m.kind}`);
          assert(m.text.length > m.label.length + 20 && !/[{}]/.test(m.text), `text "${m.text}"`);
          assert(m.actionsOnScreen && m.scrollTop === 0, `actions off screen or report scrolled (${m.scrollTop})`);
          await page.screenshot({ path: resolve(SHOTS, `tip-${language}-${width}x${height}.png`) });
          await clickTestId(page, 'gameover-tab-timeline');
          await page.waitForTimeout(300);
          assert(!(await measure(page)).visible, 'tip still visible on the Timeline tab');
          await clickTestId(page, 'gameover-tab-causes');
          assert((await measure(page)).visible, 'tip gone after returning to Causes');
        }
        console.log(`${label}: departures=${m.departures} tip=${m.kind ?? '-'}`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-tip-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:gameover-tip seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

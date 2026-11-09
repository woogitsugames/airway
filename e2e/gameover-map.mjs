// [night-11c] The game-over report covered the network the run ended on. "Map" on the closed-network sign lifts the
// report and the dim: the globe under it takes gestures (it can be turned), the jammed airport's tag stays readable,
// the dock cannot revive the run (Undo does nothing), and "Back to report" or hardware back/Escape brings the report
// back with focus on "Map"; a second Escape leaves to the menu as before. Seed 0xA1A1 bot run to a jam.
// EN 412×915, PL 915×412, PL 360×640.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, waitForBoardModels } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['gameover-map'].seeds[0];

const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412], ['pl', 360, 640]];

async function toGameOver(page) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  for (let week = 1; week <= 30; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    if (s.screen === 'gameover') break;
    if (s.screen === 'upgrade') {
      const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
      const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
      await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
      await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
      await waitForScreen(page, 'game');
    }
  }
  await waitForScreen(page, 'gameover');
  await page.getByTestId('gameover-map').waitFor({ timeout: 5000 });
}

async function journey(page, width, height) {
  await toGameOver(page);
  const map = await page.getByTestId('gameover-map').boundingBox();
  assert(map && map.width >= 48 && map.height >= 48, `Map button ${JSON.stringify(map)}`);
  const before = await page.evaluate(() => ({ state: window.aw.state(), longitude: window.__awWorld?.longitude?.() }));
  await clickTestId(page, 'gameover-map');
  const view = await page.evaluate(() => {
    const content = document.querySelector('.airway-go-content');
    const bar = document.querySelector('.airway-go-mapbar');
    const under = document.elementFromPoint(innerWidth / 2, innerHeight * 0.45)?.className ?? '';
    const r = bar?.getBoundingClientRect();
    const tags = [...document.querySelectorAll('.airport-bubble')].filter((n) => !n.hidden && n.offsetParent).length;
    return { hidden: content?.hidden, bar: r ? { top: r.top, bottom: r.bottom, h: r.height } : null,
      under: String(under), focus: document.activeElement?.dataset?.testid, tags,
      dim: getComputedStyle(document.querySelector('.airway-go-overlay')).backgroundColor };
  });
  assert(view.hidden && view.bar && view.bar.bottom <= innerHeightOf(height) + 1, `map view ${JSON.stringify(view)}`);
  // [night-81a] D-336: or one of the map's own signs (UI-A direction signs stand over the globe), never the report.
  assert(view.under.includes('airway-world') || /\bairport-/.test(view.under), `the globe is not under the centre in map view: "${view.under}"`);
  assert(view.focus === 'gameover-map-back' && view.tags > 0 && /0\)$|transparent/.test(view.dim), `map view ${JSON.stringify(view)}`);
  // Turn the globe with a drag in the free area.
  // [night-81a] D-336: start on bare globe (the canvas itself, off the signs of the UI-A map view and off the jammed
  // airport in the middle, where a press is an airport pick, not a turn).
  const [gx, gy] = await page.evaluate(() => {
    for (const [fx, fy] of [[0.35, 0.62], [0.3, 0.55], [0.5, 0.65], [0.25, 0.7], [0.5, 0.4]]) {
      const x = innerWidth * fx, y = innerHeight * fy;
      if (document.elementFromPoint(x, y)?.classList.contains('airway-world')) return [fx, fy];
    }
    return [0.5, 0.4];
  });
  await page.mouse.move(width * gx, height * gy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(width * gx - i * 18, height * gy, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const turned = await page.evaluate(() => window.__awWorld?.longitude?.());
  assert(typeof turned === 'number' && Math.abs(turned - before.longitude) > 1, `globe did not turn in map view (${before.longitude} → ${turned})`);
  // Undo on the dock must not revive the run.
  const undo = page.locator('[data-hud-action="undo"]');
  if (await undo.count() && await undo.isVisible()) await undo.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.aw.state());
  assert(after.screen === 'gameover' && after.tick === before.state.tick, `undo in map view changed the run: ${JSON.stringify({ before: before.state.tick, after: after.tick, screen: after.screen })}`);
  await clickTestId(page, 'gameover-map-back');
  let back = await page.evaluate(() => ({ hidden: document.querySelector('.airway-go-content')?.hidden, focus: document.activeElement?.dataset?.testid }));
  assert(back.hidden === false && back.focus === 'gameover-map', `back to report ${JSON.stringify(back)}`);
  await clickTestId(page, 'gameover-map');
  await page.keyboard.press('Escape');
  back = await page.evaluate(() => ({ hidden: document.querySelector('.airway-go-content')?.hidden, screen: window.aw.state().screen }));
  assert(back.hidden === false && back.screen === 'gameover', `Escape from the map ${JSON.stringify(back)}`);
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'menu');
}
const innerHeightOf = (h) => h;

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}: game-over map view`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await journey(page, width, height);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-map-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:gameover-map seed=0x${SEED.toString(16).toUpperCase()} steps=${CASES.length} passed=${results.filter((r) => r.status === 'PASS').length} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed || results.length !== CASES.length ? 1 : 0;

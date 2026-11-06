// [night-11q] R5c: route-end handles are quiet at rest and never painted over airport tags. In the real game a
// route is drawn with a real pointer drag; at rest every visible handle is the small hollow marker (≤ 12 px, no
// fill) in its 48 px area, and the handle layer paints below the airport overlay (tags, edge chips). Pressing a
// handle and dragging turns that route's ends into the full diamond (skin token fill) (others stay quiet); moving back and
// releasing leaves the network as it was and the ends quiet again. EN 412×915, PL 915×412; shots docs/shots/n11q/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, dragGesture, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11q');
const CASES = [['en', { width: 412, height: 915 }], ['pl', { width: 915, height: 412 }]];
const results = [];

const handleState = (page) => page.evaluate(() => {
  const layer = document.querySelector('.airway-route-handles');
  const overlay = document.querySelector('.airport-overlay');
  const list = [...document.querySelectorAll('.airway-route-handle')].filter((node) => !node.hidden).map((node) => {
    const mark = getComputedStyle(node, '::before');
    const box = node.getBoundingClientRect();
    return { active: node.classList.contains('airway-route-handle--active'), width: parseFloat(mark.width) + (mark.boxSizing === 'border-box' ? 0 : 2 * parseFloat(mark.borderLeftWidth)),
      fill: mark.backgroundColor, x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  // [night-23a] The full diamond's fill is the active skin's token (Róża, D-257: chalk; Diorama: yellow), resolved here.
  const probe = layer.appendChild(document.createElement('i'));
  probe.style.background = 'var(--skin-atc-handle-active-bg)';
  const activeFill = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return {
    list, activeFill, sameParent: layer?.parentElement === overlay?.parentElement,
    layerZ: Number(getComputedStyle(layer).zIndex), overlayZ: Number(getComputedStyle(overlay).zIndex),
    // later siblings paint above at equal z; the overlay must win on z-index alone
  };
});
const quiet = (h) => !h.active && h.width <= 12 && (h.fill === 'rgba(0, 0, 0, 0)' || h.fill === 'transparent');

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, viewport] of CASES) {
      const label = `${language} ${viewport.width}×${viewport.height}`;
      const { page, errors } = await newGamePage(browser, url, language, viewport);
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        const before = await state(page);
        await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
        await page.waitForFunction((n) => window.aw.state().routeCount > n, before.routeCount, { timeout: 4000 });
        await page.waitForTimeout(300);
        const rest = await handleState(page);
        assert(rest.list.length >= 2, `visible handles ${rest.list.length}`);
        assert(rest.list.every(quiet), `handles at rest not quiet: ${JSON.stringify(rest.list)}`);
        assert(rest.sameParent && rest.layerZ < rest.overlayZ,
          `handles paint over the tags (handles z ${rest.layerZ}, overlay z ${rest.overlayZ}, same parent ${rest.sameParent})`);
        await page.screenshot({ path: resolve(SHOTS, `rest-${language}-${viewport.width}x${viewport.height}.png`) });
        const routes = (await state(page)).routeCount;
        const grip = rest.list[0];
        await page.mouse.move(grip.x, grip.y);
        await page.mouse.down();
        await page.mouse.move(grip.x + 18, grip.y + 18, { steps: 4 });
        await page.waitForTimeout(200);
        const held = await handleState(page);
        const active = held.list.filter((h) => h.active);
        assert(active.length >= 1 && held.activeFill.startsWith('rgb(') &&
          active.every((h) => h.width >= 20 && h.fill === held.activeFill),
          `grabbed route's ends not full (${held.activeFill}): ${JSON.stringify(held.list)}`);
        assert(held.list.filter((h) => !h.active).every(quiet), 'another route lost its quiet ends');
        await page.screenshot({ path: resolve(SHOTS, `held-${language}-${viewport.width}x${viewport.height}.png`) });
        await page.mouse.move(grip.x, grip.y, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await handleState(page);
        assert(after.list.every(quiet), `ends not quiet after release: ${JSON.stringify(after.list)}`);
        assert((await state(page)).routeCount === routes, 'releasing on the handle changed the network');
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `route-handles-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:route-handles seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length) process.exitCode = 1;
}

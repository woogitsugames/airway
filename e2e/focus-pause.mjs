// [night-11i] D-99 (Q-59 → B), D-119: auto-pause when the window loses focus (split screen, floating window, a
// desktop click elsewhere) while the page stays visible. Mid-run EN 412×915 and PL 915×412: a window `blur` opens
// the pause sheet and holds the run (same tick and state hash over 1.5 s) while the globe keeps drawing; `focus`
// coming back does not restart the clock (still paused 1 s later); only the player's Resume tap does. On the weekly
// upgrade board PL 412×915 a blur leaves the picker uncovered. Shots docs/shots/n11i/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11i');
const results = [];
const HOLD_MS = 1500;

const blur = (page) => page.evaluate(() => window.dispatchEvent(new Event('blur')));
const focus = (page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const sheetOpen = (page) => page.evaluate(() => {
  const sheet = document.querySelector('.airway-pause');
  return !!sheet && !sheet.hidden;
});
const frames = (page) => page.evaluate(() => window.__awWorld.frames());

async function startRun(page) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  await page.waitForFunction(() => window.aw.state().tick > 3, null, { timeout: 10000 });
}

async function blurMidRun(page, language, width, height) {
  await startRun(page);
  assert(!(await sheetOpen(page)), 'pause sheet open before the blur');
  await blur(page);
  assert(await sheetOpen(page), 'blur did not open the pause sheet');
  const a = await state(page);
  const fa = await frames(page);
  await page.waitForTimeout(HOLD_MS);
  const b = await state(page);
  assert(a.tick === b.tick && a.snapshotHash === b.snapshotHash, `run advanced while blurred: tick ${a.tick} → ${b.tick}`);
  assert(await frames(page) > fa, 'the picture stopped refreshing while blurred (multi-resume)');
  await page.screenshot({ path: resolve(SHOTS, `blurred-${language}-${width}x${height}.png`) });
  await focus(page);
  await page.waitForTimeout(1000);
  const c = await state(page);
  assert(await sheetOpen(page), 'focus closed the pause sheet by itself');
  assert(c.tick === b.tick, `focus restarted the clock: tick ${b.tick} → ${c.tick}`);
  const resume = await page.getByTestId('action-resume').boundingBox();
  assert(resume && resume.height >= 48 && resume.width >= 48, 'Resume is a 48 px target');
  await clickTestId(page, 'action-resume');
  await page.waitForFunction((tick) => window.aw.state().tick > tick, c.tick, { timeout: 8000 })
    .catch(() => { throw new Error('the run did not carry on after Resume'); });
  assert(!(await sheetOpen(page)), 'pause sheet still open after Resume');
}

async function blurOnUpgrade(page, language, width, height) {
  await startRun(page);
  const s = await page.evaluate(() => window.aw.autoplay(1));
  assert(s.screen === 'upgrade', `autoplay ended on "${s.screen}", not the upgrade board`);
  await blur(page);
  await page.waitForTimeout(300);
  assert(!(await sheetOpen(page)), 'blur covered the upgrade picker with the pause sheet');
  await focus(page);
  await page.waitForTimeout(300);
  assert(!(await sheetOpen(page)), 'focus covered the upgrade picker with the pause sheet');
  assert((await state(page)).screen === 'upgrade', 'upgrade board left');
  await page.screenshot({ path: resolve(SHOTS, `upgrade-after-blur-${language}-${width}x${height}.png`) });
}

const CASES = [
  ['en', 412, 915, blurMidRun, 'mid-run'],
  ['pl', 915, 412, blurMidRun, 'mid-run'],
  ['pl', 412, 915, blurOnUpgrade, 'on the upgrade board'],
];
let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height, journey, where] of CASES) {
      const label = `focus loss ${where} ${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await journey(page, language, width, height);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `focus-pause-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:focus-pause seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length) process.exitCode = 1;
}

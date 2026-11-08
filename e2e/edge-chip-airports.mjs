// [night-10v] Found in a long play-through at 412×915 EN 4×: on the "+2 slots" airport pick the visible airport
// nearest the left screen edge sat under the edge chip of an off-screen airport, so the tap went to the chip and
// the pick never completed. Edge chips now slide clear of on-screen airport markers. Seed 41817 (now e2e/seeds.mjs): a
// board by week 5 offers "+2 slots"; after a rotation the tap on the pick target (the first selectable airport on screen, here
// the one by the left edge) must reach the globe and complete the pick. Shots docs/shots/n10v/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, gameUrl, shotsDir, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT, RENDER, assertRender, waitForBoardModels,
} from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-30a] with --skin: .e2e/skin-linoryt/; [night-44a] with --render=stub (`test:e2e:edge-chip-airports:stub`; chips,
// the pick and its tap are DOM and the real camera/projection, D-254): .e2e/stub/. Tracked shots untouched either way.
const SHOTS = shotsDir(resolve(ROOT, 'docs/shots/n10v'));

const started = performance.now();
const results = [];
const SEED = E2E_SEEDS['edge-chip-airports'].seeds[0]; // [night-12aa] 41817 until rules v6 (test:e2e-seeds)
const CASES = [['en', 412, 915], ['pl', 915, 412]];

async function reachSlotsBoard(page) {
  for (let week = 2; week <= 5; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    assert(s.screen === 'upgrade', `board for week ${week} not reached (${s.screen})`);
    const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
    const slots = offers.indexOf('departure-slots');
    if (slots >= 0) return slots;
    const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
    await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
    await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
    await waitForScreen(page, 'game');
  }
  throw new Error('no "+2 slots" board by week 5');
}

async function journey(page, language, width, height) {
  await assertRender(page);
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const index = await reachSlotsBoard(page);
  await page.setViewportSize({ width: height, height: width });
  await page.waitForTimeout(700);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(700);
  await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
  await clickTestId(page, `upgrade-option-${index}`);
  await page.locator('.airway-upgrade-open.is-picking-hub').waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `pick-${language}-${width}x${height}.png`) });
  const target = await page.evaluate(() => window.aw.gesture('pick'));
  const under = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? null, target.from);
  assert(under === 'airway-world', `the pick target ${Math.round(target.from.x)},${Math.round(target.from.y)} is covered by "${under}"`);
  await page.mouse.click(target.from.x, target.from.y);
  await page.waitForTimeout(800);
  const stuck = await page.evaluate(() => !!document.querySelector('.airway-upgrade-open.is-picking-hub'));
  assert(!stuck, `pick tap at ${Math.round(target.from.x)},${Math.round(target.from.y)} landed on "${under}" and did not complete`);
  await waitForScreen(page, 'game');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}: "+2 slots" pick clear of edge chips`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        await journey(page, language, width, height);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `edge-chip-airports-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:edge-chip-airports seed=${SEED}${RENDER === 'stub' ? ' render=stub' : ''} steps=${results.length} passed=${results.length - failed + (fatal ? 1 : 0)} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed ? 1 : 0;

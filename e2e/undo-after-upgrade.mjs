// [night-07x] Found in a long play-through: tapping Undo right after a weekly upgrade removed the upgrade choice
// itself. The world went back to that week's board, the UI had already closed it, and the clock froze at the
// week boundary with no board on screen (soft lock). Real clicks: take a card, resume, Undo on the dock; the
// choice must stay recorded and the clock must keep running. Portrait phone and phone landscape, PL/EN.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['undo-after-upgrade'].seeds[0];

const started = performance.now();
const results = [];
const CASES = [['pl', 412, 915], ['en', 915, 412]];

async function journey(page) {
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const board = await page.evaluate(() => window.aw.autoplay(1));
  assert(board.screen === 'upgrade', `week-1 board not reached (${board.screen})`);
  const offers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
  const index = offers.findIndex((kind) => kind === 'turboprop' || kind === 'widebody');
  assert(index >= 0, `no aircraft card on the board: ${offers.join(',')}`);
  await clickTestId(page, `upgrade-option-${index}`);
  await waitForScreen(page, 'game');
  const undo = page.locator('[data-hud-action="undo"]');
  assert(await undo.isEnabled(), 'Undo disabled although the bot built a network');
  await undo.click();
  await page.waitForTimeout(300);
  const after = await state(page);
  assert(after.upgrades?.length === 1, `weekly choice lost by Undo: ${JSON.stringify(after.upgrades)}`);
  // The clock must keep running (or the board must be back on screen): never a frozen game screen.
  const t0 = after.tick;
  await page.waitForTimeout(2500);
  const later = await state(page);
  assert(later.screen === 'upgrade' || later.tick > t0, `clock frozen at tick ${t0} on screen "${later.screen}"`);
  assert(later.screen === 'game', `Undo reopened the weekly board (${later.screen})`);
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} Undo after a weekly upgrade keeps the clock running`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, url, language, { width, height }));
        await journey(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'undo-after-upgrade-' + (results.length + 1)) : null;
        results.push({ label, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        if (page) await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { label, status, why } of results) {
    const line = `${status} ${label}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:undo-after-upgrade seed=0x${SEED.toString(16).toUpperCase()} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

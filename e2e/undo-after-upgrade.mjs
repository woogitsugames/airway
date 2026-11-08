// [night-07x] Found in a long play-through: tapping Undo right after a weekly upgrade removed the upgrade choice
// itself. The world went back to that week's board, the UI had already closed it, and the clock froze at the
// week boundary with no board on screen (soft lock). Real clicks: take a card, resume, Undo on the dock; the
// choice must stay recorded and the clock must keep running. Portrait phone and phone landscape, PL/EN.
// [night-56a] D-313: Undo is now disabled right after the pick (a closed week is a barrier); the same journey checks it.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, RENDER, waitForBoardModels } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['undo-after-upgrade'].seeds[0];

const started = performance.now();
const results = [];
const CASES = [['pl', 412, 915], ['en', 915, 412]];

async function journey(page) {
  await assertRender(page);
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
  await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
  await clickTestId(page, `upgrade-option-${index}`);
  await waitForScreen(page, 'game');
  const undo = page.locator('[data-hud-action="undo"]');
  // [night-56a] D-313 (Q-92 → A): a closed week is a barrier. Right after the pick there is nothing to undo, so the
  // dock shows Undo disabled, and a tap on it changes nothing (before, it removed a network command from up to 1.5
  // days earlier and the re-simulation could end the run before the board).
  await page.waitForFunction(() => document.querySelector('[data-hud-action="undo"]')?.disabled === true, null, { timeout: 5000 })
    .catch(() => { throw new Error('Undo still enabled right after the weekly pick'); });
  await undo.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await state(page);
  assert(after.screen === 'game', `Undo after the pick left the game screen (${after.screen})`);
  assert(after.upgrades?.length === 1, `weekly choice lost by Undo: ${JSON.stringify(after.upgrades)}`);
  // The clock must keep running (or the board must be back on screen): never a frozen game screen.
  const t0 = after.tick;
  // [night-44a] `test:e2e:undo-after-upgrade:stub` (--render=stub): the stub clock is frozen (D-254), so the same 2.5 s
  // pass as one game hour through window.aw. The session steps the run the same way as its frame hook does, and a run
  // sent back to the week's board does not step at all (the soft lock this suite guards).
  if (RENDER === 'stub') await page.evaluate(() => window.aw.advanceTicks(60));
  await page.waitForTimeout(2500);
  const later = await state(page);
  assert(later.screen === 'upgrade' || later.tick > t0, `clock frozen at tick ${t0} on screen "${later.screen}"`);
  assert(later.screen === 'game', `Undo reopened the weekly board (${later.screen})`);
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} Undo right after a weekly upgrade is disabled, the choice and the clock run on`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }));
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
  console.log(`SUMMARY test:e2e:undo-after-upgrade seed=0x${SEED.toString(16).toUpperCase()}${RENDER === 'stub' ? ' render=stub' : ''} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

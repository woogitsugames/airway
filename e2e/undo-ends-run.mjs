// [night-58a] Found in the round-5 long play-throughs (N58a): D-313 makes a weekly pick a barrier for Undo, but the
// network edits made after the pick can still be undone, and the exact re-simulation without them can end the run in
// the past (Q-93). The session then kept the game screen up over a finished run until the clock stepped again; on a
// frozen clock (the stub world, `?clock=frozen`) for good. Real clicks on the dock: seed 42041, home region Asia,
// class I, the bot plays to the week-1 board, the turboprop crate, 24 game hours of bot edits (an AssignPlane and an
// ExtendRoute), then Undo until it greys out. The second tap ends the run (DEL jams at tick 5692 in the
// re-simulation, `test:undo` pins it headless): the game-over report must be on screen at once, the pick recorded.
// Stub only (`test:e2e:undo-ends-run:stub`): on the real renderer the next frame shows the report anyway.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, RENDER } from './browser.mjs';

const SEED = 42041;
const REGION = 'ASI';
const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412]];
if (RENDER !== 'stub') throw new Error('undo-ends-run needs --render=stub (a frozen clock); use test:e2e:undo-ends-run:stub');

/** The bot at autoplay's cadence (a decision every 30 game minutes) through window.aw until `target` or a board. */
const play = (page, target) => page.evaluate(async (t) => {
  for (let guard = 0; guard < 20_000; guard++) {
    const s = window.aw.state();
    if (s.screen !== 'game' || s.tick >= t) return s;
    if (s.tick % 30 === 0) await window.aw.botStep();
    await window.aw.advanceTicks(1);
  }
  return window.aw.state();
}, target);

async function journey(page) {
  await assertRender(page);
  await waitForScreen(page, 'menu');
  await page.getByTestId('menu-home-region').selectOption(REGION);
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const board = await play(page, Number.MAX_SAFE_INTEGER);
  assert(board.screen === 'upgrade' && board.tick === 4320, `week-1 board not reached (${board.screen} at ${board.tick})`);
  const offers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
  const index = offers.indexOf('turboprop');
  assert(index >= 0, `no turboprop crate on the board: ${offers.join(',')}`);
  await clickTestId(page, `upgrade-option-${index}`);
  await waitForScreen(page, 'game');
  const undo = page.locator('[data-hud-action="undo"]');
  const picked = await state(page);
  assert(await undo.isDisabled(), 'D-313: Undo enabled right after the weekly pick');
  const now = await play(page, picked.tick + 24 * 60);
  assert(now.screen === 'game', `the run ended before the Undo walk (${now.screen} at ${now.tick})`);
  for (let taps = 1; taps <= 3; taps++) {
    assert(await undo.isEnabled(), `Undo greyed out after ${taps - 1} taps with the game screen still up and no report (a finished run left on screen, or the rules changed: see test:undo)`);
    await undo.click();
    await page.waitForTimeout(200);
    const after = await state(page);
    assert(after.tick === now.tick, `Undo moved the clock ${now.tick} -> ${after.tick}`);
    assert(after.upgrades?.length === 1, `weekly choice lost by Undo: ${JSON.stringify(after.upgrades)}`);
    const report = await page.getByTestId('game-over').isVisible().catch(() => false);
    if (after.screen === 'game' && !report) continue;
    assert(after.screen === 'gameover' && report, `run over but screen "${after.screen}", report ${report ? 'shown' : 'missing'}`);
    return taps;
  }
  throw new Error('three Undo taps and the run still going');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} an Undo that ends the run shows the report at once`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }));
        const taps = await journey(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (tap ${taps})`, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'undo-ends-run-' + (results.length + 1)) : null;
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
  console.log(`SUMMARY test:e2e:undo-ends-run seed=${SEED} render=${RENDER} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

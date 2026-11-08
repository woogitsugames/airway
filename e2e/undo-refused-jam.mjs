// [night-58a] Found in the round-5 long play-throughs (N58a): D-313 makes a weekly pick a barrier for Undo, but the
// network edits made after the pick can still be undone, and the exact re-simulation without them can end the run in
// the past (Q-93). [night-60a] D-321 (Q-93 → A): such an Undo is refused. Real clicks on the dock: seed 42041, home
// region Asia, class I, the bot plays to the week-1 board, the turboprop crate, 24 game hours of bot edits (an
// AssignPlane and an ExtendRoute), then Undo taps. The first tap undoes the ExtendRoute; the second would jam DEL at
// tick 5692 in the re-simulation (`test:undo` pins it headless): it must be refused — the ATC strip names the airport
// and the time, the game screen stays up, the hash, tick and pick are unchanged and Undo stays enabled (canUndo does
// not pre-simulate). Before N60a the second tap ended the run (the N58a suite `undo-ends-run` checked the report).
// Stub only (`test:e2e:undo-refused-jam:stub`): the frozen clock keeps the hash comparable across the tap.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, RENDER } from './browser.mjs';

const SEED = 42041;
const REGION = 'ASI';
const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412]];
if (RENDER !== 'stub') throw new Error('undo-refused-jam needs --render=stub (a frozen clock); use test:e2e:undo-refused-jam:stub');
const NOTICE = { en: /^Can’t undo — DEL would jam at \d\d:\d\d$/, pl: /^Nie da się cofnąć — DEL zapchałoby się o \d\d:\d\d$/ };

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

async function journey(page, language) {
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
  const notice = page.locator('.airway-atc-strip[data-notice]');
  const picked = await state(page);
  assert(await undo.isDisabled(), 'D-313: Undo enabled right after the weekly pick');
  const now = await play(page, picked.tick + 24 * 60);
  assert(now.screen === 'game', `the run ended before the Undo walk (${now.screen} at ${now.tick})`);
  for (let taps = 1; taps <= 3; taps++) {
    assert(await undo.isEnabled(), `Undo greyed out after ${taps - 1} taps without a refusal (the rules changed: see test:undo)`);
    const before = await state(page);
    await undo.click();
    await page.waitForTimeout(200);
    const after = await state(page);
    assert(after.screen === 'game', `Undo tap ${taps} ended the run: screen "${after.screen}" (Q-93 back, D-321 broken)`);
    assert(after.tick === now.tick, `Undo moved the clock ${now.tick} -> ${after.tick}`);
    assert(after.upgrades?.length === 1, `weekly choice lost by Undo: ${JSON.stringify(after.upgrades)}`);
    if (after.snapshotHash !== before.snapshotHash) continue; // an accepted Undo: one command fewer
    const text = (await notice.textContent({ timeout: 1000 }).catch(() => null))?.trim() ?? null;
    assert(text && NOTICE[language].test(text), `refused Undo without the strip notice: ${JSON.stringify(text)}`);
    assert(await notice.isVisible(), 'the refusal notice is not on screen');
    const report = await page.getByTestId('game-over').isVisible().catch(() => false);
    assert(!report, 'the game-over report is up after a refused Undo');
    assert(await undo.isEnabled(), 'Undo greyed out by the refusal (canUndo must stay cheap, the tap is refused)');
    return { taps, text };
  }
  throw new Error('three Undo taps and none refused');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} an Undo that would end the run is refused, the run unchanged`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }));
        const { taps, text } = await journey(page, language);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (tap ${taps}: "${text}")`, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'undo-refused-jam-' + (results.length + 1)) : null;
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
  console.log(`SUMMARY test:e2e:undo-refused-jam seed=${SEED} render=${RENDER} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

// [night-07z] Found in a long play-through: Continue of a week-3 save opened the camera on the empty Pacific —
// every airport an edge arrow, the "+2 slots" pick with nothing to tap — because the opening view centred on the
// spherical mean of airports on several continents. Seed 0xA1C2 builds such a network by the week-1 board. Real UI: save
// from the pause sheet, Main menu, Continue; at least two airports must be actionable on screen (aw.gesture
// 'route' finds a visible pair), in portrait and landscape.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics } from './browser.mjs';

const started = performance.now();
const results = [];
const WIDE_SEED = 0xA1C2;
const CASES = [['en', 412, 915], ['pl', 915, 412]];

async function journey(page) {
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), WIDE_SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const board = await page.evaluate(() => window.aw.autoplay(1));
  assert(board.screen === 'upgrade', `week-1 board not reached (${board.screen})`);
  const offers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
  const index = offers.findIndex((kind) => kind === 'turboprop' || kind === 'widebody');
  await clickTestId(page, `upgrade-option-${Math.max(0, index)}`);
  await waitForScreen(page, 'game');
  await page.keyboard.press('Escape');
  await clickTestId(page, 'action-save');
  await clickTestId(page, 'action-menu');
  await waitForScreen(page, 'menu');
  await clickTestId(page, 'menu-continue');
  await waitForScreen(page, 'game');
  await page.waitForTimeout(600);
  const pair = await page.evaluate(() => { try { return window.aw.gesture('route'); } catch (error) { return String(error.message); } });
  assert(pair && typeof pair === 'object', `after Continue no two airports are on screen (${pair})`);
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} Continue frames airports, not an empty ocean`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, url, language, { width, height }));
        await journey(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'continue-framing-' + (results.length + 1)) : null;
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
  console.log(`SUMMARY test:e2e:continue-framing seed=0x${WIDE_SEED.toString(16).toUpperCase()} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

// [night-08b] Found in a long play-through at 841×673: the buttons for off-screen airports in the right column
// sat on top of the landscape tag dock (undo, aircraft, hub, speed), so a tap near the dock could land on either.
// Seed 0xA1C2 opens airports on several continents (many edge buttons). After the week-1 board, at three
// sizes, no visible edge button may overlap a dock tag or the boarding pass.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics } from './browser.mjs';

const started = performance.now();
const results = [];
const WIDE_SEED = 0xA1C2;
const CASES = [['pl', 915, 412], ['en', 841, 673], ['en', 412, 915]];

async function audit(page) {
  return page.evaluate(() => {
    const boxes = (selector) => [...document.querySelectorAll(selector)]
      .filter((node) => !node.hidden && node.offsetParent !== null)
      .map((node) => ({ name: (node.textContent || node.getAttribute('aria-label') || '').trim().slice(0, 12), r: node.getBoundingClientRect() }));
    const edges = boxes('.airport-edge');
    const blockers = [...boxes('.airway-dock__tag'), ...boxes('.airway-pass')];
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const problems = [];
    for (const edge of edges) for (const other of blockers) {
      if (hit(edge.r, other.r)) problems.push(`${edge.name} ${Math.round(edge.r.left)},${Math.round(edge.r.top)} over ${other.name || 'pass'} ${Math.round(other.r.left)},${Math.round(other.r.top)}`);
    }
    return { edges: edges.length, problems };
  });
}

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
  await page.waitForTimeout(500);
  const { edges, problems } = await audit(page);
  assert(edges >= 3, `only ${edges} edge buttons: the scene does not exercise the edges`);
  assert(problems.length === 0, problems.join('; '));
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}x${height} edge buttons stay clear of the dock and the pass`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, url, language, { width, height }));
        await journey(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'edge-dock-' + (results.length + 1)) : null;
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
  console.log(`SUMMARY test:e2e:edge-dock seed=0x${WIDE_SEED.toString(16).toUpperCase()} steps=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== CASES.length) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

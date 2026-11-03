// [night-07c] Real-UI Playwright journey for "Continue" of a saved daily run (N7a, D-72).
// The official attempt is saved, left, continued from the menu and finished: its result must be recorded as
// the day's official score. A second daily of the same day is practice and must stay practice after Continue.
// Steps depend on each other: after the first failure the rest are reported as SKIP. Fixed seed, fails closed.
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics, SEED,
} from './browser.mjs';

const started = performance.now();
const results = [];
const memo = {};

/**
 * [night-08d] Real (CDP) mouse drag whose first moves are sent together with the press. dragGesture awaits
 * the press before moving; on a loaded machine that round trip alone exceeded the 350 ms long press, so the globe
 * correctly opened the route menu instead of drawing (the flake of N7x).
 */
async function pressAndDrag(page, { from, to }) {
  const { width, height } = page.viewportSize();
  for (const point of [from, to]) {
    assert(Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x < width &&
      point.y >= 0 && point.y < height, `Gesture point outside viewport: ${JSON.stringify(point)}`);
  }
  const cdp = await page.context().newCDPSession(page);
  const send = (type, { x, y }, buttons) => cdp.send('Input.dispatchMouseEvent',
    { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
  const at = (t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  try {
    await send('mouseMoved', from, 0);
    // Written to the socket back to back: the press and the first steps reach the page together.
    await Promise.all([send('mousePressed', from, 1), send('mouseMoved', at(1 / 12), 1), send('mouseMoved', at(2 / 12), 1)]);
    for (let step = 3; step <= 12; step++) await send('mouseMoved', at(step / 12), 1);
    await send('mouseReleased', to, 0);
  } finally {
    await cdp.detach();
  }
}

const storage = (page) => page.evaluate(() => ({
  active: JSON.parse(localStorage.getItem('aw-daily-active-v1') || 'null'),
  scores: JSON.parse(localStorage.getItem('aw-daily-scores-v1') || 'null'),
}));

/** Pause sheet → Save → Menu → Continue; returns the state before and after. */
async function saveLeaveContinue(page) {
  await page.keyboard.press('Escape');
  await page.getByTestId('action-save').waitFor({ timeout: 5000 });
  const before = await state(page);
  await clickTestId(page, 'action-save');
  await page.waitForFunction(() => /\S/.test(document.querySelector('.airway-pause__status')?.textContent ?? ''),
    null, { timeout: 8000 });
  await clickTestId(page, 'action-menu');
  await waitForScreen(page, 'menu');
  await clickTestId(page, 'menu-continue');
  await waitForScreen(page, 'game');
  const after = await state(page);
  assert(after.snapshotHash === before.snapshotHash && after.seed === before.seed,
    `Continue changed the run: ${before.seed}/${before.snapshotHash} -> ${after.seed}/${after.snapshotHash}`);
  return { before, after };
}

async function finishRun(page) {
  await page.evaluate(() => window.aw.forceHubOverload());
  await waitForScreen(page, 'gameover');
  await page.getByTestId('game-over').waitFor({ timeout: 5000 });
  await clickTestId(page, 'gameover-menu');
  await waitForScreen(page, 'menu');
}

const steps = [
  ['boot: dev adapter and menu', async (page) => {
    assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
    await waitForScreen(page, 'menu');
  }],
  ['start today\'s official daily from the menu', async (page) => {
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED); // skips the first-run tutorial only
    await clickTestId(page, 'menu-daily');
    await waitForScreen(page, 'game');
    const { active, scores } = await storage(page);
    assert(active?.kind === 'official' && Number.isSafeInteger(active.attemptId), `active run ${JSON.stringify(active)}`);
    const day = scores?.days?.[active.dateKey];
    assert(day?.attemptId === active.attemptId && !day.official, `reservation ${JSON.stringify(day)}`);
    memo.active = active;
    memo.seed = (await state(page)).seed;
    assert(memo.seed !== SEED, 'the daily seed comes from the date, not from prepareSeed');
  }],
  ['play: route, aircraft and some time', async (page) => {
    const initial = await state(page);
    await pressAndDrag(page, await page.evaluate(() => window.aw.gesture('route')));
    await page.waitForFunction((n) => window.aw.state().routeCount === n + 1, initial.routeCount, { timeout: 8000 })
      .catch(() => { throw new Error('route drag did not add a route'); });
    // [night-08d] A new route already flies one aircraft: count from here, not from before the route (the
    // assignment could tick in during a slow drag and the count skipped the expected value).
    const routed = await state(page);
    await pressAndDrag(page, await page.evaluate(() => window.aw.gesture('plane')));
    await page.waitForFunction((n) => window.aw.state().aircraftAssignments === n + 1,
      routed.aircraftAssignments, { timeout: 8000 })
      .catch(() => { throw new Error(`aircraft drag did not assign (planes ${routed.aircraftAssignments})`); });
    await page.evaluate(() => window.aw.advanceTicks(120));
    assert((await state(page)).tick > initial.tick, 'ticks did not advance');
  }],
  ['save, leave and continue keeps the official attempt', async (page) => {
    const { after } = await saveLeaveContinue(page);
    assert(after.seed === memo.seed, `seed ${after.seed} !== daily seed ${memo.seed}`);
    const { active } = await storage(page);
    assert(active?.kind === 'official' && active.attemptId === memo.active.attemptId &&
      active.dateKey === memo.active.dateKey, `active after continue ${JSON.stringify(active)}`);
  }],
  ['game over of the continued run records the official score', async (page) => {
    await finishRun(page);
    const { scores } = await storage(page);
    const official = scores?.days?.[memo.active.dateKey]?.official;
    assert(official?.kind === 'official' && Number.isSafeInteger(official.score),
      `official result ${JSON.stringify(scores?.days?.[memo.active.dateKey])}`);
    memo.official = official;
    // The split-flap cells duplicate glyphs in textContent; the button's aria-label carries the status.
    const status = await page.getByTestId('menu-daily').getAttribute('aria-label');
    assert(/PLANOWO$/.test(status ?? ''), `menu daily status "${status}" does not end with "PLANOWO"`);
  }],
  ['second daily of the day is practice and stays practice after continue', async (page) => {
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-daily');
    await waitForScreen(page, 'game');
    assert((await storage(page)).active?.kind === 'practice', 'second daily must be practice');
    assert((await state(page)).seed === memo.seed, 'practice replays the same daily seed');
    await page.evaluate(() => window.aw.advanceTicks(60));
    await saveLeaveContinue(page);
    assert((await storage(page)).active?.kind === 'practice', 'continued practice must not become official');
  }],
  ['practice game over keeps the official result unchanged', async (page) => {
    await finishRun(page);
    const day = (await storage(page)).scores?.days?.[memo.active.dateKey];
    assert(JSON.stringify(day?.official) === JSON.stringify(memo.official), `official changed: ${JSON.stringify(day)}`);
    assert(day?.practiceBest?.kind === 'practice', `practice result missing: ${JSON.stringify(day)}`);
  }],
];

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    let page;
    let errors = [];
    try {
      ({ page, errors } = await newGamePage(browser, url, 'pl'));
    } catch (error) {
      results.push({ label: steps[0][0], status: 'FAIL', why: 'page load: ' + message(error) });
      for (const [label] of steps.slice(1)) results.push({ label, status: 'SKIP', why: `after "${steps[0][0]}"` });
      return;
    }
    try {
      let blocked = null;
      for (const [label, run] of steps) {
        if (blocked) { results.push({ label, status: 'SKIP', why: `after "${blocked}"` }); continue; }
        try {
          await run(page);
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, 'daily-continue-' + (results.length + 1));
          results.push({ label, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
          blocked = label;
        }
      }
    } finally {
      await page.close();
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
  const skipped = results.filter((item) => item.status === 'SKIP').length;
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`SUMMARY test:e2e:daily-continue seed=0x${SEED.toString(16).toUpperCase()} steps=${steps.length} passed=${passed} failed=${failed} skipped=${skipped} durationMs=${elapsedMs}`);
  if (failed || passed !== steps.length) process.exitCode = 1;
}

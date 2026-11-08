// [night-07q] Real-UI Playwright journey for the targeted weekly upgrades ("+2 slots", hub expansion).
// Other suites always take a card that completes on its own; here the airport pick on the globe is done with a
// real tap, Back from the pick returns to the crates, and the run records the picked airport. Portrait phone
// and phone landscape (the sign sits beside the boarding pass there, N7n). Fixed seed, fails closed; after the
// first failure in a viewport the rest of that viewport is reported as SKIP.
import { performance } from 'node:perf_hooks';
// [night-44a] `test:e2e:upgrade-picks:stub` (--render=stub): the pick tap is hit-tested through the real camera and
// projection maths on the stub world (D-254), so the same journey runs without the globe.
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, RENDER, waitForBoardModels } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12aa] Per-suite seed, replayed headless by test:e2e-seeds (rules v6: no "+2 slots" on 0xA1A1 before the end).
const SEED = E2E_SEEDS['upgrade-picks'].seeds[0];

const started = performance.now();
const results = [];
const VIEWPORTS = [[412, 915], [915, 412]];

const offers = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));

async function choose(page, kind) {
  const index = (await offers(page)).indexOf(kind);
  assert(index >= 0, `no ${kind} card on the board`);
  await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
  await clickTestId(page, `upgrade-option-${index}`);
  await page.locator('.airway-upgrade-open.is-picking-hub').waitFor({ timeout: 5000 });
  assert((await offers(page)).length === 0, 'the crates stay on screen during the airport pick');
}

/** Tap the globe where the board waits for an airport; returns the picked airport from the run. */
async function tapTarget(page, kind, week) {
  const before = (await state(page)).upgrades?.length ?? 0;
  const { from } = await page.evaluate(() => window.aw.gesture('pick'));
  await page.mouse.click(from.x, from.y);
  await waitForScreen(page, 'game');
  const taken = (await state(page)).upgrades ?? [];
  assert(taken.length === before + 1, `upgrades ${before} -> ${taken.length}`);
  const last = taken[taken.length - 1];
  assert(last.upgrade === kind && last.week === week && typeof last.hubId === 'string' && last.hubId.length === 3,
    `recorded ${JSON.stringify(last)}`);
  return last.hubId;
}

/** Autoplay week by week (answering other boards with a self-completing card) until `kind` is offered. */
async function boardOffering(page, kind, fromWeek) {
  for (let week = fromWeek; week < fromWeek + 6; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    assert(s.screen === 'upgrade', `week ${week}: run ended on ${s.screen}`);
    const list = await offers(page);
    if (list.includes(kind)) return week;
    const plain = list.findIndex((item) => item !== 'hub-expansion' && item !== 'departure-slots');
    await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
    await clickTestId(page, `upgrade-option-${plain}`);
    await waitForScreen(page, 'game');
  }
  throw new Error(`${kind} never offered in 6 weeks`);
}

async function startRun(page) {
  await assertRender(page);
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
}

/** One fresh page per journey: "+2 slots" adds no aircraft, so the DEV bot cannot carry that run to week 2. */
function journeys() {
  const memo = {};
  return [
    ['slots', [
      ['reach the first board offering "+2 slots"', async (page) => {
        await startRun(page);
        memo.slotsWeek = await boardOffering(page, 'departure-slots', 1);
      }],
      ['"+2 slots" opens the airport pick; Back returns to the crates untaken', async (page) => {
        // [night-12aa] Earlier boards' crates count too (the "+2 slots" board is no longer week 1).
        const before = ((await state(page)).upgrades ?? []).length;
        // [night-23a] The same crates as before the pick, not a fixed 3: a met weekly contract adds a fourth (D-247).
        const crates = (await offers(page)).join(',');
        await choose(page, 'departure-slots');
        await clickTestId(page, 'upgrade-pick-back');
        await page.locator('.airway-upgrade-open.is-picking-hub').waitFor({ state: 'detached', timeout: 5000 });
        assert((await offers(page)).join(',') === crates, `crates after Back: ${(await offers(page)).join(',')} (before ${crates})`);
        assert(((await state(page)).upgrades ?? []).length === before, 'Back took an upgrade');
      }],
      ['a tap on an airport completes "+2 slots" for it', async (page) => {
        await choose(page, 'departure-slots');
        await tapTarget(page, 'departure-slots', memo.slotsWeek);
      }],
    ]],
    ['hub', [
      ['reach the first board offering the hub expansion', async (page) => {
        await startRun(page);
        memo.hubWeek = await boardOffering(page, 'hub-expansion', 1);
      }],
      ['a tap on a hub completes the hub expansion', async (page) => {
        await choose(page, 'hub-expansion');
        await tapTarget(page, 'hub-expansion', memo.hubWeek);
      }],
    ]],
  ];
}
const STEPS = journeys().reduce((sum, [, steps]) => sum + steps.length, 0);

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [width, height] of VIEWPORTS) for (const [journey, steps] of journeys()) {
      const tag = `${width}x${height} ${journey}:`;
      let page;
      let errors = [];
      try {
        ({ page, errors } = await newGamePage(browser, gameUrl(url), 'pl', { width, height }));
      } catch (error) {
        for (const [label] of steps) results.push({ label: `${tag} ${label}`, status: 'FAIL', why: 'page load: ' + message(error) });
        continue;
      }
      try {
        let blocked = null;
        for (const [label, run] of steps) {
          const name = `${tag} ${label}`;
          if (blocked) { results.push({ label: name, status: 'SKIP', why: `after "${blocked}"` }); continue; }
          try {
            await run(page);
            if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
            results.push({ label: name, status: 'PASS' });
          } catch (error) {
            const shot = await saveDiagnostics(page, 'upgrade-picks-' + (results.length + 1));
            results.push({ label: name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
            blocked = label;
          }
        }
      } finally {
        await page.close();
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
  const total = VIEWPORTS.length * STEPS;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  const skipped = results.filter((item) => item.status === 'SKIP').length;
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`SUMMARY test:e2e:upgrade-picks seed=0x${SEED.toString(16).toUpperCase()}${RENDER === 'stub' ? ' render=stub' : ''} steps=${total} passed=${passed} failed=${failed} skipped=${skipped} durationMs=${elapsedMs}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

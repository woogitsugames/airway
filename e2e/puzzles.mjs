// [night-07g] Real-UI Playwright journey through all 30 puzzles (task 17, N1, D-70): every level is opened from
// the menu, its reference solution is entered with real clicks on the flight strips and hub buttons, the run
// is fast-forwarded with "To deadline" and must be cleared; progress must reach the board and localStorage.
// Plus the losing path (no action → cancelled) and Undo. Fails closed; steps after a failure are SKIP.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const results = [];
const index = readFileSync(resolve(ROOT, 'src/data/puzzles/index.ts'), 'utf8');
const ids = [...index.matchAll(/from '\.\/(\d+)\.json'/g)].map((m) => m[1]);
const levels = ids.map((id) => JSON.parse(readFileSync(resolve(ROOT, `src/data/puzzles/${id}.json`), 'utf8')));

const click = async (page, action) => {
  const target = page.locator(`button[data-action="${action}"]`);
  await target.waitFor({ timeout: 5000 }).catch(() => { throw new Error(`button ${action} not on screen`); });
  assert(!(await target.isDisabled()), `button ${action} is disabled`);
  await target.click();
};
const resultClass = (page) => page.evaluate(() => document.querySelector('.puzzle-result')?.className ?? '');

function routeIndex(level, command) {
  const i = level.availableRoutes.findIndex((r) => r.plane === command.plane &&
    ((r.from === command.from && r.to === command.to) || (r.from === command.to && r.to === command.from)));
  assert(i >= 0, `${level.id}: reference route ${command.from}-${command.to} not offered`);
  return i;
}

const steps = [
  ['boot: menu and puzzle board with 30 departures', async (page) => {
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-puzzles');
    await page.locator('.puzzle-departures .puzzle-flap').first().waitFor({ timeout: 8000 });
    const count = await page.locator('.puzzle-departures .puzzle-flap').count();
    assert(levels.length === 30 && count === 30, `board shows ${count} puzzles, data has ${levels.length}`);
  }],
  ['no action until the deadline loses puzzle 01', async (page) => {
    await click(page, 'open:01');
    await click(page, 'finish');
    assert((await resultClass(page)).includes('lost'), `puzzle 01 without routes: "${await resultClass(page)}"`);
    await click(page, 'back');
  }],
  ['undo removes a connected strip', async (page) => {
    await click(page, 'open:02');
    await click(page, 'connect:0');
    assert(await page.locator('button[data-action="connect:0"].is-active').count() === 1, 'strip not active after connect');
    await click(page, 'undo');
    assert(await page.locator('button[data-action="connect:0"].is-active').count() === 0, 'strip still active after undo');
    await click(page, 'back');
  }],
  ...levels.map((level) => [`puzzle ${level.id}: reference solution through the UI clears it`, async (page) => {
    await click(page, `open:${level.id}`);
    for (const command of level.referenceCommands) {
      if (command.type === 'connect') await click(page, `connect:${routeIndex(level, command)}`);
      else if (command.type === 'upgradeHub') await click(page, `upgrade:${command.city}`);
      else throw new Error(`${level.id}: unsupported reference command ${command.type}`);
    }
    await click(page, 'finish');
    const result = await resultClass(page);
    const text = await page.locator('.puzzle-result').textContent().catch(() => '');
    assert(result.includes('won'), `${level.id} not cleared: ${result} "${text}"`);
    await click(page, 'back');
    const stars = await page.locator(`button[data-action="open:${level.id}"] .puzzle-flap-stars.is-done`).count();
    assert(stars === 1, `${level.id}: board does not show the cleared stars`);
    // [night-10l] The best margin sits under the stars.
    const best = await page.locator(`button[data-action="open:${level.id}"] .puzzle-flap-best`).textContent().catch(() => '');
    assert(/\+\d+%/.test(best ?? ''), `${level.id}: board shows no best margin ("${best}")`);
  }]),
  ['progress is stored for all 30 puzzles', async (page) => {
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('airway.puzzles.v1') || '{}'));
    const missing = levels.filter((l) => !(stored[l.id] >= 1 && stored[l.id] <= 3)).map((l) => l.id);
    assert(missing.length === 0, `no stored stars for ${missing.join(', ')}`);
    const margins = await page.evaluate(() => JSON.parse(localStorage.getItem('airway.puzzles.margin.v1') || '{}'));
    const noMargin = levels.filter((l) => !Number.isInteger(margins[l.id])).map((l) => l.id);
    assert(noMargin.length === 0, `no stored best margin for ${noMargin.join(', ')}`); // [night-10l]
    const count = await page.locator('.puzzle-count').textContent();
    assert(/30\/30/.test(count ?? ''), `board progress "${count}"`);
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
      ({ page, errors } = await newGamePage(browser, url, 'en'));
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
          const shot = await saveDiagnostics(page, 'puzzles-' + (results.length + 1));
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
  console.log(`SUMMARY test:e2e:puzzles seed=0x${SEED.toString(16).toUpperCase()} levels=${levels.length} steps=${steps.length} passed=${passed} failed=${failed} skipped=${skipped} durationMs=${elapsedMs}`);
  if (failed || passed !== steps.length) process.exitCode = 1;
}

// [night-15b] R4f: resize mid-run (Tier 3 Config_Changes / Config_Combinations). A real Endless run on the DEV stub
// world (`?render=stub&clock=frozen`, D-254; only DOM geometry and window.aw are read, so it finishes under SwiftShader,
// G7) is resized while a sheet is open:
//   - phone → tablet: 412×915 portrait → 915×412 landscape → 500×700 narrow window → 1600×900 wide desktop;
//   - fold-like: 673×841 (folded-open portrait) → 841×701 (book foldable landscape).
// Each sequence runs twice, once with the pause sheet open and once with the hub board (long press on an airport) open,
// in PL and EN. At every size: the run's snapshot hash and tick are unchanged (resizing is view-only, D-254 frozen clock),
// the orbit camera keeps its target (longitude, latitude, zoom), the open sheet is still open, inside the viewport, its
// targets are ≥ 48 px and hit-testable, and it covers neither the week line nor a visible dock target; nothing scrolls or
// overflows sideways and every visible HUD target lies inside the viewport. After the last size the sheet is closed, the
// run plays on for two game hours and its hash must equal a control page that played the same run without resizing.
// The unchanged hash needs the frozen clock (game time passes only through window.aw), so the suite runs on the stub
// world only (`npm run test:e2e:resize:stub`; D-260): on the real globe the open hub board lets the run play on.
// Screenshots of each step: .e2e/resize/ (git-ignored); `--shots` also writes docs/shots/r4f/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, assert, clickTestId, dragGesture, saveDiagnostics, gameUrl, assertRender,
  ARTIFACTS, RENDER, ROOT, SEED,
} from './browser.mjs';

const started = performance.now();
const OUT = resolve(ARTIFACTS, 'resize');
const SHOTS = process.argv.includes('--shots') ? resolve(ROOT, 'docs/shots/r4f') : null;
const PHONE_TO_DESKTOP = [[412, 915], [915, 412], [500, 700], [1600, 900]];
const FOLD = [[673, 841], [841, 701]];
/** [language, sheet, sizes]: each sequence once with each sheet, the languages alternating. */
const CASES = [
  ['pl', 'pause', PHONE_TO_DESKTOP], ['en', 'board', PHONE_TO_DESKTOP],
  ['en', 'pause', FOLD], ['pl', 'board', FOLD],
];
const PLAY_ON_TICKS = 120;
const results = [];

/** Same run on every page: a route drawn with a real drag, two game hours, the first airport of that route as the
 *  airport whose board opens. Returns that airport's id. */
async function startRun(page) {
  await assertRender(page);
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  await page.evaluate(() => document.fonts.ready);
  await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
  await page.evaluate(() => window.aw.advanceTicks(1)); // the frozen clock applies the queued command on a tick
  await page.waitForFunction(() => window.aw.state().routeCount >= 1, null, { timeout: 5000 });
  await page.evaluate(() => window.aw.advanceTicks(119));
  const airports = await page.evaluate(() => window.aw.state().airports ?? []);
  assert(airports.length > 0, 'state().airports is empty');
  return airports[0].id;
}

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

async function openSheet(page, sheet, airport) {
  if (sheet === 'pause') {
    await page.locator('.airway-pass__pause').click();
    await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 3000 });
    return;
  }
  const at = await page.evaluate((id) => window.__awStub.airportPoint(id), airport);
  assert(at?.visible, `airport ${airport} not on screen: ${JSON.stringify(at)}`);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await page.getByTestId('hub-board').waitFor({ state: 'visible', timeout: 3000 });
}

async function closeSheet(page, sheet) {
  if (sheet === 'pause') {
    await clickTestId(page, 'action-resume');
    await page.getByTestId('action-resume').waitFor({ state: 'hidden', timeout: 3000 });
  } else {
    await clickTestId(page, 'hub-board-close');
    await page.getByTestId('hub-board').waitFor({ state: 'hidden', timeout: 3000 });
  }
}

/** Run hash, camera target and layout facts at the current size. */
function snapshot(page, sheet) {
  return page.evaluate((which) => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    const name = (el) => (el.dataset.testid || el.getAttribute('aria-label') || el.textContent || el.className.baseVal || el.className).trim().slice(0, 24);
    const hit = (el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); };
    const { snapshotHash, tick, screen, camera } = window.aw.state();
    const node = which === 'pause' ? document.querySelector('.airway-pause') : document.querySelector('[data-testid="hub-board"]');
    const open = Boolean(node && !node.hidden && shown(node));
    const targets = open ? [...node.querySelectorAll('button')].filter(shown).map((b) => ({ name: name(b), ...rect(b), hit: hit(b) })) : [];
    const hud = [...document.querySelectorAll('.airway-hud button, .airway-pass, .roza-pass')].filter(shown).map((el) => ({ name: name(el), ...rect(el) }));
    const dock = [...document.querySelectorAll('.airway-dock button, .airway-dock .roza-caption, .roza-dial')].filter(shown).map((el) => ({ name: name(el), ...rect(el) }));
    const week = document.querySelector('.roza-pass');
    return {
      hash: snapshotHash, tick, screen, camera,
      w: innerWidth, h: innerHeight, layout: document.querySelector('.airway-hud')?.dataset.layout,
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
      open, sheet: open ? rect(node) : null, sheetScrollW: open ? node.scrollWidth - node.clientWidth : 0, targets,
      hud, dock, week: week && shown(week) ? rect(week) : null,
    };
  }, sheet);
}

const overlap = (a, b) => a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b - .5 && b.t < a.b - .5;
const inside = (a, w, h) => a.l >= -.5 && a.t >= -.5 && a.r <= w + .5 && a.b <= h + .5;
const sameCamera = (a, b) => Boolean(a && b) && Math.abs(a.longitude - b.longitude) < 1e-6 && Math.abs(a.latitude - b.latitude) < 1e-6 &&
  Math.abs(a.zoom - b.zoom) < 1e-6;

function check(at, base, width, height, sheet) {
  assert(at.w === width && at.h === height, `viewport ${at.w}×${at.h}, expected ${width}×${height}`);
  assert(at.screen === 'game', `screen ${at.screen}`);
  assert(at.hash === base.hash && at.tick === base.tick, `run changed on resize: ${at.hash}@${at.tick} ≠ ${base.hash}@${base.tick}`);
  assert(sameCamera(at.camera, base.camera), `camera target moved: ${JSON.stringify(at.camera)} ≠ ${JSON.stringify(base.camera)}`);
  assert(at.scrollW <= width + 1 && at.scrollH <= height + 1, `page overflows: scroll ${at.scrollW}×${at.scrollH}`);
  const out = at.hud.filter((item) => !inside(item, width, height)).map((item) => item.name);
  assert(out.length === 0, `HUD outside the viewport: ${out.join(', ')}`);
  assert(at.open, `${sheet} sheet closed by the resize`);
  assert(inside(at.sheet, width, height), `${sheet} sheet outside the viewport ${JSON.stringify(at.sheet)}`);
  assert(at.sheetScrollW <= 1, `${sheet} sheet scrolls sideways by ${at.sheetScrollW}px`);
  const small = at.targets.filter((b) => b.w < 47.5 || b.h < 47.5 || !b.hit || !inside(b, width, height));
  assert(at.targets.length > 0 && small.length === 0,
    `${sheet} targets: ${JSON.stringify(small.map((b) => [b.name, Math.round(b.w), Math.round(b.h), b.hit]))}`);
  assert(!at.week || !overlap(at.sheet, at.week), `${sheet} sheet covers the week line`);
  const covered = at.dock.filter((item) => overlap(at.sheet, item)).map((item) => item.name);
  assert(covered.length === 0, `${sheet} sheet covers the dock: ${covered.join(', ')}`);
}

if (RENDER !== 'stub') throw new Error('test:e2e:resize needs the frozen stub clock: run it with --render=stub (npm run test:e2e:resize:stub)');

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    for (const [language, sheet, sizes] of CASES) {
      const [first] = sizes;
      const label = `${language} ${sheet} ${sizes.map(([w, h]) => `${w}×${h}`).join('→')}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width: first[0], height: first[1] });
      const control = await newGamePage(browser, gameUrl(url), language, { width: first[0], height: first[1] });
      try {
        const airport = await startRun(page);
        const controlAirport = await startRun(control.page);
        assert(airport === controlAirport, `control run differs: ${controlAirport} ≠ ${airport}`);
        await openSheet(page, sheet, airport);
        await settle(page);
        const base = await snapshot(page, sheet);
        const layouts = [];
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          await settle(page);
          await page.evaluate(() => document.fonts.ready);
          const at = await snapshot(page, sheet);
          try { check(at, base, width, height, sheet); } catch (error) { throw new Error(`${width}×${height} (${at.layout}): ${error.message}`); }
          layouts.push(at.layout);
          const file = `resize-${language}-${sheet}-${width}x${height}.png`;
          await page.screenshot({ path: resolve(OUT, file), animations: 'disabled' });
          if (SHOTS) await page.screenshot({ path: resolve(SHOTS, file), animations: 'disabled' });
        }
        await closeSheet(page, sheet);
        // The control page never resizes; both play on the same ticks from the same state.
        for (const p of [page, control.page]) await p.evaluate((ticks) => window.aw.advanceTicks(ticks), PLAY_ON_TICKS);
        const [after, reference] = await Promise.all([page, control.page].map((p) => p.evaluate(() => window.aw.state())));
        assert(after.tick === reference.tick && after.snapshotHash === reference.snapshotHash,
          `played on after resizing: ${after.snapshotHash}@${after.tick} ≠ control ${reference.snapshotHash}@${reference.tick}`);
        const browserErrors = [...errors, ...control.errors];
        assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join('; ')}`);
        results.push({ label, status: 'PASS', note: `layouts ${layouts.join('→')}, hash ${base.hash.slice(0, 8)} kept, play-on equal` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `resize-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      } finally {
        await page.close();
        await control.page.close();
      }
    }
  });
} catch (error) {
  fatal = error;
}

for (const r of results) console.log(`${r.status} ${r.label}${r.note ? `: ${r.note}` : ''}${r.why ? `: ${r.why}` : ''}`);
if (fatal) console.error(`FATAL ${fatal?.message ?? fatal}`);
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:resize render=${RENDER} cases=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
if (failed || results.length !== CASES.length) process.exitCode = 1;

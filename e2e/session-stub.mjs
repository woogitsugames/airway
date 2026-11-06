// [night-12be] The real src/game/session.ts in real Chromium without the WebGL globe: `?render=stub&clock=frozen`
// (DEV only, src/game/dev/stubWorld.ts) swaps the three.js renderer for a 2D stand-in with the same orbit camera and
// projection, and game time passes only through window.aw, so the journey replays exactly at any frame rate (G7:
// SwiftShader draws the satellite globe at ~10 fps). Everything else is the shipped composition root: menu, session,
// overlay tags, weekly board, hub board, game over, logbook, Daily.
//
// One Endless flight (seed SESSION_STUB_SEED, home region EUN picked on the menu) with the DEV bot through real
// Commands, then one Daily:
//  1. R2g  the menu's home-region select starts the run in Northern Europe (state + every start airport's region).
//  2. R2k  week-1 board: the waybill shows next week's contract; a plain crate is clicked.
//  3. R2k  week-2 board: last week's contract met (filled square), four crates, the "+2 slots" crate marked
//          Contract; it is clicked and its airport picked with a real tap (window.aw.gesture('pick')).
//  4. R2i  the bot plays on until the demand surge is announced: the hollow pennant and "+N HH:00" on that airport's tag;
//          the pause sheet lists surge and contract; Save → Menu → Continue keeps the hash and the pennant.
//  5. R4c  the bot stops; ten-minute steps until a hub fills: a "filling" chevron on a tag.
//  6. R4d  the first airport to jam: a real tap on its point on the canvas opens the hub board (title = its code,
//          rows), the close button closes it; a long press (real pointer held 450 ms) opens it again, Escape closes it.
//  7. R1n  window.aw.forceHubOverload(): the game-over report lists milestones (all first-time stamps on a clean
//          device) and the home region; the logbook marks each one reached.
//  7b. R2h a logged 4-week class I flight opens class II on the menu; a class II run reports it, "same world" keeps it.
//  7c. R2j DEV `&weather=front` (D-253): same seed, the bot plays into week 3 until a weather front's forecast stub
//          (hollow front line, "−1 HH:MM") stands on a tag; the pause sheet lists the front.
//  8. R7l  Settings → "Send results to the leaderboard" switched off (D-237) before the Daily.
//  8b. Daily (Warsaw date pinned): no waybill, no surge, region null, class I, and the session's hash after the bot's
//          week 1 equals a bare createGame(seed, 'daily') played by the same bot in the page (unchanged results).
//  8c. R7l the Daily's game over shows the opted-out ranking line, no submitDaily request left the page and the
//          offline queue stays empty.
// The seed is checked headless in test:fast (scripts/test-session-stub.ts), like e2e/seeds.mjs plans.
// Diagnostics on failure: .e2e/session-stub/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// R7l needs the leaderboard switch, which a build shows only with a Firebase config: a fake one (like
// e2e/ranking-switch.mjs); the hosts are unreachable, so nothing leaves the page and every flush fails quietly.
Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099',
});
const { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, dailyInstant, ARTIFACTS } = await import('./browser.mjs');
const { SESSION_STUB } = await import('./seeds.mjs');

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'session-stub');
mkdirSync(SHOTS, { recursive: true });
const results = [];
let failedStep = null;

async function step(name, body) {
  if (failedStep) { results.push(['SKIP', name, `after ${failedStep}`]); console.log(`SKIP ${name} (after ${failedStep})`); return; }
  const t0 = performance.now();
  try {
    const detail = await body();
    results.push(['PASS', name]);
    console.log(`PASS ${name}${detail ? ' — ' + detail : ''} (${Math.round(performance.now() - t0)} ms)`);
  } catch (error) {
    failedStep = name;
    results.push(['FAIL', name]);
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

const state = (page) => page.evaluate(() => window.aw.state());
/** Ten game minutes per call: the session's hourly readings (fill trend, hub log) see every game hour. */
const tenMinutes = (page) => page.evaluate(() => window.aw.advanceTicks(10));
const point = (page, id) => page.evaluate((code) => window.__awStub.airportPoint(code), id);

async function answerPlain(page) {
  const index = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')]
    .findIndex((node) => !node.disabled && !['hub-expansion', 'departure-slots'].includes(node.dataset.upgrade)));
  await clickTestId(page, `upgrade-option-${Math.max(0, index)}`);
  await waitForScreen(page, 'game');
}

/** Waits at most `limit` ten-minute steps for `probe` (a page function) to return a truthy value. */
async function until(page, limit, probe, arg, { bot = false } = {}) {
  for (let i = 0; i < limit; i++) {
    const found = await page.evaluate(probe, arg);
    if (found) return found;
    const s = await state(page);
    if (s.screen === 'gameover') throw new Error('the run ended first');
    if (s.screen === 'upgrade') await answerPlain(page);
    if (bot) await page.evaluate(() => window.aw.botStep());
    await tenMinutes(page);
  }
  throw new Error(`not within ${limit * 10} game minutes`);
}

async function endless(browser, url) {
  const { page, errors } = await newGamePage(browser, url + '?render=stub&clock=frozen', 'en');
  try {
    await step('stub world on the real menu', async () => {
      await waitForScreen(page, 'menu');
      const probe = await page.evaluate(() => ({ stub: document.querySelector('canvas.airway-world')?.dataset.render ?? null,
        frames: window.__awStub?.frames ?? 0 }));
      assert(probe.stub === 'airway-stub-world', `canvas ${probe.stub}`);
      await page.waitForFunction(() => window.__awStub.frames > 2, null, { timeout: 5000 });
    });
    await step('R2g home region from the menu select', async () => {
      await page.getByTestId('menu-home-region').selectOption(SESSION_STUB.homeRegion);
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SESSION_STUB.seed);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      const s = await state(page);
      assert(s.seed === SESSION_STUB.seed && s.homeRegion === 'EUN' && s.licenceClass === 1, JSON.stringify(s).slice(0, 200));
      const regions = await page.evaluate(async () => {
        const { cityByCode } = await import('/src/data/index.ts');
        return window.aw.state().airports.map((a) => cityByCode(a.id)?.region);
      });
      // D-236: the start cluster is anchored at a home airport in the region (its neighbours may lie across a border).
      assert(regions[0] === SESSION_STUB.homeRegion, `home airport region ${regions[0]} (start ${regions.join(',')})`);
      return `start ${regions.join(',')}`;
    });
    await step('R2k week-1 board: waybill with the next contract', async () => {
      const s = await page.evaluate(() => window.aw.autoplay(1));
      assert(s.screen === 'upgrade', `screen ${s.screen}`);
      const bill = await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="upgrade-contract"]');
        return sheet ? { regions: sheet.querySelector('.airway-upgrade-waybill-route')?.dataset.regions ?? null,
          last: !!sheet.querySelector('.airway-upgrade-waybill-last'), text: sheet.textContent } : null;
      });
      assert(bill && bill.regions && !bill.last, `waybill ${JSON.stringify(bill)}`);
      await answerPlain(page);
      return bill.regions;
    });
    await step('R2k week-2 board: contract met, Contract crate, airport pick', async () => {
      const s = await page.evaluate(() => window.aw.autoplay(2));
      assert(s.screen === 'upgrade', `screen ${s.screen}`);
      const board = await page.evaluate(() => {
        const last = document.querySelector('[data-testid="upgrade-contract"] .airway-upgrade-waybill-last');
        const crates = [...document.querySelectorAll('[data-testid^="upgrade-option-"]')];
        return { last: last?.textContent ?? null, met: last?.dataset.met ?? last?.className ?? null, count: crates.length,
          extra: crates.map((node, i) => [i, node.dataset.extra, node.dataset.upgrade, node.textContent]).filter(([, extra]) => extra === 'contract') };
      });
      assert(board.count === 4, `crates ${board.count}`);
      assert(/met\./.test(board.last ?? '') && !/not met/.test(board.last ?? ''), `last ${board.last}`);
      assert(board.extra.length === 1 && board.extra[0][2] === 'departure-slots' && /Contract/.test(board.extra[0][3]),
        `extra ${JSON.stringify(board.extra)}`);
      await clickTestId(page, `upgrade-option-${board.extra[0][0]}`);
      await page.waitForFunction(() => document.querySelector('.airway-game-layer')?.classList.contains('is-selecting-hub'));
      const pick = await page.evaluate(() => window.aw.gesture('pick'));
      await page.mouse.click(pick.from.x, pick.from.y);
      await waitForScreen(page, 'game');
      const after = await state(page);
      const taken = after.upgrades.find((item) => item.week === 2);
      assert(taken?.upgrade === 'departure-slots' && taken.hubId, `week-2 pick ${JSON.stringify(taken)}`);
      return `${board.last} +2 slots at ${taken.hubId}`;
    });
    await step('R2i surge pennant on the announced airport', async () => {
      const mark = await until(page, 400, () => {
        const stub = document.querySelector('.airport-bubble__surge[data-phase]');
        const bubble = stub?.closest('[data-airport]');
        return stub && bubble ? { airport: bubble.dataset.airport, phase: stub.dataset.phase, text: stub.textContent?.trim() } : null;
      }, undefined, { bot: true });
      assert(mark.phase === 'announced' && /^\+\d+ \d\d:00$/.test(mark.text ?? ''), JSON.stringify(mark));
      assert(mark.airport === SESSION_STUB.surge, `surge at ${mark.airport}, expected ${SESSION_STUB.surge}`);
      // The pause sheet's flight strip lists the surge and the running contract (session fillPauseSummary).
      await page.keyboard.press('Space');
      await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 3000 });
      const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid="pause-summary"] dd[data-row]')]
        .map((node) => [node.dataset.row, node.textContent])));
      assert(rows.surge && rows.surge.includes(mark.airport) && rows.contract, `pause rows ${JSON.stringify(rows)}`);
      // Save → menu → Continue: the restored run (save envelope with contract and surge) shows the same pennant.
      const before = await state(page);
      await clickTestId(page, 'action-save');
      await page.waitForFunction(() => document.querySelector('.airway-pause__status')?.textContent?.length > 0);
      await clickTestId(page, 'action-menu');
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-continue');
      await waitForScreen(page, 'game');
      const after = await state(page);
      assert(after.snapshotHash === before.snapshotHash && after.tick === before.tick && after.homeRegion === 'EUN',
        `continued ${after.snapshotHash}@${after.tick} vs saved ${before.snapshotHash}@${before.tick}`);
      const again = await page.evaluate(() => document.querySelector('.airport-bubble__surge[data-phase]')?.closest('[data-airport]')?.dataset.airport ?? null);
      assert(again === mark.airport, `pennant after Continue at ${again}`);
      await clickTestId(page, 'action-resume');
      return `${mark.airport} ${mark.text}; pause: ${rows.surge} / ${rows.contract}`;
    });
    let jammed = null;
    await step('R4c fill-trend chevron while the network stops growing', async () => {
      const trend = await until(page, 600, () => {
        const mark = document.querySelector('.airport-bubble [data-trend="filling"]');
        const bubble = mark?.closest('[data-airport]');
        return mark && bubble && !mark.hidden && getComputedStyle(mark).display !== 'none' ? bubble.dataset.airport : null;
      });
      return `filling at ${trend}`;
    });
    await step('R4d jam: a tap on the airport opens its hub board', async () => {
      jammed = await until(page, 600, () => document.querySelector('.airport-bubble--jam')?.dataset.airport ?? null);
      assert(jammed === SESSION_STUB.jam, `jam at ${jammed}, expected ${SESSION_STUB.jam}`);
      const at = await point(page, jammed);
      assert(at?.visible, `${jammed} not on the visible globe: ${JSON.stringify(at)}`);
      const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? null, at);
      assert(top === 'airway-world', `a tap at ${jammed} lands on "${top}", not the globe`);
      await page.mouse.click(at.x, at.y);
      const board = page.getByTestId('hub-board');
      await board.waitFor({ state: 'visible', timeout: 3000 });
      const info = await board.evaluate((node) => ({ title: node.querySelector('.airway-hub-board__title')?.textContent ?? '',
        rows: node.querySelectorAll('.airway-hub-board__rows > *').length }));
      assert(info.title.includes(jammed) && info.rows > 0, JSON.stringify(info));
      await clickTestId(page, 'hub-board-close');
      await board.waitFor({ state: 'hidden', timeout: 3000 });
      return `${info.title.trim()} rows=${info.rows}`;
    });
    await step('R4d long press opens it again', async () => {
      // A press within DOUBLE_TAP_MS (260 ms) of the tap above would be read as a double tap (zoom), not a hold.
      await page.waitForTimeout(300);
      const at = await point(page, jammed);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.waitForTimeout(450); // past LONG_PRESS_MS (350 ms), measured by the recognizer's own frames
      await page.mouse.up();
      await page.getByTestId('hub-board').waitFor({ state: 'visible', timeout: 3000 });
      // Escape / Android Back (src/platform/back.ts → session.back()) closes the board first, the game stays unpaused.
      await page.keyboard.press('Escape');
      await page.getByTestId('hub-board').waitFor({ state: 'hidden', timeout: 3000 });
      const paused = await page.getByTestId('action-resume').isVisible();
      assert(!paused, 'Escape paused the game instead of only closing the hub board');
    });
    let reached = [];
    await step('R1n game over lists milestones', async () => {
      await page.evaluate(() => window.aw.forceHubOverload());
      await waitForScreen(page, 'gameover');
      reached = await page.evaluate(() => [...document.querySelectorAll('[data-testid="gameover-milestones"] [data-milestone]')]
        .filter((node) => node.dataset.reached === 'true').map((node) => node.dataset.milestone));
      assert(reached.length > 0, 'no milestone reached on the report');
      // The first logged flight on a clean device: every milestone it reached is a first (the stamp).
      const firsts = await page.evaluate(() => [...document.querySelectorAll('[data-testid="gameover-milestones"] [data-first="true"]')]
        .map((node) => node.dataset.milestone));
      assert(JSON.stringify(firsts) === JSON.stringify(reached), `first stamps ${firsts.join(',')} vs reached ${reached.join(',')}`);
      // R2g: the report names the home region; R2h: a class I run shows no licence line.
      const lines = await page.evaluate(() => ({ home: document.querySelector('[data-testid="gameover-home-region"]')?.textContent ?? null,
        licence: !!document.querySelector('[data-testid="gameover-licence"]') }));
      assert(lines.home && /Northern Europe/.test(lines.home) && !lines.licence, JSON.stringify(lines));
      return reached.join(',');
    });
    await step('R1n logbook records the milestones', async () => {
      await clickTestId(page, 'gameover-menu');
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-logbook');
      await waitForScreen(page, 'logbook');
      const marks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid="logbook"] [data-row][data-reached]')]
        .map((node) => [node.dataset.row, node.dataset.reached])));
      for (const id of reached) assert(marks[id] === 'true', `logbook ${id}=${marks[id]} (${JSON.stringify(marks)})`);
      return `${reached.length} reached in the logbook`;
    });
    await step('R2h class II opened by the logbook, flown and reported', async () => {
      // The stub run need not live to week 4 (LICENCE_UNLOCK_WEEK, D-273); a class I flight of 4 weeks flown is
      // logged through the logbook's own API (a week-5 game over, past the unlock), then the menu offers class II.
      await page.evaluate(async () => {
        const { recordFlight } = await import('/src/game/logbook.ts');
        recordFlight(localStorage, { day: '2026-11-04', mode: 'endless', passengers: 900, weeks: 4, hub: 'WAW' });
      });
      await page.locator('[data-testid="logbook"] .airway-settings__back').click();
      await waitForScreen(page, 'menu');
      const select = page.getByTestId('menu-licence');
      const options = await select.evaluate((node) => [...node.options].map((option) => option.value));
      assert(options.includes('2'), `licence options ${options.join(',')}`);
      await select.selectOption('2');
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SESSION_STUB.seed);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      let s = await state(page);
      assert(s.licenceClass === 2 && s.homeRegion === SESSION_STUB.homeRegion, `class ${s.licenceClass} region ${s.homeRegion}`);
      await page.evaluate(() => window.aw.forceHubOverload());
      await waitForScreen(page, 'gameover');
      const line = await page.evaluate(() => document.querySelector('[data-testid="gameover-licence"]')?.textContent ?? null);
      assert(line && /II/.test(line), `licence line ${line}`);
      // "Same world" keeps the run's class and region (main.ts onRestart).
      // DEV runs skip the training only once per prepareSeed (the device never finished it here).
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SESSION_STUB.seed);
      await clickTestId(page, 'gameover-same');
      await waitForScreen(page, 'game');
      s = await state(page);
      assert(s.licenceClass === 2 && s.homeRegion === SESSION_STUB.homeRegion && s.seed === SESSION_STUB.seed,
        `same world: class ${s.licenceClass} region ${s.homeRegion} seed ${s.seed}`);
      return line;
    });
    assert(errors.length === 0, `page errors: ${errors.join('; ')}`);
  } catch (error) {
    await saveDiagnostics(page, 'session-stub-endless').catch(() => undefined);
    throw error;
  } finally {
    await page.screenshot({ path: resolve(SHOTS, 'endless.png') }).catch(() => undefined);
    await page.close();
  }
}

async function weather(browser, url) {
  const { page, errors } = await newGamePage(browser, url + '?render=stub&clock=frozen&weather=front', 'en');
  try {
    await step('R2j weather front stub on a tag (DEV ?weather=front)', async () => {
      await waitForScreen(page, 'menu');
      await page.getByTestId('menu-home-region').selectOption(SESSION_STUB.homeRegion);
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SESSION_STUB.seed);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      const s = await page.evaluate(() => window.aw.autoplay(2));
      assert(s.screen === 'upgrade', `screen ${s.screen}`);
      await answerPlain(page);
      const mark = await until(page, 300, () => {
        const stub = document.querySelector('.airport-bubble__front[data-phase]');
        const bubble = stub?.closest('[data-airport]');
        return stub && bubble ? { airport: bubble.dataset.airport, phase: stub.dataset.phase, text: stub.textContent?.trim() } : null;
      }, undefined, { bot: true });
      assert(mark.phase === 'ahead' && /^\u22121 \d\d:\d\d$/.test(mark.text ?? ''), JSON.stringify(mark));
      await page.keyboard.press('Space');
      await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 3000 });
      const row = await page.evaluate(() => document.querySelector('[data-testid="pause-summary"] dd[data-row="front"]')?.textContent ?? null);
      assert(mark.airport === SESSION_STUB.front, `front at ${mark.airport}, expected ${SESSION_STUB.front}`);
      assert(row, 'no front row on the pause sheet');
      await clickTestId(page, 'action-resume');
      return `${mark.airport} ${mark.text}; pause: ${row}`;
    });
    assert(errors.length === 0, `page errors: ${errors.join('; ')}`);
  } catch (error) {
    await saveDiagnostics(page, 'session-stub-weather').catch(() => undefined);
    throw error;
  } finally {
    await page.close();
  }
}

async function daily(browser, url) {
  const { page, errors } = await newGamePage(browser, url + '?render=stub&clock=frozen', 'pl', undefined,
    { fixedTime: dailyInstant(SESSION_STUB.date) });
  const submissions = [];
  page.on('request', (request) => { if (/submitDaily/.test(request.url())) submissions.push(request.url()); });
  try {
    await step('R7l leaderboard switch off before the Daily', async () => {
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-settings');
      const row = page.locator('[data-testid="settings-share-ranking-row"]');
      await row.waitFor({ timeout: 5000 });
      await row.scrollIntoViewIfNeeded();
      const input = page.getByTestId('settings-share-ranking');
      assert(await input.isChecked(), 'the switch is not on by default');
      await row.locator('.airway-setting__switch').click();
      const stored = await page.evaluate(() => localStorage.getItem('aw-net-share-v1'));
      assert(!(await input.isChecked()) && stored === '0', `objection not stored (${stored})`);
      await page.keyboard.press('Escape');
      await waitForScreen(page, 'menu');
    });
    await step('Daily: tonight\'s features stay out, results unchanged', async () => {
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-daily');
      await waitForScreen(page, 'game');
      const s = await page.evaluate(() => window.aw.autoplay(1));
      assert(s.screen === 'upgrade' && s.homeRegion === null && s.licenceClass === 1, JSON.stringify(s).slice(0, 200));
      const dom = await page.evaluate(() => ({
        waybill: !!document.querySelector('[data-testid="upgrade-contract"]'),
        surge: !!document.querySelector('.airport-bubble__surge[data-phase]'),
        crates: document.querySelectorAll('[data-testid^="upgrade-option-"]').length,
      }));
      assert(!dom.waybill && !dom.surge && dom.crates === 3, JSON.stringify(dom));
      const bare = await page.evaluate(async ({ seed, week }) => {
        const { createGame } = await import('/src/sim/index.ts');
        const { nextAutoplayCommand, AUTOPLAY_ACTION_INTERVAL } = await import('/src/game/dev/autoplay.ts');
        const sim = createGame(seed, 'daily');
        for (let guard = 0; guard < 200_000; guard++) {
          if (sim.world.status === 'over') break;
          const offer = sim.world.status === 'upgrade' ? sim.world.offer : null;
          if (offer && offer.week >= week && !offer.lastChoice) break;
          const command = nextAutoplayCommand(sim);
          if (command && sim.check(command).ok) sim.apply(command);
          for (let i = 0; i < AUTOPLAY_ACTION_INTERVAL; i++) {
            if (sim.schedulingSpeed === 0 && sim.world.status !== 'running') break;
            sim.tick();
          }
        }
        return { hash: sim.hash(), tick: sim.tickCount, contract: sim.world.contract, surge: sim.world.surge };
      }, { seed: s.seed, week: 1 });
      assert(bare.contract === null && bare.surge === null, `daily sim has ${JSON.stringify(bare)}`);
      assert(bare.hash === s.snapshotHash && bare.tick === s.tick,
        `session ${s.snapshotHash}@${s.tick} vs bare daily ${bare.hash}@${bare.tick}`);
      return `seed ${s.seed} ${s.snapshotHash}@${s.tick}`;
    });
    await step('R7l the Daily\'s game over stays off the leaderboard', async () => {
      await page.evaluate(() => window.aw.forceHubOverload());
      await waitForScreen(page, 'gameover');
      await page.waitForTimeout(300); // a submission would start right after the report opens
      const view = await page.evaluate(() => ({ state: document.querySelector('[data-testid="daily-ranking"]')?.dataset.state ?? null,
        queue: JSON.parse(localStorage.getItem('aw-net-queue-v1') || '[]').length }));
      assert(view.state === 'opted-out' && view.queue === 0 && submissions.length === 0,
        `ranking ${view.state}, queue ${view.queue}, requests ${submissions.join(',')}`);
      return view.state;
    });
    assert(errors.length === 0, `page errors: ${errors.join('; ')}`);
  } catch (error) {
    await saveDiagnostics(page, 'session-stub-daily').catch(() => undefined);
    throw error;
  } finally {
    await page.close();
  }
}

let failure = null;
try {
  await withBrowser(async ({ browser, url }) => {
    try { await endless(browser, url); } catch (error) { failure ??= error; }
    failedStep = null; // each page is independent of the others
    try { await weather(browser, url); } catch (error) { failure ??= error; }
    failedStep = null;
    try { await daily(browser, url); } catch (error) { failure ??= error; }
  }, { softwareCompositing: true }); // [night-12bj] every page here is the stub world (no WebGL)
} catch (error) {
  failure ??= error;
  console.log(`FAIL harness: ${error instanceof Error ? error.message : String(error)}`);
}
const count = (kind) => results.filter(([k]) => k === kind).length;
console.log(`SUMMARY test:e2e:session-stub steps=${results.length} passed=${count('PASS')} failed=${count('FAIL')} ` +
  `skipped=${count('SKIP')} seconds=${((performance.now() - started) / 1000).toFixed(1)}`);
if (failure || count('FAIL')) process.exit(1);

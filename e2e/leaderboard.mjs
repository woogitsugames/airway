// [night-07l] Real-UI Playwright journey for the D-66 daily ranking against the local Firebase emulators
// (run through `npm run test:e2e:leaderboard`, which starts Auth/Functions/Firestore with the real functions bundle).
// An official daily played in the browser is replayed and accepted by the server and shows the player's own row;
// a practice run is not sent; an official run finished offline waits in the queue and is sent at the next app start.
// An observer client (src/net, a separate anonymous user) reads the boards to check what the server really stored.
// Steps depend on each other: after the first failure the rest are reported as SKIP. Fixed seed, fails closed.
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

// Load Playwright before the TypeScript test loader (needed for src/net below): its load hook does not pass
// package.json files through untouched, so a later require('playwright') would fail.
try { createRequire(import.meta.url)('playwright'); } catch { /* harness reports the missing install */ }
await import('../scripts/ts-test-loader.mjs');

const EMULATOR_ENV = {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099',
};
// Vite reads VITE_* from the environment when the dev server starts (inside withBrowser).
Object.assign(process.env, EMULATOR_ENV);
const {
  withBrowser, newGamePage, waitForScreen, dragGesture, state, assert, clickTestId, saveDiagnostics, SEED,
} = await import('./browser.mjs');
const { presetLanguage } = await import('../scripts/lib/harness.mjs');
const { readNetConfig, boardsForDaily } = await import('../src/net/index.ts');
const { FirebaseRestClient } = await import('../src/net/client.ts');

const started = performance.now();
const results = [];
const memo = {};
const EMULATOR_HOSTS = /^http:\/\/127\.0\.0\.1:(5001|9099)\//;

function memoryTokens() { let session = null; return { load: () => session, save: (next) => { session = next; } }; }
const observer = new FirebaseRestClient(readNetConfig(EMULATOR_ENV), fetch, memoryTokens());
async function serverBoards(dateKey) {
  const ids = boardsForDaily(dateKey);
  return await observer.call('getBoards', { daily: ids.daily, weekly: ids.weekly });
}

const storage = (page) => page.evaluate(() => ({
  active: JSON.parse(localStorage.getItem('aw-daily-active-v1') || 'null'),
  scores: JSON.parse(localStorage.getItem('aw-daily-scores-v1') || 'null'),
  queue: JSON.parse(localStorage.getItem('aw-net-queue-v1') || '[]'),
  session: JSON.parse(localStorage.getItem('aw-net-session-v1') || 'null'),
}));

/** Menu → today's daily → a route, an aircraft and some time → forced jam → game over. */
async function playDaily(page, { build = true } = {}) {
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED); // skips the first-run tutorial only
  await clickTestId(page, 'menu-daily');
  await waitForScreen(page, 'game');
  const initial = await state(page);
  if (build) {
    // The first frames of a fresh page may still be framing the camera: wait until the gesture resolves.
    const route = await page.waitForFunction(() => { try { return window.aw.gesture('route'); } catch { return null; } },
      null, { timeout: 10000 }).then((handle) => handle.jsonValue());
    await dragGesture(page, route);
    await page.waitForFunction((n) => window.aw.state().routeCount === n + 1, initial.routeCount, { timeout: 8000 });
    // [night-08d] The new route already flies one aircraft: count from here (see e2e/daily-continue.mjs).
    const routed = await state(page);
    await dragGesture(page, await page.evaluate(() => window.aw.gesture('plane')));
    await page.waitForFunction((n) => window.aw.state().aircraftAssignments === n + 1,
      routed.aircraftAssignments, { timeout: 8000 });
  }
  await page.evaluate(() => window.aw.advanceTicks(240));
  const { active } = await storage(page);
  await page.evaluate(() => window.aw.forceHubOverload());
  await waitForScreen(page, 'gameover', 20000);
  return active;
}

async function rankingState(page, expected, timeout = 30000) {
  try {
    await page.waitForSelector(`[data-testid="daily-ranking"][data-state="${expected}"]`, { timeout });
  } catch {
    const now = await page.evaluate(() => document.querySelector('[data-testid="daily-ranking"]')?.dataset.state ?? 'missing');
    throw new Error(`ranking state "${now}", expected "${expected}"`);
  }
}

/** A second player: own context (fresh storage), Polish UI, storage kept across reloads (= app restarts). */
async function openPlayer(browser, url) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true,
    reducedMotion: 'reduce', locale: 'pl-PL' });
  const page = await context.newPage();
  await presetLanguage(page, 'pl');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
  return page;
}

const digits = (text) => Number((text ?? '').replace(/\D/g, ''));

const steps = [
  ['boot: dev adapter and menu', async (page) => {
    assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
    await waitForScreen(page, 'menu');
  }],
  ['official daily: the server replays it and the board shows the own row', async (page) => {
    const active = await playDaily(page);
    assert(active?.kind === 'official', `expected an official run, got ${JSON.stringify(active)}`);
    await rankingState(page, 'ready');
    const { scores, session } = await storage(page);
    const official = scores?.days?.[active.dateKey]?.official;
    assert(Number.isSafeInteger(official?.score), `no official result ${JSON.stringify(scores)}`);
    const mine = await page.locator('.airway-rank-row.is-me').evaluateAll((rows) => rows.map((row) => ({
      sign: row.querySelector('.airway-rank-sign')?.textContent ?? '', score: row.querySelector('.airway-rank-score')?.textContent ?? '',
    })));
    assert(mine.length === 2, `own row on today and week boards, got ${JSON.stringify(mine)}`);
    for (const row of mine) {
      assert(/AW-[0-9A-F]{4}/.test(row.sign), `call sign "${row.sign}"`);
      assert(digits(row.score) === official.score, `board score ${row.score} != local ${official.score}`);
    }
    const boards = await serverBoards(active.dateKey);
    assert(boards.daily.entries.length === 1 && boards.weekly.entries.length === 1, `server entries ${JSON.stringify(boards)}`);
    assert(boards.daily.entries[0].score === official.score, `server stored ${boards.daily.entries[0].score}, local ${official.score}`);
    assert(mine[0].sign.includes(boards.daily.entries[0].callSign), 'server call sign differs from the board');
    memo.dateKey = active.dateKey;
    memo.first = { score: official.score, uid: session?.uid };
  }],
  ['practice daily: not sent, board on the server unchanged', async (page) => {
    await clickTestId(page, 'gameover-menu');
    await waitForScreen(page, 'menu');
    const active = await playDaily(page, { build: false });
    assert(active?.kind === 'practice', `second daily must be practice, got ${JSON.stringify(active)}`);
    await rankingState(page, 'practice', 10000);
    assert((await storage(page)).queue.length === 0, 'practice run must not be queued');
    const boards = await serverBoards(memo.dateKey);
    assert(boards.daily.entries.length === 1 && boards.daily.entries[0].score === memo.first.score,
      `board changed by a practice run: ${JSON.stringify(boards.daily.entries)}`);
  }],
  ['second player offline: the official run waits in the queue', async (page, context) => {
    const offline = { page: await openPlayer(context.browser, context.url) };
    memo.offline = offline.page;
    await offline.page.route(EMULATOR_HOSTS, (route) => route.abort('internetdisconnected'));
    await waitForScreen(offline.page, 'menu');
    const active = await playDaily(offline.page);
    assert(active?.kind === 'official', `fresh player must play official, got ${JSON.stringify(active)}`);
    await rankingState(offline.page, 'queued');
    const { queue, scores } = await storage(offline.page);
    assert(queue.length === 1 && queue[0].submission.dateKey === memo.dateKey, `queue ${JSON.stringify(queue.map((q) => q.submission?.dateKey))}`);
    memo.second = { score: scores.days[active.dateKey].official.score, retryAt: queue[0].nextAttemptAt };
    assert((await serverBoards(memo.dateKey)).daily.entries.length === 1, 'offline run reached the server');
  }],
  ['back online: the next app start sends the queued run', async () => {
    const page = memo.offline;
    await page.unroute(EMULATOR_HOSTS);
    // Real backoff (30 s after the first failure): wait it out instead of editing the queue.
    const wait = memo.second.retryAt - Date.now() + 500;
    if (wait > 0) await page.waitForTimeout(wait);
    await page.reload({ waitUntil: 'load' }); // the app starts again with the same storage
    await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
    await waitForScreen(page, 'menu');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('aw-net-queue-v1') || '[]').length === 0,
      null, { timeout: 20000 }).catch(() => { throw new Error('queued run was not sent at app start'); });
    const boards = await serverBoards(memo.dateKey);
    const scores = boards.daily.entries.map((entry) => entry.score).sort((a, b) => a - b);
    const expected = [memo.first.score, memo.second.score].sort((a, b) => a - b);
    assert(JSON.stringify(scores) === JSON.stringify(expected), `daily board ${JSON.stringify(scores)} != ${JSON.stringify(expected)}`);
    assert(boards.weekly.entries.length === 2, `weekly board has ${boards.weekly.entries.length} entries`);
    assert(boards.daily.entries.every((entry, i, all) => i === 0 || all[i - 1].score >= entry.score), 'board not ordered');
    await page.context().close();
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
          await run(page, { browser, url });
          if (errors.length) throw new Error(`Browser errors: ${errors.splice(0).join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(memo.offline && !memo.offline.isClosed() ? memo.offline : page, 'leaderboard-' + (results.length + 1));
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
  console.log(`SUMMARY test:e2e:leaderboard seed=0x${SEED.toString(16).toUpperCase()} steps=${steps.length} passed=${passed} failed=${failed} skipped=${skipped} durationMs=${elapsedMs}`);
  if (failed || passed !== steps.length) process.exitCode = 1;
}

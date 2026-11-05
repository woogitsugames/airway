// Shared Playwright helpers for the game E2E smoke and the UI matrix.
// Server/browser lifecycle lives in scripts/lib/harness.mjs (also used by `npm run shots`).
import { createServer as createHttpServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { ROOT, SEED, startVite, launchChromium, presetLanguage } from '../scripts/lib/harness.mjs';

export { ROOT, SEED };
// Diagnostics (failure screenshots, DOM dumps); ignored by git.
export const ARTIFACTS = resolve(ROOT, '.e2e');

async function startFixtureServer() {
  const html = readFileSync(resolve(ROOT, 'e2e/fixtures/airway.html'));
  const server = createHttpServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(html);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
  return { url: `http://127.0.0.1:${address.port}/`, stop: () => new Promise((done) => server.close(done)) };
}

export async function withBrowser(callback, { fixture = false } = {}) {
  let host;
  let browser;
  try {
    host = fixture ? await startFixtureServer() : await startVite();
    browser = await launchChromium();
    return await callback({ browser, url: host.url });
  } finally {
    if (browser) await browser.close();
    if (host) await host.stop();
  }
}

/** `options.deviceScaleFactor`: [night-12u] DPR (ui:matrix renders the unfolded foldable at 2).
 *  `options.reducedMotion`: the emulated system setting ('reduce' by default; night-11g e2e uses 'no-preference'). */
export async function newGamePage(browser, url, language, viewport = { width: 412, height: 915 }, options = {}) {
  const page = await browser.newPage({
    viewport, deviceScaleFactor: options.deviceScaleFactor ?? 1, hasTouch: options.hasTouch ?? true, // [night-11ai] desktop pages: false
    reducedMotion: options.reducedMotion ?? 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // [night-12aj] `fixedTime`: the page's calendar starts at this instant, so suites seeded by the date play a known
  // daily world (e2e/seeds.mjs `dates`).
  if (options.fixedTime) await pinDate(page, options.fixedTime);
  await presetLanguage(page, language, { clear: true });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#app').waitFor({ timeout: 12000 });
  await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 })
    .catch(() => { throw new Error('window.aw missing: src/main.ts must call installDevHandle() in DEV'); });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error(`Browser page errors: ${errors.join('; ')}`);
  return { page, errors };
}

/**
 * [night-12bf] `--render=stub` (or `AW_RENDER=stub`): a suite that supports it (smoke, ui:matrix, edge-chip-tags; `npm run <suite>:stub`)
 * loads the game on the DEV stub world `?render=stub&clock=frozen` (D-254) instead of the WebGL globe, so its UI/flow
 * checks finish under SwiftShader (G7). Game time then passes only through `window.aw`. Anything `src/render` draws
 * (globe, rings, planes, barriers) is not on that page: those checks stay on the default real renderer.
 */
const renderArg = process.argv.find((arg) => arg.startsWith('--render='))?.slice('--render='.length);
const renderChoice = renderArg ?? process.env.AW_RENDER ?? 'real';
if (!['stub', 'real'].includes(renderChoice)) {
  throw new Error(`--render / AW_RENDER must be "stub" or "real", got "${renderChoice}"`);
}
export const RENDER = renderChoice;

/** The game URL for the current `RENDER` mode (unchanged on the real renderer). */
export function gameUrl(url) {
  if (RENDER !== 'stub') return url;
  const target = new URL(url);
  target.searchParams.set('render', 'stub');
  target.searchParams.set('clock', 'frozen');
  return target.href;
}

/** Fails fast when a page that should run on the stub world did not load it (e.g. a production build). */
export async function assertRender(page) {
  if (RENDER !== 'stub') return;
  const stub = await page.evaluate(() => typeof window.__awStub === 'object' && window.__awStub !== null);
  assert(stub, '--render=stub but window.__awStub is missing: ?render=stub needs a Vite dev build (D-254)');
}

export async function state(page) {
  return await page.evaluate(() => window.aw.state());
}

export async function waitForScreen(page, screen, timeout = 8000) {
  try {
    await page.waitForFunction((expected) => window.aw?.ready && window.aw.state().screen === expected,
      screen, { timeout });
  } catch {
    const seen = await page.evaluate(() => {
      try { return window.aw?.ready ? window.aw.state().screen : 'adapter-not-ready'; }
      catch (error) { return 'state() threw: ' + (error instanceof Error ? error.message : String(error)); }
    });
    throw new Error(`Expected screen "${screen}" within ${timeout} ms, saw "${seen}"`);
  }
}

/** Clicks a data-testid, failing with a list of the test IDs that ARE present. */
export async function clickTestId(page, id, timeout = 5000) {
  const target = page.getByTestId(id);
  try {
    await target.click({ timeout });
  } catch {
    const present = await page.evaluate(() => [...document.querySelectorAll('[data-testid]')]
      .map((node) => node.getAttribute('data-testid')));
    throw new Error(`data-testid="${id}" not clickable; present: [${present.join(', ') || 'none'}]`);
  }
}

export function assert(condition, description) {
  if (!condition) throw new Error(description);
}

export async function dragGesture(page, positions) {
  const { from, to } = positions;
  const { width, height } = page.viewportSize();
  for (const point of [from, to]) {
    assert(Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.x < width && point.y >= 0 && point.y < height,
    `Gesture point outside viewport: ${JSON.stringify(point)}`);
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** Saves a screenshot + aw.state() for a failed step into .e2e/. */
export async function saveDiagnostics(page, name) {
  try {
    mkdirSync(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  } catch {
    return null;
  }
}

/** [night-12aj] Warsaw-noon instant of a YYYY-MM-DD daily key (10:00 UTC is the same Warsaw day all year). */
export function dailyInstant(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('daily date must be YYYY-MM-DD: ' + date);
  return new Date(date + 'T10:00:00Z');
}

/**
 * [night-12aj] Shifts the page's wall clock so it starts at `instant` and keeps running: `Date.now()` and `new Date()`
 * read real time + a fixed offset. performance.now, timers and frames are untouched. (Playwright's clock.setFixedTime
 * froze Date and stalled the game screens under SwiftShader: screenshots and the pause sheet timed out.)
 */
export function pinDate(page, instant) {
  return page.addInitScript((target) => {
    const RealDate = Date;
    const offset = target - RealDate.now();
    class ShiftedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
      static now() { return RealDate.now() + offset; }
    }
    globalThis.Date = ShiftedDate;
  }, instant.getTime());
}

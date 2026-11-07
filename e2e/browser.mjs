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

/** `softwareCompositing` (default: `--render=stub` runs): Chromium composites in software (harness.mjs
 *  SOFTWARE_COMPOSITING_ARGS, night-12bj); only for pages that draw no WebGL globe. */
export async function withBrowser(callback, { fixture = false, softwareCompositing = RENDER === 'stub' && !fixture } = {}) {
  let host;
  let browser;
  try {
    host = fixture ? await startFixtureServer() : await startVite();
    browser = await launchChromium({ softwareCompositing });
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
/**
 * [night-28a] D-284: `--skin=linoryt` (or `AW_SKIN=linoryt`): a suite that builds its URL with gameUrl() loads the DEV-only
 * Linoryt preview (`?skin=linoryt`), e.g. `npm run ui:matrix:stub -- --skin=linoryt`. Unset = the shipped skin.
 */
const skinArg = process.argv.find((arg) => arg.startsWith('--skin='))?.slice('--skin='.length);
export const SKIN = skinArg ?? process.env.AW_SKIN ?? '';
if (!['', 'linoryt'].includes(SKIN)) throw new Error(`--skin / AW_SKIN must be "linoryt" or unset, got "${SKIN}"`);

/** [night-29a] The URL with the `--skin` preview only (render mode untouched): suites that always use one renderer. */
export function skinUrl(url) {
  if (!SKIN) return url;
  const target = new URL(url);
  target.searchParams.set('skin', SKIN);
  return target.href;
}

/** The game URL for the current `RENDER` mode (unchanged on the real renderer). */
export function gameUrl(url) {
  if (RENDER !== 'stub' && !SKIN) return url;
  const target = new URL(url);
  if (RENDER === 'stub') {
    target.searchParams.set('render', 'stub');
    target.searchParams.set('clock', 'frozen');
  }
  if (SKIN) target.searchParams.set('skin', SKIN); // [night-28a] D-284
  return target.href;
}

/**
 * [night-29b] D-284 U4: where a suite that keeps PNGs in docs/shots/<task>/ writes them. With `--skin=linoryt` the shots
 * show the preview, not the shipped skin of that task, so they go to .e2e/skin-<skin>/<task>/ (tracked shots untouched).
 */
export function skinShotsDir(dir) {
  if (!SKIN) return dir;
  return resolve(ARTIFACTS, `skin-${SKIN}`, dir.split('/').filter(Boolean).at(-1));
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

/**
 * [night-12bj] Load-tolerant default for `clickTestId`. Under SwiftShader a busy host gives the page only a few frames
 * per second, and Playwright's actionability checks (visible, stable over two frames, enabled, receives the pointer)
 * each need frames: 5 s was not always enough while other suites ran. A real hang still fails, only later.
 */
export const CLICK_TIMEOUT_MS = 20000;

/** Playwright's first error line plus the last lines of its call log (what the actionability checks saw). */
function playwrightError(error) {
  const text = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-control-regex -- the call log is dimmed with ANSI escapes
  const [head, ...rest] = text.replace(/\u001b\[[0-9;]*m/g, '').split('\n');
  const log = [...new Set(rest.map((line) => line.trim()).filter((line) => /^(-|\d+ ×)/.test(line)))].slice(-6);
  return [head.trim(), ...log].join(' | ');
}

/**
 * Clicks a data-testid. Within one `timeout` budget it waits for the element to be attached, visible, stable (no
 * entry motion) and enabled, then clicks with Playwright's own checks. On failure the error keeps Playwright's
 * original message and call log, names the check it was waiting for, the element's state, what is on top of its
 * centre (an intercepting overlay, if any) and every test ID present (`(hidden)` when not rendered).
 */
export async function clickTestId(page, id, timeout = CLICK_TIMEOUT_MS) {
  const target = page.getByTestId(id);
  const deadline = Date.now() + timeout;
  const left = () => Math.max(1, deadline - Date.now());
  let phase = 'attached';
  try {
    const handle = await target.elementHandle({ timeout: left() });
    try {
      for (const check of ['visible', 'stable', 'enabled']) {
        phase = check;
        await handle.waitForElementState(check, { timeout: left() });
      }
    } finally {
      await handle.dispose();
    }
    phase = 'click';
    await target.click({ timeout: left() });
  } catch (error) {
    const seen = await page.evaluate((testId) => {
      const node = document.querySelector(`[data-testid="${testId}"]`);
      const describe = (el) => {
        const owner = el.closest('[data-testid]');
        const cls = typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        return `<${el.tagName.toLowerCase()}${cls}>` + (owner ? ` in [data-testid="${owner.getAttribute('data-testid')}"]` : '');
      };
      let element = 'missing';
      let onTop = 'n/a';
      if (node) {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        element = `box=${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}` +
          ` disabled=${Boolean(node.disabled)} visibility=${style.visibility} opacity=${style.opacity}` +
          ` pointer-events=${style.pointerEvents} running-animations=${node.getAnimations({ subtree: true }).length}`;
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        onTop = !top ? 'nothing (centre off screen)' : node.contains(top) ? 'the element itself' : describe(top);
      }
      const present = [...document.querySelectorAll('[data-testid]')].map((el) =>
        el.getAttribute('data-testid') + (el.getClientRects().length === 0 ? '(hidden)' : ''));
      return { element, onTop, present };
    }, id).catch((evalError) => ({ element: 'page.evaluate failed: ' + playwrightError(evalError), onTop: 'n/a', present: [] }));
    throw new Error(`data-testid="${id}" not clickable (waiting for ${phase}, budget ${timeout} ms): ` +
      `${playwrightError(error)} || element: ${seen.element} || on top at its centre: ${seen.onTop}` +
      ` || present: [${seen.present.join(', ') || 'none'}]`);
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

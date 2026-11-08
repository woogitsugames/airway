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
 * [night-12bf] `--render=stub` (or `AW_RENDER=stub`): a suite that supports it (smoke, ui:matrix, edge-chip-tags, [night-44a] 13 more listed in e2e/README.md;
 * `npm run <suite>:stub`)
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
 * [night-28a] D-284: `--skin=linoryt` loaded the DEV-only Linoryt preview. [night-46a] D-301 (PLAN-LINORYT.md step U5):
 * Linoryt is the shipped skin and the game has no `?skin=` any more, so the flag is refused. [night-49a] The no-op
 * helpers it left (`SKIN`, `skinUrl`, `skinShotsDir`) are gone from the suites too.
 */
if (process.argv.some((arg) => arg.startsWith('--skin=')) || process.env.AW_SKIN) {
  throw new Error('--skin / AW_SKIN: there is no skin preview any more (Linoryt ships, D-301); drop the flag');
}

/** The game URL for the current `RENDER` mode (unchanged on the real renderer). */
export function gameUrl(url) {
  if (RENDER !== 'stub') return url;
  const target = new URL(url);
  target.searchParams.set('render', 'stub');
  target.searchParams.set('clock', 'frozen');
  return target.href;
}

/**
 * [night-44a] Where a suite that keeps PNGs in docs/shots/<task>/ writes them in this run: on the stub world
 * (`--render=stub`) the shots show the stub's dots instead of the globe, so they go to the git-ignored .e2e/stub/<task>/
 * (tracked shots untouched). Unchanged on the real renderer.
 */
export function shotsDir(dir) {
  if (RENDER !== 'stub') return dir;
  return resolve(ARTIFACTS, 'stub', dir.split('/').filter(Boolean).at(-1));
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

/**
 * [night-45a] The weekly board draws each crate's 3D model in the frame after it opens (src/game/session.ts
 * onPreviewModel): shader compile plus a synchronous pixel read-back. On SwiftShader that one frame holds the page's
 * main thread for 1–3 s on an idle host (the first board in a browser) and for 20 s or more while other browsers share
 * the CPU; a crate click started then spends `CLICK_TIMEOUT_MS` before the page answers one actionability check.
 * Wait until every crate carries `data-model` ("drawn" / "none": the attempt is over); the click then gets its whole
 * budget on a page that renders again. A board whose crates never finish still fails, after `timeout`.
 */
export const BOARD_MODELS_TIMEOUT_MS = 120000;
const BOARD_CRATES = '[data-testid^="upgrade-option-"] .airway-upgrade-model';

export async function waitForBoardModels(page, timeout = BOARD_MODELS_TIMEOUT_MS) {
  try {
    await page.waitForFunction((selector) => {
      const crates = [...document.querySelectorAll(selector)];
      return crates.length > 0 && crates.every((node) => node.dataset.model);
    }, BOARD_CRATES, { timeout, polling: 250 });
  } catch {
    const seen = await page.evaluate((selector) => [...document.querySelectorAll(selector)]
      .map((node) => node.dataset.model ?? 'pending').join(', '), BOARD_CRATES).catch(() => 'page did not answer');
    throw new Error(`weekly board crates not drawn within ${timeout} ms: [${seen}]`);
  }
}

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

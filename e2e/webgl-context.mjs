// [night-11h] R3g, D-118: WebGL context loss and the no-WebGL-2 page.
// Loss (WEBGL_lose_context) mid-run EN 412×915 and on the menu PL 915×412: the paper notice appears, no globe frame
// is drawn and the run does not advance (same tick and snapshot hash over 1.5 s); after restoreContext the notice
// goes, the globe draws again and the run carries on from the same state. No WebGL 2 (getContext('webgl2') → null)
// PL 412×915 and EN 320×568: the plain page with the renderer string instead of a blank sky, no horizontal scroll.
// Shots docs/shots/n11h/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, state, ROOT, SEED } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11h');
const results = [];
const HOLD_MS = 1500;

const frames = (page) => page.evaluate(() => window.__awWorld.frames());
async function loseContext(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.airway-world');
    const gl = canvas?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) throw new Error('WEBGL_lose_context missing');
    window.__awLose = ext;
    ext.loseContext();
  });
  await page.getByTestId('gl-lost-notice').waitFor({ timeout: 5000 });
}
async function restoreContext(page) {
  await page.evaluate(() => window.__awLose.restoreContext());
  await page.getByTestId('gl-lost-notice').waitFor({ state: 'detached', timeout: 5000 });
}
async function expectDrawingAgain(page, where) {
  const before = await frames(page);
  await page.waitForFunction((n) => window.__awWorld.frames() >= n + 5, before, { timeout: 8000 })
    .catch(() => { throw new Error(`${where}: the globe did not draw again after the restore`); });
}

async function lossInGame(page, language, width, height) {
  await waitForScreen(page, 'menu');
  await page.waitForFunction(() => window.__awWorld?.ready, null, { timeout: 15000 });
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  await page.waitForFunction(() => window.aw.state().tick > 3, null, { timeout: 10000 });
  await page.screenshot({ path: resolve(SHOTS, `before-game-${language}-${width}x${height}.png`) });
  await loseContext(page);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('canvas.airway-world')).visibility) === 'hidden',
    'blank canvas hidden while lost');
  const a = await state(page);
  const fa = await frames(page);
  await page.waitForTimeout(HOLD_MS);
  const b = await state(page);
  const fb = await frames(page);
  assert(b.screen === 'game', `screen ${b.screen} while lost`);
  assert(a.tick === b.tick, `run advanced while lost: tick ${a.tick} → ${b.tick}`);
  assert(a.snapshotHash === b.snapshotHash, 'state hash changed while lost');
  assert(fb === fa, `${fb - fa} globe frames while lost`);
  const notice = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="gl-lost-notice"]').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, role: document.querySelector('[data-testid="gl-lost-notice"]').getAttribute('role') };
  });
  assert(notice.left >= 0 && notice.right <= width && notice.top >= 0 && notice.bottom <= height, 'notice on screen');
  assert(notice.role === 'status', 'notice is a status region');
  await page.screenshot({ path: resolve(SHOTS, `lost-game-${language}-${width}x${height}.png`) });
  await restoreContext(page);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('canvas.airway-world')).visibility) === 'visible',
    'canvas shown again after the restore');
  const c = await state(page);
  assert(c.snapshotHash === b.snapshotHash || c.tick > b.tick, 'state after restore');
  await expectDrawingAgain(page, 'game');
  await page.waitForFunction((tick) => window.aw.state().tick > tick, b.tick, { timeout: 8000 })
    .catch(() => { throw new Error('the run did not carry on after the restore'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(SHOTS, `restored-game-${language}-${width}x${height}.png`) });
}

async function lossOnMenu(page, language, width, height) {
  await waitForScreen(page, 'menu');
  await page.waitForFunction(() => window.__awWorld?.ready && window.__awWorld.frames() > 5, null, { timeout: 15000 });
  await loseContext(page);
  const fa = await frames(page);
  await page.waitForTimeout(HOLD_MS);
  assert(await frames(page) === fa, 'menu globe drew while lost');
  await page.screenshot({ path: resolve(SHOTS, `lost-menu-${language}-${width}x${height}.png`) });
  await restoreContext(page);
  await expectDrawingAgain(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED); // skips the first-launch tutorial
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  await expectDrawingAgain(page, 'game after a menu restore');
}

async function unsupported(browser, url, language, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, locale: language === 'pl' ? 'pl-PL' : 'en-US' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await presetLanguage(page, language, { clear: true });
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return kind === 'webgl2' ? null : original.call(this, kind, ...rest);
      };
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.getByTestId('gl-unsupported').waitFor({ timeout: 12000 });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({
      title: document.querySelector('[data-testid="gl-unsupported"] h1')?.textContent ?? '',
      gpu: document.querySelector('[data-testid="gl-unsupported-renderer"]')?.textContent ?? '',
      canvases: document.querySelectorAll('canvas').length,
      menu: !!document.querySelector('[data-testid="menu-endless"]'),
      scroll: document.documentElement.scrollWidth > innerWidth + 2,
    }));
    const title = language === 'pl' ? 'Grafika tego urządzenia nie jest obsługiwana' : 'This device’s graphics are not supported';
    assert(m.title === title, `title "${m.title}"`);
    const prefix = language === 'pl' ? 'Grafika: ' : 'Graphics: ';
    assert(m.gpu.startsWith(prefix) && m.gpu.length > prefix.length + 3, `renderer line "${m.gpu}"`);
    assert(m.canvases === 0, `${m.canvases} canvas(es) left`);
    assert(!m.menu, 'menu mounted although nothing can be drawn');
    assert(!m.scroll, 'horizontal page scroll');
    await page.screenshot({ path: resolve(SHOTS, `unsupported-${language}-${width}x${height}.png`) });
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    return { label: `no WebGL 2 ${language} ${width}×${height}: plain page (${m.gpu.slice(0, 48)})`, status: 'PASS' };
  } catch (error) {
    const shot = await saveDiagnostics(page, `webgl-unsupported-${language}-${width}`);
    return { label: `no WebGL 2 ${language} ${width}×${height}`, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') };
  } finally {
    await page.close();
  }
}

const LOSS = [['en', 412, 915, lossInGame, 'mid-run'], ['pl', 915, 412, lossOnMenu, 'on the menu']];
const NO_GL2 = [['pl', 412, 915], ['en', 320, 568]];
let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height, journey, where] of LOSS) {
      const label = `context loss ${where} ${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await journey(page, language, width, height);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `webgl-context-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
    for (const [language, width, height] of NO_GL2) results.push(await unsupported(browser, url, language, width, height));
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:webgl-context seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== LOSS.length + NO_GL2.length) process.exitCode = 1;
}

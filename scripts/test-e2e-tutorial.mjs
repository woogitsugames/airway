// [task-23] Browser contract: a real drag/selection through all six onboarding steps.
// [m2] Plus the contextual one-time ATC hints of a live run (D-54): first weekly board, first slot hold,
// first night curfew and first hub jam on seed 0xA1A1, PL and EN; PNG evidence in docs/shots/m2/.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/shots/23');
const OUT_M2 = resolve(ROOT, 'docs/shots/m2'); // [m2]
const SEED = '0xA1A1';
let browser;
let server;
let passed = 0;
let failed = 0;
let screenshots = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); passed++; };

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('Cannot bind localhost');
  const { port } = address;
  await new Promise((done) => socket.close(done));
  return port;
}
async function waitForVite(port) {
  const url = `http://127.0.0.1:${port}/`;
  for (let tries = 0; tries < 100; tries++) {
    if (server.exitCode !== null) throw new Error('Vite exited before startup');
    try { if ((await fetch(url)).ok) return url; } catch { /* Still loading. */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error('Vite was not ready');
}
async function mid(page, testId) {
  const rect = await page.getByTestId(testId).boundingBox();
  if (!rect) throw new Error(`Missing visible element: ${testId}`);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
async function drag(page, from, to) {
  const a = await mid(page, from);
  const b = await mid(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 9 });
  await page.mouse.up();
}
async function step(page, name) {
  await page.waitForFunction((s) => document.querySelector('[data-testid="tutorial"]')?.getAttribute('data-step') === s, name);
  assert(await page.getByTestId('tutorial-instruction').isVisible(), `Instruction is hidden in ${name}`);
}
async function shot(page, name, dir = OUT) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(dir, name + '.png'), animations: 'disabled' });
  screenshots++;
}

// ---- [m2] i18n catalogs, read from the source so the test never hardcodes player text ----------
function catalog(language) {
  const text = readFileSync(resolve(ROOT, 'src/i18n', language + '.ts'), 'utf8');
  const map = new Map();
  for (const match of text.matchAll(/^\s+'([\w.]+)': '((?:[^'\\]|\\.)*)',$/gm)) map.set(match[1], match[2].replace(/\\'/g, "'"));
  return map;
}
const CATALOGS = { pl: catalog('pl'), en: catalog('en') };
function copy(language, key) {
  const value = CATALOGS[language].get(key);
  if (value === undefined) throw new Error(`Missing i18n key ${language}:${key}`);
  return value;
}
/** Catalog template as a full-match regex: {param} stands for any non-empty text. */
function pattern(language, key) {
  const parts = copy(language, key).split(/\{[A-Za-z]\w*\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('^' + parts.join('.+') + '$');
}

const HINTS = {
  upgrade: { testId: 'upgrade-hint', step: 'tutorial.step.weekly', text: 'tutorial.weekly.hint', key: 'aw-tutorial-upgrade' },
  slots: { testId: 'slot-hint', step: 'tutorial.step.slots', text: 'tutorial.slots.hint', key: 'aw-tutorial-slots' },
  curfew: { testId: 'curfew-hint', step: 'tutorial.step.curfew', text: 'tutorial.curfew.hint', key: 'aw-tutorial-curfew' },
  jam: { testId: 'jam-hint', step: 'tutorial.step.jam', text: 'tutorial.jam.hint', key: 'aw-tutorial-jam' },
};
const PLAIN_LABEL = '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])';

/** A page with the given language whose storage is wiped once per tab (not on reload). */
async function hintPage(browser, url, language, { hints = true, seen = [], graphics = 'medium' } = {}) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true,
    reducedMotion: 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US' });
  page.setDefaultTimeout(60000); // SwiftShader on a shared CI box can stall single frames for seconds
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.addInitScript(({ lang, hintsOn, seenKeys, quality }) => {
    try {
      if (sessionStorage.getItem('aw-m2-reset') !== '1') {
        localStorage.clear();
        sessionStorage.setItem('aw-m2-reset', '1');
        // No shadow map: the hints are DOM strips and SwiftShader frames get much cheaper.
        localStorage.setItem('airway.settings', JSON.stringify({ language: lang, graphics: quality, ...(hintsOn ? {} : { hints: false }) }));
        for (const key of seenKeys) localStorage.setItem(key, '1');
      }
    } catch { /* storage can be blocked */ }
    window.__awHintMs = 60000; // hold strips for slow SwiftShader screenshots (DEV-only hook)
    // Count every hint strip that becomes visible, so "never shown" is checked continuously.
    window.__awHints = [];
    new MutationObserver(() => {
      for (const strip of document.querySelectorAll('.airway-hint-strip:not([hidden])')) {
        const id = strip.getAttribute('data-hint');
        const last = window.__awHints[window.__awHints.length - 1];
        if (strip.dataset.counted !== '1') { strip.dataset.counted = '1'; window.__awHints.push(id); }
        else if (last !== id) window.__awHints.push(id);
      }
      for (const strip of document.querySelectorAll('.airway-hint-strip[hidden]')) strip.dataset.counted = '0';
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  }, { lang: language, hintsOn: hints, seenKeys: seen, quality: graphics });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.aw?.ready, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
async function screen(page, name, timeout = 10000) {
  await page.waitForFunction((n) => window.aw.state().screen === n, name, { timeout });
}
async function startRun(page) {
  await page.evaluate((seed) => window.aw.prepareSeed(seed), 0xa1a1);
  await page.getByTestId('menu-endless').click();
  await screen(page, 'game');
}
async function gesture(page, kind) {
  // Right after a run starts the camera is still framing the network; wait for reachable airports.
  const handle = await page.waitForFunction((k) => { try { return window.aw.gesture(k); } catch { return null; } }, kind, { timeout: 10000 });
  const { from, to } = await handle.jsonValue();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
/** One route and three more turboprops on it: four aircraft get ready at one airport (task-32 recipe). */
async function holdForSlot(page) {
  await gesture(page, 'route');
  await page.waitForFunction(() => window.aw.state().routeCount === 1, null, { timeout: 8000 });
  for (let i = 0; i < 3; i++) {
    const before = (await page.evaluate(() => window.aw.state())).aircraftAssignments;
    await gesture(page, 'plane');
    await page.waitForFunction((n) => window.aw.state().aircraftAssignments === n + 1, before, { timeout: 8000 });
  }
  await page.evaluate(() => window.aw.advanceTicks(30));
}
async function pickPlainLabel(page) {
  await page.locator(PLAIN_LABEL).first().click();
  await screen(page, 'game');
}
async function shown(page) { return page.evaluate(() => window.__awHints.slice()); }
async function visibleHint(page) {
  return page.evaluate(() => document.querySelector('.airway-hint-strip:not([hidden])')?.getAttribute('data-hint') ?? null);
}
/** The strip is visible, has i18n copy, a ≥ 48 dp "Roger" target, and fits portrait and landscape. */
async function checkHint(page, language, id, landscapeFirst = false) {
  const spec = HINTS[id];
  const strip = page.getByTestId(spec.testId);
  await strip.waitFor({ state: 'visible', timeout: 20000 });
  const read = await strip.evaluate((node) => ({
    step: node.querySelector('.airway-atc-flight')?.textContent ?? '',
    text: node.querySelector('.airway-atc-hint')?.textContent ?? '',
    ack: node.querySelector('.airway-hint-ack')?.textContent ?? '',
  }));
  assert(read.step === copy(language, spec.step), `${id}/${language}: step "${read.step}" is not the i18n copy`);
  assert(pattern(language, spec.text).test(read.text), `${id}/${language}: text "${read.text}" is not the i18n copy`);
  assert(read.ack === copy(language, 'tutorial.hints.ack'), `${id}/${language}: ack "${read.ack}" is not the i18n copy`);
  assert(await page.evaluate((key) => localStorage.getItem(key), spec.key) === '1', `${id}: seen flag not stored`);
  const views = landscapeFirst ? [['l', 915, 412], ['p', 412, 915]] : [['p', 412, 915], ['l', 915, 412]];
  for (const [tag, width, height] of views) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const box = await page.getByTestId('hint-ack').boundingBox();
    assert(!!box && box.width >= 48 && box.height >= 48, `${id} ${tag}: "Roger" target < 48 dp`);
    const strip = await page.getByTestId(spec.testId).boundingBox();
    assert(!!strip && strip.x >= 0 && strip.y >= 0 && strip.x + strip.width <= width + 1 && strip.y + strip.height <= height + 1,
      `${id} ${tag}: strip outside the viewport ${JSON.stringify(strip)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, `${id} ${tag}: horizontal overflow`);
    await shot(page, `${id}-${language}-${tag}`, OUT_M2);
  }
  await page.setViewportSize({ width: 412, height: 915 });
}
async function dismissWithAck(page, id) {
  await page.getByTestId('hint-ack').click();
  await page.getByTestId(HINTS[id].testId).waitFor({ state: 'hidden', timeout: 3000 });
  passed++;
}

/** [m2] The vignette in Polish: every step's copy comes from the PL catalog. */
async function vignettePl(browser, url) {
  // The vignette is an opaque SVG stage; the globe behind it does not need shadows.
  const { page, errors } = await hintPage(browser, url, 'pl', { graphics: 'low' });
  await page.getByTestId('menu-endless').click();
  const steps = [
    ['route', () => drag(page, 'city-lon', 'city-par')],
    ['aircraft', () => drag(page, 'tutorial-plane-tag', 'tutorial-route-drop')],
    ['transfer', () => page.getByTestId('city-par').click()],
    ['dawn', () => page.getByTestId('tutorial-dawn').click()],
    ['upgrade', () => page.getByTestId('tutorial-upgrade-hub').click()],
    ['congestion', () => drag(page, 'city-lon', 'city-rom')],
    ['complete', null],
  ];
  let index = 1;
  for (const [name, act] of steps) {
    await step(page, name);
    const instruction = await page.getByTestId('tutorial-instruction').textContent();
    assert(instruction === copy('pl', 'tutorial.instruction.' + name), `PL instruction for ${name}: "${instruction}"`);
    const buttons = await page.evaluate(() => [...document.querySelectorAll('.aw-tutorial button')]
      .filter((node) => node.offsetParent).map((node) => { const r = node.getBoundingClientRect(); return [node.dataset.testid, r.width, r.height]; }));
    for (const [id, width, height] of buttons) assert(width >= 48 && height >= 48, `PL ${name}: ${id} ${width}x${height} < 48 dp`);
    await shot(page, `vignette-pl-${String(index++).padStart(2, '0')}-${name}`, OUT_M2);
    if (act) await act();
  }
  assert(errors.length === 0, `Browser errors (PL vignette): ${errors.join('; ')}`);
  await page.close();
}

/** [m2] First night curfew: the DEV bot plays a clean run on seed 0xA1A1; the first airport closes for the
 *  night as the week-3 board opens (minute 12 960), so the hint waits for the board and follows the choice. */
async function curfewHint(browser, url, language) {
  const others = ['upgrade', 'slots', 'jam'].map((id) => HINTS[id].key);
  const { page, errors } = await hintPage(browser, url, language, { seen: others });
  await startRun(page);
  const board = await page.evaluate(() => window.aw.autoplay(3));
  assert(board.screen === 'upgrade', `autoplay(3) ended on ${board.screen} at tick ${board.tick}`);
  await page.waitForTimeout(900);
  assert(await visibleHint(page) === null, `a hint is visible over the week-3 board (${language})`);
  await pickPlainLabel(page);
  await checkHint(page, language, 'curfew', true);
  await dismissWithAck(page, 'curfew');
  assert(JSON.stringify(await shown(page)) === '["curfew"]', `curfew run showed ${JSON.stringify(await shown(page))}`);
  assert(errors.length === 0, `Browser errors (${language} curfew): ${errors.join('; ')}`);
  await page.close();
}

/** [m2] Each contextual hint: once at its trigger, dismissable, gone after reload, off when disabled, re-armed by replay. */
async function contextualHints(browser, url) {
  for (const language of ['pl', 'en']) {
    const { page, errors } = await hintPage(browser, url, language);
    await startRun(page);
    // 1. First slot hold ("SLOTS 07"), dismissed by a tap on the globe (the tap still reaches the globe).
    await holdForSlot(page);
    await checkHint(page, language, 'slots');
    await page.mouse.click(200, 300);
    await page.getByTestId('slot-hint').waitFor({ state: 'hidden', timeout: 3000 });
    passed++;
    // 2. First weekly board: the board hint shows over the inert dock, never over a label.
    await page.evaluate(() => window.aw.autoplay(1));
    await screen(page, 'upgrade');
    await checkHint(page, language, 'upgrade');
    const overlap = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="upgrade-hint"]')?.getBoundingClientRect();
      return strip ? [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].some((label) => {
        const r = label.getBoundingClientRect();
        return r.left < strip.right && strip.left < r.right && r.top < strip.bottom && strip.top < r.bottom;
      }) : true;
    });
    assert(!overlap, `upgrade hint covers a cargo label (${language})`);
    await dismissWithAck(page, 'upgrade');
    await pickPlainLabel(page);
    // 3. First hub jam: the overload countdown, before game over. Four aircraft on one short route and
    //    no new routes: real demand jams a hub in week 2 on seed 0xA1A1.
    let found = false;
    for (let guard = 0; guard < 400 && !found; guard++) {
      const now = await page.evaluate(() => window.aw.state().screen);
      if (now === 'upgrade') await pickPlainLabel(page);
      else if (now === 'gameover') break;
      else await page.evaluate(() => window.aw.advanceTicks(40));
      found = await page.getByTestId('jam-hint').isVisible();
    }
    assert(found, `jam hint never appeared before game over (${language})`);
    assert(await page.evaluate(() => window.aw.state().screen) === 'game', 'jam hint shown outside the run');
    await checkHint(page, language, 'jam');
    await dismissWithAck(page, 'jam');
    const order = await shown(page);
    assert(JSON.stringify(order) === JSON.stringify(['slots', 'upgrade', 'jam']), `hints shown ${JSON.stringify(order)} (each exactly once)`);
    // 5. Reload: same install, nothing comes back.
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.aw?.ready, null, { timeout: 15000 });
    await startRun(page);
    await holdForSlot(page);
    await page.evaluate(() => window.aw.autoplay(1));
    await screen(page, 'upgrade');
    await page.waitForTimeout(900);
    assert((await shown(page)).length === 0, `hints reappeared after reload: ${JSON.stringify(await shown(page))}`);
    // 6. Replay from Settings re-arms them (menu → Settings → Replay → Skip).
    await pickPlainLabel(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('action-menu').click();
    await page.getByTestId('menu-settings').click();
    await page.getByTestId('settings-tutorial-replay').click();
    await step(page, 'route');
    const flags = await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), Object.values(HINTS).map((h) => h.key));
    assert(flags.every((value) => value === null), `replay did not reset hint flags: ${JSON.stringify(flags)}`);
    await page.getByTestId('tutorial-skip').click();
    await startRun(page);
    // Auto-hide without a tap (QA hold shortened to 1.5 s; the game default is 9 s).
    await page.evaluate(() => { window.__awHintMs = 1500; });
    await holdForSlot(page);
    await page.getByTestId('slot-hint').waitFor({ state: 'visible', timeout: 6000 });
    await page.getByTestId('slot-hint').waitFor({ state: 'hidden', timeout: 6000 });
    passed++;
    assert(errors.length === 0, `Browser errors (${language} hints): ${errors.join('; ')}`);
    await page.close();
    await curfewHint(browser, url, language);
  }
  // 7. Hints switched off in Settings: nothing is shown and nothing is marked seen.
  const { page, errors } = await hintPage(browser, url, 'en', { hints: false });
  await startRun(page);
  await holdForSlot(page);
  await page.evaluate(() => window.aw.autoplay(1));
  await screen(page, 'upgrade');
  await page.waitForTimeout(900);
  assert((await shown(page)).length === 0, 'hints shown while switched off in Settings');
  const flags = await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), Object.values(HINTS).map((h) => h.key));
  assert(flags.every((value) => value === null), 'switched-off hints were marked seen');
  assert(errors.length === 0, `Browser errors (hints off): ${errors.join('; ')}`);
  await page.close();
}

try {
  const { chromium } = require('playwright');
  const port = await freePort();
  server = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'inherit' });
  const url = await waitForVite(port);
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.addInitScript(() => {
    // Clear once per browser tab, never on the reload that verifies persistence.
    if (sessionStorage.getItem('aw-e2e-reset') !== '1') {
      localStorage.removeItem('aw-tutorial');
      sessionStorage.setItem('aw-e2e-reset', '1');
    }
  });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(OUT_M2, { recursive: true });
  await page.goto(url, { waitUntil: 'networkidle' });
  // [integration-ui] The training flight opens before the first Endless run, from the menu.
  await page.getByTestId('menu-endless').click();
  await step(page, 'route');
  for (const id of ['city-lon', 'city-par', 'city-rom', 'tutorial-skip']) {
    const size = await page.getByTestId(id).boundingBox();
    assert(!!size && size.width >= 48 && size.height >= 48, `${id} touch target < 48px`);
  }
  await shot(page, '01-route-p');
  await drag(page, 'city-lon', 'city-par');
  await step(page, 'aircraft');
  await shot(page, '02-aircraft-p');
  await drag(page, 'tutorial-plane-tag', 'tutorial-route-drop');
  await step(page, 'transfer');
  await shot(page, '03-transfer-p');
  await page.getByTestId('city-par').click();
  await step(page, 'dawn');
  await shot(page, '04-night-p');
  await page.getByTestId('tutorial-dawn').click();
  await step(page, 'upgrade');
  await shot(page, '05-upgrade-p');
  await page.getByTestId('tutorial-upgrade-hub').click();
  await step(page, 'congestion');
  await shot(page, '06-congestion-p');
  await drag(page, 'city-lon', 'city-rom');
  await step(page, 'complete');
  await shot(page, '07-complete-p');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aw-tutorial') || 'null'));
  assert(saved?.status === 'completed', 'Completed state was not persisted');
  await page.getByTestId('tutorial-continue').click();
  // [integration-ui] Completing the training flight starts the Endless run; replay lives in Settings.
  await page.locator('.airway-hud').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('menu-endless').click();
  await page.locator('.airway-hud').waitFor();
  assert(!(await page.locator('.aw-tutorial-stage').isVisible()), 'Completed tutorial unexpectedly reopened');
  const replayFromSettings = async () => {
    await page.keyboard.press('Escape'); // pause sheet
    await page.getByTestId('action-menu').click();
    await page.getByTestId('menu-settings').click();
    await page.getByTestId('settings-tutorial-replay').click();
  };
  await replayFromSettings();
  await step(page, 'route');
  await page.getByTestId('tutorial-skip').click();
  assert(!(await page.locator('.aw-tutorial-stage').isVisible()), 'Skip did not close tutorial');
  const skipped = await page.evaluate(() => JSON.parse(localStorage.getItem('aw-tutorial') || 'null'));
  assert(skipped?.status === 'skipped', 'Skipped state was not persisted');
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('settings-tutorial-replay').click();
  await step(page, 'route');
  for (const viewport of [{ width: 915, height: 412, name: '08-route-l' },
    { width: 673, height: 841, name: '09-route-fold' }, { width: 904, height: 1000, name: '10-route-wide' }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await shot(page, viewport.name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, `Horizontal overflow at ${viewport.width}x${viewport.height}`);
  }
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  await page.close();
  await vignettePl(browser, url);
  await contextualHints(browser, url);
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log(`SUMMARY test:e2e:tutorial seed=${SEED} passed=${passed} failed=${failed} screenshots=${screenshots}`);
  if (failed) process.exitCode = 1;
}

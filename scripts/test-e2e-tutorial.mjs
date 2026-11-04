// [task-23] Browser contract: a real drag/selection through every onboarding step.
// [night-11p] D-129/D-130: three steps in the game's own marks (airport disc, hub ring, luggage tag with the crescent
// glyph), the planet inside a 412 px phone, and the glyph legend in settings → help.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/shots/23');
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
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(OUT, name + '.png'), animations: 'disabled' });
  screenshots++;
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
  await page.goto(url, { waitUntil: 'networkidle' });
  // [integration-ui] The training flight opens before the first Endless run, from the menu.
  await page.getByTestId('menu-endless').click();
  await step(page, 'route');
  const progress = (await page.getByTestId('tutorial-progress').textContent())?.trim();
  assert(progress === 'STEP 1 / 3', `progress reads "${progress}"`);
  const marks = await page.evaluate(() => ({
    discs: document.querySelectorAll('[data-testid^="city-"] .aw-airport').length,
    hubRing: document.querySelectorAll('[data-testid="city-par"] .aw-airport-ring path').length,
    plates: [...document.querySelectorAll('[data-testid^="city-"] .airport-bubble__plate')].map((n) => n.textContent),
    lonGlyphs: document.querySelectorAll('[data-testid="city-lon"] [data-airway-destination="EUS"]').length,
    diamonds: document.querySelectorAll('.aw-city-pin').length,
  }));
  assert(marks.discs === 3 && marks.hubRing > 0 && marks.diamonds === 0, `game marks ${JSON.stringify(marks)}`);
  assert(marks.plates.join(',') === 'LON,PAR,ROM', `plates ${marks.plates.join(',')}`);
  assert(marks.lonGlyphs === 2, `London tag glyphs ${marks.lonGlyphs}`);
  const planet = await page.evaluate(() => {
    const r = document.querySelector('.aw-world-art > circle').getBoundingClientRect();
    return { left: r.left, right: r.right, width: innerWidth };
  });
  assert(planet.left >= 0 && planet.right <= planet.width, `planet ${planet.left.toFixed(1)}…${planet.right.toFixed(1)} outside 0…${planet.width}`);
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
  const transfer = await page.evaluate(() => ({
    par: document.querySelectorAll('[data-testid="city-par"] [data-airway-destination="EUS"]').length,
    hint: document.querySelector('[data-testid="tutorial-hint"]').textContent,
  }));
  assert(transfer.par === 2, `Paris tag glyphs ${transfer.par}`);
  assert(transfer.hint.startsWith('Crescent = Southern Europe'), `transfer hint "${transfer.hint}"`);
  await page.getByTestId('city-par').click();
  await step(page, 'complete');
  const dawn = await page.getByTestId('tutorial-hint').textContent();
  assert(/dawn/.test(dawn ?? ''), `the dawn sentence is missing on the last step: "${dawn}"`);
  await shot(page, '04-complete-p');
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
  const legend = await page.evaluate(() => [...document.querySelectorAll('[data-testid="settings-glyph-legend"] li')]
    .map((row) => ({ region: row.dataset.region, glyph: !!row.querySelector('svg path'), text: row.textContent.trim() })));
  assert(legend.length === 8 && legend.every((row) => row.glyph && row.text), `glyph legend ${JSON.stringify(legend)}`);
  assert(legend.find((row) => row.region === 'ME')?.text === 'Middle East', 'legend: bow tie row is not Middle East');
  await page.getByTestId('settings-glyph-legend').scrollIntoViewIfNeeded();
  await shot(page, '11-legend-p');
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
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log(`SUMMARY test:e2e:tutorial seed=${SEED} passed=${passed} failed=${failed} screenshots=${screenshots}`);
  if (failed) process.exitCode = 1;
}

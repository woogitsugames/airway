// [task-13] Deterministic Playwright touch-target, safe-area and rotation regression.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/shots/13');
const sizes = [
  { w: 412, h: 915, label: 'portrait-412x915' },
  { w: 915, h: 412, label: 'landscape-915x412' },
  { w: 673, h: 841, label: 'foldable-673x841' },
  { w: 904, h: 1000, label: 'foldable-904x1000' },
];
const state = Object.freeze({
  week: 3, day: 3, timeMinutes: 10 * 60 + 42, passengers: 1284,
  paused: false, speed: 1, canUndo: true, selectedPlane: 'turboprop',
  stock: { turboprop: 2, widebody: 1, hub: 0 },
});
const require = createRequire(import.meta.url);
let server;
let browser;
let passed = 0;
let failed = 0;
let shots = 0;

async function port() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise((done) => probe.close(done));
  return address.port;
}
async function ready(p) {
  const url = `http://127.0.0.1:${p}/`;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited early');
    try { if ((await fetch(url)).ok) return url; } catch { /* Starting. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error('Vite startup timed out');
}
function check(ok, message) {
  if (!ok) { failed++; console.error('FAIL ' + message); }
  else { passed++; console.log('PASS ' + message); }
}
async function geometry(page) {
  return page.evaluate(() => {
    const safe = { top: 24, right: 16, bottom: 22, left: 16 };
    const controls = [...document.querySelectorAll('.airway-hud button')].map((button) => {
      const r = button.getBoundingClientRect();
      return { id: button.dataset.hudAction, x: r.left, y: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    });
    const violations = [];
    for (const c of controls) {
      if (c.width < 48 || c.height < 48) violations.push(`${c.id}: ${c.width}x${c.height}`);
      if (c.x < safe.left - 1 || c.y < safe.top - 1 || c.right > innerWidth - safe.right + 1 || c.bottom > innerHeight - safe.bottom + 1) violations.push(`${c.id}: unsafe area`);
    }
    for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
      const x = controls[a], y = controls[b];
      if (Math.min(x.right, y.right) - Math.max(x.x, y.x) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y) > 1) violations.push(`${x.id} overlaps ${y.id}`);
    }
    return { violations, count: controls.length, layout: document.querySelector('.airway-hud')?.dataset.layout,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      controls };
  });
}

try {
  const { chromium } = require('playwright');
  const p = await port();
  server = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(p), '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
  const url = await ready(p);
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync(OUT, { recursive: true });
  for (const view of sizes) {
    const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(async (snapshot) => {
        const [{ mountHud }, { setLanguage }] = await Promise.all([import('/src/ui/hud/index.ts'), import('/src/i18n/index.ts')]);
        setLanguage('pl');
        const host = document.getElementById('app');
        if (!host) throw new Error('Missing game surface');
        const marker = document.createElement('div');
        marker.dataset.routeId = 'test-route-11';
        marker.style.cssText = 'position:absolute;left:40%;top:48%;width:120px;height:48px;pointer-events:auto';
        host.appendChild(marker);
        window.__hudEvents = [];
        window.__hud = mountHud(host, {
          onUndo: () => window.__hudEvents.push('undo'),
          onTogglePause: () => window.__hudEvents.push('pause'),
          onCycleSpeed: () => window.__hudEvents.push('speed'),
          onSelectPlane: (type) => window.__hudEvents.push('select:' + type),
          onUpgradeHub: () => window.__hudEvents.push('hub'),
          onAssignPlane: (type, id) => window.__hudEvents.push('assign:' + type + ':' + id),
        });
        // Synthetic safe-area values validate offsets even outside a notched iOS device.
        for (const [side, amount] of Object.entries({ top: 24, right: 16, bottom: 22, left: 16 })) {
          window.__hud.element.style.setProperty('--hud-safe-' + side, amount + 'px');
        }
        window.__hud.render(snapshot);
        await document.fonts.ready;
      }, state);
      await page.waitForFunction(() => document.querySelector('.airway-hud')?.dataset.layout !== undefined);
      const bounds = await geometry(page);
      check(bounds.count === 6, `${view.label}: six accessible controls`);
      check(bounds.violations.length === 0, `${view.label}: ≥48px targets, no overlap or safe-area violations (${bounds.violations.join(', ')})`);
      check(!bounds.horizontalOverflow, `${view.label}: no horizontal overflow`);
      check(bounds.layout === (view.w >= 600 && view.h >= 600 ? 'foldable' : view.w > view.h ? 'landscape' : 'portrait'), `${view.label}: responsive layout`);
      check(pageErrors.length === 0, `${view.label}: no page errors (${pageErrors.join('; ')})`);
      const file = resolve(OUT, `${view.label}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      shots++;
      if (view.label === 'portrait-412x915') {
        await page.getByRole('button', { name: /Pauza|Pause/ }).click();
        check(await page.evaluate(() => window.__hudEvents.includes('pause')), 'pause callback');
        const plane = page.locator('[data-hud-action="turboprop"]');
        const start = await plane.boundingBox();
        const target = await page.locator('[data-route-id="test-route-11"]').boundingBox();
        if (!start || !target) throw new Error('Missing drag rectangles');
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
        await page.mouse.up();
        check(await page.evaluate(() => window.__hudEvents.includes('assign:turboprop:test-route-11')), 'aircraft drag emits AssignPlane intent');
        const stable = await page.evaluate((snapshot) => {
          const old = [...document.querySelectorAll('.airway-hud button')];
          window.__hud.render(snapshot);
          return old.every((button, index) => button === document.querySelectorAll('.airway-hud button')[index]);
        }, state);
        check(stable, 'render reuses existing controls');
        await page.evaluate((snapshot) => window.__hud.render({ ...snapshot, stock: { ...snapshot.stock, turboprop: 0 } }), state);
        check(await page.locator('[data-hud-action="turboprop"]').isDisabled(), 'depleted aircraft is disabled');
        await page.evaluate((snapshot) => window.__hud.render(snapshot), state);
        await page.setViewportSize({ width: 915, height: 412 });
        await page.waitForFunction(() => document.querySelector('.airway-hud')?.dataset.layout === 'landscape');
        const rotated = await geometry(page);
        check(rotated.violations.length === 0 && !rotated.horizontalOverflow, 'live orientation change keeps targets and safe areas');
      }
    } finally { await page.close(); }
  }
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log(`SUMMARY test:hud-targets seed=0xA1A1 passed=${passed} failed=${failed} shots=${shots}`);
  if (failed) process.exitCode = 1;
}

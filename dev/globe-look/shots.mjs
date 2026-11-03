// [ext-03] Globe-look mockups as real renders of the game (not paintings): the DEV store-shot fixture plays seed 15
// (Tehran, Lahore, Tashkent, Almaty: the owner's phone screenshot), and `?globeLook=` switches the experimental look.
//   node dev/globe-look/shots.mjs [--looks=diorama,refined,satellite,painted] [--times=day,dusk] [--sizes=fold,phone]
//        [--out=docs/mockups/globe-2026-11] [--play=1500] [--preset=medium]
// Writes <look>-<time>-<size>.png and shots.json (asset bytes fetched per look, frame stats).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith('--' + name + '='))?.split('=')[1] ?? fallback;
const LOOKS = arg('looks', 'diorama,refined,satellite,painted').split(',');
const TIMES = arg('times', 'day,dusk').split(',');
const SIZES = arg('sizes', 'fold,phone').split(',');
const OUT = resolve(ROOT, arg('out', 'docs/mockups/globe-2026-11'));
const PLAY = arg('play', '1500');
const PRESET = arg('preset', 'medium');
const SEED = 15;
// Sun elevation (dot of surface normal and sun) over the network centroid, in the afternoon / evening.
const SUN = { day: 0.62, dusk: 0.05 };
// Galaxy Fold unfolded inner screen 1812x2176 px (CSS 906x1088 @2x) and a 412x915 phone @1x.
const DEVICES = { fold: { w: 906, h: 1088, dpr: 2 }, phone: { w: 412, h: 915, dpr: 1 } };

async function freePort() {
  const socket = createServer();
  await new Promise((done) => socket.listen(0, '127.0.0.1', done));
  const { port } = socket.address();
  await new Promise((done) => socket.close(done));
  return port;
}

const port = await freePort();
const server = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
  '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
  await new Promise((done) => setTimeout(done, 200));
}
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
mkdirSync(OUT, { recursive: true });
const reportPath = resolve(OUT, 'shots.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
let failed = 0;
try {
  for (const look of LOOKS) {
    for (const time of TIMES) {
      for (const size of SIZES) {
        const device = DEVICES[size];
        const context = await browser.newContext({
          viewport: { width: device.w, height: device.h }, deviceScaleFactor: device.dpr, locale: 'pl-PL',
        });
        const page = await context.newPage();
        const errors = [];
        let assetBytes = 0;
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', async (response) => {
          if (!response.url().includes('/dev/globe-look/assets/')) return;
          try { assetBytes += (await response.body()).length; } catch { /* aborted */ }
        });
        await page.addInitScript(() => {
          try {
            localStorage.setItem('airway.settings', JSON.stringify({ language: 'pl', graphics: 'medium' }));
          } catch { /* storage blocked */ }
        });
        const url = new URL(base);
        url.searchParams.set('storeShot', 'game');
        url.searchParams.set('seed', String(SEED));
        url.searchParams.set('lang', 'pl');
        url.searchParams.set('storePlay', PLAY);
        url.searchParams.set('storeSunDot', String(SUN[time]));
        url.searchParams.set('quality', PRESET);
        if (look !== 'diorama') url.searchParams.set('globeLook', look);
        const name = `${look}-${time}-${size}`;
        try {
          await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60000 });
          await page.waitForFunction(() => document.documentElement.dataset.storeShotReady === 'game', null,
            { timeout: 240000 });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(800);
          const file = resolve(OUT, name + '.png');
          await page.screenshot({ path: file, animations: 'disabled' });
          const stats = await page.evaluate(() => {
            const world = window.__awWorld;
            return { contrast: world?.nightContrast?.() ?? null, stats: world?.stats?.() ?? null };
          });
          report[name] = { look, time, size, assetBytes, errors, ...stats };
          console.log('PASS', name, 'assets', assetBytes, errors.length ? 'errors ' + errors.join('; ') : '');
          if (errors.length) failed++;
        } catch (error) {
          failed++;
          console.log('FAIL', name, error.message.split('\n')[0], errors.join('; '));
        }
        await context.close();
      }
    }
  }
} finally {
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.kill('SIGTERM');
  console.log('SUMMARY globe-look:shots looks=' + LOOKS.length + ' failed=' + failed);
  process.exitCode = failed ? 1 : 0;
}

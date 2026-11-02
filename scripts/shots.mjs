// Capture exact-size portrait and landscape canvas screenshots with the environment's Playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// [task-15] Keep the scaffold captures and add the failure-screen fixture.
const OUTPUT = resolve(ROOT, 'docs/shots');
const require = createRequire(import.meta.url);
const views = [
  { file: '01/game-p.png', width: 412, height: 915 },
  { file: '01/game-l.png', width: 915, height: 412 },
  { file: '15/game-p.png', width: 412, height: 915, query: '?preview=gameover' },
  { file: '15/game-l.png', width: 915, height: 412, query: '?preview=gameover' },
];
let server;
let browser;
let captured = 0;
let failed = 0;

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No local TCP port');
  const port = address.port;
  await new Promise((done) => probe.close(done));
  return port;
}
async function waitForVite(port) {
  const url = 'http://127.0.0.1:' + port + '/';
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited before becoming ready');
    try {
      const response = await fetch(url);
      if (response.ok) return url;
    } catch {
      // Vite is still starting up.
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error('Vite did not become ready within 30 seconds');
}

try {
  const { chromium } = require('playwright');
  const port = await freePort();
  server = spawn(process.execPath, [
    resolve(ROOT, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], { cwd: ROOT, stdio: 'inherit' });
  const url = await waitForVite(port);
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  mkdirSync(OUTPUT, { recursive: true });
  for (const view of views) {
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url + (view.query ?? ''), { waitUntil: 'networkidle' });
      await page.waitForSelector(view.query ? '[data-gameover-state="open"]' : '#app canvas');
      await page.evaluate(() => document.fonts.ready);
      if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
      const file = resolve(OUTPUT, view.file);
      mkdirSync(dirname(file), { recursive: true });
      await page.screenshot({ path: file, animations: 'disabled' });
      captured++;
      console.log('shot docs/shots/' + view.file + ' ' + view.width + 'x' + view.height);
    } finally {
      await page.close();
    }
  }
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log('SUMMARY shots seed=0xA1A1 captured=' + captured + ' failed=' + failed);
  if (failed) process.exitCode = 1;
}

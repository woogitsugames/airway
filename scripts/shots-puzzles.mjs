// [task-17] Capture the puzzle departure board in portrait and landscape.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'docs/shots/17');
const require = createRequire(import.meta.url);
const views = [
  { file: 'board-p.png', width: 412, height: 915 },
  { file: 'board-l.png', width: 915, height: 412 },
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
  const url = `http://127.0.0.1:${port}/`;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited before becoming ready');
    try { if ((await fetch(url)).ok) return url; } catch { /* Startup in progress. */ }
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
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  mkdirSync(OUTPUT, { recursive: true });
  for (const view of views) {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('.puzzle-departures .puzzle-flap');
      await page.evaluate(() => document.fonts.ready);
      if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
      await page.screenshot({ path: resolve(OUTPUT, view.file), animations: 'disabled' });
      captured++;
      console.log(`shot docs/shots/17/${view.file} ${view.width}x${view.height}`);
    } finally { await page.close(); }
  }
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log(`SUMMARY shots:puzzles seed=0xA1A1 captured=${captured} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

// Shared Playwright harness. Uses the environment's Playwright, not an npm dependency.
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SEED = 0xa1a1;
const require = createRequire(import.meta.url);

async function allocatePort() {
  const socket = createTcpServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port');
  const port = address.port;
  await new Promise((done) => socket.close(done));
  return port;
}

async function waitForServer(url, processHandle) {
  for (let count = 0; count < 150; count++) {
    if (processHandle && processHandle.exitCode !== null) throw new Error('Vite exited before responding');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* Server is starting. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Server did not respond: ${url}`);
}

export async function withBrowser(callback, { fixture = false } = {}) {
  let vite;
  let fixtureServer;
  let browser;
  try {
    let url = process.env.AIRWAY_E2E_URL;
    if (fixture) {
      const html = readFileSync(resolve(ROOT, 'e2e/fixtures/airway.html'));
      fixtureServer = createHttpServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(html);
      });
      fixtureServer.listen(0, '127.0.0.1');
      await once(fixtureServer, 'listening');
      const address = fixtureServer.address();
      if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
      url = `http://127.0.0.1:${address.port}/`;
    } else if (!url) {
      const port = await allocatePort();
      url = `http://127.0.0.1:${port}/`;
      vite = spawn(process.execPath, [
        resolve(ROOT, 'node_modules/vite/bin/vite.js'),
        '--host', '127.0.0.1', '--port', String(port), '--strictPort',
      ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      let tail = '';
      for (const stream of [vite.stdout, vite.stderr]) {
        stream.on('data', (chunk) => { tail = (tail + chunk.toString()).slice(-4000); });
      }
      vite.on('error', (error) => { tail += String(error); });
      try { await waitForServer(url, vite); }
      catch (error) { throw new Error(`${error.message}\n${tail}`); }
    }
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    return await callback({ browser, url });
  } finally {
    if (browser) await browser.close();
    if (vite && vite.exitCode === null) vite.kill('SIGTERM');
    if (fixtureServer) await new Promise((done) => fixtureServer.close(done));
  }
}

export async function newGamePage(browser, url, language, viewport = { width: 412, height: 915 }) {
  const page = await browser.newPage({
    viewport, deviceScaleFactor: 1, hasTouch: true,
    reducedMotion: 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((lang) => {
    localStorage.clear();
    localStorage.setItem('airway.settings', JSON.stringify({ language: lang }));
  }, language);
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#app').waitFor({ timeout: 12000 });
  await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error(`Browser page errors: ${errors.join('; ')}`);
  return { page, errors };
}

export async function state(page) {
  return await page.evaluate(() => window.aw.state());
}
export async function waitForScreen(page, screen) {
  await page.waitForFunction((expected) => window.aw?.ready && window.aw.state().screen === expected,
    screen, { timeout: 8000 });
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


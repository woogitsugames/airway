// Shared browser harness for screenshots, E2E and the UI matrix.
// Playwright + Chromium come from the environment (CI: `npm install --no-save playwright@1.63.0`);
// they are intentionally not npm dependencies of the game.
import { spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SEED = 0xa1a1;
/**
 * [night-84a] U7, D-339: the home region of every store run (store shots, feature graphic, preview video), set like a
 * player's menu choice. A Random start on 0xA1A1 lands in the Middle East beside Karachi, which opens on day 2, so the
 * provisional ASI glyph (D-08) filled the hub signs and strips; from Northern Europe the first four days stay in the
 * six D-08 regions.
 */
export const STORE_HOME_REGION = 'EUN';

/** Presets the store run's settings (language, D-339 home region) before the app reads them. */
export async function presetStoreSettings(page, language, { clear = false } = {}) {
  await page.addInitScript(({ language, homeRegion, wipe }) => {
    try {
      if (wipe) localStorage.clear();
      const key = 'airway.settings';
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...value, language, homeRegion }));
    } catch { /* Browser privacy mode can block storage. */ }
  }, { language, homeRegion: STORE_HOME_REGION, wipe: clear });
}
// SwiftShader WebGL works in headless containers without a GPU. Never compare its FPS with devices.
export const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const require = createRequire(import.meta.url);

export async function freePort() {
  const socket = createTcpServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No free local TCP port');
  await new Promise((done) => socket.close(done));
  return address.port;
}

/** Polls `url` until it answers 2xx; aborts early if `child` exits. */
export async function waitForHttp(url, child, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error('Server exited before responding');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* still starting */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Server did not respond within ${timeoutMs} ms: ${url}`);
}

/**
 * Starts a disposable Vite dev server on a free port (or reuses AIRWAY_E2E_URL).
 * Returns { url, stop }. Server output is kept as a tail for error messages only.
 */
export async function startVite({ reuseEnv = true } = {}) {
  const external = reuseEnv ? process.env.AIRWAY_E2E_URL : undefined;
  if (external) return { url: external.endsWith('/') ? external : external + '/', stop: async () => {} };
  const bin = resolve(ROOT, 'node_modules/vite/bin/vite.js');
  if (!existsSync(bin)) throw new Error('Vite is not installed; run npm ci');
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const child = spawn(process.execPath, [bin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => { tail = (tail + chunk.toString()).slice(-4000); });
  }
  child.on('error', (error) => { tail += String(error); });
  try {
    await waitForHttp(url, child);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${error.message}\n${tail}`);
  }
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((done) => setTimeout(done, 3000).unref())]);
  };
  return { url, stop, tail: () => tail };
}

export function loadChromium() {
  try {
    return require('playwright').chromium;
  } catch {
    throw new Error('Playwright is not available. Install it outside package.json: npm install --no-save playwright@1.63.0');
  }
}

/**
 * [night-12bj] For pages that draw no WebGL (the DEV stub world `?render=stub`, D-254): composite and rasterise the
 * page in software instead of through SwiftShader GL. With GPU compositing every frame of the DOM layers is rastered
 * on emulated GL; at DPR 2 (904x1088@2 = 1808x2176 px) one frame of the weekly board took ~0.3 s (3.5 rAF/s) and one
 * `page.screenshot` 18-28 s, so the ui:matrix screenshots hit Playwright's 30 s limit on a loaded host. In software
 * the same page runs at ~60 rAF/s and a screenshot takes ~0.4 s. WebGL itself stays available (still SwiftShader);
 * the real renderer keeps CHROMIUM_ARGS unchanged.
 */
export const SOFTWARE_COMPOSITING_ARGS = ['--disable-gpu-compositing'];

/** `options.softwareCompositing`: add SOFTWARE_COMPOSITING_ARGS (stub-world suites only). */
export async function launchChromium(options = {}) {
  return await loadChromium().launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: options.softwareCompositing ? [...CHROMIUM_ARGS, ...SOFTWARE_COMPOSITING_ARGS] : CHROMIUM_ARGS,
  });
}

/** Writes PL/EN into the app's settings key before any page script runs. */
export async function presetLanguage(page, language, { clear = false } = {}) {
  await page.addInitScript(({ lang, wipe }) => {
    try {
      if (wipe) localStorage.clear();
      const key = 'airway.settings';
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...value, language: lang }));
    } catch { /* storage can be blocked in private mode */ }
  }, { lang: language, wipe: clear });
}

export function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

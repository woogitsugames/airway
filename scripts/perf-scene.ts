// [task-21] Browser performance runner for the production world renderer: 120 s at 4x, fixed seed.
// Node >=22 with type stripping; Playwright is supplied by the development environment.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SEED = '0xA1A1';
const VALID_PRESETS = new Set(['auto', 'saver', 'low', 'medium', 'high']);
let server;
let browser;
let page;
let failed = 0;
let frames = 0;
let sampleCount = 0;

function parseArgs(argv) {
  const options = {
    durationMs: 120_000,
    preset: 'medium',
    look: '', // [ext-03] experimental globe look (DEV flag); '' = the shipped diorama
    width: 412,
    height: 915,
    output: resolve(ROOT, '.perf/scene.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (!value) throw new Error('Missing value for ' + flag);
    if (flag === '--duration-ms') {
      options.durationMs = Number(value);
      if (!Number.isInteger(options.durationMs) || options.durationMs < 1000 || options.durationMs > 600_000) {
        throw new Error('duration-ms must be an integer in [1000, 600000]');
      }
    } else if (flag === '--preset') {
      if (!VALID_PRESETS.has(value)) throw new Error('Invalid quality preset: ' + value);
      options.preset = value;
    } else if (flag === '--look') {
      if (!['diorama', 'refined', 'satellite', 'painted', 'map', 'linoryt', 'earth'].includes(value)) throw new Error('Invalid look: ' + value);
      options.look = value === 'diorama' ? '' : value;
    } else if (flag === '--viewport') {
      const parts = /^(\d{3,4})x(\d{3,4})$/.exec(value);
      if (!parts) throw new Error('Viewport must be WIDTHxHEIGHT');
      options.width = Number(parts[1]);
      options.height = Number(parts[2]);
    } else if (flag === '--output') {
      options.output = resolve(ROOT, value);
    } else {
      throw new Error('Unknown option: ' + flag);
    }
  }
  return options;
}

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port available');
  const port = address.port;
  await new Promise((done) => socket.close(done));
  return port;
}

async function waitForServer(port) {
  const url = 'http://127.0.0.1:' + port + '/';
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited before startup');
    try {
      const response = await fetch(url);
      if (response.ok) return url;
    } catch {
      // Vite is still starting.
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error('Vite was not ready within 30 seconds');
}

async function jsHeapBytes(cdp) {
  try {
    const result = await cdp.send('Performance.getMetrics');
    const record = result.metrics.find((entry) => entry.name === 'JSHeapUsedSize');
    return record ? record.value : null;
  } catch {
    return null;
  }
}

function finiteMean(values) {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const { chromium } = require('playwright');
  const port = await freePort();
  server = spawn(process.execPath, [
    resolve(ROOT, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], { cwd: ROOT, stdio: 'inherit' });

  const url = await waitForServer(port);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
  await page.evaluate(async ({ preset, look }) => {
    const module = await import('/src/render/perf-fixture.ts');
    const stage = document.createElement('div');
    stage.id = 'perf-stage';
    stage.style.cssText = 'position:fixed;inset:0;overflow:hidden;background:#8CC3D8';
    document.body.appendChild(stage);
    window.__airwayPerf = module.mountPerformanceFixture(stage, preset, look || undefined);
    await window.__airwayPerf.ready;
  }, { preset: options.preset, look: options.look });
  await page.waitForFunction(() => window.__airwayPerf?.read().renderedFrames > 4, null, {
    timeout: 20_000,
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const browserInfo = await page.evaluate(() => {
    const canvas = document.querySelector('#perf-stage canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      webglVersion: gl?.getParameter(gl.VERSION) ?? null,
      renderer: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    };
  });
  const config = await page.evaluate(() => {
    const fixture = window.__airwayPerf;
    return {
      seed: fixture.seed,
      speed: fixture.speed,
      scene: fixture.counts,
      preset: fixture.preset,
      pixelRatio: fixture.pixelRatio,
    };
  });

  const samples = [];
  const started = performance.now();
  let active = false;
  let previousAt = started;
  let previousFrames = 0;

  while (performance.now() - started < options.durationMs) {
    const remaining = options.durationMs - (performance.now() - started);
    await new Promise((done) => setTimeout(done, Math.min(1000, Math.max(1, remaining))));
    const now = performance.now();
    const elapsedMs = now - started;
    if (!active && elapsedMs >= options.durationMs / 2) {
      active = true;
      await page.evaluate(() => window.__airwayPerf.setInteracting(true));
    }
    const snapshot = await page.evaluate(() => window.__airwayPerf.read());
    const memoryBytes = await jsHeapBytes(cdp);
    frames = snapshot.renderedFrames;
    sampleCount++;
    samples.push({
      elapsedMs: Math.round(elapsedMs),
      phase: active ? 'active' : 'idle',
      ...snapshot,
      jsHeapBytes: memoryBytes,
      deliveredFps: (snapshot.renderedFrames - previousFrames) * 1000 / (now - previousAt),
    });
    previousFrames = snapshot.renderedFrames;
    previousAt = now;
  }

  await page.evaluate(() => window.__airwayPerf.setInteracting(false));
  const summary = await page.evaluate(() => window.__airwayPerf.summarize());
  const memory = samples.map((entry) => entry.jsHeapBytes).filter((value) => value !== null);
  const report = {
    schema: 1,
    kind: 'world-renderer-fixture',
    warning: 'Real render stack with a scripted (non-simulated) network. SwiftShader is NOT comparable to mobile GPU results.',
    ...config,
    durationRequestedMs: options.durationMs,
    durationMeasuredMs: Math.round(performance.now() - started),
    viewport: { width: options.width, height: options.height, dpr: 1 },
    browser: browserInfo,
    budgetsMs: { midRangeAndroid: 16.7, lowEndAndroid: 33 },
    summary: {
      ...summary,
      samples: sampleCount,
      meanDeliveredIdleFps: finiteMean(samples.filter((entry) => entry.phase === 'idle').map((entry) => entry.deliveredFps)),
      meanDeliveredActiveFps: finiteMean(samples.filter((entry) => entry.phase === 'active').map((entry) => entry.deliveredFps)),
      maxDrawCalls: Math.max(...samples.map((entry) => entry.drawCalls)),
      maxTriangles: Math.max(...samples.map((entry) => entry.triangles)),
      domOverlayElements: samples.length ? samples[0].overlayDomElements : null,
      jsHeapStartBytes: memory.length ? memory[0] : null,
      jsHeapEndBytes: memory.length ? memory[memory.length - 1] : null,
      jsHeapMaxBytes: memory.length ? Math.max(...memory) : null,
    },
    samples,
  };

  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  if (frames < 5 || sampleCount === 0) throw new Error('No useful frame samples');
  if (config.scene.cities !== 40 || config.scene.planes !== 100 || config.scene.routes !== 40) {
    throw new Error('Incorrect benchmark fixture cardinality');
  }
  if (samples.some((entry) => entry.overlayDomElements !== 40)) {
    throw new Error('Overlay element count changed during benchmark');
  }
  if (report.summary.p95RenderCpuMs <= 0 || report.summary.maxDrawCalls < 1 || report.summary.maxTriangles < 1) {
    throw new Error('Invalid WebGL measurements');
  }

  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('perf:scene JSON ' + options.output);
  console.log('perf:scene CPU p95=' + report.summary.p95RenderCpuMs.toFixed(2) +
    'ms drawCalls=' + report.summary.maxDrawCalls +
    ' triangles=' + report.summary.maxTriangles +
    ' DOM=' + report.summary.domOverlayElements);
} catch (error) {
  failed = 1;
  console.error('perf:scene error:', error instanceof Error ? error.stack : String(error));
} finally {
  if (page) {
    try { await page.evaluate(() => window.__airwayPerf?.dispose()); } catch { /* page may be gone */ }
  }
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log('SUMMARY perf:scene seed=' + SEED + (process.argv.includes('--look') ? ' look=' +
    process.argv[process.argv.indexOf('--look') + 1] : '') + ' frames=' + frames +
    ' samples=' + sampleCount + ' failed=' + failed);
  if (failed) process.exitCode = 1;
}

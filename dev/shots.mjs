// Exact-size screenshots and SwiftShader telemetry of the render labs.
// `node dev/shots.mjs` = globe lab (docs/shots/03); `node dev/shots.mjs world` = full world lab (docs/shots/render).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const views = [{ name: 'game-p.png', width: 412, height: 915 },
  { name: 'game-l.png', width: 915, height: 412 }];
const lab = process.argv[2] === 'world' ? 'world' : 'globe';
const outDir = resolve(root, lab === 'world' ? 'docs/shots/render' : 'docs/shots/03');
let server, browser, passed = 0, failed = 0;
try {
  const { chromium } = require('playwright');
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port');
  const port = address.port;
  await new Promise((done) => probe.close(done));
  server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit' });
  const url = 'http://127.0.0.1:' + port + (lab === 'world'
    ? '/dev/world.html?quality=medium&frozen&clean' : '/dev/globe.html?quality=medium');
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited during startup');
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* server not ready */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error('Vite startup timeout');
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  mkdirSync(outDir, { recursive: true });
  for (const v of views) {
    const page = await browser.newPage({ viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => (window.__globeReady || window.__ready) &&
        (window.__globeMetrics || window.__worldMetrics),
        undefined, { timeout: 90000 });
      await page.waitForTimeout(700);
      if (pageErrors.length) throw new Error(pageErrors.join('; '));
      const metrics = await page.evaluate(() => window.__globeMetrics || window.__worldMetrics);
      if (!metrics || metrics.drawCalls > (lab === 'world' ? 90 : 60) || metrics.triangles < 1000) {
        throw new Error('Invalid globe telemetry: ' + JSON.stringify(metrics));
      }
      await page.screenshot({ path: resolve(outDir, v.name),
        animations: 'disabled' });
      console.log(v.name + ' ' + v.width + 'x' + v.height + ' fps=' + metrics.fps +
        ' calls=' + metrics.drawCalls + ' triangles=' + metrics.triangles +
        ' renderCpuMs=' + metrics.frameMs);
      passed++;
    } catch (error) {
      failed++;
      console.error(v.name + ': ' + (error instanceof Error ? error.message : String(error)));
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
  console.log('SUMMARY shots:' + lab + ' seed=0xA1A1 captured=' + passed + ' failed=' + failed);
  if (failed) process.exitCode = 1;
}

// [M1] Close-ups of the richer world in the full world lab (dev/world.html, real renderer):
// regional airports, palms, snow, hubs and landmarks. Writes docs/shots/m1/zoom-*.png.
// Real-game day/night shots come from `node scripts/shots-34.mjs docs/shots/m1`.
// Usage: node scripts/shots-m1.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, SEED, startVite, launchChromium } from './lib/harness.mjs';

const OUT = resolve(ROOT, process.argv[2] ?? 'docs/shots/m1');
// name, viewport, crop (CSS px) or null, query for dev/world.html (?only keeps just the `add` list)
const VIEWS = [
  ['zoom-europe', [412, 915], [70, 290, 280, 280], 'tick=720&lon=6&lat=47&add=PAR,LON*,OSL,STO*,MAD,ROM'],
  ['zoom-asia', [412, 915], [60, 330, 300, 300], 'tick=200&lon=105&lat=10&add=BKK*,SIN,KUL,HCM,HAN'],
  ['zoom-east-asia', [412, 915], [40, 300, 340, 340], 'tick=120&lon=125&lat=33&add=TYO*,SEL,PEK,SHA,HKG'],
  ['zoom-americas', [412, 915], [40, 300, 340, 340], 'tick=1060&lon=-95&lat=30&add=CHI*,DCA,MEX,HOU,MIA'],
  ['zoom-mideast', [915, 412], [250, 130, 500, 210], 'tick=600&lon=40&lat=26&add=CAI*,DXB,DEL,RUH,IST'],
  ['zoom-night', [412, 915], [70, 290, 280, 280], 'tick=1440&lon=6&lat=47&add=PAR,LON*,OSL,STO*,MAD,ROM'],
];
let host, browser, passed = 0, failed = 0;
try {
  host = await startVite();
  browser = await launchChromium();
  mkdirSync(OUT, { recursive: true });
  for (const [name, [width, height], crop, query] of VIEWS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(host.url.replace(/\/$/, '') + '/dev/world.html?quality=medium&frozen&clean&only&zoom=4&' + query);
      await page.waitForFunction(() => window.__ready && window.__worldMetrics, undefined, { timeout: 120000 });
      await page.waitForTimeout(600);
      if (errors.length) throw new Error(errors.join('; '));
      const [x, y, w, h] = crop;
      await page.screenshot({ path: resolve(OUT, name + '.png'), clip: { x, y, width: w, height: h } });
      const m = await page.evaluate(() => window.__worldMetrics);
      console.log(`${name}.png calls=${m.drawCalls} triangles=${m.triangles}`);
      passed++;
    } catch (error) {
      failed++;
      console.error('FAIL ' + name + ': ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await host?.stop?.();
  console.log(`SUMMARY shots:m1 seed=0x${SEED.toString(16).toUpperCase()} shots=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

// [night-12bk] G7 measurement probe (not part of any suite): what `--disable-gpu-compositing`
// (scripts/lib/harness.mjs SOFTWARE_COMPOSITING_ARGS) does to the REAL WebGL globe. Defaults of every suite stay as they
// are; results: docs/notes/G7-compositing.md.
//
//   node scripts/research/compositing-probe.mjs capture <outdir> [--soft]   ui:matrix cells, timed, PNGs to <outdir>
//   node scripts/research/compositing-probe.mjs diff <dirA> <dirB>           per-PNG pixel difference A vs B
//
// `capture` walks menu -> game -> upgrade -> gameover like scripts/ui-matrix.mjs for a few cells (PL, 412x915@1 and
// 904x1088@2) and prints the time of every step and screenshot. `--soft` launches Chromium with the software
// compositor; WebGL stays on SwiftShader. perf:scene has no such option: run it with CHROMIUM_PATH pointing at a
// wrapper that adds the flag (see the note).
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { launchChromium } from '../lib/harness.mjs';
import { withBrowser, newGamePage, waitForScreen, clickTestId, SEED } from '../../e2e/browser.mjs';

const [mode, first, second] = process.argv.slice(2);
const soft = process.argv.includes('--soft');
const cells = [['pl', 412, 915, 1], ['pl', 904, 1088, 2]];

async function timed(label, action) {
  const started = performance.now();
  await action();
  const ms = Math.round(performance.now() - started);
  console.log(`  ${label} ${ms} ms`);
  return ms;
}

async function capture(outdir) {
  mkdirSync(outdir, { recursive: true });
  const total = performance.now();
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height, dpr] of cells) {
      const cell = `${language}-${width}x${height}${dpr > 1 ? '@' + dpr : ''}`;
      console.log(`cell ${cell} soft=${soft}`);
      const cellStarted = performance.now();
      const { page } = await newGamePage(browser, url, language, { width, height }, { deviceScaleFactor: dpr });
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        const shot = (screen) => timed(`shot ${screen}`,
          () => page.screenshot({ path: resolve(outdir, `${screen}-${cell}.png`), animations: 'disabled' }));
        await shot('menu');
        await timed('enter game', async () => { await clickTestId(page, 'menu-endless'); await waitForScreen(page, 'game'); });
        await shot('game');
        await timed('autoplay to week-1 board', async () => {
          await page.evaluate(() => window.aw.autoplay(1));
          await waitForScreen(page, 'upgrade', 60000);
        });
        await shot('upgrade');
        await timed('pick card + overload', async () => {
          const option = await page.evaluate(() => document.querySelector(
            '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')
            ?.getAttribute('data-testid') ?? 'upgrade-option-0');
          await clickTestId(page, option);
          await waitForScreen(page, 'game');
          await page.evaluate(() => window.aw.forceHubOverload());
          await waitForScreen(page, 'gameover');
        });
        await shot('gameover');
        const raf = await page.evaluate(() => new Promise((done) => {
          let count = 0;
          const start = performance.now();
          const tick = () => { count++; if (performance.now() - start < 3000) requestAnimationFrame(tick); else done(count / 3); };
          requestAnimationFrame(tick);
        }));
        console.log(`  rAF on game over ${raf.toFixed(1)}/s`);
      } finally {
        await page.close();
      }
      console.log(`  cell total ${Math.round(performance.now() - cellStarted)} ms`);
    }
  }, { softwareCompositing: soft });
  console.log(`SUMMARY compositing-probe capture soft=${soft} durationMs=${Math.round(performance.now() - total)}`);
}

async function diff(dirA, dirB) {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    for (const name of readdirSync(dirA).filter((file) => file.endsWith('.png')).sort()) {
      const a = 'data:image/png;base64,' + readFileSync(resolve(dirA, name)).toString('base64');
      const b = 'data:image/png;base64,' + readFileSync(resolve(dirB, name)).toString('base64');
      const result = await page.evaluate(async ([srcA, srcB]) => {
        const load = async (src) => { const image = new Image(); image.src = src; await image.decode(); return image; };
        const [imageA, imageB] = await Promise.all([load(srcA), load(srcB)]);
        if (imageA.width !== imageB.width || imageA.height !== imageB.height) return { size: 'differs' };
        const pixels = (image) => {
          const canvas = new OffscreenCanvas(image.width, image.height);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height).data;
        };
        const pa = pixels(imageA);
        const pb = pixels(imageB);
        let changed = 0; let over8 = 0; let maxDelta = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const delta = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
          if (delta) changed++;
          if (delta > 8) over8++;
          if (delta > maxDelta) maxDelta = delta;
        }
        const total = pa.length / 4;
        return { changedPct: +(100 * changed / total).toFixed(2), over8Pct: +(100 * over8 / total).toFixed(2), maxDelta };
      }, [a, b]);
      console.log(`${name} ${JSON.stringify(result)}`);
    }
  } finally {
    await browser.close();
  }
}

if (mode === 'capture' && first) await capture(resolve(first));
else if (mode === 'diff' && first && second) await diff(resolve(first), resolve(second));
else {
  console.error('usage: compositing-probe.mjs capture <outdir> [--soft] | diff <dirA> <dirB>');
  process.exitCode = 2;
}

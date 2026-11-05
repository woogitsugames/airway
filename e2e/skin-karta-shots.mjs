// [night-11au] D-256: evidence for the DEV-only KARTA skin preview (`?skin=karta`), for the owner's pick of a UI
// direction (docs/styles/ui-2026-11/KIERUNKI.md). Two steps:
//   node e2e/skin-karta-shots.mjs frames <outDir>                 one still frame of the real game (DEV `storeShot=game`
//                                                                 fixture, seed 0xA1A1) per skin, portrait and landscape
//   node e2e/skin-karta-shots.mjs sheet <currentDir> <kartaDir> <framesDir> <out.png>
//                                                                 side-by-side contact sheet, current | KARTA
// The fixture shots come from `node e2e/skin-pixels.mjs capture <dir>` (current) and `AW_SKIN=karta node
// e2e/skin-pixels.mjs capture <dir>` (KARTA). Not a test suite: the globe under SwiftShader is slow (G7), one frame each.
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser } from './browser.mjs';
import { SEED } from '../scripts/lib/harness.mjs';

const [mode, ...args] = process.argv.slice(2);
const FRAMES = [['p', 412, 915], ['l', 915, 412]];

async function frames(outDir) {
  mkdirSync(outDir, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const skin of ['current', 'karta']) for (const [tag, width, height] of FRAMES) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce', locale: 'pl-PL' });
      try {
        await page.addInitScript(() => { try { localStorage.setItem('airway.settings', JSON.stringify({ language: 'pl' })); } catch { /* private mode */ } });
        const target = new URL(url);
        target.searchParams.set('storeShot', 'game');
        target.searchParams.set('seed', String(SEED));
        target.searchParams.set('lang', 'pl');
        if (skin === 'karta') target.searchParams.set('skin', 'karta');
        await page.goto(target.href, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForFunction(() => document.documentElement.dataset.storeShotReady === 'game', null, { timeout: 240000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        const file = resolve(outDir, `game-${skin}-${tag}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        console.log('frame ' + file);
      } finally {
        await page.close();
      }
    }
  });
}

/** Rows of [label, file name] pairs; each pair is shown current | KARTA. */
const PAIRS = [
  ['Gra (prawdziwa klatka)', 'game', 'p'],
  ['HUD', 'hud-pl-412x915-100', 'x'],
  ['Przywieszki lotnisk / podpisy', 'overlay-pl-412x915-100', 'x'],
  ['Pauza', 'pause-pl-412x915-100', 'x'],
  ['Menu', 'menu-pl-412x915-100', 'x'],
  ['Skrzynie', 'upgrade-pl-412x915-100', 'x'],
  ['Koniec gry', 'gameover-pl-412x915-100', 'x'],
  ['Ustawienia', 'settings-pl-412x915-100', 'x'],
];

async function sheet(currentDir, kartaDir, framesDir, out) {
  const data = (file) => existsSync(file) ? 'data:image/png;base64,' + readFileSync(file).toString('base64') : '';
  const cells = PAIRS.map(([label, name, kind]) => {
    const a = kind === 'p' ? resolve(framesDir, 'game-current-p.png') : resolve(currentDir, name + '.png');
    const b = kind === 'p' ? resolve(framesDir, 'game-karta-p.png') : resolve(kartaDir, name + '.png');
    return `<figure><figcaption>${label}</figcaption><div class="pair"><div><img src="${data(a)}"><span>dziś</span></div>` +
      `<div><img src="${data(b)}"><span>KARTA</span></div></div></figure>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #e9e6df; font: 600 15px/1.2 sans-serif; color: #1b1b1b; width: 1792px; }
    h1 { margin: 0 0 18px; font-size: 22px; }
    main { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px 18px; }
    figure { margin: 0; } figcaption { margin: 0 0 6px; }
    .pair { display: flex; gap: 6px; } .pair div { display: flex; flex-direction: column; gap: 3px; }
    img { width: 206px; height: 458px; display: block; border: 1px solid #999; object-fit: cover; object-position: top; }
    span { font-size: 12px; color: #555; }
  </style><h1>Airway: dzisiejsza skórka (lewa) i podgląd KARTA (prawa), PL 412×915</h1><main>${cells}</main>`;
  await withBrowser(async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1840, height: 600 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
  });
  console.log('sheet ' + out);
}

if (mode === 'frames' && args[0]) await frames(resolve(args[0]));
else if (mode === 'sheet' && args.length === 4) await sheet(...args.slice(0, 3).map((p) => resolve(p)), resolve(args[3]));
else { console.error('usage: node e2e/skin-karta-shots.mjs frames <outDir> | sheet <currentDir> <kartaDir> <framesDir> <out.png>'); process.exitCode = 1; }

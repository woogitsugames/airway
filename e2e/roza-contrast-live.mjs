// [night-11az] D-257: re-measure of docs/notes/roza-contrast.md on the implemented Róża skin (D-47). One still of the
// real game (DEV `storeShot=game`, seed 0xA1A1) per orientation, once with the UI and once with the HUD and the airport
// overlay hidden (the background under every mark), plus the boxes of the marks; scripts/research/roza-contrast-live.py
// computes the ratios. Research only, not a suite (the globe under SwiftShader is slow, G7).
//   node e2e/roza-contrast-live.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser } from './browser.mjs';
import { SEED } from '../scripts/lib/harness.mjs';

const out = resolve(process.argv[2] ?? '.e2e/roza-contrast');
mkdirSync(out, { recursive: true });
const MARKS = {
  'nazwa po łuku (Alegreya 13,5 px, kreda/obwódka)': '.roza-rose__name',
  'notka: kod i „14 z 24” (kreda/obwódka)': '.airport-bubble:not(.airport-bubble--jam) .airport-bubble__plate, .airport-bubble:not(.airport-bubble--jam) .roza-fill',
  'notka: liczby grup (kreda/obwódka)': '.roza-count',
  'róża: kreski miejsc (kreda/obwódka)': '.roza-rose',
  'zator: notka i zdanie (cynober/obwódka)': '.airport-bubble--jam .airport-bubble__plate, .roza-jam',
  'tarcza 24 h (kreda/obwódka)': '.roza-dial',
  'dok: symbole (kreda/obwódka)': '.airway-dock__tag .airway-hud__icon',
  'dok: podpisy 12,5 px (kreda/obwódka)': '.roza-caption',
  'tydzień i pasażerowie (czerń/jasna obwódka)': '.roza-pass',
  'notka poza ekranem: odległość': '.airport-edge',
};
await withBrowser(async ({ browser, url }) => {
  for (const [tag, width, height] of [['p', 412, 915], ['l', 915, 412]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce', locale: 'pl-PL' });
    await page.addInitScript(() => { try { localStorage.setItem('airway.settings', JSON.stringify({ language: 'pl' })); } catch { /* private */ } });
    const target = new URL(url);
    target.searchParams.set('storeShot', 'game');
    target.searchParams.set('seed', String(SEED));
    target.searchParams.set('lang', 'pl');
    await page.goto(target.href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.storeShotReady === 'game', null, { timeout: 240000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(out, `ui-${tag}.png`), animations: 'disabled' });
    const boxes = await page.evaluate((marks) => Object.fromEntries(Object.entries(marks).map(([name, sel]) => [name,
      [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight)
        .map((r) => [Math.max(0, r.left), Math.max(0, r.top), Math.min(innerWidth, r.right), Math.min(innerHeight, r.bottom)])])), MARKS);
    await page.addStyleTag({ content: '.airway-hud, .airport-overlay { visibility: hidden !important; }' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(out, `bg-${tag}.png`), animations: 'disabled' });
    writeFileSync(resolve(out, `boxes-${tag}.json`), JSON.stringify(boxes, null, 1));
    console.log('frame ' + tag);
    await page.close();
  }
});

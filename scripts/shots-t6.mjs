// [night-81a] D-336 (PLAN-NOWY-KIERUNEK.md step T6 + R5): the flip's evidence shots — the shipped UI-A skin over the
// shipped NASA globe (DEFAULT_GLOBE_LOOK = 'earth'), real renderer (SwiftShader, slow), on the DEV store-shot fixtures of
// src/main.ts (`?storeShot=`, seed 0xA1A1). Was scripts/shots-u5.mjs (the Linoryt flip, D-301).
//   menu     — the menu (departures board over the night globe, `storeShot=menu`);
//   day      — the store shot `game` with the sun high over the network (`storeSunDot=0.6`);
//   night    — the store shot `night` (midnight under the camera: city lights, the moonlit land of D-336);
//   week     — the store shot `upgrade` (the bot plays to the first weekly board);
//   pause    — `game`, then the pause key is pressed;
//   report   — the store shot `failure` (a hub jams and the print-out opens).
// PL and EN at 320×568, 412×915, 915×412 and 768×1024 by default. Each frame is checked in the page (the screen reached,
// <html data-skin="board">, no browser error, no horizontal scroll); inspect every PNG against the CLAUDE.md forbidden
// list before committing it.
//   node scripts/shots-t6.mjs [--out=docs/shots/t6] [--scenes=menu,day] [--sizes=412x915] [--langs=pl]
// Prints one line per frame and `SUMMARY shots-t6 ...`.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, ROOT } from '../e2e/browser.mjs';

const started = performance.now();
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback).split(',');
const OUT = resolve(ROOT, opt('out', 'docs/shots/t6')[0]);
const SCENES = opt('scenes', 'menu,day,night,week,report');
const SIZES = opt('sizes', '320x568,412x915,915x412,768x1024').map((s) => s.split('x').map(Number));
const LANGS = opt('langs', 'pl,en');
const SEED = 0xA1A1;
const FIXTURE = { menu: 'menu', day: 'game', night: 'night', week: 'upgrade', pause: 'game', report: 'failure' };
const SCREEN = { menu: '.airway-menu', day: '.airway-pass', night: '.airway-pass', week: '.bw-sheet', pause: '.airway-pause',
  report: '.airway-go-overlay' };
const failures = [];
let frames = 0;

const frame = (page, n = 3) => page.evaluate((n) => new Promise((done) => {
  const step = () => (--n <= 0 ? done() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

async function scene(browser, url, name, language, width, height) {
  const target = new URL(url);
  target.searchParams.set('storeShot', FIXTURE[name]);
  target.searchParams.set('seed', String(SEED));
  if (name === 'day') target.searchParams.set('storeSunDot', '0.6');
  const { page, errors } = await newGamePage(browser, target.href, language, { width, height }, { deviceScaleFactor: 1 });
  const tag = `${name}-${language}-${width}x${height}`;
  try {
    await page.waitForFunction(() => document.documentElement.dataset.storeShotReady, null, { timeout: 900000 });
    if (name === 'pause') {
      await page.locator('.airway-pass__pause').click();
      await page.waitForSelector('.airway-pause', { state: 'visible', timeout: 10000 });
    }
    await frame(page, 8);
    await page.waitForTimeout(400);
    const problems = await page.evaluate(({ selector }) => {
      const out = [];
      const el = document.querySelector(selector);
      if (!el || !el.getClientRects().length) out.push(`${selector} not shown`);
      if (document.documentElement.dataset.skin !== 'board') out.push(`data-skin=${document.documentElement.dataset.skin}`);
      if (document.documentElement.scrollWidth > innerWidth + 0.5) out.push('horizontal scroll');
      return out;
    }, { selector: SCREEN[name] });
    if (errors.length) problems.push(`browser errors: ${errors.join('; ')}`);
    await page.screenshot({ path: resolve(OUT, `${tag}.png`), animations: 'disabled' });
    frames++;
    for (const problem of problems) failures.push(`${tag}: ${problem}`);
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
  } catch (error) {
    failures.push(`${tag}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
    console.log(`FAIL ${failures.at(-1)}`);
  } finally {
    await page.close();
  }
}

try {
  mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of LANGS) for (const [width, height] of SIZES) for (const name of SCENES) {
      await scene(browser, url, name, language, width, height);
    }
  });
} catch (error) {
  failures.push(`harness: ${error instanceof Error ? error.message : String(error)}`);
}
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots-t6 frames=${frames} out=${OUT.replace(ROOT + '/', '')} failed=${failures.length} ${((performance.now() - started) / 1000).toFixed(1)}s`);
if (failures.length || frames === 0) process.exitCode = 1;

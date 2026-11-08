// [night-46a] D-301, PLAN-LINORYT.md step U5: the flip's evidence shots — the shipped Linoryt skin over the shipped
// Linoryt globe (DEFAULT_GLOBE_LOOK), real renderer (SwiftShader, slow), on the DEV store-shot fixtures of src/main.ts
// (`?storeShot=`, seed 0xA1A1):
//   menu     — the menu as a release build shows it (`storeShot=menu`);
//   game     — the store shot `game` (week 1, evening light);
//   upgrade  — the store shot `upgrade` (the bot plays to the first weekly board);
//   pause    — `game`, then the pause target is pressed;
//   gameover — the store shot `failure` (a hub jams and the report opens).
// PL and EN at 412×915 and 915×412 by default. Each frame is checked in the page (the screen reached, no browser error,
// no horizontal scroll); inspect every PNG against the CLAUDE.md forbidden list before committing it.
//   node scripts/shots-u5.mjs [--out=docs/shots/u5] [--scenes=menu,game] [--sizes=412x915] [--langs=pl]
// Prints one line per frame and `SUMMARY shots-u5 ...`.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, ROOT } from '../e2e/browser.mjs';

const started = performance.now();
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback).split(',');
const OUT = resolve(ROOT, opt('out', 'docs/shots/u5')[0]);
const SCENES = opt('scenes', 'menu,game,upgrade,pause,gameover');
const SIZES = opt('sizes', '412x915,915x412').map((s) => s.split('x').map(Number));
const LANGS = opt('langs', 'pl,en');
const SEED = 0xA1A1;
const FIXTURE = { menu: 'menu', game: 'game', upgrade: 'upgrade', pause: 'game', gameover: 'failure' };
const SCREEN = { menu: '.airway-menu', game: '.airway-pass', upgrade: '.airway-upgrade-open', pause: '.airway-pause',
  gameover: '.airway-go-overlay' };
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
      if (document.documentElement.dataset.skin !== 'linoryt') out.push(`data-skin=${document.documentElement.dataset.skin}`);
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
console.log(`SUMMARY shots-u5 frames=${frames} out=${OUT.replace(ROOT + '/', '')} failed=${failures.length} ${((performance.now() - started) / 1000).toFixed(1)}s`);
if (failures.length || frames === 0) process.exitCode = 1;

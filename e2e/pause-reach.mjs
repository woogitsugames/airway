// [night-14b] D-259: the pause in Róża. In play the ringed pause target top right is ≥ 48 × 48, hit-testable, inside
// the safe area and clear of the week line, the day dial and the dock arc (targets and captions); paused, the sheet's
// three buttons are 48 px targets, the sheet stays inside the viewport and clear of the week line and of every dock
// target, caption and the dial (the arc stays usable while paused: undo, aircraft, globe view), and on a tall phone or
// a foldable Resume sits in the lower 60 % of the screen, nearer the thumb. 320×568 … 1000×904 and landscape phones.
// Runs on the DEV stub world (`--render=stub`, D-254; `npm run test:e2e:pause-reach:stub`): only DOM geometry is read.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, ARTIFACTS, RENDER, SEED,
} from './browser.mjs';

const started = performance.now();
const results = [];
const OUT = resolve(ARTIFACTS, 'pause-reach');
const CASES = [
  ['pl', 320, 568], ['en', 320, 568], ['pl', 360, 640], ['pl', 360, 800], ['en', 412, 915], ['pl', 673, 841],
  ['pl', 904, 1000], ['en', 1000, 904], ['pl', 915, 412], ['en', 568, 320], ['pl', 640, 360],
];

function geometry(page) {
  return page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const shown = (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    const hitOk = (el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); };
    const pause = document.querySelector('.airway-pass__pause');
    const dock = [...document.querySelectorAll('.airway-dock button, .airway-dock .roza-caption, .roza-dial')].filter(shown)
      .map((el) => ({ name: (el.getAttribute('aria-label') || el.textContent || el.className.baseVal || el.className).trim().slice(0, 16), ...rect(el) }));
    const week = document.querySelector('.roza-pass');
    const sheet = document.querySelector('.airway-pause');
    const css = getComputedStyle(document.documentElement);
    return {
      w: innerWidth, h: innerHeight, layout: document.querySelector('.airway-hud')?.dataset.layout,
      pause: pause ? { ...rect(pause), hit: hitOk(pause) } : null,
      week: week ? rect(week) : null,
      dock,
      sheet: sheet && !sheet.hidden ? rect(sheet) : null,
      buttons: sheet && !sheet.hidden ? [...sheet.querySelectorAll('button')].map((b) => ({ name: b.textContent, ...rect(b), hit: hitOk(b) })) : [],
      safe: ['top', 'right', 'bottom', 'left'].map((side) => parseFloat(css.getPropertyValue(`--aw-safe-${side}`)) || 0),
    };
  });
}
const overlap = (a, b) => a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b - .5 && b.t < a.b - .5;

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        await assertRender(page);
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await page.evaluate(() => document.fonts.ready);
        const play = await geometry(page);
        const p = play.pause;
        assert(p && p.w >= 47.5 && p.h >= 47.5, `pause target ${p ? `${p.w}×${p.h}` : 'missing'}`);
        assert(p.hit, 'pause target is covered');
        const [st, sr, sb, sl] = play.safe;
        assert(p.l >= sl - .5 && p.t >= st - .5 && p.r <= width - sr + .5 && p.b <= height - sb + .5, `pause outside the safe area ${JSON.stringify(p)}`);
        assert(!play.week || !overlap(p, play.week), 'pause overlaps the week line');
        const under = play.dock.filter((item) => overlap(p, item)).map((item) => item.name);
        assert(under.length === 0, `pause overlaps the dock: ${under.join(', ')}`);
        await page.getByRole('button', { name: /^(Pauza|Pause)$/ }).click();
        await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 3000 });
        const paused = await geometry(page);
        const s = paused.sheet;
        assert(s, 'pause sheet not shown');
        assert(s.l >= -.5 && s.t >= -.5 && s.r <= width + .5 && s.b <= height + .5, `sheet outside the viewport ${JSON.stringify(s)}`);
        assert(paused.buttons.length === 3 && paused.buttons.every((b) => b.w >= 47.5 && b.h >= 47.5 && b.hit),
          `sheet buttons ${JSON.stringify(paused.buttons.map((b) => [b.name, Math.round(b.w), Math.round(b.h), b.hit]))}`);
        assert(!paused.week || !overlap(s, paused.week), 'sheet covers the week line');
        const covered = paused.dock.filter((item) => overlap(s, item)).map((item) => item.name);
        assert(covered.length === 0, `sheet covers the dock: ${covered.join(', ')}`);
        const resume = paused.buttons[0];
        const reach = (resume.t + resume.b) / 2 / height;
        if (paused.layout !== 'landscape' && height >= 800) assert(reach >= .4, `Resume at ${Math.round(reach * 100)} % of the height`);
        await page.screenshot({ path: resolve(OUT, `pause-${language}-${width}x${height}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS', note: `${paused.layout}, Resume at ${Math.round(reach * 100)} %` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `pause-reach-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  fatal = error;
}

for (const r of results) console.log(`${r.status} ${r.label}${r.note ? `: ${r.note}` : ''}${r.why ? `: ${r.why}` : ''}`);
if (fatal) console.error(`FATAL ${fatal?.message ?? fatal}`);
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:pause-reach render=${RENDER} cases=${CASES.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
if (failed || results.length !== CASES.length) process.exitCode = 1;

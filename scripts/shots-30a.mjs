// [night-30a] PLAN-LINORYT.md step U2: shots of the Linoryt preview's airport notes, jam block and edge chips
// (`?skin=linoryt`) on the DEV store-shot fixtures (src/main.ts `?storeShot=`, seed 0xA1A1: the Levant cluster in week 1):
//   game  — the store shot `game` (week 1, evening light), as png/a-game.png;
//   night — the store shot `night`;
//   jam   — `game`, then game time runs with no new routes until a terminal overflows: the red note and jam block;
//   new   — `game`, then game time runs until an airport opens (its NOWE stub);
//   (an off-screen jam or new airport is brought into view through its edge chip, as a player would)
//   edge  — `game`, the globe turned by a drag over open sea so airports leave the screen: the printed edge chips.
// PL and EN at 360×640, 412×915, 915×412, 768×1024, and `game` at the 150 % text step too. Every frame is audited in the
// page (e2e/linoryt-notes.mjs: no note over a stamp, another note or a margin; rows inside their note; chips clear).
// The stub world (default) draws no stamps (E2 has not landed): the script prints each stamp the notes' layout used
// (`window.__awLinoryt.stamps()`) as an ink outline under the overlay, so collisions can be judged; the game never draws
// these outlines. `--render=real` uses the WebGL globe instead (SwiftShader, slow).
//   node scripts/shots-30a.mjs [--out=docs/shots/30a] [--render=real] [--scenes=game,jam] [--sizes=360x640] [--langs=pl]
// Prints one line per frame and `SUMMARY shots-30a ...`. Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, clickTestId, waitForScreen, RENDER, ROOT } from '../e2e/browser.mjs';
import { auditNotes } from '../e2e/linoryt-notes.mjs';

const started = performance.now();
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback).split(',');
const OUT = resolve(ROOT, opt('out', 'docs/shots/30a')[0]);
const SCENES = opt('scenes', 'game,night,jam,new,edge');
const SIZES = opt('sizes', '360x640,412x915,915x412,768x1024').map((s) => s.split('x').map(Number));
const LANGS = opt('langs', 'pl,en');
const SEED = 0xA1A1;
const failures = [];
let frames = 0;
let notes = 0;
let chips = 0;

/** Prints the stamps the notes' layout used as ink outlines under the overlay (a stand-in until E2 draws them). */
async function drawStamps(page) {
  await page.evaluate(() => {
    document.querySelector('.u2-stamps')?.remove();
    const layer = document.querySelector('.airport-overlay');
    if (!layer || !window.__awLinoryt) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'u2-stamps');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
    for (const s of window.__awLinoryt.stamps()) {
      if (!s.visible) continue;
      const r = s.hub ? s.half / Math.cos(Math.PI / 8) : s.half;
      const points = s.hub
        ? Array.from({ length: 8 }, (_, i) => `${s.x + r * Math.cos((i + .5) * Math.PI / 4)},${s.y + r * Math.sin((i + .5) * Math.PI / 4)}`).join(' ')
        : `${s.x - r},${s.y - r} ${s.x + r},${s.y - r} ${s.x + r},${s.y + r} ${s.x - r},${s.y + r}`;
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      shape.setAttribute('points', points);
      shape.setAttribute('fill', '#ECE3CC');
      shape.setAttribute('stroke', '#1E1C1F');
      shape.setAttribute('stroke-width', '2.5');
      svg.append(shape);
    }
    layer.parentElement.insertBefore(svg, layer);
  });
}

const frame = (page, n = 3) => page.evaluate((n) => new Promise((done) => {
  const step = () => (--n <= 0 ? done() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

async function scene(browser, url, name, language, width, height, scale) {
  const base = name === 'night' ? 'night' : 'game';
  const target = new URL(url);
  target.searchParams.set('storeShot', base);
  target.searchParams.set('seed', String(SEED));
  target.searchParams.set('skin', 'linoryt');
  if (RENDER === 'stub') { target.searchParams.set('render', 'stub'); target.searchParams.set('clock', 'frozen'); }
  const { page, errors } = await newGamePage(browser, target.href, language, { width, height }, { deviceScaleFactor: 2 });
  const tag = `${name}-${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}`;
  try {
    await page.waitForFunction(() => document.documentElement.dataset.storeShotReady, null, { timeout: RENDER === 'stub' ? 120000 : 600000 });
    if (scale !== 100) {
      await page.evaluate(async (scale) => {
        const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
        applyAccessibilitySettings({ textScale: scale, enhancedGlyphs: false, hapticsEnabled: true });
      }, scale);
    }
    if (name === 'jam' || name === 'new') {
      // Game time runs (no new routes) until a terminal overflows / an airport opens; an off-screen one is brought into
      // view through its edge chip, as a player would.
      const kind = name === 'jam' ? 'jam' : 'new';
      let found = '';
      for (let round = 0; round < 6 && found !== 'ok'; round++) {
        found = await page.evaluate(async (kind) => {
          for (let i = 0; i < 300; i++) {
            if (document.querySelector(`.airport-bubble--${kind}`)) return 'ok';
            if (window.aw.state().screen !== 'game') return window.aw.state().screen;
            await window.aw.advanceTicks(kind === 'jam' ? 10 : 20);
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          }
          return `no ${kind} airport in time`;
        }, kind);
        if (found === 'upgrade') {
          // The weekly board: take an aircraft (as e2e/edge-chip-fill.mjs) and play on.
          const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
          const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
          await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
          await waitForScreen(page, 'game');
        }
      }
      if (found !== 'ok') throw new Error(found);
      const id = await page.evaluate((kind) => document.querySelector(`.airport-bubble--${kind}`).dataset.airport, kind);
      if (await page.evaluate((id) => document.querySelector(`.airport-bubble[data-airport="${id}"]`).hidden, id)) {
        const chip = page.locator(`.airport-edge.airport-edge--${kind}`).first();
        if (await chip.count()) { await chip.click(); await page.waitForTimeout(1200); }
      }
    } else if (name === 'edge') {
      // Turn the globe: a drag over open sea below the network (an orbit gesture) moves airports off the screen.
      const from = { x: width * .5, y: height * .78 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let k = 1; k <= 12; k++) { await page.mouse.move(from.x - width * .05 * k / 12, from.y); await frame(page, 1); }
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    await frame(page, 6);
    await page.waitForTimeout(200);
    const audit = await auditNotes(page);
    const problems = [...audit.problems];
    if (audit.notes === 0) problems.push('no note shown');
    if (name === 'edge' && audit.chips === 0) problems.push('no edge chip shown');
    if (name === 'jam' && !(await page.$('.airport-bubble--jam:not([hidden]) .lin-jam'))) problems.push('no jam block');
    if (name === 'new' && !(await page.$('.airport-bubble--new:not([hidden]) .airport-bubble__new'))) problems.push('no NOWE stub');
    if (errors.length) problems.push(`browser errors: ${errors.join('; ')}`);
    notes += audit.notes;
    chips += audit.chips;
    await drawStamps(page);
    await page.screenshot({ path: resolve(OUT, `${tag}.png`), animations: 'disabled' });
    frames++;
    for (const problem of problems) failures.push(`${tag}: ${problem}`);
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${tag} notes=${audit.notes} chips=${audit.chips}${problems.length ? ': ' + problems.join(' | ') : ''}`);
  } catch (error) {
    failures.push(`${tag}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
    console.log(`FAIL ${tag}: ${failures.at(-1)}`);
  } finally {
    await page.close();
  }
}

try {
  mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of LANGS) for (const [width, height] of SIZES) for (const name of SCENES) {
      await scene(browser, url, name, language, width, height, 100);
      if (name === 'game') await scene(browser, url, name, language, width, height, 150);
    }
  });
} catch (error) {
  failures.push(`harness: ${error instanceof Error ? error.message : String(error)}`);
}
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots-30a render=${RENDER} frames=${frames} notes=${notes} chips=${chips} out=${OUT.replace(ROOT + '/', '')} failed=${failures.length} ${((performance.now() - started) / 1000).toFixed(1)}s`);
if (failures.length || frames === 0) process.exitCode = 1;

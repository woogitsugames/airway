// [night-86b] D-344 (playtest 2026-11-09, P-1 and P-2, the owner's answers):
// 1. The camera follows the network by itself: one eased pull-back when an airport opens outside the frame or a network
//    airport sits at its edge, at most once a game day, and not after the player moved the camera (wheel = a pinch).
// 2. On a portrait phone the off-screen direction signs are 48 × 48 keys (code + arrow); the first tap shows the city
//    and distance without moving the camera, the next tap turns there; a jam's sign stays full; landscape keeps the
//    full signs.
// 3. The dock's "Network" key (≥ 48 dp, PL/EN name) frames the whole network; six keys fit the dock at 320×568 with no
//    overlap or horizontal scroll.
// Seed: e2e/seeds.mjs 'edge-dock' (airports on several continents). PNGs (real renderer) go to docs/shots/86b/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, waitForBoardModels, gameUrl, assertRender,
  shotsDir, ROOT, RENDER,
} from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

const started = performance.now();
const SEED = E2E_SEEDS['edge-dock'].seeds[0];
const SHOTS = shotsDir(resolve(ROOT, 'docs/shots/86b'));
const NAME = { en: 'Show the whole network', pl: 'Pokaż całą sieć' };
const CASES = [['en', 412, 915], ['pl', 412, 915], ['pl', 915, 412], ['en', 915, 412], ['pl', 320, 568], ['en', 320, 568]];
const results = [];

const camera = (page) => page.evaluate(() => window.aw.state().camera);
const autoDays = (page) => page.evaluate(() =>
  ([...document.querySelectorAll('canvas')].map((node) => node.dataset.autoFrameDays ?? '').join('')).split(',').filter(Boolean).map(Number));

async function edges(page) {
  return page.evaluate(() => [...document.querySelectorAll('.airport-edge')].filter((node) => !node.hidden && node.offsetParent !== null)
    .map((node) => {
      const r = node.getBoundingClientRect();
      return { code: node.dataset.bdCode, x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height,
        compact: node.classList.contains('bd-edge--compact'), jam: node.classList.contains('airport-edge--jam'),
        line: node.dataset.bdLine ?? '', aria: node.getAttribute('aria-label') ?? '' };
    }));
}

async function start(page, width, height) {
  await assertRender(page);
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  // The player's own camera move holds the automatic framing off: a zoom, then a whole game day, nothing moves.
  await zoomIn(page, 3);
  const before = await camera(page);
  await page.evaluate(() => window.aw.advanceTicks(1440));
  await page.waitForTimeout(600);
  const after = await camera(page);
  assert((await page.evaluate(() => window.aw.state().screen)) === 'game', 'the run ended on day 1');
  assert((await autoDays(page)).length === 0, 'the camera moved by itself right after the player zoomed');
  assert(Math.abs(after.zoom - before.zoom) < 1e-6, `zoom changed ${before.zoom} → ${after.zoom}`);
  const board = await page.evaluate(() => window.aw.autoplay(1));
  assert(board.screen === 'upgrade', `week-1 board not reached (${board.screen})`);
  await waitForBoardModels(page);
  const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
  const index = offers.findIndex((kind) => kind === 'turboprop' || kind === 'widebody');
  await clickTestId(page, `upgrade-option-${Math.max(0, index)}`);
  if (await page.locator('[data-testid="upgrade-take"]').count()) await clickTestId(page, 'upgrade-take');
  await waitForScreen(page, 'game');
  // A week went by and airports opened beyond the opening frame: the camera has followed the network by itself, at
  // most once a game day, never on the opening day (framed already).
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((node) => node.dataset.autoFrameDays), null, { timeout: 25000 })
    .catch(() => undefined);
  await page.waitForTimeout(RENDER === 'stub' ? 400 : 1600);
  const days = await autoDays(page);
  assert(days.length >= 1, 'the camera never followed the network in week 1');
  assert(new Set(days).size === days.length, `more than one automatic framing on a day: ${days.join(',')}`);
  assert(days.every((day) => day >= 1), `framed on day ${days.join(',')} (the opening day is framed already)`);
  await shot(page, `${await page.evaluate(() => document.documentElement.lang)}-${width}x${height}-followed`);
  return { days, width, height };
}

async function zoomIn(page, steps) {
  const view = page.viewportSize();
  await page.mouse.move(view.width / 2, view.height / 2);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -150); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
}

async function journey(page, language, width, height) {
  const portrait = width < height;
  await start(page, width, height);
  // ---- the dock: six keys, the Network key ≥ 48 dp with its PL/EN name, nothing overlaps, no horizontal scroll ----
  const dock = await page.evaluate(() => ({
    tags: [...document.querySelectorAll('.airway-dock__tag')].map((node) => {
      const r = node.getBoundingClientRect();
      return { action: node.dataset.hudAction, l: r.left, t: r.top, r: r.right, b: r.bottom, aria: node.getAttribute('aria-label') };
    }),
    scroll: document.documentElement.scrollWidth - window.innerWidth,
  }));
  assert(dock.tags.map((tag) => tag.action).join(',') === 'undo,turboprop,widebody,hub,network,speed', `dock order ${dock.tags.map((t) => t.action)}`);
  assert(dock.scroll <= 0, `horizontal scroll ${dock.scroll}px`);
  for (const tag of dock.tags) {
    assert(tag.r - tag.l >= 48 && tag.b - tag.t >= 48, `${tag.action} ${Math.round(tag.r - tag.l)}×${Math.round(tag.b - tag.t)} < 48`);
    assert(tag.l >= 0 && tag.r <= width + 0.5 && tag.b <= height + 0.5, `${tag.action} off screen`);
  }
  for (const a of dock.tags) for (const b of dock.tags) {
    if (a !== b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) throw new Error(`${a.action} overlaps ${b.action}`);
  }
  const network = dock.tags.find((tag) => tag.action === 'network');
  assert(network.aria === NAME[language], `Network key named "${network.aria}"`);

  await zoomIn(page, 6); // airports off the screen: the direction signs

  // ---- P-2: direction signs ----
  let signs = await edges(page);
  assert(signs.length >= 1 && signs.length <= 4, `${signs.length} direction signs (1–4 expected)`);
  for (const sign of signs) {
    if (portrait && !sign.jam) {
      assert(sign.compact && Math.round(sign.width) === 48 && Math.round(sign.height) === 48, `${sign.code} ${sign.width}×${sign.height} not a 48 × 48 key`);
      assert(sign.line === '', `${sign.code} prints "${sign.line}" on the compact key`);
    } else assert(!sign.compact && sign.line !== '' && sign.width > 48, `${sign.code} not full (${sign.width} px, "${sign.line}")`);
  }
  await shot(page, `${language}-${width}x${height}-signs`);
  if (portrait) {
    const sign = signs.find((item) => item.compact);
    assert(sign, 'no compact sign to tap');
    const cam0 = await camera(page);
    await page.mouse.click(sign.x, sign.y);
    await page.waitForTimeout(300);
    const open = (await edges(page)).find((item) => item.code === sign.code);
    assert(open && !open.compact && open.line.length > 0 && open.width > 48, `${sign.code} did not open on tap`);
    const cam1 = await camera(page);
    assert(Math.abs(cam1.longitude - cam0.longitude) < 1e-6, 'the first tap moved the camera');
    await shot(page, `${language}-${width}x${height}-sign-open`);
    const r = await page.evaluate((code) => {
      const node = [...document.querySelectorAll('.airport-edge')].find((item) => item.dataset.bdCode === code && !item.hidden);
      const box = node?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
    }, sign.code);
    assert(r, `${sign.code} sign gone before the second tap`);
    await page.mouse.click(r.x, r.y);
    await page.waitForTimeout(400);
    const cam2 = await camera(page);
    assert(Math.abs(cam2.longitude - cam1.longitude) > 0.5 || Math.abs(cam2.latitude - cam1.latitude) > 0.5, 'the second tap did not turn the globe');
  }

  // ---- the Network key frames the whole network ----
  await zoomIn(page, 4);
  const zoomed = await camera(page);
  const offBefore = (await edges(page)).length;
  await page.locator('.airway-dock__tag[data-hud-action="network"]').click();
  await page.waitForTimeout(RENDER === 'stub' ? 400 : 1500);
  const framed = await camera(page);
  assert(framed.zoom < zoomed.zoom - 0.05, `Network did not pull back (zoom ${zoomed.zoom} → ${framed.zoom})`);
  assert(framed.zoom <= 3 + 1e-6, `Network framed closer than the play zoom (${framed.zoom})`);
  const offAfter = (await edges(page)).length;
  assert(offAfter <= offBefore, `more off-screen signs after Network (${offBefore} → ${offAfter})`);
  await shot(page, `${language}-${width}x${height}-network`);
}

async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
}

/** A gentle move: with motion on (no "Reduce motion"), the Network key eases (a middle frame lies between). */
async function easing(page) {
  await start(page, 412, 915);
  await zoomIn(page, 6);
  const from = await camera(page);
  await page.locator('.airway-dock__tag[data-hud-action="network"]').click();
  const samples = [];
  for (let i = 0; i < 40; i++) { samples.push((await camera(page)).zoom); await page.waitForTimeout(50); }
  const to = samples.at(-1);
  assert(to < from.zoom - 0.05, `no pull-back (${from.zoom} → ${to})`);
  const between = samples.filter((zoom) => zoom < from.zoom - 0.01 && zoom > to + 0.01);
  assert(between.length >= 2, `a cut, not an eased move (${samples.map((z) => z.toFixed(2)).join(' ')})`);
  for (let i = 1; i < samples.length; i++) assert(samples[i] <= samples[i - 1] + 1e-6, 'the zoom went back and forth');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    const all = [...CASES.map((c) => ({ kind: 'journey', c })), { kind: 'easing', c: ['en', 412, 915] }];
    for (const { kind, c: [language, width, height] } of all) {
      const label = `${kind} ${language} ${width}x${height}`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height },
          kind === 'easing' ? { reducedMotion: 'no-preference' } : {}));
        if (kind === 'journey') await journey(page, language, width, height); else await easing(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shotPath = page ? await saveDiagnostics(page, 'camera-network-' + (results.length + 1)) : null;
        results.push({ label, status: 'FAIL', why: message(error) + (shotPath ? ` (screenshot ${shotPath})` : '') });
      } finally {
        if (page) await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { label, status, why } of results) {
    const line = `${status} ${label}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  const expected = CASES.length + 1;
  console.log(`SUMMARY test:e2e:camera-network seed=0x${SEED.toString(16).toUpperCase()} render=${RENDER} steps=${expected} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== expected) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

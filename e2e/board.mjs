// [night-69a] D-324 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T1): the UI-A preview (`?skin=board`) on the
// real session (on the stub world with --render=stub, D-254). Plays a short seeded run with the DEV bot so the HUD shows
// a real afternoon (routes, aircraft used up), then audits the in-game HUD at phone, landscape, foldable and tablet sizes,
// PL and EN, at 100 % and at the 150 % text step, plus two notch profiles (the `--aw-safe-*` tokens, as e2e/notch.mjs):
//   - the preview is on: <html data-skin="board">, Archivo loaded, the split-flap board instead of the Linoryt margin;
//   - the board: clock, week, day and passengers on flap tiles that match its one spoken label (role="img"), the flaps
//     aria-hidden; every cell inside the board (no row overflow), 24 hour cells with the 10 night hours (20–06) drawn
//     lower than the day hours, the "now" mark inside the bar; the pause key beside the board, not over it;
//   - the console: pause + five keys, each ≥ 48 × 48 CSS px inside the safe rectangle and apart from each other and the
//     top band; the shape says the kind (Undo a round key, the aircraft enamel plates with a dashed / solid route line,
//     Hub an octagon, Speed a rotary selector); each caption inside its key and unclipped; no yellow anywhere in the HUD
//     (yellow is "where to / what next" only, spec §2); choosing an aircraft turns its plate cream with the lamp lit;
//   - no horizontal overflow, no page error.
// `--shots` writes PL/EN 412×915, 915×412 and 320×568 (plus a 150 % and a chosen-plate frame) to docs/shots/t1/;
// otherwise PNGs go to .e2e/board/. Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender, RENDER } from './browser.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
const OUT = SHOTS ? resolve(ROOT, 'docs/shots/t1') : resolve(ARTIFACTS, 'board');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = SHOTS
  ? [[412, 915, 100], [915, 412, 100], [320, 568, 100], [412, 915, 150]]
  : [[320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [768, 1024, 100], [1032, 1376, 100],
    [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150], [915, 412, 150]];
// `--size=412x915` (repeatable) runs only those sizes.
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const failures = [];
const failedScreens = new Set();
let checked = 0;
let shots = 0;

function boardUrl(url) {
  const target = new URL(gameUrl(url));
  target.searchParams.set('skin', 'board');
  return target.href;
}

async function audit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const root = document.documentElement;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = probe.getBoundingClientRect();
    probe.remove();
    if (root.dataset.skin !== 'board') problems.push(`data-skin=${root.dataset.skin}`);
    const archivo = [...document.fonts].filter((face) => face.family.replace(/['"]/g, '') === 'Archivo' && face.status === 'loaded');
    if (archivo.length < 2) problems.push(`Archivo faces loaded: ${archivo.length}`);
    if (root.scrollWidth > innerWidth + 1) problems.push(`horizontal overflow ${root.scrollWidth} > ${innerWidth}`);
    if (document.querySelector('.lin-pass')) problems.push('the Linoryt margin is drawn too');
    const box = (el) => el.getBoundingClientRect();
    const shown = (el) => { const r = box(el); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    const inside = (a, b, slack = 1) => a.left >= b.left - slack && a.right <= b.right + slack && a.top >= b.top - slack && a.bottom <= b.bottom + slack;
    const name = (el) => el.dataset.hudAction || el.className.split(' ')[0];
    // The board.
    const board = document.querySelector('.bd-board');
    if (!board) return [...problems, 'board missing'];
    const flaps = (cell) => [...board.querySelectorAll(`.bd-cell--${cell} .split-flap`)].map((f) => f.dataset.value).join('');
    const clock = flaps('clock');
    const week = flaps('week');
    const day = flaps('day');
    const pax = flaps('passengers');
    if (!/^\d\d:\d\d$/.test(clock)) problems.push(`clock "${clock}"`);
    if (!/^\d{1,3}$/.test(week)) problems.push(`week "${week}"`);
    if (!/^\d\/\d$/.test(day)) problems.push(`day "${day}"`);
    if (!/^\d{3,5}$/.test(pax)) problems.push(`passengers "${pax}"`);
    const label = board.getAttribute('aria-label') ?? '';
    if (board.getAttribute('role') !== 'img' || !label.startsWith(clock + ',') || !label.includes(week)) problems.push(`board label "${label}" (clock ${clock})`);
    if (board.querySelector('.bd-row')?.getAttribute('aria-hidden') !== 'true') problems.push('flaps not aria-hidden');
    const row = board.querySelector('.bd-row');
    if (row && row.scrollWidth > row.clientWidth + 1) problems.push(`board row overflows ${row.scrollWidth} > ${row.clientWidth}`);
    const inner = box(board);
    for (const cell of board.querySelectorAll('.bd-cell, .bd-label')) if (!inside(box(cell), inner)) problems.push(`${cell.className} outside the board`);
    for (const lab of board.querySelectorAll('.bd-label')) if (lab.scrollWidth > lab.clientWidth + 1) problems.push(`label "${lab.textContent}" clipped`);
    const hours = [...board.querySelectorAll('.bd-hours i')];
    if (hours.length !== 24) problems.push(`hour bar ${hours.length} cells`);
    const night = hours.filter((cell) => cell.classList.contains('is-night'));
    if (night.length !== 10) problems.push(`night hours ${night.length}`);
    if (night.some((cell) => box(cell).height >= box(hours[12]).height - .5)) problems.push('night hours not lower than day hours');
    if (hours.some((cell) => box(cell).width < 4)) problems.push('an hour cell narrower than 4 px');
    const now = board.querySelector('.bd-hours__now');
    const bar = board.querySelector('.bd-hours');
    if (!now || !bar || box(now).left < box(bar).left - 2 || box(now).right > box(bar).right + 2) problems.push('"now" mark outside the bar');
    // The console.
    const buttons = [...document.querySelectorAll('.airway-hud button')].filter(shown);
    if (buttons.length !== 6) problems.push(`HUD buttons ${buttons.length}`);
    for (const el of buttons) {
      const r = box(el);
      if (r.width < 47.5 || r.height < 47.5) problems.push(`${name(el)} ${r.width.toFixed(1)}×${r.height.toFixed(1)} < 48`);
      if (!inside(r, safe, .5)) problems.push(`${name(el)} outside the safe rectangle (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    const pause = document.querySelector('.airway-pass__pause');
    if (pause && meet(box(pause), inner)) problems.push('pause key over the board');
    const pass = document.querySelector('.airway-pass');
    const keys = [...document.querySelectorAll('.airway-dock__tag')];
    const shape = { undo: 'round', turboprop: 'plate', widebody: 'plate', hub: 'oct', speed: 'rotary' };
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      for (let j = i + 1; j < keys.length; j++) if (meet(box(key), box(keys[j]))) problems.push(`${name(key)} meets ${name(keys[j])}`);
      if (pass && meet(box(key), box(pass))) problems.push(`${name(key)} meets the top band`);
      const want = shape[key.dataset.hudAction];
      if (!key.querySelector(`.bd-face--${want}`)) problems.push(`${name(key)} without its ${want} face`);
      const caption = [...key.querySelectorAll('.bd-eng > span')].find(shown);
      if (!caption || !caption.textContent) problems.push(`${name(key)} without caption`);
      else if (!inside(box(caption), box(key), 1)) problems.push(`${name(key)} caption outside its key (${box(caption).width.toFixed(1)} in ${box(key).width.toFixed(1)})`);
      const wait = key.querySelector('.bd-wait');
      if (wait && !wait.hidden && !inside(box(wait), { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) problems.push(`${name(key)} wait tag off screen`);
    }
    const dash = (tag) => document.querySelector(`[data-hud-action="${tag}"] .bd-line path`)?.getAttribute('stroke-dasharray');
    if (!dash('turboprop') || dash('widebody')) problems.push(`route lines: turboprop ${dash('turboprop')}, widebody ${dash('widebody')}`);
    const round = document.querySelector('[data-hud-action="undo"] .bd-face--round');
    if (round && getComputedStyle(round).borderRadius !== '50%') problems.push(`undo key radius ${getComputedStyle(round).borderRadius}`);
    // Yellow is "where to / what next" only: never on the board or the console.
    const yellow = [...document.querySelectorAll('.airway-hud, .airway-hud *')].filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.fill, s.stroke, s.borderTopColor].includes('rgb(243, 195, 23)');
    });
    if (yellow.length) problems.push(`yellow in the HUD: ${yellow.slice(0, 3).map(name).join(', ')}`);
    return problems;
  });
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height, scale, profile] of cases) {
        const tag = `${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}${profile ? '-' + profile : ''}`;
        let page;
        try {
          const opened = await newGamePage(browser, boardUrl(url), language, { width, height }, { textScale: scale !== 100 ? scale : undefined });
          page = opened.page;
          await assertRender(page);
          const sides = width > height
            ? { top: 0, bottom: 21, left: notch.side, right: notch.side }
            : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
          if (profile === 'notch') {
            await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;` +
              `--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
          }
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
          await clickTestId(page, 'menu-endless');
          await waitForScreen(page, 'game');
          // At the start of the run the aircraft are in stock: choose one and check the plate (then put it back).
          const early = [];
          await page.evaluate(() => window.aw.botStep?.());
          await page.evaluate(() => window.aw.advanceTicks(30));
          // Choosing an aircraft turns its plate over (cream, lamp lit), never yellow.
          const plate = await page.evaluate(() => {
            const pick = ['turboprop', 'widebody'].map((t) => document.querySelector(`[data-hud-action="${t}"]`)).find((b) => b && !b.disabled);
            if (!pick) return null;
            pick.click();
            return pick.dataset.hudAction;
          });
          if (!plate) early.push('no aircraft in stock to choose at the start of the run');
          else {
            await page.waitForTimeout(200);
            const chosen = await page.evaluate((plate) => {
              const key = document.querySelector(`[data-hud-action="${plate}"]`);
              const face = key?.querySelector('.bd-face--plate');
              const lamp = key?.querySelector('.bd-lamp');
              return { selected: key?.classList.contains('is-selected'), pressed: key?.getAttribute('aria-pressed'),
                bg: face && getComputedStyle(face).backgroundColor, lamp: lamp && getComputedStyle(lamp).backgroundColor };
            }, plate);
            if (!chosen.selected || chosen.pressed !== 'true') early.push(`chosen ${plate}: ${JSON.stringify(chosen)}`);
            if (chosen.bg !== 'rgb(239, 231, 211)' || chosen.lamp !== 'rgb(255, 241, 201)') early.push(`chosen plate face ${chosen.bg}, lamp ${chosen.lamp}`);
            if (SHOTS && width === 412 && scale === 100) {
              await page.screenshot({ path: resolve(OUT, `game-${tag}-chosen.png`), animations: 'disabled' });
              shots++;
            }
            await page.evaluate((plate) => document.querySelector(`[data-hud-action="${plate}"]`)?.click(), plate);
            await page.waitForTimeout(100);
          }
          // A short real run: the bot draws routes and assigns aircraft, time reaches the afternoon of day 2.
          for (let i = 0; i < 31; i++) {
            await page.evaluate(() => window.aw.botStep?.());
            await page.evaluate(() => window.aw.advanceTicks(80));
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          const problems = [...early, ...await audit(page)];
          if (opened.errors.length) problems.push(`browser errors: ${opened.errors.splice(0).join('; ')}`);
          checked++;
          for (const problem of problems) failures.push(`${tag}: ${problem}`);
          if (problems.length) failedScreens.add(tag);
          await page.screenshot({ path: resolve(OUT, `game-${tag}.png`), animations: 'disabled' });
          shots++;
          console.log(`${problems.length ? 'FAIL' : 'PASS'} game ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
        } catch (error) {
          failures.push(`${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
          failedScreens.add(tag);
          console.log(`FAIL game ${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
        } finally {
          await page?.close();
        }
      }
    }
  });
} catch (error) {
  failures.push(`harness: ${String(error?.message ?? error).split('\n')[0]}`);
}
const expected = cases.length * 2;
console.log(`SUMMARY test:e2e:board render=${RENDER} seed=0x${SEED.toString(16).toUpperCase()} screens=${checked}/${expected} ` +
  `shots=${shots} passed=${expected - failedScreens.size} failed=${failedScreens.size} problems=${failures.length} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failures.length || checked !== expected) process.exitCode = 1;

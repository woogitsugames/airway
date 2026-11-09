// [night-77a] D-332 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T5): the UI-A preview (`?skin=board`) of the
// menu, the sheets and the pages, on the stub world with --render=stub (D-254). For each language and size it opens, in
// one session: the menu, Settings, Licences, Privacy, the logbook, the puzzle board, the training flight (first Endless
// on a clean profile, then skipped), the pause sheet and the game-over report, plus the no-WebGL page on its own page.
// Every screen: <html data-skin="board">, no horizontal overflow, every visible control ≥ 48 × 48 CSS px inside the
// viewport, no page error, at most one yellow element (yellow = "where to / what next", spec §2).
//   - menu: the title AIRWAY on flap tiles (aria-hidden) with the app title as the heading's name; the board
//     "ODLOTY · WYBIERZ" with the date and its rows Today, Puzzles, Logbook, Settings in that order; the run-starting row
//     (Endless) is the one yellow sign, in the lower third (thumb reach), under the board; its home-region choice stays
//     reachable; the globe frame [data-globe-frame] is there for R4; [night-80a] D-335: at 100 % the frame is ≥ 160 px
//     on 360×640 and ≥ 110 px on 320×568 (a disc, not a horizon), and in landscape the Endless choices stand in the
//     board's column (640×360: under the title, above the frame), never over the globe's frame;
//   - pause: the console sheet, Resume the yellow sign, the summary on strip paper;
//   - report: the print-out on paper with the head, the closed hub, the queue glyphs (one per waiting passenger, up to
//     the per-direction cap), the figures, the weeks table once loaded, the stamp field with "ZATOR"/"JAM" and the hub
//     code, apart from every text line of the print; Menu, Map and Same world enamel keys, "Jeszcze raz" the yellow sign;
//     nothing of the print under the action bar;
//   - pages: the heading's back key and every row control ≥ 48 px; page ground enamel, lists on strip paper.
// `--shots` writes PL/EN 412×915, 915×412 and 320×568 (and the report scrolled to its foot) to docs/shots/t5/ on the real
// renderer; otherwise PNGs go to .e2e/board-sheets/. Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
const OUT = SHOTS ? resolve(ROOT, 'docs/shots/t5') : resolve(ARTIFACTS, 'board-sheets');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = SHOTS
  ? [[412, 915, 100], [915, 412, 100], [320, 568, 100]]
  : [[320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [768, 1024, 100],
    [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150], [915, 412, 150]];
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const langs = process.argv.includes('--pl') ? ['pl'] : process.argv.includes('--en') ? ['en'] : ['pl', 'en'];
const failures = [];
let checked = 0;
let shots = 0;

function boardUrl(url) {
  const target = new URL(gameUrl(url));
  target.searchParams.set('skin', 'board');
  return target.href;
}

/** Checks every screen shares: the preview, no overflow, targets, the yellow budget. */
async function common(page, name) {
  return await page.evaluate((screen) => {
    const problems = [];
    const root = document.documentElement;
    if (root.dataset.skin !== 'board') problems.push(`data-skin=${root.dataset.skin}`);
    if (root.scrollWidth > innerWidth + 1) problems.push(`horizontal overflow ${root.scrollWidth} > ${innerWidth}`);
    const shown = (el) => {
      if (el.closest('[hidden], [aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const scope = screen === 'game' || screen === 'pause' || screen === 'report' ? document.querySelector(screen === 'pause' ? '.airway-pause' : '.airway-go-overlay')
      : screen === 'tutorial' ? document.querySelector('[data-testid="tutorial"]') : document.body;
    const targets = [...(scope ?? document.body).querySelectorAll('button, select, a[href], label.airway-setting__switch')].filter(shown);
    for (const el of targets) {
      if (el.closest('.airway-hud, .airway-dock, .airport-overlay')) continue;
      // A control inside a scrolling column only counts where it is on screen.
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      if (r.width < 47.5 || r.height < 47.5) problems.push(`target ${el.dataset.testid || el.className || el.tagName} ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
      if (r.left < -0.5 || r.right > innerWidth + 0.5) problems.push(`target ${el.dataset.testid || el.className} off screen sideways`);
    }
    const yellow = [...document.querySelectorAll('body *')].filter((el) => shown(el) && getComputedStyle(el).backgroundColor === 'rgb(243, 195, 23)');
    const top = yellow.filter((el) => !yellow.some((other) => other !== el && other.contains(el)));
    // Over the game (pause) the map keeps its own "where to" signs: one yellow in the sheet, at most three on screen (spec §2).
    const sheet = screen === 'pause' ? document.querySelector('.airway-pause') : null;
    if (sheet) {
      const inSheet = top.filter((el) => sheet.contains(el));
      if (inSheet.length !== 1) problems.push(`${inSheet.length} yellow elements in the pause sheet`);
      if (top.length > 3) problems.push(`${top.length} yellow elements on the paused game`);
    } else if (top.length > 1) problems.push(`${top.length} yellow elements: ${top.map((el) => el.dataset.testid || el.className).join(', ')}`);
    return problems;
  }, name);
}

async function menuAudit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const menu = document.querySelector('.airway-menu.bd-menu');
    if (!menu) return ['the menu is not the board (no .bd-menu)'];
    const title = menu.querySelector('.bd-menu__title');
    const letters = [...(title?.querySelectorAll('.bd-tile') ?? [])].map((tile) => tile.textContent).join('');
    if (letters !== 'AIRWAY') problems.push(`title tiles "${letters}"`);
    if (title?.getAttribute('aria-label') !== 'Airway') problems.push('title has no spoken name');
    if (!title?.querySelector('.bd-tiles')?.getAttribute('aria-hidden')) problems.push('title tiles not aria-hidden');
    const face = getComputedStyle(title.querySelector('.bd-tile')).fontFamily;
    if (!/Archivo/.test(face)) problems.push(`title face ${face}`);
    if (!menu.querySelector('[data-globe-frame="menu"]')) problems.push('no globe frame for R4');
    const rows = [...menu.querySelectorAll('.airway-board > .bd-row')].map((b) => b.dataset.mode);
    if (rows.join(',') !== 'daily,puzzles,logbook,settings') problems.push(`board rows ${rows.join(',')}`);
    const head = menu.querySelector('.bd-list__head');
    if (!head || !/\d\d\.\d\d/.test(head.textContent)) problems.push('board head without the date');
    const go = menu.querySelector('.bd-menu__go [data-testid="menu-endless"]');
    if (!go) return [...problems, 'Endless is not the main sign'];
    const r = go.getBoundingClientRect();
    if (getComputedStyle(go).backgroundColor !== 'rgb(243, 195, 23)') problems.push(`main sign ${getComputedStyle(go).backgroundColor}`);
    if (r.bottom > innerHeight + 0.5 || r.top < innerHeight * 0.45 && innerHeight > innerWidth) problems.push(`main sign out of thumb reach (top ${r.top.toFixed(0)} of ${innerHeight})`);
    const board = menu.querySelector('.airway-board').getBoundingClientRect();
    if (innerHeight > innerWidth && r.top < board.bottom - 0.5) problems.push('main sign not under the board');
    for (const row of menu.querySelectorAll('.airway-board > .bd-row')) {
      const box = row.getBoundingClientRect();
      const item = row.querySelector('.bd-item');
      if (!item || item.getAttribute('aria-hidden') !== 'true') problems.push(`row ${row.dataset.mode} drawing not aria-hidden`);
      for (const part of row.querySelectorAll('.bd-item__title, .bd-item__sub, .bd-item__end')) {
        const p = part.getBoundingClientRect();
        if (p.width && (p.left < box.left - 0.5 || p.right > box.right + 0.5)) problems.push(`row ${row.dataset.mode}: ${part.className} spills`);
        if (part.scrollWidth > part.clientWidth + 1 && part.tagName !== 'svg') problems.push(`row ${row.dataset.mode}: ${part.className} clipped`);
      }
    }
    const region = menu.querySelector('[data-testid="menu-home-region"]');
    if (region) {
      const rr = region.getBoundingClientRect();
      if (rr.height < 47.5 || rr.bottom > innerHeight || rr.top < 0) problems.push('home-region choice not reachable');
    }
    // [night-80a] D-335: the globe keeps a disc on short phones (R4 showed only a horizon in a 41–52 px frame) and, in
    // landscape, the Endless choices stay off the globe's frame (the board's column; on 640×360 above the frame).
    const frame = menu.querySelector('[data-globe-frame="menu"]').getBoundingClientRect();
    const scale = document.documentElement.dataset.airwayTextScale ?? '100';
    const portrait = innerHeight > innerWidth;
    const minFrame = scale !== '100' || !portrait ? 0 : innerWidth <= 330 ? 110 : innerHeight <= 700 ? 160 : 0;
    if (frame.height < minFrame) problems.push(`globe frame ${frame.height.toFixed(0)} px < ${minFrame}`);
    const options = menu.querySelector('.bd-menu__options');
    if (options && innerWidth > innerHeight) {
      const o = options.getBoundingClientRect();
      // R4 lets the disc run behind the bottom edge in landscape, so the frame's column counts down to the screen's foot.
      const meets = o.left < frame.right - 0.5 && frame.left < o.right - 0.5 && o.top < innerHeight - 0.5 && frame.top < o.bottom - 0.5;
      if (o.width && meets) problems.push(`Endless choices over the globe frame (${o.left.toFixed(0)},${o.top.toFixed(0)})`);
    }
    return problems;
  });
}

async function pauseAudit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const sheet = document.querySelector('.airway-pause');
    if (!sheet || sheet.hidden) return ['no pause sheet'];
    const r = sheet.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5) problems.push('pause sheet off screen');
    const resume = sheet.querySelector('[data-testid="action-resume"]');
    if (getComputedStyle(resume).backgroundColor !== 'rgb(243, 195, 23)') problems.push('Resume is not the yellow sign');
    if (getComputedStyle(sheet).backgroundColor !== 'rgb(42, 46, 43)') problems.push(`pause on ${getComputedStyle(sheet).backgroundColor}`);
    const summary = sheet.querySelector('[data-testid="pause-summary"]');
    if (summary && getComputedStyle(summary).display !== 'none' && getComputedStyle(summary).backgroundColor !== 'rgb(237, 227, 200)') problems.push('summary not on strip paper');
    const dock = document.querySelector('.airway-dock')?.getBoundingClientRect();
    const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    if (dock && meet(r, dock)) problems.push('pause sheet over the console');
    return problems;
  });
}

async function reportAudit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const print = document.querySelector('[data-testid="board-print"]');
    if (!print) return ['no print-out'];
    if (getComputedStyle(print.querySelector('.bd-print__roll')).backgroundColor !== 'rgb(237, 227, 200)') problems.push('the roll is not paper');
    const mono = getComputedStyle(print.querySelector('.bd-print__line')).fontFamily;
    if (!/Chivo Mono/.test(mono)) problems.push(`print face ${mono}`);
    const hub = print.querySelector('[data-testid="board-report-hub"]');
    if (!hub || !/\b[A-Z]{3}\b/.test(hub.textContent)) problems.push('closed hub line without a code');
    const code = hub?.querySelector('.bd-print__strong')?.textContent.match(/\b[A-Z]{3}\b/)?.[0];
    const stamp = print.querySelector('[data-testid="board-report-stamp"] .bd-stamp');
    if (!stamp) problems.push('no stamp');
    else {
      if (!/ZATOR|JAM/.test(stamp.textContent.toUpperCase()) || (code && !stamp.textContent.includes(code))) problems.push(`stamp "${stamp.textContent}"`);
      if (getComputedStyle(stamp).transform !== 'none') problems.push('the stamp is turned (it stands upright)');
      const s = stamp.getBoundingClientRect();
      const meet = (a, b) => a.left < b.right + 7.5 && b.left < a.right + 7.5 && a.top < b.bottom + 7.5 && b.top < a.bottom + 7.5;
      for (const line of print.querySelectorAll('p, dt, dd, td, th, h1, h3, li')) {
        if (line.closest('.bd-stamp-field')) continue;
        const b = line.getBoundingClientRect();
        if (b.width && b.height && meet(s, b)) { problems.push(`stamp within 8 px of "${line.textContent.slice(0, 24)}"`); break; }
      }
    }
    const glyphs = print.querySelectorAll('[data-testid="board-report-queue"] svg').length;
    if (!glyphs) problems.push('no queue glyphs');
    const weeks = print.querySelector('[data-testid="board-report-weeks"]');
    if (weeks && !weeks.hidden && weeks.dataset.state !== 'ready') problems.push(`weeks table ${weeks.dataset.state}`);
    if (weeks?.dataset.state === 'ready' && !weeks.querySelector('tbody tr:last-child')?.textContent.match(/ZATOR|JAM|Zator|Jam/)) problems.push('the last week does not carry the jam');
    for (const row of print.querySelectorAll('.bd-print__figure')) {
      const label = row.querySelector('dt').getBoundingClientRect();
      const value = row.querySelector('dd').getBoundingClientRect();
      if (label.right > value.left + 0.5 && label.bottom > value.top + 0.5) problems.push(`figure "${row.textContent}" label runs into its value`);
    }
    const next = document.querySelector('[data-testid="gameover-new"]');
    if (getComputedStyle(next).backgroundColor !== 'rgb(243, 195, 23)') problems.push('"Jeszcze raz" is not the yellow sign');
    for (const id of ['gameover-menu', 'gameover-map', 'gameover-same', 'gameover-new']) {
      const b = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      if (!b || b.bottom > innerHeight + 0.5 || b.top < 0) problems.push(`${id} not on screen`);
    }
    const actions = document.querySelector('.airway-go-actions').getBoundingClientRect();
    const roll = print.getBoundingClientRect();
    const overlap = roll.left < actions.right - .5 && actions.left < roll.right - .5 && roll.top < actions.bottom - .5 && actions.top < roll.bottom - .5;
    if (overlap) problems.push('the print runs under the action bar');
    if (print.scrollWidth > print.clientWidth + 1) problems.push('the print scrolls sideways');
    return problems;
  });
}

async function pageAudit(page, selector) {
  return await page.evaluate((sel) => {
    const problems = [];
    const pageEl = document.querySelector(sel);
    if (!pageEl) return [`no ${sel}`];
    const back = pageEl.querySelector('.airway-settings__back, .puzzle-exit');
    if (back) {
      const r = back.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) problems.push(`back ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
    }
    const h1 = pageEl.querySelector('h1');
    if (h1 && h1.scrollWidth > h1.clientWidth + 1) problems.push('heading clipped');
    const bg = getComputedStyle(pageEl).backgroundColor;
    if (sel !== '.puzzle-board' && bg !== 'rgb(14, 15, 15)') problems.push(`page ground ${bg}`);
    return problems;
  }, selector);
}

/** A weekly board in the way: take the first crate that needs no airport pick. */
async function answerBoard(page) {
  if (await page.evaluate(() => window.aw.state().screen) !== 'upgrade') return;
  await page.evaluate(() => document.querySelector('[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')?.click());
  await page.waitForTimeout(100);
}

/** The bot plays on (answering weekly boards) until the run ends on a jam; false when it has not within the budget. */
async function playToJam(page) {
  for (let i = 0; i < 1500; i++) {
    const screen = await page.evaluate(() => window.aw.state().screen);
    if (screen === 'gameover') return true;
    if (screen === 'upgrade') { await answerBoard(page); continue; }
    if (screen !== 'game') return false;
    if (i % 6 === 0) await page.evaluate(() => window.aw.botStep?.());
    await page.evaluate(() => window.aw.advanceTicks(60));
  }
  return false;
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`), animations: 'disabled' });
  shots++;
}

async function back(page) {
  await page.locator('.airway-settings__back:visible').first().click();
  await page.waitForTimeout(80);
}

async function run(browser, url, language, [width, height, scale, profile]) {
  const tag = `${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}${profile ? '-' + profile : ''}`;
  const { page, errors } = await newGamePage(browser, boardUrl(url), language, { width, height }, { textScale: scale !== 100 ? scale : undefined });
  const record = (screen, problems) => {
    checked++;
    for (const problem of problems) failures.push(`${tag} ${screen}: ${problem}`);
  };
  try {
    await assertRender(page);
    if (profile === 'notch') {
      const sides = width > height ? { top: 0, bottom: 21, left: notch.side, right: notch.side } : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
      await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;` +
        `--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
    }
    await waitForScreen(page, 'menu');
    if (SHOTS) await page.waitForTimeout(3000); // the night globe's textures (R1) load after the first frame
    record('menu', [...await common(page, 'menu'), ...await menuAudit(page)]);
    await shot(page, `menu-${tag}`);
    await clickTestId(page, 'menu-settings');
    await page.locator('.airway-settings').first().waitFor();
    record('settings', [...await common(page, 'settings'), ...await pageAudit(page, '.airway-settings')]);
    await shot(page, `settings-${tag}`);
    await clickTestId(page, 'settings-licenses');
    await page.waitForTimeout(80);
    record('licences', [...await common(page, 'licences'), ...await pageAudit(page, '.airway-settings')]);
    await shot(page, `licences-${tag}`);
    await back(page);
    await clickTestId(page, 'settings-privacy');
    await page.getByTestId('privacy-page').waitFor({ timeout: 10000 });
    record('privacy', [...await common(page, 'privacy'), ...await pageAudit(page, '.airway-settings')]);
    if (!SHOTS || width === 412) await shot(page, `privacy-${tag}`);
    await back(page);
    await back(page);
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-logbook');
    await page.getByTestId('logbook').waitFor();
    record('logbook', [...await common(page, 'logbook'), ...await pageAudit(page, '.airway-settings')]);
    await shot(page, `logbook-${tag}`);
    await back(page);
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-puzzles');
    await page.locator('.puzzle-board').waitFor();
    record('puzzles', [...await common(page, 'puzzles'), ...await pageAudit(page, '.puzzle-board')]);
    await shot(page, `puzzles-${tag}`);
    await page.locator('.puzzle-exit').click();
    await waitForScreen(page, 'menu');
    // The training flight, replayed from Settings → Help.
    await clickTestId(page, 'menu-settings');
    await clickTestId(page, 'settings-tutorial-replay');
    await page.getByTestId('tutorial').waitFor();
    await page.waitForTimeout(150);
    record('tutorial', await common(page, 'tutorial'));
    await shot(page, `tutorial-${tag}`);
    await clickTestId(page, 'tutorial-skip');
    await page.waitForTimeout(150);
    if (await page.evaluate(() => window.aw.state().screen) !== 'game') {
      if (await page.evaluate(() => window.aw.state().screen) !== 'menu') await back(page);
      await waitForScreen(page, 'menu');
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
      await clickTestId(page, 'menu-endless');
    }
    await waitForScreen(page, 'game');
    const real = SHOTS || (width === 412 && height === 915 && scale === 100);
    if (real) {
      // A short real run (as e2e/board.mjs): the bot draws routes and places aircraft, so the pause has a network.
      for (let i = 0; i < 31; i++) {
        await page.evaluate(() => window.aw.botStep?.());
        await page.evaluate(() => window.aw.advanceTicks(80));
        await answerBoard(page);
      }
    } else await page.evaluate(() => window.aw.advanceTicks(60));
    await page.locator('[data-hud-action="pause"]').click();
    await page.locator('.airway-pause:not([hidden])').waitFor();
    await page.waitForTimeout(80);
    record('pause', [...await common(page, 'pause'), ...await pauseAudit(page)]);
    await shot(page, `pause-${tag}`);
    await clickTestId(page, 'action-resume');
    // On the real-run sizes the bot plays on to a jam of its own (weeks of rows in the table); else a forced overload.
    if (!real || !await playToJam(page)) await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover', 20000);
    await page.locator('[data-testid="board-report-weeks"][data-state="ready"], [data-testid="board-report-weeks"][hidden]').first().waitFor({ timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(100);
    record('report', [...await common(page, 'report'), ...await reportAudit(page)]);
    await shot(page, `report-${tag}`);
    await page.evaluate(() => { const p = document.querySelector('[data-testid="board-print"]'); if (p) p.scrollTop = p.scrollHeight; });
    await page.waitForTimeout(60);
    await shot(page, `report-${tag}-foot`);
    if (errors.length) failures.push(`${tag}: page errors ${errors.join('; ')}`);
  } catch (error) {
    failures.push(`${tag}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
    await page.screenshot({ path: resolve(OUT, `fail-${tag}.png`) }).catch(() => undefined);
  } finally {
    await page.close();
  }
}

async function unsupported(browser, url, language, width, height) {
  const tag = `${language}-${width}x${height}`;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, locale: language === 'pl' ? 'pl-PL' : 'en-US' });
  try {
    await presetLanguage(page, language, { clear: true });
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return kind === 'webgl2' ? null : original.call(this, kind, ...rest); };
    });
    const plain = new URL(url);
    plain.searchParams.set('skin', 'board'); // the no-WebGL page needs the real renderer's context request (not the stub)
    await page.goto(plain.href, { waitUntil: 'load' });
    await page.getByTestId('gl-unsupported').waitFor({ timeout: 12000 });
    await page.evaluate(() => document.fonts.ready);
    checked++;
    for (const problem of [...await common(page, 'unsupported'), ...await pageAudit(page, '.airway-unsupported')]) failures.push(`${tag} unsupported: ${problem}`);
    await shot(page, `unsupported-${tag}`);
  } catch (error) {
    failures.push(`${tag} unsupported: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    for (const language of langs) {
      for (const size of cases) await run(browser, url, language, size);
      await unsupported(browser, url, language, 412, 915);
      if (!SHOTS) await unsupported(browser, url, language, 320, 568);
    }
  });
} catch (error) {
  failures.push(`harness: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
}
for (const failure of failures) console.error(`FAIL ${failure}`);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`SUMMARY test:e2e:board-sheets seed=0x${SEED.toString(16).toUpperCase()} screens=${checked} shots=${shots} ` +
  `failures=${failures.length} out=${OUT} ${seconds}s`);
process.exitCode = failures.length ? 1 : 0;

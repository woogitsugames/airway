// [night-28a] D-284: the Linoryt preview (D-283, docs/styles/kierunki-2026-11b/PLAN-LINORYT.md step U1) on the real
// session. Loads the DEV-only `?skin=linoryt` (on the stub world with --render=stub, D-254), plays a short seeded run
// with the DEV bot so the HUD shows a real afternoon (day 2, routes, aircraft used up), and audits the menu and the
// in-game HUD at phone, landscape, foldable and tablet sizes, PL and EN, at 100 % and at the 150 % text step, plus
// two notch profiles (the `--aw-safe-*` tokens, as e2e/notch.mjs):
//   - the preview is really on (<html data-skin="linoryt">, Besley and Schibsted Grotesk loaded, no Róża rose/dial);
//   - no horizontal overflow; every HUD button and menu entry ≥ 48 × 48 CSS px, inside the safe rectangle;
//   - dock cells apart from each other and from the top margin; the clock, week and day lines and every dock caption
//     unclipped (scrollWidth within its box); 24 day-bar hours, each ≥ 4 px wide, the "now" cut inside the bar;
//   - the menu's run-starting entry is the one red block; the menu index does not cover the title.
// [night-29b] Step U4 adds the screens off the menu, each mounted alone on `?perf=scene&skin=linoryt` (the
// e2e/screen-fixtures.mjs fixtures: settings, logbook, puzzles; plus licences, privacy, terms and the daily ranking) at the
// same sizes, PL/EN, 100/150 %, notch:
//   - the preview is on and printed in Besley + Schibsted Grotesk (page titles in Besley); the screen-fixtures layout audit
//     (≥ 48 px buttons, no clipped or overflowing text, nothing off screen, no horizontal scroll);
//   - every control (button, select, the label of a tick box) ≥ 48 × 48 and inside the safe rectangle;
//   - no word of a title, heading or big figure broken over two lines ("Ustawieni|a"; also the menu entries and title);
//   - print only: no box shadow, no rounded corner, no translucent background, no gradient on any element; the red
//     #B33823 fills no block except the danger action (delete ranking data); the globe-view setting is gone (D-285).
// Shots: .e2e/linoryt/ (default) or `--out=docs/shots/28a` (`npm run shots:linoryt`); `npm run shots:linoryt:u4`
// writes the menu and the U4 screens at 320×568, 412×915, 915×412, 768×1024 (100 and 150 %) to docs/shots/29b/
// (`--no-game`). Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender, RENDER } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { auditScreen, mountScreen } from './screen-fixtures.mjs';

const started = performance.now();
const outArg = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const OUT = outArg ? resolve(ROOT, outArg) : resolve(ARTIFACTS, 'linoryt');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = [
  [320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [768, 1024, 100], [1088, 904, 100],
  [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150], [915, 412, 150],
];
/** [night-29b] U4 screens: e2e/screen-fixtures.mjs ones, then those this suite mounts itself. */
const U4_SCREENS = ['settings', 'logbook', 'puzzles', 'licences', 'privacy', 'terms', 'ranking'];
const noGame = process.argv.includes('--no-game');
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const failures = [];
let checked = 0;
let shots = 0;

function linorytUrl(url) {
  const target = new URL(gameUrl(url));
  target.searchParams.set('skin', 'linoryt');
  return target.href;
}

/** [night-29b] Words of the printed titles and figures that break across two lines ("Ustawieni|a"), as page script. */
const SPLIT_WORDS = `(selector) => {
  const split = [];
  for (const el of document.querySelectorAll(selector)) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.textContent.matchAll(/\\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
        if (tops.size > 1) split.push(match[0]);
      }
    }
  }
  return split;
}`;
const splitWords = (page, selector) => page.evaluate(`(${SPLIT_WORDS})(${JSON.stringify(selector)})`);

/** Shared page audit; returns a list of problems (empty = fine). */
async function audit(page, screen) {
  return await page.evaluate(({ screen }) => {
    const problems = [];
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
    // The safe rectangle: --aw-safe-* resolve through env(); read them from a probe.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = probe.getBoundingClientRect();
    probe.remove();
    void px;
    if (root.dataset.skin !== 'linoryt') problems.push(`data-skin=${root.dataset.skin}`);
    if (!document.fonts.check('900 46px Besley')) problems.push('Besley not loaded');
    if (!document.fonts.check('600 14px "Schibsted Grotesk"')) problems.push('Schibsted Grotesk not loaded');
    if (document.querySelector('.roza-dial, .roza-rose, .roza-menu-rose')) problems.push('Róża helpers on');
    if (root.scrollWidth > window.innerWidth + 1) problems.push(`horizontal overflow ${root.scrollWidth} > ${window.innerWidth}`);
    const box = (el) => el.getBoundingClientRect();
    const name = (el) => el.dataset.hudAction || el.dataset.mode || el.className.split(' ')[0];
    const shown = (el) => { const r = box(el); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const target = (el) => {
      const r = box(el);
      if (r.width < 47.5 || r.height < 47.5) problems.push(`${name(el)} ${r.width.toFixed(1)}×${r.height.toFixed(1)} < 48`);
      if (r.left < safe.left - .5 || r.top < safe.top - .5 || r.right > safe.right + .5 || r.bottom > safe.bottom + .5) {
        problems.push(`${name(el)} outside the safe rectangle (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
      }
    };
    const clipped = (el, label) => { if (el && el.scrollWidth > el.clientWidth + 1) problems.push(`${label} clipped ${el.scrollWidth} > ${el.clientWidth}`); };
    const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    if (screen === 'menu') {
      const entries = [...document.querySelectorAll('.airway-flight, .airway-flight__region')].filter(shown);
      if (entries.length < 4) problems.push(`menu entries ${entries.length}`);
      entries.forEach(target);
      const title = document.querySelector('.airway-sign__title');
      const sign = title && box(title);
      if (!sign || sign.height < 30) problems.push('title missing');
      for (const entry of entries) if (sign && meet(box(entry), sign)) problems.push(`${name(entry)} covers the title`);
      const red = entries.filter((el) => getComputedStyle(el).backgroundColor === 'rgb(179, 56, 35)');
      if (red.length !== 1) problems.push(`red entries ${red.length}`);
      document.querySelectorAll('.lin-title').forEach((el) => clipped(el, 'entry title'));
    } else {
      const buttons = [...document.querySelectorAll('.airway-hud button')].filter(shown);
      if (buttons.length !== 7) problems.push(`HUD buttons ${buttons.length}`);
      buttons.forEach(target);
      const tags = [...document.querySelectorAll('.airway-dock__tag')];
      const pass = document.querySelector('.airway-pass');
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) if (meet(box(tags[i]), box(tags[j]))) problems.push(`${name(tags[i])} meets ${name(tags[j])}`);
        if (pass && meet(box(tags[i]), box(pass))) problems.push(`${name(tags[i])} meets the top margin`);
        const caption = tags[i].querySelector('.lin-caption');
        if (!caption || !caption.textContent) problems.push(`${name(tags[i])} without caption`);
        else if (box(caption).width > box(tags[i]).width + 1 || box(caption).left < box(tags[i]).left - 1) problems.push(`${name(tags[i])} caption wider than its cell (${box(caption).width.toFixed(1)} > ${box(tags[i]).width.toFixed(1)})`);
        const wait = tags[i].querySelector('.lin-wait');
        if (wait && !wait.hidden && (box(wait).right > box(tags[i]).right + 1 || box(wait).left < box(tags[i]).left - 1)) problems.push(`${name(tags[i])} wait line wider than its cell`);
      }
      for (const [selector, label] of [['.lin-clock', 'clock'], ['.lin-week', 'week'], ['.lin-sub', 'day line']]) {
        const el = document.querySelector(selector);
        if (!el || !el.textContent) problems.push(`${label} missing`); else clipped(el, label);
      }
      const clock = document.querySelector('.lin-clock');
      if (clock && !/^\d\d:\d\d$/.test(clock.textContent)) problems.push(`clock "${clock.textContent}"`);
      const cells = [...document.querySelectorAll('.lin-day__cells i')];
      if (cells.length !== 24) problems.push(`day bar ${cells.length} hours`);
      if (cells.some((cell) => box(cell).width < 4)) problems.push('a day-bar hour narrower than 4 px');
      const bar = document.querySelector('.lin-day__cells');
      const now = document.querySelector('.lin-day__now');
      if (bar && now && (box(now).left < box(bar).left - 2 || box(now).right > box(bar).right + 2)) problems.push('"now" cut outside the bar');
      const lastText = pass && [...pass.querySelectorAll('.lin-clock, .lin-lines, .lin-day')].map(box);
      const pause = document.querySelector('.airway-pass__pause');
      if (pause && lastText) for (const r of lastText) if (meet(r, box(pause))) problems.push('pause covers the top margin text');
    }
    return problems;
  }, { screen });
}

/** [night-29b] U4: mounts one screen alone (no session, no globe) on the preview. */
async function mountU4(page, screen, language, scale) {
  if (['settings', 'logbook', 'puzzles'].includes(screen)) return mountScreen(page, screen, language, { pseudo: false, textScale: scale });
  await page.evaluate(async ({ screen, language, scale }) => {
    const { setLanguage, loadLegalText } = await import('/src/i18n/index.ts');
    setLanguage(language);
    const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
    applyAccessibilitySettings({ textScale: scale, enhancedGlyphs: false, hapticsEnabled: true });
    const host = document.getElementById('app');
    if (screen === 'ranking') {
      const { createRankingView } = await import('/src/ui/leaderboard/index.ts');
      const view = createRankingView('07.11');
      const board = (me) => ({ entries: [[1, 'KESTREL', 1904], [2, 'ORION 7', 1650], [3, 'TUI', 1288], [9, 'AW-4417', 912]]
        .map(([rank, callSign, score]) => ({ rank, callSign, score, me: me && rank === 9 })), me: null });
      view.update({ kind: 'ready', daily: board(true), weekly: board(false) });
      const sheet = document.createElement('div');
      sheet.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:24px 16px;background:var(--lin-paper)';
      sheet.append(view.element);
      host.append(sheet);
    } else {
      await loadLegalText();
      const settings = await import('/src/ui/settings/settings.ts');
      const make = screen === 'licences' ? settings.createLicenses : screen === 'privacy' ? settings.createPrivacy : settings.createTerms;
      host.append(make(() => {}).element);
    }
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { screen, language, scale });
}

/** [night-29b] U4: the print rules and targets on a mounted screen (the layout audit is auditScreen's). */
async function auditU4(page, screen) {
  return await page.evaluate((screen) => {
    const problems = [];
    const root = document.documentElement;
    if (root.dataset.skin !== 'linoryt') problems.push(`data-skin=${root.dataset.skin}`);
    if (!document.fonts.check('800 20px Besley')) problems.push('Besley not loaded');
    if (!document.fonts.check('600 14px "Schibsted Grotesk"')) problems.push('Schibsted Grotesk not loaded');
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = probe.getBoundingClientRect();
    probe.remove();
    const host = document.getElementById('app');
    const name = (el) => (el.dataset?.testid || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30);
    const titles = [...host.querySelectorAll('h1, .puzzle-sign strong, .airway-rank-title')];
    if (!titles.length) problems.push('no page title');
    for (const title of titles) if (!/^"?Besley/.test(getComputedStyle(title).fontFamily)) problems.push(`title "${name(title)}" not in Besley`);
    const body = host.querySelector('.airway-setting, .airway-privacy p, .airway-licenses span, .puzzle-count, .airway-rank-row, .airway-logbook__records dt');
    if (body && !/^"?Schibsted Grotesk/.test(getComputedStyle(body).fontFamily)) problems.push('text not in Schibsted Grotesk');
    const controls = [...host.querySelectorAll('button, select, label.airway-setting__switch')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden';
    });
    if (screen !== 'ranking' && !controls.length) problems.push('no controls');
    // Only what is on screen counts for the safe rectangle (a page scrolls; the puzzle list scrolls inside).
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) problems.push(`${name(el)}: target ${Math.round(r.width)}×${Math.round(r.height)}`);
      const onScreen = r.bottom > 0 && r.top < innerHeight;
      if (onScreen && r.top >= 0 && r.bottom <= innerHeight && (r.left < safe.left - .5 || r.right > safe.right + .5 || r.top < safe.top - .5)) problems.push(`${name(el)} outside the safe rectangle`);
    }
    const RED = 'rgb(179, 56, 35)';
    for (const el of host.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('[hidden]')) continue;
      if (style.boxShadow !== 'none') problems.push(`${name(el)}: box shadow`);
      if (parseFloat(style.borderTopLeftRadius) > 0 || parseFloat(style.borderBottomRightRadius) > 0) problems.push(`${name(el)}: rounded corner`);
      if (/gradient\(/.test(style.backgroundImage)) problems.push(`${name(el)}: gradient`);
      const bg = style.backgroundColor.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
      if (bg && Number(bg[4]) > 0 && Number(bg[4]) < 1) problems.push(`${name(el)}: translucent background ${style.backgroundColor}`);
      if (style.backgroundColor === RED && el.dataset.testid !== 'settings-delete-ranking-confirm') problems.push(`${name(el)}: red block`);
    }
    if (screen === 'settings' && host.querySelector('[data-testid="settings-group-display"] select option[value="satellite"]')) problems.push('globe-view setting shown');
    if (screen === 'licences') for (const face of ['Besley', 'Schibsted Grotesk']) if (!host.textContent.includes(face)) problems.push(`licence for ${face} missing`);
    return [...new Set(problems)].slice(0, 12);
  }, screen);
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height, scale, profile] of cases) {
        const tag = `${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}${profile ? '-' + profile : ''}`;
        let page;
        let errors;
        try {
          ({ page, errors } = await newGamePage(browser, linorytUrl(url), language, { width, height }));
          await assertRender(page);
          await page.evaluate(async (scale) => {
            const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
            applyAccessibilitySettings({ textScale: scale, enhancedGlyphs: false, hapticsEnabled: true });
          }, scale);
          if (profile === 'notch') {
            const sides = width > height
              ? { top: 0, bottom: 21, left: notch.side, right: notch.side }
              : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
            await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
          }
          await waitForScreen(page, 'menu');
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
          for (const screen of noGame ? ['menu'] : ['menu', 'game']) {
            if (screen === 'game') {
              await clickTestId(page, 'menu-endless');
              await waitForScreen(page, 'game');
              // A short real run: the bot draws routes and assigns aircraft, time reaches the afternoon of day 2.
              for (let i = 0; i < 31; i++) {
                await page.evaluate(() => window.aw.botStep?.());
                await page.evaluate(() => window.aw.advanceTicks(80));
              }
              await page.waitForTimeout(150);
            }
            const problems = await audit(page, screen);
            for (const word of await splitWords(page, '.lin-title, .airway-flight__sub, .airway-sign__title, .lin-week')) problems.push(`word split over two lines: "${word}"`);
            if (errors.length) problems.push(`browser errors: ${errors.splice(0).join('; ')}`);
            checked++;
            for (const problem of problems) failures.push(`${tag} ${screen}: ${problem}`);
            await page.screenshot({ path: resolve(OUT, `${screen}-${tag}.png`), animations: 'disabled' });
            shots++;
            console.log(`${problems.length ? 'FAIL' : 'PASS'} ${screen} ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
          }
        } catch (error) {
          failures.push(`${tag}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
          console.log(`FAIL ${tag}: ${failures.at(-1)}`);
        } finally {
          if (page) await page.close();
        }
        // [night-29b] U4: the screens off the menu, each alone on the preview at the same size and text step.
        for (const screen of U4_SCREENS) {
          const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
            locale: language === 'pl' ? 'pl-PL' : 'en-US' });
          const pageErrors = [];
          page.on('pageerror', (error) => pageErrors.push(error.message));
          try {
            await presetLanguage(page, language, { clear: true });
            const target = new URL(url);
            target.searchParams.set('perf', 'scene');
            target.searchParams.set('skin', 'linoryt');
            await page.goto(target.href, { waitUntil: 'networkidle' });
            if (profile === 'notch') {
              const sides = width > height
                ? { top: 0, bottom: 21, left: notch.side, right: notch.side }
                : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
              await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
            }
            await mountU4(page, screen, language, scale);
            await page.waitForTimeout(100);
            const problems = [...(await auditScreen(page, { pseudo: false })).problems, ...(await auditU4(page, screen))];
            for (const word of await splitWords(page, 'h1, h2, .airway-logbook__totals dd, .puzzle-sign strong, .puzzle-flap-title, .airway-settings__licenses')) problems.push(`word split over two lines: "${word}"`);
            if (pageErrors.length) problems.push(`browser errors: ${pageErrors.join('; ')}`);
            checked++;
            for (const problem of problems) failures.push(`${tag} ${screen}: ${problem}`);
            await page.screenshot({ path: resolve(OUT, `${screen}-${tag}.png`), animations: 'disabled' });
            shots++;
            console.log(`${problems.length ? 'FAIL' : 'PASS'} ${screen} ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
          } catch (error) {
            failures.push(`${tag} ${screen}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
            console.log(`FAIL ${tag} ${screen}: ${failures.at(-1)}`);
          } finally {
            await page.close();
          }
        }
      }
    }
  });
} catch (error) {
  failures.push(`harness: ${error instanceof Error ? error.message : String(error)}`);
}
const failed = failures.length;
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY linoryt-preview render=${RENDER} screens=${checked} shots=${shots} out=${OUT.replace(ROOT + '/', '')} failed=${failed} ${((performance.now() - started) / 1000).toFixed(1)}s`);
if (failed || checked === 0) process.exitCode = 1;

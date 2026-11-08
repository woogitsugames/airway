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
// [night-29a] U3: then the sheets in the same session — pause, hub cause board (long press on the fullest airport), ATC
// strip + route menu and the first-time card (mounted through their modules on the game layer), the weekly board (DEV
// bot to week 1, contract slip; at 320×568 the D-280 one-liner), the four-crate board of a met contract (the real
// WeeklyUpgradeView over the session's board), the airport pick, the game-over report, and the training flight (a
// fresh install). Each sheet is audited (`auditSheet`): shown, inside the viewport, under the top margin and off the
// dock where it stands over the map, every target ≥ 48 × 48 inside the safe rectangle and hit-testable (the report's
// actions too at 150 %, D-267), no clipped text, no scroll at 100 % where the base sheet has none, and print rules:
// Besley/Schibsted only (headings in Besley), no shadow with blur or offset, no rounded corner, every filled
// background opaque paper/ink/red, ink blocks only on the chosen action and red only on danger, no running animation
// under "Reduce motion".
// Shots: .e2e/linoryt/ (default) or `--out=docs/shots/28a` (`npm run shots:linoryt`); `--sheets-only` writes only the
// sheets (`npm run shots:linoryt:sheets` → docs/shots/29a), `--no-sheets` only the menu and game. Inspect every PNG.
// [night-29b] Step U4 adds the screens off the menu, each mounted alone on `?perf=scene&skin=linoryt` (the
// e2e/screen-fixtures.mjs fixtures: settings, logbook, puzzles; plus licences, privacy, terms and the daily ranking) at the
// same sizes, PL/EN, 100/150 %, notch:
//   - the preview is on and printed in Besley + Schibsted Grotesk (page titles in Besley); the screen-fixtures layout audit
//     (≥ 48 px buttons, no clipped or overflowing text, nothing off screen, no horizontal scroll);
//   - every control (button, select, the label of a tick box) ≥ 48 × 48 and inside the safe rectangle;
//   - no word of a title, heading or big figure broken over two lines ("Ustawieni|a"; also the menu entries and title);
//   - print only: no box shadow, no rounded corner, no translucent background, no gradient on any element; the red
//     #B33823 fills no block except the danger action (delete ranking data); the globe-view setting is gone (D-285).
// [night-30a] Step U2: on every game screen the airport notes and edge chips (e2e/linoryt-notes.mjs): no note over a
// stamp (the DEV probe `window.__awLinoryt.stamps()`), another note, the paper margins or off the screen, every row
// inside its note, names in Besley, a jam note with its block; chips ≥ 48 px, clear of notes, stamps, margins and each
// other. The summary counts the notes and chips audited.
// Shots: .e2e/linoryt/ (default) or `--out=docs/shots/28a` (`npm run shots:linoryt`); `npm run shots:linoryt:u4`
// writes the menu and the U4 screens at 320×568, 412×915, 915×412, 768×1024 (100 and 150 %) to docs/shots/29b/
// (`--no-game`). Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender, RENDER } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { auditScreen, mountScreen } from './screen-fixtures.mjs';
import { auditNotes } from './linoryt-notes.mjs'; // [night-30a] U2

const started = performance.now();
const outArg = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const OUT = outArg ? resolve(ROOT, outArg) : resolve(ARTIFACTS, 'linoryt');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = [
  [320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [768, 1024, 100], [1088, 904, 100], [1032, 1376, 100], [1376, 1032, 100], // [night-57a] D-320 iPad 13"
  [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150], [915, 412, 150],
];
/** [night-29b] U4 screens: e2e/screen-fixtures.mjs ones, then those this suite mounts itself. */
const U4_SCREENS = ['settings', 'logbook', 'puzzles', 'licences', 'privacy', 'terms', 'ranking'];
const noGame = process.argv.includes('--no-game');
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const SHEETS_ONLY = process.argv.includes('--sheets-only');
const NO_SHEETS = process.argv.includes('--no-sheets'); // [night-29a] the U1 run only (`npm run shots:linoryt`)
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const failures = [];
let checked = 0;
let shots = 0;
let noteCount = 0; // [night-30a] U2: notes and edge chips audited on the game screens
let chipCount = 0;

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
      // [night-46a] D-285 L1 / D-301: pause + five dock tags (the globe-view tag went).
      const buttons = [...document.querySelectorAll('.airway-hud button')].filter(shown);
      if (buttons.length !== 6) problems.push(`HUD buttons ${buttons.length}`);
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


/** Hex inks of the preview (linoryt.css). */
const INK = { paper: 'rgb(236, 227, 204)', ink: 'rgb(30, 28, 31)', red: 'rgb(179, 56, 35)' };
/** Ink blocks allowed: the chosen action of each sheet (and marks under 16 px: squares, ticks). Red: danger only. */
const CHOSEN = '.airway-pause__button--primary, .airway-go-same, .airway-go-mapback, .airway-upgrade-back, .airway-first-time__ok, .aw-plane-tag, .aw-action-tag, .aw-settings-sign';
const DANGER = '.lin-hub, .airway-route-menu-danger, .airway-atc-strip:not(.airway-first-time, .airway-slot-hint) .airway-atc-error, .airway-hub-board--jammed .airway-hub-board__head';
/**
 * One sheet's audit. `sheet`: its root selector; `heading`: selector of the headings that must print in Besley;
 * `targets`: its buttons; `reach`: targets that must be on screen and hit-testable; `overMap`: it stands over the live
 * map (keep off the top margin and the dock); `noScroll`: the sheet (or overlay) must not scroll at this text step.
 */
async function auditSheet(page, { sheet, heading, targets = 'button', reach = '', overMap = false, noScroll = false }) {
  return await page.evaluate(({ sheet, heading, targets, reach, overMap, noScroll, INK, CHOSEN, DANGER }) => {
    const problems = [];
    const root = document.querySelector(sheet);
    if (!root) return [`${sheet} missing`];
    const box = (el) => el.getBoundingClientRect();
    const r = box(root);
    if (r.width < 1 || r.height < 1 || getComputedStyle(root).visibility === 'hidden') return [`${sheet} not shown`];
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = box(probe);
    probe.remove();
    const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    const label = (el) => (el.dataset?.testid || el.className?.baseVal || el.className || el.tagName).toString().split(' ')[0];
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('horizontal page overflow');
    if (r.left < -.5 || r.right > innerWidth + .5 || r.top < -.5 || r.bottom > innerHeight + .5) problems.push(`sheet outside the viewport (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    const pass = document.querySelector('.airway-pass');
    if (pass && box(pass).height > 0 && r.top < box(pass).bottom - 1.5 && getComputedStyle(pass).visibility !== 'hidden') problems.push(`sheet top ${Math.round(r.top)} over the top margin (${Math.round(box(pass).bottom)})`);
    if (overMap) {
      for (const tag of document.querySelectorAll('.airway-dock__tag')) if (box(tag).width && meet(box(tag), r)) problems.push(`sheet over the dock (${tag.dataset.hudAction})`);
    }
    if (noScroll) {
      const scroller = [root, ...root.querySelectorAll('*')].find((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.matches('.airway-go-flight-list, .airway-go-timeline, .airway-hub-board__rows'));
      if (scroller) problems.push(`${label(scroller)} scrolls by ${scroller.scrollHeight - scroller.clientHeight} px`);
    }
    const all = [root, ...root.querySelectorAll('*')].filter((el) => !(el instanceof SVGElement) && box(el).width > 0 && !el.closest('[hidden], .split-flap'));
    for (const el of all) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      const b = box(el);
      const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      // Fonts: Besley and Schibsted Grotesk only.
      if (ownText && b.width > 1) {
        const face = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (face !== 'Besley' && face !== 'Schibsted Grotesk') problems.push(`${label(el)} set in ${face}`);
        const clips = /hidden|clip/.test(style.overflowX) || style.textOverflow === 'ellipsis';
        if (clips && el.scrollWidth > el.clientWidth + 1 && !el.matches('.airway-upgrade-waybill-short') && b.width > 1) problems.push(`${label(el)} text clipped (${el.scrollWidth} > ${el.clientWidth})`);
        // Text stays inside its frame (the nearest ancestor drawn with a rule or a neatline), unless a scroller is between.
        let shown = b.width > 1 && b.height > 1;
        for (let up = el; shown && up && up !== root.parentElement; up = up.parentElement) if (getComputedStyle(up).clipPath !== 'none' && up.getBoundingClientRect().width <= 1) shown = false;
        for (let up = shown ? el.parentElement : null; up && root.contains(up); up = up.parentElement) {
          const us = getComputedStyle(up);
          if (/auto|scroll/.test(us.overflowY)) break;
          const framed = us.boxShadow !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(us[`border${side}Width`]) > 0);
          if (!framed) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          const t = range.getBoundingClientRect();
          const f = up.getBoundingClientRect();
          if (t.height && (t.top < f.top - 1 || t.bottom > f.bottom + 1 || t.left < f.left - 1 || t.right > f.right + 1)) problems.push(`${label(el)} text outside its frame ${label(up)}`);
          break;
        }
      }
      // Print: no soft or offset shadow, no rounded corner, no translucent fill.
      if (style.textShadow !== 'none') problems.push(`${label(el)} text-shadow`);
      if (style.boxShadow !== 'none') {
        for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
          const nums = shadow.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g)?.map(parseFloat) ?? [];
          const [x = 0, y = 0, blur = 0] = nums;
          if (blur > 0 || (!/inset/.test(shadow) && (x || y))) { problems.push(`${label(el)} shadow "${shadow.trim()}"`); break; }
        }
      }
      if (['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].some((k) => parseFloat(style[k]) > 0)) problems.push(`${label(el)} rounded`);
      const bg = style.backgroundColor;
      const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(bg)?.[1];
      if (alpha === undefined || Number(alpha) > 0) {
        if (alpha !== undefined && Number(alpha) < 1) problems.push(`${label(el)} translucent ${bg}`);
        else if (![INK.paper, INK.ink, INK.red].includes(bg)) problems.push(`${label(el)} fill ${bg}`);
        else if (b.width >= 16 && b.height >= 16) {
          if (bg === INK.ink && !el.matches(CHOSEN)) problems.push(`${label(el)} is an ink block but not the chosen action`);
          if (bg === INK.red && !el.matches(DANGER)) problems.push(`${label(el)} is a red block but not danger`);
        }
      }
      if (ownText && style.color === INK.red && !el.closest(DANGER)) problems.push(`${label(el)} red letters but not danger`);
    }
    if (heading) for (const el of root.querySelectorAll(heading)) {
      if (box(el).width && getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() !== 'Besley') problems.push(`heading ${label(el)} not in Besley`);
    }
    const buttons = !targets ? [] : [...root.querySelectorAll(targets)].filter((el) => box(el).width > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'));
    if (!buttons.length && targets) problems.push('no targets');
    for (const el of buttons) {
      const b = box(el);
      if (b.width < 47.5 || b.height < 47.5) problems.push(`${label(el)} ${b.width.toFixed(1)}×${b.height.toFixed(1)} < 48`);
      if (b.left < safe.left - .5 || b.right > safe.right + .5) problems.push(`${label(el)} outside the safe sides`);
      const onScreen = b.top >= safe.top - .5 && b.bottom <= safe.bottom + .5;
      if (reach && el.matches(reach)) {
        if (!onScreen) problems.push(`${label(el)} off screen (${Math.round(b.top)}..${Math.round(b.bottom)})`);
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit || !(el === hit || el.contains(hit))) problems.push(`${label(el)} covered by ${hit ? label(hit) : 'nothing'}`);
      }
    }
    const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target instanceof Element && root.contains(a.effect.target));
    if (document.documentElement.dataset.airwayMotion === 'reduce' && running.length) problems.push(`${running.length} animation(s) under Reduce motion`);
    return problems;
  }, { sheet, heading, targets, reach, overMap, noScroll, INK, CHOSEN, DANGER });
}

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));

/** The sheets of one session (already in the game screen); calls `record(sheet, problems)` after each. */
async function sheetsInSession(page, scale, record) {
  const large = scale > 100;
  // Pause sheet.
  await page.locator('.airway-pass__pause').click();
  await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 5000 });
  await settle(page);
  await record('pause', await auditSheet(page, { sheet: '.airway-pause', heading: 'h2', reach: 'button', overMap: true }));
  await clickTestId(page, 'action-resume');
  // Hub cause board: a long press on the fullest airport in view (as e2e/hub-board.mjs).
  const target = await page.evaluate(() => {
    const airports = [...(window.aw.state().airports ?? [])].sort((a, b) => b.waiting / b.capacity - a.waiting / a.capacity);
    for (const airport of airports) {
      const at = window.__awStub?.airportPoint(airport.id);
      const pass = document.querySelector('.airway-pass')?.getBoundingClientRect().bottom ?? 100;
      if (at?.visible && at.x > 40 && at.x < innerWidth - 150 && at.y > pass + 20 && at.y < innerHeight - 120) return at;
    }
    return null;
  });
  if (!target) await record('hub-board', ['no airport in view to long-press']);
  else {
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    await page.getByTestId('hub-board').waitFor({ state: 'visible', timeout: 3000 });
    await settle(page);
    await record('hub-board', await auditSheet(page, { sheet: '[data-testid="hub-board"]', heading: '.airway-hub-board__title', reach: 'button', overMap: true }));
    await clickTestId(page, 'hub-board-close');
  }
  // ATC strip (a route over range) and the route menu, through their modules on the game layer.
  await page.evaluate(async () => {
    const layer = document.querySelector('.airway-game-layer');
    const before = new Set(layer.children);
    const { mountAtcStrip, mountRouteContextMenu } = await import('/src/ui/atcStrip.ts');
    const strip = mountAtcStrip(layer);
    strip.show({ distanceKm: 2408, aircraft: 'turboprop', from: 'ATH', to: 'KHI' });
    const menu = mountRouteContextMenu(layer, { remove() {}, shorten() {}, close() {} });
    const pass = document.querySelector('.airway-pass').getBoundingClientRect();
    menu.show({ x: innerWidth / 2 - 40, y: pass.bottom + 60, canShorten: false });
    window.__linAtc = [strip, menu];
    for (const child of layer.children) if (!before.has(child)) child.classList.add('lin-audit-atc');
  });
  await settle(page);
  const atc = [...await auditSheet(page, { sheet: '.lin-audit-atc.airway-atc-strip', targets: '', overMap: true }),
    ...await auditSheet(page, { sheet: '.lin-audit-atc.airway-route-menu', reach: 'button:not(:disabled)' })];
  await record('atc', atc);
  await page.evaluate(() => { for (const part of window.__linAtc) part.dispose(); });
  // First-time card (the real module, the "hub 70 % full" card).
  await page.evaluate(async () => {
    const layer = document.querySelector('.airway-game-layer');
    const { t } = await import('/src/i18n/index.ts');
    const { FirstTimeRegistry } = await import('/src/game/tutorial/first-time.ts');
    const { mountFirstTimeCards } = await import('/src/game/tutorial/first-time-card.ts');
    const host = document.createElement('div');
    host.className = 'lin-audit-first-time';
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    layer.append(host);
    const cards = mountFirstTimeCards(host, new FirstTimeRegistry(null));
    cards.offer('hub-full', () => ({ tag: t('firstTime.tag.hubFull', { airport: 'AMM', waiting: 26, capacity: 36 }), hint: t('firstTime.hint.hubFull', { airport: 'AMM' }) }));
    cards.flush(false);
  });
  await settle(page);
  await record('first-time', await auditSheet(page, { sheet: '.lin-audit-first-time [data-testid="first-time-card"]', reach: 'button', overMap: true }));
  await page.evaluate(() => document.querySelector('.lin-audit-first-time')?.remove());
  // Weekly board (week 1, with the contract slip).
  await page.evaluate(() => window.aw.autoplay(1));
  await waitForScreen(page, 'upgrade');
  await settle(page);
  await record('upgrade', await auditSheet(page, { sheet: '.airway-upgrade-open', heading: '.airway-upgrade-week, .airway-upgrade-title', targets: 'button',
    reach: large ? '' : 'button:not(:disabled)', noScroll: !large }));
  // Four crates of a met contract: the real view rendered over the session's board.
  await page.evaluate(async () => {
    const real = document.querySelector('.airway-upgrade-open');
    real.style.display = 'none';
    const host = document.createElement('div');
    host.className = 'airway-upgrade-host lin-audit-crates';
    real.after(host);
    const { WeeklyUpgradeView } = await import('/src/ui/upgrade/index.ts');
    new WeeklyUpgradeView(host, { onCommand: () => {}, onCancelPick: () => {}, onPreviewModel: () => {} }).render(
      { week: 3, paused: true, pendingHub: false, offers: ['turboprop', 'hub-expansion', 'widebody', 'departure-slots'].map((id) => ({ id, week: 3 })), extraCrate: 'departure-slots' },
      [{ hubId: 'AMM', waiting: 11, capacity: 36, label: 'AMM' }],
      [{ cityId: 'AMM', label: 'AMM', held: 2, waitMinutes: 40 }, { cityId: 'ATH', label: 'ATH', held: 0, waitMinutes: 0 }],
      { next: { regions: ['EUN', 'ME'], target: 24 }, last: { delivered: 31, target: 30, met: true }, extraCrate: 'departure-slots' });
  });
  await settle(page);
  await record('crates4', await auditSheet(page, { sheet: '.lin-audit-crates.airway-upgrade-open', heading: '.airway-upgrade-week, .airway-upgrade-title', reach: large ? '' : 'button', noScroll: !large }));
  await page.evaluate(() => { document.querySelector('.lin-audit-crates')?.remove(); document.querySelector('.airway-upgrade-open').style.display = ''; });
  // The airport pick (a hub crate waits for a tap on the globe), then back to the crates.
  if (await page.locator('[data-upgrade="hub-expansion"]:not(:disabled)').count()) {
    await page.locator('[data-upgrade="hub-expansion"]').click();
    await page.getByTestId('upgrade-pick-back').waitFor({ state: 'visible', timeout: 5000 });
    await settle(page);
    await record('pick', await auditSheet(page, { sheet: '.airway-upgrade-open.is-picking-hub .airway-upgrade-sign', heading: '', reach: 'button', overMap: true }));
    await clickTestId(page, 'upgrade-pick-back');
    await page.locator('[data-testid^="upgrade-option-"]').first().waitFor({ state: 'visible', timeout: 5000 });
  } else await record('pick', ['no hub crate on the week-1 board']);
  // Game-over report.
  const option = await page.evaluate(() => document.querySelector('[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')?.getAttribute('data-testid') ?? 'upgrade-option-0');
  await clickTestId(page, option);
  await waitForScreen(page, 'game');
  await page.evaluate(() => window.aw.forceHubOverload());
  await waitForScreen(page, 'gameover');
  await page.waitForSelector('[data-gameover-state="open"]', { timeout: 15000 });
  await settle(page);
  await record('gameover', await auditSheet(page, { sheet: '.airway-go-overlay', heading: 'h1, .airway-go-strip-title', reach: '.airway-go-actions button, .airway-go-map', noScroll: !large }));
}

/** The training flight on a fresh install: the route step, then the aircraft step (the tag to drag = ink block). */
async function tutorialSheet(page) {
  await clickTestId(page, 'menu-endless');
  await page.waitForFunction(() => document.querySelector('[data-testid="tutorial"]')?.getAttribute('data-step') === 'route', null, { timeout: 8000 });
  const mid = async (id) => { const r = await page.getByTestId(id).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const a = await mid('city-lon');
  const b = await mid('city-par');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 9 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('[data-testid="tutorial"]')?.getAttribute('data-step') === 'aircraft', null, { timeout: 5000 });
  await settle(page);
  // The stage's parts never overlap: ticket, world, card, hint text and dock (the large text steps grow all of them).
  const overlaps = await page.evaluate(() => {
    const parts = {};
    for (const [name, sel] of [['ticket', '.aw-tutorial-ticket'], ['world', '.aw-tutorial-world'], ['card', '.aw-tutorial-strip'], ['dock', '.aw-tutorial-dock']]) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height) parts[name] = el.getBoundingClientRect();
    }
    const hint = document.querySelector('[data-testid="tutorial-hint"]');
    if (hint?.textContent.trim()) { const range = document.createRange(); range.selectNodeContents(hint); parts.hint = range.getBoundingClientRect(); }
    const names = Object.keys(parts);
    const out = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = parts[names[i]]; const b = parts[names[j]];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${names[i]} overlaps ${names[j]}`);
    }
    return out;
  });
  return [...overlaps, ...await auditSheet(page, { sheet: '.aw-tutorial-stage', heading: '.aw-tutorial-kicker, .aw-strip-index', targets: '.aw-ticket-skip, .aw-plane-tag', reach: '.aw-ticket-skip, .aw-plane-tag' })];
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
          const sides = width > height
            ? { top: 0, bottom: 21, left: notch.side, right: notch.side }
            : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
          const notchStyle = profile === 'notch'
            ? `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}`
            : '';
          if (notchStyle) await page.addStyleTag({ content: notchStyle });
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
            if (screen === 'game') {
              const notes = await auditNotes(page);
              problems.push(...notes.problems);
              if (notes.notes === 0) problems.push('no airport note shown');
              noteCount += notes.notes;
              chipCount += notes.chips;
            }
            for (const word of await splitWords(page, '.lin-title, .airway-flight__sub, .airway-sign__title, .lin-week')) problems.push(`word split over two lines: "${word}"`);
            if (errors.length) problems.push(`browser errors: ${errors.splice(0).join('; ')}`);
            checked++;
            for (const problem of problems) failures.push(`${tag} ${screen}: ${problem}`);
            if (!SHEETS_ONLY) {
              await page.screenshot({ path: resolve(OUT, `${screen}-${tag}.png`), animations: 'disabled' });
              shots++;
            }
            console.log(`${problems.length ? 'FAIL' : 'PASS'} ${screen} ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
          }
          // [night-29a] U3: the sheets of the same run (not with --no-sheets, nor --no-game: they need the run).
          if (!NO_SHEETS && !noGame) {
            const record = async (sheet, problems) => {
              if (errors.length) problems.push(`browser errors: ${errors.splice(0).join('; ')}`);
              checked++;
              for (const problem of problems) failures.push(`${tag} ${sheet}: ${problem}`);
              await page.screenshot({ path: resolve(OUT, `${sheet}-${tag}.png`), animations: 'disabled' });
              shots++;
              console.log(`${problems.length ? 'FAIL' : 'PASS'} ${sheet} ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
            };
            await sheetsInSession(page, scale, record);
            await page.close();
            // The training flight: a fresh install (no prepared seed, so the first Endless opens the tutorial).
            ({ page, errors } = await newGamePage(browser, linorytUrl(url), language, { width, height }));
            await page.evaluate(async (scale) => {
              const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
              applyAccessibilitySettings({ textScale: scale, enhancedGlyphs: false, hapticsEnabled: true });
            }, scale);
            if (notchStyle) await page.addStyleTag({ content: notchStyle });
            await waitForScreen(page, 'menu');
            await record('tutorial', await tutorialSheet(page));
          }
        } catch (error) {
          failures.push(`${tag}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
          console.log(`FAIL ${tag}: ${failures.at(-1)}`);
        } finally {
          if (page) await page.close();
        }
        // [night-29b] U4: the screens off the menu, each alone on the preview at the same size and text step.
        for (const screen of SHEETS_ONLY ? [] : U4_SCREENS) {
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
console.log(`SUMMARY screen-audit render=${RENDER} screens=${checked} shots=${shots} notes=${noteCount} chips=${chipCount} out=${OUT.replace(ROOT + '/', '')} failed=${failed} ${((performance.now() - started) / 1000).toFixed(1)}s`);
if (failed || checked === 0) process.exitCode = 1;

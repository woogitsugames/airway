// [m3] D-55: accessibility on the real game (Playwright, PL + EN). Fails closed.
// 1. Accessible names on every visible control of menu, settings, game (HUD/dock), upgrade board, game over.
// 2. Keyboard walk: menu (Tab, arrows, Enter) → settings → Escape → Endless → pause (Escape) → weekly board
//    (focus moves in, Tab stays in, Enter chooses) → hub jam → game over (focus in, Escape → menu).
//    The focus ring is the D-55 ink outline (≥ 3 px, solid, never the browser's blue).
// 3. aria-live: weekly board, chosen upgrade, hub jam (assertive), game over (polite).
// 4. prefers-reduced-motion: no CSS animation/transition longer than 100 ms can run on any main screen.
// 5. Settings at 130 % text: nothing clipped or overlapping at the four ui:matrix sizes.
// `--shots` also writes evidence PNGs to docs/shots/m3/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, ROOT, SEED } from '../e2e/browser.mjs';
import { textFitProblems } from './lib/text-fit.mjs';

const SHOTS = process.argv.includes('--shots');
const OUT = resolve(ROOT, 'docs/shots/m3');
const MAX_MOTION_MS = 100;
const WALKS = process.env.A11Y_WALK ? [process.env.A11Y_WALK.split(',').map((v, i) => (i ? Number(v) : v))] : [['pl', 412, 915], ['en', 412, 915], ['pl', 915, 412]];
const SIZES = [[412, 915], [915, 412], [673, 841], [904, 1000]];
const failures = [];
let checks = 0;
const started = performance.now();

const message = (error) => (error instanceof Error ? error.message : String(error)).split('\n')[0];
function check(condition, description) { checks++; assert(condition, description); }

/** In-page: visible focusable controls without an accessible name. */
function unnamedControls() {
  const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
  const visible = (el) => el.getClientRects().length && !el.closest('[hidden], [aria-hidden="true"]') &&
    getComputedStyle(el).visibility !== 'hidden';
  const name = (el) => {
    const label = el.getAttribute('aria-label')?.trim();
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName)) return el.getAttribute('title')?.trim() ?? '';
    return (el.textContent ?? '').trim() || el.getAttribute('title')?.trim() || '';
  };
  return [...document.querySelectorAll(selector)].filter(visible).filter((el) => !name(el))
    .map((el) => el.dataset.testid ?? el.outerHTML.slice(0, 80));
}

/** In-page: animations/transitions that may run longer than the limit (computed, not only running ones). */
function longMotion(limit) {
  const seconds = (list) => list.split(',').map((v) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000));
  const out = [];
  for (const animation of document.getAnimations()) {
    const timing = animation.effect?.getComputedTiming();
    const total = timing ? Number(timing.activeDuration) : 0;
    if (!Number.isFinite(total) || total > limit) out.push(`running ${animation.animationName ?? animation.constructor.name} ${total} ms`);
  }
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.animationName !== 'none' && seconds(style.animationDuration).some((ms) => ms > limit)) {
      out.push(`css animation ${style.animationName} ${style.animationDuration} on ${el.className}`);
    }
    if (style.transitionProperty !== 'none' && seconds(style.transitionDuration).some((ms) => ms > limit)) {
      out.push(`css transition ${style.transitionProperty} ${style.transitionDuration} on ${el.className}`);
    }
  }
  return [...new Set(out)].slice(0, 8);
}

/** In-page: the focused element and its ring. */
function focusInfo() {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body' };
  const style = getComputedStyle(el);
  return {
    tag: el.tagName, testid: el.dataset?.testid ?? '', className: typeof el.className === 'string' ? el.className : '',
    visible: el.matches(':focus-visible'), width: parseFloat(style.outlineWidth), outline: style.outlineStyle,
    color: style.outlineColor, inModal: !!el.closest('[aria-modal="true"]'),
    modal: document.querySelector('[aria-modal="true"]:not([hidden])')?.className ?? '',
  };
}

async function installLiveLog(page) {
  await page.evaluate(() => {
    window.__live = [];
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('[data-airway-live]')) {
        const text = node.textContent.trim();
        const last = node.__last;
        if (text && text !== last) window.__live.push({ priority: node.dataset.airwayLive, text });
        node.__last = text;
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}
const liveLog = (page) => page.evaluate(() => window.__live);
async function waitLive(page, pattern, priority, timeout = 8000) {
  try {
    await page.waitForFunction(([source, wanted]) => window.__live.some((entry) =>
      new RegExp(source).test(entry.text) && (!wanted || entry.priority === wanted)), [pattern.source, priority], { timeout });
  } catch {
    throw new Error(`no ${priority ?? ''} announcement /${pattern.source}/; heard: ${JSON.stringify(await liveLog(page)).slice(0, 400)}`);
  }
}

async function expectFocusRing(page, where) {
  const info = await page.evaluate(focusInfo);
  check(info.tag !== 'body', `${where}: focus is lost on <body>`);
  check(info.visible && info.outline === 'solid' && info.width >= 3, `${where}: focus ring missing ${JSON.stringify(info)}`);
  check(info.color === 'rgb(42, 36, 32)', `${where}: focus ring is not ink (${info.color})`);
  return info;
}
async function expectNames(page, where) {
  const missing = await page.evaluate(unnamedControls);
  check(missing.length === 0, `${where}: controls without accessible name: ${missing.join(', ')}`);
}
async function expectCalm(page, where) {
  const long = await page.evaluate(longMotion, MAX_MOTION_MS);
  check(long.length === 0, `${where}: motion > ${MAX_MOTION_MS} ms with reduced motion: ${long.join(' | ')}`);
}
async function shot(page, name) {
  if (!SHOTS) return;
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
}
async function tabUntil(page, predicate, limit = 14, key = 'Tab') {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(key);
    const info = await page.evaluate(focusInfo);
    if (predicate(info)) return info;
  }
  throw new Error(`${key} never reached the wanted control; at ${JSON.stringify(await page.evaluate(focusInfo))}`);
}
async function expectTrapped(page, where, presses = 8) {
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    const info = await page.evaluate(focusInfo);
    check(info.inModal, `${where}: Tab left the open board (${JSON.stringify(info)})`);
  }
}

async function walk(browser, url, language, width, height) {
  const tag = `${language}-${width}x${height}`;
  const { page, errors } = await newGamePage(browser, url, language, { width, height }, { hasTouch: false });
  try {
    await waitForScreen(page, 'menu');
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await installLiveLog(page);
    // ---- menu
    await expectNames(page, `${tag} menu`);
    await expectCalm(page, `${tag} menu`);
    await tabUntil(page, (info) => info.testid?.startsWith('menu-'));
    const first = await tabUntil(page, (info) => info.testid === 'menu-endless', 6, 'ArrowUp');
    await expectFocusRing(page, `${tag} menu row`);
    await shot(page, `focus-menu-${tag}`);
    await page.keyboard.press('ArrowDown');
    const second = await page.evaluate(focusInfo);
    check(second.testid !== first.testid && second.testid.startsWith('menu-'), `${tag}: ArrowDown did not move along the board (${second.testid})`);
    // ---- settings and back
    await tabUntil(page, (info) => info.testid === 'menu-settings', 6, 'ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.airway-screen-root')?.dataset.screen === 'settings');
    await expectNames(page, `${tag} settings`);
    await expectFocusRing(page, `${tag} settings back`);
    await expectCalm(page, `${tag} settings`);
    await page.keyboard.press('Tab');
    await expectFocusRing(page, `${tag} settings control`);
    await shot(page, `focus-settings-${tag}`);
    await page.keyboard.press('Escape');
    await waitForScreen(page, 'menu');
    const back = await page.evaluate(focusInfo);
    check(back.testid === 'menu-settings', `${tag}: focus did not return to the settings row (${back.testid})`);
    // ---- game
    await tabUntil(page, (info) => info.testid === 'menu-endless', 6, 'ArrowUp');
    await page.keyboard.press('Enter');
    await waitForScreen(page, 'game');
    await expectNames(page, `${tag} game`);
    await expectCalm(page, `${tag} game`);
    await page.keyboard.press('Tab');
    await expectFocusRing(page, `${tag} HUD`);
    await shot(page, `focus-hud-${tag}`);
    await page.keyboard.press('Escape'); // back = pause sheet
    await page.waitForFunction(() => !document.querySelector('.airway-pause')?.hidden);
    const pause = await page.evaluate(focusInfo);
    check(pause.testid === 'action-resume', `${tag}: pause sheet did not take focus (${pause.testid})`);
    await expectTrapped(page, `${tag} pause`, 5);
    await expectNames(page, `${tag} pause`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.airway-pause')?.hidden);
    // ---- weekly board
    await page.evaluate(() => window.aw.autoplay(1));
    await waitForScreen(page, 'upgrade');
    await waitLive(page, language === 'pl' ? /Koniec tygodnia 1\. Wybierz/ : /Week 1 complete\. Choose/, 'polite');
    const board = await page.evaluate(focusInfo);
    check(board.inModal && board.testid.startsWith('upgrade-option-'), `${tag}: weekly board did not take focus (${JSON.stringify(board)})`);
    await expectFocusRing(page, `${tag} upgrade label`);
    await expectNames(page, `${tag} upgrade`);
    await expectCalm(page, `${tag} upgrade`);
    await expectTrapped(page, `${tag} upgrade`);
    await shot(page, `focus-upgrade-${tag}`);
    const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')]
      .map((el) => ({ id: el.dataset.testid, kind: el.dataset.upgrade, disabled: el.disabled })));
    const targeted = offers.find((offer) => !offer.disabled && (offer.kind === 'hub-expansion' || offer.kind === 'departure-slots'));
    if (targeted) {
      // The globe pick by keyboard: airport buttons appear in the sign; Escape returns to the crates.
      await tabUntil(page, (info) => info.testid === targeted.id, 8);
      await page.keyboard.press('Enter');
      await page.waitForSelector('.airway-upgrade-pick');
      const pick = await page.evaluate(focusInfo);
      check(pick.className.includes('airway-upgrade-pick'), `${tag}: airport pick did not take focus (${JSON.stringify(pick)})`);
      await expectFocusRing(page, `${tag} airport pick`);
      await expectNames(page, `${tag} airport pick`);
      await shot(page, `focus-pick-${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid^="upgrade-option-"]');
    }
    const plane = offers.find((offer) => offer.kind === 'turboprop' || offer.kind === 'widebody');
    check(!!plane, `${tag}: no aircraft offer on the board`);
    await tabUntil(page, (info) => info.testid === plane.id, 8);
    await page.keyboard.press('Enter');
    await waitForScreen(page, 'game');
    await waitLive(page, language === 'pl' ? /Wybrano: / : /Chosen: /, 'polite');
    // ---- jam and game over: real demand, small steps so the countdown is seen before it ends
    for (let i = 0; i < 400; i++) {
      const heard = await page.evaluate(() => window.__live.some((entry) => entry.priority === 'assertive'));
      const current = await page.evaluate(() => window.aw.state().screen);
      if (heard || current === 'gameover') break;
      if (current === 'upgrade') {
        await page.evaluate(() => document.querySelector('[data-upgrade="turboprop"], [data-upgrade="widebody"]')?.click());
      } else await page.evaluate(() => window.aw.advanceTicks(40));
      await page.waitForTimeout(i % 10 === 0 ? 450 : 0);
    }
    await waitLive(page, /Hub .+ (zatkany|is jammed)/, 'assertive', 2000);
    await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover');
    await waitLive(page, language === 'pl' ? /Siatka wstrzymana\. Hub .+ zatkany/ : /Network closed\. Hub .+ jammed/, 'polite');
    await page.waitForSelector('.airway-go-overlay');
    const over = await page.evaluate(focusInfo);
    check(over.inModal && over.className.includes('airway-go-button'), `${tag}: game over did not take focus (${JSON.stringify(over)})`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expectFocusRing(page, `${tag} game over`);
    await expectNames(page, `${tag} game over`);
    await expectCalm(page, `${tag} game over`);
    await expectTrapped(page, `${tag} game over`);
    await shot(page, `focus-gameover-${tag}`);
    await page.keyboard.press('Escape');
    await waitForScreen(page, 'menu');
    check(errors.length === 0, `${tag}: browser errors ${errors.join('; ')}`);
    const heard = await liveLog(page);
    console.log(`ok walk ${tag} announcements=${heard.length}`);
    for (const entry of heard) console.log(`   ${entry.priority}: ${entry.text}`);
  } finally {
    await page.close();
  }
}

/** Settings is not in ui:matrix: its 130 % layout is checked here at the four matrix sizes. */
async function settingsAt130(browser, url, language) {
  for (const [width, height] of SIZES) {
    const tag = `${language}-${width}x${height}`;
    const { page } = await newGamePage(browser, url, language, { width, height }, { textScale: 130 });
    try {
      await waitForScreen(page, 'menu');
      await clickTestId(page, 'menu-settings');
      await page.waitForFunction(() => document.querySelector('.airway-screen-root')?.dataset.screen === 'settings');
      const problems = await page.evaluate(textFitProblems);
      check(problems.length === 0, `settings 130% ${tag}: ${problems.slice(0, 6).join(' | ')}`);
      if (language === 'pl' && (width === 412 || width === 915)) await shot(page, `text130-settings-${tag}`);
    } finally {
      await page.close();
    }
  }
}

try {
  if (SHOTS) mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of WALKS) {
      try { await walk(browser, url, language, width, height); } catch (error) { failures.push(`walk ${language}-${width}x${height}: ${message(error)}`); }
    }
    for (const language of ['pl', 'en']) {
      try { await settingsAt130(browser, url, language); } catch (error) { failures.push(`settings130 ${language}: ${message(error)}`); }
    }
  });
} catch (error) {
  failures.push(`harness: ${message(error)}`);
} finally {
  for (const line of failures) console.error('FAIL ' + line);
  console.log(`SUMMARY test:a11y seed=0x${SEED.toString(16).toUpperCase()} walks=${WALKS.length} checks=${checks} failed=${failures.length} durationMs=${Math.round(performance.now() - started)}`);
  if (failures.length) process.exitCode = 1;
}

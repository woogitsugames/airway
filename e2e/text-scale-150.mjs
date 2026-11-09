// [night-11ap] R1g: the two largest text steps (130 and 150 %) on real PL/EN catalogs. Every screen of e2e/screen-fixtures.mjs
// (departures menu, settings, logbook, puzzle board, weekly upgrade board over the HUD, game over, in-game HUD,
// first-time card) at 320x568, 412x915 and 915x412 with the same layout audit as e2e/pseudo-320.mjs, plus: the root carries
// the step and the screen's reading text really grew (a probe element's computed size = step x its base).
// Shots into .e2e/text-scale-150/ (not committed). The full ui:matrix times out under SwiftShader (G7).
// [night-20a] D-267 (Róża at large text, reviewed on the real renderer with scripts/shots-n20a.mjs): two more screens,
// the hub cause board (its sentences now follow the step) and the pause sheet over the HUD (on a short landscape screen
// its actions stay on screen); on the game-over report every action stays on screen and no part of the report lies
// above where its scroll can reach.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, saveDiagnostics, ARTIFACTS } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { SCREENS as SHARED_SCREENS, UPGRADE_PICK, auditScreen, fixtureStateAudit, mountScreen } from './screen-fixtures.mjs'; // [night-11ap] shared with text-scale-150

// [night-59a] D-322: the weekly board's airport pick is a case of its own; `upgrade` is the crate board.
const FIXTURE_SCREENS = [...SHARED_SCREENS, UPGRADE_PICK];
const SCREENS = [...FIXTURE_SCREENS, 'hub-board', 'pause'];

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'text-scale-150');
const SIZES = [{ width: 320, height: 568 }, { width: 412, height: 915 }, { width: 915, height: 412 }];
const SCALES = process.env.AW_TEXT_SCALE ? [Number(process.env.AW_TEXT_SCALE)] : [130, 150]; // AW_TEXT_SCALE=100 for a baseline run
/** One reading-text element per screen and its size at 100 %; the HUD and first-time card keep in-world sizes. */
const PROBES = {
  menu: null, settings: ['.airway-setting', 14], logbook: ['.airway-logbook__records dt', 13], puzzles: null, upgrade: null, 'upgrade-pick': null,
  gameover: null, hud: null, 'first-time': null, 'hub-board': ['.airway-hub-board__text', 13], pause: ['.airway-pause__summary dd', 14], // [night-81a] D-336: UI-A keys use the bounded title scale (D-332); the summary text scales fully
};

/** [night-20a] The hub cause board and the pause sheet as the session builds them, over the real HUD. */
async function mountGameSheet(page, screen, language, textScale) {
  await page.evaluate(async ({ screen, language, textScale }) => {
    const { setLanguage, t } = await import('/src/i18n/index.ts');
    setLanguage(language);
    const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
    applyAccessibilitySettings({ textScale, enhancedGlyphs: false, hapticsEnabled: true });
    await import('/src/ui/game.css');
    const host = document.getElementById('app');
    const layer = document.createElement('div');
    layer.className = 'airway-game-layer';
    host.append(layer);
    const { mountHud } = await import('/src/ui/hud/index.ts');
    const hudHost = document.createElement('div');
    // [night-29a] The session's HUD host is the whole game layer; an unsized host measured 412 × 0 and resolved the
    // landscape layout on a portrait screen (watchHudLayout).
    hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    layer.append(hudHost);
    mountHud(hudHost, {}).render({ week: 3, day: 2, timeMinutes: 1026, passengers: 342, paused: screen === 'pause', speed: 1, canUndo: true,
      selectedPlane: 'turboprop', stock: { turboprop: 1, widebody: 1, hub: 1 }, minutesToBoard: 1500 });
    if (screen === 'pause') {
      const sheet = document.createElement('section');
      sheet.className = 'airway-pause';
      const title = document.createElement('h2');
      title.textContent = t('pause.title');
      const list = document.createElement('dl');
      list.className = 'airway-pause__summary';
      for (const [k, v] of [['pause.summary.network', t('pause.summary.networkValue', { routes: 4, aircraft: 6 })],
        ['pause.summary.hub', t('pause.summary.hubValue', { hub: 'AMM', waiting: 31, capacity: 36 })],
        ['pause.summary.board', t('pause.summary.inDays', { days: 1, hours: 8 })]]) {
        const dt = document.createElement('dt'); dt.textContent = t(k);
        const dd = document.createElement('dd'); dd.textContent = v;
        list.append(dt, dd);
      }
      const button = (cls, text) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; return b; };
      const row = document.createElement('div');
      row.className = 'airway-pause__row';
      row.append(button('airway-pause__button', t('action.save')), button('airway-pause__button', t('action.menu')));
      const status = document.createElement('p');
      status.className = 'airway-pause__status';
      sheet.append(title, list, button('airway-pause__button airway-pause__button--primary', t('action.resume')), row, status);
      layer.append(sheet);
    } else {
      const { mountHubBoard } = await import('/src/ui/hubBoard.ts');
      const board = mountHubBoard(layer, { close: () => {} });
      board.show({ cityId: 'AMM', code: 'AMM', waiting: 31, capacity: 36, jammed: false, rows: [
        { region: 'ME', waiting: 12, cause: 'no-route', minutes: 0 }, { region: 'EUS', waiting: 9, cause: 'left-full', minutes: 40 },
        { region: 'ASI', waiting: 6, cause: 'slot', minutes: 25 }, { region: 'AFR', waiting: 4, cause: 'none', minutes: 0 }] });
    }
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { screen, language, textScale });
  await page.waitForTimeout(150);
}

/** [night-20a] Sheets of the game screen: actions on screen, nothing above the reach of the report's scroll. */
function sheetAudit(page, screen) {
  return page.evaluate((screen) => {
    const problems = [];
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5; };
    if (screen === 'gameover') {
      for (const button of document.querySelectorAll('.airway-go-actions button')) if (!onScreen(button)) problems.push(`game-over action "${button.textContent}" off screen`);
      const overlay = document.querySelector('.airway-go-overlay');
      const content = document.querySelector('.airway-go-content');
      if (overlay && content && content.getBoundingClientRect().top < overlay.getBoundingClientRect().top - overlay.scrollTop - 0.5) problems.push('game-over report starts above its scroll');
      const map = document.querySelector('.airway-go-map');
      if (map && map.getBoundingClientRect().top < -0.5) problems.push('game-over "Map" above the screen');
    }
    if (screen === 'pause') {
      const sheet = document.querySelector('.airway-pause');
      if (!sheet || !onScreen(sheet)) problems.push(`pause sheet off screen (${Math.round(sheet?.getBoundingClientRect().bottom ?? 0)} > ${innerHeight})`);
    }
    if (screen === 'hub-board') {
      const board = document.querySelector('.airway-hub-board');
      if (!board || !onScreen(board)) problems.push('hub board off screen');
      const close = document.querySelector('.airway-hub-board__close')?.getBoundingClientRect();
      if (!close || close.width < 47.5 || close.height < 47.5) problems.push('hub board close under 48 px');
    }
    return problems;
  }, screen);
}
const results = [];

/**
 * Checks the shared audit cannot see at large sizes: a select whose chosen option no longer fits its box, and a
 * word split across two lines (overflow-wrap:anywhere hides an overflow by breaking "USTAWIENIA" mid-word).
 */
function largeTextAudit(page) {
  return page.evaluate(() => {
    const host = document.getElementById('app');
    const problems = [];
    const context = document.createElement('canvas').getContext('2d');
    for (const select of host.querySelectorAll('select')) {
      const style = getComputedStyle(select);
      if (!select.getBoundingClientRect().width) continue;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = select.selectedOptions[0]?.textContent ?? '';
      const room = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 16;
      if (context.measureText(text).width > room + 0.5) problems.push(`select "${text}" cut (${Math.round(context.measureText(text).width)} > ${Math.round(room)})`);
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.split-flap, [hidden], [aria-hidden="true"], option, select')) continue;
      for (const match of node.textContent.matchAll(/[\p{L}\p{N}]{2,}/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        let rects = [...range.getClientRects()].filter((r) => r.width > 0);
        // [night-82b] T7: a break at a written soft hyphen ("Szeroko­kadłubowiec") is a hyphenation point, not a split
        // word (the regex already ends the word there); Chrome reports the drawn hyphen as a rect of the next word's range.
        if (node.textContent[match.index - 1] === '­' && rects.length > 1) rects = rects.slice(1);
        const tops = new Set(rects.map((r) => Math.round(r.top)));
        if (tops.size > 1) problems.push(`word broken across lines: "${match[0]}" in .${String(node.parentElement.className).split(" ")[0] || node.parentElement.tagName}`);
      }
    }
    return problems;
  });
}

const message = (error) => String(error?.message ?? error).split('\n')[0];
let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const SCALE of SCALES) for (const SIZE of SIZES) for (const language of ['pl', 'en']) for (const screen of SCREENS) {
      const name = `${SCALE}% ${language} ${SIZE.width}x${SIZE.height} ${screen}`;
      const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        if (FIXTURE_SCREENS.includes(screen)) await mountScreen(page, screen, language, { pseudo: false, textScale: SCALE });
        else await mountGameSheet(page, screen, language, SCALE);
        const { problems, seen } = await auditScreen(page, { pseudo: false });
        problems.push(...await largeTextAudit(page), ...await sheetAudit(page, screen), ...await fixtureStateAudit(page, screen));
        const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--airway-text-scale').trim());
        if (scale !== String(SCALE / 100)) problems.push(`root text scale ${scale}`);
        const probe = PROBES[screen];
        if (probe) {
          const size = await page.evaluate((selector) => {
            const el = document.querySelector('#app ' + selector);
            return el ? Number.parseFloat(getComputedStyle(el).fontSize) : null;
          }, probe[0]);
          if (size === null || Math.abs(size - probe[1] * SCALE / 100) > 0.6) problems.push(`${probe[0]} is ${size}px, not ${probe[1] * SCALE / 100}px`);
        }
        await page.screenshot({ path: resolve(SHOTS, `${SCALE}-${screen}-${language}-${SIZE.width}x${SIZE.height}.png`), animations: 'disabled' });
        if (!seen) problems.push('no visible text');
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${seen} text boxes` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `text-scale-150-${results.length + 1}`).catch(() => null);
        results.push({ name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { name, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${name}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:text-scale-150 scales=${SCALES.join('/')} checks=${results.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || results.length !== SCREENS.length * 2 * SIZES.length * SCALES.length) process.exitCode = 1;
}

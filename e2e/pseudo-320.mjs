// [night-11ac] R7h, D-211: the harsh pseudo-locale on the smallest phone. Short strings (≤ 20 code points) run twice
// as long, longer ones ~40 % longer, and every key with a length budget (src/i18n/limits.ts) is filled to its budget,
// i.e. the longest translation the catalogs allow. Each screen is mounted alone through its public API on
// ?perf=scene (no game, no globe: the globe suites are slow under SwiftShader, G7) at 320×568 in PL and EN:
// departures menu, settings, logbook (with flights), puzzle board, weekly upgrade board over the HUD, game over,
// in-game HUD and a first-time card. Audit (as e2e/pseudo-locale.mjs): buttons ≥ 48 px, no own text clipped by an
// overflow/ellipsis box or wider than its box, nothing outside the viewport, no template token, no horizontal page
// scroll, pseudo text present; plus: no split-flap cell ends in "…" (a budgeted title, status or half-row title
// fits its cells). Shots into .e2e/pseudo-320/ (not committed).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, saveDiagnostics, ARTIFACTS } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'pseudo-320');
const SIZE = { width: 320, height: 568 };
const SCREENS = ['menu', 'settings', 'logbook', 'puzzles', 'upgrade', 'gameover', 'hud', 'first-time'];
const results = [];

async function mount(page, screen, language) {
  await page.evaluate(async ({ screen, language }) => {
    const { setLanguage, setPseudoLocale, t } = await import('/src/i18n/index.ts');
    setLanguage(language);
    setPseudoLocale('harsh');
    const host = document.getElementById('app');
    if (!host) throw new Error('Missing #app');
    if (screen === 'menu') {
      const { createMenu } = await import('/src/ui/menu/menu.ts');
      host.append(createMenu(() => {}, { bestPassengers: 1284, solvedPuzzles: 3, totalPuzzles: 40, today: new Date(2026, 11, 30),
        saved: { week: 4, passengers: 912 } }).element);
    } else if (screen === 'settings') {
      const { createSettings } = await import('/src/ui/settings/settings.ts');
      host.append(createSettings(() => {}, () => {}, () => {}, () => {}, () => {}).element);
    } else if (screen === 'logbook') {
      const { createLogbook } = await import('/src/ui/logbook/logbook.ts');
      const recent = [['2026-11-03', 'endless', 1284, 6, 'FRA'], ['2026-11-02', 'daily', 412, 2, 'SIN'], ['2026-11-01', 'endless', 96, 1, null]]
        .map(([day, mode, passengers, weeks, hub]) => ({ day, mode, passengers, weeks, hub }));
      host.append(createLogbook(() => {}, { book: { flights: 12, dailies: 4, passengers: 4180, weeks: 19, longestWeeks: 6, hubs: { FRA: 5, SIN: 2 }, recent, runs: [] },
        best: { score: 1284, weeks: 6 }, dailyBest: 412, longestStreak: 4, puzzlesSolved: 3, puzzlesTotal: 40, stars: 7, tutorial: 'completed' }).element);
    } else if (screen === 'puzzles') {
      const { mountPuzzleSelector } = await import('/src/ui/puzzles/index.ts');
      mountPuzzleSelector(host, () => {});
    } else if (screen === 'upgrade' || screen === 'hud') {
      const hudHost = document.createElement('div');
      hudHost.style.cssText = 'position:fixed;inset:0;pointer-events:none';
      if (screen === 'upgrade') document.body.prepend(hudHost); else host.append(hudHost);
      const { mountHud } = await import('/src/ui/hud/index.ts');
      mountHud(hudHost, {}).render({ week: 7, day: 3, timeMinutes: 642, passengers: 1284, paused: screen === 'upgrade', speed: 1, canUndo: true,
        selectedPlane: 'turboprop', stock: { turboprop: 2, widebody: 0, hub: 0 }, minutesToBoard: 6 * 24 * 60 + 300 });
      if (screen === 'upgrade') {
        const { WeeklyUpgradeView } = await import('/src/ui/upgrade/index.ts');
        const view = new WeeklyUpgradeView(host, { onCommand: () => {}, onCancelPick: () => {}, onPreviewModel: () => {} });
        view.render({ week: 7, paused: true, offers: ['turboprop', 'widebody', 'hub-expansion'].map((id) => ({ id, week: 7 })) },
          [{ hubId: 'LON', waiting: 11, capacity: 12, label: 'LON' }]);
      }
    } else if (screen === 'gameover') {
      const { mountGameOverPreview } = await import('/src/ui/gameover/preview.ts');
      mountGameOverPreview(host);
    } else if (screen === 'first-time') {
      const layer = document.createElement('div');
      layer.className = 'airway-game-layer';
      host.append(layer);
      const { FirstTimeRegistry } = await import('/src/game/tutorial/first-time.ts');
      const { mountFirstTimeCards } = await import('/src/game/tutorial/first-time-card.ts');
      const cards = mountFirstTimeCards(layer, new FirstTimeRegistry(null));
      cards.offer('hub-full', () => ({ tag: t('firstTime.tag.hubFull', { airport: 'LON', waiting: 26, capacity: 36 }),
        hint: t('firstTime.hint.hubFull', { airport: 'LON' }) }));
      cards.flush(false);
    }
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { screen, language });
  if (screen === 'gameover') await page.waitForSelector('[data-gameover-state="open"]', { timeout: 15000 });
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => null))),
    new Promise((done) => setTimeout(done, 5000)),
  ]));
  await page.waitForTimeout(150);
}

/** The e2e/pseudo-locale.mjs audit over #app, plus split-flap rows that had to cut their text. */
function audit(page) {
  return page.evaluate(() => {
    const host = document.getElementById('app');
    const problems = [];
    const name = (el) => (el.dataset?.testid || el.getAttribute?.('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const scrollsX = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    let seen = 0;
    for (const el of host.querySelectorAll('*')) {
      if (el.closest('.split-flap')) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"]')) continue;
      const inScroller = scrollsX(el);
      const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (ownText) seen++;
      if (el.matches('button') && (r.height < 47.5 || r.width < 47.5)) problems.push(`${name(el)}: target ${Math.round(r.width)}×${Math.round(r.height)}`);
      const clips = style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow === 'ellipsis';
      if (clips && ownText && el.scrollWidth > el.clientWidth + 1) problems.push(`${name(el)}: text clipped (${el.scrollWidth} > ${el.clientWidth})`);
      if (ownText && !inScroller && style.display !== 'inline' && style.overflowX === 'visible') {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        if (t.width && (t.right > r.right + 1 || t.left < r.left - 1)) problems.push(`${name(el)}: text wider than its box (${Math.round(t.width)} > ${Math.round(r.width)})`);
      }
      if (ownText && !inScroller && (r.left < -0.5 || r.right > innerWidth + 0.5)) problems.push(`${name(el)}: outside the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    // Text runs (also inside inline elements) wider than their nearest block box, and controls off the screen.
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.split-flap, [hidden], [aria-hidden="true"], option')) continue;
      let block = node.parentElement;
      while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
      if (!block || getComputedStyle(block).overflowX !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const t = range.getBoundingClientRect(), r = block.getBoundingClientRect();
      if (t.width && r.width && (t.right > r.right + 1 || t.left < r.left - 1)) problems.push(`${name(block)}: text run wider than its box (${Math.round(t.right)} > ${Math.round(r.right)})`);
    }
    for (const el of host.querySelectorAll('button, select, a[href]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('[hidden]')) continue;
      if (r.left < -0.5 || r.right > innerWidth + 0.5) problems.push(`${name(el)}: control outside the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    for (const flap of host.querySelectorAll('.split-flap')) {
      const text = [...flap.querySelectorAll('.flap-tile')].map((tile) => tile.querySelector('.flap-half--top .flap-ink, .flap-ink')?.textContent ?? '').join('');
      if (text.includes('…')) problems.push(`split-flap cut: "${text}"`);
      const box = flap.getBoundingClientRect();
      const row = flap.parentElement.getBoundingClientRect();
      if (box.width && flap.scrollWidth > flap.clientWidth + 1) problems.push(`split-flap cells hidden: "${text}" (${flap.scrollWidth} > ${flap.clientWidth})`);
      if (box.width && box.right > row.right + 1) problems.push(`split-flap past its column: "${text}"`);
    }
    if (/\{[A-Za-z]/.test(host.textContent)) problems.push('template token');
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('horizontal page scroll');
    if (!host.textContent.includes('[')) problems.push('pseudo-locale not active');
    return { problems: [...new Set(problems)], seen };
  });
}

const message = (error) => String(error?.message ?? error).split('\n')[0];
let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of ['pl', 'en']) for (const screen of SCREENS) {
      const name = `${language} ${SIZE.width}x${SIZE.height} ${screen}`;
      const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await mount(page, screen, language);
        const { problems, seen } = await audit(page);
        await page.screenshot({ path: resolve(SHOTS, `${screen}-${language}.png`), animations: 'disabled' });
        if (!seen) problems.push('no visible text');
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${seen} text boxes` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `pseudo-320-${results.length + 1}`).catch(() => null);
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
  console.log(`SUMMARY test:e2e:pseudo-320 checks=${results.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || results.length !== SCREENS.length * 2) process.exitCode = 1;
}

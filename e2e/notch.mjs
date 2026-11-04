// [night-11y] R5j, D-206: a notch / cut-out profile. Chromium cannot emulate env(safe-area-inset-*), so the four
// `--aw-safe-*` tokens (src/ui/base.css; every inset in the UI CSS goes through them, see test:safe-area) are set
// on :root to iPhone-like values — portrait 393×852 with 59/0/34/0 (top/right/bottom/left), landscape 852×393 with
// 0/59/21/59 — and each screen is mounted alone through its public API on ?perf=scene (no game, no globe, so the
// suite stays fast under SwiftShader): departures menu (with a notice), settings, puzzle board, weekly upgrade board,
// game over, in-game HUD. Every visible, unclipped button/select/link must lie inside the safe rectangle; scrolling
// containers are checked at the top and again scrolled to the end. PL + EN. Shots docs/shots/n11y/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, saveDiagnostics, ROOT, SEED } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11y');
const PROFILES = [
  { name: 'portrait', width: 393, height: 852, inset: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'landscape', width: 852, height: 393, inset: { top: 0, right: 59, bottom: 21, left: 59 } },
];
const SCREENS = ['menu', 'settings', 'puzzles', 'upgrade', 'gameover', 'hud'];
const results = [];

/** Mounts one screen into #app (the same modules the screen router and session use). */
async function mount(page, screen, language) {
  await page.evaluate(async ({ screen, language }) => {
    const { setLanguage } = await import('/src/i18n/index.ts');
    setLanguage(language);
    const host = document.getElementById('app');
    if (!host) throw new Error('Missing #app');
    if (screen === 'menu') {
      const { createMenu } = await import('/src/ui/menu/menu.ts');
      host.append(createMenu(() => {}, { bestPassengers: 1284, solvedPuzzles: 3, totalPuzzles: 40, today: new Date(2026, 10, 2),
        notice: language === 'pl' ? 'Zapisany lot nie może być kontynuowany.' : 'The saved flight cannot be continued.' }).element);
    } else if (screen === 'settings') {
      const { createSettings } = await import('/src/ui/settings/settings.ts');
      host.append(createSettings(() => {}, () => {}, () => {}, () => {}, () => {}).element);
    } else if (screen === 'puzzles') {
      const { mountPuzzleSelector } = await import('/src/ui/puzzles/index.ts');
      mountPuzzleSelector(host, () => {});
    } else if (screen === 'upgrade') {
      const { WeeklyUpgradeView } = await import('/src/ui/upgrade/index.ts');
      const view = new WeeklyUpgradeView(host, { onCommand: () => {}, onCancelPick: () => {}, onPreviewModel: () => {} });
      view.render({ week: 7, paused: true, pendingHub: false, offers: ['turboprop', 'widebody', 'hub-expansion'].map((id) => ({ id, week: 7 })) },
        [{ hubId: 'LON', waiting: 11, capacity: 12, label: 'LON' }]);
    } else if (screen === 'gameover') {
      const { mountGameOverPreview } = await import('/src/ui/gameover/preview.ts');
      mountGameOverPreview(host);
    } else if (screen === 'hud') {
      const { mountHud } = await import('/src/ui/hud/index.ts');
      mountHud(host, {}).render({ week: 3, day: 3, timeMinutes: 642, passengers: 1284, paused: false, speed: 1, canUndo: true,
        selectedPlane: 'turboprop', stock: { turboprop: 2, widebody: 1, hub: 0 } });
    }
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { screen, language });
  if (screen === 'gameover') await page.waitForSelector('[data-gameover-state="open"]', { timeout: 15000 });
  // Measure the settled layout: wait for the entrance animations (finite ones; at most 5 s).
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => null))),
    new Promise((done) => setTimeout(done, 5000)),
  ]));
  await page.waitForTimeout(100);
}

/**
 * Visible controls inside an inset band. A control a scrolling/hidden ancestor cuts off is measured by its visible
 * part. Inside a scroller that can still scroll up (down), content may legitimately pass under the top (bottom) inset,
 * so that side is not checked; the audit runs at the top and again at the end of every scroller.
 */
function audit(page, inset) {
  return page.evaluate((inset) => {
    const safe = { left: inset.left, top: inset.top, right: innerWidth - inset.right, bottom: innerHeight - inset.bottom };
    const problems = [];
    let seen = 0;
    for (const el of document.querySelectorAll('#app button, #app select, #app a[href], #app input, #app [role="button"]')) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.closest('[hidden], [aria-hidden="true"]')) continue;
      const v = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
      let upOpen = false, downOpen = false;
      for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const ns = getComputedStyle(node);
        if (ns.overflowX === 'visible' && ns.overflowY === 'visible') continue;
        const c = node.getBoundingClientRect();
        v.left = Math.max(v.left, c.left); v.top = Math.max(v.top, c.top); v.right = Math.min(v.right, c.right); v.bottom = Math.min(v.bottom, c.bottom);
        if (/(auto|scroll)/.test(ns.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          if (node.scrollTop > 0.5) upOpen = true;
          if (node.scrollTop + node.clientHeight < node.scrollHeight - 1) downOpen = true;
        }
      }
      if (v.right - v.left < 1 || v.bottom - v.top < 1) continue;
      seen++;
      const name = (el.dataset.testid || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
      const out = [];
      if (v.left < safe.left - 0.5) out.push(`left ${Math.round(v.left)} < ${safe.left}`);
      if (!upOpen && v.top < safe.top - 0.5) out.push(`top ${Math.round(v.top)} < ${safe.top}`);
      if (v.right > safe.right + 0.5) out.push(`right ${Math.round(v.right)} > ${safe.right}`);
      if (!downOpen && v.bottom > safe.bottom + 0.5) out.push(`bottom ${Math.round(v.bottom)} > ${safe.bottom}`);
      if (out.length) problems.push(`"${name}" in the inset (${out.join(', ')})`);
    }
    return { problems, seen };
  }, inset);
}

/** Scrolls every scrollable element inside #app to its end (second audit pass). */
function scrollToEnd(page) {
  return page.evaluate(() => {
    let scrolled = 0;
    for (const el of document.querySelectorAll('#app *')) {
      if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) { el.scrollTop = el.scrollHeight; scrolled++; }
    }
    return scrolled;
  });
}

let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of ['pl', 'en']) for (const profile of PROFILES) for (const screen of SCREENS) {
      const name = `${language}/${profile.name} ${profile.width}x${profile.height} ${screen}`;
      const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1,
        hasTouch: true, reducedMotion: 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.addInitScript((inset) => {
          const apply = () => { for (const side of Object.keys(inset)) document.documentElement.style.setProperty(`--aw-safe-${side}`, inset[side] + 'px'); };
          if (document.documentElement) apply(); else document.addEventListener('DOMContentLoaded', apply);
        }, profile.inset);
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await mount(page, screen, language);
        const first = await audit(page, profile.inset);
        const scrolled = await scrollToEnd(page);
        const second = scrolled ? await audit(page, profile.inset) : { problems: [], seen: 0 };
        if (language === 'en' || screen === 'menu') {
          await page.screenshot({ path: resolve(SHOTS, `${screen}-${language}-${profile.name}.png`), animations: 'disabled' });
        }
        const problems = [...first.problems, ...second.problems.map((p) => 'scrolled: ' + p)];
        if (first.seen + second.seen === 0) problems.push('no visible control found');
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${first.seen} controls${scrolled ? ` + ${second.seen} scrolled` : ''}` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `notch-${results.length + 1}`).catch(() => null);
        results.push({ name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { name, status, why } of results) {
    const line = `${status} ${name}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const total = 2 * PROFILES.length * SCREENS.length;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:notch seed=0x${SEED.toString(16).toUpperCase()} checks=${total} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

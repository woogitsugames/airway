// [night-11y] R5j, D-206: a notch / cut-out profile. Chromium cannot emulate env(safe-area-inset-*), so the four
// `--aw-safe-*` tokens (src/ui/base.css; every inset in the UI CSS goes through them, see test:safe-area) are set
// on :root to iPhone-like values — portrait 393×852 with 59/0/34/0 (top/right/bottom/left), landscape 852×393 with
// 0/59/21/59 — and each screen is mounted alone through its public API on ?perf=scene (no game, no globe, so the
// suite stays fast under SwiftShader): departures menu (with a notice), settings, puzzle board, weekly upgrade board,
// game over, in-game HUD. Every visible, unclipped button/select/link must lie inside the safe rectangle; scrolling
// containers are checked at the top and again scrolled to the end. PL + EN. Shots docs/shots/n11y/.
// [night-11z] D-209: + a small landscape phone (812×375, 0/50/21/50); the weekly board is mounted over the real HUD
// and must fit without scrolling (every label above the bottom inset), its sign beside the boarding pass with the
// line at least 120 px wide and at most 3 lines; + the training flight through its controller (route, aircraft and
// cleared steps), the ATC range strip and a first-time card: their paper panels must lie inside the safe rectangle too.
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
  { name: 'landscape-mini', width: 812, height: 375, inset: { top: 0, right: 50, bottom: 21, left: 50 } },
];
const SCREENS = ['menu', 'settings', 'puzzles', 'upgrade', 'upgrade-pick', 'gameover', 'hud', 'tutorial', 'atc', 'first-time'];
/** [night-11z] Text panels (no control of their own) that must keep clear of every inset as well. */
const PANELS = '#app .airway-atc-strip:not([hidden]), #app .aw-tutorial-strip, #app .aw-tutorial-ticket, #app .aw-tutorial-hint, #app .airway-upgrade-sign';
const TUTORIAL_STEPS = [
  null,
  { type: 'route', from: 'LON', to: 'PAR' },
  { type: 'assign-aircraft', route: 'LON-PAR' },
  { type: 'inspect-transfer', hub: 'PAR' },
];
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
    } else if (screen === 'upgrade' || screen === 'upgrade-pick') {
      // [night-11z] Over the real HUD (its own fixed host, as in the game layer), so the sign can be checked
      // against the boarding pass it sits beside.
      const hudHost = document.createElement('div');
      hudHost.style.cssText = 'position:fixed;inset:0;pointer-events:none';
      document.body.prepend(hudHost);
      const { mountHud } = await import('/src/ui/hud/index.ts');
      mountHud(hudHost, {}).render({ week: 7, day: 3, timeMinutes: 642, passengers: 1284, paused: true, speed: 1, canUndo: true,
        selectedPlane: 'turboprop', stock: { turboprop: 2, widebody: 1, hub: 0 } });
      const { WeeklyUpgradeView } = await import('/src/ui/upgrade/index.ts');
      // [night-46a] Its own host, as src/game/session.ts mounts it: the view makes its host the fixed overlay, and on
      // #app the id rule `#app { position: relative }` won, so a sheet that starts under the top margin (Linoryt,
      // D-301) was shifted down instead of shortened.
      const upgradeHost = document.createElement('div');
      upgradeHost.className = 'airway-upgrade-host';
      host.append(upgradeHost);
      const view = new WeeklyUpgradeView(upgradeHost, { onCommand: () => {}, onCancelPick: () => {}, onPreviewModel: () => {} });
      // [night-11ab] D-210: 'upgrade-pick' is the airport pick after the hub crate (the slots pick follows in auditPick).
      const pick = screen === 'upgrade-pick';
      view.render({ week: 7, paused: true, pendingHub: pick, ...(pick ? { selected: 'hub-expansion' } : {}),
        offers: ['turboprop', 'widebody', 'hub-expansion'].map((id) => ({ id, week: 7 })) },
        [{ hubId: 'LON', waiting: 11, capacity: 12, label: 'LON' }]);
      window.__notchView = view;
    } else if (screen === 'gameover') {
      const { mountGameOverPreview } = await import('/src/ui/gameover/preview.ts');
      mountGameOverPreview(host);
    } else if (screen === 'tutorial') {
      // [night-11z] The training flight through its controller, exactly as main.ts opens it.
      const { mountTutorial } = await import('/src/game/tutorial/index.ts');
      const screenHost = document.createElement('div');
      screenHost.className = 'airway-tutorial-screen';
      screenHost.style.cssText = 'position:fixed;inset:0';
      host.append(screenHost);
      window.__notchTutorial = mountTutorial(screenHost).controller;
      window.__notchTutorial.replay();
    } else if (screen === 'atc' || screen === 'first-time') {
      const layer = document.createElement('div');
      layer.className = 'airway-game-layer';
      host.append(layer);
      if (screen === 'atc') {
        const { mountAtcStrip } = await import('/src/ui/atcStrip.ts');
        mountAtcStrip(layer).show({ from: 'LON', to: 'SYD', distanceKm: 16990, rangeKm: 2500, aircraft: 'turboprop' });
      } else {
        const { t } = await import('/src/i18n/index.ts');
        const { FirstTimeRegistry } = await import('/src/game/tutorial/first-time.ts');
        const { mountFirstTimeCards } = await import('/src/game/tutorial/first-time-card.ts');
        const cards = mountFirstTimeCards(layer, new FirstTimeRegistry(null));
        cards.offer('hub-full', () => ({ tag: t('firstTime.tag.hubFull', { airport: 'LON', waiting: 26, capacity: 36 }),
          hint: t('firstTime.hint.hubFull', { airport: 'LON' }) }));
        cards.flush(false);
      }
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
  return page.evaluate(({ inset, panels }) => {
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
    // [night-11z] Paper panels: the whole box inside the safe rectangle (they never scroll).
    for (const el of document.querySelectorAll(panels)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      seen++;
      const out = [];
      if (r.left < safe.left - 0.5) out.push(`left ${Math.round(r.left)} < ${safe.left}`);
      if (r.top < safe.top - 0.5) out.push(`top ${Math.round(r.top)} < ${safe.top}`);
      if (r.right > safe.right + 0.5) out.push(`right ${Math.round(r.right)} > ${safe.right}`);
      if (r.bottom > safe.bottom + 0.5) out.push(`bottom ${Math.round(r.bottom)} > ${safe.bottom}`);
      if (out.length) problems.push(`panel .${el.classList[0]} in the inset (${out.join(', ')})`);
    }
    return { problems, seen };
  }, { inset, panels: PANELS });
}

/**
 * [night-11z] D-209: the weekly board fits the safe height without scrolling, every label ends above the bottom
 * inset, and the sign keeps a readable line (≥ 120 px wide, ≤ 3 lines) clear of the boarding pass.
 */
/**
 * [night-11ab] D-210: the airport pick (hub crate, then the "+2 slots" crate). Its sign must hold the Back tile, the
 * week (when shown) and the instruction inside its own box, keep the instruction ≥ 80 px wide and ≤ 3 lines, stay
 * clear of the boarding pass and of the live peg rack (its cable reaches 8 px left of the rack) and, beside the pass,
 * be no taller than the pass.
 */
async function auditPick(page) {
  const problems = [];
  for (const selected of ['hub-expansion', 'departure-slots']) {
    problems.push(...await page.evaluate(async (selected) => {
      if (selected !== 'hub-expansion') {
        window.__notchView.render({ week: 7, paused: true, pendingHub: true, selected,
          offers: ['turboprop', 'widebody', selected].map((id) => ({ id, week: 7 })) }, [], []);
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      }
      const out = [];
      const signEl = document.querySelector('.airway-upgrade-sign');
      if (!signEl) return [`${selected}: no sign`];
      const sign = signEl.getBoundingClientRect();
      for (const child of signEl.children) {
        const r = child.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // visually hidden
        if (r.left < sign.left - 0.5 || r.right > sign.right + 0.5 || r.top < sign.top - 0.5 || r.bottom > sign.bottom + 0.5) {
          out.push(`${selected}: .${child.classList[0]} outside the sign (${Math.round(r.right)} > ${Math.round(sign.right)})`);
        }
        if (child.scrollWidth > child.clientWidth + 1) out.push(`${selected}: .${child.classList[0]} text overflows by ${child.scrollWidth - child.clientWidth} px`);
      }
      const sub = signEl.querySelector('.airway-upgrade-sub');
      const r = sub.getBoundingClientRect();
      const lines = Math.round(r.height / parseFloat(getComputedStyle(sub).lineHeight));
      if (r.width < 80) out.push(`${selected}: instruction ${Math.round(r.width)} px wide`);
      if (lines > 3) out.push(`${selected}: instruction wraps to ${lines} lines`);
      const over = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const pass = document.querySelector('.airway-pass')?.getBoundingClientRect();
      if (pass && over(sign, pass)) out.push(`${selected}: sign over the boarding pass`);
      const dock = document.querySelector('.airway-dock')?.getBoundingClientRect();
      if (dock && over(sign, { left: dock.left - 8, right: dock.right, top: dock.top, bottom: dock.bottom })) {
        out.push(`${selected}: sign over the peg rack (${Math.round(sign.right)} > ${Math.round(dock.left - 8)})`);
      }
      if (pass && sign.top < pass.bottom && sign.height > pass.height + 1) {
        out.push(`${selected}: sign ${Math.round(sign.height)} px tall beside a ${Math.round(pass.height)} px pass`);
      }
      return out;
    }, selected));
  }
  return problems;
}

function auditBoard(page, inset) {
  return page.evaluate((inset) => {
    const problems = [];
    const overlay = document.querySelector('.airway-upgrade-open');
    if (!overlay) return ['no board'];
    const overflow = overlay.scrollHeight - overlay.clientHeight;
    if (overflow > 1) problems.push(`board scrolls ${overflow} px`);
    for (const tag of document.querySelectorAll('.airway-upgrade-tag')) {
      const bottom = tag.getBoundingClientRect().bottom;
      if (bottom > innerHeight - inset.bottom + 0.5) problems.push(`${tag.dataset.testid} ends at ${Math.round(bottom)} > ${innerHeight - inset.bottom}`);
    }
    const sub = document.querySelector('.airway-upgrade-sub');
    const r = sub.getBoundingClientRect();
    const lines = Math.round(r.height / parseFloat(getComputedStyle(sub).lineHeight));
    if (r.width < 120) problems.push(`sign line ${Math.round(r.width)} px wide`);
    if (lines > 3) problems.push(`sign line wraps to ${lines} lines`);
    const sign = document.querySelector('.airway-upgrade-sign').getBoundingClientRect();
    const pass = document.querySelector('.airway-pass')?.getBoundingClientRect();
    if (pass && sign.left < pass.right && sign.right > pass.left && sign.top < pass.bottom && sign.bottom > pass.top) {
      problems.push(`sign over the boarding pass (${Math.round(sign.left)} < ${Math.round(pass.right)})`);
    }
    return problems;
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
        const extra = screen === 'upgrade' ? await auditBoard(page, profile.inset) : screen === 'upgrade-pick' ? await auditPick(page) : [];
        // [night-11z] The training flight: each later step through the controller, audited again.
        for (const action of screen === 'tutorial' ? TUTORIAL_STEPS.slice(1) : []) {
          const ok = await page.evaluate((action) => window.__notchTutorial.submit(action), action);
          if (!ok) extra.push(`controller refused ${action.type}`);
          await page.waitForTimeout(150);
          const step = await audit(page, profile.inset);
          first.seen += step.seen;
          first.problems.push(...step.problems.map((p) => `${action.type}: ${p}`));
          if (language === 'en' && action.type === 'assign-aircraft') {
            await page.screenshot({ path: resolve(SHOTS, `${screen}-${language}-${profile.name}-transfer.png`), animations: 'disabled' });
          }
        }
        const scrolled = await scrollToEnd(page);
        const second = scrolled ? await audit(page, profile.inset) : { problems: [], seen: 0 };
        if (language === 'en' || screen === 'menu' || screen.startsWith('upgrade')) {
          await page.screenshot({ path: resolve(SHOTS, `${screen}-${language}-${profile.name}.png`), animations: 'disabled' });
        }
        const problems = [...first.problems, ...extra, ...second.problems.map((p) => 'scrolled: ' + p)];
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

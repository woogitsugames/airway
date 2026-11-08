// [night-07x] Long real-time play-through (manual QA, `npm run ui:long-play -- <lang> <w> <h> <speed> <minutes>`,
// defaults pl 412 915 1 20). The game clock runs at its own pace at 1x/2x/4x while the DEV bot plays one decision
// at a time through real Commands (`aw.botStep`), plane tags are dragged with the pointer, weekly cards and airport
// picks are clicked/tapped, and every few minutes the run is paused, rotated, saved, reloaded and continued; game
// overs are answered with "same world"/"new world". Logs a line per event and flags ISSUE lines (frozen clock,
// Continue mismatch, off-screen buttons, pick without a target, page errors). PNGs and log in .e2e/long-play/<tag>/.
// Do not edit sources while it runs: the Vite dev server reloads the page.
//
// [night-47a] GPT-19: `--render=stub` plays on the DEV stub world `?render=stub&clock=frozen` (D-254). Game time then
// passes only through `window.aw.advanceTicks` (one game hour per step, two bot decisions per hour like autoplay's
// 30-minute interval), so a 4-week run takes minutes instead of hours under SwiftShader. Options (stub only):
// `--weeks=N` game weeks to play (default 4; game overs are answered and the next run counts too), `--region=EUS`
// (home region picked on the menu select), `--licence=2|3` (the logbook is seeded so classes II/III are open, then
// the stamp select), `--weather=front` (DEV front, D-253), `--text=150` (Settings text size). Every game hour it
// audits: no page error, the clock advanced by the hour (unless the run left the game screen), no page or sheet
// scrolled by itself, no horizontal overflow, every visible control inside the screen, >= 48 px and hit-testable.
// Each game day a pause/resume (pause ring or Escape), each week a hub board (long press), a rotation for six game
// hours, Save -> reload -> Continue (tick and hash kept), and on alternate boards Undo right after the pick. An open
// weekly board must hold the clock (`advanceTicks` steps nothing). The positional `<minutes>` caps real time.
//
// [night-58a] D-313 (Q-92 → A) in play: after every completed weekly pick the dock's Undo must be disabled at once
// (the closed week is a barrier). On alternate picks the run then plays at least three game hours, until two network
// edits (bot decisions, plane drags) or twelve hours, and taps Undo until it greys out: every tap must keep the game
// screen (a run that ends in the past is an ISSUE), the pick and the clock, and the taps may never outnumber the edits
// made since the pick (Undo reaching past the barrier). A tablet is just another size (`1024 1366`); `--seed=N` sets
// the first run's seed for a repro.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, startVite, launchChromium } from './lib/harness.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const args = argv.filter((a) => !a.startsWith('--'));
const RENDER = flag('render', 'real');
if (!['real', 'stub'].includes(RENDER)) throw new Error(`--render must be "real" or "stub", got "${RENDER}"`);
const STUB = RENDER === 'stub';
const WEEKS = +flag('weeks', '4');
const REGION = flag('region', 'random');
const LICENCE = +flag('licence', '1');
const WEATHER = flag('weather', '');
const TEXT = +flag('text', '100');
// [night-58a] `--seed=N` (stub): the first run's seed instead of 0xA1A1 + w + h (later runs count on from it), for repros.
const SEED0 = flag('seed', null);
const [lang = 'pl', W = '412', H = '915', SPEED = '1', MINUTES = STUB ? '30' : '20'] = args;
const w = +W, h = +H, speed = +SPEED, minutes = +MINUTES;
const TAG = args[5] ?? (STUB
  ? `stub-${lang}-${w}x${h}-${REGION}-c${LICENCE}${WEATHER ? '-' + WEATHER : ''}${TEXT !== 100 ? '-t' + TEXT : ''}${SEED0 !== null ? '-s' + SEED0 : ''}`
  : `${lang}-${w}x${h}-${speed}x`);
const OUT = resolve(ROOT, '.e2e/long-play', TAG);
rmSync(OUT, { recursive: true, force: true }); // [night-47a] no PNGs of an earlier run under the same tag
mkdirSync(OUT, { recursive: true });
const log = [];
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(0);
const note = (kind, msg) => { const line = `[${el()}s] ${kind} ${msg}`; log.push(line); console.log(line); };
let rngState = 0x1234 + w + speed + (STUB ? h + LICENCE * 31 + TEXT : 0);
const rnd = () => { rngState = (rngState * 1103515245 + 12345) >>> 0; return rngState / 2 ** 32; };
let shotN = 0;
const shot = async (page, name) => { const p = `${OUT}/${String(++shotN).padStart(3, '0')}-${name}.png`; await page.screenshot({ path: p }).catch(() => {}); return p; };

const host = await startVite();
// [night-47a] Stub runs composite in software like the other stub suites (harness.mjs SOFTWARE_COMPOSITING_ARGS).
const browser = await launchChromium({ softwareCompositing: STUB });
const PAGE_URL = STUB
  ? `${host.url}?render=stub&clock=frozen${WEATHER ? `&weather=${WEATHER}` : ''}`
  : host.url;
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
await ctx.addInitScript(({ l, text, licence }) => {
  try {
    if (!sessionStorage.getItem('explore-init')) {
      localStorage.clear(); sessionStorage.setItem('explore-init', '1');
      // [night-47a] Classes II/III open only after logged class I/II weeks (D-273): the same logbook as licence-classes.
      if (licence > 1) localStorage.setItem('airway.logbook.v1', JSON.stringify({ flights: 3, passengers: 900, weeks: 10,
        longestWeeks: 5, hubs: {}, recent: [{ day: '2026-11-05', mode: 'endless', passengers: 300, weeks: 3, hub: null, licence: 2 }],
        licenceWeeks: { 1: 5, 2: 3 } }));
      if (text !== 100) {
        const v0 = JSON.parse(localStorage.getItem('airway.settings') || '{}');
        localStorage.setItem('airway.settings', JSON.stringify({ ...v0, textScale: text }));
      }
    }
    const v = JSON.parse(localStorage.getItem('airway.settings') || '{}');
    localStorage.setItem('airway.settings', JSON.stringify({ ...v, language: l }));
  } catch {}
}, { l: lang, text: TEXT, licence: LICENCE });
const page = await ctx.newPage();
page.on('pageerror', (e) => note('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') note('CONSOLE-' + m.type(), m.text().slice(0, 300)); });

const S = () => page.evaluate(() => window.aw.state());
async function boot() {
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.aw?.ready, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}
async function skipTutorialIfShown() {
  const skip = page.getByTestId('tutorial-skip');
  if (await skip.count() && await skip.isVisible()) { note('INFO', 'tutorial shown -> skip'); await skip.click(); await page.waitForTimeout(800); return true; }
  return false;
}
async function startRun(seed) {
  if (await skipTutorialIfShown()) { const st = await S(); if (st.screen === 'game') { note('RUN', 'started after tutorial'); return; } }
  await page.evaluate((s) => window.aw.prepareSeed(s), seed);
  await page.getByTestId('menu-endless').click();
  await page.waitForFunction(() => window.aw.state().screen === 'game', null, { timeout: 10000 });
  note('RUN', `started seed=${seed}`);
}
async function ensureSpeed() {
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('[data-hud-action="speed"]')?.getAttribute('data-speed'));
    if (cur === null || cur === undefined || +cur === speed) return;
    await page.locator('[data-hud-action="speed"]').click().catch((e) => note('WARN', 'speed click ' + e.message.split('\n')[0]));
    await page.waitForTimeout(200);
  }
  note('ISSUE', 'could not reach speed ' + speed);
}
async function layoutCheck(label) {
  const problems = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 2) out.push('horizontal scroll');
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect(); const st = getComputedStyle(b);
      if (!r.width || st.visibility === 'hidden' || st.display === 'none') continue;
      if (b.closest('[hidden]')) continue;
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) out.push(`button off-screen ${(b.dataset.testid || b.textContent || '').trim().slice(0, 30)} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return out;
  });
  if (problems.length) note('ISSUE', `${label}: ${problems.join('; ')}`);
}

let runs = 1, maxWeek = 0;

async function runReal() {
  await boot();
  let seed = 0xA1A1 + speed * 7 + w;
  await startRun(seed);
  await ensureSpeed();
  let lastTick = -1, lastTickChange = Date.now(), lastScreen = '';
  runs = 1;
  let nextPause = Date.now() + 45_000, nextSave = Date.now() + 240_000, nextRotate = Date.now() + 150_000, rotatedUntil = 0;
  const weeksShot = new Set();
  const end = t0 + minutes * 60_000;

  while (Date.now() < end) {
    let s;
    try { s = await S(); } catch (e) { note('ERROR', 'state ' + e.message); await page.waitForTimeout(1000); continue; }
    if (s.screen !== lastScreen) { note('SCREEN', `${lastScreen} -> ${s.screen} tick=${s.tick} routes=${s.routeCount} planes=${s.aircraftAssignments}`); lastScreen = s.screen; }
    if (s.tick !== lastTick) { lastTick = s.tick; lastTickChange = Date.now(); }
    const paused = await page.evaluate(() => !!document.querySelector('[data-testid="action-resume"]')?.offsetParent);
    if (s.screen === 'game' && !paused && Date.now() - lastTickChange > 15_000) { note('ISSUE', `clock stuck at tick ${s.tick} for 15 s`); await shot(page, 'stuck'); lastTickChange = Date.now(); }

    if (rotatedUntil && Date.now() > rotatedUntil) { await page.setViewportSize({ width: w, height: h }); rotatedUntil = 0; note('ROTATE', 'back'); await page.waitForTimeout(600); await layoutCheck('after rotate back'); }

    if (s.screen === 'game') {
      if (paused) {
        await page.getByTestId('action-resume').click().catch(() => {});
      } else if (Date.now() > nextSave) {
        nextSave = Date.now() + 300_000;
        await page.keyboard.press('Escape');
        await page.getByTestId('action-save').click({ timeout: 4000 }).catch((e) => note('ISSUE', 'save ' + e.message.split('\n')[0]));
        await page.waitForTimeout(400);
        const before = await S();
        note('SAVE', `tick=${before.tick} hash=${before.snapshotHash}`);
        await boot();
        const cont = page.getByTestId('menu-continue');
        if (await cont.count() === 0 || !(await cont.isVisible())) { note('ISSUE', 'no Continue after save + reload'); await shot(page, 'no-continue'); await startRun(++seed); }
        else {
          await cont.click();
          await page.waitForFunction(() => window.aw.state().screen !== 'menu', null, { timeout: 10000 }).catch(() => note('ISSUE', 'Continue did not leave the menu'));
          const after = await S();
          note('LOAD', `tick=${after.tick} hash=${after.snapshotHash} screen=${after.screen}`);
          if (after.tick !== before.tick) note('ISSUE', `continue tick ${after.tick} != saved ${before.tick}`);
          if (after.snapshotHash !== before.snapshotHash) note('ISSUE', `continue hash differs`);
          await shot(page, 'after-continue');
          const pausedAfter = await page.evaluate(() => !!document.querySelector('[data-testid="action-resume"]')?.offsetParent);
          note('INFO', `after continue paused=${pausedAfter}`);
        }
        await ensureSpeed();
      } else if (Date.now() > nextPause) {
        nextPause = Date.now() + 60_000 + rnd() * 60_000;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await layoutCheck('pause sheet');
        if (rnd() < 0.3) await shot(page, 'pause');
        await page.getByTestId('action-resume').click({ timeout: 4000 }).catch((e) => note('ISSUE', 'resume ' + e.message.split('\n')[0]));
      } else if (Date.now() > nextRotate && !rotatedUntil) {
        nextRotate = Date.now() + 240_000;
        await page.setViewportSize({ width: h, height: w });
        rotatedUntil = Date.now() + 40_000;
        note('ROTATE', `${h}x${w}`);
        await page.waitForTimeout(800);
        await layoutCheck('rotated game');
        await shot(page, 'rotated');
      } else {
        const r = rnd();
        if (r < 0.12) {
          // a real pointer drag of a plane tag onto a route when stock exists
          const g = await page.evaluate(() => { try { return window.aw.gesture('plane'); } catch { return null; } });
          if (g) {
            await page.mouse.move(g.from.x, g.from.y); await page.mouse.down();
            for (let i = 1; i <= 8; i++) await page.mouse.move(g.from.x + (g.to.x - g.from.x) * i / 8, g.from.y + (g.to.y - g.from.y) * i / 8);
            await page.mouse.up(); note('UI', 'plane drag');
          }
        } else {
          const cmd = await page.evaluate(() => window.aw.botStep()).catch((e) => { note('ERROR', 'botStep ' + e.message); return null; });
          if (cmd) note('BOT', cmd);
        }
      }
    } else if (s.screen === 'upgrade') {
      await page.waitForTimeout(1200);
      const info = await page.evaluate(() => ({
        picking: !!document.querySelector('.airway-upgrade-open.is-picking-hub'),
        offers: [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade),
        // [night-10m] A crate the run cannot use (e.g. "Expand hub" with no hub) is disabled; never pick it.
        enabled: [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => !n.disabled),
        week: document.querySelector('.airway-upgrade-week')?.textContent,
      }));
      if (info.picking) {
        const g = await page.evaluate(() => { try { return window.aw.gesture('pick'); } catch { return null; } });
        if (!g) { note('ISSUE', 'pick mode but no tappable target on screen'); await shot(page, 'pick-no-target'); await page.getByTestId('upgrade-pick-back').click().catch(() => {}); }
        else { await page.mouse.click(g.from.x, g.from.y); note('UI', 'pick tap'); await page.waitForTimeout(600);
          const still = await page.evaluate(() => !!document.querySelector('.airway-upgrade-open.is-picking-hub'));
          if (still) { note('ISSUE', 'pick tap did not complete'); await shot(page, 'pick-stuck'); await page.getByTestId('upgrade-pick-back').click().catch(() => {}); } }
      } else if (info.offers.length) {
        const wk = info.week;
        if (!weeksShot.has(wk)) { weeksShot.add(wk); await layoutCheck('board ' + wk); await shot(page, 'board'); maxWeek = Math.max(maxWeek, parseInt((wk || '').replace(/\D/g, '')) || 0); }
        const usable = info.offers.map((_, k) => k).filter((k) => info.enabled[k]);
        if (!usable.length) { note('ISSUE', 'weekly board with every crate disabled'); await shot(page, 'board-all-disabled'); }
        const i = usable.length ? usable[Math.floor(rnd() * usable.length)] : 0;
        note('UI', `${wk}: offers=${info.offers.join(',')} take ${info.offers[i]}`);
        await page.getByTestId(`upgrade-option-${i}`).click().catch((e) => note('ISSUE', 'card click ' + e.message.split('\n')[0]));
      } else { note('ISSUE', 'upgrade screen with no offers and no pick'); await shot(page, 'upgrade-empty'); await page.waitForTimeout(2000); }
    } else if (s.screen === 'gameover') {
      await page.waitForTimeout(1500);
      await layoutCheck('game over');
      await shot(page, 'gameover');
      const report = await page.evaluate(() => document.querySelector('[data-testid="game-over"]')?.innerText.replace(/\s+/g, ' ').slice(0, 400));
      note('GAMEOVER', report);
      const again = page.getByTestId('gameover-new');
      if (rnd() < 0.5 && await page.getByTestId('gameover-same').count()) { note('UI', 'same world'); await page.getByTestId('gameover-same').click(); }
      else if (await again.count()) { note('UI', 'new world'); await again.click(); } else await page.getByTestId('gameover-menu').click();
      await page.waitForTimeout(800);
      await skipTutorialIfShown();
      await page.waitForTimeout(400);
      const s2 = await S();
      if (s2.screen === 'menu') await startRun(++seed);
      runs++; note('RUN', `run #${runs}`);
      await ensureSpeed();
    } else if (s.screen === 'menu') {
      note('ISSUE', 'unexpected menu'); await shot(page, 'menu'); await startRun(++seed); await ensureSpeed();
    }
    await page.waitForTimeout(speed === 4 ? 1200 : 2500);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// [night-47a] GPT-19: the stub-world play-through (`--render=stub`). One loop step = one game hour.
// One tick is one game minute; the day and week lengths come from src/sim/params.ts through Vite (runStub), never a
// second literal here (test:week-source).
let WEEK_TICKS = 0, DAY_TICKS = 0;
let playedTicks = 0, hours = 0;
const done = { pauses: 0, hubBoards: 0, rotations: 0, continues: 0, undos: 0, boards: 0, barriers: 0, undoWalks: 0, undoRefusals: 0 };
/** [night-58a] An Undo walk to the weekly barrier waiting for its post-pick edits (null when none is due). */
let undoWalk = null;
const issueCounts = new Map();
const infoSeen = new Set();
/** One ISSUE line per distinct problem (later repeats are counted and summed up at the end). */
function issue(key, detail = '') {
  const n = (issueCounts.get(key) ?? 0) + 1;
  issueCounts.set(key, n);
  if (n === 1) note('ISSUE', detail ? `${key} :: ${detail}` : key);
  return n === 1;
}
const weekOf = (tick) => Math.floor(tick / WEEK_TICKS) + 1;
const advance = (ticks) => page.evaluate((n) => window.aw.advanceTicks(n), ticks);
const isPaused = () => page.evaluate(() => !!document.querySelector('[data-testid="action-resume"]')?.offsetParent);

/**
 * The per-hour audit: page and sheet scroll, overflow, and every visible control (button, select, link, input,
 * [role=button|tab]) on screen at >= 48 x 48 CSS px whose centre hit-tests to itself (a covered control is a problem).
 */
async function audit(label) {
  // Step-in motion first (a sheet fading in reads as transparent to checkVisibility), never an endless animation.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
    || a.effect?.getComputedTiming().endTime === Infinity), null, { timeout: 3000, polling: 50 }).catch(() => {});
  const found = await page.evaluate(() => {
    const out = [];
    const root = document.scrollingElement || document.documentElement;
    if (root.scrollTop || root.scrollLeft || window.scrollX || window.scrollY) out.push(['page scrolled', `${window.scrollX},${window.scrollY}`]);
    if (root.scrollWidth > innerWidth + 1) out.push(['horizontal overflow', `${root.scrollWidth} > ${innerWidth}`]);
    // A stable name per control (counts and times in aria labels are blanked, so one problem is one key).
    const name = (n) => (n.dataset?.testid || n.dataset?.hudAction || (n.dataset?.airport ? `${n.getAttribute('class')?.split(' ')[0]}[${n.dataset.airport}]` : '')
      || n.getAttribute('aria-label')?.replace(/\d+([:.]\d+)?/g, '#') || n.getAttribute('class') || n.tagName).toString().trim().slice(0, 48);
    const shown = (n) => n.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? !!n.offsetParent;
    for (const n of document.querySelectorAll('body *')) {
      if (!(n instanceof HTMLElement) || !n.clientHeight) continue;
      const st = getComputedStyle(n);
      if (!/(auto|scroll)/.test(st.overflowY + st.overflowX)) continue;
      if (!shown(n)) continue;
      // Focus moved into view (the report's first action) is the browser's doing on purpose, not a stale scroll.
      // Only a scroll that the focused control needs counts as that (in view now, out of view at the top).
      const f = document.activeElement;
      const nr = n.getBoundingClientRect(), fr = f && f !== document.body && n.contains(f) ? f.getBoundingClientRect() : null;
      const focused = !!fr && fr.top >= nr.top - 1 && fr.bottom <= nr.bottom + 1 && fr.bottom + n.scrollTop > nr.bottom + 1;
      if (n.scrollTop > 1 && !focused) out.push(['sheet opened scrolled', `${name(n)} scrollTop=${Math.round(n.scrollTop)}`]);
      if (/(auto|scroll)/.test(st.overflowX) && n.scrollWidth > n.clientWidth + 1) out.push(['sheet scrolls sideways', `${name(n)} ${n.scrollWidth}>${n.clientWidth}`]);
    }
    const scrollable = [...document.querySelectorAll('body *')].filter((n) => n instanceof HTMLElement && shown(n)
      && /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1).map(name);
    // Under an open modal (pause sheet, weekly board, game-over report) only its own controls can be reached.
    const modals = [...document.querySelectorAll('[aria-modal="true"]')]
      .filter((n) => !n.closest('[hidden]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    const info = [];
    for (const n of document.querySelectorAll('button, select, a[href], input, [role="button"], [role="tab"]')) {
      if (n.disabled && n.tagName !== 'BUTTON') continue;
      if (n.closest('[hidden], [inert], [aria-hidden="true"]') || !shown(n)) continue;
      if (modals.length && !modals.some((m) => m.contains(n))) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue; // not on screen at all
      // Inside a sheet that scrolls (the board or report at 150 %), a control below the fold or under the sheet's
      // sticky actions is reached by scrolling: only its size counts.
      let scroller = n.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      if (scroller && scroller !== document.documentElement && scroller !== document.body) {
        if (r.width < 47.5 || r.height < 47.5) out.push([`target < 48 px: ${name(n)}`, `${r.width.toFixed(1)}x${r.height.toFixed(1)}`]);
        continue;
      }
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
        out.push(['control partly off screen', `${name(n)} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`]);
        continue;
      }
      if (r.width < 47.5 || r.height < 47.5) out.push([`target < 48 px: ${name(n)}`, `${r.width.toFixed(1)}x${r.height.toFixed(1)}`]);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== n && !n.contains(top) && !top.contains(n) && !n.disabled) {
        // The first-time strip (R6a) stands over the map until OK or its timeout: noted, not an issue.
        if (top.closest('[data-testid="first-time-card"]')) info.push(`${name(n)} under the first-time card`);
        else out.push([`control covered: ${name(n)}`, `under ${name(top)}`]);
      }
    }
    // [night-58a] N58a: a running surge pennant printed paper on paper (an empty box). Text must stand off the nearest
    // painted background of its own box or an ancestor (>= 3:1); text straight over the map (no painted box up to
    // the page) is left to the ink suites, as are the D-08 glyphs (SVG).
    const lum = (rgb) => (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => Number(v) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const painted = (bg) => bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(bg);
    for (const n of document.querySelectorAll('body *')) {
      if (!(n instanceof HTMLElement) || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      if (!shown(n) || n.closest('[hidden]')) continue; // aria-hidden stubs are seen all the same
      const r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      let box = n, bg = null;
      for (; box && box !== document.body; box = box.parentElement) { const b = getComputedStyle(box).backgroundColor; if (painted(b)) { bg = b; break; } }
      if (!bg) continue;
      const a = lum(getComputedStyle(n).color), b = lum(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 3) out.push([`text on its background < 3:1: ${(name(n.closest('[data-airport]') ?? box) + ' ' + (n.getAttribute('class') || n.tagName)).slice(0, 80)}`, `${ratio.toFixed(2)}:1 "${n.textContent.trim().slice(0, 24)}"`]);
    }
    return { problems: out, scrollable, info };
  });
  for (const [key, detail] of found.problems) {
    if (issue(key, `${label}; ${detail}`)) await shot(page, 'issue-' + key.replace(/[^a-z0-9]+/gi, '-').slice(0, 40));
  }
  for (const line of found.info) if (!infoSeen.has(line)) { infoSeen.add(line); note('INFO', `${label}: ${line}`); }
  return found.scrollable;
}

const stubSeed = () => (SEED0 !== null ? +SEED0 : 0xA1A1 + w + h);
async function startStubRun(seed) {
  if (await skipTutorialIfShown()) {
    const st = await S();
    if (st.screen === 'game') { note('RUN', 'started from the tutorial: back to the menu'); }
  }
  await page.getByTestId('menu-home-region').waitFor({ timeout: 8000 });
  await page.getByTestId('menu-home-region').selectOption(REGION);
  if (LICENCE > 1) {
    const select = page.getByTestId('menu-licence');
    if (!(await select.count())) issue('licence select missing although the logbook opens class ' + LICENCE);
    else await select.selectOption(String(LICENCE));
  }
  await audit('menu');
  await page.evaluate((s) => window.aw.prepareSeed(s), seed);
  await page.getByTestId('menu-endless').click();
  await page.waitForFunction(() => window.aw.state().screen === 'game', null, { timeout: 10000 });
  const s = await S();
  note('RUN', `started seed=${seed} region=${s.homeRegion ?? 'random'} class=${s.licenceClass ?? 1}`);
  if (REGION !== 'random' && s.homeRegion !== REGION) issue('home region not applied', `${s.homeRegion} != ${REGION}`);
  if ((s.licenceClass ?? 1) !== LICENCE) issue('licence class not applied', `${s.licenceClass} != ${LICENCE}`);
}

/** Two bot decisions (or a real plane-tag drag) per game hour; the hour must move the clock while the game is shown. */
async function playHour() {
  const before = await S();
  for (let k = 0; k < 2; k++) {
    if (rnd() < 0.1) {
      const g = await page.evaluate(() => { try { return window.aw.gesture('plane'); } catch { return null; } });
      if (g) {
        await page.mouse.move(g.from.x, g.from.y); await page.mouse.down();
        for (let i = 1; i <= 8; i++) await page.mouse.move(g.from.x + (g.to.x - g.from.x) * i / 8, g.from.y + (g.to.y - g.from.y) * i / 8);
        await page.mouse.up(); note('UI', 'plane drag');
        if (undoWalk) undoWalk.edits++;
      }
    } else {
      const cmd = await page.evaluate(() => window.aw.botStep()).catch((e) => { note('ERROR', 'botStep ' + e.message); return null; });
      if (cmd && undoWalk) undoWalk.edits++;
    }
    await advance(30);
    if ((await S()).screen !== 'game') break;
  }
  const after = await S();
  hours++;
  playedTicks += Math.max(0, after.tick - before.tick);
  if (after.screen === 'game' && after.tick < before.tick + 60) {
    // A run whose board is pending or that ended would have left the game screen: a game screen that does not step
    // is the soft lock of N7x (Undo after a weekly pick).
    if (issue('clock did not advance on the game screen', `tick ${before.tick} -> ${after.tick}`)) await shot(page, 'clock-stuck');
  }
  return after;
}

async function pauseResume(viaKey) {
  const before = await S();
  if (viaKey) await page.keyboard.press('Escape');
  else await page.locator('.airway-pass__pause').click({ timeout: 4000 }).catch((e) => issue('pause ring click failed', e.message.split('\n')[0]));
  const shown = await page.getByTestId('action-resume').waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (!shown) { issue(`pause sheet did not open (${viaKey ? 'Escape' : 'pause ring'})`); await shot(page, 'no-pause'); return; }
  await audit('pause sheet');
  if (rnd() < 0.15) await shot(page, 'pause');
  await page.waitForTimeout(300);
  const mid = await S();
  if (mid.tick !== before.tick) issue('clock moved while paused', `${before.tick} -> ${mid.tick}`);
  await page.getByTestId('action-resume').click({ timeout: 4000 }).catch((e) => issue('resume click failed', e.message.split('\n')[0]));
  const closed = await page.getByTestId('action-resume').waitFor({ state: 'hidden', timeout: 4000 }).then(() => true, () => false);
  if (!closed) { issue('pause sheet did not close on Resume'); await shot(page, 'pause-stuck'); } else done.pauses++;
}

/** Long press on the airport with the most waiting passengers that is on screen; audit the hub board; close it. */
async function hubBoard() {
  const s = await S();
  const candidates = [...(s.airports ?? [])].sort((a, b) => b.waiting - a.waiting);
  for (const airport of candidates) {
    const at = await page.evaluate((id) => window.__awStub.airportPoint(id), airport.id);
    if (!at?.visible || at.x < 8 || at.y < 8 || at.x > page.viewportSize().width - 8 || at.y > page.viewportSize().height - 8) continue;
    const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? null, at);
    if (top !== 'airway-world') continue; // under the HUD or a tag: a player would press elsewhere
    await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up();
    const board = page.getByTestId('hub-board');
    if (!(await board.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))) {
      issue('long press did not open the hub board', airport.id); await shot(page, 'no-hub-board'); return;
    }
    await audit('hub board');
    if (rnd() < 0.3) await shot(page, 'hub-board');
    await page.getByTestId('hub-board-close').click({ timeout: 4000 }).catch((e) => issue('hub board close failed', e.message.split('\n')[0]));
    if (!(await board.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false))) issue('hub board did not close');
    if (await isPaused()) issue('closing the hub board left the game paused');
    note('UI', `hub board ${airport.id} waiting=${airport.waiting}`); done.hubBoards++;
    return;
  }
  note('INFO', 'hub board: no airport free to press on screen');
}

async function saveContinue() {
  await page.keyboard.press('Escape');
  await page.getByTestId('action-save').click({ timeout: 4000 }).catch((e) => issue('save click failed', e.message.split('\n')[0]));
  await page.waitForFunction(() => /\S/.test(document.querySelector('.airway-pause__status')?.textContent ?? ''), null, { timeout: 8000 })
    .catch(() => issue('no save confirmation on the pause sheet'));
  const before = await S();
  note('SAVE', `tick=${before.tick} hash=${before.snapshotHash}`);
  await boot();
  const cont = page.getByTestId('menu-continue');
  if (!(await cont.count()) || !(await cont.isVisible())) { issue('no Continue after save + reload'); await shot(page, 'no-continue'); return false; }
  await cont.click();
  await page.waitForFunction(() => window.aw.state().screen !== 'menu', null, { timeout: 10000 }).catch(() => issue('Continue did not leave the menu'));
  const after = await S();
  note('LOAD', `tick=${after.tick} hash=${after.snapshotHash} screen=${after.screen} region=${after.homeRegion ?? 'random'} class=${after.licenceClass ?? 1}`);
  if (after.tick !== before.tick) issue('Continue tick differs', `${after.tick} != ${before.tick}`);
  if (after.snapshotHash !== before.snapshotHash) issue('Continue hash differs', `${after.snapshotHash} != ${before.snapshotHash}`);
  if ((after.homeRegion ?? null) !== (before.homeRegion ?? null) || (after.licenceClass ?? 1) !== (before.licenceClass ?? 1)) issue('Continue lost region/class');
  await audit('after Continue'); done.continues++;
  if (await isPaused()) await page.getByTestId('action-resume').click().catch(() => {});
  return true;
}

let undoNext = true;
/** The weekly board: the clock must hold, the layout must pass, then a usable crate (or the airport pick). */
async function board() {
  const s = await S();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"] .airway-upgrade-model')]
    .every((n) => n.dataset.model), null, { timeout: 20000 }).catch(() => {});
  await advance(10);
  const held = await S();
  if (held.tick !== s.tick) issue('clock ran under the open weekly board', `${s.tick} -> ${held.tick}`);
  const info = await page.evaluate(() => ({
    picking: !!document.querySelector('.airway-upgrade-open.is-picking-hub'),
    offers: [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade),
    enabled: [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => !n.disabled),
    week: document.querySelector('.airway-upgrade-week')?.textContent?.trim(),
  }));
  if (info.picking) {
    const g = await page.evaluate(() => { try { return window.aw.gesture('pick'); } catch { return null; } });
    if (!g) { issue('pick mode but no tappable target on screen'); await shot(page, 'pick-no-target'); await page.getByTestId('upgrade-pick-back').click().catch(() => {}); return; }
    await page.mouse.click(g.from.x, g.from.y); await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.querySelector('.airway-upgrade-open.is-picking-hub'))) {
      issue('pick tap did not complete'); await shot(page, 'pick-stuck'); await page.getByTestId('upgrade-pick-back').click().catch(() => {});
    } else {
      note('UI', 'pick tap');
      const after = await S();
      if (after.screen === 'game') await afterPick(after, (after.upgrades ?? []).length, 'airport pick');
    }
    return;
  }
  if (!info.offers.length) { issue('upgrade screen with no offers and no pick'); await shot(page, 'upgrade-empty'); return; }
  done.boards++;
  const scroll = await audit(`board ${info.week}`);
  if (scroll.length) note('INFO', `board ${info.week} scrollable: ${scroll.join(', ')}`);
  await shot(page, `board-w${weekOf(s.tick - 1)}`);
  const usable = info.offers.map((_, k) => k).filter((k) => info.enabled[k]);
  if (!usable.length) { issue('weekly board with every crate disabled'); await shot(page, 'board-all-disabled'); }
  const i = usable.length ? usable[Math.floor(rnd() * usable.length)] : 0;
  note('UI', `${info.week}: offers=${info.offers.join(',')} take ${info.offers[i]}`);
  const taken = (s.upgrades ?? []).length;
  await page.getByTestId(`upgrade-option-${i}`).click({ timeout: 8000 }).catch((e) => issue('crate click failed', e.message.split('\n')[0]));
  await page.waitForTimeout(300);
  const after = await S();
  if (after.screen !== 'game') return; // an airport pick follows on the board
  await afterPick(after, taken + 1, info.offers[i]);
}

/**
 * [night-58a] D-313 (Q-92 → A): right after a completed pick (crate or airport) Undo is disabled; a tap on it changes
 * nothing. Every second pick also schedules an Undo walk after three game hours of edits (undoToBarrier).
 */
async function afterPick(after, upgradesNow, what) {
  const undo = page.locator('[data-hud-action="undo"]');
  done.barriers++;
  if (await undo.isEnabled().catch(() => false)) {
    if (issue('Undo enabled right after the weekly pick (D-313)', `${what} tick=${after.tick}`)) await shot(page, 'undo-enabled-after-pick');
    // N7x/Q-92: what a tap does then must still keep the choice and the run.
    await undo.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    const back = await S();
    done.undos++;
    if ((back.upgrades ?? []).length !== upgradesNow) issue('Undo after the weekly pick lost the choice', JSON.stringify(back.upgrades));
    if (back.screen !== 'game') { issue('Undo after the weekly pick ended the run in the past', `${back.screen} tick=${back.tick}`); await shot(page, 'undo-past'); }
    return;
  }
  undoNext = !undoNext; // every second completed pick
  if (undoNext) return;
  undoWalk = { what, tick: after.tick, upgrades: upgradesNow, edits: 0, hours: 3 };
}

/** [night-58a] Tap Undo until it greys out: the post-pick edits go one by one, never the pick, never the run. */
async function undoToBarrier() {
  const walk = undoWalk; undoWalk = null;
  const undo = page.locator('[data-hud-action="undo"]');
  let taps = 0;
  for (; taps <= walk.edits + 2; taps++) {
    // A queued edit reaches the HUD with the next frame; a zero-length wait lets it repaint.
    await page.waitForTimeout(50);
    if (!(await undo.isEnabled().catch(() => false))) break;
    const before = await S();
    await undo.click({ timeout: 4000 }).catch((e) => issue('Undo click failed', e.message.split('\n')[0]));
    await page.waitForTimeout(150);
    const back = await S();
    done.undos++;
    if (back.screen !== 'game') {
      if (issue('Undo ended the run in the past', `${walk.what} picked at tick ${walk.tick}; tap ${taps + 1} of ${walk.edits} edits -> ${back.screen} tick=${back.tick} (Q-93)`)) {
        await shot(page, 'undo-past'); // the HUD clock already reads the minute the re-simulated run ended
      }
      return;
    }
    if ((back.upgrades ?? []).length !== walk.upgrades) issue('Undo walk lost the weekly choice', JSON.stringify(back.upgrades));
    if (back.tick !== before.tick) issue('Undo moved the clock', `${before.tick} -> ${back.tick}`);
    // [night-60a] D-321 (Q-93 → A): an Undo whose re-simulation would end the run is refused. The run stays exactly as
    // it was (an accepted Undo always changes the hash: the journal is one command shorter) and the strip says why.
    if (back.snapshotHash === before.snapshotHash) {
      const notice = await page.locator('.airway-atc-strip[data-notice]').textContent({ timeout: 1000 }).catch(() => null);
      if (!notice) { issue('Undo tap changed nothing and said nothing (D-321)', `tap ${taps + 1} of ${walk.edits} edits`); await shot(page, 'undo-silent'); }
      done.undoRefusals++;
      done.undoWalks++;
      note('UI', `Undo walk after ${walk.what}: tap ${taps + 1} of ${walk.edits} edits refused (D-321): "${notice}"`);
      return;
    }
  }
  done.undoWalks++;
  if (taps > walk.edits) issue('Undo reached past the weekly pick', `${taps} taps > ${walk.edits} edits since ${walk.what}`);
  else if (await undo.isEnabled().catch(() => false)) issue('Undo still enabled after undoing every post-pick edit', `${taps} taps, ${walk.edits} edits`);
  note('UI', `Undo walk after ${walk.what}: ${taps} taps for ${walk.edits} edits, barrier held`);
}

async function gameOver() {
  await page.getByTestId('game-over').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await audit('game over');
  await shot(page, 'gameover');
  const s = await S();
  await page.getByTestId('game-over').waitFor({ state: 'visible', timeout: 5000 }).catch(() => issue('no game-over report on screen'));
  const report = await page.evaluate(() => document.querySelector('[data-testid="game-over"]')?.innerText.replace(/\s+/g, ' ').slice(0, 240));
  note('GAMEOVER', `week=${weekOf(s.tick)} tick=${s.tick} :: ${report}`);
  if (rnd() < 0.5 && await page.getByTestId('gameover-same').count()) { note('UI', 'same world'); await page.getByTestId('gameover-same').click(); }
  else if (await page.getByTestId('gameover-new').count()) { note('UI', 'new world'); await page.getByTestId('gameover-new').click(); }
  else await page.getByTestId('gameover-menu').click();
  await page.waitForTimeout(600);
  await skipTutorialIfShown();
  const s2 = await S();
  runs++;
  if (s2.screen === 'menu') await startStubRun(stubSeed() + runs);
  else {
    const n = await S();
    if ((n.licenceClass ?? 1) !== LICENCE) issue('restart changed the licence class', `${n.licenceClass}`);
    if (REGION !== 'random' && n.homeRegion !== REGION) issue('restart changed the home region', `${n.homeRegion}`);
  }
  note('RUN', `run #${runs}`);
}

async function runStub() {
  await boot();
  ({ WEEK_TICKS, DAY_TICKS } = await page.evaluate(async () => {
    const params = await import('/src/sim/params.ts');
    return { WEEK_TICKS: params.SIM_MINUTES_PER_WEEK, DAY_TICKS: params.SIM_MINUTES_PER_DAY };
  }));
  const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--airway-text-scale').trim());
  note('INFO', `stub world ${PAGE_URL} text-scale=${scale || '1'} weeks=${WEEKS}`);
  await startStubRun(stubSeed());
  const end = t0 + minutes * 60_000;
  let lastScreen = 'game';
  let rotatedHours = 0;
  // Per run: Save -> Continue in week 2, then every second week; one hub board and one rotation each week.
  let nextSaveWeek = 2, hubWeek = 0, rotateWeek = 0, pauseDay = -1;
  const newRun = () => { nextSaveWeek = 2; hubWeek = 0; rotateWeek = 0; pauseDay = -1; };
  while (Date.now() < end && playedTicks < WEEKS * WEEK_TICKS) {
    const s = await S();
    if (s.screen !== lastScreen) { note('SCREEN', `${lastScreen} -> ${s.screen} tick=${s.tick} week=${weekOf(s.tick)} routes=${s.routeCount} planes=${s.aircraftAssignments}`); lastScreen = s.screen; }
    maxWeek = Math.max(maxWeek, weekOf(s.tick));
    if (s.screen === 'game') {
      if (await isPaused()) { issue('game paused with nobody pausing it'); await page.getByTestId('action-resume').click().catch(() => {}); }
      const week = weekOf(s.tick), day = Math.floor(s.tick / DAY_TICKS), hourOfDay = Math.floor((s.tick % DAY_TICKS) / 60);
      if (rotatedHours > 0 && --rotatedHours === 0) {
        await page.setViewportSize({ width: w, height: h }); note('ROTATE', 'back'); await page.waitForTimeout(300);
        await audit('rotated back');
      }
      if (day !== pauseDay && hourOfDay >= 9) { pauseDay = day; await pauseResume(day % 2 === 1); }
      else if (week !== hubWeek && s.tick % WEEK_TICKS >= DAY_TICKS + 600) { hubWeek = week; await hubBoard(); }
      else if (week !== rotateWeek && s.tick % WEEK_TICKS >= 2 * DAY_TICKS) {
        rotateWeek = week; rotatedHours = 6; done.rotations++;
        await page.setViewportSize({ width: h, height: w }); note('ROTATE', `${h}x${w}`); await page.waitForTimeout(300);
        await audit('rotated'); await shot(page, 'rotated');
      } else if (week >= nextSaveWeek && s.tick % WEEK_TICKS >= 900) {
        nextSaveWeek = week + 2;
        if (rotatedHours > 0) { rotatedHours = 0; await page.setViewportSize({ width: w, height: h }); note('ROTATE', 'back (save)'); }
        await saveContinue();
      }
      const after = await playHour();
      if (undoWalk && after.screen === 'game' && --undoWalk.hours <= 0 && (undoWalk.edits >= 2 || undoWalk.hours <= -9)) await undoToBarrier();
      if (after.screen === 'game') {
        await audit(`game w${weekOf(after.tick)} d${Math.floor(after.tick / DAY_TICKS) + 1} ${String(Math.floor((after.tick % DAY_TICKS) / 60)).padStart(2, '0')}h`);
        // The R6a first-time card hides itself after a few real seconds; a stub hour takes ~0.1 s, so tap OK like a player.
        const card = await page.evaluate(() => { const c = document.querySelector('[data-testid="first-time-card"]'); return c && !c.hidden ? c.dataset.card : null; });
        if (card) {
          note('UI', `first-time card ${card} -> OK`);
          await page.getByTestId('first-time-ok').click({ timeout: 4000 }).catch((e) => issue('first-time OK click failed', e.message.split('\n')[0]));
        }
      }
    } else if (s.screen === 'upgrade') {
      await board();
    } else if (s.screen === 'gameover') {
      if (rotatedHours > 0) { rotatedHours = 0; await page.setViewportSize({ width: w, height: h }); }
      await gameOver();
      undoNext = true; undoWalk = null; newRun();
      lastScreen = 'game';
    } else if (s.screen === 'menu') {
      issue('unexpected menu'); await shot(page, 'menu'); await startStubRun(stubSeed() + ++runs); newRun(); undoWalk = null;
    } else { issue(`unexpected screen ${s.screen}`); await page.keyboard.press('Escape'); }
  }
  if (Date.now() >= end) note('INFO', `stopped by the ${minutes}-minute cap after ${(playedTicks / WEEK_TICKS).toFixed(1)} game weeks`);
  for (const [key, n] of issueCounts) if (n > 1) note('INFO', `x${n} ${key}`);
  note('INFO', `done ${Object.entries(done).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

if (STUB) await runStub(); else await runReal();
await shot(page, 'final');
const issues = log.filter((l) => /ISSUE|PAGEERROR|ERROR|CONSOLE-error/.test(l));
writeFileSync(`${OUT}/log.txt`, log.join('\n'));
const spent = ((Date.now() - t0) / 60_000).toFixed(1);
console.log(STUB
  ? `SUMMARY ui:long-play ${TAG} render=stub minutes=${spent} runs=${runs} maxWeek=${maxWeek} weeks=${(playedTicks / WEEK_TICKS).toFixed(1)} hours=${hours} issues=${issues.length}`
  : `SUMMARY ui:long-play ${TAG} minutes=${minutes} runs=${runs} maxWeek=${maxWeek} issues=${issues.length}`);
await browser.close(); await host.stop();
if (issues.length) process.exitCode = 1;

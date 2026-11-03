// [night-07x] Long real-time play-through (manual QA, `npm run ui:long-play -- <lang> <w> <h> <speed> <minutes>`,
// defaults pl 412 915 1 20). The game clock runs at its own pace at 1x/2x/4x while the DEV bot plays one decision
// at a time through real Commands (`aw.botStep`), plane tags are dragged with the pointer, weekly cards and airport
// picks are clicked/tapped, and every few minutes the run is paused, rotated, saved, reloaded and continued; game
// overs are answered with "same world"/"new world". Logs a line per event and flags ISSUE lines (frozen clock,
// Continue mismatch, off-screen buttons, pick without a target, page errors). PNGs and log in .e2e/long-play/<tag>/.
// Do not edit sources while it runs: the Vite dev server reloads the page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, startVite, launchChromium } from './lib/harness.mjs';

const args = process.argv.slice(2);
const [lang = 'pl', W = '412', H = '915', SPEED = '1', MINUTES = '20'] = args;
const w = +W, h = +H, speed = +SPEED, minutes = +MINUTES;
const TAG = args[5] ?? `${lang}-${w}x${h}-${speed}x`;
const OUT = resolve(ROOT, '.e2e/long-play', TAG);
mkdirSync(OUT, { recursive: true });
const log = [];
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(0);
const note = (kind, msg) => { const line = `[${el()}s] ${kind} ${msg}`; log.push(line); console.log(line); };
let rngState = 0x1234 + w + speed;
const rnd = () => { rngState = (rngState * 1103515245 + 12345) >>> 0; return rngState / 2 ** 32; };
let shotN = 0;
const shot = async (page, name) => { const p = `${OUT}/${String(++shotN).padStart(3, '0')}-${name}.png`; await page.screenshot({ path: p }).catch(() => {}); return p; };

const host = await startVite();
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
await ctx.addInitScript((l) => {
  try {
    if (!sessionStorage.getItem('explore-init')) { localStorage.clear(); sessionStorage.setItem('explore-init', '1'); }
    const v = JSON.parse(localStorage.getItem('airway.settings') || '{}');
    localStorage.setItem('airway.settings', JSON.stringify({ ...v, language: l }));
  } catch {}
}, lang);
const page = await ctx.newPage();
page.on('pageerror', (e) => note('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') note('CONSOLE-' + m.type(), m.text().slice(0, 300)); });

const S = () => page.evaluate(() => window.aw.state());
async function boot() {
  await page.goto(host.url, { waitUntil: 'load' });
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

await boot();
let seed = 0xA1A1 + speed * 7 + w;
await startRun(seed);
await ensureSpeed();
let lastTick = -1, lastTickChange = Date.now(), lastScreen = '', runs = 1;
let nextPause = Date.now() + 45_000, nextSave = Date.now() + 240_000, nextRotate = Date.now() + 150_000, rotatedUntil = 0;
const weeksShot = new Set();
const end = t0 + minutes * 60_000;
let maxWeek = 0;

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
      const i = Math.floor(rnd() * info.offers.length);
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
await shot(page, 'final');
const issues = log.filter((l) => /ISSUE|PAGEERROR|ERROR|CONSOLE-error/.test(l));
writeFileSync(`${OUT}/log.txt`, log.join('\n'));
console.log(`SUMMARY ui:long-play ${TAG} minutes=${minutes} runs=${runs} maxWeek=${maxWeek} issues=${issues.length}`);
await browser.close(); await host.stop();
if (issues.length) process.exitCode = 1;

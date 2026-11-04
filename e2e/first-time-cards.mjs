// [night-11p] R6a / D-130: the one-time "first time" cards in the real game. The DEV bot plays Endless on a fixed
// seed through real Commands (weekly boards answered on the real board, one plain card), the clock stepped 30 game
// minutes at a time; every card that appears is checked (strip on screen, aria-live, a 48 px "OK" that hides it) and
// dismissed. All four cards must appear (hub 70 % full, airport beyond turboprop range, first curfew night, first
// weekly board). A second run on the same install replays the same flight and must show none.
// EN 412×915 and PL 915×412; fails closed; shots docs/shots/n11p/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT } from './browser.mjs';

const SEED = 0xA1A2; // reaches week 4 under rules v6: its network has a hub over 70 %, a far airport and curfew nights
const CARDS = ['hub-full', 'out-of-range', 'curfew', 'weekly-board'];
const STEP_TICKS = 30;
const MAX_TICKS = 4 * 4320;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11p');
const results = [];
const CASES = [['en', { width: 412, height: 915 }], ['pl', { width: 915, height: 412 }]];

const cardState = (page) => page.evaluate(() => {
  const strip = document.querySelector('[data-testid="first-time-card"]');
  if (!strip || strip.hidden) return null;
  const box = strip.getBoundingClientRect();
  const ok = strip.querySelector('[data-testid="first-time-ok"]').getBoundingClientRect();
  return {
    card: strip.dataset.card, live: strip.getAttribute('aria-live'), text: strip.textContent,
    box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }, ok: { width: ok.width, height: ok.height },
    vw: innerWidth, vh: innerHeight,
  };
});

/** Plays the seed until every card was seen or the run ends; returns the cards in order of appearance. */
async function play(page, language, viewport, { shots }) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed, { firstTime: true }), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const seen = [];
  for (let ticks = 0; ticks < MAX_TICKS && seen.length < CARDS.length; ticks += STEP_TICKS) {
    const s = await page.evaluate(() => window.aw.state());
    if (s.screen === 'gameover') break;
    if (s.screen === 'upgrade') {
      const list = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
      const plain = list.findIndex((item) => item !== 'hub-expansion' && item !== 'departure-slots');
      await clickTestId(page, `upgrade-option-${plain < 0 ? 0 : plain}`);
      await page.waitForTimeout(150);
      continue;
    }
    await page.evaluate(() => window.aw.botStep());
    await page.evaluate((n) => window.aw.advanceTicks(n), STEP_TICKS);
    const card = await cardState(page);
    if (!card) continue;
    assert(CARDS.includes(card.card), `unknown card ${card.card}`);
    assert(!seen.includes(card.card), `${card.card} shown twice`);
    seen.push(card.card);
    assert(card.live === 'polite', `${card.card}: aria-live ${card.live}`);
    assert(card.text.trim().length > 20, `${card.card}: no text`);
    assert(card.box.left >= 0 && card.box.top >= 0 && card.box.right <= card.vw && card.box.bottom <= card.vh,
      `${card.card}: strip outside the screen ${JSON.stringify(card.box)}`);
    assert(card.ok.width >= 48 && card.ok.height >= 48, `${card.card}: OK ${card.ok.width}×${card.ok.height} < 48`);
    if (shots) await page.screenshot({ path: resolve(SHOTS, `${card.card}-${language}-${viewport.width}x${viewport.height}.png`) });
    await clickTestId(page, 'first-time-ok');
    assert(await cardState(page) === null, `${card.card}: OK did not hide the card`);
  }
  return seen;
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, viewport] of CASES) {
      const label = `${language} ${viewport.width}×${viewport.height}`;
      const { page, errors } = await newGamePage(browser, url, language, viewport);
      try {
        const first = await play(page, language, viewport, { shots: true });
        assert(CARDS.every((card) => first.includes(card)), `cards shown: ${first.join(', ') || 'none'}`);
        results.push({ label: `${label}: every first-time card once (${first.join(' → ')})`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `first-time-${language}-1`);
        results.push({ label: `${label}: every first-time card once`, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      try {
        // Same install: a reload and the same flight again. The harness wipes storage on every load, so the
        // install's storage is put back before the run starts (the registry is read when a run starts).
        const kept = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
        assert(JSON.parse(JSON.parse(kept)['aw-first-time'] ?? '{}').seen?.length === CARDS.length, `registry after run 1: ${kept}`);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => typeof window.aw === 'object');
        await page.evaluate((data) => { for (const [key, value] of Object.entries(JSON.parse(data))) localStorage.setItem(key, value); }, kept);
        const again = await play(page, language, viewport, { shots: false });
        assert(again.length === 0, `second run showed: ${again.join(', ')}`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label}: a second run shows none`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `first-time-${language}-2`);
        results.push({ label: `${label}: a second run shows none`, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:first-time-cards seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length * 2) process.exitCode = 1;
}

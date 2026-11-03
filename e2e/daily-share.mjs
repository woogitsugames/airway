// [night-10e] The daily game-over report shares the result: clipboard when the browser has no share sheet, the
// text to select when the clipboard is blocked too. The ticket carries the served regions (it read "--"), an
// official run adds the streak. On a daily, "Same world" starts a practice of the day and "New world" starts
// Endless (both used to drop to the menu). Real UI at 412×915, PL and EN; fails closed; shots into docs/shots/n10e/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, waitForScreen, clickTestId, dragGesture, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const STEPS = 4;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10e');
const results = [];

/** Yesterday's official run, so today's official makes a streak of two days. */
function seedYesterday(page) {
  return page.addInitScript(() => {
    if (localStorage.getItem('aw-daily-scores-v1')) return;
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() - 86_400_000));
    const official = { dateKey, kind: 'official', score: 90, weeks: 1, ticket: '--' };
    localStorage.setItem('aw-daily-scores-v1', JSON.stringify({ version: 1, nextAttemptId: 2, days: { [dateKey]: { attemptId: 1, official } } }));
  });
}

/** No share sheet anywhere; optionally no clipboard either (the "select the text" path). */
function stubPlatform(page, { clipboard }) {
  return page.addInitScript((withClipboard) => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    if (!withClipboard) Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => undefined });
  }, clipboard);
}

/** Menu → today's daily → one route → forced jam → game over; returns the daily seed. */
async function playDaily(page) {
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED); // skips the first-run tutorial only
  await clickTestId(page, 'menu-daily');
  await waitForScreen(page, 'game');
  const initial = await state(page);
  const route = await page.waitForFunction(() => { try { return window.aw.gesture('route'); } catch { return null; } },
    null, { timeout: 10000 }).then((handle) => handle.jsonValue());
  await dragGesture(page, route);
  await page.waitForFunction((n) => window.aw.state().routeCount === n + 1, initial.routeCount, { timeout: 8000 });
  await page.evaluate(() => window.aw.advanceTicks(120));
  await page.evaluate(() => window.aw.forceHubOverload());
  await waitForScreen(page, 'gameover', 20000);
  return initial.seed;
}

const cases = [
  ['en: share copies the result with ticket and streak', 'en', { clipboard: true }, async (page) => {
    await playDaily(page);
    await clickTestId(page, 'gameover-share');
    await page.waitForFunction(() => document.querySelector('[data-testid="gameover-share-status"]')?.textContent, null, { timeout: 5000 });
    const status = await page.locator('[data-testid="gameover-share-status"]').textContent();
    assert(status === 'Copied. Paste it anywhere.', `status "${status}"`);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    for (const want of ['AIRWAY / DAILY CHALLENGE', 'OFFICIAL RUN', 'SCORE ', 'WEEKS ', 'STREAK 2 DAYS']) {
      assert(text.includes(want), `missing "${want}" in ${JSON.stringify(text)}`);
    }
    const ticket = /ROUTE (\S+)/.exec(text)?.[1] ?? '';
    assert(/^[‹⋈◖⌑⟆⟧⌒⌐]+$/u.test(ticket), `ticket "${ticket}" is not a served-region ticket`);
    assert(!text.includes('{') && !/\p{Extended_Pictographic}/u.test(text), `token or emoji in ${JSON.stringify(text)}`);
    await page.screenshot({ path: resolve(SHOTS, 'gameover-share-copied-en-412x915.png') });
  }],
  ['pl: without share and clipboard the text is shown to select', 'pl', { clipboard: false }, async (page) => {
    await playDaily(page);
    await clickTestId(page, 'gameover-share');
    const box = page.locator('[data-testid="gameover-share-text"]');
    await box.waitFor({ timeout: 5000 });
    const status = await page.locator('[data-testid="gameover-share-status"]').textContent();
    assert(status === 'Udostępnianie jest tu niedostępne. Zaznacz tekst:', `status "${status}"`);
    const text = await box.inputValue();
    for (const want of ['AIRWAY / WYZWANIE DNIA', 'PRÓBA OFICJALNA', 'WYNIK ', 'BILET ', 'SERIA 2 DNI']) {
      assert(text.includes(want), `missing "${want}" in ${JSON.stringify(text)}`);
    }
    const share = await page.locator('[data-testid="gameover-share"]').boundingBox();
    assert(share && share.height >= 48, `share button ${share?.height} px < 48`);
    await page.screenshot({ path: resolve(SHOTS, 'gameover-share-select-pl-412x915.png') });
  }],
  ['en: "Same world" after a daily starts a practice of the same world', 'en', { clipboard: true }, async (page) => {
    const seed = await playDaily(page);
    await clickTestId(page, 'gameover-same');
    await waitForScreen(page, 'game');
    const now = await state(page);
    const active = await page.evaluate(() => JSON.parse(localStorage.getItem('aw-daily-active-v1') || 'null'));
    assert(now.seed === seed, `seed ${now.seed} != daily ${seed}`);
    assert(active?.kind === 'practice', `active run ${JSON.stringify(active)}`);
  }],
  ['en: "New world" after a daily starts Endless on another seed', 'en', { clipboard: true }, async (page) => {
    const seed = await playDaily(page);
    await clickTestId(page, 'gameover-new');
    await waitForScreen(page, 'game');
    const now = await state(page);
    const active = await page.evaluate(() => JSON.parse(localStorage.getItem('aw-daily-active-v1') || 'null'));
    assert(now.seed !== seed, 'new world kept the daily seed');
    assert(active === null, `a daily is still active: ${JSON.stringify(active)}`);
  }],
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [label, language, platform, run] of cases) {
      if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); continue; }
      const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true,
        reducedMotion: 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US',
        permissions: platform.clipboard ? ['clipboard-read', 'clipboard-write'] : [] });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await seedYesterday(page);
        await stubPlatform(page, platform);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
        await waitForScreen(page, 'menu');
        await run(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `daily-share-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
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
  console.log(`SUMMARY test:e2e:daily-share seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

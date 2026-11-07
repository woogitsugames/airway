// [night-10n] Logbook screen: the departure board's service row opens it (settings beside it, both ≥ 48 px), a
// fresh device shows the empty page, a real Endless game over (bot to week 2 + forced jam) logs one flight that
// matches the best record, and a full seeded logbook fits 320×568 (PL) and 915×412 (EN) with no clipped cell and no
// horizontal scroll. Shots into docs/shots/n10n/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gameUrl, skinShotsDir, withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['logbook'].seeds[0];

const STEPS = 4;
const started = performance.now();
const SHOTS = skinShotsDir(resolve(ROOT, 'docs/shots/n10n')); // [night-29b] U4: --skin=linoryt keeps them out of docs/
const results = [];

/** Service row: both halves inside the viewport, ≥ 48 px, apart, titles not clipped. [night-23a] Róża (D-257) sets the
 *  two as their own entries on the menu rose's arc (one above the other), so "on one line" became "not overlapping",
 *  and the title checked is the one shown (Róża's Alegreya title; the split-flap is hidden there). */
async function checkServiceRow(page) {
  const facts = await page.evaluate(() => {
    const ids = ['menu-settings', 'menu-logbook'];
    return ids.map((id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      if (!node) return { id, missing: true };
      const box = node.getBoundingClientRect();
      const title = [node.querySelector('.roza-title'), node.querySelector('.split-flap')]
        .find((el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
      const t = title?.getBoundingClientRect();
      return { id, top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height, width: box.width,
        clipped: title ? title.scrollWidth > title.clientWidth + 1 || t.left < box.left - 0.5 || t.right > box.right + 0.5 : true,
        vw: innerWidth, vh: innerHeight };
    });
  });
  for (const fact of facts) {
    assert(!fact.missing, `${fact.id} missing`);
    assert(fact.height >= 48 && fact.width >= 48, `${fact.id} target ${Math.round(fact.width)}×${Math.round(fact.height)}`);
    assert(fact.left >= 0 && fact.right <= fact.vw && fact.top >= 0 && fact.bottom <= fact.vh, `${fact.id} outside the viewport`);
    assert(!fact.clipped, `${fact.id} title clipped`);
  }
  const [a, b] = facts;
  assert(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5,
    'settings and logbook overlap');
}

/** Logbook page: no horizontal scroll, no clipped table cell or value, Back is a 48 px target. */
async function checkPage(page) {
  const facts = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="logbook"]');
    const clipped = [...root.querySelectorAll('td, th, dd, dt')]
      .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent);
    const back = root.querySelector('.airway-settings__back').getBoundingClientRect();
    return { clipped, scroll: document.documentElement.scrollWidth > innerWidth || root.scrollWidth > root.clientWidth + 1,
      back: back.height, text: root.textContent };
  });
  assert(!facts.clipped.length, `clipped: ${facts.clipped.join(' | ')}`);
  assert(!facts.scroll, 'horizontal scroll');
  assert(facts.back >= 48, `Back ${facts.back} px`);
  assert(!facts.text.includes('{'), `template token: ${facts.text}`);
  return facts.text;
}

function fullLogbook() {
  const hubs = ['NYC', 'LIS', 'SAO', 'JNB', 'SYD', 'TYO'];
  return {
    flights: 1234, passengers: 9876543, weeks: 4321, longestWeeks: 37,
    hubs: { NYC: 3, LIS: 7, SAO: 2 },
    recent: hubs.map((hub, i) => ({ day: `2026-10-${String(28 - i).padStart(2, '0')}`, mode: i % 2 ? 'daily' : 'endless',
      passengers: 123456 - i * 1000, weeks: 37 - i, hub })),
  };
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    const run = async (label, language, viewport, body) => {
      if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); return; }
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, viewport);
      try {
        await waitForScreen(page, 'menu');
        await body(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `logbook-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    };

    await run('en 412×915: service row, empty logbook, Back to menu', 'en', { width: 412, height: 915 }, async (page) => {
      await page.waitForTimeout(1200); // split-flap rows settle
      await checkServiceRow(page);
      await page.screenshot({ path: resolve(SHOTS, 'menu-en-412x915.png') });
      await clickTestId(page, 'menu-logbook');
      await waitForScreen(page, 'logbook');
      const text = await checkPage(page);
      assert(text.includes('No flights logged yet'), 'empty state missing');
      assert(text.includes('Kept on this device only.'), 'local note missing');
      await page.screenshot({ path: resolve(SHOTS, 'logbook-empty-en-412x915.png') });
      await page.locator('[data-testid="logbook"] .airway-settings__back').click();
      await waitForScreen(page, 'menu');
    });

    await run('pl 412×915: a real game over logs one flight', 'pl', { width: 412, height: 915 }, async (page) => {
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      const s = await page.evaluate(() => window.aw.autoplay(2));
      if (s.screen === 'upgrade') {
        const enabled = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => !n.disabled && !['hub-expansion', 'departure-slots'].includes(n.dataset.upgrade)));
        await clickTestId(page, `upgrade-option-${enabled.indexOf(true)}`);
        await waitForScreen(page, 'game');
      }
      await page.evaluate(() => window.aw.forceHubOverload());
      await waitForScreen(page, 'gameover', 20000);
      await page.getByTestId('game-over').waitFor({ timeout: 5000 });
      await clickTestId(page, 'gameover-menu');
      await waitForScreen(page, 'menu');
      const stored = await page.evaluate(() => ({
        book: JSON.parse(localStorage.getItem('airway.logbook.v1') ?? 'null'),
        best: JSON.parse(localStorage.getItem('airway.gameover.best.v1') ?? 'null'),
      }));
      assert(stored.book?.flights === 1, `flights ${stored.book?.flights}`);
      assert(stored.best && stored.book.passengers === stored.best.score, `passengers ${stored.book?.passengers} vs best ${stored.best?.score}`);
      assert(stored.book.weeks === stored.best.weeks, `weeks ${stored.book.weeks} vs ${stored.best.weeks}`);
      assert(/^[A-Z]{3}$/.test(stored.book.recent[0]?.hub ?? ''), `hub ${stored.book.recent[0]?.hub}`);
      await clickTestId(page, 'menu-logbook');
      await waitForScreen(page, 'logbook');
      const text = await checkPage(page);
      const rows = await page.locator('.airway-logbook__flights tbody tr').count();
      assert(rows === 1, `${rows} logbook rows`);
      assert(text.includes('Bez końca'), 'mode missing');
      assert(text.includes(stored.book.recent[0].hub), 'hub code missing');
      const flights = await page.locator('[data-row="flights"] dd').textContent();
      assert(flights === '1', `flights cell ${flights}`);
      await page.screenshot({ path: resolve(SHOTS, 'logbook-one-pl-412x915.png') });
    });

    for (const [language, width, height] of [['pl', 320, 568], ['en', 915, 412]]) {
      await run(`${language} ${width}×${height}: full logbook fits`, language, { width, height }, async (page) => {
        await page.evaluate((book) => {
          localStorage.setItem('airway.logbook.v1', JSON.stringify(book));
          localStorage.setItem('airway.gameover.best.v1', JSON.stringify({ score: 123456, weeks: 37, seed: 7 }));
        }, fullLogbook());
        await page.waitForTimeout(1200);
        await checkServiceRow(page);
        await page.screenshot({ path: resolve(SHOTS, `menu-${language}-${width}x${height}.png`) });
        await clickTestId(page, 'menu-logbook');
        await waitForScreen(page, 'logbook');
        const text = await checkPage(page);
        const favourite = language === 'pl' ? 'Lizbona · LIS · 7 lotów' : 'Lisbon · LIS · 7 flights';
        assert(text.includes(favourite), `favourite hub "${favourite}" missing`);
        const rows = await page.locator('.airway-logbook__flights tbody tr').count();
        assert(rows === 6, `${rows} rows`);
        await page.screenshot({ path: resolve(SHOTS, `logbook-full-${language}-${width}x${height}.png`), fullPage: false });
        await page.locator('.airway-logbook__flights').scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(SHOTS, `logbook-full-${language}-${width}x${height}-flights.png`) });
      });
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:logbook seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

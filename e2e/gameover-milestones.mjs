// [night-12ax] R1n, D-242: Endless milestones on the game-over report and in the logbook, on fixture data (no full-globe
// run, G7). The DEV game-over preview (`?preview=gameover`, worst case: three departures, three causes, a tip, seven
// milestones, two first-time stamps) is checked in PL/EN at 412×915, 360×640, 320×568 and 915×412: the row shows
// seven items, a reached mark is filled and an open one hollow, every action stays on screen without scrolling,
// the first-time stamp fades in only with motion on (none under "Reduce motion"). The logbook page lists the
// milestones with the flight of the first reach. Shots docs/shots/n12ax/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n12ax');
const results = [];
const sizes = [['pl', 412, 915], ['en', 412, 915], ['pl', 360, 640], ['en', 320, 568], ['pl', 915, 412]];
const STEPS = sizes.length + 2;

async function openPreview(page, url) {
  await page.goto(url + '?preview=gameover', { waitUntil: 'load' });
  await page.getByTestId('game-over').waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
}

async function facts(page) {
  return page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
    const row = document.querySelector('[data-testid="gameover-milestones"]');
    // [night-81a] D-336: on UI-A's print-out (D-332) the row is printed on the roll, which scrolls inside: bring it into view.
    if (row?.closest('.bd-print')) row.scrollIntoView({ block: 'nearest' });
    const items = [...(row?.querySelectorAll('.airway-go-milestone') ?? [])].map((li) => {
      const mark = getComputedStyle(li.querySelector('.airway-go-milestone-mark'));
      const stamp = li.querySelector('.airway-go-milestone-first');
      return { id: li.dataset.milestone, reached: li.dataset.reached, first: li.dataset.first === 'true', label: li.getAttribute('aria-label'),
        fill: mark.backgroundColor, border: mark.borderTopStyle, stamp: stamp ? getComputedStyle(stamp).animationName : null,
        stampShown: stamp ? getComputedStyle(stamp).display !== 'none' : false };
    });
    const buttons = ['gameover-same', 'gameover-new', 'gameover-menu'].map((id) => box(document.querySelector(`[data-testid="${id}"]`)));
    return { title: row?.querySelector('.airway-go-milestones-title')?.textContent ?? null, items, buttons,
      row: row ? box(row) : null, scrollTop: document.querySelector('.airway-go-overlay')?.scrollTop ?? 0 };
  });
}

async function run(label, language, viewport, options, body) {
  return { label, language, viewport, options, body };
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    const cases = [];
    for (const [language, width, height] of sizes) {
      cases.push(await run(`${language} ${width}×${height}: milestone row, actions on screen`, language, { width, height }, {}, async (page) => {
        await openPreview(page, url);
        const f = await facts(page);
        assert(f.title === (language === 'pl' ? 'Etapy 7/7' : 'Milestones 7/7'), `title ${f.title}`);
        assert(f.items.length === 7, `${f.items.length} items`);
        assert(f.items.every((item) => item.reached === 'true' && item.fill !== 'rgba(0, 0, 0, 0)' && item.border === 'solid'), 'reached marks filled');
        assert(f.items.filter((item) => item.first).map((item) => item.id).join() === 'week-4,passengers-750', 'first-time stamps');
        assert(f.items.every((item) => item.label && !item.label.includes('{')), 'spoken labels');
        assert(f.items.filter((item) => item.stamp !== null).every((item) => item.stamp === 'none' || !item.stampShown), 'no stamp motion under reduce');
        for (const b of f.buttons) assert(b.top >= -0.5 && b.bottom <= height + 0.5 && b.height >= 47.5, `action off-screen or small ${JSON.stringify(b)}`);
        assert(f.scrollTop === 0, `report scrolled ${f.scrollTop}`);
        // Never under an action ([night-81a] D-336: UI-A's landscape report puts the actions in a column beside the roll).
        assert(f.row && f.buttons.every((b) => f.row.bottom <= b.top + 0.5 || f.row.right <= b.left + 0.5), 'milestone row under the actions');
        await page.screenshot({ path: resolve(SHOTS, `gameover-milestones-${language}-${width}x${height}.png`) });
      }));
    }
    cases.push(await run('en 412×915 motion on: the first-time stamp fades in once; an open mark is hollow', 'en',
      { width: 412, height: 915 }, { reducedMotion: 'no-preference' }, async (page) => {
        await openPreview(page, url);
        const f = await facts(page);
        const stamps = f.items.filter((item) => item.first);
        // [night-81a] D-336: UI-A prints the stamp still (D-332: no hit, no motion on the print-out).
        const board = await page.evaluate(() => document.documentElement.dataset.skin === 'board');
        assert(stamps.length === 2 && stamps.every((item) => item.stamp === (board ? 'none' : 'airway-go-stamp') && item.stampShown), JSON.stringify(stamps));
        // An open milestone: hollow square (border, no fill), told apart by shape.
        const open = await page.evaluate(() => {
          const li = document.querySelector('.airway-go-milestone');
          li.dataset.reached = 'false';
          const mark = getComputedStyle(li.querySelector('.airway-go-milestone-mark'));
          return { fill: mark.backgroundColor, border: mark.borderTopStyle, width: mark.borderTopWidth };
        });
        assert(open.fill === 'rgba(0, 0, 0, 0)' && open.border === 'solid' && parseFloat(open.width) >= 1, `open mark ${JSON.stringify(open)}`);
      }));
    cases.push(await run('pl 320×568: logbook lists milestones with the first flight', 'pl', { width: 320, height: 568 }, {}, async (page) => {
      await page.evaluate(() => localStorage.setItem('airway.logbook.v1', JSON.stringify({ flights: 6, passengers: 900, weeks: 9,
        longestWeeks: 3, hubs: {}, recent: [], milestones: { 'first-hub': 1, 'week-2': 2, 'week-3': 5, 'passengers-500': 7 } })));
      await waitForScreen(page, 'menu', 12000); // the page clears storage on navigation: no reload, the logbook reads it on open
      await clickTestId(page, 'menu-logbook');
      await waitForScreen(page, 'logbook');
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="milestones"] [data-row]')]
        .map((cell) => [cell.dataset.row, cell.dataset.reached, cell.querySelector('dd').textContent]));
      assert(rows.length === 7, `${rows.length} rows`);
      assert(JSON.stringify(rows[0]) === JSON.stringify(['first-hub', 'true', 'pierwszy raz w locie 1']), JSON.stringify(rows[0]));
      assert(JSON.stringify(rows[3]) === JSON.stringify(['week-3', 'true', 'pierwszy raz w locie 5']), JSON.stringify(rows[3]));
      assert(rows[5][1] === 'false' && rows[5][2] === 'jeszcze nie', 'a run number above the flights is dropped');
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert(!scroll, 'horizontal scroll');
      await page.locator('[data-testid="milestones"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(SHOTS, 'logbook-milestones-pl-320x568.png') });
    }));
    for (const item of cases) {
      const { page, errors } = await newGamePage(browser, url, item.language, item.viewport, item.options);
      try {
        await item.body(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: item.label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-milestones-${results.length + 1}`);
        results.push({ label: item.label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
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
  console.log(`SUMMARY test:e2e:gameover-milestones steps=${results.length} passed=${passed} failed=${failedCount} ` +
    `durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

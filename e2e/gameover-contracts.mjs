// [night-33a] D-271: weekly contracts met, one row on the Endless game-over report, under the milestones.
// Fixture part (no full-globe run, G7): the DEV preview `?preview=gameover` (worst case: four departures, three causes,
// a tip, seven milestones) with `&contracts=<marks>` at 412×915, 360×640, 320×568 and 915×412 in PL and EN: the row is
// visible with "Kontrakty: 4 z 6" / "Contracts: 4 of 6", one square per contract (filled = met, hollow = missed, by
// shape), a spoken label with both numbers, the report does not scroll, the row lies under the milestones row (beside it on a
// short landscape screen when both fit) and above whatever follows it, every action stays on screen ≥ 48 px. Then none met (0/6), all met (6/6), a long run (11 squares
// at 320×568, 14 at 360×640 and 915×412) and `contracts=none` (no row). Session part: a real Endless run (bot to the week-3 board or an earlier jam, then a forced jam)
// prints the row from the run's contracts, consistent with its marks; `--render=stub` plays it on the DEV stub world.
// `--skin=linoryt` runs the same checks on the Linoryt preview (shots to .e2e/). Shots docs/shots/gpt01/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SKIN, RENDER,
  gameUrl, skinUrl, skinShotsDir } from './browser.mjs';

const SEED = 0xA1A1;
const started = performance.now();
const SHOTS = skinShotsDir(resolve(ROOT, 'docs/shots/gpt01'));
const results = [];
const sizes = [['pl', 412, 915], ['en', 412, 915], ['pl', 360, 640], ['en', 360, 640], ['pl', 320, 568], ['en', 320, 568],
  ['pl', 915, 412], ['en', 915, 412]];
// [marks, language, width, height, shot name]: none met, all met (PL and EN, a phone and a landscape size), a long run.
// A long run: 11 squares still share the title's line at 320 px, 14 at 360 px (a longer run wraps, D-292).
const states = [['000000', 'pl', 360, 640, 'none'], ['000000', 'en', 915, 412, 'none'], ['111111', 'pl', 915, 412, 'all'],
  ['111111', 'en', 360, 640, 'all'], ['10110100101', 'en', 320, 568, 'long'], ['10110100101101', 'pl', 360, 640, 'long'],
  ['10110100101101', 'pl', 915, 412, 'long']];
const TITLE = { pl: (met, n) => `Kontrakty: ${met} z ${n}`, en: (met, n) => `Contracts: ${met} of ${n}` };
const LABEL = { pl: (met, n) => `Spełnione kontrakty tygodnia: ${met} z ${n}`, en: (met, n) => `Weekly contracts met: ${met} of ${n}` };

async function openPreview(page, url, marks) {
  await page.goto(skinUrl(url + '?preview=gameover&contracts=' + marks), { waitUntil: 'load' });
  await page.getByTestId('game-over').waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
}

async function facts(page) {
  return page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width }; };
    const row = document.querySelector('[data-testid="gameover-contracts"]');
    const title = row?.querySelector('.airway-go-milestones-title');
    const marks = [...(row?.querySelectorAll('.airway-go-milestone') ?? [])].map((li) => {
      const mark = li.querySelector('.airway-go-milestone-mark');
      const style = getComputedStyle(mark);
      return { met: li.dataset.reached, fill: style.backgroundColor, border: style.borderTopStyle, borderWidth: parseFloat(style.borderTopWidth), ...box(mark) };
    });
    const milestones = document.querySelector('[data-testid="gameover-milestones"]');
    const next = row?.nextElementSibling;
    const overlay = document.querySelector('.airway-go-overlay');
    const buttons = ['gameover-same', 'gameover-new', 'gameover-menu'].map((id) => box(document.querySelector(`[data-testid="${id}"]`)));
    const labelledBy = row?.getAttribute('aria-labelledby');
    return {
      present: Boolean(row), title: title?.textContent ?? null, spoken: labelledBy ? document.getElementById(labelledBy)?.getAttribute('aria-label') : null,
      listHidden: row?.querySelector('ul')?.getAttribute('aria-hidden') ?? null,
      marks, row: row ? box(row) : null, titleBox: title ? box(title) : null, milestones: milestones ? box(milestones) : null,
      next: next && next.getClientRects().length ? { cls: next.className, ...box(next) } : null, buttons,
      scrollTop: overlay?.scrollTop ?? 0, overflow: overlay ? overlay.scrollHeight - overlay.clientHeight : 0,
      docScroll: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

function checkRow(f, language, width, height, marks) {
  const met = [...marks].filter((m) => m === '1').length;
  assert(f.present, 'no contracts row');
  assert(f.title === TITLE[language](met, marks.length), `title ${f.title}`);
  assert(f.spoken === LABEL[language](met, marks.length), `spoken label ${f.spoken}`);
  assert(f.listHidden === 'true', 'squares not hidden from screen readers');
  assert(f.marks.length === marks.length, `${f.marks.length} squares, expected ${marks.length}`);
  assert(f.marks.map((m) => (m.met === 'true' ? '1' : '0')).join('') === marks, 'squares out of week order');
  for (const m of f.marks) {
    assert(m.border === 'solid' && m.borderWidth >= 1 && m.width >= 7.5 && m.height >= 7.5, `square ${JSON.stringify(m)}`);
    assert(m.met === 'true' ? m.fill !== 'rgba(0, 0, 0, 0)' : m.fill === 'rgba(0, 0, 0, 0)', `square fill ${m.met} ${m.fill}`);
    assert(m.left >= f.row.left - 0.5 && m.right <= f.row.right + 0.5 && m.top >= f.row.top - 0.5 && m.bottom <= f.row.bottom + 0.5, 'square outside the row');
  }
  assert(f.row.height > 0 && f.row.top >= -0.5 && f.row.bottom <= height + 0.5, `row off-screen ${JSON.stringify(f.row)}`);
  assert(f.titleBox.right <= f.row.right + 0.5 && f.titleBox.height < 20, `title cut or wrapped ${JSON.stringify(f.titleBox)}`);
  // Under the milestones, or (a short landscape screen, D-292) beside them on the same line; never over them.
  if (f.milestones) assert(f.row.top >= f.milestones.bottom - 0.5 || (f.row.left >= f.milestones.right - 0.5 && f.row.top >= f.milestones.top - 0.5),
    `row overlaps the milestones ${JSON.stringify(f.row)} ${JSON.stringify(f.milestones)}`);
  if (f.next) assert(f.next.top >= f.row.bottom - 0.5, `row overlaps ${f.next.cls}`);
  for (const b of f.buttons) assert(b.top >= -0.5 && b.bottom <= height + 0.5 && b.left >= -0.5 && b.right <= width + 0.5 && b.height >= 47.5, `action off-screen or small ${JSON.stringify(b)}`);
  assert(f.row.bottom <= Math.min(...f.buttons.map((b) => b.top)) + 0.5, 'contracts row under the actions');
  // Only the overlay's bottom padding (12 px + safe area) may lie past the edge, as without the row (the content fits).
  assert(f.scrollTop === 0 && f.overflow <= 13, `report scrolls (top ${f.scrollTop}, overflow ${f.overflow})`);
  assert(!f.docScroll, 'horizontal scroll');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    const cases = [];
    for (const [language, width, height] of sizes) {
      cases.push({ label: `${language} ${width}×${height}: 4 of 6 under the milestones, no scroll`, language, viewport: { width, height }, body: async (page) => {
        await openPreview(page, url, '101101');
        checkRow(await facts(page), language, width, height, '101101');
        await page.screenshot({ path: resolve(SHOTS, `gameover-contracts-some-${language}-${width}x${height}.png`) });
      } });
    }
    for (const [marks, language, width, height, name] of states) {
      cases.push({ label: `${language} ${width}×${height}: ${name} (${marks})`, language, viewport: { width, height }, body: async (page) => {
        await openPreview(page, url, marks);
        checkRow(await facts(page), language, width, height, marks);
        await page.screenshot({ path: resolve(SHOTS, `gameover-contracts-${name}-${language}-${width}x${height}.png`) });
      } });
    }
    cases.push({ label: 'en 320×568: no contract seen, no row', language: 'en', viewport: { width: 320, height: 568 }, body: async (page) => {
      await openPreview(page, url, 'none');
      const f = await facts(page);
      assert(!f.present, 'a row without contracts');
    } });
    cases.push({ label: `pl 360×640 ${RENDER} world: an Endless jam (bot to the week-3 board or an earlier jam) prints the run's contracts`, language: 'pl',
      viewport: { width: 360, height: 640 }, body: async (page) => {
        await page.goto(gameUrl(url), { waitUntil: 'load' });
        await waitForScreen(page, 'menu', 12000);
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        let s = await page.evaluate(() => window.aw.autoplay(3));
        if (s.screen === 'upgrade') {
          const enabled = await page.evaluate(() =>
            [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => !n.disabled && !['hub-expansion', 'departure-slots'].includes(n.dataset.upgrade)));
          await clickTestId(page, `upgrade-option-${enabled.indexOf(true)}`);
          await waitForScreen(page, 'game');
          s = await state(page);
        }
        if (s.screen !== 'gameover') await page.evaluate(() => window.aw.forceHubOverload());
        await waitForScreen(page, 'gameover', 20000);
        await page.getByTestId('game-over').waitFor({ timeout: 5000 });
        await page.waitForTimeout(1500);
        const f = await facts(page);
        assert(f.present, 'no contracts row after a weekly board with a contract');
        const met = f.marks.filter((m) => m.met === 'true').length;
        assert(f.marks.length >= 1 && f.marks.length <= 3, `${f.marks.length} contracts after three boards`);
        assert(f.title === TITLE.pl(met, f.marks.length), `title ${f.title} vs ${met}/${f.marks.length} squares`);
        console.log(`  session: ${f.title}`);
        await page.screenshot({ path: resolve(SKIN || RENDER === 'stub' ? resolve(ROOT, '.e2e') : SHOTS, `gameover-contracts-session-pl-360x640.png`) });
      } });
    for (const item of cases) {
      const { page, errors } = await newGamePage(browser, url, item.language, item.viewport);
      try {
        await item.body(page);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: item.label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-contracts-${results.length + 1}`);
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
  const steps = sizes.length + states.length + 2;
  console.log(`SUMMARY test:e2e:gameover-contracts seed=0x${SEED.toString(16).toUpperCase()} render=${RENDER}${SKIN ? ' skin=' + SKIN : ''} ` +
    `steps=${results.length} passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== steps) process.exitCode = 1;
}

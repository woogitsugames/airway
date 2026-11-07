// [night-07v] The smallest phones (320×568 portrait, 568×320 landscape): the same audit as screens-fit.mjs
// (≥ 48 px targets inside the viewport, no clipped button text, no horizontal scroll) on settings, puzzle board
// and pause sheet in PL/EN (ext-05: no puzzle title splits a word), and every select keeps ≥ 8 px to spare beside its longest option, so "Automatyczna"
// no longer runs into the arrow. screens-fit.mjs keeps the 360/412/915 sizes with the plain fit rule.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, SEED, skinUrl } from './browser.mjs'; // [night-29a] --skin=linoryt

const started = performance.now();
const SIZES = [[320, 568], [568, 320]];
const SELECT_SPARE = 8; // px beyond the longest option + padding + border + native arrow
const results = [];

/** Problems of the visible controls inside `root` (a CSS selector). */
function audit(page, root) {
  return page.evaluate(([root, spare]) => {
    const host = document.querySelector(root);
    if (!host) return [`${root} missing`];
    const problems = [];
    const measure = document.createElement('canvas').getContext('2d');
    for (const el of host.querySelectorAll('button, select')) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || style.visibility === 'hidden') continue;
      const name = (el.dataset.testid || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 32);
      if (r.height < 47.5 || r.width < 47.5) problems.push(`${name}: target ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < -0.5 || r.right > innerWidth + 0.5) problems.push(`${name}: outside the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
      if (el.tagName === 'SELECT') {
        measure.font = style.font;
        const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth) + 18; // the native arrow
        const longest = Math.max(...[...el.options].map((option) => measure.measureText(option.textContent).width));
        if (longest + chrome + spare > r.width + 0.5) problems.push(`${name}: select ${Math.round(r.width)} px < ${Math.round(longest + chrome + spare)} px`);
      } else if (el.scrollWidth > el.clientWidth + 1) {
        problems.push(`${name}: text clipped (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    // [ext-02] D-162: a pack header on the puzzle board wraps inside the list, never wider than the viewport.
    for (const row of host.querySelectorAll('.puzzle-pack')) {
      const r = row.getBoundingClientRect();
      if (r.right > innerWidth + 0.5 || row.scrollWidth > row.clientWidth + 1) problems.push(`pack header overflows (${row.textContent})`);
    }
    // [ext-05] D-166: no puzzle title on the departures board splits a word across lines ("ATLANTYK-U").
    for (const title of host.querySelectorAll('.puzzle-flap-title')) {
      const text = title.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) continue;
      const value = text.textContent ?? '';
      for (const match of value.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
        if (lines.size > 1) problems.push(`title "${value}" splits "${match[0]}"`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('horizontal page scroll');
    return problems;
  }, [root, SELECT_SPARE]);
}

const screens = [
  ['settings', async (page) => { await clickTestId(page, 'menu-settings'); return '.airway-settings'; }],
  ['puzzle board', async (page) => {
    await clickTestId(page, 'menu-puzzles');
    // [ext-02] R6h: every level from the folder is on the board (35 with the "Long haul" pack).
    const { readdirSync } = await import('node:fs');
    const want = readdirSync(new URL('../src/data/puzzles/', import.meta.url)).filter((n) => /^\d{2}\.json$/.test(n)).length;
    await page.locator('.puzzle-departures .puzzle-flap').first().waitFor({ timeout: 8000 });
    const count = await page.locator('.puzzle-departures .puzzle-flap').count();
    assert(count === want, `board shows ${count} departures, the folder has ${want}`);
    await page.locator(`button[data-action="open:${String(want).padStart(2, '0')}"]`).scrollIntoViewIfNeeded();
    return '.puzzle-shell';
  }],
  ['pause sheet', async (page) => {
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game');
    await page.keyboard.press('Escape');
    await page.getByTestId('action-resume').waitFor({ timeout: 5000 });
    return '.airway-pause';
  }],
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const lang of ['pl', 'en']) for (const [width, height] of SIZES) for (const [label, open] of screens) {
      const name = `${lang}/${width}x${height} ${label}`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, skinUrl(url), lang, { width, height }));
        await waitForScreen(page, 'menu');
        const root = await open(page);
        await page.waitForTimeout(300);
        const problems = await audit(page, root);
        assert(problems.length === 0, problems.join('; '));
        assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
        results.push({ name, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, `screens-fit-320-${results.length + 1}`) : null;
        results.push({ name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        await page?.close();
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
  const total = 2 * SIZES.length * screens.length;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:screens-fit-320 seed=0x${SEED.toString(16).toUpperCase()} checks=${total} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

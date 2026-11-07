// [night-07s] Secondary screens fit small phones: settings, puzzle board and pause sheet at 360×640, 412×915 and
// 915×412 in PL and EN. Every visible button/select is a ≥ 48 px target inside the viewport and shows its whole
// text (no clipped label, a select wide enough for its longest option). ui:matrix covers menu/game/upgrade/gameover.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, SEED, skinUrl } from './browser.mjs'; // [night-29a] --skin=linoryt

const started = performance.now();
const SIZES = [[360, 640], [412, 915], [915, 412]];
const results = [];

/** Problems of the visible controls inside `root` (a CSS selector). */
function audit(page, root) {
  return page.evaluate((root) => {
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
        if (longest + chrome > r.width + 0.5) problems.push(`${name}: select ${Math.round(r.width)} px < ${Math.round(longest + chrome)} px`);
      } else if (el.scrollWidth > el.clientWidth + 1) {
        problems.push(`${name}: text clipped (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('horizontal page scroll');
    return problems;
  }, root);
}

const screens = [
  ['settings', async (page) => { await clickTestId(page, 'menu-settings'); return '.airway-settings'; }],
  ['puzzle board', async (page) => { await clickTestId(page, 'menu-puzzles'); return '.puzzle-shell'; }],
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
        const shot = page ? await saveDiagnostics(page, `screens-fit-${results.length + 1}`) : null;
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
  console.log(`SUMMARY test:e2e:screens-fit seed=0x${SEED.toString(16).toUpperCase()} checks=${total} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

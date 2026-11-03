// [night-10p] Localisation robustness: with the DEV pseudo-locale (`?pseudo`, src/i18n/pseudo.ts) every string runs
// ~40 % longer with accents and brackets, like German/Finnish copy. Each screen (departure board, settings, logbook,
// puzzle board, pause sheet, weekly upgrade board, game over) is audited at 360×640 (PL, EN) and 915×412 (EN):
// no text cut by an overflow box (split-flap cells are fixed by design and skipped), nothing outside the viewport,
// buttons stay ≥ 48 px, no template token, no horizontal page scroll. Shots into .e2e/pseudo/ (not committed).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ARTIFACTS, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'pseudo');
const CASES = [['pl', 360, 640], ['en', 360, 640], ['en', 915, 412]];
const results = [];

function audit(page, root) {
  return page.evaluate((root) => {
    const host = document.querySelector(root);
    if (!host) return [`${root} missing`];
    const problems = [];
    const name = (el) => (el.dataset?.testid || el.getAttribute?.('aria-label') || el.textContent || el.tagName).trim().slice(0, 40);
    const inFlap = (el) => Boolean(el.closest('.split-flap'));
    const scrollsX = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    for (const el of host.querySelectorAll('*')) {
      if (inFlap(el)) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue;
      const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (el.matches('button')) {
        if (r.height < 47.5 || r.width < 47.5) problems.push(`${name(el)}: target ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      const clips = style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow === 'ellipsis';
      if (clips && ownText && el.scrollWidth > el.clientWidth + 1) problems.push(`${name(el)}: text clipped (${el.scrollWidth} > ${el.clientWidth})`);
      if (ownText && !scrollsX(el) && (r.left < -0.5 || r.right > innerWidth + 0.5)) problems.push(`${name(el)}: outside the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    if (/\{[A-Za-z]/.test(host.textContent)) problems.push('template token');
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('horizontal page scroll');
    if (!host.textContent.includes('[')) problems.push('pseudo-locale not active');
    return [...new Set(problems)];
  }, root);
}

async function startGame(page) {
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
}
const SCREENS = [
  ['board', async () => '.airway-menu'],
  ['settings', async (page) => { await clickTestId(page, 'menu-settings'); return '.airway-settings'; }],
  ['logbook', async (page) => { await clickTestId(page, 'menu-logbook'); return '[data-testid="logbook"]'; }],
  ['puzzle board', async (page) => { await clickTestId(page, 'menu-puzzles'); return '.puzzle-shell'; }],
  ['pause sheet', async (page) => {
    await startGame(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('action-resume').waitFor({ timeout: 5000 });
    return '.airway-pause';
  }],
  ['upgrade board', async (page) => {
    await startGame(page);
    const s = await page.evaluate(() => window.aw.autoplay(1));
    assert(s.screen === 'upgrade', `autoplay ended on ${s.screen}`);
    return '.airway-upgrade';
  }],
  ['game over', async (page) => {
    await startGame(page);
    await page.evaluate(() => window.aw.forceHubOverload());
    await waitForScreen(page, 'gameover', 20000);
    await page.getByTestId('game-over').waitFor({ timeout: 5000 });
    return '[data-testid="game-over"]';
  }],
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of CASES) for (const [label, open] of SCREENS) {
      const name = `${language} ${width}×${height} ${label}`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, url, language, { width, height }));
        await page.goto(url + (url.includes('?') ? '&' : '?') + 'pseudo', { waitUntil: 'load' });
        await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
        await waitForScreen(page, 'menu');
        const root = await open(page);
        await page.waitForTimeout(1200); // flaps and fly-ins settle (reduced motion)
        const problems = await audit(page, root);
        await page.screenshot({ path: resolve(SHOTS, `${label.replace(/ /g, '-')}-${language}-${width}x${height}.png`) });
        assert(!problems.length, problems.join('; '));
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ name, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, `pseudo-${results.length + 1}`) : null;
        results.push({ name, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page?.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { name, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${name}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:pseudo-locale seed=0x${SEED.toString(16).toUpperCase()} checks=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length * SCREENS.length) process.exitCode = 1;
}

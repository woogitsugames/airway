// [night-11ac] R7h, D-211: the harsh pseudo-locale on the smallest phone. Short strings (≤ 20 code points) run twice
// as long, longer ones ~40 % longer, and every key with a length budget (src/i18n/limits.ts) is filled to its budget,
// i.e. the longest translation the catalogs allow. Each screen is mounted alone through its public API on
// ?perf=scene (no game, no globe: the globe suites are slow under SwiftShader, G7) at 320×568 in PL and EN:
// departures menu, settings, logbook (with flights), puzzle board, weekly upgrade board over the HUD, game over,
// in-game HUD and a first-time card. Audit (as e2e/pseudo-locale.mjs): buttons ≥ 48 px, no own text clipped by an
// overflow/ellipsis box or wider than its box, nothing outside the viewport, no template token, no horizontal page
// scroll, pseudo text present; plus: no split-flap cell ends in "…" (a budgeted title, status or half-row title
// fits its cells). Shots into .e2e/pseudo-320/ (not committed).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gameUrl, withBrowser, saveDiagnostics, ARTIFACTS, SKIN } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { SCREENS, auditScreen, mountScreen } from './screen-fixtures.mjs'; // [night-11ap] shared with text-scale-150

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, SKIN ? `pseudo-320-${SKIN}` : 'pseudo-320'); // [night-29b] U4: `--skin=linoryt` audits the preview
const SIZE = { width: 320, height: 568 };
const results = [];

const message = (error) => String(error?.message ?? error).split('\n')[0];
let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of ['pl', 'en']) for (const screen of SCREENS) {
      const name = `${language} ${SIZE.width}x${SIZE.height} ${screen}`;
      const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(gameUrl(url + '?perf=scene'), { waitUntil: 'networkidle' });
        await mountScreen(page, screen, language);
        const { problems, seen } = await auditScreen(page);
        await page.screenshot({ path: resolve(SHOTS, `${screen}-${language}.png`), animations: 'disabled' });
        if (!seen) problems.push('no visible text');
        // [night-29b] D-284 U4: with --skin=linoryt the screens must really be in the preview's print.
        if (SKIN && await page.evaluate(() => document.documentElement.dataset.skin) !== SKIN) problems.push(`skin not ${SKIN}`);
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${seen} text boxes` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `pseudo-320-${results.length + 1}`).catch(() => null);
        results.push({ name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { name, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${name}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:pseudo-320${SKIN ? ' skin=' + SKIN : ''} checks=${results.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || results.length !== SCREENS.length * 2) process.exitCode = 1;
}

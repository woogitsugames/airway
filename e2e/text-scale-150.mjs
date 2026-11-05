// [night-11ap] R1g: the two largest text steps (130 and 150 %) on real PL/EN catalogs. Every screen of e2e/screen-fixtures.mjs
// (departures menu, settings, logbook, puzzle board, weekly upgrade board over the HUD, game over, in-game HUD,
// first-time card) at 320x568, 412x915 and 915x412 with the same layout audit as e2e/pseudo-320.mjs, plus: the root carries
// the step and the screen's reading text really grew (a probe element's computed size = step x its base).
// Shots into .e2e/text-scale-150/ (not committed). The full ui:matrix times out under SwiftShader (G7).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, saveDiagnostics, ARTIFACTS } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { SCREENS, auditScreen, mountScreen } from './screen-fixtures.mjs'; // [night-11ap] shared with text-scale-150

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'text-scale-150');
const SIZES = [{ width: 320, height: 568 }, { width: 412, height: 915 }, { width: 915, height: 412 }];
const SCALES = process.env.AW_TEXT_SCALE ? [Number(process.env.AW_TEXT_SCALE)] : [130, 150]; // AW_TEXT_SCALE=100 for a baseline run
/** One reading-text element per screen and its size at 100 %; the HUD and first-time card keep in-world sizes. */
const PROBES = {
  menu: null, settings: ['.airway-setting', 14], logbook: ['.airway-logbook__records dt', 13], puzzles: null, upgrade: null,
  gameover: null, hud: null, 'first-time': null,
};
const results = [];

/**
 * Checks the shared audit cannot see at large sizes: a select whose chosen option no longer fits its box, and a
 * word split across two lines (overflow-wrap:anywhere hides an overflow by breaking "USTAWIENIA" mid-word).
 */
function largeTextAudit(page) {
  return page.evaluate(() => {
    const host = document.getElementById('app');
    const problems = [];
    const context = document.createElement('canvas').getContext('2d');
    for (const select of host.querySelectorAll('select')) {
      const style = getComputedStyle(select);
      if (!select.getBoundingClientRect().width) continue;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = select.selectedOptions[0]?.textContent ?? '';
      const room = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 16;
      if (context.measureText(text).width > room + 0.5) problems.push(`select "${text}" cut (${Math.round(context.measureText(text).width)} > ${Math.round(room)})`);
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('.split-flap, [hidden], [aria-hidden="true"], option, select')) continue;
      for (const match of node.textContent.matchAll(/[\p{L}\p{N}]{2,}/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
        if (tops.size > 1) problems.push(`word broken across lines: "${match[0]}" in .${String(node.parentElement.className).split(" ")[0] || node.parentElement.tagName}`);
      }
    }
    return problems;
  });
}

const message = (error) => String(error?.message ?? error).split('\n')[0];
let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const SCALE of SCALES) for (const SIZE of SIZES) for (const language of ['pl', 'en']) for (const screen of SCREENS) {
      const name = `${SCALE}% ${language} ${SIZE.width}x${SIZE.height} ${screen}`;
      const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await mountScreen(page, screen, language, { pseudo: false, textScale: SCALE });
        const { problems, seen } = await auditScreen(page, { pseudo: false });
        problems.push(...await largeTextAudit(page));
        const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--airway-text-scale').trim());
        if (scale !== String(SCALE / 100)) problems.push(`root text scale ${scale}`);
        const probe = PROBES[screen];
        if (probe) {
          const size = await page.evaluate((selector) => {
            const el = document.querySelector('#app ' + selector);
            return el ? Number.parseFloat(getComputedStyle(el).fontSize) : null;
          }, probe[0]);
          if (size === null || Math.abs(size - probe[1] * SCALE / 100) > 0.6) problems.push(`${probe[0]} is ${size}px, not ${probe[1] * SCALE / 100}px`);
        }
        await page.screenshot({ path: resolve(SHOTS, `${SCALE}-${screen}-${language}-${SIZE.width}x${SIZE.height}.png`), animations: 'disabled' });
        if (!seen) problems.push('no visible text');
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${seen} text boxes` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `text-scale-150-${results.length + 1}`).catch(() => null);
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
  console.log(`SUMMARY test:e2e:text-scale-150 scales=${SCALES.join('/')} checks=${results.length} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || results.length !== SCREENS.length * 2 * SIZES.length * SCALES.length) process.exitCode = 1;
}

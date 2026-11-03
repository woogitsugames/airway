// [task-28] Screen matrix: PL/EN x 4 mobile sizes x menu/game/upgrade/gameover, real game UI only.
// The --fixture flag writes to docs/shots/matrix-fixture and NEVER counts as game screenshots.
// Each language/size run is independent; within a run a failed screen skips the later screens.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, ROOT, SEED } from '../e2e/browser.mjs';
import { textFitProblems } from './lib/text-fit.mjs'; // [m3] D-55

const fixture = process.argv.includes('--fixture');
// [m3] D-55: `--text-scale 130` = the large-text variant: the 130 % setting, its own folder and SUMMARY, and a
// clipping / overlap check of every screen. The default run (32 shots in docs/shots/matrix) is unchanged.
const scaleArg = process.argv.indexOf('--text-scale');
const textScale = scaleArg > 0 ? Number(process.argv[scaleArg + 1]) : 0;
if (textScale && ![115, 130].includes(textScale)) throw new Error('--text-scale must be 115 or 130');
const variant = textScale ? `matrix-${textScale}` : fixture ? 'matrix-fixture' : 'matrix';
const sizes = [[412, 915], [915, 412], [673, 841], [904, 1000]];
const screens = ['menu', 'game', 'upgrade', 'gameover'];
// [task-31] With 3-day weeks (D-40) the DEV autoplay bot reaches the week-1 board from a clean start on the
// ordinary test seed 0xA1A1, so no hand-picked "lucky" seed is needed any more.
const WEEK_SEED = SEED;
const outdir = resolve(ROOT, 'docs/shots', variant);
const expected = sizes.length * screens.length * 2;
const failures = [];
let captured = 0;
const started = performance.now();

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

async function enter(page, screen) {
  if (screen === 'game') {
    await clickTestId(page, 'menu-endless');
  } else if (screen === 'upgrade') {
    const current = await state(page);
    const remaining = current.nextWeekTick - current.tick;
    assert(Number.isSafeInteger(remaining) && remaining > 0, `Invalid end-of-week transition: ${remaining}`);
    // The bot plays the run through real Commands until the week-1 board (DEV window.aw.autoplay).
    await page.evaluate(() => window.aw.autoplay(1));
  } else if (screen === 'gameover') {
    // A hub-expansion card waits for a hub tap; take the first card that completes on its own.
    const option = await page.evaluate(() => document.querySelector(
      '[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])') /* [task-32] targeted picks wait for a globe tap */?.getAttribute('data-testid') ?? 'upgrade-option-0');
    await clickTestId(page, option);
    await waitForScreen(page, 'game');
    await page.evaluate(() => window.aw.forceHubOverload());
  }
  await waitForScreen(page, screen);
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(outdir, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height] of sizes) {
        const run = `${language}/${width}x${height}`;
        let page;
        let errors;
        try {
          ({ page, errors } = await newGamePage(browser, url, language, { width, height }, textScale ? { textScale } : {}));
          assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
          assert(await page.evaluate(() => document.documentElement.lang) === language,
            `<html lang> should be ${language}`);
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), WEEK_SEED);
        } catch (error) {
          failures.push(`${run} boot: ${message(error)}`);
          if (page) await page.close();
          // A missing dev adapter is structural: every other run would wait out the same timeouts.
          if (/window\.aw/.test(message(error))) { failures.push('remaining runs skipped (no dev adapter)'); return; }
          continue;
        }
        try {
          for (const screen of screens) {
            try {
              if (screen !== 'menu') await enter(page, screen);
              assert(errors.length === 0, `Browser errors: ${errors.splice(0).join('; ')}`);
              const layout = await page.evaluate(() => ({
                viewport: window.innerWidth, overflow: document.documentElement.scrollWidth,
              }));
              assert(layout.overflow <= layout.viewport + 2, `Horizontal overflow ${JSON.stringify(layout)}`);
              if (textScale) {
                const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--airway-text-scale').trim());
                assert(Number(scale) === textScale / 100, `--airway-text-scale is "${scale}", expected ${textScale / 100}`);
                const problems = await page.evaluate(textFitProblems);
                // Reported per screen; the run continues so one report lists every screen's problems.
                if (problems.length) failures.push(`${run} ${screen}: ${problems.length} text problem(s): ${problems.slice(0, 8).join(' | ')}`);
              }
              const filename = `${screen}-${language}-${width}x${height}.png`;
              await page.screenshot({ path: resolve(outdir, filename), animations: 'disabled' });
              captured++;
              console.log(`shot ${variant}/${filename}`);
            } catch (error) {
              failures.push(`${run} ${screen}: ${message(error)}`);
              break;
            }
          }
        } finally {
          await page.close();
        }
      }
    }
  }, { fixture });
} catch (error) {
  failures.push(`harness: ${message(error)}`);
} finally {
  for (const line of failures) console.error('FAIL ' + line);
  const failed = failures.length || (captured === expected ? 0 : 1);
  console.log(`SUMMARY ui:matrix${textScale ? ':' + textScale : ''} seed=0x${SEED.toString(16).toUpperCase()} weekSeed=${WEEK_SEED} mode=${fixture ? 'fixture' : 'game'}${textScale ? ` textScale=${textScale}` : ''} captured=${captured} expected=${expected} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed) process.exitCode = 1;
}

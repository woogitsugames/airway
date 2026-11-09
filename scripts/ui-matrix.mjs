// [task-28] Screen matrix: PL/EN x 12 sizes (phones, foldables, tablets, desktop) x menu/game/upgrade/gameover, real game UI only.
// The --fixture flag writes to docs/shots/matrix-fixture and NEVER counts as game screenshots.
// Each language/size run is independent; within a run a failed screen skips the later screens.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, state, assert, clickTestId, ROOT, ARTIFACTS, SEED, RENDER, SKIN, gameUrl, assertRender,
} from '../e2e/browser.mjs';

const fixture = process.argv.includes('--fixture');
// [night-12u] D-154: + the unfolded large foldable (Galaxy Z Fold class, ~1812x2176 px inner screen = 906x1088 CSS px
// at DPR 2) in portrait and landscape, rendered at device pixel ratio 2 like the phone. [width, height, dpr]
// [night-15b] R4f: + Google's large-screen reference sizes (tablet landscape 1024x640 and 1280x800, tablet portrait
// 800x1280, the unfolded book foldable 841x701, desktop 1600x900) and a narrow free-form window (500x700, a split-screen
// or desktop window), all at DPR 1. Mid-run resizes between them: `npm run test:e2e:resize:stub`.
const allSizes = [[412, 915, 1], [915, 412, 1], [673, 841, 1], [904, 1000, 1], [904, 1088, 2], [1088, 904, 2],
  [1024, 640, 1], [1280, 800, 1], [800, 1280, 1], [841, 701, 1], [1600, 900, 1], [500, 700, 1]];
// `--size=1024x640` (repeatable): only those sizes, for a quick look at one layout.
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const sizes = only.length ? allSizes.filter(([w, h]) => only.includes(`${w}x${h}`)) : allSizes;
if (only.length && sizes.length !== only.length) throw new Error(`--size must be one of ${allSizes.map(([w, h]) => `${w}x${h}`).join(', ')}`);
const screens = ['menu', 'game', 'upgrade', 'gameover'];
// [task-31] With 3-day weeks (D-40) the DEV autoplay bot reaches the week-1 board from a clean start on the
// ordinary test seed 0xA1A1, so no hand-picked "lucky" seed is needed any more.
const WEEK_SEED = SEED;
// [night-12bf] `npm run ui:matrix:stub` (--render=stub): the same screens, layout checks (no horizontal overflow, board
// and report clear of the boarding pass, no scroll) and screenshots on the DEV stub world (D-254), so the matrix finishes
// under SwiftShader (G7). Its PNGs show dots instead of the globe: they go to the git-ignored `.e2e/matrix-stub/` and
// never replace `docs/shots/matrix/`. The look of the screens over the globe needs the real renderer (default run).
const stub = !fixture && RENDER === 'stub';
const outdir = resolve(ROOT, fixture ? 'docs/shots/matrix-fixture' : stub ? '.e2e/matrix-stub' : 'docs/shots/matrix');
const shotLabel = fixture ? 'matrix-fixture' : stub ? '.e2e/matrix-stub' : 'matrix';
// [night-80a] D-335: the parts of the weekly board and the report checked against the boarding pass, and the element that
// must not scroll, per skin (`--skin=board`: the UI-A week sheet of D-331, which scrolls only at text 130/150 %).
const BOARD = SKIN === 'board';
const MATRIX_PARTS = {
  upgrade: BOARD ? '.bw-board, .bw-slip, .bw-pick, .bw-take' : '.airway-upgrade-sign, .airway-upgrade-tag',
  gameover: '.airway-go-sign, .airway-go-board, .airway-go-strip, .airway-go-button',
};
const MATRIX_SCROLLER = { upgrade: BOARD ? '.bw-sheet' : '.airway-upgrade-open', gameover: '.airway-go-overlay' };
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
    // [night-80a] D-335: on the UI-A week sheet (D-331) a tap only chooses the strip; the main action takes it.
    if (BOARD) await clickTestId(page, 'upgrade-take');
    await waitForScreen(page, 'game');
    await page.evaluate(() => window.aw.forceHubOverload());
  }
  await waitForScreen(page, screen);
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(outdir, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height, dpr] of sizes) {
        const run = `${language}/${width}x${height}${dpr > 1 ? '@' + dpr : ''}`;
        let page;
        let errors;
        try {
          ({ page, errors } = await newGamePage(browser, fixture ? url : gameUrl(url), language, { width, height },
            { deviceScaleFactor: dpr }));
          if (!fixture) await assertRender(page);
          assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
          assert(await page.evaluate(() => document.documentElement.lang) === language,
            `<html lang> should be ${language}`);
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), WEEK_SEED);
        } catch (error) {
          failures.push(`${run} boot: ${message(error)}`);
          if (page) await page.close();
          // A missing dev adapter is structural: every other run would wait out the same timeouts.
          if (/window\.(aw|__awStub)/.test(message(error))) { failures.push('remaining runs skipped (no dev adapter / stub world)'); return; }
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
              if (screen === 'upgrade' || screen === 'gameover') {
                // [night-07n/07p] The weekly board and the game-over report must not cover the boarding pass
                // (week/day/time/passengers) nor scroll.
                // [night-80a] D-335: the UI-A week board (`--skin=board`, D-331) takes the HUD's place while it is open
                // (mockup ui-a-koniec-tygodnia.png): its parts are `.bw-*`, a pass hidden with the whole HUD
                // (visibility) counts as replaced, not covered, and every HUD panel still on screen (the pass, T3's
                // bay of hub strips) is checked against every part.
                const hit = await page.evaluate((selector) => {
                  const passEl = document.querySelector('.airway-pass');
                  const parts = [...document.querySelectorAll(selector)];
                  if (!passEl || parts.length < 2) return `missing .airway-pass or the board (${selector})`;
                  const shown = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
                  const board = document.documentElement.dataset.skin === 'board';
                  const panels = board ? [passEl, ...document.querySelectorAll('.airway-strip-bay')].filter(shown) : [passEl];
                  for (const panel of panels) {
                    const pass = panel.getBoundingClientRect();
                    for (const part of parts) {
                      const r = part.getBoundingClientRect();
                      if (r.left < pass.right && pass.left < r.right && r.top < pass.bottom && pass.top < r.bottom) {
                        return `${part.className} ${Math.round(r.left)},${Math.round(r.top)} covers ${panel.className.split(' ')[0]} ..${Math.round(pass.right)},${Math.round(pass.bottom)}`;
                      }
                    }
                  }
                  return '';
                }, MATRIX_PARTS[screen]);
                assert(!hit, `${screen} overlaps HUD: ${hit}`);
                const bottom = await page.evaluate((selector) => document.querySelector(selector)?.scrollHeight ?? 0,
                  MATRIX_SCROLLER[screen]);
                assert(bottom <= height + 1, `${screen} scrolls: ${bottom} > ${height}`);
              }
              const filename = `${screen}-${language}-${width}x${height}${dpr > 1 ? '@' + dpr : ''}.png`;
              await page.screenshot({ path: resolve(outdir, filename), animations: 'disabled' });
              captured++;
              console.log(`shot ${shotLabel}/${filename}`);
            } catch (error) {
              failures.push(`${run} ${screen}: ${message(error)}`);
              await page.screenshot({ path: resolve(ARTIFACTS, `matrix-fail-${screen}-${language}-${width}x${height}.png`) }).catch(() => {});
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
  console.log(`SUMMARY ui:matrix seed=0x${SEED.toString(16).toUpperCase()} weekSeed=${WEEK_SEED} mode=${fixture ? 'fixture' : 'game'}${stub ? ' render=stub' : ''} captured=${captured} expected=${expected} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed) process.exitCode = 1;
}

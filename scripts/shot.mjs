// [task-28] Screen matrix: PL/EN x 4 mobile sizes x menu/game/upgrade/gameover.
// The --fixture flag writes to matrix-fixture and NEVER counts as game screenshots.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, state, assert, ROOT, SEED } from '../e2e/browser.mjs';

const fixture = process.argv.includes('--fixture');
const sizes = [
  [412, 915], [915, 412], [673, 841], [904, 1000],
];
const screens = ['menu', 'game', 'upgrade', 'gameover'];
const outdir = resolve(ROOT, fixture ? 'docs/shots/matrix-fixture' : 'docs/shots/matrix');
let captured = 0;
let failed = 0;
const started = performance.now();

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(outdir, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height] of sizes) {
        const { page, errors } = await newGamePage(browser, url, language, { width, height });
        try {
          assert(await page.evaluate(() => window.aw?.ready),
            'Game adapter missing; real UI matrix requires tasks 13-16');
          assert(await page.evaluate(() => document.documentElement.lang) === language,
            `UI language should be ${language}`);
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
          for (const screen of screens) {
            if (screen === 'game') {
              await page.getByTestId('menu-endless').click();
            } else if (screen === 'upgrade') {
              const current = await state(page);
              const remaining = current.nextWeekTick - current.tick;
              assert(Number.isSafeInteger(remaining) && remaining > 0,
                'Invalid end-of-week transition');
              await page.evaluate((ticks) => window.aw.advanceTicks(ticks), remaining);
            } else if (screen === 'gameover') {
              await page.getByTestId('upgrade-option-0').click();
              await waitForScreen(page, 'game');
              await page.evaluate(() => window.aw.forceHubOverload());
            }
            await waitForScreen(page, screen);
            assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
            const layout = await page.evaluate(() => ({
              viewport: window.innerWidth,
              overflow: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            }));
            assert(layout.overflow <= layout.viewport + 2,
              `Horizontal overflow for ${screen}/${language}/${width}x${height}: ${JSON.stringify(layout)}`);
            const filename = `${screen}-${language}-${width}x${height}.png`;
            await page.screenshot({ path: resolve(outdir, filename), animations: 'disabled' });
            captured++;
            console.log(`shot ${fixture ? 'matrix-fixture' : 'matrix'}/${filename}`);
          }
        } finally {
          await page.close();
        }
      }
    }
  }, { fixture });
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  const expected = sizes.length * screens.length * 2;
  if (captured !== expected && failed === 0) failed++;
  console.log(`SUMMARY ui:matrix seed=0x${SEED.toString(16).toUpperCase()} mode=${fixture ? 'fixture' : 'game'} captured=${captured} expected=${expected} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed) process.exitCode = 1;
}


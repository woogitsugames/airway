// [task-34] Readable night and camera framing: real game, seed 0xA1A1, PL.
// Writes docs/shots/34/{menu,day,dusk,night}-{p,l}.png. The run draws one route (DEV gesture), then
// advances the real sim until the sun stands at the wanted hour angle over the camera centre
// (noon = day, 90° = dusk terminator through the view, midnight = night). For night shots it samples the
// route/airport pixels against the surrounding night globe and checks WCAG contrast >= 4.5:1.
// Usage: node scripts/shots-34.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, clickTestId, dragGesture, assert, ROOT, SEED } from '../e2e/browser.mjs';

const OUT = resolve(ROOT, process.argv[2] ?? 'docs/shots/34');
const VIEWS = [['p', 412, 915], ['l', 915, 412]];
// Hour angle of the sun east of the view centre, in degrees (0 = local noon at the centre).
const MOMENTS = [['day', 0], ['dusk', -88], ['night', 180]];
const THRESHOLD = 4.5;
let captured = 0;
const failures = [];
const contrasts = [];
const framings = []; // [task-39]
mkdirSync(OUT, { recursive: true });

/** Ticks to advance so that the subsolar longitude is `centerLon + hourAngle` (sun.ts formula). */
function ticksUntil(tick, centerLon, hourAngle) {
  const sunLon = centerLon + hourAngle;
  const minuteOfDay = ((180 - sunLon) * 4 % 1440 + 1440) % 1440;
  const now = tick % 1440;
  const delta = Math.round((minuteOfDay - now + 1440) % 1440);
  return delta === 0 ? 1440 : delta;
}

await withBrowser(async ({ browser, url }) => {
  for (const [tag, width, height] of VIEWS) {
    const { page } = await newGamePage(browser, url, 'pl', { width, height });
    try {
      await waitForScreen(page, 'menu');
      await page.waitForFunction(() => window.__awWorld?.ready === true, null, { timeout: 90000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: resolve(OUT, `menu-${tag}.png`), animations: 'disabled' });
      captured++;
      // [task-39] The first rendered menu frame already used the final (measured) framing: no jump.
      const framing = await page.evaluate(() => window.__awWorld.framing());
      framings.push(`${tag}: first=${framing.first === framing.now ? 'final' : framing.first} spin=${framing.menuSpin}`);
      if (!framing.first || framing.first !== framing.now) failures.push(`${tag}: first menu frame ${framing.first} != final ${framing.now}`);
      await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
      await clickTestId(page, 'menu-endless');
      await waitForScreen(page, 'game');
      await page.waitForTimeout(400);
      await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
      await page.waitForTimeout(300);
      for (const [moment, hourAngle] of MOMENTS) {
        const { tick } = await page.evaluate(() => window.aw.state());
        const lon = await page.evaluate(() => window.__awWorld.longitude());
        await page.evaluate((n) => window.aw.advanceTicks(n), ticksUntil(tick, lon, hourAngle));
        await page.waitForTimeout(600);
        const after = await page.evaluate(() => window.aw.state());
        assert(after.screen === 'game', `run left the game screen before ${moment}: ${after.screen}`);
        const file = resolve(OUT, `${moment}-${tag}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        captured++;
        if (moment === 'night') {
          const result = await page.evaluate(() => window.__awWorld.nightContrast());
          contrasts.push(`${tag}: ${JSON.stringify(result)}`);
          for (const [layer, ratio] of Object.entries(result)) {
            if (typeof ratio === 'number' && ratio < THRESHOLD) failures.push(`${tag}: night ${layer} contrast ${ratio} < ${THRESHOLD}`);
          }
        }
      }
    } catch (error) {
      failures.push(`${tag}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    } finally {
      await page.close();
    }
  }
});
for (const line of contrasts) console.log('CONTRAST ' + line);
for (const line of framings) console.log('FRAMING ' + line);
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots:34 seed=0xA1A1 captured=${captured} expected=8 failed=${failures.length}`);
if (failures.length || captured !== 8) process.exitCode = 1;

// [task-38] Departure-slot tag at airports (D-50) on the real game, seed 0xA1A1, real pointer gestures.
// Writes docs/shots/38/{day,night}-{pl,en}-{p,l}.png. Each page lets the sim run until the
// sun stands at the wanted hour angle over the camera centre (shots-34 formula), draws one route and drags
// three more turboprops onto it so four aircraft get ready at one airport together and the slot gate holds
// them. Checks: the slot tag is visible with the localised "SLOT h:mm" text, does not overlap any passenger
// tag, its paper body reaches WCAG >= 4.5:1 (ink stub reported) against the globe under it, and it disappears once
// nothing is held. Usage: node scripts/shots-38.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  withBrowser, newGamePage, waitForScreen, clickTestId, dragGesture, state, assert, ROOT, SEED,
} from '../e2e/browser.mjs';

const OUT = resolve(ROOT, process.argv[2] ?? 'docs/shots/38');
const VIEWS = [['p', 412, 915], ['l', 915, 412]];
const MOMENTS = [['day', 0], ['night', 180]];
const LABEL = { pl: 'SLOT', en: 'SLOT' };
const THRESHOLD = 4.5;
const EXPECTED = 8;
let captured = 0;
const failures = [];
const notes = [];
mkdirSync(OUT, { recursive: true });

/** Ticks to advance so that the subsolar longitude is `centerLon + hourAngle` (sun.ts formula). */
function ticksUntil(tick, centerLon, hourAngle) {
  const sunLon = centerLon + hourAngle;
  const minuteOfDay = ((180 - sunLon) * 4 % 1440 + 1440) % 1440;
  const delta = Math.round((minuteOfDay - tick % 1440 + 1440) % 1440);
  return delta === 0 ? 1440 : delta;
}

/** Visible slot tags with their boxes, plus every visible passenger tag box. */
function readTags(page) {
  return page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const shown = (el) => !el.hidden && el.offsetParent !== null;
    return {
      slots: [...document.querySelectorAll('.airport-slot')].filter(shown)
        .map((el) => ({ ...box(el), text: el.textContent, aria: el.getAttribute('aria-label'), glyphs: el.querySelectorAll('.airport-region-glyph').length })),
      mains: [...document.querySelectorAll('.airport-bubble')].filter(shown).map(box),
    };
  });
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

await withBrowser(async ({ browser, url }) => {
  for (const language of ['pl', 'en']) {
    for (const [view, width, height] of VIEWS) {
      for (const [moment, hourAngle] of MOMENTS) {
        const name = `${moment}-${language}-${view}`;
        // Wall-clock frames also advance the sim while the plane drags run, which can split the aircraft
        // over two game minutes; a page that sees no hold is retried once from a fresh run.
        for (let attempt = 1; attempt <= 2; attempt++) {
          const retry = attempt < 2;
          const { page } = await newGamePage(browser, url, language, { width, height });
          try {
            await waitForScreen(page, 'menu');
            // The one-time ATC slot strip (task 32) is covered by shots:32; keep it out of these frames.
            await page.evaluate(() => { try { localStorage.setItem('aw-tutorial-slots', '1'); } catch { /* optional */ } });
            await page.waitForFunction(() => window.__awWorld?.ready === true, null, { timeout: 90000 });
            await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
            await clickTestId(page, 'menu-endless');
            await waitForScreen(page, 'game');
            await page.waitForTimeout(300);
            // Arrive at the wanted light ~20 game minutes early, before any route exists: the route's first
            // aircraft and the three added ones then get ready together and the slot gate holds two.
            const { tick } = await state(page);
            const lon = await page.evaluate(() => window.__awWorld.longitude());
            const skip = ticksUntil(tick, lon, hourAngle) - 20;
            if (skip > 0) await page.evaluate((n) => window.aw.advanceTicks(n), skip);
            await page.waitForTimeout(500);
            // The camera may still settle after the jump; retry the real drag gesture a few times.
            for (let attempt = 0; attempt < 3 && (await state(page)).routeCount === 0; attempt++) {
              await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
              await page.waitForFunction(() => window.aw.state().routeCount === 1, null, { timeout: 4000 }).catch(() => undefined);
            }
            assert((await state(page)).routeCount === 1, 'route gesture did not create a route');
            for (let i = 0; i < 3; i++) {
              const before = (await state(page)).aircraftAssignments;
              await dragGesture(page, await page.evaluate(() => window.aw.gesture('plane')));
              await page.waitForFunction((n) => window.aw.state().aircraftAssignments === n + 1, before, { timeout: 8000 });
            }
            let tags = await readTags(page);
            for (let step = 0; step < 90 && tags.slots.length === 0; step++) {
              await page.evaluate(() => window.aw.advanceTicks(1));
              await page.waitForTimeout(40);
              tags = await readTags(page);
            }
            assert(tags.slots.length > 0, 'no slot tag appeared within 90 game minutes');
            await page.waitForTimeout(250);
            tags = await readTags(page);
            for (const slot of tags.slots) {
              assert(new RegExp(`^${LABEL[language]}\\d+:\\d\\d(×\\d+)?$`).test(slot.text), `slot tag text "${slot.text}"`);
              assert(slot.glyphs === 0, 'slot tag carries no passenger glyph');
              assert(!!slot.aria && slot.aria.length > 10, 'slot tag has an a11y label');
              assert(slot.x >= 0 && slot.y >= 0 && slot.x + slot.w <= width && slot.y + slot.h <= height, 'slot tag inside the viewport');
              for (const main of tags.mains) assert(!overlaps(slot, main), `slot tag overlaps a passenger tag (${slot.text})`);
            }
            const paper = await page.evaluate(() => window.__awWorld.nightContrast('.airport-slot').tags);
            // The ink stub is the tag's second tone; measured with the same probe for the record.
            const ink = await page.evaluate(() => window.__awWorld.nightContrast('.airport-slot__stub').tags);
            notes.push(`${name}: slot="${tags.slots.map((s) => s.text).join(' | ')}" paper=${paper} ink=${ink}`);
            // The paper body carries the text and is what must stand off the globe; the ink stub is reported only.
            if (paper === null || paper < THRESHOLD) failures.push(`${name}: slot tag paper contrast ${paper} < ${THRESHOLD}`);
            await page.screenshot({ path: resolve(OUT, `${name}.png`), animations: 'disabled' });
            captured++;
            attempt = 2;
            if (moment === 'day' && view === 'p') {
              // Release: within two game hours the hold clears at least once and the tag goes away.
              let cleared = false;
              for (let step = 0; step < 120 && !cleared; step++) {
                await page.evaluate(() => window.aw.advanceTicks(1));
                cleared = (await readTags(page)).slots.length === 0;
              }
              if (!cleared) failures.push(`${name}: slot tag never cleared within 120 game minutes`);
              else notes.push(`${name}: slot tag cleared after release`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
            if (retry && message.includes('no slot tag appeared')) { notes.push(`${name}: retry (${message})`); continue; }
            failures.push(`${name}: ${message}`);
            break;
          } finally {
            await page.close();
          }
        }
      }
    }
  }
});
for (const line of notes) console.log('NOTE ' + line);
for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY shots:38 seed=0xA1A1 captured=${captured} expected=${EXPECTED} failed=${failures.length}`);
if (failures.length || captured !== EXPECTED) process.exitCode = 1;

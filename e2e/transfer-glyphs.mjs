// [night-10i] Transfer passengers inside the minimum connection time are drawn as hollow region glyphs on the
// hub's luggage tag and named in its screen-reader label; they fill in once the connection time runs out. The bot
// plays Endless on the fixed seed to the week-1 board, one pick puts it into week 2 (hubs with transfers), then the game is stepped one minute at a time.
// Real game at 412×915 (EN) and 915×412 (PL); fails closed; shots docs/shots/n10i/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const STEPS = 2;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10i');
const results = [];
const frames = (page, n) => page.evaluate((count) => new Promise((done) => {
  let left = count; const step = () => (--left <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step);
}), n);

/** Per tag: hollow glyph count, filled glyph count, whether it is on screen, its box, and its label. */
const hollowTags = (page) => page.evaluate(() => [...document.querySelectorAll('.airport-bubble')].map((bubble) => {
  const box = bubble.getBoundingClientRect();
  return {
    label: bubble.getAttribute('aria-label') ?? '',
    hollow: bubble.querySelectorAll('.airport-region-glyph--connecting').length,
    filled: bubble.querySelectorAll('.airport-region-glyph:not(.airport-region-glyph--connecting)').length,
    connectingClass: bubble.classList.contains('airport-bubble--connecting'),
    shown: !bubble.hidden && box.width > 0 && box.left >= 0 && box.top >= 0 &&
      box.right <= innerWidth && box.bottom <= innerHeight,
    box: { x: box.left, y: box.top, width: box.width, height: box.height },
  };
}));

const step = async (page, ticks = 1) => { await page.evaluate((n) => window.aw.advanceTicks(n), ticks); await frames(page, 2); };

const cases = [
  ['en 412×915: transfers drawn hollow, then filled', 'en', { width: 412, height: 915 }],
  ['pl 915×412: transfers drawn hollow, then filled', 'pl', { width: 915, height: 412 }],
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [label, language, viewport] of cases) {
      if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); continue; }
      const { page, errors } = await newGamePage(browser, url, language, viewport);
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        // [night-11o] Rules v5/v6 end the bot's seed-0xA1A1 run in week 2, before the week-2 board, so (as in
        // N11j) the bot plays to the week-1 board and one pick (not a hub or slot upgrade) puts it into week 2.
        const atBoard = await page.evaluate(() => window.aw.autoplay(1));
        assert(atBoard.screen === 'upgrade', `bot did not reach the week-1 board: ${atBoard.screen}`);
        // An extra aircraft keeps the bot's network growing; any card that needs no airport pick will do.
        const list = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));
        const plain = list.findIndex((item) => item !== 'hub-expansion' && item !== 'departure-slots');
        assert(plain >= 0, `no plain card on the week-1 board: ${list.join(', ')}`);
        await clickTestId(page, `upgrade-option-${plain}`);
        await waitForScreen(page, 'game');
        let s = await state(page);
        assert(s.nextWeekTick > atBoard.tick, `not in week 2: tick ${s.tick}, next board ${s.nextWeekTick}`);
        assert(s.screen === 'game', `bot left the game: ${s.screen}`);
        // Step minute by minute until a visible tag carries a hollow glyph (a plane has just dropped transfers).
        let tags = [];
        let found = null;
        for (let minute = 0; minute < 600 && !found; minute++) {
          await step(page);
          tags = await hollowTags(page);
          found = tags.find((tag) => tag.hollow > 0 && tag.shown) ?? null;
          if (minute % 60 === 59) { await page.evaluate(() => window.aw.botStep()); s = await state(page); if (s.screen !== 'game') break; }
        }
        assert(found, 'no visible tag with a transfer inside the connection time in 10 game hours');
        const word = language === 'pl' ? 'W trakcie przesiadki' : 'Making a connection';
        for (const tag of tags.filter((item) => item.hollow > 0)) {
          assert(tag.connectingClass, 'hollow tag lacks the connecting class');
          assert(tag.label.includes(word), `label does not say "${word}": ${tag.label}`);
        }
        const pad = 24;
        await page.screenshot({ path: resolve(SHOTS, `transfer-${language}-${viewport.width}x${viewport.height}.png`) });
        await page.screenshot({
          path: resolve(SHOTS, `transfer-tag-${language}.png`),
          clip: { x: Math.max(0, found.box.x - pad), y: Math.max(0, found.box.y - pad),
            width: Math.min(found.box.width + 2 * pad, viewport.width - Math.max(0, found.box.x - pad)),
            height: Math.min(found.box.height + 2 * pad, viewport.height - Math.max(0, found.box.y - pad)) },
        });
        // The connection time is 25 minutes (15 after a hub upgrade): within it the hollow glyphs must clear at
        // some tag that had them, unless another plane keeps landing; allow two windows.
        const code = /\b([A-Z]{3}):/.exec(found.label)?.[1] ?? '';
        assert(code, `no airport code in ${found.label}`);
        let cleared = false;
        for (let minute = 0; minute < 50 && !cleared; minute++) {
          await step(page);
          const now = (await hollowTags(page)).find((tag) => tag.label.includes(code + ':'));
          cleared = !now || now.hollow === 0;
        }
        assert(cleared, `${code}: hollow glyphs never filled in within 50 minutes`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `transfer-glyphs-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:transfer-glyphs seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

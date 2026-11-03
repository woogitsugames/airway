// [night-10g] An airport closed by the night curfew is drawn with the red-white barrier ring (task 11): the bot plays
// Endless into week 4+, and whenever the sim closes airports the renderer draws exactly that many barriers; it
// also clears them when the night ends. [night-10h] The tags carry the barrier stub and the edge chips a striped bar. Real game at 412×915 (EN) and 915×412 (PL); fails closed; shots docs/shots/n10g/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const STEPS = 2;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10g');
const results = [];
const frames = (page, n) => page.evaluate((count) => new Promise((done) => {
  let left = count; const step = () => (--left <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step);
}), n);

/** Endless on the fixed seed, bot to the week-3 board, then one bot decision per game hour until a curfew closes. */
async function playIntoCurfew(page) {
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  let s = await page.evaluate(() => window.aw.autoplay(3));
  for (let hour = 0; hour < 96 && !(s.curfewClosed?.length && s.screen === 'game'); hour++) {
    if (s.screen === 'gameover') break;
    await page.evaluate(async () => { await window.aw.botStep(); await window.aw.advanceTicks(60); });
    s = await state(page);
  }
  return s;
}

/** Barrier stubs on tags, striped edge chips, how many of either are on screen, and labels naming the curfew. */
const tagMarks = (page) => page.evaluate(() => {
  const tags = [...document.querySelectorAll('.airport-bubble')].filter((bubble) => bubble.querySelector('.airport-bubble__curfew'));
  const chips = [...document.querySelectorAll('.airport-edge--curfew')];
  const shown = (el) => !el.hidden && el.getBoundingClientRect().width > 0;
  return {
    tags: tags.length, chips: chips.length,
    jammed: tags.filter((bubble) => bubble.classList.contains('airport-bubble--jam')).length,
    visible: tags.filter(shown).length + chips.filter(shown).length,
    labels: tags.filter((bubble) => /closed for the night curfew|zamknięte na ciszę nocną/.test(bubble.getAttribute('aria-label') ?? '')).length,
  };
});

const cases = [
  ['en 412×915: closed airports get the barrier, cleared after the night', 'en', { width: 412, height: 915 }],
  ['pl 915×412: closed airports get the barrier', 'pl', { width: 915, height: 412 }],
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
        const s = await playIntoCurfew(page);
        console.log('state', JSON.stringify({ screen: s.screen, tick: s.tick, closed: s.curfewClosed, drawn: s.curfewDrawn }));
        assert(s.screen === 'game' && s.curfewClosed?.length, `no curfew closure in play (screen ${s.screen}, tick ${s.tick})`);
        await frames(page, 3);
        const drawn = (await state(page)).curfewDrawn;
        assert(drawn === s.curfewClosed.length, `renderer draws ${drawn} barriers for ${s.curfewClosed.length} closed airports`);
        // [night-10h] The same closure on the luggage tags and edge chips, with the screen-reader words.
        const marks = await tagMarks(page);
        assert(marks.tags === s.curfewClosed.length, `${marks.tags} tag barriers for ${s.curfewClosed.length} closed airports`);
        assert(marks.chips === s.curfewClosed.length - marks.jammed, `${marks.chips} striped chips for ${s.curfewClosed.length} closed`);
        assert(marks.visible > 0, 'no curfew sign visible on screen');
        const word = language === 'pl' ? 'zamknięte na ciszę nocną' : 'closed for the night curfew';
        assert(marks.labels === s.curfewClosed.length, `${marks.labels} tag labels say "${word}"`);
        await page.screenshot({ path: resolve(SHOTS, `curfew-${language}-${viewport.width}x${viewport.height}.png`) });
        if (language === 'en') {
          let after = await state(page);
          for (let hour = 0; hour < 12 && after.curfewClosed.length; hour++) {
            await page.evaluate(() => window.aw.advanceTicks(60));
            after = await state(page);
          }
          assert(after.screen === 'game' && after.curfewClosed.length === 0, `night not over in play: ${after.screen} ${after.curfewClosed}`);
          await frames(page, 3);
          const cleared = (await state(page)).curfewDrawn;
          assert(cleared === 0, `${cleared} barriers left after the night`);
          const left = await tagMarks(page);
          assert(left.tags === 0 && left.chips === 0, `curfew signs left after the night: ${JSON.stringify(left)}`);
        }
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `curfew-barrier-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:curfew-barrier seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

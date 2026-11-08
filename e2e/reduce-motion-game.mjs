// [night-48a] PLAN-LINORYT.md U6, D-88: reduce motion inside a Linoryt run, UI side. On the DEV stub world
// (`?render=stub&clock=frozen`, D-254: game time passes only through window.aw, so every reading is exact):
//   - the root carries `data-airway-motion="reduce"`, the one switch the renderer reads for the route line-draw and the
//     jam arc (src/render/linoryt-objects.ts; their drawing is checked by the ext session);
//   - the red "now" cut of the day bar steps once per game hour: within one hour it does not move, at the next hour it
//     jumps to the hour's start; with full motion it follows the minute;
//   - no CSS animation runs on the game screen (no pulsing chip, no sliding cut) while the planes fly.
// PL 412×915 on a reduce-motion system, EN 915×412 with full motion.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, dragGesture, saveDiagnostics, gameUrl, assertRender, SEED } from './browser.mjs';

const started = performance.now();
const CASES = [
  { language: 'pl', width: 412, height: 915, system: 'reduce' },
  { language: 'en', width: 915, height: 412, system: 'no-preference' },
];
const results = [];

async function reading(page) {
  return await page.evaluate(() => {
    const clock = document.querySelector('.lin-clock')?.textContent ?? '';
    const [h, m] = clock.split(':').map(Number);
    const at = Number(document.querySelector('.lin-day__now')?.style.getPropertyValue('--at'));
    const running = document.getAnimations().filter((a) => a.playState === 'running')
      .map((a) => `${a.animationName ?? a.transitionProperty ?? 'animation'} on ${a.effect?.target?.className?.baseVal ?? a.effect?.target?.className ?? '?'}`);
    return { clock, minute: h * 60 + m, at, attr: document.documentElement.dataset.airwayMotion ?? null, running };
  });
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const { language, width, height, system } of CASES) {
      const label = `${language} ${width}×${height} system=${system}`;
      const reduce = system === 'reduce';
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }, { reducedMotion: system });
      try {
        await assertRender(page);
        await waitForScreen(page, 'menu');
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
        await page.evaluate(() => window.aw.advanceTicks(1));
        // Move to a quarter past some hour, then 20 minutes later (same hour), then past the next hour.
        const first = await reading(page);
        assert(first.attr === (reduce ? 'reduce' : 'full'), `root attribute ${first.attr}`);
        await page.evaluate((n) => window.aw.advanceTicks(n), ((75 - (first.minute % 60)) % 60) + 60);
        const a = await reading(page);
        await page.evaluate(() => window.aw.advanceTicks(20));
        const b = await reading(page);
        await page.evaluate((n) => window.aw.advanceTicks(n), 60 - (b.minute % 60) + 5);
        const c = await reading(page);
        const hourAt = (minute) => Math.floor(minute / 60) / 24;
        for (const [name, r] of Object.entries({ a, b, c })) {
          const want = reduce ? hourAt(r.minute) : r.minute / 1440;
          assert(Math.abs(r.at - want) < 1e-3, `${name} ${r.clock}: --at ${r.at}, want ${want.toFixed(4)}`);
        }
        assert(Math.floor(a.minute / 60) === Math.floor(b.minute / 60), `a ${a.clock} and b ${b.clock} not in one hour`);
        if (reduce) {
          assert(a.at === b.at, `the cut moved within one hour: ${a.at} -> ${b.at}`);
          assert(c.at > b.at, `the cut did not step at the next hour: ${b.at} -> ${c.at} (${c.clock})`);
        } else {
          assert(b.at > a.at, `the cut does not follow the minute: ${a.at} -> ${b.at}`);
        }
        if (reduce) assert(c.running.length === 0, `animations running: ${c.running.slice(0, 4).join(' | ')}`);
        assert(!errors.length, `browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} ${a.clock}→${b.clock}→${c.clock} cut ${a.at}→${b.at}→${c.at}`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `reduce-motion-game-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:reduce-motion-game seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length) process.exitCode = 1;
}

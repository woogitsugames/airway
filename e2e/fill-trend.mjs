// [night-11af] R4c: fill trend chevron on the passenger tag (src/ui/overlay.ts) in real Chromium, without a run: the
// overlay is built on the menu page with a fixed camera (like perf:overlay), so the globe frame rate (G7) does not
// matter. Checks: up/down chevron after the count, inside the tag (the width sum grew), aria text PL/EN, removed on
// null, drawn in paper ink on a jammed tag, no animation under "Reduce motion", one short step-in otherwise.
import { performance } from 'node:perf_hooks';
// [night-44a] `test:e2e:fill-trend:stub` (--render=stub): the same overlay on the stub world's menu page (D-254).
import { withBrowser, newGamePage, gameUrl, waitForScreen, assert, saveDiagnostics, assertRender, RENDER } from './browser.mjs';

const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412]];
const ARIA = {
  en: { filling: 'Filling up over the last game hour.', emptying: 'Emptying over the last game hour.' },
  pl: { filling: 'Zapełnia się w ostatniej godzinie gry.', emptying: 'Pustoszeje w ostatniej godzinie gry.' },
};

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        await assertRender(page);
        await waitForScreen(page, 'menu');
        const m = await page.evaluate(async () => {
          const { createAirportOverlay } = await import('/src/ui/overlay.ts');
          const { PerspectiveCamera } = await import('/node_modules/three/build/three.module.js');
          const host = document.createElement('div');
          host.style.cssText = 'position:fixed;inset:0;z-index:99';
          document.body.append(host);
          const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
          camera.position.set(0, 0, 3.2);
          camera.lookAt(0, 0, 0);
          const overlay = createAirportOverlay(host, camera, {});
          overlay.addAirport({ id: 'FRA', code: 'FRA', lon: 0, lat: 0, hub: true });
          overlay.addAirport({ id: 'MAD', code: 'MAD', lon: -14, lat: 10 });
          overlay.setCapacity('FRA', 12);
          overlay.setCapacity('MAD', 12);
          const read = (id) => {
            overlay.update();
            const tag = host.querySelector(`.airport-bubble[data-airport="${id}"]`);
            const chevron = tag.querySelector('.airport-bubble__trend');
            const r = tag.getBoundingClientRect();
            const c = chevron?.getBoundingClientRect();
            const kids = [...tag.children];
            return {
              aria: tag.getAttribute('aria-label'), width: r.width, scroll: tag.scrollWidth - tag.clientWidth,
              trend: chevron?.dataset.trend ?? null,
              up: !!tag.querySelector('.airport-bubble__trend--up'), down: !!tag.querySelector('.airport-bubble__trend--down'),
              inside: c ? c.left >= r.left - 0.5 && c.right <= r.right + 0.5 && c.top >= r.top - 0.5 && c.bottom <= r.bottom + 0.5 : null,
              // [night-11az] D-257: the chevron right after the last count or the occupancy figure ([night-46a] Linoryt: .lin-fill).
              afterCount: chevron ? (kids.indexOf(chevron) === kids.findIndex((el) => el.classList.contains('airport-bubble__timer')) - 1 &&
                kids[kids.indexOf(chevron) - 1]?.matches('svg, .airport-bubble__count')) || !!kids[kids.indexOf(chevron) - 1]?.matches('.lin-fill, .bd-count, .airport-region-glyph') : null, // [night-81a] UI-A: after the count (.bd-count, D-328)
              stroke: chevron ? getComputedStyle(chevron).color : null, tagColour: getComputedStyle(tag).color,
              animation: chevron ? getComputedStyle(chevron).animationName : null,
              duration: chevron ? getComputedStyle(chevron).animationDuration : null,
            };
          };
          const out = {};
          document.documentElement.dataset.airwayMotion = 'full'; // the harness may start with the system setting
          const glyphs = (n) => Array.from({ length: n }, (_, i) => ['EUN', 'NAM', 'ASI', 'AFR'][i % 4]);
          overlay.setPassengers('FRA', glyphs(4));
          out.plain = read('FRA');
          overlay.setFillTrend('FRA', 'filling');
          out.filling = read('FRA');
          overlay.setPassengers('FRA', glyphs(9)); // overflow: chevron after "+3"
          out.overflow = read('FRA');
          overlay.setFillTrend('FRA', 'emptying');
          out.emptying = read('FRA');
          overlay.setFillTrend('FRA', null);
          out.cleared = read('FRA');
          overlay.setPassengers('MAD', glyphs(12));
          overlay.setFillTrend('MAD', 'emptying');
          overlay.setJamCountdown('MAD', 40);
          out.jam = read('MAD');
          document.documentElement.dataset.airwayMotion = 'reduce';
          overlay.setFillTrend('FRA', 'filling');
          out.reduced = read('FRA');
          let bad = null;
          try { overlay.setFillTrend('FRA', 'sideways'); } catch (error) { bad = error.name; }
          out.bad = bad;
          return out;
        });
        const aria = ARIA[language];
        assert(m.plain.trend === null && !m.plain.aria.includes(aria.filling), `${label}: chevron without a trend`);
        assert(m.filling.up && !m.filling.down && m.filling.trend === 'filling', `${label}: filling is not the up chevron`);
        assert(m.filling.aria.endsWith(aria.filling), `${label}: filling aria "${m.filling.aria}"`);
        assert(m.filling.width >= m.plain.width + 16, `${label}: tag did not grow for the chevron (${m.plain.width} → ${m.filling.width})`);
        for (const key of ['filling', 'overflow', 'emptying', 'jam', 'reduced']) {
          assert(m[key].inside === true, `${label}: ${key} chevron outside its tag`);
          assert(m[key].afterCount === true, `${label}: ${key} chevron is not right after the count`);
          assert(m[key].scroll <= 0, `${label}: ${key} tag content clipped by ${m[key].scroll}px`);
        }
        assert(m.emptying.down && !m.emptying.up && m.emptying.aria.endsWith(aria.emptying), `${label}: emptying chevron or aria`);
        assert(m.cleared.trend === null && !m.cleared.up && !m.cleared.down, `${label}: null keeps a chevron`);
        assert(!m.cleared.aria.includes(aria.emptying), `${label}: aria keeps the trend after null`);
        assert(m.jam.down && m.jam.stroke === m.jam.tagColour, `${label}: jammed tag chevron not in the tag ink (${m.jam.stroke} vs ${m.jam.tagColour})`);
        // [night-81a] D-336: UI-A's signs never move (D-328: nothing slides or blinks), so no step-in there.
        const board = await page.evaluate(() => document.documentElement.dataset.skin === 'board');
        if (!board) assert(m.filling.animation === 'airport-trend-in' && parseFloat(m.filling.duration) <= 0.2, `${label}: step-in ${m.filling.animation} ${m.filling.duration}`);
        else assert(m.filling.animation === 'none', `${label}: the board's chevron animates (${m.filling.animation})`);
        assert(m.reduced.animation === 'none', `${label}: reduce motion still animates (${m.reduced.animation})`);
        assert(m.bad === 'RangeError', `${label}: invalid trend accepted`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (tag ${Math.round(m.plain.width)} → ${Math.round(m.filling.width)} px)`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `fill-trend-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
}
for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
if (fatal) console.error('FAIL harness: ' + fatal);
const passed = results.filter((item) => item.status === 'PASS').length;
const failedCount = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:fill-trend seed=0xA1A1${RENDER === 'stub' ? ' render=stub' : ''} steps=${results.length} passed=${passed} failed=${failedCount} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

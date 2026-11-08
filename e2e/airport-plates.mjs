// [night-11m] D-128 (Q-61 → C, R5a): on-screen airports had no code or name (owner's Fold screenshot: four runway
// discs and a pink glyph tag with no airport to read), while the pause summary, crate stamps and the game-over board
// speak in codes. At the gameplay zoom the run opens with, every on-screen airport carries a code plate on its tag;
// zoomed out to the whole network only hubs and the airports the UI names (jam, NEW, slot hold, curfew) keep one. Plates never overlap each other, their text is not clipped, they keep clear of the
// boarding pass and the dock. EN 412×915, PL 915×412, EN 320×568, PL 904×1088; shots docs/shots/n11m/.
// [night-46a] D-301: Linoryt prints each airport as a stamp on the globe (WebGL; the overlay's DEV probe counts them)
// and a paper note beside it whose first line is the airport's name (the compact note: its code). There the plate is
// that shown line: the opening zoom must stamp ≥ 3 airports with ≥ 3 named notes, every shown note keeps its line at
// both zooms, and the zoomed-out thinning of D-128 (the Diorama plates) does not apply.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['airport-plates'].seeds[0];

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11m');
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412], ['en', 320, 568], ['pl', 904, 1088]];

const plates = (page) => page.evaluate(() => {
  const shown = (el) => !el.hidden && el.offsetParent !== null;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const tags = [...document.querySelectorAll('.airport-bubble')].filter(shown);
  const panels = [...document.querySelectorAll('.airway-pass, .airway-dock')].map(rect);
  const state = window.aw.state();
  const hubs = new Set(state.airports.filter((a) => a.hub).map((a) => a.id));
  return {
    hubs: [...hubs],
    tags: tags.map((tag) => {
      const visible = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const plate = [tag.querySelector('.airport-bubble__plate'), tag.querySelector('.lin-name'), tag.querySelector('.lin-code')]
        .find((el) => visible(el) && (el.textContent ?? '').trim().length >= 3) ?? null;
      return {
        id: tag.dataset.airport, plate: plate?.textContent?.trim() ?? null, rect: rect(tag),
        clipped: plate ? plate.scrollWidth > plate.clientWidth + 1 : false,
        named: tag.classList.contains('airport-bubble--jam') || tag.classList.contains('airport-bubble--new') ||
          !!tag.querySelector('.airport-bubble__curfew:not([hidden])'),
        glyphs: tag.querySelectorAll('svg').length,
      };
    }),
    linoryt: document.documentElement.dataset.skin === 'linoryt',
    stamps: (globalThis.__awLinoryt?.stamps() ?? []).filter((stamp) => stamp.visible && stamp.half > 0).length,
    slotIds: [...document.querySelectorAll('.airport-slot')].filter(shown).map((slot) => slot.previousElementSibling?.dataset.airport),
    panels,
  };
});

const overlaps = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

function checkCommon(m, label) {
  for (let i = 0; i < m.tags.length; i++) {
    for (let j = i + 1; j < m.tags.length; j++) assert(!overlaps(m.tags[i].rect, m.tags[j].rect), `${label}: tags ${m.tags[i].id}/${m.tags[j].id} overlap`);
    for (const panel of m.panels) assert(!overlaps(m.tags[i].rect, panel), `${label}: tag ${m.tags[i].id} under the HUD`);
    assert(!m.tags[i].clipped, `${label}: plate ${m.tags[i].plate} clipped`);
  }
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await page.evaluate(() => window.aw.advanceTicks(120));
        await page.waitForTimeout(400);
        // Opening (gameplay) zoom: every on-screen airport carries its plate.
        const opening = await plates(page);
        assert(opening.tags.every((tag) => tag.plate && tag.plate.length >= 3),
          `${label}: opening zoom, tags without a plate ${JSON.stringify(opening.tags.map((tag) => [tag.id, tag.plate]))}`);
        if (opening.linoryt) {
          assert(opening.stamps >= 3 && opening.tags.length >= 3,
            `${label}: opening zoom, ${opening.stamps} stamps and ${opening.tags.length} named notes`);
        } else assert(opening.tags.length >= 3, `${label}: opening zoom, ${opening.tags.length} tags`);
        checkCommon(opening, `${label} opening`);
        await page.screenshot({ path: resolve(SHOTS, `plates-${language}-${width}x${height}.png`) });
        // Zoomed out to the whole network (wheel; a pinch on a phone): only hubs and named airports keep a plate.
        await page.mouse.move(width / 2, height / 2);
        for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(60); }
        await page.waitForTimeout(500);
        const wide = await plates(page);
        if (wide.linoryt) {
          assert(wide.tags.every((tag) => tag.plate && tag.plate.length >= 3), `${label}: zoomed out, a note without its plate`);
        } else {
          for (const tag of wide.tags) {
            if (tag.plate === null) continue;
            assert(wide.hubs.includes(tag.id) || tag.named || wide.slotIds.includes(tag.id),
              `${label}: zoomed out, ${tag.id} keeps a plate without being a hub or named`);
          }
          assert(wide.tags.filter((tag) => tag.plate).length < opening.tags.length, `${label}: zoomed out keeps every plate`);
        }
        checkCommon(wide, `${label} zoomed out`);
        await page.screenshot({ path: resolve(SHOTS, `plates-out-${language}-${width}x${height}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${opening.tags.length} plates at the opening zoom, ${wide.tags.filter((tag) => tag.plate).length} zoomed out)`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `airport-plates-${results.length + 1}`);
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
console.log(`SUMMARY test:e2e:airport-plates seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

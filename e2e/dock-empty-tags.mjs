// [night-11n] R5d: an empty dock tag ("0 widebodies", "0 hub upgrades", Undo with nothing to undo) was drawn at 42 %
// opacity, so at night or under a cloud the globe showed through and hid its icon (docs/research/r5/
// dock-disabled-night.png). Every empty tag must now be fully opaque (its own and every ancestor's opacity 1, an
// opaque background), carry the dashed rack outline (shape, not only colour) and keep its count/icon ink at
// ≥ 4.5:1 on its fill. EN 412×915, PL 915×412, PL 904×1088; dock shots docs/shots/n11n/.
// [night-11s] R6c: an empty aircraft/hub tag no longer reads a bare "0": it counts down to the next weekly crates
// ("2 days" / "2 dni", "5 h" / "5 godz."), matching the run's own clock (aw.state nextWeekTick − tick), not clipped,
// inside its tag, and its aria-label adds "Next crates in …"; checked at the night start and again 9 game hours later
// (day), plus PL 320×568; shots docs/shots/n11s/ (0/4 on the old dock).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11n');
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412], ['pl', 904, 1088], ['pl', 320, 568]];
const COUNTDOWN_SHOTS = resolve(ROOT, 'docs/shots/n11s');
const WAIT = { en: /^(\d+) (day|days|h|min)$/, pl: /^(\d+) (dzień|dni|godz\.|min)$/ };
const SPOKEN = { en: 'Next crates in ', pl: 'Następne skrzynie za ' };

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    mkdirSync(COUNTDOWN_SHOTS, { recursive: true });
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
        await clickTestId(page, 'menu-endless');
        await waitForScreen(page, 'game');
        await page.waitForTimeout(400);
        const tags = await page.evaluate(() => {
          const rgb = (text) => (text.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
            .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
          return [...document.querySelectorAll('.airway-dock__tag.is-empty')].map((tag) => {
            let opacity = 1;
            for (let node = tag; node && node instanceof Element; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
            const style = getComputedStyle(tag);
            const bg = rgb(style.backgroundColor);
            const fg = rgb(style.color);
            const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
            return {
              action: tag.dataset.hudAction, opacity, bgAlpha: bg.length > 3 ? bg[3] : 1,
              outline: getComputedStyle(tag, '::after').borderTopStyle, contrast: (a + 0.05) / (b + 0.05),
            };
          });
        });
        assert(tags.length >= 2, `${label}: expected empty tags at the start, saw ${tags.length}`);
        for (const tag of tags) {
          assert(tag.opacity === 1, `${label}: ${tag.action} tag opacity ${tag.opacity}`);
          assert(tag.bgAlpha === 1, `${label}: ${tag.action} tag background alpha ${tag.bgAlpha}`);
          assert(tag.outline === 'dashed', `${label}: ${tag.action} tag has no dashed outline (${tag.outline})`);
          assert(tag.contrast >= 4.5, `${label}: ${tag.action} ink contrast ${tag.contrast.toFixed(2)}`);
        }
        const dock = await page.locator('.airway-dock').boundingBox();
        if (dock && width !== 320) await page.screenshot({ path: resolve(SHOTS, `dock-${language}-${width}x${height}.png`), clip: dock });
        // [night-11s] R6c: the crate countdown, at the night start and 9 game hours later.
        for (const [phase, advance] of [['night', 0], ['day', 540]]) {
          if (advance) { await page.evaluate((ticks) => window.aw.advanceTicks(ticks), advance); await page.waitForTimeout(300); }
          const { left, tags: waits } = await page.evaluate(() => {
            const s = window.aw.state();
            return {
              left: s.nextWeekTick - s.tick,
              tags: [...document.querySelectorAll('.airway-dock__tag.is-empty')].filter((tag) => tag.dataset.hudAction !== 'undo').map((tag) => {
                const count = tag.querySelector('.airway-dock__count');
                const c = count.getBoundingClientRect(), r = tag.getBoundingClientRect();
                return {
                  action: tag.dataset.hudAction, countdown: tag.classList.contains('is-countdown'), text: count.textContent,
                  aria: tag.getAttribute('aria-label') ?? '', clipped: count.scrollWidth > count.clientWidth + 1,
                  inside: c.left >= r.left - 0.5 && c.right <= r.right + 0.5 && c.bottom <= r.bottom + 0.5 && c.width > 0,
                };
              }),
            };
          });
          assert(waits.length >= 2, `${label} ${phase}: expected empty aircraft/hub tags, saw ${waits.length}`);
          const days = Math.floor(left / 1440), hours = Math.floor((left % 1440) / 60);
          for (const tag of waits) {
            const match = WAIT[language].exec(tag.text);
            assert(tag.countdown && match, `${label} ${phase}: ${tag.action} tag reads "${tag.text}", not a crate countdown`);
            const expected = days > 0 ? days : hours > 0 ? hours : left;
            assert(Number(match[1]) === expected, `${label} ${phase}: ${tag.action} "${tag.text}" vs ${left} min to the board`);
            assert(tag.aria.includes(SPOKEN[language]), `${label} ${phase}: ${tag.action} aria "${tag.aria}"`);
            assert(!tag.clipped && tag.inside, `${label} ${phase}: ${tag.action} countdown clipped or outside its tag`);
          }
          if (dock) await page.screenshot({ path: resolve(COUNTDOWN_SHOTS, `dock-${language}-${width}x${height}-${phase}.png`), clip: dock });
          if (phase === 'day') await page.screenshot({ path: resolve(COUNTDOWN_SHOTS, `game-${language}-${width}x${height}-day.png`) });
        }
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${tags.map((tag) => tag.action).join(', ')})`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `dock-empty-tags-${results.length + 1}`);
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
console.log(`SUMMARY test:e2e:dock-empty-tags seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

// [night-11n] R5d: an empty dock tag ("0 widebodies", "0 hub upgrades", Undo with nothing to undo) was drawn at 42 %
// opacity, so at night or under a cloud the globe showed through and hid its icon (docs/research/r5/
// dock-disabled-night.png). Every empty tag must now be fully opaque (its own and every ancestor's opacity 1, an
// opaque background), carry the dashed rack outline (shape, not only colour) and keep its count/icon ink at
// ≥ 4.5:1 on its fill. EN 412×915, PL 915×412, PL 904×1088; dock shots docs/shots/n11n/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11n');
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412], ['pl', 904, 1088]];

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
        if (dock) await page.screenshot({ path: resolve(SHOTS, `dock-${language}-${width}x${height}.png`), clip: dock });
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

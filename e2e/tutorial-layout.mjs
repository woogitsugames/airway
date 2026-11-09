// [night-11l] Owner feedback from a real Galaxy Fold (unfolded, with a status bar): on the training flight the hint
// line under the ATC card ("Drag the tag onto the route marker", "Simulation paused…") overlapped the card's bottom
// edge; the TURBOPROP tag and "Watch the sunrise" were cut with a notch that read as a second button behind them;
// and on the night step a dark rectangle stuck out beyond the globe and over the header's bottom strip.
// For each size the flight is played to the aircraft and the night step: the hint sits below the card with its own
// gap and above the dock, the world fits its row, the action tags use the dock's luggage-tag outline (one shape),
// and at night only the globe darkens (the world box keeps the stage colour). PL/EN; shots docs/shots/n11l/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, assert, clickTestId, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11l');
const results = [];
// [night-11p] D-130: the night step is gone; the last ("cleared") step is measured instead, and the planet must stay
// inside the screen sides (it overflowed a 412 px phone by ~11 px a side).
// 686×762 "insets": the unfolded Fold; Chromium cannot emulate env(safe-area-inset-*), so the stage gets the
// device's status bar (40 px) and gesture bar (20 px) as padding — the layout that overflowed on the phone.
const INSETS = '.aw-tutorial-stage { padding-top: 49px !important; padding-bottom: 29px !important; }';
const CASES = [
  ['pl', 686, 762, true], ['pl', 673, 841], ['en', 412, 915], ['pl', 360, 640], ['en', 320, 568], ['pl', 915, 412], ['en', 904, 1000],
];
const TAG_SHAPE = 'polygon(14px 0px, calc(100% - 14px) 0px, 100% 14px, 100% 100%, 0px 100%, 0px 14px)';

const mid = async (page, id) => {
  const r = await page.getByTestId(id).boundingBox();
  if (!r) throw new Error(`missing ${id}`);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
async function drag(page, from, to) {
  const a = await mid(page, from);
  const b = await mid(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 9 });
  await page.mouse.up();
}
const atStep = (page, name) => page.waitForFunction((s) =>
  document.querySelector('[data-testid="tutorial"]')?.getAttribute('data-step') === s, name, { timeout: 5000 });

async function measure(page, tagId) {
  return page.evaluate((id) => {
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const strip = box('.aw-tutorial-strip');
    const hint = document.querySelector('[data-testid="tutorial-hint"]');
    const range = document.createRange();
    range.selectNodeContents(hint);
    const text = range.getBoundingClientRect();
    const dock = box('.aw-tutorial-dock');
    const world = box('.aw-tutorial-world');
    const center = box('.aw-tutorial-center');
    const tag = document.querySelector(`[data-testid="${id}"]`);
    const stage = document.querySelector('.aw-tutorial-stage');
    const landscape = innerWidth > innerHeight && innerHeight <= 590;
    return {
      landscape,
      strip: strip && { top: strip.top, bottom: strip.bottom, left: strip.left, right: strip.right },
      text: { top: text.top, bottom: text.bottom, left: text.left, right: text.right, h: text.height },
      dockTop: dock?.top ?? null,
      world: world && { top: world.top, bottom: world.bottom }, center: center && { top: center.top, bottom: center.bottom },
      tagShape: tag ? getComputedStyle(tag).clipPath : null,
      skin: document.documentElement.dataset.skin,
      worldBg: getComputedStyle(document.querySelector('.aw-tutorial-world')).backgroundColor,
      // [night-11p] the planet (first circle of the art) must stay inside the screen sides
      planet: (() => { const r = document.querySelector('.aw-world-art > circle').getBoundingClientRect(); return { left: r.left, right: r.right }; })(),
      width: innerWidth,
      stageBg: getComputedStyle(stage).backgroundColor,
    };
  }, tagId);
}

function check(m, label) {
  assert(m.text.h > 0, `${label}: hint has no text`);
  if (!m.landscape) {
    // Portrait: hint row between the ATC card and the dock, clear of both.
    assert(m.text.top >= m.strip.bottom + 4, `${label}: hint text ${m.text.top.toFixed(1)} overlaps the card (bottom ${m.strip.bottom.toFixed(1)})`);
    assert(m.text.bottom <= m.dockTop - 2, `${label}: hint text ${m.text.bottom.toFixed(1)} runs into the dock (${m.dockTop})`);
  } else {
    // Landscape: the hint is in its own column; it must not intersect the card either way.
    const apart = m.text.right <= m.strip.left || m.text.left >= m.strip.right || m.text.bottom <= m.strip.top || m.text.top >= m.strip.bottom;
    assert(apart, `${label}: hint text intersects the card`);
  }
  assert(m.world.top >= m.center.top - 0.5 && m.world.bottom <= m.center.bottom + 0.5 && m.strip.bottom <= m.center.bottom + 0.5,
    `${label}: world/card overflow their row ${JSON.stringify({ world: m.world, strip: m.strip.bottom, center: m.center })}`);
  // [night-81a] D-336: UI-A prints the action as a plain strip-paper plate like its console (no luggage-tag clip).
  assert(m.tagShape === (m.skin === 'board' ? 'none' : TAG_SHAPE), `${label}: tag outline ${m.tagShape}`);
  assert(m.planet.left >= -0.5 && m.planet.right <= m.width + 0.5,
    `${label}: planet ${m.planet.left.toFixed(1)}…${m.planet.right.toFixed(1)} crosses the screen sides (0…${m.width})`);
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height, insets] of CASES) {
      const label = `${language} ${width}×${height}${insets ? ' insets' : ''}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        if (insets) await page.addStyleTag({ content: INSETS });
        await clickTestId(page, 'menu-endless');
        await atStep(page, 'route');
        await drag(page, 'city-lon', 'city-par');
        await atStep(page, 'aircraft');
        await page.waitForTimeout(250);
        check(await measure(page, 'tutorial-plane-tag'), `${label} aircraft`);
        await page.screenshot({ path: resolve(SHOTS, `aircraft-${language}-${width}x${height}${insets ? '-insets' : ''}.png`) });
        await drag(page, 'tutorial-plane-tag', 'tutorial-route-drop');
        await atStep(page, 'transfer');
        await page.getByTestId('city-par').click();
        // [night-11p] D-130: no night step any more; the last step ("Start flying") carries the dawn sentence.
        await atStep(page, 'complete');
        await page.waitForTimeout(250);
        const last = await measure(page, 'tutorial-continue');
        check(last, `${label} cleared`);
        assert(last.worldBg === last.stageBg || last.worldBg === 'rgba(0, 0, 0, 0)',
          `${label} cleared: world box ${last.worldBg} differs from the stage ${last.stageBg} (a dark rectangle)`);
        await page.screenshot({ path: resolve(SHOTS, `cleared-${language}-${width}x${height}${insets ? '-insets' : ''}.png`) });
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `tutorial-layout-${results.length + 1}`);
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
console.log(`SUMMARY test:e2e:tutorial-layout seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
  `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

// [night-10z] Found in the N10x long play at 800×1280: a luggage tag of an on-screen airport by the left edge was
// drawn over the edge chip of an off-screen airport, hiding its code ("←B…"). Edge chips now first look for a place
// clear of the placed tags too (they may still sit under a tag only when the edge is too crowded). Seeds 0xA1C3 (0xA1C2 until rules v6) and
// 41817 grow networks on several continents; at three sizes the run is sampled after the week-1 and week-2 boards and
// a day later each: every visible chip must be clear of every visible tag (main tag and slot tag).
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, RENDER, gameUrl, assertRender, waitForBoardModels,
} from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

const started = performance.now();
const results = [];
const SEEDS = E2E_SEEDS['edge-chip-tags'].seeds; // [night-12aa] 0xA1C2 → 0xA1C3 under rules v6 (test:e2e-seeds)
const SIZES = [['en', 412, 915], ['pl', 915, 412], ['pl', 673, 841]];

async function audit(page) {
  return page.evaluate(() => {
    const boxes = (selector) => [...document.querySelectorAll(selector)]
      .filter((node) => !node.hidden && node.offsetParent !== null && getComputedStyle(node).visibility !== 'hidden')
      .map((node) => ({ name: (node.textContent || '').trim().slice(0, 10), r: node.getBoundingClientRect() }));
    const chips = boxes('.airport-edge');
    const tags = [...boxes('.airport-bubble'), ...boxes('.airport-slot')];
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const problems = [];
    for (const chip of chips) for (const tag of tags) {
      if (hit(chip.r, tag.r)) problems.push(`chip ${chip.name} ${Math.round(chip.r.left)},${Math.round(chip.r.top)} under tag "${tag.name}" ${Math.round(tag.r.left)},${Math.round(tag.r.top)}`);
    }
    return { chips: chips.length, tags: tags.length, problems };
  });
}

// [night-12bf] `npm run test:e2e:edge-chip-tags:stub` (--render=stub): the chips and tags are DOM placed from the real
// camera/projection, so the stub world (D-254) gives the same audit without the weekly-card click timeout (G7).
async function journey(page, seed) {
  await assertRender(page);
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((s) => window.aw.prepareSeed(s), seed);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  let chips = 0;
  const problems = [];
  for (let week = 1; week <= 2; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    if (s.screen !== 'upgrade') break; // the run may close early: what was sampled still counts
    const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
    const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
    await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
    await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
    await waitForScreen(page, 'game');
    // [night-86b] D-344: the camera now follows the network once a game day, so most airports stay in view; a pinch
    // (wheel) in puts airports off the screen again so the edge signs are exercised (and holds the follow off).
    const view = page.viewportSize();
    await page.mouse.move(view.width / 2, view.height / 2);
    for (let step = 0; step < 3; step++) { await page.mouse.wheel(0, -150); await page.waitForTimeout(120); }
    for (let sample = 0; sample < 2; sample++) {
      if (sample) await page.evaluate(() => window.aw.advanceTicks(24 * 60));
      await page.waitForTimeout(500);
      if ((await page.evaluate(() => window.aw.state().screen)) !== 'game') break;
      const a = await audit(page);
      chips += a.chips;
      problems.push(...a.problems.map((p) => `week ${week}.${sample}: ${p}`));
    }
  }
  assert(problems.length === 0, problems.slice(0, 4).join('; ') + (problems.length > 4 ? ` (+${problems.length - 4})` : ''));
  return chips;
}

let fatal = null;
let sampled = 0;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const seed of SEEDS) for (const [language, width, height] of SIZES) {
      const label = `seed ${seed} ${language} ${width}×${height}: edge chips clear of airport tags`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        const chips = await journey(page, seed);
        sampled += chips;
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${chips} chips)`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `edge-chip-tags${RENDER === 'stub' ? '-stub' : ''}-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
// Some sizes keep every airport on screen; the suite as a whole must exercise the edges.
if (sampled < 20) results.push({ label: `chips sampled over all cases: ${sampled} (< 20, the scenes do not exercise the edges)`, status: 'FAIL' });
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
const steps = SEEDS.length * SIZES.length;
console.log(`SUMMARY test:e2e:edge-chip-tags${RENDER === 'stub' ? ' render=stub' : ''} seeds=${SEEDS.length} steps=${steps} chips=${sampled} passed=${results.filter((r) => r.status === 'PASS').length} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed || results.length < steps ? 1 : 0;

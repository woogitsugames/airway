// [night-11d] An airport off screen showed only its code on the edge chip until its waiting area was already full
// (red chip, 45 s of grace before the network closes). The chip now carries a gauge under the code: the share of
// waiting places taken, signal red from three quarters full, hidden while nobody waits, named in the chip's label.
// Seeds 0xA1C2 and 41817 at EN 412×915 and PL 915×412: after the week-1 board, then a day later and zoomed in (more
// airports leave the screen) and every 2 h for 12 h after that (until the run closes), every visible chip is checked against the run's waiting count and capacity.
import { performance } from 'node:perf_hooks';
import {
  withBrowser, newGamePage, gameUrl, SKIN, RENDER, assertRender, waitForScreen, assert, clickTestId, saveDiagnostics, waitForBoardModels,
} from './browser.mjs';
// [night-44a] `test:e2e:edge-chip-fill:stub` (--render=stub): chips are DOM placed from the real camera/projection and
// the wheel zoom goes to the same orbit camera, so the stub world (D-254) gives the same audit; time already passes
// only through window.aw (the frozen clock just removes the drift the audit allows).
import { E2E_SEEDS } from './seeds.mjs';

const started = performance.now();
const results = [];
const SEEDS = E2E_SEEDS['edge-chip-fill'].seeds; // [night-12ac] e2e/seeds.mjs
const SIZES = [['en', 412, 915], ['pl', 915, 412]];

async function audit(page) {
  // [night-30a] the Linoryt preview prints a high fill in its own red ink (linoryt.css U2 notes).
  return page.evaluate((highRed) => {
    const airports = new Map((window.aw.state().airports ?? []).map((a) => [a.id, a]));
    const problems = [];
    let filled = 0;
    let high = 0;
    let chips = 0;
    for (const chip of document.querySelectorAll('.airport-edge')) {
      if (chip.hidden || chip.offsetParent === null) continue;
      chips++;
      const code = (chip.textContent || '').trim();
      const airport = airports.get(code);
      if (!airport) { problems.push(`chip ${code}: no airport in the run`); continue; }
      const taken = Math.min(airport.waiting, airport.capacity);
      const gauge = chip.querySelector('.airport-edge__gauge');
      if (!gauge) { problems.push(`chip ${code} (${taken}/${airport.capacity}): no waiting gauge`); continue; }
      const shown = !gauge.hidden && getComputedStyle(gauge).display !== 'none';
      const [domTaken, domCap] = (chip.dataset.fill || '0/0').split('/').map(Number);
      // The clock keeps running between the overlay frame and this read: allow one passenger of drift.
      if (Math.abs(domTaken - taken) > 1 || (shown && domCap !== airport.capacity)) {
        problems.push(`chip ${code}: gauge says ${chip.dataset.fill}, run has ${taken}/${airport.capacity}`);
      }
      if (domTaken === 0) { if (shown) problems.push(`chip ${code}: gauge shown with nobody waiting`); continue; }
      if (!shown) { problems.push(`chip ${code} (${domTaken}/${domCap}): gauge hidden`); continue; }
      filled++;
      const track = gauge.getBoundingClientRect();
      const fill = gauge.querySelector('.airport-edge__fill').getBoundingClientRect();
      const inner = track.width - 3; // 1.5 px border each side
      const want = Math.max(0.08, domTaken / domCap);
      if (Math.abs(fill.width / inner - want) > 0.06) problems.push(`chip ${code}: fill ${(fill.width / inner).toFixed(2)} for ${domTaken}/${domCap}`);
      const box = chip.getBoundingClientRect();
      if (track.left < box.left || track.right > box.right || track.bottom > box.bottom) problems.push(`chip ${code}: gauge outside the chip`);
      const text = [...chip.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
      const range = document.createRange();
      range.selectNodeContents(text);
      const label = range.getBoundingClientRect();
      if (label.bottom > track.top + 0.5) problems.push(`chip ${code}: code ${label.bottom.toFixed(1)} runs into the gauge ${track.top.toFixed(1)}`);
      const red = getComputedStyle(gauge.querySelector('.airport-edge__fill')).backgroundColor === highRed;
      const isHigh = domTaken * 4 >= domCap * 3;
      if (isHigh) high++;
      if (!chip.classList.contains('airport-edge--jam') && red !== isHigh) problems.push(`chip ${code}: red=${red} at ${domTaken}/${domCap}`);
      const aria = chip.getAttribute('aria-label') || '';
      if (!aria.includes(String(domCap)) || !aria.includes(String(domTaken))) problems.push(`chip ${code}: label "${aria}" misses ${domTaken}/${domCap}`);
    }
    return { chips, filled, high, problems };
  }, SKIN === 'linoryt' ? 'rgb(179, 56, 35)' : 'rgb(200, 53, 42)');
}

async function journey(page, seed, width, height) {
  await assertRender(page);
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((s) => window.aw.prepareSeed(s), seed);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  const s = await page.evaluate(() => window.aw.autoplay(1));
  assert(s.screen === 'upgrade', `expected the week-1 board, saw ${s.screen}`);
  const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
  const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
  await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
  await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
  await waitForScreen(page, 'game');
  const total = { chips: 0, filled: 0, high: 0 };
  const problems = [];
  for (let sample = 0; sample < 9; sample++) {
    if (sample === 1) await page.evaluate(() => window.aw.advanceTicks(12 * 60));
    if (sample === 2) {
      await page.mouse.move(width / 2, height / 2);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(60); }
    }
    if (sample >= 3) await page.evaluate(() => window.aw.advanceTicks(2 * 60)); // fuller waiting areas: red gauges
    await page.waitForTimeout(600);
    if ((await page.evaluate(() => window.aw.state().screen)) !== 'game') break;
    const a = await audit(page);
    total.chips += a.chips; total.filled += a.filled; total.high += a.high;
    problems.push(...a.problems.map((p) => `sample ${sample}: ${p}`));
  }
  assert(problems.length === 0, problems.slice(0, 4).join('; ') + (problems.length > 4 ? ` (+${problems.length - 4})` : ''));
  return total;
}

let fatal = null;
const sum = { chips: 0, filled: 0, high: 0 };
try {
  await withBrowser(async ({ browser, url }) => {
    for (const seed of SEEDS) for (const [language, width, height] of SIZES) {
      const label = `seed ${seed} ${language} ${width}×${height}: edge chips draw the waiting area`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        const t = await journey(page, seed, width, height);
        sum.chips += t.chips; sum.filled += t.filled; sum.high += t.high;
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${t.chips} chips, ${t.filled} with a gauge)`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `edge-chip-fill-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
// The scenes must actually put airports with waiting passengers behind the screen edge.
if (sum.filled < 6) results.push({ label: `chips with a gauge over all cases: ${sum.filled} (< 6, the scenes do not exercise it)`, status: 'FAIL' });
if (sum.high < 1) results.push({ label: 'no chip reached three quarters full: the red gauge is not exercised', status: 'FAIL' });
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
const steps = SEEDS.length * SIZES.length;
console.log(`SUMMARY test:e2e:edge-chip-fill${RENDER === 'stub' ? ' render=stub' : ''} steps=${steps} chips=${sum.chips} gauges=${sum.filled} high=${sum.high} passed=${results.filter((r) => r.status === 'PASS').length} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed || results.length < steps ? 1 : 0;

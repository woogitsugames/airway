// [night-07u] Layout audit of the yellow sign during the weekly airport pick ("+2 slots" / hub expansion).
// The instruction used to share one row with the week and the Back tile, so it was squeezed to 0–66 px and the
// sign grew to 84–117 px (PL/EN) on phone landscape and to 4 lines on a 360 px portrait phone. Checks, in PL and
// EN at five sizes: the sign does not cover the boarding pass or the peg rack, the instruction keeps a readable
// width, the Back tile stays a 48 px target, and beside the pass (≥ 844 px landscape) the sign is no taller than
// the pass. Fixed seed, fails closed.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12ac] Seed from e2e/seeds.mjs, replayed headless by test:e2e-seeds (in test:fast).
const SEED = E2E_SEEDS['pick-sign'].seeds[0];

const started = performance.now();
const results = [];
// [width, height, sign no taller than the pass]
const VIEWPORTS = [[915, 412, true], [844, 390, true], [740, 360, false], [412, 915, false], [360, 640, false]];
const LANGUAGES = ['pl', 'en'];
const MIN_SUB_WIDTH = 90;

const offers = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((node) => node.dataset.upgrade));

/** Autoplay week by week until a board offers an airport pick, then open it. */
async function openPick(page) {
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  for (let week = 1; week < 7; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    assert(s.screen === 'upgrade', `week ${week}: run ended on ${s.screen}`);
    const list = await offers(page);
    const pick = list.findIndex((item) => item === 'departure-slots' || item === 'hub-expansion');
    if (pick >= 0) {
      await clickTestId(page, `upgrade-option-${pick}`);
      await page.locator('.airway-upgrade-open.is-picking-hub').waitFor({ timeout: 5000 });
      return;
    }
    await clickTestId(page, 'upgrade-option-0');
    await waitForScreen(page, 'game');
  }
  throw new Error('no airport pick offered in 6 weeks');
}

async function audit(page, besidePass) {
  const box = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      sign: rect('.airway-upgrade-sign'), sub: rect('.airway-upgrade-sub'), back: rect('.airway-upgrade-back'),
      pass: rect('.airway-pass'), dock: rect('.airway-dock'), vw: innerWidth,
    };
  });
  const { sign, sub, back, pass, dock } = box;
  assert(sign && sub && back && pass, `missing parts ${JSON.stringify(box)}`);
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const px = (n) => Math.round(n);
  assert(!overlaps(sign, pass), `sign ${px(sign.left)},${px(sign.top)} covers the pass ..${px(pass.right)},${px(pass.bottom)}`);
  if (dock) assert(!overlaps(sign, dock), `sign ..${px(sign.right)} covers the peg rack from ${px(dock.left)}`);
  assert(sign.right <= box.vw, `sign runs off screen to ${px(sign.right)}`);
  assert(sub.width >= MIN_SUB_WIDTH, `instruction squeezed to ${px(sub.width)} px`);
  assert(back.width >= 48 && back.height >= 48, `Back tile ${px(back.width)}×${px(back.height)} below 48 px`);
  if (besidePass) assert(sign.height <= pass.height + 1, `sign ${px(sign.height)} px taller than the pass ${px(pass.height)} px`);
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const language of LANGUAGES) for (const [width, height, besidePass] of VIEWPORTS) {
      const label = `${language} ${width}x${height} airport-pick sign fits`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, url, language, { width, height }));
        await openPick(page);
        await page.waitForTimeout(250); // the slip-in animation is off (reduced motion); let layout settle
        await audit(page, besidePass);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'pick-sign-' + (results.length + 1)) : null;
        results.push({ label, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        if (page) await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { label, status, why } of results) {
    const line = `${status} ${label}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const total = LANGUAGES.length * VIEWPORTS.length;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`SUMMARY test:e2e:pick-sign seed=0x${SEED.toString(16).toUpperCase()} steps=${total} passed=${passed} failed=${failed} durationMs=${elapsedMs}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

// [night-08c] Found in a long play-through at 360×640: the weekly board's third crate sat half below the screen
// (the overlay scrolled 51–111 px; 190–232 px at 320×568). Short portrait phones now get a compact board. Checks
// the week-1 and week-2 boards (week 2 carries the tall hub-expansion label) in PL/EN: at 360×640 nothing scrolls
// and all three labels lie inside the viewport below the boarding pass; [night-08e] the same at 320×568.
import { performance } from 'node:perf_hooks';
// [night-29a] --skin=linoryt; [night-44a] --render=stub (`test:e2e:board-short:stub`): the board is DOM over the HUD, so
// the stub world (D-254) measures the same layout. gameUrl() is skinUrl() on the real renderer.
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, gameUrl, assertRender, RENDER, waitForBoardModels } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// [night-12aa] Per-suite seed, replayed headless by test:e2e-seeds (rules v6 ended 0xA1A1 in week 2).
const SEED = E2E_SEEDS['board-short'].seeds[0];

const started = performance.now();
const results = [];
// [width, height, allowed overlay scroll in px]
const SIZES = [[360, 640, 0], [320, 568, 0]]; // [night-08e] 320×568 fits too (was ≤ 24 px)
const LANGUAGES = ['pl', 'en'];

async function measure(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.airway-upgrade-open');
    const pass = document.querySelector('.airway-pass')?.getBoundingClientRect();
    const tags = [...document.querySelectorAll('.airway-upgrade-tag')].map((tag) => tag.getBoundingClientRect());
    return {
      scroll: overlay ? overlay.scrollHeight - overlay.clientHeight : -1,
      passBottom: pass ? pass.bottom : -1,
      tags: tags.map((r) => ({ top: r.top, bottom: r.bottom, height: r.height })),
      vh: innerHeight,
    };
  });
}

async function boards(page, allowed, language, width, height) {
  await assertRender(page);
  assert(await page.evaluate(() => window.aw?.ready), 'window.aw.ready=false: no AwDevAdapter registered');
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  for (let week = 1; week <= 2; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    assert(s.screen === 'upgrade', `week ${week}: run ended on ${s.screen}`);
    await page.waitForTimeout(250);
    const m = await measure(page);
    const tag = `${language} ${width}x${height} week ${week}`;
    assert(m.tags.length === 3, `${tag}: ${m.tags.length} labels`);
    assert(m.scroll <= allowed, `${tag}: board scrolls ${m.scroll} px (allowed ${allowed})`);
    if (allowed === 0) {
      for (const [i, r] of m.tags.entries()) {
        assert(r.top >= m.passBottom - 0.5, `${tag}: label ${i + 1} top ${Math.round(r.top)} under the pass (${Math.round(m.passBottom)})`);
        assert(r.bottom <= m.vh + 0.5, `${tag}: label ${i + 1} ends at ${Math.round(r.bottom)} > ${m.vh}`);
        assert(r.height >= 48, `${tag}: label ${i + 1} target ${Math.round(r.height)} px`);
      }
    }
    const plain = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')]
      .findIndex((node) => node.dataset.upgrade !== 'hub-expansion' && node.dataset.upgrade !== 'departure-slots'));
    await waitForBoardModels(page); // [night-47a] crate-model frame first (N45a)
    await clickTestId(page, `upgrade-option-${Math.max(0, plain)}`);
    await waitForScreen(page, 'game');
  }
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const language of LANGUAGES) for (const [width, height, allowed] of SIZES) {
      const label = `${language} ${width}x${height} weekly board fits a short phone`;
      let page;
      try {
        let errors;
        ({ page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }));
        await boards(page, allowed, language, width, height);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = page ? await saveDiagnostics(page, 'board-short-' + (results.length + 1)) : null;
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
  const total = LANGUAGES.length * SIZES.length;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:board-short seed=0x${SEED.toString(16).toUpperCase()}${RENDER === 'stub' ? ' render=stub' : ''} steps=${total} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

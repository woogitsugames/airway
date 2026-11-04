// [night-11ai] R4g: keyboard and mouse basics in real Chromium on a desktop page (no touch screen), EN 1280×800 and
// PL 915×412. Settings → Help lists the keys and mouse actions in the page language; Escape leaves settings. In the
// first seconds of a seeded run (as test:e2e:focus-pause: no weekly board, so the globe frame rate (G7) only slows
// the start): the HUD pause and speed controls carry aria-keyshortcuts; 3/1/2 set 4×/1×/2×; Space opens the pause
// sheet and holds the clock, a digit there changes nothing, Space on the focused Resume resumes once; Space with the
// speed tag focused pauses without cycling the speed; Escape resumes; + and − zoom the globe one step; a right click
// on the globe opens no browser menu; the mouse over an airport gives a pointer cursor and marks its tag, over the
// globe away from the airports nothing; a HUD tag shows its hover rule.
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, state, assert, saveDiagnostics } from './browser.mjs';
import { E2E_SEEDS } from './seeds.mjs';

// The run only needs its first seconds, like focus-pause (seed replayed headless by test:e2e-seeds).
const SEED = E2E_SEEDS['focus-pause'].seeds[0];
const started = performance.now();
const results = [];
const TEXT = {
  en: { title: 'Keyboard and mouse', space: 'Space', pause: 'Pause or resume', wheel: 'Mouse wheel: zoom the globe' },
  pl: { title: 'Klawiatura i mysz', space: 'Spacja', pause: 'Pauza lub wznowienie', wheel: 'Kółko myszy: przybliż lub oddal glob' },
};
const CASES = [['en', 1280, 800], ['pl', 915, 412]];

const sheetOpen = (page) => page.evaluate(() => { const s = document.querySelector('.airway-pause'); return !!s && !s.hidden; });
const speedOf = (page) => page.evaluate(() => document.querySelector('[data-hud-action="speed"]')?.dataset.speed ?? null);
const zoomOf = (page) => page.evaluate(() => window.__awWorld.zoom());
const ticksMove = async (page, ms = 900) => {
  const a = (await state(page)).tick;
  await page.waitForTimeout(ms);
  return (await state(page)).tick > a;
};

async function step(label, fn) {
  try { await fn(); results.push({ label, status: 'PASS' }); } catch (error) {
    results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] });
    if (error && typeof error === 'object') error.stepped = true;
    throw error;
  }
}

async function journey(page, language, size) {
  await step(`${language} ${size} settings help lists keys and mouse`, async () => {
    await waitForScreen(page, 'menu');
    await clickTestId(page, 'menu-settings');
    await waitForScreen(page, 'settings');
    const m = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="settings-keys"]');
      if (!box) return null;
      const rows = [...box.querySelectorAll('.airway-keys__row')];
      return {
        shown: getComputedStyle(box).display !== 'none' && box.getBoundingClientRect().height > 0,
        title: box.querySelector('.airway-glyph-legend__title')?.textContent,
        rows: rows.map((row) => ({ keys: [...row.querySelectorAll('kbd')].map((k) => k.textContent), text: row.querySelector('.airway-keys__label')?.textContent })),
        anyHoverNone: matchMedia('(any-hover: none)').matches,
      };
    });
    assert(m, 'no [data-testid="settings-keys"] in Settings → Help');
    assert(m.shown, 'the key list is hidden on a page with a mouse');
    const want = TEXT[language];
    assert(m.title === want.title, `title "${m.title}"`);
    assert(m.rows.length === 6, `${m.rows.length} rows`);
    assert(m.rows[0].keys.join() === want.space && m.rows[0].text === want.pause, `pause row ${JSON.stringify(m.rows[0])}`);
    assert(m.rows[1].keys.join(' ') === '1 2 3', `speed row ${JSON.stringify(m.rows[1])}`);
    assert(m.rows[4].keys.length === 0 && m.rows[4].text === want.wheel, `wheel row ${JSON.stringify(m.rows[4])}`);
    await page.keyboard.press('Escape');
    await waitForScreen(page, 'menu');
  });

  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  await page.waitForFunction(() => window.aw.state().tick > 3, null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());

  await step(`${language} ${size} aria-keyshortcuts and 1/2/3 speed`, async () => {
    const aria = await page.evaluate(() => [
      document.querySelector('[data-hud-action="pause"]')?.getAttribute('aria-keyshortcuts'),
      document.querySelector('[data-hud-action="speed"]')?.getAttribute('aria-keyshortcuts'),
    ]);
    assert(aria[0] === 'Space' && aria[1] === '1 2 3', `aria-keyshortcuts ${JSON.stringify(aria)}`);
    await page.keyboard.press('3');
    assert(await speedOf(page) === '4', `3 → speed ${await speedOf(page)}`);
    await page.keyboard.press('1');
    assert(await speedOf(page) === '1', `1 → speed ${await speedOf(page)}`);
    await page.keyboard.press('2');
    assert(await speedOf(page) === '2', `2 → speed ${await speedOf(page)}`);
  });

  await step(`${language} ${size} Space pauses and the focused Resume resumes once`, async () => {
    await page.keyboard.press('Space');
    assert(await sheetOpen(page), 'Space did not open the pause sheet');
    assert(!(await ticksMove(page)), 'the clock ran while paused');
    await page.keyboard.press('3');
    assert(await speedOf(page) === '2', 'a digit changed the speed behind the pause sheet');
    const focused = await page.evaluate(() => document.activeElement?.dataset.testid ?? null);
    assert(focused === 'action-resume', `focus on ${focused}, not Resume`);
    await page.keyboard.press('Space');
    assert(!(await sheetOpen(page)), 'Space on Resume left the sheet open (toggled twice?)');
    assert(await ticksMove(page), 'the clock did not run after Resume');
  });

  await step(`${language} ${size} Space on a focused HUD tag pauses only; Escape resumes`, async () => {
    await page.evaluate(() => document.querySelector('[data-hud-action="speed"]').focus());
    await page.keyboard.press('Space');
    assert(await sheetOpen(page), 'Space on the focused speed tag did not pause');
    assert(await speedOf(page) === '2', `Space also clicked the speed tag (speed ${await speedOf(page)})`);
    await page.keyboard.press('Escape');
    assert(!(await sheetOpen(page)), 'Escape did not resume');
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  });

  await step(`${language} ${size} + and − zoom the globe one step`, async () => {
    const z0 = await zoomOf(page);
    await page.keyboard.press('Minus');
    const z1 = await zoomOf(page);
    assert(Math.abs(z1 - Math.max(1, z0 / 1.25)) < 1e-6, `− zoom ${z0} → ${z1}`);
    await page.keyboard.press('Equal'); // '=' is the unshifted '+' key
    const z2 = await zoomOf(page);
    assert(Math.abs(z2 - Math.min(4, z1 * 1.25)) < 1e-6, `+ zoom ${z1} → ${z2}`);
    await page.keyboard.press('NumpadAdd');
    assert(await zoomOf(page) > z2 || z2 >= 4, 'NumpadAdd did not zoom in');
    await page.keyboard.press('NumpadSubtract');
  });

  await step(`${language} ${size} no browser menu on a right click over the globe`, async () => {
    await page.evaluate(() => { window.__awMenu = null; window.addEventListener('contextmenu', (e) => { window.__awMenu = e.defaultPrevented; }, { once: true }); });
    const box = await page.locator('canvas.airway-world').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    assert(await page.evaluate(() => window.__awMenu) === true, 'contextmenu not prevented on the globe');
    assert(!(await sheetOpen(page)), 'right click paused the game');
  });

  await step(`${language} ${size} hover: airport pointer + tag mark, globe away from airports plain, HUD tag rule`, async () => {
    assert(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), 'page is not a hover device');
    // Two airports in range and apart on screen; zoom in a step when the framing packs them too close.
    let from = null;
    for (let tries = 0; tries < 4 && !from; tries++) {
      from = await page.evaluate(() => { try { return window.aw.gesture('route').from; } catch { return null; } });
      if (!from) await page.keyboard.press('Equal');
    }
    assert(from, 'no two actionable airports on screen');
    await page.mouse.move(from.x, from.y);
    const over = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.airway-world');
      return { hover: canvas.dataset.hover ?? null, cursor: getComputedStyle(canvas).cursor,
        tag: document.querySelectorAll('.airport-bubble.is-hover').length };
    });
    assert(over.hover === 'city' && over.cursor === 'pointer', `over an airport: ${JSON.stringify(over)}`);
    assert(over.tag === 1, `${over.tag} airport tags marked`);
    const disc = await page.evaluate(() => window.__awWorld.disc());
    // Just inside the globe's rim, far from the framed airports: open sea or land with no airport within 28 px.
    let plain = null;
    for (const angle of [0.6, 2.2, 3.9, 5.5]) {
      await page.mouse.move(disc.x + Math.cos(angle) * disc.radius * 0.97, disc.y + Math.sin(angle) * disc.radius * 0.97);
      plain = await page.evaluate(() => ({ hover: document.querySelector('canvas.airway-world').dataset.hover ?? null,
        tag: document.querySelectorAll('.airport-bubble.is-hover').length }));
      if (plain.hover === null) break;
    }
    assert(plain.hover === null && plain.tag === 0, `off the airports: ${JSON.stringify(plain)}`);
    // The speed tag is always enabled (Undo is disabled until the first route, and disabled tags get no hover).
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('[data-hud-action="speed"]')).boxShadow);
    await page.hover('[data-hud-action="speed"]');
    const shadow = await page.evaluate(() => getComputedStyle(document.querySelector('[data-hud-action="speed"]')).boxShadow);
    assert(before === 'none' && shadow !== 'none', `speed tag box-shadow ${before} → ${shadow} on hover`);
  });
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const size = `${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height }, { hasTouch: false });
      try {
        await journey(page, language, size);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
      } catch (error) {
        const shot = await saveDiagnostics(page, `keyboard-mouse-${language}`);
        if (!error?.stepped) {
          results.push({ label: `${language} ${size} journey`, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
        }
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
  console.log(`SUMMARY test:e2e:keyboard-mouse seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== CASES.length * 7) process.exitCode = 1;
}

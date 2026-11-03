// [night-11g] R1h, D-88: Settings → Display → "Reduce motion / Ogranicz ruch". The switch starts at the system
// setting, an explicit choice wins both ways and is saved; the root attribute stills the split-flap fold and the menu
// globe turn (DEV probe `__awWorld.framing().menuSpin`). EN 412×915 on a full-motion system, PL 915×412 and
// EN 320×568 on a reduce-motion system; shots docs/shots/n11g/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n11g');
const results = [];
const cases = [
  { language: 'en', width: 412, height: 915, system: 'no-preference' },
  { language: 'pl', width: 915, height: 412, system: 'reduce' },
  { language: 'en', width: 320, height: 568, system: 'reduce' },
];

/** Root attribute, the menu globe turn rate and whether a split-flap fold would animate. */
async function motion(page) {
  return await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'flap-fold-out flap-fold-out--active';
    document.body.append(probe);
    const flap = getComputedStyle(probe).animationName;
    probe.remove();
    return {
      attr: document.documentElement.dataset.airwayMotion ?? null,
      spin: window.__awWorld?.framing?.().menuSpin ?? null,
      flap,
      stored: JSON.parse(localStorage.getItem('airway.settings') || '{}').reduceMotion ?? null,
    };
  });
}
/** The menu sign is measured a frame or two after the screen shows; wait for the expected turn (bounded). */
async function waitSpin(page, turning) {
  await page.waitForFunction((want) => {
    const spin = window.__awWorld?.framing?.().menuSpin;
    return typeof spin === 'number' && (want ? spin > 0 : spin === 0);
  }, turning, { timeout: 5000 }).catch(() => undefined);
}
async function openSettings(page) {
  await clickTestId(page, 'menu-settings');
  await page.locator('[data-testid="settings-reduce-motion"]').waitFor({ timeout: 5000 });
}
async function backToMenu(page) {
  await page.locator('.airway-settings__back').first().click();
  await waitForScreen(page, 'menu');
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const { language, width, height, system } of cases) {
      const label = `${language} ${width}×${height} system=${system}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height }, { reducedMotion: system });
      try {
        await waitForScreen(page, 'menu');
        const reduceBySystem = system === 'reduce';
        await waitSpin(page, !reduceBySystem);
        const before = await motion(page);
        assert(before.attr === (reduceBySystem ? 'reduce' : 'full'), `start attribute ${before.attr}`);
        assert(reduceBySystem ? before.spin === 0 : before.spin > 0, `start menu spin ${before.spin}`);
        assert(before.flap === (reduceBySystem ? 'none' : 'flap-top'), `start flap animation ${before.flap}`);
        assert(before.stored === null, 'no stored choice on a fresh profile');

        await openSettings(page);
        const input = page.locator('[data-testid="settings-reduce-motion"]');
        assert(await input.isChecked() === reduceBySystem, 'switch starts at the system setting');
        const row = await page.evaluate(() => {
          const input = document.querySelector('[data-testid="settings-reduce-motion"]');
          const target = input.closest('.airway-setting__switch').getBoundingClientRect();
          const group = input.closest('.airway-settings__group')?.dataset.testid;
          return { w: target.width, h: target.height, group, scroll: document.documentElement.scrollWidth > innerWidth + 2 };
        });
        assert(row.group === 'settings-group-display', `switch in ${row.group}`);
        assert(row.h >= 48 && row.w >= 48, `touch target ${row.w}×${row.h}`);
        assert(!row.scroll, 'horizontal page scroll');
        await input.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(SHOTS, `settings-${language}-${width}x${height}.png`) });

        await page.locator('[data-testid="settings-reduce-motion"]').click();
        const after = await motion(page);
        assert(after.attr === (reduceBySystem ? 'full' : 'reduce'), `after toggle attribute ${after.attr}`);
        assert(after.stored === !reduceBySystem, `stored choice ${after.stored}`);
        assert(after.flap === (reduceBySystem ? 'flap-top' : 'none'), `after toggle flap animation ${after.flap}`);
        await backToMenu(page);
        await waitSpin(page, reduceBySystem);
        const menu = await motion(page);
        assert(reduceBySystem ? menu.spin > 0 : menu.spin === 0, `menu spin after the choice ${menu.spin}`);
        await openSettings(page);
        assert(await page.locator('[data-testid="settings-reduce-motion"]').isChecked() === !reduceBySystem,
          'switch shows the saved choice');
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `reduce-motion-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
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
  console.log(`SUMMARY test:e2e:reduce-motion seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

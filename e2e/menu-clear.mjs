// [night-16a] D-262: on the Róża menu no demo-network airport (London, Madrid, Dakar...) stands on a menu entry, at any
// turn of the menu spin (DEV probe `__awWorld.framing().menuClashes`, src/game/menu-clear.ts). Real renderer: the store
// shot menu-phone (PL 360×640) had Dakar under "Ustawienia". PL/EN on the store phone, a short phone, a tall phone, a
// foldable and landscape. No PNG is kept (failures leave a diagnostic screenshot in .e2e/).
import { performance } from 'node:perf_hooks';
import { gameUrl, withBrowser, newGamePage, waitForScreen, assert, saveDiagnostics, SEED } from './browser.mjs';

const started = performance.now();
const results = [];
const cases = [
  { language: 'pl', width: 360, height: 640 },
  { language: 'en', width: 360, height: 640 },
  { language: 'pl', width: 320, height: 568 },
  { language: 'pl', width: 412, height: 915 },
  { language: 'en', width: 673, height: 841 },
  { language: 'pl', width: 915, height: 412 },
];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const { language, width, height } of cases) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height }, { reducedMotion: 'reduce' });
      try {
        await waitForScreen(page, 'menu');
        // The framing settles once the entries are laid out on the rose (a frame or two after the screen shows).
        await page.waitForFunction(() => {
          const framing = window.__awWorld?.framing?.();
          // [night-29b] D-284 U4 / [night-46a] D-301: the Linoryt index rows are the entries.
          return framing && framing.first !== null && document.querySelector('.lin-title');
        }, null, { timeout: 8000 });
        await page.waitForTimeout(400);
        const probe = await page.evaluate(() => window.__awWorld.framing());
        assert(probe.menuClashes === 0, `demo airports touch a menu entry (${probe.menuClashes} samples, tilt ${probe.menuTilt}°)`);
        // [night-81a] D-336: the UI-A menu frames its globe to the board's frame (frameTilt, D-334: 0…60°), not D-262's 16…32°.
        assert(probe.menuTilt >= 0 && probe.menuTilt <= 60, `menu tilt ${probe.menuTilt}`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS', note: `tilt=${probe.menuTilt}` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `menu-clear-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
} finally {
  for (const { label, status, why, note } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : note ? ' ' + note : ''}`);
  if (fatal) console.error('FAIL harness: ' + fatal);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:menu-clear seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

// [night-12k] D-114 (R1a): Settings → Help → "Delete my ranking data". The build has a (fake) Firebase config;
// the Auth/Functions hosts are answered by page.route, so no emulator is needed. Per language and size:
// no identity → no row; with an identity the row (≥ 48 px) asks for confirmation, Cancel returns, offline says
// nothing was deleted and keeps the identity, then a confirmed deletion calls `deleteMyData` with the player's
// token, clears the identity and the queue, and the row is gone after reopening settings.
import { performance } from 'node:perf_hooks';

Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-airway',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: '127.0.0.1:5001', VITE_FIREBASE_AUTH_EMULATOR: '127.0.0.1:9099',
});
const { withBrowser, waitForScreen, clickTestId, assert, saveDiagnostics, SEED } = await import('./browser.mjs');
const { presetLanguage } = await import('../scripts/lib/harness.mjs');

const started = performance.now();
const results = [];
const cases = [['pl', 412, 915], ['en', 320, 568]];
const TEXT = {
  pl: { offline: 'Brak połączenia', deleted: 'Twoje dane rankingu zostały usunięte.' },
  en: { offline: 'No connection', deleted: 'Your leaderboard data has been deleted.' },
};
const SESSION = { uid: 'player-1', idToken: 'token-1', refreshToken: 'refresh-1', expiresAt: Date.now() + 86_400_000 };

async function openPage(browser, url, language, viewport, withIdentity) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
    locale: language === 'pl' ? 'pl-PL' : 'en-US' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await presetLanguage(page, language, { clear: true });
  if (withIdentity) {
    await page.addInitScript((session) => {
      if (!sessionStorage.getItem('aw-e2e-seeded')) {
        localStorage.setItem('aw-net-session-v1', JSON.stringify(session));
        sessionStorage.setItem('aw-e2e-seeded', '1');
      }
    }, SESSION);
  }
  const server = { mode: 'offline', calls: [] };
  await page.route(/^http:\/\/127\.0\.0\.1:(5001|9099)\//, async (route) => {
    const request = route.request();
    server.calls.push({ url: request.url(), auth: request.headers().authorization ?? '' });
    if (server.mode === 'offline') return route.abort('internetdisconnected');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { deleted: true, entries: 2, account: true } }) });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#app').waitFor({ timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors, server };
}

async function openSettings(page) {
  await waitForScreen(page, 'menu');
  await clickTestId(page, 'menu-settings');
  await page.locator('[data-testid="settings-group-help"]').waitFor({ timeout: 5000 });
}
const visible = (page, id) => page.locator(`[data-testid="${id}"]`).isVisible();

try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of cases) {
      for (const withIdentity of [false, true]) {
        const label = `${language} ${width}×${height}: ${withIdentity ? 'confirm, offline, delete' : 'no identity, no row'}`;
        const { page, errors, server } = await openPage(browser, url, language, { width, height }, withIdentity);
        try {
          await openSettings(page);
          if (!withIdentity) {
            assert(await page.locator('[data-testid="settings-delete-ranking-row"]').count() === 0, 'row shown without identity');
          } else {
            const start = page.locator('[data-testid="settings-delete-ranking"]');
            await start.scrollIntoViewIfNeeded();
            const box = await start.boundingBox();
            assert(box && box.height >= 48 && box.width >= 48, `touch target ${JSON.stringify(box)}`);
            await start.click();
            assert(await visible(page, 'settings-delete-ranking-confirm'), 'confirmation shown');
            assert(!(await start.isVisible()), 'start button hidden while confirming');
            await clickTestId(page, 'settings-delete-ranking-cancel');
            assert(await start.isVisible() && !(await visible(page, 'settings-delete-ranking-confirm')), 'cancel returns');
            assert(server.calls.length === 0, 'nothing sent before confirming');
            // Offline: nothing deleted, identity kept, the player may retry.
            await start.click();
            await clickTestId(page, 'settings-delete-ranking-confirm');
            const status = page.locator('[data-testid="settings-delete-ranking-status"]');
            await page.waitForFunction((text) => document.querySelector('[data-testid="settings-delete-ranking-status"]')
              ?.textContent?.startsWith(text), TEXT[language].offline, { timeout: 5000 });
            assert(await page.evaluate(() => localStorage.getItem('aw-net-session-v1')) !== null, 'identity kept offline');
            assert(await start.isVisible(), 'retry possible');
            // Online: the server call carries the player's token, then the identity is gone.
            server.mode = 'ok';
            await start.click();
            await clickTestId(page, 'settings-delete-ranking-confirm');
            await page.waitForFunction((text) => document.querySelector('[data-testid="settings-delete-ranking-status"]')
              ?.textContent === text, TEXT[language].deleted, { timeout: 5000 });
            const call = server.calls.at(-1);
            assert(call.url.endsWith('/demo-airway/europe-west1/deleteMyData') && call.auth === 'Bearer token-1', JSON.stringify(call));
            assert(await page.evaluate(() => localStorage.getItem('aw-net-session-v1')) === null, 'identity cleared');
            assert(!(await start.isVisible()) && await status.isVisible(), 'done: no second delete button');
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'horizontal scroll');
            await page.keyboard.press('Escape');
            await openSettings(page);
            assert(await page.locator('[data-testid="settings-delete-ranking-row"]').count() === 0, 'row gone after deletion');
          }
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          results.push({ label, status: 'PASS' });
        } catch (error) {
          const shot = await saveDiagnostics(page, `delete-ranking-${results.length + 1}`);
          results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
        }
        await page.close();
      }
    }
  });
} catch (error) {
  results.push({ label: 'harness', status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] });
} finally {
  for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failedCount = results.length - passed;
  console.log(`SUMMARY test:e2e:delete-ranking seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length * 2) process.exitCode = 1;
}

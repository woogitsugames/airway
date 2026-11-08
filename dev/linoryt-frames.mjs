// [ext-04] Linoryt performance probe (docs/PERFORMANCE.md "Linoryt review"): rAF frame intervals of a running game
// and around the weekly board, on the real renderer under SwiftShader, at CPU throttle 1× and 4× ("budget phone"
// profile, Chrome DevTools Emulation.setCPUThrottlingRate). SwiftShader is software GL, so the numbers are relative
// (this container, this build) and never comparable with devices.
//   node dev/linoryt-frames.mjs [--seconds=8] [--throttle=1,4]
import { withBrowser, newGamePage, waitForScreen, clickTestId } from '../e2e/browser.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const SECONDS = Number(arg('seconds', 8));
const THROTTLES = arg('throttle', '1,4').split(',').map(Number);
const SEED = 0xA1A1;

const stats = (gaps) => {
  const s = [...gaps].sort((a, b) => a - b);
  const q = (p) => s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN;
  return { frames: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +(s.at(-1) ?? NaN).toFixed(1),
    over33: s.filter((g) => g > 33.4).length, fps: s.length ? +(1000 / (s.reduce((a, b) => a + b, 0) / s.length)).toFixed(1) : 0 };
};

const record = (page, ms) => page.evaluate((duration) => new Promise((done) => {
  const gaps = []; let last = performance.now(); const end = last + duration;
  const tick = (now) => { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else done(gaps); };
  requestAnimationFrame(tick);
}), ms);

await withBrowser(async ({ browser, url }) => {
  for (const rate of THROTTLES) {
    const { page } = await newGamePage(browser, url, 'en');
    const cdp = await page.context().newCDPSession(page);
    await waitForScreen(page, 'menu');
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game', 30000);
    await page.waitForTimeout(1500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const game = stats(await record(page, SECONDS * 1000));
    // Weekly board: let the DEV bot reach it (throttle off while the sim fast-forwards), then measure its first seconds.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => window.aw.autoplay(1));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const opened = await page.evaluate(() => document.querySelectorAll('[data-testid^="upgrade-option-"]').length);
    const board = stats(await record(page, 3000));
    console.log(JSON.stringify({ throttle: rate, game, board: { ...board, options: opened } }));
    await page.close();
  }
});

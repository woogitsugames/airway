// [night-10d] The departure board shows what the stores already know: the endless record above 1 000 reads as a
// proper plural (the {count|…} token used to leak), and the daily row carries today's score and the streak.
// PL and EN at 412×915 with seeded local stores; fails closed; shots into docs/shots/n10d/.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, waitForScreen, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const STEPS = 4;
const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10d');
const results = [];

/** Seed the record and three official days ending today (Warsaw calendar, as src/core/daily.ts keys them). */
function seedStores(page, { today }) {
  return page.addInitScript(({ today: withToday }) => {
    const key = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })
      .format(new Date(Date.now() - offset * 86_400_000));
    const days = {};
    let id = 1;
    for (const offset of withToday ? [0, 1, 2] : [1, 2]) {
      const dateKey = key(offset);
      days[dateKey] = { attemptId: id, official: { dateKey, kind: 'official', score: 1250 + offset, weeks: 2, ticket: '--' } };
      id++;
    }
    localStorage.setItem('aw-daily-scores-v1', JSON.stringify({ version: 1, nextAttemptId: id, days }));
    localStorage.setItem('airway.gameover.best.v1', JSON.stringify({ score: 2500, weeks: 4, seed: 7 }));
  }, { today });
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    const cases = [
      ['pl', true, ['rekord 2 500 pasażerów', 'dziś 1 250 · seria 3 dni']],
      ['pl', false, ['seria 2 dni · zagraj dziś']],
      ['en', true, ['record 2,500 passengers', 'today 1,250 · 3-day streak']],
      ['en', false, ['2-day streak · play today']],
    ];
    for (const [language, today, expected] of cases) {
      const label = `${language}: board shows ${expected.join(' / ')}`;
      if (results.some((item) => item.status !== 'PASS')) { results.push({ label, status: 'SKIP' }); continue; }
      const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true,
        reducedMotion: 'reduce', locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await seedStores(page, { today });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => typeof window.aw === 'object', null, { timeout: 12000 });
        await waitForScreen(page, 'menu');
        const text = (await page.locator('.airway-menu').textContent()) ?? ''; // [night-81a] D-336: UI-A prints the record on the yellow sign beside the board
        assert(!text.includes('{'), `template token on the board: ${text}`);
        for (const want of expected) assert(text.includes(want), `missing "${want}" in: ${text}`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        await page.waitForTimeout(1200); // split-flap rows settle
        await page.screenshot({ path: resolve(SHOTS, `menu-daily-${today ? 'played' : 'streak'}-${language}-412x915.png`) });
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `daily-row-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:daily-row seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== STEPS) process.exitCode = 1;
}

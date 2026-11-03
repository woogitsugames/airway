// [night-10l] Best result per puzzle: an earlier clear of puzzle 01 at +0% is shown on the board ("best +0%") and
// on the level ticket ("Your best"); replaying the reference solution beats it ("new best"), the board then shows
// the stored wider margin, and the same result again is not news. EN 412×915, PL 915×412; shots docs/shots/n10l/.
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, assert, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = resolve(ROOT, 'docs/shots/n10l');
const results = [];
const level = JSON.parse(readFileSync(resolve(ROOT, 'src/data/puzzles/01.json'), 'utf8'));
const WORDS = { en: { best: 'best +', ticket: 'Your best', news: 'new best' }, pl: { best: 'rekord +', ticket: 'Twój rekord', news: 'nowy rekord' } };
const cases = [['en', { width: 412, height: 915 }], ['pl', { width: 915, height: 412 }]];

const click = async (page, action) => {
  const target = page.locator(`button[data-action="${action}"]`);
  await target.waitFor({ timeout: 5000 });
  assert(!(await target.isDisabled()), `button ${action} is disabled`);
  await target.click();
};
async function playReference(page) {
  await click(page, 'open:01');
  for (const command of level.referenceCommands) {
    if (command.type === 'connect') {
      const i = level.availableRoutes.findIndex((r) => r.plane === command.plane &&
        ((r.from === command.from && r.to === command.to) || (r.from === command.to && r.to === command.from)));
      await click(page, `connect:${i}`);
    } else await click(page, `upgrade:${command.city}`);
  }
  await click(page, 'finish');
  return (await page.locator('.puzzle-result').textContent()) ?? '';
}
const flapBest = (page) => page.locator('button[data-action="open:01"] .puzzle-flap-best').textContent().catch(() => '');

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, viewport] of cases) {
      const label = `${language} ${viewport.width}×${viewport.height}: best margin shown, beaten, kept`;
      const words = WORDS[language];
      const { page, errors } = await newGamePage(browser, url, language, viewport);
      try {
        await waitForScreen(page, 'menu');
        await page.evaluate(() => {
          localStorage.setItem('airway.puzzles.v1', JSON.stringify({ '01': 1 }));
          localStorage.setItem('airway.puzzles.margin.v1', JSON.stringify({ '01': 0 }));
        });
        await clickTestId(page, 'menu-puzzles');
        await page.locator('.puzzle-departures .puzzle-flap').first().waitFor({ timeout: 8000 });
        const before = await flapBest(page);
        assert(before === `${words.best}0%`, `board before: "${before}"`);
        const aria = await page.locator('button[data-action="open:01"]').getAttribute('aria-label');
        assert(/\+0%/.test(aria ?? ''), `flap label lacks the margin: ${aria}`);
        await click(page, 'open:01');
        const ticket = await page.getByTestId('puzzle-best').textContent();
        assert(ticket?.startsWith(words.ticket) && ticket.includes('+0%'), `ticket line "${ticket}"`);
        await page.screenshot({ path: resolve(SHOTS, `level-${language}-${viewport.width}x${viewport.height}.png`) });
        await click(page, 'back');
        const first = await playReference(page);
        assert(first.includes(words.news), `beating +0% is not a new best: "${first}"`);
        const margin = Number(/\+(\d+)%/.exec(first)?.[1]);
        assert(margin > 0, `result has no margin: "${first}"`);
        await click(page, 'back');
        const after = await flapBest(page);
        assert(after === `${words.best}${margin}%`, `board after: "${after}", expected +${margin}%`);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('airway.puzzles.margin.v1') || '{}'));
        assert(stored['01'] === margin, `stored ${JSON.stringify(stored)}`);
        await page.screenshot({ path: resolve(SHOTS, `board-${language}-${viewport.width}x${viewport.height}.png`) });
        const again = await playReference(page);
        assert(!again.includes(words.news), `the same margin again is reported as news: "${again}"`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `puzzle-best-${results.length + 1}`);
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
  console.log(`SUMMARY test:e2e:puzzle-best seed=0x${SEED.toString(16).toUpperCase()} steps=${results.length} ` +
    `passed=${passed} failed=${failedCount} durationMs=${Math.round(performance.now() - started)}`);
  if (failedCount || results.length !== cases.length) process.exitCode = 1;
}

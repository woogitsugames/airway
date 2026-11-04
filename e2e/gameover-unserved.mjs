// [night-11b] Found in the N10x long play and the 673×841 matrix shot: when the airport that jammed was on no route,
// the game-over departures board was an empty dark panel reading "No scheduled departures". Its departures are the
// airport's route neighbours, so an empty board always means no route served it; the board now says so and what
// would have helped. A run with no routes at all is left to jam (seed 0xA1A1): the board must show the unserved
// line with the jammed airport's code and the hint, wrapped inside the board (no clipped text), at three sizes; and
// a bot-played run that jams at a served hub keeps its cancelled departures and no unserved line.
// [night-11k] R5f: the unserved board has no "FLIGHT / GATE / STATUS" column headings (they stay above real rows),
// and while the report is open no edge chip and no dock tag shows over it; the "Map" view brings both back.
// Shots docs/shots/n11k/.
// [night-12y] R8b, D-187: the bot's seed-0xA1A1 run ends at an unserved airport with an empty reserve; its hint then
// names the moves that need no spare aircraft ("drag a route end…"), wrapped inside the board at 360×640.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, assert, clickTestId, saveDiagnostics, ROOT, SEED } from './browser.mjs';

const SHOTS = resolve(ROOT, 'docs/shots/n11k');

const started = performance.now();
const results = [];
const CASES = [['pl', 360, 640], ['en', 412, 915], ['pl', 915, 412]];
const WORDS = { en: 'No route served', pl: 'Żadna trasa nie obsługiwała' };

async function board(page) {
  return page.evaluate(() => {
    const go = document.querySelector('[data-testid="game-over"]');
    const none = document.querySelector('[data-testid="gameover-unserved"]');
    const title = document.querySelector('.airway-go-board-title')?.textContent ?? '';
    const rows = document.querySelectorAll('.airway-go-flight').length;
    const clipped = none ? [...none.querySelectorAll('p')].some((p) => p.scrollWidth > p.clientWidth + 1) : false;
    const box = document.querySelector('.airway-go-board')?.getBoundingClientRect();
    const r = none?.getBoundingClientRect();
    const inside = !!(box && r && r.left >= box.left - 1 && r.right <= box.right + 1 && r.bottom <= box.bottom + 1);
    const record = !!document.querySelector('.airway-go-record');
    const head = !!document.querySelector('.airway-go-board-head');
    const shown = (el) => !el.hidden && getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).display !== 'none';
    const edges = [...document.querySelectorAll('.airport-edge')].filter(shown).length;
    const dock = [...document.querySelectorAll('.airway-dock')].filter(shown).length;
    return { open: !!go, title, rows, text: none?.textContent ?? null, clipped, inside, record, head, edges, dock };
  });
}

async function unserved(page, language) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  for (let i = 0; i < 200; i++) {
    const screen = await page.evaluate(() => window.aw.state().screen);
    if (screen === 'gameover') break;
    if (screen === 'upgrade') { await clickTestId(page, 'upgrade-option-0'); await waitForScreen(page, 'game'); continue; }
    await page.evaluate(() => window.aw.advanceTicks(600));
  }
  await waitForScreen(page, 'gameover');
  await page.waitForTimeout(400);
  const b = await board(page);
  const hub = /·\s*(\S+)/.exec(b.title)?.[1] ?? '';
  assert(b.rows === 0, `a run without routes shows ${b.rows} departures`);
  assert(b.text?.startsWith(WORDS[language]) && hub && b.text.includes(hub), `unserved line "${b.text}" (board "${b.title}")`);
  assert(!b.clipped && b.inside, `unserved text clipped=${b.clipped} inside=${b.inside}`);
  assert(!b.record, '0 passengers delivered is announced as a new local record');
  assert(!b.head, 'column headings above a board with no rows');
  assert(b.edges === 0 && b.dock === 0, `over the report: ${b.edges} edge chips, ${b.dock} dock`);
  await page.screenshot({ path: resolve(SHOTS, `gameover-unserved-${language}-${page.viewportSize().width}x${page.viewportSize().height}.png`) });
  // The map view is for looking at the network: the dock and the edge chips are back there.
  await clickTestId(page, 'gameover-map');
  const map = await board(page);
  assert(map.dock === 1, `map view without the dock (${map.dock})`);
  await clickTestId(page, 'gameover-map-back');
  const again = await board(page);
  assert(again.edges === 0 && again.dock === 0, `back on the report: ${again.edges} edge chips, ${again.dock} dock`);
  return hub;
}

/** [night-11k] Rules v5 (N12f) end the bot's seed-0xA1A1 run at an unserved airport (RIO); on 0xA1A3 it jams at a
 * served hub (SEL, week 2, 2 departures). */
const SERVED_SEED = 0xA1A3;

async function served(page) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SERVED_SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  // The DEV bot builds a network; the run ends at a jam of a served airport (a pick between weeks keeps it going).
  for (let week = 1; week <= 30; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    if (s.screen === 'gameover') break;
    if (s.screen === 'upgrade') {
      const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
      const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
      await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
      await waitForScreen(page, 'game');
    }
  }
  await waitForScreen(page, 'gameover');
  await page.waitForTimeout(400);
  const b = await board(page);
  assert(b.rows > 0 && b.text === null, `served jam: rows=${b.rows} unserved="${b.text}" (${b.title})`);
  assert(b.head, 'column headings missing above real departures');
  assert(b.edges === 0 && b.dock === 0, `over the report: ${b.edges} edge chips, ${b.dock} dock`);
  await page.screenshot({ path: resolve(SHOTS, 'gameover-served-en-412x915.png') });
  return b.rows;
}

const NO_SPARE = { en: 'No spare aircraft', pl: 'Brak wolnych samolotów' };

async function noSpare(page, language) {
  await waitForScreen(page, 'menu');
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await clickTestId(page, 'menu-endless');
  await waitForScreen(page, 'game');
  for (let week = 1; week <= 30; week++) {
    const s = await page.evaluate((w) => window.aw.autoplay(w), week);
    if (s.screen === 'gameover') break;
    if (s.screen === 'upgrade') {
      const offers = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="upgrade-option-"]')].map((n) => n.dataset.upgrade));
      const plane = offers.findIndex((o) => o === 'turboprop' || o === 'widebody');
      await clickTestId(page, `upgrade-option-${Math.max(0, plane)}`);
      await waitForScreen(page, 'game');
    }
  }
  await waitForScreen(page, 'gameover');
  await page.waitForTimeout(400);
  const b = await board(page);
  const hint = await page.evaluate(() => document.querySelector('[data-testid="gameover-unserved"] .airway-go-none-hint')?.textContent ?? '');
  assert(b.rows === 0 && b.text !== null, `the bot run should end unserved: rows=${b.rows} (${b.title})`);
  assert(hint.startsWith(NO_SPARE[language]), `no-spare hint "${hint}"`);
  assert(!b.clipped && b.inside, `no-spare text clipped=${b.clipped} inside=${b.inside}`);
  await page.screenshot({ path: resolve(SHOTS, `gameover-nospare-${language}-${page.viewportSize().width}x${page.viewportSize().height}.png`) });
  return hint;
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(SHOTS, { recursive: true });
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}: an unserved jam says no route served the airport`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        const hub = await unserved(page, language);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label: `${label} (${hub})`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-unserved-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
    {
      const label = 'pl 360×640 bot run: an unserved jam with an empty reserve names moves that need no spare aircraft';
      const { page, errors } = await newGamePage(browser, url, 'pl', { width: 360, height: 640 });
      try {
        await noSpare(page, 'pl');
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        results.push({ label, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `gameover-nospare-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
    const label = 'en 412×915 seed 0xA1A3: a jam at a served hub keeps its cancelled departures';
    const { page, errors } = await newGamePage(browser, url, 'en');
    try {
      const rows = await served(page);
      if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
      results.push({ label: `${label} (${rows} rows)`, status: 'PASS' });
    } catch (error) {
      const shot = await saveDiagnostics(page, `gameover-unserved-${results.length + 1}`);
      results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
    }
    await page.close();
  });
} catch (error) { fatal = error; }

for (const r of results) console.log(`${r.status} ${r.label}${r.why ? ` — ${r.why}` : ''}`);
if (fatal) console.log(`FAIL harness — ${fatal.message}`);
const failed = results.filter((r) => r.status === 'FAIL').length + (fatal ? 1 : 0);
const steps = CASES.length + 2;
console.log(`SUMMARY test:e2e:gameover-unserved seed=0x${SEED.toString(16).toUpperCase()} steps=${steps} passed=${results.filter((r) => r.status === 'PASS').length} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
process.exitCode = failed || results.length !== steps ? 1 : 0;

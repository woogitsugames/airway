// [night-12ba] R2k, D-247: the weekly contract waybill on the weekly board and the contract crate, in real Chromium,
// without a run: the board is mounted alone through its public API on ?perf=scene over the real HUD (like
// test:e2e:notch), so the globe frame rate (G7) does not matter. Checks per size and language: the waybill shows both
// region names, the target and the reward in the player's language; last week's result has a filled (met) or hollow
// (missed) square; a board with a met contract shows four crates, the "four crates" sign line and one crate marked
// "CONTRACT" (also in its aria-label); every crate stays a 48 px target; the 3-crate board with a waybill and the
// 4-crate board fit without scrolling and every crate ends above the bottom edge (412×915, 393×852, [night-12bf] 384×854,
// 360×800, 673×841, 360×640, 915×412,
// 812×375; 320×568 is measured and reported, it scrolls by about the slip's height). Shots .e2e/weekly-contract/ (inspected, not committed).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, saveDiagnostics, ARTIFACTS, SEED } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';

const started = performance.now();
const SHOTS = resolve(ARTIFACTS, 'weekly-contract');
// [night-12bf] + 673×841 (ui:matrix foldable, ran 55 px), 360×800 (PL 58 px) and 384×854 (PL 5 px): found by ui:matrix:stub.
const SIZES = [[412, 915], [393, 852], [384, 854], [360, 800], [673, 841], [360, 640], [320, 568], [915, 412], [812, 375]];
const WORDS = {
  en: { route: 'Northern Europe – Middle East', task: /^24 passengers between them this week\. Reward: a fourth crate next week\.$/,
    met: 'Last week: 31/30, met.', missed: 'Last week: 12/30, not met.', four: 'Hangar: four crates arrived. You open one.', crate: 'CONTRACT' },
  pl: { route: 'Europa Północna – Bliski Wschód', task: /^24 pasażerów między nimi w tym tygodniu\. Nagroda: czwarta skrzynia za tydzień\.$/,
    met: 'Zeszły tydzień: 31/30, wykonany.', missed: 'Zeszły tydzień: 12/30, niewykonany.', four: 'Hangar: przyszły cztery skrzynie. Otwierasz jedną.', crate: 'KONTRAKT' },
};
const BOARDS = ['met', 'missed'];
const results = [];

async function mount(page, language, board) {
  await page.evaluate(async ({ language, board }) => {
    const { setLanguage } = await import('/src/i18n/index.ts');
    setLanguage(language);
    const host = document.getElementById('app');
    const hudHost = document.createElement('div');
    hudHost.style.cssText = 'position:fixed;inset:0;pointer-events:none';
    document.body.prepend(hudHost);
    const { mountHud } = await import('/src/ui/hud/index.ts');
    mountHud(hudHost, {}).render({ week: 3, day: 3, timeMinutes: 642, passengers: 412, paused: true, speed: 1, canUndo: true,
      selectedPlane: 'turboprop', stock: { turboprop: 2, widebody: 1, hub: 0 } });
    const { WeeklyUpgradeView } = await import('/src/ui/upgrade/index.ts');
    const view = new WeeklyUpgradeView(host, { onCommand: () => {}, onCancelPick: () => {}, onPreviewModel: () => {} });
    const met = board === 'met';
    const ids = met ? ['turboprop', 'hub-expansion', 'widebody', 'departure-slots'] : ['turboprop', 'widebody', 'hub-expansion'];
    view.render({ week: 3, paused: true, pendingHub: false, offers: ids.map((id) => ({ id, week: 3 })),
      ...(met ? { extraCrate: 'departure-slots' } : {}) },
    [{ hubId: 'LON', waiting: 11, capacity: 36, label: 'LON' }],
    [{ cityId: 'LON', label: 'LON', held: 2, waitMinutes: 40 }, { cityId: 'DXB', label: 'DXB', held: 0, waitMinutes: 0 }],
    { next: { regions: ['EUN', 'ME'], target: 24 }, last: met ? { delivered: 31, target: 30, met: true } : { delivered: 12, target: 30, met: false },
      extraCrate: met ? 'departure-slots' : null });
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { language, board });
  await page.waitForTimeout(250);
}

function measure(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.airway-upgrade-open');
    const sheet = document.querySelector('[data-testid="upgrade-contract"]');
    const text = (selector) => sheet?.querySelector(selector)?.textContent ?? null;
    const last = sheet?.querySelector('.airway-upgrade-waybill-last');
    const mark = last ? getComputedStyle(last, '::before') : null;
    const tags = [...document.querySelectorAll('.airway-upgrade-tag')].map((tag) => {
      const r = tag.getBoundingClientRect();
      return { extra: tag.dataset.extra ?? null, aria: tag.getAttribute('aria-label'), code: tag.querySelector('.airway-upgrade-code').textContent,
        height: r.height, width: r.width, bottom: r.bottom };
    });
    const s = sheet?.getBoundingClientRect();
    return {
      overflow: overlay.scrollHeight - overlay.clientHeight, innerHeight, innerWidth,
      sub: document.querySelector('.airway-upgrade-sub').textContent,
      route: text('.airway-upgrade-waybill-route'), task: text('.airway-upgrade-waybill-task'), last: last?.textContent ?? null,
      markFilled: mark ? mark.backgroundColor !== 'rgba(0, 0, 0, 0)' : null, markBorder: mark ? mark.borderTopWidth : null,
      sheet: s ? { left: s.left, right: s.right, height: s.height } : null, tags,
    };
  });
}

let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const language of ['pl', 'en']) for (const [width, height] of SIZES) for (const board of BOARDS) {
      const name = `${language} ${width}×${height} ${board}`;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await mount(page, language, board);
        const m = await measure(page);
        await page.screenshot({ path: resolve(SHOTS, `board-${board}-${language}-${width}x${height}.png`), animations: 'disabled' });
        const w = WORDS[language];
        const problems = [];
        if (m.route !== w.route) problems.push(`route "${m.route}"`);
        if (!w.task.test(m.task ?? '')) problems.push(`task "${m.task}"`);
        if (m.last !== w[board]) problems.push(`last "${m.last}"`);
        if (m.markFilled !== (board === 'met')) problems.push(`result square ${m.markFilled ? 'filled' : 'hollow'} on a ${board} contract`);
        if (m.markBorder !== '2px') problems.push(`result square border ${m.markBorder}`);
        if (!m.sheet || m.sheet.left < 0 || m.sheet.right > m.innerWidth + 0.5) problems.push('waybill outside the screen');
        const extra = m.tags.filter((tag) => tag.extra === 'contract');
        if (board === 'met') {
          if (m.tags.length !== 4) problems.push(`${m.tags.length} crates`);
          if (m.sub !== w.four) problems.push(`sign "${m.sub}"`);
          if (extra.length !== 1 || !extra[0].code.includes(w.crate) || !extra[0].aria.endsWith(w.crate)) problems.push('contract crate not marked');
        } else {
          if (m.tags.length !== 3) problems.push(`${m.tags.length} crates`);
          if (extra.length !== 0) problems.push('a crate marked without a met contract');
        }
        for (const tag of m.tags) if (tag.height < 48 || tag.width < 48) problems.push(`crate ${Math.round(tag.width)}×${Math.round(tag.height)} under 48 px`);
        // Every size fits without scrolling except 320×568, which already needed every pixel for three crates (N8e):
        // there the board scrolls by about the slip's height (the overlay scrolls; every crate stays reachable).
        const mustFit = width !== 320;
        if (mustFit && m.overflow > 1) problems.push(`board scrolls ${m.overflow} px`);
        if (mustFit) for (const tag of m.tags) if (tag.bottom > m.innerHeight + 0.5) problems.push(`crate ends at ${Math.round(tag.bottom)}`);
        if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);
        if (problems.length) throw new Error(problems.join('; '));
        results.push({ name, status: 'PASS', why: `${m.tags.length} crates, waybill ${Math.round(m.sheet.height)} px, scroll ${Math.max(0, m.overflow)} px` });
      } catch (error) {
        const shot = await saveDiagnostics(page, `weekly-contract-${results.length + 1}`).catch(() => null);
        results.push({ name, status: 'FAIL', why: message(error) + (shot ? ` (screenshot ${shot})` : '') });
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  fatal = message(error);
} finally {
  for (const { name, status, why } of results) {
    const line = `${status} ${name}${why ? ': ' + why : ''}`;
    if (status === 'FAIL') console.error(line); else console.log(line);
  }
  if (fatal) console.error('FAIL harness: ' + fatal);
  const total = 2 * SIZES.length * BOARDS.length;
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.length - passed + (fatal ? 1 : 0);
  console.log(`SUMMARY test:e2e:weekly-contract seed=0x${SEED.toString(16).toUpperCase()} checks=${total} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
  if (failed || passed !== total) process.exitCode = 1;
}

function message(error) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}

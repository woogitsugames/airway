// [night-76a] D-331 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T4): the UI-A preview's weekly sheet
// (`?skin=board`, src/ui/skin/board-week.{ts,css}) on the real session (the stub world with --render=stub, D-254). The DEV
// bot plays the seeded run to the week-1 board (`aw.autoplay(1)`), then on phone, landscape, foldable and tablet sizes,
// PL and EN, at 100 % and 150 % text and with a notch profile:
//   - the sheet replaces the HUD (top band and console hidden, the airport signs hidden): the "TYDZ 1" board with the
//     closed week's four figures on tiles and one spoken label that names them;
//   - one strip per offer, each a button ≥ 48 px tall inside the sheet, with the sim's data-upgrade; exactly one chosen
//     (aria-pressed, cream outline, the clip) and it is the first strip that can act; tapping another moves the choice
//     and renames the main action;
//   - the main action (data-testid upgrade-take) is ≥ 48 px, fully inside the safe rectangle without scrolling, black on
//     yellow; it is the only yellow element of the sheet (spec §2: yellow = "where to / what next");
//   - no text cut or spilling out of its box, nothing wider than the page, no browser error.
// On 412×915 and 915×412 the flow is played: a hub or slots strip (when offered) taken → the airport pick (yellow
// direction sign, Back ≥ 48 px, the globe free) → Back → the strips with that choice kept → an aircraft taken → the game.
// `--shots` writes PL/EN phone, landscape, 320×568, 150 %, tablet portrait/landscape and the airport pick to
// docs/shots/t4/ (real renderer); otherwise PNGs go to .e2e/board-week/. Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender, RENDER } from './browser.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
const OUT = SHOTS ? resolve(ROOT, 'docs/shots/t4') : resolve(ARTIFACTS, 'board-week');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = SHOTS
  ? [[412, 915, 100], [915, 412, 100], [320, 568, 100], [412, 915, 150], [768, 1024, 100], [1376, 1032, 100]]
  : [[320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [673, 841, 100], [768, 1024, 100],
    [1032, 1376, 100], [1376, 1032, 100], [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150],
    [915, 412, 150]];
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const failures = [];
const failedScreens = new Set();
let checked = 0;
let shots = 0;

function boardUrl(url) {
  const target = new URL(gameUrl(url));
  target.searchParams.set('skin', 'board');
  return target.href;
}

/** The crate sheet's audit (problems as strings). */
async function auditSheet(page) {
  return await page.evaluate(() => {
    const problems = [];
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = probe.getBoundingClientRect();
    probe.remove();
    const box = (el) => el.getBoundingClientRect();
    const shown = (el) => { const r = box(el); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const root = document.documentElement;
    if (root.scrollWidth > innerWidth + 1) problems.push(`horizontal overflow ${root.scrollWidth} > ${innerWidth}`);
    const sheet = document.querySelector('.bw-sheet[data-mode="crates"]');
    if (!sheet) return [...problems, 'crate sheet missing'];
    if (sheet.scrollWidth > sheet.clientWidth + 1) problems.push(`sheet scrolls sideways ${sheet.scrollWidth} > ${sheet.clientWidth}`);
    if (document.querySelector('.airway-upgrade-tag')) problems.push('the shipped crate labels are drawn too');
    const hud = document.querySelector('.airway-hud');
    if (hud && getComputedStyle(hud).visibility !== 'hidden') problems.push('HUD still shown under the sheet');
    // The board.
    const board = sheet.querySelector('.bw-board');
    const title = [...(board?.querySelectorAll('.bw-tiles--title .bw-tile') ?? [])].map((t) => t.textContent || ' ').join('');
    if (!/^(TYDZ|WEEK) 1$/.test(title)) problems.push(`board title "${title}"`);
    const figs = [...(board?.querySelectorAll('.bw-fig') ?? [])].map((f) => [...f.querySelectorAll('.bw-tile')].map((t) => t.textContent).join(''));
    if (figs.length !== 4 || figs.some((f) => !/^\d+$/.test(f))) problems.push(`board figures ${JSON.stringify(figs)}`);
    const label = board?.getAttribute('aria-label') ?? '';
    if (board?.getAttribute('role') !== 'img' || figs.some((f) => !label.includes(String(Number(f))))) problems.push(`board label "${label}" vs ${figs}`);
    for (const tile of board?.querySelectorAll('.bw-tile') ?? []) {
      if (!tile.closest('[aria-hidden="true"]')) { problems.push('a board tile is not aria-hidden'); break; }
    }
    if (board && (box(board).right > innerWidth + .5 || [...board.querySelectorAll('.bw-fig, .bw-tiles')].some((f) => box(f).right > box(board).right + .5))) {
      problems.push('a board row runs out of the board');
    }
    // Strips.
    const strips = [...sheet.querySelectorAll('.bw-strip')];
    if (strips.length < 2 || strips.length > 4) problems.push(`${strips.length} strips`);
    const chosen = strips.filter((s) => s.getAttribute('aria-pressed') === 'true');
    if (chosen.length !== 1 || !chosen[0].classList.contains('is-chosen')) problems.push(`${chosen.length} chosen strips`);
    const firstFree = strips.find((s) => !s.disabled);
    if (chosen[0] && chosen[0] !== firstFree) problems.push('the default choice is not the first strip that can act');
    for (const strip of strips) {
      const r = box(strip);
      if (r.height < 48 || r.width < 48) problems.push(`strip ${strip.dataset.upgrade} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < safe.left - 1 || r.right > safe.right + 1) problems.push(`strip ${strip.dataset.upgrade} outside the safe sides`);
      if (!/^upgrade-option-\d$/.test(strip.dataset.testid || '') || !strip.dataset.upgrade) problems.push('strip without its test id or kind');
    }
    if (chosen[0]) {
      const style = getComputedStyle(chosen[0]);
      if (style.outlineColor !== 'rgb(239, 231, 211)' || style.outlineStyle !== 'solid') problems.push(`chosen outline ${style.outlineStyle} ${style.outlineColor}`);
      const clip = chosen[0].querySelector('.bw-clip');
      if (!clip || !shown(clip)) problems.push('chosen strip without its clip');
    }
    // The main action.
    const take = sheet.querySelector('[data-testid="upgrade-take"]');
    if (!take) problems.push('main action missing');
    else {
      // Pinned to the bottom, except with large text on a short page (it scrolls with the strips there).
      const pinned = getComputedStyle(take).position === 'sticky';
      const short = ['130', '150'].includes(root.dataset.airwayTextScale ?? '');
      if (pinned === short) problems.push(`main action ${pinned ? 'pinned' : 'not pinned'} (text ${root.dataset.airwayTextScale ?? '100'})`);
      if (!pinned) take.scrollIntoView({ block: 'nearest' });
      const r = box(take);
      if (r.height < 48) problems.push(`main action ${Math.round(r.height)} px tall`);
      if (r.top < safe.top - 1 || r.bottom > safe.bottom + 1 || r.left < safe.left - 1 || r.right > safe.right + 1) {
        problems.push(`main action outside the safe rectangle ${JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))}`);
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !take.contains(hit)) problems.push('main action covered');
      if (take.dataset.upgrade !== chosen[0]?.dataset.upgrade) problems.push('main action names another strip');
    }
    // Yellow (#F3C317): the main action only.
    const Y = 'rgb(243, 195, 23)';
    const yellow = [...sheet.querySelectorAll('*')].filter((el) => {
      if (!shown(el)) return false;
      const s = getComputedStyle(el);
      return s.backgroundColor === Y || (s.outlineStyle !== 'none' && s.outlineColor === Y)
        || (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0 && s.borderTopColor === Y);
    });
    if (yellow.length !== 1 || yellow[0] !== take) problems.push(`yellow elements: ${yellow.map((el) => el.className).join(', ')}`);
    // Text: nothing cut or spilling (each text leaf inside its box and inside the sheet).
    const sheetBox = box(sheet);
    for (const el of sheet.querySelectorAll('span, b, h2, p')) {
      const srOnly = el.closest('.bw-slip-task');
      if (srOnly && srOnly.getBoundingClientRect().width <= 1) continue; // the screen-reader slip (short pages)
      if (!shown(el) || el.closest('[aria-hidden="true"]:not(.bw-clip)') || el.children.length) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') problems.push(`text cut: "${el.textContent.slice(0, 30)}"`);
      const r = box(el);
      if (r.right > sheetBox.right + 1 || r.left < sheetBox.left - 1) problems.push(`text outside the sheet: "${el.textContent.slice(0, 30)}"`);
      const owner = el.closest('.bw-strip, .bw-take, .bw-board, .bw-slip, .bw-allot');
      if (owner && !el.classList.contains('bw-clip')) {
        const o = box(owner);
        if (r.right > o.right + 1 || r.left < o.left - 1 || r.bottom > o.bottom + 1) problems.push(`text spills: "${el.textContent.slice(0, 30)}"`);
      }
    }
    return problems;
  });
}

/** Choose strip `kind` and return the main action's text. */
async function choose(page, kind) {
  return await page.evaluate((kind) => {
    document.querySelector(`.bw-strip[data-upgrade="${kind}"]`)?.click();
    const take = document.querySelector('[data-testid="upgrade-take"]');
    return { upgrade: take?.dataset.upgrade, text: take?.textContent ?? '',
      chosen: [...document.querySelectorAll('.bw-strip[aria-pressed="true"]')].map((s) => s.dataset.upgrade) };
  }, kind);
}

/** The airport pick's audit. */
async function auditPick(page) {
  return await page.evaluate(() => {
    const problems = [];
    const sheet = document.querySelector('.bw-sheet[data-mode^="pick"]');
    if (!sheet) return ['airport pick sheet missing'];
    const host = document.querySelector('.airway-upgrade-host');
    if (!host?.classList.contains('is-picking-hub')) problems.push('host without is-picking-hub');
    if (getComputedStyle(host).pointerEvents !== 'none') problems.push('the globe is not free for the tap');
    const back = sheet.querySelector('[data-testid="upgrade-pick-back"]');
    const r = back?.getBoundingClientRect();
    if (!r || r.width < 48 || r.height < 48) problems.push(`Back ${r ? `${Math.round(r.width)}×${Math.round(r.height)}` : 'missing'}`);
    if (back && getComputedStyle(back).pointerEvents === 'none') problems.push('Back takes no tap');
    const sign = sheet.querySelector('.bw-direction');
    if (!sign || getComputedStyle(sign).backgroundColor !== 'rgb(243, 195, 23)') problems.push('no yellow direction sign');
    if (document.querySelector('.bw-strip')) problems.push('strips shown during the pick');
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('horizontal overflow');
    return problems;
  });
}

try {
  mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const [width, height, scale, profile] of cases) {
      for (const language of ['pl', 'en']) {
        const tag = `${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}${profile ? '-' + profile : ''}`;
        let page;
        const problems = [];
        try {
          const opened = await newGamePage(browser, boardUrl(url), language, { width, height }, { textScale: scale !== 100 ? scale : undefined });
          page = opened.page;
          await assertRender(page);
          if (profile === 'notch') {
            const sides = width > height ? { top: 0, bottom: 21, left: notch.side, right: notch.side } : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
            await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;` +
              `--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
          }
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
          await clickTestId(page, 'menu-endless');
          await waitForScreen(page, 'game');
          await page.evaluate(() => window.aw.autoplay(1));
          await waitForScreen(page, 'upgrade', 20000);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);
          problems.push(...await auditSheet(page));
          await page.screenshot({ path: resolve(OUT, `week-${tag}.png`), animations: 'disabled' });
          shots++;
          // Another strip: the choice and the main action follow.
          const kinds = await page.evaluate(() => [...document.querySelectorAll('.bw-strip:not(:disabled)')].map((s) => s.dataset.upgrade));
          const other = kinds[1];
          if (other) {
            const picked = await choose(page, other);
            if (picked.upgrade !== other || picked.chosen.join() !== other) problems.push(`after tapping ${other}: ${JSON.stringify(picked)}`);
            if (SHOTS && width === 412 && scale === 100) { await page.screenshot({ path: resolve(OUT, `week-${tag}-other.png`), animations: 'disabled' }); shots++; }
            await choose(page, kinds[0]);
          }
          // The flow on the phone and the landscape phone.
          if (scale === 100 && !profile && ((width === 412 && height === 915) || (width === 915 && height === 412))) {
            const targeted = kinds.find((k) => k === 'hub-expansion' || k === 'departure-slots');
            if (targeted) {
              await choose(page, targeted);
              await clickTestId(page, 'upgrade-take');
              await page.waitForSelector('.bw-sheet[data-mode^="pick"]', { timeout: 8000 });
              problems.push(...(await auditPick(page)).map((p) => `pick: ${p}`));
              if (SHOTS) { await page.screenshot({ path: resolve(OUT, `pick-${tag}.png`), animations: 'disabled' }); shots++; }
              await clickTestId(page, 'upgrade-pick-back');
              await page.waitForSelector('.bw-sheet[data-mode="crates"]', { timeout: 8000 });
              const kept = await page.evaluate(() => document.querySelector('.bw-strip[aria-pressed="true"]')?.dataset.upgrade);
              if (kept !== targeted) problems.push(`after Back the choice is ${kept}, not ${targeted}`);
            } else {
              console.log(`NOTE ${tag}: no hub or slots strip on this board (${kinds.join(', ')}); pick flow not played`);
            }
            const aircraft = kinds.find((k) => k === 'turboprop' || k === 'widebody');
            await choose(page, aircraft);
            const before = await page.evaluate(() => window.aw.state().upgrades?.length ?? 0);
            await clickTestId(page, 'upgrade-take');
            await waitForScreen(page, 'game', 8000);
            const after = await page.evaluate(() => window.aw.state().upgrades ?? []);
            if (after.length !== before + 1 || after.at(-1)?.upgrade !== aircraft) problems.push(`take ${aircraft}: upgrades ${JSON.stringify(after)}`);
            const hud = await page.evaluate(() => getComputedStyle(document.querySelector('.airway-hud')).visibility);
            if (hud === 'hidden') problems.push('HUD still hidden after the board');
          }
          if (opened.errors.length) problems.push(`browser errors: ${opened.errors.splice(0).join('; ')}`);
          checked++;
        } catch (error) {
          problems.push(String(error?.message ?? error).split('\n')[0]);
        } finally {
          await page?.close();
        }
        for (const problem of problems) failures.push(`${tag}: ${problem}`);
        if (problems.length) failedScreens.add(tag);
        console.log(`${problems.length ? 'FAIL' : 'PASS'} week ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
      }
    }
  });
} catch (error) {
  failures.push(`harness: ${String(error?.message ?? error).split('\n')[0]}`);
}
const expected = cases.length * 2;
console.log(`SUMMARY test:e2e:board-week render=${RENDER} seed=0x${SEED.toString(16).toUpperCase()} screens=${checked}/${expected} ` +
  `shots=${shots} passed=${expected - failedScreens.size} failed=${failedScreens.size} problems=${failures.length} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failures.length || checked !== expected) process.exitCode = 1;

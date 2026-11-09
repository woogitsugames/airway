// [night-69a] D-324 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T1): the UI-A skin on the
// real session (on the stub world with --render=stub, D-254). Plays a short seeded run with the DEV bot so the HUD shows
// a real afternoon (routes, aircraft used up), then audits the in-game HUD at phone, landscape, foldable and tablet sizes,
// PL and EN, at 100 % and at the 150 % text step, plus two notch profiles (the `--aw-safe-*` tokens, as e2e/notch.mjs):
//   - the preview is on: <html data-skin="board">, Archivo loaded, the split-flap board instead of the Linoryt margin;
//   - the board: clock, week, day and passengers on flap tiles that match its one spoken label (role="img"), the flaps
//     aria-hidden; every cell inside the board (no row overflow), 24 hour cells with the 10 night hours (20–06) drawn
//     lower than the day hours, the "now" mark inside the bar; the pause key beside the board, not over it;
//   - the console: pause + six keys ([night-86b] D-344: + Network), each ≥ 48 × 48 CSS px inside the safe rectangle and apart from each other and the
//     top band; the shape says the kind (Undo a round key, the aircraft enamel plates with a dashed / solid route line,
//     Hub an octagon, Speed a rotary selector); each caption inside its key and unclipped; no yellow anywhere in the HUD
//     (yellow is "where to / what next" only, spec §2); choosing an aircraft turns its plate cream with the lamp lit;
//   - no horizontal overflow, no page error.
//   - [night-73a] D-328 (step T2) the airport signs: every shown sign one row (nothing wraps or spills), in Archivo,
//     beside its own pin (never on a pin, within 60 px of its own), no two signs overlap; the level of detail follows the
//     text size (level 2 from 130 %); atlas labels never meet a sign or a pin; at most two yellow direction signs; on
//     412×915 and 915×412 the run is played on to a live jam: the jam's sign (or its direction sign) is white on red with
//     a "m:ss" countdown, and the jammed airport's own sign is checked after the camera turns to it.
// `--shots` writes PL/EN 412×915, 915×412 and 320×568 (plus a 150 % and a chosen-plate frame) to docs/shots/t1/;
// `--shots=t2` writes the T2 set to docs/shots/t2/ (the same frames, the jam turned to, a network of ten airports on
// screen and the same at the closest zoom); otherwise PNGs go to .e2e/board/. Inspect every PNG.
//   - [night-75a] D-330 (step T3) the hub strip bay: one strip per hub (all of them in the bay or its list), at most two
//     on show (one at 130 % and more), the rest behind a "+N" tile that says how many; every strip and the tile ≥ 48 px,
//     inside the safe rectangle, apart from the console, the board and each other, no sign or direction sign over the
//     bay; every column label and figure unclipped; the holder blue, red with a ringed "m:ss" on a jammed hub; no yellow;
//     in landscape the bay stands right of the board beside the console (or, where that column is too narrow, over the
//     map's lower left with one strip). On 412×915 and 915×412 a strip opens the full strip (the hub board) on the bay's
//     lines and its close button shuts it; the "+N" tile unfolds the list; the ATC strip (a range warning and the
//     refused-Undo notice) stands over the bay and the console, never on them.
// `--shots=t3` writes the T3 set to docs/shots/t3/ (the frames, the jam, the full strip, the ATC strip, the unfolded list).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, clickTestId, ROOT, ARTIFACTS, SEED, gameUrl, assertRender, RENDER } from './browser.mjs';

const started = performance.now();
const SHOTS_ARG = process.argv.find((arg) => arg === '--shots' || arg.startsWith('--shots='));
const SHOTS = SHOTS_ARG !== undefined;
const T2 = SHOTS_ARG === '--shots=t2';
const T3 = SHOTS_ARG === '--shots=t3'; // [night-75a] D-330
const OUT = SHOTS ? resolve(ROOT, T3 ? 'docs/shots/t3' : T2 ? 'docs/shots/t2' : 'docs/shots/t1') : resolve(ARTIFACTS, 'board');
const notch = { top: 47, bottom: 34, side: 47 };
/** [width, height, text scale, notch?] */
const CASES = SHOTS
  ? [[412, 915, 100], [915, 412, 100], [320, 568, 100], [412, 915, 150]]
  : [[320, 568, 100], [360, 640, 100], [412, 915, 100], [915, 412, 100], [640, 360, 100], [768, 1024, 100], [1032, 1376, 100],
    [390, 844, 100, 'notch'], [844, 390, 100, 'notch'], [320, 568, 150], [412, 915, 150], [915, 412, 150]];
// `--size=412x915` (repeatable) runs only those sizes.
const only = process.argv.filter((arg) => arg.startsWith('--size=')).map((arg) => arg.slice('--size='.length));
const cases = only.length ? CASES.filter(([w, h]) => only.includes(`${w}x${h}`)) : CASES;
const failures = [];
const failedScreens = new Set();
let checked = 0;
let shots = 0;

function boardUrl(url) {
  const target = new URL(gameUrl(url));
  return target.href;
}

async function audit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const root = document.documentElement;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:var(--aw-safe-left);top:var(--aw-safe-top);right:var(--aw-safe-right);bottom:var(--aw-safe-bottom);pointer-events:none;visibility:hidden';
    document.body.append(probe);
    const safe = probe.getBoundingClientRect();
    probe.remove();
    if (root.dataset.skin !== 'board') problems.push(`data-skin=${root.dataset.skin}`);
    const archivo = [...document.fonts].filter((face) => face.family.replace(/['"]/g, '') === 'Archivo' && face.status === 'loaded');
    if (archivo.length < 2) problems.push(`Archivo faces loaded: ${archivo.length}`);
    if (root.scrollWidth > innerWidth + 1) problems.push(`horizontal overflow ${root.scrollWidth} > ${innerWidth}`);
    if (document.querySelector('.base-pass')) problems.push('the Linoryt margin is drawn too');
    const box = (el) => el.getBoundingClientRect();
    const shown = (el) => { const r = box(el); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    const inside = (a, b, slack = 1) => a.left >= b.left - slack && a.right <= b.right + slack && a.top >= b.top - slack && a.bottom <= b.bottom + slack;
    const name = (el) => el.dataset.hudAction || el.className.split(' ')[0];
    // The board.
    const board = document.querySelector('.bd-board');
    if (!board) return [...problems, 'board missing'];
    const flaps = (cell) => [...board.querySelectorAll(`.bd-cell--${cell} .split-flap`)].map((f) => f.dataset.value).join('');
    const clock = flaps('clock');
    const week = flaps('week');
    const day = flaps('day');
    const pax = flaps('passengers');
    if (!/^\d\d:\d\d$/.test(clock)) problems.push(`clock "${clock}"`);
    if (!/^\d{1,3}$/.test(week)) problems.push(`week "${week}"`);
    if (!/^\d\/\d$/.test(day)) problems.push(`day "${day}"`);
    if (!/^\d{3,5}$/.test(pax)) problems.push(`passengers "${pax}"`);
    const label = board.getAttribute('aria-label') ?? '';
    if (board.getAttribute('role') !== 'img' || !label.startsWith(clock + ',') || !label.includes(week)) problems.push(`board label "${label}" (clock ${clock})`);
    if (board.querySelector('.bd-row')?.getAttribute('aria-hidden') !== 'true') problems.push('flaps not aria-hidden');
    const row = board.querySelector('.bd-row');
    if (row && row.scrollWidth > row.clientWidth + 1) problems.push(`board row overflows ${row.scrollWidth} > ${row.clientWidth}`);
    const inner = box(board);
    for (const cell of board.querySelectorAll('.bd-cell, .bd-label')) if (!inside(box(cell), inner)) problems.push(`${cell.className} outside the board`);
    for (const lab of board.querySelectorAll('.bd-label')) if (lab.scrollWidth > lab.clientWidth + 1) problems.push(`label "${lab.textContent}" clipped`);
    const hours = [...board.querySelectorAll('.bd-hours i')];
    if (hours.length !== 24) problems.push(`hour bar ${hours.length} cells`);
    const night = hours.filter((cell) => cell.classList.contains('is-night'));
    if (night.length !== 10) problems.push(`night hours ${night.length}`);
    if (night.some((cell) => box(cell).height >= box(hours[12]).height - .5)) problems.push('night hours not lower than day hours');
    if (hours.some((cell) => box(cell).width < 4)) problems.push('an hour cell narrower than 4 px');
    const now = board.querySelector('.bd-hours__now');
    const bar = board.querySelector('.bd-hours');
    if (!now || !bar || box(now).left < box(bar).left - 2 || box(now).right > box(bar).right + 2) problems.push('"now" mark outside the bar');
    // The console.
    const buttons = [...document.querySelectorAll('.airway-hud button')].filter(shown);
    if (buttons.length !== 7) problems.push(`HUD buttons ${buttons.length}`); // [night-86b] D-344: + Network
    for (const el of buttons) {
      const r = box(el);
      if (r.width < 47.5 || r.height < 47.5) problems.push(`${name(el)} ${r.width.toFixed(1)}×${r.height.toFixed(1)} < 48`);
      if (!inside(r, safe, .5)) problems.push(`${name(el)} outside the safe rectangle (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    const pause = document.querySelector('.airway-pass__pause');
    if (pause && meet(box(pause), inner)) problems.push('pause key over the board');
    const pass = document.querySelector('.airway-pass');
    const keys = [...document.querySelectorAll('.airway-dock__tag')];
    const shape = { undo: 'round', turboprop: 'plate', widebody: 'plate', hub: 'oct', network: 'round', speed: 'rotary' };
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      for (let j = i + 1; j < keys.length; j++) if (meet(box(key), box(keys[j]))) problems.push(`${name(key)} meets ${name(keys[j])}`);
      if (pass && meet(box(key), box(pass))) problems.push(`${name(key)} meets the top band`);
      const want = shape[key.dataset.hudAction];
      if (!key.querySelector(`.bd-face--${want}`)) problems.push(`${name(key)} without its ${want} face`);
      const caption = [...key.querySelectorAll('.bd-eng > span')].find(shown);
      if (!caption || !caption.textContent) problems.push(`${name(key)} without caption`);
      else if (!inside(box(caption), box(key), 1)) problems.push(`${name(key)} caption outside its key (${box(caption).width.toFixed(1)} in ${box(key).width.toFixed(1)})`);
      const wait = key.querySelector('.bd-wait');
      if (wait && !wait.hidden && !inside(box(wait), { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) problems.push(`${name(key)} wait tag off screen`);
    }
    const dash = (tag) => document.querySelector(`[data-hud-action="${tag}"] .bd-line path`)?.getAttribute('stroke-dasharray');
    if (!dash('turboprop') || dash('widebody')) problems.push(`route lines: turboprop ${dash('turboprop')}, widebody ${dash('widebody')}`);
    const round = document.querySelector('[data-hud-action="undo"] .bd-face--round');
    if (round && getComputedStyle(round).borderRadius !== '50%') problems.push(`undo key radius ${getComputedStyle(round).borderRadius}`);
    // Yellow is "where to / what next" only: never on the board or the console.
    const yellow = [...document.querySelectorAll('.airway-hud, .airway-hud *')].filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.fill, s.stroke, s.borderTopColor].includes('rgb(243, 195, 23)');
    });
    if (yellow.length) problems.push(`yellow in the HUD: ${yellow.slice(0, 3).map(name).join(', ')}`);
    return [...problems, ...signProblems(), ...stripProblems()];

    // [night-75a] D-330 (T3): the hub strip bay.
    function stripProblems() {
      const out = [];
      const bay = document.querySelector('.airway-strip-bay');
      if (!bay) return ['no strip bay'];
      const all = [...bay.querySelectorAll('.bd-strip')];
      if (!all.length) { if (!bay.hidden) out.push('an empty bay is shown'); return out; }
      if (bay.hidden || !shown(bay)) return [`${all.length} hubs but the bay is hidden`];
      const front = [...bay.querySelectorAll('.bd-bay__strips > .bd-strip')];
      const scale = Number(root.dataset.airwayTextScale ?? 100);
      if (front.length < 1 || front.length > 2) out.push(`${front.length} strips on show`);
      if (scale >= 130 && front.length > 1) out.push(`${front.length} strips at ${scale} % text`);
      const more = bay.querySelector('.bd-bay__more');
      const rest = all.length - front.length;
      if (rest > 0) {
        if (!more || more.hidden || !shown(more)) out.push(`${rest} folded strips without the tile`);
        else {
          if (!more.textContent.includes(String(rest))) out.push(`tile "${more.textContent}" for ${rest}`);
          if (box(more).width < 47.5 || box(more).height < 47.5) out.push(`tile ${box(more).width}×${box(more).height}`);
          if (!more.getAttribute('aria-label')) out.push('tile without a label');
        }
      } else if (more && !more.hidden) out.push('tile shown with nothing folded');
      const bayBox = box(bay);
      if (!inside(bayBox, safe, .5)) out.push(`bay outside the safe rectangle (${Math.round(bayBox.left)},${Math.round(bayBox.top)},${Math.round(bayBox.right)},${Math.round(bayBox.bottom)})`);
      const dock = document.querySelector('.airway-dock');
      const pass = document.querySelector('.airway-pass');
      if (dock && meet(bayBox, box(dock))) out.push('bay over the console');
      if (pass && meet(bayBox, box(pass))) out.push('bay over the top band');
      const landscape = innerWidth > innerHeight && innerHeight < 600;
      if (landscape && bay.dataset.anchor === 'top' && board && bayBox.left < box(board).right) out.push('landscape bay not right of the board');
      if (landscape && bay.dataset.anchor === 'bottom' && front.length > 1) out.push('landscape fallback bay with two strips');
      front.forEach((strip, i) => {
        const id = strip.dataset.hub;
        const r = box(strip);
        if (r.height < 47.5) out.push(`strip ${id} ${r.height.toFixed(1)} px tall`);
        if (!inside(r, bayBox, 1)) out.push(`strip ${id} outside the bay`);
        for (let j = i + 1; j < front.length; j++) if (meet(r, box(front[j]))) out.push(`strip ${id} meets ${front[j].dataset.hub}`);
        const label = strip.getAttribute('aria-label') ?? '';
        if (!label.includes(strip.querySelector('.bd-strip__code')?.textContent ?? '?')) out.push(`strip ${id} label "${label}"`);
        for (const el of strip.querySelectorAll('.bd-strip__lab, .bd-strip__code, .bd-strip__val')) {
          if (el.scrollWidth > el.clientWidth + 1 || !inside(box(el), r, 1)) out.push(`strip ${id}: "${el.textContent}" clipped (${el.scrollWidth}/${el.clientWidth}, ${Math.round(box(el).bottom)} in ${Math.round(r.bottom)})`);
        }
        for (const row of strip.querySelectorAll('.bd-strip__row')) if (row.scrollWidth > row.clientWidth + 1) out.push(`strip ${id}: queue row overflows (${row.scrollWidth}/${row.clientWidth}, ${row.children.length} marks)`);
        const grip = getComputedStyle(strip.querySelector('.bd-strip__grip')).backgroundColor;
        const jam = strip.classList.contains('bd-strip--jam');
        if (grip !== (jam ? 'rgb(192, 35, 27)' : 'rgb(59, 95, 140)')) out.push(`strip ${id} holder ${grip} (jam ${jam})`);
        const value = strip.querySelector('.bd-strip__close .bd-strip__val');
        if (jam && (!/^\d+:\d\d$/.test(value?.textContent ?? '') || !value.querySelector('.bd-strip__ring'))) out.push(`strip ${id} jam value "${value?.textContent}"`);
      });
      for (const el of document.querySelectorAll('.bd-notes .airport-bubble, .bd-notes .airport-edge')) {
        if (!el.hidden && shown(el) && meet(box(el), bayBox)) out.push(`${el.dataset.airport ?? el.textContent} over the bay`);
      }
      const yellow = [bay, ...bay.querySelectorAll('*')].filter((el) => {
        const st = getComputedStyle(el);
        return [st.color, st.backgroundColor, st.fill, st.stroke].includes('rgb(243, 195, 23)');
      });
      if (yellow.length) out.push('yellow in the bay');
      return out;
    }

    // [night-73a] D-328 (T2): the airport signs, direction signs and atlas labels.
    function signProblems() {
      const out = [];
      const layer = document.querySelector('.airport-overlay.bd-notes');
      if (!layer) return ['the overlay has no board signs (.bd-notes)'];
      const origin = layer.getBoundingClientRect();
      const stamps = (window.__awLinoryt?.stamps?.() ?? []).filter((s) => s.visible && s.half > 0)
        .map((s) => ({ ...s, x: s.x + origin.left, y: s.y + origin.top }));
      const probe = window.__awBoardSigns;
      const scale = Number(root.dataset.airwayTextScale ?? 100);
      if (!probe) out.push('no sign probe');
      else if (scale >= 130 && probe.lod !== 2) out.push(`level of detail ${probe.lod} at ${scale} % text`);
      const signs = [...layer.querySelectorAll('.airport-bubble.bd-sign')].filter((b) => !b.hidden && shown(b));
      if (signs.length === 0) out.push('no airport sign shown');
      const rects = signs.map((b) => box(b));
      signs.forEach((sign, i) => {
        const id = sign.dataset.airport;
        const r = rects[i];
        const plate = sign.querySelector('.bd-plate');
        if (!plate || !shown(plate)) { out.push(`${id}: no code plate`); return; }
        const top = box(plate).top;
        for (const child of sign.children) {
          if (!shown(child) || child.matches('.bd-br, .bd-city, .bd-new')) continue;
          if (Math.abs(box(child).top - top) > 1) out.push(`${id}: ${child.getAttribute('class')} wrapped off the sign row`);
          if (box(child).right > r.right + 1) out.push(`${id}: ${child.getAttribute('class')} spills out of the sign`);
        }
        if (sign.scrollHeight > r.height + 1) out.push(`${id}: sign taller than its box`);
        const face = getComputedStyle(sign.querySelector('.bd-code')).fontFamily;
        if (!/^["']?Archivo/.test(face)) out.push(`${id}: code face ${face}`);
        const own = stamps.find((s) => s.id === id);
        if (own) {
          const dx = Math.max(r.left - own.x, 0, own.x - r.right), dy = Math.max(r.top - own.y, 0, own.y - r.bottom);
          if (Math.hypot(dx, dy) > 60) out.push(`${id}: sign ${Math.round(Math.hypot(dx, dy))} px from its pin`);
        }
        for (const s of stamps) {
          const h = s.half * .7;
          if (s.x + h > r.left && s.x - h < r.right && s.y + h > r.top && s.y - h < r.bottom) out.push(`${id}: sign on ${s.id}'s pin`);
        }
        for (let j = i + 1; j < signs.length; j++) if (meet(r, rects[j])) out.push(`${id}: sign overlaps ${signs[j].dataset.airport}'s`);
      });
      for (const label of [...layer.querySelectorAll('.bd-atlas__label')].filter((el) => !el.hidden)) {
        const r = box(label);
        if (rects.some((s) => meet(r, s))) out.push(`atlas label "${label.textContent}" over a sign`);
        if (stamps.some((s) => s.x + s.half > r.left && s.x - s.half < r.right && s.y + s.half > r.top && s.y - s.half < r.bottom)) {
          out.push(`atlas label "${label.textContent}" over a pin`);
        }
      }
      const edges = [...layer.querySelectorAll('.airport-edge')].filter((el) => !el.hidden && shown(el));
      const yellowSigns = edges.filter((el) => getComputedStyle(el).backgroundColor === 'rgb(243, 195, 23)');
      if (yellowSigns.length > 2) out.push(`${yellowSigns.length} yellow direction signs (at most 2)`);
      for (const el of edges) if (box(el).height < 47.5) out.push(`direction sign ${el.textContent} ${box(el).height} px tall`);
      return out;
    }
  });
}

/** [night-73a] D-328: plays on (answering weekly boards) until a jam shows; the jam's sign or direction sign is checked. */
async function jamProblems(page) {
  for (let i = 0; i < 3000; i++) {
    const screen = await page.evaluate(() => window.aw.state().screen);
    if (screen === 'upgrade') {
      await page.evaluate(() => { // [night-76a] D-331: a strip only chooses on the T4 sheet; the main action takes it
        document.querySelector('[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')?.click();
        document.querySelector('[data-testid="upgrade-take"]')?.click();
      });
      await page.waitForTimeout(100);
      continue;
    }
    if (screen !== 'game') return [`no live jam before the screen "${screen}"`];
    await page.evaluate(() => window.aw.advanceTicks(5));
    if (await page.evaluate(() => !!document.querySelector('.bd-notes :is(.airport-bubble--jam, .airport-edge--jam):not([hidden])'))) break;
  }
  // Turn to the jammed airport (its direction sign navigates there), then check its sign.
  await page.evaluate(() => document.querySelector('.bd-notes .airport-edge--jam:not([hidden])')?.click());
  await page.waitForTimeout(1200);
  return await page.evaluate(() => {
    const out = [];
    const jam = document.querySelector('.bd-notes .airport-bubble--jam:not([hidden])');
    const edge = document.querySelector('.bd-notes .airport-edge--jam:not([hidden])');
    if (!jam && !edge) return ['no jam sign after playing on'];
    if (jam) {
      const plate = getComputedStyle(jam.querySelector('.bd-plate'));
      const timer = jam.querySelector('.airport-bubble__timer');
      if (plate.backgroundColor !== 'rgb(192, 35, 27)' || plate.color !== 'rgb(255, 255, 255)') out.push(`jam plate ${plate.color} on ${plate.backgroundColor}`);
      if (!timer || timer.hidden || !/^\d+:\d\d$/.test(timer.textContent ?? '')) out.push(`jam countdown "${timer?.textContent}"`);
      if (!/\d/.test(jam.getAttribute('aria-label') ?? '')) out.push(`jam label "${jam.getAttribute('aria-label')}"`);
    } else if (getComputedStyle(edge).backgroundColor !== 'rgb(192, 35, 27)') out.push(`jam direction sign ${getComputedStyle(edge).backgroundColor}`);
    return out;
  });
}

/** [night-75a] D-330: a strip opens the full strip, the tile unfolds the list, the ATC strip stands over the chrome. */
async function stripInteractions(page, tag) {
  const out = [];
  const opened = await page.evaluate(() => {
    const strip = document.querySelector('.airway-strip-bay:not([hidden]) .bd-bay__strips > .bd-strip');
    if (!strip) return null;
    strip.click();
    return strip.dataset.hub;
  });
  if (opened) {
    await page.waitForTimeout(200);
    out.push(...await page.evaluate(() => {
      const problems = [];
      const sheet = document.querySelector('[data-testid="hub-board"]');
      if (!sheet || sheet.hidden) return ['a strip did not open the full strip'];
      const r = sheet.getBoundingClientRect();
      const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
      for (const sel of ['.airway-dock', '.airway-pass']) {
        const el = document.querySelector(sel);
        if (el && meet(r, el.getBoundingClientRect())) problems.push(`full strip over ${sel}`);
      }
      if (getComputedStyle(sheet).backgroundColor !== 'rgb(237, 227, 200)') problems.push(`full strip on ${getComputedStyle(sheet).backgroundColor}`);
      if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) problems.push('full strip off screen');
      const close = sheet.querySelector('[data-testid="hub-board-close"]').getBoundingClientRect();
      if (close.width < 47.5 || close.height < 47.5) problems.push('full strip close < 48');
      return problems;
    }));
    if (T3) { await page.screenshot({ path: resolve(OUT, `game-${tag}-full.png`), animations: 'disabled' }); shots++; }
    await clickTestId(page, 'hub-board-close');
    await page.waitForTimeout(100);
    if (await page.evaluate(() => !document.querySelector('[data-testid="hub-board"]').hidden)) out.push('the full strip did not close');
  }
  if (await page.evaluate(() => { const m = document.querySelector('.bd-bay__more'); return !!m && !m.hidden; })) {
    await page.click('.bd-bay__more');
    await page.waitForTimeout(100);
    out.push(...await page.evaluate(() => {
      const list = document.querySelector('.bd-bay__list');
      const more = document.querySelector('.bd-bay__more');
      if (!list || list.hidden || more.getAttribute('aria-expanded') !== 'true') return ['the tile did not unfold the list'];
      const r = list.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) return ['the list runs off screen'];
      return [...list.querySelectorAll('.bd-strip')].filter((s) => s.getBoundingClientRect().height < 47.5).map((s) => `listed strip ${s.dataset.hub} < 48`);
    }));
    if (T3) { await page.screenshot({ path: resolve(OUT, `game-${tag}-more.png`), animations: 'disabled' }); shots++; }
    await page.click('.bd-bay__more');
    await page.waitForTimeout(100);
  }
  // The ATC strip: a range warning, then the refused-Undo notice (D-321), mounted on the game layer as the session does.
  for (const kind of ['warning', 'notice']) {
    out.push(...await page.evaluate(async (kind) => {
      const { mountAtcStrip } = await import('/src/ui/atcStrip.ts');
      const { t } = await import('/src/i18n/index.ts');
      const layer = document.querySelector('.airway-game-layer');
      const atc = mountAtcStrip(layer);
      if (kind === 'warning') atc.show({ from: 'AMM', to: 'KHI', distanceKm: 2408, rangeKm: 1500, aircraft: 'turboprop' });
      else atc.notice(t('route.atc.undoRefused', { code: 'AMM', time: '04:12' }), 60000);
      window.__awT3Atc = atc;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const strip = [...layer.querySelectorAll('.airway-atc-strip:not(.airway-first-time, .airway-slot-hint)')].pop();
      const r = strip.getBoundingClientRect();
      const meet = (a, b) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
      const problems = [];
      for (const sel of ['.airway-dock', '.airway-pass', '.airway-strip-bay:not([hidden])']) {
        const el = document.querySelector(sel);
        if (el && meet(r, el.getBoundingClientRect())) problems.push(`ATC ${kind} over ${sel}`);
      }
      if (r.left < 0 || r.right > innerWidth + .5 || r.top < 0 || r.bottom > innerHeight) problems.push(`ATC ${kind} off screen`);
      if (getComputedStyle(strip).backgroundColor !== 'rgb(237, 227, 200)') problems.push(`ATC ${kind} on ${getComputedStyle(strip).backgroundColor}`);
      for (const field of strip.querySelectorAll('.airway-atc-field:not([hidden])')) if (field.scrollWidth > field.clientWidth + 1) problems.push(`ATC ${kind} field clipped`);
      return problems;
    }, kind));
    if (T3) { await page.screenshot({ path: resolve(OUT, `game-${tag}-atc-${kind}.png`), animations: 'disabled' }); shots++; }
    await page.evaluate(() => { window.__awT3Atc?.dispose(); window.__awT3Atc = null; });
  }
  return out;
}

try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(OUT, { recursive: true });
    for (const language of ['pl', 'en']) {
      for (const [width, height, scale, profile] of cases) {
        const tag = `${language}-${width}x${height}${scale !== 100 ? '-' + scale : ''}${profile ? '-' + profile : ''}`;
        let page;
        try {
          const opened = await newGamePage(browser, boardUrl(url), language, { width, height }, { textScale: scale !== 100 ? scale : undefined });
          page = opened.page;
          await assertRender(page);
          const sides = width > height
            ? { top: 0, bottom: 21, left: notch.side, right: notch.side }
            : { top: notch.top, bottom: notch.bottom, left: 0, right: 0 };
          if (profile === 'notch') {
            await page.addStyleTag({ content: `:root{--aw-safe-top:${sides.top}px!important;--aw-safe-bottom:${sides.bottom}px!important;` +
              `--aw-safe-left:${sides.left}px!important;--aw-safe-right:${sides.right}px!important}` });
          }
          await waitForScreen(page, 'menu');
          await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
          await clickTestId(page, 'menu-endless');
          await waitForScreen(page, 'game');
          // At the start of the run the aircraft are in stock: choose one and check the plate (then put it back).
          const early = [];
          await page.evaluate(() => window.aw.botStep?.());
          await page.evaluate(() => window.aw.advanceTicks(30));
          // Choosing an aircraft turns its plate over (cream, lamp lit), never yellow.
          const plate = await page.evaluate(() => {
            const pick = ['turboprop', 'widebody'].map((t) => document.querySelector(`[data-hud-action="${t}"]`)).find((b) => b && !b.disabled);
            if (!pick) return null;
            pick.click();
            return pick.dataset.hudAction;
          });
          if (!plate) early.push('no aircraft in stock to choose at the start of the run');
          else {
            await page.waitForTimeout(200);
            const chosen = await page.evaluate((plate) => {
              const key = document.querySelector(`[data-hud-action="${plate}"]`);
              const face = key?.querySelector('.bd-face--plate');
              const lamp = key?.querySelector('.bd-lamp');
              return { selected: key?.classList.contains('is-selected'), pressed: key?.getAttribute('aria-pressed'),
                bg: face && getComputedStyle(face).backgroundColor, lamp: lamp && getComputedStyle(lamp).backgroundColor };
            }, plate);
            if (!chosen.selected || chosen.pressed !== 'true') early.push(`chosen ${plate}: ${JSON.stringify(chosen)}`);
            if (chosen.bg !== 'rgb(239, 231, 211)' || chosen.lamp !== 'rgb(255, 241, 201)') early.push(`chosen plate face ${chosen.bg}, lamp ${chosen.lamp}`);
            if (SHOTS && width === 412 && scale === 100) {
              await page.screenshot({ path: resolve(OUT, `game-${tag}-chosen.png`), animations: 'disabled' });
              shots++;
            }
            await page.evaluate((plate) => document.querySelector(`[data-hud-action="${plate}"]`)?.click(), plate);
            await page.waitForTimeout(100);
          }
          // A short real run: the bot draws routes and assigns aircraft, time reaches the afternoon of day 2.
          for (let i = 0; i < 31; i++) {
            await page.evaluate(() => window.aw.botStep?.());
            await page.evaluate(() => window.aw.advanceTicks(80));
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          const problems = [...early, ...await audit(page)];
          if (opened.errors.length) problems.push(`browser errors: ${opened.errors.splice(0).join('; ')}`);
          checked++;
          for (const problem of problems) failures.push(`${tag}: ${problem}`);
          if (problems.length) failedScreens.add(tag);
          await page.screenshot({ path: resolve(OUT, `game-${tag}.png`), animations: 'disabled' });
          shots++;
          // [night-73a] D-328: a live jam on the phone and the landscape phone.
          if (scale === 100 && !profile && ((width === 412 && height === 915) || (width === 915 && height === 412))) {
            const jam = await jamProblems(page);
            const later = [...jam, ...await audit(page)];
            for (const problem of later) failures.push(`${tag} jam: ${problem}`);
            if (later.length) failedScreens.add(tag);
            problems.push(...later);
            if (T2 || T3) { await page.screenshot({ path: resolve(OUT, `game-${tag}-jam.png`), animations: 'disabled' }); shots++; }
            // [night-75a] D-330: the strips' interactions on the same two screens.
            const strips = await stripInteractions(page, tag);
            for (const problem of strips) failures.push(`${tag} strips: ${problem}`);
            if (strips.length) failedScreens.add(tag);
            problems.push(...strips);
          }
          console.log(`${problems.length ? 'FAIL' : 'PASS'} game ${tag}${problems.length ? ': ' + problems.join(' | ') : ''}`);
        } catch (error) {
          failures.push(`${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
          failedScreens.add(tag);
          console.log(`FAIL game ${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
        } finally {
          await page?.close();
        }
      }
    }
    // [night-73a] D-328: a grown network (ten airports on screen) and the same at the closest zoom, PL and EN.
    if (T2 || T3) {
      for (const language of ['pl', 'en']) {
        const { page } = await newGamePage(browser, boardUrl(url), language, { width: 412, height: 915 });
        try {
          await waitForScreen(page, 'menu');
          // 0xA1A2 lives longest under the bot (the harness seed ends in week 2): an hour a step, boards answered, until
          // ten airports are on screen with no jam.
          await page.evaluate((seed) => window.aw.prepareSeed(seed), 0xA1A2);
          await clickTestId(page, 'menu-endless');
          await waitForScreen(page, 'game');
          for (let hour = 0; hour < 400; hour++) {
            const screen = await page.evaluate(() => window.aw.state().screen);
            if (screen === 'upgrade') {
              // [night-76a] D-331: a strip only chooses on the T4 sheet; the main action takes it.
              await page.evaluate(() => {
                document.querySelector('[data-testid^="upgrade-option-"]:not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"])')?.click();
                document.querySelector('[data-testid="upgrade-take"]')?.click();
              });
              await page.waitForTimeout(100);
              continue;
            }
            if (screen !== 'game') break;
            await page.evaluate(() => window.aw.botStep?.());
            await page.evaluate(() => window.aw.advanceTicks(60));
            if (await page.evaluate(() => (window.__awBoardSigns?.visible ?? 0) >= 10 && !document.querySelector('.bd-notes :is(.airport-bubble--jam, .airport-edge--jam):not([hidden])'))) break;
          }
          await page.waitForTimeout(600);
          const dense = await audit(page);
          const lod = await page.evaluate(() => window.__awBoardSigns);
          console.log(`${dense.length ? 'FAIL' : 'PASS'} dense ${language} ${JSON.stringify(lod)}${dense.length ? ': ' + dense.join(' | ') : ''}`);
          await page.screenshot({ path: resolve(OUT, `game-${language}-412x915-dense.png`), animations: 'disabled' });
          if (T3) { // [night-75a] D-330: a grown network has more hubs than the bay shows: the tile and its list
            const strips = await stripInteractions(page, `${language}-412x915-dense`);
            console.log(`${strips.length ? 'FAIL' : 'PASS'} dense strips ${language}${strips.length ? ': ' + strips.join(' | ') : ''}`);
            if (strips.length) failures.push(...strips.map((p) => `dense ${language}: ${p}`));
          }
          await page.mouse.move(206, 470);
          await page.mouse.wheel(0, -600);
          await page.waitForTimeout(900);
          const zoomed = await audit(page);
          console.log(`${zoomed.length ? 'FAIL' : 'PASS'} zoom ${language} ${JSON.stringify(await page.evaluate(() => window.__awBoardSigns))}${zoomed.length ? ': ' + zoomed.join(' | ') : ''}`);
          await page.screenshot({ path: resolve(OUT, `game-${language}-412x915-zoom.png`), animations: 'disabled' });
          shots += 2;
        } finally {
          await page.close();
        }
      }
    }
  });
} catch (error) {
  failures.push(`harness: ${String(error?.message ?? error).split('\n')[0]}`);
}
const expected = cases.length * 2;
console.log(`SUMMARY test:e2e:board render=${RENDER} seed=0x${SEED.toString(16).toUpperCase()} screens=${checked}/${expected} ` +
  `shots=${shots} passed=${expected - failedScreens.size} failed=${failedScreens.size} problems=${failures.length} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failures.length || checked !== expected) process.exitCode = 1;

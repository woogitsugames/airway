// [night-11aq] D-249: UI skin groundwork, zero-visual-change evidence. Captures every fixture screen that needs no live
// globe (G7: full-globe SwiftShader runs time out) and compares two captures pixel by pixel and by computed style:
//   node e2e/skin-pixels.mjs capture <dir>      screens of e2e/screen-fixtures.mjs (menu, settings, logbook, puzzle
//                                               board, weekly board over the HUD, game over, HUD, first-time card) +
//                                               pause sheet, airport overlay (tags, jam, NEW, curfew, slot ticket,
//                                               trend, demand surge, edge chips), hub cause board and [night-11as] ATC
//                                               strip + route menu + handles, leaderboard, puzzle game, tutorial; PL/EN × 412×915, 915×412,
//                                               320×568 at 100 % text, 412×915 also at 150 % (D-248). PNG + a JSON of
//                                               computed visual properties of every element.
//   AW_SKIN=current node e2e/skin-pixels.mjs capture <dir> the same screens in the previous "Diorama" skin, DEV
//                                               comparison only ([night-11az] D-257: Róża is the default; before it,
//                                               KARTA, and AW_SKIN=karta captured the D-256 preview);
//                                               AW_SCREENS=hud,overlay,… captures only those screens.
//   node e2e/skin-pixels.mjs compare <a[,a2…]> <b[,b2…]>  every shot identical (pixels and computed style) in some base/new pair (a few
//                                               anti-aliased edges and native controls are not bit-stable run to run
//                                               in headless Chromium, even on one tree) and every computed value equal.
// Use: capture on the tree before a skin change (a worktree of the base commit) and after it, then compare. Not a CI
// suite (the base capture needs the old tree); the static guard is `npm run test:skin-tokens`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { inflateSync } from 'node:zlib';
import { withBrowser } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
import { SCREENS, mountScreen } from './screen-fixtures.mjs';

const started = performance.now();
const [mode, dirA, dirB] = process.argv.slice(2);
const SIZES = [[412, 915], [915, 412], [320, 568]];
// [night-11au] D-256 / [night-11ax] D-257: AW_SKIN=<name> adds `?skin=<name>`; `current` shows the old Diorama skin.
const SKIN = process.env.AW_SKIN ?? '';
// [night-11as] + the components the D-250 follow-up covers: ATC strip / route menu / handles, leaderboard, puzzle game
// screen (with a curfew barrier), tutorial vignette.
const EXTRA = ['pause', 'overlay', 'hub-board', 'atc', 'leaderboard', 'puzzle-game', 'tutorial'];
const PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color',
  'border-left-color', 'border-top-width', 'border-left-width', 'border-top-left-radius', 'outline-color', 'box-shadow',
  'font-family', 'font-weight', 'font-size', 'line-height', 'letter-spacing', 'fill', 'stroke', 'width', 'height',
  'padding-top', 'padding-left', 'animation-name', 'animation-duration', 'animation-delay', 'transition-duration',
  'accent-color', 'border-image-source'];

async function mountExtra(page, screen, language) {
  await page.evaluate(async ({ screen, language }) => {
    const { setLanguage, t } = await import('/src/i18n/index.ts');
    setLanguage(language);
    const host = document.getElementById('app');
    if (screen === 'pause') {
      // The DOM of src/game/session.ts (the sheet is built there, with no public mount of its own).
      const layer = document.createElement('div');
      layer.className = 'airway-game-layer';
      host.append(layer);
      const { mountHud } = await import('/src/ui/hud/index.ts');
      const hudHost = document.createElement('div');
      layer.append(hudHost);
      mountHud(hudHost, {}).render({ week: 3, day: 2, timeMinutes: 1026, passengers: 342, paused: true, speed: 1, canUndo: false,
        selectedPlane: null, stock: { turboprop: 0, widebody: 1, hub: 1 }, minutesToBoard: 1500 });
      const sheet = document.createElement('section');
      sheet.className = 'airway-pause';
      const title = document.createElement('h2');
      title.textContent = t('pause.title');
      const list = document.createElement('dl');
      list.className = 'airway-pause__summary';
      for (const [k, v] of [['ROUTES', '4'], ['AIRCRAFT', '6'], ['BUSIEST', 'FRA 11/12']]) {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        list.append(dt, dd);
      }
      const button = (cls, text) => { const b = document.createElement('button'); b.className = cls; b.textContent = text; return b; };
      const row = document.createElement('div');
      row.className = 'airway-pause__row';
      row.append(button('airway-pause__button', 'Save'), button('airway-pause__button', 'Menu'));
      const status = document.createElement('p');
      status.className = 'airway-pause__status';
      status.textContent = 'Saved.';
      sheet.append(title, list, button('airway-pause__button airway-pause__button--primary', 'Resume'), row, status);
      layer.append(sheet);
    } else if (screen === 'overlay') {
      const { createAirportOverlay } = await import('/src/ui/overlay.ts');
      const { PerspectiveCamera } = await import('/node_modules/three/build/three.module.js');
      const layerHost = document.createElement('div');
      layerHost.style.cssText = 'position:fixed;inset:0';
      host.append(layerHost);
      const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
      camera.position.set(0, 0, 3.4);
      camera.lookAt(0, 0, 0);
      const overlay = createAirportOverlay(layerHost, camera, {});
      const glyphs = (n) => Array.from({ length: n }, (_, i) => ['EUN', 'NAM', 'ME', 'AFR', 'SAM', 'EUS'][i % 6]);
      const add = (id, lon, lat, hub = false) => { overlay.addAirport({ id, code: id, lon, lat, hub }); overlay.setCapacity(id, 12); };
      add('FRA', -20, 28, true); overlay.setPassengers('FRA', glyphs(9), 2); overlay.setFillTrend('FRA', 'filling');
      add('MAD', 12, 20); overlay.setPassengers('MAD', glyphs(12)); overlay.setJamCountdown('MAD', 42); overlay.setFillTrend('MAD', 'emptying');
      add('ATH', -18, 2); overlay.setPassengers('ATH', glyphs(3)); overlay.setNew('ATH', true);
      add('CAI', 14, -6); overlay.setPassengers('CAI', glyphs(4)); overlay.setCurfew('CAI', true); overlay.setSlotHold('CAI', 2, 37);
      add('IST', -16, -24, true); overlay.setSurge?.('IST', { phase: 'announced', passengers: 12, time: '14:00' });
      add('DXB', 10, -28); overlay.setPassengers('DXB', glyphs(5)); overlay.setSurge?.('DXB', { phase: 'active', passengers: 12, time: '18:00' });
      // Behind the globe: edge chips (gauge, jam, new, curfew).
      add('NYC', 170, 40); overlay.setPassengers('NYC', glyphs(7));
      add('LAX', 160, 0); overlay.setPassengers('LAX', glyphs(11)); overlay.setJamCountdown('LAX', 20);
      add('SYD', 175, -40); overlay.setNew('SYD', true);
      add('LIM', -170, 20); overlay.setPassengers('LIM', glyphs(2)); overlay.setCurfew('LIM', true);
      add('JNB', -150, -30); overlay.setSurge?.('JNB', { phase: 'announced', passengers: 12, time: '09:00' });
      overlay.update();
    } else if (screen === 'atc') {
      const { mountAtcStrip, mountRouteContextMenu, mountRouteHandles } = await import('/src/ui/atcStrip.ts');
      const layer = document.createElement('div');
      layer.style.cssText = 'position:fixed;inset:0';
      host.append(layer);
      mountAtcStrip(layer).show({ from: 'FRA', to: 'SIN', distanceKm: 10260, rangeKm: 3000, aircraft: 'turboprop' });
      mountRouteContextMenu(layer, { remove() {}, shorten() {}, close() {} }).show({ routeId: 'r1', end: 'end', x: 40, y: 60, canShorten: true });
      mountRouteHandles(layer).show([{ routeId: 'r1', end: 'start', cityId: 'FRA', x: 290, y: 120 },
        { routeId: 'r2', end: 'end', cityId: 'MAD', x: 340, y: 180 }], 'r2');
    } else if (screen === 'leaderboard') {
      const { createRankingView } = await import('/src/ui/leaderboard/index.ts');
      const entry = (rank, callSign, score, me = false) => ({ rank, callSign, score, me });
      const board = (me) => ({ entries: [entry(1, 'KITE-41', 2310), entry(2, 'HERON-7', 1984), entry(3, 'OWL-12', 1702)], me });
      const ready = createRankingView('2026-11-05');
      ready.update({ kind: 'ready', daily: board(entry(17, 'GULL-3', 912, true)), weekly: board(null) });
      const status = createRankingView('2026-11-05');
      status.update({ kind: 'queued' });
      host.append(ready.element, status.element);
    } else if (screen === 'puzzle-game') {
      const { mountPuzzleSelector } = await import('/src/ui/puzzles/index.ts');
      mountPuzzleSelector(host, () => {});
      const flaps = [...document.querySelectorAll('.puzzle-flap')];
      (flaps.find((flap) => flap.querySelector('.puzzle-flap-number')?.textContent === '08') ?? flaps[0])?.click();
    } else if (screen === 'tutorial') {
      const { mountTutorial } = await import('/src/game/tutorial/index.ts');
      mountTutorial(host);
      // The route guide loops; freeze every animation at its start so two captures of one tree match.
      await new Promise((done) => requestAnimationFrame(done));
      for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
    } else if (screen === 'hub-board') {
      const { HubDepartureLog } = await import('/src/game/hubBoard.ts');
      const { mountHubBoard } = await import('/src/ui/hubBoard.ts');
      const layer = document.createElement('div');
      layer.style.cssText = 'position:fixed;inset:0';
      host.append(layer);
      const board = mountHubBoard(layer, { close: () => {} });
      const REGIONS = ['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'];
      const city = (id, region, waiting = []) => ({ id, region, waiting, connecting: 0, capacity: 48, hub: true, jamTicksLeft: null,
        slotHeld: 0, nextSlotMinutes: 0, curfewClosed: false, lon: 0, lat: 0 });
      const waiting = REGIONS.flatMap((region, i) => Array(9 - i).fill(region));
      const fake = (minute, planes) => ({ clockMinute: minute,
        cityList: () => [city('IST', 'ME', waiting), city('NYC', 'NAM'), city('MAD', 'EUS'), city('CAI', 'ME'), city('DEL', 'ASI')],
        routeList: () => [{ id: 'r1', cityIds: ['IST', 'NYC'] }, { id: 'r2', cityIds: ['IST', 'MAD'] }, { id: 'r3', cityIds: ['IST', 'CAI'] },
          { id: 'r4', cityIds: ['IST', 'DEL'] }],
        planeList: () => planes });
      const plane = (id, routeId, phase, load, slotWaitTicks = 0) => ({ id, routeId, type: 'widebody', segment: 0, progress01: 0,
        direction: 1, load, capacity: 20, phase, cityIndex: 0, slotWaitTicks });
      const log = new HubDepartureLog();
      log.observe(fake(600, [plane('a', 'r1', 'ground', 0), plane('b', 'r2', 'ground', 0)]));
      log.observe(fake(640, [plane('a', 'r1', 'flight', 20), plane('b', 'r2', 'ground', 0, 40)]));
      board.show({ ...log.board(fake(640, []), 'IST'), code: 'IST' });
      document.querySelector('.airway-hub-board')?.classList.add('airway-hub-board--jammed');
    }
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { screen, language });
  await page.waitForTimeout(150);
}

function styleDump(page) {
  return page.evaluate((props) => [...document.body.querySelectorAll('*')].filter((el) => !el.closest('script, style, canvas'))
    .map((el, i) => {
      const s = getComputedStyle(el);
      return `${i} ${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).trim().replace(/\s+/g, '.')} ` +
        props.map((p) => s.getPropertyValue(p)).join(' | ');
    }), PROPS);
}

async function capture(dir) {
  mkdirSync(dir, { recursive: true });
  let shots = 0;
  await withBrowser(async ({ browser, url }) => {
    const jobs = [];
    for (const language of ['pl', 'en']) for (const [w, h] of SIZES) for (const screen of [...SCREENS, ...EXTRA]) jobs.push({ language, w, h, screen, scale: 100 });
    for (const language of ['pl', 'en']) for (const screen of [...SCREENS, ...EXTRA]) jobs.push({ language, w: 412, h: 915, screen, scale: 150 });
    // [night-11av] AW_SCREENS=hud,overlay limits a capture to those screens (quick look while editing a skin).
    const only = process.env.AW_SCREENS ? new Set(process.env.AW_SCREENS.split(',')) : null;
    for (const { language, w, h, screen, scale } of jobs.filter((job) => !only || only.has(job.screen))) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?perf=scene' + (SKIN ? `&skin=${SKIN}` : ''), { waitUntil: 'networkidle' });
        if (SCREENS.includes(screen)) await mountScreen(page, screen, language, { pseudo: false, textScale: scale });
        else {
          await page.evaluate(async (textScale) => {
            const { applyAccessibilitySettings } = await import('/src/ui/a11y.ts');
            applyAccessibilitySettings({ textScale, enhancedGlyphs: false, hapticsEnabled: true });
          }, scale);
          await mountExtra(page, screen, language);
        }
        // Capture-only: no running animation (the jam pulse is infinite) and no native select chevron, whose
        // anti-aliasing is not bit-stable between two runs of the same tree in headless Chromium.
        await page.addStyleTag({ content: 'select { appearance: none !important; -webkit-appearance: none !important; }' });
        await page.evaluate(() => { document.documentElement.dataset.airwayMotion = 'reduce'; return new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))); });
        const name = `${screen}-${language}-${w}x${h}-${scale}`;
        await page.screenshot({ path: resolve(dir, name + '.png'), animations: 'disabled' });
        writeFileSync(resolve(dir, name + '.json'), JSON.stringify(await styleDump(page)));
        shots++;
      } finally {
        await page.close();
      }
    }
  });
  return shots;
}

/** Minimal decoder for the 8-bit, non-interlaced RGB/RGBA PNGs Chromium writes: unfiltered pixel bytes. */
function decodePng(buffer) {
  let pos = 8, width = 0, height = 0, channels = 4;
  const idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const body = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('unsupported PNG');
      channels = { 2: 3, 6: 4 }[body[9]];
      if (!channels) throw new Error('unsupported PNG colour type');
    } else if (type === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const v = raw[y * (stride + 1) + 1 + i];
      const a = i >= channels ? data[y * stride + i - channels] : 0;
      const b = y ? data[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? data[(y - 1) * stride + i - channels] : 0;
      let out;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      data[y * stride + i] = out & 255;
    }
  }
  return { width, height, data };
}

function samePixels(x, y) {
  if (x.equals(y)) return 0;
  const p = decodePng(x), q = decodePng(y);
  if (p.width !== q.width || p.height !== q.height) return Infinity;
  let diff = 0;
  for (let i = 0; i < p.data.length; i++) if (p.data[i] !== q.data[i]) diff++;
  return diff;
}

/** `bases` / `news`: one or more captures of the old / new tree. A few anti-aliased edges are not bit-stable between two
 *  runs of the same tree, so a shot passes when some base capture and some new capture of it are identical. */
async function compare(bases, news) {
  const b = news[0];
  const names = readdirSync(bases[0]).filter((n) => n.endsWith('.png')).sort();
  const failures = [];
  let pixels = 0;
  let styles = 0;
  for (const name of names) {
    if (!existsSync(resolve(b, name))) { failures.push(`${name}: missing in ${b}`); continue; }
    const diffs = news.flatMap((n) => bases.map((a) => samePixels(readFileSync(resolve(a, name)), readFileSync(resolve(n, name)))));
    if (!diffs.includes(0)) { failures.push(`${name}: ${Math.min(...diffs)} channel values differ from the closest base capture`); continue; }
    pixels++;
    const dump = (dir) => JSON.parse(readFileSync(resolve(dir, name.replace(/png$/, 'json')), 'utf8'));
    const pairs = news.flatMap((n) => bases.map((a) => [dump(a), dump(n)]));
    const same = pairs.find(([sa, sb]) => sa.length === sb.length && sa.every((line, i) => line === sb[i]));
    if (!same) {
      const [sa, sb] = pairs[0];
      const bad = sa.length !== sb.length ? [`${sa.length} vs ${sb.length} elements`] : sa.filter((line, i) => line !== sb[i]).slice(0, 2);
      failures.push(`${name}: computed style differs: ${bad.join(' // ').slice(0, 400)}`);
    } else styles += same[0].length;
  }
  return { names: names.length, pixels, styles, failures };
}

let failed = 0;
if (mode === 'capture' && dirA) {
  const shots = await capture(resolve(dirA));
  console.log(`SUMMARY skin-pixels capture shots=${shots} durationMs=${Math.round(performance.now() - started)}`);
} else if (mode === 'compare' && dirA && dirB) {
  const { names, pixels, styles, failures } = await compare(dirA.split(',').map((d) => resolve(d)), dirB.split(',').map((d) => resolve(d)));
  for (const f of failures) console.error('FAIL ' + f);
  failed = failures.length;
  console.log(`SUMMARY skin-pixels compare shots=${names} identical=${pixels} elementsCompared=${styles} failed=${failed}`);
} else {
  console.error('usage: node e2e/skin-pixels.mjs capture <dir> | compare <dirA> <dirB>');
  failed = 1;
}
if (failed) process.exitCode = 1;

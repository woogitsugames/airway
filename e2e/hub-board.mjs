// [night-11ag] R4d: hub cause board (src/ui/hubBoard.ts over src/game/hubBoard.ts) in real Chromium, without the
// globe's frame rate (G7): on the menu page a real EndlessRun is stepped headlessly until an airport jams (no routes:
// a forced jam), the run's jam event opens the board as the session does, and the real HUD (boarding pass + tag dock)
// is mounted beside it. Checks per size: the board opens on the jam with one row per waiting region and the no-route
// sentence of the game-over report; a mixed board (8 regions: no route, left full, slot, none) and a curfew board stay
// inside the screen, off the pass and the dock (bottom in portrait, side rack in landscape), with no clipped text; the
// close target is ≥ 48 px and closes it; the step-in is short and off under "Reduce motion".
// `--shots` writes docs/shots/n11ag/hub-board-*.png.
// [night-21a] D-268: then in the real session on the DEV stub world (`?render=stub&clock=frozen`, D-254; only DOM
// geometry is read), landscape 915×412 and 640×360 and portrait 360×640 and 412×915: a run with a day of waiting
// passengers, the board opened by a long press on the fullest airport in view (the hit test's point). No shown note,
// slot tag or edge chip intersects the board ([night-46a] D-301: Linoryt's stamps are printed by the globe under the
// opaque board; they are only counted).
// `--shots` also writes docs/shots/n21a/hub-board-map-*-after.png (`--shots-tag=before` for the pre-D-268 frames).
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  withBrowser, newGamePage, waitForScreen, assert, saveDiagnostics, clickTestId, dragGesture, ROOT, SEED, RENDER, gameUrl, assertRender, shotsDir,
} from './browser.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
// [night-44a] `test:e2e:hub-board:stub` (--render=stub): the menu-page cases also run on the stub world (D-254; the board
// and the HUD are DOM) and their --shots go to .e2e/stub/n11ag/. The map cases are on the stub world either way.
const SHOT_DIR = shotsDir(resolve(ROOT, 'docs/shots/n11ag'));
const results = [];
/** The shots kept in docs/shots/n11ag (portrait 360×640, landscape phones, foldable). */
const SHOT_SET = { 'pl 360x640': ['jam', 'curfew'], 'en 360x640': ['mixed'], 'en 915x412': ['mixed'], 'pl 640x360': ['curfew'],
  'pl 673x841': ['mixed'] };
const CASES = [['pl', 360, 640], ['en', 360, 640], ['en', 915, 412], ['pl', 640, 360], ['pl', 673, 841]];
/** [night-21a] D-268: the board over the map in the real session (stub world), landscape and portrait. */
const MAP_CASES = [['pl', 915, 412], ['en', 640, 360], ['en', 360, 640], ['pl', 412, 915]];
const MAP_SHOT_DIR = resolve(ROOT, 'docs/shots/n21a');
const SHOT_TAG = process.argv.find((arg) => arg.startsWith('--shots-tag='))?.slice('--shots-tag='.length) ?? 'after';
/** The stub world with the frozen clock (D-254), whatever --render says: only DOM geometry is read here. */
const stubUrl = (url) => { const target = new URL(url); target.searchParams.set('render', 'stub'); target.searchParams.set('clock', 'frozen'); return target.href; };
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));

/** One real session: a route, a day of waiting passengers, the board opened on the fullest airport in view. */
async function mapCase(browser, url, language, width, height) {
  const { page, errors } = await newGamePage(browser, stubUrl(url), language, { width, height });
  try {
    assert(await page.evaluate(() => typeof window.__awStub === 'object' && window.__awStub !== null), 'stub world missing (?render=stub needs the Vite dev build)');
    await waitForScreen(page, 'menu');
    await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
    await clickTestId(page, 'menu-endless');
    await waitForScreen(page, 'game');
    await page.evaluate(() => document.fonts.ready);
    await dragGesture(page, await page.evaluate(() => window.aw.gesture('route')));
    await page.evaluate(() => window.aw.advanceTicks(1));
    await page.waitForFunction(() => window.aw.state().routeCount >= 1, null, { timeout: 5000 });
    await page.evaluate(() => window.aw.advanceTicks(1400));
    await settle(page);
    // The fullest airport the hit test sees, off the HUD bands (a long press there opens the board as a player's does).
    const target = await page.evaluate(() => {
      const airports = [...(window.aw.state().airports ?? [])].sort((a, b) => b.waiting / b.capacity - a.waiting / a.capacity);
      for (const airport of airports) {
        const at = window.__awStub.airportPoint(airport.id);
        if (at?.visible && at.x > 40 && at.x < innerWidth - 130 && at.y > 100 && at.y < innerHeight - 120) return { id: airport.id, ...at };
      }
      return null;
    });
    assert(target, 'no airport in view to long-press');
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    await page.getByTestId('hub-board').waitFor({ state: 'visible', timeout: 3000 });
    await settle(page);
    const m = await page.evaluate((at) => {
      const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      const board = box(document.querySelector('[data-testid="hub-board"]').getBoundingClientRect());
      const hits = (a) => a.l < board.r - .5 && board.l < a.r - .5 && a.t < board.b - .5 && board.t < a.b - .5;
      const shown = (el) => !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' &&
        Number(getComputedStyle(el).opacity) > 0;
      const items = [];
      for (const el of document.querySelectorAll('.airport-overlay .airport-bubble, .airport-overlay .airport-slot, .airport-overlay .airport-edge')) {
        if (shown(el)) items.push({ kind: el.className.split(' ')[0], text: el.textContent.trim().slice(0, 24), ...box(el.getBoundingClientRect()) });
      }
      // [night-46a] D-301: Linoryt's airport stamps are printed by the globe (WebGL) under the opaque board, so only the
      // DOM notes, slots and edge chips must clear it; the stamps are counted (the overlay's DEV probe).
      const stamps = (globalThis.__awLinoryt?.stamps() ?? []).filter((stamp) => stamp.visible && stamp.half > 0).length;
      return { board, items, hits: items.filter(hits), stamps };
    }, target);
    if (SHOTS) {
      mkdirSync(MAP_SHOT_DIR, { recursive: true });
      await page.screenshot({ path: resolve(MAP_SHOT_DIR, `hub-board-map-${language}-${width}x${height}-${SHOT_TAG}.png`) });
    }
    assert(m.items.length + m.stamps > 0, 'nothing of the map is drawn beside the board'); // [night-46a] stamps count
    assert(m.hits.length === 0, `on the board ${JSON.stringify(m.board)}: ${m.hits.map((h) => `${h.kind} "${h.text}" ${[h.l, h.t, h.r, h.b].map(Math.round)}`).join('; ')}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    return `${m.items.length} map marks beside the board, ${m.stamps} stamps on the globe`;
  } finally {
    await page.close().catch(() => {});
  }
}

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        await assertRender(page);
        await waitForScreen(page, 'menu');
        const m = await page.evaluate(async () => {
          const { EndlessRun } = await import('/src/game/run.ts');
          const { HubDepartureLog, boardOpensOnTap, HUB_BOARD_CAUSE_KEYS } = await import('/src/game/hubBoard.ts');
          const { mountHubBoard } = await import('/src/ui/hubBoard.ts');
          const { mountHud } = await import('/src/ui/hud/index.ts');
          const { t } = await import('/src/i18n/index.ts');
          await import('/src/ui/game.css');
          for (const el of document.querySelectorAll('#app > *:not(canvas)')) el.style.visibility = 'hidden';
          const host = document.createElement('div');
          host.className = 'airway-game-layer';
          host.style.zIndex = '99';
          document.body.append(host);
          const hud = mountHud(host, {});
          hud.render({ week: 1, day: 3, timeMinutes: 14 * 60 + 5, passengers: 128, paused: false, speed: 1, canUndo: true,
            selectedPlane: 'turboprop', stock: { turboprop: 1, widebody: 0, hub: 0 }, minutesToBoard: 900 });
          // [night-46a] D-301: the Linoryt sheets start under the top margin, whose bottom edge a ResizeObserver
          // publishes (--lin-pass-bottom) once the margin is laid out: let it run, as a frame does in the game.
          await document.fonts.ready;
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          let closed = 0;
          const board = mountHubBoard(host, { close: () => { closed++; board.show(null); } });
          document.documentElement.dataset.airwayMotion = 'full';

          const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const sentence = (row) => t(HUB_BOARD_CAUSE_KEYS[row.cause], { count: row.waiting, minutes: row.minutes, time: '06:00' });
          const read = (model) => {
            const sheet = document.querySelector('[data-testid="hub-board"]');
            const list = sheet.querySelector('.airway-hub-board__rows');
            const s = rect(sheet);
            const dock = [...document.querySelectorAll('.airway-dock__tag, .airway-dock')].map(rect);
            const pass = rect(document.querySelector('.airway-pass'));
            const rows = [...sheet.querySelectorAll('.airway-hub-board__row')];
            const texts = [...sheet.querySelectorAll('.airway-hub-board__text, .airway-hub-board__title, .airway-hub-board__fill, .airway-hub-board__count')];
            return {
              hidden: sheet.hidden, sheet: s, layout: sheet.dataset.layout,
              inside: s.left >= 0 && s.top >= 0 && s.right <= innerWidth && s.bottom <= innerHeight,
              dockOverlap: Math.max(0, ...dock.map((d) => overlap(s, d))), passOverlap: overlap(s, pass),
              close: rect(sheet.querySelector('[data-testid="hub-board-close"]')),
              closeLabel: sheet.querySelector('[data-testid="hub-board-close"]').getAttribute('aria-label'),
              rowCount: rows.length,
              rows: rows.map((row) => ({ region: row.dataset.region, cause: row.dataset.cause,
                marks: row.querySelectorAll('.airway-hub-board__mark').length,
                markCause: row.querySelector('.airway-hub-board__mark')?.dataset.cause,
                glyph: row.querySelector('[data-airway-destination]')?.dataset.airwayDestination,
                count: row.querySelector('.airway-hub-board__count').textContent,
                text: row.querySelector('.airway-hub-board__text').textContent })),
              expected: model.rows.map((row) => ({ region: row.region, cause: row.cause, count: String(row.waiting), text: sentence(row) })),
              clipped: texts.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
              hScroll: sheet.scrollWidth - sheet.clientWidth,
              listScroll: list.scrollHeight - list.clientHeight,
              animation: getComputedStyle(sheet).animationName, duration: getComputedStyle(sheet).animationDuration,
              focus: document.activeElement?.dataset.testid ?? null,
            };
          };
          const out = {};

          // 1. A forced jam in a real run: no routes, the clock runs until an airport's jam countdown starts.
          const run = EndlessRun.create(0xA1A1);
          const log = new HubDepartureLog();
          let opened = null;
          for (let tick = 0; tick < 20000 && !opened; tick++) {
            if (!run.step()) {
              const offer = run.weeklyUpgrade;
              const pick = offer?.offers.find((item) => item.id !== 'hub-expansion' && item.id !== 'departure-slots');
              if (!offer || !pick) break;
              run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
              continue;
            }
            const events = run.drainEvents();
            log.observe(run);
            const jam = events.find((event) => event.type === 'jam' && event.jammed);
            if (!jam) continue;
            const city = run.cityList().find((item) => item.id === jam.cityId);
            if (city && boardOpensOnTap(city.waiting.length, city.capacity)) {
              opened = log.board(run, jam.cityId);
              board.show({ ...opened, code: jam.cityId });
            }
          }
          out.jamId = opened?.cityId ?? null;
          out.jamWaiting = opened ? opened.waiting : 0;
          out.jamCapacity = opened ? opened.capacity : 0;
          out.jam = opened ? read(opened) : null;
          out.jamClass = document.querySelector('.airway-hub-board--jammed') !== null;
          out.openId = board.openId;

          // 2. Mixed causes on all eight regions (the most rows a board can have), from a fake read model.
          const REGIONS = ['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'];
          const city = (id, region, waiting = [], extra = {}) => ({ id, region, waiting, connecting: 0, capacity: 48,
            hub: true, jamTicksLeft: null, slotHeld: 0, nextSlotMinutes: 0, curfewClosed: false, lon: 0, lat: 0, ...extra });
          const waiting = REGIONS.flatMap((region, i) => Array(9 - i).fill(region)); // 44 waiting, 9…2 per region
          const fake = (minute, planes, extra = {}) => ({
            clockMinute: minute,
            cityList: () => [city('IST', 'ME', waiting, extra), city('NYC', 'NAM'), city('MAD', 'EUS'), city('CAI', 'ME'),
              city('DEL', 'ASI')],
            routeList: () => [{ id: 'r1', cityIds: ['IST', 'NYC'] }, { id: 'r2', cityIds: ['IST', 'MAD'] },
              { id: 'r3', cityIds: ['IST', 'CAI'] }, { id: 'r4', cityIds: ['IST', 'DEL'] }],
            planeList: () => planes,
          });
          const plane = (id, routeId, phase, load, slotWaitTicks = 0) => ({ id, routeId, type: 'widebody', segment: 0,
            progress01: 0, direction: 1, load, capacity: 20, phase, cityIndex: 0, slotWaitTicks });
          const mixed = new HubDepartureLog();
          mixed.observe(fake(600, [plane('a', 'r1', 'ground', 0), plane('b', 'r2', 'ground', 0)]));
          mixed.observe(fake(640, [plane('a', 'r1', 'flight', 20), plane('b', 'r2', 'ground', 0, 40)]));
          const mixedModel = mixed.board(fake(640, []), 'IST');
          board.show({ ...mixedModel, code: 'IST' });
          out.mixed = read(mixedModel);
          out.mixedCauses = [...new Set(mixedModel.rows.map((row) => row.cause))].sort();
          const curfewModel = mixed.board(fake(640, [], { curfewClosed: true }), 'IST');
          board.show({ ...curfewModel, code: 'IST' });
          out.curfew = read(curfewModel);
          board.show({ ...mixedModel, code: 'IST' });

          // 3. Close target and reduced motion.
          const before = closed;
          document.querySelector('[data-testid="hub-board-close"]').click();
          out.closedByButton = closed === before + 1 && document.querySelector('[data-testid="hub-board"]').hidden && board.openId === null;
          document.documentElement.dataset.airwayMotion = 'reduce';
          board.show({ ...mixedModel, code: 'IST' });
          out.reduced = getComputedStyle(document.querySelector('[data-testid="hub-board"]')).animationName;
          document.documentElement.dataset.airwayMotion = 'full';
          window.__hubBoardShot = (which) => {
            const model = which === 'jam' ? opened : which === 'curfew' ? curfewModel : mixedModel;
            board.show(null);
            board.show({ ...model, code: which === 'jam' ? opened.cityId : 'IST' });
            document.documentElement.dataset.airwayMotion = 'reduce';
          };
          return out;
        });
        assert(m.jamId, `${label}: no jam in the forced run`);
        assert(m.openId === m.jamId, `${label}: board open on ${m.openId}, not the jammed ${m.jamId}`);
        const checkBoard = (name, b, needAllRows) => {
          assert(b && !b.hidden, `${name}: board not open`);
          assert(b.inside, `${name}: board outside the screen ${JSON.stringify(b.sheet)}`);
          assert(b.dockOverlap === 0, `${name}: board over the tag dock (${Math.round(b.dockOverlap)} px²)`);
          assert(b.passOverlap === 0, `${name}: board over the boarding pass (${Math.round(b.passOverlap)} px²)`);
          assert(b.close.width >= 48 && b.close.height >= 48, `${name}: close target ${b.close.width}×${b.close.height}`);
          assert(b.closeLabel, `${name}: close target without a label`);
          assert(b.hScroll <= 0 && b.clipped.length === 0, `${name}: clipped text ${JSON.stringify(b.clipped)} / ${b.hScroll}px`);
          assert(b.rowCount === b.expected.length, `${name}: ${b.rowCount} rows for ${b.expected.length} regions`);
          b.rows.forEach((row, i) => {
            const want = b.expected[i];
            assert(row.region === want.region && row.glyph === want.region, `${name}: row ${i} region ${row.region}/${row.glyph} ≠ ${want.region}`);
            assert(row.marks === 1 && row.cause === want.cause && row.markCause === want.cause, `${name}: row ${i} mark ${row.markCause} ×${row.marks} ≠ ${want.cause}`);
            assert(row.count === want.count && row.text === want.text, `${name}: row ${i} "${row.count} ${row.text}" ≠ "${want.count} ${want.text}"`);
          });
          if (needAllRows) assert(b.listScroll <= 0, `${name}: rows need ${b.listScroll}px of scrolling`);
          assert(b.animation === 'airway-hub-board-in' && parseFloat(b.duration) <= 0.2, `${name}: step-in ${b.animation} ${b.duration}`);
        };
        const portrait = height > width;
        checkBoard('jam', m.jam, true);
        assert(m.jam.rows.every((row) => row.cause === 'no-route'), `${label}: forced jam rows are not all "no onward flight"`);
        assert(m.jamClass, `${label}: jammed board without the jam edge`);
        assert(m.jamWaiting >= m.jamCapacity * 0.7, `${label}: jam board opened below 70 % (${m.jamWaiting}/${m.jamCapacity})`);
        assert(m.jam.focus === 'hub-board-close', `${label}: focus not on the close target (${m.jam.focus})`);
        checkBoard('mixed', m.mixed, portrait);
        assert(m.mixed.rowCount === 8, `${label}: mixed board has ${m.mixed.rowCount} rows`);
        assert(JSON.stringify(m.mixedCauses) === JSON.stringify(['left-full', 'no-route', 'none', 'slot']), `${label}: mixed causes ${m.mixedCauses}`);
        checkBoard('curfew', m.curfew, portrait);
        assert(m.curfew.rows.some((row) => row.cause === 'curfew'), `${label}: no curfew row`);
        assert(m.closedByButton, `${label}: close target did not close the board`);
        assert(m.reduced === 'none', `${label}: reduce motion still animates (${m.reduced})`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        if (SHOTS) {
          mkdirSync(SHOT_DIR, { recursive: true });
          for (const which of SHOT_SET[`${language} ${width}x${height}`] ?? []) {
            await page.evaluate((name) => window.__hubBoardShot(name), which);
            await page.waitForTimeout(250);
            await page.screenshot({ path: resolve(SHOT_DIR, `hub-board-${which}-${language}-${width}x${height}.png`) });
          }
        }
        results.push({ label: `${label} (jam ${m.jamId} ${m.jamWaiting}/${m.jamCapacity}, ${m.jam.rowCount} rows; mixed 8 rows` +
          `${m.mixed.listScroll > 0 ? ', scrolls ' + m.mixed.listScroll + ' px' : ''}; layout ${m.jam.layout})`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `hub-board-${results.length + 1}`);
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] + (shot ? ` (${shot})` : '') });
      }
      await page.close();
    }
    for (const [language, width, height] of MAP_CASES) {
      const label = `map ${language} ${width}×${height}`;
      try {
        results.push({ label: `${label} (${await mapCase(browser, url, language, width, height)})`, status: 'PASS' });
      } catch (error) {
        results.push({ label, status: 'FAIL', why: String(error?.message ?? error).split('\n')[0] });
      }
    }
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
}
for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
if (fatal) console.error('FAIL harness: ' + fatal);
const passed = results.filter((item) => item.status === 'PASS').length;
const failedCount = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:hub-board seed=0xA1A1${RENDER === 'stub' ? ' render=stub' : ''} steps=${results.length} passed=${passed} failed=${failedCount} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length + MAP_CASES.length) process.exitCode = 1;

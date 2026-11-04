// [night-11ag] R4d: hub cause board (src/ui/hubBoard.ts over src/game/hubBoard.ts) in real Chromium, without the
// globe's frame rate (G7): on the menu page a real EndlessRun is stepped headlessly until an airport jams (no routes:
// a forced jam), the run's jam event opens the board as the session does, and the real HUD (boarding pass + tag dock)
// is mounted beside it. Checks per size: the board opens on the jam with one row per waiting region and the no-route
// sentence of the game-over report; a mixed board (8 regions: no route, left full, slot, none) and a curfew board stay
// inside the screen, off the pass and the dock (bottom in portrait, side rack in landscape), with no clipped text; the
// close target is ≥ 48 px and closes it; the step-in is short and off under "Reduce motion".
// `--shots` writes docs/shots/n11ag/hub-board-*.png.
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, waitForScreen, assert, saveDiagnostics, ROOT } from './browser.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = resolve(ROOT, 'docs/shots/n11ag');
const results = [];
/** The shots kept in docs/shots/n11ag (portrait 360×640, landscape phones, foldable). */
const SHOT_SET = { 'pl 360x640': ['jam', 'curfew'], 'en 360x640': ['mixed'], 'en 915x412': ['mixed'], 'pl 640x360': ['curfew'],
  'pl 673x841': ['mixed'] };
const CASES = [['pl', 360, 640], ['en', 360, 640], ['en', 915, 412], ['pl', 640, 360], ['pl', 673, 841]];

let fatal = null;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
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
  });
} catch (error) {
  fatal = String(error?.message ?? error).split('\n')[0];
}
for (const { label, status, why } of results) console[status === 'FAIL' ? 'error' : 'log'](`${status} ${label}${why ? ': ' + why : ''}`);
if (fatal) console.error('FAIL harness: ' + fatal);
const passed = results.filter((item) => item.status === 'PASS').length;
const failedCount = results.length - passed + (fatal ? 1 : 0);
console.log(`SUMMARY test:e2e:hub-board seed=0xA1A1 steps=${results.length} passed=${passed} failed=${failedCount} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

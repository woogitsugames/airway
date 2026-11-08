// [night-12bb] R2i, D-249: the announced demand surge on the airport's luggage tag and edge chip (src/ui/overlay.ts)
// in real Chromium, without a run: the overlay is built on the menu page with a fixed camera (like fill-trend), so the
// globe frame rate (G7) does not matter. Checks: the pennant stub sits right after the code plate (in Linoryt, after the
// code's fill and tick bar; night-46a) and inside the tag
// (no clipping), hollow pennant + "+12 14:00" while announced, filled pennant + "+12 to/do 20:00" while running (the
// state is told by shape and words, not colour), the tag aria names the surge (PL/EN), an off-screen airport's edge
// chip carries the same pennant and aria, null removes both, an invalid mark is refused. Writes one PNG per case to
// docs/shots/n12bb/ (inspected before committing).
import { performance } from 'node:perf_hooks';
import { mkdirSync } from 'node:fs';
// [night-44a] `test:e2e:surge-tag:stub` (--render=stub): the same overlay on the stub world's menu page (D-254); its
// PNGs go to .e2e/stub/n12bb/.
import { withBrowser, newGamePage, waitForScreen, assert, saveDiagnostics, gameUrl, assertRender, shotsDir, RENDER } from './browser.mjs';

const started = performance.now();
const results = [];
const CASES = [['en', 412, 915], ['pl', 915, 412]];
const TEXT = {
  en: { soon: '+12 14:00', active: '+12 to 20:00', soonAria: 'Passenger surge at FRA: 12 extra passengers from 14:00 local time.',
    activeAria: 'Passenger surge at FRA: 12 extra passengers until 20:00 local time.',
    edgeAria: 'Passenger surge at SYD: 12 extra passengers from 08:00 local time.' },
  pl: { soon: '+12 14:00', active: '+12 do 20:00', soonAria: 'Szczyt ruchu w FRA: 12 dodatkowych pasażerów od 14:00 czasu lokalnego.',
    activeAria: 'Szczyt ruchu w FRA: 12 dodatkowych pasażerów do 20:00 czasu lokalnego.',
    edgeAria: 'Szczyt ruchu w SYD: 12 dodatkowych pasażerów od 08:00 czasu lokalnego.' },
};
const SHOTS = shotsDir('docs/shots/n12bb');

let fatal = null;
try {
  mkdirSync(SHOTS, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const [language, width, height] of CASES) {
      const label = `${language} ${width}×${height}`;
      const { page, errors } = await newGamePage(browser, gameUrl(url), language, { width, height });
      try {
        await assertRender(page);
        await waitForScreen(page, 'menu');
        const m = await page.evaluate(async () => {
          const { createAirportOverlay } = await import('/src/ui/overlay.ts');
          const { PerspectiveCamera } = await import('/node_modules/three/build/three.module.js');
          const host = document.createElement('div');
          host.id = 'surge-host';
          host.style.cssText = 'position:fixed;inset:0;z-index:99;background:#e9e2d0';
          document.body.append(host);
          const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
          camera.position.set(0, 0, 3.2);
          camera.lookAt(0, 0, 0);
          const overlay = createAirportOverlay(host, camera, {});
          overlay.addAirport({ id: 'FRA', code: 'FRA', lon: 0, lat: 0 });
          overlay.addAirport({ id: 'MAD', code: 'MAD', lon: -14, lat: 10 });
          overlay.addAirport({ id: 'SYD', code: 'SYD', lon: 180, lat: -20 }); // behind the globe: edge chip
          for (const id of ['FRA', 'MAD', 'SYD']) overlay.setCapacity(id, 24);
          overlay.setPassengers('FRA', ['EUN', 'NAM', 'ASI']);
          overlay.setPassengers('MAD', ['AFR']);
          overlay.setPassengers('SYD', ['ASI', 'ASI']);
          const read = (id) => {
            overlay.update();
            const tag = host.querySelector(`.airport-bubble[data-airport="${id}"]`);
            const stub = tag.querySelector('.airport-bubble__surge');
            const r = tag.getBoundingClientRect();
            const s = stub?.getBoundingClientRect();
            const kids = [...tag.children];
            const path = stub?.querySelector('path');
            return {
              aria: tag.getAttribute('aria-label'), scroll: tag.scrollWidth - tag.clientWidth,
              text: stub?.querySelector('.airport-bubble__surge-text')?.textContent ?? null,
              phase: stub?.dataset.phase ?? null, fill: path?.getAttribute('fill') ?? null,
              // [night-23a] The note reads code, "14 of 24", then the stubs and the region groups. [night-46a] Linoryt
              // (D-301) prints the code (.lin-code) after the name, then the fill, its tick bar (an SVG) and line
              // breaks: only those parts may stand between the code plate and the pennant.
              afterPlate: stub ? (() => {
                const plateAt = kids.findIndex((kid) => kid.classList.contains('airport-bubble__plate') || kid.classList.contains('lin-code'));
                const between = kids.slice(plateAt + 1, kids.indexOf(stub));
                return plateAt >= 0 && plateAt < kids.indexOf(stub) && between.every((kid) => kid instanceof SVGElement ||
                  ['lin-fill', 'lin-br', 'lin-count', 'lin-more', 'airport-bubble__trend'].some((cls) => kid.classList.contains(cls)));
              })() : null,
              inside: s ? s.left >= r.left - 0.5 && s.right <= r.right + 0.5 && s.top >= r.top - 0.5 && s.bottom <= r.bottom + 0.5 : null,
              stubScroll: stub ? stub.scrollWidth - stub.clientWidth : null,
            };
          };
          const edge = (id) => {
            overlay.update();
            const button = [...host.querySelectorAll('.airport-edge')].find((el) => el.textContent.includes(id));
            const flag = button.querySelector('.airport-edge__surge');
            const b = button.getBoundingClientRect();
            const f = flag.getBoundingClientRect();
            return {
              visible: !button.hidden, aria: button.getAttribute('aria-label'), flag: !flag.hidden && f.width > 0,
              flagInside: f.left >= b.left && f.right <= b.right && f.top >= b.top && f.bottom <= b.bottom,
              fill: flag.querySelector('path')?.getAttribute('fill') ?? null,
            };
          };
          const out = {};
          out.plain = read('FRA');
          overlay.setSurge('FRA', { phase: 'announced', passengers: 12, time: '14:00' });
          out.soon = read('FRA');
          overlay.setSurge('SYD', { phase: 'announced', passengers: 12, time: '08:00' });
          out.edge = edge('SYD');
          overlay.setSurge('SYD', null);
          out.edgeCleared = edge('SYD');
          overlay.setSurge('MAD', { phase: 'active', passengers: 12, time: '20:00' });
          out.active = read('MAD');
          overlay.setSurge('FRA', { phase: 'active', passengers: 12, time: '20:00' });
          out.fraActive = read('FRA');
          let bad = null;
          try { overlay.setSurge('FRA', { phase: 'soon', passengers: 12, time: '14:00' }); } catch (error) { bad = error.name; }
          out.bad = bad;
          // For the screenshot: FRA announced, MAD running, SYD announced behind the globe (edge chip).
          overlay.setSurge('FRA', { phase: 'announced', passengers: 12, time: '14:00' });
          overlay.setSurge('SYD', { phase: 'announced', passengers: 12, time: '08:00' });
          overlay.update();
          return out;
        });
        const text = TEXT[language];
        assert(m.plain.text === null, `${label}: stub without a surge`);
        assert(m.soon.text === text.soon && m.soon.phase === 'announced', `${label}: announced text "${m.soon.text}"`);
        assert(m.soon.fill === 'none', `${label}: announced pennant is not hollow (${m.soon.fill})`);
        assert(m.soon.aria.startsWith(text.soonAria), `${label}: announced aria "${m.soon.aria}"`);
        assert(m.fraActive.text === text.active && m.fraActive.phase === 'active', `${label}: active text "${m.fraActive.text}"`);
        assert(m.fraActive.fill === 'currentColor', `${label}: running pennant is not filled (${m.fraActive.fill})`);
        assert(m.fraActive.aria.startsWith(text.activeAria), `${label}: active aria "${m.fraActive.aria}"`);
        for (const key of ['soon', 'active', 'fraActive']) {
          assert(m[key].afterPlate === true, `${label}: ${key} stub is not right after the code plate`);
          assert(m[key].inside === true, `${label}: ${key} stub outside its tag`);
          assert(m[key].scroll <= 0 && m[key].stubScroll <= 0, `${label}: ${key} clipped (${m[key].scroll}/${m[key].stubScroll} px)`);
        }
        assert(m.edge.visible && m.edge.flag && m.edge.flagInside, `${label}: edge chip pennant ${JSON.stringify(m.edge)}`);
        assert(m.edge.fill === 'none' && m.edge.aria.includes(text.edgeAria), `${label}: edge chip aria "${m.edge.aria}"`);
        assert(!m.edgeCleared.flag && !m.edgeCleared.aria.includes(text.edgeAria), `${label}: null keeps the edge pennant`);
        assert(m.bad === 'RangeError', `${label}: invalid mark accepted`);
        if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        await page.screenshot({ path: `${SHOTS}/surge-tag-${language}.png` });
        results.push({ label: `${label} (soon "${m.soon.text}", active "${m.fraActive.text}")`, status: 'PASS' });
      } catch (error) {
        const shot = await saveDiagnostics(page, `surge-tag-${results.length + 1}`);
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
console.log(`SUMMARY test:e2e:surge-tag seed=0xA1A1${RENDER === 'stub' ? ' render=stub' : ''} steps=${results.length} passed=${passed} failed=${failedCount} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failedCount || results.length !== CASES.length) process.exitCode = 1;

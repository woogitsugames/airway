// [night-10u] Airport tag overlay (src/ui/overlay.ts) with 40 airports in headless Chromium (Vite dev server):
// mean wall time per frame of `update()` plus forced style/layout, at 0, 5 and 40 passenger-tag changes per frame.
// Then a correctness check: every tag rebuilt by reusing its glyph nodes equals a tag built once from scratch.
// Orientation only (SwiftShader host CPU, never compare with devices). Fixed pattern, prints one SUMMARY line.
import { withBrowser, newGamePage, waitForScreen } from '../e2e/browser.mjs';

let failed = 0;
let result = null;
try {
  await withBrowser(async ({ browser, url }) => {
    const { page } = await newGamePage(browser, url, 'en', { width: 1280, height: 800 });
    await waitForScreen(page, 'menu');
    result = await page.evaluate(async () => {
      const { createAirportOverlay } = await import('/src/ui/overlay.ts');
      const { PerspectiveCamera } = await import('/node_modules/three/build/three.module.js');
      const R = ['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'];
      const make = () => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:99';
        document.body.append(host);
        const camera = new PerspectiveCamera(40, 1280 / 800, 0.1, 100);
        camera.position.set(0, 0, 3.2);
        camera.lookAt(0, 0, 0);
        const overlay = createAirportOverlay(host, camera, {});
        for (let i = 0; i < 40; i++) {
          overlay.addAirport({ id: 'C' + i, code: 'C' + i, lon: -50 + (i % 8) * 13, lat: -30 + Math.floor(i / 8) * 14, hub: i % 5 === 0 });
        }
        return { host, camera, overlay };
      };
      const live = make();
      const final = new Map();
      let k = 0;
      const change = () => {
        const i = k++ % 40;
        const n = (k * 7) % 12;
        const waiting = Array.from({ length: n }, (_, j) => R[(i + j + (k >> 3)) % 8]);
        const connecting = Math.min(n, k % 3);
        live.overlay.setPassengers('C' + i, waiting, connecting);
        if (k % 11 === 0) live.overlay.setCurfew('C' + i, k % 2 === 0);
        if (k % 13 === 0) live.overlay.setNew('C' + i, k % 2 === 1);
        final.set('C' + i, { waiting, connecting });
      };
      const run = (frames, changesPerFrame) => {
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) {
          for (let c = 0; c < changesPerFrame; c++) change();
          live.camera.position.x = Math.sin(f / 50) * 0.3;
          live.camera.lookAt(0, 0, 0);
          live.overlay.update();
          void live.host.getBoundingClientRect(); void document.body.offsetHeight; // style + layout
        }
        return (performance.now() - t0) / frames;
      };
      run(60, 5);
      const ms = { idle: run(300, 0), five: run(300, 5), all: run(300, 40) };
      // Reference: a fresh overlay given the final state of each tag once.
      const curfew = new Map();
      const fresh = new Map();
      const ref = make();
      const liveBubbles = [...live.host.querySelectorAll('.airport-bubble')];
      liveBubbles.forEach((bubble, i) => {
        curfew.set('C' + i, !!bubble.querySelector('.airport-bubble__curfew'));
        fresh.set('C' + i, bubble.classList.contains('airport-bubble--new'));
      });
      for (const [id, { waiting, connecting }] of final) {
        if (curfew.get(id)) ref.overlay.setCurfew(id, true);
        if (fresh.get(id)) ref.overlay.setNew(id, true);
        ref.overlay.setPassengers(id, waiting, connecting);
      }
      const refBubbles = [...ref.host.querySelectorAll('.airport-bubble')];
      const mismatched = liveBubbles.filter((bubble, i) => bubble.innerHTML !== refBubbles[i].innerHTML ||
        bubble.getAttribute('aria-label') !== refBubbles[i].getAttribute('aria-label')).length;
      return { ...ms, mismatched, tags: liveBubbles.length, dom: live.overlay.getPoolStats().domElements };
    });
  });
  console.log(`overlay 40 airports: ${result.idle.toFixed(2)} ms/frame idle, ${result.five.toFixed(2)} ms with 5 tag changes, ${result.all.toFixed(2)} ms with 40; DOM ${result.dom}`);
  if (result.tags !== 40) { failed++; console.error(`FAIL tags ${result.tags}`); }
  if (result.mismatched) { failed++; console.error(`FAIL ${result.mismatched} reused tags differ from a fresh build`); }
} catch (error) {
  failed++;
  console.error(`FAIL ${error?.message ?? error}`);
}
console.log(`SUMMARY perf:overlay seed=0xA1A1 airports=40 idleMs=${result?.idle.toFixed(2)} fiveMs=${result?.five.toFixed(2)} allMs=${result?.all.toFixed(2)} mismatched=${result?.mismatched} failed=${failed}`);
process.exitCode = failed ? 1 : 0;

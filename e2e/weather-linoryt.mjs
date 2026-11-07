// The real overlay's weather note in the DEV-only Linoryt preview (fixed projection; no WebGL).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, assert, saveDiagnostics, ARTIFACTS } from './browser.mjs';

const shots = resolve(ARTIFACTS, 'weather-linoryt');
mkdirSync(shots, { recursive: true });
let passed = 0, failed = 0;
try {
  await withBrowser(async ({ browser, url }) => {
    for (const language of ['pl', 'en']) {
      const { page, errors } = await newGamePage(browser, url + '?skin=linoryt&render=stub&clock=frozen', language);
      try {
        for (const phase of ['ahead', 'under']) {
          const note = await page.evaluate(async (phase) => {
            const { createAirportOverlay } = await import('/src/ui/overlay.ts');
            const { PerspectiveCamera } = await import('/node_modules/three/build/three.module.js');
            document.querySelectorAll('.weather-fixture').forEach((node) => node.remove());
            const host = document.createElement('div');
            host.className = 'weather-fixture';
            host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#e9e3cf';
            document.body.append(host);
            const camera = new PerspectiveCamera();
            const overlay = createAirportOverlay(host, camera, {
              project: (_lon, _lat, _alt, out) => Object.assign(out, { x: 150, y: 400, visible: true }),
            });
            overlay.addAirport({ id: 'WAW', code: 'WAW', name: 'Warszawa', lon: 21, lat: 52, hub: true });
            overlay.setCapacity('WAW', 24);
            overlay.setPassengers('WAW', ['EUN', 'NAM', 'EUN']);
            overlay.setFront('WAW', { phase, minutes: 15, time: '18:20' });
            overlay.update();
            const bubble = host.querySelector('.airport-bubble');
            const stub = host.querySelector('.airport-bubble__front');
            const style = getComputedStyle(stub);
            const rect = stub.getBoundingClientRect();
            const luminance = (rgb) => {
              const values = rgb.match(/\d+/g).slice(0, 3).map((v) => Number(v) / 255)
                .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
              return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
            };
            const a = luminance(style.color), b = luminance(style.backgroundColor);
            return { skin: document.documentElement.dataset.skin, text: stub.textContent.trim(),
              aria: bubble.getAttribute('aria-label'), hidden: bubble.hidden,
              contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
              box: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } };
          }, phase);
          assert(note.skin === 'linoryt' && !note.hidden && note.text.includes('≤15 min'), JSON.stringify(note));
          assert(note.aria.includes(language === 'pl' ? 'do 15 minut' : 'up to 15 minutes'), JSON.stringify(note));
          assert(note.contrast >= 4.5 && note.box.width > 0 && note.box.height > 0 && note.box.left >= 0 &&
            note.box.right <= 412 && note.box.top >= 0 && note.box.bottom <= 915, JSON.stringify(note));
          await page.screenshot({ path: resolve(shots, `${language}-${phase}.png`) });
          await page.locator('.weather-fixture .airport-bubble').screenshot({ path: resolve(shots, `${language}-${phase}-note.png`) });
          passed++;
          console.log(`PASS ${language} ${phase}: ${note.text} contrast=${note.contrast.toFixed(2)}`);
        }
        assert(errors.length === 0, errors.join('; '));
      } catch (error) {
        failed++;
        console.error(`FAIL ${language}: ${error.message}`);
        await saveDiagnostics(page, `weather-linoryt-${language}`);
      } finally { await page.close(); }
    }
  }, { softwareCompositing: true });
} catch (error) { failed++; console.error(`FAIL harness: ${error.message}`); }
console.log(`SUMMARY test:e2e:weather-linoryt seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed || passed !== 4) process.exitCode = 1;

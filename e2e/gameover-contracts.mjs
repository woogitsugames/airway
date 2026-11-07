import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, assert, ROOT } from './browser.mjs';
import { presetLanguage } from '../scripts/lib/harness.mjs';
const skin = process.argv.includes('--skin=linoryt') ? 'linoryt' : 'roza';
const shots = resolve(ROOT, '.e2e', 'gameover-contracts', skin);
let passed = 0, failed = 0;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(shots, { recursive: true });
    for (const language of ['pl', 'en']) for (const [width, height] of [[320,568],[360,640],[412,915],[915,412]]) for (const met of [0,2,4,12]) {
      const offered = met === 12 ? 24 : 4;
      const label = `${language} ${width}x${height} ${met}/${offered}`;
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce',
        locale: language === 'pl' ? 'pl-PL' : 'en-US' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await presetLanguage(page, language, { clear: true });
        await page.goto(url + '?preview=gameover' + (skin === 'linoryt' ? '&skin=linoryt' : ''), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.documentElement.dataset.skin) === skin, `expected ${skin} skin`);
        await page.evaluate(async ({ met, offered }) => {
          const { createGameOverController } = await import('/src/ui/gameover/index.ts');
          const host = document.querySelector('#app'); host.replaceChildren();
          const controller = createGameOverController({ host, pauseSimulation(){}, freezeScene(){}, restartSameWorld(){}, restartNewWorld(){}, returnToMenu(){}, reducedMotion: () => true,
            storage: { getItem: () => null, setItem(){} } });
          await controller.show({ seed: 41377, initialHash: 'fixture', hubId: 'LIS', hubCode: 'LIS', delivered: 1184, completedWeeks: 6, tip: true,
            contracts: { met, offered, marks: Array.from({ length: offered }, (_, i) => i < met) },
            milestones: { reached: ['first-hub','all-regions','week-2','week-3','week-4','passengers-500','passengers-750'], first: ['week-4','passengers-750'] },
            ledger: { waiting: 100, capacity: 100, waitingByRegion: { NAM: 62, EUN: 18, AFR: 20 }, seatsUnavailable: 28, congestedSeconds: 45 },
            departures: [{originHubId:'LIS',flightNumber:'AW 104',destinationCode:'JFK',gate:'A1'},{originHubId:'LIS',flightNumber:'AW 211',destinationCode:'ACC',gate:'B4'},{originHubId:'LIS',flightNumber:'AW 018',destinationCode:'CDG',gate:'C2'}] });
        }, { met, offered });
        const facts = await page.evaluate(() => {
          const r = document.querySelector('[data-testid="gameover-contracts"]');
          const m = document.querySelector('[data-testid="gameover-milestones"]');
          const a = document.querySelector('[data-testid="gameover-menu"]');
          const o = document.querySelector('.airway-go-overlay');
          const flightList = document.querySelector('.airway-go-flight-list');
          const flight = flightList.querySelector('.airway-go-flight');
          return { text:r?.textContent, label:r?.getAttribute('aria-label'), marks:[...r.querySelectorAll('[data-met]')].map(x=>x.dataset.met),
            top:r.getBoundingClientRect().top, mb:m.getBoundingClientRect().bottom, bottom:a.getBoundingClientRect().bottom,
            scroll:o.scrollTop, height:o.scrollHeight, client:o.clientHeight, width:o.scrollWidth, clientWidth:o.clientWidth,
            flightHeight:flight.getBoundingClientRect().height, flightListHeight:flightList.clientHeight };
        });
        assert(facts.text === (language === 'pl' ? `Kontrakty: ${met} z ${offered}` : `Contracts: ${met} of ${offered}`), JSON.stringify(facts));
        assert(facts.label === facts.text && facts.marks.filter(x=>x==='true').length === met && facts.marks.length === offered, JSON.stringify(facts));
        assert(facts.top >= facts.mb - 0.5 && facts.bottom <= height + 0.5 && facts.scroll === 0 && facts.height <= facts.client + 1 && facts.width <= facts.clientWidth + 1, JSON.stringify(facts));
        assert(facts.flightListHeight + 1 >= facts.flightHeight, 'a flight is clipped: ' + JSON.stringify(facts));
        if (offered === 24) {
          const marks = page.locator('[data-testid="gameover-contracts"] .airway-go-milestones-list');
          assert(await marks.getAttribute('role') === 'group' && await marks.getAttribute('aria-label') === facts.text, 'contract marks lack accessible summary');
          assert(await marks.getAttribute('tabindex') === '0', 'contract marks are not keyboard reachable');
          if (await marks.evaluate(el => el.scrollWidth > el.clientWidth)) {
            await marks.focus();
            for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
            assert(await marks.evaluate(el => el.scrollLeft > 0), 'contract marks cannot be scrolled by keyboard');
            const lastVisible = await marks.evaluate(el => { const last = el.lastElementChild.getBoundingClientRect(); const box = el.getBoundingClientRect(); return last.right <= box.right + 1; });
            assert(lastVisible, 'last contract mark cannot be reached');
          }
        }
        assert(!errors.length, errors.join('; '));
        if (met !== 12 && (width === 412 || width === 915)) await page.screenshot({ path: resolve(shots, `${language}-${width}x${height}-${met}.png`) });
        passed++; console.log(`PASS ${label}`);
      } catch(e) { failed++; console.error(`FAIL ${label}: ${e.message}`); }
      await page.close();
    }
  }, { softwareCompositing: true });
} catch(e) { failed++; console.error(`FAIL harness: ${e.message}`); }
console.log(`SUMMARY test:e2e:gameover-contracts seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed || passed !== 32) process.exitCode = 1;

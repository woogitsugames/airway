import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser, newGamePage, assert, ROOT } from './browser.mjs';
const shots = resolve(ROOT, 'docs/shots/gpt01');
let passed = 0, failed = 0;
try {
  await withBrowser(async ({ browser, url }) => {
    mkdirSync(shots, { recursive: true });
    for (const language of ['pl', 'en']) for (const [width, height] of [[320,568],[360,640],[412,915],[915,412]]) for (const met of [0,2,4]) {
      const label = `${language} ${width}x${height} ${met}/4`;
      const { page, errors } = await newGamePage(browser, url, language, { width, height });
      try {
        await page.goto(url + '?preview=gameover');
        await page.evaluate(async (met) => {
          const { createGameOverController } = await import('/src/ui/gameover/index.ts');
          const host = document.querySelector('#app'); host.replaceChildren();
          const controller = createGameOverController({ host, pauseSimulation(){}, freezeScene(){}, restartSameWorld(){}, restartNewWorld(){}, returnToMenu(){}, reducedMotion: () => true,
            storage: { getItem: () => null, setItem(){} } });
          await controller.show({ seed: 41377, initialHash: 'fixture', hubId: 'LIS', hubCode: 'LIS', delivered: 1184, completedWeeks: 6, tip: true,
            contracts: { met, offered: 4, marks: [0,1,2,3].map(i => i < met) },
            milestones: { reached: ['first-hub','all-regions','week-2','week-3','week-4','passengers-500','passengers-750'], first: ['week-4','passengers-750'] },
            ledger: { waiting: 100, capacity: 100, waitingByRegion: { NAM: 62, EUN: 18, AFR: 20 }, seatsUnavailable: 28, congestedSeconds: 45 },
            departures: [{originHubId:'LIS',flightNumber:'AW 104',destinationCode:'JFK',gate:'A1'},{originHubId:'LIS',flightNumber:'AW 211',destinationCode:'ACC',gate:'B4'},{originHubId:'LIS',flightNumber:'AW 018',destinationCode:'CDG',gate:'C2'}] });
        }, met);
        const facts = await page.evaluate(() => {
          const r = document.querySelector('[data-testid="gameover-contracts"]');
          const m = document.querySelector('[data-testid="gameover-milestones"]');
          const a = document.querySelector('[data-testid="gameover-menu"]');
          const o = document.querySelector('.airway-go-overlay');
          return { text:r?.textContent, label:r?.getAttribute('aria-label'), marks:[...r.querySelectorAll('[data-met]')].map(x=>x.dataset.met),
            top:r.getBoundingClientRect().top, mb:m.getBoundingClientRect().bottom, bottom:a.getBoundingClientRect().bottom,
            scroll:o.scrollTop, height:o.scrollHeight, client:o.clientHeight };
        });
        assert(facts.text === (language === 'pl' ? `Kontrakty: ${met} z 4` : `Contracts: ${met} of 4`), JSON.stringify(facts));
        assert(facts.label === facts.text && facts.marks.filter(x=>x==='true').length === met && facts.marks.length === 4, JSON.stringify(facts));
        assert(facts.top >= facts.mb - 0.5 && facts.bottom <= height + 0.5 && facts.scroll === 0 && facts.height <= facts.client + 1, JSON.stringify(facts));
        assert(!errors.length, errors.join('; '));
        if (width === 412 || width === 915) await page.screenshot({ path: resolve(shots, `${language}-${width}x${height}-${met}.png`) });
        passed++; console.log(`PASS ${label}`);
      } catch(e) { failed++; console.error(`FAIL ${label}: ${e.message}`); }
      await page.close();
    }
  }, { softwareCompositing: true });
} catch(e) { failed++; console.error(`FAIL harness: ${e.message}`); }
console.log(`SUMMARY test:e2e:gameover-contracts seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed || passed !== 24) process.exitCode = 1;

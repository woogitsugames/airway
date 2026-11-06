// [night-20a] N7: Róża at large text (D-248 steps 130/150 %) on the real renderer. For each size and language the DEV
// store-shot fixtures (src/main.ts `?storeShot=`, seed 0xA1A1) are loaded with the text step preset in the settings:
// `game` (the dense Levant cluster), then the pause sheet over it, then the hub board of the busiest hub (a tap on its
// rose); `upgrade` (the weekly crates) and `failure` (the game-over report). Every frame is audited in the page:
// text outside the screen, notes over rings / other notes / dock targets, the pause sheet over the dock arc, visible
// targets under 48 px. Settings needs no globe and comes from the stub screen fixture (e2e/screen-fixtures.mjs).
//   node scripts/shots-n20a.mjs <outDir> [--scales=150] [--sizes=360x640,412x915] [--langs=pl] [--scenes=game,upgrade]
// Prints one line per frame and writes <outDir>/audit.json. Not a CI suite: SwiftShader makes each scene ~30–60 s (G7).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withBrowser } from '../e2e/browser.mjs';
import { SEED, presetLanguage } from './lib/harness.mjs';
import { mountScreen } from '../e2e/screen-fixtures.mjs';

const args = process.argv.slice(2);
const outDir = resolve(args.find((arg) => !arg.startsWith('--')) ?? '.e2e/n20a');
const opt = (name, fallback) => (args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback).split(',');
const SCALES = opt('scales', '150').map(Number);
const SIZES = opt('sizes', '360x640,412x915,915x412,768x1024').map((s) => s.split('x').map(Number));
const LANGS = opt('langs', 'pl,en');
const SCENES = opt('scenes', 'game,upgrade,failure,settings');

/** In-page audit of the current frame; returns a list of problems (strings). */
function audit(page, frame) {
  return page.evaluate((frame) => {
    const problems = [];
    const W = innerWidth, H = innerHeight;
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('[hidden], [aria-hidden="true"] .split-flap');
    };
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const meet = (a, b, pad = 0) => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
    const name = (el) => '.' + String(el.className?.baseVal ?? el.className).trim().split(/\s+/)[0] + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    // 1. Text off the screen (any element whose own text node is visible).
    const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || seen.has(el) || !visible(el) || el.closest('.split-flap, option, select, svg, .airport-overlay')) continue;
      seen.add(el);
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        let scroller = el.parentElement;
        while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        const vertical = !scroller && (r.top < -0.5 || r.bottom > H + 0.5);
        if (r.left < -0.5 || r.right > W + 0.5 || vertical) {
          problems.push(`text off screen: ${name(el)} ${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)}`);
          break;
        }
      }
      // Clipped by its own box (ellipsis or overflow hidden).
      const s = getComputedStyle(el);
      if ((s.overflow === 'hidden' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) problems.push(`text clipped: ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }
    // 2. Targets under 48 px (visible buttons of the game layer).
    for (const el of document.querySelectorAll('.airway-game-layer button, .airway-game-layer [role="button"], .airway-settings button, .airway-settings select')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) problems.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${name(el)}`);
    }
    // 3. The Róża overlay: notes against rings, other notes and the dock.
    const roses = [...document.querySelectorAll('svg.roza-rose')].filter((el) => el.style.display !== 'none').map((el) => {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform);
      const span = Number(el.getAttribute('width')) / 2;
      return m ? { x: Number(m[1]), y: Number(m[2]), r: span - 46 + 9 } : null;
    }).filter(Boolean);
    const notes = [...document.querySelectorAll('.airport-bubble')].filter(visible).map((el) => ({ el, b: box(el), id: el.dataset.airport }));
    const dock = [...document.querySelectorAll('.airway-dock__tag, .roza-dial')].filter(visible).map(box);
    const captions = [...document.querySelectorAll('.roza-caption')].filter(visible).map((el) => ({ el, b: box(el) }));
    for (const n of notes) {
      for (const rose of roses) {
        const cx = Math.max(n.b.l, Math.min(rose.x, n.b.r)), cy = Math.max(n.b.t, Math.min(rose.y, n.b.b));
        if (Math.hypot(cx - rose.x, cy - rose.y) < rose.r - 2) { problems.push(`note ${n.id} over a ring at ${Math.round(rose.x)},${Math.round(rose.y)}`); break; }
      }
      for (const m of notes) if (m !== n && m.el.compareDocumentPosition(n.el) & Node.DOCUMENT_POSITION_FOLLOWING && meet(n.b, m.b)) problems.push(`notes ${n.id} and ${m.id} overlap`);
      for (const d of dock) if (meet(n.b, d)) { problems.push(`note ${n.id} over the dock`); break; }
      if (n.b.l < 0 || n.b.t < 0 || n.b.r > W || n.b.b > H) problems.push(`note ${n.id} off screen`);
    }
    // 4. Dock captions over the dial or another caption; the pause sheet over the dock arc (targets, captions, dial).
    const dial = document.querySelector('.roza-dial');
    for (const c of captions) {
      if (dial && visible(dial) && meet(c.b, box(dial), -1)) problems.push(`caption ${name(c.el)} over the dial`);
      for (const o of captions) if (o !== c && o.el.compareDocumentPosition(c.el) & Node.DOCUMENT_POSITION_FOLLOWING && meet(c.b, o.b)) problems.push(`captions ${name(c.el)} / ${name(o.el)} overlap`);
    }
    for (const sel of ['.airway-pause', '.airway-hub-board', '.airway-upgrade-tag', '.airway-go-content']) {
      for (const sheet of document.querySelectorAll(sel)) {
        if (!visible(sheet)) continue;
        const s = box(sheet);
        // Inside a scrolling sheet a part below the edge can be scrolled to; one above the scroll origin cannot.
        let scroller = sheet.parentElement;
        while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        const origin = scroller ? scroller.getBoundingClientRect().top - scroller.scrollTop : 0;
        if (s.t < origin - 0.5 || (!scroller && s.b > H + 0.5) || s.l < -0.5 || s.r > W + 0.5) problems.push(`${sel} off screen ${Math.round(s.t)}..${Math.round(s.b)}`);
        const pass = document.querySelector('.roza-pass');
        if (sel === '.airway-go-content' && pass && meet(s, box(pass))) problems.push(`${sel} covers the week line`);
        if (sel === '.airway-go-content') {
          for (const b of sheet.querySelectorAll('.airway-go-button')) {
            const r = box(b);
            if (r.b > H + 0.5 || r.t < 0) problems.push(`game-over action "${b.textContent}" off screen`);
          }
        }
        if (sel === '.airway-pause' || sel === '.airway-hub-board') {
          for (const d of [...dock, ...captions.map((c) => c.b)]) if (meet(s, d)) { problems.push(`${sel} covers the dock arc (${Math.round(s.b)} > ${Math.round(d.t)})`); break; }
          const pass = document.querySelector('.roza-pass');
          if (pass && meet(s, box(pass))) problems.push(`${sel} covers the week line`);
        }
        if (sheet.scrollHeight > sheet.clientHeight + 1 && getComputedStyle(sheet).overflowY === 'hidden') problems.push(`${sel} content cut ${sheet.scrollHeight}>${sheet.clientHeight}`);
      }
    }
    return { problems, notes: notes.length, roses: roses.length, frame };
  }, frame);
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(400);
}

const results = [];
mkdirSync(outDir, { recursive: true });
await withBrowser(async ({ browser, url }) => {
  for (const scale of SCALES) for (const [width, height] of SIZES) for (const lang of LANGS) for (const scene of SCENES) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: false, reducedMotion: 'reduce',
      locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tag = `${width}x${height}-${lang}-${scale}`;
    const shoot = async (frame) => {
      await settle(page);
      const file = resolve(outDir, `${frame}-${tag}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      const result = await audit(page, frame);
      results.push({ tag, ...result });
      console.log(`${result.problems.length ? 'ISSUE' : 'OK   '} ${frame} ${tag} (${result.notes} notes, ${result.roses} roses)` +
        (result.problems.length ? '\n      ' + [...new Set(result.problems)].join('\n      ') : ''));
    };
    try {
      await presetLanguage(page, lang, { clear: true });
      await page.addInitScript((textScale) => {
        try {
          const value = JSON.parse(localStorage.getItem('airway.settings') || '{}');
          localStorage.setItem('airway.settings', JSON.stringify({ ...value, textScale }));
        } catch { /* private mode */ }
      }, scale);
      if (scene === 'settings') {
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await mountScreen(page, 'settings', lang, { pseudo: false, textScale: scale });
        await shoot('settings');
        continue;
      }
      const target = new URL(url);
      target.searchParams.set('storeShot', scene);
      target.searchParams.set('seed', String(SEED));
      target.searchParams.set('lang', lang);
      await page.goto(target.href, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction((id) => document.documentElement.dataset.storeShotReady === id, scene, { timeout: 300000 });
      const step = await page.evaluate(() => document.documentElement.dataset.airwayTextScale ?? getComputedStyle(document.documentElement).getPropertyValue('--airway-text-scale'));
      if (String(step).trim() !== String(scale) && String(step).trim() !== String(scale / 100)) throw new Error(`text step ${step}, not ${scale}`);
      await shoot(scene === 'failure' ? 'gameover' : scene);
      if (scene !== 'game') continue;
      await page.click('.airway-pass__pause');
      await shoot('pause');
      await page.click('.airway-pause__button--primary');
      await page.waitForTimeout(300);
      // The hub board: tap the busiest hub's rose (the largest ring in view, as the player would).
      const hub = await page.evaluate(() => {
        const roses = [...document.querySelectorAll('svg.roza-rose')].filter((el) => el.style.display !== 'none').map((el) => {
          const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform);
          return m ? { x: Number(m[1]), y: Number(m[2]), r: Number(el.getAttribute('width')) } : null;
        }).filter(Boolean).filter((r) => r.x > 20 && r.y > 80 && r.x < innerWidth - 20 && r.y < innerHeight - 200);
        roses.sort((a, b) => b.r - a.r);
        return roses[0] ?? null;
      });
      if (hub) {
        // A long press opens the board of any airport (a tap only of one at least 70 % full).
        await page.mouse.move(hub.x, hub.y);
        await page.mouse.down();
        await page.waitForTimeout(900);
        await page.mouse.up();
        await page.waitForTimeout(300);
        if (await page.locator('.airway-hub-board:not([hidden])').count()) await shoot('hubboard');
        else console.log(`----- hubboard ${tag}: tap at ${Math.round(hub.x)},${Math.round(hub.y)} opened no board`);
      }
    } catch (error) {
      console.log(`FAIL  ${scene} ${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
      results.push({ tag, frame: scene, problems: ['harness: ' + String(error?.message ?? error).split('\n')[0]] });
    } finally {
      if (errors.length) console.log(`      page errors: ${errors.join('; ')}`);
      await page.close();
    }
  }
});
writeFileSync(resolve(outDir, 'audit.json'), JSON.stringify(results, null, 1) + '\n');
const issues = results.filter((r) => r.problems.length).length;
console.log(`SUMMARY shots-n20a frames=${results.length} withIssues=${issues}`);

// [task-13] Deterministic Playwright touch-target, safe-area and rotation regression.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// [task-37] --text-only runs just the text-break section (fast local loop).
const TEXT_ONLY = process.argv.includes('--text-only');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/shots/13');
const sizes = [
  { w: 412, h: 915, label: 'portrait-412x915' },
  { w: 915, h: 412, label: 'landscape-915x412' },
  { w: 673, h: 841, label: 'foldable-673x841' },
  { w: 904, h: 1000, label: 'foldable-904x1000' },
];
const state = Object.freeze({
  week: 3, day: 3, timeMinutes: 10 * 60 + 42, passengers: 1284,
  paused: false, speed: 1, canUndo: true, selectedPlane: 'turboprop',
  stock: { turboprop: 2, widebody: 1, hub: 0 },
});
const require = createRequire(import.meta.url);
// [task-35] Upgrade board fixtures: the mockup's three crates, plus the "+2 slots" variant (task 32).
const UPGRADE_OUT = resolve(ROOT, 'docs/shots/35');
const UPGRADE_HUBS = [
  { hubId: 'LON', waiting: 11, capacity: 12, label: 'LON' },
  { hubId: 'PAR', waiting: 4, capacity: 30, label: 'PAR' },
];
const UPGRADE_VARIANTS = [
  { suffix: '', offers: ['turboprop', 'widebody', 'hub-expansion'], shot: true },
  { suffix: '-slots', offers: ['widebody', 'departure-slots', 'hub-expansion'], shot: true },
];
async function mountUpgrade(page, language, variant) {
  await page.evaluate(async ({ language, offers, hubs }) => {
    // Bare 'three' does not resolve in page scripts: reuse the exact pre-bundled URL modelPreview.ts imports.
    const threeUrl = (await (await fetch('/src/render/modelPreview.ts')).text()).match(/from\s+["']([^"']*three[^"']*)["']/)?.[1];
    if (!threeUrl) throw new Error('three.js module URL not found');
    const [{ WeeklyUpgradeView }, { setLanguage }, THREE, { createModelPreviewRenderer }] = await Promise.all([
      import('/src/ui/upgrade/index.ts'), import('/src/i18n/index.ts'), import(threeUrl), import('/src/render/modelPreview.ts')]);
    setLanguage(language);
    document.querySelector('.test-upgrade-host')?.remove();
    const host = document.createElement('div');
    host.className = 'test-upgrade-host';
    document.body.append(host);
    window.__previewRenderer ??= createModelPreviewRenderer(new THREE.WebGLRenderer({ alpha: true }));
    window.__upgradeEvents = [];
    window.__upgradeState = { week: 7, paused: true, pendingHub: false, offers: offers.map((id) => ({ id, week: 7 })) };
    window.__upgradeHubs = hubs;
    const pending = [];
    window.__upgradeView = new WeeklyUpgradeView(host, {
      onCommand: (command) => window.__upgradeEvents.push(command.upgrade),
      onCancelPick: (week) => window.__upgradeEvents.push(`cancel:${week}`), // [task-39]
      onPreviewModel: (container, kind) => pending.push([container, kind]),
    });
    window.__upgradeView.render(window.__upgradeState, hubs);
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(done));
    // Same path as src/game/session.ts: measure the window, render the model into a 2D canvas.
    for (const [container, kind] of pending) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(container.clientWidth * devicePixelRatio);
      canvas.height = Math.round(container.clientHeight * devicePixelRatio);
      container.append(canvas);
      if (window.__previewRenderer.draw(kind, canvas)) container.classList.add('has-model');
    }
  }, { language, offers: variant.offers, hubs: UPGRADE_HUBS });
}
async function upgradeGeometry(page) {
  return page.evaluate(() => {
    const violations = [];
    const box = (el) => el.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.airway-upgrade-tag')];
    const sign = document.querySelector('.airway-upgrade-sign');
    const rects = [sign, ...cards].map(box);
    rects.forEach((r, i) => {
      if (i > 0 && (r.width < 48 || r.height < 48)) violations.push(`label ${i}: ${r.width}x${r.height}`);
      if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) violations.push(`${i ? 'label ' + i : 'sign'} outside viewport`);
      for (let j = 0; j < i; j++) {
        const o = rects[j];
        if (Math.min(r.right, o.right) - Math.max(r.left, o.left) > 1 && Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top) > 1) violations.push(`${i} overlaps ${j}`);
      }
    });
    for (const el of document.querySelectorAll('.airway-upgrade-week, .airway-upgrade-sub, .airway-upgrade-code, .airway-upgrade-title, .airway-upgrade-key, .airway-upgrade-value, .airway-upgrade-stamp')) {
      if (el.scrollWidth > el.clientWidth + 1) violations.push(`clipped "${el.textContent}"`);
      const r = box(el), card = el.closest('.airway-upgrade-tag, .airway-upgrade-sign');
      const c = card ? box(card) : null;
      if (c && (r.right > c.right + 1 || r.bottom > c.bottom - 6)) violations.push(`"${el.textContent}" leaves its label`);
    }
    const windows = [...document.querySelectorAll('.airway-upgrade-model')];
    const text = (kind) => document.querySelector(`[data-upgrade="${kind}"]`)?.textContent ?? '';
    const digits = (value) => value.replace(/[^0-9]/g, '');
    const tp = text('turboprop'), wb = text('widebody');
    return {
      violations, cards: cards.length,
      minWindow: Math.round(Math.min(...windows.map((w) => Math.min(box(w).width, box(w).height)))),
      models: windows.filter((w) => w.classList.contains('has-model') && w.querySelector('canvas')).length,
      stamps: [...document.querySelectorAll('.airway-upgrade-stamp')].map((s) => s.closest('.airway-upgrade-tag')?.dataset.upgrade),
      facts: (!tp || (digits(tp).includes('2500') && tp.includes('48'))) && (!wb || (digits(wb).includes('11000') && wb.includes('300'))),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}
// [task-37] Text-break regression: menu, upgrade labels and game over at phone, foldable and landscape sizes.
const TEXT_SIZES = [
  { w: 360, h: 800, label: 'portrait-360x800' },
  { w: 412, h: 915, label: 'portrait-412x915' },
  { w: 673, h: 841, label: 'foldable-673x841' },
  { w: 904, h: 1000, label: 'foldable-904x1000' },
  { w: 915, h: 412, label: 'landscape-915x412' },
  { w: 800, h: 360, label: 'landscape-800x360' },
];
/** Every visible word that wraps between two characters must end its first line with a hyphen
 *  (a hyphen, soft hyphen or slash); a bare mid-word break ("Szerokokadłubowie / c") is a failure. */
async function midWordBreaks(page, selector) {
  return page.evaluate((selector) => {
    const breaks = [];
    const allowed = new Set(['-', '­', '‐', '/']);
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const owner = node.parentElement;
        if (!owner || !owner.getClientRects().length || getComputedStyle(owner).visibility === 'hidden') continue;
        for (const match of node.data.matchAll(/\S+/g)) {
          let previous = null;
          for (let i = 0; i < match[0].length; i++) {
            const range = document.createRange();
            range.setStart(node, match.index + i);
            range.setEnd(node, match.index + i + 1);
            const rect = range.getClientRects()[0];
            if (!rect || rect.height === 0) continue;
            if (previous && Math.abs(rect.top + rect.height / 2 - previous.mid) > previous.height / 2
              && !allowed.has(previous.char)) {
              breaks.push(`"${match[0].replace(/­/g, '')}" breaks after "${match[0].slice(0, i).replace(/­/g, '')}"`);
              break;
            }
            previous = { mid: rect.top + rect.height / 2, height: rect.height, char: match[0][i] };
          }
        }
      }
    }
    return breaks;
  }, selector);
}
/** Horizontal gap between the visible ink boxes of two header labels (text ranges, not grid cells). */
async function headerGaps(page, selector) {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)].map((header) => {
    const boxes = [...header.children].map((child) => {
      const range = document.createRange();
      range.selectNodeContents(child);
      return range.getBoundingClientRect();
    });
    return boxes.slice(1).map((box, i) => ({ left: header.children[i].textContent, right: header.children[i + 1].textContent,
      gap: Math.round((box.left - boxes[i].right) * 10) / 10 }));
  }).flat(), selector);
}
/** The middle dot (" · ") must have equal space on both sides and a real advance (Overpass ships it with 0). */
async function middleDots(page, selector) {
  return page.evaluate((selector) => {
    const uneven = [];
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.getClientRects().length) continue;
        for (const match of node.data.matchAll(/\S · \S/g)) {
          const box = (from, to) => { const r = document.createRange(); r.setStart(node, match.index + from); r.setEnd(node, match.index + to); return r.getBoundingClientRect(); };
          // Ink edges approximated by advance boxes: char before, dot, char after.
          const before = box(0, 1), dot = box(2, 3), after = box(4, 5);
          const size = parseFloat(getComputedStyle(node.parentElement).fontSize);
          const left = dot.left - before.right, right = after.left - dot.right;
          if (dot.width < size * 0.15 || Math.abs(left - right) > Math.max(1.5, size * 0.08)) {
            uneven.push(`"${node.data.trim()}" dot ${dot.width.toFixed(1)}px, gaps ${left.toFixed(1)}/${right.toFixed(1)}`);
          }
        }
      }
    }
    return uneven;
  }, selector);
}
let server;
let browser;
let passed = 0;
let failed = 0;
let shots = 0;

async function port() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise((done) => probe.close(done));
  return address.port;
}
async function ready(p) {
  const url = `http://127.0.0.1:${p}/`;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite exited early');
    try { if ((await fetch(url)).ok) return url; } catch { /* Starting. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error('Vite startup timed out');
}
function check(ok, message) {
  if (!ok) { failed++; console.error('FAIL ' + message); }
  else { passed++; console.log('PASS ' + message); }
}
async function geometry(page) {
  return page.evaluate(() => {
    const safe = { top: 24, right: 16, bottom: 22, left: 16 };
    const controls = [...document.querySelectorAll('.airway-hud button')].map((button) => {
      const r = button.getBoundingClientRect();
      return { id: button.dataset.hudAction, x: r.left, y: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    });
    const violations = [];
    for (const c of controls) {
      if (c.width < 48 || c.height < 48) violations.push(`${c.id}: ${c.width}x${c.height}`);
      if (c.x < safe.left - 1 || c.y < safe.top - 1 || c.right > innerWidth - safe.right + 1 || c.bottom > innerHeight - safe.bottom + 1) violations.push(`${c.id}: unsafe area`);
    }
    for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
      const x = controls[a], y = controls[b];
      if (Math.min(x.right, y.right) - Math.max(x.x, y.x) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y) > 1) violations.push(`${x.id} overlaps ${y.id}`);
    }
    return { violations, count: controls.length, layout: document.querySelector('.airway-hud')?.dataset.layout,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      controls };
  });
}

try {
  const { chromium } = require('playwright');
  const p = await port();
  server = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(p), '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
  const url = await ready(p);
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync(OUT, { recursive: true });
  for (const view of TEXT_ONLY ? [] : sizes) {
    const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(async (snapshot) => {
        const [{ mountHud }, { setLanguage }] = await Promise.all([import('/src/ui/hud/index.ts'), import('/src/i18n/index.ts')]);
        setLanguage('pl');
        const host = document.getElementById('app');
        if (!host) throw new Error('Missing game surface');
        const marker = document.createElement('div');
        marker.dataset.routeId = 'test-route-11';
        marker.style.cssText = 'position:absolute;left:40%;top:48%;width:120px;height:48px;pointer-events:auto';
        host.appendChild(marker);
        window.__hudEvents = [];
        window.__hud = mountHud(host, {
          onUndo: () => window.__hudEvents.push('undo'),
          onTogglePause: () => window.__hudEvents.push('pause'),
          onCycleSpeed: () => window.__hudEvents.push('speed'),
          onSelectPlane: (type) => window.__hudEvents.push('select:' + type),
          onUpgradeHub: () => window.__hudEvents.push('hub'),
          onAssignPlane: (type, id) => window.__hudEvents.push('assign:' + type + ':' + id),
        });
        // Synthetic safe-area values validate offsets even outside a notched iOS device.
        for (const [side, amount] of Object.entries({ top: 24, right: 16, bottom: 22, left: 16 })) {
          window.__hud.element.style.setProperty('--hud-safe-' + side, amount + 'px');
        }
        window.__hud.render(snapshot);
        await document.fonts.ready;
      }, state);
      await page.waitForFunction(() => document.querySelector('.airway-hud')?.dataset.layout !== undefined);
      const bounds = await geometry(page);
      check(bounds.count === 6, `${view.label}: six accessible controls`);
      check(bounds.violations.length === 0, `${view.label}: ≥48px targets, no overlap or safe-area violations (${bounds.violations.join(', ')})`);
      check(!bounds.horizontalOverflow, `${view.label}: no horizontal overflow`);
      check(bounds.layout === (view.w >= 600 && view.h >= 600 ? 'foldable' : view.w > view.h ? 'landscape' : 'portrait'), `${view.label}: responsive layout`);
      check(pageErrors.length === 0, `${view.label}: no page errors (${pageErrors.join('; ')})`);
      const file = resolve(OUT, `${view.label}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      shots++;
      if (view.label === 'portrait-412x915') {
        await page.getByRole('button', { name: /Pauza|Pause/ }).click();
        check(await page.evaluate(() => window.__hudEvents.includes('pause')), 'pause callback');
        const plane = page.locator('[data-hud-action="turboprop"]');
        const start = await plane.boundingBox();
        const target = await page.locator('[data-route-id="test-route-11"]').boundingBox();
        if (!start || !target) throw new Error('Missing drag rectangles');
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
        await page.mouse.up();
        check(await page.evaluate(() => window.__hudEvents.includes('assign:turboprop:test-route-11')), 'aircraft drag emits AssignPlane intent');
        const stable = await page.evaluate((snapshot) => {
          const old = [...document.querySelectorAll('.airway-hud button')];
          window.__hud.render(snapshot);
          return old.every((button, index) => button === document.querySelectorAll('.airway-hud button')[index]);
        }, state);
        check(stable, 'render reuses existing controls');
        await page.evaluate((snapshot) => window.__hud.render({ ...snapshot, stock: { ...snapshot.stock, turboprop: 0 } }), state);
        check(await page.locator('[data-hud-action="turboprop"]').isDisabled(), 'depleted aircraft is disabled');
        await page.evaluate((snapshot) => window.__hud.render(snapshot), state);
        await page.setViewportSize({ width: 915, height: 412 });
        await page.waitForFunction(() => document.querySelector('.airway-hud')?.dataset.layout === 'landscape');
        const rotated = await geometry(page);
        check(rotated.violations.length === 0 && !rotated.horizontalOverflow, 'live orientation change keeps targets and safe areas');
      }
    } finally { await page.close(); }
  }
  // [task-35] Weekly upgrade board (cargo labels) on the same four sizes, PL + EN, with real 3D model windows.
  mkdirSync(UPGRADE_OUT, { recursive: true });
  for (const language of TEXT_ONLY ? [] : ['pl', 'en']) {
    for (const view of sizes) {
      const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        const tag = `upgrade ${language} ${view.label}`;
        for (const variant of UPGRADE_VARIANTS) {
          if (variant.portraitOnly && view.label !== 'portrait-412x915') continue;
          await mountUpgrade(page, language, variant);
          const board = await upgradeGeometry(page);
          const name = `${tag}${variant.suffix}`;
          check(board.cards === 3, `${name}: three cargo labels`);
          check(board.violations.length === 0, `${name}: ≥48px labels inside the viewport, no overlap or clipped text (${board.violations.join(', ')})`);
          check(board.minWindow >= (view.w >= 720 ? 96 : 120), `${name}: model window ≥ ${view.w >= 720 ? 96 : 120}px (${board.minWindow})`);
          check(board.models === 3, `${name}: three rendered 3D models (${board.models})`);
          check(board.stamps.length === 1 && board.stamps[0] === 'hub-expansion', `${name}: context stamp only on the hub label (${board.stamps.join(',')})`);
          check(board.facts, `${name}: range and seats from PLANE_TYPES`);
          check(!board.horizontalOverflow, `${name}: no horizontal overflow`);
          if (variant.shot) {
            await page.screenshot({ path: resolve(UPGRADE_OUT, `upgrade-${language}-${view.label}${variant.suffix}.png`), animations: 'disabled' });
            shots++;
          }
        }
        if (view.label === 'portrait-412x915') {
          await page.locator('[data-upgrade="widebody"]').click();
          check(await page.evaluate(() => window.__upgradeEvents.includes('widebody')), `${tag}: label tap emits ChooseUpgrade`);
          await page.evaluate(() => window.__upgradeView.render({ ...window.__upgradeState, pendingHub: true }, window.__upgradeHubs));
          const picking = await page.evaluate(() => ({ cards: document.querySelectorAll('.airway-upgrade-tag').length,
            transparent: getComputedStyle(document.querySelector('.airway-upgrade-open')).backgroundColor === 'rgba(0, 0, 0, 0)' }));
          check(picking.cards === 0 && picking.transparent, `${tag}: hub pick leaves only the sign over the live globe`);
          // [task-39] Back tile in the pick sign: ≥48 px, inside the viewport, translated, tap emits CancelUpgradePick.
          const back = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="upgrade-pick-back"]');
            const r = el?.getBoundingClientRect();
            return el && r ? { w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
              text: el.textContent, label: el.getAttribute('aria-label'), hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid="upgrade-pick-back"]') === el } : null;
          });
          check(!!back && back.w >= 48 && back.h >= 48 && back.inside && back.hit, `${tag}: back tile ≥48px and tappable (${JSON.stringify(back)})`);
          check(!!back && back.text === (language === 'pl' ? 'Wróć' : 'Back') && !!back.label, `${tag}: back tile text from i18n`);
          await page.getByTestId('upgrade-pick-back').click();
          check(await page.evaluate(() => window.__upgradeEvents.includes('cancel:7')), `${tag}: back tile emits CancelUpgradePick`);
          await page.evaluate(() => window.__upgradeView.render(window.__upgradeState, []));
          check(await page.locator('[data-upgrade="hub-expansion"]').isDisabled(), `${tag}: hub label disabled when there is no hub`);
        }
        check(pageErrors.length === 0, `${tag}: no page errors (${pageErrors.join('; ')})`);
      } finally { await page.close(); }
    }
  }
  // [task-37] No mid-word breaks, header gaps and symmetric middle dots: menu, upgrade labels, game over (PL + EN).
  const TEXT_OUT = resolve(ROOT, 'docs/shots/37');
  mkdirSync(TEXT_OUT, { recursive: true });
  for (const language of ['pl', 'en']) {
    for (const view of TEXT_SIZES) {
      const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const tag = `text ${language} ${view.label}`;
      try {
        // ?perf=scene boots no game: each screen is mounted alone through its public API.
        await page.goto(url + '?perf=scene', { waitUntil: 'networkidle' });
        await page.evaluate(async (language) => {
          const [{ createMenu }, { setLanguage }] = await Promise.all([import('/src/ui/menu/menu.ts'), import('/src/i18n/index.ts')]);
          setLanguage(language);
          document.getElementById('app').append(createMenu(() => {}, { bestPassengers: 1284, solvedPuzzles: 3, totalPuzzles: 15, today: new Date(2026, 10, 2) }).element);
          await document.fonts.ready;
        }, language);
        const menuBreaks = await midWordBreaks(page, '.airway-menu');
        check(menuBreaks.length === 0, `${tag} menu: no mid-word breaks (${menuBreaks.join('; ')})`);
        const gaps = await headerGaps(page, '.airway-board__header');
        const tight = gaps.filter((g) => g.gap < 8);
        check(gaps.length === 2 && tight.length === 0, `${tag} menu: board headers ≥ 8px apart (${gaps.map((g) => `${g.left}|${g.right} ${g.gap}`).join(', ')})`);
        const menuDots = await middleDots(page, '.airway-menu');
        check(menuDots.length === 0, `${tag} menu: symmetric middle dots (${menuDots.join('; ')})`);
        if (view.w === 360) { await page.screenshot({ path: resolve(TEXT_OUT, `menu-${language}-${view.label}.png`) }); shots++; }

        await page.evaluate(() => document.querySelector('.airway-menu')?.remove());
        await mountUpgrade(page, language, UPGRADE_VARIANTS[0]);
        const cardBreaks = await midWordBreaks(page, '.airway-upgrade');
        check(cardBreaks.length === 0, `${tag} upgrade: no mid-word breaks (${cardBreaks.join('; ')})`);
        const titles = await page.evaluate(() => [...document.querySelectorAll('.airway-upgrade-title')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
        check(titles.length === 0, `${tag} upgrade: titles fit their label (${titles.join(', ')})`);
        const cardDots = await middleDots(page, '.airway-upgrade');
        check(cardDots.length === 0, `${tag} upgrade: symmetric middle dots (${cardDots.join('; ')})`);
        if (view.w === 360 || view.w === 412) { await page.screenshot({ path: resolve(TEXT_OUT, `upgrade-${language}-${view.label}.png`) }); shots++; }

        await page.evaluate(async () => {
          document.querySelector('.test-upgrade-host')?.remove();
          const { mountGameOverPreview } = await import('/src/ui/gameover/preview.ts');
          mountGameOverPreview(document.getElementById('app'));
        });
        await page.waitForSelector('[data-gameover-state="open"]');
        await page.evaluate(() => document.fonts.ready);
        const overBreaks = await midWordBreaks(page, '.airway-go-overlay');
        check(overBreaks.length === 0, `${tag} game over: no mid-word breaks (${overBreaks.join('; ')})`);
        const overDots = await middleDots(page, '.airway-go-overlay');
        check(overDots.length === 0, `${tag} game over: symmetric middle dots (${overDots.join('; ')})`);
        if (view.w === 360 && view.h === 800) { await page.screenshot({ path: resolve(TEXT_OUT, `gameover-${language}-${view.label}.png`) }); shots++; }
        check(pageErrors.length === 0, `${tag}: no page errors (${pageErrors.join('; ')})`);
      } finally { await page.close(); }
    }
  }
} catch (error) {
  failed++;
  console.error(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  console.log(`SUMMARY test:hud-targets seed=0xA1A1 passed=${passed} failed=${failed} shots=${shots}`);
  if (failed) process.exitCode = 1;
}

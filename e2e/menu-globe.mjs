// [night-79a R4] D-334 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step R4): the UI-A menu's night globe on the
// real renderer (`?skin=board&look=earth`). For each language and size, on the menu:
//   - the globe is framed to `[data-globe-frame="menu"]` (the DEV world probe's framing key starts with "menu-frame"):
//     centred on the frame's column, never wider than it, its limb under the tagline;
//   - portrait: at most 30 % of the disc behind the board, and the part under the board's top inside the board's width
//     and above its foot (no sliver of globe beside or under the board); landscape: the disc left of the board;
//   (the menu's night sun is checked headless by test:render-layers, `menuSunTick`; a pixel probe cannot tell the dark
//   day-side ocean from the night side, so the night is judged on the shots);
//   - D-62: the globe turns ~1.2°/s with "Reduce motion" off and stands still with it on, and the outline does not move.
// `--shots` writes PL/EN 320×568, 412×915, 915×412 and 768×1024 to docs/shots/r4/; otherwise PNGs go to .e2e/menu-globe/.
// Inspect every PNG.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, waitForScreen, ROOT, ARTIFACTS, SEED } from './browser.mjs';

const started = performance.now();
const SHOTS = process.argv.includes('--shots');
const OUT = SHOTS ? resolve(ROOT, 'docs/shots/r4') : resolve(ARTIFACTS, 'menu-globe');
const SIZES = SHOTS ? [[320, 568], [412, 915], [915, 412], [768, 1024]]
  : [[320, 568], [360, 640], [412, 915], [390, 844], [915, 412], [640, 360], [768, 1024]];
const langs = process.argv.includes('--pl') ? ['pl'] : process.argv.includes('--en') ? ['en'] : ['pl', 'en'];
const failures = [];
let checked = 0;
let shots = 0;

function menuUrl(url) {
  const target = new URL(url);
  target.searchParams.set('skin', 'board');
  target.searchParams.set('look', 'earth');
  return target.href;
}

async function audit(page) {
  return await page.evaluate(() => {
    const problems = [];
    const world = window.__awWorld;
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const frame = box('[data-globe-frame="menu"]');
    const board = box('.airway-board');
    const disc = world?.disc();
    if (!frame || !board || !disc) return [`missing ${!frame ? 'frame' : !board ? 'board' : 'disc'}`];
    if (!world.framing().now.startsWith('menu-frame ')) problems.push(`not framed to the globe frame: ${world.framing().now.slice(0, 40)}`);
    const cx = (frame.left + frame.right) / 2;
    if (Math.abs(disc.x - cx) > 1.5) problems.push(`disc centre ${disc.x.toFixed(1)} off the frame's column ${cx}`);
    if (disc.x - disc.radius < frame.left - 1 || disc.x + disc.radius > frame.right + 1) problems.push(`disc (r ${disc.radius.toFixed(0)}) wider than the frame`);
    if (disc.y - disc.radius < frame.top + 7) problems.push(`limb ${(disc.y - disc.radius).toFixed(0)} over the tagline (frame top ${frame.top.toFixed(0)})`);
    const below = board.top >= frame.bottom - 1;
    if (below) {
      const coverTop = board.top;
      const half = (y) => (Math.abs(y - disc.y) >= disc.radius ? 0 : Math.sqrt(disc.radius ** 2 - (y - disc.y) ** 2));
      const widest = disc.y > coverTop ? disc.radius : half(coverTop);
      if (disc.x - widest < board.left - 1 || disc.x + widest > board.right + 1) problems.push(`globe beside the board (half chord ${widest.toFixed(0)})`);
      if (disc.y + disc.radius > board.bottom + 1) problems.push('globe under the board\'s foot');
      const hidden = Math.max(0, disc.y + disc.radius - coverTop) / (2 * disc.radius);
      if (disc.radius >= 72 && hidden > 0.31 && world.framing().now.includes('"kind":"disc"')) problems.push(`${(hidden * 100).toFixed(0)} % of the disc behind the board`);
    } else if (disc.x + disc.radius > board.left - 8) problems.push('landscape disc runs under the board');
    return problems;
  });
}

async function run(browser, url, language, [width, height]) {
  const tag = `${language}-${width}x${height}`;
  const record = (problems) => { checked++; for (const p of problems) failures.push(`${tag}: ${p}`); };
  const { page, errors } = await newGamePage(browser, menuUrl(url), language, { width, height }, { reducedMotion: 'reduce' });
  try {
    await waitForScreen(page, 'menu');
    await page.waitForFunction(() => window.__awWorld?.ready, null, { timeout: 30000 });
    await page.waitForTimeout(3000); // the earth textures and borders arrive after the first frame
    const problems = await audit(page);
    if (await page.evaluate(() => window.__awWorld.framing().menuSpin) !== 0) problems.push('the globe turns under "Reduce motion"');
    record(problems);
    await page.screenshot({ path: resolve(OUT, `menu-${tag}.png`), animations: 'disabled' });
    shots++;
    if (errors.length) failures.push(`${tag}: page errors ${errors.join('; ')}`);
  } finally {
    await page.close();
  }
}

/** D-62 on the framed menu: ~1.2°/s with motion allowed, the outline still. */
async function spin(browser, url) {
  const { page } = await newGamePage(browser, menuUrl(url), 'pl', { width: 412, height: 915 }, { reducedMotion: 'no-preference' });
  try {
    await waitForScreen(page, 'menu');
    await page.waitForTimeout(1500);
    const a = await page.evaluate(() => ({ rate: window.__awWorld.framing().menuSpin, lon: window.__awWorld.longitude(), disc: window.__awWorld.disc() }));
    await page.waitForTimeout(2000);
    const b = await page.evaluate(() => ({ lon: window.__awWorld.longitude(), disc: window.__awWorld.disc() }));
    const turned = ((b.lon - a.lon) + 540) % 360 - 180;
    const problems = [];
    if (a.rate !== 1.2) problems.push(`menu spin ${a.rate}°/s (D-62: 1.2)`);
    if (!(turned > 0.5)) problems.push(`the globe did not turn (${turned.toFixed(2)}°)`);
    if (Math.abs(a.disc.y - b.disc.y) > 0.5 || Math.abs(a.disc.radius - b.disc.radius) > 0.5) problems.push('the outline moved while turning');
    checked++;
    for (const p of problems) failures.push(`spin: ${p}`);
  } finally {
    await page.close();
  }
}

mkdirSync(OUT, { recursive: true });
await withBrowser(async ({ browser, url }) => {
  for (const language of langs) for (const size of SIZES) await run(browser, url, language, size);
  await spin(browser, url);
});
for (const failure of failures) console.error('FAIL ' + failure);
console.log(`SUMMARY test:e2e:menu-globe seed=0x${SEED.toString(16).toUpperCase()} screens=${checked} shots=${shots} ` +
  `passed=${checked - new Set(failures.map((f) => f.split(':')[0])).size} failed=${failures.length} out=${OUT} ` +
  `${((performance.now() - started) / 1000).toFixed(0)}s`);
if (failures.length) process.exitCode = 1;

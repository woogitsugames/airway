// One screenshot pipeline for the game and its dev pages (replaces the per-task shots:NN variants).
//
//   npm run shots                         every target, portrait 412x915 + landscape 915x412, DPR 1
//   npm run shots -- menu gameover        only the named targets
//   npm run shots -- --fold               also foldable 673x841 and 904x1000
//   npm run shots -- --lang=en --dpr=2    language / device pixel ratio override
//   npm run shots -- --list               print targets and exit
//   npm run shots -- globe --look=linoryt  [ext-04] add ?look= (and/or --skin=) to every URL; PNGs go to
//                                          docs/shots/look-<look>[-skin-<skin>]/<id>-<orientation>.png
//
// Output: docs/shots/<dir>/<file>-<orientation>.png (dir = the task that owns the view, see docs/shots/README.md).
// Targets fail independently; the run exits nonzero if any requested capture failed. A missing
// screen (e.g. a selector the app shell does not render yet) is a failure, never a silent skip.
// Set AIRWAY_E2E_URL to reuse a running dev server. Inspect every PNG before committing it.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT, SEED, startVite, launchChromium, presetLanguage, errorText } from './lib/harness.mjs';
import { linorytMotion } from '../dev/linoryt-motion.mjs';

const PORTRAIT = { tag: 'p', width: 412, height: 915 };
const LANDSCAPE = { tag: 'l', width: 915, height: 412 };
const FOLDS = [{ tag: 'fold-673x841', width: 673, height: 841 }, { tag: 'fold-904x1000', width: 904, height: 1000 }];

/**
 * path: URL relative to the dev server root. ready: what proves the view is real
 * (selector, or a page function string). settle: extra ms for split-flap / camera motion.
 * open: selectors clicked in order after load (real UI navigation, no state injection).
 * check(page): optional telemetry assertion returning a short log string.
 */
const TARGETS = [
  { id: 'game', dir: '01', file: 'game', path: '', ready: { selector: '#app canvas' }, settle: 500,
    note: 'app boot screen' },
  { id: 'globe', dir: '03', file: 'game', path: 'dev/globe.html?quality=medium',
    ready: { fn: 'window.__globeReady && window.__globeMetrics' }, timeout: 90000, settle: 700,
    note: 'standalone Diorama globe + draw-call/triangle telemetry',
    check: async (page) => {
      const m = await page.evaluate(() => window.__globeMetrics);
      if (!m || m.drawCalls > 60 || m.triangles < 1000) throw new Error('Invalid globe telemetry: ' + JSON.stringify(m));
      return `fps=${m.fps} calls=${m.drawCalls} triangles=${m.triangles} renderCpuMs=${m.frameMs}`;
    } },
  { id: 'airports', dir: '06', file: 'airports', suffix: '-1x', path: 'dev/world.html?frozen&clean&zoom=1', // [integration-ui] ?dev=airports moved to dev/world.html
   
    ready: { selector: '.airport-bubble', state: 'attached' }, note: 'airport/overlay fixture at 1x' },
  { id: 'airports-zoom', dir: '06', file: 'airports', suffix: '-2_5x', path: 'dev/world.html?frozen&clean&zoom=2.5',
    ready: { selector: '.airport-bubble', state: 'attached' }, note: 'airport/overlay fixture at 2.5x' },
  // [task-33] Globe detail vs the mockup: world lab at 1x / 2.5x per preset and the menu globe.
  ...['low', 'medium', 'high'].flatMap((q) => [1, 2.5].map((zoom) => ({
    id: `globe-${q}-${zoom === 1 ? '1x' : '2_5x'}`, dir: '33', file: `world-${q}`,
    suffix: zoom === 1 ? '-1x' : '-2_5x', path: `dev/world.html?frozen&clean&quality=${q}&zoom=${zoom}`,
    ready: { fn: 'window.__ready && window.__worldMetrics' }, timeout: 90000, settle: 700,
    note: `globe detail, ${q} preset at ${zoom}x`,
    check: async (page) => {
      const m = await page.evaluate(() => window.__worldMetrics);
      return `calls=${m.drawCalls} triangles=${m.triangles}`;
    },
  }))),
  { id: 'globe-menu', dir: '33', file: 'menu', path: '', lang: 'pl',
    ready: { selector: '.airway-board .airway-flight' }, settle: 1500, note: 'menu globe' },
  { id: 'menu', dir: '14', file: 'menu', path: '', lang: 'pl',
    ready: { selector: '.airway-board .airway-flight' }, settle: 1100, note: 'split-flap main menu' },
  { id: 'gameover', dir: '15', file: 'game', path: '?preview=gameover',
    ready: { selector: '[data-gameover-state="open"]' }, note: 'game-over board (dev preview)' },
  { id: 'puzzles', dir: '17', file: 'board', path: '', open: ['.airway-board [data-mode="puzzles"]'],
    ready: { selector: '.puzzle-departures .puzzle-flap' }, note: 'puzzle departure board' },
  // [ext-04 E1] D-283/D-298: the Linoryt globe in motion (8 frames, 0.15°/frame) and its flicker score (≤ 2 %), low preset.
  { id: 'linoryt-motion', dir: 'ext-04', file: 'linoryt-motion', path: 'dev/globe.html?quality=low&look=linoryt&clean&zoom=2.2&lon=24&lat=38&sun=-10,-18',
    ready: { fn: 'window.__globeReady && window.__globeMetrics' }, timeout: 120000, settle: 700,
    note: 'Linoryt motion strip + flicker score (spec §9)', motion: true },
  // [night-70a R1] D-323: the NASA globe preview (`?look=earth`, DEV only) by day, at dusk and by night on each preset,
  // and the game's menu globe with it (sun fixed: day over the Mediterranean, the terminator through it, night).
  ...[['day', '30,-18', 'high'], ['dusk', '-58,-18', 'high'], ['night', '-150,-18', 'medium'], ['night-low', '-150,-18', 'low']]
    .map(([file, sun, quality]) => ({
      id: `earth-${file}`, dir: 'r1', file: `earth-${file}`,
      path: `dev/globe.html?quality=${quality}&look=earth&clean&zoom=2.2&lon=24&lat=38&sun=${sun}`,
      ready: { fn: 'window.__globeReady && window.__globeMetrics' }, timeout: 120000, settle: 2500,
      note: `NASA globe preview, ${file} (${quality})`,
      check: async (page) => {
        const m = await page.evaluate(() => window.__globeMetrics);
        if (!m || m.drawCalls > 50) throw new Error('Earth globe over the draw-call budget: ' + JSON.stringify(m));
        return `calls=${m.drawCalls} triangles=${m.triangles}`;
      },
    })),
  { id: 'earth-menu', dir: 'r1', file: 'earth-menu', path: '?look=earth', lang: 'pl',
    ready: { selector: '.airway-board .airway-flight' }, settle: 3000, note: 'menu over the NASA globe preview' },
  // [night-07d] Curfew airports marked on the puzzle strips (barrier mark + hours line).
  ...[['08', 'pl'], ['30', 'en']].map(([level, lang]) => ({
    id: `puzzle-curfew-${level}`, dir: 'night-07d', file: `puzzle${level}-${lang}`, path: '', lang,
    open: ['.airway-board [data-mode="puzzles"]', `[data-action="open:${level}"]`],
    ready: { selector: '[data-testid="puzzle-curfews"] .puzzle-curfew-mark' }, settle: 300,
    note: `puzzle ${level} with curfew marks (${lang})`,
  })),
  // [ext-02/ext-04] R6h: the "Long haul" pack (31–40), four levels with curfew marks.
  ...[['32', 'en'], ['35', 'pl'], ['39', 'en'], ['40', 'pl']].map(([level, lang]) => ({
    id: `puzzle-long-haul-${level}`, dir: 'ext-02', file: `puzzle${level}-${lang}`, path: '', lang,
    open: ['.airway-board [data-mode="puzzles"]', `[data-action="open:${level}"]`],
    ready: { selector: '[data-testid="puzzle-curfews"] .puzzle-curfew-mark' }, settle: 300,
    note: `long-haul puzzle ${level} (${lang})`,
  })),
];

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const names = args.filter((arg) => !arg.startsWith('--'));
const dpr = Number(option('dpr') ?? 1);
const langOverride = option('lang');
const lookOption = option('look'); // [ext-04]
const skinOption = option('skin');
const withQuery = (path) => {
  const extra = [lookOption && `look=${lookOption}`, skinOption && `skin=${skinOption}`].filter(Boolean).join('&');
  if (!extra) return path;
  return path + (path.includes('?') ? '&' : '?') + extra;
};

if (args.includes('--list')) {
  for (const t of TARGETS) console.log(`${t.id.padEnd(14)} docs/shots/${t.dir}/  /${t.path}  ${t.note}`);
  process.exit(0);
}
const unknown = names.filter((name) => !TARGETS.some((t) => t.id === name));
if (unknown.length) {
  console.error(`Unknown target(s): ${unknown.join(', ')}. Known: ${TARGETS.map((t) => t.id).join(', ')}`);
  console.log(`SUMMARY shots seed=0xA1A1 captured=0 failed=1`);
  process.exit(1);
}
if (!(dpr >= 1 && dpr <= 3)) throw new Error('--dpr must be between 1 and 3');
const selected = names.length ? TARGETS.filter((t) => names.includes(t.id)) : TARGETS;
const sizes = [PORTRAIT, LANDSCAPE, ...(args.includes('--fold') ? FOLDS : [])];

let host;
let browser;
let captured = 0;
const failures = [];
const started = performance.now();

async function shoot(target, size, baseUrl) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const lang = langOverride ?? target.lang;
    if (lang) await presetLanguage(page, lang);
    await page.goto(baseUrl + withQuery(target.path), { waitUntil: 'networkidle', timeout: 30000 });
    const timeout = target.timeout ?? 15000;
    for (const selector of target.open ?? []) {
      await page.click(selector, { timeout }).catch(() => { throw new Error(`cannot open via "${selector}"`); });
    }
    if (target.ready.fn) {
      await page.waitForFunction(target.ready.fn, undefined, { timeout });
    } else {
      await page.waitForSelector(target.ready.selector, { state: target.ready.state ?? 'visible', timeout })
        .catch(() => { throw new Error(`"${target.ready.selector}" not rendered within ${timeout} ms`); });
    }
    await page.evaluate(() => document.fonts.ready);
    if (target.settle) await page.waitForTimeout(target.settle);
    if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
    const info = target.check ? ' ' + await target.check(page) : '';
    const lookDir = lookOption || skinOption
      ? `look-${lookOption ?? 'default'}${skinOption ? '-skin-' + skinOption : ''}` : null;
    const rel = lookDir ? `docs/shots/${lookDir}/${target.id}-${size.tag}${target.suffix ?? ''}.png`
      : `docs/shots/${target.dir}/${target.file}-${size.tag}${target.suffix ?? ''}.png`;
    mkdirSync(dirname(resolve(ROOT, rel)), { recursive: true });
    if (target.motion) {
      const log = await linorytMotion(page, resolve(ROOT, rel));
      captured++;
      console.log(`shot ${rel} ${size.width}x${size.height}@${dpr} ${log}`);
      return;
    }
    await page.screenshot({ path: resolve(ROOT, rel), animations: 'disabled' });
    captured++;
    console.log(`shot ${rel} ${size.width}x${size.height}@${dpr}${info}`);
  } finally {
    await page.close();
  }
}

try {
  host = await startVite();
  browser = await launchChromium();
  for (const target of selected) {
    for (const size of sizes) {
      try {
        await shoot(target, size, host.url);
      } catch (error) {
        failures.push(`${target.id} ${size.tag}: ${errorText(error).split('\n')[0]}`);
      }
    }
  }
} catch (error) {
  failures.push('harness: ' + errorText(error));
} finally {
  if (browser) await browser.close();
  if (host) await host.stop();
  for (const line of failures) console.error('FAIL ' + line);
  console.log(`SUMMARY shots seed=0x${SEED.toString(16).toUpperCase()} targets=${selected.length} ` +
    `expected=${selected.length * sizes.length} captured=${captured} failed=${failures.length} ` +
    `durationMs=${Math.round(performance.now() - started)}`);
  if (failures.length) process.exitCode = 1;
}

// One screenshot pipeline for the game and its dev pages (replaces the per-task shots:NN variants).
//
//   npm run shots                         every target, portrait 412x915 + landscape 915x412, DPR 1
//   npm run shots -- menu gameover        only the named targets
//   npm run shots -- --fold               also foldable 673x841 and 904x1000
//   npm run shots -- --lang=en --dpr=2    language / device pixel ratio override
//   npm run shots -- --list               print targets and exit
//
// Output: docs/shots/<dir>/<file>-<orientation>.png (dir = the task that owns the view, see docs/shots/README.md).
// Targets fail independently; the run exits nonzero if any requested capture failed. A missing
// screen (e.g. a selector the app shell does not render yet) is a failure, never a silent skip.
// Set AIRWAY_E2E_URL to reuse a running dev server. Inspect every PNG before committing it.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT, SEED, startVite, launchChromium, presetLanguage, errorText } from './lib/harness.mjs';

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
  { id: 'menu', dir: '14', file: 'menu', path: '', lang: 'pl',
    ready: { selector: '.airway-board .airway-flight' }, settle: 1100, note: 'split-flap main menu' },
  { id: 'gameover', dir: '15', file: 'game', path: '?preview=gameover',
    ready: { selector: '[data-gameover-state="open"]' }, note: 'game-over board (dev preview)' },
  { id: 'puzzles', dir: '17', file: 'board', path: '', open: ['.airway-board [data-mode="puzzles"]'],
    ready: { selector: '.puzzle-departures .puzzle-flap' }, note: 'puzzle departure board' },
];

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const names = args.filter((arg) => !arg.startsWith('--'));
const dpr = Number(option('dpr') ?? 1);
const langOverride = option('lang');

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
    await page.goto(baseUrl + target.path, { waitUntil: 'networkidle', timeout: 30000 });
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
    const rel = `docs/shots/${target.dir}/${target.file}-${size.tag}${target.suffix ?? ''}.png`;
    mkdirSync(dirname(resolve(ROOT, rel)), { recursive: true });
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

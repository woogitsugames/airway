// [night-12q] R5k, D-143: bundle budget guard. The Capacitor app loads its files from disk, so size is not a network
// cost, but parse time on a budget Android phone grows with the main chunk; this guard makes growth a decision.
//   node scripts/test-bundle.mjs           -> static checks + budgets of the built dist/ (run after `npm run build`)
//   node scripts/test-bundle.mjs --static  -> static checks only (test:fast): no module is imported both statically
//                                             and dynamically in src/ (Vite cannot split it and warns), and the budget
//                                             checker itself rejects an oversized synthetic dist.
// Budgets and headroom: docs/PERFORMANCE.md "Bundle budget".
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_ONLY = process.argv.includes('--static');
const KB = 1000;
export const BUDGET = Object.freeze({
  mainJsRaw: 1150 * KB, // measured 1,033.8 kB on 2026-11-03 (+11 %)
  mainJsGzip: 340 * KB, // measured 307.0 kB (+11 %)
  css: 90 * KB, // measured 70.2 kB, all CSS files together
  // [ext-03 G1] D-171: + ~1.8 MB globe textures (public/data/globe/, test:globe-assets) and ~0.55 MB for Mapa (G8).
  total: 4300 * KB, // measured 1,804.8 kB before G1, every file under dist/ (fonts, land mask, licences, globe)
});

const failures = [];
let checks = 0;
const check = (ok, message) => { checks++; if (!ok) failures.push(message); };

function files(dir, filter = () => true, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, filter, out);
    else if (filter(path)) out.push(path);
  }
  return out;
}

/** Module ids imported both statically and with import() across the given sources ({path, text}). */
export function mixedImports(sources) {
  const id = (from, specifier) => {
    if (!specifier.startsWith('.')) return specifier;
    return relative(ROOT, resolve(dirname(from), specifier)).replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '');
  };
  const statics = new Map();
  const dynamics = new Map();
  const add = (map, key, path) => map.set(key, [...(map.get(key) ?? []), relative(ROOT, path)]);
  for (const { path, text } of sources) {
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      add(statics, id(path, m[1]), path);
    }
    for (const m of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) add(dynamics, id(path, m[1]), path);
  }
  return [...dynamics.keys()].filter((key) => statics.has(key))
    .map((key) => `${key} (dynamic: ${dynamics.get(key).join(', ')}; static: ${statics.get(key).join(', ')})`);
}

/** Size report of a built dist/ directory and the list of budget breaches. */
export function measure(dist, budget = BUDGET) {
  const all = files(dist).map((path) => ({ path, bytes: statSync(path).size }));
  const js = all.filter((f) => extname(f.path) === '.js' && f.path.includes(`${join(dist, 'assets')}`))
    .sort((a, b) => b.bytes - a.bytes);
  const main = js[0];
  const report = {
    mainJs: main ? relative(dist, main.path) : null,
    mainJsRaw: main?.bytes ?? 0,
    mainJsGzip: main ? gzipSync(readFileSync(main.path), { level: 9 }).length : 0,
    css: all.filter((f) => extname(f.path) === '.css').reduce((sum, f) => sum + f.bytes, 0),
    total: all.reduce((sum, f) => sum + f.bytes, 0),
    top: [...all].sort((a, b) => b.bytes - a.bytes).slice(0, 6).map((f) => [relative(dist, f.path), f.bytes]),
  };
  const breaches = [];
  if (!main) breaches.push('mainJsRaw no JS chunk in ' + relative(ROOT, join(dist, 'assets')));
  for (const key of ['mainJsRaw', 'mainJsGzip', 'css', 'total']) {
    if (report[key] > budget[key]) breaches.push(`${key} ${kb(report[key])} kB > budget ${kb(budget[key])} kB`);
  }
  return { report, breaches };
}
const kb = (bytes) => (bytes / KB).toFixed(1);

// 1. Static: no mixed static/dynamic import (the R5k case was `@capacitor/core` in platform/install.ts and storage.ts).
const sources = files(resolve(ROOT, 'src'), (p) => /\.(ts|tsx|js|mjs)$/.test(p))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const mixed = mixedImports(sources);
check(mixed.length === 0, 'imported both statically and dynamically: ' + mixed.join('; '));
check(mixedImports([
  { path: join(ROOT, 'src/a.ts'), text: "import { x } from 'pkg';\nimport type { T } from './t';" },
  { path: join(ROOT, 'src/b.ts'), text: "const m = await import('pkg'); const t = await import('./t.ts');" },
]).length === 1, 'mixed-import self-check: one mixed module (type-only imports do not count)');

// 2. Self-check of the budget checker on a synthetic dist/ that breaks every budget.
const fake = mkdtempSync(join(tmpdir(), 'aw-bundle-'));
try {
  mkdirSync(join(fake, 'assets'));
  writeFileSync(join(fake, 'assets/index-a.js'), 'x'.repeat(2000));
  writeFileSync(join(fake, 'assets/web-b.js'), 'y'.repeat(10));
  writeFileSync(join(fake, 'assets/index-c.css'), 'z'.repeat(500));
  const tiny = { mainJsRaw: 1000, mainJsGzip: 1, css: 100, total: 2000 };
  const { report, breaches } = measure(fake, tiny);
  check(report.mainJs === join('assets', 'index-a.js'), 'budget self-check: largest JS chunk is the main chunk');
  check(breaches.length === 4, 'budget self-check: 4 breaches expected, got ' + breaches.length);
  check(measure(fake, { mainJsRaw: 1e9, mainJsGzip: 1e9, css: 1e9, total: 1e9 }).breaches.length === 0,
    'budget self-check: a roomy budget passes');
} finally {
  rmSync(fake, { recursive: true, force: true });
}

// 3. The real build.
if (!STATIC_ONLY) {
  const dist = resolve(ROOT, 'dist');
  if (!existsSync(join(dist, 'assets'))) {
    check(false, 'dist/assets missing: run `npm run build` first');
  } else {
    const { report, breaches } = measure(dist);
    for (const key of ['mainJsRaw', 'mainJsGzip', 'css', 'total']) {
      const breach = breaches.find((b) => b.startsWith(key + ' '));
      check(!breach, 'budget: ' + breach);
    }
    console.log(`main ${report.mainJs} ${kb(report.mainJsRaw)} kB (gzip ${kb(report.mainJsGzip)} kB), css ` +
      `${kb(report.css)} kB, dist ${kb(report.total)} kB`);
    for (const [path, bytes] of report.top) console.log(`  ${kb(bytes).padStart(8)} kB  ${path}`);
    console.log(`SUMMARY test:bundle mainKB=${kb(report.mainJsRaw)} gzipKB=${kb(report.mainJsGzip)} ` +
      `cssKB=${kb(report.css)} distKB=${kb(report.total)} checks=${checks} passed=${checks - failures.length} ` +
      `failed=${failures.length}`);
  }
}
for (const failure of failures) console.error('FAIL ' + failure);
if (STATIC_ONLY || failures.length && !existsSync(join(ROOT, 'dist/assets'))) {
  console.log(`SUMMARY test:bundle${STATIC_ONLY ? ':static' : ''} checks=${checks} passed=${checks - failures.length} ` +
    `failed=${failures.length}`);
}
if (failures.length) process.exitCode = 1;

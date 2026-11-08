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
import { skinBuild } from './vite-skin-inline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_ONLY = process.argv.includes('--static');
const KB = 1000;
export const BUDGET = Object.freeze({
  // [night-11ar] D-252: 1,150 -> 1,180 kB raw and 340 -> 360 kB gzip after removing 31 kB of waste: what is left is
  // content merged since D-143 (puzzles 31-40, legal pages, globe G-series, contract, surge, licence classes).
  mainJsRaw: 1180 * KB, // measured 1,033.8 kB on 2026-11-03, 1,150.4 kB on 2026-11-05 (1,181.6 kB before D-252)
  mainJsGzip: 360 * KB, // measured 307.0 kB on 2026-11-03, 347.8 kB on 2026-11-05 (the same gzip/raw ratio, 0.302)
  // [night-11az] D-258: 90 -> 109 kB (owner-approved ceiling) for the Róża structure over the component CSS.
  // [night-46a] D-297/D-301: 109 -> 132 kB at the Linoryt flip (U5): the measured release CSS after it (129.0 kB) + 3 kB.
  // [night-48a] D-305 (U6): 132 -> 130 kB: the inks written in place (126.8 kB), then the U6 fixes, 127.4 kB measured + ~3 kB.
  // [night-56b] 130 -> 129.8 kB: dead CSS removed without visual change (split-flap cells, Diorama ticket fields, unused
  // task-20 text roles, overridden duplicates; 129.9 -> 126.8 kB measured) + ~3 kB.
  css: 129.8 * KB, // measured 70.2 kB, all CSS files together; 88.8 kB on 2026-11-05 with the skin inlined (D-252); 107.2 kB with Róża; 129.0 kB with Linoryt (2026-11-08); 127.4 kB after U6; 126.8 kB after N56b
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
    // [night-11ar] D-252: the release CSS carries the skin values, not the tokens (scripts/vite-skin-inline.mjs);
    // only the tokens TypeScript reads at run time stay defined.
    // [night-36a] D-294: plus the font stacks kept as references (REFERENCED_TOKENS).
    const { keep, refs } = skinBuild(ROOT);
    const css = files(dist, (p) => extname(p) === '.css').map((p) => readFileSync(p, 'utf8')).join('\n');
    const tokenUses = [...css.matchAll(/var\(--skin-([a-z0-9-]+)/g)].map((m) => m[1]).filter((name) => !keep.has(name) && !refs.has(name));
    check(tokenUses.length === 0, 'skin tokens left in dist CSS (vite-skin-inline off?): ' + [...new Set(tokenUses)].join(' '));
    // [night-11ax] D-257: fonts ship as WOFF2 only (scripts/vite-font-files.mjs drops the TTF twins from dist/), and
    // every font file the release CSS names is in dist/.
    const fontFilesInDist = existsSync(join(dist, 'fonts')) ? files(join(dist, 'fonts'), () => true).map((p) => relative(dist, p)) : [];
    const ttfs = fontFilesInDist.filter((p) => p.endsWith('.ttf'));
    check(ttfs.length === 0, 'TTF fonts in dist/ (WOFF2 only): ' + ttfs.join(' '));
    const named = [...new Set([...css.matchAll(/url\(['"]?(?:\.\.)?\/?(fonts\/[^'")]+)['"]?\)/g)].map((m) => m[1]))];
    const absent = named.filter((p) => !existsSync(join(dist, p)));
    check(named.length >= 6 && absent.length === 0, `font files named by the CSS missing from dist/ (${named.length} named): ` + absent.join(' '));
    // [night-11at] D-255: the privacy policy and terms bodies are a chunk of their own inside dist/ (loaded on demand,
    // no network), not part of the main chunk; markers are the first section titles of both documents, EN and PL.
    await import('./ts-test-loader.mjs');
    const { en: legalEn } = await import('../src/i18n/legal/en.ts');
    const { pl: legalPl } = await import('../src/i18n/legal/pl.ts');
    const markers = [legalEn, legalPl].flatMap((c) => [c['privacy.s1.title'], c['terms.s1.title']]);
    const chunks = files(join(dist, 'assets'), (p) => extname(p) === '.js').map((p) => [relative(dist, p), readFileSync(p, 'utf8')]);
    const legalChunks = chunks.filter(([, text]) => markers.some((marker) => text.includes(marker)));
    check(legalChunks.length === 1 && legalChunks[0][0] !== report.mainJs && markers.every((m) => legalChunks[0][1].includes(m)),
      'legal texts: one separate chunk with both documents in every language, got ' + legalChunks.map(([path]) => path).join(', '));
    if (legalChunks.length === 1) console.log(`legal ${legalChunks[0][0]} ${kb(Buffer.byteLength(legalChunks[0][1]))} kB`);
    for (const key of ['mainJsRaw', 'mainJsGzip', 'css', 'total']) {
      const breach = breaches.find((b) => b.startsWith(key + ' '));
      check(!breach, 'budget: ' + breach);
    }
    // [night-70a R1] D-323: the NASA globe preview (`?look=earth`) never ships before the flip: no preview texture in
    // dist/ (scripts/vite-globe-preview.mjs) and no chunk with its shader (the import is behind import.meta.env.DEV).
    const { PREVIEW_GLOBE_FILES } = await import('./vite-globe-preview.mjs');
    const previewTextures = PREVIEW_GLOBE_FILES.filter((name) => existsSync(join(dist, 'data', 'globe', name)));
    check(previewTextures.length === 0, 'NASA globe preview textures in dist/: ' + previewTextures.join(' '));
    const earthChunks = files(join(dist, 'assets'), (path) => extname(path) === '.js')
      .filter((path) => /EarthGlobe|awNightGain/.test(readFileSync(path, 'utf8')));
    check(PREVIEW_GLOBE_FILES.length === 0 || earthChunks.length === 0,
      'NASA globe preview shader in the release bundle: ' + earthChunks.map((path) => relative(dist, path)).join(', '));
    // [night-12be] D-254: the DEV stub world (`?render=stub`, src/game/dev/stubWorld.ts) never ships.
    const leaked = files(join(dist, 'assets'), (path) => extname(path) === '.js')
      .filter((path) => /airway-stub-world|__awStub/.test(readFileSync(path, 'utf8')));
    check(leaked.length === 0, 'DEV stub world in the release bundle: ' + leaked.map((path) => relative(dist, path)).join(', '));
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

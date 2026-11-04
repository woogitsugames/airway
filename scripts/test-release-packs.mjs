// [night-11u] D-193 (owner Q-74 → B): the "Long haul" pack (31–35) stays out of release builds until it ships as the
// T+4 store event; DEV/test builds keep it, so e2e:puzzles and screens-fit-320 still cover it. The puzzle index is
// built with Vite itself (production, development, and production with VITE_AW_ALL_PACKS=1) and the bundled PUZZLES
// are counted: release 30 (01–30, no pack heading level), DEV 35, override 35. Also the pure releasedLevels() rules.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { releasedLevels } from '../src/data/puzzles/packs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const temp = mkdtempSync(join(tmpdir(), 'airway-release-packs-'));

/** Bundles src/data/puzzles/index.ts the way `npm run build` / `npm run dev` would and returns its exports. */
async function bundled(mode, env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const result = await build({
      configFile: false, root: ROOT, mode, logLevel: 'silent',
      build: {
        write: false, minify: false, target: 'es2022',
        lib: { entry: resolve(ROOT, 'src/data/puzzles/index.ts'), formats: ['es'], fileName: 'puzzles' },
      },
    });
    const output = (Array.isArray(result) ? result[0] : result).output.find((chunk) => chunk.type === 'chunk');
    const file = join(temp, `${mode}-${Object.keys(env).join('-') || 'plain'}.mjs`);
    writeFileSync(file, output.code);
    return await import(pathToFileURL(file).href);
  } finally {
    for (const key of Object.keys(env)) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
}

try {
  await test('release build (vite build, production): 30 puzzles, 01–30, no Long haul level', async () => {
    const { PUZZLES } = await bundled('production', { NODE_ENV: 'production' });
    assert(PUZZLES.length === 30, `expected 30, got ${PUZZLES.length}`);
    assert(PUZZLES[0].id === '01' && PUZZLES.at(-1).id === '30', `range ${PUZZLES[0].id}–${PUZZLES.at(-1).id}`);
  });
  await test('DEV build (development mode): 35 puzzles, Long haul 31–35 included', async () => {
    const { PUZZLES } = await bundled('development', { NODE_ENV: 'development' });
    assert(PUZZLES.length === 35, `expected 35, got ${PUZZLES.length}`);
    assert(PUZZLES.at(-1).id === '35', `last ${PUZZLES.at(-1).id}`);
  });
  await test('release build with VITE_AW_ALL_PACKS=1 (the T+4 check build): 35 puzzles', async () => {
    const { PUZZLES } = await bundled('production', { NODE_ENV: 'production', VITE_AW_ALL_PACKS: '1' });
    assert(PUZZLES.length === 35, `expected 35, got ${PUZZLES.length}`);
  });
  await test('releasedLevels: a hidden pack ends at the next pack; visible packs and showHidden keep everything', async () => {
    const levels = ['01', '02', '03', '04', '05', '06'].map((id) => ({ id }));
    const packs = [
      { id: 'a', firstLevel: '03', nameKey: 'puzzle.pack.a', hiddenInRelease: true },
      { id: 'b', firstLevel: '05', nameKey: 'puzzle.pack.b' },
    ];
    assert(releasedLevels(levels, false, packs).map((l) => l.id).join() === '01,02,05,06', 'hidden pack 03–04');
    assert(releasedLevels(levels, true, packs).length === 6, 'showHidden keeps all');
    assert(releasedLevels(levels, false, [packs[1]]).length === 6, 'visible pack keeps all');
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(`SUMMARY test:release-packs seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

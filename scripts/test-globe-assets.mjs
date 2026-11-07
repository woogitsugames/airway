// [ext-03 G1] D-170/D-171: the production globe textures in public/data/globe/ (NASA Blue Marble NG July 2004,
// Black Marble 2016, NOAA ETOPO5, own clouds; docs/ASSETS.md). Checks the committed manifest against the files:
// SHA-256, byte size, image format and dimensions (2:1, power of two), per-file caps and the folder total.
//   node scripts/test-globe-assets.mjs           -> check (test:fast)
//   node scripts/test-globe-assets.mjs --write   -> rewrite manifest.json after a deliberate re-bake
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public/data/globe');
const MANIFEST = join(DIR, 'manifest.json');
const KB = 1000;
/**
 * [ext-04 E4] D-285: the Linoryt print needs only the elevation raster (relief hatching and the terrain heights; the
 * coast field and the plane atlas are built at load, D-298/D-299). The photo textures (Blue Marble, Black Marble, Mapa,
 * clouds) were removed with Satelita and Mapa; nothing may bring them back unnoticed.
 */
const CAP = { 'elevation-2048.png': 350 * KB };
const TOTAL_CAP = 350 * KB;
const SOURCES = {
  'elevation-2048.png': 'NOAA ETOPO5 land elevation, sqrt-encoded 8 bit (m = (v/255)^2 * 8000); public domain',
};
const REMOVED = ['day-4096.jpg', 'day-2048.jpg', 'night-2048.jpg', 'night-1024.jpg', 'clouds-2048.png', 'map-4096.jpg', 'map-2048.jpg'];

/** Width/height from a PNG IHDR or a JPEG SOFn marker. */
export function imageSize(bytes) {
  if (bytes.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i + 9 < bytes.length;) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const length = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: 'jpeg', width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + length;
    }
  }
  return null;
}

function describe() {
  const files = {};
  for (const name of readdirSync(DIR).filter((n) => n !== 'manifest.json').sort()) {
    const bytes = readFileSync(join(DIR, name));
    files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      ...imageSize(bytes), source: SOURCES[name] ?? null };
  }
  return files;
}

let passed = 0, failed = 0;
const check = (ok, message) => { if (ok) passed++; else { failed++; console.log('FAIL ' + message); } };
if (process.argv.includes('--write')) {
  writeFileSync(MANIFEST, JSON.stringify({ format: 'airway-globe-assets-v1', bake: 'python3 -I dev/globe-look/bake.py',
    files: describe() }, null, 2) + '\n');
  console.log('wrote ' + MANIFEST);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const actual = describe();
check(manifest.format === 'airway-globe-assets-v1', 'manifest format');
check(JSON.stringify(Object.keys(actual)) === JSON.stringify(Object.keys(CAP).sort()),
  'files in public/data/globe are exactly ' + Object.keys(CAP).sort().join(', ') + ' (got ' + Object.keys(actual).join(', ') + ')');
let total = 0;
for (const [name, file] of Object.entries(actual)) {
  const listed = manifest.files[name];
  total += file.bytes;
  check(!!listed, name + ' listed in manifest.json');
  check(listed?.sha256 === file.sha256 && listed?.bytes === file.bytes, name + ' matches manifest (re-bake? run with --write)');
  check(file.format === (name.endsWith('.png') ? 'png' : 'jpeg'), name + ' format ' + file.format);
  check(file.width === 2 * file.height && (file.width & (file.width - 1)) === 0, name + ' is 2:1 power of two (' + file.width + 'x' + file.height + ')');
  check(String(file.width) === name.match(/-(\d+)\./)?.[1], name + ' width matches its name');
  check(file.bytes <= (CAP[name] ?? 0), name + ' ' + file.bytes + ' B over cap ' + CAP[name]);
  check(typeof file.source === 'string' && file.source.length > 0, name + ' has a source/licence line');
}
check(total <= TOTAL_CAP, 'globe assets total ' + total + ' B over ' + TOTAL_CAP);
// No source file may still ask for a removed photo texture.
const { execSync } = await import('node:child_process');
for (const name of REMOVED) {
  const hits = execSync(`git grep -l -F ${JSON.stringify(name)} -- src public index.html vite.config.ts || true`, { cwd: ROOT, encoding: 'utf8' }).trim();
  check(hits === '', name + ' is not referenced by src/public/index.html (got ' + hits.replace(/\n/g, ', ') + ')');
}
console.log(`SUMMARY test:globe-assets files=${Object.keys(actual).length} bytes=${total} passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;

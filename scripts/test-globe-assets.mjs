// [ext-03 G1] D-170/D-171: the production globe textures in public/data/globe/ (NASA Blue Marble NG July 2004,
// Black Marble 2016, NOAA ETOPO5; docs/ASSETS.md). Checks the committed manifest against the files:
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
/**
 * [night-70a R1] D-323: the realistic globe brings NASA back as the one look (DEV preview `?look=earth` until the flip):
 * Blue Marble July 2004 by day, Black Marble 2016 by night, WebP (half the JPEG bytes at the same quality, measured),
 * baked by dev/globe-look/bake-earth.py. A cap per file (~10 % over the bake) instead of the old 350 kB folder total;
 * the folder total is the sum of the caps. Mapa and clouds stay removed (D-285 L2), as do the old JPEG names.
 */
const CAP = {
  'elevation-2048.png': 350 * KB,
  'day-4096.webp': 590 * KB,
  'day-2048.webp': 190 * KB,
  'night-2048.webp': 70 * KB,
  'night-1024.webp': 22 * KB,
};
const TOTAL_CAP = Object.values(CAP).reduce((sum, cap) => sum + cap, 0);
const BLUE_MARBLE = 'NASA Blue Marble NG July 2004 (world.topo.bathy.200407.3x5400x2700), resized; public domain';
const BLACK_MARBLE = 'NASA Black Marble 2016 colour (BlackMarble_2016_3km), resized; public domain';
const SOURCES = {
  'elevation-2048.png': 'NOAA ETOPO5 land elevation, sqrt-encoded 8 bit (m = (v/255)^2 * 8000); public domain',
  'day-4096.webp': BLUE_MARBLE,
  'day-2048.webp': BLUE_MARBLE,
  'night-2048.webp': BLACK_MARBLE,
  'night-1024.webp': BLACK_MARBLE,
};
const REMOVED = ['day-4096.jpg', 'day-2048.jpg', 'night-2048.jpg', 'night-1024.jpg', 'clouds-2048.png', 'map-4096.jpg', 'map-2048.jpg',
  'map-4096.webp', 'map-2048.webp', 'clouds-2048.webp'];

/** Width/height from a PNG IHDR, a JPEG SOFn marker or a WebP VP8/VP8L/VP8X header. */
export function imageSize(bytes) {
  if (bytes.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') { // [night-70a R1]
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { format: 'webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { format: 'webp', width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
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
  writeFileSync(MANIFEST, JSON.stringify({ format: 'airway-globe-assets-v1', bake: 'python3 -I dev/globe-look/bake.py (elevation); python3 -I dev/globe-look/bake-earth.py (day, night)',
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
  check(file.format === ({ png: 'png', webp: 'webp' }[name.split('.').pop()] ?? 'jpeg'), name + ' format ' + file.format);
  check(file.width === 2 * file.height && (file.width & (file.width - 1)) === 0, name + ' is 2:1 power of two (' + file.width + 'x' + file.height + ')');
  check(String(file.width) === name.match(/-(\d+)\./)?.[1], name + ' width matches its name');
  check(file.bytes <= (CAP[name] ?? 0), name + ' ' + file.bytes + ' B over cap ' + CAP[name]);
  check(typeof file.source === 'string' && file.source.length > 0, name + ' has a source/licence line');
}
check(total <= TOTAL_CAP, 'globe assets total ' + total + ' B over ' + TOTAL_CAP);
// [night-70a R1] The earth look asks for exactly the photo textures listed here, and the release build leaves out the same
// set while the look is a preview (scripts/vite-globe-preview.mjs).
{
  const earth = readFileSync(join(ROOT, 'src/render/globe/earth.ts'), 'utf8');
  const asked = [...earth.matchAll(/'((?:day|night)-\d+\.webp)'/g)].map((m) => m[1]).sort();
  const photos = Object.keys(CAP).filter((name) => /^(day|night)-/.test(name)).sort();
  check(JSON.stringify(asked) === JSON.stringify(photos), 'earth.ts EARTH_TEXTURES = ' + photos.join(', ') + ' (got ' + asked.join(', ') + ')');
  const { PREVIEW_GLOBE_FILES } = await import('./vite-globe-preview.mjs');
  check(PREVIEW_GLOBE_FILES.length === 0 || JSON.stringify([...PREVIEW_GLOBE_FILES].sort()) === JSON.stringify(photos),
    'release leaves out exactly the preview photo textures (got ' + PREVIEW_GLOBE_FILES.join(', ') + ')');
}
// No source file may still ask for a removed photo texture.
const { execSync } = await import('node:child_process');
for (const name of REMOVED) {
  const hits = execSync(`git grep -l -F ${JSON.stringify(name)} -- src public index.html vite.config.ts || true`, { cwd: ROOT, encoding: 'utf8' }).trim();
  check(hits === '', name + ' is not referenced by src/public/index.html (got ' + hits.replace(/\n/g, ', ') + ')');
}
console.log(`SUMMARY test:globe-assets files=${Object.keys(actual).length} bytes=${total} passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;

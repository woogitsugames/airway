#!/usr/bin/env node
// [task-24] Capacitor Android build, offline procedural SVG rasterizer, external signing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { checkNativeAlignment, describe } from './native-align.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const ARGS = process.argv.slice(2);
const MODES = new Set(['--assets-only', '--release-apk', '--release-aab']);
if (ARGS.length > 1 || ARGS.some((arg) => !MODES.has(arg))) {
  console.error('Usage: node scripts/build-android.mjs [--assets-only|--release-apk|--release-aab]');
  process.exit(2);
}

function attributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function loadShapes(file) {
  const svg = readFileSync(join(ROOT, 'resources', file), 'utf8');
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!viewBox || viewBox[1] !== viewBox[2]) throw new Error('Expected a square SVG viewBox: ' + file);
  const shapes = [];
  for (const match of svg.matchAll(/<(rect|polygon|circle)\b([^>]*)\/>/g)) {
    const props = attributes(match[2]);
    if (!/^#[0-9a-fA-F]{6}$/.test(props.fill ?? '')) throw new Error('Unsupported fill in ' + file);
    const rgb = [1, 3, 5].map((i) => parseInt(props.fill.slice(i, i + 2), 16));
    const shape = { type: match[1], rgb };
    if (match[1] === 'rect') {
      Object.assign(shape, { x: Number(props.x), y: Number(props.y), width: Number(props.width), height: Number(props.height) });
    } else if (match[1] === 'circle') {
      Object.assign(shape, { cx: Number(props.cx), cy: Number(props.cy), radius: Number(props.r) });
    } else {
      const nums = (props.points ?? '').trim().split(/[\s,]+/).map(Number);
      if (nums.length < 6 || nums.length % 2) throw new Error('Invalid polygon: ' + file);
      shape.points = Array.from({ length: nums.length / 2 }, (_, i) => [nums[i * 2], nums[i * 2 + 1]]);
    }
    shapes.push(shape);
  }
  if (!shapes.length) throw new Error('No SVG shapes found: ' + file);
  return { view: Number(viewBox[1]), shapes };
}

function inside(shape, x, y) {
  if (shape.type === 'rect') {
    return x >= shape.x && y >= shape.y && x < shape.x + shape.width && y < shape.y + shape.height;
  }
  if (shape.type === 'circle') return (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.radius ** 2;
  let hit = false;
  const points = shape.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const val of buf) {
    crc ^= val;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(name, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, data.length + 8)), data.length + 8);
  return out;
}

function svgToPng(svg, size, round = false) {
  const { view, shapes } = svg;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const stride = size * 4 + 1;
  const samples = 2; // Four coverage samples make diagonal plane wings readable.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, coverage = 0;
      for (let dy = 0; dy < samples; dy++) for (let dx = 0; dx < samples; dx++) {
        const u = x + (dx + 0.5) / samples;
        const v = y + (dy + 0.5) / samples;
        if (round && (u - size / 2) ** 2 + (v - size / 2) ** 2 > (size / 2) ** 2) continue;
        const px = u * view / size, py = v * view / size;
        let color = null;
        for (const shape of shapes) if (inside(shape, px, py)) color = shape.rgb;
        if (color) { r += color[0]; g += color[1]; b += color[2]; coverage++; }
      }
      const index = y * stride + 1 + x * 4;
      if (coverage) {
        raw[index] = Math.round(r / coverage);
        raw[index + 1] = Math.round(g / coverage);
        raw[index + 2] = Math.round(b / coverage);
        raw[index + 3] = Math.round(255 * coverage / (samples * samples));
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6; // 8-bit RGBA, no palette or interlacing.
  const magic = Buffer.from('89504e470d0a1a0a', 'hex');
  return Buffer.concat([magic, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function generateAssets() {
  const icon = loadShapes('icon.svg');
  const foreground = loadShapes('icon-foreground.svg');
  const splash = loadShapes('splash.svg');
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  let count = 0;
  for (const [density, scale] of Object.entries(densities)) {
    const dir = join(ANDROID, 'app/src/main/res/mipmap-' + density);
    mkdirSync(dir, { recursive: true });
    for (const [name, source, size, round] of [
      ['ic_launcher.png', icon, Math.round(48 * scale), false],
      ['ic_launcher_round.png', icon, Math.round(48 * scale), true],
      ['ic_launcher_foreground.png', foreground, Math.round(108 * scale), false],
    ]) {
      writeFileSync(join(dir, name), svgToPng(source, size, round));
      count++;
    }
  }
  const splashDir = join(ANDROID, 'app/src/main/res/drawable-nodpi');
  mkdirSync(splashDir, { recursive: true });
  writeFileSync(join(splashDir, 'splash.png'), svgToPng(splash, 288));
  return count + 1;
}

function run(command, args, cwd = ROOT) {
  const win = process.platform === 'win32';
  const executable = win && (command === 'npm' || command === 'npx') ? command + '.cmd' : command;
  const result = spawnSync(executable, args, { cwd, stdio: 'inherit', shell: win });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed (exit ' + (result.status ?? 'signal') + ')');
}

function validateSigning() {
  const keystore = process.env.AW_KEYSTORE;
  const password = process.env.AW_KEYSTORE_PASS;
  if (!keystore || !isAbsolute(keystore) || !existsSync(keystore) || !password) {
    throw new Error('Release needs AW_KEYSTORE (absolute existing path) and AW_KEYSTORE_PASS');
  }
  const real = realpathSync(keystore);
  const relativePath = relative(ROOT, real);
  if (relativePath === '' || (relativePath !== '..' && !relativePath.startsWith('..' + sep) && !isAbsolute(relativePath))) {
    throw new Error('Release keystore must be outside the repository');
  }
}

try {
  const mode = ARGS[0] ?? '--debug';
  const count = generateAssets();
  console.log('SUMMARY android:assets seed=0xA1A1 generated=' + count + ' failed=0');
  if (mode === '--assets-only') process.exit(0);
  if (!process.env.ANDROID_HOME || !existsSync(process.env.ANDROID_HOME)) {
    throw new Error('ANDROID_HOME must point to the installed Android SDK');
  }
  if (mode.startsWith('--release-')) validateSigning();
  run('npm', ['run', 'build']);
  // Pin CLI independently because task 01 intentionally omitted @capacitor/cli from the lockfile.
  run('npm', ['exec', '--yes', '--package=@capacitor/cli@8.5.3', '--', 'cap', 'sync', 'android']);
  const task = mode === '--release-aab' ? 'bundleRelease' : mode === '--release-apk' ? 'assembleRelease' : 'assembleDebug';
  run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [task], ANDROID);
  // [night-12e] D-98: Play rejects 64-bit native libraries that are not 16 KB aligned; release builds fail here.
  const output = mode === '--release-aab' ? 'app/build/outputs/bundle/release/app-release.aab'
    : mode === '--release-apk' ? 'app/build/outputs/apk/release/app-release.apk' : 'app/build/outputs/apk/debug/app-debug.apk';
  const alignment = checkNativeAlignment(readFileSync(join(ANDROID, output)), output.endsWith('.apk') ? 'apk' : 'aab');
  for (const line of describe(alignment, output)) console.log(line);
  if (!alignment.ok && mode.startsWith('--release-')) throw new Error('native libraries are not 16 KB aligned');
  console.log('SUMMARY android:build seed=0xA1A1 task=' + task + ' passed=1 failed=0');
} catch (error) {
  console.error('Android build failed: ' + error.message);
  console.error('SUMMARY android:build seed=0xA1A1 passed=0 failed=1');
  process.exitCode = 1;
}

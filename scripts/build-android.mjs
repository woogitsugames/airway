#!/usr/bin/env node
// [task-24] Capacitor Android build, offline procedural SVG rasterizer, external signing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkNativeAlignment, describe } from './native-align.mjs';
import { translations as siteTranslations } from '../site/i18n.js';
import { assertPublisherReady } from '../site/publisher.js';
import { androidAssets, write } from './icon-assets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const ARGS = process.argv.slice(2);
const MODES = new Set(['--assets-only', '--release-apk', '--release-aab']);
if (ARGS.length > 1 || ARGS.some((arg) => !MODES.has(arg))) {
  console.error('Usage: node scripts/build-android.mjs [--assets-only|--release-apk|--release-aab]');
  process.exit(2);
}

function generateAssets() {
  // [night-78a] Z, D-333: the mark, rasterizer and file list live in icon-assets.mjs (also used by build-icons.mjs).
  return write(androidAssets());
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

// [night-12az] D-246 (R3e): the App Check debug provider is for debug builds and the emulator only. A release build
// with it would send debug tokens (and log the debug secret), so it refuses the flag from the shell or a Vite .env file.
function validateAppCheck() {
  const files = ['.env', '.env.local', '.env.production', '.env.production.local'].map((name) => join(ROOT, name));
  const fromFiles = files.some((file) => existsSync(file) &&
    /^\s*VITE_FIREBASE_APPCHECK_DEBUG\s*=\s*['"]?1['"]?\s*$/m.test(readFileSync(file, 'utf8')));
  if (process.env.VITE_FIREBASE_APPCHECK_DEBUG === '1' || fromFiles) {
    throw new Error('Release builds must not use the App Check debug provider (VITE_FIREBASE_APPCHECK_DEBUG=1)');
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
  if (mode.startsWith('--release-')) { validateSigning(); validateAppCheck(); }
  // [night-11al] R7c, D-241: no store build with "[Q-01 …]" in Settings → Help → Publisher (the game copies site/i18n.js).
  if (mode.startsWith('--release-')) assertPublisherReady(siteTranslations, 'android release');
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

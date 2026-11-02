#!/usr/bin/env node
// [task-24] Deterministic, SDK-free structural checks for the Android native shell.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const appGradle = read('android/app/build.gradle');
const variables = read('android/variables.gradle');
const theme = read('android/app/src/main/res/values/styles.xml');
const nativeBack = read('android/app/src/main/java/pl/samsufi/airway/MainActivity.java');
const jsBack = read('src/platform/back.ts');
const buildScript = read('scripts/build-android.mjs');

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('FAIL ' + name);
  }
}
function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}

// Fixed seed 0xA1A1: no simulation, random state or wall-clock dependencies.
const activity = manifest.match(/<activity\b[\s\S]*?>/);
const config = activity?.[0].match(/android:configChanges="([^"]+)"/)?.[1].split('|') ?? [];
check('orientation-unlocked', !!activity && !/android:screenOrientation\s*=/.test(activity[0]) && !/setRequestedOrientation/.test(nativeBack));
check('configuration-handling', hasAll(config, ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout', 'density', 'uiMode', 'keyboardHidden']));
check('foldable-resize', manifest.includes('android:resizeableActivity="true"'));
check('single-activity-launch', manifest.includes('android:launchMode="singleTask"') && manifest.includes('android:exported="true"'));
const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((match) => match[1]);
check('minimal-permissions', permissions.length === 1 && permissions[0] === 'android.permission.INTERNET');
check('sdk-versions', hasAll(variables, ['minSdkVersion = 24', 'compileSdkVersion = 36', 'targetSdkVersion = 36']));
check('owner-application-id', hasAll(appGradle, ["namespace = 'pl.samsufi.airway'", "applicationId = 'pl.samsufi.airway'"]));
check('edge-to-edge', hasAll(theme, ['android:statusBarColor', 'android:navigationBarColor', '@android:color/transparent']) && !/windowOptOutEdgeToEdgeEnforcement/.test(manifest + theme));
check('splash', theme.includes('windowSplashScreenAnimatedIcon') && existsSync(join(ROOT, 'resources/splash.svg')));
check('back-dispatch', hasAll(nativeBack, ['OnBackPressedCallback', 'getOnBackPressedDispatcher', 'airway:android-back']) && jsBack.includes("'airway:android-back'"));
check('release-env-only', hasAll(appGradle, ["System.getenv('AW_KEYSTORE')", "System.getenv('AW_KEYSTORE_PASS')", 'signingConfigs.release']) && hasAll(buildScript, ['validateSigning()', 'AW_KEYSTORE']));
check('procedural-assets', ['icon.svg', 'icon-foreground.svg', 'splash.svg'].every((file) => existsSync(join(ROOT, 'resources', file))));
check('wrapper-present', existsSync(join(ANDROID, 'gradle/wrapper/gradle-wrapper.jar')) && readFileSync(join(ANDROID, 'gradle/wrapper/gradle-wrapper.jar')).subarray(0, 2).toString() === 'PK');
check('build-flavours', hasAll(buildScript, ['assembleDebug', 'assembleRelease', 'bundleRelease', '@capacitor/cli@8.5.3']));
console.log('SUMMARY test:android-config seed=0xA1A1 checks=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
if (failed) process.exitCode = 1;

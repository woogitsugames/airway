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
// [night-12q] D-133 (Q-54 → B): minSdk 29 (Android 10) — older WebViews no longer get Chrome updates (Chrome 139+
// needs Android 10) and are not tested; target/compile: play-target-sdk-floor (D-98).
check('sdk-versions', /minSdkVersion = 29\b/.test(variables) && !/minSdk(Version)?\s*[= ]\s*\d/.test(appGradle));
// [night-12e] D-98 store-requirement guards (R1m): Play requires targetSdk ≥ 36 for new apps and updates from
// 31.08.2026 (raise PLAY_MIN_TARGET_SDK every August), and release builds check 16 KB native-library alignment.
const PLAY_MIN_TARGET_SDK = 36;
const sdk = (name) => Number(variables.match(new RegExp(name + '\\s*=\\s*(\\d+)'))?.[1] ?? NaN);
check('play-target-sdk-floor', sdk('targetSdkVersion') >= PLAY_MIN_TARGET_SDK && sdk('compileSdkVersion') >= sdk('targetSdkVersion') &&
  appGradle.includes('targetSdk = rootProject.ext.targetSdkVersion') && !/targetSdk(Version)?\s*[= ]\s*\d/.test(appGradle));
check('release-16k-alignment', buildScript.includes("from './native-align.mjs'") &&
  /checkNativeAlignment\([\s\S]*?\)/.test(buildScript) && buildScript.includes("throw new Error('native libraries are not 16 KB aligned')"));
check('owner-application-id', hasAll(appGradle, ["namespace = 'pl.samsufi.airway'", "applicationId = 'pl.samsufi.airway'"]));
check('edge-to-edge', hasAll(theme, ['android:statusBarColor', 'android:navigationBarColor', '@android:color/transparent']) && !/windowOptOutEdgeToEdgeEnforcement/.test(manifest + theme));
check('splash', theme.includes('windowSplashScreenAnimatedIcon') && existsSync(join(ROOT, 'resources/splash.svg')));
check('back-dispatch', hasAll(nativeBack, ['OnBackPressedCallback', 'getOnBackPressedDispatcher', 'airway:android-back']) && jsBack.includes("'airway:android-back'"));
check('release-env-only', hasAll(appGradle, ["System.getenv('AW_KEYSTORE')", "System.getenv('AW_KEYSTORE_PASS')", 'signingConfigs.release']) && hasAll(buildScript, ['validateSigning()', 'AW_KEYSTORE']));
check('procedural-assets', ['icon.svg', 'icon-foreground.svg', 'splash.svg'].every((file) => existsSync(join(ROOT, 'resources', file))));
check('wrapper-present', existsSync(join(ANDROID, 'gradle/wrapper/gradle-wrapper.jar')) && readFileSync(join(ANDROID, 'gradle/wrapper/gradle-wrapper.jar')).subarray(0, 2).toString() === 'PK');
check('build-flavours', hasAll(buildScript, ['assembleDebug', 'assembleRelease', 'bundleRelease', '@capacitor/cli@8.5.3']));
// [night-12c] D-92: Auto Backup carries the game to a new phone (saves, logbook, streak, settings), include-only,
// and never the install marker that makes a restored phone forget the leaderboard identity.
const backupXml = (name) => existsSync(join(ANDROID, 'app/src/main/res/xml', name + '.xml'))
  ? read('android/app/src/main/res/xml/' + name + '.xml').replace(/<!--[\s\S]*?-->/g, '') : '';
const includes = (xml) => [...xml.matchAll(/<include\s+domain="([^"]+)"\s+path="([^"]*)"\s*\/>/g)]
  .map((match) => match[1] + ':' + match[2]).sort();
const section = (xml, tag) => xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'))?.[1] ?? '';
const legacyRules = backupXml('backup_rules');
const modernRules = backupXml('data_extraction_rules');
const ruleSets = [includes(legacyRules), includes(section(modernRules, 'cloud-backup')), includes(section(modernRules, 'device-transfer'))];
check('backup-enabled', manifest.includes('android:allowBackup="true"') &&
  manifest.includes('android:fullBackupContent="@xml/backup_rules"') &&
  manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"') && !!legacyRules && !!modernRules);
check('backup-include-only', ruleSets[0].length > 0 && ruleSets.every((set) => set.join() === ruleSets[0].join()) &&
  !/<exclude\b/.test(legacyRules + modernRules) && ruleSets[0].every((rule) => !/:(\.?|\/)$/.test(rule)));
const storageSource = read('src/platform/storage.ts');
const savePaths = [...(storageSource.match(/SAVE_PATHS\s*=\s*\{([^}]*)\}/)?.[1] ?? '').matchAll(/'([^']+\.json)'/g)].map((match) => 'file:' + match[1]);
const preferencesGroup = /Preferences\.configure\(/.test(read('src/main.ts') + storageSource) ? null : 'sharedpref:CapacitorStorage.xml';
check('backup-covers-game-stores', savePaths.length === 2 && !!preferencesGroup &&
  [...savePaths, preferencesGroup, 'root:app_webview/Default/Local Storage/'].every((rule) => ruleSets[0].includes(rule)));
const installSource = existsSync(join(ROOT, 'src/platform/install.ts')) ? read('src/platform/install.ts') : '';
const marker = installSource.match(/INSTALL_MARKER_PATH = '([^']+)'/)?.[1];
check('backup-leaves-install-marker', !!marker && installSource.includes('Directory.LibraryNoCloud') &&
  !(legacyRules + modernRules).includes(marker) && !savePaths.includes('file:' + marker) &&
  read('src/main.ts').includes('forgetIdentityOnNewInstall(') && read('src/net/index.ts').includes('IDENTITY_KEYS'));
// [night-12l] D-115 (R1d): Android 13+ per-app language lists exactly the game's languages (src/i18n), the same
// set as iOS CFBundleLocalizations (D-91); the in-game choice is read before the device language (D-31).
const localeFile = 'android/app/src/main/res/xml/locales_config.xml';
const localeConfig = existsSync(join(ROOT, localeFile)) ? read(localeFile) : '';
const declaredLocales = [...localeConfig.matchAll(/<locale\s+android:name="([^"]+)"\s*\/>/g)].map((m) => m[1]).sort();
// [night-12w] R7f: the game's languages are the entries of the one language table (src/i18n/languages.ts).
const languageTable = read('src/i18n/languages.ts');
const gameLanguages = [...(languageTable.slice(languageTable.indexOf('export const LANGUAGE_ENTRIES'),
  languageTable.indexOf('satisfies readonly LanguageEntry')).matchAll(/\bcode: '([a-z-]+)'/g))].map((m) => m[1]).sort();
const iosLocales = [...(read('ios/App/App/Info.plist').match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '')
  .matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]).sort();
check('per-app-locale-config', manifest.includes('android:localeConfig="@xml/locales_config"') &&
  localeConfig.includes('<locale-config') && gameLanguages.length >= 2 &&
  declaredLocales.join() === gameLanguages.join() && declaredLocales.join() === iosLocales.join());
// [night-12p] D-124: three r163+ has no WebGL 1 path, and Android WebView's WebGL 2 needs OpenGL ES 3.0, so the
// manifest declares exactly one required glEsVersion of 0x00030000 (Play device filter). ES 3.0 exists from API 18,
// so it never conflicts with minSdk (29 since D-133).
const glEs = [...manifest.matchAll(/<uses-feature\b[^>]*android:glEsVersion="([^"]+)"[^>]*>/g)];
const threeVersion = JSON.parse(read('package.json')).dependencies?.three ?? '';
const threeMinor = Number(threeVersion.match(/^\D*0\.(\d+)/)?.[1] ?? NaN);
check('play-gles3-filter', glEs.length === 1 && Number(glEs[0][1]) === 0x30000 &&
  /android:required="true"/.test(glEs[0][0]) && threeMinor >= 163 && sdk('minSdkVersion') >= 29);
const i18nSource = read('src/i18n/index.ts');
check('in-game-language-wins', /savedLanguage\(\) \?\? deviceLanguage\(\)/.test(i18nSource) && i18nSource.includes('navigator.languages'));
console.log('SUMMARY test:android-config seed=0xA1A1 checks=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
if (failed) process.exitCode = 1;

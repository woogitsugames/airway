// [task-25] Static iOS config contract, independent of macOS / Xcode.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const IOS = join(ROOT, 'ios', 'App', 'App');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const plist = read('ios/App/App/Info.plist');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const delegate = read('ios/App/App/AppDelegate.swift');
const podfile = read('ios/App/Podfile');
const failed = [];
let checks = 0;

function check(name, result) {
  checks += 1;
  if (!result) {
    failed.push(name);
    console.error('FAIL ' + name);
  }
}
function orientations(key) {
  const start = plist.indexOf('<key>' + key + '</key>');
  if (start === -1) return [];
  const section = plist.slice(start).match(/<array>([\s\S]*?)<\/array>/);
  if (!section) return [];
  return [...section[1].matchAll(/<string>([^<]+)<\/string>/g)].map((match) => match[1]);
}
const expected = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
];
check('Airway display name', /<key>CFBundleDisplayName<\/key>\s*<string>Airway<\/string>/.test(plist));
check('portrait and landscape on iPhone', expected.every((value) => orientations('UISupportedInterfaceOrientations').includes(value)));
check('portrait and landscape on iPad', [...expected, 'UIInterfaceOrientationPortraitUpsideDown'].every((value) => orientations('UISupportedInterfaceOrientations~ipad').includes(value)));
check('iPad multitasking not disabled', !/<key>UIRequiresFullScreen<\/key>\s*<true\s*\/>/.test(plist));
check('no unnecessary permission descriptions', !/<key>NS[A-Za-z0-9]+UsageDescription<\/key>/.test(plist));
// Store keys (R1c): HTTPS-only networking is exempt from export documentation, so the upload asks nothing;
// the App Store lists the game's languages from CFBundleLocalizations, which must match the i18n catalogs.
check('export compliance: no non-exempt encryption', /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\s*\/>/.test(plist));
function stringArray(key) {
  const match = plist.match(new RegExp('<key>' + key + '<\\/key>\\s*<array>([\\s\\S]*?)<\\/array>'));
  return match ? [...match[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]).sort() : [];
}
const catalogs = readdirSync(join(ROOT, 'src', 'i18n')).filter((name) => /^[a-z]{2}\.ts$/.test(name))
  .map((name) => name.slice(0, 2)).sort();
check('bundle localizations match i18n catalogs', catalogs.length >= 2 &&
  stringArray('CFBundleLocalizations').join() === catalogs.join());
check('development region is a bundled language', catalogs.includes((plist.match(/<key>CFBundleDevelopmentRegion<\/key>\s*<string>([^<]+)</) || [])[1]));
check('no background modes', !/<key>UIBackgroundModes<\/key>/.test(plist));
check('bundle ID in Debug and Release', (project.match(/PRODUCT_BUNDLE_IDENTIFIER = pl\.samsufi\.airway;/g) || []).length === 2);
check('CocoaPods minimum iOS 15', /platform\s+:ios,\s*'15\.0'/.test(podfile));
check('Capacitor pods', /pod 'Capacitor'/.test(podfile) && /pod 'CapacitorCordova'/.test(podfile));
// Every native plugin in package.json has a pod; nothing else (no ad/analytics SDKs, D-16).
const pkg = JSON.parse(read('package.json'));
const plugins = Object.keys(pkg.dependencies).filter((name) => /^@capacitor\/(?!core$|android$|ios$|cli$)/.test(name));
const podName = (name) => 'Capacitor' + name.slice('@capacitor/'.length).replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
check('plugin pods match package.json', plugins.every((name) => podfile.includes("pod '" + podName(name) + "'")) &&
  (podfile.match(/pod '/g) || []).length === plugins.length + 2);
check('no ad or tracking SDKs', !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) =>
  /admob|ads|applovin|unity-ads|ironsource|firebase|analytics|tracking|purchases|billing/i.test(name)));
const capConfig = read('capacitor.config.ts');
check('capacitor appId and name', capConfig.includes("appId: 'pl.samsufi.airway'") && capConfig.includes("appName: 'Airway'"));
check('silent switch respected by ambient session', /setCategory\(\.ambient,\s*mode:\s*\.default\)/.test(delegate));
check('privacy manifest bundled', project.includes('PrivacyInfo.xcprivacy in Resources') && existsSync(join(IOS, 'PrivacyInfo.xcprivacy')));
// [night-12ak] R1f, D-219: the manifest declares the leaderboard build's data (docs/store/privacy-declarations.md).
const manifest = read('ios/App/App/PrivacyInfo.xcprivacy');
const collected = (manifest.match(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>([\s\S]*?)\n    <\/array>/) || [])[1] || '';
const collectedDicts = [...collected.matchAll(/<dict>([\s\S]*?)<\/dict>/g)].map((m) => m[1]);
const typeOf = (dict) => (dict.match(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)</) || [])[1];
check('privacy manifest: no tracking', /<key>NSPrivacyTracking<\/key>\s*<false\s*\/>/.test(manifest) &&
  /<key>NSPrivacyTrackingDomains<\/key>\s*<array\s*\/>/.test(manifest));
check('privacy manifest: leaderboard data types (User ID, Gameplay Content)',
  collectedDicts.map(typeOf).sort().join() === 'NSPrivacyCollectedDataTypeGameplayContent,NSPrivacyCollectedDataTypeUserID');
check('privacy manifest: linked, not tracking, app functionality only', collectedDicts.length === 2 &&
  collectedDicts.every((dict) => /<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\s*\/>/.test(dict) &&
    /<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\s*\/>/.test(dict) &&
    [...dict.matchAll(/<string>(NSPrivacyCollectedDataTypePurpose[^<]+)</g)].map((m) => m[1]).join() ===
      'NSPrivacyCollectedDataTypePurposeAppFunctionality'));
check('shared archive scheme', existsSync(join(ROOT, 'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')));
check('viewport-fit cover', read('index.html').includes('viewport-fit=cover'));
check('HUD safe-area tokens', read('src/ui/base.css').includes('--aw-safe-top: env(safe-area-inset-top'));
function opaquePng(path, width, height) {
  try {
    const data = readFileSync(join(IOS, 'Assets.xcassets', path));
    return data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
      data.readUInt32BE(16) === width && data.readUInt32BE(20) === height &&
      (data[25] === 2 || data[25] === 3);
  } catch {
    return false;
  }
}
check('opaque 1024x1024 app icon', opaquePng('AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024));
check('opaque 2732x2732 splash', opaquePng('Splash.imageset/splash-2732x2732.png', 2732, 2732));
check('matching procedural SVG sources', existsSync(join(ROOT, 'ios/Brand/app-icon.svg')) && existsSync(join(ROOT, 'ios/Brand/splash.svg')));

console.log('SUMMARY test:ios-config seed=0xA1A1 checks=' + checks +
  ' passed=' + (checks - failed.length) + ' failed=' + failed.length);
if (failed.length !== 0) process.exitCode = 1;

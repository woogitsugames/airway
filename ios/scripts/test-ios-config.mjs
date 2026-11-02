// [task-25] Static iOS config contract, independent of macOS / Xcode.
import { existsSync, readFileSync } from 'node:fs';
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

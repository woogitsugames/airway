// [night-78a] Z, D-333: the app mark I-1 icons. Source SVGs and committed PNGs equal a fresh deterministic build,
// the iOS and Play icons have no alpha channel, the adaptive foreground and monochrome layers sit inside the 66/108
// safe circle, the launch images are the mark on enamel, and the mark's colours are the D-326 palette.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { ROOT, ENAMEL, CREAM, YELLOW, SAFE_DIAMETER, sourceSvgs, committedAssets, androidAssets, parseShapes } from './icon-assets.mjs';

let checks = 0, failed = 0;
function check(name, ok) { checks++; if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name); }
const same = (path, data) => existsSync(join(ROOT, path)) && readFileSync(join(ROOT, path)).equals(typeof data === 'string' ? Buffer.from(data) : data);
const info = (png) => ({ w: png.readUInt32BE(16), h: png.readUInt32BE(20), type: png[25] });
function pixels(png) { // 8-bit, filter 0 only (our encoder)
  const { w, type } = info(png), ch = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat((() => { const parts = []; for (let at = 8; at < png.length;) { const n = png.readUInt32BE(at); if (png.subarray(at + 4, at + 8).toString() === 'IDAT') parts.push(png.subarray(at + 8, at + 8 + n)); at += 12 + n; } return parts; })()));
  return { w, ch, at: (x, y) => raw.subarray(y * (w * ch + 1) + 1 + x * ch, y * (w * ch + 1) + 1 + (x + 1) * ch) };
}

const svgs = sourceSvgs();
for (const [path, text] of Object.entries(svgs)) check('svg up to date: ' + path, same(path, text));
const committed = committedAssets();
for (const [path, data] of Object.entries(committed)) check('png up to date: ' + path, same(path, data));
check('palette D-326', ENAMEL === '#0E0F0F' && CREAM === '#EFE7D3' && YELLOW === '#F3C317');
check('mark equals znak-i-1 geometry', svgs['resources/icon.svg'].includes('r="262"') && svgs['resources/icon.svg'].includes('stroke-width="44"') &&
  svgs['resources/icon.svg'].includes('r="176"') && svgs['resources/icon.svg'].includes('stroke-width="16"'));
const opaque = (path) => { const i = info(committed[path]); return i.type === 2; };
check('Play icon 512x512, no alpha', info(committed['docs/store/icon-512.png']).w === 512 && opaque('docs/store/icon-512.png'));
const set = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/';
check('iOS icons 1024x1024, no alpha (default, dark, tinted)', ['AppIcon-512@2x.png', 'AppIcon-dark.png', 'AppIcon-tinted.png']
  .every((n) => info(committed[set + n]).w === 1024 && opaque(set + n)));
const tinted = pixels(committed[set + 'AppIcon-tinted.png']);
check('iOS tinted icon is grey', [[512, 300], [100, 100], [512, 512]].every(([x, y]) => { const p = tinted.at(x, y); return p[0] === p[1] && p[1] === p[2]; }));
for (const n of ['', '-1', '-2']) {
  const path = 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732' + n + '.png';
  const p = pixels(committed[path]);
  check('launch image ' + n + ' 2732, enamel corners', info(committed[path]).w === 2732 && opaque(path) && [...p.at(0, 0)].join() === '14,15,15');
}
// Android layers: every drawn pixel inside the safe circle (66/108)
const android = androidAssets();
const R = SAFE_DIAMETER / 1024;
for (const layer of ['ic_launcher_foreground', 'ic_launcher_monochrome']) {
  const png = android['android/app/src/main/res/mipmap-xxxhdpi/' + layer + '.png'];
  const p = pixels(png), n = p.w; let outside = 0, drawn = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (p.at(x, y)[3] > 0) { drawn++; if (Math.hypot(x + .5 - n / 2, y + .5 - n / 2) > R * n / 2 + 1) outside++; }
  check(layer + ' 432px: ' + drawn + ' px, all inside the safe circle', n === 432 && drawn > 0 && outside === 0);
  check(layer + ' corner transparent', p.at(0, 0)[3] === 0);
}
const mono = pixels(android['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_monochrome.png']);
check('monochrome is one colour', [[216, 216], [216, 20 + 70]].every(([x, y]) => { const p = mono.at(x, y); return p[3] === 0 || (p[0] === 0 && p[1] === 0 && p[2] === 0); }));
const sizes = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
check('legacy 48 dp, adaptive 108 dp in 5 densities', Object.entries(sizes).every(([d, s]) => {
  const dir = 'android/app/src/main/res/mipmap-' + d + '/';
  return info(android[dir + 'ic_launcher.png']).w === Math.round(48 * s) && info(android[dir + 'ic_launcher_round.png']).w === Math.round(48 * s) &&
    info(android[dir + 'ic_launcher_foreground.png']).w === Math.round(108 * s);
}));
const round = pixels(android['android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png']);
check('round launcher corners transparent', round.at(0, 0)[3] === 0 && round.at(24, 24)[3] === 255);
const splash = pixels(android['android/app/src/main/res/drawable-nodpi/splash.png']);
check('Android splash mark transparent corners, inside the 192/288 circle', splash.at(0, 0)[3] === 0 && splash.w === 1152 &&
  (() => { let bad = 0; for (let y = 0; y < 1152; y += 4) for (let x = 0; x < 1152; x += 4) if (splash.at(x, y)[3] > 0 && Math.hypot(x - 576, y - 576) > 1152 * 192 / 288 / 2) bad++; return bad === 0; })());
check('foreground has no enamel tile', !svgs['resources/icon-foreground.svg'].includes('<rect'));
check('shapes parse', ['resources/icon.svg', 'resources/icon-foreground.svg', 'resources/icon-monochrome.svg', 'resources/splash.svg'].every((p) => parseShapes(svgs[p], p).shapes.length >= 4));
console.log('SUMMARY test:icons seed=0xA1A1 checks=' + checks + ' passed=' + (checks - failed) + ' failed=' + failed);
if (failed) process.exitCode = 1;

// [task-29] Source checks for localized copy, local links, image alt text and assets.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { translations } from './i18n.js';
import { createHash } from 'node:crypto';
import { LAUNCH, STORE_BADGES, STORE_HOSTS, SITE_SHOTS, storeLink } from './launch.js';

const root = dirname(fileURLToPath(import.meta.url));
const pages = ['index.html', 'privacy.html', '404.html'];
let count = 0, failures = 0;
const check = (name, test) => {
  try { assert.ok(test(), name); count++; }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
};
const keyMatches = new Set();
const keys = Object.keys(translations.en);
check('PL/EN catalog size', () => keys.length > 60 && keys.length === Object.keys(translations.pl).length);
for (const key of keys) {
  check('PL/EN value ' + key, () => typeof translations.pl[key] === 'string' && Boolean(translations.pl[key].trim()) && Boolean(translations.en[key].trim()));
}
check('Exact catalog parity', () => keys.every(k => Object.hasOwn(translations.pl, k)) && Object.keys(translations.pl).every(k => Object.hasOwn(translations.en, k)));
for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const match of html.matchAll(/data-i18n(?:-alt|-aria)?="([^"]+)"/g)) keyMatches.add(match[1]);
  check(`${page}: document language`, () => /<html lang="pl">/.test(html));
  check(`${page}: viewport safe area`, () => /viewport-fit=cover/.test(html));
  check(`${page}: stylesheet`, () => /href="\/?styles\.css"/.test(html));
  check(`${page}: JS module`, () => /src="\/?site\.js"/.test(html));
  check(`${page}: main landmark`, () => /<main\s+id="main"/.test(html));
  check(`${page}: skip link`, () => /href="#main"/.test(html));
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    const el = img[0];
    check(`${page}: image accessible alt`, () => /\balt="[^"]*"/.test(el));
    const src = el.match(/\bsrc="([^"]+)"/)?.[1];
    if (src) check(`${page}: local image ${src}`, () => existsSync(join(root, src.replace(/^\//, ''))));
  }
  for (const href of html.matchAll(/\bhref="([^"]+)"/g)) {
    const url = href[1];
    if (/^(mailto:|https?:)/.test(url)) continue;
    const [path, fragment] = url.split('#');
    // [night-11ad] 404.html uses root-absolute URLs ("/" is the site root, i.e. index.html).
    const resolved = path.split('?')[0].replace(/^\/$/, './').replace(/^\//, '');
    if (resolved && resolved !== './') check(`${page}: link ${url}`, () => existsSync(resolve(root, resolved)));
    if (fragment) {
      const target = resolved && resolved !== './' ? readFileSync(join(root, resolved), 'utf8') : html;
      check(`${page}: anchor #${fragment}`, () => target.includes(`id="${fragment}"`));
    }
  }
}
for (const key of keyMatches) check('All i18n keys exist: ' + key, () => keys.includes(key));
check('At least 65 localized references', () => keyMatches.size >= 65);
const home = readFileSync(join(root, 'index.html'), 'utf8');
// [night-11ad] R7k, D-214: real game screenshots, store links, social preview, hreflang, 404.
const shotTags = [...home.matchAll(/<img\b[^>]*data-shot="([a-z]+)"[^>]*>/g)];
check('Four screenshot previews, one per site scene', () => (home.match(/class="preview-shot"/g)||[]).length === 4 &&
  shotTags.map(m => m[1]).join() === SITE_SHOTS.scenes.join());
check('No stage-0 concept mockups on the site', () => !/game-p\.png|upgrade-p\.png|menu-p\.png|makiet|concept/i.test(home + JSON.stringify(translations)));
const sources = JSON.parse(readFileSync(join(root, 'assets/shots/sources.json'), 'utf8'));
const jpegSize = (bytes) => { // SOF0/SOF2 frame header: height, width
  for (let i = 2; i < bytes.length - 9;) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1], length = bytes.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  return null;
};
for (const language of SITE_SHOTS.languages) for (const scene of SITE_SHOTS.scenes) {
  const file = join(root, 'assets/shots', language, scene + '.jpg');
  check(`shot ${language}/${scene}: ${SITE_SHOTS.width}x${SITE_SHOTS.height} JPEG`, () => {
    const size = existsSync(file) && jpegSize(readFileSync(file));
    return size && size.width === SITE_SHOTS.width && size.height === SITE_SHOTS.height && readFileSync(file).length < 250000;
  });
  const store = join(root, '../docs/store/shots', language, scene + '-phone.png');
  check(`shot ${language}/${scene}: made from the current store PNG (npm run site:assets)`, () =>
    sources[`${language}/${scene}.jpg`] === createHash('sha256').update(readFileSync(store)).digest('hex').slice(0, 16));
}
for (const key of SITE_SHOTS.scenes.flatMap(scene => ['status', 'title', 'caption', 'alt'].map(f => `preview.${scene}.${f}`))) {
  check('Screenshot copy ' + key, () => keys.includes(key));
}
const meta = (html, name) => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`))?.[1];
const pngSize = (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
const og = pngSize(readFileSync(join(root, '../docs/store/feature-graphic.png')));
const buildSource = readFileSync(join(root, 'build.mjs'), 'utf8');
check('og:image is the feature graphic, absolute, copied by build:site', () => meta(home, 'og:image') === `${LAUNCH.origin}/assets/og-image.png` &&
  /docs\/store\/feature-graphic\.png/.test(buildSource) && /assets\/og-image\.png/.test(buildSource));
check('og:image size matches the file', () => Number(meta(home, 'og:image:width')) === og.width && Number(meta(home, 'og:image:height')) === og.height);
check('og:image alt, og:url, twitter card', () => Boolean(meta(home, 'og:image:alt')) && meta(home, 'og:url') === LAUNCH.origin + '/' &&
  meta(home, 'twitter:card') === 'summary_large_image' && keys.includes('meta.ogimage'));
for (const [page, path] of [['index.html', '/'], ['privacy.html', '/privacy.html']]) {
  const html = readFileSync(join(root, page), 'utf8');
  check(`${page}: canonical and hreflang pl/en/x-default`, () => html.includes(`<link rel="canonical" href="${LAUNCH.origin}${path}">`) &&
    ['pl', 'en'].every(code => html.includes(`<link rel="alternate" hreflang="${code}" href="${LAUNCH.origin}${path}?lang=${code}">`)) &&
    html.includes(`<link rel="alternate" hreflang="x-default" href="${LAUNCH.origin}${path}">`));
}
const notFound = readFileSync(join(root, '404.html'), 'utf8');
check('404: noindex, built, every URL root-absolute', () => /<meta name="robots" content="noindex">/.test(notFound) && /'404\.html'/.test(buildSource) &&
  [...notFound.matchAll(/\b(?:href|src)="([^"]+)"/g)].every(m => /^(\/|\?lang=|#|mailto:)/.test(m[1])));
check('404: localized title and way home', () => ['notfound.title', 'notfound.status', 'notfound.home', 'meta.notfound'].every(k => keys.includes(k) && notFound.includes(k === 'meta.notfound' ? '' : `data-i18n="${k}"`)));
for (const store of Object.keys(STORE_HOSTS)) {
  check(`store ${store}: tag on the page, disabled while its link is empty`, () =>
    new RegExp(`<span class="store-tag" data-store="${store}" aria-disabled="true">`).test(home));
  const value = LAUNCH.stores[store];
  check(`store ${store}: a configured link is the store's own https host`, () => !value || storeLink(store) !== null);
  check(`store ${store}: a configured link ships the official badge`, () => !value || existsSync(join(root, STORE_BADGES[store])));
}
// Self-check of the link guard with fake values (restored afterwards).
const saved = { ...LAUNCH.stores };
LAUNCH.stores.googlePlay = 'https://play.google.com/store/apps/details?id=games.airway';
LAUNCH.stores.appStore = 'https://example.com/airway';
check('store link guard: accepts the store host, rejects others', () => storeLink('googlePlay') !== null && storeLink('appStore') === null);
Object.assign(LAUNCH.stores, saved);
check('Store claims not linked yet', () => !/play\.google\.com|apps\.apple\.com/.test(home));
check('Canvas fallback image', () => /globe-fallback\.svg/.test(home));
check('Privacy page linked', () => /href="privacy\.html"/.test(home));
check('Language links', () => /\?lang=pl/.test(home) && /\?lang=en/.test(home));
check('Fonts present', () => ['Overpass-800.ttf','Overpass-400.ttf','OverpassMono-700.ttf','AtkinsonHyperlegibleNext-400.ttf','AtkinsonHyperlegibleNext-700.ttf'].every(f=>existsSync(join(root,'fonts',f))));
check('Font licenses present', () => ['OFL-Overpass.txt','OFL-OverpassMono.txt','OFL-AtkinsonHyperlegibleNext.txt'].every(f=>existsSync(join(root,'fonts',f))));
const css = readFileSync(join(root,'styles.css'),'utf8');
check('Small screen and reduced motion layouts', () => css.includes('@media(max-width:750px)') && css.includes('prefers-reduced-motion'));
check('No third-party font loads', () => !/@import|fonts\.googleapis/.test(css));
check('No analytics or tracking', () => ['site.js','globe.js','launch.js','index.html','privacy.html','404.html'].every(p=>!/gtag\(|google-analytics|googletagmanager|facebook\.com\/tr|document\.cookie|localStorage|sendBeacon|fetch\(/.test(readFileSync(join(root,p),'utf8'))));
const script = readFileSync(join(root,'site.js'),'utf8');
check('Translation insertion is text-only', () => !script.includes('innerHTML') && script.includes('createTextNode'));
check('No undisclosed external assets', () => [...home.matchAll(/\b(src|href)="(https?:\/\/[^"]*)"/g)].every(m => m[2].startsWith(LAUNCH.origin + '/') && /rel="(canonical|alternate)"/.test(home.slice(home.lastIndexOf('<', m.index), m.index))));
console.log(`SUMMARY test:site seed=0xA1A1 assertions=${count+failures} passed=${count} failed=${failures}`);
if (failures) process.exitCode = 1;

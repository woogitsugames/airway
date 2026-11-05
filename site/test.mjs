// [task-29] Source checks for localized copy, local links, image alt text and assets.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { translations } from './i18n.js';
import { createHash } from 'node:crypto';
import { LAUNCH, PRESS_KIT, STORE_BADGES, STORE_HOSTS, SITE_SHOTS, storeLink } from './launch.js';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { buildPressKit, pressShots, unzip } from './press-kit.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pages = ['index.html', 'privacy.html', 'terms.html', 'press.html', '404.html'];
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
  for (const match of html.matchAll(/data-i18n(?:-alt|-aria|-paragraphs)?="([^"]+)"/g)) keyMatches.add(match[1]);
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
    if (url === PRESS_KIT.zip) continue; // [night-11ae] built by build:site; checked below
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
// [night-11ad] D-218: the site follows the game glossary (D-195): an airport is a "hub", never a "terminal".
check('Glossary: no "terminal" in site copy or pages', () => !/terminal/i.test(JSON.stringify(translations) +
  pages.map(page => readFileSync(join(root, page), 'utf8')).join('')));
// [night-11ad] R7k, D-218: real game screenshots, store links, social preview, hreflang, 404.
const shotTags = [...home.matchAll(/<img\b[^>]*data-shot="([a-z]+)"[^>]*>/g)];
check('Four screenshot previews, one per site scene', () => (home.match(/class="preview-shot"/g)||[]).length === 4 &&
  shotTags.map(m => m[1]).join() === SITE_SHOTS.scenes.join());
check('No stage-0 concept mockups on the site', () => !/game-p\.png|upgrade-p\.png|menu-p\.png|makiet|concept/i.test(home + JSON.stringify(translations)));
const sources = JSON.parse(readFileSync(join(root, 'assets/shots/sources.json'), 'utf8'));
check('package.json: site:assets runs site/make-assets.mjs', () =>
  JSON.parse(readFileSync(join(root, '../package.json'), 'utf8')).scripts['site:assets'] === 'node site/make-assets.mjs');
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
for (const [page, path] of [['index.html', '/'], ['privacy.html', '/privacy.html'], ['terms.html', '/terms.html'], ['press.html', '/press.html']]) {
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
check('No analytics or tracking', () => ['site.js','globe.js','launch.js','index.html','privacy.html','terms.html','press.html','404.html'].every(p=>!/gtag\(|google-analytics|googletagmanager|facebook\.com\/tr|document\.cookie|localStorage|sendBeacon|fetch\(/.test(readFileSync(join(root,p),'utf8'))));
const script = readFileSync(join(root,'site.js'),'utf8');
check('Translation insertion is text-only', () => !script.includes('innerHTML') && script.includes('createTextNode'));
check('No undisclosed external assets', () => [...home.matchAll(/\b(src|href)="(https?:\/\/[^"]*)"/g)].every(m => m[2].startsWith(LAUNCH.origin + '/') && /rel="(canonical|alternate)"/.test(home.slice(home.lastIndexOf('<', m.index), m.index))));
// [night-11ae] R2e, D-219: press page — fact sheet, store copy, 8–10 store shots, logo, video slot, one ZIP.
const press = readFileSync(join(root, 'press.html'), 'utf8');
const storeSection = (language, heading) => readFileSync(join(root, `../docs/store/${language}.md`), 'utf8')
  .match(new RegExp(`^## ${heading}\n([\\s\\S]*?)(?=^## )`, 'm'))?.[1].trim();
check('press: linked from the home, privacy and 404 footers', () => /href="press\.html"/.test(home) &&
  /href="press\.html"/.test(readFileSync(join(root, 'privacy.html'), 'utf8')) && /href="\/press\.html"/.test(notFound));
check('press: no forms, inputs or iframes', () => !/<(form|input|textarea|select|iframe)\b/i.test(press));
const facts = ['developer', 'genre', 'platforms', 'release', 'price', 'languages', 'contact', 'website'];
for (const fact of facts) check(`press: fact sheet row ${fact}`, () => press.includes(`data-i18n="press.fact.${fact}.label"`) &&
  (['contact', 'website'].includes(fact) || press.includes(`data-i18n="press.fact.${fact}.value"`)));
check('press: contact is the site address', () => press.includes(`href="mailto:${PRESS_KIT.contact}"`) && home.includes(`mailto:${PRESS_KIT.contact}`));
// D-16 is free with no ads/IAP, but launch copy never names a price or "free" (RESEARCH R2): the price row says what is not there.
const pressCopy = (language) => Object.entries(translations[language]).filter(([key]) => key.startsWith('press.')).map(([, value]) => value).join('\n');
check('press: price row says "no ads, no purchases"', () => /bez reklam/i.test(translations.pl['press.fact.price.value']) &&
  /zakup/i.test(translations.pl['press.fact.price.value']) && /no ads/i.test(translations.en['press.fact.price.value']) && /purchase/i.test(translations.en['press.fact.price.value']));
check('press: no price or "free" in the press copy', () => !/\bfree\b|darmow|bezpłatn|za darmo|\d\s?(zł|pln|usd|eur)\b|[$€£]\s?\d/i.test(pressCopy('pl') + pressCopy('en')));
// Short and long description from docs/store/, verbatim (D-223: the store texts say "hub" too, D-195).
for (const language of SITE_SHOTS.languages) {
  check(`press ${language}: short description = docs/store/${language}.md`, () =>
    translations[language]['press.short'] === storeSection(language, 'Google Play short description'));
  check(`press ${language}: full description = docs/store/${language}.md`, () =>
    translations[language]['press.long'] === storeSection(language, 'Full description'));
}
check('press: descriptions on the page', () => press.includes('data-i18n="press.short"') && press.includes('data-i18n-paragraphs="press.long"') &&
  /createElement\('li'\)/.test(script) && !/innerHTML/.test(script));
const pressShotTags = [...press.matchAll(/<img\b[^>]*data-shot="([a-z]+)" data-shot-format="([a-z]+)"[^>]*>/g)];
check('press: 8–10 store shots on the page', () => pressShotTags.length >= 8 && pressShotTags.length <= 10);
check('press: every scene in every kit format', () => SITE_SHOTS.scenes.every(scene => PRESS_KIT.formats.every(format =>
  pressShotTags.some(m => m[1] === scene && m[2] === format))));
for (const language of SITE_SHOTS.languages) for (const scene of SITE_SHOTS.scenes) {
  const file = join(root, 'assets/shots', language, `${scene}-landscape.jpg`);
  check(`shot ${language}/${scene}-landscape: ${PRESS_KIT.landscape.width}x${PRESS_KIT.landscape.height} JPEG`, () => {
    const size = existsSync(file) && jpegSize(readFileSync(file));
    return size && size.width === PRESS_KIT.landscape.width && size.height === PRESS_KIT.landscape.height && readFileSync(file).length < 250000;
  });
  const store = join(root, '../docs/store/shots', language, scene + '-landscape.png');
  check(`shot ${language}/${scene}-landscape: made from the current store PNG (npm run site:assets)`, () =>
    sources[`${language}/${scene}-landscape.jpg`] === createHash('sha256').update(readFileSync(store)).digest('hex').slice(0, 16));
}
for (const logo of PRESS_KIT.logos) {
  check(`press logo ${logo.name}: source exists`, () => existsSync(join(root, logo.source)));
  if (logo.width) check(`press logo ${logo.name}: ${logo.width}x${logo.height} PNG from the current SVG (npm run site:assets)`, () => {
    const size = pngSize(readFileSync(join(root, logo.source)));
    const svg = PRESS_KIT.logos.find(item => item.name === logo.name.replace(/\.png$/, '.svg'));
    return size.width === logo.width && size.height === logo.height &&
      sources[logo.source.replace(/^assets\//, '')] === createHash('sha256').update(readFileSync(join(root, svg.source), 'utf8')).digest('hex').slice(0, 16);
  });
}
check('press: logo and icon shown', () => PRESS_KIT.logos.filter(logo => logo.width).every(logo => press.includes(`src="${logo.source}"`)));
check('press: video slot matches PRESS_KIT.video', () => PRESS_KIT.video
  ? press.includes('data-i18n="press.video.ready"') && existsSync(join(root, PRESS_KIT.video))
  : press.includes('data-i18n="press.video.pending"') && !press.includes('press.video.ready'));
check('press: one ZIP link, built by build:site', () => (press.match(new RegExp(`href="${PRESS_KIT.zip.replace('.', '\\.')}"`, 'g')) || []).length === 1 &&
  /buildPressKit\(root, join\(output, PRESS_KIT\.zip\)\)/.test(buildSource) && /'press\.html'/.test(buildSource));
const kitDir = mkdtempSync(join(tmpdir(), 'airway-press-'));
try {
  const kitFile = join(kitDir, PRESS_KIT.zip);
  let built = null, entries = [];
  check('press ZIP: builds from the sources', () => { built = buildPressKit(root, kitFile); return existsSync(kitFile); });
  check('press ZIP: reads back with valid CRCs', () => { entries = unzip(readFileSync(kitFile)); return entries.length === built?.entries.length; });
  const names = entries.map(entry => entry.name);
  const prefix = PRESS_KIT.folder + '/';
  check('press ZIP: one top folder', () => names.length > 0 && names.every(name => name.startsWith(prefix)));
  for (const language of SITE_SHOTS.languages) {
    const shots = names.filter(name => name.startsWith(`${prefix}screenshots/${language}/`));
    check(`press ZIP ${language}: 8–10 full-size store shots`, () => shots.length >= 8 && shots.length <= 10);
    const readme = entries.find(entry => entry.name === `${prefix}README-${language}.txt`)?.data.toString('utf8') ?? '';
    check(`press ZIP ${language}: README with facts, both descriptions, contents`, () => readme.includes(translations[language]['press.long']) &&
      readme.includes(translations[language]['press.short']) && readme.includes(PRESS_KIT.contact) &&
      readme.includes(translations[language]['press.fact.price.value']) && shots.every(name => readme.includes(name.slice(prefix.length))));
  }
  for (const shot of pressShots()) {
    check(`press ZIP: ${shot.name} is the store PNG byte for byte`, () =>
      entries.find(entry => entry.name === prefix + shot.name)?.data.equals(readFileSync(join(root, shot.source))));
  }
  check('press ZIP: full-size shots (1080×1920 phone, 1920×1080 landscape)', () => pressShots().every(shot => {
    const size = pngSize(readFileSync(join(root, shot.source)));
    return shot.format === 'phone' ? size.width === 1080 && size.height === 1920 : size.width === 1920 && size.height === 1080;
  }));
  check('press ZIP: every logo file', () => PRESS_KIT.logos.every(logo => names.includes(`${prefix}logo/${logo.name}`)));
  check('press ZIP: video when configured', () => !PRESS_KIT.video || names.some(name => name.startsWith(`${prefix}video/`)));
  check('press ZIP: reproducible', () => { buildPressKit(root, kitFile + '.2'); return readFileSync(kitFile).equals(readFileSync(kitFile + '.2')); });
} finally {
  rmSync(kitDir, { recursive: true, force: true });
}
// [night-11an] R7b, D-244: terms of use page — built like privacy.html, linked from every other footer, the R7b
// leaderboard rules present, the draft banner kept; a release build refuses bracketed placeholders.
const termsPage = readFileSync(join(root, 'terms.html'), 'utf8');
check('terms: built by build:site', () => /'terms\.html'/.test(buildSource));
check('terms: canonical/meta handled by site.js', () => /terms: '\/terms\.html'/.test(script) && /terms: \{ description: 'meta\.terms'/.test(script));
for (const page of pages.filter(p => p !== 'terms.html')) {
  const html = readFileSync(join(root, page), 'utf8');
  const footer = html.slice(html.indexOf('<footer'));
  check(`${page}: footer links the terms`, () => new RegExp(`href="/?terms\\.html" data-nav-lang data-i18n="footer\\.terms"`).test(footer));
}
check('terms: footer links back to the privacy policy', () => termsPage.slice(termsPage.indexOf('<footer')).includes('href="privacy.html" data-nav-lang data-i18n="footer.privacy"'));
const termsSections = [...termsPage.matchAll(/data-i18n="terms\.s(\d+)\.title"/g)].map(m => Number(m[1]));
const termsCount = keys.filter(k => /^terms\.s\d+\.title$/.test(k)).length;
check('terms: every catalog section on the page, in order, bodies as paragraphs', () => termsCount >= 8 &&
  termsSections.join() === Array.from({ length: termsCount }, (_, i) => i + 1).join() &&
  termsSections.every(n => termsPage.includes(`data-i18n-paragraphs="terms.s${n}.body"`)));
check('terms: draft banner, "to verify with a lawyer", not legal advice', () => termsPage.includes('data-i18n="terms.warning"') &&
  /do weryfikacji z prawnikiem/.test(translations.pl['terms.warning']) && /porada prawna/.test(translations.pl['terms.warning']) &&
  /verified with a lawyer/.test(translations.en['terms.warning']) && /legal advice/.test(translations.en['terms.warning']));
check('terms: no forms, inputs or iframes', () => !/<(form|input|textarea|select|iframe)\b/i.test(termsPage));
const legalGaps = ['pl', 'en'].flatMap(l => Object.entries(translations[l]).filter(([k, v]) => /^(terms|privacy)\./.test(k) && /\[[^\]]+\]/.test(v)).map(([k]) => `${l}:${k}`));
if (process.env.AIRWAY_RELEASE === '1') check('release: terms and privacy texts have no bracketed placeholders', () => legalGaps.length === 0);
else if (legalGaps.length) console.log(`note: ${legalGaps.length} terms/privacy texts with [placeholders]; AIRWAY_RELEASE=1 test:site fails until they are filled`);
console.log(`SUMMARY test:site seed=0xA1A1 assertions=${count+failures} passed=${count} failed=${failures}`);
if (failures) process.exitCode = 1;

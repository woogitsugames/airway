// [task-29] Source checks for localized copy, local links, image alt text and assets.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { translations } from './i18n.js';

const root = dirname(fileURLToPath(import.meta.url));
const pages = ['index.html', 'privacy.html'];
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
  check(`${page}: stylesheet`, () => /href="styles\.css"/.test(html));
  check(`${page}: JS module`, () => /src="site\.js"/.test(html));
  check(`${page}: main landmark`, () => /<main\s+id="main"/.test(html));
  check(`${page}: skip link`, () => /href="#main"/.test(html));
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    const el = img[0];
    check(`${page}: image accessible alt`, () => /\balt="[^"]*"/.test(el));
    const src = el.match(/\bsrc="([^"]+)"/)?.[1];
    if (src) check(`${page}: local image ${src}`, () => existsSync(join(root, src)));
  }
  for (const href of html.matchAll(/\bhref="([^"]+)"/g)) {
    const url = href[1];
    if (/^(mailto:|https?:)/.test(url)) continue;
    const [path, fragment] = url.split('#');
    const resolved = path.split('?')[0];
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
check('Three screenshot previews', () => (home.match(/class="preview-shot"/g)||[]).length === 3);
check('Store claims not linked yet', () => !/play\.google\.com|apps\.apple\.com/.test(home));
check('Canvas fallback image', () => /globe-fallback\.svg/.test(home));
check('Privacy page linked', () => /href="privacy\.html"/.test(home));
check('Language links', () => /\?lang=pl/.test(home) && /\?lang=en/.test(home));
check('Fonts present', () => ['Overpass-800.ttf','Overpass-400.ttf','OverpassMono-700.ttf','AtkinsonHyperlegibleNext-400.ttf','AtkinsonHyperlegibleNext-700.ttf'].every(f=>existsSync(join(root,'fonts',f))));
check('Font licenses present', () => ['OFL-Overpass.txt','OFL-OverpassMono.txt','OFL-AtkinsonHyperlegibleNext.txt'].every(f=>existsSync(join(root,'fonts',f))));
const css = readFileSync(join(root,'styles.css'),'utf8');
check('Small screen and reduced motion layouts', () => css.includes('@media(max-width:750px)') && css.includes('prefers-reduced-motion'));
check('No third-party font loads', () => !/@import|fonts\.googleapis/.test(css));
check('No analytics or tracking', () => ['site.js','globe.js','index.html','privacy.html'].every(p=>!/gtag\(|google-analytics|googletagmanager|facebook\.com\/tr|document\.cookie|localStorage|sendBeacon|fetch\(/.test(readFileSync(join(root,p),'utf8'))));
const script = readFileSync(join(root,'site.js'),'utf8');
check('Translation insertion is text-only', () => !script.includes('innerHTML') && script.includes('createTextNode'));
check('No undisclosed external assets', () => !/\b(src|href)="https?:\/\//.test(home));
console.log(`SUMMARY test:site seed=0xA1A1 assertions=${count+failures} passed=${count} failed=${failures}`);
if (failures) process.exitCode = 1;

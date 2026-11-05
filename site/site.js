import { translations } from './i18n.js';
import { mountGlobe } from './globe.js';
import { LAUNCH, STORE_BADGES, storeLink } from './launch.js';

const requested = new URLSearchParams(window.location.search).get('lang');
const lang = requested === 'en' || requested === 'pl'
  ? requested
  : (navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en');
const t = translations[lang];
document.documentElement.lang = lang;

for (const element of document.querySelectorAll('[data-i18n]')) {
  const value = t[element.dataset.i18n];
  if (typeof value !== 'string') continue;
  const lines = value.split('\n');
  const nodes = [];
  lines.forEach((line, index) => {
    if (index) nodes.push(document.createElement('br'));
    nodes.push(document.createTextNode(line));
  });
  element.replaceChildren(...nodes);
}
// [night-11ae] R2e, D-219: long copy (press.long) as paragraphs and a bullet list, still text-only.
for (const element of document.querySelectorAll('[data-i18n-paragraphs]')) {
  const value = t[element.dataset.i18nParagraphs];
  if (typeof value !== 'string') continue;
  element.replaceChildren(...value.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');
    if (!lines.every(line => line.startsWith('• '))) return Object.assign(document.createElement('p'), { textContent: block });
    const list = document.createElement('ul');
    for (const line of lines) list.append(Object.assign(document.createElement('li'), { textContent: line.slice(2) }));
    return list;
  }));
}
for (const element of document.querySelectorAll('[data-i18n-alt]')) {
  element.alt = t[element.dataset.i18nAlt];
}
for (const element of document.querySelectorAll('[data-i18n-aria]')) {
  element.setAttribute('aria-label', t[element.dataset.i18nAria]);
}
for (const element of document.querySelectorAll('[data-nav-lang]')) {
  const target = new URL(element.getAttribute('href'), window.location.href);
  target.searchParams.set('lang', lang);
  element.href = target.href;
}
for (const element of document.querySelectorAll('[data-language]')) {
  element.setAttribute('aria-current', element.dataset.language === lang ? 'true' : 'false');
}
// [night-11ad] R7k, D-218: real screenshots in the page's language; store tags become links only once configured.
for (const image of document.querySelectorAll('img[data-shot]')) {
  const suffix = image.dataset.shotFormat === 'landscape' ? '-landscape' : '';
  image.src = `assets/shots/${lang}/${image.dataset.shot}${suffix}.jpg`;
}
for (const tag of document.querySelectorAll('[data-store]')) {
  const href = storeLink(tag.dataset.store);
  if (!href) continue;
  const link = document.createElement('a');
  link.className = 'store-tag';
  link.href = href;
  link.rel = 'noopener';
  const badge = document.createElement('img');
  badge.src = STORE_BADGES[tag.dataset.store];
  badge.alt = tag.querySelector('.store-tag-name')?.textContent ?? '';
  link.append(badge);
  tag.replaceWith(link);
}
// Language-specific canonical and og:url (the static markup names the language-neutral root).
const page = document.body.dataset.page;
const path = { home: '/', privacy: '/privacy.html', press: '/press.html', terms: '/terms.html' }[page];
if (path && requested) {
  const self = `${LAUNCH.origin}${path}?lang=${lang}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', self);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', self);
}
const ogLocale = document.querySelector('meta[property="og:locale"]');
if (ogLocale) ogLocale.content = lang === 'pl' ? 'pl_PL' : 'en_GB';
const ogAlternate = document.querySelector('meta[property="og:locale:alternate"]');
if (ogAlternate) ogAlternate.content = lang === 'pl' ? 'en_GB' : 'pl_PL';
const ogImageAlt = document.querySelector('meta[property="og:image:alt"]');
if (ogImageAlt) ogImageAlt.content = t['meta.ogimage'];
// Per-page description and title; og:title/og:description follow the page's own copy where it has them.
const PAGE_META = {
  home: { description: 'meta.home', ogTitle: 'meta.ogtitle', ogDescription: 'meta.ogdescription', title: () => 'Airway — Globe Route Builder' },
  privacy: { description: 'meta.privacy', title: () => `${t['privacy.title']} — Airway` },
  terms: { description: 'meta.terms', title: () => `${t['terms.title']} — Airway` }, // [night-11an] R7b
  press: { description: 'meta.press', ogTitle: 'press.title', ogDescription: 'meta.press', title: () => `${t['press.title']} — Airway` },
  notfound: { description: 'meta.notfound', title: () => '404 — Airway' },
}[page] ?? { description: 'meta.home', title: () => 'Airway — Globe Route Builder' };
const description = document.querySelector('meta[name="description"]');
if (description) description.content = t[PAGE_META.description];
const ogTitle = document.querySelector('meta[property="og:title"]');
if (ogTitle && PAGE_META.ogTitle) ogTitle.content = page === 'press' ? `Airway — ${t[PAGE_META.ogTitle]}` : t[PAGE_META.ogTitle];
const ogDescription = document.querySelector('meta[property="og:description"]');
if (ogDescription && PAGE_META.ogDescription) ogDescription.content = t[PAGE_META.ogDescription];
document.title = PAGE_META.title();
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
const globe = document.getElementById('globe');
if (globe) mountGlobe(globe);

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
  image.src = `assets/shots/${lang}/${image.dataset.shot}.jpg`;
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
const path = { home: '/', privacy: '/privacy.html', press: '/press.html' }[page];
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
const privacyPage = document.body.dataset.page === 'privacy';
const notFound = page === 'notfound';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = t[privacyPage ? 'meta.privacy' : notFound ? 'meta.notfound' : 'meta.home'];
if (!privacyPage && !notFound) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogTitle) ogTitle.content = t['meta.ogtitle'];
  if (ogDescription) ogDescription.content = t['meta.ogdescription'];
}
document.title = privacyPage
  ? `${t['privacy.title']} — Airway`
  : notFound ? '404 — Airway' : 'Airway — Globe Route Builder';
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
const globe = document.getElementById('globe');
if (globe) mountGlobe(globe);

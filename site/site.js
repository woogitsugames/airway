import { translations } from './i18n.js';
import { mountGlobe } from './globe.js';

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
const privacyPage = document.body.dataset.page === 'privacy';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = t[privacyPage ? 'meta.privacy' : 'meta.home'];
if (!privacyPage) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogTitle) ogTitle.content = t['meta.ogtitle'];
  if (ogDescription) ogDescription.content = t['meta.ogdescription'];
}
document.title = privacyPage
  ? `${t['privacy.title']} — Airway`
  : 'Airway — Globe Route Builder';
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
const globe = document.getElementById('globe');
if (globe) mountGlobe(globe);

// [night-11an] R7b, D-244: the terms of use. The in-app copy (Settings → Help → Terms of use) shows the text of
// site/terms.html word for word; its sections are the page's sections in order; the leaderboard rules match the game
// (one official run per day, server replay, RETENTION_DAYS, the real switch labels); the store notes name Apple's
// standard EULA and the terms URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
// [night-11at] D-255: the bodies are in the lazily loaded legal catalogs; the game shows main + legal.
import { en as legalEn } from '../src/i18n/legal/en.ts';
import { pl as legalPl } from '../src/i18n/legal/pl.ts';
import { translations } from '../site/i18n.js';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
type Lang = 'pl' | 'en';
const LANGS: Lang[] = ['pl', 'en'];
const site = translations as Record<Lang, Record<string, string>>;
const games: Record<Lang, Record<string, string>> = { pl: { ...pl, ...legalPl }, en: { ...en, ...legalEn } };
const html = read('site/terms.html');
const pageKeys = [...html.matchAll(/data-i18n(?:-paragraphs)?="(terms\.[^"]+)"/g)].map((m) => m[1]!)
  .filter((key, index, all) => all.indexOf(key) === index);
const sections = [...html.matchAll(/data-i18n="terms\.s(\d+)\.title"/g)].map((m) => Number(m[1]));
const body = (lang: Lang, n: number): string => site[lang][`terms.s${n}.body`] ?? '';

test('terms.html uses the expected keys', () => {
  for (const key of ['terms.overline', 'terms.title', 'terms.warning', 'terms.date']) assert.ok(pageKeys.includes(key), key);
  assert.ok(sections.length >= 8, `${sections.length} sections`);
  assert.equal(pageKeys.length, 4 + sections.length * 2);
});
for (const lang of LANGS) {
  test(`${lang}: every site terms text is in the game catalog, word for word`, () => {
    assert.deepEqual(pageKeys.filter((key) => !(key in games[lang])), [], `missing in src/i18n/${lang}.ts`);
    assert.deepEqual(pageKeys.filter((key) => games[lang][key] !== site[lang][key]), [], 'differs from site/i18n.js');
  });
  test(`${lang}: settings row label and offline note`, () => {
    assert.ok((games[lang]['settings.terms'] ?? '').trim());
    assert.ok((games[lang]['terms.offline'] ?? '').trim());
  });
}
test('sections: TERMS_SECTIONS in settings.ts = the page, the row sits in Help after the privacy policy, router has "terms"', () => {
  const source = read('src/ui/settings/settings.ts');
  const declared = source.match(/TERMS_SECTIONS=\[([\d,]+)\]/)?.[1]?.split(',').map(Number);
  assert.deepEqual(declared, sections);
  const help = source.indexOf("group(t('settings.group.help')");
  const privacy = source.indexOf("dataset.testid='settings-privacy'");
  const terms = source.indexOf("dataset.testid='settings-terms'");
  assert.ok(help > 0 && privacy > help && terms > privacy, 'terms row after the privacy row in Help');
  const screens = read('src/game/screens.ts');
  assert.match(screens, /screen === 'terms'\) replace\('terms', createTerms/);
  assert.match(screens, /name === 'terms'\) \{ show\('settings'\)/);
});
test('draft: banner "to verify with a lawyer", not legal advice; effective date line', () => {
  assert.match(site.pl['terms.warning'] ?? '', /do weryfikacji z prawnikiem/);
  assert.match(site.en['terms.warning'] ?? '', /to be verified with a lawyer/);
  assert.match(site.pl['terms.date'] ?? '', /Data wejścia w życie/);
  assert.match(site.en['terms.date'] ?? '', /Effective date/);
});
// Topic order from the backlog (R7b): provider/contact, scope, licence, leaderboard rules, availability, …, law.
const TOPICS: Array<[RegExp, RegExp]> = [[/Usługodawca/, /Provider/], [/Czego dotyczy/, /cover/], [/Licencja/, /Licence/],
  [/rankingu/, /leaderboard/], [/Dostępność/, /Availability/]];
test('structure: provider, scope, licence, leaderboard rules, availability first; governing law last', () => {
  TOPICS.forEach(([plTitle, enTitle], i) => {
    assert.match(site.pl[`terms.s${i + 1}.title`] ?? '', plTitle);
    assert.match(site.en[`terms.s${i + 1}.title`] ?? '', enTitle);
  });
  const last = sections.length;
  assert.match(site.pl[`terms.s${last}.title`] ?? '', /Prawo właściwe/);
  assert.match(site.en[`terms.s${last}.title`] ?? '', /Governing law/);
  assert.match(body('pl', last), /^\[do ustalenia z prawnikiem/);
  assert.match(body('en', last), /^\[to be set with the lawyer/);
});
test('leaderboard rules match the game: one official run, replay rejects, RETENTION_DAYS, real labels', () => {
  const retention = Number(read('functions/src/logic.ts').match(/RETENTION_DAYS\s*=\s*(\d+)/)?.[1]);
  assert.ok(retention > 0);
  assert.match(games.pl['rank.practice'] ?? '', /pierwsza gra dnia/);
  assert.match(body('pl', 4), /tylko pierwsza gra/);
  assert.match(games.en['rank.practice'] ?? '', /first game of the day/);
  assert.match(body('en', 4), /Only the first game/);
  assert.match(body('pl', 4), /odtwarza .*odrzucony/s);
  assert.match(body('en', 4), /replays .*rejected/s);
  assert.match(body('pl', 4), new RegExp(`${retention} dni po ostatnim zapisie`));
  assert.match(body('en', 4), new RegExp(`${retention} days after the last write`));
  for (const lang of LANGS) {
    const quote = (label: string) => body(lang, 4).toLowerCase().includes(label.toLowerCase());
    assert.ok(quote(games[lang]['settings.shareRanking'] ?? '\u0000'), `${lang} shareRanking`);
    assert.ok(quote(games[lang]['settings.deleteRanking'] ?? '\u0000'), `${lang} deleteRanking`);
    assert.ok(body(lang, 3).toLowerCase().includes((games[lang]['settings.licenses'] ?? '\u0000').toLowerCase()), `${lang} licences label`);
    assert.match(body(lang, 5), lang === 'pl' ? /nie gwarantujemy/ : /do not guarantee/);
  }
});
test('Apple standard EULA referenced in the terms and in docs/store/README.md, with the terms URL', () => {
  for (const lang of LANGS) assert.match(body(lang, 3), /Licensed Application End User License Agreement/);
  const store = read('docs/store/README.md');
  assert.match(store, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
  assert.match(store, /https:\/\/airway\.games\/terms\.html/);
});

console.log(`SUMMARY test:terms seed=0 cases=${passed + failed} passed=${passed} failed=${failed} sections=${sections.length}`);
if (failed) process.exitCode = 1;

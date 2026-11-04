// [task-37] D-61 player-facing number format: PL groups thousands from four digits, EN unchanged.
import assert from 'node:assert/strict';
import { formatNumber, formatNumberIn, parseLocalNumber } from '../src/core/format.ts';
import { fillPluralTokens, localNumber, pluralForm, setLanguage, t } from '../src/i18n/index.ts';
import { dailyRowHint } from '../src/game/dailyRow.ts';

const SEED = '0xA1A1';
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
const NBSP = ' ';
const intlGroup = new Intl.NumberFormat('pl-PL').format(11000).replace(/\d/g, '');

test('PL keeps three digits as they are', () => assert.equal(formatNumber(999, 'pl'), '999'));
test('PL groups four digits ("2 500")', () => assert.equal(formatNumber(2500, 'pl'), `2${NBSP}500`));
test('PL five digits match Intl ("11 000")', () => assert.equal(formatNumber(11000, 'pl'), `11${NBSP}000`));
test('PL seven digits', () => assert.equal(formatNumber(1234567, 'pl'), `1${NBSP}234${NBSP}567`));
test('PL four- and five-digit groups use the same separator as Intl', () => {
  assert.equal(intlGroup, NBSP);
  assert.equal(formatNumber(2500, 'pl').replace(/\d/g, ''), intlGroup);
});
test('PL negative and fractional four digits', () => {
  assert.equal(formatNumber(-2500, 'pl'), `-2${NBSP}500`);
  assert.equal(formatNumber(2500.5, 'pl', 1), `2${NBSP}500,5`);
});
test('EN unchanged', () => {
  assert.equal(formatNumber(999, 'en'), '999');
  assert.equal(formatNumber(2500, 'en'), '2,500');
  assert.equal(formatNumber(11000, 'en'), '11,000');
  assert.equal(formatNumber(1234567, 'en'), '1,234,567');
});
test('t() formats numeric parameters, strings stay verbatim', () => {
  setLanguage('pl');
  assert.equal(t('upgrade.value.km', { km: 2500 }), `2${NBSP}500 km`);
  assert.equal(t('upgrade.value.km', { km: '2500' }), '2500 km');
  assert.equal(localNumber(1284), `1${NBSP}284`);
  setLanguage('en');
  assert.equal(t('upgrade.value.km', { km: 2500 }), '2,500 km');
  assert.equal(localNumber(1284), '1,284');
});

// [night-07j] Plural word forms: `{count|one|few|many}` in PL, `{count|one|other}` in EN.
test('PL plural forms pick one / few / many', () => {
  const forms = ['pasażer', 'pasażerów', 'pasażerów'];
  assert.equal(pluralForm('pl', 1, ['sekunda', 'sekundy', 'sekund']), 'sekunda');
  for (const n of [2, 3, 4, 22, 34, 102]) assert.equal(pluralForm('pl', n, ['sekunda', 'sekundy', 'sekund']), 'sekundy', String(n));
  for (const n of [0, 5, 11, 12, 14, 21, 25, 111]) assert.equal(pluralForm('pl', n, ['sekunda', 'sekundy', 'sekund']), 'sekund', String(n));
  assert.equal(pluralForm('pl', 1.5, forms), 'pasażerów', 'fractions use the last form');
});
test('EN plural forms pick one / other', () => {
  assert.equal(pluralForm('en', 1, ['star', 'stars']), 'star');
  for (const n of [0, 2, 11, 21]) assert.equal(pluralForm('en', n, ['star', 'stars']), 'stars');
});
test('t() fills plural tokens in real catalog strings', () => {
  setLanguage('pl');
  assert.equal(t('airport.jammed', { code: 'LON', seconds: 1 }), 'LON: zator, pozostała 1 sekunda');
  assert.equal(t('airport.jammed', { code: 'LON', seconds: 3 }), 'LON: zator, pozostały 3 sekundy');
  assert.equal(t('airport.jammed', { code: 'LON', seconds: 12 }), 'LON: zator, pozostało 12 sekund');
  assert.equal(t('gameover.cause.noRoute', { count: 1 }), '1 pasażer nie miał trasy do regionu docelowego.');
  assert.equal(t('gameover.cause.noRoute', { count: 1500 }), `1${NBSP}500 pasażerów nie miało trasy do regionu docelowego.`);
  assert.equal(t('puzzle.board.progress', { done: 3, total: 30, stars: 22 }), '3/30 zaliczonych · 22 gwiazdki');
  assert.equal(t('puzzle.goal.nights', { nights: 5, passengers: 40 }), 'Przetrwaj 5 nocy z ciszą nocną i dowieź 40 pasażerów.');
  assert.equal(t('gameover.cause.capacity', { waiting: 26, capacity: 24 }), 'Poczekalnia przepełniona: 26 osób na 24 miejsca.');
  assert.equal(t('gameover.cause.capacity', { waiting: 22, capacity: 25 }), 'Poczekalnia przepełniona: 22 osoby na 25 miejsc.');
  // [night-07r] Puzzle goals agree with a count of one (accusative after "dowieź").
  assert.equal(t('puzzle.goal.deliver', { passengers: 1 }), 'Dowieź 1 pasażera przed końcem czasu.');
  assert.equal(t('puzzle.goal.deliver', { passengers: 24 }), 'Dowieź 24 pasażerów przed końcem czasu.');
  setLanguage('en');
  assert.equal(t('airport.waiting', { code: 'LON', count: 1 }), 'LON: 1 passenger waiting');
  assert.equal(t('gameover.cause.slotWait', { minutes: 1 }), 'Aircraft waited 1 minute on the ground for a departure slot.');
  assert.equal(t('gameover.cause.slotWait', { minutes: 45 }), 'Aircraft waited 45 minutes on the ground for a departure slot.');
  assert.equal(t('puzzle.goal.continents', { continents: 3, passengers: 1 }), 'Connect 3 continents and deliver 1 passenger without a jam.');
  assert.equal(t('puzzle.board.item', { number: 4, title: 'X', stars: 1 }), 'Puzzle 4: X, 1 star');
  assert.equal(t('airport.waiting', { code: 'LON' }), 'LON: {count} {count|passenger|passengers} waiting', 'missing param keeps the token');
});

// [night-10d] Counts formatted by localNumber still pick the plural form (the token leaked from 1 000 up).
test('plural forms read localNumber output (PL "2 500", EN "2,500")', () => {
  setLanguage('pl');
  assert.equal(t('menu.record', { count: localNumber(2500) }), `rekord 2${NBSP}500 pasażerów`);
  assert.equal(t('menu.record', { count: localNumber(1) }), 'rekord 1 pasażer');
  assert.equal(t('menu.continueHint', { week: 3, count: localNumber(12345) }), `tydzień 3 · 12${NBSP}345 pasażerów`);
  setLanguage('en');
  assert.equal(t('menu.record', { count: localNumber(2500) }), 'record 2,500 passengers');
  assert.equal(t('menu.record', { count: localNumber(1) }), 'record 1 passenger');
});
test('daily row: hint, streak to keep, score, score with streak', () => {
  const result = { dateKey: 'd', kind: 'official' as const, score: 1250, weeks: 2, ticket: '--' };
  setLanguage('en');
  assert.equal(dailyRowHint({ officialResult: null, currentStreak: 0 }), 'same world for everyone');
  assert.equal(dailyRowHint({ officialResult: null, currentStreak: 3 }), '3-day streak · play today');
  assert.equal(dailyRowHint({ officialResult: result, currentStreak: 1 }), 'today 1,250 passengers');
  assert.equal(dailyRowHint({ officialResult: result, currentStreak: 4 }), 'today 1,250 · 4-day streak');
  setLanguage('pl');
  assert.equal(dailyRowHint({ officialResult: null, currentStreak: 1 }), 'seria 1 dzień · zagraj dziś');
  assert.equal(dailyRowHint({ officialResult: null, currentStreak: 5 }), 'seria 5 dni · zagraj dziś');
  assert.equal(dailyRowHint({ officialResult: { ...result, score: 1 }, currentStreak: 1 }), 'dziś 1 pasażer');
  assert.equal(dailyRowHint({ officialResult: result, currentStreak: 2 }), `dziś 1${NBSP}250 · seria 2 dni`);
  setLanguage('en');
});

// [night-12s] R7e, D-145: the plural form comes from the number, read with the language's own separators. Fake
// catalogs for languages not shipped yet; the form order puts `many` after `other` (a missing form takes the last).
const FAKE = {
  'de-DE': { order: ['one', 'other'], template: '{n} {n|Passagier|Passagiere}', one: 'Passagier', other: 'Passagiere' },
  'pt-BR': { order: ['one', 'other', 'many'], template: '{n} {n|passageiro|passageiros}', one: 'passageiro', other: 'passageiros' },
  'es-ES': { order: ['one', 'other', 'many'], template: '{n} {n|pasajero|pasajeros}', one: 'pasajero', other: 'pasajeros' },
  'fr-FR': { order: ['one', 'other', 'many'], template: '{n} {n|passager|passagers}', one: 'passager', other: 'passagers' },
} as const;
// CLDR: fr and pt-BR put 0 in `one` ("0 passager"); millions are `many` in fr/es/pt, which falls back to `other`.
const EXPECT: Record<keyof typeof FAKE, Record<number, 'one' | 'other'>> = {
  'de-DE': { 0: 'other', 1: 'one', 2: 'other', 1000: 'other', 1500: 'other', 1000000: 'other' },
  'pt-BR': { 0: 'one', 1: 'one', 2: 'other', 1000: 'other', 1500: 'other', 1000000: 'other' },
  'es-ES': { 0: 'other', 1: 'one', 2: 'other', 1000: 'other', 1500: 'other', 1000000: 'other' },
  'fr-FR': { 0: 'one', 1: 'one', 2: 'other', 1000: 'other', 1500: 'other', 1000000: 'other' },
};
test('R7e: formatted de/pt-BR/es/fr counts pick the plural of the number, not of "1.000" read as 1', () => {
  for (const [locale, fake] of Object.entries(FAKE) as [keyof typeof FAKE, (typeof FAKE)[keyof typeof FAKE]][]) {
    for (const [n, category] of Object.entries(EXPECT[locale])) {
      const shown = formatNumberIn(locale, Number(n));
      assert.equal(parseLocalNumber(shown, locale), Number(n), `${locale} reads back ${JSON.stringify(shown)}`);
      assert.equal(fillPluralTokens(fake.template, { n: shown }, locale, fake.order), `{n} ${fake[category]}`, `${locale} ${n}`);
    }
  }
  // The exact strings the research found wrong: de "1.000 Passagier", pt-BR "1.500" read as 1.5.
  assert.equal(fillPluralTokens(FAKE['de-DE'].template, { n: '1.000' }, 'de-DE', FAKE['de-DE'].order), '{n} Passagiere');
  assert.equal(fillPluralTokens(FAKE['pt-BR'].template, { n: '1.500' }, 'pt-BR', FAKE['pt-BR'].order), '{n} passageiros');
});
test('R7e: decimals and odd strings', () => {
  assert.equal(parseLocalNumber('1,5', 'de-DE'), 1.5);
  assert.equal(parseLocalNumber('1,5', 'pl-PL'), 1.5);
  assert.equal(parseLocalNumber('1.5', 'en-GB'), 1.5);
  assert.equal(parseLocalNumber('1,500', 'en-GB'), 1500);
  assert.equal(parseLocalNumber(formatNumber(12345, 'pl'), 'pl-PL'), 12345);
  assert.equal(parseLocalNumber(formatNumberIn('pl-PL', -2500), 'pl-PL'), -2500);
  for (const odd of ['LON', '', '1.5', 'A1A3']) assert.ok(Number.isNaN(parseLocalNumber(odd, 'pl-PL')), odd);
  assert.equal(fillPluralTokens('{n|a|b}', { n: 'LON' }, 'de-DE', ['one', 'other']), '{n|a|b}', 'non-numeric keeps the token');
  assert.equal(fillPluralTokens('{n|a|b}', { n: 1 }, 'de-DE', ['one', 'other']), 'a', 'numbers used as they are');
});
test('R7g: fr-FR groups with U+00A0, never the narrow U+202F the body font lacks', () => {
  assert.ok(new Intl.NumberFormat('fr-FR').format(2500).includes('\u202f'), 'precondition: Intl fr-FR uses U+202F');
  assert.equal(formatNumberIn('fr-FR', 2500), `2${NBSP}500`);
  assert.equal(formatNumberIn('fr-FR', 1234567.5, 1), `1${NBSP}234${NBSP}567,5`);
  for (const locale of ['pl-PL', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR']) {
    assert.ok(!formatNumberIn(locale, 1234567.25, 2).includes('\u202f'), locale);
  }
});

console.log(`SUMMARY test:format seed=${SEED} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

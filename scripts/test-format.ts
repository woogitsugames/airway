// [task-37] D-61 player-facing number format: PL groups thousands from four digits, EN unchanged.
import assert from 'node:assert/strict';
import { formatNumber } from '../src/core/format.ts';
import { localNumber, pluralForm, setLanguage, t } from '../src/i18n/index.ts';

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

console.log(`SUMMARY test:format seed=${SEED} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

// [night-11r] R5e: weekly crate stamps say what they measure. The hub-expansion stamp carries "Fullest hub" and the
// slot stamp "Longest slot wait" (PL "Najpełniejszy hub" / "Najdłuższe czekanie na slot"); a hub with nobody
// waiting reads "none yet" instead of "MAD 0/36"; "No hub yet" has no caption; crates without context carry none.
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/index.ts';
import { cardModel } from '../src/ui/upgrade/cards.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const hub = (label: string, waiting: number, capacity = 36) => ({ hubId: label.toLowerCase(), label, waiting, capacity });
const slots = [{ cityId: 'beg', label: 'Beg', held: 1, waitMinutes: 13 }, { cityId: 'mad', label: 'Mad', held: 0, waitMinutes: 4 }];

test('EN hub stamp: caption "Fullest hub" over "BEG 9/36"', () => {
  setLanguage('en');
  const card = cardModel('hub-expansion', 0, 3, [hub('Mad', 2), hub('Beg', 9)]);
  assert.equal(card.stampCaption, 'Fullest hub');
  assert.equal(card.stamp, 'BEG 9/36');
});
test('EN slot stamp: caption "Longest slot wait" over "BEG 13 min"', () => {
  setLanguage('en');
  const card = cardModel('departure-slots', 1, 3, [], undefined, slots);
  assert.equal(card.stampCaption, 'Longest slot wait');
  assert.equal(card.stamp, 'BEG 13 min');
});
test('EN hub with nobody waiting: "none yet", not "MAD 0/36"', () => {
  setLanguage('en');
  const card = cardModel('hub-expansion', 0, 3, [hub('Mad', 0)]);
  assert.equal(card.stamp, 'none yet');
  assert.equal(card.stampCaption, 'Fullest hub');
  assert.equal(card.unavailable, false);
});
test('no hub: "No hub yet" without a caption; plane crates and idle slots carry no stamp', () => {
  setLanguage('en');
  const none = cardModel('hub-expansion', 0, 3, []);
  assert.equal(none.stamp, 'No hub yet');
  assert.equal(none.stampCaption, undefined);
  assert.equal(none.unavailable, true);
  assert.equal(cardModel('turboprop', 0, 3, [hub('Mad', 5)]).stamp, undefined);
  const idle = cardModel('departure-slots', 2, 3, [], undefined, [{ cityId: 'beg', label: 'Beg', held: 0, waitMinutes: 0 }]);
  assert.equal(idle.stamp, undefined);
  assert.equal(idle.stampCaption, undefined);
});
test('PL captions and "jeszcze brak"', () => {
  setLanguage('pl');
  assert.equal(cardModel('hub-expansion', 0, 3, [hub('Beg', 9)]).stampCaption, 'Najpełniejszy hub');
  assert.equal(cardModel('departure-slots', 1, 3, [], undefined, slots).stampCaption, 'Najdłuższe czekanie na slot');
  assert.equal(cardModel('hub-expansion', 0, 3, [hub('Mad', 0)]).stamp, 'jeszcze brak');
  setLanguage('en');
});

console.log(`SUMMARY test:crate-stamps seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);

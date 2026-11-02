// [task-06] Fixed-seed regression for deterministic collision avoidance.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/ui/overlay-layout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { layoutTags, sizeTagGroup, attachSlotTag, slotCountdownText, MAIN_TAG_HEIGHT, SLOT_TAG_HEIGHT, SLOT_TAG_GAP } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(js));
let passed = 0;
let failed = 0;
const assert = (name, ok) => { if (ok) passed++; else { failed++; console.error('FAIL ' + name); } };
const bounds = { width: 412, height: 915, top: 75, bottom: 95, gap: 3 };
const seed = 0xA1A1;
let state = seed;
const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
const slots = Array.from({ length: 30 }, (_, i) => ({ id: 'city' + i, anchorX: 130 + random() * 180, anchorY: 150 + random() * 510, width: 72 + Math.round(random() * 30), height: 30, active: true, jammed: i === 5, x: 0, y: 0, placed: false }));
const first = layoutTags(slots, bounds);
assert('at least one visible', first > 0);
assert('jam has priority', slots[5].placed);
assert('all placed within bounds', slots.every(s => !s.placed || (s.x >= 6 && s.x + s.width <= 406 && s.y >= 75 && s.y + s.height <= 820)));
let overlap = false;
for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
  const a = slots[i], b = slots[j];
  if (a.placed && b.placed && a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y) overlap = true;
}
assert('no visible overlaps', !overlap);
const snapshot = slots.map(s => [s.placed, s.x, s.y]);
assert('stable second frame', layoutTags(slots, bounds) === first && JSON.stringify(snapshot) === JSON.stringify(slots.map(s => [s.placed, s.x, s.y])));
const crowd = Array.from({ length: 50 }, (_, i) => ({ id: String(i), anchorX: 50, anchorY: 210, width: 95, height: 32, active: true, jammed: false, x: 0, y: 0, placed: false }));
const visible = layoutTags(crowd, { width: 140, height: 230, top: 20, bottom: 20, gap: 3 });
assert('crowded labels suppressed', visible < crowd.length);
assert('out-of-range label suppressed', layoutTags([{ ...crowd[0], width: 500 }], bounds) === 0);
// [task-38] Slot tag hung under the passenger tag: one group box, deterministic, never overlapping.
{
  state = seed;
  const n = 24;
  const mains = Array.from({ length: n }, (_, i) => (i % 4 === 3 ? 0 : 60 + Math.round(random() * 60)));
  const rects = Array.from({ length: n }, (_, i) => ({ width: i % 3 === 0 ? 0 : 74 + Math.round(random() * 20), x: 0, y: 0, visible: false }));
  const groups = Array.from({ length: n }, (_, i) => ({ id: 'g' + i, anchorX: 120 + random() * 180, anchorY: 160 + random() * 480, width: 0, height: 0, active: true, jammed: i === 2, x: 0, y: 0, placed: false }));
  groups.forEach((g, i) => { sizeTagGroup(g, mains[i], rects[i]); g.active = mains[i] > 0 || rects[i].width > 0; });
  assert('group height stacks main + gap + slot', groups[1].height === MAIN_TAG_HEIGHT + SLOT_TAG_GAP + SLOT_TAG_HEIGHT);
  assert('group without slot keeps the passenger height', groups[0].height === MAIN_TAG_HEIGHT);
  assert('slot-only group is one slot tag high', groups[7].height === SLOT_TAG_HEIGHT);
  assert('group width covers both tags', groups.every((g, i) => g.width >= mains[i] && g.width >= rects[i].width));
  layoutTags(groups, bounds);
  groups.forEach((g, i) => attachSlotTag(g, mains[i] > 0, rects[i]));
  const boxes = [];
  groups.forEach((g, i) => {
    if (!g.placed) return;
    if (mains[i] > 0) boxes.push({ g: i, kind: 'main', x: g.x, y: g.y, w: mains[i], h: MAIN_TAG_HEIGHT });
    if (rects[i].visible) boxes.push({ g: i, kind: 'slot', x: rects[i].x, y: rects[i].y, w: rects[i].width, h: SLOT_TAG_HEIGHT });
  });
  let clash = false;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) clash = true;
  }
  assert('slot tags never overlap any tag (own or other airport)', !clash);
  assert('slot tag hangs directly under its passenger tag', groups.every((g, i) => !rects[i].visible || mains[i] === 0 ||
    (rects[i].x === g.x && rects[i].y === g.y + MAIN_TAG_HEIGHT + SLOT_TAG_GAP)));
  assert('slot-only group puts the slot tag at the box top', groups.every((g, i) => !rects[i].visible || mains[i] > 0 || rects[i].y === g.y));
  assert('slot tags stay inside bounds', boxes.every((b) => b.x >= 6 && b.x + b.w <= 406 && b.y >= 75 && b.y + b.h <= 820));
  assert('placed groups show their slot tag', groups.every((g, i) => rects[i].visible === (g.placed && rects[i].width > 0)));
  const snap = JSON.stringify(rects);
  layoutTags(groups, bounds);
  groups.forEach((g, i) => attachSlotTag(g, mains[i] > 0, rects[i]));
  assert('slot layout stable on the next frame', JSON.stringify(rects) === snap);
  // Release: nothing held -> the tag hides and the group shrinks back to the passenger tag.
  rects[1].width = 0;
  sizeTagGroup(groups[1], mains[1], rects[1]);
  layoutTags(groups, bounds);
  attachSlotTag(groups[1], true, rects[1]);
  assert('released slot hides and group shrinks', !rects[1].visible && groups[1].height === MAIN_TAG_HEIGHT);
  assert('countdown h:mm', slotCountdownText(12) === '0:12' && slotCountdownText(60) === '1:00' && slotCountdownText(0.2) === '0:01' &&
    slotCountdownText(-3) === '0:00' && slotCountdownText(5) === '0:05');
}
console.log(`SUMMARY test:overlay-layout seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

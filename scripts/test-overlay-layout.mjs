// [task-06] Fixed-seed regression for deterministic collision avoidance.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/ui/overlay-layout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { layoutTags } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(js));
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
console.log(`SUMMARY test:overlay-layout seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

import assert from 'node:assert/strict';
import { contractsSummary } from '../src/game/contractsSummary.ts';
import type { WeeklyContract } from '../src/sim/contracts.ts';
const c = (week: number, delivered: number): WeeklyContract => ({ week, regions: ['EUN', 'EUS'], target: 10, delivered });
const history = [{ ...c(2, 2), met: false }, { ...c(1, 10), met: true }];
let passed = 0; let failed = 0;
for (const [name, fn] of [
  ['no offers', () => assert.deepEqual(contractsSummary([], null), { met: 0, offered: 0, marks: [] })],
  ['closed and current in week order', () => assert.deepEqual(contractsSummary(history, c(3, 10)), { met: 2, offered: 3, marks: [true, false, true] })],
  ['current incomplete', () => assert.deepEqual(contractsSummary([], c(1, 9)), { met: 0, offered: 1, marks: [false] })],
  ['input remains unchanged', () => { const before = JSON.stringify(history); contractsSummary(history, c(3, 20)); assert.equal(JSON.stringify(history), before); }],
] as const) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}:`, e); } }
console.log(`SUMMARY test:contracts-summary seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

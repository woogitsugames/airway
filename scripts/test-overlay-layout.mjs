// [task-06] Fixed-seed regression for deterministic collision avoidance.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/ui/overlay-layout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { layoutTags, sizeTagGroup, attachSlotTag, slotCountdownText, MAIN_TAG_HEIGHT, SLOT_TAG_HEIGHT, SLOT_TAG_GAP,
  placeEdgeChips, projectEdgeChip, EDGE_CHIP_WIDTH: EW, EDGE_CHIP_HEIGHT: EH, EDGE_CHIP_PAD, EDGE_CHIP_CLEAR } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(js));
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
// [night-11m] D-128: a plate-only tag never takes the place of a passenger tag, whatever the insertion order.
{
  const tight = { width: 140, height: 150, top: 20, bottom: 20, gap: 3 }; // room for 3 tags
  const plate = { id: 'plate', anchorX: 70, anchorY: 90, width: 100, height: 30, active: true, jammed: false, minor: true, x: 0, y: 0, placed: false };
  const people = { id: 'people', anchorX: 70, anchorY: 90, width: 100, height: 30, active: true, jammed: false, x: 0, y: 0, placed: false };
  const crowdOf = (n) => Array.from({ length: n }, (_, i) => ({ ...people, id: 'p' + i }));
  const alone = crowdOf(3);
  const fit = layoutTags(alone, tight); // the crowd fills the space (not all of it fits)
  const order = [plate, ...crowdOf(3)];
  layoutTags(order, tight);
  assert('passenger tags placed before a plate-only tag',
    fit < 3 && order.slice(1).filter((s) => s.placed).length === fit && !plate.placed);
  const roomy = [plate, people];
  plate.placed = false; people.placed = false;
  layoutTags(roomy, bounds);
  assert('plate-only tag placed when there is room', plate.placed && people.placed);
}
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
// [night-11x] R5h: edge-chip placement as a pure function (moved out of createAirportOverlay's distributeEdges).
{
  const W = 412, H = 915;
  const eb = { width: W, height: H, top: 75, bottom: 95, right: 0 };
  /** Verbatim port of the pre-R5h `distributeEdges` (src/ui/overlay.ts on origin/dev before night-11x), as the oracle. */
  function referenceDistribute(entries, bounds) {
    for (const e of entries) e.edgePlaced = false;
    for (let pass = 1; pass >= 0; pass--) for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.edgeVisible || Number(entry.jammed) !== pass) continue;
      const vertical = entry.edgeSide < 2;
      const start = vertical ? entry.edgeY : entry.edgeX;
      const min = vertical ? bounds.top + 7 : 7;
      const max = vertical ? bounds.height - bounds.bottom - 48 - 7 : bounds.width - bounds.right - 58 - 7;
      const step = (vertical ? 48 : 58) + 3;
      entry.edgePlaced = false;
      for (let avoidTags = 1; avoidTags >= 0 && !entry.edgePlaced; avoidTags--)
      for (let offset = 0; offset <= entries.length; offset++) {
        const delta = offset === 0 ? 0 : (offset % 2 ? 1 : -1) * Math.ceil(offset / 2) * step;
        const coord = Math.round(start + delta);
        if (coord < min || coord > max) continue;
        const x = vertical ? entry.edgeX : coord;
        const y = vertical ? coord : entry.edgeY;
        let collides = false;
        for (let j = 0; j < entries.length; j++) {
          const other = entries[j];
          if (!other.edgeVisible) {
            const ax = other.tag.anchorX, ay = other.tag.anchorY;
            if (ax > x - 16 && ax < x + 58 + 16 && ay > y - 16 && ay < y + 48 + 16) { collides = true; break; }
            const tag = other.tag;
            if (avoidTags && tag.placed && x < tag.x + tag.width + 3 && x + 58 + 3 > tag.x &&
                y < tag.y + tag.height + 3 && y + 48 + 3 > tag.y) { collides = true; break; }
            continue;
          }
          if (!other.edgePlaced || other.edgeSide !== entry.edgeSide) continue;
          if (x < other.edgeX + 58 + 3 && x + 58 + 3 > other.edgeX &&
              y < other.edgeY + 48 + 3 && y + 48 + 3 > other.edgeY) { collides = true; break; }
        }
        if (!collides) { entry.edgeX = x; entry.edgeY = y; entry.edgePlaced = true; break; }
      }
    }
  }
  /** Random scene: on-screen airports (tags laid out by layoutTags) and off-screen ones projected onto the edge. */
  function scene(n, seedValue, offscreenShare, b = eb) {
    state = seedValue;
    const tags = [], chips = [];
    for (let i = 0; i < n; i++) {
      const off = random() < offscreenShare;
      // Some on-screen airports hug the edges, where the chips go (night-10v / night-10z cases).
      const nearEdge = random() < 0.5;
      const ax = nearEdge ? (random() < 0.5 ? 12 + random() * 60 : b.width - 72 + random() * 60) : 60 + random() * (b.width - 120);
      const ay = b.top + random() * (b.height - b.top - b.bottom);
      tags.push({ id: 'a' + i, anchorX: ax, anchorY: ay, width: 60 + Math.round(random() * 50), height: 30, active: !off && random() < 0.8, jammed: false, x: 0, y: 0, placed: false });
      const chip = { offscreen: off, jammed: off && random() < 0.15, side: 0, x: 0, y: 0, placed: false };
      if (off) {
        const angle = random() * Math.PI * 2;
        projectEdgeChip(chip, Math.cos(angle) * (0.2 + random()), Math.sin(angle) * (0.2 + random()), random() * 360 - 180, b);
      }
      chips.push(chip);
    }
    layoutTags(tags, { width: b.width, height: b.height, top: b.top, bottom: b.bottom, gap: 4 });
    return { tags, chips };
  }
  const asEntries = (s) => s.chips.map((c, i) => ({ edgeVisible: c.offscreen, jammed: c.jammed, edgeSide: c.side, edgeX: c.x, edgeY: c.y, edgePlaced: false, tag: s.tags[i] }));
  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh, gap) => ax < bx + bw + gap && ax + aw + gap > bx && ay < by + bh + gap && ay + ah + gap > by;

  // Identical to the old placement on 200 random scenes (portrait, landscape with a right dock band, crowded edges).
  let same = 0, total = 0, firstDiff = '';
  for (let k = 0; k < 200; k++) {
    const b = k % 3 === 0 ? { width: 915, height: 412, top: 60, bottom: 20, right: 96 } : eb;
    const s = scene(10 + (k % 7) * 20, 0x5EED + k, 0.2 + (k % 5) * 0.15, b);
    const ref = asEntries(s);
    referenceDistribute(ref, b);
    placeEdgeChips(s.chips, s.tags, b);
    total++;
    const equal = s.chips.every((c, i) => c.placed === ref[i].edgePlaced && (!c.placed || (c.x === ref[i].edgeX && c.y === ref[i].edgeY)));
    if (equal) same++; else if (!firstDiff) firstDiff = `scene ${k}`;
  }
  assert(`edge chips: identical to the old distributeEdges on ${same}/${total} scenes ${firstDiff}`, same === total);

  // Jammed chips win the space: a crowd of ordinary chips aimed at one spot cannot push a jammed chip off the edge.
  {
    const crowd = Array.from({ length: 30 }, (_, i) => ({ offscreen: true, jammed: i === 29, side: 1, x: W - 7 - EW, y: 400, placed: false }));
    const tags = crowd.map((_, i) => ({ id: 'c' + i, anchorX: -100, anchorY: -100, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false }));
    const placed = placeEdgeChips(crowd, tags, eb);
    assert('edge chips: jammed chip keeps its ideal place in a crowd', crowd[29].placed && crowd[29].y === 400);
    assert('edge chips: a full edge hides the rest instead of stacking', placed < crowd.length && placed === Math.floor((H - 75 - 95 - 14 - EH) / (EH + 3)) + 1);
    const ys = crowd.filter((c) => c.placed).map((c) => c.y).sort((a, b) => a - b);
    assert('edge chips: placed chips on one edge never overlap', ys.every((y, i) => i === 0 || y - ys[i - 1] >= EH + 3));
    assert('edge chips: placed chips stay inside the free band', crowd.every((c) => !c.placed || (c.y >= 75 + 7 && c.y + EH <= H - 95 - 7)));
  }
  // Never on an on-screen airport (night-10v): its marker at the chip's ideal place moves the chip along the edge.
  {
    const chips = [{ offscreen: true, jammed: false, side: 0, x: 7, y: 400, placed: false }, { offscreen: false, jammed: false, side: 0, x: 0, y: 0, placed: false }];
    const tags = [{ id: 'off', anchorX: -50, anchorY: 0, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false },
      { id: 'on', anchorX: 30, anchorY: 420, width: 80, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false }];
    placeEdgeChips(chips, tags, eb);
    const c = chips[0];
    assert('edge chips: a chip never covers an on-screen airport marker', c.placed && !(30 > c.x - EDGE_CHIP_CLEAR && 30 < c.x + EW + EDGE_CHIP_CLEAR && 420 > c.y - EDGE_CHIP_CLEAR && 420 < c.y + EH + EDGE_CHIP_CLEAR));
    // Even when the edge is full of markers the chip hides rather than covering one.
    const wall = Array.from({ length: 40 }, (_, i) => ({ id: 'w' + i, anchorX: 30, anchorY: 75 + i * 20, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false }));
    const wallChips = [{ offscreen: true, jammed: true, side: 0, x: 7, y: 400, placed: false }, ...wall.map(() => ({ offscreen: false, jammed: false, side: 0, x: 0, y: 0, placed: false }))];
    placeEdgeChips(wallChips, [tags[0], ...wall], eb);
    assert('edge chips: a chip hides when every place would cover an airport', !wallChips[0].placed);
  }
  // Keeps clear of luggage tags when there is room (night-10z); sits under a tag only when the edge is full.
  {
    const chips = [{ offscreen: true, jammed: false, side: 0, x: 7, y: 400, placed: false }, { offscreen: false, jammed: false, side: 0, x: 0, y: 0, placed: false }];
    const tag = { id: 'on', anchorX: 200, anchorY: 600, width: 100, height: 30, active: true, jammed: false, x: 0, y: 395, placed: true };
    const tags = [{ id: 'off', anchorX: -50, anchorY: 0, width: 30, height: 30, active: false, jammed: false, x: 0, y: 0, placed: false }, tag];
    placeEdgeChips(chips, tags, eb);
    assert('edge chips: avoid a luggage tag when there is room', chips[0].placed && !overlaps(chips[0].x, chips[0].y, EW, EH, tag.x, tag.y, tag.width, tag.height, 3));
    const short = { width: 412, height: 75 + 95 + 14 + EH, top: 75, bottom: 95, right: 0 }; // room for exactly one chip
    const one = [{ offscreen: true, jammed: false, side: 0, x: 7, y: 75 + 7, placed: false }, chips[1]];
    const under = { ...tag, y: 80 };
    placeEdgeChips(one, [tags[0], under], short);
    assert('edge chips: a full edge lets the chip sit under a tag', one[0].placed && overlaps(one[0].x, one[0].y, EW, EH, under.x, under.y, under.width, under.height, 3));
  }
  // Projection: sides, the dock band on the right, the "straight behind" tie.
  {
    const c = { offscreen: true, jammed: false, side: 0, x: 0, y: 0, placed: false };
    projectEdgeChip(c, -1, 0, 0, eb);
    assert('edge chips: left ray → left side at the pad', c.side === 0 && c.x === EDGE_CHIP_PAD);
    projectEdgeChip(c, 0, 1, 0, eb);
    assert('edge chips: down ray → bottom side above the HUD band', c.side === 3 && c.y === H - 95 - EDGE_CHIP_PAD - EH);
    projectEdgeChip(c, 1, 0, 0, { ...eb, right: 96 });
    assert('edge chips: right ray stops before the dock band', c.side === 1 && c.x === W - 96 - EDGE_CHIP_PAD - EW);
    projectEdgeChip(c, 0, 0, -20, eb);
    assert('edge chips: straight behind → side from the longitude', c.side === 0);
  }
  // Deterministic and stable: the same input gives the same output, frame after frame.
  {
    const s = scene(80, 0xD00D, 0.5);
    const ideal = s.chips.map((c) => [c.x, c.y]);
    placeEdgeChips(s.chips, s.tags, eb);
    const first = JSON.stringify(s.chips);
    s.chips.forEach((c, i) => { c.x = ideal[i][0]; c.y = ideal[i][1]; });
    placeEdgeChips(s.chips, s.tags, eb);
    assert('edge chips: deterministic output', JSON.stringify(s.chips) === first);
  }
  // 150 airports (100 off screen, a crowded edge) under a per-frame budget; the old O(n²·k) loop is timed alongside.
  {
    const s = scene(150, 0xBEEF, 0.67);
    const ideal = s.chips.map((c) => [c.x, c.y]);
    const reset = () => s.chips.forEach((c, i) => { c.x = ideal[i][0]; c.y = ideal[i][1]; });
    const ref = asEntries(s);
    const refIdeal = ref.map((e) => [e.edgeX, e.edgeY]);
    const time = (fn, runs) => { for (let r = 0; r < 50; r++) fn(); const t0 = performance.now(); for (let r = 0; r < runs; r++) fn(); return (performance.now() - t0) / runs; };
    const now = time(() => { reset(); placeEdgeChips(s.chips, s.tags, eb); }, 400);
    const old = time(() => { ref.forEach((e, i) => { e.edgeX = refIdeal[i][0]; e.edgeY = refIdeal[i][1]; }); referenceDistribute(ref, eb); }, 400);
    console.log(`edge chips 150 airports: placeEdgeChips ${now.toFixed(3)} ms/frame, old distributeEdges ${old.toFixed(3)} ms/frame (×${(old / now).toFixed(1)})`);
    assert(`edge chips: 150 airports under 1 ms per frame (${now.toFixed(3)} ms)`, now < 1);
  }
}
// [night-11az] D-257 Róża: a fixed obstacle (a rose) is never moved and keeps tags off it; a tag with maxShift tries
// the other side before drifting; a minor one stays unplaced rather than drift away.
{
  const b = { width: 412, height: 915, top: 0, bottom: 0, gap: 3 };
  const rose = { id: 'rose', anchorX: 0, anchorY: 0, width: 60, height: 60, active: true, jammed: false, fixed: true, x: 200, y: 300, placed: false };
  const blocker = { id: 'b', anchorX: 290, anchorY: 351, width: 80, height: 30, active: true, jammed: true, x: 0, y: 0, placed: false };
  const note = { id: 'n', anchorX: 290, anchorY: 351, altAnchorX: 120, maxShift: 36, width: 80, height: 30, active: true, jammed: false, x: 0, y: 0, placed: false };
  const minor = { id: 'm', anchorX: 290, anchorY: 351, altAnchorX: 290, maxShift: 0, minor: true, width: 80, height: 30, active: true, jammed: false, x: 0, y: 0, placed: false };
  layoutTags([rose, blocker, note, minor], b);
  assert('roza: a fixed obstacle stays put and counts as placed', rose.placed && rose.x === 200 && rose.y === 300);
  assert('roza: a note blocked on its side goes to the other side, near its anchor', note.placed && note.x === 80 && note.y === 310);
  assert('roza: a minor note with no room nearby stays unplaced', !minor.placed);
  const overlaps = (a, c) => a.x < c.x + c.width && a.x + a.width > c.x && a.y < c.y + c.height && a.y + a.height > c.y;
  assert('roza: no tag covers the obstacle', !overlaps(blocker, rose) && !overlaps(note, rose));
}
// [night-14b] D-259: a passenger note blocked beside its rose on both sides hides instead of drifting next to another
// rose (store shot night-tablet: "BGW 3 z 24" stood beside Ankara).
{
  const b = { width: 600, height: 900, top: 0, bottom: 0, gap: 3 };
  const mk = (id, x, y, extra = {}) => ({ id, anchorX: x, anchorY: y, width: 90, height: 26, active: true, jammed: false, x: 0, y: 0, placed: false, ...extra });
  const right = mk('r', 400, 500, { jammed: true });
  const left = mk('l', 200, 500, { jammed: true });
  const note = mk('n', 400, 500, { altAnchorX: 200, maxShift: 20 });
  layoutTags([right, left, note], b);
  assert('roza: a note with no room on either side near its rose stays unplaced', right.placed && left.placed && !note.placed);
}
console.log(`SUMMARY test:overlay-layout seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

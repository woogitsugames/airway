/** Pure, allocation-free in-place tag placement, independent of DOM and three.js. */
export interface TagSlot {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  active: boolean;
  jammed: boolean;
  /** [night-11m] A tag that only names the airport (code plate, no passengers): placed after every other tag. */
  minor?: boolean;
  /**
   * [night-11az] D-257: an obstacle that already stands where it is (x, y set by the caller, e.g. an airport's rose):
   * never moved, every other tag keeps off it. Placed while active.
   */
  fixed?: boolean;
  /**
   * [night-11az] D-257: a tag that should stay next to its anchor: it is tried at `anchorX`, then at `altAnchorX` (the
   * other side of the airport), each moved at most `maxShift` px up or down; if neither fits, it stays unplaced
   * ([night-14b] D-259: the former third try drifting 3 × maxShift left a note beside the wrong rose; the rose's ticks
   * still show the fill, and zooming in makes room).
   */
  maxShift?: number;
  altAnchorX?: number;
  /**
   * [night-16a] D-262: priority inside a tier (jam, passenger tag, plate): the higher rank is placed first and so takes
   * the room from a lower one (the overlay ranks a hub, then the fuller airport). Ties keep array order.
   */
  rank?: number;
  /**
   * [night-16a] D-262: two more places for a tag with `maxShift`, both centred on `belowX`: its top at `belowY` (under
   * the rose, moved down first) and its bottom at `aboveY` (over the rose, moved up first), at most `maxShift` px.
   */
  belowX?: number;
  belowY?: number;
  aboveY?: number;
  /**
   * [night-16b] D-263: two places beside the rose's own name, level with its middle (`besideY`): right edge at
   * `besideLeft` (left of the name) and left edge at `besideRight` (right of it), moved at most `maxShift` px.
   */
  besideLeft?: number;
  besideRight?: number;
  besideY?: number;
  /**
   * [night-16b] D-263: the note's own rose: a place whose box ends up farther than `homeReach` px from (`homeX`,
   * `homeY`) is not taken (a note never floats away from its rose; it hides instead).
   */
  homeX?: number;
  homeY?: number;
  homeReach?: number;
  /** [night-16b] D-263: a fixed obstacle no tag ever covers, not even a `must` one (a rose's ring of ticks). */
  ring?: boolean;
  /**
   * [night-16a] D-262: a narrower form (the overlay's code + fill) tried at every place before the tag hides; on
   * output `compact` says which form was placed. Its near edge stays where the full tag's would be.
   */
  compactWidth?: number;
  compact?: boolean;
  /**
   * [night-16a] D-262: a tag that must show (the busiest hub's code and fill): when no place is free, it is placed in
   * its compact form over lower-ranked fixed obstacles (another rose's name), and then over any obstacle but a ring
   * ([night-16b] D-263: never over a `ring`, never away from its rose; boxed in by rings it hides).
   */
  must?: boolean;
  /** [night-16a] D-262: the place used last frame (written by layoutTags; -1 none); it keeps it with 3 px less gap. */
  lastPick?: number;
  x: number;
  y: number;
  placed: boolean;
}

export interface TagBounds {
  width: number;
  height: number;
  top: number;
  bottom: number;
  gap: number;
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(value, high));

function collides(a: TagSlot, b: TagSlot, gap: number): boolean {
  if (b.ring) {
    // [night-16b] D-263: a ring is the disc inscribed in its box (the corners stay free for a note).
    const radius = b.width / 2 + gap, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const dx = Math.max(a.x - cx, 0, cx - a.x - a.width), dy = Math.max(a.y - cy, 0, cy - a.y - a.height);
    return dx * dx + dy * dy < radius * radius;
  }
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
/** [night-16b] D-263: a place beside the rose's name slides outward in these steps (px), at most BESIDE_SLIDE. */
const BESIDE_STEP = 6;
const BESIDE_SLIDE = 36;

// Reused between frames: the placement order of `layoutTags` (no allocation per frame).
const orderScratch: number[] = [];
/** [night-16a] D-262: hysteresis, px: a tag tried at the place it held last frame needs this much less clearance. */
export const TAG_HYSTERESIS = 3;
/** [night-16a] D-262: places a note may take: its side, the other side, under the rose, over it; [night-16b] D-263:
 *  left and right of the rose's own name. */
const PLACES = 6;

const tierOf = (slot: TagSlot): number => (slot.jammed ? 2 : slot.minor ? 0 : 1);

/**
 * Tries one place: x fixed, y from `idealY`, moved off blockers (up first, or down first with `down`) at most
 * `maxShift` px. `skipBelowRank`: fixed obstacles ranked lower than this are ignored (the must passes; a `ring` never
 * is).
 */
function tryPlace(slots: readonly TagSlot[], i: number, idealY: number, maxShift: number, top: number, bottom: number,
  gap: number, down: boolean, skipBelowRank: number): boolean {
  const slot = slots[i];
  slot.y = idealY;
  // Collision checks are bounded by the number of tags; no allocations per frame.
  for (let tries = 0; tries <= slots.length; tries++) {
    let blocker: TagSlot | null = null;
    for (let j = 0; j < slots.length; j++) {
      const other = slots[j];
      if (i === j || !other.placed) continue;
      if (other.fixed && !other.ring && (other.rank ?? 0) < skipBelowRank) continue;
      if (collides(slot, other, gap)) { blocker = other; break; }
    }
    if (!blocker) return true;
    const above = blocker.y - slot.height - gap;
    const below = Math.max(idealY, blocker.y + blocker.height + gap);
    if (down && below + slot.height <= bottom) slot.y = below;
    else if (above >= top && (!down || above <= idealY)) slot.y = above;
    else {
      // Choose a stable downward placement only when upward placement is exhausted.
      slot.y = below;
      if (slot.y + slot.height > bottom) return false;
    }
    if (Math.abs(slot.y - idealY) > maxShift) return false;
  }
  return false;
}

/** [night-16b] D-263: the tag's box lies within `homeReach` px of its rose's centre (always true without a home). */
function nearHome(slot: TagSlot): boolean {
  if (slot.homeX === undefined || slot.homeY === undefined || slot.homeReach === undefined) return true;
  const dx = Math.max(slot.x - slot.homeX, 0, slot.homeX - slot.x - slot.width);
  const dy = Math.max(slot.y - slot.homeY, 0, slot.homeY - slot.y - slot.height);
  return dx * dx + dy * dy <= slot.homeReach * slot.homeReach;
}

/**
 * Places the tags in priority order: jammed tags first, then passenger tags, then plate-only tags (night-11m); inside
 * a tier the higher `rank` (D-262: a hub, then the fuller airport) goes first, so it takes the room from a lower one;
 * ties keep the fixed array order, which keeps labels from swapping on sub-pixel camera motion.
 * A plain tag moves upward, then below as fallback. A tag with `maxShift` tries its anchor side, the other side, the
 * place under its rose and the one over it, each kept near the anchor, first in full and then in its compact form;
 * the place it held last frame needs `TAG_HYSTERESIS` px less clearance, so it does not flicker.
 * `width` is the full width on input; after the layout it is the placed width (the compact one when `compact`), so the
 * caller sets it again before the next layout.
 * If no room remains they hide instead of overlapping a readable label (except a `must` tag, see TagSlot.must).
 */
export function layoutTags(slots: readonly TagSlot[], bounds: TagBounds): number {
  const left = 6;
  const top = Math.max(0, bounds.top);
  const bottom = Math.min(bounds.height, bounds.height - bounds.bottom);
  let placed = 0;
  orderScratch.length = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    slot.placed = slot.fixed === true && slot.active;
    if (!slot.active || slot.fixed) continue;
    // Stable insertion sort: tier, then rank, both descending.
    const tier = tierOf(slot), rank = slot.rank ?? 0;
    let at = orderScratch.length;
    orderScratch.push(i);
    while (at > 0) {
      const other = slots[orderScratch[at - 1]];
      const ot = tierOf(other), or = other.rank ?? 0;
      if (ot > tier || (ot === tier && or >= rank)) break;
      orderScratch[at] = orderScratch[at - 1];
      at--;
    }
    orderScratch[at] = i;
  }
  for (let k = 0; k < orderScratch.length; k++) {
    const i = orderScratch[k];
    const slot = slots[i];
    const fullWidth = slot.width;
    const last = slot.lastPick ?? -1;
    slot.compact = false;
    slot.lastPick = -1;
    if (slot.height > bottom - top) continue;
    // With maxShift: the anchor side, the other side, under the rose, over it, each kept near the anchor, else the tag
    // hides. Pick = place + PLACES × compact.
    const limited = slot.maxShift !== undefined && slot.altAnchorX !== undefined;
    const narrow = limited && slot.compactWidth !== undefined && slot.compactWidth > 0 && slot.compactWidth < fullWidth;
    const picks = narrow ? PLACES * 2 : PLACES;
    const maxShift = limited ? slot.maxShift! : Infinity;
    // pass 0: normal; pass 1: a must tag over lower-ranked roses' names; pass 2: over any obstacle but a ring.
    const passes = slot.must ? 3 : 1;
    for (let pass = 0; pass < passes && !slot.placed; pass++) {
      for (let pick = 0; pick < picks && !slot.placed; pick++) {
        const compact = pick >= PLACES;
        const place = pick % PLACES;
        if (pass > 0 && narrow && !compact) continue; // a forced tag takes the compact form
        if (place > 0 && !limited) continue;
        if ((place === 2 || place === 3) && (slot.belowX === undefined || (place === 2 ? slot.belowY : slot.aboveY) === undefined)) continue;
        if (place >= 4 && ((place === 4 ? slot.besideLeft : slot.besideRight) === undefined || slot.besideY === undefined)) continue;
        const width = compact ? slot.compactWidth! : fullWidth;
        if (width > bounds.width - left * 2) continue;
        let x: number;
        if (place === 2 || place === 3) x = slot.belowX! - width / 2;
        else if (place === 4) x = slot.besideLeft! - width;
        else if (place === 5) x = slot.besideRight!;
        else {
          const anchorX = place === 1 ? slot.altAnchorX! : slot.anchorX;
          const other = place === 1 ? slot.anchorX : (slot.altAnchorX ?? slot.anchorX);
          // A compact tag keeps the full tag's edge next to the rose (left edge on the right side and vice versa).
          x = anchorX >= other ? anchorX - fullWidth / 2 : anchorX + fullWidth / 2 - width;
        }
        slot.width = width;
        const wantY = place === 2 ? slot.belowY! : place === 3 ? slot.aboveY! - slot.height
          : place >= 4 ? slot.besideY! - slot.height / 2 : slot.anchorY - slot.height - 11;
        const idealY = Math.round(clamp(wantY, top, bottom - slot.height));
        const skip = pass === 1 ? (slot.rank ?? 0) : pass === 2 ? Infinity : -Infinity;
        // Beside the name the note may also slide outward, away from the rose (D-263).
        const slides = place >= 4 ? BESIDE_SLIDE / BESIDE_STEP : 0;
        for (let k = 0; k <= slides && !slot.placed; k++) {
          slot.x = Math.round(clamp(x + (place === 4 ? -k : k) * BESIDE_STEP, left, bounds.width - left - width));
          // Hysteresis: the place a note held last frame needs a little less clearance (tried only when the full one
          // fails, so an unchanged scene lays out exactly as the frame before). A place away from the rose is not taken.
          if ((tryPlace(slots, i, idealY, maxShift, top, bottom, bounds.gap, place === 2, skip) && nearHome(slot)) ||
            (limited && pick === last && tryPlace(slots, i, idealY, maxShift, top, bottom, Math.max(0, bounds.gap - TAG_HYSTERESIS), place === 2, skip) && nearHome(slot))) {
            slot.placed = true;
            slot.compact = compact;
            slot.lastPick = pick;
            placed++;
          }
        }
      }
    }
    if (!slot.placed) slot.width = fullWidth;
  }
  return placed;
}

// [task-38] Departure-slot tag (D-50): hung directly under the passenger tag of the same airport.
/** Height of the passenger luggage tag (CSS `.airport-bubble`). */
export const MAIN_TAG_HEIGHT = 30;
/** Height of the slot tag (CSS `.airport-slot`). */
export const SLOT_TAG_HEIGHT = 24;
/** Vertical "string" gap between the passenger tag and the slot tag hanging under it. */
export const SLOT_TAG_GAP = 2;

/** Screen rectangle of one airport's slot tag; written in place, never reallocated. */
export interface SlotTagRect {
  width: number;
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Sizes the single layout box shared by an airport's passenger tag and its slot tag, so `layoutTags`
 * moves both as one group and other airports can never slide between them. `mainWidth <= 0` means the
 * airport shows no passenger tag (nobody waiting, no jam); `slot.width <= 0` means nothing is held.
 */
export function sizeTagGroup(group: TagSlot, mainWidth: number, slot: SlotTagRect): void {
  const hasMain = mainWidth > 0;
  const hasSlot = slot.width > 0;
  group.width = Math.max(hasMain ? mainWidth : 0, hasSlot ? slot.width : 0, 30);
  group.height = hasMain && hasSlot ? MAIN_TAG_HEIGHT + SLOT_TAG_GAP + SLOT_TAG_HEIGHT
    : hasSlot ? SLOT_TAG_HEIGHT : MAIN_TAG_HEIGHT;
}

/**
 * Places the slot tag inside its group box after `layoutTags`: left-aligned under the passenger tag
 * (closest to the airport, where the held aircraft stand), or alone in the box when nobody waits.
 */
export function attachSlotTag(group: TagSlot, hasMain: boolean, slot: SlotTagRect): void {
  slot.visible = group.placed && slot.width > 0;
  if (!slot.visible) return;
  slot.x = group.x;
  slot.y = hasMain ? group.y + MAIN_TAG_HEIGHT + SLOT_TAG_GAP : group.y;
}

/** Game-time countdown to the next free slot as h:mm ("0:12", "1:00"); negatives clamp to 0:00. */
export function slotCountdownText(minutes: number): string {
  const total = Math.max(0, Math.ceil(Number.isFinite(minutes) ? minutes : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// [night-11x] R5h: edge chips (off-screen airports) — projection onto the screen edge and placement along it, with
// no DOM and no three.js, so the rules N10v/N10z/N11 patched one by one are unit-tested in `test:overlay-layout`.
/** Edge chip button size (CSS `.airport-edge`). */
export const EDGE_CHIP_WIDTH = 58;
export const EDGE_CHIP_HEIGHT = 48;
/** Distance from the screen edge (and the HUD bands) to a chip. */
export const EDGE_CHIP_PAD = 7;
/** [night-10v] Clearance between a chip and the marker of an on-screen airport (inside the 28 dp tap radius). */
export const EDGE_CHIP_CLEAR = 16;
/** Gap kept between two chips and between a chip and a luggage tag. */
export const EDGE_CHIP_GAP = 3;

/** One airport's edge chip; written in place every frame, never reallocated. */
export interface EdgeChip {
  /** The airport is off screen and needs a chip; an on-screen airport (false) is an obstacle through its tag. */
  offscreen: boolean;
  /** A jammed airport's chip claims edge space first. */
  jammed: boolean;
  /** 0 left, 1 right, 2 top, 3 bottom. */
  side: 0 | 1 | 2 | 3;
  /** Top-left corner: the ideal place after `projectEdgeChip`, the final place after `placeEdgeChips`. */
  x: number;
  y: number;
  placed: boolean;
}

/** Free screen area for chips: HUD bands at the top/bottom and (landscape dock) on the right. */
export interface EdgeBounds {
  width: number;
  height: number;
  top: number;
  bottom: number;
  right: number;
}

/**
 * Ideal chip place for an off-screen airport: the ray from the centre of the free band along the airport's screen
 * direction (dx, dy) hits the band's edge. `lon` breaks the tie when the airport is straight behind the globe.
 */
export function projectEdgeChip(chip: EdgeChip, dx: number, dy: number, lon: number, bounds: EdgeBounds): void {
  const left = EDGE_CHIP_PAD + EDGE_CHIP_WIDTH / 2;
  const right = bounds.width - bounds.right - left;
  const top = bounds.top + EDGE_CHIP_PAD + EDGE_CHIP_HEIGHT / 2;
  const bottom = bounds.height - bounds.bottom - EDGE_CHIP_PAD - EDGE_CHIP_HEIGHT / 2;
  // [night-08b] The horizontal centre of the free band (width / 2 without a right reservation).
  const centreX = (left + right) / 2;
  let x = centreX;
  let y = (top + bottom) / 2;
  if (dx === 0 && dy === 0) dx = lon >= 0 ? 1 : -1;
  const halfW = Math.max(1, right - centreX);
  const halfH = Math.max(1, (bottom - top) / 2);
  const factor = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
  x = Math.max(left, Math.min(right, x + dx * factor));
  y = Math.max(top, Math.min(bottom, y + dy * factor));
  const onVertical = Math.abs(dx / halfW) >= Math.abs(dy / halfH);
  chip.side = onVertical ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3);
  chip.x = Math.round(x - EDGE_CHIP_WIDTH / 2);
  chip.y = Math.round(y - EDGE_CHIP_HEIGHT / 2);
}

// Reused between frames: indices of on-screen airports and of the chips placed so far, per side.
const obstacleScratch: number[] = [];
/** Obstacles that can touch the current chip's strip along its edge (its x on a side edge, its y on top/bottom). */
const nearScratch: number[] = [];
const sideScratch: [number[], number[], number[], number[]] = [[], [], [], []];

function hitsObstacle(x: number, y: number, tags: readonly TagSlot[], avoidTags: boolean): boolean {
  for (let k = 0; k < nearScratch.length; k++) {
    const tag = tags[nearScratch[k]];
    // [night-10v] A chip must never sit on an airport that is on screen: the button would take the tap meant for
    // that airport (route start, hub or "+2 slots" pick). It slides along the edge instead.
    const ax = tag.anchorX;
    const ay = tag.anchorY;
    if (ax > x - EDGE_CHIP_CLEAR && ax < x + EDGE_CHIP_WIDTH + EDGE_CHIP_CLEAR
      && ay > y - EDGE_CHIP_CLEAR && ay < y + EDGE_CHIP_HEIGHT + EDGE_CHIP_CLEAR) return true;
    if (avoidTags && tag.placed && x < tag.x + tag.width + EDGE_CHIP_GAP && x + EDGE_CHIP_WIDTH + EDGE_CHIP_GAP > tag.x
      && y < tag.y + tag.height + EDGE_CHIP_GAP && y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP > tag.y) return true;
  }
  return false;
}

/**
 * Slides every off-screen chip along its edge from its ideal place (`projectEdgeChip`) to the nearest free spot,
 * alternating after/before in steps of one chip. Jammed chips are placed first (they win the space), then the rest in
 * array order, so the output is deterministic. A chip never covers an on-screen airport's marker (night-10v); it
 * keeps clear of the luggage tags (`tags[i]`, already placed by `layoutTags`) while there is room and sits under a tag
 * only when the edge is full (night-10z); a chip with no free spot stays hidden (`placed = false`).
 * `chips[i]` and `tags[i]` belong to the same airport. Returns the number of placed chips. No allocations per frame.
 */
export function placeEdgeChips(chips: readonly EdgeChip[], tags: readonly TagSlot[], bounds: EdgeBounds): number {
  obstacleScratch.length = 0;
  for (const list of sideScratch) list.length = 0;
  for (let i = 0; i < chips.length; i++) {
    chips[i].placed = false;
    if (!chips[i].offscreen) obstacleScratch.push(i);
  }
  let placed = 0;
  for (let pass = 1; pass >= 0; pass--) for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    if (!chip.offscreen || Number(chip.jammed) !== pass) continue;
    const vertical = chip.side < 2;
    const start = vertical ? chip.y : chip.x;
    const min = vertical ? bounds.top + EDGE_CHIP_PAD : EDGE_CHIP_PAD;
    const max = vertical ? bounds.height - bounds.bottom - EDGE_CHIP_HEIGHT - EDGE_CHIP_PAD
      : bounds.width - bounds.right - EDGE_CHIP_WIDTH - EDGE_CHIP_PAD;
    const step = (vertical ? EDGE_CHIP_HEIGHT : EDGE_CHIP_WIDTH) + EDGE_CHIP_GAP;
    // Past this shift both directions are off the edge (rounding moves a coordinate by at most 0.5).
    const reach = Math.max(start - min, max - start) + 1;
    const same = sideScratch[chip.side];
    // A chip slides along one axis only, so an obstacle off its strip can never collide: filter once per chip.
    nearScratch.length = 0;
    for (let k = 0; k < obstacleScratch.length; k++) {
      const tag = tags[obstacleScratch[k]];
      const near = vertical
        ? (tag.anchorX > chip.x - EDGE_CHIP_CLEAR && tag.anchorX < chip.x + EDGE_CHIP_WIDTH + EDGE_CHIP_CLEAR)
          || (tag.placed && chip.x < tag.x + tag.width + EDGE_CHIP_GAP && chip.x + EDGE_CHIP_WIDTH + EDGE_CHIP_GAP > tag.x)
        : (tag.anchorY > chip.y - EDGE_CHIP_CLEAR && tag.anchorY < chip.y + EDGE_CHIP_HEIGHT + EDGE_CHIP_CLEAR)
          || (tag.placed && chip.y < tag.y + tag.height + EDGE_CHIP_GAP && chip.y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP > tag.y);
      if (near) nearScratch.push(obstacleScratch[k]);
    }
    for (let avoidTags = 1; avoidTags >= 0 && !chip.placed; avoidTags--)
    for (let offset = 0; offset <= chips.length; offset++) {
      const shift = Math.ceil(offset / 2) * step;
      if (shift > reach) break;
      const coord = Math.round(start + (offset === 0 ? 0 : (offset % 2 ? 1 : -1) * shift));
      if (coord < min || coord > max) continue;
      const x = vertical ? chip.x : coord;
      const y = vertical ? coord : chip.y;
      if (hitsObstacle(x, y, tags, avoidTags === 1)) continue;
      let collides = false;
      for (let k = 0; k < same.length; k++) {
        const other = chips[same[k]];
        if (x < other.x + EDGE_CHIP_WIDTH + EDGE_CHIP_GAP && x + EDGE_CHIP_WIDTH + EDGE_CHIP_GAP > other.x
          && y < other.y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP && y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP > other.y) { collides = true; break; }
      }
      if (collides) continue;
      chip.x = x;
      chip.y = y;
      chip.placed = true;
      same.push(i);
      placed++;
      break;
    }
  }
  return placed;
}

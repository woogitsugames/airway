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
   * the room from a lower one (the overlay ranks a hub, then the fuller airport; [night-24a] D-281: a newly opened airport
   * above a hub). Ties keep array order.
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
   * [night-18a] D-264: the rose a slot belongs to. On a note: the note is shown only where it is clearly its rose's
   * (`ownsPlace`); on a fixed ring or name: the rose that ring or name draws. Slots without it are not checked.
   */
  rose?: string;
  /**
   * [night-16a] D-262: a narrower form (the overlay's code + fill) tried at every place before the tag hides; on
   * output `compact` says which form was placed. Its near edge stays where the full tag's would be.
   */
  compactWidth?: number;
  compact?: boolean;
  /**
   * [night-16a] D-262: a tag that must show (the busiest hub's code and fill; [night-24a] D-281: a newly opened airport's
   * code and NEW stub, which so never hides before its compact form was tried): when no place is free, it is placed in
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

/**
 * [night-18a] D-264: a shown note must be nearer its own rose's ring than any other rose's ring by this many px, and
 * at least this far from any other rose's name, so it never reads as a neighbour's note (the store shot game-iphone: "BGW 2 z 24" level with Ankara).
 */
export const OWN_MARGIN = 12;

/** Gap (px) between a tag's box and a fixed obstacle: a ring's disc or a name's box; 0 when they touch. */
function gapTo(a: TagSlot, b: TagSlot): number {
  if (b.ring) {
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const dx = Math.max(a.x - cx, 0, cx - a.x - a.width), dy = Math.max(a.y - cy, 0, cy - a.y - a.height);
    return Math.max(0, Math.hypot(dx, dy) - b.width / 2);
  }
  const dx = Math.max(b.x - a.x - a.width, 0, a.x - b.x - b.width), dy = Math.max(b.y - a.y - a.height, 0, a.y - b.y - b.height);
  return Math.hypot(dx, dy);
}

/**
 * [night-18a] D-264: the note at `i` is unambiguously its own rose's where it stands: its gap to its own ring (or to its
 * own name, when it stands level beside it: the forced busiest-hub "Amman · AMM 3 z 36") is at least `margin` px smaller
 * than its gap to every other rose's ring, and it keeps `margin` px from every other rose's name. A name the must pass
 * covers (ranked below `skipBelowRank`) steps back that frame and does not count. True for a slot without a `rose`.
 */
function ownsPlace(slots: readonly TagSlot[], i: number, beside: boolean, margin: number, skipBelowRank: number): boolean {
  const slot = slots[i];
  if (slot.rose === undefined) return true;
  let own = Infinity, other = Infinity;
  const mid = slot.y + slot.height / 2;
  for (let j = 0; j < slots.length; j++) {
    const s = slots[j];
    if (j === i || !s.placed || !s.fixed || s.rose === undefined) continue;
    if (s.rose === slot.rose) {
      if (s.ring || (beside && mid >= s.y && mid <= s.y + s.height)) own = Math.min(own, gapTo(slot, s));
    } else if (s.ring) {
      other = Math.min(other, gapTo(slot, s));
    } else if ((s.rank ?? 0) >= skipBelowRank && gapTo(slot, s) < margin) {
      return false; // right next to another rose's name: it reads as that rose's
    }
  }
  return other === Infinity || own + margin <= other;
}

/**
 * [night-19a] D-266: a shown note keeps at least this many px from another rose's note above or below it (their
 * columns overlap) and NOTE_GAP_X px from one beside it (their rows overlap), so two notes never stack into one block
 * that reads as either rose's (store shot game-tablet: "BGW 2 z 24" right under "ANK 1 z 24").
 */
export const NOTE_GAP_Y = 8;
export const NOTE_GAP_X = 12;

/**
 * [night-19a] D-266: the box `a`, grown by `pad` px, crosses the band between a note's rose and that note: the line
 * from the rose's centre (`homeX`, `homeY`) to the nearest point of the note's box. False without a home.
 */
function inBand(a: TagSlot, note: TagSlot, pad: number): boolean {
  if (note.homeX === undefined || note.homeY === undefined) return false;
  const x0 = note.homeX, y0 = note.homeY;
  const dx = clamp(x0, note.x, note.x + note.width) - x0, dy = clamp(y0, note.y, note.y + note.height) - y0;
  // Clip the segment (x0, y0) + t (dx, dy), t in [0, 1], against the grown box (slab test).
  let t0 = 0, t1 = 1;
  const lo = [a.x - pad - x0, a.y - pad - y0], hi = [a.x + a.width + pad - x0, a.y + a.height + pad - y0];
  const d = [dx, dy];
  for (let k = 0; k < 2; k++) {
    if (d[k] === 0) { if (lo[k] >= 0 || hi[k] <= 0) return false; continue; }
    let near = lo[k] / d[k], far = hi[k] / d[k];
    if (near > far) { const swap = near; near = far; far = swap; }
    t0 = Math.max(t0, near); t1 = Math.min(t1, far);
    if (t0 >= t1) return false;
  }
  return true;
}

/**
 * [night-19a] D-266: the note at `i` stands clear of every other rose's shown note: `gapX` / `gapY` px from it (see
 * NOTE_GAP_Y), off the band between that rose and its note (by `gapY`), and not holding that note in its own band. Only notes
 * with a `rose` are checked (true otherwise).
 */
function clearOfNotes(slots: readonly TagSlot[], i: number, gapX: number, gapY: number): boolean {
  const slot = slots[i];
  if (slot.rose === undefined) return true;
  for (let j = 0; j < slots.length; j++) {
    const s = slots[j];
    if (j === i || !s.placed || s.fixed || s.rose === undefined || s.rose === slot.rose) continue;
    if (slot.x < s.x + s.width + gapX && slot.x + slot.width + gapX > s.x &&
      slot.y < s.y + s.height + gapY && slot.y + slot.height + gapY > s.y) return false;
    if (inBand(slot, s, gapY) || inBand(s, slot, gapY)) return false;
  }
  return true;
}

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
        // Hysteresis: the place a note held last frame needs a little less clearance, tried only after every slide of
        // that place failed at the full clearance (so an unchanged scene lays out exactly as the frame before). A place
        // away from the rose ([night-16b] D-263), where the note reads as another rose's ([night-18a] D-264) or stacks
        // against another rose's note or stands between that rose and its note ([night-19a] D-266) is not taken.
        const tries = limited && pick === last ? 2 : 1;
        for (let lenient = 0; lenient < tries && !slot.placed; lenient++) {
          const gap = lenient ? Math.max(0, bounds.gap - TAG_HYSTERESIS) : bounds.gap;
          const margin = lenient ? OWN_MARGIN - TAG_HYSTERESIS : OWN_MARGIN;
          const ease = lenient ? TAG_HYSTERESIS : 0;
          for (let k = 0; k <= slides && !slot.placed; k++) {
            slot.x = Math.round(clamp(x + (place === 4 ? -k : k) * BESIDE_STEP, left, bounds.width - left - width));
            if (tryPlace(slots, i, idealY, maxShift, top, bottom, gap, place === 2, skip) && nearHome(slot) &&
              ownsPlace(slots, i, place >= 4, margin, skip) && clearOfNotes(slots, i, NOTE_GAP_X - ease, NOTE_GAP_Y - ease)) {
              slot.placed = true;
              slot.compact = compact;
              slot.lastPick = pick;
              placed++;
            }
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
  /**
   * [night-30a] PLAN-LINORYT.md U2: the chip's width when it is not EDGE_CHIP_WIDTH (the Linoryt preview prints the
   * city name and "2 408 km · 8 z 12"); read only by `placeSizedEdgeChips`.
   */
  width?: number;
  /** Great-circle angle (rad) from the view centre to the airport; ranks the chips when more than MAX_EDGE_CHIPS are off screen. Missing = farthest. */
  near?: number;
}

/** [night-85a] At most this many off-screen direction signs at once: jammed airports first, then the nearest ones. */
export const MAX_EDGE_CHIPS = 4;

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
const allowedScratch: number[] = [];
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

// [night-30a] PLAN-LINORYT.md step U2: the Linoryt preview's edge chips carry the city name and the distance line, so
// they are wider than EDGE_CHIP_WIDTH and differ per airport. `placeSizedEdgeChips` is `placeEdgeChips` with each chip's
// own width (`EdgeChip.width`, default EDGE_CHIP_WIDTH): the same rules (jams first, never on an on-screen airport, none
// off the band), except that only a jam's chip may sit under a note when the edge is full (others hide). Only the DEV preview calls it, so a release build drops it;
// the flip (U5) makes it the one placement and removes `placeEdgeChips`.
const chipWidth = (chip: EdgeChip): number => chip.width ?? EDGE_CHIP_WIDTH;
const sizedNear: number[] = [];

/** Where an on-screen airport is drawn (its marker or stamp) and the half size the chip keeps clear of beyond EDGE_CHIP_CLEAR. */
export interface ChipMarker { x: number; y: number; half: number }

function hitsObstacleSized(x: number, y: number, w: number, tags: readonly TagSlot[], markers: readonly ChipMarker[] | undefined, avoidTags: boolean): boolean {
  for (let k = 0; k < sizedNear.length; k++) {
    const i = sizedNear[k];
    const tag = tags[i];
    const marker = markers?.[i];
    const ax = marker ? marker.x : tag.anchorX;
    const ay = marker ? marker.y : tag.anchorY;
    const clear = marker ? Math.max(EDGE_CHIP_CLEAR, marker.half * 1.5 + 2) : EDGE_CHIP_CLEAR;
    if (ax > x - clear && ax < x + w + clear && ay > y - clear && ay < y + EDGE_CHIP_HEIGHT + clear) return true;
    if (avoidTags && tag.placed && x < tag.x + tag.width + EDGE_CHIP_GAP && x + w + EDGE_CHIP_GAP > tag.x
      && y < tag.y + tag.height + EDGE_CHIP_GAP && y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP > tag.y) return true;
  }
  return false;
}

/**
 * `placeEdgeChips` for chips of their own width (see above). The ideal place of `projectEdgeChip` (computed for an
 * EDGE_CHIP_WIDTH chip) is first widened round the same point: a chip on the right edge grows leftward, one on the top
 * or bottom edge grows round its centre and stays inside the band. `markers[i]`, when given, is where airport `i` is
 * drawn (the Linoryt stamp: its note's anchor is not the airport); the chip keeps clear of it by EDGE_CHIP_CLEAR and of
 * a larger stamp's corners. A chip slides along the whole free edge (not only one step per other chip: the wide chips
 * meet more notes). No allocations per frame.
 */
export function placeSizedEdgeChips(chips: readonly EdgeChip[], tags: readonly TagSlot[], bounds: EdgeBounds, markers?: readonly ChipMarker[]): number {
  obstacleScratch.length = 0;
  for (const list of sideScratch) list.length = 0;
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    chip.placed = false;
    if (!chip.offscreen) { obstacleScratch.push(i); continue; }
    const w = chipWidth(chip);
    if (chip.side === 1) chip.x = Math.round(bounds.width - bounds.right - EDGE_CHIP_PAD - w);
    else if (chip.side >= 2) chip.x = Math.round(clamp(chip.x + (EDGE_CHIP_WIDTH - w) / 2, EDGE_CHIP_PAD, bounds.width - bounds.right - w - EDGE_CHIP_PAD));
  }
  // [night-85a] Only MAX_EDGE_CHIPS signs are shown: jammed airports first, then the nearest ones (ties by index).
  allowedScratch.length = 0;
  for (let n = 0; n < MAX_EDGE_CHIPS; n++) {
    let best = -1;
    for (let i = 0; i < chips.length; i++) {
      const c = chips[i];
      if (!c.offscreen || allowedScratch.includes(i)) continue;
      if (best < 0) { best = i; continue; }
      const b = chips[best];
      if (c.jammed !== b.jammed ? c.jammed : (c.near ?? Infinity) < (b.near ?? Infinity)) best = i;
    }
    if (best < 0) break;
    allowedScratch.push(best);
  }
  let placed = 0;
  for (let pass = 1; pass >= 0; pass--) for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    if (!chip.offscreen || Number(chip.jammed) !== pass || !allowedScratch.includes(i)) continue;
    const w = chipWidth(chip);
    const vertical = chip.side < 2;
    const start = vertical ? chip.y : chip.x;
    const min = vertical ? bounds.top + EDGE_CHIP_PAD : EDGE_CHIP_PAD;
    const max = vertical ? bounds.height - bounds.bottom - EDGE_CHIP_HEIGHT - EDGE_CHIP_PAD
      : bounds.width - bounds.right - w - EDGE_CHIP_PAD;
    const step = (vertical ? EDGE_CHIP_HEIGHT : w) + EDGE_CHIP_GAP;
    const reach = Math.max(start - min, max - start) + 1;
    const same = sideScratch[chip.side];
    sizedNear.length = 0;
    for (let k = 0; k < obstacleScratch.length; k++) {
      const tag = tags[obstacleScratch[k]];
      const marker = markers?.[obstacleScratch[k]];
      const ax = marker ? marker.x : tag.anchorX, ay = marker ? marker.y : tag.anchorY;
      const clear = marker ? Math.max(EDGE_CHIP_CLEAR, marker.half * 1.5 + 2) : EDGE_CHIP_CLEAR;
      const near = vertical
        ? (ax > chip.x - clear && ax < chip.x + w + clear)
          || (tag.placed && chip.x < tag.x + tag.width + EDGE_CHIP_GAP && chip.x + w + EDGE_CHIP_GAP > tag.x)
        : (ay > chip.y - clear && ay < chip.y + EDGE_CHIP_HEIGHT + clear)
          || (tag.placed && chip.y < tag.y + tag.height + EDGE_CHIP_GAP && chip.y + EDGE_CHIP_HEIGHT + EDGE_CHIP_GAP > tag.y);
      if (near) sizedNear.push(obstacleScratch[k]);
    }
    // The chip slides in steps of its own size (wide chips on the top or bottom edge in thirds, so a gap narrower than
    // the chip is found) until both directions leave the edge.
    const fine = vertical ? 1 : 3;
    // A printed chip over a note reads as one block with it, so only a jam's chip may sit under a note when the edge is
    // full (the off-screen jam must stay visible); any other chip without a place clear of the notes hides.
    for (let avoidTags = 1; avoidTags >= (chip.jammed ? 0 : 1) && !chip.placed; avoidTags--)
    for (let offset = 0; ; offset++) {
      const shift = Math.ceil(offset / 2) * step / fine;
      if (shift > reach) break;
      const coord = Math.round(start + (offset === 0 ? 0 : (offset % 2 ? 1 : -1) * shift));
      if (coord < min || coord > max) continue;
      const x = vertical ? chip.x : coord;
      const y = vertical ? coord : chip.y;
      if (hitsObstacleSized(x, y, w, tags, markers, avoidTags === 1)) continue;
      // Every chip placed so far, on any edge: a wide chip near a corner may reach a chip of the next edge.
      let collides = false;
      for (let s = 0; s < 4 && !collides; s++) for (let k = 0; k < sideScratch[s].length; k++) {
        const other = chips[sideScratch[s][k]];
        if (x < other.x + chipWidth(other) + EDGE_CHIP_GAP && x + w + EDGE_CHIP_GAP > other.x
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

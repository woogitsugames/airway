/** Pure, allocation-free in-place tag placement, independent of DOM and three.js. */
export interface TagSlot {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  active: boolean;
  jammed: boolean;
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
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/**
 * Fixed insertion order prevents labels from swapping on sub-pixel camera motion.
 * Jammed labels have first claim; other tags move upward, then below as fallback.
 * If no room remains they hide instead of overlapping a readable label.
 */
export function layoutTags(slots: readonly TagSlot[], bounds: TagBounds): number {
  const left = 6;
  const top = Math.max(0, bounds.top);
  const bottom = Math.min(bounds.height, bounds.height - bounds.bottom);
  let placed = 0;
  for (let i = 0; i < slots.length; i++) slots[i].placed = false;
  for (let priority = 1; priority >= 0; priority--) {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.active || Number(slot.jammed) !== priority || slot.width > bounds.width - left * 2 || slot.height > bottom - top) continue;
      slot.x = Math.round(clamp(slot.anchorX - slot.width / 2, left, bounds.width - left - slot.width));
      const idealY = Math.round(clamp(slot.anchorY - slot.height - 11, top, bottom - slot.height));
      slot.y = idealY;
      // Collision checks are bounded by the number of tags; no allocations per frame.
      for (let tries = 0; tries <= slots.length; tries++) {
        let blocker: TagSlot | null = null;
        for (let j = 0; j < slots.length; j++) {
          if (i !== j && slots[j].placed && collides(slot, slots[j], bounds.gap)) {
            blocker = slots[j];
            break;
          }
        }
        if (!blocker) {
          slot.placed = true;
          placed++;
          break;
        }
        const above = blocker.y - slot.height - bounds.gap;
        if (above >= top) {
          slot.y = above;
        } else {
          // Choose a stable downward placement only when upward placement is exhausted.
          slot.y = Math.max(idealY, blocker.y + blocker.height + bounds.gap);
          if (slot.y + slot.height > bottom) break;
        }
      }
    }
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

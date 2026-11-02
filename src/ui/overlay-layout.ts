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

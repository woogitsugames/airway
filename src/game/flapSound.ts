// [night-07e] D-71 UI sound: split-flap boards rattle while their tiles flip. Many SplitFlap rows start
// together (a whole departures board), so their animations merge into one rattle with a capped number
// of clicks instead of one click per tile. Pure planning + a tiny clock-injected scheduler.

/** Shortest gap between two clicks; a real board's rattle, not a buzz. */
export const FLAP_CLICK_GAP_MS = 45;
/** Most clicks in one merged rattle (a full board flips ~150 tiles). */
export const FLAP_MAX_CLICKS = 8;

/**
 * Click times (ms from now) for a board animation of `cells` tiles over `durationMs`, skipping the span
 * an earlier rattle still covers (`busyUntilMs`, relative to now). Pure and deterministic.
 */
export function planFlapClicks(cells: number, durationMs: number, busyUntilMs = 0): number[] {
  if (!(cells > 0) || !(durationMs > 0)) return [];
  const start = Math.max(0, busyUntilMs);
  if (start >= durationMs) return [];
  const wanted = Math.min(FLAP_MAX_CLICKS, Math.ceil(cells / 3), Math.floor((durationMs - start) / FLAP_CLICK_GAP_MS) + 1);
  const clicks: number[] = [];
  for (let i = 0; i < wanted; i++) clicks.push(Math.round(start + i * FLAP_CLICK_GAP_MS));
  return clicks;
}

export interface FlapRattle {
  /** Feed one SplitFlap animation start. */
  animate(cells: number, durationMs: number): void;
  dispose(): void;
}

/**
 * Merge overlapping board animations into one rattle and fire `click()` at each planned time. A rattle
 * lasts until the longest animation in it ends and never exceeds FLAP_MAX_CLICKS, however many rows join.
 */
export function createFlapRattle(
  click: () => void,
  now: () => number = () => performance.now(),
  later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  cancel: (handle: unknown) => void = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
): FlapRattle {
  let end = -Infinity; // absolute ms: the current rattle covers animations until here
  let lastClick = -Infinity; // absolute ms of the last planned click
  let cells = 0; // tiles flipping in the current rattle
  let count = 0; // clicks planned in the current rattle
  const pending = new Set<unknown>();
  return {
    animate(flipping, durationMs) {
      if (!(flipping > 0) || !(durationMs > 0)) return;
      const t = now();
      if (t > end) { cells = 0; count = 0; } // the previous rattle is over: start a new one
      cells += flipping;
      end = Math.max(end, t + durationMs);
      const wanted = Math.min(FLAP_MAX_CLICKS, Math.ceil(cells / 3));
      let at = Math.max(t, lastClick + FLAP_CLICK_GAP_MS);
      while (count < wanted && at <= end) {
        const delay = Math.round(at - t);
        if (delay === 0) click();
        else {
          const handle = later(() => { pending.delete(handle); click(); }, delay);
          pending.add(handle);
        }
        lastClick = at;
        count++;
        at += FLAP_CLICK_GAP_MS;
      }
    },
    dispose() { for (const handle of pending) cancel(handle); pending.clear(); },
  };
}

/** A geographical pentatonic instrument, independent of frame/render timing. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
// Travel around the circle of fifths once per game week; musical only.
const WEEK_SHIFTS = [0, 7, 2, 9, 4, 11, 5] as const;

/**
 * [night-03] Each destination region plays its own rotation of the same pentatonic collection, so every
 * hub stays consonant with every other one while regions sound distinct ("Resonant hubs", D-71).
 * Steps are semitones above the week's tonic. Unknown regions fall back to the major pentatonic.
 */
export const REGION_SCALES: Readonly<Record<string, readonly number[]>> = {
  EUN: [0, 2, 4, 7, 9],   // major pentatonic
  EUS: [2, 4, 7, 9, 12],  // from the 2nd: suspended
  AFR: [4, 7, 9, 12, 14], // from the 3rd: minor-sounding
  ME: [7, 9, 12, 14, 16], // from the 5th: open, sus4 colour
  ASI: [9, 12, 14, 16, 19], // relative minor pentatonic
  OCE: [0, 4, 7, 9, 14],  // wide, bright
  NAM: [0, 2, 7, 9, 12],  // open fifths
  SAM: [2, 7, 9, 14, 16], // warm, low-third-free
};

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function weekShift(week: number): number {
  const validWeek = Number.isSafeInteger(week) && week > 0 ? week : 1;
  return WEEK_SHIFTS[(validWeek - 1) % WEEK_SHIFTS.length];
}

export function latitudeToMidi(latitude: number, week = 1, regionId?: string): number {
  const safeLatitude = Number.isFinite(latitude) ? latitude : 0;
  const position = clamp01((safeLatitude + 60) / 130);
  const degree = Math.min(10, Math.floor(position * 10));
  const scale = (regionId && REGION_SCALES[regionId]) || PENTATONIC;
  const semitones = scale[degree % 5] + Math.floor(degree / 5) * 12;
  return 57 + semitones + weekShift(week);
}

export function latitudeToHz(latitude: number, week = 1, regionId?: string): number {
  return 440 * 2 ** ((latitudeToMidi(latitude, week, regionId) - 69) / 12);
}

/** Tonic of the week (A3 shifted around the circle of fifths), for week cadences and dawn blooms. */
export function weekTonicHz(week = 1): number {
  return 220 * 2 ** (weekShift(week) / 12);
}

export function stressBeatHz(loadRatio: number): number {
  // Audible at 72% load, reaching 6 Hz before the queue jams at 100%.
  return 6 * clamp01((clamp01(loadRatio) - 0.72) / 0.28);
}

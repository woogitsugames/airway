/** A geographical pentatonic instrument, independent of frame/render timing. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
// Travel around the circle of fifths once per game week; musical only.
const WEEK_SHIFTS = [0, 7, 2, 9, 4, 11, 5] as const;

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function latitudeToMidi(latitude: number, week = 1): number {
  const safeLatitude = Number.isFinite(latitude) ? latitude : 0;
  const position = clamp01((safeLatitude + 60) / 130);
  const degree = Math.min(10, Math.floor(position * 10));
  const validWeek = Number.isSafeInteger(week) && week > 0 ? week : 1;
  const semitones = PENTATONIC[degree % 5] + Math.floor(degree / 5) * 12;
  return 57 + semitones + WEEK_SHIFTS[(validWeek - 1) % WEEK_SHIFTS.length];
}

export function latitudeToHz(latitude: number, week = 1): number {
  return 440 * 2 ** ((latitudeToMidi(latitude, week) - 69) / 12);
}

export function stressBeatHz(loadRatio: number): number {
  // Audible at 72% load, reaching 6 Hz before the queue jams at 100%.
  return 6 * clamp01((clamp01(loadRatio) - 0.72) / 0.28);
}

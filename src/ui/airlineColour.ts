// [night-09c] D-80: the player's airline colour. The palette lives in src/data/airline-colours.json, where
// `npm run test:cvd` checks it (ΔE ≥ 15 in normal vision and the three CVD simulations, clear of the cream body).
// It is never gameplay information: destinations keep their own colours and shapes.
import palette from '../data/airline-colours.json';

export type AirlineColourId = keyof typeof palette;
export const AIRLINE_COLOURS = Object.keys(palette) as AirlineColourId[];
/** The house teal of the brand, so a player who never opens the setting sees the original look. */
export const DEFAULT_AIRLINE_COLOUR: AirlineColourId = 'teal';
const KEY = 'airway.settings';

export function isAirlineColour(value: unknown): value is AirlineColourId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(palette, value);
}

export function airlineColourHex(id: AirlineColourId): string {
  return palette[id];
}

export function readAirlineColour(): AirlineColourId {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const value = parsed && typeof parsed === 'object' ? (parsed as { airlineColour?: unknown }).airlineColour : null;
    if (isAirlineColour(value)) return value;
  } catch { /* Storage may be denied; the house colour is the safe default. */ }
  return DEFAULT_AIRLINE_COLOUR;
}

/** Render hook: anything that paints the airline (liveries, tail fins) registers here. */
type AirlinePainter = (hex: string, id: AirlineColourId) => void;
const painters = new Set<AirlinePainter>();

/** Paints with the current colour now and on every later change; returns the unsubscribe. */
export function onAirlineColour(painter: AirlinePainter): () => void {
  painters.add(painter);
  const id = readAirlineColour();
  painter(airlineColourHex(id), id);
  return () => { painters.delete(painter); };
}

/** Called by the settings store after a change; CSS reads `--airway-airline` (boarding pass band). */
export function applyAirlineColour(id: AirlineColourId): void {
  const hex = airlineColourHex(id);
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--airway-airline', hex);
  painters.forEach((painter) => painter(hex, id));
}

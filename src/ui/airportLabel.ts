// [night-05] D-68: airports read as IATA-style code (default) or localized city name, per player setting.
// The setting lives in the settings store ('airway.settings'); this module only reads it, so callers in the
// game layer can label hubs without importing the settings screen.
import { cityByCode, displayCode } from '../data/index.ts';
import { getLanguage } from '../i18n';

export type AirportLabelMode = 'code' | 'name';
export const AIRPORT_LABEL_MODES: readonly AirportLabelMode[] = ['code', 'name'];
const KEY = 'airway.settings';

export function readAirportLabelMode(): AirportLabelMode {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && (parsed as { airportLabels?: unknown }).airportLabels === 'name') return 'name';
  } catch { /* Storage may be denied; codes are the safe default. */ }
  return 'code';
}

/** Player-facing label of one airport (display code or city name, R4a); unknown codes stay as they are. */
export function airportLabel(code: string, mode: AirportLabelMode = readAirportLabelMode()): string {
  if (mode !== 'name') return displayCode(code);
  const city = cityByCode(code);
  if (!city) return code;
  return getLanguage() === 'pl' ? city.namePl : city.nameEn;
}

// [night-12bc] R2h, D-251: Endless licence classes on the device. Which classes are open is read from the logbook's
// best weeks per class (airway.logbook.v1); the menu's choice is one field of the settings record (airway.settings).
// Both stay on the device; a run carries its own class in its GameConfig.
import { LICENCE_CLASSES, LICENCE_UNLOCK_WEEK, isLicenceClass, type LicenceClass } from '../sim';
import { licenceWeeks, type Logbook } from './logbook';
import type { TranslationKey } from '../i18n';

const KEY = 'airway.settings';
/** The class numeral as the stamp shows it (I, II, III) and the full name the pickers and reports use. */
export const LICENCE_SHORT_KEY: Readonly<Record<LicenceClass, TranslationKey>> =
  { 1: 'licence.short.1', 2: 'licence.short.2', 3: 'licence.short.3' };
export const LICENCE_NAME_KEY: Readonly<Record<LicenceClass, TranslationKey>> =
  { 1: 'licence.name.1', 2: 'licence.name.2', 3: 'licence.name.3' };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * The classes this player may fly, in order: class I always; each further class once a run of the class below it
 * reached week LICENCE_UNLOCK_WEEK (the logbook counts weeks flown, so week 4 = 3 weeks flown).
 */
export function openLicences(book: Logbook): LicenceClass[] {
  const best = licenceWeeks(book);
  const open: LicenceClass[] = [1];
  for (const next of LICENCE_CLASSES.slice(1)) {
    const below = (next - 1) as LicenceClass;
    if ((best[below] ?? -1) + 1 >= LICENCE_UNLOCK_WEEK) open.push(next);
    else break;
  }
  return open;
}

/** The highest class opened by this flight (compares the books before and after it); null when nothing opened. */
export function licenceIssued(before: Logbook, after: Logbook): LicenceClass | null {
  const was = openLicences(before).length;
  const now = openLicences(after);
  return now.length > was ? now[now.length - 1]! : null;
}

function record(storage: StorageLike | undefined): Record<string, unknown> {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

/** The stored menu choice (class I when missing or unreadable). Never throws. */
export function readLicenceChoice(storage: StorageLike | undefined): LicenceClass {
  const value = record(storage).licenceClass;
  return isLicenceClass(value) ? value : 1;
}

/** Store the choice next to the other settings (class I removes the field); a blocked storage keeps it for the session. */
export function writeLicenceChoice(storage: StorageLike | undefined, licence: LicenceClass): void {
  const next = { ...record(storage) };
  if (isLicenceClass(licence) && licence !== 1) next.licenceClass = licence;
  else delete next.licenceClass;
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* Storage denied. */ }
}

/** The class a new Endless run starts in: the stored choice when it is open, else class I. */
export function licenceForRun(choice: LicenceClass, open: readonly LicenceClass[]): LicenceClass {
  return open.includes(choice) ? choice : 1;
}

// Resolve saved settings before device language and fall back to English.
import { formatNumber } from '../core/format';
import { en } from './en';
import { pl } from './pl';

export type Language = 'pl' | 'en';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Readonly<Record<string, number | string>>;

const SETTINGS_KEY = 'airway.settings';
const catalogs: Record<Language, Record<TranslationKey, string>> = { en, pl };
let activeLanguage: Language | null = null;

function normaliseLanguage(value: unknown): Language | null {
  if (typeof value !== 'string') return null;
  const base = value.toLowerCase().split(/[-_]/, 1)[0];
  return base === 'pl' || base === 'en' ? base : null;
}

function savedLanguage(): Language | null {
  try {
    const value = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!value) return null;
    const settings: unknown = JSON.parse(value);
    if (settings && typeof settings === 'object' && !Array.isArray(settings) && 'language' in settings) {
      return normaliseLanguage(settings.language);
    }
  } catch {
    // Private browsing and blocked storage are not fatal.
  }
  return null;
}

function deviceLanguage(): Language | null {
  if (typeof navigator === 'undefined') return null;
  for (const language of [...(navigator.languages ?? []), navigator.language]) {
    const supported = normaliseLanguage(language);
    if (supported) return supported;
  }
  return null;
}

export function getLanguage(): Language {
  return activeLanguage ?? (activeLanguage = savedLanguage() ?? deviceLanguage() ?? 'en');
}

export function setLanguage(language: Language): void {
  activeLanguage = language;
  try {
    const previous = globalThis.localStorage?.getItem(SETTINGS_KEY);
    const parsed: unknown = previous ? JSON.parse(previous) : {};
    const settings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, language }));
  } catch {
    // The current session still uses the selected language.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const template = catalogs[getLanguage()][key] ?? en[key];
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    params?.[name] === undefined ? token : typeof params[name] === 'number' ? localNumber(params[name]) : String(params[name]),
  );
}

/** [task-37] D-61: the player-facing number format of the active language ("2 500" PL, "2,500" EN).
 *  t() applies it to every numeric parameter; pass a string to show a number verbatim (codes, seeds). */
export function localNumber(value: number, maximumFractionDigits = 0): string {
  return formatNumber(value, getLanguage(), maximumFractionDigits);
}

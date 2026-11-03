// Resolve saved settings before device language and fall back to English.
import { formatNumber } from '../core/format';
import { en } from './en';
import { pl } from './pl';
import { pseudoText } from './pseudo';

export type Language = 'pl' | 'en';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Readonly<Record<string, number | string>>;

const SETTINGS_KEY = 'airway.settings';
const catalogs: Record<Language, Record<TranslationKey, string>> = { en, pl };
let activeLanguage: Language | null = null;
let pseudo = false;

/** [night-10p] DEV layout check: stretch every translated string (src/i18n/pseudo.ts). */
export function setPseudoLocale(enabled: boolean): void { pseudo = enabled; }

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

/** Plural categories in the order a `{name|form|…}` token lists its forms; a missing form falls back to the last. */
const PLURAL_ORDER: Record<Language, readonly Intl.LDMLPluralRule[]> = {
  en: ['one', 'other'],
  pl: ['one', 'few', 'many', 'other'],
};
const pluralRules = new Map<Language, Intl.PluralRules>();

/** [night-07j] `{count|pasażer|pasażerów|pasażerów}` picks the word form for the number in `count` (PL: one|few|many,
 *  EN: one|other); it prints only the word, so templates write `{count} {count|…}`. */
export function pluralForm(language: Language, value: number, forms: readonly string[]): string {
  let rules = pluralRules.get(language);
  if (!rules) pluralRules.set(language, rules = new Intl.PluralRules(language));
  const index = PLURAL_ORDER[language].indexOf(rules.select(value));
  return forms[Math.min(index < 0 ? forms.length - 1 : index, forms.length - 1)] ?? '';
}

/**
 * [night-10d] Plural selector value. Callers pass counts already formatted by localNumber ("2 500", "2,500"),
 * which Number() cannot read, so the {n|form|…} token leaked into the text for counts from 1 000 up.
 */
function pluralValue(raw: unknown): number {
  if (typeof raw !== 'string') return Number(raw);
  const plain = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  return Number(plain);
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const language = getLanguage();
  const template = (catalogs[language][key] ?? en[key]).replace(/\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g, (token, name: string, forms: string) => {
    const value = pluralValue(params?.[name]);
    return params?.[name] === undefined || !Number.isFinite(value) ? token : pluralForm(language, value, forms.split('|'));
  });
  const text = template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    params?.[name] === undefined ? token : typeof params[name] === 'number' ? localNumber(params[name]) : String(params[name]),
  );
  return pseudo ? pseudoText(text) : text;
}

/** [task-37] D-61: the player-facing number format of the active language ("2 500" PL, "2,500" EN).
 *  t() applies it to every numeric parameter; pass a string to show a number verbatim (codes, seeds). */
export function localNumber(value: number, maximumFractionDigits = 0): string {
  return formatNumber(value, getLanguage(), maximumFractionDigits);
}

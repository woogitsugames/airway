// Resolve saved settings before device language and fall back to English.
import { formatNumber, numberLocale, parseLocalNumber } from '../core/format';
import { en } from './en';
import { LANGUAGES, type Language } from './languages';
import { pl } from './pl';
import { pseudoText } from './pseudo';

export type { Language } from './languages';
export { LANGUAGE_CODES, LANGUAGES, localName } from './languages';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Readonly<Record<string, number | string>>;

const SETTINGS_KEY = 'airway.settings';
/** [night-12w] R7f: one catalog per entry of the language table (src/i18n/languages.ts). */
const catalogs: Record<Language, Record<TranslationKey, string>> = { en, pl };
let activeLanguage: Language | null = null;
let pseudo = false;

/** [night-10p] DEV layout check: stretch every translated string (src/i18n/pseudo.ts). */
export function setPseudoLocale(enabled: boolean): void { pseudo = enabled; }

function normaliseLanguage(value: unknown): Language | null {
  return LANGUAGES.normalise(value);
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
  return activeLanguage ?? (activeLanguage = savedLanguage() ?? deviceLanguage() ?? LANGUAGES.fallback);
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

/** Plural categories in the order a `{name|form|…}` token lists its forms (from the language table). */
const pluralOrder = (language: Language): readonly Intl.LDMLPluralRule[] => LANGUAGES.entry(language).plural;
const pluralRules = new Map<string, Intl.PluralRules>();

/** [night-07j] `{count|pasażer|pasażerów|pasażerów}` picks the word form for the number in `count` (PL: one|few|many,
 *  EN: one|other); it prints only the word, so templates write `{count} {count|…}`. */
export function pluralForm(language: Language, value: number, forms: readonly string[]): string {
  return pluralFormIn(numberLocale(language), pluralOrder(language), value, forms);
}

/** [night-12s] The same choice for any Intl locale and form order (tests use it for languages not shipped yet). */
export function pluralFormIn(locale: string, order: readonly Intl.LDMLPluralRule[], value: number, forms: readonly string[]): string {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, rules = new Intl.PluralRules(locale));
  const index = order.indexOf(rules.select(value));
  return forms[Math.min(index < 0 ? forms.length - 1 : index, forms.length - 1)] ?? '';
}

/**
 * [night-10d] Plural selector value. Callers pass counts already formatted by localNumber ("2 500", "2,500"),
 * which Number() cannot read, so the {n|form|…} token leaked into the text for counts from 1 000 up.
 * [night-12s] R7e, D-145: the string is read with the active language's own group and decimal symbols; the old
 * reader took "." as a decimal point, so de/es/pt-BR "1.000" picked the singular. Numbers are used as they are.
 */
export function pluralCount(raw: unknown, locale: string): number {
  return typeof raw === 'string' ? parseLocalNumber(raw, locale) : Number(raw);
}

/** Replaces every `{name|form|…}` token with the word form for `params[name]`; unknown or non-numeric params keep it. */
export function fillPluralTokens(template: string, params: TranslationParams | undefined, locale: string,
  order: readonly Intl.LDMLPluralRule[]): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g, (token, name: string, forms: string) => {
    const value = pluralCount(params?.[name], locale);
    return params?.[name] === undefined || !Number.isFinite(value) ? token : pluralFormIn(locale, order, value, forms.split('|'));
  });
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const language = getLanguage();
  const template = fillPluralTokens(catalogs[language][key] ?? en[key], params, numberLocale(language), pluralOrder(language));
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

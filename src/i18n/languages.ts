// [night-12w] R7f, D-185: the one table of game languages. Everything that used to spell out 'pl' | 'en' derives
// from it: the `Language` type, normalising a device/saved language, the plural form order of `{n|…}` tokens, the
// Intl locale of numbers, the settings select, the city/region name field, the native-store locale lists
// (`test:android-config` checks `locales_config.xml` and `CFBundleLocalizations` against `LANGUAGE_CODES`) and the
// catalog checks of `test:i18n`. Adding a language = one entry here + its catalog file (+ native locale lists).
// Pure: no catalogs, no DOM, so `src/core/format.ts` and Node scripts can import it.

/** Which of the data files' name fields a language shows until R7j gives every language its own names. */
export type NameField = 'namePl' | 'nameEn';

export interface LanguageEntry<Code extends string = string> {
  /** BCP 47 base code, also the catalog file name (`src/i18n/<code>.ts`) and the saved setting value. */
  readonly code: Code;
  /** Intl locale of player-facing numbers and plural rules (D-61). */
  readonly locale: string;
  /** Plural categories in the order a `{name|form|…}` token lists them; a missing form falls back to the last. */
  readonly plural: readonly Intl.LDMLPluralRule[];
  /** Forms a token must give at least (PL may leave out `other`, used only by fractions). */
  readonly requiredForms: number;
  /** Catalog key of the language's name in the settings select. */
  readonly labelKey: string;
  /** Store listing / native locale (Play `values-…`, App Store). */
  readonly storeLocale: string;
  /** City and region name field (data files carry PL and EN names, D-107). */
  readonly names: NameField;
}

export interface LanguageTable<Code extends string> {
  readonly entries: readonly LanguageEntry<Code>[];
  readonly codes: readonly Code[];
  readonly fallback: Code;
  entry(code: Code): LanguageEntry<Code>;
  /** `pl-PL`, `PL`, `en_GB`… → a game language, or null when none matches. */
  normalise(value: unknown): Code | null;
}

/** Builds the derived lookups; tests build a table with a stub language to prove one entry is enough. */
export function createLanguageTable<Code extends string>(
  entries: readonly LanguageEntry<Code>[], fallback: Code,
): LanguageTable<Code> {
  const byCode = new Map<string, LanguageEntry<Code>>();
  for (const entry of entries) {
    if (byCode.has(entry.code)) throw new Error('duplicate language ' + entry.code);
    if (entry.requiredForms < 1 || entry.requiredForms > entry.plural.length) throw new Error('bad plural forms ' + entry.code);
    byCode.set(entry.code, entry);
  }
  if (!byCode.has(fallback)) throw new Error('fallback language missing: ' + fallback);
  return {
    entries, fallback,
    codes: entries.map((entry) => entry.code),
    entry: (code) => byCode.get(code) ?? byCode.get(fallback)!,
    normalise(value) {
      if (typeof value !== 'string') return null;
      const base = value.toLowerCase().split(/[-_]/, 1)[0];
      return byCode.has(base) ? base as Code : null;
    },
  };
}

/** The shipped languages (PL/EN until the translations of R7i exist). English is the fallback. */
export const LANGUAGE_ENTRIES = [
  { code: 'pl', locale: 'pl-PL', plural: ['one', 'few', 'many', 'other'], requiredForms: 3,
    labelKey: 'language.polish', storeLocale: 'pl-PL', names: 'namePl' },
  { code: 'en', locale: 'en-GB', plural: ['one', 'other'], requiredForms: 2,
    labelKey: 'language.english', storeLocale: 'en-GB', names: 'nameEn' },
] as const satisfies readonly LanguageEntry[];

export type Language = (typeof LANGUAGE_ENTRIES)[number]['code'];
export const LANGUAGES: LanguageTable<Language> = createLanguageTable<Language>(LANGUAGE_ENTRIES, 'en');
export const LANGUAGE_CODES: readonly Language[] = LANGUAGES.codes;

/** A city's or region's name in a game language (the data's PL/EN fields, D-107). */
export function localName(item: { readonly namePl: string; readonly nameEn: string }, language: Language): string {
  return item[LANGUAGES.entry(language).names];
}

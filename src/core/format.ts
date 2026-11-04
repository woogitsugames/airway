// Provide locale-aware number and duration presentation for player-facing views.
// [task-37] D-61: one number formatter for every player-facing number.

import { LANGUAGES, type Language } from '../i18n/languages';

/** [night-12w] R7f: the game languages (src/i18n/languages.ts); the Intl locale comes from their table entry. */
export type NumberLanguage = Language;

const formatters = new Map<string, Intl.NumberFormat>();

/** The Intl locale behind a game language's numbers ("pl-PL", "en-GB"). */
export function numberLocale(language: NumberLanguage): string {
  return LANGUAGES.entry(language).locale;
}

function formatter(locale: string, maximumFractionDigits: number): Intl.NumberFormat {
  const key = locale + ':' + maximumFractionDigits;
  let cached = formatters.get(key);
  if (!cached) formatters.set(key, cached = new Intl.NumberFormat(locale, { maximumFractionDigits }));
  return cached;
}

/** [night-12s] R7g, D-146: Intl fr-FR groups with U+202F (narrow no-break space), which the body font
 *  (Atkinson Hyperlegible Next, 362-glyph subset) lacks; U+00A0 keeps the no-break and is in every font. */
const NARROW_NBSP = /\u202f/g;

/**
 * Formats a player-facing number for an Intl locale. EN groups thousands with a comma ("2,500"). PL groups from four
 * digits (D-61: "2 500", "11 000"), although Intl pl-PL only groups from five; the four-digit group
 * uses the same separator Intl emits for five digits (a no-break space), so both look identical.
 */
export function formatNumberIn(locale: string, value: number, maximumFractionDigits = 0): string {
  const parts = formatter(locale, maximumFractionDigits).formatToParts(value);
  const integers = parts.filter((part) => part.type === 'integer');
  let text: string;
  if (!/^pl\b/i.test(locale) || integers.length !== 1 || integers[0].value.length !== 4) text = parts.map((p) => p.value).join('');
  else {
    const group = formatter(locale, 0).formatToParts(10000).find((part) => part.type === 'group')?.value ?? '\u00a0';
    text = parts.map((part) => part.type === 'integer' ? part.value[0] + group + part.value.slice(1) : part.value).join('');
  }
  return text.replace(NARROW_NBSP, '\u00a0');
}

export function formatNumber(value: number, language: NumberLanguage, maximumFractionDigits = 0): string {
  return formatNumberIn(numberLocale(language), value, maximumFractionDigits);
}

/**
 * [night-12s] R7e, D-145: reads a number written by formatNumberIn for the same locale back into a value, using that
 * locale's own group and decimal symbols (de-DE "1.000" is 1000, pt-BR "1.500" is 1500, en-GB "1.5" is 1.5).
 * Spaces of any kind are group separators. Returns NaN for anything that is not such a number.
 */
export function parseLocalNumber(text: string, locale: string): number {
  const parts = formatter(locale, 1).formatToParts(12345.5);
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  let plain = text.trim().replace(/[\s\u00a0\u202f]/g, '').replace(/\u2212/g, '-');
  if (!/\s|\u00a0|\u202f/.test(group)) plain = plain.split(group).join('');
  if (decimal !== '.') plain = plain.split('.').length > 1 ? 'x' : plain.split(decimal).join('.');
  return /^-?\d+(?:\.\d+)?$/.test(plain) ? Number(plain) : Number.NaN;
}

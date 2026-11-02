// Provide locale-aware number and duration presentation for player-facing views.
// [task-37] D-61: one number formatter for every player-facing number.

export type NumberLanguage = 'pl' | 'en';

const LOCALES: Record<NumberLanguage, string> = { pl: 'pl-PL', en: 'en-GB' };
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(language: NumberLanguage, maximumFractionDigits: number): Intl.NumberFormat {
  const key = language + ':' + maximumFractionDigits;
  let cached = formatters.get(key);
  if (!cached) formatters.set(key, cached = new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits }));
  return cached;
}

/**
 * Formats a player-facing number. EN groups thousands with a comma ("2,500"). PL groups from four
 * digits (D-61: "2 500", "11 000"), although Intl pl-PL only groups from five; the four-digit group
 * uses the same separator Intl emits for five digits (a no-break space), so both look identical.
 */
export function formatNumber(value: number, language: NumberLanguage, maximumFractionDigits = 0): string {
  const parts = formatter(language, maximumFractionDigits).formatToParts(value);
  const integers = parts.filter((part) => part.type === 'integer');
  if (language !== 'pl' || integers.length !== 1 || integers[0].value.length !== 4) return parts.map((p) => p.value).join('');
  const group = formatter('pl', 0).formatToParts(10000).find((part) => part.type === 'group')?.value ?? ' ';
  return parts.map((part) => part.type === 'integer' ? part.value[0] + group + part.value.slice(1) : part.value).join('');
}

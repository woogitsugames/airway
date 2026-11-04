// [night-10p] Pseudo-locale for layout robustness (DEV only, `?pseudo` in the URL): every translated string is
// stretched ~40 % with accented Latin letters and wrapped in brackets, so clipped or overflowing text is visible
// and measurable (e2e/pseudo-locale.mjs). German or Finnish copy runs about this much longer than English.
// [night-11ac] R7h, D-211: `?pseudo=harsh` stretches short strings (≤ 20 code points) to twice their length, the
// IBM/W3C expansion for short UI text, and longer ones as before. In both modes a key with a length budget
// (src/i18n/limits.ts) is filled up to its budget and never past it: the longest text a translation may have
// there (e2e/pseudo-320.mjs, test:i18n).
const ACCENT: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', y: 'ý', c: 'ç', n: 'ñ', s: 'š', z: 'ž',
  A: 'Á', E: 'É', I: 'Í', O: 'Ö', U: 'Ü', Y: 'Ý', C: 'Ç', N: 'Ñ', S: 'Š', Z: 'Ž',
};
const VOWEL = /[aeiouyAEIOUY]/;
const LETTER = /\p{L}/u;
/** Strings up to this many code points count as short text (twice as long in the harsh mode). */
export const SHORT_TEXT = 20;

export type PseudoMode = 'stretch' | 'harsh';
export interface PseudoOptions {
  readonly mode?: PseudoMode;
  /** The key's length budget in code points: the result fills it and never exceeds it. */
  readonly budget?: number;
}

const accent = (char: string): string => ACCENT[char] ?? char;

/** Accented text, letters repeated round-robin (vowels first, then the other letters) up to `target` code points. */
function stretchTo(chars: readonly string[], target: number): string {
  const repeat = chars.map(() => 1);
  const order = [...chars.keys()].filter((i) => VOWEL.test(chars[i]!))
    .concat([...chars.keys()].filter((i) => LETTER.test(chars[i]!) && !VOWEL.test(chars[i]!)));
  for (let step = 0, length = chars.length; order.length && length < target; step += 1, length += 1) {
    repeat[order[step % order.length]!]! += 1;
  }
  return chars.map((char, index) => accent(char).repeat(repeat[index]!)).join('');
}

/** Stretched text: vowels doubled, letters accented, digits and punctuation untouched, then `[…]`. */
export function pseudoText(text: string, options: PseudoOptions = {}): string {
  if (!text) return text;
  const chars = Array.from(text.normalize('NFC'));
  const { mode = 'stretch', budget } = options;
  if (budget !== undefined) {
    // Brackets only when they fit; a text already at (or over) its budget keeps its length, accented.
    if (chars.length + 2 > budget) return chars.map(accent).join('');
    return `[${stretchTo(chars, budget - 2)}]`;
  }
  if (mode === 'harsh' && chars.length <= SHORT_TEXT) return `[${stretchTo(chars, chars.length * 2 - 2)}]`;
  let out = '';
  for (const char of chars) out += VOWEL.test(char) ? accent(char) + accent(char) : accent(char);
  return `[${out}]`;
}

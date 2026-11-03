// [night-10p] Pseudo-locale for layout robustness (DEV only, `?pseudo` in the URL): every translated string is
// stretched ~40 % with accented Latin letters and wrapped in brackets, so clipped or overflowing text is visible
// and measurable (e2e/pseudo-locale.mjs). German or Finnish copy runs about this much longer than English.
const ACCENT: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', y: 'ý', c: 'ç', n: 'ñ', s: 'š', z: 'ž',
  A: 'Á', E: 'É', I: 'Í', O: 'Ö', U: 'Ü', Y: 'Ý', C: 'Ç', N: 'Ñ', S: 'Š', Z: 'Ž',
};
const VOWEL = /[aeiouyAEIOUY]/;

/** Stretched text: vowels doubled, letters accented, digits and punctuation untouched, then `[…]`. */
export function pseudoText(text: string): string {
  if (!text) return text;
  let out = '';
  for (const char of text) {
    const accented = ACCENT[char] ?? char;
    out += VOWEL.test(char) ? accented + accented : accented;
  }
  return `[${out}]`;
}

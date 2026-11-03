// [m3] D-55: one rule for the 100/115/130 % text-size setting. Every absolute font size (and px line
// height) declared in the airport-object UI stylesheets (src/ui/**/*.css) is multiplied by the root
// custom property --airway-text-scale (set by src/ui/a11y.ts from the settings store). Components keep
// writing plain `font: 700 12px/1.2 …`; Vite rewrites it at load/build time to
// `font: 700 calc(12px * var(--airway-text-scale, 1))/calc(1.2) …` — no per-file edits, no transform:scale.
// Skipped: sizes that already read the scale (var(--airway-font-*) / --airway-text-scale), relative sizes
// (em, %, inherit, keywords) and container-fitted sizes (cqi/cqw: a title fitted to its label stays fitted).

export const SCALE = 'var(--airway-text-scale, 1)';
const SKIP = /--airway-text-scale|--airway-font-|cq[iwhb]\b|cqmin|cqmax/;

/** Split a CSS value on top-level whitespace (parentheses and quotes kept together). */
function tokens(value) {
  const out = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of value) {
    if (quote) { current += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (current) out.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

/** True when a size token is an absolute length worth scaling (px, vw/vh-based clamp, var() fallback…). */
function scalable(token) {
  if (!token || SKIP.test(token)) return false;
  if (/^-?\d*\.?\d+px$/.test(token)) return true;
  // Functions (clamp/min/max/calc/var with a px fallback) that contain an absolute length.
  return /^[a-z-]+\(/.test(token) && /\d(px|vw|vh|vmin|vmax|dvh|svh|lvh)\b/.test(token);
}
const scaled = (token) => `calc(${token} * ${SCALE})`;

/** Split "12px/1.2" at its top-level slash. */
function splitSlash(token) {
  let depth = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === '/' && depth === 0) return [token.slice(0, i), token.slice(i + 1)];
  }
  return [token, null];
}

/** Rewrite one `font-size` value; returns the input when nothing should change. */
export function scaleFontSize(value) {
  const v = value.trim();
  return scalable(v) ? scaled(v) : value;
}

/** Rewrite the size (and an absolute px line height) inside a `font` shorthand. */
export function scaleFontShorthand(value) {
  if (SKIP.test(value)) return value;
  const parts = tokens(value.replace(/\s*\/\s*/g, '/'));
  for (let i = 0; i < parts.length; i++) {
    const [size, lineHeight] = splitSlash(parts[i]);
    if (!scalable(size)) continue;
    let next = scaled(size);
    if (lineHeight !== null) next += '/' + (/^\d*\.?\d+px$/.test(lineHeight) ? scaled(lineHeight) : lineHeight);
    parts[i] = next;
    return parts.join(' ');
  }
  return value;
}

/** Only the game UI stylesheets are scaled; fonts.css (@font-face) and third-party CSS are left alone. */
export function shouldScaleFile(file) {
  const path = String(file ?? '').replace(/\\/g, '/').split('?')[0];
  return /\/src\/ui\/.+\.css$/.test(path) && !/\/src\/ui\/fonts\.css$/.test(path);
}

/** PostCSS plugin object (Vite bundles PostCSS; no extra dependency). */
export function textScalePlugin() {
  return {
    postcssPlugin: 'airway-text-scale',
    Declaration(decl) {
      if (decl.__airwayScaled || !shouldScaleFile(decl.source?.input?.file)) return;
      const prop = decl.prop.toLowerCase();
      let next = decl.value;
      if (prop === 'font-size') next = scaleFontSize(decl.value);
      else if (prop === 'font') next = scaleFontShorthand(decl.value);
      else return;
      decl.__airwayScaled = true;
      if (next !== decl.value) decl.value = next;
    },
  };
}
textScalePlugin.postcss = true;

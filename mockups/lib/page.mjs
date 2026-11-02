// Static page writer for mockups: one HTML file per (screen × orientation), fonts loaded from mockups/fonts/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SIZES = { p: [412, 915], l: [915, 412] };

/** fonts: [{ family, file, weight?, style? }] — files live in mockups/fonts/. */
export function writePage(dir, name, { w, h, title, fonts = [], css = '', body = '' }) {
  mkdirSync(dir, { recursive: true });
  const faces = fonts.map((f) => `@font-face{font-family:'${f.family}';src:url('../fonts/${f.file}');font-weight:${f.weight || '100 900'};font-style:${f.style || 'normal'};font-display:block}`).join('\n');
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="viewport-size" content="${w}x${h}">
<title>${title}</title><style>
${faces}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
${css}
</style></head><body>${body}</body></html>`;
  writeFileSync(join(dir, name + '.html'), html);
}

/** Safe-area insets used by every mockup (typical notch phone): status bar top, gesture bar bottom. */
export const SAFE = { p: { t: 36, b: 24, l: 0, r: 0 }, l: { t: 0, b: 16, l: 36, r: 24 } };

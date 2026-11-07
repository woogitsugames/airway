// [night-11ax] D-257: the game loads its fonts as WOFF2 (src/ui/fonts.css, src/ui/skin/roza.css). public/fonts/ still
// holds the TTF each WOFF2 was converted from, because dev pages (dev/globe.html) and the store-shot tool read the TTFs
// from disk; Vite copies public/ whole, so a release build drops every dist/fonts/*.ttf that has a .woff2 twin (−377 kB
// of dist/). `npm run test:bundle` fails on any .ttf left in dist/.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * [night-28a] Linoryt (D-283, docs/styles/kierunki-2026-11b/PLAN-LINORYT.md step U1): the Linoryt faces live in
 * public/fonts/ (the app's font dir, licences next to them, docs/ASSETS.md) while the skin is a DEV-only preview
 * (`?skin=linoryt`, D-284). Until the flip step (U6) makes Linoryt the shipped skin, a release build leaves them out, so
 * dist/ stays byte-identical to the build before them; U6 empties this list.
 */
export const PREVIEW_FONTS = Object.freeze(['Besley-800.woff2', 'Besley-900.woff2', 'SchibstedGrotesk-VF.woff2', 'OFL-Besley.txt', 'OFL-SchibstedGrotesk.txt']);

/** TTF files of `fontsDir` that have a WOFF2 twin (the ones a release build leaves out). */
export function replacedFonts(fontsDir) {
  if (!existsSync(fontsDir)) return [];
  return readdirSync(fontsDir).filter((name) => name.endsWith('.ttf') && existsSync(join(fontsDir, name.replace(/\.ttf$/, '.woff2'))));
}

/** Vite plugin: after a build, removes those TTFs (and the DEV-preview faces) from the output's fonts/ folder. */
export function fontFiles() {
  let outFonts = '';
  let build = false;
  return {
    name: 'airway-font-files',
    apply: 'build',
    configResolved(config) {
      build = config.command === 'build';
      outFonts = resolve(config.root, config.build.outDir, 'fonts');
    },
    closeBundle() {
      if (!build) return;
      for (const name of replacedFonts(outFonts)) rmSync(join(outFonts, name));
      for (const name of PREVIEW_FONTS) rmSync(join(outFonts, name), { force: true }); // [night-28a] D-284
    },
  };
}

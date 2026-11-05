// [night-11ax] D-257: the game loads its fonts as WOFF2 (src/ui/fonts.css, src/ui/skin/roza.css). public/fonts/ still
// holds the TTF each WOFF2 was converted from, because dev pages (dev/globe.html) and the store-shot tool read the TTFs
// from disk; Vite copies public/ whole, so a release build drops every dist/fonts/*.ttf that has a .woff2 twin (−377 kB
// of dist/). `npm run test:bundle` fails on any .ttf left in dist/.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** TTF files of `fontsDir` that have a WOFF2 twin (the ones a release build leaves out). */
export function replacedFonts(fontsDir) {
  if (!existsSync(fontsDir)) return [];
  return readdirSync(fontsDir).filter((name) => name.endsWith('.ttf') && existsSync(join(fontsDir, name.replace(/\.ttf$/, '.woff2'))));
}

/** Vite plugin: after a build, removes those TTFs from the output's fonts/ folder. */
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
    },
  };
}

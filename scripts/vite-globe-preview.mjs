// [night-70a R1] D-323: the NASA globe (the NASA globe) is a DEV-only preview until the flip (R5), so a release build
// leaves its photo textures out of dist/ (Vite copies public/ whole). The flip empties `PREVIEW_GLOBE_FILES`.
// `npm run test:bundle` fails on any of them left in dist/.
// [night-79a R4] D-334: the earth look is in the release build behind DEFAULT_GLOBE_LOOK (as the print was in E3), so
// its textures and the borders ship now and both lists are empty; the plugin stays until R6 removes the print.
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Files of public/data/globe/ a release build leaves out (the textures of `src/render/globe/earth.ts`). */
export const PREVIEW_GLOBE_FILES = Object.freeze([]);

/** [night-72a R2] D-327: files of public/data/ a release build leaves out while the look is a preview (the borders). */
export const PREVIEW_DATA_FILES = Object.freeze([]);

/** Vite plugin: after a build, removes the preview textures (data/globe/) and data files (data/) from the output. */
export function globePreview() {
  let outGlobe = '';
  let build = false;
  return {
    name: 'airway-globe-preview',
    apply: 'build',
    configResolved(config) {
      build = config.command === 'build';
      outGlobe = resolve(config.root, config.build.outDir, 'data', 'globe');
    },
    closeBundle() {
      if (!build || !existsSync(outGlobe)) return;
      for (const name of PREVIEW_GLOBE_FILES) rmSync(join(outGlobe, name), { force: true });
      for (const name of PREVIEW_DATA_FILES) rmSync(join(outGlobe, '..', name), { force: true });
    },
  };
}

// [night-70a R1] D-323: the NASA globe (`?look=earth`) is a DEV-only preview until the flip (R5), so a release build
// leaves its photo textures out of dist/ (Vite copies public/ whole). The flip empties `PREVIEW_GLOBE_FILES`.
// `npm run test:bundle` fails on any of them left in dist/.
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Files of public/data/globe/ a release build leaves out (the textures of `src/render/globe/earth.ts`). */
export const PREVIEW_GLOBE_FILES = Object.freeze(['day-4096.webp', 'day-2048.webp', 'night-2048.webp', 'night-1024.webp']);

/** Vite plugin: after a build, removes the preview textures from the output's data/globe/ folder. */
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
    },
  };
}

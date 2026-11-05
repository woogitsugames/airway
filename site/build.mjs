// [task-29] Dependency-free static build, ready for any file-based hosting provider.
import { cpSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPressKit } from './press-kit.mjs';
import { PRESS_KIT } from './launch.js';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const files = ['index.html', 'privacy.html', 'terms.html', 'press.html', '404.html', 'styles.css', 'site.js', 'i18n.js', 'globe.js', 'launch.js'];
const folders = ['assets', 'fonts'];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) cpSync(join(root, file), join(output, file));
for (const folder of folders) {
  const source = join(root, folder);
  if (!statSync(source).isDirectory()) throw new Error(`${folder} must be a directory`);
  cpSync(source, join(output, folder), { recursive: true });
}
// [night-11ad] R7k, D-218: og:image is the Play feature graphic (D-117), copied, not duplicated in git.
export const OG_IMAGE = { source: '../docs/store/feature-graphic.png', target: 'assets/og-image.png' };
cpSync(join(root, OG_IMAGE.source), join(output, OG_IMAGE.target));
// [night-11ae] R2e, D-219: one press kit ZIP (store shots, logo, fact sheet) next to press.html; built, never committed.
const kit = buildPressKit(root, join(output, PRESS_KIT.zip));
console.log(`press kit ${PRESS_KIT.zip}: ${kit.entries.length} files, ${(kit.bytes / 1e6).toFixed(1)} MB`);
console.log(`SUMMARY build:site seed=0xA1A1 files=${files.length} assetFolders=${folders.length} pressKit=${kit.entries.length} failed=0`);

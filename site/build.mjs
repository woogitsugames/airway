// [task-29] Dependency-free static build, ready for any file-based hosting provider.
import { cpSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const files = ['index.html', 'privacy.html', 'styles.css', 'site.js', 'i18n.js', 'globe.js'];
const folders = ['assets', 'fonts'];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) cpSync(join(root, file), join(output, file));
for (const folder of folders) {
  const source = join(root, folder);
  if (!statSync(source).isDirectory()) throw new Error(`${folder} must be a directory`);
  cpSync(source, join(output, folder), { recursive: true });
}
console.log(`SUMMARY build:site seed=0xA1A1 files=${files.length} assetFolders=${folders.length} failed=0`);

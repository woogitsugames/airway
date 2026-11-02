// Run every mockups/<style>/build.mjs (each writes its own static HTML pages).
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
for (const style of readdirSync(root)) {
  const b = join(root, style, 'build.mjs');
  if (existsSync(b)) { await import(pathToFileURL(b).href); console.log('built', style); }
}

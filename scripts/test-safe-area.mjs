// [night-11y] R5j, D-206: every safe-area inset in the UI CSS goes through the four `--aw-safe-*` tokens of
// src/ui/base.css. Chromium cannot emulate env(safe-area-inset-*), so a raw env() is invisible to every browser suite
// (test:e2e:notch sets the tokens to iPhone-like values); this headless check fails on any raw use outside the token
// definitions and on a missing/duplicated token. src/render/** (globe, owned by the ext session) has no insets.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const TOKEN_FILE = 'src/ui/base.css';
const SIDES = ['top', 'right', 'bottom', 'left'];
let passed = 0;
let failed = 0;
const check = (ok, message) => { if (ok) passed++; else { failed++; console.error('FAIL ' + message); } };

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const files = cssFiles(SRC);
const raw = [];
const definitions = new Map(SIDES.map((side) => [side, 0]));
let tokenUses = 0;
for (const file of files) {
  const name = relative(ROOT, file).replaceAll('\\', '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/env\(\s*safe-area-inset-(\w+)[^)]*\)/g)) {
      const definition = name === TOKEN_FILE && new RegExp(`^\\s*--aw-safe-${match[1]}\\s*:\\s*env\\(`).test(line);
      if (definition) definitions.set(match[1], definitions.get(match[1]) + 1);
      else raw.push(`${name}:${index + 1} ${match[0]}`);
    }
    tokenUses += [...line.matchAll(/var\(--aw-safe-(top|right|bottom|left)\)/g)].length;
  });
}
for (const side of SIDES) check(definitions.get(side) === 1, `--aw-safe-${side} defined once in ${TOKEN_FILE} (${definitions.get(side)})`);
for (const use of raw) console.error('  raw ' + use);
check(raw.length === 0, `no raw env(safe-area-inset-*) outside the tokens (${raw.length} found)`);
check(tokenUses > 0, `the UI CSS reads the tokens (${tokenUses} uses)`);
console.log(`SUMMARY test:safe-area files=${files.length} raw=${raw.length} tokenUses=${tokenUses} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

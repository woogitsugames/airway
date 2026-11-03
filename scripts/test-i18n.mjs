// Check catalog parity, nonempty strings, and formatting placeholders with a fixed test seed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const SEED = '0xA1A1';

function dictionary(language) {
  const file = resolve(ROOT, 'src/i18n', language + '.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error(language + ' has invalid TypeScript syntax');
  let expression;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === language) {
        expression = declaration.initializer;
      }
    }
  }
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))) {
    expression = expression.expression;
  }
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    throw new Error(language + ' must export a literal dictionary');
  }
  const values = new Map();
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property) ||
        (!ts.isStringLiteral(property.name) && !ts.isIdentifier(property.name)) ||
        !ts.isStringLiteral(property.initializer)) {
      failures.push(language + ': all catalog entries must be literal strings');
      continue;
    }
    const key = property.name.text;
    if (values.has(key)) failures.push(language + ': duplicate key ' + key);
    values.set(key, property.initializer.text);
    if (!property.initializer.text.trim()) failures.push(language + ': empty value for ' + key);
  }
  return values;
}

// [night-12q] R5i: every catalog key must be referenced from src/ (outside the catalogs) as a string literal,
// or start with the static prefix of a template/concatenated key such as `privacy.s${n}` or 'settings.airline.' + x.
// Catches dead copy left behind when a screen is removed (13 a11y.city*/a11y.action.* keys and status.* were).
function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path);
  }
  return out;
}
export function unusedKeys(keys, sources) {
  const text = sources.join('\n');
  const literals = new Set([...text.matchAll(/['"`]([A-Za-z0-9_.-]+)['"`]/g)].map((m) => m[1]));
  const prefixes = new Set([
    ...[...text.matchAll(/`([A-Za-z0-9_.-]+)\$\{/g)].map((m) => m[1]),
    ...[...text.matchAll(/['"]([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]*)['"]\s*\+/g)].map((m) => m[1]),
  ].filter((prefix) => prefix.includes('.')));
  return [...keys].filter((key) => !literals.has(key) && ![...prefixes].some((prefix) => key.startsWith(prefix)));
}

const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
  .map((match) => match[1]).sort().join(',');
let keyCount = 0;
try {
  const english = dictionary('en');
  const polish = dictionary('pl');
  keyCount = english.size;
  for (const key of english.keys()) {
    if (!polish.has(key)) failures.push('pl: missing key ' + key);
    else if (placeholders(english.get(key)) !== placeholders(polish.get(key))) {
      failures.push('placeholder mismatch: ' + key);
    }
    // [night-07j] Plural tokens `{name|form|…}`: PL lists one|few|many(|other), EN one|other; the name must be a
    // parameter of the English template so callers pass it.
    if (polish.has(key)) {
      const params = new Set([...english.get(key).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)[}|]/g)].map((m) => m[1]));
      for (const [language, value, min, max] of [['en', english.get(key), 2, 2], ['pl', polish.get(key), 3, 4]]) {
        for (const match of value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\|([^{}]*)\}/g)) {
          const forms = match[2].split('|');
          if (forms.length < min || forms.length > max || forms.some((form) => !form.trim())) {
            failures.push(language + ': plural token ' + match[0] + ' in ' + key + ' needs ' + min + '-' + max + ' forms');
          }
          if (!params.has(match[1])) failures.push(language + ': plural token parameter ' + match[1] + ' unknown in ' + key);
        }
      }
    }
  }
  for (const key of polish.keys()) if (!english.has(key)) failures.push('en: missing key ' + key);
  const catalogDir = resolve(ROOT, 'src/i18n');
  const sources = sourceFiles(resolve(ROOT, 'src'))
    .filter((file) => !['en.ts', 'pl.ts', 'pseudo.ts'].some((name) => file === join(catalogDir, name)))
    .map((file) => readFileSync(file, 'utf8'));
  // Self-check of the matcher: a literal, a template prefix and a concatenated prefix count; a bare key does not.
  const probe = unusedKeys(['a.used', 'b.s1', 'c.x.y', 'd.unused'], ["t('a.used')", "t(`b.s${n}`)", "t('c.x.' + v)"]);
  if (probe.join() !== 'd.unused') failures.push('unused-key matcher self-check: got ' + probe.join());
  for (const key of unusedKeys(english.keys(), sources)) failures.push('unused key (not referenced in src/): ' + key);
  if (english.size === 0) failures.push('dictionaries must not be empty');
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
for (const failure of failures) console.error('FAIL ' + failure);
console.log('SUMMARY test:i18n seed=' + SEED + ' files=2 keys=' + keyCount +
  ' passed=' + (failures.length ? 0 : 1) + ' failed=' + failures.length);
if (failures.length) process.exitCode = 1;

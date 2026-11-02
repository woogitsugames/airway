// Check catalog parity, nonempty strings, and formatting placeholders with a fixed test seed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
  }
  for (const key of polish.keys()) if (!english.has(key)) failures.push('en: missing key ' + key);
  if (english.size === 0) failures.push('dictionaries must not be empty');
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
for (const failure of failures) console.error('FAIL ' + failure);
console.log('SUMMARY test:i18n seed=' + SEED + ' files=2 keys=' + keyCount +
  ' passed=' + (failures.length ? 0 : 1) + ' failed=' + failures.length);
if (failures.length) process.exitCode = 1;

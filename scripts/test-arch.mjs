// Enforce the pure-simulation boundary using the TypeScript AST, with a fixed test seed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIM = resolve(ROOT, 'src/sim');
const DISALLOWED = ['render', 'ui', 'input', 'audio', 'platform', 'net'].map(
  (name) => resolve(ROOT, 'src', name),
);
const MATH_METHODS = new Set([
  'random', 'sin', 'cos', 'tan', 'exp', 'pow', 'atan', 'atan2',
  'asin', 'acos', 'log', 'log2', 'log10', 'hypot', 'cbrt',
]);
const FAILURES = [];
const SEED = '0xA1A1';
let checked = 0;

function files(folder) {
  const result = [];
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const file = resolve(folder, item.name);
    if (item.isDirectory()) result.push(...files(file));
    else if (item.isFile() && ['.ts', '.tsx', '.mts', '.cts'].includes(extname(file))) result.push(file);
  }
  return result;
}
function forbiddenImport(specifier, source) {
  const value = specifier.replaceAll('\\', '/');
  if (value === 'three' || value.startsWith('three/')) return true;
  if (value === '@capacitor' || value.startsWith('@capacitor/')) return true;
  const candidate = value.startsWith('@/') ? resolve(ROOT, 'src', value.slice(2)) :
    value.startsWith('src/') ? resolve(ROOT, value) :
    value.startsWith('.') ? resolve(dirname(source), value) : null;
  return candidate !== null && DISALLOWED.some(
    (blocked) => candidate === blocked || candidate.startsWith(blocked + sep),
  );
}
function member(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression) &&
      ts.isStringLiteral(expression.argumentExpression)) return expression.argumentExpression.text;
  return null;
}
function check(file) {
  checked++;
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const issue = (node, description) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    FAILURES.push(file.slice(ROOT.length + 1) + ':' + (line + 1) + ':' +
      (character + 1) + ' ' + description);
  };
  for (const diag of sf.parseDiagnostics) issue({ getStart: () => diag.start ?? 0 },
    'invalid TypeScript syntax');
  const walk = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (spec && ts.isStringLiteral(spec) && forbiddenImport(spec.text, file)) {
        issue(spec, 'forbidden dependency: ' + spec.text);
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if ((callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require')) &&
          node.arguments.length && ts.isStringLiteral(node.arguments[0]) &&
          forbiddenImport(node.arguments[0].text, file)) {
        issue(node, 'forbidden dynamic dependency: ' + node.arguments[0].text);
      }
    }
    if (ts.isIdentifier(node) && (node.text === 'document' || node.text === 'window')) {
      issue(node, 'forbidden browser global: ' + node.text);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = member(node);
      const owner = node.expression;
      if (ts.isIdentifier(owner) && owner.text === 'Math' && key && MATH_METHODS.has(key)) {
        issue(node, 'forbidden Math.' + key);
      }
      if (ts.isIdentifier(owner) && owner.text === 'Date' && key === 'now') {
        issue(node, 'forbidden Date.now');
      }
      if (ts.isIdentifier(owner) && owner.text === 'performance' && key === 'now') {
        issue(node, 'forbidden performance.now');
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Date') {
      issue(node, 'forbidden wall-clock Date constructor');
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) &&
        node.initializer && ts.isIdentifier(node.initializer) && node.initializer.text === 'Math') {
      for (const element of node.name.elements) {
        const key = element.propertyName ?? element.name;
        if (ts.isIdentifier(key) && MATH_METHODS.has(key.text)) {
          issue(node, 'forbidden destructured Math.' + key.text);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
}
try {
  if (!statSync(SIM).isDirectory()) throw new Error('src/sim is missing');
  const sourceFiles = files(SIM);
  if (!sourceFiles.length) throw new Error('src/sim has no TypeScript files');
  for (const file of sourceFiles) check(file);
} catch (error) {
  FAILURES.push(error instanceof Error ? error.message : String(error));
}
for (const failure of FAILURES) console.error('FAIL ' + failure);
console.log('SUMMARY test:arch seed=' + SEED + ' files=' + checked +
  ' passed=' + (FAILURES.length ? 0 : 1) + ' failed=' + FAILURES.length);
if (FAILURES.length) process.exitCode = 1;

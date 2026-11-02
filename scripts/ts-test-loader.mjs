// Tiny TypeScript ESM test loader for Node 22; the project runtime uses Vite.
// Resolves `./x.js` and extensionless `./x` to `./x.ts` so tests can import src/sim directly.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function candidate(specifier, parentURL) {
  const base = specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier;
  for (const suffix of ['.ts', '/index.ts']) {
    const url = new URL(base + suffix, parentURL);
    if (existsSync(fileURLToPath(url))) return url.href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL && !/\.(ts|json|mjs|cjs)$/.test(specifier)) {
      const url = candidate(specifier, context.parentURL);
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      const output = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      } });
      return { format: 'module', source: output.outputText, shortCircuit: true };
    }
    if (url.endsWith('.json')) {
      // Vite-style default-export JSON without import attributes.
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

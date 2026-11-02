// [task-05] Transpile the production TS module graph into an isolated CommonJS test sandbox.
// Tests run in stock Node 22 without experimental loaders or new dependencies.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = [
  'src/core/rng.ts',
  'src/data/regions.ts',
  'src/data/cities.ts',
  'src/data/generated/distances.ts',
  'src/sim/params.ts',
];

export function loadTask05Modules() {
  const dir = mkdtempSync(join(tmpdir(), 'airway-test-05-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"commonjs"}');
    for (const relative of MODULES) {
      const target = join(dir, relative.replace(/\.ts$/, '.js'));
      mkdirSync(dirname(target), { recursive: true });
      const text = readFileSync(resolve(ROOT, relative), 'utf8');
      const { outputText, diagnostics } = ts.transpileModule(text, {
        fileName: relative,
        reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      });
      if (diagnostics?.length) throw new Error(`${relative}: ${diagnostics.length} diagnostics`);
      writeFileSync(target, outputText);
    }
    const require = createRequire(join(dir, 'runner.cjs'));
    return {
      cities: require(join(dir, 'src/data/cities.js')),
      regions: require(join(dir, 'src/data/regions.js')),
      distances: require(join(dir, 'src/data/generated/distances.js')),
      params: require(join(dir, 'src/sim/params.js')),
      dispose() { rmSync(dir, { recursive: true, force: true }); },
    };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

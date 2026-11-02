import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import ts from 'typescript';

/** Compile exactly the task-09 pure TS modules, without Vite or browser APIs. */
export function withPlaneModules(run) {
  const output = mkdtempSync(join(tmpdir(), 'airway-planes-'));
  try {
    const inputs = ['params.ts', 'planes.ts', 'schedule.ts']
      .map((name) => resolve('src/sim', name));
    const compiler = ts.createProgram(inputs, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      outDir: output,
    });
    const diagnostics = ts.getPreEmitDiagnostics(compiler);
    const emission = compiler.emit();
    diagnostics.push(...emission.diagnostics);
    if (diagnostics.length) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (value) => value,
        getCurrentDirectory: process.cwd,
        getNewLine: () => '\n',
      }));
    }
    writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}\n');
    const require = createRequire(import.meta.url);
    return run({
      params: require(join(output, 'params.js')),
      planes: require(join(output, 'planes.js')),
      schedule: require(join(output, 'schedule.js')),
    });
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

export function harness(name, seed, testSuite) {
  let passed = 0;
  let failed = 0;
  const check = (label, run) => {
    try {
      run();
      passed++;
    } catch (error) {
      failed++;
      console.error(`FAIL ${label}:`, error);
    }
  };
  try {
    withPlaneModules((modules) => testSuite(modules, check));
  } catch (error) {
    failed++;
    console.error('FAIL compilation:', error);
  }
  console.log(`SUMMARY test:${name} seed=${seed} cases=${passed + failed} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

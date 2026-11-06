// Merge V8 ranges across processes, mapping emitted TypeScript back to source lines.
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(segment) {
  const values = []; let value = 0, shift = 0;
  for (const ch of segment) {
    const digit = alphabet.indexOf(ch);
    if (digit < 0) throw new Error('Invalid source map VLQ');
    value += (digit & 31) * 2 ** shift;
    if (digit & 32) shift += 5;
    else { values.push((value & 1) ? -(value >> 1) : (value >> 1)); value = 0; shift = 0; }
  }
  if (shift) throw new Error('Truncated source map VLQ');
  return values;
}
function lines(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}
export function decodeMappings(map, generated) {
  const starts = lines(generated), points = [];
  let source = 0, originalLine = 0, originalColumn = 0, name = 0;
  for (const [line, row] of map.mappings.split(';').entries()) {
    let column = 0;
    for (const part of row.split(',')) {
      if (!part) continue;
      const v = vlq(part); column += v[0];
      if (v.length < 4) continue;
      source += v[1]; originalLine += v[2]; originalColumn += v[3];
      if (v.length > 4) name += v[4];
      if (source === 0 && starts[line] !== undefined) points.push({ generated: starts[line] + column, line: originalLine, column: originalColumn });
    }
  }
  return points;
}
export function countAt(ranges, offset) {
  let selected = null;
  for (const r of ranges) if (r.startOffset <= offset && offset < r.endOffset &&
    (!selected || r.endOffset - r.startOffset < selected.endOffset - selected.startOffset)) selected = r;
  return selected?.count ?? 0;
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:ts|js)$/.test(entry.name) ? [path] : [];
  });
}
function prepare(path) {
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { fileName: path, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, sourceMap: true,
  }});
  const generated = output.outputText.replace(/\n?\/\/# sourceMappingURL=.*(?:\n|$)/, '\n');
  const points = decodeMappings(JSON.parse(output.sourceMapText), generated);
  const originalStarts = lines(source);
  const mappedLines = new Set(points.map((p) => p.line));
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const start = node.getStart(ast), end = node.end, bodyStart = node.body.getStart(ast), bodyEnd = node.body.end;
      const candidates = points.filter((p) => {
        const original = originalStarts[p.line] + p.column;
        return original > bodyStart && original < bodyEnd;
      });
      if (candidates.length) functions.push({ start, end, points: candidates, hit: false });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { path, source, generated, points, mappedLines, hitLines: new Set(), functions, originalStarts };
}
export function analyse(root, coverageDir) {
  const src = resolve(root, 'src');
  const modules = new Map(files(src).map((path) => [resolve(path), prepare(path)]));
  for (const name of readdirSync(coverageDir).filter((n) => n.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(coverageDir, name), 'utf8'));
    for (const script of data.result ?? []) {
      if (!script.url.startsWith('file:')) continue;
      let path; try { path = resolve(fileURLToPath(script.url)); } catch { continue; }
      const mod = modules.get(path); if (!mod || !script.functions?.length) continue;
      const rootRange = script.functions[0].ranges[0];
      const emitted = rootRange.endOffset === mod.generated.length;
      const original = rootRange.endOffset >= mod.source.length && rootRange.endOffset - mod.source.length <= 512;
      if (!emitted && !original) throw new Error(`Cannot map V8 offsets for ${relative(root, path)} (${rootRange.endOffset}, emitted ${mod.generated.length}, source ${mod.source.length})`);
      const ranges = script.functions.flatMap((f) => f.ranges);
      if (emitted) {
        for (const p of mod.points) if (countAt(ranges, p.generated) > 0) mod.hitLines.add(p.line);
        for (const fn of mod.functions) if (!fn.hit && fn.points.some((p) => countAt(ranges, p.generated) > 0)) fn.hit = true;
      } else {
        for (const p of mod.points) if (countAt(ranges, mod.originalStarts[p.line] + p.column) > 0) mod.hitLines.add(p.line);
        for (const fn of mod.functions) if (fn.points.some((p) => countAt(ranges, mod.originalStarts[p.line] + p.column) > 0)) fn.hit = true;
      }
    }
  }
  return [...modules.values()].map((m) => ({
    path: relative(root, m.path).split(sep).join('/'),
    lines: m.mappedLines.size, coveredLines: m.hitLines.size,
    functions: m.functions.length, coveredFunctions: m.functions.filter((f) => f.hit).length,
  })).sort((a, b) => a.path.localeCompare(b.path));
}

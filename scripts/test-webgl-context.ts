// [night-11h] R3g, D-118: WebGL context loss guard and the no-WebGL-2 probes (src/render/contextGuard.ts) under Node,
// plus the wiring the browser test cannot see cheaply: the renderer draws nothing while lost, the world loop holds
// the run, main.ts mounts the unsupported page, and both catalogs carry the texts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
type Guard = typeof import('../src/render/contextGuard.ts');
let mod: Guard | null = null;
const load = async (): Promise<Guard> => (mod ??= await import('../src/render/contextGuard.ts'));
const source = (file: string): string => readFileSync(resolve(ROOT, file), 'utf8');

await test('loss and restore are reported once each, restore hook first', async () => {
  const { createContextGuard } = await load();
  const canvas = new EventTarget();
  const log: string[] = [];
  const guard = createContextGuard(canvas, () => log.push('restore-hook'));
  guard.onChange((lost) => log.push(lost ? 'lost' : 'restored'));
  assert.equal(guard.lost(), false);
  const lost = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true, 'preventDefault lets the browser restore the context');
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(guard.lost(), true);
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(guard.lost(), false);
  assert.deepEqual(log, ['lost', 'restore-hook', 'restored']);
});

await test('dispose removes the listeners', async () => {
  const { createContextGuard } = await load();
  const canvas = new EventTarget();
  let calls = 0;
  const guard = createContextGuard(canvas);
  const off = guard.onChange(() => calls++);
  off();
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(calls, 0, 'unsubscribed listener');
  guard.dispose();
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(guard.lost(), true, 'disposed guard ignores events');
});

const fakeGl = (params: Record<number, unknown>, debug = true) => ({
  getParameter: (name: number) => params[name] ?? null,
  getExtension: (name: string) => (debug && name === 'WEBGL_debug_renderer_info' ? {} : null),
});
await test('renderer string: unmasked first, then RENDERER, then the next context kind, else unknown', async () => {
  const { gpuRendererString } = await load();
  const unmasked = fakeGl({ 0x9246: 'Mali-G52 MC2', 0x1F01: 'WebKit WebGL' });
  assert.equal(gpuRendererString(() => ({ getContext: () => unmasked })), 'Mali-G52 MC2');
  const masked = fakeGl({ 0x1F01: 'WebKit WebGL' }, false);
  assert.equal(gpuRendererString(() => ({ getContext: () => masked })), 'WebKit WebGL');
  const onlyWebgl1 = fakeGl({ 0x9246: 'PowerVR Rogue GE8320' });
  assert.equal(gpuRendererString(() => ({ getContext: (kind: string) => (kind === 'webgl' ? onlyWebgl1 : null) })),
    'PowerVR Rogue GE8320');
  assert.equal(gpuRendererString(() => ({ getContext: () => { throw new Error('blocked'); } })), 'unknown');
  assert.equal(gpuRendererString(() => ({ getContext: () => null })), 'unknown');
  const long = fakeGl({ 0x9246: 'x'.repeat(400) });
  assert.equal(gpuRendererString(() => ({ getContext: () => long })).length, 160);
});

await test('WebGL 2 probe: null or a throw means unavailable', async () => {
  const { webgl2Available } = await load();
  assert.equal(webgl2Available(() => ({ getContext: (kind: string) => (kind === 'webgl2' ? {} : null) })), true);
  assert.equal(webgl2Available(() => ({ getContext: () => null })), false);
  assert.equal(webgl2Available(() => ({ getContext: () => { throw new Error('no'); } })), false);
});

await test('renderer draws nothing while lost and re-applies quality on restore', () => {
  const world = source('src/render/world.ts');
  assert.match(world, /createContextGuard\(element,/);
  assert.match(world, /render\(alpha, dtSeconds\) \{\n\s+if \(disposed \|\| guard\.lost\(\)\) return false;/);
  const hook = world.slice(world.indexOf('createContextGuard(element,'), world.indexOf('const ready = loadGlobe();'));
  assert.match(hook, /applyQualityProfile\(renderer, quality\)/);
  assert.match(hook, /lastPaintAt = 0/);
});

await test('world loop holds the run while the context is lost', () => {
  const world = source('src/game/world.ts');
  const loop = world.slice(world.indexOf('const loop = '), world.indexOf('raf = requestAnimationFrame(loop);\n  //'));
  const hold = loop.indexOf('if (renderer.contextLost()) return;');
  assert.ok(hold > 0, 'contextLost check in the loop');
  assert.ok(hold < loop.indexOf('frameCallback?.(dt)'), 'checked before the run advances');
  assert.match(world, /t\('gl\.lost'\)/);
  assert.match(world, /canvas\.style\.visibility = lost \? 'hidden' : ''/, 'blank lost canvas hidden under the notice');
});

await test('main.ts shows the unsupported page when WebGL 2 is missing', () => {
  const main = source('src/main.ts');
  const at = main.indexOf('if (!webgl2Available(');
  assert.ok(at > 0, 'WebGL 2 probe after a failed world');
  assert.ok(main.slice(at, at + 200).includes('mountUnsupported(app, gpuRendererString('), 'unsupported page with the renderer');
});

await test('both catalogs carry the context texts', async () => {
  const { en } = await import('../src/i18n/en.ts');
  const { pl } = await import('../src/i18n/pl.ts');
  for (const catalog of [en, pl] as Array<Record<string, string>>) {
    for (const key of ['gl.lost', 'gl.unsupported.title', 'gl.unsupported.body', 'gl.unsupported.renderer', 'gl.unsupported.mail']) {
      assert.ok((catalog[key] ?? '').trim().length > 10, key);
    }
    assert.ok(catalog['gl.unsupported.renderer'].includes('{renderer}'));
  }
});

console.log(`SUMMARY test:webgl-context seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

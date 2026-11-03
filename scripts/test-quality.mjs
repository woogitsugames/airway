// [night-04] Headless checks of the low-end performance layer (D-73): terrain chunking keeps every
// triangle exactly once, the horizon test never hides a visible point, the LOD level switches with
// hysteresis, the battery-saver profile and frame cap, and the adaptive quality ladder.
// Fixed seed 0xA1A1, no WebGL. Run: npm run test:quality
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera, Vector3 } from 'three';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0xA1A1;
let passed = 0, failed = 0;
const check = (ok, label) => { if (ok) passed++; else { failed++; console.log('FAIL ' + label); } };

const { decodeLandMask } = await import('../src/render/globe/land-mask.ts');
const { buildTerrainArrays } = await import('../src/render/globe/terrain.ts');
const lod = await import('../src/render/globe/lod.ts');
const quality = await import('../src/render/quality.ts');
const mask = decodeLandMask(JSON.parse(readFileSync(resolve(ROOT, 'public/data/land-50m.json'), 'utf8')));

let state = SEED;
const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };

const levels = {};
for (const level of ['low', 'medium']) {
  const arrays = buildTerrainArrays(mask, level);
  const chunked = lod.chunkTerrain(arrays, level);
  levels[level] = chunked;
  const pos = chunked.geometry.getAttribute('position').array;
  check(chunked.triangles === arrays.stats.triangles && pos.length === arrays.positions.length,
    `${level}: chunking keeps all ${arrays.stats.triangles} triangles`);
  // Same multiset of triangles: order-independent checksums of positions and colours.
  const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 9) + 1); return s; };
  check(Math.abs(sum(arrays.positions) - sum(pos)) < 1e-3 * arrays.stats.triangles, `${level}: positions are a permutation of whole triangles`);
  check(sum(arrays.colors) === sum(chunked.geometry.getAttribute('color').array), `${level}: colours travel with their triangles`);
  // Chunk ranges tile the buffer contiguously, in storage order.
  let cursor = 0, contiguous = true;
  for (const c of chunked.chunks) { if (c.start !== cursor || c.count % 3) contiguous = false; cursor += c.count; }
  check(contiguous && cursor === pos.length / 3, `${level}: ${chunked.chunks.length} chunks tile the vertex buffer`);
  // Every vertex lies inside its chunk's cone and frustum sphere.
  let outside = 0;
  const p = new Vector3();
  for (const c of chunked.chunks) {
    for (let v = c.start; v < c.start + c.count; v += 7) {
      p.fromArray(pos, v * 3);
      if (Math.acos(Math.min(1, p.dot(c.center) / p.length())) > c.spread + 1e-6 ||
        p.distanceTo(c.sphere.center) > c.sphere.radius + 1e-6 || p.length() > c.maxRadius + 1e-6) outside++;
    }
  }
  check(outside === 0, `${level}: chunk bounds contain their vertices (${outside} outside)`);
}

// Horizon test is conservative: any vertex with a clear line of sight over the occluder sphere
// belongs to a chunk the test keeps.
{
  const chunked = levels.medium;
  const pos = chunked.geometry.getAttribute('position').array;
  const p = new Vector3(), eye = new Vector3(), dir = new Vector3();
  let hidden = 0, tested = 0, culled = 0;
  for (let k = 0; k < 24; k++) {
    const d = 1.3 + rand() * 9;
    eye.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(d);
    for (const c of chunked.chunks) {
      const kept = lod.chunkAboveHorizon(c, eye);
      if (!kept) culled++;
      if (kept) continue;
      for (let v = c.start; v < c.start + c.count; v += 5) {
        p.fromArray(pos, v * 3);
        // Segment eye→p misses the sphere of radius 0.995 ⇒ p is visible.
        dir.subVectors(p, eye);
        const len = dir.length();
        dir.divideScalar(len);
        const tc = -eye.dot(dir);
        const t = Math.max(0, Math.min(len, tc));
        const closest = eye.clone().addScaledVector(dir, t).length();
        tested++;
        if (closest > 0.995 + 1e-6) hidden++;
      }
    }
  }
  check(hidden === 0, `horizon test never hides a visible vertex (${hidden} of ${tested} sampled culled vertices)`);
  check(culled > 0, `horizon test culls chunks (${culled} chunk-views)`);
}

// LOD object: level by on-screen facet size, with hysteresis; runs cover exactly the visible chunks.
{
  const terrain = lod.createTerrainLod([levels.medium, levels.low], { dispose() {} });
  const camera = new PerspectiveCamera(30, 412 / 915, 0.05, 30);
  const place = (d, lon, lat) => {
    const r = Math.PI / 180;
    camera.position.set(d * Math.cos(lat * r) * Math.sin(lon * r), d * Math.sin(lat * r), d * Math.cos(lat * r) * Math.cos(lon * r));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  };
  const farFacet = levels.low.finestDeg;
  place(9.6, 10, 30);
  terrain.update(camera, 3 / farFacet);
  check(terrain.stats.level === 1, 'small globe on screen → far level');
  terrain.update(camera, 5 / farFacet);
  check(terrain.stats.level === 1, 'inside the hysteresis band → stays far');
  terrain.update(camera, 6 / farFacet);
  check(terrain.stats.level === 0, 'facets above 5.5 px → near level');
  terrain.update(camera, 5 / farFacet);
  check(terrain.stats.level === 0, 'inside the hysteresis band → stays near');
  terrain.update(camera, 0);
  check(terrain.stats.level === 0, 'unknown pixel density → near level');
  let worstRuns = 0, ok = true;
  for (const [d, lon, lat] of [[9.6, 10, 30], [5.3, -18, 40], [3.15, 140, -20], [3.15, 0, 85], [5.3, 179, 0]]) {
    place(d, lon, lat);
    terrain.update(camera, 100);
    const meshes = terrain.group.children.filter((m) => m.visible);
    let drawn = 0;
    for (const m of meshes) drawn += m.geometry.drawRange.count / 3;
    if (drawn !== terrain.stats.triangles || meshes.length !== terrain.stats.runs) ok = false;
    worstRuns = Math.max(worstRuns, terrain.stats.runs);
    if (process.env.DEBUG) console.log(d, lon, lat, terrain.stats.triangles / levels.medium.triangles, terrain.stats.runs, drawn, meshes.length);
    if (terrain.stats.triangles >= levels.medium.triangles * (d > 9 ? .85 : .65)) ok = false;
  }
  check(ok, 'drawn ranges equal the visible chunks and skip the far side (≥ 15 % far out, ≥ 35 % zoomed in)');
  check(worstRuns <= 16, `visible chunks merge into at most 16 draw runs (worst ${worstRuns})`);
  terrain.forceLevel(1);
  terrain.update(camera, 1000);
  check(terrain.stats.level === 1, 'forceLevel pins the far level');
  terrain.forceLevel(null);
}

// Battery saver profile, frame cap, adaptive ladder.
{
  const saver = quality.resolveQualityProfile('saver', { hardwareConcurrency: 8, deviceMemoryGb: 8, devicePixelRatio: 3 });
  check(saver.preset === 'low' && saver.pixelRatio === 1 && !saver.shadowEnabled && saver.maxFps === 30 &&
    saver.decorDensity < 1 && saver.batterySaver, 'saver: low terrain, DPR 1, no shadows, 30 fps, fewer decorations');
  const high = quality.resolveQualityProfile('high', { devicePixelRatio: 3 });
  check(high.maxFps === 0 && high.decorDensity === 1 && !high.batterySaver, 'presets keep full rate and decorations');
  check(quality.QUALITY_PREFERENCES.includes('saver'), 'saver is a selectable preference');
  const rate = (hz) => {
    let last = 0, drawn = 0;
    for (let i = 1; i <= hz * 10; i++) {
      const t = i * 1000 / hz;
      if (quality.frameDue(t - last, 30)) { drawn++; last = t; }
    }
    return drawn / 10;
  };
  check(rate(60) === 30 && rate(120) === 30 && rate(90) === 30, `30 fps cap at 60/90/120 Hz (${rate(60)}/${rate(90)}/${rate(120)})`);
  check(rate(30) === 30, 'a 30 Hz display is never halved');
  check(quality.frameDue(1, 0), 'no cap draws every frame');

  const steps = quality.adaptiveSteps(quality.resolveQualityProfile('medium', { devicePixelRatio: 2 }));
  check(steps.join() === 'pixel-ratio,decorations,terrain', `medium ladder ${steps.join()}`);
  check(quality.adaptiveSteps(quality.resolveQualityProfile('saver')).length === 0, 'saver has nothing left to drop');
  const fast = new quality.AdaptiveQualityMonitor(steps);
  let any = null;
  for (let i = 0; i < 2000; i++) any = any ?? fast.push(i % 10 ? 16.7 : 60);
  check(any === null, 'smooth frames with hitches never step down');
  const slow = new quality.AdaptiveQualityMonitor(steps);
  const taken = [];
  let firstAt = -1;
  for (let i = 0; i < 3000; i++) {
    const step = slow.push(50);
    if (step) { taken.push(step); if (firstAt < 0) firstAt = i; }
  }
  check(taken.join() === steps.join(), `slow frames walk the whole ladder once (${taken.join()})`);
  check(firstAt === 179, `first step after three slow windows (frame ${firstAt})`);
  const resume = new quality.AdaptiveQualityMonitor(steps);
  let stepped = null;
  for (let i = 0; i < 1000; i++) stepped = stepped ?? resume.push(400);
  check(stepped === null, 'resume gaps (> 250 ms) are ignored');
}

console.log(`SUMMARY test:quality seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;

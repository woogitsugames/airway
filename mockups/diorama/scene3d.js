// Direction "Diorama": a hand-made, low-poly 3D globe (three.js). Mockup renderer only — not game code.
// The sun is a real directional light at the subsolar point, so the day/night terminator, dusk light and
// city lights on the night side come from the scene itself, not from an overlay.
import * as THREE from 'three';
import { geoEquirectangular, geoPath, geoInterpolate, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import { CITIES } from '../lib/cities.mjs';
import { ROUTES, FLIGHTS, HUBS, CITIES_WAITING, CURFEW, SUN, NEW_CITY } from '../lib/scene.mjs';

const D2R = Math.PI / 180;
export const vec = (lon, lat, r = 1) => new THREE.Vector3(
  r * Math.cos(lat * D2R) * Math.sin(lon * D2R), r * Math.sin(lat * D2R), r * Math.cos(lat * D2R) * Math.cos(lon * D2R));

// ---- deterministic noise -------------------------------------------------------------------------------------
let seed = 7;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(p) {
  const i = p.clone().floor(), f = p.clone().sub(i); const u = f.clone().multiply(f).multiply(new THREE.Vector3(3, 3, 3).sub(f.clone().multiplyScalar(2)));
  let v = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++)
    v += hash(i.x + dx, i.y + dy, i.z + dz) * (dx ? u.x : 1 - u.x) * (dy ? u.y : 1 - u.y) * (dz ? u.z : 1 - u.z);
  return v;
}
const fbm = (p) => vnoise(p.clone().multiplyScalar(3)) * .55 + vnoise(p.clone().multiplyScalar(7)) * .3 + vnoise(p.clone().multiplyScalar(17)) * .15;

// ---- land mask (equirectangular canvas) ----------------------------------------------------------------------
async function landMask() {
  const topo = await (await fetch('/node_modules/world-atlas/land-50m.json')).json();
  const land = feature(topo, topo.objects.land);
  const W = 2048, H = 1024, mk = (blur) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H); if (blur) x.filter = `blur(${blur}px)`;
    x.fillStyle = '#fff'; x.beginPath(); geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), x)(land); x.fill();
    return x.getImageData(0, 0, W, H).data;
  };
  const sharp = mk(0), soft = mk(10);
  const at = (data, lon, lat) => { const px = Math.min(W - 1, Math.max(0, Math.round((lon + 180) / 360 * W))), py = Math.min(H - 1, Math.max(0, Math.round((90 - lat) / 180 * H))); return data[(py * W + px) * 4] / 255; };
  return { land: (lon, lat) => at(sharp, lon, lat), coast: (lon, lat) => at(soft, lon, lat) };
}

const PAL = {
  deep: new THREE.Color('#1f5f86'), sea: new THREE.Color('#2f86a8'), shallow: new THREE.Color('#4aa3b8'), sand: new THREE.Color('#e6cf91'),
  grass: new THREE.Color('#86b35a'), forest: new THREE.Color('#4f8a45'), jungle: new THREE.Color('#3d7a3c'), desert: new THREE.Color('#dcb36e'),
  rock: new THREE.Color('#9a8f7c'), snow: new THREE.Color('#f3f1ea'), tundra: new THREE.Color('#a9b48c'),
};
function biome(lon, lat, h, n) {
  const a = Math.abs(lat);
  if (a > 66 || h > 0.022) return PAL.snow;
  if (h > 0.015) return PAL.rock;
  if (a > 58) return PAL.tundra;
  const sahara = lat > 14 && lat < 33 && lon > -17 && lon < 60, arabia = lat > 13 && lat < 32 && lon > 34 && lon < 60;
  if (sahara || arabia) return n > .62 ? PAL.sand : PAL.desert;
  if (a < 12) return PAL.jungle;
  return n > .55 ? PAL.forest : PAL.grass;
}

// ---- globe mesh ----------------------------------------------------------------------------------------------
function globe(mask) {
  const geo = new THREE.IcosahedronGeometry(1, 150);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), tmp = new THREE.Vector3();
  const heightAt = new Map();
  const H = (x, y, z) => {
    const k = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`; if (heightAt.has(k)) return heightAt.get(k);
    tmp.set(x, y, z).normalize(); const lat = Math.asin(tmp.y) / D2R, lon = Math.atan2(tmp.x, tmp.z) / D2R;
    const l = mask.land(lon, lat), n = fbm(tmp);
    const h = l > .5 ? 0.005 + Math.max(0, n - .56) * 0.09 : -0.004 * (1 - mask.coast(lon, lat));
    const r = { h, lon, lat, l, n, c: mask.coast(lon, lat) }; heightAt.set(k, r); return r;
  };
  for (let i = 0; i < pos.count; i += 3) {
    let lsum = 0, hsum = 0, lon0 = 0, lat0 = 0, n0 = 0, c0 = 0;
    for (let j = 0; j < 3; j++) { const v = H(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)); lsum += v.l; hsum += v.h; lon0 += v.lon; lat0 += v.lat; n0 += v.n; c0 += v.c; }
    const isLand = lsum / 3 > .5, hh = hsum / 3, lat = lat0 / 3, lon = lon0 / 3, n = n0 / 3, coast = c0 / 3;
    let c;
    if (isLand) c = biome(lon, lat, hh, n).clone().offsetHSL(0, 0, (n - .5) * .06);
    else { const k = Math.min(1, coast * 2.2 + n * .2); c = PAL.deep.clone().lerp(PAL.sea, k).lerp(PAL.shallow, Math.max(0, Math.min(1, (coast - .3) / .4))); }
    for (let j = 0; j < 3; j++) {
      const v = H(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
      tmp.set(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)).normalize().multiplyScalar(1 + v.h);
      pos.setXYZ(i + j, tmp.x, tmp.y, tmp.z); col.set([c.r, c.g, c.b], (i + j) * 3);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92, metalness: 0 }));
  m.receiveShadow = true; return m;
}

/** Orient an object on the surface at lon/lat (local +Y = up, +Z = north). */
function place(obj, lon, lat, alt = 1.006) {
  const up = vec(lon, lat).normalize(), north = new THREE.Vector3(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize();
  const east = new THREE.Vector3().crossVectors(north, up);
  obj.position.copy(up.clone().multiplyScalar(alt));
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, north.clone().negate()));
  return obj;
}

// ---- trees ---------------------------------------------------------------------------------------------------
function trees(mask, count = 5000) {
  const cone = new THREE.ConeGeometry(.0028, .009, 5).translate(0, .0055, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#3f7a3b', flatShading: true, roughness: 1 });
  const mesh = new THREE.InstancedMesh(cone, mat, count); mesh.castShadow = true;
  const dummy = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  for (let tries = 0; k < count && tries < count * 30; tries++) {
    const lat = Math.asin(rnd() * 2 - 1) / D2R, lon = rnd() * 360 - 180, a = Math.abs(lat);
    if (mask.land(lon, lat) < .9 || a > 64) continue;
    const desert = lat > 13 && lat < 33 && lon > -17 && lon < 60; if (desert) continue;
    if (fbm(vec(lon, lat)) < .42) continue;
    place(dummy, lon, lat, 1.004 + Math.max(0, fbm(vec(lon, lat)) - .56) * .09); const s = .7 + rnd() * .8; dummy.scale.set(s, s * (a > 45 ? 1.3 : 1), s); dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix); mesh.setColorAt(k, c.set(a > 45 ? '#2f6b45' : a < 15 ? '#2f7a36' : (rnd() > .5 ? '#4f8a3f' : '#6a9a45'))); k++;
  }
  mesh.count = k; return mesh;
}
/** Desert: low sandstone rocks and dune ridges so the Sahara is not an empty plate. */
function rocks(mask, count = 220) {
  const geo = new THREE.DodecahedronGeometry(.006, 0).scale(1.6, .55, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#c99a5b', flatShading: true, roughness: 1 }), count); mesh.castShadow = true;
  const d = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  for (let t = 0; k < count && t < count * 40; t++) {
    const lat = 14 + rnd() * 19, lon = -16 + rnd() * 74; if (mask.land(lon, lat) < .9) continue;
    place(d, lon, lat, 1.005); d.rotateY(rnd() * 6); const s = .35 + rnd() * .6; d.scale.set(s, s, s); d.updateMatrix();
    mesh.setMatrixAt(k, d.matrix); mesh.setColorAt(k, c.set(rnd() > .5 ? '#c99a5b' : '#e0b878')); k++;
  }
  mesh.count = k; return mesh;
}

// ---- clouds --------------------------------------------------------------------------------------------------
function clouds(n = 70) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: .96 });
  for (let i = 0; i < n; i++) {
    const lat = Math.asin(rnd() * 1.6 - .8) / D2R, lon = rnd() * 360 - 180, cl = new THREE.Group();
    const puffs = 3 + Math.floor(rnd() * 4);
    for (let j = 0; j < puffs; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.012 + rnd() * .012, 0), mat); p.position.set((j - puffs / 2) * .014, rnd() * .006, (rnd() - .5) * .014); p.scale.y = .55; p.castShadow = true; cl.add(p); }
    g.add(place(cl, lon, lat, 1.07 + rnd() * .02));
  }
  return g;
}

// ---- planes --------------------------------------------------------------------------------------------------
const M = (c, e) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .6, emissive: e || '#000' });
export function planeModel(type) {
  const g = new THREE.Group(), white = M('#f7f5ee'), tailc = type === 'widebody' ? M('#e2553b') : M('#2a8f8a'), dark = M('#2a2f35');
  const L = type === 'widebody' ? 1.5 : 1;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.06 * L, .05 * L, 1 * L, 8).rotateX(Math.PI / 2), white); g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.06 * L, .16 * L, 8).rotateX(Math.PI / 2), white); nose.position.z = .58 * L; g.add(nose);
  if (type === 'widebody') {
    const wing = new THREE.Shape(); wing.moveTo(0, .12); wing.lineTo(.9, -.32); wing.lineTo(.9, -.44); wing.lineTo(0, -.18); wing.lineTo(-.9, -.44); wing.lineTo(-.9, -.32); wing.closePath();
    const w = new THREE.Mesh(new THREE.ExtrudeGeometry(wing, { depth: .03, bevelEnabled: false }).rotateX(Math.PI / 2), white); w.position.y = -.01; g.add(w);
    for (const x of [-.55, -.3, .3, .55]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .16, 8).rotateX(Math.PI / 2), dark); e.position.set(x, -.05, Math.abs(x) * -.45 + .08); g.add(e); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.03, .34, .26), tailc); tail.position.set(0, .2, -.62); tail.rotation.x = -.35; g.add(tail);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(.6, .02, .14), white); hs.position.set(0, .02, -.66); g.add(hs);
  } else {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.5, .03, .16), white); w.position.set(0, .06, .08); g.add(w);
    for (const x of [-.32, .32]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .22, 8).rotateX(Math.PI / 2), tailc); e.position.set(x, .03, .16); g.add(e);
      const prop = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .01, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2f35', transparent: true, opacity: .45 })); prop.position.set(x, .03, .28); g.add(prop); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.03, .3, .2), tailc); tail.position.set(0, .16, -.42); g.add(tail);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(.5, .02, .12), tailc); hs.position.set(0, .3, -.45); g.add(hs);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- airports ------------------------------------------------------------------------------------------------
function airport(code, hub) {
  const g = new THREE.Group(), s = hub ? 1.7 : 1.2;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.026 * s, .028 * s, .004, 20), M('#efe9da')); pad.position.y = .001; g.add(pad);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(.008 * s, .002, .046 * s), M('#3b4046')); rw.position.set(-.008 * s, .004, 0); rw.rotation.y = .5; g.add(rw);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.0012, .0022, .04 * s), M('#f5f1e6')); stripe.position.copy(rw.position); stripe.rotation.y = .5; g.add(stripe);
  const term = new THREE.Mesh(new THREE.BoxGeometry(.018 * s, .006 * s, .009 * s), M('#f2efe6')); term.position.set(.011 * s, .006, .006 * s); g.add(term);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(.019 * s, .0018, .010 * s), M(hub ? '#2a8f8a' : '#c96f4a')); roof.position.set(.011 * s, .0095 * s + .002, .006 * s); g.add(roof);
  if (hub) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(.0018, .0024, .02, 6), M('#f2efe6')); tw.position.set(.02, .012, -.012); g.add(tw);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(.0042, .003, .004, 8), M('#2a8f8a')); cab.position.set(.02, .023, -.012); g.add(cab);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const c = CITIES[code]; return place(g, c.lon, c.lat, 1.0055);
}

/** Hub capacity ring on the apron: one segment per seat in the lounge; lit = occupied (orange → red near full). */
function hubRing(code) {
  const h = HUBS[code], g = new THREE.Group(), n = h.cap, w = h.waiting.length, load = w / n;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, seg = new THREE.Mesh(new THREE.RingGeometry(.052, .064, 6, 1, a0 + .05, Math.PI * 2 / n - .1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: i < w ? (load > .8 ? '#c8352a' : '#ff9a3d') : '#f2efe6', transparent: true, opacity: i < w ? 1 : .55, side: THREE.DoubleSide }));
    seg.position.y = .004; g.add(seg);
  }
  const c = CITIES[code]; return place(g, c.lon, c.lat, 1.0058);
}

// ---- routes --------------------------------------------------------------------------------------------------
export function routeCurve(a, b, lift) {
  const A = [CITIES[a].lon, CITIES[a].lat], B = [CITIES[b].lon, CITIES[b].lat], f = geoInterpolate(A, B), d = geoDistance(A, B);
  const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80, [lo, la] = f(t); pts.push(vec(lo, la, 1.008 + lift * Math.sin(Math.PI * t) * Math.min(1, d / .9))); }
  return new THREE.CatmullRomCurve3(pts);
}
function routes() {
  const g = new THREE.Group();
  for (const [a, b, type] of ROUTES) {
    const cv = routeCurve(a, b, type === 'widebody' ? .09 : .035);
    if (type === 'widebody') {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 120, .0032, 6), new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#6b6458', roughness: .5 })));
    } else { // turboprop: dashed route made of short capsules
      const n = Math.max(6, Math.round(cv.getLength() / .022));
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = t0 + .55 / n; const seg = new THREE.CatmullRomCurve3([cv.getPointAt(t0), cv.getPointAt((t0 + t1) / 2), cv.getPointAt(t1)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(seg, 4, .0026, 5), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#6b4a10', roughness: .5 }))); }
    }
  }
  return g;
}
function flights() {
  const g = new THREE.Group();
  for (const [a, b, t, , type] of FLIGHTS) {
    const cv = routeCurve(a, b, type === 'widebody' ? .09 : .035), p = cv.getPointAt(t), tan = cv.getTangentAt(t), up = p.clone().normalize();
    const m = planeModel(type); m.scale.setScalar(type === 'widebody' ? .045 : .04);
    m.position.copy(p.clone().add(up.clone().multiplyScalar(.01)));
    const z = tan.clone().normalize(), x = new THREE.Vector3().crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); g.add(m);
    if (type === 'widebody') { // short contrail behind
      const pts = []; for (let k = 0; k < 10; k++) pts.push(cv.getPointAt(Math.max(0, t - k * .012)).add(up.clone().multiplyScalar(.006)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .0026, 5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 })));
    }
  }
  return g;
}

/** City lights on the night side: small warm points scattered around each city + a few hundred elsewhere. */
function cityLights(mask) {
  const pts = [];
  const add = (lon, lat, k, spread) => { for (let i = 0; i < k; i++) pts.push(vec(lon + (rnd() - .5) * spread, lat + (rnd() - .5) * spread * .7, 1.009)); };
  for (const c of Object.values(CITIES)) add(c.lon, c.lat, 26, 3);
  for (let i = 0; i < 1800; i++) { const lat = Math.asin(rnd() * 1.4 - .55) / D2R, lon = rnd() * 360 - 180; if (mask.land(lon, lat) > .9 && Math.abs(lat) < 60) pts.push(vec(lon, lat, 1.009)); }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const sun = vec(SUN.lon, SUN.lat).normalize();
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { sun: { value: sun } },
    vertexShader: 'uniform vec3 sun; varying float vN; void main(){ vN = smoothstep(0.05,-0.12,dot(normalize(position),sun)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 3.0; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vN; void main(){ vec2 d=gl_PointCoord-.5; if(dot(d,d)>.25) discard; gl_FragColor=vec4(1.,.78,.42,vN*.95); }' });
  return new THREE.Points(geo, mat);
}

/** Night-curfew marker: a low striped barrier ring around a closed airport. */
function curfewRing(code) {
  const g = new THREE.Group();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(.006, .005, .002), M(i % 2 ? '#e5483b' : '#f2efe6')); b.position.set(Math.cos(a) * .055, .004, Math.sin(a) * .055); b.rotation.y = -a + Math.PI / 2; g.add(b); }
  const c = CITIES[code]; return place(g, c.lon, c.lat, 1.0055);
}

/** Drawing preview LIS → ACC: a raised dashed arc that turns red past turboprop range, with a stop marker. */
function dragPreview() {
  const g = new THREE.Group(), cv = routeCurve('LIS', 'ACC', .035), n = 26;
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = t0 + .5 / n; const seg = new THREE.CatmullRomCurve3([cv.getPointAt(t0), cv.getPointAt((t0 + t1) / 2), cv.getPointAt(t1)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(seg, 4, .0034, 5), new THREE.MeshBasicMaterial({ color: t0 > .64 ? '#e5483b' : '#ffffff' }))); }
  return g;
}

// ---- scene assembly ------------------------------------------------------------------------------------------
export async function buildScene({ canvas, w, h, dpr = 2, look, dist, tilt = 0, fov = 30, offset = [0, 0], drag = true, light = 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05 * light;
  const scene = new THREE.Scene();
  const mask = await landMask();
  scene.add(globe(mask)); scene.add(trees(mask)); scene.add(rocks(mask)); scene.add(clouds()); scene.add(routes()); scene.add(flights()); scene.add(cityLights(mask));
  const hubs = Object.keys(HUBS);
  for (const k of Object.keys(CITIES_WAITING)) scene.add(airport(k, false));
  for (const k of hubs) { scene.add(airport(k, true)); scene.add(hubRing(k)); }
  for (const k of CURFEW) scene.add(curfewRing(k));
  if (drag) scene.add(dragPreview());
  // atmosphere: thin back-side shell, flat colour fading at the rim (no bloom)
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.11, 64, 64), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),1.); float a=smoothstep(.0,.6,f)*smoothstep(1.,.75,f); gl_FragColor=vec4(.62,.82,.92,a*.55); }' })));
  const sunDir = vec(SUN.lon, SUN.lat).normalize();
  const sun = new THREE.DirectionalLight('#fff4e0', 3.2); sun.position.copy(sunDir.clone().multiplyScalar(5)); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 2, far: 8 }); sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(new THREE.HemisphereLight('#bcd6ff', '#26324a', .55));
  const camera = new THREE.PerspectiveCamera(fov, w / h, .1, 50);
  // Oblique diorama camera: hover above a point `tilt` degrees south of the target and look at it, so the
  // horizon and curvature stay visible at the top of the screen.
  const target = vec(look[0], look[1]).normalize();
  camera.position.copy(vec(look[0], look[1] - tilt).normalize().multiplyScalar(1 + dist));
  camera.up.copy(target); camera.lookAt(target.clone().multiplyScalar(1.0));
  if (offset[0] || offset[1]) camera.setViewOffset(w, h, offset[0], offset[1], w, h);
  renderer.render(scene, camera);
  const project = (lon, lat, alt = 1.03) => { const v = vec(lon, lat, alt), front = v.clone().normalize().dot(camera.position.clone().sub(v)) > 0; v.project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front }; };
  return { renderer, scene, camera, project };
}

/** Render a single model on a small pedestal into its own canvas (upgrade cards). */
export function renderModel(canvas, w, h, obj, { dpr = 2, rotY = .8 } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(dpr); r.setSize(w, h, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
  const s = new THREE.Scene(); obj.rotation.y = rotY; s.add(obj);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, .08, 40), new THREE.MeshStandardMaterial({ color: '#d9d3c3', roughness: 1 })); ped.position.y = -.32; ped.receiveShadow = true; s.add(ped);
  const l = new THREE.DirectionalLight('#fff4e0', 3); l.position.set(2, 4, 3); l.castShadow = true; s.add(l); s.add(new THREE.HemisphereLight('#cfe3ff', '#3a3f4a', .9));
  const cam = new THREE.PerspectiveCamera(28, w / h, .1, 20); cam.position.set(0, 2.1, 4.6); cam.lookAt(0, -.15, 0); r.render(s, cam);
}
export { THREE, airport as airportModel };

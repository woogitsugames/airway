// Realistic globe for the K1/K2 mockups (2026-11c; not game code). three.js sphere shaded in one fragment shader:
// NASA Blue Marble NG (day, June 2004, topo+bathy; a 500 m/px crop over Europe and the Middle East blended into the
// global 8 km/px image), NASA Black Marble 2016 (night lights), sun-driven terminator with a dusk band, ocean
// glint, limb haze and a thin atmosphere shell. Positions are projected with the same camera for the SVG layer.
import * as THREE from 'three';

const TEX = '../.tex/';
const D2R = Math.PI / 180;
const RS = 1.022; // atmosphere shell radius (exaggerated ~2x for legibility at phone size)
export const ll2v = (lon, lat, r = 1) => new THREE.Vector3(
  r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));

function load(url) {
  return new Promise((ok, err) => new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.wrapS = THREE.RepeatWrapping; ok(t);
  }, undefined, err));
}

const VERT = /* glsl */`
varying vec3 vP;
void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D dayBase, dayDetail, nightTex;
uniform vec3 sun, camPos, atm;
uniform float nightGain, moon, grade, haze;
varying vec3 vP;
const float PI = 3.14159265;
vec3 sat(vec3 c, float s){ float l = dot(c, vec3(.2126,.7152,.0722)); return mix(vec3(l), c, s); }
void main(){
  vec3 n = normalize(vP);
  float lat = asin(clamp(n.y,-1.,1.)), lon = atan(-n.z, n.x);
  vec2 uv = vec2(lon/(2.*PI)+.5, lat/PI+.5);
  vec3 day = texture2D(dayBase, uv).rgb;
  float ld = degrees(lon), la = degrees(lat);
  vec2 ud = vec2(ld/64., (la-18.)/48.);
  float w = smoothstep(0.,.04,ud.x)*smoothstep(1.,.96,ud.x)*smoothstep(0.,.05,ud.y)*smoothstep(1.,.95,ud.y);
  if (w > 0.) day = mix(day, texture2D(dayDetail, ud).rgb, w);
  // own grading: a touch less saturation, lifted mids, cooler deep water
  float lum = dot(day, vec3(.2126,.7152,.0722));
  float water = smoothstep(.02,.10, day.b - day.r) * (1. - smoothstep(.30,.45,lum));
  day = sat(day, mix(.86, 1.0, water));
  day = pow(day, vec3(grade));
  day = mix(day, day*vec3(.86,.98,1.08), water*.6);

  vec3 V = normalize(camPos - vP);
  float ndl = dot(n, sun);
  float light = clamp(ndl*2.2 + .1, 0., 1.);
  light = pow(light, .6);
  vec3 col = day * (.035 + 1.08*light);
  vec3 H = normalize(sun + V);
  col += vec3(1.,.93,.80) * pow(max(dot(n,H),0.), 70.) * .32 * water * smoothstep(0.,.2,ndl);
  // dusk band: warm, narrow, physical (no glow)
  float dusk = smoothstep(-.20, -.01, ndl) * (1. - smoothstep(-.01, .16, ndl));
  col = mix(col, col*vec3(1.25,.82,.62) + vec3(.035,.012,.0), dusk*.55);
  // night: Black Marble lights + faint moonlight on the land
  float nightW = 1. - smoothstep(-.14, .06, ndl);
  vec3 nl = texture2D(nightTex, uv).rgb;
  // split city lights from Black Marble's blue base: lights keep their sodium colour, the base goes neutral
  float nlum = dot(nl, vec3(.2126,.7152,.0722));
  float lm = smoothstep(.16, .42, nlum);
  vec3 base = vec3(nlum) * vec3(.62,.68,.76) * .55;
  vec3 lights = mix(base, pow(nl, vec3(1.15)) * vec3(1.06,.98,.86), lm) * nightGain;
  col += nightW * (lights + vec3(dot(day, vec3(.3,.55,.15)))*moon*vec3(.70,.78,.86));
  // limb haze, lit side only
  float fr = pow(1. - max(dot(n, V), 0.), 2.6);
  float hz = fr * haze * smoothstep(-.25, .35, ndl);
  col = mix(col, atm * (.35 + .75*light), clamp(hz, 0., .85));
  gl_FragColor = vec4(col, 1.);
}`;

const ATM_V = /* glsl */`
varying vec3 vN; varying vec3 vW;
void main(){ vN = normalize(position); vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ATM_F = /* glsl */`
uniform vec3 sun, camPos, atm; uniform float strength, rs;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 V = normalize(camPos - vW);
  // impact parameter of the view ray through this fragment: 1 = planet limb, rs = top of the shell
  float b = length(cross(vW, V));
  float t = clamp((b - 1.) / (rs - 1.), 0., 1.);
  float rim = pow(1. - t, 2.4);
  float sl = dot(normalize(vW), sun);
  float lit = smoothstep(-.30, .30, sl);
  vec3 c = mix(vec3(.78,.60,.52), atm, smoothstep(-.18, .15, sl));
  gl_FragColor = vec4(c * rim * lit * strength, 1.);
}`;

export async function makeGlobe(stage, { w, h, dpr, theme, cam, sunLL }) {
  const [dayBase, dayDetail, nightTex] = await Promise.all([
    load(TEX + 'day-5400.jpg'), load(TEX + 'day-detail.jpg'), load(TEX + 'night-8192.jpg')]);
  dayDetail.wrapS = THREE.ClampToEdgeWrapping; dayDetail.wrapT = THREE.ClampToEdgeWrapping;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(dpr); renderer.setSize(w, h); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color(theme.space), 1);
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cam.fov, w / h, 0.001, 50);
  const eye = ll2v(cam.lon, cam.lat, 1 + cam.alt);
  const target = ll2v(cam.tlon, cam.tlat, 1);
  camera.position.copy(eye); camera.up.set(0, 1, 0); camera.lookAt(target);
  if (cam.shift) { camera.setViewOffset(w, h, cam.shift[0], cam.shift[1], w, h); }
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const sun = ll2v(sunLL.lon, sunLL.lat).normalize();
  const atm = new THREE.Color(theme.atm);
  const uni = {
    dayBase: { value: dayBase }, dayDetail: { value: dayDetail }, nightTex: { value: nightTex },
    sun: { value: sun }, camPos: { value: eye }, atm: { value: new THREE.Vector3(atm.r, atm.g, atm.b) },
    nightGain: { value: theme.nightGain }, moon: { value: theme.moon }, grade: { value: theme.grade }, haze: { value: theme.haze },
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 512, 256), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG })));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(RS, 256, 128), new THREE.ShaderMaterial({
    uniforms: { sun: uni.sun, camPos: uni.camPos, atm: uni.atm, strength: { value: theme.atmStrength }, rs: { value: RS } },
    vertexShader: ATM_V, fragmentShader: ATM_F, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  scene.add(shell);
  if (theme.stars) {
    const n = 420, pos = new Float32Array(n * 3); let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).normalize().multiplyScalar(20); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa6b8, size: 1.2 * dpr, sizeAttenuation: false, transparent: true, opacity: 0.45 })));
  }
  renderer.render(scene, camera);
  const v = new THREE.Vector3();
  // project lon/lat (+ altitude in R) to CSS px; vis=false when behind the planet
  function project(lon, lat, alt = 0) {
    const p = ll2v(lon, lat, 1 + alt);
    const toCam = eye.clone().sub(p); const vis = p.clone().normalize().dot(toCam) > -alt * 2 - 1e-4 && p.length() > 0;
    v.copy(p).project(camera);
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, vis: vis && v.z < 1 };
  }
  // ground-plane depth cue: how far a point is (0 near, 1 horizon) for label scaling
  function depth(lon, lat) { return ll2v(lon, lat).distanceTo(eye); }
  return { project, depth, renderer, sun };
}

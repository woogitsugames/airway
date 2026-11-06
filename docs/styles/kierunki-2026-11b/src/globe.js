// Software globe for the 2026-11b art-direction mockups (not game code).
// Builds equirectangular rasters (land mask, elevation, hillshade, distance to coast) from
// world-atlas land-50m (Natural Earth, public domain) and the game's own ETOPO5 elevation PNG,
// then shades an orthographic globe pixel by pixel with a direction-specific shade function.
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const W = 2048, H = 1024;
const D2R = Math.PI / 180;

async function loadImage(src) {
  const img = new Image(); img.src = src; await img.decode(); return img;
}

export async function prepareWorld() {
  const topo = await (await fetch('/node_modules/world-atlas/land-50m.json')).json();
  const land = feature(topo, topo.objects.land);
  const c = new OffscreenCanvas(W, H); const g = c.getContext('2d');
  const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.beginPath(); geoPath(proj, g)(land); g.fill();
  const lm = g.getImageData(0, 0, W, H).data;
  const mask = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = lm[i * 4] / 255;

  const eimg = await loadImage('/public/data/globe/elevation-2048.png');
  const ec = new OffscreenCanvas(W, H); const eg = ec.getContext('2d');
  eg.drawImage(eimg, 0, 0, W, H);
  const ed = eg.getImageData(0, 0, W, H).data;
  const elev = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) elev[i] = (ed[i * 4] / 228) * (mask[i] > 0.5 ? 1 : 0);

  // Hillshade, light from the north-west (Imhof's convention), exaggerated.
  const hs = new Float32Array(W * H);
  const lx = -0.6, ly = 0.6, lz = 0.53;
  for (let y = 1; y < H - 1; y++) {
    const coslat = Math.max(0.2, Math.cos(((H / 2 - y) / H) * Math.PI));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xl = y * W + ((x + W - 1) % W), xr = y * W + ((x + 1) % W);
      const dzdx = (elev[xr] - elev[xl]) * 28 / coslat;
      const dzdy = (elev[i - W] - elev[i + W]) * 28;
      const nx = -dzdx, ny = -dzdy, nz = 1; const n = Math.hypot(nx, ny, nz);
      hs[i] = Math.max(0, (nx * lx + ny * ly + nz * lz) / n);
    }
  }
  // blurred copies (box blur, radius 3) for posterised styles: bigger, calmer shapes
  const blur = (src, r) => {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * W + ((x + W) % W)];
      for (let x = 0; x < W; x++) { tmp[y * W + x] = acc / (2 * r + 1); acc += src[y * W + ((x + r + 1) % W)] - src[y * W + ((x - r + W) % W)]; } }
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) { let acc = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { acc += tmp[yy * W + x]; n++; } } out[y * W + x] = acc / n; } }
    return out;
  };
  const hsb = blur(hs, 3), elevb = blur(elev, 2);
  // Chamfer distance from land (in equirect px, x scaled by cos(lat)).
  const dist = new Float32Array(W * H);
  const INF = 1e9;
  for (let i = 0; i < W * H; i++) dist[i] = mask[i] > 0.5 ? 0 : INF;
  const pass = (y0, y1, dy, x0, x1, dx) => {
    for (let y = y0; y !== y1; y += dy) {
      const cl = Math.max(0.15, Math.cos(((H / 2 - y) / H) * Math.PI));
      for (let x = x0; x !== x1; x += dx) {
        const i = y * W + x; let d = dist[i];
        const xp = x - dx, yp = y - dy;
        if (xp >= 0 && xp < W) d = Math.min(d, dist[y * W + xp] + cl);
        if (yp >= 0 && yp < H) {
          d = Math.min(d, dist[yp * W + x] + 1);
          if (xp >= 0 && xp < W) d = Math.min(d, dist[yp * W + xp] + Math.hypot(1, cl));
        }
        dist[i] = d;
      }
    }
  };
  pass(0, H, 1, 0, W, 1); pass(H - 1, -1, -1, W - 1, -1, -1);
  pass(0, H, 1, W - 1, -1, -1); pass(H - 1, -1, -1, 0, W, 1);
  // high-resolution land mask for the game camera's region (crisp coasts when zoomed in)
  const hi = { lon0: -12, lon1: 92, lat0: 0, lat1: 72, res: 0.025 };
  hi.w = Math.round((hi.lon1 - hi.lon0) / hi.res); hi.h = Math.round((hi.lat1 - hi.lat0) / hi.res);
  const hc = new OffscreenCanvas(hi.w, hi.h); const hg = hc.getContext('2d');
  const hp = geoEquirectangular().scale(180 / Math.PI / hi.res).translate([-(hi.lon0 / hi.res), hi.lat1 / hi.res]);
  hg.fillStyle = '#fff'; hg.beginPath(); geoPath(hp, hg)(land); hg.fill();
  const hd = hg.getImageData(0, 0, hi.w, hi.h).data; hi.m = new Uint8Array(hi.w * hi.h);
  for (let i = 0; i < hi.m.length; i++) hi.m[i] = hd[i * 4 + 3];
  return { land, mask, elev, hs, dist, hi, hsb, elevb };
}

function sampleHi(hi, lon, lat) {
  const fx = (lon - hi.lon0) / hi.res - 0.5, fy = (hi.lat1 - lat) / hi.res - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy); if (x0 < 0 || y0 < 0 || x0 >= hi.w - 1 || y0 >= hi.h - 1) return -1;
  const tx = fx - x0, ty = fy - y0, m = hi.m, w = hi.w;
  const a = m[y0 * w + x0], b = m[y0 * w + x0 + 1], c = m[(y0 + 1) * w + x0], d = m[(y0 + 1) * w + x0 + 1];
  return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 255;
}
function sample(arr, lon, lat) {
  const fx = ((lon + 180) / 360) * W - 0.5, fy = ((90 - lat) / 180) * H - 0.5;
  const x0 = Math.floor(fx), y0 = Math.max(0, Math.min(H - 2, Math.floor(fy)));
  const tx = fx - x0, ty = Math.max(0, Math.min(1, fy - y0));
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W;
  const a = arr[y0 * W + xa], b = arr[y0 * W + xb], c = arr[(y0 + 1) * W + xa], d = arr[(y0 + 1) * W + xb];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// Perspective camera above the globe (unit sphere). Looks from the south-east-ish side towards `look`,
// so the horizon (limb) shows at the top of a portrait frame like the game's camera.
const V = {
  p: (lon, lat) => { const a = lon * D2R, b = lat * D2R; return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)]; },
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; },
};
export function makeCamera(o) {
  const T = V.p(o.lon, o.lat);
  const east = V.norm(V.cross([0, 0, 1], T)), north = V.cross(T, east);
  const pos = V.sub(V.add(T, V.mul(T, o.alt)), V.mul(north, o.back));
  const look = V.p(o.lookLon ?? o.lon, o.lookLat ?? o.lat);
  const f = V.norm(V.sub(look, pos));
  const right = V.norm(V.cross(f, V.add(north, V.mul(T, 0.3))));
  const up = V.cross(right, f);
  const cam = { ...o, pos, f, right, up, R: o.F * 0.0175 };
  cam.projectV = (P) => {
    const v = V.sub(P, pos); const z = V.dot(v, f); if (z <= 0) return null;
    return [o.cx + o.F * V.dot(v, right) / z, o.cy - o.F * V.dot(v, up) / z];
  };
  cam.project = (lonlat, lift = 0) => {
    const P = V.p(lonlat[0], lonlat[1]);
    if (V.dot(V.sub(P, pos), P) > 0) return null; // far side
    return cam.projectV(V.mul(P, 1 + lift));
  };
  // far-side points are pulled onto the horizon so filled land polygons stay closed
  const pl = Math.hypot(pos[0], pos[1], pos[2]), n = V.mul(pos, 1 / pl), ha = 1 / pl, hb = Math.sqrt(1 - ha * ha);
  cam.projectClamp = (lonlat) => {
    const P = V.p(lonlat[0], lonlat[1]);
    if (V.dot(P, pos) >= 1) { const u = V.norm(V.sub(P, V.mul(n, V.dot(P, n)))); return cam.projectV(V.add(V.mul(n, ha), V.mul(u, hb))); }
    return cam.projectV(P);
  };
  cam.ray = (px, py) => V.norm(V.add(f, V.add(V.mul(right, (px - o.cx) / o.F), V.mul(up, (o.cy - py) / o.F))));
  // screen centre of the globe and limb are found numerically for sky effects
  return cam;
}

// Land mask rasterised in screen space at ss x resolution (crisp coasts at any zoom).
export function screenMask(world, cam, Wc, Hc, ss) {
  const c = new OffscreenCanvas(Wc * ss, Hc * ss); const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath();
  const projection = { stream: (out) => ({
    point(lon, lat) { const p = cam.projectClamp([lon, lat]); if (p) out.point(p[0] * ss, p[1] * ss); },
    lineStart() { out.lineStart(); }, lineEnd() { out.lineEnd(); },
    polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); }, sphere() {},
  }) };
  geoPath(projection, g)(world.land); g.fill('evenodd');
  const d = g.getImageData(0, 0, Wc * ss, Hc * ss).data; const m = new Float32Array(Wc * ss * Hc * ss);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
  return m;
}

// shade(s) -> [r,g,b]. On the globe s.hit = true with lat, lon, land, elev, hs, dist, sun, nx/ny/nz (camera space);
// off the globe s.hit = false and s.gap = ray's closest distance to the sphere minus 1 (for atmosphere rings).
export function renderGlobe(ctx, world, cam, sun, shade, ss = 2, sky = null, edgeD = 0.03) {
  const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, Wc, Hc); const d = img.data;
  const sl = sun.lat * D2R, sunLon = sun.lon; const C0 = cam.pos; const cc = V.dot(C0, C0) - 1;
  const s = {};
  for (let py = 0; py < Hc; py++) {
    for (let px = 0; px < Wc; px++) {
      let r = 0, g = 0, b = 0, cov = 0, hitAny = false;
      const i = (py * Wc + px) * 4;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const dir = cam.ray(px + (sx + 0.5) / ss, py + (sy + 0.5) / ss);
        const bq = V.dot(C0, dir); const disc = bq * bq - cc;
        s.x = px; s.y = py;
        if (disc < 0) {
          if (!sky) continue;
          const cl = V.add(C0, V.mul(dir, -bq)); s.hit = false; s.gap = Math.hypot(cl[0], cl[1], cl[2]) - 1;
          const c = sky(s, [d[i], d[i + 1], d[i + 2]]); if (!c) continue; r += c[0]; g += c[1]; b += c[2]; cov++; continue;
        }
        hitAny = true;
        const t = -bq - Math.sqrt(disc); const P = V.add(C0, V.mul(dir, t));
        const lat = Math.asin(Math.max(-1, Math.min(1, P[2]))) / D2R; const lon = Math.atan2(P[1], P[0]) / D2R;
        s.hit = true; s.lat = lat; s.lon = lon;
        s.nx = V.dot(P, cam.right); s.ny = V.dot(P, cam.up); s.nz = -V.dot(P, cam.f);
        { const h = sampleHi(world.hi, lon, lat); s.land = h >= 0 ? h : sample(world.mask, lon, lat);
          if (h >= 0) { const e = edgeD; const a1 = sampleHi(world.hi, lon + e, lat), a2 = sampleHi(world.hi, lon - e, lat), a3 = sampleHi(world.hi, lon, lat + e), a4 = sampleHi(world.hi, lon, lat - e);
            s.edge = Math.min(a1, a2, a3, a4) < 0 ? 0 : Math.max(h, a1, a2, a3, a4) - Math.min(h, a1, a2, a3, a4); } else s.edge = 0; } s.elev = sample(world.elev, lon, lat);
        s.hs = sample(world.hs, lon, lat); s.hsb = sample(world.hsb, lon, lat); s.elevb = sample(world.elevb, lon, lat); s.dist = sample(world.dist, lon, lat);
        const la = lat * D2R;
        s.sun = Math.sin(la) * Math.sin(sl) + Math.cos(la) * Math.cos(sl) * Math.cos((lon - sunLon) * D2R);
        const c = shade(s); r += c[0]; g += c[1]; b += c[2]; cov++;
      }
      if (!cov) continue;
      const a = cov / (ss * ss);
      d[i] = d[i] * (1 - a) + (r / cov) * a; d[i + 1] = d[i + 1] * (1 - a) + (g / cov) * a; d[i + 2] = d[i + 2] * (1 - a) + (b / cov) * a; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// Coastline as an SVG path string in screen space (for inked/painted coast strokes).
export function coastD(world, cam) {
  let d = '';
  const ctx = { moveTo: (x, y) => { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; }, lineTo: (x, y) => { d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }, closePath: () => { d += 'Z'; }, arc() {} };
  const projection = { stream: (out) => ({
    point(lon, lat) { const p = cam.projectClamp([lon, lat]); if (p) out.point(p[0], p[1]); },
    lineStart() { out.lineStart(); }, lineEnd() { out.lineEnd(); },
    polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); }, sphere() {},
  }) };
  geoPath(projection, ctx)(world.land);
  return d;
}

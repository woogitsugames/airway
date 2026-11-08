// [night-78a] Z (PLAN-NOWY-KIERUNEK), D-333: every launcher / store / launch-screen image of the app mark I-1 "Wezel"
// (D-326) from ONE definition, with a dependency-free, deterministic rasterizer (no Chromium, no image library).
// The mark: the hub's double ring in cream and the D-08 bow-tie glyph in direction yellow, on black enamel (the same
// geometry as docs/styles/kierunki-2026-11c/znak/znak-i-1.svg, 1024 units). All content sits inside the Android
// adaptive safe circle (66/108 of the canvas = 626 units; the outer ring is 568 across).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENAMEL = '#0E0F0F';
export const CREAM = '#EFE7D3';
export const YELLOW = '#F3C317';
/** Android adaptive icon: the safe circle is 66 of 108 dp. */
export const SAFE_DIAMETER = 1024 * 66 / 108;

const f = (n) => +n.toFixed(2);

/** The mark's shapes as SVG elements. `k` scales it about the canvas centre, `ink` overrides the colours. */
function markElements(k = 1, ink = {}) {
  const ring = ink.ring ?? CREAM, glyph = ink.glyph ?? YELLOW;
  const s = 16 + 1 / 3; // the glyph is 12 units wide in its own grid
  const p = (x, y) => `${f(512 + x * s * k)},${f(512 + y * s * k)}`;
  return [
    `<circle cx="512" cy="512" r="${f(262 * k)}" fill="none" stroke="${ring}" stroke-width="${f(44 * k)}"/>`,
    `<circle cx="512" cy="512" r="${f(176 * k)}" fill="none" stroke="${ring}" stroke-width="${f(16 * k)}"/>`,
    `<polygon points="${p(-6, -5.5)} ${p(0, 0)} ${p(-6, 5.5)}" fill="${glyph}"/>`,
    `<polygon points="${p(6, -5.5)} ${p(0, 0)} ${p(6, 5.5)}" fill="${glyph}"/>`,
  ];
}
const bg = (color) => `<rect x="0" y="0" width="1024" height="1024" fill="${color}"/>`;
const svg = (comment, parts) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n  <!-- ${comment} -->\n` +
  parts.map((part) => '  ' + part + '\n').join('') + '</svg>\n';

/** Source SVGs (path relative to the repository root -> text). The one place the mark is defined. */
export function sourceSvgs() {
  const icon = svg('[night-78a] D-326/D-333: app mark I-1 "Wezel", full-bleed tile (store, legacy and iOS icon).', [bg(ENAMEL), ...markElements()]);
  const files = {
    'resources/icon.svg': icon,
    'resources/icon-foreground.svg': svg('[night-78a] Adaptive foreground: transparent, the whole mark inside the 66/108 safe circle.', markElements()),
    'resources/icon-monochrome.svg': svg('[night-78a] Android 13 themed icon: one-colour silhouette, only the alpha is used.', markElements(1, { ring: '#000000', glyph: '#000000' })),
    // Android splash icon: the system shows it in a circle 2/3 of the 288 dp canvas, so the mark is 0.317 of the tile.
    'resources/splash.svg': svg('[night-78a] Launch mark, transparent; the enamel behind it comes from the splash background colour.', markElements(0.317)),
    'ios/Brand/app-icon.svg': icon,
    'ios/Brand/splash.svg': null,
    'site/assets/favicon.svg': icon.replace('<svg ', '<svg role="img" aria-label="Airway" '),
  };
  files['ios/Brand/splash.svg'] = files['resources/splash.svg'];
  return files;
}

// ---- rasterizer (the one of task 24, extended with rings) ---------------------------------------------------------
function attributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function parseShapes(text, label = 'svg') {
  const viewBox = text.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!viewBox || viewBox[1] !== viewBox[2]) throw new Error('Expected a square SVG viewBox: ' + label);
  const shapes = [];
  for (const match of text.matchAll(/<(rect|polygon|circle)\b([^>]*)\/>/g)) {
    const props = attributes(match[2]);
    const ring = match[1] === 'circle' && props.fill === 'none';
    const colour = ring ? props.stroke : props.fill;
    if (!/^#[0-9a-fA-F]{6}$/.test(colour ?? '')) throw new Error('Unsupported fill in ' + label);
    const shape = { type: ring ? 'ring' : match[1], rgb: rgbOf(colour) };
    if (match[1] === 'rect') {
      Object.assign(shape, { x: Number(props.x), y: Number(props.y), width: Number(props.width), height: Number(props.height) });
    } else if (match[1] === 'circle') {
      Object.assign(shape, { cx: Number(props.cx), cy: Number(props.cy), radius: Number(props.r) });
      if (ring) {
        const half = Number(props['stroke-width']) / 2;
        Object.assign(shape, { inner: shape.radius - half, outer: shape.radius + half });
      }
    } else {
      const nums = (props.points ?? '').trim().split(/[\s,]+/).map(Number);
      if (nums.length < 6 || nums.length % 2) throw new Error('Invalid polygon: ' + label);
      shape.points = Array.from({ length: nums.length / 2 }, (_, i) => [nums[i * 2], nums[i * 2 + 1]]);
    }
    shapes.push(shape);
  }
  if (!shapes.length) throw new Error('No SVG shapes found: ' + label);
  return { view: Number(viewBox[1]), shapes };
}
export const loadShapes = (file) => parseShapes(readFileSync(join(ROOT, 'resources', file), 'utf8'), file);

function inside(shape, x, y) {
  if (shape.type === 'rect') return x >= shape.x && y >= shape.y && x < shape.x + shape.width && y < shape.y + shape.height;
  if (shape.type === 'circle') return (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.radius ** 2;
  if (shape.type === 'ring') {
    const d = (x - shape.cx) ** 2 + (y - shape.cy) ** 2;
    return d >= shape.inner ** 2 && d <= shape.outer ** 2;
  }
  let hit = false;
  const points = shape.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const val of buf) {
    crc ^= val;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(name, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, data.length + 8)), data.length + 8);
  return out;
}

/** Rasterize to RGBA pixels (coverage anti-aliasing, 4x4 samples up to 512 px, 2x2 above).
 *  options: round (circular mask), background (#rrggbb under the shapes), size of the output square. */
export function rasterize(source, size, { round = false, background = null } = {}) {
  const { view, shapes } = source;
  const pixels = Buffer.alloc(size * size * 4);
  const samples = size <= 512 ? 4 : 2;
  const base = background ? rgbOf(background) : null;
  const scale = view / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, coverage = 0;
      for (let dy = 0; dy < samples; dy++) for (let dx = 0; dx < samples; dx++) {
        const u = x + (dx + 0.5) / samples, v = y + (dy + 0.5) / samples;
        if (round && (u - size / 2) ** 2 + (v - size / 2) ** 2 > (size / 2) ** 2) continue;
        const px = u * scale, py = v * scale;
        let color = base;
        for (const shape of shapes) if (inside(shape, px, py)) color = shape.rgb;
        if (color) { r += color[0]; g += color[1]; b += color[2]; coverage++; }
      }
      const index = (y * size + x) * 4;
      if (coverage) {
        pixels[index] = Math.round(r / coverage);
        pixels[index + 1] = Math.round(g / coverage);
        pixels[index + 2] = Math.round(b / coverage);
        pixels[index + 3] = Math.round(255 * coverage / (samples * samples));
      }
    }
  }
  return pixels;
}

/** PNG bytes from RGBA pixels; `opaque` writes 8-bit RGB (colour type 2, no alpha channel at all). */
export function encodePng(pixels, size, { opaque = false } = {}) {
  const channels = opaque ? 3 : 4;
  const stride = size * channels + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4, to = y * stride + 1 + x * channels;
      raw[to] = pixels[from]; raw[to + 1] = pixels[from + 1]; raw[to + 2] = pixels[from + 2];
      if (!opaque) raw[to + 3] = pixels[from + 3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export const svgToPng = (source, size, options = {}) => encodePng(rasterize(source, size, options), size, options);

/** Grey version of an RGBA buffer for the iOS tinted icon (the system tints by luminance). */
function tinted(pixels) {
  const out = Buffer.from(pixels);
  for (let i = 0; i < out.length; i += 4) {
    const y = Math.round(0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]);
    out[i] = out[i + 1] = out[i + 2] = y;
  }
  return out;
}

// ---- outputs --------------------------------------------------------------------------------------------------------
const rel = (path) => join(ROOT, path);

/** Android PNGs (git-ignored, regenerated by `npm run android:assets`): legacy square + round launcher, adaptive
 *  foreground, monochrome (themed icon) in 5 densities, and the splash drawable. Returns {path: bytes}. */
export function androidAssets() {
  const icon = loadShapes('icon.svg');
  const foreground = loadShapes('icon-foreground.svg');
  const monochrome = loadShapes('icon-monochrome.svg');
  const splash = loadShapes('splash.svg');
  const out = {};
  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const dir = 'android/app/src/main/res/mipmap-' + density + '/';
    out[dir + 'ic_launcher.png'] = svgToPng(icon, Math.round(48 * scale));
    out[dir + 'ic_launcher_round.png'] = svgToPng(icon, Math.round(48 * scale), { round: true });
    out[dir + 'ic_launcher_foreground.png'] = svgToPng(foreground, Math.round(108 * scale));
    out[dir + 'ic_launcher_monochrome.png'] = svgToPng(monochrome, Math.round(108 * scale));
  }
  out['android/app/src/main/res/drawable-nodpi/splash.png'] = svgToPng(splash, 1152);
  return out;
}

/** Committed PNGs: the Play Store icon, the iOS icon set and the iOS launch image. */
export function committedAssets() {
  const icon = loadShapes('icon.svg');
  const out = {};
  out['docs/store/icon-512.png'] = svgToPng(icon, 512, { opaque: true });
  const set = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/';
  const full = rasterize(icon, 1024);
  out[set + 'AppIcon-512@2x.png'] = encodePng(full, 1024, { opaque: true });
  out[set + 'AppIcon-dark.png'] = out[set + 'AppIcon-512@2x.png']; // the tile is already dark enamel
  out[set + 'AppIcon-tinted.png'] = encodePng(tinted(full), 1024, { opaque: true });
  // Launch image: the transparent splash mark over the enamel, 2732 square (same bytes in the three scale slots).
  const launch = encodePng(rasterize(loadShapes('splash.svg'), 2732, { background: ENAMEL }), 2732, { opaque: true });
  const slots = 'ios/App/App/Assets.xcassets/Splash.imageset/';
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) out[slots + name] = launch;
  return out;
}

export function write(files) {
  for (const [path, data] of Object.entries(files)) {
    mkdirSync(dirname(rel(path)), { recursive: true });
    writeFileSync(rel(path), data);
  }
  return Object.keys(files).length;
}

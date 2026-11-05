// [night-12s] R7g: read the Unicode code points a TrueType/OpenType font maps (cmap formats 4 and 12), no dependency.
// [night-11ax] D-257: also WOFF2 (the shipped fonts): the table data is one Brotli stream (node:zlib) and `cmap` is
// never transformed, so it is cut out of the decompressed stream and read like a TTF table.
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

/** Reads a WOFF2 UIntBase128 at `at`; returns [value, next offset]. */
function base128(bytes, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = bytes[at + i];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return [value, at + i + 1];
  }
  throw new Error('bad UIntBase128');
}

/** The raw `cmap` table of a WOFF2 file (W3C WOFF2 §5: table directory, then one Brotli-compressed stream). */
export function woff2Cmap(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = view.getUint16(12);
  const compressedLength = view.getUint32(20);
  if (view.getUint32(4) === 0x74746366) throw new Error('WOFF2 font collections are not supported');
  let at = 48;
  let offset = 0;
  let cmap = null;
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at++];
    const known = flags & 0x3f; // 0 = cmap, 10 = glyf, 11 = loca (WOFF2 known-tag table)
    let tag = '';
    if (known === 0x3f) { tag = buf.toString('latin1', at, at + 4); at += 4; }
    let length;
    [length, at] = base128(buf, at);
    const version = (flags >> 6) & 3;
    const glyfOrLoca = known === 10 || known === 11 || tag === 'glyf' || tag === 'loca';
    if (glyfOrLoca ? version === 0 : version !== 0) [length, at] = base128(buf, at); // transformLength
    if (known === 0 || tag === 'cmap') cmap = { offset, length };
    offset += length;
  }
  if (!cmap) throw new Error('no cmap table');
  const data = brotliDecompressSync(buf.subarray(at, at + compressedLength));
  return data.subarray(cmap.offset, cmap.offset + cmap.length);
}

/** Returns the set of code points with a non-zero glyph id in the font's best Unicode cmap subtable. */
export function fontCodePoints(path) {
  let buf = readFileSync(path);
  let cmap = -1;
  if (buf.toString('latin1', 0, 4) === 'wOF2') {
    buf = Buffer.from(woff2Cmap(buf));
    cmap = 0;
  } else {
    const head = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const numTables = head.getUint16(4);
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = head.getUint32(rec + 8);
    }
  }
  if (cmap < 0) throw new Error(path + ': no cmap table');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const subtables = [];
  const count = view.getUint16(cmap + 2);
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const offset = cmap + view.getUint32(rec + 4);
    const format = view.getUint16(offset);
    if ((platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) && (format === 4 || format === 12)) {
      subtables.push({ format, offset });
    }
  }
  const best = subtables.find((s) => s.format === 12) ?? subtables.find((s) => s.format === 4);
  if (!best) throw new Error(path + ': no Unicode cmap subtable (format 4/12)');
  const points = new Set();
  const { offset } = best;
  if (best.format === 12) {
    const groups = view.getUint32(offset + 12);
    for (let g = 0; g < groups; g++) {
      const at = offset + 16 + g * 12;
      const start = view.getUint32(at);
      const end = view.getUint32(at + 4);
      const glyph = view.getUint32(at + 8);
      for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) points.add(c);
    }
    return points;
  }
  const segX2 = view.getUint16(offset + 6);
  const ends = offset + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  for (let s = 0; s < segX2; s += 2) {
    const end = view.getUint16(ends + s);
    const start = view.getUint16(starts + s);
    const delta = view.getInt16(deltas + s);
    const rangeOffset = view.getUint16(ranges + s);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph;
      if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
      else {
        const at = ranges + s + rangeOffset + (c - start) * 2;
        glyph = view.getUint16(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) points.add(c);
    }
  }
  return points;
}

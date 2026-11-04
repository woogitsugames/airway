// [night-11ae] R2e, D-219: the press kit ZIP, built by build:site into site/dist/ and checked by test:site.
// Dependency-free: a minimal ZIP writer (store for images/video, deflate for text) and a reader for the test.
// Every entry has a fixed timestamp, so the same sources give a byte-identical ZIP.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { translations } from './i18n.js';
import { LAUNCH, PRESS_KIT, SITE_SHOTS } from './launch.js';

/** Store screenshot sources (relative to site/) in the ZIP: every scene × format × language. */
export function pressShots() {
  return SITE_SHOTS.languages.flatMap(language => SITE_SHOTS.scenes.flatMap(scene => PRESS_KIT.formats.map(format => ({
    language, scene, format,
    source: `../docs/store/shots/${language}/${scene}-${format}.png`,
    name: `screenshots/${language}/airway-${scene}-${format}.png`,
  }))));
}

/** The fact sheet, descriptions and contents as plain text, in one language, from the site catalog. */
export function readme(language, names) {
  const t = translations[language];
  const facts = ['developer', 'genre', 'platforms', 'release', 'price', 'languages'].map(key =>
    `${t[`press.fact.${key}.label`]}: ${t[`press.fact.${key}.value`]}`);
  facts.push(`${t['press.fact.contact.label']}: ${PRESS_KIT.contact}`, `${t['press.fact.website.label']}: ${LAUNCH.origin}/`);
  const title = t['press.kit.title'];
  return [title, '='.repeat(title.length), '', ...facts, '',
    t['press.short.title'].toUpperCase(), t['press.short'], '',
    t['press.long.title'].toUpperCase(), t['press.long'], '',
    t['press.usage.title'].toUpperCase(), t['press.usage.body'], t['press.logo.note'], '',
    t['press.kit.contents'], ...names.map(name => `- ${name}`), ''].join('\n');
}

/** Every ZIP entry: { name, source } for files (relative to site/) and { name, text } for the two README files. */
export function pressKitEntries() {
  const files = [
    ...pressShots(),
    ...PRESS_KIT.logos.map(logo => ({ source: logo.source, name: `logo/${logo.name}` })),
    ...(PRESS_KIT.video ? [{ source: PRESS_KIT.video, name: `video/${PRESS_KIT.video.split('/').pop()}` }] : []),
  ];
  const names = files.map(file => file.name);
  const texts = SITE_SHOTS.languages.map(language => ({ name: `README-${language}.txt`, text: readme(language, names) }));
  return [...texts, ...files].map(entry => ({ ...entry, name: `${PRESS_KIT.folder}/${entry.name}` }));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 2026-11-04 00:00 in MS-DOS format; a fixed stamp keeps the ZIP reproducible.
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 4, DOS_TIME = 0;

/** A ZIP archive of [{ name, data }] (UTF-8 names; deflate only where it pays: text and SVG). */
export function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflate = /\.(txt|svg)$/.test(name);
    const body = deflate ? deflateRawSync(data, { level: 9 }) : data;
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(deflate ? 8 : 0, 8); head.writeUInt16LE(DOS_TIME, 10); head.writeUInt16LE(DOS_DATE, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBytes.length, 26); head.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(head, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += head.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Reads a ZIP from zip() (or any plain store/deflate ZIP) and verifies every CRC: [{ name, data }]. */
export function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('no end of central directory');
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory');
    const method = buffer.readUInt16LE(at + 10), crc = buffer.readUInt32LE(at + 16);
    const size = buffer.readUInt32LE(at + 20), nameLength = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32), local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad local header ${name}`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const body = buffer.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch ${name}`);
    entries.push({ name, data });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** Builds the press kit ZIP from the sources under `root` (site/) into `outFile`; returns its entries and size. */
export function buildPressKit(root, outFile) {
  const entries = pressKitEntries();
  const missing = entries.filter(entry => entry.source && !existsSync(join(root, entry.source)));
  if (missing.length) throw new Error(`press kit: missing ${missing.map(entry => entry.source).join(', ')}`);
  const bytes = zip(entries.map(entry => ({
    name: entry.name,
    data: entry.source ? readFileSync(join(root, entry.source)) : Buffer.from(entry.text, 'utf8'),
  })));
  writeFileSync(outFile, bytes);
  return { entries, bytes: bytes.length };
}

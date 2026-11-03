#!/usr/bin/env node
// [night-12e] D-94 Google Play 16 KB page-size guard (R1m). Since 1.11.2025 every new app/update targeting Android 15+
// must ship 64-bit native libraries whose ELF LOAD segments are aligned to 16 KB; in an APK, uncompressed `.so`
// entries must also start on a 16 KB boundary (`zipalign -P 16`). Pure Node (no SDK): reads the ZIP central
// directory of an .aab or .apk, inflates each `lib/<abi>/*.so`, and checks both. A Capacitor web app normally has no
// native libraries at all; that is reported as "no native libs" and passes.
// Usage: node scripts/native-align.mjs <file.aab|file.apk>
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAGE_16K = 16 * 1024;
const PT_LOAD = 1;
const LIB_PATH = /(^|\/)lib\/([^/]+)\/[^/]+\.so$/;

/** Entries of a ZIP buffer (no ZIP64; app bundles are far below 4 GB). */
export function zipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a ZIP file (no end of central directory)');
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || at === 0xffffffff) throw new Error('ZIP64 archives are not supported');
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buffer.readUInt16LE(at + 10);
    const compressedSize = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const localOffset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('corrupt local header: ' + name);
    const dataOffset = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    entries.push({ name, method, compressedSize, dataOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function entryData(buffer, entry) {
  const raw = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error('unsupported compression method ' + entry.method + ': ' + entry.name);
}

/** ELF class (32/64) and the smallest LOAD segment alignment. */
export function elfLoadAlignment(elf) {
  if (elf.length < 52 || elf.readUInt32BE(0) !== 0x7f454c46) throw new Error('not an ELF file');
  const bits = elf[4] === 2 ? 64 : elf[4] === 1 ? 32 : 0;
  if (!bits) throw new Error('unknown ELF class');
  const little = elf[5] === 1;
  const u16 = (at) => (little ? elf.readUInt16LE(at) : elf.readUInt16BE(at));
  const u32 = (at) => (little ? elf.readUInt32LE(at) : elf.readUInt32BE(at));
  const u64 = (at) => Number(little ? elf.readBigUInt64LE(at) : elf.readBigUInt64BE(at));
  const phoff = bits === 64 ? u64(0x20) : u32(0x1c);
  const phentsize = u16(bits === 64 ? 0x36 : 0x2a);
  const phnum = u16(bits === 64 ? 0x38 : 0x2c);
  let minAlign = Infinity;
  for (let i = 0; i < phnum; i++) {
    const header = phoff + i * phentsize;
    if (u32(header) !== PT_LOAD) continue;
    minAlign = Math.min(minAlign, bits === 64 ? u64(header + 0x30) : u32(header + 0x1c));
  }
  if (minAlign === Infinity) throw new Error('ELF without LOAD segments');
  return { bits, minAlign };
}

/**
 * Check every native library in an .aab/.apk buffer. 64-bit libraries need LOAD alignment ≥ 16 KB (Play rule);
 * 32-bit ones are listed but not required. In an APK, stored (uncompressed) `.so` data must start on 16 KB.
 */
export function checkNativeAlignment(buffer, kind) {
  const libs = [];
  for (const entry of zipEntries(buffer)) {
    const match = entry.name.match(LIB_PATH);
    if (!match) continue;
    const problems = [];
    let elf = { bits: 0, minAlign: 0 };
    try { elf = elfLoadAlignment(entryData(buffer, entry)); } catch (error) { problems.push(error.message); }
    if (elf.bits === 64 && elf.minAlign < PAGE_16K) problems.push('LOAD segment aligned to ' + elf.minAlign + ' bytes');
    if (kind === 'apk' && entry.method === 0 && entry.dataOffset % PAGE_16K !== 0) {
      problems.push('stored at ZIP offset ' + entry.dataOffset + ' (not 16 KB aligned; run zipalign -P 16)');
    }
    libs.push({ name: entry.name, abi: match[2], bits: elf.bits, minAlign: elf.minAlign, problems });
  }
  const misaligned = libs.filter((lib) => lib.problems.length);
  return { ok: misaligned.length === 0, libs, misaligned };
}

/** One printable line per problem plus a summary line. */
export function describe(result, file) {
  const lines = result.misaligned.map((lib) => 'FAIL ' + lib.name + ': ' + lib.problems.join('; '));
  const summary = result.libs.length === 0 ? 'no native libs'
    : result.libs.length + ' native libs, ' + result.misaligned.length + ' not 16 KB aligned';
  lines.push('SUMMARY native-align ' + file + ': ' + summary);
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file || !/\.(aab|apk)$/.test(file)) {
    console.error('Usage: node scripts/native-align.mjs <file.aab|file.apk>');
    process.exit(2);
  }
  const result = checkNativeAlignment(readFileSync(file), file.endsWith('.apk') ? 'apk' : 'aab');
  for (const line of describe(result, file)) console.log(line);
  if (!result.ok) process.exitCode = 1;
}

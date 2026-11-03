#!/usr/bin/env node
// [night-12e] D-98 16 KB native-library guard (R1m) on synthetic bundles: no libs, aligned and misaligned 64-bit ELF
// LOAD segments, 32-bit libraries (listed, not required), stored APK entries on and off a 16 KB boundary,
// compressed entries, corrupt input. When the Android SDK's zipalign is installed, its `-c -P 16` verdict on the
// same APKs must agree. Deterministic (fixed bytes, no clock).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { checkNativeAlignment, describe, PAGE_16K } from './native-align.mjs';

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ':', error.message); }
}

/** Minimal ELF with `aligns.length` LOAD segments (plus one non-LOAD segment with a small alignment). */
function elf(bits, aligns) {
  const is64 = bits === 64;
  const ehsize = is64 ? 64 : 52;
  const phentsize = is64 ? 56 : 32;
  const headers = [...aligns.map((align) => [1, align]), [6, 4]]; // PT_PHDR-like entry: ignored
  const out = Buffer.alloc(ehsize + phentsize * headers.length + 64);
  out.writeUInt32BE(0x7f454c46, 0);
  out[4] = is64 ? 2 : 1; out[5] = 1; out[6] = 1;
  out.writeUInt16LE(3, 16); // ET_DYN
  out.writeUInt16LE(is64 ? 183 : 40, 18); // aarch64 / arm
  if (is64) { out.writeBigUInt64LE(BigInt(ehsize), 0x20); out.writeUInt16LE(phentsize, 0x36); out.writeUInt16LE(headers.length, 0x38); }
  else { out.writeUInt32LE(ehsize, 0x1c); out.writeUInt16LE(phentsize, 0x2a); out.writeUInt16LE(headers.length, 0x2c); }
  headers.forEach(([type, align], i) => {
    const at = ehsize + i * phentsize;
    out.writeUInt32LE(type, at);
    if (is64) out.writeBigUInt64LE(BigInt(align), at + 0x30); else out.writeUInt32LE(align, at + 0x1c);
  });
  return out;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const val of buf) { crc ^= val; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP writer. `align`: pad stored entries' data to that boundary via the local extra field (like zipalign). */
function zip(files, { align = 0 } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data, deflate = false } of files) {
    const body = deflate ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    let extra = Buffer.alloc(0);
    if (align && !deflate) {
      const start = offset + 30 + nameBytes.length;
      extra = Buffer.alloc((align - (start % align)) % align);
    }
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(extra.length, 28);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(deflate ? 8 : 0, 10);
    head.writeUInt32LE(crc32(data), 16); head.writeUInt32LE(body.length, 20); head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(nameBytes.length, 28); head.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([head, nameBytes]));
    parts.push(local, nameBytes, extra, body);
    offset += 30 + nameBytes.length + extra.length + body.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

const webOnly = [
  { name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('<manifest/>'), deflate: true },
  { name: 'base/assets/public/index.html', data: Buffer.from('<!doctype html>'), deflate: true },
];

check('a bundle without native libraries passes and says "no native libs"', () => {
  const result = checkNativeAlignment(zip(webOnly), 'aab');
  assert.equal(result.ok, true);
  assert.equal(result.libs.length, 0);
  assert.match(describe(result, 'app-release.aab').at(-1), /no native libs$/);
});
check('64-bit libraries with 16 KB LOAD alignment pass in an AAB', () => {
  const result = checkNativeAlignment(zip([...webOnly,
    { name: 'base/lib/arm64-v8a/libok.so', data: elf(64, [PAGE_16K, PAGE_16K]), deflate: true },
    { name: 'base/lib/x86_64/libok.so', data: elf(64, [65536]), deflate: true },
  ]), 'aab');
  assert.equal(result.ok, true, JSON.stringify(result.misaligned));
  assert.deepEqual(result.libs.map((lib) => [lib.abi, lib.bits, lib.minAlign]), [['arm64-v8a', 64, PAGE_16K], ['x86_64', 64, 65536]]);
});
check('a 64-bit library with one 4 KB LOAD segment fails', () => {
  const result = checkNativeAlignment(zip([...webOnly,
    { name: 'base/lib/arm64-v8a/libold.so', data: elf(64, [PAGE_16K, 4096]), deflate: true },
  ]), 'aab');
  assert.equal(result.ok, false);
  assert.equal(result.misaligned[0].name, 'base/lib/arm64-v8a/libold.so');
  assert.match(describe(result, 'x.aab')[0], /^FAIL base\/lib\/arm64-v8a\/libold\.so: LOAD segment aligned to 4096 bytes/);
});
check('32-bit libraries are listed but not required to be 16 KB aligned', () => {
  const result = checkNativeAlignment(zip([{ name: 'base/lib/armeabi-v7a/libold.so', data: elf(32, [4096]), deflate: true }]), 'aab');
  assert.equal(result.ok, true);
  assert.deepEqual(result.libs.map((lib) => [lib.bits, lib.minAlign]), [[32, 4096]]);
});
const goodLib = { name: 'lib/arm64-v8a/libok.so', data: elf(64, [PAGE_16K]) };
check('stored APK libraries must start on a 16 KB boundary; compressed ones only need the ELF rule', () => {
  assert.equal(checkNativeAlignment(zip([...webOnly, goodLib], { align: PAGE_16K }), 'apk').ok, true);
  const off = checkNativeAlignment(zip([...webOnly, goodLib]), 'apk');
  assert.equal(off.ok, false);
  assert.match(off.misaligned[0].problems[0], /not 16 KB aligned/);
  assert.equal(checkNativeAlignment(zip([...webOnly, goodLib], { align: 4096 }), 'apk').ok, false, '4 KB zipalign is not enough');
  assert.equal(checkNativeAlignment(zip([...webOnly, { ...goodLib, deflate: true }]), 'apk').ok, true);
  assert.equal(checkNativeAlignment(zip([...webOnly, goodLib]), 'aab').ok, true, 'AAB offsets are bundletool\'s job');
});
check('a .so that is not an ELF file and a non-ZIP input are reported, not ignored', () => {
  const result = checkNativeAlignment(zip([{ name: 'base/lib/arm64-v8a/libfake.so', data: Buffer.from('not elf at all, padded to fifty-two bytes .....') }]), 'aab');
  assert.equal(result.ok, false);
  assert.match(result.misaligned[0].problems[0], /not an ELF file/);
  assert.throws(() => checkNativeAlignment(Buffer.from('plain text, no zip'), 'aab'), /not a ZIP file/);
});

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const tools = sdk && existsSync(join(sdk, 'build-tools')) ? readdirSync(join(sdk, 'build-tools')).sort().reverse() : [];
const zipalign = tools.map((version) => join(sdk, 'build-tools', version, 'zipalign')).find((path) => existsSync(path));
if (zipalign) {
  check('zipalign -c -P 16 agrees on the stored-library APKs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aw-align-'));
    try {
      for (const [label, apk, expected] of [
        ['aligned', zip([...webOnly, goodLib], { align: PAGE_16K }), true],
        ['unaligned', zip([...webOnly, goodLib]), false],
      ]) {
        const file = join(dir, label + '.apk');
        writeFileSync(file, apk);
        const status = spawnSync(zipalign, ['-c', '-P', '16', '4', file]).status;
        assert.equal(status === 0, expected, label + ': zipalign exit ' + status);
        assert.equal(checkNativeAlignment(apk, 'apk').ok, expected, label);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
} else {
  console.log('SKIP zipalign cross-check (no Android SDK build-tools)');
}

console.log('SUMMARY test:native-align seed=0 cases=' + (passed + failed) + ' passed=' + passed + ' failed=' + failed);
if (failed) process.exitCode = 1;

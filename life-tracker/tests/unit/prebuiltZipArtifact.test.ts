import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { readVerifiedActionsZip } from '../../scripts/lib/prebuilt-zip-artifact.mjs';

const names = [
  'config.json', 'dist.tar.gz', 'dist.tar.gz.sha256',
  'evidence.json', 'inventory.json', 'routing-evidence.json',
];
const table = Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let j = 0; j < 8; j++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc32(b: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of b) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip({ entries = names, symlink = false } : {
  entries?: string[]; symlink?: boolean;
} = {}) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const name = Buffer.from(entries[i], 'utf8');
    const content = Buffer.from('safe sample ' + i);
    const compressed = deflateRawSync(content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(name.length, 26);
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(compressed.length, 8);
    descriptor.writeUInt32LE(content.length, 12);
    locals.push(local, name, compressed, descriptor);
    const row = Buffer.alloc(46);
    row.writeUInt32LE(0x02014b50);
    row.writeUInt16LE(0x0314, 4);
    row.writeUInt16LE(20, 6);
    row.writeUInt16LE(8, 8);
    row.writeUInt16LE(8, 10);
    row.writeUInt32LE(crc, 16);
    row.writeUInt32LE(compressed.length, 20);
    row.writeUInt32LE(content.length, 24);
    row.writeUInt16LE(name.length, 28);
    row.writeUInt32LE((symlink && i === 0 ? 0o120777 : 0o100644) * 65536, 38);
    row.writeUInt32LE(offset, 42);
    central.push(row, name);
    offset += 30 + name.length + compressed.length + 16;
  }
  const dir = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, eocd]);
}

describe('bounded trusted GitHub Actions artifact ZIP parser #592', () => {
  it('recovers the exact six canonical data files without writing or executing them', () => {
    const data = readVerifiedActionsZip(makeZip());
    expect(Object.keys(data)).toEqual(names);
    expect(data['inventory.json'].toString()).toBe('safe sample 4');
  });
  it('rejects unexpected paths, duplicates, unsupported entries and symlinks', () => {
    expect(() => readVerifiedActionsZip(makeZip({ entries: [
      '../config.js', ...names.slice(1),
    ] }))).toThrow(/unsafe/);
    expect(() => readVerifiedActionsZip(makeZip({ entries: [
      names[1], ...names.slice(1),
    ] }))).toThrow(/Duplicate/);
    expect(() => readVerifiedActionsZip(makeZip({ symlink: true }))).toThrow(/unsafe/);
    expect(() => readVerifiedActionsZip(makeZip({ entries: names.slice(1) }))).toThrow(/entry count/);
  });
  it('rejects corrupted CRC/data, hidden prefix, and tampered central offsets', () => {
    const original = makeZip();
    const corrupt = Buffer.from(original);
    corrupt[48] ^= 1;
    expect(() => readVerifiedActionsZip(corrupt)).toThrow();
    expect(() => readVerifiedActionsZip(Buffer.concat([Buffer.from('hidden'), original])))
      .toThrow();
    const forged = Buffer.from(original);
    const cd = forged.readUInt32LE(forged.length - 6);
    forged.writeUInt32LE(10, cd + 42);
    expect(() => readVerifiedActionsZip(forged)).toThrow();
  });
  it('rejects missing and oversized input immediately', () => {
    expect(() => readVerifiedActionsZip(Buffer.alloc(16))).toThrow();
    expect(() => readVerifiedActionsZip(Buffer.alloc(16 * 1024 * 1024 + 1))).toThrow();
  });
});
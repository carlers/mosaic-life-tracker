import { inflateRawSync } from 'node:zlib';

// GitHub Actions upload-artifact v4 ZIP, not a general-purpose ZIP extractor.
// Strict file allowlist; bounded central directory and decompression; no disk,
// link, traversal, encrypted, ZIP64 or noncanonical entries. This parser never
// writes to disk or executes candidate-controlled files.
const FILES = Object.freeze([
  'config.json', 'dist.tar.gz', 'dist.tar.gz.sha256',
  'evidence.json', 'inventory.json', 'routing-evidence.json',
]);
const MAX_ZIP = 16 * 1024 * 1024;
const MAX_TOTAL = 32 * 1024 * 1024;
const MAX_ENTRY = 9 * 1024 * 1024;
const MAX_JSON = 1024 * 1024;
const EOCD = 0x06054b50;
const CD = 0x02014b50;
const LOCAL = 0x04034b50;
const DESCRIPTOR = 0x08074b50;

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
function need(bytes, offset, count) {
  if (!Number.isSafeInteger(offset) || offset < 0 || count < 0 ||
      offset + count > bytes.length) throw new Error('Truncated or invalid Actions ZIP');
}
function u16(bytes, offset) { need(bytes, offset, 2); return bytes.readUInt16LE(offset); }
function u32(bytes, offset) { need(bytes, offset, 4); return bytes.readUInt32LE(offset); }
function filename(bytes, offset, length) {
  need(bytes, offset, length);
  const name = bytes.subarray(offset, offset + length).toString('utf8');
  if (Buffer.byteLength(name, 'utf8') !== length || !FILES.includes(name))
    throw new Error('Unexpected or unsafe CI artifact ZIP path');
  return name;
}

export function readVerifiedActionsZip(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ZIP)
    throw new Error('Missing or oversized Actions ZIP');
  let end = -1;
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let at = bytes.length - 22; at >= min; at--) {
    if (u32(bytes, at) === EOCD && at + 22 + u16(bytes, at + 20) === bytes.length) {
      end = at;
      break;
    }
  }
  if (end < 0 || u16(bytes, end + 4) !== 0 || u16(bytes, end + 6) !== 0 ||
      u16(bytes, end + 8) !== FILES.length ||
      u16(bytes, end + 10) !== FILES.length || u16(bytes, end + 20) !== 0)
    throw new Error('Unsupported ZIP layout or wrong artifact entry count');
  const directoryBytes = u32(bytes, end + 12);
  const directoryOffset = u32(bytes, end + 16);
  if (directoryOffset > end || directoryOffset + directoryBytes !== end)
    throw new Error('Invalid ZIP central directory boundaries');
  let cursor = directoryOffset;
  let total = 0;
  const content = new Map();
  const intervals = [];
  for (let i = 0; i < FILES.length; i++) {
    need(bytes, cursor, 46);
    if (u32(bytes, cursor) !== CD) throw new Error('Invalid ZIP central entry');
    const flag = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const crc = u32(bytes, cursor + 16);
    const compressedSize = u32(bytes, cursor + 20);
    const uncompressedSize = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const startDisk = u16(bytes, cursor + 34);
    const mode = u32(bytes, cursor + 38) >>> 16;
    const localOffset = u32(bytes, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || extraLength || commentLength || startDisk ||
        (flag & ~0x808) !== 0 || (flag & 0x8) === 0 || method !== 8 ||
        (mode & 0o170000) !== 0o100000 ||
        !compressedSize || compressedSize > MAX_ENTRY ||
        !uncompressedSize || uncompressedSize > MAX_ENTRY ||
        localOffset >= directoryOffset)
      throw new Error('Unsupported or unsafe ZIP entry metadata');
    const name = filename(bytes, cursor + 46, nameLength);
    if (content.has(name)) throw new Error('Duplicate CI artifact ZIP entry');
    need(bytes, localOffset, 30);
    if (u32(bytes, localOffset) !== LOCAL ||
        u16(bytes, localOffset + 6) !== flag ||
        u16(bytes, localOffset + 8) !== method ||
        u16(bytes, localOffset + 26) !== nameLength ||
        u16(bytes, localOffset + 28) !== 0 ||
        filename(bytes, localOffset + 30, nameLength) !== name)
      throw new Error('Inconsistent ZIP local entry');
    const dataStart = localOffset + 30 + nameLength;
    const dataEnd = dataStart + compressedSize;
    need(bytes, dataStart, compressedSize + 16);
    if (dataEnd + 16 > directoryOffset ||
        u32(bytes, dataEnd) !== DESCRIPTOR ||
        u32(bytes, dataEnd + 4) !== crc ||
        u32(bytes, dataEnd + 8) !== compressedSize ||
        u32(bytes, dataEnd + 12) !== uncompressedSize)
      throw new Error('Corrupt ZIP data descriptor');
    const endOffset = dataEnd + 16;
    intervals.push([localOffset, endOffset]);
    let inflated;
    try {
      inflated = inflateRawSync(bytes.subarray(dataStart, dataEnd), {
        maxOutputLength: Math.min(uncompressedSize, MAX_ENTRY),
      });
    } catch { throw new Error('Unsafe or invalid ZIP decompression'); }
    if (inflated.length !== uncompressedSize || crc32(inflated) !== crc)
      throw new Error('Corrupted ZIP entry bytes or CRC');
    total += inflated.length;
    if (total > MAX_TOTAL || (name.endsWith('.json') && inflated.length > MAX_JSON))
      throw new Error('Oversized ZIP artifact payload');
    content.set(name, inflated);
    cursor = next;
  }
  if (cursor !== end || content.size !== FILES.length ||
      FILES.some(file => !content.has(file)))
    throw new Error('Incomplete or trailing Actions ZIP data');
  intervals.sort((a, b) => a[0] - b[0]);
  let expectedStart = 0;
  for (const [start, stop] of intervals) {
    if (start !== expectedStart) throw new Error('Overlapping or hidden ZIP payload');
    expectedStart = stop;
  }
  if (expectedStart !== directoryOffset) throw new Error('ZIP contains hidden data');
  return Object.fromEntries(FILES.map(name => [name, content.get(name)]));
}
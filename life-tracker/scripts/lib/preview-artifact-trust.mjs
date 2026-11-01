import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { validateBuildEvidence } from './preview-evidence-schema.mjs';

const HEX = /^[a-f0-9]{64}$/;
const SAFE_NAME = /^[a-zA-Z0-9.][a-zA-Z0-9._/-]*$/;
const BLOCK = 512;
const MAX_TAR_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
// The optional on-device Whisper WASM runtime exceeds the ordinary file limit.
// Its exact hashed path and 28 MiB ceiling preserve all other archive guards.
const OPTIONAL_WHISPER_WASM = /^assets\/ort-wasm-simd-threaded\.asyncify-[a-zA-Z0-9_-]{8}\.wasm$/;
const MAX_OPTIONAL_WHISPER_WASM_BYTES = 28 * 1024 * 1024;
const sha256 = data => createHash('sha256').update(data).digest('hex');

function safeName(value) {
  if (typeof value !== 'string' || !SAFE_NAME.test(value) || value.startsWith('/') ||
      value.includes('\\') || value.split('/').some(p => p === '' || p === '..' ||
        (p.startsWith('.') && p !== '.vite' && p !== '.'))) {
    throw new Error('Unsafe tar artifact path');
  }
  const name = value.startsWith('./') ? value.slice(2) : value;
  if (!name || name === '.' || name.startsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Unsafe tar artifact path');
  }
  return name;
}

function stringField(block, offset, size) {
  const field = block.subarray(offset, offset + size);
  const terminator = field.indexOf(0);
  return field.subarray(0, terminator >= 0 ? terminator : size).toString('utf8');
}

function sizeField(block, maximum = MAX_FILE_BYTES) {
  const raw = stringField(block, 124, 12).trim();
  if (!/^[0-7]+$/.test(raw)) throw new Error('Malformed tar size');
  const parsed = parseInt(raw, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum)
    throw new Error('Oversized tar entry');
  return parsed;
}

function assertTarChecksum(block) {
  const field = stringField(block, 148, 8).trim();
  if (!/^[0-7]+$/.test(field)) throw new Error('Malformed tar header checksum');
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 32 : block[i];
  if (parseInt(field, 8) !== sum) throw new Error('Corrupt tar header checksum');
}

/** Decode only regular GNU/USTAR file entries; never run tar or unpack unverified bytes. */
export function inspectGzipTar(archive, maxLength = MAX_TAR_BYTES, includeData = false) {
  if (!Buffer.isBuffer(archive) || archive.length === 0 || archive.length > MAX_TAR_BYTES)
    throw new Error('Invalid or oversized compressed artifact');
  let tar;
  try { tar = gunzipSync(archive, { maxOutputLength: maxLength }); }
  catch { throw new Error('Cannot safely decompress bounded CI artifact'); }
  const found = new Map();
  const data = includeData ? new Map() : null;
  const seenDirs = new Set();
  let offset = 0;
  let ended = false;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every(byte => byte === 0)) {
      if (offset + 2 * BLOCK > tar.length ||
          !tar.subarray(offset).every(byte => byte === 0)) throw new Error('Malformed tar trailer');
      ended = true;
      break;
    }
    assertTarChecksum(header);
    const kind = header[156];
    const prefix = stringField(header, 345, 155);
    const base = stringField(header, 0, 100);
    const rawName = prefix ? `${prefix}/${base}` : base;
    if (!rawName || (kind !== 0 && kind !== 48 && kind !== 53))
      throw new Error('Archive contains link, extension or unsupported entry');
    const normalizedName = kind === 53 ? rawName.replace(/\/$/, '') : rawName;
    const name = kind === 53 && (normalizedName === '.' || normalizedName === './')
      ? '.' : safeName(normalizedName);
    const maxFileBytes = kind !== 53 && OPTIONAL_WHISPER_WASM.test(name)
      ? MAX_OPTIONAL_WHISPER_WASM_BYTES : MAX_FILE_BYTES;
    const size = sizeField(header, maxFileBytes);
    if (kind === 53) {
      // GNU tar writes a root directory and file parent directories.
      const directory = rawName.replace(/\/$/, '');
      if (directory !== '.' && directory !== './') {
        if (seenDirs.has(name) || found.has(name)) throw new Error('Duplicate tar directory');
        seenDirs.add(name);
      }
      if (size !== 0) throw new Error('Directory contains data');
    } else {
      if (seenDirs.has(name) || found.has(name)) throw new Error('Duplicate archive file');
      const start = offset + BLOCK;
      if (start + size > tar.length) throw new Error('Truncated tar entry');
      found.set(name, { name, bytes: size, sha256: sha256(tar.subarray(start, start + size)) });
      if (data) data.set(name, Buffer.from(tar.subarray(start, start + size)));
    }
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  if (!ended || !found.size) throw new Error('Missing tar end markers or files');
  const files = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return data ? { files, data } : files;
}

/** Return *evidence*, not deploy authorization. Caller must check full canonical CI separately. */
export function verifyArchivedBuild({ archive, archiveSha256, evidence, inventory, expected }) {
  if (!HEX.test(archiveSha256 ?? '') || sha256(archive) !== archiveSha256)
    throw new Error('CI artifact compressed archive digest mismatch');
  validateBuildEvidence(evidence, expected);
  if (!Array.isArray(inventory?.files) || inventory.files.length !== evidence.inventory.count)
    throw new Error('Incomplete expected build inventory');
  const received = inspectGzipTar(archive);
  if (received.length !== inventory.files.length ||
      JSON.stringify(received) !== JSON.stringify(inventory.files) ||
      sha256(Buffer.from(JSON.stringify(received))) !== evidence.inventory.digest ||
      sha256(Buffer.from(JSON.stringify(inventory.files))) !== inventory.digest) {
    throw new Error('Untrusted CI build archive differs from signed-by-CI inventory');
  }
  return { source: evidence.source, files: received.length, inventoryDigest: inventory.digest,
    archiveDigest: archiveSha256, deploymentAuthorized: false };
}
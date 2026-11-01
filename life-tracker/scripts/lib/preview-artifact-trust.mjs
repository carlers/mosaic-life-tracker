import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { validateBuildEvidence } from './preview-evidence-schema.mjs';

const HEX = /^[a-f0-9]{64}$/;
const SAFE_NAME = /^[a-zA-Z0-9.][a-zA-Z0-9._/-]*$/;
const BLOCK = 512;
const MAX_TAR_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
// A single optional, self-hosted Whisper ONNX Runtime WASM binary exceeds the
// normal per-file ceiling. The strict filename and 28 MiB cap preserve the
// existing 32 MiB total decompression bound and all inventory/hash checks.
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
  ret¶»§q«^
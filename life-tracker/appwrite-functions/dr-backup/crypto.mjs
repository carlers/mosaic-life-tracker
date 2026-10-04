import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const MAGIC = Buffer.from('MOSDR001', 'ascii');
const FLAG_GZIP = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function decodeMasterKey(value) {
  if (typeof value !== 'string') {
    throw new Error('DR encryption key must be base64');
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)
  ) {
    throw new Error('DR encryption key must be valid base64');
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('DR encryption key must decode to exactly 32 bytes');
  }
  return key;
}

function aadBytes(aad) {
  if (typeof aad !== 'string' || aad.length === 0) {
    throw new Error('DR encrypted objects require non-empty AAD');
  }
  return Buffer.from(`mosaic-dr/v1\n${aad}`, 'utf8');
}

export function encryptBuffer(
  input,
  { key, keyVersion, aad, compress = false }
) {
  const plain = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('DR AES-256-GCM key must be 32 bytes');
  }
  if (
    typeof keyVersion !== 'string' ||
    keyVersion.length === 0 ||
    Buffer.byteLength(keyVersion) > 65535
  ) {
    throw new Error('DR keyVersion is invalid');
  }

  const payload = compress ? gzipSync(plain) : plain;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadBytes(aad));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  const keyVersionBytes = Buffer.from(keyVersion, 'utf8');
  const versionLength = Buffer.alloc(2);
  versionLength.writeUInt16BE(keyVersionBytes.length);

  return Buffer.concat([
    MAGIC,
    Buffer.from([compress ? FLAG_GZIP : 0]),
    versionLength,
    keyVersionBytes,
    iv,
    tag,
    ciphertext,
  ]);
}

export function readEnvelopeKeyVersion(input) {
  const envelope = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const minimum = MAGIC.length + 1 + 2 + IV_LENGTH + TAG_LENGTH;
  if (
    envelope.length < minimum ||
    !envelope.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error('Invalid Mosaic DR envelope');
  }
  let offset = MAGIC.length + 1;
  const keyVersionLength = envelope.readUInt16BE(offset);
  offset += 2;
  if (offset + keyVersionLength + IV_LENGTH + TAG_LENGTH > envelope.length) {
    throw new Error('Truncated Mosaic DR envelope');
  }
  return envelope
    .subarray(offset, offset + keyVersionLength)
    .toString('utf8');
}

export function decryptBuffer(input, { key, aad }) {
  const envelope = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('DR AES-256-GCM key must be 32 bytes');
  }
  const minimum = MAGIC.length + 1 + 2 + IV_LENGTH + TAG_LENGTH;
  if (
    envelope.length < minimum ||
    !envelope.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error('Invalid Mosaic DR envelope');
  }

  let offset = MAGIC.length;
  const flags = envelope[offset++];
  const keyVersionLength = envelope.readUInt16BE(offset);
  offset += 2;
  if (offset + keyVersionLength + IV_LENGTH + TAG_LENGTH > envelope.length) {
    throw new Error('Truncated Mosaic DR envelope');
  }
  const keyVersion = envelope
    .subarray(offset, offset + keyVersionLength)
    .toString('utf8');
  offset += keyVersionLength;
  const iv = envelope.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const tag = envelope.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;
  const ciphertext = envelope.subarray(offset);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aadBytes(aad));
  decipher.setAuthTag(tag);
  const payload = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const compressed = (flags & FLAG_GZIP) !== 0;
  return {
    keyVersion,
    compressed,
    plain: compressed ? gunzipSync(payload) : payload,
  };
}

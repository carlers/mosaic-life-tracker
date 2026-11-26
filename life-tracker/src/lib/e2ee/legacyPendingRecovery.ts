/**
 * Local-only encrypted recovery capsule for pre-cutover pending operations.
 * No server, cloud Storage, worker, queue mutation or auto-replay code here.
 * An actual historical installed PWA cannot be patched by this module.
 */
import type { Bytes, Owner } from './coreCrypto';

const context = 'mosaic-e2ee/legacy-pending-recovery/v1';
const MAX_RECORDS = 500;
const MAX_PLAINTEXT_BYTES = 1_048_576;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export type RecoverableQueue = 'social' | 'message-action' | 'friendship';
export type PendingLegacyIntent = Readonly<{
  queue: RecoverableQueue;
  record: Readonly<Record<string, unknown>>;
}>;
export type LegacyPendingCapsule = Readonly<{
  version: 1;
  algorithm: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
}>;

function denied(): never {
  throw new Error('Pending encrypted recovery unavailable or invalid.');
}
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validateOwner(owner: Owner, root: Bytes): void {
  if (!owner?.projectId || !owner?.ownerId ||
      !(root instanceof Uint8Array) || root.byteLength !== 32) denied();
}
function validateItems(owner: Owner, items: unknown): asserts items is PendingLegacyIntent[] {
  if (!Array.isArray(items) || items.length > MAX_RECORDS) denied();
  const seen = new Set<string>();
  for (const item of items) {
    if (!isObject(item) ||
        !['social', 'message-action', 'friendship'].includes(item.queue as string) ||
        !isObject(item.record)) denied();
    const r = item.record;
    const command = item.queue === 'friendship' ? r.operation : r.action;
    if (typeof r.id !== 'string' || !r.id || typeof command !== 'string' || !command ||
        (r.userId !== owner.ownerId && r.ownerId !== owner.ownerId) ||
        (r.userId !== undefined && r.userId !== owner.ownerId) ||
        (r.ownerId !== undefined && r.ownerId !== owner.ownerId)) denied();
    const id = item.queue + '/' + r.id;
    if (seen.has(id)) denied();
    seen.add(id);
  }
}
function b64(input: Uint8Array): string {
  let data = '';
  for (let i = 0; i < input.length; i += 8192) {
    data += String.fromCharCode(...input.subarray(i, i + 8192));
  }
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(value: unknown, length?: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) ||
      value.length > MAX_PLAINTEXT_BYTES * 2) denied();
  try {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - value.length % 4) % 4));
    const result = Uint8Array.from(raw, c => c.charCodeAt(0));
    if (b64(result) !== value || (length !== undefined && result.length !== length)) denied();
    return result;
  } catch {
    return denied();
  }
}
function aad(owner: Owner): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify([context, owner.projectId, owner.ownerId]));
}
async function keyFor(root: Bytes, owner: Owner, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const imported = await crypto.subtle.importKey('raw', root, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'HKDF', hash: 'SHA-256', salt, info: aad(owner),
  }, imported, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Caller must hold a fully authenticated, unlocked owner root and explicitly
 * collect *all* unsent queues before exporting this encrypted local capsule.
 * Returning this string does not save the file or prove a historical PWA was frozen.
 */
export async function encryptPendingLegacyIntents(
  owner: Owner, root: Bytes, items: readonly PendingLegacyIntent[],
): Promise<string> {
  validateOwner(owner, root);
  validateItems(owner, items);
  let plaintext: Uint8Array<ArrayBuffer>;
  try {
    plaintext = encoder.encode(JSON.stringify({
      format: context, owner, savedAt: new Date().toISOString(), items,
    }));
  } catch {
    return denied();
  }
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) denied();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const key = await keyFor(root, owner, salt);
    const encrypted = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: aad(owner), tagLength: 128,
    }, key, plaintext);
    const capsule: LegacyPendingCapsule = {
      version: 1, algorithm: 'AES-256-GCM', salt: b64(salt),
      iv: b64(iv), ciphertext: b64(new Uint8Array(encrypted)),
    };
    return JSON.stringify(capsule);
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Only decrypts/validates and returns immutable owner-bound pending actions.
 * NO automatic import, queue mutation, remote write or plaintext fallback.
 */
export async function decryptPendingLegacyIntents(
  owner: Owner, root: Bytes, contents: string,
): Promise<readonly PendingLegacyIntent[]> {
  validateOwner(owner, root);
  if (typeof contents !== 'string' || contents.length > MAX_PLAINTEXT_BYTES * 2)
    denied();
  try {
    const envelope: unknown = JSON.parse(contents);
    if (!isObject(envelope) || envelope.version !== 1 ||
        envelope.algorithm !== 'AES-256-GCM' ||
        Object.keys(envelope).sort().join('|') !== 'algorithm|ciphertext|iv|salt|version')
      denied();
    const salt = fromB64(envelope.salt, 16), iv = fromB64(envelope.iv, 12);
    const ciphertext = fromB64(envelope.ciphertext);
    const key = await keyFor(root, owner, salt);
    const bytes = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv, additionalData: aad(owner), tagLength: 128,
    }, key, ciphertext);
    const plain = new Uint8Array(bytes);
    let decoded: unknown;
    try {
      if (plain.byteLength > MAX_PLAINTEXT_BYTES) denied();
      decoded = JSON.parse(decoder.decode(plain));
    } finally {
      plain.fill(0);
    }
    if (!isObject(decoded) || decoded.format !== context || !isObject(decoded.owner) ||
        decoded.owner.projectId !== owner.projectId || decoded.owner.ownerId !== owner.ownerId ||
        typeof decoded.savedAt !== 'string') denied();
    validateItems(owner, decoded.items);
    return decoded.items;
  } catch {
    return denied();
  }
}

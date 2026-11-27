import { isPrivatePayloadDomain, type PrivatePayloadDomain } from './domainRegistry';

/**
 * Stage-1 generic E2EE cryptographic foundation (#1662/#2083).
 * This module is NOT connected to normal synchronization or enabled for users.
 * Adapts the isolated synthetic Diary pilot's WebCrypto primitives. No security
 * assurance is claimed until cross-device/backend/independent review.
 */
export type Bytes = Uint8Array<ArrayBuffer>;
export type Owner = Readonly<{ projectId: string; ownerId: string }>;
export type RecordContext = Owner & Readonly<{
  rowId: string; keyId: string; revision: string;
}>;
export type DiaryText = Readonly<{ content: string; emoji: string }>;
export type RecordEnvelope = Readonly<{
  v: 1; alg: 'A256GCM'; kid: string; revision: string; iv: string; ct: string;
}>;
export type RootEnvelope = Readonly<{
  v: 1; alg: 'A256GCM'; kid: string; iv: string; ct: string;
}>;
const domain = 'mosaic-e2ee/private-payload/v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const idRe = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const randomRe = /^[a-z]_[a-f0-9]{32}$/;
const plainLimit = 131072;
function invalid(): never { throw new Error('Encrypted data is unavailable or invalid.'); }
function id(s: unknown, max: number): asserts s is string {
  if (typeof s !== 'string' || s.length === 0 || s.length > max || !idRe.test(s)) invalid();
}
function randomId(s: unknown, prefix: string): asserts s is string {
  if (typeof s !== 'string' || !randomRe.test(s) || !s.startsWith(prefix + '_')) invalid();
}
function owner(o: Owner): void {
  if (!o) invalid();
  id(o.projectId, 100); id(o.ownerId, 255);
}
function context(c: RecordContext): void {
  owner(c); id(c.rowId, 36); randomId(c.keyId, 'k'); randomId(c.revision, 'r');
}
function bytes32(v: Bytes): void {
  if (!(v instanceof Uint8Array) || v.byteLength !== 32) invalid();
}
function cloneSafe<T>(value:T):T{
  try{return structuredClone(value);}catch{return invalid();}
}

function randomBytes(n: number): Bytes {
  const result = new Uint8Array(n); crypto.getRandomValues(result); return result;
}
function randomHex(prefix: string): string {
  return prefix + '_' + [...randomBytes(16)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function fields(...args: string[]): Bytes {
  const parts = args.map(x => encoder.encode(x));
  const length = parts.reduce((n, a) => n + 4 + a.byteLength, 0);
  if (length > 8192) invalid();
  const b = new Uint8Array(length), view = new DataView(b.buffer);
  let i = 0;
  for (const p of parts) {
    view.setUint32(i, p.length, false); i += 4; b.set(p, i); i += p.length;
  }
  return b;
}
function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(v: unknown, expected?: number): Bytes {
  if (typeof v !== 'string' || v.length < 2 || v.length > 180000 ||
    v.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(v)) invalid();
  try {
    const raw = atob(v.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - v.length % 4) % 4));
    const result = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) result[i] = raw.charCodeAt(i);
    if ((expected !== undefined && result.length !== expected) || b64(result) !== v) invalid();
    return result;
  } catch { return invalid(); }
}
function exact(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
      Object.keys(v).length !== keys.length ||
      keys.some(k => !Object.prototype.hasOwnProperty.call(v, k))) invalid();
}
function recordEnvelope(v: unknown): asserts v is RecordEnvelope {
  exact(v, ['v', 'alg', 'kid', 'revision', 'iv', 'ct']);
  if (v.v !== 1 || v.alg !== 'A256GCM') invalid();
  randomId(v.kid, 'k'); randomId(v.revision, 'r');
  unb64(v.iv, 12);
  const ct = unb64(v.ct);
  if (ct.length < 16 || ct.length > plainLimit + 16) invalid();
}
function rootEnvelope(v: unknown): asserts v is RootEnvelope {
  exact(v, ['v', 'alg', 'kid', 'iv', 'ct']);
  if (v.v !== 1 || v.alg !== 'A256GCM') invalid();
  randomId(v.kid, 'k'); unb64(v.iv, 12); unb64(v.ct, 48);
}
function textPayload(p: unknown): asserts p is DiaryText {
  exact(p, ['content', 'emoji']);
  if (typeof p.content !== 'string' || typeof p.emoji !== 'string' ||
      p.emoji.length > 32 || encoder.encode(JSON.stringify(p)).byteLength > plainLimit) invalid();
}
async function derived(secret: Bytes, purpose: string, values: string[]): Promise<CryptoKey> {
  bytes32(secret);
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'HKDF', hash: 'SHA-256',
    salt: encoder.encode(domain + '/salt'),
    info: fields(domain, purpose, ...values),
  }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encrypt(key: CryptoKey, aad: Bytes, plaintext: Bytes): Promise<{iv: string; ct: string}> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({
    name: 'AES-GCM', iv, additionalData: aad, tagLength: 128,
  }, key, plaintext));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decrypt(key: CryptoKey, aad: Bytes, iv: string, ct: string): Promise<Bytes> {
  const nonce = unb64(iv, 12), sealed = unb64(ct);
  if (sealed.length < 16 || sealed.length > plainLimit + 16) invalid();
  try {
    return new Uint8Array(await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128,
    }, key, sealed));
  } catch { return invalid(); }
}
function dataAad(c: RecordContext): Bytes {
  return fields(domain, 'diary-data', c.projectId, c.ownerId,
    c.rowId, c.keyId, c.revision, '1', 'A256GCM');
}
function rootAad(o: Owner, kid: string, mode: string): Bytes {
  return fields(domain, mode, o.projectId, o.ownerId, kid, '1', 'A256GCM');
}
export function generateAccountRoot(): Bytes { return randomBytes(32); }
export function generateIndependentRecoverySecret(): Bytes { return randomBytes(32); }
export function formatIndependentRecoverySecret(secret: Bytes): string {
  bytes32(secret); return b64(secret);
}
export function parseIndependentRecoverySecret(text: string): Bytes {
  const secret = unb64(text.trim(), 32); bytes32(secret); return secret;
}

export function generateKeyId(): string { return randomHex('k'); }
export function generateRevision(): string { return randomHex('r'); }
export function generateOperationId(): string { return randomHex('o'); }
export function generateOpaqueRowId(): string { return randomHex('p'); }

/**
 * Stable, pseudorandom migration row ID keyed to the owner's root.
 * Two offline devices migrating the same legacy local ID MUST converge to
 * one opaque remote ID; random IDs would create duplicate owner documents.
 * The root never leaves the browser. This is only for private owner records,
 * not social recipients, public IDs, or shared chat messages.
 */
export async function deriveMigratedOwnerRowId(
  root: Bytes, scope: Owner, collection: PrivatePayloadDomain, localDocumentId: string,
): Promise<string> {
  owner(scope); bytes32(root);
  root=root.slice();scope={projectId:scope.projectId,ownerId:scope.ownerId};
  try{
  if (!['task','category','diary','bucket-list','bucket-task-link','settings-private',
    'activity','activity-task-link'].includes(collection)) invalid();
  if (typeof localDocumentId !== 'string' || localDocumentId.length === 0 ||
      encoder.encode(localDocumentId).length > 512) invalid();
  const base = await crypto.subtle.importKey('raw', root, 'HKDF', false, ['deriveBits']);
  const rawKey = new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(domain + '/owner-row-id-salt'),
    info: fields(domain, 'owner-row-id-key', scope.projectId, scope.ownerId, collection),
  }, base, 256));
  let signingKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey('raw', rawKey,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  } finally { rawKey.fill(0); }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', signingKey,
    fields(domain, 'owner-row-id', localDocumentId)));
  return 'p_' + [...mac.subarray(0, 16)]
    .map(n => n.toString(16).padStart(2, '0')).join('');
  }finally{root.fill(0);}
}

export async function encryptDiary(root: Bytes, c: RecordContext, p: DiaryText): Promise<RecordEnvelope> {
  bytes32(root);root=root.slice();
  try{
  c=cloneSafe(c);p=cloneSafe(p);
  context(c); textPayload(p);
  const k = await derived(root, 'record-key', [c.projectId, c.ownerId, c.rowId, c.keyId]);
  const v = await encrypt(k, dataAad(c), encoder.encode(JSON.stringify(p)));
  return { v: 1, alg: 'A256GCM', kid: c.keyId, revision: c.revision, ...v };
  }finally{root.fill(0);}
}
export async function decryptDiary(root: Bytes, c: RecordContext, value: unknown): Promise<DiaryText> {
  bytes32(root);root=root.slice();
  try{
  c=cloneSafe(c);value=cloneSafe(value);
  context(c); recordEnvelope(value);
  if (value.kid !== c.keyId || value.revision !== c.revision) invalid();
  const k = await derived(root, 'record-key', [c.projectId, c.ownerId, c.rowId, c.keyId]);
  const result = await decrypt(k, dataAad(c), value.iv, value.ct);
  try {
    if (result.byteLength > plainLimit) invalid();
    const p: unknown = JSON.parse(decoder.decode(result));
    textPayload(p);
    return p;
  } catch { return invalid(); }
  finally{result.fill(0);}
  }finally{root.fill(0);}
}
export async function wrapRootForRecovery(root: Bytes, secret: Bytes, o: Owner, kid: string): Promise<RootEnvelope> {
  owner(o);bytes32(root);bytes32(secret);
  const stableRoot=root.slice();
  try{
    const stableSecret=secret.slice();
    try{
      o={projectId:o.projectId,ownerId:o.ownerId};
      randomId(kid, 'k');
      const k = await derived(stableSecret, 'recovery-key', [o.projectId, o.ownerId, kid]);
      const v = await encrypt(k, rootAad(o, kid, 'recovery-root'), stableRoot);
      return { v: 1, alg: 'A256GCM', kid, ...v };
    }finally{stableSecret.fill(0);}
  }finally{stableRoot.fill(0);}
}
export async function unwrapRootFromRecovery(secret: Bytes, o: Owner, value: unknown): Promise<Bytes> {
  owner(o);bytes32(secret);
  secret=secret.slice();
  try{
    o={projectId:o.projectId,ownerId:o.ownerId};
    value=cloneSafe(value);rootEnvelope(value);
    const k = await derived(secret, 'recovery-key', [o.projectId, o.ownerId, value.kid]);
    const root = await decrypt(k, rootAad(o, value.kid, 'recovery-root'), value.iv, value.ct);
    bytes32(root); return root;
  }finally{secret.fill(0);}
}
export async function generateDeviceWrappingKey(): Promise<CryptoKey> {
  // Nonextractable is not hardware protection. Same-origin JS can still use the key.
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function deviceKeyValid(key: CryptoKey): void {
  if (!key || key.extractable || key.algorithm.name !== 'AES-GCM' ||
      !key.usages.includes('encrypt') || !key.usages.includes('decrypt')) invalid();
}
export async function wrapRootForDevice(root: Bytes, key: CryptoKey, o: Owner, kid: string): Promise<RootEnvelope> {
  owner(o);bytes32(root);
  root=root.slice();
  try{
    o={projectId:o.projectId,ownerId:o.ownerId};
    randomId(kid, 'k'); deviceKeyValid(key);
    const v = await encrypt(key, rootAad(o, kid, 'device-root'), root);
    return { v: 1, alg: 'A256GCM', kid, ...v };
  }finally{root.fill(0);}
}
export async function unwrapRootFromDevice(key: CryptoKey, o: Owner, value: unknown): Promise<Bytes> {
  owner(o);o={projectId:o.projectId,ownerId:o.ownerId};
  value=cloneSafe(value);rootEnvelope(value);deviceKeyValid(key);
  const root = await decrypt(key, rootAad(o, value.kid, 'device-root'), value.iv, value.ct);
  bytes32(root); return root;
}

/** Authenticated context for one encrypted remote record. Never use timestamps as AAD. */
export type PrivateRecordContext = RecordContext & Readonly<{
  payloadDomain: PrivatePayloadDomain;
  /** Only explicitly classified routing fields, authenticated as AEAD AAD. */
  publicRouting?: Readonly<Record<string, unknown>>;
}>;

/** Canonical bounded nonsecret routing fields; unreviewed nested data is denied. */
function canonicalRouting(value: unknown): string {
  if (value === undefined) return '{}';
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (keys.length > 32) invalid();
  const output: Record<string, string | number | boolean | null> = Object.create(null);
  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) invalid();
    const item = input[key];
    if (typeof item === 'string' && encoder.encode(item).length <= 512) output[key] = item;
    else if (typeof item === 'boolean' || item === null) output[key] = item;
    else if (typeof item === 'number' && Number.isSafeInteger(item)) output[key] = item;
    else invalid();
  }
  const result = JSON.stringify(output);
  if (encoder.encode(result).byteLength > 4096) invalid();
  return result;
}

/** Encrypt JSON business data. Domain-specific validation remains the caller's job. */
export async function encryptPrivateRecord(
  root: Bytes, c: PrivateRecordContext, payload: Record<string, unknown>,
): Promise<RecordEnvelope> {
  bytes32(root);root=root.slice();
  try{
  c=cloneSafe(c);
  context(c);
  if (!isPrivatePayloadDomain(c.payloadDomain) || !payload ||
      typeof payload !== 'object' || Array.isArray(payload)) invalid();
  let text: string;
  try { text = JSON.stringify(payload); } catch { return invalid(); }
  if (typeof text !== 'string' || encoder.encode(text).byteLength > plainLimit) invalid();
  // Derive a distinct key for each client revision; nonces are random and
  // backend CAS must additionally prevent revision/epoch reuse and rollback.
  const k = await derived(root, 'private-record-key', [
    c.projectId, c.ownerId, c.payloadDomain, c.rowId, c.keyId, c.revision,
  ]);
  const aad = fields(domain, 'record-data', c.projectId, c.ownerId, c.payloadDomain,
    c.rowId, c.keyId, c.revision, '1', 'A256GCM', canonicalRouting(c.publicRouting));
  const v = await encrypt(k, aad, encoder.encode(text));
  return { v: 1, alg: 'A256GCM', kid: c.keyId, revision: c.revision, ...v };
  }finally{root.fill(0);}
}

/** A missing/invalid ciphertext is an error, never a plaintext fallback. */
export async function decryptPrivateRecord(
  root: Bytes, c: PrivateRecordContext, sealed: unknown,
): Promise<Record<string, unknown>> {
  bytes32(root);root=root.slice();
  try{
  c=cloneSafe(c);sealed=cloneSafe(sealed);
  context(c);
  if (!isPrivatePayloadDomain(c.payloadDomain)) invalid();
  recordEnvelope(sealed);
  if (sealed.kid !== c.keyId || sealed.revision !== c.revision) invalid();
  const k = await derived(root, 'private-record-key', [
    c.projectId, c.ownerId, c.payloadDomain, c.rowId, c.keyId, c.revision,
  ]);
  const aad = fields(domain, 'record-data', c.projectId, c.ownerId, c.payloadDomain,
    c.rowId, c.keyId, c.revision, '1', 'A256GCM', canonicalRouting(c.publicRouting));
  const bytes = await decrypt(k, aad, sealed.iv, sealed.ct);
  try {
    const parsed: unknown = JSON.parse(decoder.decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
    return parsed as Record<string, unknown>;
  } catch { return invalid(); }
  finally{bytes.fill(0);}
  }finally{root.fill(0);}
}

/**
 * Typo-detecting human-readable emergency key. The SHA-256 prefix is only an
 * accidental transcription checksum, not a proof of possession/authentication.
 * AEAD unwrap remains the authority. Never log this string.
 */
export async function formatEmergencyRecoveryKey(secret: Bytes): Promise<string> {
  bytes32(secret);
  // Both checksum and encoded key must read the same caller-owned bytes
  // even if a caller clears or changes its buffer while SHA-256 awaits.
  const stable=secret.slice();
  try{
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', stable));
    return 'mosaic1-' + b64(stable) + '-' + b64(digest.subarray(0, 4));
  }finally{stable.fill(0);}
}

export async function parseEmergencyRecoveryKey(text: string): Promise<Bytes> {
  if (typeof text !== 'string') invalid();
  const match = /^mosaic1-([A-Za-z0-9_-]{43})-([A-Za-z0-9_-]{6})$/.exec(text.trim());
  if (!match) invalid();
  const secret = unb64(match[1], 32);
  let accepted=false;
  try{
    const checksum = unb64(match[2], 4);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', secret));
    // This checksum is not secret or an authentication check. The full recovery
    // key is required for subsequent AES-GCM root unwrapping.
    if (checksum.some((n, i) => n !== digest[i])) invalid();
    accepted=true;
    return secret; // A successful parse transfers ownership to the caller.
  }finally{if(!accepted)secret.fill(0);}
}

/**
 * Isolated synthetic-only private Diary crypto (#1662).
 * NOT wired into legacy Diary or normal sync. A six-digit PIN must NEVER
 * unlock a locally testable root envelope.
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
const domain = 'mosaic-e2ee/private-diary/v1';
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
export function generateKeyId(): string { return randomHex('k'); }
export function generateRevision(): string { return randomHex('r'); }
export function generateOpaqueRowId(): string { return randomHex('p'); }
export async function encryptDiary(root: Bytes, c: RecordContext, p: DiaryText): Promise<RecordEnvelope> {
  context(c); textPayload(p);
  const k = await derived(root, 'record-key', [c.projectId, c.ownerId, c.rowId, c.keyId]);
  const v = await encrypt(k, dataAad(c), encoder.encode(JSON.stringify(p)));
  return { v: 1, alg: 'A256GCM', kid: c.keyId, revision: c.revision, ...v };
}
export async function decryptDiary(root: Bytes, c: RecordContext, value: unknown): Promise<DiaryText> {
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
}
export async function wrapRootForRecovery(root: Bytes, secret: Bytes, o: Owner, kid: string): Promise<RootEnvelope> {
  owner(o); bytes32(root); randomId(kid, 'k');
  const k = await derived(secret, 'recovery-key', [o.projectId, o.ownerId, kid]);
  const v = await encrypt(k, rootAad(o, kid, 'recovery-root'), root);
  return { v: 1, alg: 'A256GCM', kid, ...v };
}
export async function unwrapRootFromRecovery(secret: Bytes, o: Owner, value: unknown): Promise<Bytes> {
  owner(o); rootEnvelope(value);
  const k = await derived(secret, 'recovery-key', [o.projectId, o.ownerId, value.kid]);
  const root = await decrypt(k, rootAad(o, value.kid, 'recovery-root'), value.iv, value.ct);
  bytes32(root); return root;
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
  owner(o); bytes32(root); randomId(kid, 'k'); deviceKeyValid(key);
  const v = await encrypt(key, rootAad(o, kid, 'device-root'), root);
  return { v: 1, alg: 'A256GCM', kid, ...v };
}
export async function unwrapRootFromDevice(key: CryptoKey, o: Owner, value: unknown): Promise<Bytes> {
  owner(o); rootEnvelope(value); deviceKeyValid(key);
  const root = await decrypt(key, rootAad(o, value.kid, 'device-root'), value.iv, value.ct);
  bytes32(root); return root;
}

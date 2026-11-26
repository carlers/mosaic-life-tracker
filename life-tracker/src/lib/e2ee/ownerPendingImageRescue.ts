/**
 * Dormant source-only M2 offline rescue for owner-scoped staged image Blobs.
 * Never uploads, deletes, restores, clears old PWA storage, or changes RxDB.
 * The caller MUST authenticate the active owner/MFA and hold the unlocked root.
 * This DOES NOT reach a previously installed PWA from a different origin.
 */
import {
  type Bytes, type Owner, type RecordEnvelope,
  generateOpaqueRowId, generateRevision,
  encryptPrivateRecord, decryptPrivateRecord,
} from './coreCrypto';
import {
  sealPrivateMedia, openPrivateMedia,
  type EncryptedMedia,
} from './privateMediaCodec';

const DATABASE = 'mosaic_pending_images';
const STORE = 'images';
const ID = /^localimg_[a-f0-9]{26}$/;
const KID = /^k_[a-f0-9]{32}$/;
const MAX_ITEMS = 500;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_VISITED = 10_000;

type Entry = Readonly<{ id: string; ownerUserId: string; blob: Blob; createdAt: string }>;
export interface PendingImageSource {
  readAll(): Promise<readonly unknown[]>;
}
export interface OwnerReadyGate {
  assertReady(owner: Owner): Promise<void>;
}
export type EncryptedPendingImage = Readonly<{
  rowId: string; revision: string; keyId: string;
  sealedMetadata: RecordEnvelope;
  sealedMedia: EncryptedMedia;
}>;

function invalid(): never {
  throw new Error('Encrypted pending-image recovery is unavailable or incomplete.');
}
function validateContext(owner: Owner, root: Bytes, keyId: string): void {
  if (!owner?.projectId || !owner?.ownerId ||
      !(root instanceof Uint8Array) || root.byteLength !== 32 ||
      !KID.test(keyId)) invalid();
}
function selected(owner: Owner, all: readonly unknown[]): Entry[] {
  if (!Array.isArray(all) || all.length > MAX_VISITED) invalid();
  const found: Entry[] = [];
  const ids = new Set<string>();
  let total = 0;
  for (const value of all) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    const row = value as Record<string, unknown>;
    if (typeof row.ownerUserId !== 'string' || !row.ownerUserId) invalid();
    if (row.ownerUserId !== owner.ownerId) continue;
    if (typeof row.id !== 'string' || !ID.test(row.id) ||
        ids.has(row.id) || !(row.blob instanceof Blob) ||
        !Number.isSafeInteger(row.blob.size) || row.blob.size < 1 ||
        typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)))
      invalid();
    ids.add(row.id);
    total += row.blob.size;
    if (found.length >= MAX_ITEMS || total > MAX_BYTES) invalid();
    found.push({ id: row.id, ownerUserId: row.ownerUserId,
      blob: row.blob, createdAt: row.createdAt });
  }
  return found.sort((a,b) => a.id.localeCompare(b.id));
}
async function fingerprint(items: readonly Entry[]): Promise<string> {
  const parts: string[] = [];
  for (const row of items) {
    const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', await row.blob.arrayBuffer()));
    const hex = Array.from(sha, byte => byte.toString(16).padStart(2, '0')).join('');
    parts.push(JSON.stringify([row.id, row.ownerUserId, row.createdAt,
      row.blob.size, row.blob.type, hex]));
  }
  return parts.join('\n');
}

/**
 * Existing v1 pendingImages DB opened read-only. If absent, abort the
 * upgrade transaction instead of creating an empty database and misreporting
 * an empty snapshot as verified.
 */
export const indexedDbPendingImageSource: PendingImageSource = {
  async readAll(): Promise<readonly unknown[]> {
    if (typeof indexedDB === 'undefined') invalid();
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const req = indexedDB.open(DATABASE);
      req.onupgradeneeded = () => {
        try { req.transaction?.abort(); } catch { /* reject through request */ }
        reject(new Error('Pending image database not initialized.'));
      };
      req.onerror = () => reject(req.error ?? new Error('Pending image database denied.'));
      req.onsuccess = () => resolve(req.result);
      req.onblocked = () => reject(new Error('Pending image database blocked.'));
    });
    try {
      if (!db.objectStoreNames.contains(STORE)) invalid();
      return await new Promise<unknown[]>((resolve,reject) => {
        const rows: unknown[] = [];
        let finished = false;
        const fail = (error: unknown) => {
          if (finished) return;
          finished = true;
          reject(error);
        };
        let tx: IDBTransaction;
        try { tx = db.transaction(STORE, 'readonly'); }
        catch (error) { fail(error); return; }
        tx.onerror = () => fail(tx.error ?? new Error('Pending image read failed.'));
        tx.onabort = () => fail(tx.error ?? new Error('Pending image read aborted.'));
        tx.oncomplete = () => {
          if (!finished) { finished = true; resolve(rows); }
        };
        const req = tx.objectStore(STORE).openCursor();
        req.onerror = () => fail(req.error ?? new Error('Pending image cursor failed.'));
        req.onsuccess = () => {
          try {
            const cursor = req.result;
            if (!cursor) return;
            if (rows.length >= MAX_VISITED) invalid();
            rows.push(cursor.value);
            cursor.continue();
          } catch(error) {
            fail(error);
            try { tx.abort(); } catch { /* readonly abort best effort */ }
          }
        };
      });
    } finally { db.close(); }
  },
};

/** Root-encrypt every owner staged image including orphaned localimg_ blobs. */
export async function sealOwnerPendingImages(
  owner: Owner, root: Bytes, keyId: string, gate: OwnerReadyGate,
  source: PendingImageSource = indexedDbPendingImageSource,
): Promise<readonly EncryptedPendingImage[]> {
  validateContext(owner, root, keyId);
  await gate.assertReady(owner);
  const rows = selected(owner, await source.readAll());
  const before = await fingerprint(rows);
  const encrypted: EncryptedPendingImage[] = [];
  for (const row of rows) {
    await gate.assertReady(owner);
    const media = await sealPrivateMedia(root,owner,keyId,row.blob);
    const rowId = generateOpaqueRowId(), revision = generateRevision();
    const sealedMetadata = await encryptPrivateRecord(root, {
      ...owner, payloadDomain:'attachment-manifest', rowId, keyId, revision,
      publicRouting:{},
    }, {
      localId: row.id, createdAt: row.createdAt,
      mediaId: media.manifest.mediaId, ownerUserId: owner.ownerId,
    });
    encrypted.push({ rowId, revision, keyId, sealedMetadata, sealedMedia: media });
  }
  const after = await fingerprint(selected(owner,await source.readAll()));
  await gate.assertReady(owner);
  if (after !== before) invalid();
  // Local self-verification; a future separately saved-file check is still required.
  for (const item of encrypted) await decryptOwnerPendingImage(owner,root,item);
  return encrypted;
}

/** Authenticated local readback only; never uploads or restores a Blob. */
export async function decryptOwnerPendingImage(
  owner: Owner, root: Bytes, item: EncryptedPendingImage,
): Promise<Readonly<{ localId:string; createdAt:string; blob:Blob }>> {
  if (!item || typeof item !== 'object') invalid();
  validateContext(owner,root,item.keyId);
  const details = await decryptPrivateRecord(root, {
    ...owner, payloadDomain:'attachment-manifest',
    rowId:item.rowId,keyId:item.keyId,revision:item.revision,publicRouting:{},
  },item.sealedMetadata);
  if (typeof details.localId !== 'string' || !ID.test(details.localId) ||
      details.ownerUserId !== owner.ownerId ||
      typeof details.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(details.createdAt)) ||
      details.mediaId !== item.sealedMedia?.manifest?.mediaId ||
      item.sealedMedia.manifest.keyId !== item.keyId) invalid();
  const blob = await openPrivateMedia(root,owner,item.sealedMedia.manifest,
    item.sealedMedia.ciphertext);
  return {localId:details.localId,createdAt:details.createdAt,blob};
}

/**
 * Isolated E2EE M1 local remembered-device vault (#2083).
 * Not connected to normal login/sync. No plaintext root or recovery secret
 * is written to IndexedDB; only a nonextractable CryptoKey and AEAD wrapper.
 *
 * IMPORTANT: nonextractable is not hardware isolation. Same-origin code
 * can USE the key, and erasure of IndexedDB cannot erase copied plaintext.
 */
import {
  type Bytes, type Owner, type RootEnvelope,
  generateDeviceWrappingKey, wrapRootForDevice, unwrapRootFromDevice,
} from './coreCrypto';
import type { CryptoSession, RememberedRootStore } from './accountRootLifecycle';

const DATABASE = 'mosaic-e2ee-account-keyring-v1';
const STORE = 'remembered-roots';
type Stored = Readonly<Owner & {
  v: 1; key: CryptoKey; keyId: string; generation: number;
  envelope: RootEnvelope;
}>;

function storageUnavailable(): never {
  throw new Error('Encrypted device storage is unavailable. Recovery key is required.');
}
function id(owner: Owner): string {
  if (!owner?.projectId || !owner?.ownerId) storageUnavailable();
  return JSON.stringify([owner.projectId, owner.ownerId]);
}
function valid(row: Stored, owner: Owner): void {
  if (!row || row.v !== 1 || row.projectId !== owner.projectId ||
      row.ownerId !== owner.ownerId || !Number.isSafeInteger(row.generation) ||
      row.generation < 1 || !/^k_[a-f0-9]{32}$/.test(row.keyId) ||
      row.envelope?.kid !== row.keyId) storageUnavailable();
}
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Encrypted device storage unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(new Error('Encrypted device storage unavailable.'));
    request.onblocked = () => reject(new Error('Encrypted device storage blocked by another tab.'));
  });
}
async function read(owner: Owner): Promise<Stored | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const req = transaction.objectStore(STORE).get(id(owner));
    let row: Stored | null = null;
    req.onsuccess = () => { row = req.result as Stored | null; };
    transaction.oncomplete = () => { db.close(); resolve(row); };
    transaction.onabort = transaction.onerror = () => {
      db.close(); reject(new Error('Encrypted device read failed.'));
    };
  });
}
export const indexedDbRememberedRoots: RememberedRootStore = {
  async remember(owner: Owner, root: Bytes, keyId: string, generation: number): Promise<void> {
    if (!Number.isSafeInteger(generation) || generation < 1) storageUnavailable();
    const key = await generateDeviceWrappingKey();
    const envelope = await wrapRootForDevice(root, key, owner, keyId);
    const stored: Stored = { v: 1, key, envelope, keyId, generation,
      ownerId: owner.ownerId, projectId: owner.projectId };
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const existing = store.get(id(owner));
      existing.onsuccess = () => {
        try {
          if (existing.result) {
            valid(existing.result as Stored, owner);
            if ((existing.result as Stored).generation > generation) storageUnavailable();
          }
          store.put(stored, id(owner));
        } catch { transaction.abort(); }
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = transaction.onerror = () => {
        db.close(); reject(new Error('Encrypted device write rejected or failed.'));
      };
    });
  },
  async unlock(owner: Owner): Promise<CryptoSession | null> {
    const stored = await read(owner);
    if (!stored) return null;
    valid(stored, owner);
    const root = await unwrapRootFromDevice(stored.key, owner, stored.envelope);
    return { root, keyId: stored.keyId, generation: stored.generation };
  },
};

/** Explicitly forget this owner on this browser; never clear other accounts. */
export async function forgetRememberedAccountRoot(owner: Owner): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id(owner));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => {
      db.close(); reject(new Error('Encrypted device removal failed.'));
    };
  });
}

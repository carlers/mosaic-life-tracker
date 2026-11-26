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
  if (!owner || typeof owner.projectId !== 'string' || !owner.projectId ||
      typeof owner.ownerId !== 'string' || !owner.ownerId) storageUnavailable();
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
  // Pin the storage key before the async database open: a mutable owner
  // object must never silently redirect a read to a different account.
  const storageKey = id(owner);
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const req = transaction.objectStore(STORE).get(storageKey);
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
    if (!(root instanceof Uint8Array) || root.byteLength !== 32 ||
        !owner || typeof owner.projectId !== 'string' || !owner.projectId ||
        typeof owner.ownerId !== 'string' || !owner.ownerId ||
        typeof keyId !== 'string' || !/^k_[a-f0-9]{32}$/.test(keyId) ||
        !Number.isSafeInteger(generation) || generation < 1 ||
        generation > 2147483647) storageUnavailable();
    // Pin arguments before the first awaited IndexedDB or WebCrypto call:
    // callers cannot mutate a Uint8Array mid-operation to change the root.
    const scope: Owner = { projectId: owner.projectId, ownerId: owner.ownerId };
    const secret = root.slice();
    try {
      const previous = await read(scope);
      if (previous) {
        valid(previous, scope);
        if (previous.keyId !== keyId || previous.generation > generation)
          storageUnavailable();
        const oldRoot = await unwrapRootFromDevice(previous.key, scope, previous.envelope);
        let difference = 0;
        for (let i = 0; i < 32; i++) difference |= oldRoot[i] ^ secret[i];
        oldRoot.fill(0);
        // Same owner + generation with a changed root or key ID must never
        // silently overwrite offline data encrypted by the first root.
        if (difference !== 0) storageUnavailable();
        if (previous.generation === generation) return; // Idempotent; original wrapper retained.
      }
      const key = await generateDeviceWrappingKey();
      const envelope = await wrapRootForDevice(secret, key, scope, keyId);
      const stored: Stored = { v: 1, key, envelope, keyId, generation,
        ownerId: scope.ownerId, projectId: scope.projectId };
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE, 'readwrite');
          const store = transaction.objectStore(STORE);
          const existing = store.get(id(scope));
          existing.onsuccess = () => {
            try {
              const current = existing.result as Stored | undefined;
              if (!previous) {
                if (current !== undefined) storageUnavailable();
                store.add(stored, id(scope)); // Two first writers cannot both win.
              } else {
                if (!current) storageUnavailable();
                valid(current, scope);
                // A second tab may have replaced this envelope while WebCrypto
                // was awaiting. An exact CAS-like local snapshot check prevents
                // a stale retry from overwriting the newly committed wrapper.
                if (current.generation !== previous.generation ||
                    current.keyId !== previous.keyId ||
                    JSON.stringify(current.envelope) !==
                      JSON.stringify(previous.envelope)) storageUnavailable();
                store.put(stored, id(scope));
              }
            } catch { try { transaction.abort(); } catch { /* fail closed */ } }
          };
          transaction.oncomplete = () => resolve();
          transaction.onabort = transaction.onerror = () => {
            reject(new Error('Encrypted device write rejected or failed.'));
          };
        });
      } finally { db.close(); }
      const verified = await read(scope);
      if (!verified) storageUnavailable();
      valid(verified, scope);
      if (verified.generation !== generation || verified.keyId !== keyId)
        storageUnavailable();
      const opened = await unwrapRootFromDevice(verified.key, scope, verified.envelope);
      let difference = 0;
      for (let i = 0; i < 32; i++) difference |= opened[i] ^ secret[i];
      opened.fill(0);
      if (difference !== 0) storageUnavailable();
    } finally {
      secret.fill(0);
    }
  },
  async unlock(owner: Owner): Promise<CryptoSession | null> {
    id(owner);
    const scope: Owner = { projectId: owner.projectId, ownerId: owner.ownerId };
    const stored = await read(scope);
    if (!stored) return null;
    valid(stored, scope);
    const root = await unwrapRootFromDevice(stored.key, scope, stored.envelope);
    return { root, keyId: stored.keyId, generation: stored.generation };
  },
};

/** Explicitly forget this owner on this browser; never clear other accounts. */
export async function forgetRememberedAccountRoot(owner: Owner): Promise<void> {
  // A user may switch accounts while IndexedDB.open awaits. Never delete a
  // different owner's vault row because the caller mutated its owner object.
  const storageKey = id(owner);
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(storageKey);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => {
      db.close(); reject(new Error('Encrypted device removal failed.'));
    };
  });
}

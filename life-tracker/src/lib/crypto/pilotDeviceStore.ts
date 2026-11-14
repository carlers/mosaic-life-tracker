/**
 * Local-only IndexedDB for the synthetic E2EE Diary pilot (#1662).
 * Local key material is bound to the current authenticated account, but is
 * still accessible to same-origin scripts. No local plaintext is persisted.
 */
import {
  type Bytes, type Owner, type RecordEnvelope, type RootEnvelope,
  generateDeviceWrappingKey, wrapRootForDevice, unwrapRootFromDevice,
} from './pilotCrypto';

const DATABASE = 'mosaic-e2ee-private-diary-pilot-v1';
const DEVICE = 'devices';
const QUEUE = 'pending';

export type PendingCiphertext = Readonly<{
  opId: string;
  rowId: string;
  expectedRevision: string | null;
  deleted: boolean;
  envelope: RecordEnvelope;
}>;

function ownerKey(owner: Owner): string {
  return owner.projectId + '/' + owner.ownerId;
}

async function database(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) throw new Error('Encrypted local storage unavailable.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEVICE)) db.createObjectStore(DEVICE);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Encrypted local storage unavailable.'));
    request.onblocked = () => reject(new Error('Encrypted local storage blocked by another tab.'));
  });
}

async function storageRequest<T>(store: string, mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let value: T;
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    request.onsuccess = () => { value = request.result; };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => { db.close(); resolve(value); };
    transaction.onerror = () => { db.close(); reject(new Error('Encrypted local storage failed.')); };
    transaction.onabort = () => { db.close(); reject(new Error('Encrypted local storage transaction failed.')); };
  });
}

export async function rememberPilotDevice(root: Bytes, owner: Owner, kid: string): Promise<void> {
  const key = await generateDeviceWrappingKey();
  const wrapped = await wrapRootForDevice(root, key, owner, kid);
  await storageRequest(DEVICE, 'readwrite',
    store => store.put({ ownerId: owner.ownerId, projectId: owner.projectId, key, wrapped },
      ownerKey(owner)));
}

export async function unlockRememberedPilotDevice(owner: Owner):
  Promise<{ root: Bytes; kid: string } | null> {
  const stored = await storageRequest<{
    ownerId: string; projectId: string; key: CryptoKey; wrapped: RootEnvelope;
  } | undefined>(DEVICE, 'readonly', store => store.get(ownerKey(owner)));
  if (!stored) return null;
  if (stored.ownerId !== owner.ownerId || stored.projectId !== owner.projectId) {
    throw new Error('Encrypted device belongs to a different account.');
  }
  const root = await unwrapRootFromDevice(stored.key, owner, stored.wrapped);
  return { root, kid: stored.wrapped.kid };
}

export async function savePendingPilotCiphertext(owner: Owner, value: PendingCiphertext): Promise<void> {
  const op = value;
  if (!/^o_[a-f0-9]{32}$/.test(op.opId) || !/^p_[a-f0-9]{32}$/.test(op.rowId) ||
      !op.envelope || typeof op.envelope.ct !== 'string') {
    throw new Error('Invalid encrypted pending write.');
  }
  await storageRequest(QUEUE, 'readwrite', store => store.put({
    ownerId: owner.ownerId, projectId: owner.projectId,
    opId: op.opId, rowId: op.rowId, expectedRevision: op.expectedRevision,
    deleted: op.deleted, envelope: op.envelope,
  }, ownerKey(owner) + '/' + op.opId));
}

export async function listPendingPilotCiphertext(owner: Owner): Promise<PendingCiphertext[]> {
  const entries = await storageRequest<Array<PendingCiphertext & Owner>>(
    QUEUE, 'readonly', store => store.getAll());
  return entries.filter(value =>
    value.ownerId === owner.ownerId && value.projectId === owner.projectId
  ).map(({ opId, rowId, envelope, expectedRevision, deleted }) => ({
    opId, rowId, envelope, expectedRevision, deleted,
  }));
}

export async function clearPendingPilotCiphertext(owner: Owner, opId: string): Promise<void> {
  if (!/^o_[a-f0-9]{32}$/.test(opId)) throw new Error('Invalid pending operation.');
  await storageRequest(QUEUE, 'readwrite',
    store => store.delete(ownerKey(owner) + '/' + opId));
}

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

/** The pending outbox accepts only ciphertext, immutable op ID and owner scope. */
export function assertPendingPilotCiphertext(owner: Owner, op: PendingCiphertext): void {
  const envelope = op?.envelope;
  if (!owner || !owner.ownerId || !owner.projectId ||
      !op || Object.keys(op).length !== 5 ||
      !/^o_[a-f0-9]{32}$/.test(op.opId) ||
      !/^p_[a-f0-9]{32}$/.test(op.rowId) ||
      (op.expectedRevision !== null && !/^r_[a-f0-9]{32}$/.test(op.expectedRevision)) ||
      typeof op.deleted !== 'boolean' ||
      !envelope || Object.keys(envelope).length !== 6 ||
      envelope.v !== 1 || envelope.alg !== 'A256GCM' ||
      !/^k_[a-f0-9]{32}$/.test(envelope.kid) ||
      !/^r_[a-f0-9]{32}$/.test(envelope.revision) ||
      typeof envelope.iv !== 'string' ||
      !/^[A-Za-z0-9_-]{16}$/.test(envelope.iv) ||
      typeof envelope.ct !== 'string' || envelope.ct.length < 22 ||
      envelope.ct.length > 180000 || !/^[A-Za-z0-9_-]+$/.test(envelope.ct)) {
    throw new Error('Invalid encrypted pending write.');
  }
}

export async function savePendingPilotCiphertext(owner: Owner, value: PendingCiphertext): Promise<void> {
  assertPendingPilotCiphertext(owner, value);
  // add (not put) makes an existing unacknowledged operation ID immutable.
  // A collision must fail closed, never replace the original AES-GCM bytes.
  await storageRequest(QUEUE, 'readwrite', store => store.add({
    ownerId: owner.ownerId, projectId: owner.projectId,
    opId: value.opId, rowId: value.rowId, expectedRevision: value.expectedRevision,
    deleted: value.deleted, envelope: value.envelope,
  }, ownerKey(owner) + '/' + value.opId));
}

export async function listPendingPilotCiphertext(owner: Owner): Promise<PendingCiphertext[]> {
  const entries = await storageRequest<Array<PendingCiphertext & Owner>>(
    QUEUE, 'readonly', store => store.getAll());
  return entries.filter(value =>
    value.ownerId === owner.ownerId && value.projectId === owner.projectId
  ).map(({ opId, rowId, envelope, expectedRevision, deleted }) => {
    const intent = { opId, rowId, envelope, expectedRevision, deleted };
    assertPendingPilotCiphertext(owner, intent);
    return intent;
  });
}

export async function clearPendingPilotCiphertext(owner: Owner, opId: string): Promise<void> {
  if (!/^o_[a-f0-9]{32}$/.test(opId)) throw new Error('Invalid pending operation.');
  await storageRequest(QUEUE, 'readwrite',
    store => store.delete(ownerKey(owner) + '/' + opId));
}

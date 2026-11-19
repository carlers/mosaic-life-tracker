/**
 * M2 source-only encrypted owner outbox. No plaintext private document is
 * stored in this database. This is NOT connected to normal RxDB replication.
 *
 * The pending intent's original ciphertext, nonce and operation ID are
 * immutable: retries must never re-encrypt an acknowledged-but-lost response.
 * A successful server response alone is insufficient to remove an intent;
 * removal occurs only AFTER client AEAD-authenticated remote readback.
 */
import type { Owner } from './coreCrypto';
import { ownerPrivacyFields } from './fieldManifest';
import { DOMAIN_FOR_COLLECTION } from './ownerRecordCodec';
import {
  type EncryptedOwnerMutation, type OwnerOnlyCollection,
  type EncryptedOwnerRpc, OWNER_ONLY_COLLECTIONS,
  commitEncryptedOwnerMutation,
} from './ownerCiphertextTransport';
import type { CryptoSession, FullyAuthenticatedSessionGate } from './accountRootLifecycle';

const DB_NAME = 'mosaic-e2ee-owner-ciphertext-outbox-v1';
const STORE = 'pending-owner-ciphertext';
const MAX_OWNER_PENDING = 500;
const ownerOnly = OWNER_ONLY_COLLECTIONS as readonly string[];
const hex = (prefix: string, value: unknown) =>
  typeof value === 'string' && new RegExp('^' + prefix + '_[a-f0-9]{32}$').test(value);
type Stored = Readonly<{
  projectId: string; ownerId: string; opId: string; queuedAt: string;
  mutation: EncryptedOwnerMutation;
}>;

function bad(): never { throw new Error('Encrypted owner outbox rejected unsafe intent.'); }
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function hasExactly(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length &&
    keys.every(k => Object.prototype.hasOwnProperty.call(value, k));
}
function b64(value: unknown, max: number) {
  return typeof value === 'string' && value.length >= 2 &&
    value.length <= max && /^[A-Za-z0-9_-]+$/.test(value) &&
    value.length % 4 !== 1;
}
function check(owner: Owner, mutation: EncryptedOwnerMutation) {
  if (!owner || !owner.ownerId || !owner.projectId || !isObject(mutation) ||
      !hasExactly(mutation, ['record','opId','expectedRevision']) ||
      !hex('o',mutation.opId) ||
      (mutation.expectedRevision !== null && !hex('r',mutation.expectedRevision))) bad();
  const record = mutation.record;
  if (!isObject(record) ||
      !hasExactly(record, ['projectId','ownerId','rowId','collection','domain','routing','published','envelope']) ||
      record.projectId !== owner.projectId || record.ownerId !== owner.ownerId ||
      !hex('p',record.rowId) || !ownerOnly.includes(record.collection) ||
      record.domain !== DOMAIN_FOR_COLLECTION[record.collection as OwnerOnlyCollection] ||
      !isObject(record.routing) || !isObject(record.published) ||
      Object.keys(record.published).length !== 0 ||
      record.routing.userId !== owner.ownerId ||
      typeof record.routing.isDeleted !== 'boolean') bad();
  const classification = ownerPrivacyFields[record.collection as OwnerOnlyCollection] as
    Record<string,string>;
  for(const [field,value] of Object.entries(record.routing)) {
    if(classification[field] !== 'routing' ||
       !(value === null || typeof value === 'boolean' ||
         typeof value === 'string' && new TextEncoder().encode(value).length <= 512 ||
         typeof value === 'number' && Number.isSafeInteger(value))) bad();
  }
  const env = record.envelope;
  if (!isObject(env) || !hasExactly(env, ['v','alg','kid','revision','iv','ct']) ||
      env.v !== 1 || env.alg !== 'A256GCM' ||
      !hex('k',env.kid) || !hex('r',env.revision) ||
      !b64(env.iv,16) || !b64(env.ct,180000)) bad();
  // Stored intent contains no arbitrary application-specific fields. The
  // browser may still hold plaintext in ordinary RxDB; that remains a
  // separate migration/security gate.
}
/**
 * An offline owner must not stage two different next revisions of one remote
 * row before the first is server-verified. Otherwise random opId ordering
 * could replay stale writes and silently mask a user edit.
 */
export function rejectCompetingOwnerIntent(
  owner: Owner, incoming: EncryptedOwnerMutation,
  existing: readonly EncryptedOwnerMutation[],
): void {
  check(owner,incoming);
  for (const pending of existing) {
    check(owner,pending);
    if (pending.record.rowId === incoming.record.rowId) bad();
  }
}

function id(owner: Owner): string {
  if (!owner || !owner.projectId || !owner.ownerId) bad();
  return JSON.stringify([owner.projectId, owner.ownerId]);
}
function key(owner: Owner, opId: string): string {
  if (!hex('o',opId)) bad();
  return id(owner) + '|' + opId;
}
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Encrypted outbox requires local IndexedDB.'));
  }
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);
    };
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    request.onerror=()=>reject(new Error('Encrypted outbox open failed.'));
    request.onblocked=()=>reject(new Error('Encrypted outbox blocked by another tab.'));
  });
}
function range(owner: Owner): IDBKeyRange {
  if(typeof IDBKeyRange === 'undefined') bad();
  const prefix=id(owner)+'|';
  return IDBKeyRange.bound(prefix,prefix+'\uffff');
}
function validStored(owner: Owner, value: unknown): asserts value is Stored {
  if(!isObject(value)|| !hasExactly(value,['projectId','ownerId','opId','queuedAt','mutation'])||
     value.projectId!==owner.projectId || value.ownerId!==owner.ownerId ||
     !hex('o',value.opId) || typeof value.queuedAt!=='string' ||
     !isObject(value.mutation) || value.mutation.opId!==value.opId)bad();
  check(owner,value.mutation as EncryptedOwnerMutation);
}
/** Persist the entire pre-encrypted immutable intent in a committed IDB transaction. */
export async function queueEncryptedOwnerIntent(owner: Owner, mutation: EncryptedOwnerMutation):
  Promise<void> {
  check(owner,mutation);
  const db=await open();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    const store=tx.objectStore(STORE);
    const current=store.getAll(range(owner),MAX_OWNER_PENDING+1);
    current.onsuccess=()=>{
      try {
        const rows=current.result as unknown[];
        if(rows.length>=MAX_OWNER_PENDING) bad();
        for(const row of rows)validStored(owner,row);
        rejectCompetingOwnerIntent(owner,mutation,
          rows.map(row=>(row as Stored).mutation));
      }catch{tx.abort();return;}
      // ADD, not PUT: an accidental operation-ID collision cannot overwrite
      // earlier unacknowledged ciphertext.
      store.add({
        ownerId:owner.ownerId,projectId:owner.projectId,
        opId:mutation.opId,queuedAt:new Date().toISOString(),mutation,
      } satisfies Stored,key(owner,mutation.opId));
    };
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=tx.onabort=()=>{db.close();reject(new Error('Encrypted outbox write blocked or failed.'));};
  });
}
export async function listEncryptedOwnerIntents(owner: Owner): Promise<EncryptedOwnerMutation[]> {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const request=tx.objectStore(STORE).getAll(range(owner),MAX_OWNER_PENDING+1);
    let result:EncryptedOwnerMutation[]=[];
    request.onsuccess=()=>{
      const rows=request.result as unknown[];
      if(rows.length>MAX_OWNER_PENDING){tx.abort();return;}
      try {
        for(const row of rows)validStored(owner,row);
        result=rows.map(x=>(x as Stored).mutation);
      } catch { tx.abort(); }
    };
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(new Error('Encrypted outbox read rejected.'));};
  });
}
/** Only a previously authenticated ciphertext readback authorizes removal. */
async function removeVerified(owner: Owner, opId: string): Promise<void> {
  const db=await open();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key(owner,opId));
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=tx.onabort=()=>{db.close();reject(new Error('Encrypted outbox removal failed.'));};
  });
}
export async function replayEncryptedOwnerIntents(
  owner: Owner, session: CryptoSession, rpc: EncryptedOwnerRpc,
  gate: FullyAuthenticatedSessionGate,
): Promise<number> {
  const intents=await listEncryptedOwnerIntents(owner);
  let acknowledged=0;
  for(const intent of intents) {
    // On a conflict/offline/account switch/lock/auth failure, stop without
    // deleting the failed intent or any later pending operations.
    await commitEncryptedOwnerMutation(owner,session,intent,rpc,gate);
    await removeVerified(owner,intent.opId);
    acknowledged++;
  }
  return acknowledged;
}

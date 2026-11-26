/**
 * Isolated Scratch-only IndexedDB compare-and-set storage for authenticated
 * owner change-feed checkpoints. Metadata only: NEVER store private payloads
 * or account root bytes here. No legacy sync or backend mutations.
 */
import type { Owner } from './coreCrypto';
import type { OwnerOnlyCollection } from './ownerCiphertextTransport';
import type { OwnerFeedCheckpoint, OwnerFeedCheckpointStore } from './ownerChangeFeedCheckpoint';

const DB_NAME = 'mosaic-e2ee-owner-feed-cursors-v1';
const STORE_NAME = 'verified-owner-cursors';
const SCRATCH = '6b00671500279e901846';
function blocked(): never { throw new Error('Owner feed cursor storage unavailable.'); }
function scoped(owner: Owner, collection: OwnerOnlyCollection): string {
  if (owner?.projectId !== SCRATCH || typeof owner.ownerId !== 'string' ||
      !owner.ownerId || !['tasks','categories','diary','bucketList',
        'bucketTaskLinks','settings'].includes(collection)) blocked();
  return JSON.stringify([owner.projectId,owner.ownerId,collection]);
}
function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 50 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}
function valid(row: unknown, owner: Owner, collection: OwnerOnlyCollection): OwnerFeedCheckpoint {
  if (!row || typeof row !== 'object' || Array.isArray(row)) blocked();
  const r = row as Record<string,unknown>;
  if (Object.keys(r).length !== 7 || r.schema !== 1 ||
      r.projectId !== owner.projectId || r.ownerId !== owner.ownerId ||
      r.collection !== collection || typeof r.keyId !== 'string' ||
      !/^k_[a-f0-9]{32}$/.test(r.keyId) ||
      !Number.isSafeInteger(r.generation as number) || (r.generation as number) < 1 ||
      !r.after || typeof r.after !== 'object' || Array.isArray(r.after)) blocked();
  const after = r.after as Record<string,unknown>;
  if (Object.keys(after).length !== 2 || !validTimestamp(after.updatedAt) ||
      typeof after.rowId !== 'string' || !/^p_[a-f0-9]{32}$/.test(after.rowId)) blocked();
  return r as unknown as OwnerFeedCheckpoint;
}
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Owner feed cursor IndexedDB unavailable.'));
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    request.onerror=()=>reject(new Error('Owner feed cursor IndexedDB unavailable.'));
    request.onblocked=()=>reject(new Error('Owner feed cursor IndexedDB is blocked.'));
  });
}
function same(a: unknown,b: unknown): boolean {
  return JSON.stringify(a)===JSON.stringify(b);
}
function after(a: OwnerFeedCheckpoint, b: OwnerFeedCheckpoint): boolean {
  const x=Date.parse(a.after.updatedAt), y=Date.parse(b.after.updatedAt);
  return y>x || (y===x && b.after.rowId>a.after.rowId);
}
export const indexedDbOwnerFeedCheckpoints: OwnerFeedCheckpointStore = {
  async read(owner,collection) {
    const key=scoped(owner,collection);
    const db=await open();
    return new Promise<OwnerFeedCheckpoint | null>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const get=tx.objectStore(STORE_NAME).get(key);
      let row:unknown;
      get.onsuccess=()=>{row=get.result;};
      tx.oncomplete=()=>{
        db.close();
        try { resolve(row===undefined?null:valid(row,owner,collection)); }
        catch { reject(new Error('Owner feed cursor storage unavailable.')); }
      };
      tx.onerror=tx.onabort=()=>{
        db.close();reject(new Error('Owner feed cursor read failed.'));
      };
    });
  },
  async compareAndSet(owner,collection,expected,next) {
    const key=scoped(owner,collection);
    if (expected!==null) valid(expected,owner,collection);
    valid(next,owner,collection);
    if (expected && (expected.keyId!==next.keyId ||
        expected.generation!==next.generation || !after(expected,next))) blocked();
    const db=await open();
    return new Promise<boolean>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      const store=tx.objectStore(STORE_NAME);
      let matched=false;
      const get=store.get(key);
      get.onsuccess=()=>{
        try {
          const present=get.result===undefined?null:valid(get.result,owner,collection);
          if (!same(present,expected)) return;
          matched=true;
          store.put(next,key);
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete=()=>{db.close();resolve(matched);};
      tx.onabort=tx.onerror=()=>{
        db.close();reject(new Error('Owner feed cursor compare-and-set failed.'));
      };
    });
  },
};

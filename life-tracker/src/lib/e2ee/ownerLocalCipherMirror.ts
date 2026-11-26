/**
 * Scratch-only ciphertext owner mirror. Call solely with pages returned by
 * the authenticated AEAD-verified owner change feed; never raw Appwrite rows.
 * Not connected to normal RxDB, legacy sync, or production account data.
 */
import type { Owner } from './coreCrypto';
import type { CryptoSession } from './accountRootLifecycle';
import type { OwnerOnlyCollection, VerifiedOwnerChange } from './ownerCiphertextTransport';
import type { OwnerFeedPageApplier } from './ownerChangeFeedCheckpoint';
import {
  sealVerifiedOwnerPage,openVerifiedLocalOwnerChange,
  type StagedLocalOwnerRecord,
} from './localOwnerPageCodec';

const DATABASE='mosaic-e2ee-owner-local-cipher-mirror-v1';
const STORE='ciphertext-rows';
const SCRATCH='6b00671500279e901846';
const opaque=/^p_[a-f0-9]{32}$/;
function unavailable():never {
  throw new Error('Local encrypted owner mirror unavailable.');
}
function index(owner:Owner,collection:OwnerOnlyCollection,rowId:string):string {
  if(owner?.projectId!==SCRATCH || !owner.ownerId ||
    !['tasks','categories','diary','bucketList','bucketTaskLinks','settings'].includes(collection) ||
    !opaque.test(rowId))unavailable();
  return JSON.stringify([owner.projectId,owner.ownerId,collection,rowId]);
}
function validated(old:unknown,owner:Owner,collection:OwnerOnlyCollection,
  incoming:StagedLocalOwnerRecord):StagedLocalOwnerRecord {
  if(!old || typeof old!=='object' || Array.isArray(old))unavailable();
  const row=old as Record<string,unknown>;
  if(Object.keys(row).length!==11 || row.version!==1 ||
    row.projectId!==owner.projectId || row.ownerId!==owner.ownerId ||
    row.collection!==collection || row.rowId!==incoming.rowId ||
    row.keyId!==incoming.keyId || row.generation!==incoming.generation ||
    typeof row.sourceRevision!=='string' || !/^r_[a-f0-9]{32}$/.test(row.sourceRevision) ||
    typeof row.serverUpdatedAt!=='string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.serverUpdatedAt) ||
    !Number.isFinite(Date.parse(row.serverUpdatedAt)) ||
    typeof row.localRevision!=='string' || !/^r_[a-f0-9]{32}$/.test(row.localRevision) ||
    !row.envelope || typeof row.envelope!=='object' || Array.isArray(row.envelope))unavailable();
  return row as unknown as StagedLocalOwnerRecord;
}
function open():Promise<IDBDatabase> {
  if(typeof indexedDB==='undefined')
    return Promise.reject(new Error('Local encrypted owner IndexedDB unavailable.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE,1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);
    };
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    req.onerror=()=>reject(new Error('Local encrypted owner IndexedDB unavailable.'));
    req.onblocked=()=>reject(new Error('Local encrypted owner IndexedDB blocked.'));
  });
}
async function readRaw(
  owner:Owner,collection:OwnerOnlyCollection,rowId:string,
):Promise<unknown> {
  const id=index(owner,collection,rowId);
  const db=await open();
  return new Promise<unknown>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const get=tx.objectStore(STORE).get(id);
    let result:unknown;
    get.onsuccess=()=>{result=get.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=tx.onerror=()=>{
      db.close();reject(new Error('Local encrypted owner mirror read failed.'));
    };
  });
}
function canonical(doc:Record<string,unknown>):string {
  return JSON.stringify(Object.keys(doc).sort().map(k=>[k,doc[k]]));
}

/**
 * The batch is sealed BEFORE opening the IDB transaction. It either commits
 * the entire ciphertext page or none. Source revision/timestamp never regresses;
 * the exact same revision can be applied again after a lost checkpoint.
 */
export async function applyVerifiedPageToLocalCipherMirror(
  owner:Owner,session:CryptoSession,collection:OwnerOnlyCollection,
  page:Parameters<OwnerFeedPageApplier['apply']>[0],
):Promise<void> {
  const staged=await sealVerifiedOwnerPage(owner,session,collection,page);
  if(staged.length===0)return;
  // Reject corrupted older AEAD ciphertext before any replacement. Snapshot
  // bytes are rechecked inside the atomic write transaction to reject races.
  const expected=new Map<string,unknown>();
  for(const item of staged) {
    const id=index(owner,collection,item.rowId);
    const old=await readRaw(owner,collection,item.rowId);
    if(old!==undefined) {
      validated(old,owner,collection,item);
      await openVerifiedLocalOwnerChange(owner,session,collection,old);
    }
    expected.set(id,old);
  }
  const db=await open();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    const store=tx.objectStore(STORE);
    for(const item of staged){
      const id=index(owner,collection,item.rowId);
      const request=store.get(id);
      request.onsuccess=()=>{
        try {
          if(JSON.stringify(request.result)!==JSON.stringify(expected.get(id)))
            unavailable();
          if(request.result!==undefined){
            const previous=validated(request.result,owner,collection,item);
            const oldTime=Date.parse(previous.serverUpdatedAt);
            const newTime=Date.parse(item.serverUpdatedAt);
            if(oldTime>newTime || (oldTime===newTime &&
                previous.sourceRevision!==item.sourceRevision))unavailable();
            if(oldTime===newTime)return; // same source, no new ciphertext
          }
          store.put(item,id);
        } catch {
          try { tx.abort(); } catch { /* transaction already aborted */ }
        }
      };
    }
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onabort=tx.onerror=()=>{
      db.close();reject(new Error('Local encrypted owner mirror atomic apply failed.'));
    };
  });
  // A durable success is claimed only after authenticated storage readback of
  // each source document. Otherwise the caller MUST NOT checkpoint this page.
  for(const original of page) {
    const verified=await readLocalCipherOwnerRecord(owner,session,collection,original.rowId);
    if(!verified || verified.serverUpdatedAt!==original.serverUpdatedAt ||
       canonical(verified.document)!==canonical(original.document))unavailable();
  }
}
/** Authenticated readback requires the original project/owner/epoch/root. */
export async function readLocalCipherOwnerRecord(
  owner:Owner,session:CryptoSession,collection:OwnerOnlyCollection,rowId:string,
):Promise<VerifiedOwnerChange | null> {
  const raw=await readRaw(owner,collection,rowId);
  if(raw===undefined)return null;
  return openVerifiedLocalOwnerChange(owner,session,collection,raw);
}
export function makeLocalCipherMirrorPageApplier(session:CryptoSession):OwnerFeedPageApplier {
  return {apply:(page,owner,collection)=>
    applyVerifiedPageToLocalCipherMirror(owner,session,collection,page)};
}

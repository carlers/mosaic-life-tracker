/**
 * Dormant Scratch-only owner migration intent storage. No normal sync import,
 * no network, no delete, no mark-sent/ack: never discard unsent ciphertext.
 * The exact encrypted opId/revision/nonce MUST survive reload before PUT.
 */
import {type Bytes,type Owner,deriveMigratedOwnerRowId} from './coreCrypto';
import {
  type PreparedV1ToV2,
} from './ownerV1ToV2MigrationPlan';
import {
  openV2PrivateOwnerDocument,V2_OWNER_DOMAIN,
} from './ownerPrivateV2Contract';

const DB_NAME='mosaic-e2ee-owner-v2-migration-intents-v1';
const STORE='pending-migration-intents';
const PROJECT='6b00671500279e901846';
const MAX_PENDING=500;
type Unsigned=Readonly<{schema:2;projectId:string;ownerId:string;
  rowId:string;queuedAt:string;plan:PreparedV1ToV2}>;
type Stored=Unsigned&Readonly<{tag:string}>;
const encoder=new TextEncoder();
const INTENT_MAC_DOMAIN='mosaic-e2ee/owner-v2-pending-intent/v2';
function invalid():never{throw new Error('Encrypted owner migration intent unavailable or unsafe.');}
function scope(owner:Owner):string {
  if(!owner||owner.projectId!==PROJECT||typeof owner.ownerId!=='string'||
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(owner.ownerId))invalid();
  return JSON.stringify([owner.projectId,owner.ownerId])+'|';
}
function key(owner:Owner,rowId:string):string {
  if(!/^p_[a-f0-9]{32}$/.test(rowId))invalid();
  return scope(owner)+rowId;
}
function range(owner:Owner):IDBKeyRange{
  if(typeof IDBKeyRange==='undefined')invalid();
  const prefix=scope(owner);
  return IDBKeyRange.bound(prefix,prefix+'\uffff');
}
function open(allowCreate:boolean):Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(new Error('Local IndexedDB required.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      if(!allowCreate){
        try{req.transaction?.abort();}catch{/* fail closed */}
        reject(new Error('No initialized encrypted migration intent store.'));
      } else {
        req.result.createObjectStore(STORE);
      }
    };
    req.onerror=()=>reject(new Error('Encrypted migration storage inaccessible.'));
    req.onblocked=()=>reject(new Error('Encrypted migration storage is blocked.'));
    req.onsuccess=()=>{
      if(!req.result.objectStoreNames.contains(STORE)){
        req.result.close();reject(new Error('Encrypted migration storage schema unavailable.'));
      }else{
        req.result.onversionchange=()=>req.result.close();
        resolve(req.result);
      }
    };
  });
}
function getStore<T>(db:IDBDatabase,mode:IDBTransactionMode,
   work:(store:IDBObjectStore,tx:IDBTransaction,done:(v:T)=>void)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{
    let resolved=false,value:T;
    let tx:IDBTransaction;
    try{tx=db.transaction(STORE,mode);}catch{reject(new Error('Encrypted migration transaction unavailable.'));return;}
    tx.onerror=()=>reject(new Error('Encrypted migration transaction failed.'));
    tx.onabort=()=>reject(new Error('Encrypted migration transaction aborted.'));
    tx.oncomplete=()=>{if(resolved)resolve(value);else reject(new Error('Incomplete migration transaction.'));};
    try{
      work(tx.objectStore(STORE),tx,(v)=>{value=v;resolved=true;});
    }catch{
      try{tx.abort();}catch{/* best effort */}
    }
  });
}
async function validated(root:Bytes,owner:Owner,plan:PreparedV1ToV2):Promise<void>{
  const keys=['projectId','ownerId','collection','rowId',
    'expectedRevision','expectedGeneration','opId','record'];
  if(!plan||typeof plan!=='object'||Array.isArray(plan)||
     !(Object.getPrototypeOf(plan)===Object.prototype||
       Object.getPrototypeOf(plan)===null)||
     Object.keys(plan).length!==keys.length||
     !keys.every(k=>Object.hasOwn(plan,k))||!plan.record||
     typeof plan.record!=='object'||Array.isArray(plan.record))invalid();
  if(scope(owner).length<1||!(root instanceof Uint8Array)||root.length!==32||
     plan.projectId!==owner.projectId||plan.ownerId!==owner.ownerId||
     plan.rowId!==plan.record.rowId||plan.collection!==plan.record.collection||
     plan.expectedRevision!==null||!Number.isSafeInteger(plan.expectedGeneration)||
     plan.expectedGeneration<1||plan.expectedGeneration>2147483647||
     !/^o_[a-f0-9]{32}$/.test(plan.opId))invalid();
  const context={...owner,
    payloadDomain:V2_OWNER_DOMAIN[plan.collection],
    rowId:plan.rowId,keyId:plan.record.envelope.kid,
    revision:plan.record.envelope.revision};
  const doc=await openV2PrivateOwnerDocument(root,owner,context,plan.collection,plan.record);
  if(typeof doc.id!=='string'||!doc.id)invalid();
  const stable=await deriveMigratedOwnerRowId(root,owner,context.payloadDomain,doc.id);
  if(stable!==plan.rowId)invalid();
}
// Independent root-derived HMAC for *local* outer metadata, not a remote
// receipt or proof that the generation is currently valid on Appwrite.
async function intentKey(root:Bytes,owner:Owner):Promise<CryptoKey>{
  const base=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',salt:encoder.encode(INTENT_MAC_DOMAIN+'/salt'),
    info:encoder.encode(JSON.stringify([INTENT_MAC_DOMAIN,owner.projectId,owner.ownerId])),
  },base,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
}
function intentBytes(row:Unsigned):Bytes{
  // Include the complete already-validated plan, including ciphertext,
  // operation ID and generation. Exact serialized bytes are intentional.
  const data=encoder.encode(JSON.stringify([INTENT_MAC_DOMAIN,row.schema,
    row.projectId,row.ownerId,row.rowId,row.queuedAt,row.plan]));
  if(data.length>262144)invalid();
  return data;
}
async function signed(root:Bytes,owner:Owner,row:Unsigned):Promise<Stored>{
  const data=intentBytes(row);
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await intentKey(root,owner),data));
  return {...row,tag:Array.from(signature,b=>b.toString(16).padStart(2,'0')).join('')};
}
async function authenticate(root:Bytes,owner:Owner,row:Stored):Promise<void>{
  const signature=Uint8Array.from(row.tag.match(/../g)!,b=>Number.parseInt(b,16));
  if(!await crypto.subtle.verify('HMAC',await intentKey(root,owner),signature,intentBytes(row)))invalid();
  await validated(root,owner,row.plan);
}
function checkedStored(owner:Owner,value:unknown):Stored {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid();
  const row=value as Stored;
  if(Object.keys(row).sort().join('|')!==
     ['schema','projectId','ownerId','rowId','queuedAt','plan','tag'].sort().join('|')||
     row.schema!==2||typeof row.tag!=='string'||!/^[a-f0-9]{64}$/.test(row.tag)||
     row.projectId!==owner.projectId||
     row.ownerId!==owner.ownerId||
     typeof row.queuedAt!=='string'||!Number.isFinite(Date.parse(row.queuedAt))||
     !/^p_[a-f0-9]{32}$/.test(row.rowId)||row.plan?.rowId!==row.rowId)invalid();
  return row;
}
/** Atomic per-owner/per-row first-write wins; identical retry reads same bytes. */
export async function stageV2OwnerMigrationIntent(
  root:Bytes,owner:Owner,plan:PreparedV1ToV2,
):Promise<'stored'|'unchanged'>{
  // Snapshot before the first await: validation and persistence must operate
  // on the same bytes even if the caller mutates a JS object during crypto.
  root=root.slice();
  owner={projectId:owner.projectId,ownerId:owner.ownerId};
  plan=structuredClone(plan);
  await validated(root,owner,plan);
  const record=await signed(root,owner,{schema:2,projectId:owner.projectId,
    ownerId:owner.ownerId,rowId:plan.rowId,queuedAt:new Date().toISOString(),plan});
  const db=await open(true);
  let state:'stored'|'unchanged'='stored';
  const k=key(owner,plan.rowId);
  try{
    await getStore<void>(db,'readwrite',(store,tx,done)=>{
      const req=store.get(k);
      req.onerror=()=>{try{tx.abort();}catch{}};
      req.onsuccess=()=>{
        try{
          if(req.result!==undefined){
            const prior=checkedStored(owner,req.result);
            if(JSON.stringify(prior.plan)!==JSON.stringify(plan))invalid();
            state='unchanged';done();return;
          }
          const count=store.count(range(owner));
          count.onerror=()=>{try{tx.abort();}catch{}};
          count.onsuccess=()=>{
            try{
              if(count.result>=MAX_PENDING)invalid();
              store.add(record,k);
              done();
            }catch{try{tx.abort();}catch{}}
          };
        }catch{try{tx.abort();}catch{}}
      };
    });
  }finally{db.close();}
  const persisted=await readV2OwnerMigrationIntent(root,owner,plan.rowId);
  if(!persisted||JSON.stringify(persisted)!==JSON.stringify(plan))invalid();
  return state;
}
/** Readback checks authenticated AEAD and deterministic ID, not just IndexedDB bytes. */
export async function readV2OwnerMigrationIntent(
  root:Bytes,owner:Owner,rowId:string,
):Promise<PreparedV1ToV2|null>{
  root=root.slice();
  owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const k=key(owner,rowId);
  const db=await open(false);
  let value:unknown;
  try{
    value=await getStore<unknown>(db,'readonly',(store,tx,done)=>{
      const req=store.get(k);
      req.onerror=()=>{try{tx.abort();}catch{}};
      req.onsuccess=()=>done(req.result);
    });
  }finally{db.close();}
  if(value===undefined)return null;
  const row=checkedStored(owner,value);
  if(row.rowId!==rowId)invalid();
  await authenticate(root,owner,row);
  return row.plan;
}
/**
 * An authenticated snapshot retains the exact local HMAC and queuedAt bytes.
 * The transaction compares those same bytes before inserting anything, so a
 * competing tab, altered record or newly staged row fails the entire batch.
 */
type AuthenticatedRow=Readonly<{storageKey:string;row:Stored}>;
async function readAuthenticatedRows(
  root:Bytes,owner:Owner,allowCreate:boolean,
):Promise<readonly AuthenticatedRow[]>{
  const db=await open(allowCreate);
  let values:{key:IDBValidKey;value:unknown}[];
  try{
    values=await getStore<{key:IDBValidKey;value:unknown}[]>(db,'readonly',(store,tx,done)=>{
      const result:{key:IDBValidKey;value:unknown}[]=[];
      const req=store.openCursor(range(owner));
      req.onerror=()=>{try{tx.abort();}catch{/* fail closed */}};
      req.onsuccess=()=>{
        try{
          const cursor=req.result;
          if(!cursor){done(result);return;}
          if(result.length>=MAX_PENDING)invalid();
          result.push({key:cursor.primaryKey,value:cursor.value});
          cursor.continue();
        }catch{try{tx.abort();}catch{/* fail closed */}}
      };
    });
  }finally{db.close();}
  const out:AuthenticatedRow[]=[];
  const seen=new Set<string>();
  for(const entry of values){
    const row=checkedStored(owner,entry.value);
    const storageKey=key(owner,row.rowId);
    if(entry.key!==storageKey||seen.has(row.rowId))invalid();
    seen.add(row.rowId);
    await authenticate(root,owner,row);
    out.push({storageKey,row});
  }
  return out;
}

export type AtomicOwnerIntentBatch=Readonly<{
  plans:readonly PreparedV1ToV2[];
  stored:number;
  reused:number;
}>;

/**
 * Commit an entire authenticated rescue batch in ONE IndexedDB readwrite
 * transaction, never one row at a time. The caller must have performed an
 * independently authenticated saved-file, full-source and prior-intent
 * semantic preflight; we independently validate every ciphertext and detect
 * local changes in the store across that preflight.
 *
 * This is a local transaction only, not a server-root CAS or global RxDB
 * snapshot; losing IndexedDB still requires the separate saved rescue file.
 */
export async function stageV2OwnerMigrationIntentsAtomic(
  root:Bytes,owner:Owner,proposals:readonly PreparedV1ToV2[],
  expectedExisting:readonly PreparedV1ToV2[],
):Promise<AtomicOwnerIntentBatch>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     !Array.isArray(proposals)||!Array.isArray(expectedExisting)||
     !proposals.length||proposals.length>MAX_PENDING||
     expectedExisting.length>proposals.length)invalid();
  // Freeze inputs synchronously before any crypto/storage await, including
  // nested envelopes, to prevent mid-flight caller mutation of the intent.
  root=root.slice();
  owner={projectId:owner.projectId,ownerId:owner.ownerId};
  proposals=structuredClone(proposals);
  expectedExisting=structuredClone(expectedExisting);
  const fresh=new Map<string,PreparedV1ToV2>();
  for(const proposal of proposals){
    if(fresh.has(proposal.rowId))invalid();
    await validated(root,owner,proposal);
    fresh.set(proposal.rowId,proposal);
  }
  const expected=new Map<string,PreparedV1ToV2>();
  for(const prior of expectedExisting){
    if(expected.has(prior.rowId)||!fresh.has(prior.rowId))invalid();
    await validated(root,owner,prior);
    expected.set(prior.rowId,prior);
  }
  const authenticated=await readAuthenticatedRows(root,owner,true);
  if(authenticated.length!==expected.size)invalid();
  const before=new Map<string,Stored>();
  for(const item of authenticated){
    const expectedPlan=expected.get(item.row.rowId);
    if(!expectedPlan||
       JSON.stringify(item.row.plan)!==JSON.stringify(expectedPlan))invalid();
    before.set(item.storageKey,item.row);
  }
  const additional:Stored[]=[];
  for(const plan of proposals){
    if(expected.has(plan.rowId))continue;
    additional.push(await signed(root,owner,{
      schema:2,projectId:owner.projectId,ownerId:owner.ownerId,
      rowId:plan.rowId,queuedAt:new Date().toISOString(),plan,
    }));
  }
  if(authenticated.length+additional.length!==proposals.length||
     proposals.length>MAX_PENDING)invalid();
  const db=await open(true);
  try{
    await getStore<void>(db,'readwrite',(store,tx,done)=>{
      const req=store.openCursor(range(owner));
      let seen=0;
      req.onerror=()=>{try{tx.abort();}catch{/* fail closed */}};
      req.onsuccess=()=>{
        try{
          const cursor=req.result;
          if(cursor){
            const raw=before.get(String(cursor.primaryKey));
            if(!raw||JSON.stringify(cursor.value)!==JSON.stringify(raw))invalid();
            seen++;
            cursor.continue();
            return;
          }
          if(seen!==before.size)invalid();
          // No await inside the transaction. Every add is covered by the
          // same atomic transaction: quota, duplicate or thrown request
          // errors abort ALL new records and keep the previous rows.
          for(const row of additional)store.add(row,key(owner,row.rowId));
          done();
        }catch{try{tx.abort();}catch{/* fail closed */}}
      };
    });
  }finally{db.close();}
  const verified=await readAuthenticatedRows(root,owner,false);
  if(verified.length!==proposals.length)invalid();
  const saved=new Map(verified.map(item=>[item.row.rowId,item.row.plan]));
  const plans:PreparedV1ToV2[]=[];
  for(const proposal of proposals){
    const plan=saved.get(proposal.rowId);
    const expectedPlan=expected.get(proposal.rowId)??proposal;
    if(!plan||JSON.stringify(plan)!==JSON.stringify(expectedPlan))invalid();
    plans.push(plan);
  }
  return {plans,stored:additional.length,reused:expected.size};
}

/** Does not clear or replay; plaintext root is never persisted. */
export async function listV2OwnerMigrationIntents(
  root:Bytes,owner:Owner,
):Promise<readonly PreparedV1ToV2[]>{
  root=root.slice();
  owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const verified=await readAuthenticatedRows(root,owner,false);
  return verified.map(item=>item.row.plan);
}

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
type Stored=Readonly<{schema:1;projectId:string;ownerId:string;
  rowId:string;queuedAt:string;plan:PreparedV1ToV2}>;
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
  if(scope(owner).length<1||!(root instanceof Uint8Array)||root.length!==32||
     !plan||plan.projectId!==owner.projectId||plan.ownerId!==owner.ownerId||
     plan.rowId!==plan.record?.rowId||plan.collection!==plan.record.collection||
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
function checkedStored(owner:Owner,value:unknown):Stored {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid();
  const row=value as Stored;
  if(Object.keys(row).sort().join('|')!==
     ['schema','projectId','ownerId','rowId','queuedAt','plan'].sort().join('|')||
     row.schema!==1||row.projectId!==owner.projectId||
     row.ownerId!==owner.ownerId||
     typeof row.queuedAt!=='string'||!Number.isFinite(Date.parse(row.queuedAt))||
     !/^p_[a-f0-9]{32}$/.test(row.rowId)||row.plan?.rowId!==row.rowId)invalid();
  return row;
}
/** Atomic per-owner/per-row first-write wins; identical retry reads same bytes. */
export async function stageV2OwnerMigrationIntent(
  root:Bytes,owner:Owner,plan:PreparedV1ToV2,
):Promise<'stored'|'unchanged'>{
  await validated(root,owner,plan);
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
              const record:Stored={schema:1,projectId:owner.projectId,
                ownerId:owner.ownerId,rowId:plan.rowId,
                queuedAt:new Date().toISOString(),plan};
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
  const plan=checkedStored(owner,value).plan;
  await validated(root,owner,plan);
  return plan;
}
/** Does not clear or replay; plaintext root is never persisted. */
export async function listV2OwnerMigrationIntents(
  root:Bytes,owner:Owner,
):Promise<readonly PreparedV1ToV2[]>{
  const db=await open(false);
  let values:unknown[];
  try{
    values=await getStore<unknown[]>(db,'readonly',(store,tx,done)=>{
      const req=store.getAll(range(owner),MAX_PENDING+1);
      req.onerror=()=>{try{tx.abort();}catch{}};
      req.onsuccess=()=>done(req.result);
    });
  }finally{db.close();}
  if(values.length>MAX_PENDING)invalid();
  const out:PreparedV1ToV2[]=[];
  const seen=new Set<string>();
  for(const value of values){
    const row=checkedStored(owner,value);
    if(seen.has(row.rowId))invalid();
    seen.add(row.rowId);
    await validated(root,owner,row.plan);
    out.push(row.plan);
  }
  return out;
}

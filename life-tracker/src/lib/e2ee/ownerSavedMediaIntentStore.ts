/**
 * Scratch-only, dormant durable encrypted PHOTO replay preparation.
 *
 * Requires the actual saved, root-authenticated rescue File and retains the
 * ORIGINAL encrypted media bytes and randomized AES-GCM media ID, across
 * page reloads and ambiguous future uploads. No Appwrite client, Storage,
 * media ACK, deletion, overwrite, normal sync, or user-data migration.
 */
import type {Bytes,Owner,RecordEnvelope} from './coreCrypto';
import {
  OWNER_LOCAL_RESCUE_FILENAME,readVerifiedSealedMediaFromRescueFile,
} from './ownerLocalRescueBundle';
import {
  decryptOwnerPendingImage,type EncryptedPendingImage,
} from './ownerPendingImageRescue';
import type {EncryptedMediaManifest} from './privateMediaCodec';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';

const DB='mosaic-e2ee-encrypted-owner-media-v1';
const STORE='sealed-photo-intents';
const DOMAIN='mosaic-e2ee/owner-media-local-index/v1';
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const KEY=/^k_[a-f0-9]{32}$/;
const ROW=/^p_[a-f0-9]{32}$/;
const MAX_ITEMS=500,MAX_BYTES=64*1024*1024;
const ENC=new TextEncoder();
type Stored=Readonly<{
  schema:1;rowId:string;revision:string;keyId:string;
  sealedMetadata:RecordEnvelope;manifest:EncryptedMediaManifest;
  ciphertext:Uint8Array;
}>;
type Verified=Readonly<{key:string;localId:string;stored:Stored}>;
export type StagedMediaResult=Readonly<{
  status:'local-ciphertext-staged-not-uploaded';
  stored:number;reused:number;total:number;
}>;

function denied():never{
  throw new Error('Encrypted owner photo replay source incomplete; original saved File required.');
}
function valid(root:Bytes,owner:Owner,keyId?:string){
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
     !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     keyId!==undefined&&(typeof keyId!=='string'||!KEY.test(keyId)))
    denied();
}
function hex(bytes:Uint8Array){
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function hmacKey(root:Bytes,owner:Owner):Promise<CryptoKey>{
  const source=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',salt:ENC.encode(DOMAIN+'/salt'),
    info:ENC.encode(JSON.stringify([DOMAIN,owner.projectId,owner.ownerId])),
  },source,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']);
}
async function indexKey(
  key:CryptoKey,scope:string,localId:string,
):Promise<string>{
  if(typeof localId!=='string'||!/^localimg_[a-f0-9]{26}$/.test(localId))denied();
  return scope+hex(new Uint8Array(await crypto.subtle.sign(
    'HMAC',key,ENC.encode(DOMAIN+'/photo:'+localId))));
}
async function ownerPrefix(root:Bytes,owner:Owner){
  const key=await hmacKey(root,owner);
  const data=ENC.encode(DOMAIN+'/owner-prefix');
  const prefix=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,data)))+'|';
  return {prefix,key};
}
function equalBytes(a:Uint8Array,b:Uint8Array){
  if(a.byteLength!==b.byteLength)return false;
  let changed=0;
  for(let i=0;i<a.byteLength;i++)changed|=a[i]^b[i];
  return changed===0;
}
function compare(a:Stored,b:Stored){
  return a.schema===b.schema&&a.rowId===b.rowId&&
    a.revision===b.revision&&a.keyId===b.keyId&&
    JSON.stringify(a.sealedMetadata)===JSON.stringify(b.sealedMetadata)&&
    JSON.stringify(a.manifest)===JSON.stringify(b.manifest)&&
    equalBytes(a.ciphertext,b.ciphertext);
}
function check(record:unknown):Stored{
  if(!record||typeof record!=='object'||Array.isArray(record)||
     Object.getPrototypeOf(record)!==Object.prototype)denied();
  const r=record as Stored;
  if(Object.keys(r).length!==7||r.schema!==1||
     typeof r.rowId!=='string'||!ROW.test(r.rowId)||
     typeof r.keyId!=='string'||!KEY.test(r.keyId)||
     typeof r.revision!=='string'||!/^r_[a-f0-9]{32}$/.test(r.revision)||
     !r.sealedMetadata||!r.manifest||
     !(r.ciphertext instanceof Uint8Array)||
     r.ciphertext.byteLength<1||r.ciphertext.byteLength>MAX_BYTES)
    denied();
  return r;
}
function encrypted(record:Stored):EncryptedPendingImage {
  return {
    rowId:record.rowId,revision:record.revision,keyId:record.keyId,
    sealedMetadata:record.sealedMetadata,
    sealedMedia:{
      manifest:record.manifest,
      ciphertext:new Blob([record.ciphertext.slice().buffer],
        {type:'application/octet-stream'}),
    },
  };
}
async function checkedMedia(
  root:Bytes,owner:Owner,record:Stored,key:CryptoKey,prefix:string,
):Promise<Verified>{
  const opened=await decryptOwnerPendingImage(owner,root,encrypted(record));
  return {key:await indexKey(key,prefix,opened.localId),
    localId:opened.localId,stored:record};
}
function open(create:boolean):Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(new Error('IndexedDB required'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{
      if(!create){
        try{request.transaction?.abort();}catch{/* fail closed */}
        reject(new Error('No initialized encrypted media queue.'));
      }else request.result.createObjectStore(STORE);
    };
    request.onerror=()=>reject(new Error('Encrypted media IndexedDB unavailable.'));
    request.onblocked=()=>reject(new Error('Encrypted media IndexedDB blocked.'));
    request.onsuccess=()=>{
      if(!request.result.objectStoreNames.contains(STORE)){
        request.result.close();reject(new Error('Invalid encrypted media queue.'));
      }else{
        request.result.onversionchange=()=>request.result.close();
        resolve(request.result);
      }
    };
  });
}
function range(prefix:string){
  if(typeof IDBKeyRange==='undefined')denied();
  return IDBKeyRange.bound(prefix,prefix+'\uffff');
}
async function snapshot(root:Bytes,owner:Owner,create=false):Promise<Verified[]>{
  let db:IDBDatabase;
  try{db=await open(create);}
  catch(e){
    if(!create&&e instanceof Error&&e.message==='No initialized encrypted media queue.')
      return [];
    throw e;
  }
  const {prefix,key}=await ownerPrefix(root,owner);
  try{
    const entries=await new Promise<{key:string;value:unknown}[]>((resolve,reject)=>{
      const rows:{key:string;value:unknown}[]=[];
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).openCursor(range(prefix));
      req.onsuccess=()=>{
        try{
          const cursor=req.result;
          if(!cursor)return;
          if(rows.length>=MAX_ITEMS)denied();
          rows.push({key:String(cursor.primaryKey),value:cursor.value});
          cursor.continue();
        }catch{try{tx.abort();}catch{/* fail closed */}}
      };
      req.onerror=()=>{try{tx.abort();}catch{/* fail closed */}};
      tx.oncomplete=()=>resolve(rows);
      tx.onerror=tx.onabort=()=>reject(new Error('Encrypted media snapshot aborted.'));
    });
    const out:Verified[]=[];
    let bytes=0;
    for(const item of entries){
      const row=check(item.value);
      bytes+=row.ciphertext.byteLength;
      if(bytes>MAX_BYTES)denied();
      const verified=await checkedMedia(root,owner,row,key,prefix);
      if(verified.key!==item.key)denied();
      out.push(verified);
    }
    return out;
  }finally{db.close();}
}

/** Authenticate and decrypt staged ciphertext in memory, never upload it. */
export async function readStagedOwnerEncryptedMedia(
  root:Bytes,owner:Owner,
):Promise<readonly Readonly<{localId:string;encrypted:EncryptedPendingImage}>[]>{
  valid(root,owner);
  const scope:Owner={...owner},key=root.slice();
  const records=await snapshot(key,scope);
  return records.map(v=>({localId:v.localId,encrypted:encrypted(v.stored)}));
}

/**
 * The ONLY writer: complete root-authenticated saved-file readback, before
 * atomic first-write-wins storage. Local ID is root-HMAC-blinded. A different
 * saved ciphertext for the SAME original local image is a conflict, not a
 * silent new upload ID. Every existing owner's media must remain included.
 */
export async function stageSelectedSavedOwnerEncryptedMedia(
  root:Bytes,owner:Owner,file:File,keyId:string,
  gate:Readonly<{assertReady:(owner:Owner)=>Promise<void>}>,
):Promise<StagedMediaResult>{
  valid(root,owner,keyId);
  if(typeof File==='undefined'||!(file instanceof File)||
     file.name!==OWNER_LOCAL_RESCUE_FILENAME||
     typeof gate?.assertReady!=='function')denied();
  const scope:Owner={...owner},secret=root.slice();
  await gate.assertReady(scope);
  const originals=await readVerifiedSealedMediaFromRescueFile(scope,secret,file);
  if(originals.length>MAX_ITEMS)denied();
  const {prefix,key}=await ownerPrefix(secret,scope);
  const proposed=new Map<string,Verified>();
  let totalBytes=0;
  for(const item of originals){
    if(item.keyId!==keyId)denied();
    const bytes=new Uint8Array(await item.sealedMedia.ciphertext.arrayBuffer());
    totalBytes+=bytes.byteLength;
    if(totalBytes>MAX_BYTES)denied();
    const row:Stored={
      schema:1,rowId:item.rowId,revision:item.revision,
      keyId:item.keyId,sealedMetadata:structuredClone(item.sealedMetadata),
      manifest:structuredClone(item.sealedMedia.manifest),
      ciphertext:bytes,
    };
    const verified=await checkedMedia(secret,scope,row,key,prefix);
    if(proposed.has(verified.key))denied();
    proposed.set(verified.key,verified);
  }
  const existing=await snapshot(secret,scope);
  if(existing.length>proposed.size)denied();
  const before=new Map<string,Stored>();
  for(const old of existing){
    const current=proposed.get(old.key);
    if(!current||!compare(old.stored,current.stored))denied();
    before.set(old.key,old.stored);
  }
  const additional=[...proposed.values()].filter(v=>!before.has(v.key));
  await gate.assertReady(scope);
  if(additional.length){
    const db=await open(true);
    try{
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        const req=tx.objectStore(STORE).openCursor(range(prefix));
        let seen=0;
        req.onsuccess=()=>{
          try{
            const cur=req.result;
            if(cur){
              const old=before.get(String(cur.primaryKey));
              if(!old||!compare(check(cur.value),old))denied();
              seen++;cur.continue();
            }else{
              if(seen!==before.size)denied();
              // All adds share the exact same IDB transaction: a duplicate,
              // quota error or concurrent snapshot conflict aborts the batch.
              for(const item of additional)
                tx.objectStore(STORE).add(item.stored,item.key);
            }
          }catch{try{tx.abort();}catch{/* fail closed */}}
        };
        req.onerror=()=>{try{tx.abort();}catch{/* fail closed */}};
        tx.oncomplete=()=>resolve();
        tx.onerror=tx.onabort=()=>reject(
          new Error('Encrypted media atomic staging failed; saved file retained.'));
      });
    }finally{db.close();}
  }
  const verified=await snapshot(secret,scope);
  if(verified.length!==proposed.size)denied();
  for(const item of verified){
    const expected=proposed.get(item.key);
    if(!expected||!compare(item.stored,expected.stored))denied();
  }
  await gate.assertReady(scope);
  return {status:'local-ciphertext-staged-not-uploaded',
    stored:additional.length,reused:existing.length,total:verified.length};
}

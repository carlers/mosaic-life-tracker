/**
 * Dormant M3 local persistence of independently manually verified recipient
 * identity pins. The server-provided key directory is UNTRUSTED. Nothing here
 * implements chat, signed key changes, share encryption, HPKE, or MLS.
 *
 * Local identifiers are HMAC-indexed and pinned fingerprint data is encrypted
 * with the currently unlocked owner root; no plaintext recipient key or
 * identity pin is written to IndexedDB. Same-origin hostile JS can still use
 * an unlocked root and local eviction can destroy this local trust history.
 */
import {
  type Bytes,type Owner,type RecordEnvelope,
  generateOpaqueRowId,generateRevision,
  encryptPrivateRecord,decryptPrivateRecord,
} from './coreCrypto';
import {
  candidateIdentityFingerprint,pinManuallyVerifiedRecipient,
  requirePinnedRecipientIdentity,
  type RecipientIdentity,type VerifiedRecipientPin,
} from './recipientIdentityGate';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';

const DB='mosaic-e2ee-recipient-trust-pins-v1';
const STORE='recipient-pins';
const INDEX_DOMAIN='mosaic-e2ee/local-recipient-trust-pin-index/v1';
const PURPOSE='recipient-identity-manual-pin-v1';
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const KEY=/^k_[a-f0-9]{32}$/;
const OPAQUE=/^p_[a-f0-9]{32}$/;
const REV=/^r_[a-f0-9]{32}$/;
const ENC=new TextEncoder();
type Stored=Readonly<{
  v:1;rowId:string;keyId:string;revision:string;envelope:RecordEnvelope;
}>;
type PinResult=Readonly<{pin:VerifiedRecipientPin;state:'stored'|'reused'}>;

function denied():never{
  throw new Error('Independent recipient identity pin not available or safe.');
}
function check(root:Bytes,owner:Owner,keyId:string):void{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     typeof owner.projectId!=='string'||typeof owner.ownerId!=='string'||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||!ID.test(owner.ownerId)||
     typeof keyId!=='string'||!KEY.test(keyId))denied();
}
async function index(root:Bytes,owner:Owner,recipientId:string,deviceId:string):
  Promise<string>{
  if(typeof recipientId!=='string'||typeof deviceId!=='string'||
     !ID.test(recipientId)||!ID.test(deviceId)||recipientId===owner.ownerId)denied();
  const material=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveKey']);
  const hmac=await crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',salt:ENC.encode(INDEX_DOMAIN+'/salt'),
    info:ENC.encode(JSON.stringify([INDEX_DOMAIN,owner.projectId,owner.ownerId])),
  },material,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,
    ENC.encode(JSON.stringify([INDEX_DOMAIN,recipientId,deviceId]))));
  return 'pin_'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
function parse(value:unknown):Stored{
  if(!value||typeof value!=='object'||Array.isArray(value))denied();
  const s=value as Stored;
  const names=['v','rowId','keyId','revision','envelope'];
  if(Object.keys(s).length!==names.length||names.some(k=>!Object.hasOwn(s,k))||
     s.v!==1||!OPAQUE.test(s.rowId)||!KEY.test(s.keyId)||
     !REV.test(s.revision)||!s.envelope||s.envelope.kid!==s.keyId||
     s.envelope.revision!==s.revision)denied();
  return s;
}
function context(owner:Owner,s:Pick<Stored,'rowId'|'keyId'|'revision'>){
  return {...owner,payloadDomain:'offline-snapshot' as const,
    rowId:s.rowId,keyId:s.keyId,revision:s.revision,
    publicRouting:{purpose:PURPOSE}};
}
function pinPayload(value:Record<string,unknown>):VerifiedRecipientPin{
  const fields=['projectId','localOwnerId','recipientId','deviceId',
    'identityEpoch','fingerprint','verification'];
  if(!value||Object.keys(value).length!==fields.length||
     fields.some(k=>!Object.hasOwn(value,k))||
     value.verification!=='manual-out-of-band'||
     typeof value.projectId!=='string'||typeof value.localOwnerId!=='string'||
     typeof value.recipientId!=='string'||typeof value.deviceId!=='string'||
     !Number.isSafeInteger(value.identityEpoch)||
     typeof value.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(value.fingerprint))denied();
  return value as unknown as VerifiedRecipientPin;
}
function open(allowCreate:boolean):Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(
    new Error('Encrypted recipient pin IndexedDB unavailable.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{
      if(!allowCreate){
        try{req.transaction?.abort();}catch{/* fail closed */}
        reject(new Error('No initialized recipient pin store.'));
      }else req.result.createObjectStore(STORE);
    };
    req.onerror=()=>reject(new Error('Encrypted recipient pin store inaccessible.'));
    req.onblocked=()=>reject(new Error('Encrypted recipient pin store blocked.'));
    req.onsuccess=()=>{
      if(!req.result.objectStoreNames.contains(STORE)){
        req.result.close();reject(new Error('Recipient pin schema mismatch.'));
      }else{
        req.result.onversionchange=()=>req.result.close();
        resolve(req.result);
      }
    };
  });
}
async function read(storageKey:string):Promise<Stored|null>{
  let db:IDBDatabase;
  try{db=await open(false);}
  catch(e){
    if(e instanceof Error&&e.message==='No initialized recipient pin store.')
      return null;
    throw e;
  }
  try{
    return await new Promise<Stored|null>((resolve,reject)=>{
      let value:unknown;
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(storageKey);
      req.onsuccess=()=>{value=req.result;};
      tx.oncomplete=()=>{
        try{resolve(value===undefined?null:parse(value));}
        catch(error){reject(error);}
      };
      tx.onerror=tx.onabort=()=>reject(
        new Error('Encrypted recipient pin read failed.'));
    });
  }finally{db.close();}
}
/**
 * Returns null only for a truly ABSENT local pin. A wrong root, replaced
 * recipient key/epoch or tampered ciphertext throws; never fall back to TOFU.
 * Rebuilding a lost pin requires a new independent out-of-band comparison.
 */
export async function readPinnedRecipientIdentity(
  root:Bytes,owner:Owner,candidate:RecipientIdentity,keyId:string,
):Promise<VerifiedRecipientPin|null>{
  check(root,owner,keyId);
  const secret=root.slice(),scope:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  const identity:RecipientIdentity={...candidate};
  try{
    await candidateIdentityFingerprint(scope,identity);
    const storageKey=await index(secret,scope,identity.recipientId,identity.deviceId);
    const saved=await read(storageKey);
    if(!saved)return null;
    if(saved.keyId!==keyId)denied();
    const payload=await decryptPrivateRecord(secret,context(scope,saved),saved.envelope);
    const pin=pinPayload(payload);
    await requirePinnedRecipientIdentity(scope,identity,pin);
    return pin;
  }finally{secret.fill(0);}
}
/**
 * Requires a caller-entered fingerprint independently compared through a
 * trusted contact channel; the code cannot prove that channel is independent.
 * First-write-wins across tabs, with no silent key changes or reset operation.
 * Failed writes leave an existing original pin untouched.
 */
export async function stageManuallyVerifiedRecipientPin(
  root:Bytes,owner:Owner,candidate:RecipientIdentity,
  independentlyEnteredFingerprint:string,keyId:string,
):Promise<PinResult>{
  check(root,owner,keyId);
  const secret=root.slice(),scope:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  try{
  const identity:RecipientIdentity={...candidate};
  const pin=await pinManuallyVerifiedRecipient(
    scope,identity,independentlyEnteredFingerprint);
  const storageKey=await index(secret,scope,identity.recipientId,identity.deviceId);
  const header={rowId:generateOpaqueRowId(),keyId,revision:generateRevision()};
  const sealed:Stored={v:1,...header,envelope:await encryptPrivateRecord(
    secret,context(scope,header),{...pin},
  )};
  const db=await open(true);
  let state:'stored'|'reused'='stored';
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const store=tx.objectStore(STORE);
      const req=store.get(storageKey);
      req.onsuccess=()=>{
        try{
          if(req.result===undefined)store.add(sealed,storageKey);
          else{
            parse(req.result);
            state='reused';
          }
        }catch{try{tx.abort();}catch{/* fail closed */}}
      };
      tx.oncomplete=()=>resolve();
      tx.onerror=tx.onabort=()=>reject(
        new Error('Encrypted recipient pin first-write transaction failed.'));
    });
  }finally{db.close();}
  const verified=await readPinnedRecipientIdentity(secret,scope,identity,keyId);
  if(!verified||JSON.stringify(verified)!==JSON.stringify(pin))denied();
  return {pin:verified,state};
  }finally{secret.fill(0);}
}

/**
 * SOURCE ONLY: turn already authenticated local owner RxDB documents into
 * new opaque owner-v2 migration intents. Never writes a Function, IndexedDB,
 * Appwrite, an existing local record, or a queue.
 *
 * Raw _deleted=true must remain a tombstone on the future v2 server. Keeping
 * only app-level isDeleted is unsafe for historical offline deletions.
 */
import {
  type Bytes,type Owner,deriveMigratedOwnerRowId,
  generateRevision,generateOperationId,
} from './coreCrypto';
import {ownerPrivacyFields} from './fieldManifest';
import {
  SCRATCH_OWNER_V2_PROJECT,OWNER_V2_COLLECTIONS,
  type OwnerV2Collection,V2_OWNER_DOMAIN,
  sealV2PrivateOwnerDocument,openV2PrivateOwnerDocument,
} from './ownerPrivateV2Contract';
import type {PreparedV1ToV2} from './ownerV1ToV2MigrationPlan';

const KID=/^k_[a-f0-9]{32}$/;
const INTERNAL=new Set(['_deleted','_rev','_meta','_attachments']);
const encoder=new TextEncoder();
function denied():never{
  throw new Error('Historical raw owner-to-v2 migration intent incomplete.');
}
function serialize(v:unknown,depth=0):string{
  if(depth>24)denied();
  if(v===null||typeof v==='boolean'||typeof v==='string')
    return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v)){
    if(v.length>3000)denied();
    return '['+v.map(x=>serialize(x,depth+1)).join(',')+']';
  }
  if(typeof v==='object'&&v&&
    (Object.getPrototypeOf(v)===Object.prototype||
     Object.getPrototypeOf(v)===null)){
    const value=v as Record<string,unknown>,keys=Object.keys(value).sort();
    if(keys.length>200)denied();
    return '{'+keys.map(k=>{
      if(['__proto__','constructor','prototype'].includes(k))denied();
      return JSON.stringify(k)+':'+serialize(value[k],depth+1);
    }).join(',')+'}';
  }
  return denied();
}
function checkRaw(
  owner:Owner,collection:OwnerV2Collection,raw:unknown,
):Record<string,unknown>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.getPrototypeOf(raw)!==Object.prototype)denied();
  const source=raw as Record<string,unknown>;
  if(typeof source.id!=='string'||!source.id||
     encoder.encode(source.id).length>512||
     source.userId!==owner.ownerId||typeof source.isDeleted!=='boolean'||
     typeof source._deleted!=='boolean'||
     typeof source._rev!=='string'||!source._rev||
     !source._meta||typeof source._meta!=='object'||
     Array.isArray(source._meta)||
     !Number.isFinite((source._meta as Record<string,unknown>).lwt)||
     !source._attachments||typeof source._attachments!=='object'||
     Array.isArray(source._attachments))denied();
  // Refuse lossy JSON coercion or unclassified fields, even if a later codec
  // would have silently dropped undefined, Dates, or an extra plaintext key.
  serialize(source);
  const allowed=ownerPrivacyFields[collection] as Record<string,string>;
  const document:Record<string,unknown>={};
  for(const key of Object.keys(source)){
    if(INTERNAL.has(key))continue;
    if(!Object.hasOwn(allowed,key))denied();
    document[key]=source[key];
  }
  // A physical RxDB deletion is final regardless of legacy application
  // isDeleted:false. The original full revision stays in the encrypted
  // offline rescue, not server-visible routing.
  if(source._deleted===true)document.isDeleted=true;
  return document;
}
export async function prepareScratchRawOwnerToV2(
  root:Bytes,owner:Owner,collection:OwnerV2Collection,
  raw:Record<string,unknown>,keyId:string,expectedGeneration:number,
):Promise<PreparedV1ToV2>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
    !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
    typeof owner.ownerId!=='string'||!owner.ownerId||
    !(OWNER_V2_COLLECTIONS as readonly string[]).includes(collection)||
    !KID.test(keyId)||!Number.isSafeInteger(expectedGeneration)||
    expectedGeneration<1||expectedGeneration>2147483647)denied();
  // Snapshot *before* async HKDF/AES. Caller mutation cannot alter the
  // plaintext being authenticated or the output operation metadata.
  const scoped:Owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const secret=root.slice();
  try{
  let source:Record<string,unknown>;
  try{source=structuredClone(raw);}catch{return denied();}
  const document=checkRaw(scoped,collection,source);
  const rowId=await deriveMigratedOwnerRowId(secret,scoped,
    V2_OWNER_DOMAIN[collection],document.id as string);
  const revision=generateRevision();
  const context={...scoped,rowId,keyId,revision,
    payloadDomain:V2_OWNER_DOMAIN[collection]};
  const record=await sealV2PrivateOwnerDocument(
    secret,scoped,context,collection,document,
  );
  const opened=await openV2PrivateOwnerDocument(
    secret,scoped,context,collection,record,
  );
  if(serialize(opened)!==serialize(document))denied();
  return {
    projectId:scoped.projectId,ownerId:scoped.ownerId,
    collection,rowId,expectedRevision:null,
    expectedGeneration,opId:generateOperationId(),record,
  };
  }finally{secret.fill(0);}
}

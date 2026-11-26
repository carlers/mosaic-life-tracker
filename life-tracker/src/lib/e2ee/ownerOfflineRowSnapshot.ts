/**
 * Dormant current-dev E2EE offline owner-row snapshot. Retains local tombstones
 * and orphaned links: never use the filtered normal backup export for cutover.
 * No network, restore, deletion, upload, auto-promotion or old-PWA access.
 */
import {
  type Bytes, type Owner, type RecordEnvelope,
  generateRevision, generateOpaqueRowId, deriveMigratedOwnerRowId,
  encryptPrivateRecord, decryptPrivateRecord,
} from './coreCrypto';
import type { PrivatePayloadDomain } from './domainRegistry';

export const LOCAL_OWNER_COLLECTIONS = [
  'tasks','categories','diary','settings','bucketList','bucketTaskLinks',
  'activities','activityTaskLinks','friendships','messages',
] as const;
export type LocalOwnerCollection=(typeof LOCAL_OWNER_COLLECTIONS)[number];
type InputDoc=Readonly<Record<string, unknown>>;
type ReadResult=Readonly<Record<LocalOwnerCollection, readonly InputDoc[]>>;
export interface OwnerLocalReader {
  readAll(collection: LocalOwnerCollection, userId:string): Promise<readonly InputDoc[]>;
}
export interface OwnerLocalGate {assertReady(owner:Owner):Promise<void>;}
export type SealedLocalRow=Readonly<{
  collection:LocalOwnerCollection;rowId:string;keyId:string;revision:string;
  envelope:RecordEnvelope;
}>;

const KID=/^k_[a-f0-9]{32}$/;
const MAX_ROWS=3000;
const MAX_BYTES=24*1024*1024;
const DOMAIN='offline-snapshot' as const;
const DOMAINS:Readonly<Record<LocalOwnerCollection,PrivatePayloadDomain>>={
  tasks:'task',categories:'category',diary:'diary',
  settings:'settings-private',bucketList:'bucket-list',
  bucketTaskLinks:'bucket-task-link',activities:'activity',
  activityTaskLinks:'activity-task-link',
  // Offline copies only, NEVER deterministic remote chat/recipient IDs.
  friendships:'social-private',messages:'chat-message',
};

function invalid():never {
  throw new Error('Owner offline ciphertext snapshot unavailable or incomplete.');
}
function safeValue(value:unknown,depth=0):boolean {
  if(depth>24)return false;
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=3000&&value.every(x=>safeValue(x,depth+1));
  if(typeof value==='object' && value) {
    if(Object.getPrototypeOf(value)!==Object.prototype &&
       Object.getPrototypeOf(value)!==null) return false;
    const keys=Object.keys(value);
    return keys.length<=200 && keys.every(k=>
      !['__proto__','constructor','prototype'].includes(k) &&
      safeValue((value as Record<string,unknown>)[k],depth+1));
  }
  return false;
}
function checkDoc(doc:unknown,owner:Owner):asserts doc is InputDoc {
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||
      !safeValue(doc))invalid();
  const d=doc as Record<string,unknown>;
  if(typeof d.id!=='string'||!d.id||d.id.length>512||
      d.userId!==owner.ownerId||typeof d.isDeleted!=='boolean')invalid();
}
function canonical(value:unknown):string {
  if(!safeValue(value))invalid();
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>
    JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
function assertContext(owner:Owner,root:Bytes,keyId:string):void {
  if(!owner?.projectId||!owner?.ownerId||
     !(root instanceof Uint8Array)||root.byteLength!==32||!KID.test(keyId))
     invalid();
}
async function collect(owner:Owner,reader:OwnerLocalReader):Promise<ReadResult> {
  const result={} as Record<LocalOwnerCollection, readonly InputDoc[]>;
  let totalRows=0,totalBytes=0;
  for(const collection of LOCAL_OWNER_COLLECTIONS){
    const rows=await reader.readAll(collection,owner.ownerId);
    if(!Array.isArray(rows))invalid();
    const byId=new Set<string>();
    const sorted=rows.map(doc=>{
      checkDoc(doc,owner);
      if(byId.has(doc.id as string))invalid();
      byId.add(doc.id as string);
      return doc;
    }).sort((a,b)=>(a.id as string).localeCompare(b.id as string));
    totalRows+=sorted.length;
    totalBytes+=new TextEncoder().encode(canonical(sorted)).length;
    if(totalRows>MAX_ROWS||totalBytes>MAX_BYTES)invalid();
    result[collection]=sorted;
  }
  return result;
}
function fingerprint(snapshot:ReadResult):string {
  return LOCAL_OWNER_COLLECTIONS.map(c=>c+':'+canonical(snapshot[c])).join('\n');
}

/**
 * Current-app RxDB reader uses owner-only queries WITHOUT an isDeleted:false
 * predicate and never drops orphaned link rows. RxDB internal revision/sync
 * checkpoints are NOT promised by toJSON(); complete PWA recovery remains blocked.
 * Caller must explicitly opt in from a fully authenticated, root-unlocked flow.
 */
export const currentRxDbOwnerLocalReader:OwnerLocalReader={
  async readAll(collection,userId) {
    const {getDatabase}=await import('../../db/database');
    const db=getDatabase();
    const target=db[collection] as unknown as {
      find:(q:{selector:{userId:string}})=>{exec:()=>Promise<readonly {toJSON:()=>unknown}[]>};
    };
    const found=await target.find({selector:{userId}}).exec();
    return found.map(value=>value.toJSON() as InputDoc);
  },
};

export async function sealCurrentOwnerOfflineRows(
  owner:Owner,root:Bytes,keyId:string,gate:OwnerLocalGate,
  reader:OwnerLocalReader=currentRxDbOwnerLocalReader,
):Promise<readonly SealedLocalRow[]> {
  assertContext(owner,root,keyId);
  await gate.assertReady(owner);
  const initial=await collect(owner,reader);
  const proof=fingerprint(initial);
  const result:SealedLocalRow[]=[];
  for(const collection of LOCAL_OWNER_COLLECTIONS){
    for(const doc of initial[collection]){
      await gate.assertReady(owner);
      // Social/chat local copies must never be confused with remote owner-
      // migration identities or an authenticated messaging protocol.
      const rowId=collection==='friendships'||collection==='messages'
        ? generateOpaqueRowId()
        : await deriveMigratedOwnerRowId(root,owner,DOMAINS[collection],doc.id as string);
      const revision=generateRevision();
      const envelope=await encryptPrivateRecord(root,{
        ...owner,payloadDomain:DOMAIN,rowId,keyId,revision,
        publicRouting:{collection},
      },{collection,document:doc});
      result.push({collection,rowId,keyId,revision,envelope});
    }
  }
  if(fingerprint(await collect(owner,reader))!==proof)invalid();
  await gate.assertReady(owner);
  for(const sealed of result)await decryptOwnerOfflineRow(owner,root,sealed);
  return result;
}

/** File-oriented authenticated readback; no restore or backend mutation. */
export async function decryptOwnerOfflineRow(
  owner:Owner,root:Bytes,item:SealedLocalRow,
):Promise<InputDoc> {
  if(!item||!LOCAL_OWNER_COLLECTIONS.includes(item.collection))invalid();
  assertContext(owner,root,item.keyId);
  const data=await decryptPrivateRecord(root,{
    ...owner,payloadDomain:DOMAIN,rowId:item.rowId,
    keyId:item.keyId,revision:item.revision,publicRouting:{collection:item.collection},
  },item.envelope);
  if(data.collection!==item.collection)invalid();
  checkDoc(data.document,owner);
  if(item.collection==='friendships'||item.collection==='messages'){
    if(!/^p_[a-f0-9]{32}$/.test(item.rowId))invalid();
  }else{
    const expected=await deriveMigratedOwnerRowId(root,owner,DOMAINS[item.collection],
      data.document.id as string);
    if(expected!==item.rowId)invalid();
  }
  return data.document;
}

/** Isolated Scratch-only E2EE owner-private v2 candidate. NOT a live sync path. */
import {type Bytes,type Owner,type PrivateRecordContext,type RecordEnvelope,encryptPrivateRecord,decryptPrivateRecord} from './coreCrypto';
import {ownerPrivacyFields} from './fieldManifest';
import type {PrivatePayloadDomain} from './domainRegistry';

export const SCRATCH_OWNER_V2_PROJECT='6b00671500279e901846';
export const OWNER_V2_COLLECTIONS=['tasks','categories','diary','bucketList','bucketTaskLinks','settings','activities','activityTaskLinks'] as const;
export type OwnerV2Collection=(typeof OWNER_V2_COLLECTIONS)[number];
export const V2_OWNER_DOMAIN:Readonly<Record<OwnerV2Collection,PrivatePayloadDomain>>={
  tasks:'task',categories:'category',diary:'diary',bucketList:'bucket-list',
  bucketTaskLinks:'bucket-task-link',settings:'settings-private',
  activities:'activity',activityTaskLinks:'activity-task-link',
};
export const V2_ROUTING:Readonly<Record<OwnerV2Collection,readonly string[]>>={
  tasks:['userId','createdAt','updatedAt','isDeleted'],
  categories:['userId','updatedAt','isDeleted'],
  diary:['userId','createdAt','updatedAt','isDeleted'],
  bucketList:['userId','createdAt','updatedAt','isDeleted'],
  bucketTaskLinks:['userId','createdAt','updatedAt','isDeleted'],
  settings:['userId','updatedAt','isDeleted'],
  activities:['userId','createdAt','updatedAt','isDeleted'],
  activityTaskLinks:['userId','createdAt','updatedAt','isDeleted'],
};
const POLICY='owner-private-v2',ID=/^p_[a-f0-9]{32}$/;
const PRIVATE_VISIBILITY=new Set<OwnerV2Collection>(['tasks','categories','diary']);
const encoder=new TextEncoder();
type Routed=string|number|boolean|null;
export type V2OwnerRecord=Readonly<{
  policy:typeof POLICY;schemaVersion:2;projectId:string;ownerId:string;rowId:string;
  collection:OwnerV2Collection;domain:PrivatePayloadDomain;
  routing:Readonly<Record<string,Routed>>;
  published:Readonly<Record<string,never>>;
  envelope:RecordEnvelope;
}>;
function denied():never {throw new Error('Isolated owner v2 policy mismatch; no downgrade allowed.');}
function snapshot<T>(value:T):T {
  try { return structuredClone(value); } catch { return denied(); }
}
/** Capture one immutable invocation state before any awaited WebCrypto work. */
function invocation(root:Bytes,owner:Owner,c:PrivateRecordContext){
  if(!(root instanceof Uint8Array)||root.byteLength!==32)denied();
  // Clone metadata before taking a key copy: malformed caller input must
  // never strand an allocated secret in a failed invocation path.
  const stable=snapshot({owner,c});
  if(!stable.owner||!stable.c||typeof stable.owner.projectId!=='string'||
     typeof stable.owner.ownerId!=='string')denied();
  return {key:root.slice(),owner:stable.owner,c:stable.c};
}
function validCollection(v:unknown):v is OwnerV2Collection {
  return typeof v==='string'&&(OWNER_V2_COLLECTIONS as readonly string[]).includes(v);
}
function checkScope(owner:Owner,c:PrivateRecordContext,collection:OwnerV2Collection) {
  if(!owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     c.projectId!==owner.projectId||c.ownerId!==owner.ownerId||
     !ID.test(c.rowId)||c.payloadDomain!==V2_OWNER_DOMAIN[collection])denied();
}
function sourceFields(collection:OwnerV2Collection,doc:Record<string,unknown>,ownerId:string) {
  const classes:Record<string,string>=ownerPrivacyFields[collection];
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||
     Object.getPrototypeOf(doc)!==Object.prototype||
     typeof doc.id!=='string'||doc.id.length===0||
     encoder.encode(doc.id).length>512||doc.userId!==ownerId||
     typeof doc.isDeleted!=='boolean')denied();
  for(const key of Object.keys(doc))if(!Object.hasOwn(classes,key))denied();
  if(PRIVATE_VISIBILITY.has(collection)&&doc.visibility!=='private')denied();
}
function routedFields(collection:OwnerV2Collection,input:unknown,ownerId:string):
  Record<string,Routed> {
  if(!input||typeof input!=='object'||Array.isArray(input)||
     (Object.getPrototypeOf(input)!==Object.prototype&&
      Object.getPrototypeOf(input)!==null))denied();
  const out:Record<string,Routed>=Object.create(null);
  for(const [key,value] of Object.entries(input)){
    if(!V2_ROUTING[collection].includes(key)||
       !(value===null||typeof value==='boolean'||
         typeof value==='string'&&encoder.encode(value).length<=512||
         typeof value==='number'&&Number.isSafeInteger(value)))denied();
    out[key]=value as Routed;
  }
  if(out.userId!==ownerId||typeof out.isDeleted!=='boolean'||
     encoder.encode(JSON.stringify(out)).length>4096)denied();
  return out;
}
function aad(routing:Record<string,Routed>) {
  return {...routing,ownerPolicy:POLICY,ownerPolicyVersion:2};
}
export async function sealV2PrivateOwnerDocument(
  root:Bytes,owner:Owner,c:PrivateRecordContext,
  collection:OwnerV2Collection,doc:Record<string,unknown>,
):Promise<V2OwnerRecord> {
  if(!validCollection(collection))denied();
  const pinned=invocation(root,owner,c);
  try{
  root=pinned.key;owner=pinned.owner;c=pinned.c;
  doc=snapshot(doc);
  checkScope(owner,c,collection);sourceFields(collection,doc,owner.ownerId);
  const classes:Record<string,string>=ownerPrivacyFields[collection];
  const publicRouting:Record<string,unknown>={},secret:Record<string,unknown>={};
  for(const [key,value] of Object.entries(doc)){
    if(value===undefined)continue;
    if(classes[key]==='routing')publicRouting[key]=value;
    else if(classes[key]==='encrypted')secret[key]=value;
    else denied(); // No public/social sharing through owner v2.
  }
  const routing=routedFields(collection,publicRouting,owner.ownerId);
  const envelope=await encryptPrivateRecord(root,{...c,publicRouting:aad(routing)},secret);
  return {policy:POLICY,schemaVersion:2,projectId:owner.projectId,
    ownerId:owner.ownerId,rowId:c.rowId,collection,
    domain:V2_OWNER_DOMAIN[collection],routing,published:{},envelope};
  }finally{pinned.key.fill(0);}
}
export async function openV2PrivateOwnerDocument(
  root:Bytes,owner:Owner,c:PrivateRecordContext,
  collection:OwnerV2Collection,record:V2OwnerRecord,
):Promise<Record<string,unknown>> {
  if(!validCollection(collection))denied();
  const pinned=invocation(root,owner,c);
  try{
  root=pinned.key;owner=pinned.owner;c=pinned.c;
  record=snapshot(record);
  checkScope(owner,c,collection);
  const keys=['policy','schemaVersion','projectId','ownerId','rowId','collection','domain','routing','published','envelope'];
  if(!record||typeof record!=='object'||Array.isArray(record)||
     Object.keys(record).length!==keys.length||
     Object.keys(record).some(k=>!keys.includes(k))||
     record.policy!==POLICY||record.schemaVersion!==2||
     record.projectId!==owner.projectId||record.ownerId!==owner.ownerId||
     record.rowId!==c.rowId||record.collection!==collection||
     record.domain!==V2_OWNER_DOMAIN[collection]||
     !record.published||Object.keys(record.published).length!==0)denied();
  const routing=routedFields(collection,record.routing,owner.ownerId);
  const secret=await decryptPrivateRecord(root,{...c,publicRouting:aad(routing)},record.envelope);
  const classes:Record<string,string>=ownerPrivacyFields[collection];
  for(const key of Object.keys(secret))if(classes[key]!=='encrypted')denied();
  const document={...routing,...secret};
  sourceFields(collection,document,owner.ownerId);
  return document;
  }finally{pinned.key.fill(0);}
}

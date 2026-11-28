/**
 * READ-ONLY compatibility decoder for original six-domain v1 owner ciphertext.
 * Necessary because the current-dev v2 privacy field manifest intentionally
 * hides fields formerly disclosed by the isolated v1 Scratch routing policy.
 * Never called by sync, import or an owner write path.
 */
import {type Bytes,type Owner,type RecordEnvelope,decryptPrivateRecord} from './coreCrypto';
import type {PrivatePayloadDomain} from './domainRegistry';

export const OWNER_V1_SCRATCH_PROJECT='6b00671500279e901846';
export const OWNER_V1_COLLECTIONS=['tasks','categories','diary','bucketList',
  'bucketTaskLinks','settings'] as const;
export type OwnerV1Collection=(typeof OWNER_V1_COLLECTIONS)[number];
const DOMAINS:Readonly<Record<OwnerV1Collection,PrivatePayloadDomain>>={
  tasks:'task',categories:'category',diary:'diary',bucketList:'bucket-list',
  bucketTaskLinks:'bucket-task-link',settings:'settings-private',
};
const ROUTING:Readonly<Record<OwnerV1Collection,readonly string[]>>={
  tasks:['userId','date','createdAt','updatedAt','isDeleted','reminderTime','visibility'],
  categories:['userId','isDeleted','visibility','updatedAt'],
  diary:['userId','date','createdAt','updatedAt','isDeleted','visibility'],
  bucketList:['userId','createdAt','updatedAt','isDeleted'],
  bucketTaskLinks:['userId','createdAt','updatedAt','isDeleted'],
  settings:['userId','updatedAt','isDeleted'],
};
const ID=/^p_[a-f0-9]{32}$/;
const KID=/^k_[a-f0-9]{32}$/;
const REV=/^r_[a-f0-9]{32}$/;
type Scalar=string|boolean|number|null;
export type OwnerV1Record=Readonly<{
  projectId:string;ownerId:string;rowId:string;collection:OwnerV1Collection;
  domain:PrivatePayloadDomain;routing:Record<string,Scalar>;
  published:Readonly<Record<string,never>>;
  envelope:RecordEnvelope;
  deleted?:boolean;updatedAt?:string;
}>;
function invalid():never {throw new Error('Historical v1 owner ciphertext is invalid or unavailable.');}
function collection(v:unknown):v is OwnerV1Collection {
  return typeof v==='string'&&(OWNER_V1_COLLECTIONS as readonly string[]).includes(v);
}
function strictKeys(x:Record<string,unknown>,keys:readonly string[]):boolean {
  return Object.keys(x).length===keys.length&&
    Object.keys(x).every(k=>keys.includes(k));
}
function routingFor(c:OwnerV1Collection,value:unknown,ownerId:string):
  Record<string,Scalar> {
  if(!value||typeof value!=='object'||Array.isArray(value)||
     !(Object.getPrototypeOf(value)===Object.prototype||
       Object.getPrototypeOf(value)===null))invalid();
  const output:Record<string,Scalar>=Object.create(null);
  const list=ROUTING[c];
  for(const [key,entry] of Object.entries(value)){
    if(!list.includes(key)||!(entry===null||typeof entry==='boolean'||
       typeof entry==='number'&&Number.isSafeInteger(entry)||
       typeof entry==='string'&&new TextEncoder().encode(entry).length<=512))
      invalid();
    output[key]=entry as Scalar;
  }
  if(output.userId!==ownerId||typeof output.isDeleted!=='boolean'||
     new TextEncoder().encode(JSON.stringify(output)).length>4096)invalid();
  if(['tasks','categories','diary'].includes(c)&&output.visibility!=='private')invalid();
  return output;
}
/**
 * The original v1 AAD includes the original disclosed routing map verbatim,
 * not any v2 policy/manifest. Never use this decoder to write or re-encrypt v1.
 */
export async function readVerifiedScratchOwnerV1(
  root:Bytes,owner:Owner,record:OwnerV1Record,
):Promise<Record<string,unknown>> {
  if(!owner||owner.projectId!==OWNER_V1_SCRATCH_PROJECT||!owner.ownerId||
     !record||typeof record!=='object'||Array.isArray(record)||
     !collection(record.collection)||record.projectId!==owner.projectId||
     record.ownerId!==owner.ownerId||
     !ID.test(record.rowId)||record.domain!==DOMAINS[record.collection]||
     !record.published||Object.keys(record.published).length!==0||
     !record.envelope||!KID.test(record.envelope.kid)||
     !REV.test(record.envelope.revision))invalid();
  const keys=['projectId','ownerId','rowId','collection','domain',
    'routing','published','envelope'];
  const asObject=record as unknown as Record<string,unknown>;
  const fromServer=('deleted' in record)||('updatedAt' in record);
  if(!strictKeys(asObject,fromServer?[...keys,'deleted','updatedAt']:keys))invalid();
  const routing=routingFor(record.collection,record.routing,owner.ownerId);
  if(fromServer && (record.deleted!==routing.isDeleted||
     typeof record.updatedAt!=='string'||
     !Number.isFinite(Date.parse(record.updatedAt))))invalid();
  const content=await decryptPrivateRecord(root,{
    projectId:owner.projectId,ownerId:owner.ownerId,
    payloadDomain:record.domain,rowId:record.rowId,
    keyId:record.envelope.kid,revision:record.envelope.revision,
    publicRouting:routing,
  },record.envelope);
  if(Object.keys(content).some(k=>Object.hasOwn(routing,k))||
     typeof content.id!=='string'||content.id.length===0)invalid();
  return {...routing,...content};
}

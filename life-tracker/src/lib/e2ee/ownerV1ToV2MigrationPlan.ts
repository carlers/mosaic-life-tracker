/**
 * Synthetic-only v1 -> v2 locally authenticated migration plan.
 * Produces a ciphertext intent, never uploads, restores or clears v1 data.
 * Caller MUST durably persist the exact intent before any future network PUT.
 */
import {
  type Bytes,type Owner,deriveMigratedOwnerRowId,generateRevision,
  generateOperationId,
} from './coreCrypto';
import {
  type OwnerV1Record,readVerifiedScratchOwnerV1,
} from './ownerLegacyV1Readback';
import {
  type V2OwnerRecord,type OwnerV2Collection,V2_OWNER_DOMAIN,
  sealV2PrivateOwnerDocument,openV2PrivateOwnerDocument,
} from './ownerPrivateV2Contract';

export type PreparedV1ToV2=Readonly<{
  projectId:string;ownerId:string;collection:OwnerV2Collection;
  rowId:string;expectedRevision:null;expectedGeneration:number;opId:string;
  record:V2OwnerRecord;
}>;
function blocked():never{throw new Error('Historical v1-v2 migration proof is incomplete.');}
function sortJson(value:unknown,depth=0):string {
  if(depth>28)blocked();
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(v=>sortJson(v,depth+1)).join(',')+']';
  if(typeof value==='object'&&value&&
     (Object.getPrototypeOf(value)===Object.prototype||
      Object.getPrototypeOf(value)===null)) {
    const data=value as Record<string,unknown>;
    const keys=Object.keys(data).sort();
    if(keys.length>200)blocked();
    return '{'+keys.map(k=>{
      if(['__proto__','constructor','prototype'].includes(k))blocked();
      return JSON.stringify(k)+':'+sortJson(data[k],depth+1);
    }).join(',')+'}';
  }
  return blocked();
}
function context(owner:Owner,plan:PreparedV1ToV2){
  return {
    ...owner,payloadDomain:V2_OWNER_DOMAIN[plan.collection],
    rowId:plan.rowId,keyId:plan.record.envelope.kid,
    revision:plan.record.envelope.revision,
  };
}
function checkPlan(owner:Owner,plan:PreparedV1ToV2):void {
  if(!plan||plan.projectId!==owner.projectId||plan.ownerId!==owner.ownerId||
     plan.collection!==plan.record?.collection||
     plan.rowId!==plan.record.rowId||
     plan.expectedRevision!==null||
     !Number.isSafeInteger(plan.expectedGeneration)||
     plan.expectedGeneration<1||plan.expectedGeneration>2147483647||
     !/^o_[a-f0-9]{32}$/.test(plan.opId))blocked();
}
/**
 * V1 source is authenticated under its original AAD before target creation.
 * The same owner-root and source original ID deterministically derive an opaque
 * row ID, but a new random revision/operation MUST NOT replace a pending intent.
 */
export async function prepareScratchOwnerV1ToV2(
  root:Bytes,owner:Owner,legacy:OwnerV1Record,expectedGeneration:number,
):Promise<PreparedV1ToV2> {
  if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<1||
     expectedGeneration>2147483647)blocked();
  const collection=legacy.collection as OwnerV2Collection;
  if(!Object.hasOwn(V2_OWNER_DOMAIN,collection))blocked();
  const plaintext=await readVerifiedScratchOwnerV1(root,owner,legacy);
  if(typeof plaintext.id!=='string'||!plaintext.id)blocked();
  const rowId=await deriveMigratedOwnerRowId(root,owner,
    V2_OWNER_DOMAIN[collection],plaintext.id);
  const c={...owner,rowId,payloadDomain:V2_OWNER_DOMAIN[collection],
    keyId:legacy.envelope.kid,revision:generateRevision()};
  const record=await sealV2PrivateOwnerDocument(root,owner,c,collection,plaintext);
  const recovered=await openV2PrivateOwnerDocument(root,owner,c,collection,record);
  if(sortJson(recovered)!==sortJson(plaintext))blocked();
  const plan:PreparedV1ToV2={
    projectId:owner.projectId,ownerId:owner.ownerId,
    collection,rowId,expectedRevision:null,expectedGeneration,
    opId:generateOperationId(),record,
  };
  checkPlan(owner,plan);
  return plan;
}
/**
 * Independently re-authenticates legacy input and readback ciphertext.
 * Not proof that a Function/row ACL accepted a write; no backend calls occur.
 */
export async function verifyScratchOwnerV1ToV2(
  root:Bytes,owner:Owner,legacy:OwnerV1Record,
  prepared:PreparedV1ToV2,remote:V2OwnerRecord,
):Promise<void>{
  checkPlan(owner,prepared);
  if(remote.rowId!==prepared.rowId||
     remote.collection!==prepared.collection||
     remote.envelope.revision!==prepared.record.envelope.revision||
     remote.envelope.kid!==prepared.record.envelope.kid)blocked();
  const original=await readVerifiedScratchOwnerV1(root,owner,legacy);
  const expected=await deriveMigratedOwnerRowId(root,owner,
    V2_OWNER_DOMAIN[prepared.collection],original.id as string);
  if(expected!==prepared.rowId)blocked();
  const readback=await openV2PrivateOwnerDocument(root,owner,context(owner,prepared),
    prepared.collection,remote);
  if(sortJson(original)!==sortJson(readback))blocked();
}

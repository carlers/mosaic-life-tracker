/**
 * Dormant current-origin only: produce and durably stage a raw owner record's
 * owner-v2 migration plan. Never uploads, replays, acknowledges, deletes or
 * modifies source records. No account/root readiness proof is implied.
 */
import {type Bytes,type Owner} from './coreCrypto';
import {
  type OwnerV2Collection,V2_OWNER_DOMAIN,openV2PrivateOwnerDocument,
} from './ownerPrivateV2Contract';
import type {PreparedV1ToV2} from './ownerV1ToV2MigrationPlan';
import {prepareScratchRawOwnerToV2} from './ownerRawV2MigrationPlan';
import {
  stageV2OwnerMigrationIntent,readV2OwnerMigrationIntent,
} from './ownerV2PendingIntentStore';
type Durable=Readonly<{plan:PreparedV1ToV2;state:'stored'|'reused'}>;

function denied():never{
  throw new Error('Encrypted owner migration retry conflicts with pending local intent.');
}
function canonical(value:unknown,depth=0):string{
  if(depth>24)denied();
  if(value===null||typeof value==='boolean'||typeof value==='string')
    return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))
    return JSON.stringify(value);
  if(Array.isArray(value)){
    if(value.length>3000)denied();
    return '['+value.map(x=>canonical(x,depth+1)).join(',')+']';
  }
  if(value&&typeof value==='object'&&
    (Object.getPrototypeOf(value)===Object.prototype||
      Object.getPrototypeOf(value)===null)){
    const data=value as Record<string,unknown>,keys=Object.keys(data).sort();
    if(keys.length>200)denied();
    return '{'+keys.map(k=>{
      if(['__proto__','constructor','prototype'].includes(k))denied();
      return JSON.stringify(k)+':'+canonical(data[k],depth+1);
    }).join(',')+'}';
  }
  return denied();
}
async function open(root:Bytes,owner:Owner,plan:PreparedV1ToV2){
  return openV2PrivateOwnerDocument(root,owner,{
    ...owner,payloadDomain:V2_OWNER_DOMAIN[plan.collection],
    rowId:plan.rowId,keyId:plan.record.envelope.kid,
    revision:plan.record.envelope.revision,
  },plan.collection,plan.record);
}
/**
 * Read-only comparison for a previously authenticated, durable pending plan
 * and a fresh randomized proposal from the same saved source row. The caller
 * MUST check all prior rows before writing any new rescue plans. Not a remote
 * CAS/readback, multi-tab snapshot or trusted account epoch.
 */
export async function assertCompatibleScratchRawOwnerV2Intent(
  root:Bytes,owner:Owner,prior:PreparedV1ToV2,fresh:PreparedV1ToV2,
):Promise<void>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     !prior||!fresh||prior.projectId!==owner.projectId||
     prior.ownerId!==owner.ownerId||fresh.projectId!==owner.projectId||
     fresh.ownerId!==owner.ownerId||
     prior.collection!==fresh.collection||prior.rowId!==fresh.rowId||
     prior.expectedRevision!==null||fresh.expectedRevision!==null||
     prior.expectedGeneration!==fresh.expectedGeneration||
     prior.record?.envelope?.kid!==fresh.record?.envelope?.kid)denied();
  const key=root.slice(),scope:Owner={
    projectId:owner.projectId,ownerId:owner.ownerId,
  };
  const [oldDoc,newDoc]=await Promise.all([
    open(key,scope,prior),open(key,scope,fresh),
  ]);
  if(canonical(oldDoc)!==canonical(newDoc))denied();
}

/**
 * New and repeat calls may produce separate *ephemeral* random plans, but the
 * only plan returned to a future sender is the original authenticated plan
 * that survived a committed local IndexedDB transaction. Existing ciphertext
 * cannot be replaced when the source document changes after first staging.
 */
export async function prepareAndStageScratchRawOwnerV2(
  root:Bytes,owner:Owner,collection:OwnerV2Collection,
  raw:Record<string,unknown>,keyId:string,expectedGeneration:number,
):Promise<Durable>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner)denied();
  const key=root.slice();
  const scope:Owner={projectId:owner.projectId,ownerId:owner.ownerId};
  let snapshot:Record<string,unknown>;
  try{snapshot=structuredClone(raw);}catch{return denied();}
  const fresh=await prepareScratchRawOwnerToV2(key,scope,collection,
    snapshot,keyId,expectedGeneration);
  try{
    await stageV2OwnerMigrationIntent(key,scope,fresh);
    return {plan:fresh,state:'stored'};
  }catch(error){
    // The first write may have won on another tab. Do not regenerate a
    // competing opId/revision to overwrite it. Readback reauthenticates
    // local full-plan HMAC, ciphertext and scoped IndexedDB primary key.
    let prior:PreparedV1ToV2|null;
    try{prior=await readV2OwnerMigrationIntent(key,scope,fresh.rowId);}
    catch{throw error;}
    if(!prior)throw error;
    await assertCompatibleScratchRawOwnerV2Intent(key,scope,prior,fresh);
    return {plan:prior,state:'reused'};
  }
}

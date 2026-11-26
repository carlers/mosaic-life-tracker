/**
 * Dormant read-only imported rescue -> local-only E2EE v2 ciphertext staging.
 * Must NEVER treat a subset as a successful account migration. In particular,
 * chat/sharing, pending actions and media remain unported and block ALL staging.
 * No Appwrite calls, deletion, ack, source-file edits, or writer-floor changes.
 */
import {type Bytes,type Owner,deriveMigratedOwnerRowId} from './coreCrypto';
import {
  OWNER_V2_COLLECTIONS,V2_OWNER_DOMAIN,
  SCRATCH_OWNER_V2_PROJECT,type OwnerV2Collection,
} from './ownerPrivateV2Contract';
import {unpackVerifiedOwnerLocalRescueFile,type UnpackedOwnerLocalRescue} from './ownerLocalRescueBundle';
import {type PreparedV1ToV2} from './ownerV1ToV2MigrationPlan';
import {prepareScratchRawOwnerToV2} from './ownerRawV2MigrationPlan';
import {prepareAndStageScratchRawOwnerV2} from './ownerRawV2DurableIntent';
import {listV2OwnerMigrationIntents} from './ownerV2PendingIntentStore';

const MAX_OWNER_ROWS=500;
const KEY=/^k_[a-f0-9]{32}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
function blocked():never{
  throw new Error('Incomplete encrypted rescue migration; local data unchanged.');
}
export type StagedRescueOwnerV2=Readonly<{
  plans:readonly PreparedV1ToV2[];
  stored:number;
  reused:number;
}>;
/**
 * The caller has already read and fully authenticated a saved rescue file,
 * and independently verified the currently unlocked account/root generation.
 * This function cannot prove either of those prerequisites by itself.
 */
async function stageVerifiedScratchRescueOwnerV2(
  root:Bytes,owner:Owner,unpacked:UnpackedOwnerLocalRescue,
  keyId:string,generation:number,
):Promise<StagedRescueOwnerV2>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||!OWNER.test(owner.ownerId)||
     !KEY.test(keyId)||!Number.isSafeInteger(generation)||
     generation<1||generation>2147483647||!unpacked||
     !Array.isArray(unpacked.rows)||!Array.isArray(unpacked.media)||
     !Array.isArray(unpacked.pending)||
     unpacked.rows.length>MAX_OWNER_ROWS||
     unpacked.media.length!==0||unpacked.pending.length!==0)blocked();
  const key=root.slice();
  const scope:Owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const ids=new Set<string>(),entries:{
    collection:OwnerV2Collection;raw:Record<string,unknown>;rowId:string;
  }[]=[];
  for(const item of unpacked.rows){
    if(!item||typeof item!=='object'||
       !(OWNER_V2_COLLECTIONS as readonly string[]).includes(item.collection)||
       !item.document||typeof item.document!=='object'||
       Array.isArray(item.document))blocked(); // includes friendships/chat
    const collection=item.collection as OwnerV2Collection;
    const raw={...item.document};
    // Check the full input before any IndexedDB write. The detailed codec
    // performs strict manifest and internal tombstone validation below.
    const sourceId=raw.id;
    if(typeof sourceId!=='string'||!sourceId)blocked();
    const opaque=await deriveMigratedOwnerRowId(
      key,scope,V2_OWNER_DOMAIN[collection],sourceId);
    if(ids.has(opaque))blocked();
    ids.add(opaque);
    entries.push({collection,raw,rowId:opaque});
  }
  // A previously staged row absent from this saved bundle might represent
  // unsent data. Never silently pretend that this file supersedes it.
  let existing:readonly PreparedV1ToV2[];
  try{existing=await listV2OwnerMigrationIntents(key,scope);}
  catch(error){
    // A completely fresh owner may not have an initialized local queue.
    // A corrupt/unavailable store must not be treated as empty. The
    // dedicated store's absent-database error is distinguishable.
    if(!(error instanceof Error)||
       !error.message.includes('No initialized encrypted migration intent store.'))
      throw error;
    existing=[];
  }
  if(existing.length>entries.length||
     existing.some(plan=>!ids.has(plan.rowId)))blocked();
  // Preflight ALL domains and their plaintext classifications before creating
  // the first pending intent; one malformed record rejects the entire input.
  await Promise.all(entries.map(entry=>
    prepareScratchRawOwnerToV2(
      key,scope,entry.collection,entry.raw,keyId,generation)));
  const plans:PreparedV1ToV2[]=[];
  let stored=0,reused=0;
  for(const entry of entries){
    // This call always returns persisted/re-authenticated ORIGINAL intent,
    // never a freshly randomized competing retry.
    const result=await prepareAndStageScratchRawOwnerV2(
      key,scope,entry.collection,entry.raw,keyId,generation);
    if(result.plan.rowId!==entry.rowId)blocked();
    plans.push(result.plan);
    if(result.state==='stored')stored++;
    else reused++;
  }
  const verified=await listV2OwnerMigrationIntents(key,scope);
  if(verified.length!==entries.length||
     verified.some(plan=>!ids.has(plan.rowId))||
     plans.some(plan=>!verified.some(x=>
       x.rowId===plan.rowId&&JSON.stringify(x)===JSON.stringify(plan))))blocked();
  return {plans,stored,reused};
}

/**
 * The ONLY exported rescue-to-v2 staging entry point. Authenticate the actual
 * saved encrypted bytes and decrypt all protected sections before any local
 * intent writes; a caller-provided plaintext object is never trusted as proof
 * of having passed the saved-file AEAD and manifest checks.
 *
 * Root epoch/current-session authority still needs independent verification.
 * No live server writes, queue replay, writer floor or migration commit.
 */
export async function stageAuthenticatedScratchRescueFileV2(
  root:Bytes,owner:Owner,file:Pick<Blob,'size'|'text'>,
  keyId:string,generation:number,
):Promise<StagedRescueOwnerV2>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||!OWNER.test(owner.ownerId)||
     !KEY.test(keyId)||!Number.isSafeInteger(generation)||
     generation<1||generation>2147483647)blocked();
  const key=root.slice(),scope:Owner={
    projectId:owner.projectId,ownerId:owner.ownerId,
  };
  const unpacked=await unpackVerifiedOwnerLocalRescueFile(scope,key,file);
  return stageVerifiedScratchRescueOwnerV2(key,scope,unpacked,keyId,generation);
}

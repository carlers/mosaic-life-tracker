/**
 * Dormant read-only imported rescue -> local-only E2EE v2 ciphertext staging.
 * Must NEVER treat a subset as a successful account migration. In particular,
 * social/chat pending actions block staging; the legacy row-only entry point
 * additionally rejects media. A separate explicit local-only mixed photo
 * route verifies original pre-staged ciphertext before staging owner rows.
 * No Appwrite calls, deletion, ack, source-file edits, or writer-floor changes.
 */
import {type Bytes,type Owner,deriveMigratedOwnerRowId} from './coreCrypto';
import {
  OWNER_V2_COLLECTIONS,V2_OWNER_DOMAIN,
  SCRATCH_OWNER_V2_PROJECT,type OwnerV2Collection,
} from './ownerPrivateV2Contract';
import {
  unpackVerifiedOwnerLocalRescueFile,readVerifiedSealedMediaFromRescueFile,
  type UnpackedOwnerLocalRescue,
} from './ownerLocalRescueBundle';
import {readStagedOwnerEncryptedMedia} from './ownerSavedMediaIntentStore';
import {type PreparedV1ToV2} from './ownerV1ToV2MigrationPlan';
import {prepareScratchRawOwnerToV2} from './ownerRawV2MigrationPlan';
import {assertCompatibleScratchRawOwnerV2Intent} from './ownerRawV2DurableIntent';
import {
  listV2OwnerMigrationIntents,stageV2OwnerMigrationIntentsAtomic,
} from './ownerV2PendingIntentStore';

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
  keyId:string,generation:number,allowAlreadyVerifiedMedia=false,
):Promise<StagedRescueOwnerV2>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||!OWNER.test(owner.ownerId)||
     !KEY.test(keyId)||!Number.isSafeInteger(generation)||
     generation<1||generation>2147483647||!unpacked||
     !Array.isArray(unpacked.rows)||!Array.isArray(unpacked.media)||
     !Array.isArray(unpacked.pending)||
     unpacked.rows.length>MAX_OWNER_ROWS||
     (!allowAlreadyVerifiedMedia&&unpacked.media.length!==0)||unpacked.pending.length!==0)blocked();
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
  const prepared=await Promise.all(entries.map(entry=>
    prepareScratchRawOwnerToV2(
      key,scope,entry.collection,entry.raw,keyId,generation)));
  // A source changed after its first local staging is a conflict, even if
  // this rescued file also contains new rows. Reauthenticate/compare ALL
  // previously staged ciphertext before creating a single new intent.
  const proposals=new Map(prepared.map(plan=>[plan.rowId,plan]));
  for(const prior of existing){
    const fresh=proposals.get(prior.rowId);
    if(!fresh)blocked();
    await assertCompatibleScratchRawOwnerV2Intent(key,scope,prior,fresh);
  }
  // One owner-scoped IndexedDB readwrite transaction. A raced tab, quota
  // failure or changed pending record aborts the WHOLE new rescue batch,
  // preserving every pre-existing pending ciphertext exactly.
  const result=await stageV2OwnerMigrationIntentsAtomic(
    key,scope,prepared,existing);
  if(result.plans.length!==entries.length||
     result.plans.some((plan,i)=>plan.rowId!==entries[i].rowId||
       !ids.has(plan.rowId)))blocked();
  return result;
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

/**
 * Additional dormant mixed owner-row/photo staging path.
 *
 * Photos MUST first be staged from the same user-selected, authenticated
 * saved File, with original ciphertext and IDs. We compare every staged
 * ciphertext against the File both before and after the row transaction.
 * These are TWO independent IndexedDB databases, NOT a cross-store atomic
 * transaction: any failure leaves the saved File + existing local intents
 * intact and requires retry. No ACK, server I/O, migration completion.
 */
async function assertStagedMediaMatchesSavedFile(
  root:Bytes,owner:Owner,file:Pick<Blob,'size'|'text'>,
):Promise<number>{
  const originals=await readVerifiedSealedMediaFromRescueFile(owner,root,file);
  const staged=await readStagedOwnerEncryptedMedia(root,owner);
  if(originals.length===0||originals.length!==staged.length)blocked();
  const seen=new Set<string>();
  const stored=new Map(staged.map(item=>[item.encrypted.rowId,item.encrypted]));
  if(stored.size!==staged.length)blocked();
  for(const original of originals){
    if(seen.has(original.rowId))blocked();
    seen.add(original.rowId);
    const matched=stored.get(original.rowId);
    if(!matched||original.keyId!==matched.keyId||
       original.revision!==matched.revision||
       JSON.stringify(original.sealedMetadata)!==JSON.stringify(matched.sealedMetadata)||
       JSON.stringify(original.sealedMedia.manifest)!==
         JSON.stringify(matched.sealedMedia.manifest))blocked();
    const a=new Uint8Array(await original.sealedMedia.ciphertext.arrayBuffer());
    const b=new Uint8Array(await matched.sealedMedia.ciphertext.arrayBuffer());
    if(a.length!==b.length||a.some((v,i)=>v!==b[i]))blocked();
  }
  return originals.length;
}

/** A separate explicit entry that requires *already verified* original
 * encrypted media in its durable queue; ordinary row-only staging still
 * categorically rejects saved Files containing media. Never use this as
 * proof of atomic whole-account migration or remote delivery.
 */
export async function stageAuthenticatedScratchRescueFileV2WithVerifiedMedia(
  root:Bytes,owner:Owner,file:Pick<Blob,'size'|'text'>,
  keyId:string,generation:number,
):Promise<StagedRescueOwnerV2>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     typeof keyId!=='string'||!KEY.test(keyId)||
     !Number.isSafeInteger(generation)||generation<1||generation>2147483647)
    blocked();
  const key=root.slice(),scope:Owner={
    projectId:owner.projectId,ownerId:owner.ownerId,
  };
  const unpacked=await unpackVerifiedOwnerLocalRescueFile(scope,key,file);
  // No silent disappearance of legacy pending social/chat actions; there
  // must also be at least one row and one photo for this explicit mixed mode.
  if(unpacked.pending.length!==0||unpacked.rows.length===0||
     unpacked.media.length===0)blocked();
  if(await assertStagedMediaMatchesSavedFile(key,scope,file)!==unpacked.media.length)
    blocked();
  const rows=await stageVerifiedScratchRescueOwnerV2(
    key,scope,unpacked,keyId,generation,true);
  if(await assertStagedMediaMatchesSavedFile(key,scope,file)!==unpacked.media.length)
    blocked();
  return rows;
}

/**
 * Dormant Scratch-only entry points for the real current-origin RxDB rescue
 * sequence. Normal sync / login / startup never imports this module.
 *
 * 1. Read ALL 10 local owner collections directly from RxDB 17 storage,
 *    including _deleted:true internal tombstones and orphan link records.
 * 2. Capture actual pending image IndexedDB + social localStorage outbox,
 *    seal a full root-authenticated rescue file, recheck live source.
 * 3. Require explicit external File re-selection and a current owner/MFA/root
 *    gate before atomic local owner-v2 staging.
 *
 * No network, backend, file auto-save, delete, local-to-live sync, ACK or
 * old installed PWA/origin access. A saved File is still essential to DR.
 */
import type {RxDatabase} from 'rxdb';
import type {Bytes,Owner} from './coreCrypto';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';
import {
  type OwnerLocalReader,type OwnerLocalGate,LOCAL_OWNER_COLLECTIONS,
} from './ownerOfflineRowSnapshot';
import {
  buildOwnerLocalRescueFile,OWNER_LOCAL_RESCUE_FILENAME,
  type OwnerLocalRescueResult,
} from './ownerLocalRescueBundle';
import {indexedDbPendingImageSource} from './ownerPendingImageRescue';
import {readOwnerRawStorageRows} from './ownerRawStorageRead';
import {
  stageAuthenticatedScratchRescueFileV2,
  stageAuthenticatedScratchRescueFileV2WithVerifiedMedia,
  type StagedRescueOwnerV2,
} from './ownerRescueV2Staging';
import {verifyOwnerLocalRescueFile} from './ownerLocalRescueBundle';
import {stageSelectedSavedOwnerEncryptedMedia} from './ownerSavedMediaIntentStore';
import type {AppDatabaseCollections} from '../../db/database';

const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const KID=/^k_[a-f0-9]{32}$/;
function fail():never{
  throw new Error('Scratch current-origin encrypted rescue incomplete; no cutover.');
}
function assertOwner(root:Bytes,owner:Owner,keyId:string){
  if(!(root instanceof Uint8Array)||root.byteLength!==32||!owner||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof keyId!=='string'||!KID.test(keyId))fail();
}

/** Bound to a real storageInstance, never RxCollection.find() or exportData. */
export function ownerRescueReaderFromRxDb(
  database:RxDatabase<AppDatabaseCollections>,
):OwnerLocalReader {
  if(!database)fail();
  const collections=Object.fromEntries(LOCAL_OWNER_COLLECTIONS.map(name=>{
    const collection=database[name];
    if(!collection?.storageInstance)fail();
    return [name,collection.storageInstance];
  })) as Record<(typeof LOCAL_OWNER_COLLECTIONS)[number],unknown>;
  return {
    async readAll(name,userId){
      if(!(LOCAL_OWNER_COLLECTIONS as readonly string[]).includes(name))fail();
      const storage=collections[name];
      if(!storage)fail();
      return readOwnerRawStorageRows(
        storage as Parameters<typeof readOwnerRawStorageRows>[0],userId);
    },
  };
}

/**
 * Capture from the CURRENT actual RxDB + IndexedDB + localStorage on this
 * origin. No synthetic missing-source defaults. The optional DB exists solely
 * to support separate synthetic RxDB browser fixtures, and is still queried
 * through the exact same real raw storage adapter.
 *
 * This returns an in-memory Blob, NOT proof the user downloaded it. Caller
 * must save it and reselect the complete encrypted file before staging.
 */
export async function buildScratchCurrentOriginRescueFile(
  root:Bytes,owner:Owner,keyId:string,gate:OwnerLocalGate,
  database?:RxDatabase<AppDatabaseCollections>,
):Promise<OwnerLocalRescueResult>{
  assertOwner(root,owner,keyId);
  if(typeof gate?.assertReady!=='function'||
     typeof indexedDB==='undefined'||typeof localStorage==='undefined')fail();
  const key=root.slice(),scope:Owner={
    projectId:owner.projectId,ownerId:owner.ownerId,
  };
  await gate.assertReady(scope);
  const live=database??(await import('../../db/database')).getDatabase();
  return buildOwnerLocalRescueFile(scope,key,keyId,gate,{
    rows:ownerRescueReaderFromRxDb(live),
    images:indexedDbPendingImageSource,
    queues:localStorage,
  });
}

/**
 * Only a deliberately selected File goes into the authenticated, local-only
 * atomic staging. This does NOT prove the saved file is held off-device, nor
 * establish a global cross-tab snapshot, server CAS or old PWA writer cutoff.
 */
export async function stageSelectedScratchOwnerRescueFile(
  root:Bytes,owner:Owner,selected:File,keyId:string,generation:number,
  gate:OwnerLocalGate,
):Promise<StagedRescueOwnerV2>{
  assertOwner(root,owner,keyId);
  if(typeof File==='undefined'||!(selected instanceof File)||
     selected.name!==OWNER_LOCAL_RESCUE_FILENAME||
     !Number.isSafeInteger(selected.size)||selected.size<1||
     typeof gate?.assertReady!=='function')fail();
  const scope:Owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const key=root.slice();
  await gate.assertReady(scope);
  const staged=await stageAuthenticatedScratchRescueFileV2(
    key,scope,selected,keyId,generation);
  await gate.assertReady(scope);
  return staged;
}

/**
 * Local-only combined sealed-file replay for owner rows AND photos.
 * Pending social/chat action capsules must be EMPTY, checked before any
 * IndexedDB write. Photo intents are staged first; then row intents.
 *
 * The two stores are independently atomic, NOT jointly atomic. A failure
 * between them must retain the exact original downloaded File, existing
 * pending ciphertext and unsent actions for an explicit idempotent retry.
 * Never delete, ACK, enable network sync or mark account migration complete.
 */
export async function stageSelectedScratchOwnerRescueFileWithMedia(
  root:Bytes,owner:Owner,selected:File,keyId:string,generation:number,
  gate:OwnerLocalGate,
):Promise<Readonly<{
  status:'local-mixed-ciphertext-staged-not-cutover';
  rows:number;photos:number;rowStored:number;rowReused:number;
  photoStored:number;photoReused:number;
}>>{
  assertOwner(root,owner,keyId);
  if(typeof File==='undefined'||!(selected instanceof File)||
     selected.name!==OWNER_LOCAL_RESCUE_FILENAME||
     !Number.isSafeInteger(selected.size)||selected.size<1||
     !Number.isSafeInteger(generation)||generation<1||
     generation>2147483647||typeof gate?.assertReady!=='function')fail();
  const scope:Owner={projectId:owner.projectId,ownerId:owner.ownerId};
  const key=root.slice();
  await gate.assertReady(scope);
  const counts=await verifyOwnerLocalRescueFile(scope,key,selected);
  if(counts.pending!==0||counts.rows<1||counts.media<1)fail();
  await gate.assertReady(scope);
  // Only ORIGINAL saved-file ciphertext; IDB first-write-wins.
  const photos=await stageSelectedSavedOwnerEncryptedMedia(
    key,scope,selected,keyId,gate);
  await gate.assertReady(scope);
  const rows=await stageAuthenticatedScratchRescueFileV2WithVerifiedMedia(
    key,scope,selected,keyId,generation);
  if(rows.plans.length!==counts.rows||photos.total!==counts.media)fail();
  await gate.assertReady(scope);
  return {
    status:'local-mixed-ciphertext-staged-not-cutover',
    rows:rows.plans.length,photos:photos.total,
    rowStored:rows.stored,rowReused:rows.reused,
    photoStored:photos.stored,photoReused:photos.reused,
  };
}

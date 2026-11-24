/**
 * Fixed disposable six-domain fixture used only by the isolated Scratch M2 UI.
 * It is never a snapshot of the user's actual RxDB, nor a migration permission.
 * Stable local IDs/timestamps make interrupted shadow encryption resumable:
 * unlike random canaries, a second run can AEAD-verify identical remote rows.
 */
import type { Owner } from './coreCrypto';
import { OWNER_ONLY_COLLECTIONS, type OwnerOnlyCollection } from './ownerCiphertextTransport';
import { syntheticDoc } from './m2SyntheticRecord';
import type { OwnerMigrationSource } from './ownerShadowMigration';

const PROJECT='6b00671500279e901846';
const STAMP='2026-11-25T00:00:00.000Z';
const DAY='2026-11-25';
const IDs: Record<OwnerOnlyCollection,string> = {
  tasks:'m2batch_task_one',
  categories:'m2batch_category_one',
  diary:'m2batch_diary_one',
  bucketList:'m2batch_bucket_one',
  bucketTaskLinks:'m2batch_link_one',
  settings:'m2batch_setting_one',
};
const VALUES:Record<OwnerOnlyCollection,string> = {
  tasks:'Synthetic private migration task',
  categories:'Synthetic private migration category',
  diary:'Synthetic private migration diary',
  bucketList:'Synthetic private migration bucket',
  bucketTaskLinks:'',
  settings:'Synthetic private migration setting',
};

export function buildSyntheticOwnerMigrationSource(owner:Owner):OwnerMigrationSource {
  if(owner?.projectId!==PROJECT ||
     typeof owner.ownerId!=='string' ||
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(owner.ownerId)) {
    throw new Error('Synthetic Scratch migration environment unavailable.');
  }
  const collections={} as Record<OwnerOnlyCollection,readonly Record<string,unknown>[]>;
  for(const collection of OWNER_ONLY_COLLECTIONS) {
    const generated=syntheticDoc(owner.ownerId,collection,VALUES[collection],
      IDs.bucketList,IDs.tasks);
    const doc:Record<string,unknown>={
      ...generated,id:IDs[collection],updatedAt:STAMP,
    };
    if('createdAt' in generated)doc.createdAt=STAMP;
    if('date' in generated)doc.date=DAY;
    if(collection==='tasks')doc.categoryId=IDs.categories;
    collections[collection]=[doc];
  }
  // completeAndFresh refers exclusively to this explicitly frozen synthetic
  // six-domain fixture, NOT any actual owner's cached/remote data.
  return {owner,completeAndFresh:true,collections};
}

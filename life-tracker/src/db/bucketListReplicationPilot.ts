import type { BucketListDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot, type SimpleOwnerPullCheckpoint, type SimpleOwnerPushCheckpoint } from './simpleOwnerReplicationPilot';

export type BucketListReplicationCheckpoint = SimpleOwnerPullCheckpoint;
export type BucketListReplicationPushCheckpoint = SimpleOwnerPushCheckpoint;

const pilot = createSimpleOwnerReplicationPilot<BucketListDocument>({
  collectionName: 'bucketList',
  tableId: APPWRITE_TABLES.bucketList,
  casTableId: 'bucket_list_items',
  label: 'BucketList',
  freshnessLabel: 'bucketList',
  equalityFields: ["id","userId","title","description","achieved","achievedAt","createdAt","updatedAt","isDeleted"],
});

export const captureBucketListReplicationPushCheckpoint = pilot.capture;
export const isBucketListReplicationPilotActive = pilot.active;
export const resyncBucketListReplicationPilot = pilot.resync;
export const refreshBucketListReplicationPilot = pilot.refresh;
export const startBucketListReplicationPilot = pilot.start;
export const stopBucketListReplicationPilot = pilot.stop;
export const __bucketListReplicationPilotTestUtils = {
  pullBucketList: pilot.pull,
  pushBucketList: pilot.push,
};

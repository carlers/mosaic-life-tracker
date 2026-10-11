import type { BucketTaskLinkDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot } from './simpleOwnerReplicationPilot';

const pilot = createSimpleOwnerReplicationPilot<BucketTaskLinkDocument>({
  collectionName: 'bucketTaskLinks',
  tableId: APPWRITE_TABLES.bucketTaskLinks,
  casTableId: 'bucket_task_links',
  label: 'BucketTaskLinks',
  freshnessLabel: 'bucketTaskLinks',
  equalityFields: ['id','userId','bucketListId','taskId','createdAt','updatedAt','isDeleted'],
});
export const isBucketTaskLinksReplicationPilotActive = pilot.active;
export const resyncBucketTaskLinksReplicationPilot = pilot.resync;
export const refreshBucketTaskLinksReplicationPilot = pilot.refresh;
export const startBucketTaskLinksReplicationPilot = pilot.start;
export const stopBucketTaskLinksReplicationPilot = pilot.stop;
export const __bucketTaskLinksReplicationPilotTestUtils = { pull: pilot.pull, push: pilot.push };

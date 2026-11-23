import type { ActivityTaskLinkDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot } from './simpleOwnerReplicationPilot';

// Default-disabled until same-owner link CAS/preflight and erasure readiness.
const pilot = createSimpleOwnerReplicationPilot<ActivityTaskLinkDocument>({
  collectionName: 'activityTaskLinks',
  tableId: APPWRITE_TABLES.activityTaskLinks,
  casTableId: 'activity_task_links',
  label: 'ActivityTaskLinks',
  freshnessLabel: 'activityTaskLinks',
  equalityFields: ['id','userId','activityId','taskId','createdAt','updatedAt','isDeleted'],
});
export const isActivityTaskLinksReplicationPilotActive = pilot.active;
export const resyncActivityTaskLinksReplicationPilot = pilot.resync;
export const refreshActivityTaskLinksReplicationPilot = pilot.refresh;
export const startActivityTaskLinksReplicationPilot = pilot.start;
export const stopActivityTaskLinksReplicationPilot = pilot.stop;
export const __activityTaskLinksReplicationPilotTestUtils = { pull: pilot.pull, push: pilot.push };

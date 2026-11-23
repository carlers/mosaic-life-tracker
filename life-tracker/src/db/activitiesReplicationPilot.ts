import type { ActivityDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot } from './simpleOwnerReplicationPilot';

// Default-disabled until the backend source/Function/migration release is verified.
const pilot = createSimpleOwnerReplicationPilot<ActivityDocument>({
  collectionName: 'activities',
  tableId: APPWRITE_TABLES.activities,
  casTableId: 'activities',
  label: 'Activities',
  freshnessLabel: 'activities',
  equalityFields: ['id','userId','title','sport','localDate','completedAt',
    'distanceMeters','elapsedSeconds','source','fingerprint',
    'createdAt','updatedAt','isDeleted'],
});
export const isActivitiesReplicationPilotActive = pilot.active;
export const resyncActivitiesReplicationPilot = pilot.resync;
export const refreshActivitiesReplicationPilot = pilot.refresh;
export const startActivitiesReplicationPilot = pilot.start;
export const stopActivitiesReplicationPilot = pilot.stop;
export const __activitiesReplicationPilotTestUtils = { pull: pilot.pull, push: pilot.push };

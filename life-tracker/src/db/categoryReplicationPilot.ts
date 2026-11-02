import type { CategoryDocument } from './schema';
import { APPWRITE_TABLES } from '../lib/appwriteConfig';
import { createSimpleOwnerReplicationPilot, type SimpleOwnerPullCheckpoint, type SimpleOwnerPushCheckpoint } from './simpleOwnerReplicationPilot';

export type CategoryReplicationCheckpoint = SimpleOwnerPullCheckpoint;
export type CategoryReplicationPushCheckpoint = SimpleOwnerPushCheckpoint;

const pilot = createSimpleOwnerReplicationPilot<CategoryDocument>({
  collectionName: 'categories',
  tableId: APPWRITE_TABLES.categories,
  casTableId: 'categories',
  label: 'Category',
  freshnessLabel: 'category',
  equalityFields: ["id","userId","name","color","order","visibility","icon","retiredOn","updatedAt","isDeleted"],
});

export const captureCategoryReplicationPushCheckpoint = pilot.capture;
export const isCategoryReplicationPilotActive = pilot.active;
export const resyncCategoryReplicationPilot = pilot.resync;
export const refreshCategoryReplicationPilot = pilot.refresh;
export const startCategoryReplicationPilot = pilot.start;
export const stopCategoryReplicationPilot = pilot.stop;
export const __categoryReplicationPilotTestUtils = {
  pullCategories: pilot.pull,
  pushCategories: pilot.push,
};

import { sendAppAction } from './appAction';
import { refreshTaskReplicationPilot, resyncTaskReplicationPilot } from '../db/taskReplicationPilot';
import { refreshCategoryReplicationPilot, resyncCategoryReplicationPilot } from '../db/categoryReplicationPilot';

export interface CategoryLifecycleInventory {
  categoryId: string;
  persistedTaskCount: number;
  safeToDelete: boolean;
}
export async function categoryLifecycleInventory(categoryId: string): Promise<CategoryLifecycleInventory> {
  const result = await sendAppAction({
    action: 'get_category_lifecycle_preflight', categoryId,
  }, 30000);
  if (result.ok !== true || result.categoryId !== categoryId ||
      !Number.isSafeInteger(result.persistedTaskCount) ||
      (result.persistedTaskCount as number) < 0 ||
      typeof result.safeToDelete !== 'boolean') {
    throw new Error('Invalid category inventory');
  }
  return {
    categoryId, persistedTaskCount: result.persistedTaskCount as number,
    safeToDelete: result.safeToDelete,
  };
}

export async function executeCategoryLifecycle(
  userId: string,
  categoryId: string,
  confirmName: string,
  mode: 'move' | 'delete',
  destinationId: string,
  onProgress: (remaining: number) => void,
): Promise<void> {
  // Require that local pending owner writes have been given a chance to push
  // before establishing an authoritative server inventory.
  const [tasksReady, categoriesReady] = await Promise.all([
    refreshTaskReplicationPilot(userId, 30000),
    refreshCategoryReplicationPilot(userId, 30000),
  ]);
  if (!tasksReady || !categoriesReady) {
    throw new Error('Sync is not ready');
  }
  const inventory = await categoryLifecycleInventory(categoryId);
  if (!inventory.safeToDelete) {
    throw new Error('The server has not enabled safe category deletion');
  }
  // A large category is completed over multiple signed, bounded server
  // invocations. Retry is safe: server state stores mode and destination.
  // A failed request leaves the original category visible and recoverable.
  for (let attempt = 0; attempt < 10000; attempt++) {
    const result = await sendAppAction({
      action: 'run_category_lifecycle',
      categoryId, confirmName, mode,
      ...(mode === 'move' ? {destinationId} : {}),
    }, 70000);
    if (result.ok !== true ||
        (result.status !== 'processing' && result.status !== 'done') ||
        !Number.isSafeInteger(result.remaining)) {
      throw new Error('Invalid category operation response');
    }
    onProgress(result.remaining as number);
    if (result.status === 'done') {
      resyncTaskReplicationPilot(userId);
      resyncCategoryReplicationPilot(userId);
      // Re-pull the remote tombstones/moves, not just the original local list.
      await Promise.all([
        refreshTaskReplicationPilot(userId, 30000),
        refreshCategoryReplicationPilot(userId, 30000),
      ]);
      return;
    }
  }
  throw new Error('Category migration exceeded its safety limit');
}

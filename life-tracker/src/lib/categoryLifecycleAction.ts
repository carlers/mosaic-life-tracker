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

export interface RecoverableCategory {
  id: string;
  name: string;
  deletedAt: string;
  status: 'delete' | 'restore';
}
export async function listRecoverableCategories(cursor?: string): Promise<{
  categories: RecoverableCategory[]; nextCursor: string | null;
}> {
  const result = await sendAppAction({
    action: 'list_recoverable_categories', ...(cursor ? {cursor} : {}),
  }, 30000);
  if (result.ok !== true || !Array.isArray(result.categories) ||
      !(result.nextCursor === null || typeof result.nextCursor === 'string')) {
    throw new Error('Invalid recovery inventory');
  }
  const categories = result.categories as RecoverableCategory[];
  if (!categories.every(cat => cat && typeof cat.id === 'string' &&
      typeof cat.name === 'string' && typeof cat.deletedAt === 'string' &&
      ['delete','restore'].includes(cat.status))) throw new Error('Invalid recovery category');
  return {categories,nextCursor:result.nextCursor as string | null};
}

export async function recoverDeletedCategory(
  userId: string,
  categoryId: string,
  confirmName: string,
  onProgress: (remaining: number) => void,
): Promise<void> {
  for (let attempt=0; attempt<10000;attempt++) {
    const result=await sendAppAction({
      action:'recover_deleted_category',categoryId,confirmName,
    },70000);
    if (result.ok !== true || !['processing','done'].includes(result.status as string) ||
        !Number.isSafeInteger(result.remaining)) throw new Error('Invalid recovery response');
    onProgress(result.remaining as number);
    if (result.status === 'done') {
      resyncCategoryReplicationPilot(userId);
      resyncTaskReplicationPilot(userId);
      await Promise.all([
        refreshTaskReplicationPilot(userId,30000),
        refreshCategoryReplicationPilot(userId,30000),
      ]);
      return;
    }
  }
  throw new Error('Category recovery exceeded safety limit');
}

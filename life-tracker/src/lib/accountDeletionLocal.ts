import { purgeAccountFromDatabase } from '../db/database';
import { clearMessageActionQueue } from './messageActionQueue';
import { clearSocialOutbox } from './socialOutbox';
import { clearPendingImagesForUser } from './pendingImages';
import { clearAllFriendCaches } from './friendCache';
import { clearCachedOwnProfile } from './profileCache';
import { clearAllCachedImages } from './imageCache';
import { clearOfflineDataReadiness } from './offlineReadiness';
import { clearTodoMateImportMarker } from './todomateImportState';
import { clearBackupActivity } from './backupActivity';
import { clearSharedCompletionQueue } from './taskShareQueue';
import { clearSharedTaskCache } from '../hooks/useSharedTasks';

const ACCOUNT_STORAGE_KEYS = [
  'lastSyncTime_',
  'lastSyncTimePerCollection_',
  'reconciledMissingRows_',
  'mosaic_friendship_cache_v1:',
  'mosaic_shared_completion_conflict_',
] as const;

export async function clearDeletedAccountLocalData(
  userId: string
): Promise<void> {
  if (!userId) return;

  clearMessageActionQueue(userId);
  clearSocialOutbox(userId);
  clearCachedOwnProfile(userId);
  clearTodoMateImportMarker(userId);
  clearBackupActivity(userId);
  clearSharedCompletionQueue(userId);
  clearSharedTaskCache(userId);
  clearOfflineDataReadiness();

  try {
    for (const prefix of ACCOUNT_STORAGE_KEYS) {
      localStorage.removeItem(prefix + userId);
    }
  } catch {
    // The durable remote deletion has already been accepted. Local storage
    // cleanup is best effort and must not resurrect or cancel it.
  }

  await Promise.allSettled([
    clearPendingImagesForUser(userId),
    clearAllFriendCaches(),
    clearAllCachedImages(),
  ]);

  await purgeAccountFromDatabase(userId);
}

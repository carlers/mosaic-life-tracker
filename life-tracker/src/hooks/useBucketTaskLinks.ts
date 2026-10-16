import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import type { BucketTaskLinkDocument } from '../db/schema';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeBucketTaskLinkId } from '../lib/bucketTaskLinkId';

export function useBucketTaskLinks(enabled = true) {
  const { user } = useAuth();
  const userId = user?.$id;
  const { data: links, isLoading } = useRxCollection<BucketTaskLinkDocument>({
    collection: 'bucketTaskLinks',
    selector: { userId: userId ?? '', isDeleted: false },
    enabled,
    logPrefix: '[useBucketTaskLinks]',
  });

  const setLinked = useCallback(async (bucketListId: string, taskId: string, linked: boolean) => {
    if (!userId) throw new Error('Sign in to link tasks.');
    const db = getDatabase();
    const [goal, task] = await Promise.all([
      db.bucketList.findOne(bucketListId).exec(),
      db.tasks.findOne(taskId).exec(),
    ]);
    if (!goal || goal.userId !== userId || goal.isDeleted ||
        (linked && (!task || task.userId !== userId || task.isDeleted))) {
      throw new Error('This aspiration or task is no longer available.');
    }
    const id = makeBucketTaskLinkId(userId, bucketListId, taskId);
    const existing = await db.bucketTaskLinks.findOne(id).exec();
    if (existing && (existing.userId !== userId || existing.bucketListId !== bucketListId || existing.taskId !== taskId)) {
      throw new Error('Relationship ID collision; nothing was changed.');
    }
    if (existing) {
      if (existing.isDeleted === !linked) return;
      await existing.incrementalPatch({ isDeleted: !linked, updatedAt: new Date().toISOString() });
    } else if (linked) {
      const now = new Date().toISOString();
      try {
        await db.bucketTaskLinks.insert({
          id, userId, bucketListId, taskId, createdAt: now,
          updatedAt: now, isDeleted: false,
        });
      } catch (error) {
        // Concurrent taps in another tab are idempotent.
        const raced = await db.bucketTaskLinks.findOne(id).exec();
        if (!raced || raced.userId !== userId || raced.bucketListId !== bucketListId ||
            raced.taskId !== taskId) throw error;
        if (raced.isDeleted) await raced.incrementalPatch({ isDeleted: false, updatedAt: new Date().toISOString() });
      }
    }
  }, [userId]);

  return { links, isLoading, setLinked };
}

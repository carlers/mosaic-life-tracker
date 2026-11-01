import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { isFeatureEnabled } from '../lib/featureControls';
import type { BucketListDocument } from '../db/schema';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';

export function validateBucketListInput(title: string, description: string) {
  const normalized = title.trim();
  if (!normalized || normalized.length > 255) throw new Error('Enter a title up to 255 characters.');
  if (description.length > 2000) throw new Error('Description is too long.');
  return { title: normalized, description: description.trim() };
}

export function useBucketList() {
  const { user } = useAuth();
  const { data: items, isLoading } = useRxCollection<BucketListDocument>({
    collection: 'bucketList',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    logPrefix: '[useBucketList]',
  });
  const userId = user?.$id;
  const createItem = useCallback(async (title: string, description = '') => {
    if (!userId) throw new Error('Sign in to manage your Bucket List.');
    if (!isFeatureEnabled('mosaic_disable_bucket_list_creation')) throw new Error('New Bucket List aspirations are temporarily unavailable.');
    const fields = validateBucketListInput(title, description);
    const now = new Date().toISOString();
    await getDatabase().bucketList.insert({
      id: crypto.randomUUID().replace(/-/g, ''),
      userId, ...fields, achieved: false, achievedAt: '',
      createdAt: now, updatedAt: now, isDeleted: false,
    });
  }, [userId]);
  const editItem = useCallback(async (id: string, title: string, description: string) => {
    if (!userId) throw new Error('Sign in to manage your Bucket List.');
    const fields = validateBucketListInput(title, description);
    const doc = await getDatabase().bucketList.findOne(id).exec();
    if (!doc || doc.userId !== userId || doc.isDeleted) throw new Error('Item unavailable.');
    await doc.incrementalPatch({ ...fields, updatedAt: new Date().toISOString() });
  }, [userId]);
  const setAchieved = useCallback(async (id: string, achieved: boolean) => {
    if (!userId) throw new Error('Sign in to manage your Bucket List.');
    const doc = await getDatabase().bucketList.findOne(id).exec();
    if (!doc || doc.userId !== userId || doc.isDeleted) throw new Error('Item unavailable.');
    if (doc.achieved === achieved) return;
    const now = new Date().toISOString();
    await doc.incrementalPatch({
      achieved, achievedAt: achieved ? now : '', updatedAt: now,
    });
  }, [userId]);
  const deleteItem = useCallback(async (id: string) => {
    if (!userId) throw new Error('Sign in to manage your Bucket List.');
    const doc = await getDatabase().bucketList.findOne(id).exec();
    if (!doc || doc.userId !== userId || doc.isDeleted) throw new Error('Item unavailable.');
    await doc.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() });
    // Relationships are separately scoped/tombstoned: the canonical tasks survive.
    const links = await getDatabase().bucketTaskLinks.find({ selector: { userId, bucketListId: id, isDeleted: false } }).exec();
    await Promise.all(links.map(link => link.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() })));
  }, [userId]);
  return { items, isLoading, createItem, editItem, setAchieved, deleteItem };
}

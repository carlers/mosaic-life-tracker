/** Synthetic isolated Scratch M2 lab record builder. Not a normal user sync path. */
import type { OwnerOnlyCollection } from './ownerCiphertextTransport';

export function syntheticDoc(
  ownerId: string, collection: OwnerOnlyCollection, value: string,
  linkedBucket: string, linkedTask: string, previous?: PrivateRow,
): Record<string, unknown> {
  const timestamp = new Date().toISOString();
  if (previous) {
    const saved: Record<string, unknown> = { ...previous };
    delete saved.__e2eeRevision;
    const update: Record<string, unknown> = {
      ...saved, updatedAt: timestamp, isDeleted: false,
    };
    if (collection === 'tasks' || collection === 'bucketList') update.title = value;
    if (collection === 'categories') update.name = value;
    if (collection === 'diary') update.content = value;
    if (collection === 'settings') update.value = value;
    // Link membership is never silently redirected by an edit.
    return update;
  }
  const base = {
    id: crypto.randomUUID(), userId: ownerId, isDeleted: false,
    createdAt: timestamp, updatedAt: timestamp,
  };
  switch (collection) {
    case 'tasks': return {
      ...base, title: value, categoryId: '', completed: false, order: 0,
      date: timestamp.slice(0, 10), memo: '', image: '', visibility: 'private',
    };
    case 'categories': return {
      ...base, name: value, color: '#64748b', order: 0,
      visibility: 'private', icon: '', retiredOn: '',
    };
    case 'diary': return {
      ...base, date: timestamp.slice(0, 10), content: value,
      emoji: '', photos: '[]', visibility: 'private',
    };
    case 'bucketList': return {
      ...base, title: value, description: '', achieved: false, achievedAt: '',
    };
    case 'bucketTaskLinks':
      if (!linkedBucket || !linkedTask) throw new Error('Missing linked test records.');
      return {
        ...base, bucketListId: linkedBucket, taskId: linkedTask,
      };
    case 'settings': return {
      ...base, key: 'm2_synthetic_note', value,
    };
  }
}

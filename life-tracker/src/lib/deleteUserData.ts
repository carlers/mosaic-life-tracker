import { getDatabase } from '../db/database';
import { guardedTablesDB } from './sdk';
import { toAppwriteDeletePatch } from './syncMapping';
import { deleteImage } from './storage';
import { deleteFriendPair, fetchMyProfile } from './social';
import { APPWRITE_DATABASE_ID } from './appwriteConfig';

const DATABASE_ID = APPWRITE_DATABASE_ID;
const SYNCED_COLLECTIONS = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
] as const;

type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number];

interface DeletableDoc {
  id?: string;
  toJSON?: () => Record<string, unknown>;
  incrementalPatch: (patch: Record<string, unknown>) => Promise<unknown>;
  [key: string]: unknown;
}

interface DeletableCollection {
  find: (query?: unknown) => {
    exec: () => Promise<DeletableDoc[]>;
  };
}

export interface DeleteAllUserDataResult {
  totalRows: number;
  counts: Record<SyncedCollection, number>;
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

function readDoc(doc: DeletableDoc): Record<string, unknown> {
  return doc.toJSON ? doc.toJSON() : doc;
}

export async function deleteAllUserData(
  userId: string
): Promise<DeleteAllUserDataResult> {
  if (!userId) throw new Error('Cannot delete user data without a user id');

  const db = getDatabase();
  const now = new Date().toISOString();
  const counts = Object.fromEntries(
    SYNCED_COLLECTIONS.map((name) => [name, 0])
  ) as Record<SyncedCollection, number>;
  const imageIds = new Set<string>();

  const profile = await fetchMyProfile(userId);
  if (profile?.avatar_file_id) imageIds.add(profile.avatar_file_id);

  for (const collectionName of SYNCED_COLLECTIONS) {
    const collection = db[collectionName] as unknown as DeletableCollection;
    const docs = await collection.find({ selector: { userId } }).exec();

    for (const doc of docs) {
      const json = readDoc(doc);
      const rowId = String(json.id ?? doc.id ?? '');
      if (!rowId) continue;

      if (
        collectionName === 'tasks' &&
        typeof json.image === 'string' &&
        json.image
      ) {
        imageIds.add(json.image);
      }

      if (
        collectionName === 'friendships' &&
        json.isDeleted !== true &&
        typeof json.friendId === 'string' &&
        json.friendId
      ) {
        await deleteFriendPair(userId, json.friendId);
      }

      await doc.incrementalPatch({
        isDeleted: true,
        updatedAt: now,
      });

      try {
        await guardedTablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: collectionName,
          rowId,
          data: toAppwriteDeletePatch(now),
        });
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      counts[collectionName] += 1;
    }
  }

  try {
    await guardedTablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: 'profiles',
      rowId: `profile_${userId}`,
      data: {
        deleted: true,
        is_searchable: false,
        updated_at: now,
      },
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await Promise.all(
    Array.from(imageIds, (fileId) =>
      deleteImage(fileId).catch((error) => {
        console.warn('[deleteUserData] Image cleanup failed:', fileId, error);
      })
    )
  );

  return {
    totalRows: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts,
  };
}

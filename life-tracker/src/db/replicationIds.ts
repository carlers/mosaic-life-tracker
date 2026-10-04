export const SYNCED_COLLECTION_NAMES = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
] as const;

export type SyncedCollectionName =
  (typeof SYNCED_COLLECTION_NAMES)[number];

const REPLICATION_PROTOCOL_VERSION = 'v1';

export function getReplicationIdentifier(
  collection: SyncedCollectionName,
  userId: string
): string {
  return `mosaic-appwrite-tablesdb-${collection}-${REPLICATION_PROTOCOL_VERSION}:${userId}`;
}

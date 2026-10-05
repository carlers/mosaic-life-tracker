import {
  getChangedDocumentsSince,
  type RxCollection,
  type RxReplicationPullStreamItem,
} from 'rxdb';
import { type Subject } from 'rxjs';
import { Query } from 'appwrite';
import {
  guardedRealtime,
  guardedTablesDB,
  type RealtimeUnsubscribe,
} from '../lib/sdk';
import { assertRemoteRowsOwnedBy } from './replicationOwnership';

export async function captureReplicationPushCheckpoint<
  DocumentType,
  CheckpointType
>(
  collection: RxCollection<DocumentType>,
  batchSize: number
): Promise<CheckpointType | undefined> {
  let checkpoint: CheckpointType | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<DocumentType, CheckpointType>(
      collection.storageInstance,
      batchSize,
      checkpoint
    );
    checkpoint = result.checkpoint;
    if (result.documents.length < batchSize) {
      return checkpoint;
    }
  }
}

export function subscribeToOwnerRealtime<
  DocumentType,
  PullCheckpointType
>(options: {
  channel: string;
  userId: string;
  isActiveOwner: () => boolean;
  pullStream: Subject<
    RxReplicationPullStreamItem<DocumentType, PullCheckpointType>
  >;
}): RealtimeUnsubscribe {
  return guardedRealtime.subscribe(options.channel, (message) => {
    if (!options.isActiveOwner()) return;
    const events = Array.isArray(message.events) ? message.events : [];

    if (events.some((event) => event.endsWith('.delete'))) {
      options.pullStream.next('RESYNC');
      return;
    }

    const payload = message.payload;
    if (!payload || payload.user_id !== options.userId) return;
    if (
      events.some(
        (event) => event.endsWith('.create') || event.endsWith('.update')
      )
    ) {
      options.pullStream.next('RESYNC');
    }
  });
}


export type UpdatedAtIdCheckpoint = {
  updatedAt: string;
  id: string;
};

export async function pullOwnerRowsByUpdatedAtId<
  DocumentType,
  CheckpointType extends UpdatedAtIdCheckpoint
>(options: {
  databaseId: string;
  tableId: string;
  userId: string;
  ownerLabel: string;
  checkpoint: CheckpointType | undefined;
  batchSize: number;
  mapRow: (row: Record<string, unknown>) => DocumentType;
}): Promise<{
  documents: DocumentType[];
  checkpoint: CheckpointType | undefined;
}> {
  const queries: string[] = [Query.equal('user_id', options.userId)];

  if (options.checkpoint) {
    queries.push(
      Query.or([
        Query.greaterThan('$updatedAt', options.checkpoint.updatedAt),
        Query.and([
          Query.equal('$updatedAt', options.checkpoint.updatedAt),
          Query.greaterThan('$id', options.checkpoint.id),
        ]),
      ])
    );
  }

  queries.push(
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
    Query.limit(options.batchSize)
  );

  const response = await guardedTablesDB.listRows({
    databaseId: options.databaseId,
    tableId: options.tableId,
    queries,
    total: false,
  });
  const responseRows =
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  assertRemoteRowsOwnedBy(responseRows, options.userId, options.ownerLabel);
  const rows = responseRows.filter(
    (row) =>
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const last = rows.at(-1);
  return {
    documents: rows.map(options.mapRow),
    checkpoint: last
      ? ({
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        } as CheckpointType)
      : options.checkpoint,
  };
}

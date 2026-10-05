import {
  getChangedDocumentsSince,
  type RxCollection,
  type RxReplicationPullStreamItem,
} from 'rxdb';
import { type Subject } from 'rxjs';
import {
  guardedRealtime,
  type RealtimeUnsubscribe,
} from '../lib/sdk';

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

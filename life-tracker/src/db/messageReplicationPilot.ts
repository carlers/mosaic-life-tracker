import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';
import { Query } from 'appwrite';
import {
  getChangedDocumentsSince,
  type RxCollection,
  type RxReplicationPullStreamItem,
  type RxReplicationWriteToMasterRow,
  type WithDeletedAndAttachments,
} from 'rxdb';
import {
  replicateRxCollection,
  type RxReplicationState,
} from 'rxdb/plugins/replication';
import { Subject, type Subscription } from 'rxjs';
import type { MessageDocument } from './schema';
import {
  guardedRealtime,
  guardedTablesDB,
  type RealtimeUnsubscribe,
} from '../lib/sdk';
import { fromAppwriteFormat } from '../lib/syncMapping';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import { assertRemoteRowsOwnedBy } from './replicationOwnership';

const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 50;
const LOCAL_CHECKPOINT_BATCH_SIZE = 200;
const RETRY_TIME_MS = 5_000;

export interface MessageReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

export type MessageReplicationPushCheckpoint = {
  id: string;
  lwt: number;
};

type ReplicatedMessage = WithDeletedAndAttachments<MessageDocument>;

let activeOwnerId: string | null = null;
let activeReplication:
  | RxReplicationState<MessageDocument, MessageReplicationCheckpoint>
  | null = null;
let activePullStream:
  | Subject<
      RxReplicationPullStreamItem<
        MessageDocument,
        MessageReplicationCheckpoint
      >
    >
  | null = null;
let realtimeUnsubscribe: RealtimeUnsubscribe | null = null;
let errorSubscription: Subscription | null = null;
let activeCollection: RxCollection<MessageDocument> | null = null;

function toReplicatedMessage(
  row: Record<string, unknown>
): ReplicatedMessage {
  return {
    ...(fromAppwriteFormat(
      row,
      'messages'
    ) as unknown as MessageDocument),
    _deleted: false,
  };
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localIsAtLeastAsNew(
  local: ReplicatedMessage,
  remote: ReplicatedMessage
): boolean {
  return toTimestamp(local.updatedAt) >= toTimestamp(remote.updatedAt);
}

function preserveLocalUnsend(
  local: ReplicatedMessage,
  remote: ReplicatedMessage
): ReplicatedMessage {
  return {
    ...remote,
    content: '',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: true,
    reactions: '',
    deliveryStatus: 'delivered',
    updatedAt: local.updatedAt,
    readAt:
      remote.direction === 'outgoing'
        ? remote.readAt
        : local.readAt || remote.readAt,
  };
}

/**
 * Message writes are Function/outbox owned, so a pull can race a local
 * optimistic intent that has not reached Appwrite yet. Preserve only the
 * known local-only intent fields until their Function result arrives.
 */
async function mergeRemoteWithLocalIntent(
  collection: RxCollection<MessageDocument>,
  userId: string,
  remote: ReplicatedMessage
): Promise<ReplicatedMessage> {
  const localDoc = await collection.findOne(remote.id).exec();
  if (!localDoc) return remote;

  const local = {
    ...(localDoc.toJSON() as MessageDocument),
    _deleted: false,
  } as ReplicatedMessage;
  if (local.userId !== userId || remote.userId !== userId) return remote;

  let merged: ReplicatedMessage = { ...remote };

  if (local.isDeleted && !remote.isDeleted && localIsAtLeastAsNew(local, remote)) {
    merged = {
      ...merged,
      isDeleted: true,
      updatedAt: local.updatedAt,
    };
  }

  if (local.isUnsent && !remote.isUnsent && localIsAtLeastAsNew(local, remote)) {
    merged = preserveLocalUnsend(local, merged);
  }

  if (
    !local.isUnsent &&
    local.reactions !== remote.reactions &&
    localIsAtLeastAsNew(local, remote)
  ) {
    merged = {
      ...merged,
      reactions: local.reactions,
      updatedAt: local.updatedAt,
    };
  }

  if (
    local.replyToContent === '' &&
    remote.replyToContent !== '' &&
    localIsAtLeastAsNew(local, remote)
  ) {
    merged = {
      ...merged,
      replyToContent: '',
      updatedAt: local.updatedAt,
    };
  }

  if (local.originalMessageId && !remote.originalMessageId) {
    merged = {
      ...merged,
      originalMessageId: local.originalMessageId,
    };
  }

  if (
    remote.direction === 'incoming' &&
    local.readAt &&
    (!remote.readAt || remote.readAt === local.readAt)
  ) {
    merged = {
      ...merged,
      readAt: remote.readAt || local.readAt,
      updatedAt:
        toTimestamp(local.updatedAt) > toTimestamp(merged.updatedAt)
          ? local.updatedAt
          : merged.updatedAt,
    };
  }

  // Outgoing readAt belongs to the server even while other local intent is
  // being preserved.
  if (remote.direction === 'outgoing') {
    merged.readAt = remote.readAt;
  }

  return merged;
}

/**
 * Message rows are never written directly by replication. Delivery,
 * mark_read, unsend, reactions and account deletion already have dedicated
 * Function/direct-delete paths. This upstream only validates ownership and
 * acknowledges local state so it does not block downstream reconciliation.
 */
async function acknowledgeMessageChanges(
  rows: RxReplicationWriteToMasterRow<MessageDocument>[],
  userId: string
): Promise<ReplicatedMessage[]> {
  for (const row of rows) {
    const next = row.newDocumentState;
    if (next.userId !== userId) {
      // Mosaic intentionally keeps multiple owners in one local RxDB. A
      // per-user replication identifier will encounter those cached foreign
      // rows on first upstream scan; acknowledge them as outside this
      // replication scope instead of poisoning the active owner's queue.
      continue;
    }
    if (next._deleted) {
      throw new Error(
        `Message replication cannot physically delete ${next.id}; use isDeleted tombstones`
      );
    }
  }
  return [];
}

async function pullMessages(
  collection: RxCollection<MessageDocument>,
  userId: string,
  checkpoint: MessageReplicationCheckpoint | undefined,
  batchSize: number
): Promise<{
  documents: ReplicatedMessage[];
  checkpoint: MessageReplicationCheckpoint | undefined;
}> {
  const queries: string[] = [Query.equal('user_id', userId)];

  if (checkpoint) {
    queries.push(
      Query.or([
        Query.greaterThan('$updatedAt', checkpoint.updatedAt),
        Query.and([
          Query.equal('$updatedAt', checkpoint.updatedAt),
          Query.greaterThan('$id', checkpoint.id),
        ]),
      ])
    );
  }

  queries.push(
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
    Query.limit(batchSize)
  );

  const response = await guardedTablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.messages,
    queries,
    total: false,
  });

  const responseRows =
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  assertRemoteRowsOwnedBy(responseRows, userId, 'Message');
  const rows = responseRows.filter(
    (row) =>
      typeof row.$id === 'string' &&
      row.$id.length > 0 &&
      typeof row.$updatedAt === 'string' &&
      row.$updatedAt.length > 0
  );

  const documents: ReplicatedMessage[] = [];
  for (const row of rows) {
    const remote = toReplicatedMessage(row);
    documents.push(
      await mergeRemoteWithLocalIntent(collection, userId, remote)
    );
  }

  const last = rows.at(-1);
  return {
    documents,
    checkpoint: last
      ? {
          id: last.$id as string,
          updatedAt: last.$updatedAt as string,
        }
      : checkpoint,
  };
}

export async function captureMessageReplicationPullCheckpoint(
  userId: string
): Promise<MessageReplicationCheckpoint | undefined> {
  const response = await guardedTablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLES.messages,
    queries: [
      Query.equal('user_id', userId),
      Query.orderDesc('$updatedAt'),
      Query.orderDesc('$id'),
      Query.limit(1),
    ],
    total: false,
  });
  const responseRows =
    (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  assertRemoteRowsOwnedBy(responseRows, userId, 'Message bootstrap');
  const row = responseRows.find(
    (candidate) =>
      typeof candidate.$id === 'string' &&
      candidate.$id.length > 0 &&
      typeof candidate.$updatedAt === 'string' &&
      candidate.$updatedAt.length > 0
  );
  if (!row) return undefined;
  return {
    id: row.$id as string,
    updatedAt: row.$updatedAt as string,
  };
}

export async function captureMessageReplicationPushCheckpoint(
  collection: RxCollection<MessageDocument>
): Promise<MessageReplicationPushCheckpoint | undefined> {
  let checkpoint: MessageReplicationPushCheckpoint | undefined;

  for (;;) {
    const result = await getChangedDocumentsSince<
      MessageDocument,
      MessageReplicationPushCheckpoint
    >(
      collection.storageInstance,
      LOCAL_CHECKPOINT_BATCH_SIZE,
      checkpoint
    );
    checkpoint = result.checkpoint;
    if (result.documents.length < LOCAL_CHECKPOINT_BATCH_SIZE) {
      return checkpoint;
    }
  }
}

async function applyRealtimeDelete(
  collection: RxCollection<MessageDocument>,
  userId: string,
  rowId: string
): Promise<void> {
  const current = await collection.findOne(rowId).exec();
  if (
    !current ||
    activeOwnerId !== userId ||
    current.userId !== userId
  ) {
    return;
  }

  const now = new Date().toISOString();
  await current.incrementalModify((document) => {
    if (
      activeOwnerId !== userId ||
      document.userId !== userId ||
      document.isDeleted
    ) {
      return document;
    }
    return {
      ...document,
      isDeleted: true,
      updatedAt: now,
    };
  });
}

function subscribeToMessageRealtime(
  userId: string,
  collection: RxCollection<MessageDocument>,
  pullStream: Subject<
    RxReplicationPullStreamItem<
      MessageDocument,
      MessageReplicationCheckpoint
    >
  >
): RealtimeUnsubscribe {
  const channel =
    `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_TABLES.messages}.rows`;

  return guardedRealtime.subscribe(channel, (message) => {
    if (activeOwnerId !== userId) return;

    const payload = message.payload;
    const events = Array.isArray(message.events) ? message.events : [];
    const isDelete = events.some((event) => event.endsWith('.delete'));

    if (isDelete) {
      const rowId =
        payload && typeof payload.$id === 'string'
          ? payload.$id
          : '';
      if (rowId) {
        void applyRealtimeDelete(collection, userId, rowId).catch((error) => {
          console.error(
            '[MessageReplicationPilot] realtime delete apply failed:',
            error
          );
        });
      }
      pullStream.next('RESYNC');
      return;
    }

    if (!payload || payload.user_id !== userId) return;
    if (
      events.some(
        (event) => event.endsWith('.create') || event.endsWith('.update')
      )
    ) {
      pullStream.next('RESYNC');
    }
  });
}

export function isMessageReplicationPilotActive(
  userId: string
): boolean {
  return activeOwnerId === userId && activeReplication !== null;
}

export function resyncMessageReplicationPilot(
  userId: string
): boolean {
  if (!isMessageReplicationPilotActive(userId)) return false;
  activeReplication?.reSync();
  return true;
}

export async function refreshMessageReplicationPilot(
  userId: string,
  timeoutMs: number
): Promise<boolean> {
  if (
    !isMessageReplicationPilotActive(userId) ||
    !activeReplication ||
    !activeCollection
  ) {
    return false;
  }

  await awaitPilotReplicationFreshness(
    'message',
    activeReplication,
    activeCollection,
    timeoutMs
  );
  return true;
}

async function stopMessageReplicationPilotNow(
  userId?: string
): Promise<void> {
  if (userId && activeOwnerId !== userId) return;

  const replication = activeReplication;
  activeOwnerId = null;
  activeReplication = null;
  activeCollection = null;

  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;
  errorSubscription?.unsubscribe();
  errorSubscription = null;
  activePullStream?.complete();
  activePullStream = null;

  if (replication) {
    await replication.cancel();
  }
}

async function startMessageReplicationPilotNow(
  userId: string,
  collection: RxCollection<MessageDocument>,
  initialPushCheckpoint: MessageReplicationPushCheckpoint | undefined,
  initialPullCheckpoint: MessageReplicationCheckpoint | undefined
): Promise<void> {
  if (!userId) return;
  if (isMessageReplicationPilotActive(userId)) return;

  if (activeReplication) {
    await stopMessageReplicationPilotNow();
  }

  const pullStream = new Subject<
    RxReplicationPullStreamItem<
      MessageDocument,
      MessageReplicationCheckpoint
    >
  >();

  const replication = replicateRxCollection<
    MessageDocument,
    MessageReplicationCheckpoint
  >({
    replicationIdentifier:
      getReplicationIdentifier('messages', userId),
    collection,
    live: true,
    retryTime: RETRY_TIME_MS,
    waitForLeadership: true,
    toggleOnDocumentVisible: true,
    pull: {
      batchSize: PULL_BATCH_SIZE,
      initialCheckpoint: initialPullCheckpoint,
      stream$: pullStream.asObservable(),
      handler: (checkpoint, batchSize) =>
        pullMessages(collection, userId, checkpoint, batchSize),
    },
    push: {
      batchSize: PUSH_BATCH_SIZE,
      initialCheckpoint: initialPushCheckpoint,
      handler: (rows) => acknowledgeMessageChanges(rows, userId),
    },
  });

  activeOwnerId = userId;
  activeReplication = replication;
  trackReplicationFreshness(replication, userId, 'messages');
  activeCollection = collection;
  activePullStream = pullStream;
  realtimeUnsubscribe = subscribeToMessageRealtime(
    userId,
    collection,
    pullStream
  );
  errorSubscription = replication.error$.subscribe((error) => {
    console.error(
      '[MessageReplicationPilot] replication error:',
      error
    );
  });
}

const runReplicationPilotLifecycle = createReplicationPilotLifecycleQueue();

export function stopMessageReplicationPilot(
  ...args: Parameters<typeof stopMessageReplicationPilotNow>
): ReturnType<typeof stopMessageReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => stopMessageReplicationPilotNow(...args));
}

export function startMessageReplicationPilot(
  ...args: Parameters<typeof startMessageReplicationPilotNow>
): ReturnType<typeof startMessageReplicationPilotNow> {
  return runReplicationPilotLifecycle(() => startMessageReplicationPilotNow(...args));
}

export const __messageReplicationPilotTestUtils = {
  acknowledgeMessageChanges,
  mergeRemoteWithLocalIntent,
  pullMessages,
};

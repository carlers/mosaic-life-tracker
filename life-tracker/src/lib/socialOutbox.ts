import { flushFriendshipCommands, clearFriendshipCommands, pendingFriendshipCount, migrateLegacyFriendship } from './friendshipCommands';
import { createPersistentOutbox } from './outbox';
import type { FriendshipDocument } from '../db/schema';
import {
  captureAccountWorkGeneration,
  isAccountWorkCurrent,
} from './accountWorkScope';

const DEBUG = import.meta.env.DEV;

export type SocialOutboxAction =
  | 'send_request'
  | 'accept_friend_request'
  | 'delete_friend_pair'
  | 'block_friend'
  | 'upsert_profile';

export interface SocialOutboxRemoteOp {
  kind: 'upsertRow' | 'updateRow';
  databaseId: string;
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
  permissions?: string[];
}

export interface SocialOutboxRevertInfo {
  /**
   * My own friendship row id. Empty string when there is no local RxDB
   * row to revert (e.g. the profile upsert, which has no local mirror).
   */
  myRowId: string;
  /**
   * Status to restore when the failure listener reverts an accept/block
   * mutation. Undefined for send_request/delete_friend_pair.
   */
  previousStatus?: FriendshipDocument['status'];
}

export interface SocialOutboxSender {
  (op: SocialOutboxRemoteOp): Promise<void>;
}

export interface SocialOutboxFailureEvent {
  userId: string;
  action: SocialOutboxAction;
  revert: SocialOutboxRevertInfo;
}

export type SocialOutboxFailureListener = (
  event: SocialOutboxFailureEvent
) => void;

export interface SocialOutboxQueuedEntry {
  id: string;
  userId: string;
  action: SocialOutboxAction;
  op: SocialOutboxRemoteOp;
  revert: SocialOutboxRevertInfo;
  attempts: number;
  enqueuedAt: string;
}

const failureListeners = new Set<SocialOutboxFailureListener>();

export function subscribeToSocialOutboxFailures(
  fn: SocialOutboxFailureListener
): () => void {
  failureListeners.add(fn);
  return () => {
    failureListeners.delete(fn);
  };
}

export function emitSocialOutboxFailure(
  event: SocialOutboxFailureEvent
): void {
  for (const fn of failureListeners) {
    try {
      fn(event);
    } catch (err) {
      if (DEBUG) {
        console.error('[socialOutbox] failure listener threw:', err);
      }
    }
  }
}

const outbox = createPersistentOutbox<
  SocialOutboxRemoteOp,
  SocialOutboxRemoteOp,
  SocialOutboxQueuedEntry
>({
  storageKey: 'mosaic_social_outbox',
  logPrefix: '[socialOutbox]',
  makeEntry: (input, previousAttempts) => ({
    id: input.dedupKey,
    userId: input.userId,
    action: input.action as SocialOutboxAction,
    op: input.payload,
    revert: (input.extra?.revert as SocialOutboxRevertInfo | undefined) ?? {
      myRowId: '',
    },
    attempts: previousAttempts,
    enqueuedAt: new Date().toISOString(),
  }),
  parseEntry: (raw) => {
    if (
      !!raw &&
      typeof raw === 'object' &&
      typeof (raw as SocialOutboxQueuedEntry).id === 'string' &&
      typeof (raw as SocialOutboxQueuedEntry).userId === 'string' &&
      typeof (raw as SocialOutboxQueuedEntry).action === 'string' &&
      typeof (raw as SocialOutboxQueuedEntry).attempts === 'number' &&
      typeof (raw as SocialOutboxQueuedEntry).enqueuedAt === 'string' &&
      typeof (raw as SocialOutboxQueuedEntry).op === 'object' &&
      (raw as SocialOutboxQueuedEntry).op !== null &&
      typeof (raw as SocialOutboxQueuedEntry).revert === 'object' &&
      (raw as SocialOutboxQueuedEntry).revert !== null
    ) {
      return raw as SocialOutboxQueuedEntry;
    }
    return null;
  },
  send: async (op) => {
    await sender?.(op);
  },
  toSendInput: (entry) => entry.op,
  onDrop: ({ entry }) => {
    emitSocialOutboxFailure({
      userId: entry.userId,
      action: entry.action,
      revert: entry.revert,
    });
  },
});

let sender: SocialOutboxSender | null = null;

outbox.setSender(async (entry) => {
  if (!sender) {
    throw new Error('Social outbox sender not configured');
  }
  if (entry.action !== 'upsert_profile') {
    await migrateLegacyFriendship(entry);
    return;
  }
  await sender(entry.op);
});

export function setSocialOutboxSender(fn: SocialOutboxSender): void {
  sender = fn;
}

export function enqueueSocialOp(
  userId: string,
  input: {
    action: SocialOutboxAction;
    op: SocialOutboxRemoteOp;
    revert?: SocialOutboxRevertInfo;
    dedupKey: string;
  }
): void {
  outbox.enqueue(userId, {
    action: input.action,
    payload: input.op,
    dedupKey: input.dedupKey,
    extra: { revert: input.revert ?? { myRowId: '' } },
  });
}

export async function flushSocialOutbox(userId: string): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) return;
  if (sender) {
    await outbox.flush(
      userId,
      () => isAccountWorkCurrent(userId, generation)
    );
  }
  if (!isAccountWorkCurrent(userId, generation)) return;
  await flushFriendshipCommands(userId);
}

export function clearSocialOutbox(userId?: string): void {
  outbox.clear(userId);
  clearFriendshipCommands(userId);
}

export function getSocialOutboxSize(userId?: string): number {
  return outbox.size(userId) + pendingFriendshipCount(userId);
}

export function __resetSocialOutboxForTests(): void {
  outbox.resetForTests();
  sender = null;
  failureListeners.clear();
}

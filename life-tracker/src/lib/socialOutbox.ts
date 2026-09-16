import { isUnauthorizedError } from './authEvents';
import type { FriendshipDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;
const STORAGE_KEY = 'mosaic_social_outbox';
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES = 100;

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

interface QueuedEntry {
  id: string;
  userId: string;
  action: SocialOutboxAction;
  op: SocialOutboxRemoteOp;
  revert: SocialOutboxRevertInfo;
  attempts: number;
  enqueuedAt: string;
}

let sender: SocialOutboxSender | null = null;

export function setSocialOutboxSender(fn: SocialOutboxSender): void {
  sender = fn;
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

let queue: QueuedEntry[] = [];
let isFlushing = false;

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      queue = [];
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      queue = [];
      return;
    }
    queue = parsed.filter(
      (e): e is QueuedEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as QueuedEntry).id === 'string' &&
        typeof (e as QueuedEntry).userId === 'string' &&
        typeof (e as QueuedEntry).action === 'string' &&
        typeof (e as QueuedEntry).attempts === 'number' &&
        typeof (e as QueuedEntry).enqueuedAt === 'string' &&
        typeof (e as QueuedEntry).op === 'object' &&
        (e as QueuedEntry).op !== null &&
        typeof (e as QueuedEntry).revert === 'object' &&
        (e as QueuedEntry).revert !== null
    );
  } catch {
    queue = [];
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota or privacy-mode failure — the in-memory queue is unaffected.
  }
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
  load();
  const existingIdx = queue.findIndex(
    (e) => e.userId === userId && e.id === input.dedupKey
  );
  const entry: QueuedEntry = {
    id: input.dedupKey,
    userId,
    action: input.action,
    op: input.op,
    revert: input.revert || { myRowId: '' },
    attempts: existingIdx >= 0 ? queue[existingIdx].attempts : 0,
    enqueuedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }
  if (queue.length > MAX_ENTRIES) {
    queue.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    queue = queue.slice(queue.length - MAX_ENTRIES);
  }
  save();
}

function isPermanentFailure(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (typeof code !== 'number') return false;
  if (code === 429) return false;
  if (code >= 400 && code < 500) return true;
  return false;
}

function removeEntry(entry: QueuedEntry): void {
  queue = queue.filter(
    (e) => !(e.id === entry.id && e.userId === entry.userId)
  );
}

function dropEntry(entry: QueuedEntry): void {
  if (DEBUG) {
    console.log(
      `[socialOutbox] Dropping ${entry.id} (${entry.action})`
    );
  }
  removeEntry(entry);
  emitSocialOutboxFailure({
    userId: entry.userId,
    action: entry.action,
    revert: entry.revert,
  });
}

export async function flushSocialOutbox(userId: string): Promise<void> {
  if (isFlushing) return;
  if (!sender) return;
  load();
  const mine = queue.filter((e) => e.userId === userId);
  if (mine.length === 0) return;
  isFlushing = true;
  try {
    for (const entry of [...mine]) {
      try {
        await sender(entry.op);
        removeEntry(entry);
        save();
      } catch (err) {
        if (isUnauthorizedError(err) || isPermanentFailure(err)) {
          dropEntry(entry);
          save();
        } else {
          const next = entry.attempts + 1;
          if (next >= MAX_ATTEMPTS) {
            dropEntry(entry);
          } else {
            const idx = queue.findIndex(
              (e) => e.id === entry.id && e.userId === entry.userId
            );
            if (idx >= 0) queue[idx] = { ...queue[idx], attempts: next };
          }
          save();
        }
      }
    }
  } finally {
    isFlushing = false;
  }
}

export function clearSocialOutbox(userId?: string): void {
  load();
  if (userId) {
    queue = queue.filter((e) => e.userId !== userId);
  } else {
    queue = [];
  }
  save();
}

export function getSocialOutboxSize(userId?: string): number {
  load();
  if (userId) return queue.filter((e) => e.userId === userId).length;
  return queue.length;
}

export function __resetSocialOutboxForTests(): void {
  queue = [];
  sender = null;
  isFlushing = false;
  failureListeners.clear();
}

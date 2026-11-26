/**
 * Lazy-only asynchronous queue delivery. Never imported by Home's synchronous
 * enqueue path. Immutable original intents are kept until positive send ack.
 */
import { isUnauthorizedError } from './authEvents';
import type { OutboxEntryBase } from './outbox';

const DEBUG = import.meta.env.DEV;
const MAX_ATTEMPTS = 5;

export interface OutboxDeliveryContext<TEntry extends OutboxEntryBase> {
  storageKey: string;
  logPrefix: string;
  isFlushingUsers: Set<string>;
  heldUsers: Set<string>;
  readEntries: (userId: string) => TEntry[];
  storedEntryMatches: (entry: TEntry) => boolean;
  writeEntry: (entry: TEntry) => void;
  removeEntryIfUnchanged: (entry: TEntry) => boolean;
  dropEntry: (entry: TEntry) => void;
  sendEntry: (entry: TEntry) => Promise<void>;
  preserveOnEncryptionCutover?: (error: unknown) => boolean;
}

function permanentFailure(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  return typeof code === 'number' && code >= 400 && code < 500 && code !== 429;
}

async function flushUnlocked<TEntry extends OutboxEntryBase>(
  userId: string,
  shouldContinue: () => boolean,
  config: OutboxDeliveryContext<TEntry>,
): Promise<void> {
  if (config.isFlushingUsers.has(userId)) return;
  const mine = config.readEntries(userId).sort((a, b) =>
    a.enqueuedAt.localeCompare(b.enqueuedAt));
  if (mine.length === 0) return;
  if (config.preserveOnEncryptionCutover &&
      (config.heldUsers.has(userId) || mine.some(e =>
        e.encryptionCutoverHold || e.attempts >= MAX_ATTEMPTS))) return;

  config.isFlushingUsers.add(userId);
  try {
    for (const entry of mine) {
      if (!shouldContinue()) break;
      if (!config.storedEntryMatches(entry)) continue;
      try {
        await config.sendEntry(entry);
        if (!shouldContinue()) break;
        config.removeEntryIfUnchanged(entry);
      } catch (error) {
        if (!shouldContinue()) break;
        if (config.preserveOnEncryptionCutover?.(error)) {
          config.heldUsers.add(userId);
          if (config.storedEntryMatches(entry)) {
            config.writeEntry({ ...entry, encryptionCutoverHold: true });
          }
          break;
        }
        const permanent = isUnauthorizedError(error) || permanentFailure(error);
        const attempts = entry.attempts + 1;
        if (!permanent && config.preserveOnEncryptionCutover) {
          if (attempts >= MAX_ATTEMPTS) config.heldUsers.add(userId);
          if (config.storedEntryMatches(entry)) config.writeEntry({ ...entry, attempts });
          // Never overtake the unresolved earlier intent in this owner queue.
          break;
        }
        if (permanent || attempts >= MAX_ATTEMPTS) {
          if (DEBUG) console.log(`${config.logPrefix} Dropped pending action`);
          config.dropEntry(entry);
        } else if (config.storedEntryMatches(entry)) {
          config.writeEntry({ ...entry, attempts });
        }
      }
    }
  } finally {
    config.isFlushingUsers.delete(userId);
  }
}

export async function flushPersistentOutbox<TEntry extends OutboxEntryBase>(
  userId: string,
  shouldContinue: () => boolean,
  config: OutboxDeliveryContext<TEntry>,
): Promise<void> {
  if (!shouldContinue()) return;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks && typeof locks.request === 'function') {
    try {
      await locks.request(`mosaic-outbox:${config.storageKey}:${userId}`, async () => {
        await flushUnlocked(userId, shouldContinue, config);
      });
      return;
    } catch (error) {
      if (DEBUG) console.warn(`${config.logPrefix} Web Lock unavailable:`, error);
    }
  }
  await flushUnlocked(userId, shouldContinue, config);
}

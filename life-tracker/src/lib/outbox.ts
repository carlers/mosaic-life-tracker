import { isUnauthorizedError } from './authEvents';

const DEBUG = import.meta.env.DEV;
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES_PER_USER = 100;

export interface OutboxEntryBase {
  id: string;
  userId: string;
  action: string;
  attempts: number;
  enqueuedAt: string;
}

export interface OutboxDropInfo<TEntry extends OutboxEntryBase> {
  entry: TEntry;
}

export interface OutboxConfig<TPayload, TSendInput, TEntry extends OutboxEntryBase> {
  storageKey: string;
  logPrefix: string;
  makeEntry: (
    input: {
      userId: string;
      action: string;
      payload: TPayload;
      dedupKey: string;
      extra?: Record<string, unknown>;
    },
    previousAttempts: number
  ) => TEntry;
  parseEntry: (raw: unknown) => TEntry | null;
  send: (input: TSendInput) => Promise<void>;
  toSendInput: (entry: TEntry) => TSendInput;
  onDrop?: (info: OutboxDropInfo<TEntry>) => void;
}

export interface PersistentOutbox<TPayload, TEntry extends OutboxEntryBase> {
  setSender: (fn: (entry: TEntry) => Promise<void>) => void;
  enqueue: (
    userId: string,
    input: {
      action: string;
      payload: TPayload;
      dedupKey: string;
      extra?: Record<string, unknown>;
    }
  ) => void;
  flush: (userId: string, shouldContinue?: () => boolean) => Promise<void>;
  clear: (userId?: string) => void;
  size: (userId?: string) => number;
  resetForTests: () => void;
}

function isPermanentFailure(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (typeof code !== 'number') return false;
  if (code === 429) return false;
  if (code >= 400 && code < 500) return true;
  return false;
}

export function createPersistentOutbox<
  TPayload,
  TSendInput,
  TEntry extends OutboxEntryBase
>(config: OutboxConfig<TPayload, TSendInput, TEntry>): PersistentOutbox<TPayload, TEntry> {
  const { storageKey, logPrefix, makeEntry, parseEntry, send, toSendInput, onDrop } = config;
  const entryPrefix = `${storageKey}:entry:`;
  const knownEntryKeys = new Set<string>();
  const isFlushingUsers = new Set<string>();
  let sendOverride: ((entry: TEntry) => Promise<void>) | null = null;

  function entryKey(userId: string, id: string): string {
    return `${entryPrefix}${encodeURIComponent(userId)}:${encodeURIComponent(id)}`;
  }

  function parseStored(raw: string | null): TEntry | null {
    if (!raw) return null;
    try {
      return parseEntry(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }

  function listKeys(): string[] {
    const keys = new Set(knownEntryKeys);
    try {
      if (
        typeof localStorage.length === 'number' &&
        typeof localStorage.key === 'function'
      ) {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key?.startsWith(entryPrefix)) keys.add(key);
        }
      }
    } catch {
    }
    return [...keys];
  }

  function writeEntry(entry: TEntry): void {
    try {
      const key = entryKey(entry.userId, entry.id);
      localStorage.setItem(key, JSON.stringify(entry));
      knownEntryKeys.add(key);
    } catch {
    }
  }

  function migrateLegacyQueue(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(storageKey);
        return;
      }

      for (const element of parsed) {
        const legacyEntry = parseEntry(element);
        if (!legacyEntry) continue;
        const key = entryKey(legacyEntry.userId, legacyEntry.id);
        const current = parseStored(localStorage.getItem(key));
        if (
          !current ||
          current.enqueuedAt.localeCompare(legacyEntry.enqueuedAt) < 0
        ) {
          writeEntry(legacyEntry);
        }
      }
      localStorage.removeItem(storageKey);
    } catch {
      // Keep malformed/unavailable legacy storage untouched so a later
      // successful read can retry migration instead of destroying intents.
    }
  }

  function readEntries(userId?: string): TEntry[] {
    migrateLegacyQueue();
    const entries: TEntry[] = [];
    for (const key of listKeys()) {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        continue;
      }
      const entry = parseStored(raw);
      if (!entry) {
        try {
          localStorage.removeItem(key);
        } catch {
        }
        continue;
      }
      if (!userId || entry.userId === userId) entries.push(entry);
    }
    return entries;
  }

  function storedEntryMatches(entry: TEntry): boolean {
    try {
      const current = parseStored(
        localStorage.getItem(entryKey(entry.userId, entry.id))
      );
      return !!current && JSON.stringify(current) === JSON.stringify(entry);
    } catch {
      return false;
    }
  }

  function removeEntryIfUnchanged(entry: TEntry): boolean {
    if (!storedEntryMatches(entry)) return false;
    try {
      const key = entryKey(entry.userId, entry.id);
      localStorage.removeItem(key);
      knownEntryKeys.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  function dropEntry(entry: TEntry): void {
    if (!removeEntryIfUnchanged(entry)) return;
    if (DEBUG) {
      console.log(`${logPrefix} Dropping ${entry.id} (${entry.action})`);
    }
    if (onDrop) {
      try {
        onDrop({ entry });
      } catch (err) {
        if (DEBUG) {
          console.error(`${logPrefix} onDrop threw:`, err);
        }
      }
    }
  }

  function pruneUser(userId: string): void {
    const mine = readEntries(userId).sort((a, b) =>
      a.enqueuedAt.localeCompare(b.enqueuedAt)
    );
    if (mine.length <= MAX_ENTRIES_PER_USER) return;
    for (const entry of mine.slice(0, mine.length - MAX_ENTRIES_PER_USER)) {
      console.warn(
        `${logPrefix} Dropping oldest entry ${entry.id} (action=${entry.action}, attempts=${entry.attempts}) — per-user queue cap ${MAX_ENTRIES_PER_USER} reached`
      );
      removeEntryIfUnchanged(entry);
    }
  }

  function enqueue(
    userId: string,
    input: {
      action: string;
      payload: TPayload;
      dedupKey: string;
      extra?: Record<string, unknown>;
    }
  ): void {
    migrateLegacyQueue();
    const key = entryKey(userId, input.dedupKey);
    let previousAttempts = 0;
    try {
      previousAttempts =
        parseStored(localStorage.getItem(key))?.attempts ?? 0;
    } catch {
    }
    const entry = makeEntry(
      {
        userId,
        action: input.action,
        payload: input.payload,
        dedupKey: input.dedupKey,
        extra: input.extra,
      },
      previousAttempts
    );
    writeEntry(entry);
    pruneUser(userId);
  }

  async function flushUnlocked(
    userId: string,
    shouldContinue: () => boolean
  ): Promise<void> {
    if (isFlushingUsers.has(userId)) return;
    const mine = readEntries(userId).sort((a, b) =>
      a.enqueuedAt.localeCompare(b.enqueuedAt)
    );
    if (mine.length === 0) return;

    isFlushingUsers.add(userId);
    try {
      for (const entry of mine) {
        if (!shouldContinue()) break;
        if (!storedEntryMatches(entry)) continue;
        try {
          if (sendOverride) {
            await sendOverride(entry);
          } else {
            await send(toSendInput(entry));
          }
          if (!shouldContinue()) break;
          removeEntryIfUnchanged(entry);
        } catch (err) {
          if (!shouldContinue()) break;
          if (isUnauthorizedError(err) || isPermanentFailure(err)) {
            if (DEBUG) {
              console.log(
                `${logPrefix} Dropping ${entry.id} after permanent failure`
              );
            }
            dropEntry(entry);
          } else {
            const nextAttempts = entry.attempts + 1;
            if (nextAttempts >= MAX_ATTEMPTS) {
              if (DEBUG) {
                console.log(
                  `${logPrefix} Dropping ${entry.id} after ${nextAttempts} attempts`
                );
              }
              dropEntry(entry);
            } else if (storedEntryMatches(entry)) {
              writeEntry({ ...entry, attempts: nextAttempts });
            }
          }
        }
      }
    } finally {
      isFlushingUsers.delete(userId);
    }
  }

  async function flush(
    userId: string,
    shouldContinue: () => boolean = () => true
  ): Promise<void> {
    migrateLegacyQueue();
    if (!shouldContinue()) return;

    const locks =
      typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks && typeof locks.request === 'function') {
      try {
        await locks.request(
          `mosaic-outbox:${storageKey}:${userId}`,
          async () => {
            await flushUnlocked(userId, shouldContinue);
          }
        );
        return;
      } catch (error) {
        if (DEBUG) {
          console.warn(
            `${logPrefix} Web Lock unavailable; continuing with per-entry persistence:`,
            error
          );
        }
      }
    }

    await flushUnlocked(userId, shouldContinue);
  }

  function clear(userId?: string): void {
    migrateLegacyQueue();
    for (const entry of readEntries(userId)) {
      try {
        const key = entryKey(entry.userId, entry.id);
        localStorage.removeItem(key);
        knownEntryKeys.delete(key);
      } catch {
      }
    }
  }

  function size(userId?: string): number {
    return readEntries(userId).length;
  }

  function setSender(fn: (entry: TEntry) => Promise<void>): void {
    sendOverride = fn;
  }

  function resetForTests(): void {
    sendOverride = null;
    knownEntryKeys.clear();
    isFlushingUsers.clear();
  }

  return {
    setSender,
    enqueue,
    flush,
    clear,
    size,
    resetForTests,
  };
}

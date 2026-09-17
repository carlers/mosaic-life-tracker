import { isUnauthorizedError } from './authEvents';

const DEBUG = import.meta.env.DEV;
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES = 100;

/**
 * Structural base every outbox entry must satisfy. Deliberately does NOT
 * include `payload` — each module owns its entry shape (message-action
 * stores `payload`, social stores `op` + `revert`). The factory only
 * reads these five fields directly.
 */
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
  /**
   * Builds a fresh entry from the caller's enqueue input. `extra` is the
   * optional per-enqueue payload bag (e.g. social's `revert` info). It is
   * undefined when the caller did not supply one.
   */
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
  /** Validates one parsed JSON element. Return null to reject. */
  parseEntry: (raw: unknown) => TEntry | null;
  /** Default sender used when no override has been set. Throws on failure. */
  send: (input: TSendInput) => Promise<void>;
  /** Maps an entry to the default sender's input. */
  toSendInput: (entry: TEntry) => TSendInput;
  /** Optional decorator invoked on permanent drop / attempt exhaustion. */
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
  flush: (userId: string) => Promise<void>;
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

  let queue: TEntry[] = [];
  let isFlushing = false;
  let sendOverride: ((entry: TEntry) => Promise<void>) | null = null;

  function load(): void {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        queue = [];
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        queue = [];
        return;
      }
      const accepted: TEntry[] = [];
      for (const element of parsed) {
        const entry = parseEntry(element);
        if (entry) accepted.push(entry);
      }
      queue = accepted;
    } catch {
      queue = [];
    }
  }

  function save(): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(queue));
    } catch {
    }
  }

  function removeEntry(entry: TEntry): void {
    queue = queue.filter(
      (e) => !(e.id === entry.id && e.userId === entry.userId)
    );
  }

  function dropEntry(entry: TEntry): void {
    if (DEBUG) {
      console.log(`${logPrefix} Dropping ${entry.id} (${entry.action})`);
    }
    removeEntry(entry);
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

  function enqueue(
    userId: string,
    input: {
      action: string;
      payload: TPayload;
      dedupKey: string;
      extra?: Record<string, unknown>;
    }
  ): void {
    load();
    const existingIdx = queue.findIndex(
      (e) => e.userId === userId && e.id === input.dedupKey
    );
    const previousAttempts = existingIdx >= 0 ? queue[existingIdx].attempts : 0;
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
    if (existingIdx >= 0) {
      queue[existingIdx] = entry;
    } else {
      queue.push(entry);
    }
    if (queue.length > MAX_ENTRIES) {
      queue.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
      const dropped = queue.slice(0, queue.length - MAX_ENTRIES);
      for (const drop of dropped) {
        console.warn(
          `${logPrefix} Dropping oldest entry ${drop.id} (action=${drop.action}, attempts=${drop.attempts}) — queue cap ${MAX_ENTRIES} reached`
        );
      }
      queue = queue.slice(queue.length - MAX_ENTRIES);
    }
    save();
  }

  async function flush(userId: string): Promise<void> {
    if (isFlushing) return;
    load();
    const mine = queue.filter((e) => e.userId === userId);
    if (mine.length === 0) return;
    isFlushing = true;
    try {
      for (const entry of [...mine]) {
        try {
          if (sendOverride) {
            await sendOverride(entry);
          } else {
            await send(toSendInput(entry));
          }
          removeEntry(entry);
          save();
        } catch (err) {
          if (isUnauthorizedError(err) || isPermanentFailure(err)) {
            if (DEBUG) {
              console.log(
                `${logPrefix} Dropping ${entry.id} after permanent failure`
              );
            }
            dropEntry(entry);
            save();
          } else {
            const next = entry.attempts + 1;
            if (next >= MAX_ATTEMPTS) {
              if (DEBUG) {
                console.log(
                  `${logPrefix} Dropping ${entry.id} after ${next} attempts`
                );
              }
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

  function clear(userId?: string): void {
    load();
    if (userId) {
      queue = queue.filter((e) => e.userId !== userId);
    } else {
      queue = [];
    }
    save();
  }

  function size(userId?: string): number {
    load();
    if (userId) return queue.filter((e) => e.userId === userId).length;
    return queue.length;
  }

  function setSender(fn: (entry: TEntry) => Promise<void>): void {
    sendOverride = fn;
  }

  function resetForTests(): void {
    queue = [];
    sendOverride = null;
    isFlushing = false;
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

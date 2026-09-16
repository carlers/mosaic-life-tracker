import { isUnauthorizedError } from './authEvents';
const DEBUG = import.meta.env.DEV;
const STORAGE_KEY = 'mosaic_message_action_queue';
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES = 100;
export interface MessageActionSender {
  (payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}
interface QueuedEntry {
  id: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  attempts: number;
  enqueuedAt: string;
}
let sender: MessageActionSender | null = null;
export function setMessageActionSender(fn: MessageActionSender): void {
  sender = fn;
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
        typeof (e as QueuedEntry).payload === 'object'
    );
  } catch {
    queue = [];
  }
}
function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
  }
}
export function enqueueMessageAction(
  userId: string,
  input: {
    action: string;
    payload: Record<string, unknown>;
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
    payload: input.payload,
    attempts:
      existingIdx >= 0 ? queue[existingIdx].attempts : 0,
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
export async function flushMessageActionQueue(userId: string): Promise<void> {
  if (isFlushing) return;
  if (!sender) return;
  load();
  const mine = queue.filter((e) => e.userId === userId);
  if (mine.length === 0) return;
  isFlushing = true;
  try {
    for (const entry of [...mine]) {
      try {
        await sender({ action: entry.action, ...entry.payload });
        removeEntry(entry);
        save();
      } catch (err) {
        if (isUnauthorizedError(err) || isPermanentFailure(err)) {
          if (DEBUG) {
            console.log(
              `[MessageActionQueue] Dropping ${entry.id} after permanent failure`
            );
          }
          removeEntry(entry);
          save();
        } else {
          const next = entry.attempts + 1;
          if (next >= MAX_ATTEMPTS) {
            if (DEBUG) {
              console.log(
                `[MessageActionQueue] Dropping ${entry.id} after ${next} attempts`
              );
            }
            removeEntry(entry);
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
export function clearMessageActionQueue(userId?: string): void {
  load();
  if (userId) {
    queue = queue.filter((e) => e.userId !== userId);
  } else {
    queue = [];
  }
  save();
}
export function getMessageActionQueueSize(userId?: string): number {
  load();
  if (userId) return queue.filter((e) => e.userId === userId).length;
  return queue.length;
}
export function __resetQueueForTests(): void {
  queue = [];
  sender = null;
  isFlushing = false;
}

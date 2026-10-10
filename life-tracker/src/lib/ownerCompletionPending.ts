/**
 * Presentation-only receipts for creator completion on shared tasks. RxDB's
 * replicated local task remains the durable owner outbox; never replay these
 * receipts as a second writer.
 */
const PREFIX = 'mosaic_shared_owner_completion_v1:';
const MAX_ROWS = 1000;
const VALID_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
export interface OwnerCompletionPending {
  taskId: string;
  completed: boolean;
  updatedAt: string;
}
const listeners = new Set<() => void>();
function notify(): void { for (const listener of listeners) listener(); }

function key(userId: string): string { return PREFIX + userId; }

export function readOwnerCompletionPending(userId: string): OwnerCompletionPending[] {
  if (!VALID_ID.test(userId)) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    if (!Array.isArray(parsed) || parsed.length > MAX_ROWS) return [];
    if (!parsed.every((row: unknown) => {
      if (!row || typeof row !== 'object') return false;
      const candidate = row as Partial<OwnerCompletionPending>;
      return typeof candidate.taskId === 'string' && VALID_ID.test(candidate.taskId) &&
        typeof candidate.completed === 'boolean' &&
        typeof candidate.updatedAt === 'string' &&
        !Number.isNaN(Date.parse(candidate.updatedAt));
    })) return [];
    return parsed;
  } catch { return []; }
}

function save(userId: string, entries: OwnerCompletionPending[]): void {
  localStorage.setItem(key(userId), JSON.stringify(entries));
  notify();
}

/** Called BEFORE the owner task is patched locally, preventing a fast-sync race. */
export function markOwnerCompletionPending(
  userId: string, taskId: string, completed: boolean, updatedAt: string,
): OwnerCompletionPending | undefined {
  if (!VALID_ID.test(userId) || !VALID_ID.test(taskId) ||
      !Number.isFinite(Date.parse(updatedAt))) return undefined;
  const entries = readOwnerCompletionPending(userId);
  const previous = entries.find(row => row.taskId === taskId);
  // A larger offline queue should be surfaced through RxDB, not silently
  // truncated in this presentation-only receipt store.
  if (entries.length >= MAX_ROWS && !previous) return undefined;
  save(userId, [...entries.filter(row => row.taskId !== taskId),
    { taskId, completed, updatedAt }]);
  return previous;
}

/** Restore the last receipt when the local RxDB patch itself fails. */
export function restoreOwnerCompletionPending(
  userId: string, taskId: string, previous?: OwnerCompletionPending,
): void {
  const entries = readOwnerCompletionPending(userId).filter(row => row.taskId !== taskId);
  save(userId, previous ? [...entries, previous] : entries);
}

export function pendingOwnerCompletionIds(userId: string): Set<string> {
  return new Set(readOwnerCompletionPending(userId).map(row => row.taskId));
}

/**
 * Sent$ fires after successful owner replication; ignore an old send for a
 * newer local intent, including an opposite boolean toggle.
 */
export function acknowledgeOwnerCompletionSent(
  userId: string, task: { id: string; userId: string; completed: boolean; updatedAt: string },
): void {
  if (userId !== task.userId) return;
  const entries = readOwnerCompletionPending(userId);
  const pending = entries.find(row => row.taskId === task.id);
  if (!pending || pending.completed !== task.completed ||
      Date.parse(task.updatedAt) < Date.parse(pending.updatedAt)) return;
  save(userId, entries.filter(row => row.taskId !== task.id));
}

/** Conflict to remote master is visible through syncStatus, not "confirmed." */
export function rejectOwnerCompletionPending(userId: string, taskId: string): void {
  const entries = readOwnerCompletionPending(userId);
  if (entries.some(row => row.taskId === taskId)) {
    save(userId, entries.filter(row => row.taskId !== taskId));
  }
}

export function clearOwnerCompletionPending(userId: string): void {
  if (!VALID_ID.test(userId)) return;
  try { localStorage.removeItem(key(userId)); notify(); }
  catch { /* Local erasure is best effort; server identity is still fenced. */ }
}

export function subscribeOwnerCompletionPending(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(PREFIX)) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

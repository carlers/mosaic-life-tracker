/** Presentation receipts only; durable creator changes remain in RxDB replication. */
const PREFIX = 'mosaic_shared_owner_completion_v1:';
const VALID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const listeners = new Set<() => void>();
const key = (id: string) => PREFIX + id;
const notify = () => { for (const listener of listeners) listener(); };

export interface OwnerCompletionPending {
  taskId: string;
  completed: boolean;
  updatedAt: string;
}
function valid(row: unknown): row is OwnerCompletionPending {
  if (!row || typeof row !== 'object') return false;
  const x = row as Partial<OwnerCompletionPending>;
  return typeof x.taskId === 'string' && VALID.test(x.taskId) &&
    typeof x.completed === 'boolean' && typeof x.updatedAt === 'string' &&
    Number.isFinite(Date.parse(x.updatedAt));
}
export function readOwnerCompletionPending(userId: string): OwnerCompletionPending[] {
  if (!VALID.test(userId)) return [];
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(rows) && rows.length <= 1000 && rows.every(valid) ? rows : [];
  } catch { return []; }
}
function save(userId: string, rows: OwnerCompletionPending[]) {
  localStorage.setItem(key(userId), JSON.stringify(rows));
  notify();
}

/** Local cache is only a hint for a pending indicator, never share authority. */
export function hasCachedOwnedSharedTask(userId: string, taskId: string): boolean {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(
      'mosaic_shared_tasks_cache_v1:' + encodeURIComponent(userId) + ':owned'
    ) || '[]');
    return Array.isArray(rows) && rows.some(row =>
      row && typeof row === 'object' && row.taskId === taskId &&
      (row.status === 'pending' || row.status === 'accepted'));
  } catch { return false; }
}
export function markOwnerCompletionPending(
  userId: string, taskId: string, completed: boolean, updatedAt: string
): OwnerCompletionPending | undefined {
  if (!VALID.test(userId) || !VALID.test(taskId) || !Number.isFinite(Date.parse(updatedAt)))
    return undefined;
  const rows = readOwnerCompletionPending(userId);
  const previous = rows.find(x => x.taskId === taskId);
  if (rows.length >= 1000 && !previous) return undefined;
  save(userId, [...rows.filter(x => x.taskId !== taskId), { taskId, completed, updatedAt }]);
  return previous;
}
export function restoreOwnerCompletionPending(
  userId: string, taskId: string, previous?: OwnerCompletionPending
): void {
  const rows = readOwnerCompletionPending(userId).filter(x => x.taskId !== taskId);
  save(userId, previous ? [...rows, previous] : rows);
}
export function pendingOwnerCompletionIds(userId: string): Set<string> {
  return new Set(readOwnerCompletionPending(userId).map(x => x.taskId));
}
export function acknowledgeOwnerCompletionSent(
  userId: string, task: { id: string; userId: string; completed: boolean; updatedAt: string }
): void {
  if (userId !== task.userId) return;
  const rows = readOwnerCompletionPending(userId);
  const pending = rows.find(x => x.taskId === task.id);
  if (!pending || pending.completed !== task.completed ||
      !Number.isFinite(Date.parse(task.updatedAt)) ||
      Date.parse(task.updatedAt) < Date.parse(pending.updatedAt)) return;
  save(userId, rows.filter(x => x.taskId !== task.id));
}
export function rejectOwnerCompletionPending(userId: string, taskId: string): void {
  const rows = readOwnerCompletionPending(userId);
  if (rows.some(x => x.taskId === taskId)) save(userId, rows.filter(x => x.taskId !== taskId));
}
export function clearOwnerCompletionPending(userId: string): void {
  if (!VALID.test(userId)) return;
  try { localStorage.removeItem(key(userId)); notify(); } catch { /* local best effort */ }
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

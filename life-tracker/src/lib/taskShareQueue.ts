import { sendAppAction } from './appAction';
import { getConnectivitySnapshot } from './connectivity';

export interface SharedTaskItem {
  id: string;
  taskId: string;
  ownerId: string;
  inviteeId?: string;
  status: 'pending' | 'accepted';
  grantEpoch: string;
  membershipRevision: string;
  title: string;
  date: string;
  completed: boolean;
  completionRevision: string;
}

export interface SharedCompletionCommand {
  operationId: string;
  userId: string;
  ownerId: string;
  taskId: string;
  grantEpoch: string;
  expectedRevision: string;
  completed: boolean;
  enqueuedAt: number;
  attempts: number;
}

export interface SharedCommandResult {
  operationId: string;
  status: 'confirmed' | 'rejected' | 'pending';
  reason?: string;
}

const KEY = 'mosaic_shared_completion_queue_v1';
export interface SharedCompletionFailure {
  operationId: string;
  taskId: string;
  reason: string;
  rejectedAt: number;
}

const FAILURE_PREFIX = 'mosaic_shared_completion_failures_v1:';
const FAILURE_MAX = 20;

export function readSharedCompletionFailures(userId: string): SharedCompletionFailure[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAILURE_PREFIX + userId) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is SharedCompletionFailure =>
      Boolean(r && typeof r === 'object' &&
        typeof r.operationId === 'string' && ROW_ID.test(r.operationId) &&
        typeof r.taskId === 'string' && ROW_ID.test(r.taskId) &&
        typeof r.reason === 'string' && r.reason.length <= 150 &&
        typeof r.rejectedAt === 'number' &&
        Date.now() - r.rejectedAt <= TTL)).slice(-FAILURE_MAX);
  } catch { return []; }
}

function rememberSharedCompletionFailure(userId: string, command: SharedCompletionCommand, reason: string) {
  const prior = readSharedCompletionFailures(userId).filter(r => r.operationId !== command.operationId);
  localStorage.setItem(FAILURE_PREFIX + userId, JSON.stringify([...prior, {
    operationId: command.operationId,
    taskId: command.taskId,
    reason: reason.slice(0, 150),
    rejectedAt: Date.now(),
  }].slice(-FAILURE_MAX)));
  listeners.forEach(listener => listener());
}

export function acknowledgeSharedCompletionFailures(userId: string) {
  localStorage.removeItem(FAILURE_PREFIX + userId);
  listeners.forEach(listener => listener());
}

const TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const ROW_ID = /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/;

let activeUserId: string | null = null;
let activeGeneration = 0;
let serial = Promise.resolve();
const listeners = new Set<() => void>();

function validCommand(value: unknown): value is SharedCompletionCommand {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<SharedCompletionCommand>;
  return [c.operationId, c.userId, c.ownerId, c.taskId].every(
    id => typeof id === 'string' && ROW_ID.test(id)
  ) && typeof c.grantEpoch === 'string' && c.grantEpoch.length > 0 &&
    c.grantEpoch.length <= 50 && typeof c.expectedRevision === 'string' &&
    c.expectedRevision.length > 0 && c.expectedRevision.length <= 50 &&
    typeof c.completed === 'boolean' && typeof c.enqueuedAt === 'number' &&
    Number.isFinite(c.enqueuedAt) && Number.isInteger(c.attempts) &&
    c.attempts >= 0 && c.attempts <= MAX_ATTEMPTS;
}

function read(): SharedCompletionCommand[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(validCommand)) {
    throw new Error('Shared task queue is invalid; no commands were sent');
  }
  return parsed;
}

function save(commands: SharedCompletionCommand[]): void {
  // Do not swallow storage failures: the UI must never claim an action is queued
  // if the browser could not persist it.
  localStorage.setItem(KEY, JSON.stringify(commands));
  listeners.forEach(listener => listener());
}

export function subscribeSharedTaskQueue(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function scopeSharedTaskQueue(userId: string | null): void {
  activeUserId = userId;
  activeGeneration += 1;
}

export function pendingSharedCompletion(userId: string, taskId: string): SharedCompletionCommand | undefined {
  return read().find(c => c.userId === userId && c.taskId === taskId);
}

export function clearSharedCompletionQueue(userId?: string): void {
  activeGeneration += 1;
  save(read().filter(c => Boolean(userId) && c.userId !== userId));
  if (userId) acknowledgeSharedCompletionFailures(userId);
}

export function enqueueSharedCompletion(
  userId: string, item: SharedTaskItem, completed: boolean
): SharedCompletionCommand {
  if (activeUserId !== userId || !ROW_ID.test(userId) ||
      item.status !== 'accepted' || !ROW_ID.test(item.taskId) ||
      !ROW_ID.test(item.ownerId) || item.ownerId === userId ||
      typeof item.grantEpoch !== 'string' || item.grantEpoch.length > 50 ||
      !item.grantEpoch || !item.completionRevision) {
    throw new Error('Shared task membership is not ready for this account');
  }
  const commands = read();
  if (commands.some(c => c.userId === userId && c.taskId === item.taskId)) {
    throw new Error('Completion is already pending for this shared task');
  }
  const command: SharedCompletionCommand = {
    operationId: 'cmd_' + crypto.randomUUID().replaceAll('-', ''),
    userId, ownerId: item.ownerId, taskId: item.taskId,
    grantEpoch: item.grantEpoch, expectedRevision: item.completionRevision,
    completed, enqueuedAt: Date.now(), attempts: 0,
  };
  if (!validCommand(command)) throw new Error('Invalid completion command');
  save([...commands, command]);
  return command;
}

async function drain(userId: string): Promise<SharedCommandResult[]> {
  const generation = activeGeneration;
  const result: SharedCommandResult[] = [];
  for (const queued of read().filter(c => c.userId === userId)) {
    if (activeUserId !== userId || activeGeneration !== generation) return result;
    const current = read().find(c => c.operationId === queued.operationId);
    if (!current) continue;
    if (getConnectivitySnapshot().status !== 'online') {
      result.push({ operationId: current.operationId, status: 'pending' });
      return result;
    }
    if (Date.now() - current.enqueuedAt > TTL || current.attempts >= MAX_ATTEMPTS) {
      rememberSharedCompletionFailure(userId, current, 'Queued completion expired');
      save(read().filter(c => c.operationId !== current.operationId));
      result.push({ operationId: current.operationId, status: 'rejected', reason: 'Queued completion expired' });
      continue;
    }
    // Persist each dispatch attempt *before* performing it; network timeout is
    // not evidence that the server did not commit the first request.
    const attempt = { ...current, attempts: current.attempts + 1 };
    save(read().map(c => c.operationId === attempt.operationId ? attempt : c));
    try {
      const response = await sendAppAction({
        action: 'task_shares', operation: 'set_completed', taskId: attempt.taskId,
        ownerId: attempt.ownerId, grantEpoch: attempt.grantEpoch,
        completed: attempt.completed, expectedRevision: attempt.expectedRevision,
        operationId: attempt.operationId,
      });
      if (response.ok !== true || !response.item || typeof response.item !== 'object') {
        throw new Error('Invalid shared completion acknowledgment');
      }
      if (activeUserId !== userId || activeGeneration !== generation) return result;
      save(read().filter(c => c.operationId !== attempt.operationId));
      result.push({ operationId: attempt.operationId, status: 'confirmed' });
    } catch (error) {
      if (activeUserId !== userId || activeGeneration !== generation) return result;
      const code = (error as { code?: number }).code;
      const permanent = typeof code === 'number' && code >= 400 && code < 500 && code !== 408 && code !== 429;
      if (permanent || attempt.attempts >= MAX_ATTEMPTS) {
        const reason = code === 409 ? 'Completion changed. Refresh and retry.' :
          code === 403 || code === 404 ? 'Share is no longer available.' :
            'Could not synchronize completion.';
        rememberSharedCompletionFailure(userId, attempt, reason);
        save(read().filter(c => c.operationId !== attempt.operationId));
        result.push({ operationId: attempt.operationId, status: 'rejected', reason });
      } else {
        result.push({ operationId: attempt.operationId, status: 'pending' });
        return result;
      }
    }
  }
  return result;
}

export function flushSharedCompletions(userId: string): Promise<SharedCommandResult[]> {
  const run = () => activeUserId === userId
    ? (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(KEY + ':' + userId, () => drain(userId))
      : drain(userId))
    : Promise.resolve([]);
  const next = serial.catch(() => undefined).then(run);
  serial = next.then(() => undefined, () => undefined);
  return next;
}

export async function listSharedTasks(scope: 'owned' | 'received'): Promise<SharedTaskItem[]> {
  const items: SharedTaskItem[] = [];
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const response = await sendAppAction({
      action: 'task_shares', operation: 'list', scope, ...(cursor ? { cursor } : {}),
    });
    if (response.ok !== true || !Array.isArray(response.items)) {
      throw new Error('Invalid shared-task list response');
    }
    for (const item of response.items) {
      if (item && typeof item === 'object' && typeof item.taskId === 'string' &&
          typeof item.ownerId === 'string' && typeof item.title === 'string' &&
          typeof item.date === 'string' && typeof item.completed === 'boolean' &&
          (item.status === 'pending' || item.status === 'accepted') &&
          typeof item.grantEpoch === 'string' && typeof item.completionRevision === 'string' &&
          typeof item.membershipRevision === 'string' && typeof item.id === 'string') {
        items.push(item as SharedTaskItem);
      } else {
        throw new Error('Invalid shared-task entry');
      }
    }
    const nextCursor = response.nextCursor;
    if (typeof nextCursor !== 'string') throw new Error('Invalid shared-task cursor');
    if (!nextCursor) return items;
    if (nextCursor === cursor) throw new Error('Shared-task cursor did not advance');
    cursor = nextCursor;
  }
  throw new Error('Shared-task list exceeded page limit');
}

export async function changeSharedTaskMembership(payload: {
  operation: 'invite' | 'accept' | 'decline' | 'revoke' | 'leave';
  taskId: string;
  ownerId?: string;
  friendUserId?: string;
  grantEpoch?: string;
}): Promise<void> {
  const response = await sendAppAction({ action: 'task_shares', ...payload });
  if (response.ok !== true) throw new Error('Shared task action failed');
}

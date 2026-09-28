import { getDatabase } from '../db/database';
import type { FriendshipDocument } from '../db/schema';
import { fromAppwriteFormat } from './syncMapping';
import { sendMessageAction } from './messageDelivery';
import { clearCachedCalendar } from './friendCache';

export type FriendshipOperation = 'send' | 'accept' | 'decline' | 'cancel' | 'remove' | 'block';
export type FriendshipResult = { status: 'applied' | 'queued' };
export interface FriendshipCommand {
  id: string;
  ownerId: string;
  friendUserId: string;
  operation: FriendshipOperation;
  expectedVersion: string | null;
  dependsOn?: string;
  enqueuedAt: number;
  attempts: number;
  preview?: FriendshipDocument;
}
const KEY = 'mosaic_friendship_commands_v1';
const listeners = new Set<() => void>();
const failures = new Set<(userId: string, message: string) => void>();
let revision = 0;
let activeUser: string | null = null;
let generation = 0;
let serial: Promise<unknown> = Promise.resolve();
const changed = () => { revision++; listeners.forEach(fn => fn()); };
export const subscribeFriendshipCommands = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) changed(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
};
export const getFriendshipRevision = () => revision;
export const subscribeFriendshipFailures = (fn: (userId: string, message: string) => void) => { failures.add(fn); return () => { failures.delete(fn); }; };
export function scopeFriendshipCommands(userId: string | null) { activeUser = userId; generation++; }
function fail(userId: string, message: string) { failures.forEach(fn => fn(userId, message)); }
function readQueue(): FriendshipCommand[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('Invalid friendship queue');
  return entries.filter((e): e is FriendshipCommand => !!e && typeof e.id === 'string' &&
    typeof e.ownerId === 'string' && typeof e.friendUserId === 'string' &&
    ['send', 'accept', 'decline', 'cancel', 'remove', 'block'].includes(e.operation) &&
    (e.expectedVersion === null || typeof e.expectedVersion === 'string') &&
    typeof e.enqueuedAt === 'number' && typeof e.attempts === 'number');
}
function save(entries: FriendshipCommand[]) { localStorage.setItem(KEY, JSON.stringify(entries)); changed(); }
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = serial.catch(() => {}).then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(KEY, fn) : fn());
  serial = next;
  return next;
}
export function pendingFriendshipRows(userId: string): FriendshipDocument[] {
  try {
    return readQueue().filter(e => e.ownerId === userId && e.operation === 'send' && e.preview)
      .map(e => e.preview!);
  } catch { return []; } // Storage failure must not prevent cached/offline rendering.
}
export function pendingFriendshipCount(userId?: string): number {
  try { return readQueue().filter(e => !userId || e.ownerId === userId).length; }
  catch { return 0; }
}
export function clearFriendshipCommands(userId?: string) {
  // Logout invalidates in-flight callbacks before storage is cleared.
  generation++;
  save(readQueue().filter(e => userId && e.ownerId !== userId));
}
async function applyRow(userId: string, row: unknown, epoch: number) {
  if (activeUser !== userId || generation !== epoch || !row || typeof row !== 'object') return;
  const data = row as Record<string, unknown>;
  if (data.user_id !== userId) return;
  const doc = fromAppwriteFormat(data, 'friendships') as unknown as FriendshipDocument;
  const db = getDatabase();
  const current = await db.friendships.findOne(doc.id).exec();
  if (activeUser !== userId || generation !== epoch) return;
  if (current && current.updatedAt > doc.updatedAt) return;
  if (current) {
    await current.incrementalModify(latest => {
      if (activeUser !== userId || generation !== epoch || latest.updatedAt > doc.updatedAt) return latest;
      return { ...latest, ...doc };
    });
  } else {
    try { await db.friendships.insert(doc); }
    catch (error) {
      if ((error as { code?: string }).code !== 'CONFLICT') throw error;
      // Another delivery/pull inserted this row while the lookup was pending.
      const inserted = await db.friendships.findOne(doc.id).exec();
      if (inserted) await inserted.incrementalModify(latest =>
        activeUser === userId && generation === epoch && latest.updatedAt <= doc.updatedAt ? { ...latest, ...doc } : latest);
    }
  }
  if (doc.isDeleted || doc.status === 'blocked') await clearCachedCalendar(userId, doc.friendId);
}
async function drain(userId: string): Promise<void> {
  const epoch = generation;
  const blockedPairs = new Set<string>();
  for (const entry of readQueue().filter(e => e.ownerId === userId)) {
    if (activeUser !== userId || epoch !== generation) return;
    if (blockedPairs.has(entry.friendUserId)) continue;
    const current = readQueue().find(e => e.id === entry.id);
    if (!current) continue;
    try {
      if (Date.now() - current.enqueuedAt > 7 * 86400000) throw Object.assign(new Error('Queued request expired. Try again.'), { code: 409 });
      // Persist before dispatch: a lost response is an attempted command too.
      current.attempts++;
      save(readQueue().map(e => e.id === current.id ? current : e));
      const response = await sendMessageAction({ action: 'friendship', ownerId: current.ownerId,
        friendUserId: current.friendUserId, operation: current.operation, expectedVersion: current.expectedVersion });
      const confirmed = response.row as Record<string, unknown> | null;
      if (response.ok !== true || !confirmed || confirmed.user_id !== userId || confirmed.friend_id !== current.friendUserId || typeof confirmed.updated_at !== 'string') {
        throw Object.assign(new Error('Invalid friendship response. Try again.'), { code: 502 });
      }
      await applyRow(userId, confirmed, epoch);
      if (activeUser !== userId || epoch !== generation) return;
      const version = (response.row as { updated_at?: string } | null)?.updated_at ?? null;
      save(readQueue().filter(e => e.id !== current.id).map(e => e.dependsOn === current.id
        ? { ...e, expectedVersion: version, dependsOn: undefined } : e));
    } catch (error) {
      if (activeUser !== userId || epoch !== generation) return;
      const err = error as { code?: number; result?: { row?: unknown }; message?: string };
      if (err.result?.row) await applyRow(userId, err.result.row, epoch);
      const permanent = typeof err.code === 'number' && err.code >= 400 && err.code < 500 && err.code !== 429;
      if (permanent || current.attempts >= 5) {
        // Dependent intent must never acquire a new baseline after a stale predecessor.
        save(readQueue().filter(e => e.ownerId !== userId || e.friendUserId !== current.friendUserId));
        fail(userId, err.message || 'Friendship change failed. Refresh and try again.');
      } else blockedPairs.add(current.friendUserId);
    }
  }
}
export function flushFriendshipCommands(userId: string) { return locked(() => drain(userId)); }
export async function migrateLegacyFriendship(entry: {
  userId: string; action: string; enqueuedAt: string;
  op: { rowId: string; data: Record<string, unknown> };
}) {
  return locked(async () => {
    const { userId, op } = entry;
    const friend = op.data.user_id;
    const invalid = () => Object.assign(new Error('Old friendship change needs a fresh retry.'), { code: 409 });
    if (activeUser !== userId) throw new Error('Friendship account scope not ready');
    // Only a new send has an unambiguous absent-row baseline. Legacy updates
    // contain no target identity/version and must never be replayed blindly.
    if (entry.action !== 'send_request' || typeof friend !== 'string' || op.data.friend_id !== userId || op.data.status !== 'pending_incoming') throw invalid();
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${friend}|${userId}`));
    const expectedId = 'fr_' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    if (op.rowId !== expectedId) throw invalid();
    const enqueuedAt = Date.parse(entry.enqueuedAt);
    if (!Number.isFinite(enqueuedAt) || Date.now() - enqueuedAt > 7 * 86400000) throw invalid();
    const queue = readQueue();
    if (queue.some(e => e.ownerId === userId && e.friendUserId === friend)) return;
    save([...queue, { id: crypto.randomUUID(), ownerId: userId, friendUserId: friend,
      operation: 'send', expectedVersion: null, enqueuedAt, attempts: 0 }]);
  });
}
export async function executeFriendshipCommand(
  ownerId: string, friendUserId: string, operation: FriendshipOperation, preview?: FriendshipDocument
): Promise<FriendshipResult> {
  return locked(async () => {
    if (activeUser !== ownerId) throw new Error('Account changed. Try again.');
    const queue = readQueue();
    const related = queue.filter(e => e.ownerId === ownerId && e.friendUserId === friendUserId);
    const last = related.at(-1);
    if (last?.operation === operation) return { status: 'queued' };
    // A send which has never reached the server can be cancelled locally.
    if (operation === 'cancel' && related.length === 1 && last?.operation === 'send' && last.attempts === 0) {
      save(queue.filter(e => e.id !== last.id));
      return { status: 'applied' };
    }
    const epoch = generation;
    const local = await getDatabase().friendships.findOne({ selector: { userId: ownerId, friendId: friendUserId } }).exec();
    if (activeUser !== ownerId || generation !== epoch) throw new Error('Account changed.');
    const entry: FriendshipCommand = { id: crypto.randomUUID(), ownerId, friendUserId, operation,
      expectedVersion: local?.updatedAt || null, dependsOn: last?.id,
      enqueuedAt: Date.now(), attempts: 0, preview };
    if (queue.length >= 100) throw new Error('Too many pending friendship changes. Connect and retry.');
    save([...queue, entry]);
    let failure: string | undefined;
    const stop = subscribeFriendshipFailures((uid, message) => { if (uid === ownerId) failure = message; });
    try { await drain(ownerId); } finally { stop(); }
    if (failure) throw new Error(failure);
    if (activeUser !== ownerId) throw new Error('Account changed.');
    return { status: readQueue().some(e => e.id === entry.id) ? 'queued' : 'applied' };
  });
}

/**
 * Read-only best-effort snapshot of the three CURRENT historical queue formats.
 * Does not inspect RxDB, IndexedDB, image cache or older unrecognized namespaces.
 * Never mutate, migrate, discard, replay or send a pending legacy operation.
 */
import type { Bytes, Owner } from './coreCrypto';
import {
  encryptPendingLegacyIntents, type PendingLegacyIntent, type RecoverableQueue,
} from './legacyPendingRecovery';

type QueueStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
type RawSnapshot = Map<string, string>;
const SOCIAL = 'mosaic_social_outbox';
const MESSAGES = 'mosaic_message_action_queue';
const FRIENDSHIPS = 'mosaic_friendship_commands_v1';
const MAX_STORAGE_KEYS = 20_000;
const MAX_QUEUE_BYTES = 1_048_576;
const MAX_QUEUE_ITEMS = 500;

function blocked(): never {
  throw new Error('Offline pending-queue snapshot incomplete or inconsistent.');
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isQueueKey(key: string): boolean {
  return key === FRIENDSHIPS ||
    key === SOCIAL || key.startsWith(SOCIAL + ':entry:') ||
    key === MESSAGES || key.startsWith(MESSAGES + ':entry:');
}
function readRaw(storage: QueueStorage): RawSnapshot {
  const result: RawSnapshot = new Map();
  const count = storage.length;
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_STORAGE_KEYS) blocked();
  let bytes = 0;
  for (let i = 0; i < count; i++) {
    const key = storage.key(i);
    if (typeof key !== 'string') blocked();
    if (!isQueueKey(key)) continue;
    if (result.has(key)) blocked();
    const value = storage.getItem(key);
    if (typeof value !== 'string') blocked();
    bytes += key.length + value.length;
    if (bytes > MAX_QUEUE_BYTES) blocked();
    result.set(key, value);
  }
  if (storage.length !== count) blocked();
  return result;
}
function unchanged(a: RawSnapshot, b: RawSnapshot): boolean {
  return a.size === b.size &&
    [...a].every(([key, value]) => b.get(key) === value);
}
function parseArray(raw: string): unknown[] {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return blocked(); }
  if (!Array.isArray(value) || value.length > MAX_QUEUE_ITEMS) blocked();
  return value;
}
function parseRecord(raw: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return blocked(); }
  if (!record(value)) blocked();
  return value;
}
function validate(queue: RecoverableQueue, value: unknown, ownerId: string): value is Record<string, unknown> {
  if (!record(value) || typeof value.id !== 'string' || !value.id) blocked();
  if (queue === 'friendship') {
    if (value.ownerId !== ownerId || value.userId !== undefined ||
      !['send', 'accept', 'decline', 'cancel', 'remove', 'block'].includes(String(value.operation)) ||
      typeof value.friendUserId !== 'string' || !value.friendUserId ||
      (value.expectedVersion !== null && typeof value.expectedVersion !== 'string') ||
      !Number.isSafeInteger(value.attempts) || (value.attempts as number) < 0 ||
      typeof value.enqueuedAt !== 'number' || !Number.isFinite(value.enqueuedAt))
      blocked();
  } else {
    const body = queue === 'social' ? value.op : value.payload;
    if (value.userId !== ownerId || value.ownerId !== undefined ||
      typeof value.action !== 'string' || !value.action ||
      !record(body) || !Number.isSafeInteger(value.attempts) ||
      (value.attempts as number) < 0 || typeof value.enqueuedAt !== 'string')
      blocked();
  }
  return true;
}
function readOwnerKey(key: string, base: string): { userId: string; id: string } {
  const suffix = key.slice((base + ':entry:').length);
  const colon = suffix.indexOf(':');
  if (colon < 1 || colon === suffix.length - 1) blocked();
  try {
    const userId = decodeURIComponent(suffix.slice(0, colon));
    const id = decodeURIComponent(suffix.slice(colon + 1));
    if (!userId || !id ||
      key !== base + ':entry:' + encodeURIComponent(userId) + ':' + encodeURIComponent(id)) blocked();
    return { userId, id };
  } catch { return blocked(); }
}
/**
 * Returns only verified pending actions of the requested owner from the known
 * current localStorage layouts. Malformed or conflicting owner entries cause
 * total failure, never a partial "successful" export.
 *
 * An unrelated account's entries are not returned. No claim of historical
 * binary coverage or a stable cross-tab transaction is made.
 */
export function snapshotOwnerPendingQueues(owner: Owner, storage: QueueStorage): readonly PendingLegacyIntent[] {
  if (!owner?.projectId || !owner?.ownerId) blocked();
  owner=Object.freeze({projectId:owner.projectId,ownerId:owner.ownerId});
  const raw = readRaw(storage);
  const output = new Map<string, PendingLegacyIntent>();
  function accept(queue: RecoverableQueue, value: unknown, sourceId?: string): void {
    if (!record(value)) blocked();
    const idOwner = queue === 'friendship' ? value.ownerId : value.userId;
    if (typeof idOwner !== 'string' || !idOwner) blocked();
    if (idOwner !== owner.ownerId) return;
    if (!validate(queue, value, owner.ownerId)) blocked();
    if (sourceId !== undefined && value.id !== sourceId) blocked();
    const key = queue + '/' + value.id;
    const old = output.get(key);
    if (old) {
      if (JSON.stringify(old.record) !== JSON.stringify(value)) blocked();
      return;
    }
    output.set(key, { queue, record: value });
    if (output.size > MAX_QUEUE_ITEMS) blocked();
  }
  for (const [base, queue] of [
    [SOCIAL, 'social'], [MESSAGES, 'message-action'],
  ] as const) {
    if (raw.has(base)) {
      for (const item of parseArray(raw.get(base)!)) accept(queue, item);
    }
    const prefix = base + ':entry:';
    for (const [key, value] of raw) {
      if (!key.startsWith(prefix)) continue;
      const parsedKey = readOwnerKey(key, base);
      if (parsedKey.userId !== owner.ownerId) {
        // Other-account data is excluded, but an owner-owned record filed
        // under someone else's key cannot be silently omitted from recovery.
        let foreign: unknown;
        try { foreign = JSON.parse(value); } catch { continue; }
        if (record(foreign) && foreign.userId === owner.ownerId) blocked();
        continue;
      }
      const item = parseRecord(value);
      if (item.userId !== parsedKey.userId) blocked();
      accept(queue, item, parsedKey.id);
    }
  }
  if (raw.has(FRIENDSHIPS)) {
    for (const item of parseArray(raw.get(FRIENDSHIPS)!)) accept('friendship', item);
  }
  if (!unchanged(raw, readRaw(storage))) blocked();
  return [...output.values()];
}

/**
 * No writes to storage; no network. Re-read before returning encrypted data so
 * a changed queue cannot be silently represented as a complete capture.
 */
export async function sealOwnerPendingQueueSnapshot(
  owner: Owner, root: Bytes, storage: QueueStorage,
): Promise<string> {
  if(!owner?.projectId||!owner?.ownerId||
     !(root instanceof Uint8Array)||root.byteLength!==32)blocked();
  owner=Object.freeze({projectId:owner.projectId,ownerId:owner.ownerId});
  const secret=root.slice();
  try{
    const before = readRaw(storage);
    const entries = snapshotOwnerPendingQueues(owner, storage);
    const sealed = await encryptPendingLegacyIntents(owner, secret, entries);
    if (!unchanged(before, readRaw(storage))) blocked();
    return sealed;
  }finally{secret.fill(0);}
}

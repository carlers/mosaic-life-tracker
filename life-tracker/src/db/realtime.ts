import { clearCachedCalendar } from '../lib/friendCache';
import { getDatabase, type AppDatabaseCollections } from './database';
import { guardedRealtime, type RealtimeUnsubscribe } from '../lib/sdk';
import { fromAppwriteFormat } from '../lib/syncMapping';
import type { RxCollection } from 'rxdb';
import { APPWRITE_DATABASE_ID, APPWRITE_TABLES } from '../lib/appwriteConfig';

const DEBUG = import.meta.env.DEV;

// Same table-name map as sync.ts. Kept duplicated (rather than imported)
// because importing sync.ts from realtime.ts would create a cycle once
// sync.ts wants to schedule a sync on a realtime event. The map is
// small and stable — sync.ts is the canonical source, this is a mirror.
const TABLES: Record<keyof AppDatabaseCollections, string> = {
  tasks: APPWRITE_TABLES.tasks,
  categories: APPWRITE_TABLES.categories,
  diary: APPWRITE_TABLES.diary,
  settings: APPWRITE_TABLES.settings,
  friendships: APPWRITE_TABLES.friendships,
  messages: APPWRITE_TABLES.messages,
};

const ALL_COLLECTIONS: (keyof AppDatabaseCollections)[] = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
];

// Appwrite Realtime event strings look like:
//   databases.<db>.tables.<table>.rows.<rowId>.create|update|delete
// We only need the row id and the verb.
function parseRowEvent(event: string): {
  rowId: string;
  verb: 'create' | 'update' | 'delete';
} | null {
  const parts = event.split('.');
  if (parts.length < 6) return null;
  const rowId = parts[parts.length - 2];
  const verb = parts[parts.length - 1];
  if (
    verb !== 'create' &&
    verb !== 'update' &&
    verb !== 'delete'
  ) {
    return null;
  }
  if (!rowId) return null;
  return { rowId, verb };
}

// RxDB internal keys that must never reach `incrementalPatch`.
const RXDB_META_KEYS = new Set(['_meta', '_rev', '_attachments', '_deleted']);

function stripRxMeta(
  doc: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(doc)) {
    if (RXDB_META_KEYS.has(key)) continue;
    out[key] = doc[key];
  }
  return out;
}

// Apply one incoming row payload to the local collection.
//
// Semantics mirror the sync engine's pull loop (docs/PROJECT_REFERENCE.md §18):
//   - Incoming update: read the local doc. If it is locally dirty
//     (its `_meta.lwt` is newer than the last sync's dirty boundary),
//     skip the apply EXCEPT for `messages.read_at` on outgoing rows —
//     the server owns that field (§12), so it is always applied.
//   - Incoming create: upsert; RxDB CONFLICT is preserved (a local
//     insert landed in the meantime) and is not an error (§10).
//   - Incoming delete (tombstone): apply as a soft-delete via
//     `incrementalPatch({ isDeleted: true })` if the local doc exists.
//     The next pull cycle will fill in `updatedAt`; the realtime
//     payload carries it, but reusing the pull path is simpler and the
//     row will be reconciled either way.
//
// The function is deliberately conservative: it never throws. A failure
// is logged and dropped; the next sync cycle is the safety net.
async function applyRowEvent(
  colName: keyof AppDatabaseCollections,
  verb: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  if (activeUserId !== userId || payload.user_id !== userId) return;
  let db;
  try {
    db = getDatabase();
  } catch (err) {
    if (DEBUG) {
      console.warn('[realtime] DB not ready, dropping event:', err);
    }
    return;
  }
  const collection = db[colName] as unknown as RxCollection<
    Record<string, unknown>
  >;
  const doc = fromAppwriteFormat(payload, colName);
  const docId = (doc.id as string) || '';
  if (!docId) return;

  if (verb === 'delete') {
    try {
      const local = await collection.findOne(docId).exec();
      if (activeUserId !== userId) return;
      if (!local) return;
      const localDoc = local as unknown as {
        incrementalPatch: (
          updates: Record<string, unknown>
        ) => Promise<unknown>;
      };
      await localDoc.incrementalPatch({ isDeleted: true });
      if (colName === 'friendships' && typeof doc.friendId === 'string') await clearCachedCalendar(userId, doc.friendId);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'CONFLICT') {
        console.error(
          `[realtime] delete apply failed for ${colName} ${docId}:`,
          err
        );
      }
    }
    return;
  }

  try {
    const local = await collection.findOne(docId).exec();
    if (activeUserId !== userId) return;
    if (!local) {
      try {
        await collection.upsert(doc);
        if (colName === 'friendships' && (doc.isDeleted || doc.status === 'blocked') && typeof doc.friendId === 'string') await clearCachedCalendar(userId, doc.friendId);
      } catch (upsertErr) {
        const code = (upsertErr as { code?: string })?.code;
        if (code !== 'CONFLICT') {
          console.error(
            `[realtime] create apply failed for ${colName} ${docId}:`,
            upsertErr
          );
        }
      }
      return;
    }

    const localDoc = local as unknown as {
      toJSON: () => Record<string, unknown>;
      incrementalPatch: (
        updates: Record<string, unknown>
      ) => Promise<unknown>;
    };
    const localJson = localDoc.toJSON();

    // Server-owned read_at on outgoing messages: applied regardless of
    // dirty state (§12, and mirrors sync.ts's F12 branch).
    if (colName === 'messages' && payload.direction === 'outgoing') {
      const remoteReadAt = (payload.read_at as string) || '';
      const localReadAt = (localJson.readAt as string) || '';
      if (remoteReadAt && remoteReadAt !== localReadAt) {
        try {
          await localDoc.incrementalPatch({ readAt: remoteReadAt });
        } catch (err) {
          if (DEBUG) {
            console.warn(
              '[realtime] read_at patch failed for',
              docId,
              err
            );
          }
        }
      }
    }

    // Full update. Preserve the same local-dirty guard as the pull loop
    // only for non-server-owned fields. Because we do not have the sync
    // engine's dirty boundary here, use the conservative rule: if the
    // incoming `updatedAt` is not newer than the local `updatedAt`, skip.
    // For `messages`, read_at was already handled above; the rest of the
    // row is either local-optimistic (content etc.) or server-confirmed.
    const localUpdatedAt = (localJson.updatedAt as string) || '';
    const remoteUpdatedAt = (doc.updatedAt as string) || '';
    if (
      localUpdatedAt &&
      remoteUpdatedAt &&
      remoteUpdatedAt <= localUpdatedAt
    ) {
      return;
    }

    if (colName === 'friendships') {
      await local.incrementalModify((latest) => {
        if (activeUserId !== userId || String(latest.updatedAt || '') > String(doc.updatedAt || '')) return latest;
        return { ...latest, ...stripRxMeta(doc) };
      });
      if ((doc.isDeleted || doc.status === 'blocked') && typeof doc.friendId === 'string') await clearCachedCalendar(userId, doc.friendId);
      return;
    }

    const patch = stripRxMeta(doc);
    // Never let a realtime update clobber the server-owned read_at on an
    // outgoing message with the (empty) client value — sync.ts omits it
    // on push, and the same rule applies here.
    if (colName === 'messages' && payload.direction === 'outgoing') {
      delete patch.readAt;
    }
    try {
      await localDoc.incrementalPatch(patch);
    } catch (patchErr) {
      const code = (patchErr as { code?: string })?.code;
      if (code === 'CONFLICT') {
        // A local edit landed between findOne and patch; leave it for
        // the next sync cycle to reconcile (same policy as §18 F13).
        return;
      }
      console.error(
        `[realtime] update apply failed for ${colName} ${docId}:`,
        patchErr
      );
    }
  } catch (err) {
    console.error(`[realtime] apply failed for ${colName} ${docId}:`, err);
  }
}

let activeUnsubscribes: RealtimeUnsubscribe[] = [];
let activeUserId: string | null = null;

// Opens a realtime subscription for every collection that belongs to the
// current user. The channels are table-scoped; row-read permissions limit
// delivery to the caller's own rows. Cross-user delivery (recipient's
// `rmsg_*` row) works because the caller has `read` on that row.
export function startRealtime(userId: string): void {
  if (!userId) return;
  if (activeUserId === userId && activeUnsubscribes.length > 0) return;
  stopRealtime();
  activeUserId = userId;

  for (const colName of ALL_COLLECTIONS) {
    const tableId = TABLES[colName];
    const channel = `databases.${APPWRITE_DATABASE_ID}.tables.${tableId}.rows`;
    const unsubscribe = guardedRealtime.subscribe(
      channel,
      (msg) => {
        const events = Array.isArray(msg?.events) ? msg.events : [];
        const payload = msg?.payload;
        if (!payload || typeof payload !== 'object') return;
        for (const event of events) {
          const parsed = parseRowEvent(event);
          if (!parsed) continue;
          // Fire and forget; applyRowEvent never throws.
          void applyRowEvent(colName, parsed.verb, payload, userId);
        }
      }
    );
    activeUnsubscribes.push(unsubscribe);
  }

  if (DEBUG) {
    console.log(
      `[realtime] subscribed to ${activeUnsubscribes.length} channels for user ${userId}`
    );
  }
}

export function stopRealtime(): void {
  for (const unsub of activeUnsubscribes) {
    try {
      unsub();
    } catch (err) {
      console.error('[realtime] unsubscribe failed:', err);
    }
  }
  activeUnsubscribes = [];
  activeUserId = null;
}

export function __resetRealtimeForTests(): void {
  activeUnsubscribes = [];
  activeUserId = null;
}

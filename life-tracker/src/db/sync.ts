import { getDatabase, type AppDatabaseCollections } from './database';
import { client, account } from '../lib/appwrite';
import { TablesDB, Permission, Role, Query } from 'appwrite';

const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  databaseId: 'life_tracker',
  tables: {
    tasks: 'tasks',
    categories: 'categories',
    diary: 'diary',
    settings: 'settings',
    friendships: 'friendships',
    messages: 'messages',
  },
} as const;

const tablesDB = new TablesDB(client);
const DEBUG = import.meta.env.DEV;
const PAGE_SIZE = 100;

const PULL_OVERLAP_MS = 30_000;

const RATE_LIMIT_BASE_MS = 5_000;
const RATE_LIMIT_MAX_MS = 60_000;

const TRIGGER_DEBOUNCE_MS = 1_500;

type CollectionName = keyof AppDatabaseCollections;

const ALL_COLLECTIONS: CollectionName[] = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
];

interface PerCollectionSyncEntry {
  // ISO timestamp. Lower bound for this collection's delta pull:
  // `$updatedAt > pull - PULL_OVERLAP_MS`. Set to the start of the last
  // cycle for this collection whose pull phase succeeded.
  pull: string;
  // ISO timestamp. Threshold for `isLocalDirty`. Set to the end of the last
  // fully-successful (pull + push) cycle so rows upserted during that cycle
  // are not considered dirty on the next one.
  dirty: string;
}

// S1-1: persisted state is namespaced by user id. Cross-user state leakage
// on a shared browser would otherwise cause a new user's first sync to skip
// rows older than the previous user's last pull.
interface PerCollectionPersistedState {
  ownerId: string;
  entries: Partial<Record<CollectionName, PerCollectionSyncEntry>>;
}

const PER_COLLECTION_KEY = 'lastSyncTimePerCollection';

function loadPerCollectionState(
  userId: string
): Partial<Record<CollectionName, PerCollectionSyncEntry>> {
  try {
    const raw = localStorage.getItem(PER_COLLECTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const state = parsed as Partial<PerCollectionPersistedState>;
    // Mismatched owner (user switch) or legacy shape (pre-S1-1 persisted as
    // a bare entries map). Either way, treat as fresh → full pull.
    if (state.ownerId !== userId) return {};
    if (!state.entries || typeof state.entries !== 'object') return {};
    return state.entries as Partial<
      Record<CollectionName, PerCollectionSyncEntry>
    >;
  } catch {
    return {};
  }
}

function savePerCollectionState(
  userId: string,
  entries: Partial<Record<CollectionName, PerCollectionSyncEntry>>
): void {
  try {
    const state: PerCollectionPersistedState = { ownerId: userId, entries };
    localStorage.setItem(PER_COLLECTION_KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
}

let perCollectionSync: Partial<
  Record<CollectionName, PerCollectionSyncEntry>
> = {};
let perCollectionOwnerId: string | null = null;

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  errors: string[];
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  lastSync: localStorage.getItem('lastSyncTime') || null,
  errors: [],
};

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

type SyncListener = (status: SyncStatus) => void;
const listeners: SyncListener[] = [];

function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  if (syncStatus.lastSync) {
    localStorage.setItem('lastSyncTime', syncStatus.lastSync);
  }
  listeners.forEach((l) => l(syncStatus));
  if (DEBUG) console.log('[Sync] Status:', syncStatus);
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.push(listener);
  listener(syncStatus);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

type AppwriteRow = Record<string, unknown>;
type AppwritePayload = Record<string, unknown>;

type LocalDoc = {
  id: string;
  _meta?: { lwt?: number };
  toJSON: () => Record<string, unknown>;
  incrementalPatch: (updates: Record<string, unknown>) => Promise<unknown>;
};

type LocalCollection = {
  findOne: (id: string) => { exec: () => Promise<LocalDoc | null> };
  find: () => { exec: () => Promise<LocalDoc[]> };
  upsert: (doc: Record<string, unknown>) => Promise<unknown>;
};

let isSyncInProgress = false;
let rateLimitUntil = 0;
let rateLimitBackoffMs = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

declare global {
  interface Window {
    __mosaicFocusSyncAttached?: boolean;
  }
}

function isTimestampedCollection(collection: string): boolean {
  return (
    collection === 'tasks' ||
    collection === 'diary' ||
    collection === 'friendships' ||
    collection === 'messages'
  );
}

function isRateLimitError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit/i.test(msg);
}

function isNotFoundError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  return code === 404;
}

function toAppwriteFormat(
  doc: Record<string, unknown>,
  collection: string,
  userId: string
): AppwritePayload {
  const source: Record<string, unknown> = { ...doc };
  delete source._meta;
  delete source._deleted;
  delete source._rev;

  const mapped: AppwritePayload = {};

  if (collection === 'tasks') {
    mapped.title = source.title || '';
    mapped.is_completed = source.completed ?? false;
    mapped.category_id = source.categoryId || '';
    mapped.tags = source.tags || '';
    mapped.date = source.date || '';
    mapped.memo = source.memo || '';
    mapped.image = source.image || '';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.completed_at = source.completedAt || '';
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.visibility = source.visibility ?? '';
    mapped.source = source.source || '';
    mapped.routine_id = source.routineId || '';
    mapped.reminder_time = source.reminderTime || '';
    mapped.reactions = source.reactions || '';
  } else if (collection === 'categories') {
    mapped.name = source.name || '';
    mapped.color = source.color || '#3B82F6';
    mapped.visibility = source.visibility || 'private';
    mapped.order = source.order ?? 0;
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.icon = source.icon || '';
  } else if (collection === 'diary') {
    mapped.date = source.date || '';
    mapped.content = source.content || '';
    mapped.visibility = source.visibility || 'private';
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
  } else if (collection === 'settings') {
    mapped.user_id = userId;
    mapped.key = source.key || '';
    mapped.value = source.value || '';
    mapped.deleted = source.isDeleted ?? false;
  } else if (collection === 'friendships') {
    mapped.user_id = userId;
    mapped.friend_id = source.friendId || '';
    mapped.friend_username = source.friendUsername || '';
    mapped.friend_display_name = source.friendDisplayName || '';
    mapped.friend_avatar_file_id = source.friendAvatarFileId || '';
    mapped.friend_bio = source.friendBio || '';
    mapped.status = source.status || 'pending_outgoing';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.deleted = source.isDeleted ?? false;
  } else if (collection === 'messages') {
    mapped.user_id = userId;
    mapped.thread_id = source.threadId || '';
    mapped.sender_id = source.senderId || '';
    mapped.recipient_id = source.recipientId || '';
    mapped.direction = source.direction || 'outgoing';
    mapped.content = source.content || '';
    mapped.task_ref_id = source.taskRefId || '';
    mapped.task_ref_title = source.taskRefTitle || '';
    mapped.task_ref_date = source.taskRefDate || '';
    mapped.task_ref_color = source.taskRefColor || '';
    mapped.reply_to_id = source.replyToId || '';
    mapped.reply_to_content = source.replyToContent || '';
    mapped.reply_to_sender_id = source.replyToSenderId || '';
    mapped.is_unsent = source.isUnsent ?? false;
    mapped.original_message_id = source.originalMessageId || '';
    mapped.reactions = source.reactions || '';
    if (source.direction !== 'outgoing') {
      mapped.read_at = source.readAt || '';
    }
    mapped.delivery_status = source.deliveryStatus || 'delivered';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.deleted = source.isDeleted ?? false;
  }

  return mapped;
}

function fromAppwriteFormat(
  row: AppwriteRow,
  collection: string
): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...row };
  delete mapped.$id;
  delete mapped.$createdAt;
  delete mapped.$updatedAt;
  delete mapped.$permissions;
  delete mapped.$databaseId;
  delete mapped.$tableId;
  delete mapped.$sequence;

  if (collection === 'tasks') {
    mapped.id = row.$id || mapped.id;
    mapped.completed = mapped.is_completed ?? false;
    mapped.categoryId = mapped.category_id || '';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.completedAt = mapped.completed_at || '';
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.visibility = (row.visibility as string) ?? '';
    mapped.source = row.source || '';
    mapped.tags = row.tags || '';
    mapped.memo = row.memo || '';
    mapped.image = row.image || '';
    mapped.routineId = row.routine_id || '';
    mapped.reminderTime = row.reminder_time || '';
    mapped.reactions = row.reactions || '';
    delete mapped.is_completed;
    delete mapped.category_id;
    delete mapped.created_at;
    delete mapped.completed_at;
    delete mapped.updated_at;
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.routine_id;
    delete mapped.reminder_time;
  } else if (collection === 'categories') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.icon = row.icon || '';
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'diary') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.content = row.content || '';
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.created_at;
    delete mapped.updated_at;
  } else if (collection === 'settings') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'friendships') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.friendId = mapped.friend_id || '';
    mapped.friendUsername = mapped.friend_username || '';
    mapped.friendDisplayName = mapped.friend_display_name || '';
    mapped.friendAvatarFileId = mapped.friend_avatar_file_id || '';
    mapped.friendBio = mapped.friend_bio || '';
    mapped.status = mapped.status || 'pending_outgoing';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.friend_id;
    delete mapped.friend_username;
    delete mapped.friend_display_name;
    delete mapped.friend_avatar_file_id;
    delete mapped.friend_bio;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.deleted;
  } else if (collection === 'messages') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.threadId = mapped.thread_id || '';
    mapped.senderId = mapped.sender_id || '';
    mapped.recipientId = mapped.recipient_id || '';
    mapped.direction = mapped.direction || 'outgoing';
    mapped.content = mapped.content || '';
    mapped.taskRefId = mapped.task_ref_id || '';
    mapped.taskRefTitle = mapped.task_ref_title || '';
    mapped.taskRefDate = mapped.task_ref_date || '';
    mapped.taskRefColor = mapped.task_ref_color || '';
    mapped.replyToId = mapped.reply_to_id || '';
    mapped.replyToContent = mapped.reply_to_content || '';
    mapped.replyToSenderId = mapped.reply_to_sender_id || '';
    mapped.isUnsent = mapped.is_unsent ?? false;
    mapped.originalMessageId = mapped.original_message_id || '';
    mapped.reactions = mapped.reactions || '';
    mapped.readAt = mapped.read_at || '';
    mapped.deliveryStatus = mapped.delivery_status || 'delivered';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.thread_id;
    delete mapped.sender_id;
    delete mapped.recipient_id;
    delete mapped.task_ref_id;
    delete mapped.task_ref_title;
    delete mapped.task_ref_date;
    delete mapped.task_ref_color;
    delete mapped.reply_to_id;
    delete mapped.reply_to_content;
    delete mapped.reply_to_sender_id;
    delete mapped.is_unsent;
    delete mapped.original_message_id;
    delete mapped.read_at;
    delete mapped.delivery_status;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.deleted;
  }

  return mapped;
}

function buildRowPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function toMs(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const user = await account.get();
    return user?.$id || null;
  } catch (err) {
    if (DEBUG) console.log('[Sync] account.get() failed:', err);
    return null;
  }
}

export async function initializeSync(): Promise<void> {
  if (isSyncInProgress) {
    if (DEBUG)
      console.log('[Sync] initializeSync skipped: sync already in progress');
    return;
  }

  if (Date.now() < rateLimitUntil) {
    if (DEBUG) {
      console.log(
        `[Sync] Skipping: rate-limit backoff until ${new Date(
          rateLimitUntil
        ).toISOString()}`
      );
    }
    updateSyncStatus({ isSyncing: false });
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (DEBUG) console.log('[Sync] Offline, skipping sync');
    updateSyncStatus({ isSyncing: false });
    return;
  }

  isSyncInProgress = true;
  if (DEBUG) console.log('[Sync] Starting sync...');
  updateSyncStatus({ isSyncing: true, errors: [] });

  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      if (DEBUG) console.log('[Sync] No authenticated user, skipping sync');
      updateSyncStatus({ isSyncing: false });
      return;
    }

    // S1-1: (re)load per-collection high-water marks for this user. A
    // mismatch (different user, or legacy shape from before this fix) yields
    // an empty map, which makes the first cycle a full pull for this user.
    if (perCollectionOwnerId !== userId) {
      perCollectionSync = loadPerCollectionState(userId);
      perCollectionOwnerId = userId;
      if (DEBUG) {
        console.log(
          `[Sync] Loaded per-collection state for user ${userId}:`,
          Object.keys(perCollectionSync)
        );
      }
    }

    const db = getDatabase();
    const collectionErrors: string[] = [];
    let sawRateLimit = false;

    for (const colName of ALL_COLLECTIONS) {
      try {
        await syncCollection(
          db[colName] as unknown as LocalCollection,
          colName,
          userId
        );
      } catch (colError) {
        const message =
          colError instanceof Error
            ? colError.message
            : `Unknown error in ${colName}`;
        console.error(`[Sync] Collection "${colName}" failed:`, colError);
        collectionErrors.push(`${colName}: ${message}`);
        if (isRateLimitError(colError)) sawRateLimit = true;
      }
    }

    if (sawRateLimit) {
      rateLimitBackoffMs =
        rateLimitBackoffMs === 0
          ? RATE_LIMIT_BASE_MS
          : Math.min(rateLimitBackoffMs * 2, RATE_LIMIT_MAX_MS);
      rateLimitUntil = Date.now() + rateLimitBackoffMs;
      console.warn(
        `[Sync] Rate limited; backing off for ${rateLimitBackoffMs}ms`
      );
    } else {
      rateLimitBackoffMs = 0;
      rateLimitUntil = 0;
    }

    if (collectionErrors.length === 0) {
      updateSyncStatus({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        errors: [],
      });
      if (DEBUG) console.log('[Sync] ✅ Sync complete');
    } else {
      updateSyncStatus({ isSyncing: false, errors: collectionErrors });
      if (DEBUG)
        console.warn('[Sync] ⚠️ Sync completed with errors:', collectionErrors);
    }
  } catch (error) {
    console.error('[Sync] ❌ Sync failed', error);
    updateSyncStatus({
      isSyncing: false,
      errors: [
        ...syncStatus.errors,
        error instanceof Error ? error.message : 'Unknown error',
      ],
    });
  } finally {
    isSyncInProgress = false;
  }
}

async function syncCollection(
  collection: LocalCollection,
  colName: string,
  userId: string
) {
  const cycleStartMs = Date.now();
  const tableId =
    APPWRITE_CONFIG.tables[colName as keyof typeof APPWRITE_CONFIG.tables];
  if (DEBUG) console.log(`[Sync] Syncing ${colName}...`);

  const entry = perCollectionSync[colName as CollectionName];
  const pullBoundaryMs = entry?.pull ? new Date(entry.pull).getTime() : 0;
  const dirtyBoundaryMs = entry?.dirty ? new Date(entry.dirty).getTime() : 0;
  const usesTimestamps = isTimestampedCollection(colName);

  const remoteIndex = new Map<
    string,
    { updatedAt: number; isDeleted: boolean }
  >();
  const justPulled = new Set<string>();

  let cursor: string | undefined = undefined;
  let pageCount = 0;

  for (;;) {
    const queries: unknown[] = [
      Query.equal('user_id', userId),
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
    ];

    if (pullBoundaryMs > 0) {
      const sinceIso = new Date(
        pullBoundaryMs - PULL_OVERLAP_MS
      ).toISOString();
      queries.push(Query.greaterThan('$updatedAt', sinceIso));
    }
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const remoteResponse = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId,
      queries: queries as never,
      total: false,
    });
    const rows = ((remoteResponse as { rows?: AppwriteRow[] }).rows ||
      []) as AppwriteRow[];

    pageCount++;
    if (DEBUG)
      console.log(`[Sync] ${colName} page ${pageCount}: ${rows.length} rows`);

    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const doc = fromAppwriteFormat(row, colName);
        const docId = doc.id as string;
        if (!docId) continue;

        const remoteUpdatedAt = toMs(row.$updatedAt);
        remoteIndex.set(docId, {
          updatedAt: remoteUpdatedAt,
          isDeleted: (doc.isDeleted as boolean) ?? false,
        });

        const localDoc = await collection.findOne(docId).exec();
        if (!localDoc) {
          await collection.upsert(doc);
          justPulled.add(docId);
          continue;
        }

        const localLwt = localDoc._meta?.lwt ?? 0;
        const isLocalDirty = localLwt > dirtyBoundaryMs;

        if (isLocalDirty) continue;

        if (colName === 'messages' && row.direction === 'outgoing') {
          const remoteReadAt = (row.read_at as string) || '';
          const localJson = localDoc.toJSON();
          const localReadAt = (localJson.readAt as string) || '';
          if (remoteReadAt && remoteReadAt !== localReadAt) {
            try {
              await localDoc.incrementalPatch({ readAt: remoteReadAt });
            } catch (err) {
              if (DEBUG) {
                console.warn('[Sync] read_at pull failed for', docId, err);
              }
            }
          }
        }

        let remoteWins = false;
        if (usesTimestamps) {
          const localUpdatedAt = toMs(localDoc.toJSON().updatedAt);
          remoteWins = remoteUpdatedAt > localUpdatedAt;
        } else {
          remoteWins = remoteUpdatedAt > localLwt;
        }

        if (remoteWins) {
          await collection.upsert(doc);
          justPulled.add(docId);
        }
      } catch (rowError) {
        console.error(`[Sync] Failed to process ${colName} row:`, rowError);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    const lastId = rows[rows.length - 1].$id as string | undefined;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }

  // S6-4: advance the pull boundary as soon as the pull phase completes,
  // before the push phase. If the push phase throws below, `pull` stays
  // advanced so the next cycle's delta window does not grow unboundedly.
  // `dirty` is deliberately not advanced here — locally-edited rows must
  // still be visible as dirty on the next cycle if the push fails.
  perCollectionSync[colName as CollectionName] = {
    pull: new Date(cycleStartMs).toISOString(),
    dirty: entry?.dirty ?? '',
  };
  savePerCollectionState(userId, perCollectionSync);

  // Messages are excluded from the push loop. Every message row is written
  // server-side by the `message-action` function (deliver, react, unsend,
  // mark_read), which uses a server API key and bypasses client rate limits.
  // Client-side PATCHes to /tablesdb/.../messages/rows were duplicate traffic
  // and were the dominant contributor to the 120 req/min bucket that was
  // returning 429. Pull stays enabled above so read receipts and incoming
  // rows still arrive.
  if (colName !== 'messages') {
    const localDocs = await collection.find().exec();
    for (const doc of localDocs) {
      const json = doc.toJSON();
      const docUserId = json.userId as string | undefined;
      if (docUserId !== userId) continue;

      const docId = (json.id as string) || doc.id;
      if (!docId) continue;
      if (justPulled.has(docId)) continue;

      const remoteMeta = remoteIndex.get(docId);
      const localLwt = doc._meta?.lwt ?? 0;
      const isLocalDirty = localLwt > dirtyBoundaryMs;

      let shouldPush = false;
      if (isLocalDirty) {
        shouldPush = true;
      } else if (remoteMeta && usesTimestamps) {
        const localUpdatedAt = toMs(json.updatedAt);
        shouldPush = localUpdatedAt > remoteMeta.updatedAt;
      }

      if (!shouldPush) continue;

      const rowData = toAppwriteFormat(json, colName, userId);
      if (DEBUG) console.log(`[Sync] Pushing ${colName} ${docId}`);

      try {
        await tablesDB.updateRow({
          databaseId: APPWRITE_CONFIG.databaseId,
          tableId,
          rowId: docId,
          data: rowData,
        });
      } catch (updateErr) {
        if (isNotFoundError(updateErr)) {
          try {
            await tablesDB.upsertRow({
              databaseId: APPWRITE_CONFIG.databaseId,
              tableId,
              rowId: docId,
              data: rowData,
              permissions: buildRowPermissions(userId),
            });
          } catch (createErr) {
            console.error(
              `[Sync] Failed to create ${colName} ${docId}:`,
              createErr
            );
            throw createErr;
          }
        } else {
          console.error(
            `[Sync] Failed to push ${colName} ${docId}:`,
            updateErr
          );
          throw updateErr;
        }
      }
    }
  }

  // Advance `dirty` only after push completes without throwing. For
  // `messages`, the push phase is skipped, so this runs immediately after
  // the pull boundary was set and simply moves `dirty` to now. That is the
  // intended behavior: the boundary advances so locally-touched message rows
  // do not re-enter the dirty state on the next cycle.
  perCollectionSync[colName as CollectionName] = {
    pull: new Date(cycleStartMs).toISOString(),
    dirty: new Date().toISOString(),
  };
  savePerCollectionState(userId, perCollectionSync);

  if (DEBUG)
    console.log(`[Sync] ✅ ${colName} synced (${pageCount} page(s) pulled)`);
}

export async function forceSync() {
  if (DEBUG) console.log('[Sync] Force sync triggered');
  await initializeSync();
}

function safeForceSync(reason: string) {
  try {
    getDatabase();
    if (DEBUG) console.log(`[Sync] ${reason}, syncing...`);
    forceSync().catch((e) => console.error(`[Sync] ${reason} sync failed`, e));
  } catch (e) {
    if (DEBUG)
      console.log(`[Sync] ${reason} handler skipped (DB not ready):`, e);
  }
}

function scheduleSync(reason: string) {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    safeForceSync(reason);
  }, TRIGGER_DEBOUNCE_MS);
}

function handleWindowFocus() {
  scheduleSync('Window focused');
}

function handleOnline() {
  scheduleSync('Connection restored');
}

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    scheduleSync('App became visible');
  }
}

if (typeof window !== 'undefined' && !window.__mosaicFocusSyncAttached) {
  window.__mosaicFocusSyncAttached = true;
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}
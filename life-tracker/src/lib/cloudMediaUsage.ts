import { Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID, APPWRITE_STORAGE_BUCKET_ID, APPWRITE_TABLES } from './appwriteConfig';
import { guardedAccount, guardedStorage, guardedTablesDB } from './sdk';
import { parseDiaryPhotos } from './diaryPhotos';
import { isPendingImageId } from './pendingImages';

export type CloudMediaKind = 'tasks' | 'diary' | 'profile' | 'multiple';
export interface CloudMediaSummary { count: number; bytes: number }
export interface CloudMediaInventory {
  ownerId: string;
  checkedAt: string;
  /** Counts only confirmed, owner-controlled, referenced Appwrite files. NOT an account quota. */
  verified: CloudMediaSummary;
  byKind: Record<CloudMediaKind, CloudMediaSummary>;
  largest: { kind: CloudMediaKind; bytes: number }[];
  unavailable: number;
  truncated: boolean;
  /** Cannot include orphaned files, archived records, other providers, or provider billing overhead. */
  coverage: 'referenced-media-only';
}

const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const MAX_FILES = 120;
const PARALLEL_METADATA_REQUESTS = 4;
const VALID_REMOTE_FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

function uploadedFileId(value: unknown): value is string {
  return typeof value === 'string' && VALID_REMOTE_FILE_ID.test(value) &&
    !isPendingImageId(value);
}

function readProfileImageId(value: unknown): unknown {
  if (typeof value !== 'string') return null;
  try {
    const decoded: unknown = JSON.parse(value);
    return typeof decoded === 'string' ? decoded : null;
  } catch {
    return value;
  }
}

/** Cancelled scans stop issuing follow-up metadata reads and cannot publish a partial result.
 * In-flight Appwrite requests cannot be aborted by the SDK; the signal is checked
 * immediately after each settled call and before starting another request.
 */
export async function scanOwnerReferencedCloudMedia(
  ownerId: string,
  signal?: AbortSignal
): Promise<CloudMediaInventory> {
  const ensureActive = () => {
    if (signal?.aborted) throw new Error('Cloud media inventory cancelled.');
  };
  ensureActive();
  if (!ownerId) throw new Error('Cloud media inventory requires an owner.');
  const verifyOwner = async () => {
    ensureActive();
    const account = await guardedAccount.get();
    ensureActive();
    if (account.$id !== ownerId) throw new Error('Account changed during cloud inventory.');
  };
  await verifyOwner();

  const references = new Map<string, Set<Exclude<CloudMediaKind, 'multiple'>>>();
  const add = (fileId: unknown, kind: 'tasks' | 'diary' | 'profile') => {
    if (!uploadedFileId(fileId)) return;
    const kinds = references.get(fileId) ?? new Set<'tasks' | 'diary' | 'profile'>();
    kinds.add(kind);
    references.set(fileId, kinds);
  };

  let truncated = false;
  for (const [table, kind] of [
    [APPWRITE_TABLES.tasks, 'tasks'],
    [APPWRITE_TABLES.diary, 'diary'],
    [APPWRITE_TABLES.settings, 'profile'],
  ] as const) {
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      await verifyOwner();
      const queries = [
        Query.equal('user_id', ownerId),
        Query.equal('deleted', false),
        Query.orderAsc('$id'),
        Query.limit(PAGE_SIZE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ];
      const response = await guardedTablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: table,
        queries,
        total: false,
      });
      ensureActive();
      const rows = response.rows;
      for (const raw of rows) {
        const row = raw as unknown as Record<string, unknown>;
        // A client filter is not authorization: fail closed on any unexpected owner row.
        if (row.user_id !== ownerId) throw new Error('Untrusted cloud media ownership result.');
        if (row.deleted === true) continue;
        if (kind === 'tasks') add(row.image, 'tasks');
        if (kind === 'diary') for (const id of parseDiaryPhotos(row.photos)) add(id, 'diary');
        if (kind === 'profile' && row.key === 'profileImageId') {
          add(readProfileImageId(row.value), 'profile');
        }
      }
      if (rows.length < PAGE_SIZE) break;
      const last = rows[rows.length - 1]?.$id;
      if (typeof last !== 'string' || last === cursor) {
        throw new Error('Cloud media pagination could not advance.');
      }
      if (page === MAX_PAGES - 1) truncated = true;
      cursor = last;
    }
  }

  await verifyOwner();
  const ids = Array.from(references.keys()).sort();
  if (ids.length > MAX_FILES) truncated = true;
  const chosen = ids.slice(0, MAX_FILES);
  const byKind: Record<CloudMediaKind, CloudMediaSummary> = {
    tasks: { count: 0, bytes: 0 },
    diary: { count: 0, bytes: 0 },
    profile: { count: 0, bytes: 0 },
    multiple: { count: 0, bytes: 0 },
  };
  const largest: CloudMediaInventory['largest'] = [];
  let unavailable = 0;
  let index = 0;
  const requiredUpdate = Permission.update(Role.user(ownerId));
  const requiredDelete = Permission.delete(Role.user(ownerId));

  const worker = async () => {
    while (index < chosen.length) {
      ensureActive();
      const fileId = chosen[index++];
      try {
        const meta = await guardedStorage.getFile({
          bucketId: APPWRITE_STORAGE_BUCKET_ID,
          fileId,
        });
        // A friend's read grant is never evidence that this account owns a file.
        ensureActive();
        const grants = meta.$permissions;
        if (!Array.isArray(grants) || !grants.includes(requiredUpdate) ||
            !grants.includes(requiredDelete) ||
            !Number.isFinite(meta.sizeOriginal) || meta.sizeOriginal < 0) {
          unavailable++;
          continue;
        }
        const kinds = references.get(fileId);
        if (!kinds) continue;
        const kind: CloudMediaKind = kinds.size > 1 ? 'multiple' : [...kinds][0];
        byKind[kind].count++;
        byKind[kind].bytes += meta.sizeOriginal;
        largest.push({ kind, bytes: meta.sizeOriginal });
      } catch {
        ensureActive();
        unavailable++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_METADATA_REQUESTS, chosen.length) }, () => worker()));
  await verifyOwner();
  largest.sort((a, b) => b.bytes - a.bytes);
  return {
    ownerId,
    checkedAt: new Date().toISOString(),
    verified: Object.values(byKind).reduce((total, group) => ({
      count: total.count + group.count,
      bytes: total.bytes + group.bytes,
    }), { count: 0, bytes: 0 }),
    byKind,
    largest: largest.slice(0, 8),
    unavailable,
    truncated,
    coverage: 'referenced-media-only',
  };
}

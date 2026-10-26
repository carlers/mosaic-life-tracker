/**
 * #1027 source-only, READ-ONLY Appwrite full-owner history scanner.
 *
 * Never runs in the shipped app or against hosted users automatically. The
 * caller MUST prove a server-enforced read-only source lease; a UI flag or
 * local timestamp is not an acceptable replacement for that trust boundary.
 * An ordinary Mosaic ZIP is active-only and cannot substitute for this scan.
 */
import { createHash } from 'node:crypto';
import { Query } from 'appwrite';
import type {
  BucketListDocument, BucketTaskLinkDocument, TaskDocument,
} from '../src/db/schema';
import { guardedAccount, guardedTablesDB } from '../src/lib/sdk';
import {
  APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
  APPWRITE_TABLES,
} from '../src/lib/appwriteConfig';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';
import { toCandidateBucketWrite, toCandidateBucketLinkWrite } from './candidateBucketMapping';

const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const MAX_ROWS = 250_000;
const DEFAULT_PAGE = 100;
type Domain = 'tasks' | 'buckets' | 'links';
type TaskIdentity = Pick<TaskDocument, 'id' | 'userId' | 'isDeleted'>;
type HistoryRows = {
  tasks: TaskIdentity[];
  buckets: BucketListDocument[];
  links: BucketTaskLinkDocument[];
};
type RawRow = Record<string, unknown>;
type SourceSession = { ownerId: string; sessionEpoch: number };
export type SourceLease = {
  ownerId: string;
  sourceDeploymentId: string;
  leaseId: string;
  generation: string;
  expiresAt: string;
  /** Exact frozen counts from the independent server-side writer coordinator. */
  ownerCounts: Record<Domain, number>;
  /** Authoritative server-side writer fence, NOT a browser toggle. */
  readOnly: true;
};
type Page = { rows: RawRow[]; total: number };

const TABLE: Record<Domain, string> = {
  tasks: APPWRITE_TABLES.tasks,
  buckets: APPWRITE_TABLES.bucketList,
  links: APPWRITE_TABLES.bucketTaskLinks,
};

export interface AppwriteHistoryReadOptions {
  identity: CandidateIdentity;
  sourceDeploymentId: string;
  /** Must be backed by the trusted Appwrite writer-authority coordinator. */
  getSourceLease: () => Promise<SourceLease>;
  /** App's owner-generation guard, independent of remote Account.get(). */
  getSessionEpoch: () => Promise<number>;
  /** The default implementation is the actual signed Appwrite SDK. */
  getAccount?: () => Promise<{ $id: string }>;
  /** Must use the signed owner session, not an admin key or server bypass. */
  listRows?: (input: {
    databaseId: string; tableId: string; queries: string[];
    total: true;
  }) => Promise<Page>;
  pageSize?: number;
}

export type AppwriteHistoryReadback = {
  owner: CandidateIdentity;
  sourceDeploymentId: string;
  leaseId: string;
  generation: string;
  expectedCounts: { tasks: number; buckets: number; links: number };
  /** Two identical signed passes through every domain, including tombstones. */
  fingerprints: Record<Domain, string>;
} & HistoryRows;

function snapshotFingerprint(rows: readonly unknown[]): string {
  const hash = createHash('sha256');
  for (const row of rows) {
    const bytes = JSON.stringify(row);
    hash.update(Buffer.byteLength(bytes, 'utf8').toString(10) + ':');
    hash.update(bytes, 'utf8');
  }
  return hash.digest('hex');
}
function stringField(raw: RawRow, key: string): string {
  if (typeof raw[key] !== 'string') throw new Error('Invalid Appwrite history field: ' + key);
  return raw[key] as string;
}
function deletedField(raw: RawRow): boolean {
  if (typeof raw.deleted !== 'boolean')
    throw new Error('Historical tombstone state is not an explicit boolean');
  return raw.deleted;
}
function projectRow(domain: Domain, raw: RawRow, identity: CandidateIdentity):
  TaskIdentity | BucketListDocument | BucketTaskLinkDocument {
  const id = stringField(raw, '$id');
  if (!ID.test(id) || stringField(raw, 'user_id') !== identity.legacyUserId)
    throw new Error('Invalid or foreign signed Appwrite history owner row');
  const owner = identity.legacyUserId;
  const isDeleted = deletedField(raw);
  if (domain === 'tasks') return { id, userId: owner, isDeleted };
  if (domain === 'buckets') {
    const value: BucketListDocument = {
      id, userId: owner, title: stringField(raw, 'title'),
      description: stringField(raw, 'description'),
      achieved: raw.achieved as boolean,
      achievedAt: stringField(raw, 'achieved_at'),
      createdAt: stringField(raw, 'created_at'),
      updatedAt: stringField(raw, 'updated_at'), isDeleted,
    };
    toCandidateBucketWrite(value, identity);
    return value;
  }
  const value: BucketTaskLinkDocument = {
    id, userId: owner, bucketListId: stringField(raw, 'bucket_list_id'),
    taskId: stringField(raw, 'task_id'),
    createdAt: stringField(raw, 'created_at'),
    updatedAt: stringField(raw, 'updated_at'), isDeleted,
  };
  toCandidateBucketLinkWrite(value, identity);
  return value;
}

export async function readFrozenAppwriteOwnerHistory(
  options: AppwriteHistoryReadOptions,
): Promise<AppwriteHistoryReadback> {
  if (!options || !options.identity || typeof options.sourceDeploymentId !== 'string' ||
      !options.sourceDeploymentId || !options.getSourceLease ||
      !options.getSessionEpoch || typeof options.getSourceLease !== 'function' ||
      typeof options.getSessionEpoch !== 'function')
    throw new Error('Historical source requires trusted owner identity and server read-only lease');
  validateCandidateIdentity(options.identity);
  const pageSize = options.pageSize ?? DEFAULT_PAGE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error('Historical source page size exceeds reviewed limit');
  // Include the actual Appwrite target in the lease binding. Cloud and Oracle
  // must never be silently treated as one data authority.
  const deployment = APPWRITE_ENDPOINT + '|' + APPWRITE_PROJECT_ID + '|' +
    APPWRITE_DATABASE_ID + '|' + options.sourceDeploymentId;
  const getAccount = options.getAccount ?? (() => guardedAccount.get());
  const listRows = options.listRows ?? (async input =>
    (await guardedTablesDB.listRows(input)) as Page);
  const initial: SourceSession = {
    ownerId: (await getAccount()).$id,
    sessionEpoch: await options.getSessionEpoch(),
  };
  if (initial.ownerId !== options.identity.legacyUserId ||
      !Number.isSafeInteger(initial.sessionEpoch) || initial.sessionEpoch < 0)
    throw new Error('Appwrite full-history signed account does not match reviewed owner');
  const rawLease = await options.getSourceLease();
  if (!rawLease?.ownerCounts || typeof rawLease.ownerCounts !== 'object')
    throw new Error('Trusted history lease omitted independently frozen source owner counts');
  // Copy the witness: a callback must not mutate the original lease object
  // in place between asynchronous pages to bypass frozen-count/epoch checks.
  const firstLease: SourceLease = {
    ...rawLease, ownerCounts: { ...rawLease.ownerCounts },
  };
  function checkLease(lease: SourceLease) {
    if (!lease || lease.readOnly !== true ||
        lease.ownerId !== options.identity.legacyUserId ||
        lease.sourceDeploymentId !== deployment ||
        typeof lease.leaseId !== 'string' || !lease.leaseId ||
        typeof lease.generation !== 'string' || !lease.generation ||
        typeof lease.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(lease.expiresAt)) ||
        Date.parse(lease.expiresAt) <= Date.now() ||
        lease.leaseId !== firstLease.leaseId ||
        lease.generation !== firstLease.generation ||
        !lease.ownerCounts || typeof lease.ownerCounts !== 'object' ||
        (['tasks', 'buckets', 'links'] as const).some(domain =>
          !Number.isSafeInteger(lease.ownerCounts[domain]) ||
          lease.ownerCounts[domain] < 0 ||
          lease.ownerCounts[domain] > MAX_ROWS ||
          lease.ownerCounts[domain] !== firstLease.ownerCounts[domain]))
      throw new Error('Signed Appwrite history source writer fence changed or expired');
  }
  checkLease(firstLease);
  async function fence() {
    const [account, epoch, lease] = await Promise.all([
      getAccount(), options.getSessionEpoch(), options.getSourceLease(),
    ]);
    if (!account || account.$id !== initial.ownerId || epoch !== initial.sessionEpoch)
      throw new Error('Signed Appwrite history account/session switched during read');
    checkLease(lease);
  }
  async function scan<T extends HistoryRows[Domain][number]>(
    domain: Domain,
  ): Promise<{ rows: T[]; hash: string }> {
    let total: number | undefined;
    let cursor = '';
    let pages = 0;
    const rows: T[] = [];
    const seen = new Set<string>();
    for (;;) {
      await fence();
      const queries = [
        Query.equal('user_id', options.identity.legacyUserId),
        Query.orderAsc('$id'),
        Query.limit(pageSize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ];
      const response = await listRows({
        databaseId: APPWRITE_DATABASE_ID, tableId: TABLE[domain],
        queries, total: true,
      });
      await fence();
      if (!response || !Array.isArray(response.rows) ||
          response.rows.length > pageSize ||
          !Number.isSafeInteger(response.total) ||
          response.total < 0 || response.total > MAX_ROWS ||
          (total !== undefined && response.total !== total))
        throw new Error('Incomplete or changing signed Appwrite owner history total');
      total = response.total;
      if (total !== firstLease.ownerCounts[domain])
        throw new Error('Appwrite owner history differs from trusted frozen source row count');
      if (pages++ > Math.ceil(total / pageSize) + 1)
        throw new Error('Historical source exceeded its bounded page limit');
      for (const raw of response.rows) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          throw new Error('Malformed Appwrite historical row');
        const next = projectRow(domain, raw, options.identity) as T;
        if (next.id <= cursor || seen.has(next.id))
          throw new Error('Duplicate or out-of-order Appwrite owner history cursor');
        cursor = next.id;
        seen.add(next.id);
        rows.push(next);
      }
      if (rows.length > total)
        throw new Error('Appwrite owner history unexpectedly grew while frozen');
      if (rows.length === total) break;
      if (response.rows.length !== pageSize)
        throw new Error('Incomplete owner history pagination before expected total');
    }
    await fence();
    if (rows.length !== total)
      throw new Error('Incomplete signed Appwrite owner inventory');
    return { rows, hash: snapshotFingerprint(rows) };
  }
  const first = {
    tasks: await scan<TaskIdentity>('tasks'),
    buckets: await scan<BucketListDocument>('buckets'),
    links: await scan<BucketTaskLinkDocument>('links'),
  };
  const second = {
    tasks: await scan<TaskIdentity>('tasks'),
    buckets: await scan<BucketListDocument>('buckets'),
    links: await scan<BucketTaskLinkDocument>('links'),
  };
  await fence();
  for (const domain of ['tasks', 'buckets', 'links'] as const) {
    if (first[domain].rows.length !== second[domain].rows.length ||
        first[domain].hash !== second[domain].hash)
      throw new Error('Signed Appwrite owner source changed between complete passes');
  }
  return {
    owner: { ...options.identity },
    sourceDeploymentId: deployment,
    leaseId: firstLease.leaseId,
    generation: firstLease.generation,
    tasks: first.tasks.rows, buckets: first.buckets.rows, links: first.links.rows,
    expectedCounts: { tasks: first.tasks.rows.length,
      buckets: first.buckets.rows.length, links: first.links.rows.length },
    fingerprints: { tasks: first.tasks.hash,
      buckets: first.buckets.hash, links: first.links.hash },
  };
}

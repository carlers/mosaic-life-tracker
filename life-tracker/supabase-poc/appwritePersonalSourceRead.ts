/**
 * #1027 dormant signed Appwrite personal-content source inventory.
 *
 * This is an IN-MEMORY, READ-ONLY preliminary snapshot, not a migration
 * writer, independent backup, source-authenticity proof or cutover permit.
 * A trusted server must issue/renew the actual exclusive writer-freeze lease.
 */
import { createHash } from 'node:crypto';
import { Query } from 'appwrite';
import { guardedAccount, guardedTablesDB } from '../src/lib/sdk';
import {
  APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_TABLES,
} from '../src/lib/appwriteConfig';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';
import type { SourceLease } from './appwriteOwnerHistoryRead';

const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const MAX_ROWS = 250_000;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ROW_BYTES = 2 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
export type PersonalDomain = 'tasks' | 'categories' | 'diary' | 'settings';
const DOMAINS: readonly PersonalDomain[] = ['tasks', 'categories', 'diary', 'settings'];
const TABLE: Record<PersonalDomain, string> = {
  tasks: APPWRITE_TABLES.tasks,
  categories: APPWRITE_TABLES.categories,
  diary: APPWRITE_TABLES.diary,
  settings: APPWRITE_TABLES.settings,
};
// These are the known raw Appwrite fields, NOT RxDB defaults. Unknown
// application fields abort the entire scan instead of vanishing in a mapper.
const FIELDS: Record<PersonalDomain, ReadonlySet<string>> = {
  tasks: new Set([
    'title', 'is_completed', 'category_id', 'order', 'tags', 'date',
    'memo', 'image', 'created_at', 'completed_at', 'updated_at',
    'visibility', 'source', 'routine_id', 'reminder_time', 'reactions',
  ]),
  categories: new Set([
    'name', 'color', 'visibility', 'order', 'icon', 'updated_at',
  ]),
  diary: new Set([
    'date', 'content', 'emoji', 'photos', 'visibility',
    'created_at', 'updated_at',
  ]),
  settings: new Set(['key', 'value', 'updated_at']),
};
type ColumnValue = string | number | boolean | null;
export type FrozenPersonalRow = {
  id: string;
  userId: string;
  isDeleted: boolean;
  /** Only exact present original raw Appwrite fields, including nulls. */
  columns: Record<string, ColumnValue>;
  /** Server-origin evidence, never generated from the client's clock. */
  serverCreatedAt: string | null;
  serverUpdatedAt: string | null;
  /** Kept for source forensics, NEVER copied to Supabase grants. */
  originalPermissions: string[] | null;
};
export type PersonalSourceLease = SourceLease & {
  /** Independently frozen server-side owner counts, including tombstones. */
  personalCounts: Record<PersonalDomain, number>;
};
type RawRow = Record<string, unknown>;
type Page = { rows: RawRow[]; total: number };
export type FrozenPersonalSnapshot = {
  identity: CandidateIdentity;
  sourceDeploymentId: string;
  leaseId: string;
  generation: string;
  originalOwnerCounts: Record<PersonalDomain, number>;
  fingerprintSha256: Record<PersonalDomain, string>;
  rows: Record<PersonalDomain, FrozenPersonalRow[]>;
  /** Hash of this provisional readback, not authenticated source provenance. */
  scanSha256: string;
  completeSourceArchive: false;
  providerCutoverEligible: false;
};
export type FrozenPersonalOptions = {
  identity: CandidateIdentity;
  sourceDeploymentId: string;
  getSourceLease: () => Promise<PersonalSourceLease>;
  getSessionEpoch: () => Promise<number>;
  getAccount?: () => Promise<{ $id: string }>;
  listRows?: (query: {
    databaseId: string; tableId: string; queries: string[]; total: true;
  }) => Promise<Page>;
  pageSize?: number;
};

function finiteTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 50 &&
    Number.isFinite(Date.parse(value));
}
function project(domain: PersonalDomain, row: RawRow, owner: string): FrozenPersonalRow {
  if (typeof row.$id !== 'string' || !ROW_ID.test(row.$id) ||
      row.user_id !== owner || typeof row.deleted !== 'boolean')
    throw new Error('Foreign, deleted-state missing or malformed Appwrite personal source row');
  const columns: Record<string, ColumnValue> = {};
  for (const key of Object.keys(row).filter(key => !key.startsWith('$')).sort()) {
    if (key === 'user_id' || key === 'deleted') continue;
    if (!FIELDS[domain].has(key))
      throw new Error('Unknown Appwrite personal source field requires explicit migration review');
    const value = row[key];
    if (value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'boolean' &&
        !(typeof value === 'number' && Number.isSafeInteger(value)))
      throw new Error('Unsupported nested or invalid personal source field');
    if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > 1_000_000)
      throw new Error('Oversized personal source column');
    columns[key] = value as ColumnValue;
  }
  function timestamp(key: '$createdAt' | '$updatedAt') {
    const value = row[key];
    if (value === undefined) return null;
    if (!finiteTimestamp(value))
      throw new Error('Invalid source server timestamp');
    return value;
  }
  const originalPermissions = row.$permissions;
  if (originalPermissions !== undefined &&
      (!Array.isArray(originalPermissions) || originalPermissions.length > 50 ||
       originalPermissions.some(value => typeof value !== 'string' || value.length > 256)))
    throw new Error('Invalid original Appwrite row permission metadata');
  return {
    id: row.$id, userId: owner, isDeleted: row.deleted,
    columns, serverCreatedAt: timestamp('$createdAt'),
    serverUpdatedAt: timestamp('$updatedAt'),
    originalPermissions: originalPermissions === undefined ? null : [...originalPermissions],
  };
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function validCounts(
  counts: Partial<Record<PersonalDomain | 'buckets' | 'links', number>> | undefined,
  keys: readonly (PersonalDomain | 'buckets' | 'links')[],
): boolean {
  return !!counts && keys.every(key => {
    const count = counts[key];
    return typeof count === 'number' && Number.isSafeInteger(count) &&
      count >= 0 && count <= MAX_ROWS;
  });
}

/**
 * Must only be invoked after an externally server-enforced owner writer
 * freeze. No caller-supplied lease is itself proof of that server fence.
 * Signed Auth and source-scan validation prevent accidental mixed-owner or
 * partial data; they cannot block old offline PWA writers on their own.
 */
export async function readFrozenAppwritePersonalSource(
  options: FrozenPersonalOptions,
): Promise<FrozenPersonalSnapshot> {
  if (!options?.identity || !options.sourceDeploymentId ||
      typeof options.getSourceLease !== 'function' ||
      typeof options.getSessionEpoch !== 'function')
    throw new Error('Full personal source requires reviewed owner and read-only lease');
  validateCandidateIdentity(options.identity);
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error('Unbounded Appwrite personal history page size');
  const deployment = [APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
    APPWRITE_DATABASE_ID, options.sourceDeploymentId].join('|');
  const getAccount = options.getAccount ?? (() => guardedAccount.get());
  const listRows = options.listRows ?? (async input =>
    (await guardedTablesDB.listRows(input)) as Page);
  const owner = options.identity.legacyUserId;
  const initialUser = (await getAccount()).$id;
  const initialEpoch = await options.getSessionEpoch();
  if (initialUser !== owner || !Number.isSafeInteger(initialEpoch) || initialEpoch < 0)
    throw new Error('Signed Appwrite personal source account mismatch');
  const rawLease = await options.getSourceLease();
  if (!rawLease || !validCounts(rawLease.personalCounts, DOMAINS) ||
      !validCounts(rawLease.ownerCounts, ['tasks', 'buckets', 'links']))
    throw new Error('Missing independently frozen complete owner counts');
  // Copy every nested count object: mutable callback objects must not be
  // able to quietly change the baseline during an awaited page fetch.
  const firstLease: PersonalSourceLease = {
    ...rawLease, personalCounts: { ...rawLease.personalCounts },
    ownerCounts: { ...rawLease.ownerCounts },
  };
  if (firstLease.ownerCounts.tasks !== firstLease.personalCounts.tasks)
    throw new Error('Inconsistent task owner counts between source histories');
  function validateLease(lease: PersonalSourceLease) {
    if (!lease || lease.readOnly !== true || lease.ownerId !== owner ||
        lease.sourceDeploymentId !== deployment ||
        !lease.leaseId || lease.leaseId !== firstLease.leaseId ||
        !lease.generation || lease.generation !== firstLease.generation ||
        !finiteTimestamp(lease.expiresAt) || Date.parse(lease.expiresAt) <= Date.now() ||
        !validCounts(lease.personalCounts, DOMAINS) ||
        !validCounts(lease.ownerCounts, ['tasks', 'buckets', 'links']) ||
        DOMAINS.some(domain =>
          lease.personalCounts[domain] !== firstLease.personalCounts[domain]) ||
        (['tasks','buckets','links'] as const).some(domain =>
          lease.ownerCounts[domain] !== firstLease.ownerCounts[domain]))
      throw new Error('Authoritative personal source owner writer lease changed or expired');
  }
  validateLease(firstLease);
  async function fence() {
    const [account, epoch, lease] = await Promise.all([
      getAccount(), options.getSessionEpoch(), options.getSourceLease(),
    ]);
    if (!account || account.$id !== initialUser || epoch !== initialEpoch)
      throw new Error('Authenticated Appwrite personal owner session changed during source read');
    validateLease(lease);
  }
  let totalBytes = 0;
  async function scan(domain: PersonalDomain, collect: boolean) {
    let cursor = '';
    let total: number | undefined;
    let pages = 0;
    const rows: FrozenPersonalRow[] = [];
    const hash = createHash('sha256');
    let count = 0;
    for (;;) {
      await fence();
      const query = [
        Query.equal('user_id', owner),
        Query.orderAsc('$id'), Query.limit(pageSize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ];
      const response = await listRows({
        databaseId: APPWRITE_DATABASE_ID, tableId: TABLE[domain],
        queries: query, total: true,
      });
      await fence();
      if (!response || !Array.isArray(response.rows) ||
          response.rows.length > pageSize ||
          !Number.isSafeInteger(response.total) ||
          response.total !== firstLease.personalCounts[domain] ||
          (total !== undefined && total !== response.total))
        throw new Error('Incomplete frozen Appwrite personal source total');
      total = response.total;
      if (pages++ > Math.ceil(total / pageSize) + 1)
        throw new Error('Personal source exceeded bounded page count');
      for (const raw of response.rows) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          throw new Error('Invalid Appwrite source row envelope');
        const data = project(domain, raw, owner);
        if (data.id <= cursor)
          throw new Error('Duplicate or non-monotonic Appwrite personal cursor');
        cursor = data.id;
        count++;
        if (count > total)
          throw new Error('Changed owner count during frozen personal scan');
        const json = JSON.stringify(data);
        const size = Buffer.byteLength(json, 'utf8');
        if (size > MAX_ROW_BYTES)
          throw new Error('Personal history row exceeds safe snapshot memory limit');
        totalBytes += size;
        if (totalBytes > MAX_BYTES)
          throw new Error('Personal history requires streaming encrypted snapshot');
        hash.update(size.toString(10) + ':');
        hash.update(json, 'utf8');
        if (collect) rows.push(data);
      }
      if (count === total) break;
      if (response.rows.length !== pageSize)
        throw new Error('Incomplete frozen owner personal source pagination');
    }
    await fence();
    if (count !== total) throw new Error('Incomplete personal source after paging');
    return { rows, count, fingerprint: hash.digest('hex') };
  }
  const first = {
    tasks: await scan('tasks', true),
    categories: await scan('categories', true),
    diary: await scan('diary', true),
    settings: await scan('settings', true),
  };
  const second = {
    tasks: await scan('tasks', false),
    categories: await scan('categories', false),
    diary: await scan('diary', false),
    settings: await scan('settings', false),
  };
  await fence();
  for (const domain of DOMAINS) {
    if (first[domain].count !== second[domain].count ||
        first[domain].fingerprint !== second[domain].fingerprint)
      throw new Error('Personal owner content changed across complete frozen source passes');
  }
  const fingerprintSha256 = {
    tasks: first.tasks.fingerprint,
    categories: first.categories.fingerprint,
    diary: first.diary.fingerprint,
    settings: first.settings.fingerprint,
  };
  const originalOwnerCounts = { ...firstLease.personalCounts };
  return {
    identity: { ...options.identity }, sourceDeploymentId: deployment,
    leaseId: firstLease.leaseId, generation: firstLease.generation,
    originalOwnerCounts, fingerprintSha256,
    rows: { tasks: first.tasks.rows, categories: first.categories.rows,
      diary: first.diary.rows, settings: first.settings.rows },
    scanSha256: digest({ deployment, owner, generation: firstLease.generation,
      originalOwnerCounts, fingerprintSha256 }),
    completeSourceArchive: false,
    providerCutoverEligible: false,
  };
}

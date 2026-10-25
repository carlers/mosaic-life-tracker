/**
 * Source-only Supabase candidate task/category create + master read (#967).
 * No upsert and no blind retry: 409 requires a fresh owner-scoped master read.
 * Not wired to Mosaic's shipped RxDB or Appwrite sync.
 */
import type { CategoryDocument, TaskDocument, DiaryDocument, SettingsDocument, BucketListDocument, BucketTaskLinkDocument } from '../src/db/schema';
import { fromCandidateSettingRow, toCandidateSettingWrite, type CandidateSettingRow, type CandidateSettingWrite } from './candidateSettingsMapping';
import { fromCandidateBucketRow, fromCandidateBucketLinkRow, toCandidateBucketWrite,
  toCandidateBucketLinkWrite, classifyCandidateLinkReferences,
  type CandidateBucketRow, type CandidateBucketLinkRow, type CandidateBucketWrite,
  type CandidateBucketLinkWrite } from './candidateBucketMapping';
import {
  parseCandidateRevision, toCandidateTaskWrite, toCandidateCategoryWrite,
  toCandidateDiaryWrite,
  validateCandidateIdentity, type CandidateIdentity,
  type CandidateTaskRow, type CandidateCategoryRow, type CandidateDiaryRow,
  type CandidateTaskWrite, type CandidateCategoryWrite, type CandidateDiaryWrite,
} from './candidateMapping';
import {
  CandidateAuthError, CandidateHttpError,
  type CandidateSessionProvider, type CandidateVerifiedSession,
} from './candidateHttpTransport';

type Domain = 'tasks' | 'categories' | 'diary' | 'settings' | 'buckets' | 'bucket_task_links';
type Row = CandidateTaskRow | CandidateCategoryRow | CandidateDiaryRow | CandidateSettingRow | CandidateBucketRow | CandidateBucketLinkRow;
type Write = CandidateTaskWrite | CandidateCategoryWrite | CandidateDiaryWrite | CandidateSettingWrite | CandidateBucketWrite | CandidateBucketLinkWrite;
const TABLE: Record<Domain, string> = {
  tasks: 'mosaic_candidate_tasks',
  categories: 'mosaic_candidate_categories',
  diary: 'mosaic_candidate_diary',
  settings: 'mosaic_candidate_settings',
  buckets: 'mosaic_candidate_buckets',
  bucket_task_links: 'mosaic_candidate_bucket_task_links',
};
const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CandidateCreateOutcome<T extends Row> =
  | { state: 'created'; row: T; revision: string }
  | { state: 'conflict'; row: T; revision: string };

function checkedId(id: string): void {
  if (!ID.test(id)) throw new Error('Invalid Mosaic candidate document ID');
}

function checkSession(
  session: CandidateVerifiedSession | null, owner: CandidateIdentity,
): CandidateVerifiedSession {
  if (!session || !UUID.test(session.userId) ||
    session.userId !== owner.supabaseUserId ||
    typeof session.accessToken !== 'string' || !session.accessToken ||
    !Number.isSafeInteger(session.sessionEpoch) || session.sessionEpoch < 0) {
    throw new CandidateAuthError('Candidate insert/master has no matching verified session');
  }
  return session;
}

function sameSession(first: CandidateVerifiedSession, next: CandidateVerifiedSession): boolean {
  return next.userId === first.userId &&
    next.sessionEpoch === first.sessionEpoch &&
    next.accessToken === first.accessToken;
}

function checkedRow(value: unknown, ownerId: string, id: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid candidate master row');
  const row = value as Row;
  if (row.owner_id !== ownerId || row.id !== id ||
    typeof row.is_deleted !== 'boolean' ||
    parseCandidateRevision(row.change_seq) < 1n)
    throw new Error('Candidate master returned foreign or invalid revision');
  return row;
}

export function createCandidateCreateTransport(options: {
  baseUrl: string;
  publishableKey: string;
  session: CandidateSessionProvider;
  fetcher?: typeof fetch;
}) {
  const base = new URL(options.baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
    base.username || base.password || base.search || base.hash ||
    !['', '/'].includes(base.pathname)) {
    throw new Error('Candidate insert/master needs a safe root HTTPS or loopback URL');
  }
  // Modern public keys only. A legacy JWT can embed service_role claims.
  if (!options.publishableKey?.startsWith('sb_publishable_') ||
    options.publishableKey !== options.publishableKey.trim() ||
    /\s/.test(options.publishableKey)) {
    throw new Error('Candidate insert/master requires a modern publishable key');
  }
  const fetcher = options.fetcher ?? fetch;

  async function authorizedRequest(
    path: string,
    user: CandidateVerifiedSession,
    method: 'GET' | 'POST',
    body?: Write,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetcher(new URL(path, base).toString(), {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: {
          apikey: options.publishableKey,
          Authorization: 'Bearer ' + user.accessToken,
          Accept: 'application/json',
          ...(method === 'POST'
            ? { 'Content-Type': 'application/json', Prefer: 'return=representation' }
            : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      // An ambiguous POST may already have committed. Never automatically retry.
      throw new CandidateHttpError(0);
    }
    if (response.status === 401 || response.status === 403)
      throw new CandidateAuthError('Supabase candidate request denied');
    return response;
  }

  async function verifyAfter(owner: CandidateIdentity, initial: CandidateVerifiedSession) {
    const next = checkSession(await options.session.getVerifiedSession(), owner);
    if (!sameSession(initial, next))
      throw new CandidateAuthError('Candidate account changed during insert/master request');
  }

  async function master(domain: Domain, id: string, identity: CandidateIdentity): Promise<Row | null> {
    validateCandidateIdentity(identity);
    checkedId(id);
    const before = checkSession(await options.session.getVerifiedSession(), identity);
    const query = new URLSearchParams({
      select: '*',
      owner_id: 'eq.' + identity.supabaseUserId,
      id: 'eq.' + id,
      limit: '1',
    });
    const response = await authorizedRequest(
      '/rest/v1/' + TABLE[domain] + '?' + query.toString(), before, 'GET',
    );
    if (!response.ok) throw new CandidateHttpError(response.status);
    let rows: unknown;
    try { rows = await response.json(); }
    catch { throw new Error('Invalid Supabase master JSON'); }
    await verifyAfter(identity, before);
    if (!Array.isArray(rows) || rows.length > 1)
      throw new Error('Invalid Supabase master cardinality');
    return rows.length ? checkedRow(rows[0], identity.supabaseUserId, id) : null;
  }

  async function create(
    domain: Domain, write: Write, identity: CandidateIdentity,
  ): Promise<CandidateCreateOutcome<Row>> {
    validateCandidateIdentity(identity);
    checkedId(write.id);
    if (write.owner_id !== identity.supabaseUserId)
      throw new Error('Candidate create owner mismatch');
    const before = checkSession(await options.session.getVerifiedSession(), identity);
    const response = await authorizedRequest('/rest/v1/' + TABLE[domain], before, 'POST', write);
    // Explicit 409, never an upsert; always read the *current* owner master.
    if (response.status === 409) {
      await verifyAfter(identity, before);
      const current = await master(domain, write.id, identity);
      if (!current) throw new Error('Duplicate candidate ID without accessible owner master');
      return {
        state: 'conflict', row: current,
        revision: parseCandidateRevision(current.change_seq).toString(),
      };
    }
    if (response.status !== 201) throw new CandidateHttpError(response.status);
    let rows: unknown;
    try { rows = await response.json(); }
    catch { throw new Error('Invalid Supabase inserted-row JSON'); }
    await verifyAfter(identity, before);
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new Error('Supabase candidate create lacked authoritative row');
    const created = checkedRow(rows[0], identity.supabaseUserId, write.id);
    return {
      state: 'created', row: created,
      revision: parseCandidateRevision(created.change_seq).toString(),
    };
  }

  return {
    readTaskMaster: (id: string, identity: CandidateIdentity) =>
      master('tasks', id, identity) as Promise<CandidateTaskRow | null>,
    readCategoryMaster: (id: string, identity: CandidateIdentity) =>
      master('categories', id, identity) as Promise<CandidateCategoryRow | null>,
    createTask: async (doc: TaskDocument, identity: CandidateIdentity) =>
      create('tasks', toCandidateTaskWrite(doc, identity), identity) as Promise<CandidateCreateOutcome<CandidateTaskRow>>,
    createCategory: async (doc: CategoryDocument, identity: CandidateIdentity) =>
      create('categories', toCandidateCategoryWrite(doc, identity), identity) as Promise<CandidateCreateOutcome<CandidateCategoryRow>>,
    readDiaryMaster: (id: string, identity: CandidateIdentity) =>
      master('diary', id, identity) as Promise<CandidateDiaryRow | null>,
    createDiary: async (doc: DiaryDocument, identity: CandidateIdentity) =>
      create('diary', toCandidateDiaryWrite(doc, identity), identity) as Promise<CandidateCreateOutcome<CandidateDiaryRow>>,
    // Source-only Settings transport: owner-only, no upsert, no runtime activation.
    readSettingMaster: async (id: string, identity: CandidateIdentity): Promise<CandidateSettingRow | null> => {
      const row = await master('settings', id, identity) as CandidateSettingRow | null;
      if (row) fromCandidateSettingRow(row, identity);
      return row;
    },
    createSetting: async (doc: SettingsDocument, identity: CandidateIdentity): Promise<CandidateCreateOutcome<CandidateSettingRow>> => {
      const write = toCandidateSettingWrite(doc, identity);
      const result = await create('settings', write, identity) as CandidateCreateOutcome<CandidateSettingRow>;
      // A forged or invalid result is not a successful create or conflict.
      fromCandidateSettingRow(result.row, identity);
      return result;
    },
    // Isolated Bucket List owner transport. No default runtime/collection.
    readBucketMaster: async (id: string, identity: CandidateIdentity): Promise<CandidateBucketRow | null> => {
      const row = await master('buckets', id, identity) as CandidateBucketRow | null;
      if (row) fromCandidateBucketRow(row, identity);
      return row;
    },
    createBucket: async (doc: BucketListDocument, identity: CandidateIdentity): Promise<CandidateCreateOutcome<CandidateBucketRow>> => {
      const write = toCandidateBucketWrite(doc, identity);
      const result = await create('buckets', write, identity) as CandidateCreateOutcome<CandidateBucketRow>;
      fromCandidateBucketRow(result.row, identity);
      return result;
    },
    readBucketLinkMaster: async (id: string, identity: CandidateIdentity): Promise<CandidateBucketLinkRow | null> => {
      const row = await master('bucket_task_links', id, identity) as CandidateBucketLinkRow | null;
      if (row) fromCandidateBucketLinkRow(row, identity);
      // This does not mark a historical referenced task as migrated/ready.
      return row;
    },
    createBucketLink: async (
      doc: BucketTaskLinkDocument, identity: CandidateIdentity,
      verifiedReferences: {
        buckets: ReadonlyMap<string, { userId: string; isDeleted: boolean }>;
        tasks: ReadonlyMap<string, { userId: string; isDeleted: boolean }>;
      },
    ): Promise<CandidateCreateOutcome<CandidateBucketLinkRow>> => {
      // Owner mapping and original IDs must be validated before any request.
      const write = toCandidateBucketLinkWrite(doc, identity);
      // Historical Appwrite links may contain 255-char task IDs. These must
      // stay in the migration quarantine, not be rewritten to a short ID.
      checkedId(write.task_id);
      const bucket = verifiedReferences.buckets.get(doc.bucketListId);
      const task = verifiedReferences.tasks.get(doc.taskId);
      if (!bucket || !task || bucket.userId !== identity.legacyUserId ||
          task.userId !== identity.legacyUserId)
        throw new Error('Bucket link missing trusted same-owner targets; quarantine required');
      const status = classifyCandidateLinkReferences(doc, identity, verifiedReferences);
      if (status === 'quarantined')
        throw new Error('Unresolved historical Bucket link must remain in quarantine');
      // Tombstone links may retain tombstoned but known same-owner targets.
      const result = await create('bucket_task_links', write, identity) as CandidateCreateOutcome<CandidateBucketLinkRow>;
      fromCandidateBucketLinkRow(result.row, identity);
      if (result.row.bucket_list_id !== write.bucket_list_id ||
          result.row.task_id !== write.task_id)
        throw new Error('Bucket link master returned a changed historical reference');
      return result;
    },
  };
}

/** #1027 pre-social Bucket List/link migration source contract; NOT a cloud writer. */
import type { BucketListDocument, BucketTaskLinkDocument } from '../src/db/schema';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';

const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
// Historic Appwrite Task IDs may be longer than newly created candidate IDs.
const HISTORIC_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;

export interface CandidateBucketWrite {
  owner_id: string;
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  achieved_at: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}
export type CandidateBucketRow = CandidateBucketWrite & {
  change_seq: string | number;
  server_updated_at: string;
};

export interface CandidateBucketLinkWrite {
  owner_id: string;
  id: string;
  bucket_list_id: string;
  task_id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}
export type CandidateBucketLinkRow = CandidateBucketLinkWrite & {
  change_seq: string | number;
  server_updated_at: string;
};

function checkId(id: unknown, task = false): asserts id is string {
  if (typeof id !== 'string' ||
      !(task ? HISTORIC_TASK_ID : ROW_ID).test(id))
    throw new Error('Invalid historical bucket/task reference ID');
}
function checkTime(value: unknown, optional = false): asserts value is string {
  if (typeof value !== 'string' || value.length > 50 ||
      (!optional || value.length !== 0) &&
      (!value.length || !Number.isFinite(Date.parse(value))))
    throw new Error('Invalid historical bucket timestamp');
}
function checkBucketFields(doc: BucketListDocument) {
  checkId(doc.id);
  if (typeof doc.title !== 'string' || doc.title.length > 255 ||
      typeof doc.description !== 'string' || doc.description.length > 2000 ||
      typeof doc.achieved !== 'boolean' || typeof doc.isDeleted !== 'boolean')
    throw new Error('Invalid owner Bucket List fields');
  checkTime(doc.achievedAt, true);
  checkTime(doc.createdAt);
  checkTime(doc.updatedAt);
}
function checkLinkFields(doc: BucketTaskLinkDocument) {
  checkId(doc.id);
  checkId(doc.bucketListId);
  checkId(doc.taskId, true);
  if (typeof doc.isDeleted !== 'boolean')
    throw new Error('Invalid historical link tombstone');
  checkTime(doc.createdAt);
  checkTime(doc.updatedAt);
}
function checkLocal(owner: string, identity: CandidateIdentity) {
  validateCandidateIdentity(identity);
  if (owner !== identity.legacyUserId)
    throw new Error('Refusing foreign legacy Bucket List owner');
}
function checkRemote(owner: string, identity: CandidateIdentity) {
  validateCandidateIdentity(identity);
  if (owner !== identity.supabaseUserId)
    throw new Error('Refusing foreign Supabase Bucket List owner');
}
export function toCandidateBucketWrite(
  doc: BucketListDocument, identity: CandidateIdentity,
): CandidateBucketWrite {
  checkLocal(doc.userId, identity);
  checkBucketFields(doc);
  return {
    owner_id: identity.supabaseUserId, id: doc.id,
    title: doc.title, description: doc.description,
    achieved: doc.achieved, achieved_at: doc.achievedAt,
    created_at: doc.createdAt, updated_at: doc.updatedAt,
    is_deleted: doc.isDeleted,
  };
}
export function fromCandidateBucketRow(
  row: CandidateBucketRow, identity: CandidateIdentity,
): BucketListDocument {
  checkRemote(row.owner_id, identity);
  const doc: BucketListDocument = {
    id: row.id, userId: identity.legacyUserId,
    title: row.title, description: row.description,
    achieved: row.achieved, achievedAt: row.achieved_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
  };
  checkBucketFields(doc);
  return doc;
}
export function toCandidateBucketLinkWrite(
  doc: BucketTaskLinkDocument, identity: CandidateIdentity,
): CandidateBucketLinkWrite {
  checkLocal(doc.userId, identity);
  checkLinkFields(doc);
  return {
    owner_id: identity.supabaseUserId, id: doc.id,
    bucket_list_id: doc.bucketListId, task_id: doc.taskId,
    created_at: doc.createdAt, updated_at: doc.updatedAt,
    is_deleted: doc.isDeleted,
  };
}
export function fromCandidateBucketLinkRow(
  row: CandidateBucketLinkRow, identity: CandidateIdentity,
): BucketTaskLinkDocument {
  checkRemote(row.owner_id, identity);
  const doc: BucketTaskLinkDocument = {
    id: row.id, userId: identity.legacyUserId,
    bucketListId: row.bucket_list_id, taskId: row.task_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
  };
  checkLinkFields(doc);
  return doc;
}

/** A missing or foreign target is quarantined, NEVER silently omitted/deleted. */
export function classifyCandidateLinkReferences(
  link: BucketTaskLinkDocument,
  identity: CandidateIdentity,
  references: {
    buckets: ReadonlyMap<string, { userId: string; isDeleted: boolean }>;
    tasks: ReadonlyMap<string, { userId: string; isDeleted: boolean }>;
  },
): 'ready' | 'quarantined' | 'tombstone' {
  toCandidateBucketLinkWrite(link, identity);
  if (link.isDeleted) return 'tombstone';
  const bucket = references.buckets.get(link.bucketListId);
  const task = references.tasks.get(link.taskId);
  if (!bucket || !task ||
      bucket.userId !== identity.legacyUserId || task.userId !== identity.legacyUserId ||
      bucket.isDeleted || task.isDeleted)
    return 'quarantined';
  return 'ready';
}

/**
 * Isolated Supabase migration candidate. NOT imported by Mosaic's runtime.
 *
 * Convert RxDB task/category documents without rewriting their legacy string
 * IDs or assuming Appwrite user IDs are Supabase Auth UUIDs. The identity
 * mapping must be established and verified separately.
 */
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../src/db/schema';

export interface CandidateIdentity {
  /** Verified current Appwrite/RxDB user ID, not necessarily a UUID. */
  legacyUserId: string;
  /** Verified corresponding Supabase Auth principal UUID. */
  supabaseUserId: string;
}

export interface CandidateTaskWrite {
  owner_id: string;
  id: string;
  title: string;
  completed: boolean;
  category_id: string;
  order_index: number;
  tags: string | null;
  task_date: string;
  memo: string | null;
  image: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  source: string | null;
  routine_id: string | null;
  reminder_time: string | null;
  reactions: string | null;
  visibility: TaskDocument['visibility'];
  is_deleted: boolean;
}

export interface CandidateCategoryWrite {
  owner_id: string;
  id: string;
  name: string;
  color: string;
  order_index: number;
  visibility: CategoryDocument['visibility'];
  icon: string | null;
  retired_on?: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface CandidateDiaryWrite {
  owner_id: string;
  id: string;
  entry_date: string;
  content: string;
  emoji: string;
  photos: string;
  visibility: 'private';
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}
export type CandidateDiaryRow = CandidateDiaryWrite & {
  change_seq: string | number;
  server_updated_at: string;
};

export type CandidateTaskRow = CandidateTaskWrite & {
  change_seq: string | number;
  server_updated_at: string;
};
export type CandidateCategoryRow = CandidateCategoryWrite & {
  change_seq: string | number;
  server_updated_at: string;
};

export function validateCandidateIdentity(identity: CandidateIdentity): void {
  if (!identity.legacyUserId) throw new Error('Unverified legacy account mapping');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identity.supabaseUserId,
    )
  ) {
    throw new Error('Expected a verified Supabase Auth UUID');
  }
}

function assertLocalOwner(userId: string, identity: CandidateIdentity): void {
  validateCandidateIdentity(identity);
  if (userId !== identity.legacyUserId) {
    throw new Error('Refusing to write a different legacy account');
  }
}

function assertRemoteOwner(ownerId: string, identity: CandidateIdentity): void {
  validateCandidateIdentity(identity);
  if (ownerId !== identity.supabaseUserId) {
    throw new Error('Refusing a Supabase row with unexpected owner');
  }
}

/** Server-controlled fields (change_seq, server_updated_at) must NOT be sent. */
export function toCandidateTaskWrite(
  doc: TaskDocument,
  identity: CandidateIdentity,
): CandidateTaskWrite {
  assertLocalOwner(doc.userId, identity);
  return {
    owner_id: identity.supabaseUserId,
    id: doc.id,
    title: doc.title,
    completed: doc.completed,
    category_id: doc.categoryId,
    order_index: doc.order,
    tags: doc.tags ?? null,
    task_date: doc.date,
    memo: doc.memo ?? null,
    image: doc.image ?? null,
    created_at: doc.createdAt,
    completed_at: doc.completedAt ?? null,
    updated_at: doc.updatedAt,
    source: doc.source ?? null,
    routine_id: doc.routineId ?? null,
    reminder_time: doc.reminderTime ?? null,
    reactions: doc.reactions ?? null,
    visibility: doc.visibility,
    is_deleted: doc.isDeleted,
  };
}

export function fromCandidateTaskRow(
  row: CandidateTaskRow,
  identity: CandidateIdentity,
): TaskDocument {
  assertRemoteOwner(row.owner_id, identity);
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    categoryId: row.category_id,
    order: row.order_index,
    tags: row.tags ?? undefined,
    date: row.task_date,
    memo: row.memo ?? undefined,
    image: row.image ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    updatedAt: row.updated_at,
    source: row.source ?? undefined,
    routineId: row.routine_id ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    reactions: row.reactions ?? undefined,
    visibility: row.visibility,
    userId: identity.legacyUserId,
    isDeleted: row.is_deleted,
  };
}

export function toCandidateCategoryWrite(
  doc: CategoryDocument,
  identity: CandidateIdentity,
): CandidateCategoryWrite {
  assertLocalOwner(doc.userId, identity);
  return {
    owner_id: identity.supabaseUserId,
    id: doc.id,
    name: doc.name,
    color: doc.color,
    order_index: doc.order,
    visibility: doc.visibility,
    icon: doc.icon ?? null,
    retired_on: doc.retiredOn ?? '',
    updated_at: doc.updatedAt,
    is_deleted: doc.isDeleted,
  };
}

export function fromCandidateCategoryRow(
  row: CandidateCategoryRow,
  identity: CandidateIdentity,
): CategoryDocument {
  assertRemoteOwner(row.owner_id, identity);
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order_index,
    visibility: row.visibility,
    icon: row.icon ?? undefined,
    retiredOn: row.retired_on ?? '',
    updatedAt: row.updated_at,
    userId: identity.legacyUserId,
    isDeleted: row.is_deleted,
  };
}

/** Private Diary has no social reader or newly supported remote image uploads. */
function checkDiaryDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
      !Number.isFinite(new Date(value + 'T00:00:00Z').valueOf()) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
    throw new Error('Invalid candidate Diary calendar date');
}

export function toCandidateDiaryWrite(
  doc: DiaryDocument, identity: CandidateIdentity,
): CandidateDiaryWrite {
  assertLocalOwner(doc.userId, identity);
  checkDiaryDate(doc.date);
  if (doc.visibility !== 'private')
    throw new Error('Supabase core Diary cannot publish followers/public entries');
  if (typeof doc.content !== 'string' && doc.content !== undefined ||
      typeof doc.emoji !== 'string' && doc.emoji !== undefined ||
      typeof doc.photos !== 'string' && doc.photos !== undefined)
    throw new Error('Invalid candidate Diary fields');
  return {
    owner_id: identity.supabaseUserId, id: doc.id, entry_date: doc.date,
    content: doc.content ?? '', emoji: doc.emoji ?? '',
    photos: doc.photos ?? '[]', visibility: 'private',
    created_at: doc.createdAt, updated_at: doc.updatedAt,
    is_deleted: doc.isDeleted,
  };
}

export function fromCandidateDiaryRow(
  row: CandidateDiaryRow, identity: CandidateIdentity,
): DiaryDocument {
  assertRemoteOwner(row.owner_id, identity);
  checkDiaryDate(row.entry_date);
  if (row.visibility !== 'private' || typeof row.content !== 'string' ||
      typeof row.emoji !== 'string' || typeof row.photos !== 'string')
    throw new Error('Unapproved Supabase Diary visibility/fields');
  return {
    id: row.id, date: row.entry_date,
    content: row.content, emoji: row.emoji, photos: row.photos,
    visibility: 'private', userId: identity.legacyUserId,
    createdAt: row.created_at, updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
  };
}

/** PostgreSQL int8 can exceed JS's safe numeric range. Never round a cursor. */
export function parseCandidateRevision(raw: string | number): bigint {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0)
      throw new Error('Unsafe numeric Supabase revision');
    return BigInt(raw);
  }
  if (!/^\d+$/.test(raw)) throw new Error('Invalid Supabase revision');
  return BigInt(raw);
}

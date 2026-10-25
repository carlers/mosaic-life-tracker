/**
 * Experimental paginated pull for the Supabase candidate.
 * NOT wired to Mosaic, RxDB, real Auth or the shipped sync loop.
 *
 * A future authenticated HTTP transport must filter by owner_id and
 * change_seq > after, ORDER BY change_seq ASC, LIMIT batchSize.
 * Even then, validate all remote rows before returning an advanced checkpoint.
 */
import type { TaskDocument, CategoryDocument, DiaryDocument, SettingsDocument } from '../src/db/schema';
import { fromCandidateSettingRow, type CandidateSettingRow } from './candidateSettingsMapping';
import {
  fromCandidateCategoryRow,
  fromCandidateTaskRow,
  fromCandidateDiaryRow,
  parseCandidateRevision,
  validateCandidateIdentity,
  type CandidateCategoryRow,
  type CandidateTaskRow,
  type CandidateDiaryRow,
  type CandidateIdentity,
} from './candidateMapping';

export type CandidateDomain = 'tasks' | 'categories' | 'diary';
/** New Settings domain is read-only until the migration writer is approved. */
export type CandidateReadDomain = CandidateDomain | 'settings';
export type CandidateCheckpoint = { changeSeq: string };

export interface CandidateChangeTransport {
  listChanges<R>(options: {
    domain: CandidateReadDomain;
    ownerId: string;
    afterExclusive: string;
    batchSize: number;
  }): Promise<R[]>;
}

type CandidateRow = { owner_id: string; change_seq: string | number; is_deleted: boolean };

function assertCheckpoint(cursor: CandidateCheckpoint | undefined): bigint {
  return cursor ? parseCandidateRevision(cursor.changeSeq) : 0n;
}

export async function pullCandidateChanges<Row extends CandidateRow, Doc>(options: {
  domain: CandidateReadDomain;
  transport: CandidateChangeTransport;
  identity: CandidateIdentity;
  checkpoint?: CandidateCheckpoint;
  batchSize: number;
  convert: (row: Row, identity: CandidateIdentity) => Doc;
}): Promise<{ documents: Array<Doc & { _deleted: false }>; checkpoint: CandidateCheckpoint | undefined }> {
  const { domain, transport, identity, batchSize } = options;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100)
    throw new Error('Invalid candidate pull batch size');

  validateCandidateIdentity(identity);
  const initial = assertCheckpoint(options.checkpoint);
  const rows = await transport.listChanges<Row>({
    domain,
    ownerId: identity.supabaseUserId,
    afterExclusive: initial.toString(),
    batchSize,
  });
  if (!Array.isArray(rows) || rows.length > batchSize)
    throw new Error('Invalid candidate response size');

  let cursor = initial;
  // No checkpoint is returned until the entire batch has been validated.
  const documents: Array<Doc & { _deleted: false }> = [];
  for (const row of rows) {
    if (!row || row.owner_id !== identity.supabaseUserId)
      throw new Error('Candidate pull included foreign owner');
    if (typeof row.is_deleted !== 'boolean')
      throw new Error('Candidate pull is missing a tombstone flag');
    const revision = parseCandidateRevision(row.change_seq);
    if (revision <= cursor)
      throw new Error('Candidate pull revision out of order or duplicated');
    const document = options.convert(row, identity);
    documents.push({ ...document, _deleted: false });
    cursor = revision;
  }
  return {
    documents,
    checkpoint: rows.length ? { changeSeq: cursor.toString() } : options.checkpoint,
  };
}

export function pullCandidateTasks(options: {
  transport: CandidateChangeTransport;
  identity: CandidateIdentity;
  checkpoint?: CandidateCheckpoint;
  batchSize: number;
}): Promise<{ documents: Array<TaskDocument & { _deleted: false }>; checkpoint: CandidateCheckpoint | undefined }> {
  return pullCandidateChanges<CandidateTaskRow, TaskDocument>({
    ...options, domain: 'tasks', convert: fromCandidateTaskRow,
  });
}

export function pullCandidateCategories(options: {
  transport: CandidateChangeTransport;
  identity: CandidateIdentity;
  checkpoint?: CandidateCheckpoint;
  batchSize: number;
}): Promise<{ documents: Array<CategoryDocument & { _deleted: false }>; checkpoint: CandidateCheckpoint | undefined }> {
  return pullCandidateChanges<CandidateCategoryRow, CategoryDocument>({
    ...options, domain: 'categories', convert: fromCandidateCategoryRow,
  });
}

export function pullCandidateDiary(options: {
  transport: CandidateChangeTransport;
  identity: CandidateIdentity;
  checkpoint?: CandidateCheckpoint;
  batchSize: number;
}): Promise<{ documents: Array<DiaryDocument & { _deleted: false }>; checkpoint: CandidateCheckpoint | undefined }> {
  return pullCandidateChanges<CandidateDiaryRow, DiaryDocument>({
    ...options, domain: 'diary', convert: fromCandidateDiaryRow,
  });
}

/** Source-only, signed Settings pull; no Settings cloud writer or RxDB side effect. */
export function pullCandidateSettings(options: {
  transport: CandidateChangeTransport;
  identity: CandidateIdentity;
  checkpoint?: CandidateCheckpoint;
  batchSize: number;
}): Promise<{ documents: Array<SettingsDocument & { _deleted: false }>; checkpoint: CandidateCheckpoint | undefined }> {
  return pullCandidateChanges<CandidateSettingRow, SettingsDocument>({
    ...options, domain: 'settings', convert: fromCandidateSettingRow,
  });
}

import { sendAppAction } from '../lib/appAction';
import { APPWRITE_DATABASE_ID } from '../lib/appwriteConfig';
import { guardedTablesDB } from '../lib/sdk';
import { assertRemoteRowOwnedBy } from './replicationOwnership';

export type OwnerWriteCasStatus =
  | { status: 'updated' }
  | { status: 'missing' }
  | { status: 'conflict'; row: Record<string, unknown> };

export interface OwnerMaster<T> {
  document: T;
  serverUpdatedAt: string;
}

function isNotFoundError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

export async function readOwnerMaster<T>(
  tableId: string,
  rowId: string,
  userId: string,
  mapRow: (row: Record<string, unknown>) => T
): Promise<OwnerMaster<T> | null> {
  try {
    const raw = (await guardedTablesDB.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      rowId,
    })) as unknown as Record<string, unknown>;
    assertRemoteRowOwnedBy(raw, userId, tableId);
    const serverUpdatedAt = raw.$updatedAt;
    if (typeof serverUpdatedAt !== 'string') {
      throw new Error('Invalid sync token');
    }
    return { document: mapRow(raw), serverUpdatedAt };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function updateOwnerRowWithCas(
  tableId: 'tasks' | 'categories' | 'diary' | 'settings' | 'bucket_list_items' | 'bucket_task_links',
  rowId: string,
  userId: string,
  expectedUpdatedAt: string,
  data: Record<string, unknown>,
  expectedCompleted?: boolean
): Promise<OwnerWriteCasStatus> {
  let response: Record<string, unknown>;
  try {
    response = await sendAppAction(
      {
        action: 'compare_and_set_owner_row',
        tableId,
        rowId,
        expectedUpdatedAt,
        data,
        ...(tableId === 'tasks' && typeof expectedCompleted === 'boolean'
          ? { expectedCompleted } : {}),
      },
      15_000
    );
  } catch (error) {
    if (
      !(error as { result?: { error?: string } })?.result?.error?.startsWith(
        'Unknown action'
      )
    ) {
      throw error;
    }
    try {
      await guardedTablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        rowId,
        data,
      });
      return { status: 'updated' };
    } catch (fallbackError) {
      if (isNotFoundError(fallbackError)) return { status: 'missing' };
      throw fallbackError;
    }
  }

  if (response.status === 'updated') return { status: 'updated' };
  if (response.status === 'missing') return { status: 'missing' };
  if (
    response.status === 'conflict' &&
    response.row &&
    typeof response.row === 'object' &&
    !Array.isArray(response.row)
  ) {
    const row = response.row as Record<string, unknown>;
    assertRemoteRowOwnedBy(row, userId, tableId);
    return { status: 'conflict', row };
  }
  throw new Error('Invalid CAS');
}


export type OwnerRowCreateResult =
  | { status: 'unsupported' }
  | { status: 'created' }
  | { status: 'existing'; row: Record<string, unknown> };

/**
 * Compatibility-first migration to owner-fenced server creates. "Unsupported"
 * means the shared Scratch Function has not been upgraded yet. Callers retain
 * the existing direct-create fallback until the audited ACL cutover.
 * Other failures are never silently converted into a direct write.
 */
export async function createOwnerRowViaFunction(
  tableId: 'tasks' | 'categories',
  rowId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<OwnerRowCreateResult> {
  let response: Record<string, unknown>;
  try {
    response = await sendAppAction({
      action: 'create_owner_row', tableId, rowId, data,
    }, 15_000);
  } catch (error) {
    const candidate = error as { code?: number; result?: { error?: unknown } };
    if (candidate?.code === 400 &&
      typeof candidate.result?.error === 'string' &&
      candidate.result.error.startsWith('Unknown action:')) {
      return { status: 'unsupported' };
    }
    throw error;
  }
  if (response.status === 'created' && response.ok === true) {
    return { status: 'created' };
  }
  if (response.status === 'existing' && response.ok === true &&
    response.row && typeof response.row === 'object' &&
    !Array.isArray(response.row)) {
    const row = response.row as Record<string, unknown>;
    assertRemoteRowOwnedBy(row, userId, tableId);
    return { status: 'existing', row };
  }
  throw new Error('Invalid owner row create response');
}

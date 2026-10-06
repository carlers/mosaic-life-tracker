import { sendAppAction } from '../lib/appAction';
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

function isUnsupportedAction(error: unknown): boolean {
  const candidate = error as {
    code?: number;
    result?: { error?: unknown };
  };
  return (
    candidate?.code === 400 &&
    typeof candidate.result?.error === 'string' &&
    candidate.result.error.startsWith('Unknown action:')
  );
}

export async function readOwnerMaster<T>(input: {
  databaseId: string;
  tableId: string;
  rowId: string;
  userId: string;
  ownerLabel: string;
  mapRow: (row: Record<string, unknown>) => T;
}): Promise<OwnerMaster<T> | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: input.databaseId,
      tableId: input.tableId,
      rowId: input.rowId,
    });
    const raw = row as unknown as Record<string, unknown>;
    assertRemoteRowOwnedBy(raw, input.userId, input.ownerLabel);
    const serverUpdatedAt = raw.$updatedAt;
    if (
      typeof serverUpdatedAt !== 'string' ||
      Number.isNaN(Date.parse(serverUpdatedAt))
    ) {
      throw new Error(
        `${input.ownerLabel} replication master missing valid $updatedAt for ${input.rowId}`
      );
    }
    return {
      document: input.mapRow(raw),
      serverUpdatedAt,
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function fallbackDirectUpdate(input: {
  databaseId: string;
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
}): Promise<OwnerWriteCasStatus> {
  try {
    await guardedTablesDB.updateRow({
      databaseId: input.databaseId,
      tableId: input.tableId,
      rowId: input.rowId,
      data: input.data,
    });
    return { status: 'updated' };
  } catch (error) {
    if (isNotFoundError(error)) return { status: 'missing' };
    throw error;
  }
}

/**
 * Compare-and-set an owner-controlled row through the trusted message-action
 * Function. The Function atomically filters on $id + server $updatedAt +
 * user_id, so a concurrent write becomes a conflict instead of a silent
 * overwrite.
 *
 * During a staggered backend/client rollout, an older Function can reject the
 * new action. In that one compatibility case we retain the previous direct
 * update behavior so Preview clients are not write-broken before activation.
 */
export async function updateOwnerRowWithCas(input: {
  databaseId: string;
  tableId: 'tasks' | 'categories' | 'diary' | 'settings';
  rowId: string;
  userId: string;
  expectedUpdatedAt: string;
  data: Record<string, unknown>;
}): Promise<OwnerWriteCasStatus> {
  let response: Record<string, unknown>;
  try {
    response = await sendAppAction(
      {
        action: 'compare_and_set_owner_row',
        tableId: input.tableId,
        rowId: input.rowId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        data: input.data,
      },
      15_000
    );
  } catch (error) {
    if (!isUnsupportedAction(error)) throw error;
    return fallbackDirectUpdate(input);
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
    assertRemoteRowOwnedBy(row, input.userId, 'Owner write CAS');
    return { status: 'conflict', row };
  }
  throw new Error('Owner write CAS returned an invalid response');
}

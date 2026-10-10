const { Query } = require('node-appwrite');
const { isScheduledTask } = require('./task-placement');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const MAX_ROW_ID_LENGTH = 36;
const ROW_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const TABLE_FIELDS = {
  tasks: new Set([
    'title', 'is_completed', 'category_id', 'order', 'tags', 'date', 'memo',
    'image', 'created_at', 'completed_at', 'updated_at', 'source', 'user_id',
    'deleted', 'visibility', 'routine_id', 'reminder_time', 'reactions',
  ]),
  categories: new Set([
    'name', 'color', 'order', 'visibility', 'user_id', 'deleted', 'icon',
    'updated_at',
  ]),
  diary: new Set([
    'date', 'content', 'visibility', 'user_id', 'updated_at', 'deleted',
    'created_at',
  ]),
  settings: new Set([
    'user_id', 'key', 'value', 'deleted', 'updated_at',
  ]),
};

function isValidRowId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ROW_ID_LENGTH &&
    ROW_ID_REGEX.test(value)
  );
}

function isValidIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateData(tableId, data, callerId) {
  const allowed = TABLE_FIELDS[tableId];
  if (!allowed || !isPlainObject(data) || data.user_id !== callerId) {
    return false;
  }
  return Object.keys(data).every(
    (key) => !key.startsWith('$') && allowed.has(key)
  );
}

async function handleOwnerWriteCas(db, callerId, payload) {
  const tableId = payload?.tableId;
  const rowId = payload?.rowId;
  const expectedUpdatedAt = payload?.expectedUpdatedAt;
  const data = payload?.data;

  if (
    !Object.prototype.hasOwnProperty.call(TABLE_FIELDS, tableId) ||
    !isValidRowId(rowId) ||
    !isValidIso(expectedUpdatedAt) ||
    !validateData(tableId, data, callerId)
  ) {
    return { status: 400, body: { error: 'Invalid owner write CAS request' } };
  }

  const queries = [
    Query.equal('$id', rowId),
    Query.equal('$updatedAt', expectedUpdatedAt),
    Query.equal('user_id', callerId),
  ];

  if (tableId === 'tasks') {
    // A shared task must never silently move into private Backlog while an
    // accepted or pending collaborator still has a live membership. Reject
    // malformed/undated placements before a CAS update; owner may unshare
    // first, then retry the same task ID without cloning or deleting it.
    if (Object.prototype.hasOwnProperty.call(data, 'date') &&
        !isScheduledTask(data)) {
      const activeShares = await db.listRows({
        databaseId: DATABASE_ID, tableId: 'task_shares',
        queries: [
          Query.equal('task_id', rowId),
          Query.equal('status', ['pending', 'accepted']),
          Query.limit(1),
        ], total: false,
      });
      if ((activeShares.rows || []).length > 0) {
        const current = await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
        if (current?.user_id !== callerId) {
          return { status: 403, body: { error: 'Owner mismatch' } };
        }
        return { status: 200, body: { ok: true, status: 'conflict', row: current } };
      }
    }
    // A pre-sharing client may still call this Function even after its direct
    // Appwrite update permission was removed. Its old local bootstrap logic
    // could read a fresh server token, then overwrite collaborator completion
    // with a stale local value. Require a client-observed completion baseline
    // for *every* task with a sharing history, even after the last revoke.
    const observed = payload?.expectedCompleted;
    if (observed !== undefined && typeof observed !== 'boolean') {
      return { status: 400, body: { error: 'Invalid expected completion state' } };
    }
    if (typeof observed === 'boolean') {
      // Atomic with the normal row revision predicate. This extra condition
      // is cheap for upgraded clients (no additional listRows request).
      queries.push(Query.equal('is_completed', observed));
    } else {
      const sharePage = await db.listRows({
        databaseId: DATABASE_ID, tableId: 'task_shares',
        queries: [Query.equal('task_id', rowId), Query.limit(1)], total: false,
      });
      if ((sharePage.rows || []).length > 0) {
        const current = await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
        if (current?.user_id !== callerId) {
          return { status: 403, body: { error: 'Owner mismatch' } };
        }
        return { status: 200, body: { ok: true, status: 'conflict', row: current } };
      }
    }
  }

  const result = await db.updateRows({
    databaseId: DATABASE_ID, tableId, data, queries,
  });

  const updatedCount =
    typeof result?.total === 'number'
      ? result.total
      : Array.isArray(result?.rows)
        ? result.rows.length
        : 0;

  if (updatedCount === 1) {
    return { status: 200, body: { ok: true, status: 'updated' } };
  }
  if (updatedCount > 1) {
    throw new Error(
      `Owner write CAS unexpectedly updated ${updatedCount} rows for ${tableId}/${rowId}`
    );
  }

  try {
    const current = await db.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
    });
    if (current?.user_id !== callerId) {
      return { status: 403, body: { error: 'Owner mismatch' } };
    }
    return {
      status: 200,
      body: { ok: true, status: 'conflict', row: current },
    };
  } catch (err) {
    if (err?.code === 404) {
      return { status: 200, body: { ok: true, status: 'missing' } };
    }
    throw err;
  }
}

module.exports = { handleOwnerWriteCas };

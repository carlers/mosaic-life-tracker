'use strict';

const { Query } = require('node-appwrite');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const MAX_BATCH = 12;
const PREFLIGHT_PAGE_SIZE = 100;
const MAX_PREFLIGHT_PAGES = 1000;
const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const accepted = new Set(['move', 'delete']);
const error = (status, message) => ({ status, body: { error: message } });

function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validCategoryDateRange(startedOn, retiredOn) {
  const start = startedOn || '';
  const end = retiredOn || '';
  return (!start || validDateKey(start)) && (!end || validDateKey(end)) &&
    (!start || !end || start <= end);
}
function categoryAllowsTaskDate(category, date, ownerLocalDate) {
  if (!category || !validCategoryDateRange(category.started_on, category.retired_on)) return false;
  const start = category.started_on || '';
  const end = category.retired_on || '';
  if (date === '') {
    return !end && (!start || (validDateKey(ownerLocalDate) && start <= ownerLocalDate));
  }
  return validDateKey(date) && (!start || date >= start) && (!end || date <= end);
}

async function ownerCategory(db, ownerId, id) {
  try {
    const row = await db.getRow({databaseId: DATABASE_ID, tableId: 'categories', rowId: id});
    return row?.user_id === ownerId ? row : null;
  } catch (e) {
    if (e?.code === 404) return null;
    throw e;
  }
}

function updateCount(result) {
  if (!Number.isSafeInteger(result?.total)) {
    throw new Error('Lifecycle CAS count unavailable');
  }
  if (result.total > 1) throw new Error('Lifecycle CAS wrote more than one row');
  return result.total;
}

function sourceQueries(ownerId, sourceId, limit = MAX_BATCH, cursor) {
  return [
    Query.equal('user_id', ownerId),
    Query.equal('category_id', sourceId),
    Query.equal('deleted', false),
    Query.orderAsc('$id'),
    Query.limit(limit),
    ...(cursor ? [Query.cursorAfter(cursor)] : []),
  ];
}

/** Bounded, exhaustive, read-only preflight. Never treat a truncated page as success. */
async function listSourceTasksForPreflight(db, ownerId, sourceId) {
  const rows = [];
  let cursor;
  for (let pageIndex = 0; pageIndex < MAX_PREFLIGHT_PAGES; pageIndex++) {
    const page = await db.listRows({
      databaseId: DATABASE_ID, tableId: 'tasks',
      queries: sourceQueries(ownerId, sourceId, PREFLIGHT_PAGE_SIZE, cursor),
      ttl: 0, total: false,
    });
    if (!Array.isArray(page?.rows)) throw new Error('Category move preflight page unavailable');
    rows.push(...page.rows);
    if (page.rows.length < PREFLIGHT_PAGE_SIZE) return rows;
    const nextCursor = page.rows.at(-1)?.$id;
    if (typeof nextCursor !== 'string' || !nextCursor || nextCursor === cursor) {
      throw new Error('Category move preflight cursor unavailable');
    }
    cursor = nextCursor;
  }
  throw new Error('Category move preflight exceeded its safety limit');
}

function sourceTasksFitDestination(tasks, callerId, sourceId, destination, ownerLocalDate) {
  return tasks.every(task => task.user_id === callerId &&
    task.category_id === sourceId && task.deleted === false &&
    typeof task.$updatedAt === 'string' &&
    categoryAllowsTaskDate(destination, task.date, ownerLocalDate));
}

/** Release only the exact held category lock; never release another operation. */
async function releaseClaim(db, callerId, id, mode, target) {
  const released = await db.updateRows({
    databaseId: DATABASE_ID, tableId: 'categories',
    queries: [
      Query.equal('$id', id),
      Query.equal('user_id', callerId),
      Query.equal('deleted', false),
      Query.equal('lifecycle_state', mode),
      Query.equal('lifecycle_target', target),
      Query.limit(1),
    ],
    data: {lifecycle_state: '', lifecycle_target: '', updated_at: new Date().toISOString()},
  });
  return updateCount(released) === 1;
}

async function remainingTasks(db, ownerId, sourceId) {
  const page = await db.listRows({
    databaseId: DATABASE_ID, tableId: 'tasks',
    queries: sourceQueries(ownerId, sourceId, 1),
    ttl: 0, total: true,
  });
  if (!Number.isSafeInteger(page?.total) || page.total < 0) {
    throw new Error('Lifecycle count unavailable');
  }
  return page.total;
}

async function claimCategory(db, callerId, category, mode, targetId) {
  if (category.lifecycle_state === mode && (category.lifecycle_target || '') === targetId) {
    return category;
  }
  if (category.lifecycle_state) return null;
  const claimed = await db.updateRows({
    databaseId: DATABASE_ID, tableId: 'categories',
    queries: [
      Query.equal('$id', category.$id),
      Query.equal('$updatedAt', category.$updatedAt),
      Query.equal('user_id', callerId),
      Query.equal('deleted', false),
      Query.equal('lifecycle_state', ''),
      Query.limit(1),
    ],
    data: {
      lifecycle_state: mode,
      lifecycle_target: targetId,
      updated_at: new Date().toISOString(),
    },
  });
  if (updateCount(claimed) !== 1) return null;
  return { ...category, lifecycle_state: mode, lifecycle_target: targetId };
}

async function revokeTaskAssociations(db, callerId, taskId, now) {
  // Shares do not have a deleted column. Revocation makes them invisible to
  // invitees without destroying grant history; subsequent share changes are
  // independently fenced by the task's deleted state.
  await db.updateRows({
    databaseId: DATABASE_ID, tableId: 'task_shares',
    queries: [
      Query.equal('owner_id', callerId),
      Query.equal('task_id', taskId),
      Query.notEqual('status', 'revoked'),
      Query.limit(100),
    ],
    data: {status: 'revoked', updated_at: now},
  });
  await db.updateRows({
    databaseId: DATABASE_ID, tableId: 'bucket_task_links',
    queries: [
      Query.equal('user_id', callerId),
      Query.equal('task_id', taskId),
      Query.equal('deleted', false),
      Query.limit(100),
    ],
    data: {deleted: true, updated_at: now},
  });
}

// One small bounded, restartable batch per signed invocation. This action
// must remain behind server-only row writes; it cannot safely race direct
// table create or owner row update/delete grants.
async function handleCategoryLifecycleOperation(db, callerId, payload) {
  // Off until table create permissions and all existing row write grants
  // have been migrated to server-only, with signed regression coverage.
  if (process.env.CATEGORY_DESTRUCTIVE_ENABLED !== 'true') {
    return error(503, 'Category deletion is not enabled');
  }
  const sourceId = payload?.categoryId;
  const mode = payload?.mode;
  const targetId = mode === 'move' ? payload?.destinationId : '';
  const ownerLocalDate = payload?.ownerLocalDate;
  if (!ID.test(sourceId || '') || !accepted.has(mode) ||
      (mode === 'move' && (!ID.test(targetId || '') || targetId === sourceId)) ||
      (mode === 'delete' && payload?.destinationId) ||
      (ownerLocalDate !== undefined && !validDateKey(ownerLocalDate))) {
    return error(400, 'Invalid category lifecycle request');
  }
  const category = await ownerCategory(db, callerId, sourceId);
  if (!category) return error(404, 'Category not found');
  if (category.deleted === true) {
    return {status: 200, body: {ok: true, status: 'done', affected: 0, remaining: 0}};
  }
  if (payload?.confirmName !== category.name) {
    return error(400, 'Confirm the category name before continuing');
  }
  const sourceWasLocked = category.lifecycle_state === mode &&
    (category.lifecycle_target || '') === targetId;
  let target = null;
  let targetWasLocked = false;
  if (mode === 'move') {
    target = await ownerCategory(db, callerId, targetId);
    targetWasLocked = target?.lifecycle_state === 'move-target' &&
      (target.lifecycle_target || '') === sourceId;
    if (!target || target.deleted === true ||
        (target.lifecycle_state && !targetWasLocked) ||
        !validCategoryDateRange(target.started_on, target.retired_on)) {
      return error(409, 'Destination category unavailable');
    }
    // Validate all source tasks before touching either category. A category
    // with thousands of tasks must not partially migrate on an invalid date.
    if (!sourceWasLocked || !targetWasLocked) {
      const pending = await listSourceTasksForPreflight(db, callerId, sourceId);
      if (!sourceTasksFitDestination(pending, callerId, sourceId, target, ownerLocalDate)) {
        return error(409, 'Some tasks fall outside destination active dates');
      }
    }
  }
  const locked = await claimCategory(db, callerId, category, mode, targetId);
  if (!locked) return error(409, 'Category operation changed; refresh to resume');

  if (mode === 'move') {
    const lockedTarget = await claimCategory(db, callerId, target, 'move-target', sourceId);
    if (!lockedTarget) {
      if (!sourceWasLocked &&
          !await releaseClaim(db, callerId, sourceId, mode, targetId)) {
        return error(409, 'Category locks could not be safely released');
      }
      return error(409, 'Destination category changed; retry operation');
    }
    // The source lock prevents fresh creates, and the destination lock fences
    // category metadata edits. Recheck after both locks to close the race.
    if (!sourceWasLocked || !targetWasLocked) {
      const remaining = await listSourceTasksForPreflight(db, callerId, sourceId);
      if (!sourceTasksFitDestination(remaining, callerId, sourceId, lockedTarget, ownerLocalDate)) {
        const releasedTarget = targetWasLocked ||
          await releaseClaim(db, callerId, targetId, 'move-target', sourceId);
        const releasedSource = sourceWasLocked ||
          await releaseClaim(db, callerId, sourceId, mode, targetId);
        if (!releasedTarget || !releasedSource) {
          return error(409, 'Category locks could not be safely released');
        }
        return error(409, 'Some tasks fall outside destination active dates');
      }
    }
  }

  const page = await db.listRows({
    databaseId: DATABASE_ID, tableId: 'tasks',
    queries: sourceQueries(callerId, sourceId),
    ttl: 0, total: false,
  });
  if (!Array.isArray(page?.rows)) throw new Error('Lifecycle task page unavailable');
  let affected = 0;
  const now = new Date().toISOString();
  for (const task of page.rows) {
    if (task.user_id !== callerId || task.category_id !== sourceId ||
        task.deleted !== false || typeof task.$updatedAt !== 'string') {
      throw new Error('Unexpected lifecycle task row');
    }
    if (mode === 'delete') await revokeTaskAssociations(db, callerId, task.$id, now);
    const data = mode === 'delete' ?
      {deleted: true, category_delete_marker: sourceId, updated_at: now} :
      {
        category_id: targetId,
        ...(task.visibility === '' ? {visibility: category.visibility || 'private'} : {}),
        updated_at: now,
      };
    const updated = await db.updateRows({
      databaseId: DATABASE_ID, tableId: 'tasks', data,
      queries: [
        Query.equal('$id', task.$id),
        Query.equal('user_id', callerId),
        Query.equal('category_id', sourceId),
        Query.equal('deleted', false),
        Query.equal('$updatedAt', task.$updatedAt),
        Query.limit(1),
      ],
    });
    if (updateCount(updated) !== 1) {
      return error(409, 'Task changed; retry category operation');
    }
    affected++;
  }
  const remaining = await remainingTasks(db, callerId, sourceId);
  if (remaining > 0) {
    return {status: 200, body: {ok: true, status: 'processing', affected, remaining}};
  }
  if (mode === 'move' &&
      !await releaseClaim(db, callerId, targetId, 'move-target', sourceId)) {
    return error(409, 'Destination category lock could not be released');
  }
  const finished = await db.updateRows({
    databaseId: DATABASE_ID, tableId: 'categories',
    queries: [
      Query.equal('$id', sourceId),
      Query.equal('user_id', callerId),
      Query.equal('deleted', false),
      Query.equal('lifecycle_state', mode),
      Query.equal('lifecycle_target', targetId),
      Query.limit(1),
    ],
    data: {deleted: true, lifecycle_target: mode === 'delete' ? 'recoverable' : targetId, updated_at: now},
  });
  if (updateCount(finished) !== 1) return error(409, 'Category changed; retry completion');
  return {status: 200, body: {ok: true, status: 'done', affected, remaining: 0}};
}

module.exports = {handleCategoryLifecycleOperation};

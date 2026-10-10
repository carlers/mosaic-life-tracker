'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { Query, Permission, Role } = require('node-appwrite');
const { idFor: friendshipId, read } = require('./friendship');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const SHARES = 'task_shares';
const TASKS = 'tasks';
const FRIENDSHIPS = process.env.APPWRITE_TABLE_FRIENDSHIPS || 'friendships';
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/.test(value);
const shareId = (taskId, inviteeId) =>
  'shr_' + createHash('sha256').update(taskId + '|' + inviteeId).digest('hex').slice(0, 32);
const answer = (status, error) => ({ status, body: { error } });
const live = (row) => row && row.deleted !== true;

async function mutualFriends(db, left, right, transactionId) {
  if (left === right || !validId(left) || !validId(right)) return false;
  const [one, two] = await Promise.all([
    read(db, FRIENDSHIPS, friendshipId(left, right), transactionId),
    read(db, FRIENDSHIPS, friendshipId(right, left), transactionId),
  ]);
  if (![one, two].every(row => live(row) && row.status === 'accepted' &&
      typeof row.updated_at === 'string' && row.updated_at)) return null;
  return createHash('sha256').update([one.updated_at, two.updated_at].join('|'))
    .digest('hex').slice(0, 40);
}

// Never return an owner task row: it contains category, memo, image and other private fields.
function projection(task, membership, includeInvitee) {
  return {
    id: membership.$id,
    taskId: membership.task_id,
    ownerId: membership.owner_id,
    ...(includeInvitee ? { inviteeId: membership.invitee_id } : {}),
    status: membership.status,
    allowTitleEdit: membership.allow_title_edit === true,
    allowDateEdit: membership.allow_date_edit === true,
    grantEpoch: membership.grant_epoch,
    membershipRevision: membership.$updatedAt || membership.updated_at,
    title: task.title,
    date: task.date,
    completed: task.is_completed === true,
    completionRevision: task.$updatedAt,
  };
}

async function list(db, caller, scope, cursor) {
  if (scope !== 'received' && scope !== 'owned') return answer(400, 'Invalid share scope');
  if (cursor && !validId(cursor)) return answer(400, 'Invalid cursor');
  const field = scope === 'owned' ? 'owner_id' : 'invitee_id';
  const query = [Query.equal(field, caller), Query.orderAsc('$id'), Query.limit(50)];
  if (cursor) query.push(Query.cursorAfter(cursor));
  const page = await db.listRows({
    databaseId: DATABASE_ID, tableId: SHARES, queries: query, total: false,
  });
  const items = [];
  const rows = page.rows || [];
  // Owner lists often contain multiple invitees for one task. Reuse the same
  // server reads within each paginated request and bound fan-out to keep the
  // Appwrite Free-tier round-trip and concurrent request budgets predictable.
  const taskReads = new Map();
  const friendshipReads = new Map();
  const memo = (cache, key, load) => {
    if (!cache.has(key)) cache.set(key, load());
    return cache.get(key);
  };
  for (let index = 0; index < rows.length; index += 6) {
    const chunk = await Promise.all(rows.slice(index, index + 6).map(async membership => {
      if (membership[field] !== caller ||
          !['pending', 'accepted'].includes(membership.status)) return null;
      const peerKey = membership.owner_id + '|' + membership.invitee_id;
      const friendshipVersion = await memo(friendshipReads, peerKey, () =>
        mutualFriends(db, membership.owner_id, membership.invitee_id));
      if (!friendshipVersion || membership.friendship_version !== friendshipVersion) return null;
      const task = await memo(taskReads, membership.task_id, () =>
        read(db, TASKS, membership.task_id));
      if (!live(task) || task.user_id !== membership.owner_id) return null;
      return projection(task, membership, scope === 'owned');
    }));
    for (const item of chunk) if (item) items.push(item);
  }
  return { status: 200, body: { ok: true, items,
    nextCursor: rows.length === 50 ? rows[rows.length - 1].$id : '' } };
}

async function handleTaskShares(db, caller, payload) {
  const operation = payload?.operation;
  if (operation === 'list') return list(db, caller, payload.scope, payload.cursor);

  const taskId = payload?.taskId;
  const ownerOperation = ['invite', 'revoke', 'set_permissions'].includes(operation);
  const ownerId = ownerOperation ? caller : payload?.ownerId;
  const inviteeId = ownerOperation ? payload?.friendUserId : caller;
  if (!validId(caller) || !validId(taskId) || !validId(ownerId) ||
      !validId(inviteeId) || ownerId === inviteeId ||
      !['invite', 'accept', 'decline', 'leave', 'revoke', 'set_completed', 'set_permissions', 'edit_title', 'edit_date'].includes(operation)) {
    return answer(400, 'Invalid shared task request');
  }
  if (['accept', 'decline', 'leave', 'set_completed', 'edit_title', 'edit_date'].includes(operation) && ownerId === caller) {
    return answer(403, 'Not a collaborator');
  }
  const key = shareId(taskId, inviteeId);
  const tx = await db.createTransaction({ ttl: 60 });
  let committed = false;
  try {
    const [task, membership, friends] = await Promise.all([
      read(db, TASKS, taskId, tx.$id),
      read(db, SHARES, key, tx.$id),
      mutualFriends(db, ownerId, inviteeId, tx.$id),
    ]);
    if (!live(task) || task.user_id !== ownerId) return answer(404, 'Task unavailable');
    if (!friends) return answer(403, 'Friendship required');
    if (membership && (membership.task_id !== taskId ||
        membership.owner_id !== ownerId || membership.invitee_id !== inviteeId)) {
      return answer(409, 'Invalid membership');
    }
    const status = membership?.status;
    const sameFriendship = membership?.friendship_version === friends;
    const requiresOperationId = ['accept', 'decline', 'leave'].includes(operation);
    if (requiresOperationId && !validId(payload.operationId)) {
      return answer(400, 'Invalid membership operation ID');
    }
    if (payload.operationId !== undefined && !validId(payload.operationId)) {
      return answer(400, 'Invalid operation ID');
    }
    const desiredMembershipStatus = {
      accept: 'accepted', decline: 'declined', leave: 'left', revoke: 'revoked',
    }[operation];
    if (membership && desiredMembershipStatus &&
      membership.last_membership_command_id === payload.operationId &&
      status === desiredMembershipStatus && sameFriendship) {
      return { status: 200, body: { ok: true, duplicate: true,
        item: projection(task, membership, ownerId === caller) } };
    }
    const now = new Date().toISOString();
    let patch = null;
    let taskPatch = null;
    if (operation === 'invite') {
      if (sameFriendship && ['pending', 'accepted'].includes(status)) {
        return { status: 200, body: { ok: true, item: projection(task, membership, true) } };
      }
      patch = {
        task_id: taskId, owner_id: ownerId, invitee_id: inviteeId,
        status: 'pending', grant_epoch: randomUUID(), friendship_version: friends,
        last_command_id: '', last_membership_command_id: '',
        last_command_target: false, allow_title_edit: false, allow_date_edit: false, created_at: now,
        updated_at: now,
      };
    } else {
      if (!membership) return answer(404, 'Invitation unavailable');
      if (!sameFriendship) return answer(403, 'Friendship changed; a new invitation is required');
      if (operation === 'accept' || operation === 'decline') {
        if (status !== 'pending') return answer(409, 'Invitation changed');
        if (payload.grantEpoch !== membership.grant_epoch) return answer(409, 'Invitation changed');
        patch = { status: operation === 'accept' ? 'accepted' : 'declined',
          last_membership_command_id: payload.operationId, updated_at: now };
      } else if (operation === 'leave' || operation === 'revoke') {
        if (status !== 'accepted' && status !== 'pending') return answer(409, 'Share changed');
        if (operation === 'leave' && status !== 'accepted') return answer(409, 'Share changed');
        if (payload.grantEpoch !== membership.grant_epoch) return answer(409, 'Share changed');
        patch = { status: operation === 'leave' ? 'left' : 'revoked',
          last_membership_command_id: payload.operationId || '', updated_at: now };
      } else if (operation === 'set_permissions') {
        if (status !== 'pending' && status !== 'accepted') return answer(409, 'Share changed');
        if (payload.grantEpoch !== membership.grant_epoch) return answer(409, 'Share changed');
        if (typeof payload.allowTitleEdit !== 'boolean' ||
            typeof payload.allowDateEdit !== 'boolean') return answer(400, 'Invalid edit permissions');
        patch = {
          allow_title_edit: payload.allowTitleEdit,
          allow_date_edit: payload.allowDateEdit,
          updated_at: now,
        };
      } else if (operation === 'edit_title' || operation === 'edit_date') {
        if (status !== 'accepted' || payload.grantEpoch !== membership.grant_epoch)
          return answer(403, 'Share unavailable');
        if (!(operation === 'edit_title' ? membership.allow_title_edit : membership.allow_date_edit))
          return answer(403, 'Owner has not granted this edit');
        if (typeof payload.expectedRevision !== 'string' || !payload.expectedRevision)
          return answer(400, 'Missing task revision');
        if (task.$updatedAt !== payload.expectedRevision)
          return { status: 409, body: { error: 'Task changed; refresh and retry',
            item: projection(task, membership, false) } };
        if (operation === 'edit_title') {
          if (typeof payload.title !== 'string' ||
              payload.title !== payload.title.trim() ||
              payload.title.length < 1 || payload.title.length > 255)
            return answer(400, 'Invalid shared title');
          taskPatch = { title: payload.title, updated_at: now };
        } else {
          const date = payload.date;
          if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              Number.isNaN(Date.parse(date + 'T00:00:00Z')) ||
              new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)
            return answer(400, 'Invalid shared date');
          taskPatch = { date, updated_at: now };
        }
        patch = { updated_at: now };
      } else if (operation === 'set_completed') {
        if (status !== 'accepted' || payload.grantEpoch !== membership.grant_epoch) {
          return answer(403, 'Share unavailable');
        }
        if (!validId(payload.operationId) || typeof payload.completed !== 'boolean' ||
            typeof payload.expectedRevision !== 'string' || !payload.expectedRevision) {
          return answer(400, 'Invalid completion command');
        }
        if (membership.last_command_id === payload.operationId) {
          if (membership.last_command_target !== payload.completed) {
            return answer(409, 'Command identity reused');
          }
          return { status: 200, body: { ok: true, duplicate: true,
            item: projection(task, membership, false) } };
        }
        if (task.$updatedAt !== payload.expectedRevision) {
          return { status: 409, body: { error: 'Completion changed',
            item: projection(task, membership, false) } };
        }
        // Only the completion fields may change. All other owner fields remain untouched.
        if ((task.is_completed === true) !== payload.completed) {
          taskPatch = {
            is_completed: payload.completed,
            completed_at: payload.completed ? now : '',
            updated_at: now,
          };
        }
        patch = { last_command_id: payload.operationId,
          last_command_target: payload.completed, updated_at: now };
      }
    }
    if (!patch) return answer(400, 'Unsupported task share action');
    const data = { ...(membership ? {} : patch), ...patch };
    if (operation === 'invite') {
      // An old browser with direct Appwrite row update rights must not overwrite a
      // collaborator's completion. New clients persist owner edits via the
      // authenticated compare_and_set_owner_row Function, not row-level update.
      // Fence legacy direct updates *atomically* with the first invitation.
      await db.updateRow({
        databaseId: DATABASE_ID, tableId: TASKS, rowId: taskId,
        transactionId: tx.$id, data: {},
        permissions: [
          Permission.read(Role.user(ownerId)),
          Permission.delete(Role.user(ownerId)),
        ],
      });
    }
    if (membership) {
      await db.updateRow({ databaseId: DATABASE_ID, tableId: SHARES, rowId: key,
        transactionId: tx.$id, data });
    } else {
      await db.createRow({ databaseId: DATABASE_ID, tableId: SHARES, rowId: key,
        transactionId: tx.$id, permissions: [], data });
    }
    if (taskPatch) {
      await db.updateRow({ databaseId: DATABASE_ID, tableId: TASKS, rowId: taskId,
        transactionId: tx.$id, data: taskPatch });
    }
    await db.updateTransaction({ transactionId: tx.$id, commit: true });
    committed = true;
    const [updatedShare, updatedTask] = await Promise.all([
      read(db, SHARES, key), read(db, TASKS, taskId),
    ]);
    if (!updatedShare || !updatedTask) return answer(409, 'Share changed after commit');
    return { status: 200, body: { ok: true,
      item: projection(updatedTask, updatedShare, ownerId === caller) } };
  } catch (error) {
    if (Number(error?.code) === 409) return answer(409, 'Share changed; refresh and retry');
    throw error;
  } finally {
    if (!committed) {
      await db.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
    }
  }
}

module.exports = { handleTaskShares, shareId, projection, mutualFriends };

const crypto = require('crypto');
const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const NOTIFICATIONS_TABLE = 'notifications';
const PUSH_SUBSCRIPTIONS_TABLE = 'push_subscriptions';
const FRIENDSHIPS_TABLE = 'friendships';
const TASKS_TABLE = 'tasks';
const CATEGORIES_TABLE = 'categories';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MAX_EVENT_AGE_MS = 72 * 60 * 60 * 1000;

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function notificationId(recipientId, taskId, completedAt) {
  return `not_${sha256Hex(`${recipientId}|${taskId}|${completedAt}`).slice(0, 32)}`;
}

function pushSubscriptionId(userId, endpoint) {
  return `ps_${sha256Hex(`${userId}|${endpoint}`).slice(0, 32)}`;
}

function isNotFound(error) {
  return Number(error && error.code) === 404;
}

function isConflict(error) {
  return Number(error && error.code) === 409;
}

async function mapLimit(values, limit, worker) {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor++;
        await worker(values[index], index);
      }
    }
  );
  await Promise.all(workers);
}

async function listAllRows(tablesDB, tableId, baseQueries = []) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [
        ...baseQueries,
        Query.limit(PAGE_SIZE),
        Query.orderAsc('$id'),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    const pageRows = result.rows || [];
    if (pageRows.length === 0) return rows;
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
    const next = pageRows.at(-1)?.$id;
    if (!next || next === cursor) {
      throw new Error(`Pagination stalled for ${tableId}`);
    }
    cursor = next;
  }
  throw new Error(`Pagination exceeded page limit for ${tableId}`);
}

async function readRow(tablesDB, tableId, rowId) {
  try {
    return await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function mutualFriendMap(tablesDB, userId) {
  const [forward, reverse] = await Promise.all([
    listAllRows(tablesDB, FRIENDSHIPS_TABLE, [
      Query.equal('user_id', userId),
      Query.equal('status', 'accepted'),
      Query.equal('deleted', false),
    ]),
    listAllRows(tablesDB, FRIENDSHIPS_TABLE, [
      Query.equal('friend_id', userId),
      Query.equal('status', 'accepted'),
      Query.equal('deleted', false),
    ]),
  ]);
  const reverseOwners = new Set(reverse.map((row) => row.user_id));
  return new Map(
    forward
      .filter((row) => reverseOwners.has(row.friend_id))
      .map((row) => [row.friend_id, row])
  );
}

async function categoryForTask(tablesDB, task) {
  if (!task || !task.category_id) return null;
  const row = await readRow(tablesDB, CATEGORIES_TABLE, task.category_id);
  if (!row || row.deleted === true || row.user_id !== task.user_id) return null;
  return row;
}

async function effectiveTaskVisibility(tablesDB, task, category) {
  if (task.visibility && task.visibility !== '') return task.visibility;
  const resolvedCategory = category || (await categoryForTask(tablesDB, task));
  return resolvedCategory?.visibility || 'private';
}

function pushConfig() {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || '').trim();
  return {
    enabled: Boolean(publicKey && privateKey && subject),
    publicKey,
    privateKey,
    subject,
  };
}

async function sendPushToUser(tablesDB, userId, payload, log) {
  const config = pushConfig();
  if (!config.enabled) return { sent: 0, disabled: true };

  // Keep the optional delivery dependency out of ordinary handler/test startup.
  // Fresh forks without VAPID configuration still get the in-app Alerts feed.
  const webpush = require('web-push');
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const subscriptions = await listAllRows(tablesDB, PUSH_SUBSCRIPTIONS_TABLE, [
    Query.equal('user_id', userId),
    Query.equal('enabled', true),
  ]);
  let sent = 0;
  await mapLimit(subscriptions, 4, async (row) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 }
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error && error.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        try {
          await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: PUSH_SUBSCRIPTIONS_TABLE,
            rowId: row.$id,
          });
        } catch (deleteError) {
          if (!isNotFound(deleteError)) throw deleteError;
        }
        return;
      }
      log(`push delivery failed for ${row.$id}: ${error.message}`);
    }
  });
  return { sent, disabled: false };
}

async function handleTaskCompletionEvent(tablesDB, task, eventName, log, error) {
  if (!task || typeof task !== 'object') {
    return { status: 200, body: { ok: true, ignored: 'invalid-payload' } };
  }
  const taskId = typeof task.$id === 'string' ? task.$id : '';
  const actorId = typeof task.user_id === 'string' ? task.user_id : '';
  const completedAt =
    typeof task.completed_at === 'string' ? task.completed_at : '';
  if (
    !taskId ||
    !actorId ||
    task.deleted === true ||
    task.is_completed !== true ||
    !completedAt ||
    Number.isNaN(Date.parse(completedAt))
  ) {
    return { status: 200, body: { ok: true, ignored: 'not-completion' } };
  }
  if (task.source === 'todomate') {
    return { status: 200, body: { ok: true, ignored: 'imported-task' } };
  }
  if (Date.now() - Date.parse(completedAt) > MAX_EVENT_AGE_MS) {
    return { status: 200, body: { ok: true, ignored: 'stale-completion' } };
  }

  const category = await categoryForTask(tablesDB, task);
  const visibility = await effectiveTaskVisibility(tablesDB, task, category);
  if (visibility === 'private') {
    return { status: 200, body: { ok: true, ignored: 'private-task' } };
  }

  const friends = await mutualFriendMap(tablesDB, actorId);
  if (friends.size === 0) {
    return { status: 200, body: { ok: true, created: 0 } };
  }

  const now = new Date().toISOString();
  let created = 0;
  await mapLimit([...friends.entries()], 6, async ([recipientId, friendship]) => {
    const rowId = notificationId(recipientId, taskId, completedAt);
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: NOTIFICATIONS_TABLE,
        rowId,
        data: {
          recipient_id: recipientId,
          actor_id: actorId,
          type: 'task_completed',
          task_id: taskId,
          completed_at: completedAt,
          occurred_at: completedAt,
          read_at: '',
          created_at: now,
        },
        permissions: [],
      });
      created += 1;
    } catch (createError) {
      if (isConflict(createError)) return;
      throw createError;
    }

    const actorName =
      friendship.friend_display_name ||
      friendship.friend_username ||
      'A friend';
    await sendPushToUser(
      tablesDB,
      recipientId,
      {
        userId: recipientId,
        title: `${actorName} completed a task`,
        body: 'Open Mosaic to see recent activity.',
        url: '/notifications',
        tag: `friend-completions-${actorId}`,
      },
      log
    );
  });

  log(
    `notifications: event=${eventName} actor=${actorId} task=${taskId} created=${created}`
  );
  return { status: 200, body: { ok: true, created } };
}

async function handleGetNotifications(tablesDB, callerId, payload, log, error) {
  const requested = Number(payload?.limit);
  const limit =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, 50)
      : 30;
  const cursor =
    typeof payload?.cursor === 'string' && payload.cursor ? payload.cursor : '';

  const queries = [
    Query.equal('recipient_id', callerId),
    Query.orderDesc('occurred_at'),
    Query.limit(limit),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: NOTIFICATIONS_TABLE,
    queries,
    total: false,
  });
  const rows = result.rows || [];
  const friends = await mutualFriendMap(tablesDB, callerId);
  const items = [];

  await mapLimit(rows, 6, async (row) => {
    const friendship = friends.get(row.actor_id);
    if (!friendship || row.type !== 'task_completed') return;

    const task = await readRow(tablesDB, TASKS_TABLE, row.task_id);
    if (
      !task ||
      task.deleted === true ||
      task.user_id !== row.actor_id ||
      task.is_completed !== true ||
      task.completed_at !== row.completed_at
    ) {
      return;
    }

    const category = await categoryForTask(tablesDB, task);
    const visibility = await effectiveTaskVisibility(tablesDB, task, category);
    if (visibility === 'private') return;

    items.push({
      id: row.$id,
      type: row.type,
      actorId: row.actor_id,
      actorName:
        friendship.friend_display_name ||
        friendship.friend_username ||
        'Friend',
      actorUsername: friendship.friend_username || '',
      actorAvatarFileId: friendship.friend_avatar_file_id || '',
      occurredAt: row.occurred_at,
      readAt: row.read_at || '',
      categoryColor: category?.color || '#6B7280',
      task: {
        id: task.$id,
        title: task.title || '',
        completed: true,
        categoryId: task.category_id || '',
        order: typeof task.order === 'number' ? task.order : 0,
        tags: task.tags || '',
        date: task.date || '',
        memo: '',
        image: '',
        createdAt: task.created_at || '',
        completedAt: task.completed_at || '',
        updatedAt: task.updated_at || '',
        source: task.source || '',
        userId: task.user_id || '',
        isDeleted: false,
        routineId: task.routine_id || '',
        reminderTime: task.reminder_time || '',
        reactions: task.reactions || '',
        visibility: task.visibility || '',
      },
    });
  });

  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const nextCursor = rows.length === limit ? rows.at(-1)?.$id || '' : '';
  log(
    `get_notifications: caller=${callerId} visible=${items.length}/${rows.length}`
  );
  return {
    status: 200,
    body: { items, nextCursor, fetchedAt: new Date().toISOString() },
  };
}

async function handleMarkNotificationsRead(tablesDB, callerId, payload, log, error) {
  const ids = Array.isArray(payload?.ids)
    ? [...new Set(payload.ids.filter((id) => typeof id === 'string'))].slice(0, 100)
    : [];
  if (ids.length === 0) {
    return { status: 200, body: { ok: true, marked: 0 } };
  }
  const now = new Date().toISOString();
  let marked = 0;
  await mapLimit(ids, 8, async (id) => {
    const row = await readRow(tablesDB, NOTIFICATIONS_TABLE, id);
    if (!row || row.recipient_id !== callerId || row.read_at) return;
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: NOTIFICATIONS_TABLE,
      rowId: id,
      data: { read_at: now },
    });
    marked += 1;
  });
  log(`mark_notifications_read: caller=${callerId} marked=${marked}`);
  return { status: 200, body: { ok: true, marked, readAt: now } };
}

function handleGetPushConfig() {
  const config = pushConfig();
  return {
    status: 200,
    body: {
      enabled: config.enabled,
      publicKey: config.enabled ? config.publicKey : '',
    },
  };
}

function validateEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

async function handleRegisterPushSubscription(
  tablesDB,
  callerId,
  payload,
  log,
  error
) {
  const config = pushConfig();
  if (!config.enabled) {
    return { status: 503, body: { error: 'Push notifications are not configured' } };
  }
  const endpoint = validateEndpoint(payload?.endpoint);
  const p256dh = typeof payload?.p256dh === 'string' ? payload.p256dh : '';
  const auth = typeof payload?.auth === 'string' ? payload.auth : '';
  const expirationTime =
    typeof payload?.expirationTime === 'string' ? payload.expirationTime : '';
  if (!endpoint || !p256dh || p256dh.length > 512 || !auth || auth.length > 255) {
    return { status: 400, body: { error: 'Invalid push subscription' } };
  }

  const rowId = pushSubscriptionId(callerId, endpoint);
  const now = new Date().toISOString();
  const existing = await readRow(tablesDB, PUSH_SUBSCRIPTIONS_TABLE, rowId);
  if (existing && existing.user_id !== callerId) {
    return { status: 403, body: { error: 'Push subscription owner mismatch' } };
  }

  const data = {
    user_id: callerId,
    endpoint,
    p256dh,
    auth,
    expiration_time: expirationTime,
    enabled: true,
    updated_at: now,
  };
  if (existing) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: PUSH_SUBSCRIPTIONS_TABLE,
      rowId,
      data,
    });
  } else {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: PUSH_SUBSCRIPTIONS_TABLE,
      rowId,
      data: { ...data, created_at: now },
      permissions: [],
    });
  }
  log(`push subscription registered for ${callerId}`);
  return { status: 200, body: { ok: true } };
}

async function handleUnregisterPushSubscription(
  tablesDB,
  callerId,
  payload,
  log,
  error
) {
  const endpoint = validateEndpoint(payload?.endpoint);
  if (!endpoint) {
    return { status: 400, body: { error: 'Invalid push endpoint' } };
  }
  const rowId = pushSubscriptionId(callerId, endpoint);
  const existing = await readRow(tablesDB, PUSH_SUBSCRIPTIONS_TABLE, rowId);
  if (!existing) return { status: 200, body: { ok: true } };
  if (existing.user_id !== callerId) {
    return { status: 403, body: { error: 'Push subscription owner mismatch' } };
  }
  try {
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: PUSH_SUBSCRIPTIONS_TABLE,
      rowId,
    });
  } catch (deleteError) {
    if (!isNotFound(deleteError)) throw deleteError;
  }
  log(`push subscription removed for ${callerId}`);
  return { status: 200, body: { ok: true } };
}

module.exports = {
  handleGetNotifications,
  handleGetPushConfig,
  handleMarkNotificationsRead,
  handleRegisterPushSubscription,
  handleTaskCompletionEvent,
  handleUnregisterPushSubscription,
  notificationId,
  pushSubscriptionId,
};

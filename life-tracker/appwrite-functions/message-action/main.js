const crypto = require('crypto');
const { Client, TablesDB, Query, Permission, Role } = require('node-appwrite');

const DATABASE_ID = 'life_tracker';
const MESSAGES_TABLE = 'messages';
const FRIENDSHIPS_TABLE = 'friendships';
const TASKS_TABLE = 'tasks';

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function makeRecipientRowId(senderMessageId) {
  return `rmsg_${sha256Hex(senderMessageId).slice(0, 30)}`;
}

function parseReactions(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          typeof r.emoji === 'string' &&
          Array.isArray(r.userIds)
      )
      .map((r) => ({
        emoji: r.emoji,
        userIds: r.userIds.filter((id) => typeof id === 'string'),
      }))
      .filter((r) => r.userIds.length > 0);
  } catch {
    return [];
  }
}

function stringifyReactions(reactions) {
  const cleaned = reactions
    .map((r) => ({
      emoji: r.emoji,
      userIds: Array.from(new Set(r.userIds)),
    }))
    .filter((r) => r.userIds.length > 0);
  if (cleaned.length === 0) return '';
  return JSON.stringify(cleaned);
}

function applyReactionDelta(reactions, emoji, userId, op) {
  const next = reactions.map((r) => ({
    emoji: r.emoji,
    userIds: [...r.userIds],
  }));
  const idx = next.findIndex((r) => r.emoji === emoji);
  if (op === 'add') {
    if (idx === -1) {
      next.push({ emoji, userIds: [userId] });
    } else if (!next[idx].userIds.includes(userId)) {
      next[idx].userIds.push(userId);
    }
  } else {
    if (idx !== -1) {
      next[idx].userIds = next[idx].userIds.filter((id) => id !== userId);
      if (next[idx].userIds.length === 0) next.splice(idx, 1);
    }
  }
  return next;
}

async function verifyFriendship(tablesDB, a, b) {
  const fsCheck = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: FRIENDSHIPS_TABLE,
    queries: [
      Query.equal('user_id', a),
      Query.equal('friend_id', b),
      Query.equal('status', 'accepted'),
      Query.equal('deleted', false),
      Query.limit(1),
    ],
  });
  return fsCheck.rows.length > 0;
}

async function handleDeliver(tablesDB, senderId, payload, log, error) {
  const {
    messageId,
    recipientId,
    content,
    taskRefId,
    taskRefTitle,
    taskRefDate,
    taskRefColor,
    replyToId,
    replyToContent,
    replyToSenderId,
    createdAt,
  } = payload || {};

  if (!messageId || typeof messageId !== 'string') {
    error('deliver: Missing messageId');
    return { status: 400, body: { error: 'Missing messageId' } };
  }
  if (!recipientId || typeof recipientId !== 'string') {
    error('deliver: Missing recipientId');
    return { status: 400, body: { error: 'Missing recipientId' } };
  }
  if (senderId === recipientId) {
    error('deliver: Cannot message yourself');
    return { status: 400, body: { error: 'Cannot message yourself' } };
  }

  const isFriend = await verifyFriendship(tablesDB, senderId, recipientId);
  if (!isFriend) {
    error(`deliver: Forbidden, no accepted friendship ${senderId} -> ${recipientId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }

  const recipientRowId = makeRecipientRowId(messageId);
  const [x, y] =
    senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
  const threadId = `th_${sha256Hex(`${x}|${y}`).slice(0, 30)}`;
  const now = new Date().toISOString();

  await tablesDB.upsertRow({
    databaseId: DATABASE_ID,
    tableId: MESSAGES_TABLE,
    rowId: recipientRowId,
    data: {
      user_id: recipientId,
      thread_id: threadId,
      sender_id: senderId,
      recipient_id: recipientId,
      direction: 'incoming',
      content: content || '',
      task_ref_id: taskRefId || '',
      task_ref_title: taskRefTitle || '',
      task_ref_date: taskRefDate || '',
      task_ref_color: taskRefColor || '',
      reply_to_id: replyToId || '',
      reply_to_content: replyToContent || '',
      reply_to_sender_id: replyToSenderId || '',
      is_unsent: false,
      original_message_id: messageId,
      reactions: '',
      read_at: '',
      delivery_status: 'delivered',
      created_at: createdAt || now,
      updated_at: now,
      deleted: false,
    },
    permissions: [
      Permission.read(Role.user(recipientId)),
      Permission.update(Role.user(recipientId)),
      Permission.delete(Role.user(recipientId)),
    ],
  });

  log(`deliver: ${messageId} -> ${recipientId} as ${recipientRowId}`);
  return { status: 200, body: { ok: true, recipientRowId, threadId } };
}

async function handleMarkRead(tablesDB, callerId, payload, log, error) {
  const { partnerId, threadId } = payload || {};

  if (!partnerId || typeof partnerId !== 'string') {
    error('mark_read: Missing partnerId');
    return { status: 400, body: { error: 'Missing partnerId' } };
  }
  if (!threadId || typeof threadId !== 'string') {
    error('mark_read: Missing threadId');
    return { status: 400, body: { error: 'Missing threadId' } };
  }
  if (callerId === partnerId) {
    error('mark_read: partnerId cannot equal callerId');
    return { status: 400, body: { error: 'partnerId cannot be self' } };
  }

  const isFriend = await verifyFriendship(tablesDB, callerId, partnerId);
  if (!isFriend) {
    error(`mark_read: Forbidden, no accepted friendship ${callerId} -> ${partnerId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }

  const now = new Date().toISOString();
  let marked = 0;
  let cursor = undefined;

  for (;;) {
    const queries = [
      Query.equal('user_id', partnerId),
      Query.equal('thread_id', threadId),
      Query.equal('direction', 'outgoing'),
      Query.equal('read_at', ''),
      Query.equal('deleted', false),
      Query.limit(100),
      Query.orderAsc('$id'),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      queries,
    });
    const rows = res.rows || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId: row.$id,
        data: { read_at: now },
      });
      marked++;
    }

    if (rows.length < 100) break;
    const lastId = rows[rows.length - 1].$id;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }

  log(`mark_read: caller=${callerId} partner=${partnerId} marked=${marked}`);
  return { status: 200, body: { ok: true, marked } };
}

async function cascadeReplyWipe(
  tablesDB,
  userIds,
  senderMessageId,
  recipientRowId,
  now,
  log
) {
  let total = 0;
  const targets = [senderMessageId, recipientRowId];

  for (const uid of userIds) {
    for (const targetId of targets) {
      let cursor = undefined;
      for (;;) {
        const queries = [
          Query.equal('user_id', uid),
          Query.equal('reply_to_id', targetId),
          Query.equal('deleted', false),
          Query.limit(100),
          Query.orderAsc('$id'),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: MESSAGES_TABLE,
          queries,
        });
        const rows = res.rows || [];
        if (rows.length === 0) break;

        for (const row of rows) {
          if (row.reply_to_content === '') continue;
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: MESSAGES_TABLE,
            rowId: row.$id,
            data: { reply_to_content: '', updated_at: now },
          });
          total++;
        }

        if (rows.length < 100) break;
        const lastId = rows[rows.length - 1].$id;
        if (!lastId || lastId === cursor) break;
        cursor = lastId;
      }
    }
  }

  log(
    `unsend cascade: wiped ${total} reply snapshot(s) for ${senderMessageId}`
  );
  return total;
}

async function handleUnsend(tablesDB, callerId, payload, log, error) {
  const { messageId, recipientId } = payload || {};

  if (!messageId || typeof messageId !== 'string') {
    error('unsend: Missing messageId');
    return { status: 400, body: { error: 'Missing messageId' } };
  }
  if (!recipientId || typeof recipientId !== 'string') {
    error('unsend: Missing recipientId');
    return { status: 400, body: { error: 'Missing recipientId' } };
  }
  if (callerId === recipientId) {
    error('unsend: Cannot unsend to yourself');
    return { status: 400, body: { error: 'Cannot unsend to yourself' } };
  }

  const isFriend = await verifyFriendship(tablesDB, callerId, recipientId);
  if (!isFriend) {
    error(`unsend: Forbidden, no accepted friendship ${callerId} -> ${recipientId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }

  const recipientRowId = makeRecipientRowId(messageId);
  const now = new Date().toISOString();
  const wipe = {
    content: '',
    task_ref_id: '',
    task_ref_title: '',
    task_ref_date: '',
    task_ref_color: '',
    reply_to_id: '',
    reply_to_content: '',
    reply_to_sender_id: '',
    is_unsent: true,
    reactions: '',
    updated_at: now,
  };

  let patchedCaller = false;
  let patchedRecipient = false;

  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      rowId: messageId,
      data: wipe,
    });
    patchedCaller = true;
  } catch (err) {
    log(`unsend: caller-row update skipped (${err.message})`);
  }

  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      rowId: recipientRowId,
      data: wipe,
    });
    patchedRecipient = true;
  } catch (err) {
    log(`unsend: recipient-row update skipped (${err.message})`);
  }

  let cascaded = 0;
  try {
    cascaded = await cascadeReplyWipe(
      tablesDB,
      [callerId, recipientId],
      messageId,
      recipientRowId,
      now,
      log
    );
  } catch (err) {
    error(`unsend cascade failed: ${err.message}`);
  }

  if (!patchedCaller && !patchedRecipient && cascaded === 0) {
    error(`unsend: no rows patched for message ${messageId}`);
    return { status: 404, body: { error: 'Message not found' } };
  }

  log(
    `unsend: ${messageId} caller=${patchedCaller} recipient=${patchedRecipient} cascade=${cascaded}`
  );
  return {
    status: 200,
    body: { ok: true, patchedCaller, patchedRecipient, cascaded },
  };
}

async function resolveLegacyPeerRowId(tablesDB, myRow, log) {
  try {
    if (!myRow || myRow.direction !== 'incoming') return null;
    const senderId = myRow.sender_id;
    const createdAt = myRow.created_at;
    const content = myRow.content || '';
    if (!senderId || !createdAt) return null;

    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      queries: [
        Query.equal('user_id', senderId),
        Query.equal('created_at', createdAt),
        Query.equal('deleted', false),
        Query.limit(5),
      ],
    });
    const candidates = (res.rows || []).filter(
      (r) => (r.content || '') === content && r.direction === 'outgoing'
    );
    if (candidates.length !== 1) {
      log(
        `resolveLegacyPeerRowId: ${candidates.length} candidates for ${myRow.$id}`
      );
      return null;
    }
    return candidates[0].$id;
  } catch (err) {
    log(`resolveLegacyPeerRowId failed: ${err.message}`);
    return null;
  }
}

async function handleReact(tablesDB, callerId, payload, log, error) {
  const { myRowId, peerRowId, recipientId, emoji, op } = payload || {};

  if (!myRowId || typeof myRowId !== 'string') {
    error('react: Missing myRowId');
    return { status: 400, body: { error: 'Missing myRowId' } };
  }
  if (!recipientId || typeof recipientId !== 'string') {
    error('react: Missing recipientId');
    return { status: 400, body: { error: 'Missing recipientId' } };
  }
  if (!emoji || typeof emoji !== 'string' || emoji.length > 16) {
    error('react: Missing or invalid emoji');
    return { status: 400, body: { error: 'Invalid emoji' } };
  }
  if (op !== 'add' && op !== 'remove') {
    error('react: op must be add or remove');
    return { status: 400, body: { error: 'Invalid op' } };
  }
  if (callerId === recipientId) {
    error('react: Cannot react to yourself');
    return { status: 400, body: { error: 'Cannot react to yourself' } };
  }

  const isFriend = await verifyFriendship(tablesDB, callerId, recipientId);
  if (!isFriend) {
    error(`react: Forbidden, no accepted friendship ${callerId} -> ${recipientId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }

  const now = new Date().toISOString();
  let updated = 0;
  let resolvedPeerRowId = '';

  let myRow = null;
  try {
    myRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      rowId: myRowId,
    });
  } catch (err) {
    log(`react: could not fetch myRow ${myRowId} (${err.message})`);
  }

  let effectivePeerRowId = peerRowId;
  if (!effectivePeerRowId && myRow) {
    const resolved = await resolveLegacyPeerRowId(tablesDB, myRow, log);
    if (resolved) {
      effectivePeerRowId = resolved;
      resolvedPeerRowId = resolved;
      log(`react: resolved legacy peer ${myRowId} -> ${resolved}`);
    }
  }

  const targets = [myRowId, effectivePeerRowId].filter(Boolean);

  for (const rowId of targets) {
    try {
      const row = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId,
      });
      const current = parseReactions(row.reactions || '');
      const next = applyReactionDelta(current, emoji, callerId, op);
      const nextStr = stringifyReactions(next);
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId,
        data: { reactions: nextStr, updated_at: now },
      });
      updated++;
    } catch (err) {
      log(`react: row ${rowId} update skipped (${err.message})`);
    }
  }

  if (updated === 0) {
    error(`react: no rows updated for ${myRowId} / ${effectivePeerRowId || '(none)'}`);
    return { status: 404, body: { error: 'Message not found' } };
  }

  log(
    `react: caller=${callerId} emoji=${emoji} op=${op} rows=${updated} resolvedPeer=${resolvedPeerRowId || '-'}`
  );
  return {
    status: 200,
    body: { ok: true, updated, resolvedPeerRowId },
  };
}

/**
 * Applies a reaction delta to a task owned by another user.
 * The caller must be an accepted friend of the task owner. The task row lives
 * on the owner's account; the function patches it via the API key.
 */
async function handleReactToTask(tablesDB, callerId, payload, log, error) {
  const { taskId, taskOwnerId, emoji, op } = payload || {};

  if (!taskId || typeof taskId !== 'string') {
    error('react_to_task: Missing taskId');
    return { status: 400, body: { error: 'Missing taskId' } };
  }
  if (!taskOwnerId || typeof taskOwnerId !== 'string') {
    error('react_to_task: Missing taskOwnerId');
    return { status: 400, body: { error: 'Missing taskOwnerId' } };
  }
  if (!emoji || typeof emoji !== 'string' || emoji.length > 16) {
    error('react_to_task: Missing or invalid emoji');
    return { status: 400, body: { error: 'Invalid emoji' } };
  }
  if (op !== 'add' && op !== 'remove') {
    error('react_to_task: op must be add or remove');
    return { status: 400, body: { error: 'Invalid op' } };
  }
  if (callerId === taskOwnerId) {
    error('react_to_task: Cannot react to your own task');
    return { status: 400, body: { error: 'Cannot react to your own task' } };
  }

  const isFriend = await verifyFriendship(tablesDB, callerId, taskOwnerId);
  if (!isFriend) {
    error(
      `react_to_task: Forbidden, no accepted friendship ${callerId} -> ${taskOwnerId}`
    );
    return { status: 403, body: { error: 'Not friends with this user' } };
  }

  let row;
  try {
    row = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
    });
  } catch (err) {
    error(`react_to_task: task ${taskId} not found (${err.message})`);
    return { status: 404, body: { error: 'Task not found' } };
  }

  if (row.user_id !== taskOwnerId) {
    error(`react_to_task: task ${taskId} is not owned by ${taskOwnerId}`);
    return { status: 403, body: { error: 'Task ownership mismatch' } };
  }
  if (row.deleted === true) {
    error(`react_to_task: task ${taskId} is deleted`);
    return { status: 404, body: { error: 'Task not found' } };
  }

  const current = parseReactions(row.reactions || '');
  const next = applyReactionDelta(current, emoji, callerId, op);
  const nextStr = stringifyReactions(next);
  const now = new Date().toISOString();

  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: { reactions: nextStr, updated_at: now },
    });
  } catch (err) {
    error(`react_to_task: failed to update task ${taskId} (${err.message})`);
    return { status: 500, body: { error: 'Update failed' } };
  }

  log(
    `react_to_task: caller=${callerId} task=${taskId} owner=${taskOwnerId} emoji=${emoji} op=${op}`
  );
  return { status: 200, body: { ok: true, reactions: nextStr } };
}

module.exports = async ({ req, res, log, error }) => {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    error('Unauthorized: no x-appwrite-user-id header');
    return res.json({ error: 'Unauthorized' }, 401);
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    error(`Bad Request: ${e.message}`);
    return res.json({ error: 'Bad Request' }, 400);
  }

  const action = payload?.action;
  if (!action || typeof action !== 'string') {
    error('Missing action');
    return res.json({ error: 'Missing action' }, 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);

  try {
    let result;
    switch (action) {
      case 'deliver':
        result = await handleDeliver(tablesDB, callerId, payload, log, error);
        break;
      case 'mark_read':
        result = await handleMarkRead(tablesDB, callerId, payload, log, error);
        break;
      case 'unsend':
        result = await handleUnsend(tablesDB, callerId, payload, log, error);
        break;
      case 'react':
        result = await handleReact(tablesDB, callerId, payload, log, error);
        break;
      case 'react_to_task':
        result = await handleReactToTask(tablesDB, callerId, payload, log, error);
        break;
      default:
        error(`Unknown action: ${action}`);
        return res.json({ error: `Unknown action: ${action}` }, 400);
    }
    return res.json(result.body, result.status);
  } catch (err) {
    error(`Internal error (${action}): ${err.message}`);
    if (err.cause) {
      error(`Cause: ${err.cause.code || err.cause.message || err.cause}`);
    }
    return res.json({ error: 'An internal error occurred' }, 500);
  }
};
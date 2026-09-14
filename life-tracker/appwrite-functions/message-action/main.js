const crypto = require('crypto');
const { Client, TablesDB, Query, Permission, Role } = require('node-appwrite');

const DATABASE_ID = 'life_tracker';
const MESSAGES_TABLE = 'messages';
const FRIENDSHIPS_TABLE = 'friendships';

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function makeRecipientRowId(senderMessageId) {
  return `rmsg_${sha256Hex(senderMessageId).slice(0, 30)}`;
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

/**
 * Wipes the reply snapshot on every message (across both users) that quoted
 * the target. Checks BOTH possible `reply_to_id` values:
 *   - `senderMessageId` — replies the original sender wrote to their own
 *     message (uses their local id directly).
 *   - `recipientRowId`  — replies the recipient wrote (their local copy of
 *     the original has this synthetic `rmsg_<hash>` row id).
 *
 * Paginated per-user. Idempotent: rows whose `reply_to_content` is already
 * empty are skipped.
 */
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
const crypto = require('crypto');
const { Client, TablesDB, Query, Permission, Role } = require('node-appwrite');

const DATABASE_ID = 'life_tracker';
const MESSAGES_TABLE = 'messages';
const FRIENDSHIPS_TABLE = 'friendships';

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = async ({ req, res, log, error }) => {
  const senderId = req.headers['x-appwrite-user-id'];
  if (!senderId) {
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

  const {
    messageId,
    recipientId,
    content,
    taskRefId,
    taskRefTitle,
    taskRefDate,
    taskRefColor,
    createdAt,
  } = payload || {};

  if (!messageId || typeof messageId !== 'string') {
    error('Missing messageId');
    return res.json({ error: 'Missing messageId' }, 400);
  }
  if (!recipientId || typeof recipientId !== 'string') {
    error('Missing recipientId');
    return res.json({ error: 'Missing recipientId' }, 400);
  }
  if (senderId === recipientId) {
    error('Cannot message yourself');
    return res.json({ error: 'Cannot message yourself' }, 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);

  try {
    // 1) Verify accepted friendship (sender -> recipient)
    const fsCheck = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: FRIENDSHIPS_TABLE,
      queries: [
        Query.equal('user_id', senderId),
        Query.equal('friend_id', recipientId),
        Query.equal('status', 'accepted'),
        Query.equal('deleted', false),
        Query.limit(1),
      ],
    });
    if (fsCheck.rows.length === 0) {
      error(`Forbidden: no accepted friendship ${senderId} -> ${recipientId}`);
      return res.json({ error: 'Not friends with this user' }, 403);
    }

    // 2) Compute deterministic recipient row id from the sender's local
    //    messageId so retries are idempotent.
    const recipientRowId = `rmsg_${sha256Hex(messageId).slice(0, 30)}`;

    // 3) Compute deterministic thread id server-side.
    const [x, y] = senderId < recipientId
      ? [senderId, recipientId]
      : [recipientId, senderId];
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

    log(`Delivered ${messageId} -> ${recipientId} as ${recipientRowId}`);
    return res.json({ ok: true, recipientRowId, threadId });
  } catch (err) {
    error(`Internal error: ${err.message}`);
    if (err.cause) {
      error(`Cause: ${err.cause.code || err.cause.message || err.cause}`);
    }
    return res.json({ error: 'An internal error occurred' }, 500);
  }
};
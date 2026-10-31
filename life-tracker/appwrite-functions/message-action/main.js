const crypto = require('crypto');
const { isScheduledTask } = require('./task-placement');
const { handleFriendship, deleteAccountFriendships } = require('./friendship');
const { handleTaskShares } = require('./task-shares');
const { handleTodoMateTaskBatch } = require('./todomate-task-batch');
const { handleOwnerWriteCas } = require('./owner-write-cas');
const {
  handleGetNotifications,
  handleGetNotification,
  handleGetPushConfig,
  handleGetPushDetails,
  handleSetPushDetails,
  handleMarkNotificationsRead,
  handleRegisterPushSubscription,
  handleTaskCompletionEvent,
  sendPushToUser,
  handleUnregisterPushSubscription,
} = require('./notifications');
const { emitActivity } = require('./activity-notifications');
const {
  Client,
  TablesDB,
  Storage,
  Users,
  Functions,
  Query,
  Permission,
  Role,
} = require('node-appwrite');
const { handleScheduledTombstoneGc } = require('./tombstone-gc');
const {
  isAccountDeletionPending,
  resumeDeletionJobs,
  startAccountDeletion,
} = require('./account-deletion');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const MESSAGES_TABLE = 'messages';
const FRIENDSHIPS_TABLE = 'friendships';
const TASKS_TABLE = 'tasks';
const CATEGORIES_TABLE = 'categories';
const DIARY_REACTIONS_TABLE = 'diary_reactions';
const DIARY_TABLE = 'diary';
const DIARY_PHOTOS_BUCKET = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const MAX_ROW_ID_LENGTH = 36;
const ROW_ID_REGEX = /^[a-zA-Z0-9_]+$/;
const REACTIONS_MAX_LEN = 5000;
let graphemeSegmenter = null;
try {
  if (
    typeof Intl !== 'undefined' &&
    typeof Intl.Segmenter === 'function'
  ) {
    graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  }
} catch {
  graphemeSegmenter = null;
}
function graphemeLength(str) {
  if (!str) return 0;
  if (graphemeSegmenter) {
    let n = 0;
    for (const _ of graphemeSegmenter.segment(str)) n++;
    return n;
  }
  return Array.from(str).length;
}
function isValidRowId(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_ROW_ID_LENGTH) return false;
  if (value.startsWith('_')) return false;
  return ROW_ID_REGEX.test(value);
}
function validateOptionalString(value, maxLen) {
  if (value === undefined || value === null) return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false };
  if (value.length > maxLen) return { ok: false };
  return { ok: true, value };
}
function validateOptionalIso(value, maxLen) {
  const r = validateOptionalString(value, maxLen);
  if (!r.ok) return r;
  if (r.value === '') return r;
  if (Number.isNaN(Date.parse(r.value))) return { ok: false };
  return r;
}
function validateEmoji(value) {
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false };
  const gl = graphemeLength(trimmed);
  if (gl === 0 || gl > 16) return { ok: false };
  return { ok: true, value: trimmed };
}
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
  const forward = await tablesDB.listRows({
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
  if (!forward.rows || forward.rows.length === 0) return false;
  const reverse = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: FRIENDSHIPS_TABLE,
    queries: [
      Query.equal('user_id', b),
      Query.equal('friend_id', a),
      Query.equal('status', 'accepted'),
      Query.equal('deleted', false),
      Query.limit(1),
    ],
  });
  return !!(reverse.rows && reverse.rows.length > 0);
}
async function listAllRows(tablesDB, tableId, baseQueries, log, maxPages = 100) {
  const all = [];
  let cursor = undefined;
  let pages = 0;
  for (;;) {
    const queries = [...baseQueries, Query.limit(100), Query.orderAsc('$id')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });
    const rows = res.rows || [];
    if (rows.length === 0) break;
    for (const r of rows) all.push(r);
    pages++;
    if (rows.length < 100) break;
    const lastId = rows[rows.length - 1].$id;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
    if (pages >= maxPages) {
      log(`listAllRows: hit maxPages=${maxPages} for ${tableId}`);
      break;
    }
  }
  return all;
}
// A privacy change publishes a server-owned revocation fence first.
// While its owner CAS is pending, fail closed for all friend diary reads.
function isDiaryQuoteRevocationPending(diary) {
  if (!diary?.quote_revoke_revision) return false;
  const fence = Date.parse(diary.quote_revoke_revision);
  const published = Date.parse(diary.updated_at || '');
  return !Number.isFinite(fence) || !Number.isFinite(published) || fence > published;
}

async function handleDeliver(tablesDB, senderId, payload, log, error) {
  const p = payload || {};
  if (!isValidRowId(p.messageId)) {
    error('deliver: invalid messageId');
    return { status: 400, body: { error: 'Invalid messageId' } };
  }
  if (!p.messageId.startsWith('msg_')) {
    error('deliver: messageId must start with msg_');
    return { status: 400, body: { error: 'Invalid messageId format' } };
  }
  if (!isValidRowId(p.recipientId)) {
    error('deliver: invalid recipientId');
    return { status: 400, body: { error: 'Invalid recipientId' } };
  }
  const messageId = p.messageId;
  const recipientId = p.recipientId;
  if (senderId === recipientId) {
    error('deliver: Cannot message yourself');
    return { status: 400, body: { error: 'Cannot message yourself' } };
  }
  const vContent = validateOptionalString(p.content, 4000);
  const vTaskRefId = validateOptionalString(p.taskRefId, 255);
  const vTaskRefTitle = validateOptionalString(p.taskRefTitle, 500);
  const vTaskRefDate = validateOptionalString(p.taskRefDate, 50);
  const vTaskRefColor = validateOptionalString(p.taskRefColor, 20);
  const vDiaryRefId = validateOptionalString(p.diaryRefId, 36);
  const vDiaryRefOwnerId = validateOptionalString(p.diaryRefOwnerId, 36);
  const vDiaryRefDate = validateOptionalString(p.diaryRefDate, 10);
  const vDiaryRefExcerpt = validateOptionalString(p.diaryRefExcerpt, 160);
  const diaryRefEpoch = p.diaryRefEpoch ?? 0;
  if (!Number.isInteger(diaryRefEpoch) || diaryRefEpoch < 0 || diaryRefEpoch > 2147483647)
    return { status: 400, body: { error: 'Invalid diary quote epoch' } };
  const vReplyToId = validateOptionalString(p.replyToId, 255);
  const vReplyToContent = validateOptionalString(p.replyToContent, 300);
  const vReplyToSenderId = validateOptionalString(p.replyToSenderId, 255);
  const vCreatedAt = validateOptionalIso(p.createdAt, 50);
  const optionalChecks = [
    ['content', vContent],
    ['taskRefId', vTaskRefId],
    ['taskRefTitle', vTaskRefTitle],
    ['taskRefDate', vTaskRefDate],
    ['taskRefColor', vTaskRefColor],
    ['diaryRefId', vDiaryRefId],
    ['diaryRefOwnerId', vDiaryRefOwnerId],
    ['diaryRefDate', vDiaryRefDate],
    ['diaryRefExcerpt', vDiaryRefExcerpt],
    ['replyToId', vReplyToId],
    ['replyToContent', vReplyToContent],
    ['replyToSenderId', vReplyToSenderId],
    ['createdAt', vCreatedAt],
  ];
  for (const [name, r] of optionalChecks) {
    if (!r.ok) {
      error(`deliver: invalid ${name}`);
      return { status: 400, body: { error: `Invalid ${name}` } };
    }
  }
  const content = vContent.value;
  const taskRefId = vTaskRefId.value;
  const taskRefTitle = vTaskRefTitle.value;
  const taskRefDate = vTaskRefDate.value;
  const taskRefColor = vTaskRefColor.value;
  const diaryRefId = vDiaryRefId.value;
  const diaryRefOwnerId = vDiaryRefOwnerId.value;
  const diaryRefDate = vDiaryRefDate.value;
  const diaryRefExcerpt = ''; // never store copied diary content in chat
  const replyToId = vReplyToId.value;
  const replyToContent = vReplyToContent.value;
  const replyToSenderId = vReplyToSenderId.value;
  const createdAt = vCreatedAt.value;
  const hasContent = content.trim().length > 0;
  const hasTaskRef = taskRefId !== '' || taskRefTitle !== '';
  const hasDiaryRef = diaryRefId !== '';
  const hasReply = replyToId !== '';
  if (!hasContent && !hasTaskRef && !hasReply && !hasDiaryRef) {
    error('deliver: message has no content');
    return { status: 400, body: { error: 'Message has no content' } };
  }
  const isFriend = await verifyFriendship(tablesDB, senderId, recipientId);
  if (!isFriend) {
    error(`deliver: Forbidden, no accepted friendship ${senderId} -> ${recipientId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }
  if (hasDiaryRef) {
    if (!isValidRowId(diaryRefId) || !isValidRowId(diaryRefOwnerId) ||
      diaryRefOwnerId !== recipientId ||
      !/^[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(diaryRefDate) ||
      hasTaskRef) return { status: 400, body: { error: 'Invalid diary reference' } };
    const diary = await findVisibleFriendDiary(tablesDB, senderId, diaryRefId, diaryRefOwnerId);
    if (!diary || isDiaryQuoteRevocationPending(diary) || diary.date !== diaryRefDate || (diary.quote_epoch || 0) !== diaryRefEpoch)
      return { status: 403, body: { error: 'Diary no longer available' } };
    // Live previews are resolved through a separately authorized read.
  } else if (diaryRefOwnerId || diaryRefDate || vDiaryRefExcerpt.value || diaryRefEpoch) {
    return { status: 400, body: { error: 'Incomplete diary reference' } };
  }
  const recipientRowId = makeRecipientRowId(messageId);
  const [x, y] =
    senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
  const threadId = `th_${sha256Hex(`${x}|${y}`).slice(0, 30)}`;
  const now = new Date().toISOString();
  // An unknown getRow failure must not be mistaken for an absent message.
  async function readDeliveryRow(rowId) {
    try {
      return await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId,
      });
    } catch (cause) {
      if (Number(cause?.code) === 404) return null;
      throw cause;
    }
  }
  let existingSenderRow;
  let existingRecipientRow;
  try {
    [existingSenderRow, existingRecipientRow] = await Promise.all([
      readDeliveryRow(messageId),
      readDeliveryRow(recipientRowId),
    ]);
  } catch (cause) {
    error(`deliver: could not verify current pair (${cause.message})`);
    return { status: 503, body: { error: 'Message state unavailable; retry' } };
  }
  // Never re-create missing content after an unsend/delete or ID collision.
  for (const [row, owner, direction] of [
    [existingSenderRow, senderId, 'outgoing'],
    [existingRecipientRow, recipientId, 'incoming'],
  ]) {
    if (!row) continue;
    if (
      row.user_id !== owner ||
      row.sender_id !== senderId ||
      row.recipient_id !== recipientId ||
      row.thread_id !== threadId ||
      row.direction !== direction ||
      row.is_unsent === true ||
      row.deleted === true ||
      row.content !== content
    ) {
      return { status: 409, body: { error: 'Existing message conflicts with delivery' } };
    }
  }
  if (existingSenderRow) {
    if (
      existingSenderRow.user_id !== senderId ||
      existingSenderRow.sender_id !== senderId
    ) {
      error(`deliver: messageId ${messageId} already owned by another sender`);
      return { status: 403, body: { error: 'messageId not owned by caller' } };
    }
  }
  if (existingRecipientRow) {
    if (
      existingRecipientRow.sender_id !== senderId ||
      existingRecipientRow.recipient_id !== recipientId
    ) {
      error(
        `deliver: recipient row ${recipientRowId} already exists with different participants`
      );
      return { status: 403, body: { error: 'recipient row already exists' } };
    }
  }
  if (existingRecipientRow) {
    log(
      `deliver: recipient row ${recipientRowId} already exists; skipping upsert (idempotent)`
    );
  } else {
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      rowId: recipientRowId,
      data: {
        user_id: recipientId,
        thread_id: threadId,
        sender_id: senderId,
        recipient_id: recipientId,
        direction: 'incoming',
        content,
        task_ref_id: taskRefId,
        task_ref_title: taskRefTitle,
        task_ref_date: taskRefDate,
        task_ref_color: taskRefColor,
          diary_ref_id: diaryRefId,
          diary_ref_owner_id: diaryRefOwnerId,
          diary_ref_date: diaryRefDate,
          diary_ref_excerpt: diaryRefExcerpt,
          diary_ref_epoch: diaryRefEpoch,
        reply_to_id: replyToId,
        reply_to_content: replyToContent,
        reply_to_sender_id: replyToSenderId,
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
  }
  if (!existingSenderRow) {
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId: messageId,
        data: {
          user_id: senderId,
          thread_id: threadId,
          sender_id: senderId,
          recipient_id: recipientId,
          direction: 'outgoing',
          content,
          task_ref_id: taskRefId,
          task_ref_title: taskRefTitle,
          task_ref_date: taskRefDate,
          task_ref_color: taskRefColor,
          diary_ref_id: diaryRefId,
          diary_ref_owner_id: diaryRefOwnerId,
          diary_ref_date: diaryRefDate,
          diary_ref_excerpt: diaryRefExcerpt,
          diary_ref_epoch: diaryRefEpoch,
          reply_to_id: replyToId,
          reply_to_content: replyToContent,
          reply_to_sender_id: replyToSenderId,
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
          Permission.read(Role.user(senderId)),
          Permission.update(Role.user(senderId)),
          Permission.delete(Role.user(senderId)),
        ],
      });
      log(`deliver: created sender row ${messageId}`);
    } catch (createErr) {
      error(
        `deliver: failed to create sender row ${messageId} (${createErr.message})`
      );
      return { status: 503, body: { error: 'Message delivery incomplete; retry' } };
    }
  } else {
    log(`deliver: sender row ${messageId} already exists`);
  }
  log(`deliver: ${messageId} -> ${recipientId} as ${recipientRowId}`);
  return { status: 200, body: { ok: true, messageId, recipientRowId, threadId, duplicate: Boolean(existingRecipientRow) } };
}
// Explicit, bounded anti-entropy for a single authorized thread. Reconstruct
// only a provably missing counterpart of a committed, non-unsent owner row.
async function handleRepairThread(tablesDB, callerId, payload, verified = false) {
  const partnerId = payload?.partnerId;
  const cursor = payload?.cursor || '';
  const scope = payload?.scope || 'self';
  if (!isValidRowId(partnerId) || partnerId === callerId ||
      (cursor && !isValidRowId(cursor)) ||
      (scope !== 'self' && scope !== 'peer')) {
    return { status: 400, body: { error: 'Invalid chat repair request' } };
  }
  if (!verified && !(await verifyFriendship(tablesDB, callerId, partnerId))) {
    return { status: 403, body: { error: 'Not friends with this user' } };
  }
  const [a, b] = callerId < partnerId
    ? [callerId, partnerId] : [partnerId, callerId];
  const threadId = `th_${sha256Hex(`${a}|${b}`).slice(0, 30)}`;
  const sourceOwner = scope === 'self' ? callerId : partnerId;
  const targetOwner = scope === 'self' ? partnerId : callerId;
  const queries = [
    Query.equal('user_id', sourceOwner),
    Query.equal('thread_id', threadId),
    Query.orderAsc('created_at'),
    Query.limit(50),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  let rows;
  try {
    rows = (await tablesDB.listRows({
      databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, queries,
    })).rows;
    if (!Array.isArray(rows) || rows.length > 50) throw Error('Invalid page');
  } catch {
    return { status: 503, body: { error: 'Chat repair scan unavailable' } };
  }
  let repaired = 0;
  for (const row of rows) {
    if (row.user_id !== sourceOwner || row.thread_id !== threadId) {
      return { status: 409, body: { error: 'Chat repair ownership mismatch' } };
    }
    if (row.deleted || row.is_unsent) continue;
    if (row.direction !== 'incoming' && row.direction !== 'outgoing') {
      return { status: 409, body: { error: 'Invalid chat direction' } };
    }
    const outgoing = row.direction === 'outgoing';
    const messageId = outgoing ? row.$id : row.original_message_id;
    const peerRowId = outgoing ? makeRecipientRowId(messageId) : messageId;
    const expectedOwnId = outgoing ? messageId : makeRecipientRowId(messageId);
    const senderId = outgoing ? sourceOwner : targetOwner;
    const recipientId = outgoing ? targetOwner : sourceOwner;
    if (!isValidRowId(messageId) || !messageId.startsWith('msg_') ||
        row.$id !== expectedOwnId ||
        row.sender_id !== senderId || row.recipient_id !== recipientId ||
        (outgoing && row.original_message_id !== messageId)) {
      return { status: 409, body: { error: 'Invalid chat message identity' } };
    }
    let peer;
    try {
      peer = await tablesDB.getRow({
        databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, rowId: peerRowId,
      });
    } catch (cause) {
      if (Number(cause?.code) !== 404) {
        return { status: 503, body: { error: 'Chat peer lookup unavailable' } };
      }
      peer = null;
    }
    const peerDirection = outgoing ? 'incoming' : 'outgoing';
    function matchesPeer(candidate) {
      return candidate &&
        candidate.user_id === targetOwner && candidate.thread_id === threadId &&
        candidate.sender_id === senderId && candidate.recipient_id === recipientId &&
        candidate.direction === peerDirection &&
        candidate.original_message_id === messageId &&
        candidate.content === row.content &&
        ['task_ref_id', 'task_ref_title', 'task_ref_date', 'task_ref_color',
         'reply_to_id', 'reply_to_content', 'reply_to_sender_id']
          .every((key) => (candidate[key] || '') === (row[key] || ''));
    }
    if (peer) {
      if (peer.deleted || peer.is_unsent) continue;
      if (!matchesPeer(peer)) {
        return { status: 409, body: { error: 'Conflicting chat peer copy' } };
      }
      continue;
    }
    // Re-read the source before writing; a concurrent unsend must not be
    // silently resurrected using a stale snapshot from the page scan.
    try {
      const latest = await tablesDB.getRow({
        databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, rowId: row.$id,
      });
      if (latest.deleted || latest.is_unsent) continue;
      if (latest.$updatedAt !== row.$updatedAt ||
          latest.content !== row.content) {
        return { status: 409, body: { error: 'Chat changed during repair' } };
      }
    } catch {
      return { status: 503, body: { error: 'Chat source verification failed' } };
    }
    // Repair must not reconstruct a diary reference revoked after the source
    // message was delivered. The missing peer may be an older offline copy.
    let repairedDiaryDate = '';
    if (isValidRowId(row.diary_ref_id) &&
        (row.diary_ref_owner_id === senderId || row.diary_ref_owner_id === recipientId)) {
      let currentDiary = null;
      try {
        currentDiary = await tablesDB.getRow({
          databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId: row.diary_ref_id,
        });
      } catch (cause) {
        if (Number(cause?.code) !== 404)
          return { status: 503, body: { error: 'Chat diary reference unavailable' } };
      }
      if (currentDiary && currentDiary.user_id === row.diary_ref_owner_id &&
          currentDiary.deleted !== true &&
          ['public', 'followers'].includes(currentDiary.visibility) &&
          currentDiary.date === row.diary_ref_date &&
          !isDiaryQuoteRevocationPending(currentDiary) &&
          (currentDiary.quote_epoch || 0) === (row.diary_ref_epoch || 0)) {
        repairedDiaryDate = currentDiary.date;
      }
    }
    const now = new Date().toISOString();
    const data = {
      user_id: targetOwner, thread_id: threadId,
      sender_id: senderId, recipient_id: recipientId,
      direction: peerDirection, content: row.content,
      task_ref_id: row.task_ref_id || '',
      task_ref_title: row.task_ref_title || '',
      task_ref_date: row.task_ref_date || '',
      task_ref_color: row.task_ref_color || '',
      diary_ref_id: row.diary_ref_id || '',
      diary_ref_owner_id: row.diary_ref_owner_id || '',
      diary_ref_date: repairedDiaryDate,
      diary_ref_excerpt: '',
      diary_ref_epoch: row.diary_ref_epoch || 0,
      reply_to_id: row.reply_to_id || '',
      reply_to_content: row.reply_to_content || '',
      reply_to_sender_id: row.reply_to_sender_id || '',
      is_unsent: false, original_message_id: messageId,
      reactions: row.reactions || '',
      read_at: row.read_at || '',
      delivery_status: 'delivered',
      created_at: row.created_at || now, updated_at: now, deleted: false,
    };
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID, tableId: MESSAGES_TABLE,
        rowId: peerRowId, data,
        permissions: [
          Permission.read(Role.user(targetOwner)),
          Permission.update(Role.user(targetOwner)),
          Permission.delete(Role.user(targetOwner)),
        ],
      });
      repaired++;
    } catch (cause) {
      // Another tab/device may have repaired the same pair first; validate
      // the winner rather than overwriting it or resurrecting an unsent row.
      if (Number(cause?.code) !== 409) {
        return { status: 503, body: { error: 'Chat repair write failed' } };
      }
      try {
        const raced = await tablesDB.getRow({
          databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, rowId: peerRowId,
        });
        if (raced.deleted || raced.is_unsent) continue;
        if (matchesPeer(raced)) continue;
      } catch {
        return { status: 503, body: { error: 'Chat repair verification failed' } };
      }
      return { status: 409, body: { error: 'Chat repair conflict' } };
    }
  }
  const last = rows[rows.length - 1];
  if (rows.length === 50 && !last?.$id) {
    return { status: 503, body: { error: 'Invalid chat repair cursor' } };
  }
  return { status: 200, body: {
    ok: true, checked: rows.length, repaired,
    nextCursor: rows.length === 50 ? last.$id : '',
    nextScope: rows.length === 50 ? scope : scope === 'self' ? 'peer' : 'done',
  } };
}

// Single user-initiated request; strictly bounded and never a background scan.
async function handleRepairThreadAll(db, callerId, payload) {
  const partnerId = payload?.partnerId;
  if (!isValidRowId(partnerId) || partnerId === callerId)
    return { status: 400, body: { error: 'Invalid repair partner' } };
  if (!(await verifyFriendship(db, callerId, partnerId)))
    return { status: 403, body: { error: 'Not friends with this user' } };
  let scope = 'self', cursor = '', repaired = 0;
  for (let page = 0; page < 30; page++) {
    const result = await handleRepairThread(db, callerId, { partnerId, scope, cursor }, true);
    if (result.status !== 200) return result;
    repaired += result.body.repaired;
    if (result.body.nextScope === 'done')
      return { status: 200, body: { ok: true, repaired } };
    scope = result.body.nextScope;
    cursor = result.body.nextCursor;
  }
  return { status: 503, body: { error: 'Chat history exceeds repair limit' } };
}

async function handleMarkRead(tablesDB, callerId, payload, log, error) {
  const p = payload || {};
  if (!isValidRowId(p.partnerId)) {
    error('mark_read: invalid partnerId');
    return { status: 400, body: { error: 'Invalid partnerId' } };
  }
  const partnerId = p.partnerId;
  if (!p.threadId || typeof p.threadId !== 'string' || p.threadId.length > 50) {
    error('mark_read: invalid threadId');
    return { status: 400, body: { error: 'Invalid threadId' } };
  }
  const threadId = p.threadId;
  if (callerId === partnerId) {
    error('mark_read: partnerId cannot equal callerId');
    return { status: 400, body: { error: 'partnerId cannot be self' } };
  }
  const isFriend = await verifyFriendship(tablesDB, callerId, partnerId);
  if (!isFriend) {
    error(`mark_read: Forbidden, no accepted friendship ${callerId} -> ${partnerId}`);
    return { status: 403, body: { error: 'Not friends with this user' } };
  }
  let callerRowsInThread;
  try {
    callerRowsInThread = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      queries: [
        Query.equal('user_id', callerId),
        Query.equal('thread_id', threadId),
        Query.limit(1),
      ],
    });
  } catch (err) {
    error(`mark_read: participant check failed (${err.message})`);
    return { status: 500, body: { error: 'Failed to verify thread access' } };
  }
  if (!callerRowsInThread.rows || callerRowsInThread.rows.length === 0) {
    error(
      `mark_read: Forbidden, caller ${callerId} has no rows in thread ${threadId}`
    );
    return { status: 403, body: { error: 'Not a participant in this thread' } };
  }
  const now = new Date().toISOString();
  let markedPartner = 0;
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
      markedPartner++;
    }
    if (rows.length < 100) break;
    const lastId = rows[rows.length - 1].$id;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }
  let markedCaller = 0;
  cursor = undefined;
  for (;;) {
    const queries = [
      Query.equal('user_id', callerId),
      Query.equal('thread_id', threadId),
      Query.equal('direction', 'incoming'),
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
      markedCaller++;
    }
    if (rows.length < 100) break;
    const lastId = rows[rows.length - 1].$id;
    if (!lastId || lastId === cursor) break;
    cursor = lastId;
  }
  log(
    `mark_read: caller=${callerId} partner=${partnerId} markedPartner=${markedPartner} markedCaller=${markedCaller}`
  );
  return { status: 200, body: { ok: true, markedPartner, markedCaller } };
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
  log(`unsend cascade: wiped ${total} reply snapshot(s) for ${senderMessageId}`);
  return total;
}
async function handleUnsend(tablesDB, callerId, payload, log, error) {
  const p = payload || {};
  if (!isValidRowId(p.messageId)) {
    error('unsend: invalid messageId');
    return { status: 400, body: { error: 'Invalid messageId' } };
  }
  if (!isValidRowId(p.recipientId)) {
    error('unsend: invalid recipientId');
    return { status: 400, body: { error: 'Invalid recipientId' } };
  }
  const messageId = p.messageId;
  const recipientId = p.recipientId;
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
  let callerRow = null;
  try {
    callerRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: MESSAGES_TABLE,
      rowId: messageId,
    });
  } catch (err) {
    log(`unsend: caller row ${messageId} not fetched (${err.message})`);
  }
  if (callerRow) {
    if (callerRow.user_id !== callerId) {
      error(`unsend: message ${messageId} not owned by caller ${callerId}`);
      return { status: 403, body: { error: 'Not your message' } };
    }
    if (callerRow.direction !== 'outgoing') {
      error(`unsend: message ${messageId} is not outgoing`);
      return { status: 403, body: { error: 'Not an outgoing message' } };
    }
    if (callerRow.sender_id !== callerId) {
      error(`unsend: sender_id mismatch for ${messageId}`);
      return { status: 403, body: { error: 'Sender mismatch' } };
    }
    if (callerRow.recipient_id !== recipientId) {
      error(`unsend: recipient_id mismatch for ${messageId}`);
      return { status: 403, body: { error: 'Recipient mismatch' } };
    }
  } else {
    let peerRow = null;
    try {
      peerRow = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId: recipientRowId,
      });
    } catch (err) {
      log(`unsend: recipient row ${recipientRowId} not fetched (${err.message})`);
    }
    if (!peerRow) {
      error(`unsend: neither row exists for ${messageId}`);
      return { status: 404, body: { error: 'Message not found' } };
    }
    if (peerRow.sender_id !== callerId) {
      error(`unsend: recipient row ${recipientRowId} not sent by caller`);
      return { status: 403, body: { error: 'Not your message' } };
    }
    if (peerRow.original_message_id !== messageId) {
      error(
        `unsend: recipient row ${recipientRowId} does not reference ${messageId}`
      );
      return { status: 403, body: { error: 'Message mismatch' } };
    }
    if (peerRow.user_id !== recipientId) {
      error(`unsend: recipient row ${recipientRowId} not owned by ${recipientId}`);
      return { status: 403, body: { error: 'Recipient mismatch' } };
    }
  }
  const now = new Date().toISOString();
  const wipe = {
    content: '',
    task_ref_id: '',
    task_ref_title: '',
    task_ref_date: '',
    task_ref_color: '',
    diary_ref_id: '',
    diary_ref_owner_id: '',
    diary_ref_date: '',
    diary_ref_excerpt: '',
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
    const candidates = [];
    let cursor = undefined;
    let pages = 0;
    const MAX_PAGES = 5;
    for (;;) {
      const queries = [
        Query.equal('user_id', senderId),
        Query.equal('created_at', createdAt),
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
      for (const r of rows) {
        if ((r.content || '') === content && r.direction === 'outgoing') {
          candidates.push(r);
        }
      }
      pages++;
      if (rows.length < 100) break;
      const lastId = rows[rows.length - 1].$id;
      if (!lastId || lastId === cursor) break;
      cursor = lastId;
      if (pages >= MAX_PAGES) {
        log(
          `resolveLegacyPeerRowId: hit maxPages=${MAX_PAGES} for ${myRow.$id} (candidates=${candidates.length})`
        );
        break;
      }
    }
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
  const p = payload || {};
  if (!isValidRowId(p.myRowId)) {
    error('react: invalid myRowId');
    return { status: 400, body: { error: 'Invalid myRowId' } };
  }
  const myRowId = p.myRowId;
  let peerRowId = '';
  if (p.peerRowId !== undefined && p.peerRowId !== null && p.peerRowId !== '') {
    if (!isValidRowId(p.peerRowId)) {
      error('react: invalid peerRowId');
      return { status: 400, body: { error: 'Invalid peerRowId' } };
    }
    peerRowId = p.peerRowId;
  }
  if (!isValidRowId(p.recipientId)) {
    error('react: invalid recipientId');
    return { status: 400, body: { error: 'Invalid recipientId' } };
  }
  const recipientId = p.recipientId;
  const vEmoji = validateEmoji(p.emoji);
  if (!vEmoji.ok) {
    error('react: invalid emoji');
    return { status: 400, body: { error: 'Invalid emoji' } };
  }
  const emoji = vEmoji.value;
  if (p.op !== 'add' && p.op !== 'remove') {
    error('react: op must be add or remove');
    return { status: 400, body: { error: 'Invalid op' } };
  }
  const op = p.op;
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
  let reactionAdded = false;
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
  const prepared = [];
  for (const rowId of targets) {
    try {
      const row = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: MESSAGES_TABLE,
        rowId,
      });
      if (row.sender_id !== callerId && row.recipient_id !== callerId) {
        log(`react: row ${rowId} caller not a participant, skipping`);
        continue;
      }
      const current = parseReactions(row.reactions || '');
      if (op === 'add' && row.user_id === callerId &&
          !current.some(item => item.emoji === emoji && item.userIds.includes(callerId))) {
        reactionAdded = true;
      }
      const next = applyReactionDelta(current, emoji, callerId, op);
      const nextStr = stringifyReactions(next);
      if (nextStr.length > REACTIONS_MAX_LEN) {
        error(
          `react: reactions overflow on ${rowId} (${nextStr.length} > ${REACTIONS_MAX_LEN})`
        );
        return { status: 400, body: { error: 'Too many reactions' } };
      }
      prepared.push({ rowId, nextStr });
    } catch (err) {
      log(`react: row ${rowId} read skipped (${err.message})`);
    }
  }
  for (const { rowId, nextStr } of prepared) {
    try {
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
  return { status: 200, body: { ok: true, updated, resolvedPeerRowId,
    reactionAdded, originalAuthorId: myRow?.sender_id || '',
    originalMessageId: myRow?.original_message_id || myRow?.$id || '' } };
}
async function handleReactToTask(tablesDB, callerId, payload, log, error) {
  const p = payload || {};
  if (!isValidRowId(p.taskId)) {
    error('react_to_task: invalid taskId');
    return { status: 400, body: { error: 'Invalid taskId' } };
  }
  const taskId = p.taskId;
  if (!isValidRowId(p.taskOwnerId)) {
    error('react_to_task: invalid taskOwnerId');
    return { status: 400, body: { error: 'Invalid taskOwnerId' } };
  }
  const taskOwnerId = p.taskOwnerId;
  const vEmoji = validateEmoji(p.emoji);
  if (!vEmoji.ok) {
    error('react_to_task: invalid emoji');
    return { status: 400, body: { error: 'Invalid emoji' } };
  }
  const emoji = vEmoji.value;
  if (p.op !== 'add' && p.op !== 'remove') {
    error('react_to_task: op must be add or remove');
    return { status: 400, body: { error: 'Invalid op' } };
  }
  const op = p.op;
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
  if (row.deleted === true || !isScheduledTask(row)) {
    error(`react_to_task: task ${taskId} is deleted`);
    return { status: 404, body: { error: 'Task not found' } };
  }
  let effectiveVisibility = 'private';
  const taskVis = row.visibility;
  if (taskVis && taskVis !== '') {
    effectiveVisibility = taskVis;
  } else if (row.category_id) {
    try {
      const cat = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: CATEGORIES_TABLE,
        rowId: row.category_id,
      });
      if (cat.deleted === true) {
        effectiveVisibility = 'private';
      } else {
        effectiveVisibility = cat.visibility || 'private';
      }
    } catch (err) {
      log(
        `react_to_task: category ${row.category_id} fetch failed (${err.message})`
      );
      effectiveVisibility = 'private';
    }
  } else {
    effectiveVisibility = 'private';
    log(`react_to_task: task ${taskId} has no category; defaulting to private`);
  }
  if (effectiveVisibility === 'private') {
    error(
      `react_to_task: task ${taskId} is private, forbidden for caller ${callerId}`
    );
    return { status: 403, body: { error: 'Task is not visible to you' } };
  }
  const current = parseReactions(row.reactions || '');
  const reactionAdded = op === 'add' &&
    !current.some(item => item.emoji === emoji && item.userIds.includes(callerId));
  const next = applyReactionDelta(current, emoji, callerId, op);
  const nextStr = stringifyReactions(next);
  if (nextStr.length > REACTIONS_MAX_LEN) {
    error(
      `react_to_task: reactions overflow on ${taskId} (${nextStr.length} > ${REACTIONS_MAX_LEN})`
    );
    return { status: 400, body: { error: 'Too many reactions' } };
  }
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
  return { status: 200, body: { ok: true, reactions: nextStr, reactionAdded } };
}
// Lightweight, privacy-checked alert tap-through. Unlike get_friend_calendar,
// this requires at most a task and category row instead of a user's full history.
async function handleGetFriendTask(tablesDB, callerId, payload, log, error) {
  const friendUserId = payload?.friendUserId;
  const taskId = payload?.taskId;
  const completedAt = payload?.completedAt;
  if (!isValidRowId(friendUserId) || !isValidRowId(taskId) ||
      typeof completedAt !== 'string' || !completedAt || Number.isNaN(Date.parse(completedAt)) ||
      callerId === friendUserId) {
    return { status: 400, body: { error: 'Invalid friend task request' } };
  }
  if (!await verifyFriendship(tablesDB, callerId, friendUserId)) {
    return { status: 403, body: { error: 'Not friends with this user' } };
  }
  let task;
  try {
    task = await tablesDB.getRow({
      databaseId: DATABASE_ID, tableId: TASKS_TABLE, rowId: taskId,
    });
  } catch (cause) {
    if (Number(cause?.code || cause?.status) !== 404) throw cause;
    return { status: 404, body: { error: 'Task unavailable' } };
  }
  if (task.user_id !== friendUserId || task.deleted === true ||
      !isScheduledTask(task) || task.is_completed !== true || task.completed_at !== completedAt) {
    return { status: 404, body: { error: 'Task unavailable' } };
  }
  let category = null;
  if (isValidRowId(task.category_id)) {
    try {
      const row = await tablesDB.getRow({
        databaseId: DATABASE_ID, tableId: CATEGORIES_TABLE, rowId: task.category_id,
      });
      if (row.user_id === friendUserId && row.deleted !== true) category = row;
    } catch (cause) {
      if (Number(cause?.code || cause?.status) !== 404) throw cause;
    }
  }
  const visibility = task.visibility || category?.visibility || 'private';
  if (visibility === 'private') {
    return { status: 404, body: { error: 'Task unavailable' } };
  }
  log(`get_friend_task: caller=${callerId} friend=${friendUserId}`);
  return {
    status: 200,
    body: {
      task,
      // A task-level visibility override must not expose the parent
      // category's private name, color, or metadata.
      category: category?.visibility !== 'private' ? category : null,
    },
  };
}


async function findVisibleFriendDiary(tablesDB, callerId, diaryId, ownerId) {
  if (!isValidRowId(ownerId) || !isValidRowId(diaryId) || callerId === ownerId) return null;
  if (!await verifyFriendship(tablesDB, callerId, ownerId)) return null;
  let row;
  try { row = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId: diaryId }); }
  catch { return null; }
  if (row.user_id !== ownerId || row.deleted === true ||
    isDiaryQuoteRevocationPending(row) ||
    !['public','followers'].includes(row.visibility)) return null;
  return row;
}

async function handleReactToDiary(tablesDB, callerId, payload, log, error) {
  const { friendUserId: ownerId, diaryId, emoji, op } = payload || {};
  const valid = validateEmoji(emoji);
  if (!valid.ok || (op !== 'add' && op !== 'remove'))
    return { status: 400, body: { error: 'Invalid diary reaction' } };
  const diary = await findVisibleFriendDiary(tablesDB, callerId, diaryId, ownerId);
  if (!diary) return { status: 403, body: { error: 'Diary unavailable' } };
  const rowId = 'dr_' + sha256Hex(diaryId + '|' + callerId + '|' + valid.value).slice(0, 30);
  const now = new Date().toISOString();
  const table = { databaseId: DATABASE_ID, tableId: DIARY_REACTIONS_TABLE, rowId };
  let existing = null;
  try { existing = await tablesDB.getRow(table); } catch (cause) {
    if (Number(cause?.code) !== 404) throw cause;
  }
  let created = false;
  if (!existing && op === 'add') {
    try {
      await tablesDB.createRow({ ...table, data: {
        diary_id: diaryId, owner_id: ownerId, user_id: callerId, date: diary.date,
        emoji: valid.value, deleted: false, created_at: now, updated_at: now,
      }, permissions: [] });
      created = true;
      existing = { diary_id: diaryId, owner_id: ownerId, user_id: callerId, deleted: false, updated_at: now };
    } catch (cause) {
      if (Number(cause?.code) !== 409) throw cause;
      existing = await tablesDB.getRow(table);
    }
  }
  if (!existing) return { status: 200, body: { ok: true, changed: false } };
  if (existing.diary_id !== diaryId || existing.user_id !== callerId ||
    existing.owner_id !== ownerId)
    return { status: 403, body: { error: 'Diary reaction unavailable' } };
  const changed = created || Boolean(existing.deleted) === (op === 'add');
  const eventAt = changed ? now : (existing.updated_at || existing.created_at);
  if (changed && !created) {
    await tablesDB.updateRow({ ...table, data: { deleted: op === 'remove', updated_at: now } });
  }
  if (op === 'add') {
    // One durable activity message per add transition. Retries reuse its ID.
    const messageId = 'msg_dr_' + sha256Hex(rowId + '|' + eventAt).slice(0, 27);
    const delivery = await handleDeliver(tablesDB, callerId, {
      messageId, recipientId: ownerId,
      content: `Reacted ${valid.value} to your diary`,
      diaryRefId: diaryId, diaryRefOwnerId: ownerId, diaryRefDate: diary.date,
      createdAt: eventAt, diaryRefEpoch: diary.quote_epoch || 0,
    }, log, error);
    if (delivery.status !== 200) return delivery;
  }
  return { status: 200, body: { ok: true, changed } };
}
async function handleGetOwnerDiaryReactions(tablesDB, callerId, payload, log) {
  const diaryId = payload?.diaryId;
  if (!isValidRowId(diaryId)) return { status: 400, body: { error: 'Invalid diary' } };
  let diary;
  try {
    diary = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId: diaryId });
  } catch (cause) {
    if (Number(cause?.code) === 404) return { status: 404, body: { error: 'Diary unavailable' } };
    throw cause;
  }
  if (diary.user_id !== callerId || diary.deleted === true) {
    return { status: 403, body: { error: 'Diary unavailable' } };
  }
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(diary.date || '')) {
    return { status: 400, body: { error: 'Invalid diary date' } };
  }
  // Use the same bounded owner/month access pattern as friend month reads.
  const month = diary.date.slice(0, 7);
  const [year, number] = month.split('-').map(Number);
  const nextMonth = number === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(number + 1).padStart(2, '0')}-01`;
  const rows = await listAllRows(tablesDB, DIARY_REACTIONS_TABLE, [
    Query.equal('owner_id', callerId), Query.equal('deleted', false),
    Query.greaterThanEqual('date', month + '-01'), Query.lessThan('date', nextMonth),
  ], log, 10);
  if (rows.length > 500) return { status: 503, body: { error: 'Reaction summary too large' } };
  const byEmoji = new Map();
  for (const item of rows) {
    if (item.diary_id !== diaryId || item.owner_id !== callerId ||
      item.deleted === true || typeof item.emoji !== 'string' ||
      !isValidRowId(item.user_id)) continue;
    // Former friends cannot continue to appear as active diary reactions.
    if (!await verifyFriendship(tablesDB, callerId, item.user_id)) continue;
    if (!byEmoji.has(item.emoji)) byEmoji.set(item.emoji, new Set());
    byEmoji.get(item.emoji).add(item.user_id);
  }
  return { status: 200, body: {
    reactions: JSON.stringify([...byEmoji].map(([emoji, ids]) => ({ emoji, userIds: [...ids] }))),
  } };
}

async function handleGetFriendDiaryPhoto(tablesDB, storage, callerId, payload) {
  const { friendUserId, diaryId, fileId } = payload || {};
  if (!isValidRowId(fileId)) return { status: 400, body: { error: 'Invalid diary photo' } };
  const diary = await findVisibleFriendDiary(tablesDB, callerId, diaryId, friendUserId);
  if (!diary) return { status: 403, body: { error: 'Diary unavailable' } };
  let photos = [];
  try { photos = JSON.parse(diary.photos || '[]'); } catch { return { status: 404, body: { error: 'Photo unavailable' } }; }
  if (!Array.isArray(photos) || !photos.includes(fileId)) return { status: 404, body: { error: 'Photo unavailable' } };
  const file = await storage.getFile({ bucketId: DIARY_PHOTOS_BUCKET, fileId });
  if (file.mimeType !== 'image/webp' || file.sizeOriginal > 262144)
    return { status: 415, body: { error: 'Diary photo unavailable' } };
  const buffer = await storage.getFileDownload({ bucketId: DIARY_PHOTOS_BUCKET, fileId });
  return { status: 200, body: { mimeType: 'image/webp', data: Buffer.from(buffer).toString('base64') } };
}
// Only the diary owner can revoke references. A visibility fence blocks
// previews until the private write is published, without invalidating the
// reference. Permanent deletion increments the epoch and removes its date.
async function handleRevokeDiaryReferences(tablesDB, callerId, payload) {
  const diaryId = payload?.diaryId;
  const revision = payload?.revision;
  const cursor = payload?.cursor || '';
  // Old clients without a mode retain their original permanent behavior.
  const mode = payload?.mode ?? 'permanent';
  if (!['visibility', 'permanent'].includes(mode))
    return { status: 400, body: { error: 'Invalid revocation mode' } };
  if (!isValidRowId(diaryId) || (cursor && !isValidRowId(cursor)) ||
      typeof revision !== 'string' || revision.length > 50 ||
      !Number.isFinite(Date.parse(revision)))
    return { status: 400, body: { error: 'Invalid diary revocation' } };
  let diary;
  try {
    diary = await tablesDB.getRow({
      databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId: diaryId,
    });
  } catch (cause) {
    if (Number(cause?.code) === 404)
      return { status: 404, body: { error: 'Diary unavailable' } };
    throw cause;
  }
  if (diary.user_id !== callerId)
    return { status: 403, body: { error: 'Not your diary' } };
  let epoch = diary.quote_epoch || 0;
  if (diary.quote_revoke_revision !== revision) {
    const olderOrEqual = Number.isFinite(Date.parse(diary.updated_at || '')) &&
      Date.parse(revision) <= Date.parse(diary.updated_at);
    if (olderOrEqual || (diary.quote_revoke_revision &&
        revision <= diary.quote_revoke_revision)) {
      return { status: 409, body: { error: 'Stale diary revision' } };
    }
    if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= 2147483647)
      return { status: 409, body: { error: 'Invalid diary epoch' } };
    if (mode === 'permanent') epoch += 1;
    // Atomic revision/owner predicate keeps the visibility fence ordered.
    const applied = await tablesDB.updateRows({
      databaseId: DATABASE_ID, tableId: DIARY_TABLE,
      queries: [
        Query.equal('$id', diaryId),
        Query.equal('user_id', callerId),
        Query.equal('$updatedAt', diary.$updatedAt),
      ],
      data: { quote_epoch: epoch, quote_revoke_revision: revision },
    });
    if (applied.total !== 1)
      return { status: 409, body: { error: 'Concurrent diary revocation; retry' } };
  }
  const queries = [
    Query.equal('diary_ref_id', diaryId),
    Query.orderAsc('$id'), Query.limit(50),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, queries,
  });
  const rows = result.rows || [];
  if (rows.length > 50) throw Error('Invalid diary quote scan page');
  let scrubbed = 0;
  for (const row of rows) {
    if (row.diary_ref_owner_id !== callerId ||
        (mode === 'permanent' && (row.diary_ref_epoch || 0) >= epoch) ||
        (!row.diary_ref_excerpt && (mode !== 'permanent' || !row.diary_ref_date))) continue;
    await tablesDB.updateRow({
      databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, rowId: row.$id,
      data: { diary_ref_excerpt: '',
        ...(mode === 'permanent' ? { diary_ref_date: '' } : {}),
        updated_at: new Date().toISOString() },
    });
    scrubbed += 1;
  }
  const last = rows.at(-1);
  return {
    status: 200,
    body: {
      ok: true, epoch, scrubbed,
      nextCursor: rows.length === 50 && last?.$id ? last.$id : '',
    },
  };
}

// Resolve quote contents from current authorization, never from snapshots.
async function handleGetDiaryReferencePreviews(tablesDB, callerId, payload) {
  const ids = payload?.messageIds;
  if (!Array.isArray(ids) || ids.length > 25 ||
      ids.some(id => !isValidRowId(id)) || new Set(ids).size !== ids.length)
    return { status: 400, body: { error: 'Invalid diary message IDs' } };
  const previews = {};
  const friendships = new Map();
  const diaries = new Map();
  for (const id of ids) {
    let message;
    try {
      message = await tablesDB.getRow({
        databaseId: DATABASE_ID, tableId: MESSAGES_TABLE, rowId: id,
      });
    } catch (cause) {
      if (Number(cause?.code) === 404) continue;
      throw cause;
    }
    if (!message || message.user_id !== callerId || message.deleted === true ||
        message.is_unsent === true || !isValidRowId(message.diary_ref_id) ||
        !isValidRowId(message.diary_ref_owner_id) ||
        !/^\d{4}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(message.diary_ref_date || '')) continue;
    const ownerId = message.diary_ref_owner_id;
    if (ownerId !== message.sender_id && ownerId !== message.recipient_id) continue;
    if (ownerId !== callerId) {
      if (!friendships.has(ownerId))
        friendships.set(ownerId, await verifyFriendship(tablesDB, callerId, ownerId));
      if (!friendships.get(ownerId)) continue;
    }
    if (!diaries.has(message.diary_ref_id)) {
      let row = null;
      try {
        row = await tablesDB.getRow({
          databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId: message.diary_ref_id,
        });
      } catch (cause) {
        if (Number(cause?.code) !== 404) throw cause;
      }
      diaries.set(message.diary_ref_id, row);
    }
    const diary = diaries.get(message.diary_ref_id);
    if (!diary || diary.user_id !== ownerId || diary.deleted === true ||
        isDiaryQuoteRevocationPending(diary) ||
        !['public', 'followers'].includes(diary.visibility) ||
        diary.date !== message.diary_ref_date ||
        (message.diary_ref_epoch || 0) !== (diary.quote_epoch || 0)) continue;
    previews[id] = {
      date: diary.date,
      excerpt: String(diary.content || '').replace(/\s+/g, ' ').trim().slice(0, 120) ||
        String(diary.emoji || '').slice(0, 32) || 'Diary photos',
    };
  }
  return { status: 200, body: { previews } };
}

async function handleGetFriendDiaryMonth(tablesDB, callerId, payload, log, error) {
  const friendUserId = payload?.friendUserId;
  const month = payload?.month;
  if (!isValidRowId(friendUserId) || friendUserId === callerId ||
      typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { status: 400, body: { error: 'Invalid friend diary request' } };
  }
  const isFriend = await verifyFriendship(tablesDB, callerId, friendUserId);
  if (!isFriend) return { status: 403, body: { error: 'Not friends with this user' } };
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const rows = await listAllRows(tablesDB, 'diary', [
    Query.equal('user_id', friendUserId), Query.equal('deleted', false),
    Query.greaterThanEqual('date', month + '-01'),
    Query.lessThan('date', nextMonth),
  ], log, 2);
  if (rows.length > 60) {
    error('get_friend_diary_month: unexpected row count');
    return { status: 500, body: { error: 'Friend diary unavailable' } };
  }
  const entries = rows.filter(row =>
    row.user_id === friendUserId && row.deleted !== true &&
    row.date >= month + '-01' && row.date < nextMonth &&
    (row.visibility === 'public' || row.visibility === 'followers') &&
    !isDiaryQuoteRevocationPending(row)
  ).map(row => ({
    $id: row.$id, user_id: row.user_id, date: row.date,
    content: row.content || '', emoji: row.emoji || '', photos: row.photos || '[]', visibility: row.visibility,
    quote_epoch: row.quote_epoch || 0,
    created_at: row.created_at || row.$createdAt || '',
    updated_at: row.updated_at || row.$updatedAt || '',
    deleted: false,
  }));
  const diaryIds = new Set(entries.map(entry => entry.$id));
  if (diaryIds.size > 0) {
    const rawReactions = await listAllRows(tablesDB, DIARY_REACTIONS_TABLE, [
      Query.equal('owner_id', friendUserId), Query.equal('deleted', false),
      Query.greaterThanEqual('date', month + '-01'), Query.lessThan('date', nextMonth),
    ], log, 10);
    const grouped = new Map();
    for (const reaction of rawReactions) {
      if (!diaryIds.has(reaction.diary_id)) continue;
      const id = reaction.diary_id;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(reaction);
    }
    for (const entry of entries) {
      const all = grouped.get(entry.$id) || [];
      const byEmoji = new Map();
      for (const item of all) {
        if (!byEmoji.has(item.emoji)) byEmoji.set(item.emoji, []);
        byEmoji.get(item.emoji).push(item.user_id);
      }
      entry.reactions = JSON.stringify([...byEmoji].map(([emoji,userIds]) => ({ emoji, userIds })));
    }
  }
  return { status: 200, body: { entries } };
}
async function handleGetFriendCalendar(tablesDB, callerId, payload, log, error) {
  const p = payload || {};
  if (!isValidRowId(p.friendUserId)) {
    error('get_friend_calendar: invalid friendUserId');
    return { status: 400, body: { error: 'Invalid friendUserId' } };
  }
  const friendUserId = p.friendUserId;
  if (callerId === friendUserId) {
    error('get_friend_calendar: Cannot query your own calendar');
    return { status: 400, body: { error: 'Cannot query your own calendar' } };
  }
  const isFriend = await verifyFriendship(tablesDB, callerId, friendUserId);
  if (!isFriend) {
    error(
      `get_friend_calendar: Forbidden, no accepted friendship ${callerId} -> ${friendUserId}`
    );
    return { status: 403, body: { error: 'Not friends with this user' } };
  }
  let categoryRows = [];
  let taskRows = [];
  // These independent, owner-scoped queries used to run serially, doubling
  // Function network latency for friends with large task histories.
  const [categoryResult, taskResult] = await Promise.allSettled([
    listAllRows(tablesDB, CATEGORIES_TABLE, [
      Query.equal('user_id', friendUserId),
      Query.equal('deleted', false),
    ], log),
    listAllRows(tablesDB, TASKS_TABLE, [
      Query.equal('user_id', friendUserId),
      Query.equal('deleted', false),
    ], log),
  ]);
  if (categoryResult.status === 'rejected') {
    error(`get_friend_calendar: categories fetch failed (${categoryResult.reason.message})`);
    return { status: 500, body: { error: 'Failed to fetch categories' } };
  }
  if (taskResult.status === 'rejected') {
    error(`get_friend_calendar: tasks fetch failed (${taskResult.reason.message})`);
    return { status: 500, body: { error: 'Failed to fetch tasks' } };
  }
  categoryRows = categoryResult.value;
  taskRows = taskResult.value;
  categoryRows.sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : 0;
    const bo = typeof b.order === 'number' ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return String(a.$id).localeCompare(String(b.$id));
  });
  const categoryVisibility = new Map();
  for (const c of categoryRows) {
    categoryVisibility.set(c.$id, c.visibility || 'private');
  }
  taskRows.sort((a, b) => {
    const ad = (a.date || '').localeCompare(b.date || '');
    if (ad !== 0) return ad;
    return String(a.$id).localeCompare(String(b.$id));
  });
  const visibleTasks = taskRows.filter((t) => {
    if (!isScheduledTask(t)) return false;
    const taskVis = t.visibility;
    const effective =
      taskVis && taskVis !== ''
        ? taskVis
        : categoryVisibility.get(t.category_id) || 'private';
    return effective !== 'private';
  });
  const visibleCategories = categoryRows.filter(
    (c) => (c.visibility || 'private') !== 'private'
  );
  log(
    `get_friend_calendar: caller=${callerId} friend=${friendUserId} ` +
      `tasks=${visibleTasks.length}/${taskRows.length} ` +
      `categories=${visibleCategories.length}/${categoryRows.length}`
  );
  return {
    status: 200,
    body: {
      tasks: visibleTasks,
      categories: visibleCategories,
      fetchedAt: new Date().toISOString(),
    },
  };
}
const handler = async ({ req, res, log, error }) => {
  let payload = {};
  if (req.headers['x-appwrite-trigger'] !== 'schedule') {
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      error(`Bad Request: ${e.message}`);
      return res.json({ error: 'Bad Request' }, 400);
    }
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);
  const storage = new Storage(client);
  const users = new Users(client);
  const functions = new Functions(client);

  if (req.headers['x-appwrite-trigger'] === 'event') {
    const eventName = req.headers['x-appwrite-event'] || '';
    if (
      eventName.includes('.tables.tasks.rows.') &&
      (eventName.endsWith('.create') || eventName.endsWith('.update'))
    ) {
      try {
        const result = await handleTaskCompletionEvent(
          tablesDB,
          payload,
          eventName,
          log,
          error
        );
        return res.json(result.body, result.status);
      } catch (err) {
        error(`Task completion event failed: ${err.message}`);
        return res.json({ error: 'Task completion event failed' }, 500);
      }
    }
    return res.json({ ok: true, ignored: true }, 200);
  }

  if (req.headers['x-appwrite-trigger'] === 'schedule') {
    try {
      const deletionResult = await resumeDeletionJobs({
        db: tablesDB,
        storage,
        users,
        functions,
        log,
      });
      log(
        `account-deletion: scheduled processed=${deletionResult.processed} failed=${deletionResult.failed}`
      );
    } catch (err) {
      error(`account-deletion scheduled retry failed: ${err.message}`);
      return res.json({ error: 'Account deletion maintenance failed' }, 500);
    }

    // Run ordinary tombstone GC on the same hourly maintenance trigger.
    // It is idempotent and keeps the schedule deterministic for retries/tests.
    return handleScheduledTombstoneGc({ req, res, log, error });
  }

  const action = payload?.action;
  if (!action || typeof action !== 'string') {
    error('Missing action');
    return res.json({ error: 'Missing action' }, 400);
  }

  const callerId = req.headers['x-appwrite-user-id'];
  const internalDeletionResume = action === 'resume_account_deletion';
  if (internalDeletionResume) {
    if (callerId || !req.headers['x-appwrite-key']) {
      error('Forbidden internal account deletion resume');
      return res.json({ error: 'Forbidden' }, 403);
    }
    try {
      const result = await resumeDeletionJobs({
        db: tablesDB,
        storage,
        users,
        functions,
        log,
        jobId: payload.jobId,
      });
      return res.json({ ok: true, ...result }, 200);
    } catch (err) {
      error(`Internal error (${action}): ${err.message}`);
      return res.json({ error: 'Account deletion retry failed' }, 500);
    }
  }

  if (!callerId) {
    error('Unauthorized: no x-appwrite-user-id header');
    return res.json({ error: 'Unauthorized' }, 401);
  }

  try {
    if (action !== 'delete_account') {
      const involvedUsers = new Set(
        [
          callerId,
          payload?.recipientId,
          payload?.taskOwnerId,
          payload?.partnerId,
          payload?.friendUserId,
          payload?.ownerId,
        ].filter((value) => typeof value === 'string' && value)
      );
      for (const userId of involvedUsers) {
        if (await isAccountDeletionPending(tablesDB, userId)) {
          return res.json({ error: 'Account deletion in progress' }, 409);
        }
      }
    }

    let result;
    switch (action) {
      case 'delete_account':
        result = await startAccountDeletion({
          db: tablesDB,
          storage,
          users,
          functions,
          callerId,
          payload,
          functionId:
            process.env.APPWRITE_FUNCTION_ID ||
            process.env.APPWRITE_MESSAGE_ACTION_FUNCTION_ID ||
            '6aa8057f002a4c306fdd',
          log,
        });
        break;
      case 'delete_account_friendships':
        if (payload.ownerId !== callerId) return res.json({ error: 'Account changed' }, 403);
        result = await deleteAccountFriendships(tablesDB, callerId);
        break;
      case 'friendship':
        result = await handleFriendship(tablesDB, callerId, payload);
        if (result.status === 200 && !result.body?.duplicate &&
            ['send','accept'].includes(payload.operation)) {
          const friendId = payload.friendUserId;
          const peerRowId = 'fr_' + sha256Hex(friendId + '|' + callerId).slice(0,32);
          await emitActivity(tablesDB, {
            type: payload.operation === 'send' ? 'friend_request' : 'friend_accepted',
            actorId: callerId, recipientId: friendId, sourceId: peerRowId,
            occurredAt: result.body?.row?.updated_at,
            occurrenceKey: result.body?.row?.updated_at,
          }, log, sendPushToUser).catch(cause => log('activity notification failed: ' + cause.message));
        }
        break;
      case 'task_shares':
        result = await handleTaskShares(tablesDB, callerId, payload);
        if (result.status === 200 && !result.body?.duplicate &&
            payload.operation === 'invite' && result.body?.item?.status === 'pending') {
          await emitActivity(tablesDB, {
            type: 'shared_task_invite', actorId: callerId,
            recipientId: payload.friendUserId, sourceId: result.body.item.id,
            occurrenceKey: result.body.item.grantEpoch,
          }, log, sendPushToUser).catch(cause => log('activity notification failed: ' + cause.message));
        }
        break;
      case 'deliver':
        result = await handleDeliver(tablesDB, callerId, payload, log, error);
        if (result.status === 200 && !result.body?.duplicate) {
          await emitActivity(tablesDB, {
            type: 'direct_message', actorId: callerId,
            recipientId: payload.recipientId, sourceId: result.body.recipientRowId,
            occurrenceKey: payload.messageId,
          }, log, sendPushToUser).catch(cause => log('activity notification failed: ' + cause.message));
        }
        break;
      case 'repair_thread':
        result = await handleRepairThread(tablesDB, callerId, payload);
        break;
      case 'repair_thread_all':
        result = await handleRepairThreadAll(tablesDB, callerId, payload);
        break;
      case 'mark_read':
        result = await handleMarkRead(tablesDB, callerId, payload, log, error);
        break;
      case 'unsend':
        result = await handleUnsend(tablesDB, callerId, payload, log, error);
        break;
      case 'react':
        result = await handleReact(tablesDB, callerId, payload, log, error);
        if (result.status === 200 && result.body?.reactionAdded &&
            result.body?.originalAuthorId === payload.recipientId &&
            result.body?.originalMessageId) {
          await emitActivity(tablesDB, {
            type: 'message_reaction', actorId: callerId,
            recipientId: payload.recipientId, sourceId: result.body.originalMessageId,
            occurrenceKey: payload.emoji,
          }, log, sendPushToUser).catch(cause => log('activity notification failed: ' + cause.message));
        }
        break;
      case 'react_to_task':
        result = await handleReactToTask(tablesDB, callerId, payload, log, error);
        if (result.status === 200 && result.body?.reactionAdded) {
          await emitActivity(tablesDB, {
            type: 'task_reaction', actorId: callerId,
            recipientId: payload.taskOwnerId, sourceId: payload.taskId,
            occurrenceKey: payload.emoji,
          }, log, sendPushToUser).catch(cause => log('activity notification failed: ' + cause.message));
        }
        break;
      case 'compare_and_set_owner_row':
        result = await handleOwnerWriteCas(tablesDB, callerId, payload);
        break;
      case 'bulk_create_todomate_tasks':
        result = await handleTodoMateTaskBatch(tablesDB, callerId, payload);
        break;
      case 'get_friend_task':
        result = await handleGetFriendTask(tablesDB, callerId, payload, log, error);
        break;
      case 'react_to_diary':
        result = await handleReactToDiary(tablesDB, callerId, payload, log, error);
        break;
      case 'get_owner_diary_reactions':
        result = await handleGetOwnerDiaryReactions(tablesDB, callerId, payload, log);
        break;
      case 'get_friend_diary_photo':
        result = await handleGetFriendDiaryPhoto(tablesDB, storage, callerId, payload);
        break;
      case 'revoke_diary_references':
        result = await handleRevokeDiaryReferences(tablesDB, callerId, payload);
        break;
      case 'get_diary_reference_previews':
        result = await handleGetDiaryReferencePreviews(tablesDB, callerId, payload);
        break;
      case 'get_friend_diary_month':
        result = await handleGetFriendDiaryMonth(tablesDB, callerId, payload, log, error);
        break;
      case 'get_friend_calendar':
        result = await handleGetFriendCalendar(
          tablesDB,
          callerId,
          payload,
          log,
          error
        );
        break;
      case 'get_notifications':
        result = await handleGetNotifications(
          tablesDB,
          callerId,
          payload,
          log,
          error
        );
        break;
      case 'get_notification':
        result = await handleGetNotification(tablesDB, callerId, payload);
        break;
      case 'mark_notifications_read':
        result = await handleMarkNotificationsRead(
          tablesDB,
          callerId,
          payload,
          log,
          error
        );
        break;
      case 'get_push_config':
        result = handleGetPushConfig();
        break;
      case 'register_push_subscription':
        result = await handleRegisterPushSubscription(
          tablesDB,
          callerId,
          payload,
          log,
          error
        );
        break;
      case 'get_push_details':
        result = await handleGetPushDetails(tablesDB, callerId, payload);
        break;
      case 'set_push_details':
        result = await handleSetPushDetails(tablesDB, callerId, payload);
        break;
      case 'unregister_push_subscription':
        result = await handleUnregisterPushSubscription(
          tablesDB,
          callerId,
          payload,
          log,
          error
        );
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
handler.sha256Hex = sha256Hex;
handler.makeRecipientRowId = makeRecipientRowId;
handler.parseReactions = parseReactions;
handler.stringifyReactions = stringifyReactions;
handler.applyReactionDelta = applyReactionDelta;
module.exports = handler;
